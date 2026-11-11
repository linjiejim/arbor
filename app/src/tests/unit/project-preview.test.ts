import { mkdtemp, copyFile, mkdir, readdir, readFile, stat, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { expect, it } from "vitest"
import { ProjectPreview, legacyPreviewPath, previewPath } from "../../../../desktop/src/engine/project-preview"
import { assemblyKey } from "../../../../desktop/src/engine/assembly-cache"
import type { DisplayData } from "@/studio/kernel/build"

const display: DisplayData = {
  index: 0, mesh: { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), triangles: new Uint32Array([0, 1, 2]) },
  groups: [{ hash: 42, origin: "part", status: "new", start: 0, count: 3, part: 0 }], edges: null, edgeGroups: [], sketch: null, threads: [], bbox: [[0, 0, 0], [1, 1, 0]],
  parts: [{ name: "piece", center: [0.5, 0.5, 0], explode: [0, 0, 20] }],
}
const exists = (file: string) => stat(file).then(() => true, () => false)

it("moves a portable preview with its project, validates dependencies/version, and preserves typed geometry", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "turnery-preview-"))
  const file = path.join(dir, "model.turnery-asm.json"), copy = path.join(dir, "relocated.turnery-asm.json")
  const store = new ProjectPreview()
  const source = { tree: { params: { width: 10 } }, parts: [{ file: "part.json", tree: { params: { length: 20 } } }] }
  const key = assemblyKey(source)
  try {
    await writeFile(file, "{}")
    await writeFile(copy, "{}")
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
    expect(await exists(path.join(dir, "missing"))).toBe(false)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

it("keeps every preview in the project's one cache folder, out of git and out of the way", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnery-preview-"))
  const top = path.join(root, "box.turnery-asm.json"), nested = path.join(root, "assemblies", "kit.arbor-asm.json")
  const store = new ProjectPreview()
  try {
    await mkdir(path.dirname(nested))
    await writeFile(top, "{}")
    await writeFile(nested, "{}")
    await store.write(top, "k", "kernel", display, root)
    await store.write(nested, "k", "kernel", display, root)
    expect(previewPath(top, root)).toBe(path.join(root, ".turnery", "cache", "box.turnery-asm.preview"))
    expect(previewPath(nested, root)).toBe(path.join(root, ".turnery", "cache", "assemblies", "kit.arbor-asm.preview"))
    // Outside the project (or with none): beside the assembly, in its own cache folder.
    expect(previewPath(nested, path.join(root, "elsewhere"))).toBe(path.join(root, "assemblies", ".turnery", "cache", "kit.arbor-asm.preview"))
    expect(previewPath(nested)).toBe(path.join(root, "assemblies", ".turnery", "cache", "kit.arbor-asm.preview"))
    expect(await store.read(top, "k", "kernel", root)).toBeTruthy()
    expect(await store.read(nested, "k", "kernel", root)).toBeTruthy()
    // Nothing of ours beside the files any more.
    expect((await readdir(root)).sort()).toEqual([".turnery", "assemblies", "box.turnery-asm.json"])
    expect(await readFile(path.join(root, ".turnery", "cache", ".gitignore"), "utf8")).toMatch(/^\*$/m)
    // The assembly goes (renamed, deleted): so does its preview, the next time one beside it is read.
    await rm(nested)
    await writeFile(path.join(root, "assemblies", "other.turnery-asm.json"), "{}")
    await store.read(path.join(root, "assemblies", "other.turnery-asm.json"), "k", "kernel", root)
    expect(await exists(previewPath(nested, root))).toBe(false)
    expect(await exists(previewPath(top, root))).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

it("takes in the previews earlier versions left beside the assemblies, and only those", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "turnery-preview-"))
  const kept = path.join(root, "a.arbor-asm.json"), gone = path.join(root, "old.arbor-asm.json")
  const store = new ProjectPreview()
  try {
    await writeFile(kept, "{}")
    // Made the way 0.8 did: write where it goes now, then put it back beside the assembly.
    await store.write(kept, "k", "kernel", display, root)
    await copyFile(previewPath(kept, root), legacyPreviewPath(gone))
    await copyFile(previewPath(kept, root), legacyPreviewPath(kept))
    await rm(path.join(root, ".turnery"), { recursive: true })
    // Someone else's file that happens to end the same way stays.
    await writeFile(path.join(root, "notes-asm.preview"), "not a Turnery preview")
    expect(await store.read(kept, "k", "kernel", root)).toEqual({ ...display, provisional: true })
    expect((await readdir(root)).sort()).toEqual([".turnery", "a.arbor-asm.json", "notes-asm.preview"])
    expect(await exists(previewPath(kept, root))).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
