// Self-update from GitHub Releases. The latest release's turnery-update.json names the version and,
// per platform, a zip of Turnery.app with its size, SHA-256 and a signature from Turnery's own key.
// A newer version is downloaded in the background (Chromium's network stack, so the system
// proxy applies), checked, unpacked next to the installed app, and swapped in when Turnery quits;
// the window offers 重启 to do that now. Checks run shortly after launch and every few hours,
// unless 自动检查更新 is off in the app menu.
import { app, net } from "electron"
import { rm } from "node:fs/promises"
import path from "node:path"
import type { Notice, UpdateStatus } from "../../../app/src/desktop/core/protocol"
import { readSettings, writeSettings } from "../engine/home"
import { bundleOf, cannotReplace, clearStaging, download, stagingDir, swapBundles, unpack } from "../update/install"
import { assetFor, compareVersions, parseManifest, platformKey } from "../update/manifest"
import { UPDATE_PUBLIC_KEY, UPDATE_URL } from "../update/public-key"

const FIRST_CHECK = 15_000
const EVERY = 6 * 60 * 60 * 1000

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type Updater = ReturnType<typeof createUpdater>

export function createUpdater(hooks: { status: (s: UpdateStatus) => void; notice: (n: Notice) => void }) {
  const url = process.env.TURNERY_UPDATE_URL || UPDATE_URL
  const bundle = process.platform === "darwin" && app.isPackaged ? bundleOf(app.getPath("exe")) : null
  // An update unpacked and checked, waiting for Turnery to quit.
  let staged: { version: string; app: string } | null = null
  let status: UpdateStatus = { phase: "idle" }
  let running: Promise<void> | null = null
  /** The person asked (menu): every outcome gets a message, not only a finished download. */
  let asked = false
  let relaunch = false
  // Leftovers of the last update (the old bundle) go first; nothing downloads before that's done.
  // Only from `start()`, i.e. in the instance that holds the single-instance lock: a second
  // launch must not clear the folder under a download the running one has under way.
  let cleared: Promise<void> | null = null
  const clearOnce = () => (cleared ??= bundle && !cannotReplace(bundle) ? clearStaging(bundle).catch(() => {}) : Promise.resolve())

  const set = (s: UpdateStatus) => {
    status = s
    hooks.status(s)
  }

  async function fetchManifest() {
    const res = await net.fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" })
    if (res.status === 404) return null // no release published yet
    if (!res.ok) throw new Error(`读不到更新清单：HTTP ${res.status}`)
    return parseManifest(await res.json())
  }

  async function update() {
    const why = cannotReplace(bundle)
    if (why) throw new Error(why)
    const manifest = await fetchManifest()
    if (!manifest || compareVersions(manifest.version, app.getVersion()) <= 0) {
      if (asked) hooks.notice({ tone: "success", text: `Turnery ${app.getVersion()} 已是最新版本` })
      return
    }
    const { version } = manifest
    const asset = assetFor(manifest, platformKey(), UPDATE_PUBLIC_KEY)
    await clearOnce()
    const dir = stagingDir(bundle!)
    const zip = path.join(dir, `Turnery-${version}.zip`)
    set({ phase: "downloading", version, percent: 0, asked })
    let shown = -1
    try {
      await download(
        (u, init) => net.fetch(u, { ...init, cache: "no-store" }),
        asset,
        zip,
        (bytes) => {
          const percent = Math.floor((bytes / asset.size) * 100)
          if (percent === shown) return
          shown = percent
          set({ phase: "downloading", version, percent, asked })
        },
      )
      const fresh = await unpack(zip, path.join(dir, "new"), version)
      await rm(zip, { force: true })
      staged = { version, app: fresh }
    } catch (e) {
      set({ phase: "idle" })
      throw e
    }
    set({ phase: "ready", version })
    if (asked) hooks.notice({ tone: "success", text: `Turnery ${version} 已下载好，重启后生效` })
  }

  function check(manual: boolean) {
    if (staged) {
      if (manual) hooks.notice({ tone: "info", text: `Turnery ${staged.version} 已下载好，重启后生效` })
      return Promise.resolve()
    }
    if (manual) {
      asked = true
      // A background download already under way: show its progress from here on.
      if (status.phase === "downloading") set({ ...status, asked: true })
    }
    running ??= update()
      .catch((e) => {
        if (asked) hooks.notice({ tone: "error", text: `检查更新失败：${reason(e)}` })
        else console.warn("[turnery] update:", reason(e))
      })
      .finally(() => {
        running = null
        asked = false
      })
    return running
  }

  let timers: NodeJS.Timeout[] = []
  function schedule() {
    for (const t of timers) clearTimeout(t)
    timers = []
    if (!bundle || !readSettings().autoUpdate) return
    const tick = () => void check(false)
    timers = [setTimeout(tick, FIRST_CHECK), setInterval(tick, EVERY)]
  }

  return {
    /** Only a packaged Turnery.app on macOS updates itself. */
    supported: Boolean(bundle),
    status: () => status,
    check,
    get autoUpdate() {
      return readSettings().autoUpdate
    },
    setAutoUpdate(on: boolean) {
      writeSettings({ ...readSettings(), autoUpdate: on })
      schedule()
    },
    /** Once the app is ready (and holds the single-instance lock). */
    start() {
      void clearOnce()
      schedule()
    },
    /** 重启: quit (which installs) and start the new version. */
    restart() {
      if (!staged) return
      relaunch = true
      app.quit()
    },
    /** Called while quitting: put the staged version in place. */
    installOnQuit() {
      for (const t of timers) clearTimeout(t)
      if (!staged || !bundle) return
      try {
        swapBundles(bundle, staged.app)
      } catch (e) {
        console.error("[turnery] update: could not install", reason(e))
      }
      staged = null
      // Starts whichever version is in place now: the new one, or the old one if the swap failed.
      if (relaunch) app.relaunch()
    },
  }
}
