// Renaming from the window (docs/specs/2026-11-11-turnery-workbench-layout.md): a part in an
// assembly (its component's name), and a part or assembly file on disk, with everything that names it.
import { beforeAll, describe, expect, it } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext } from "@/desktop/core/protocol"
import { renamedPart, renameInNotes } from "@/desktop/core/rename"
import type { PartNote } from "@/desktop/core/protocol"
import { initNodeKernel } from "@/studio/kernel/node"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

const box = (w: number, h: number, d: number) => [
  { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w, h }] },
  { id: "box", op: "extrude", sketch: "sk", distance: d },
]
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`
const note = (n: number, part: string) => ({ id: `n${n}`, n, part, kind: "face", text: `关于 ${part}`, what: "", where: "", facts: "", origins: [], point: [0, 0, 0], selector: null, sketch: null, status: "open", createdAt: 1 })

/** A box of two parts: 「block」 (named after its file) and 「盖」, a check on each and a note on block. */
async function workspace() {
  const mem = memFiles()
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
  await mem.files.write("/work/parts/block.turnery.json", json({ params: {}, features: box(20, 20, 10) }))
  await mem.files.write("/work/parts/block.notes.json", json({ next: 2, notes: [note(1, "主体")] }))
  await mem.files.write(
    "/work/box.turnery-asm.json",
    json({
      params: {},
      features: [
        { id: "a", op: "component", file: "parts/block.turnery.json" },
        { id: "b", op: "component", name: "盖", file: "parts/block.turnery.json", at: [0, 0, 10] },
      ],
      checks: [
        { id: "touch", kind: "gap", said: "盖贴住", a: { part: "block" }, b: { part: "盖" }, max: 0 },
        { id: "wall", kind: "min_wall", said: "壁厚", min: 0.8, part: "block" },
      ],
    }),
  )
  await mem.files.write("/work/box.asm.notes.json", json({ next: 3, notes: [note(1, "block"), note(2, "盖")] }))
  const user = (name: string, input: unknown, part?: string) => engine.run(name, input, { actor: "user", ...(part ? { part } : {}) })
  return { ...mem, engine, user, read: (p: string) => JSON.parse(mem.disk.get(p) as string) }
}

describe("renaming a part in an assembly", () => {
  it("keeps the instance and sub-part of a name", () => {
    expect(renamedPart("螺钉#2/垫圈", "螺钉", "M3")).toBe("M3#2/垫圈")
    expect(renamedPart("螺钉", "螺钉", "M3")).toBe("M3")
    expect(renamedPart("螺钉帽", "螺钉", "M3")).toBe("螺钉帽")
  })

  it("renames the parts a note is about, not only the one its pin is on", () => {
    const notes = [{ ...note(1, "螺钉#2"), kind: "parts", parts: ["螺钉#2", "盖"] }, { ...note(2, ""), part: undefined, kind: "region", parts: ["螺钉", "盖"] }, note(3, "盖")] as unknown as PartNote[]
    const out = renameInNotes(notes, "螺钉", "M3")
    expect(out.map((n) => [n.part, n.parts])).toEqual([["M3#2", ["M3#2", "盖"]], [undefined, ["M3", "盖"]], ["盖", undefined]])
    expect(out[2]).toBe(notes[2])
    expect(renameInNotes(notes, "垫圈", "x")).toBe(notes)
  })

  it("names the component; its checks and notes follow, and undo brings the old name back", async () => {
    const { engine, user, read } = await workspace()
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    const r = await user("rename_part", { id: "a", name: "底座" }, "/work/box.turnery-asm.json")
    expect(r.ok).toBe(true)
    const tree = read("/work/box.turnery-asm.json")
    expect(tree.features[0]).toMatchObject({ id: "a", name: "底座", file: "parts/block.turnery.json" })
    expect(tree.checks[0]).toMatchObject({ a: { part: "底座" }, b: { part: "盖" } })
    expect(tree.checks[1].part).toBe("底座")
    expect(read("/work/box.asm.notes.json").notes.map((n: { part: string }) => n.part)).toEqual(["底座", "盖"])
    expect(engine.docState()?.report?.parts?.map((p) => p.name)).toEqual(["底座", "盖"])
    expect(engine.docState()?.changes[0].summary).toBe("零件「block」改名为「底座」")
    // The agent hears about it on its next call.
    expect((await engine.run("get_state", {}, AGENT)).text).toMatch(/零件「block」改名为「底座」/)

    expect((await user("rename_part", { id: "a", name: "盖" }, "/work/box.turnery-asm.json")).text).toMatch(/已经有叫「盖」的零件/)
    expect((await user("rename_part", { id: "a", name: "a#b" }, "/work/box.turnery-asm.json")).ok).toBe(false)
    expect((await user("rename_part", { id: "a", name: "  " }, "/work/box.turnery-asm.json")).ok).toBe(false)

    await user("undo", {}, "/work/box.turnery-asm.json")
    expect(read("/work/box.turnery-asm.json").features[0].name).toBeUndefined()
  })

  it("is only for assemblies", async () => {
    const { engine, user } = await workspace()
    await engine.run("open_part", { path: "parts/block.turnery.json" }, AGENT)
    expect((await user("rename_part", { id: "box", name: "x" }, "/work/parts/block.turnery.json")).text).toMatch(/只有装配里的零件/)
  })
})

describe("renaming a file", () => {
  it("moves the file and its notes; assemblies that use it follow, parts named after it too", async () => {
    const { engine, user, read, disk } = await workspace()
    await engine.run("open_project", { path: "/work" }, AGENT)
    await engine.run("open_part", { path: "parts/block.turnery.json" }, AGENT)
    await engine.run("set_params", { set: { w: 20 } }, AGENT)
    const r = await user("rename_file", { path: "/work/parts/block.turnery.json", name: "底座" })
    expect(r.ok).toBe(true)
    expect(r.text).toMatch(/用到它的 box 已经改成新名字/)
    expect(disk.has("/work/parts/block.turnery.json")).toBe(false)
    expect(disk.has("/work/parts/block.notes.json")).toBe(false)
    expect(read("/work/parts/底座.notes.json").notes).toHaveLength(1)
    const asm = read("/work/box.turnery-asm.json")
    expect(asm.features.map((f: { file: string }) => f.file)).toEqual(["parts/底座.turnery.json", "parts/底座.turnery.json"])
    // 「block」 went by the file's name: its references take the new one; 「盖」 has its own.
    expect(asm.checks[0]).toMatchObject({ a: { part: "底座" }, b: { part: "盖" } })
    expect(asm.checks[1].part).toBe("底座")
    expect(read("/work/box.asm.notes.json").notes.map((n: { part: string }) => n.part)).toEqual(["底座", "盖"])

    // Still open, under its new name, with its history.
    const snap = engine.snapshot()
    expect(snap.active).toBe("/work/parts/底座.turnery.json")
    expect(snap.parts.map((p) => p.path)).not.toContain("/work/parts/block.turnery.json")
    expect(snap.project?.files.map((f) => f.path)).toContain("/work/parts/底座.turnery.json")
    const doc = engine.docState()!
    expect(doc.changes[0].summary).toBe("文件改名：block → 底座")
    expect(doc.canUndo).toBe(true)
    expect((await engine.run("get_state", {}, AGENT)).text).toMatch(/文件改名：block → 底座/)
    await user("undo", {}, "/work/parts/底座.turnery.json")
    expect(read("/work/parts/底座.turnery.json").params.w).toBeUndefined()

    // And back, as the toast's 撤销 does.
    expect((await user("rename_file", { path: "/work/parts/底座.turnery.json", name: "block" })).ok).toBe(true)
    expect(read("/work/box.turnery-asm.json").features[0].file).toBe("parts/block.turnery.json")
    expect(read("/work/box.turnery-asm.json").checks[1].part).toBe("block")
  })

  it("renames an assembly, keeping a part edited in it there", async () => {
    const { engine, user, disk } = await workspace()
    await engine.run("open_part", { path: "parts/block.turnery.json", context: "box.turnery-asm.json" }, AGENT)
    const r = await user("rename_file", { path: "/work/box.turnery-asm.json", name: "盒子" })
    expect(r.ok).toBe(true)
    expect(disk.has("/work/盒子.turnery-asm.json")).toBe(true)
    expect(disk.has("/work/盒子.asm.notes.json")).toBe(true)
    expect(engine.docState()?.context?.assembly).toBe("/work/盒子.turnery-asm.json")
  })

  it("refuses a name that is taken or not a file name", async () => {
    const { user, mem } = await workspace().then((w) => ({ ...w, mem: w }))
    await mem.files.write("/work/parts/lid.turnery.json", json({ params: {}, features: [] }))
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "lid" })).text).toMatch(/已经有 lid\.turnery\.json/)
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "a/b" })).ok).toBe(false)
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: ".x" })).ok).toBe(false)
    expect((await user("rename_file", { path: "/work/parts/nope.turnery.json", name: "x" })).text).toMatch(/没有这个文件/)
    expect(mem.disk.has("/work/parts/block.turnery.json")).toBe(true)
  })

  it("refuses a name another part of an assembly already goes by", async () => {
    const { engine, user, disk } = await workspace()
    await engine.run("open_project", { path: "/work" }, AGENT)
    // 「block」 would become 「盖」, which the other component is called.
    const r = await user("rename_file", { path: "/work/parts/block.turnery.json", name: "盖" })
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/装配「box」里已经有叫「盖」的零件/)
    expect(disk.has("/work/parts/block.turnery.json")).toBe(true)
  })

  it("checks every new path before moving anything, and puts back what moved when a move fails", async () => {
    const { engine, user, disk, files } = await workspace()
    await engine.run("open_part", { path: "parts/block.turnery.json" }, AGENT)
    // A pictures folder of that name is in the way: nothing moves.
    await files.write("/work/parts/底座.notes/n1.png", "png")
    const r = await user("rename_file", { path: "/work/parts/block.turnery.json", name: "底座" })
    expect(r.text).toMatch(/已经有 底座\.notes 文件夹/)
    expect(disk.has("/work/parts/block.turnery.json") && disk.has("/work/parts/block.notes.json")).toBe(true)

    // The notes fail to move after the part did: the part goes back, open where it was.
    const move = files.rename!
    files.rename = async (a, b) => {
      if (a.endsWith(".notes.json")) throw new Error("磁盘满了")
      await move(a, b)
    }
    // What the window shows: it keeps a document only while it is the active one (useEngine).
    let active: string | null = null
    let shown: string | null = null
    engine.on((e) => {
      if (e.type === "snapshot") {
        active = e.snapshot.active
        if (shown !== active) shown = null
      }
      if (e.type === "doc" && e.doc.path === active) shown = e.doc.path
    })
    const r2 = await user("rename_file", { path: "/work/parts/block.turnery.json", name: "主体" })
    expect(r2.ok).toBe(false)
    expect(shown, "the window shows the file again").toBe("/work/parts/block.turnery.json")
    expect(r2.text).toMatch(/没能改名：磁盘满了/)
    expect(disk.has("/work/parts/block.turnery.json") && disk.has("/work/parts/block.notes.json")).toBe(true)
    expect(disk.has("/work/parts/主体.turnery.json")).toBe(false)
    expect(engine.snapshot().active).toBe("/work/parts/block.turnery.json")
    expect(engine.docState()?.path).toBe("/work/parts/block.turnery.json")
  })

  it("changes only the case when that is the same file, never onto another file", async () => {
    const { user, disk, files } = await workspace()
    // Here (as on a disk that minds case) Block and block are two files.
    await files.write("/work/parts/Block.turnery.json", json({ params: {}, features: [] }))
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "Block" })).text).toMatch(/已经有 Block\.turnery\.json/)
    expect(disk.get("/work/parts/Block.turnery.json")).toBe(json({ params: {}, features: [] }))
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "BLOCK" })).ok).toBe(true)
    expect(disk.has("/work/parts/BLOCK.turnery.json")).toBe(true)
  })

  it("undo in an open assembly after a rename keeps the new file", async () => {
    const { engine, user, read } = await workspace()
    const asm = "/work/box.turnery-asm.json"
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    await engine.run("set_params", { set: { gap: 1 } }, AGENT)
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "底座" })).ok).toBe(true)
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    // The rename isn't undone from here (the file is gone from its old name); what came before is, on the new name.
    await user("undo", {}, asm)
    const tree = read(asm)
    expect(tree.params.gap).toBeUndefined()
    expect(tree.features.map((f: { file: string }) => f.file)).toEqual(["parts/底座.turnery.json", "parts/底座.turnery.json"])
    expect(tree.checks[1].part).toBe("底座")
    expect(engine.docState()?.error).toBeUndefined()
    await user("redo", {}, asm)
    expect(read(asm).params.gap).toBe(1)
    expect(read(asm).features[0].file).toBe("parts/底座.turnery.json")
  })

  it("an outside save of an open assembly, not yet noticed, is undone onto the new name too", async () => {
    const { engine, user, read, files } = await workspace()
    const asm = "/work/box.turnery-asm.json"
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    // An editor saved it; its watcher hasn't fired yet (written without telling it).
    await files.write(asm, json({ ...read(asm), params: { gap: 2 } }))
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "底座" })).ok).toBe(true)
    await user("undo", {}, asm)
    expect(read(asm).params.gap).toBeUndefined()
    expect(read(asm).features.map((f: { file: string }) => f.file)).toEqual(["parts/底座.turnery.json", "parts/底座.turnery.json"])
    expect(engine.docState()?.error).toBeUndefined()
  })

  it("an assembly that no longer uses the file gets it back under its new name on undo", async () => {
    const { engine, user, read } = await workspace()
    const asm = "/work/box.turnery-asm.json"
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    await engine.run("delete_feature", { id: "b" }, AGENT)
    await engine.run("delete_feature", { id: "a" }, AGENT)
    expect(read(asm).features).toHaveLength(0)
    expect((await user("rename_file", { path: "/work/parts/block.turnery.json", name: "底座" })).ok).toBe(true)
    await user("undo", {}, asm)
    await user("undo", {}, asm)
    expect(read(asm).features.map((f: { file: string }) => f.file)).toEqual(["parts/底座.turnery.json", "parts/底座.turnery.json"])
  })
})
