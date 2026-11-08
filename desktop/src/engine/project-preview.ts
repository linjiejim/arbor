// A portable, derived project artifact. It travels with the assembly, unlike
// ARBOR_HOME caches. The complete dependency key prevents stale geometry flashes.
import { createHash, randomUUID } from "node:crypto"
import { readFile, rename, rm, writeFile } from "node:fs/promises"
import { gzip, gunzip } from "node:zlib"
import { promisify } from "node:util"
import type { DisplayData } from "../../../app/src/studio/kernel/build"

const compress = promisify(gzip), decompress = promisify(gunzip)
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export const previewPath = (assembly: string) => assembly.replace(/\.json$/i, "") + ".preview"
const FORMAT = 1

export class ProjectPreview {
  async read(assembly: string, key: string, kernel: string): Promise<DisplayData | null> {
    try {
      const bytes = await readFile(previewPath(assembly))
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

  async write(assembly: string, key: string, kernel: string, display: DisplayData) {
    const file = previewPath(assembly), temp = `${file}.${randomUUID()}.tmp`
    try {
      if (!display.mesh || !display.bbox) return
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
