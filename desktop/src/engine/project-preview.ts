// A portable, derived project artifact. It travels with the project folder, unlike
// TURNERY_HOME caches. The complete dependency key prevents stale geometry flashes.
//
// Previews live in one hidden folder, `.turnery/cache/` at the top of the project (beside the
// assembly when it is opened on its own), under the assembly's path in the project. They used to
// sit next to each assembly as `*-asm.preview`; those are moved in (or dropped, when their assembly
// is gone) the next time an assembly beside them is opened.
import { createHash, randomUUID } from "node:crypto"
import { access, mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { gzip, gunzip } from "node:zlib"
import { promisify } from "node:util"
import type { DisplayData } from "../../../app/src/studio/kernel/build"

const compress = promisify(gzip), decompress = promisify(gunzip)
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const FORMAT = 1
/** In a project: everything Turnery derives and can make again. Safe to delete. */
export const CACHE_DIR = path.join(".turnery", "cache")
const stem = (assembly: string) => assembly.replace(/\.json$/i, "")
const within = (root: string, file: string) => !path.relative(root, file).startsWith("..") && !path.isAbsolute(path.relative(root, file))

/** Where an assembly's preview is kept. `root`: the project it is in (none, or outside it: its own folder). */
export function previewPath(assembly: string, root?: string | null) {
  const base = root && within(root, assembly) ? root : path.dirname(assembly)
  return path.join(base, CACHE_DIR, `${stem(path.relative(base, assembly))}.preview`)
}
/** Before 0.9: beside the assembly. */
export const legacyPreviewPath = (assembly: string) => `${stem(assembly)}.preview`

const exists = (file: string) => access(file).then(() => true, () => false)

/** One of ours: 64 hex digits of checksum, then gzip. Nothing else is ever moved or removed. */
async function isPreview(file: string) {
  const handle = await open(file, "r").catch(() => null)
  if (!handle) return false
  try {
    const head = Buffer.alloc(66)
    const { bytesRead } = await handle.read(head, 0, 66, 0)
    return bytesRead === 66 && /^[0-9a-f]{64}$/.test(head.subarray(0, 64).toString("latin1")) && head[64] === 0x1f && head[65] === 0x8b
  } finally { await handle.close() }
}

/**
 * Previews left beside the assemblies in `dir` by earlier versions: into the cache folder when their
 * assembly is still there, removed when it isn't. And previews in the cache whose assembly is gone
 * (renamed, deleted). Never throws: a read-only folder just stays as it is.
 */
export async function tidyPreviews(dir: string, root?: string | null) {
  try {
    for (const name of await readdir(dir)) {
      if (!/-asm\.preview$/i.test(name)) continue
      const old = path.join(dir, name)
      if (!(await isPreview(old))) continue
      const assembly = `${old.slice(0, -".preview".length)}.json`
      const target = previewPath(assembly, root)
      if ((await exists(assembly)) && !(await exists(target))) {
        await prepare(target, root && within(root, assembly) ? root : dir)
        await rename(old, target)
      } else await rm(old, { force: true })
    }
  } catch { /* leave it */ }
  try {
    const base = root && within(root, dir) ? root : dir
    const cache = path.join(base, CACHE_DIR, path.relative(base, dir))
    for (const name of await readdir(cache)) {
      if (!name.endsWith(".preview")) continue
      if (!(await exists(path.join(dir, `${name.slice(0, -".preview".length)}.json`)))) await rm(path.join(cache, name), { force: true })
    }
  } catch { /* no cache yet */ }
}

/** Make the cache folder for `file`; it keeps itself out of git (derived, and rewritten on every change). */
async function prepare(file: string, base: string) {
  await mkdir(path.dirname(file), { recursive: true })
  const ignore = path.join(base, CACHE_DIR, ".gitignore")
  if (!(await exists(ignore))) await writeFile(ignore, "# Turnery 的缓存：打开装配时的预览，可以随时删掉\n*\n").catch(() => {})
}

export class ProjectPreview {
  async read(assembly: string, key: string, kernel: string, root?: string | null): Promise<DisplayData | null> {
    await tidyPreviews(path.dirname(assembly), root)
    try {
      const bytes = await readFile(previewPath(assembly, root))
      const payload = bytes.subarray(64)
      if (digest(payload) !== bytes.subarray(0, 64).toString()) return null
      const json = await decompress(payload, { maxOutputLength: 128 * 1024 * 1024 })
      const data = JSON.parse(json.toString(), (_key, value) => {
        if (!value || typeof value !== "object" || !["f32", "u32"].includes(value.array)) return value
        const bytes = Buffer.from(value.data, "base64")
        if (bytes.length % 4) throw new Error("Invalid preview buffer")
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        return value.array === "f32" ? new Float32Array(buffer) : new Uint32Array(buffer)
      })
      if (data.format !== FORMAT || data.key !== key || data.kernel !== kernel) return null
      const d = data.display as DisplayData
      if (!d?.mesh || !(d.mesh.vertices instanceof Float32Array) || !(d.mesh.normals instanceof Float32Array) || !(d.mesh.triangles instanceof Uint32Array)) return null
      if (d.mesh.vertices.length % 3 || d.mesh.normals.length !== d.mesh.vertices.length || d.mesh.triangles.length % 3) return null
      if (!d.mesh.vertices.every(Number.isFinite) || !d.mesh.normals.every(Number.isFinite) || !d.mesh.triangles.every((i) => i < d.mesh!.vertices.length / 3)) return null
      if (!Array.isArray(d.groups) || !Array.isArray(d.edgeGroups) || !Array.isArray(d.threads)) return null
      if (!d.groups.every((g) => typeof g.origin === "string" && Number.isInteger(g.start) && Number.isInteger(g.count) && g.start >= 0 && g.count >= 0 && g.start + g.count <= d.mesh!.triangles.length)) return null
      if (d.edges !== null && !(d.edges instanceof Float32Array)) return null
      if (!d.edgeGroups.every((g) => g.start >= 0 && g.count >= 0 && (g.start + g.count) * 3 <= (d.edges?.length ?? 0))) return null
      if (!d.bbox || !d.bbox.flat().every(Number.isFinite) || d.bbox.some((p) => p.length !== 3)) return null
      if (d.parts && !d.parts.every((p) => typeof p.name === "string" && p.center.length === 3 && p.explode.length === 3 && [...p.center, ...p.explode].every(Number.isFinite))) return null
      return { ...d, provisional: true }
    } catch { return null }
  }

  async write(assembly: string, key: string, kernel: string, display: DisplayData, root?: string | null) {
    const file = previewPath(assembly, root), temp = `${file}.${randomUUID()}.tmp`
    try {
      if (!display.mesh || !display.bbox) return
      // Only beside an assembly that is there: a path that leads nowhere gets no folder made for it.
      if (!(await exists(assembly))) return
      await prepare(file, root && within(root, assembly) ? root : path.dirname(assembly))
      const json = JSON.stringify({ format: FORMAT, key, kernel, display: { ...display, provisional: undefined } }, (_key, value) => {
        if (value instanceof Float32Array || value instanceof Uint32Array) return { array: value instanceof Float32Array ? "f32" : "u32", data: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64") }
        return value
      })
      const bytes = await compress(json)
      await writeFile(temp, Buffer.concat([Buffer.from(digest(bytes)), bytes]), { mode: 0o600 })
      await rename(temp, file)
    } catch { await rm(temp, { force: true }).catch(() => {}) }
  }
}
