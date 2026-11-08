import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { serialize, deserialize } from "node:v8"
import type { BuildReport, DisplayData } from "../../../app/src/studio/kernel/build"
import { contentKey } from "./content-key"
import { ComponentCache } from "./component-pool"

export type AssemblySnapshot = { display: DisplayData; interferences: BuildReport["interferences"] }
const hash = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex")

/** The complete dependency content, including shared params and STEP bytes. */
export const assemblyKey = contentKey

/** Binary typed-array previews; never used for picking until fresh B-reps are ready. */
export class AssemblyCache {
  constructor(private readonly dir: string) {}
  async get(key: string): Promise<AssemblySnapshot | null> {
    try {
      const data = await readFile(path.join(this.dir, `${key}.json`))
      const checksum = data.subarray(0, 64).toString()
      const payload = data.subarray(64)
      if (hash(payload) !== checksum) return null
      const value = deserialize(payload) as AssemblySnapshot
      if (!value.display || !(value.display.mesh?.vertices instanceof Float32Array) || !(value.display.mesh.triangles instanceof Uint32Array)) return null
      return value
    } catch { return null }
  }
  async put(key: string, snapshot: AssemblySnapshot) {
    const file = path.join(this.dir, `${key}.json`)
    const temp = `${file}.${process.pid}.tmp`
    try {
      await mkdir(this.dir, { recursive: true })
      const data = serialize(snapshot)
      await writeFile(temp, Buffer.concat([Buffer.from(hash(data)), data]), { mode: 0o600 })
      await rename(temp, file)
      await new ComponentCache(this.dir).trim()
    } catch { await rm(temp, { force: true }).catch(() => {}) }
  }
}
