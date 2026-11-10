// Getting a new Turnery.app onto the disk, macOS only: download the signed archive next to the
// installed app (same volume, so the final swap is two renames), check it, unpack it there, and
// swap the bundles when Turnery quits. The running app is never touched while it runs: its
// helpers, kernel thread and wasm keep loading from the old bundle until the very end.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { accessSync, constants, createWriteStream, existsSync, renameSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { promisify } from "node:util"
import type { UpdateAsset } from "./manifest"

const run = promisify(execFile)

export const BUNDLE_ID = "com.linjiejim.turnery"

/** The .app around an executable at `Turnery.app/Contents/MacOS/Turnery`, or null. */
export function bundleOf(exe: string) {
  const app = path.resolve(exe, "../../..")
  return app.endsWith(".app") && path.basename(path.dirname(exe)) === "MacOS" ? app : null
}

/** Why this copy can't update itself, or null when it can. */
export function cannotReplace(bundle: string | null) {
  if (!bundle) return "只有打包好的 Turnery.app 能自动更新"
  if (bundle.includes("/AppTranslocation/") || bundle.startsWith("/Volumes/"))
    return "Turnery 正从下载的磁盘映像或隔离位置运行：先把它拖进「应用程序」文件夹再打开，才能自动更新"
  try {
    // Moving a folder to another parent needs write access to it as well as to both parents.
    accessSync(path.dirname(bundle), constants.W_OK)
    accessSync(bundle, constants.W_OK)
  } catch {
    return `没有权限改动 ${bundle}：换一个当前用户能写的位置，或手动下载新版本`
  }
  return null
}

/** Where updates are prepared: a hidden folder next to the app, removed at the next launch. */
export const stagingDir = (bundle: string) => path.join(path.dirname(bundle), ".turnery-update")

/** What's left from an earlier update (the old bundle, a half-done download). */
export const clearStaging = (bundle: string) => rm(stagingDir(bundle), { recursive: true, force: true })

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>

/**
 * Download `asset` to `file`, checking its size and SHA-256 as it streams. Aborts when no data
 * arrives for `stallMs`. `onProgress` gets bytes so far.
 */
export async function download(fetchFn: Fetch, asset: UpdateAsset, file: string, onProgress?: (bytes: number) => void, stallMs = 60_000) {
  const abort = new AbortController()
  let timer = setTimeout(() => abort.abort(), stallMs)
  const poke = () => {
    clearTimeout(timer)
    timer = setTimeout(() => abort.abort(), stallMs)
  }
  try {
    const res = await fetchFn(asset.url, { signal: abort.signal })
    if (!res.ok || !res.body) throw new Error(`下载更新包失败：HTTP ${res.status}`)
    const hash = createHash("sha256")
    let bytes = 0
    const count = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length
        if (bytes > asset.size) return done(new Error("更新包比清单里说的大"))
        hash.update(chunk)
        poke()
        onProgress?.(bytes)
        done(null, chunk)
      },
    })
    await mkdir(path.dirname(file), { recursive: true })
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), count, createWriteStream(file))
    if (bytes !== asset.size) throw new Error(`更新包大小不对：${bytes}，应为 ${asset.size}`)
    if (hash.digest("hex") !== asset.sha256) throw new Error("更新包的 SHA-256 和清单不符")
  } catch (e) {
    if (abort.signal.aborted) throw new Error(`下载更新包 ${stallMs / 1000} 秒没有进展，已停止`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Unpack the archive into `dir` and check it holds an Turnery.app of `version`. Returns that .app. */
export async function unpack(zip: string, dir: string, version: string) {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  // ditto keeps the bundle's symlinks and permissions (the frameworks rely on both).
  await run("/usr/bin/ditto", ["-x", "-k", zip, dir])
  const app = path.join(dir, "Turnery.app")
  const plist = path.join(app, "Contents/Info.plist")
  if (!existsSync(plist)) throw new Error("更新包里没有 Turnery.app")
  const read = async (key: string) => (await run("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plist])).stdout.trim()
  const [id, v] = await Promise.all([read("CFBundleIdentifier"), read("CFBundleShortVersionString")])
  if (id !== BUNDLE_ID) throw new Error(`更新包里的 App 不是 Turnery（${id}）`)
  if (v !== version) throw new Error(`更新包里的 Turnery 是 ${v}，不是 ${version}`)
  return app
}

/**
 * Put `fresh` where `bundle` is. Synchronous: it runs while Turnery quits. The old bundle moves into
 * the staging folder (cleared at the next launch); if the second rename fails it is put back.
 */
export function swapBundles(bundle: string, fresh: string) {
  const old = path.join(stagingDir(bundle), `old-${Date.now()}.app`)
  renameSync(bundle, old)
  try {
    renameSync(fresh, bundle)
  } catch (e) {
    renameSync(old, bundle)
    throw e
  }
}
