import { mkdtemp, copyFile, stat, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { expect, it } from "vitest"
import { ProjectPreview, previewPath } from "../../../../desktop/src/engine/project-preview"
import { assemblyKey } from "../../../../desktop/src/engine/assembly-cache"
import type { DisplayData } from "@/studio/kernel/build"

const display: DisplayData = {
  index: 0, mesh: { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), triangles: new Uint32Array([0, 1, 2]) },
  groups: [{ hash: 42, origin: "part", status: "new", start: 0, count: 3, part: 0 }], edges: null, edgeGroups: [], sketch: null, threads: [], bbox: [[0, 0, 0], [1, 1, 0]],
  parts: [{ name: "piece", center: [0.5, 0.5, 0], explode: [0, 0, 20] }],
}

it("moves a portable preview with its project, validates dependencies/version, and preserves typed geometry", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "turnery-preview-"))
  const file = path.join(dir, "model.turnery-asm.json"), copy = path.join(dir, "relocated.turnery-asm.json")
  const store = new ProjectPreview()
  const source = { tree: { params: { width: 10 } }, parts: [{ file: "part.json", tree: { params: { length: 20 } } }] }
  const key = assemblyKey(source)
  try {
    await store.write(file, key, "kernel-v1", display)
    expect((await stat(previewPath(file))).size).toBeGreaterThan(64)
    await copyFile(previewPath(file), previewPath(copy))
    expect(await store.read(copy, key, "kernel-v1")).toEqual({ ...display, provisional: true })
    expect(await store.read(copy, key, "kernel-v2")).toBeNull()
    source.parts[0].tree.params.length++
    expect(await store.read(copy, assemblyKey(source), "kernel-v1")).toBeNull()
    await writeFile(previewPath(file), "truncated")
    expect(await store.read(file, key, "kernel-v1")).toBeNull()
    await store.write(file, key, "kernel-v1", { ...display, mesh: { ...display.mesh!, triangles: new Uint32Array([0, 1, 100]) } })
    expect(await store.read(file, key, "kernel-v1")).toBeNull()
    await expect(store.write(path.join(dir, "missing", "part.json"), key, "kernel-v1", display)).resolves.toBeUndefined()
  } finally { await rm(dir, { recursive: true, force: true }) }
})
