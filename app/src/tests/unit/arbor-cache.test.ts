import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ComponentCache, ComponentPool } from "../../../../desktop/src/engine/component-pool"
import { AssemblyCache, assemblyKey } from "../../../../desktop/src/engine/assembly-cache"

describe("desktop content caches", () => {
  it("disables caching when a worker build cannot be fingerprinted without rejecting at startup", async () => {
    const pool = new ComponentPool(new URL("file:///does-not-exist/arbor-kernel.mjs"))
    expect(await pool.directory).toBeNull()
    expect(await pool.prepare([], () => {})).toEqual([])
    await pool.dispose()
  })

  it("invalidates geometry for params, nested dependencies, STEP bytes and placements, ignoring derived compiled data", () => {
    const source = { tree: { params: { L: 10 }, features: [{ at: [0, 0, 0] }] }, components: [{ tree: { params: { D: 2 } }, bytes: new Uint8Array([1, 2]) }] }
    const key = assemblyKey(source)
    expect(assemblyKey({ ...source, compiled: { ignored: true } })).toBe(key)
    for (const mutate of [
      (s: typeof source) => { s.tree.params.L = 11 },
      (s: typeof source) => { s.tree.features[0].at[0] = 1 },
      (s: typeof source) => { s.components[0].tree.params.D = 3 },
      (s: typeof source) => { s.components[0].bytes[1] = 3 },
    ]) {
      const changed = structuredClone(source)
      mutate(changed)
      expect(assemblyKey(changed)).not.toBe(key)
    }
  })

  it("round-trips native data and typed previews; corruption becomes a cache miss", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "arbor-cache-test-"))
    try {
      const key = "a".repeat(64)
      const cache = new ComponentCache(dir)
      const native = { parts: [{ name: null, brep: "native data" }], failed: 0 }
      await cache.put(key, native)
      expect(await cache.get(key)).toEqual(native)
      await writeFile(path.join(dir, `${key}.json`), '{"data":"truncated"}')
      expect(await cache.get(key)).toBeNull()
      const preview = new AssemblyCache(dir)
      const data = { display: { index: 0, mesh: { vertices: new Float32Array([1, 2, 3]), normals: new Float32Array([0, 0, 1]), triangles: new Uint32Array([0]) }, groups: [], edges: null, edgeGroups: [], sketch: null, bbox: null, threads: [] }, interferences: [] }
      await preview.put(key, data)
      expect(await preview.get(key)).toEqual(data)
      await writeFile(path.join(dir, `${key}.json`), "broken")
      expect(await preview.get(key)).toBeNull()
      expect((await readdir(dir)).some((f) => f.endsWith(".tmp"))).toBe(false)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
