// Notes beyond a clicked face or edge (docs/specs/2026-11-11-turnery-workbench-layout.md): on whole
// parts, on a step, on an area framed or drawn with its picture; changed words; an assembly's notes
// read while editing one of its parts.
import { beforeAll, describe, expect, it } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import { viewWords } from "@/desktop/core/notes"
import type { CallContext } from "@/desktop/core/protocol"
import { initNodeKernel } from "@/studio/kernel/node"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }
// A 1×1 PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`
const box = [
  { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 20, h: 20 }] },
  { id: "box", op: "extrude", name: "底座拉伸", sketch: "sk", distance: 10 },
]

async function workspace() {
  const mem = memFiles()
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
  await mem.files.write("/work/parts/block.turnery.json", json({ params: {}, features: box }))
  await mem.files.write(
    "/work/box.turnery-asm.json",
    json({ params: {}, features: [{ id: "a", op: "component", file: "parts/block.turnery.json" }, { id: "b", op: "component", name: "盖", file: "parts/block.turnery.json", at: [0, 0, 10] }] }),
  )
  const user = (name: string, input: unknown, part: string) => engine.run(name, input, { actor: "user", part })
  return { ...mem, engine, user }
}

describe("notes about more than a spot", () => {
  it("says where a camera looks from", () => {
    expect(viewWords({ position: [100, -100, 80], target: [0, 0, 0] })).toBe("从右前上方看")
    expect(viewWords({ position: [0, 0, 100], target: [0, 0, 0] })).toBe("从上方看")
  })

  it("keeps notes on whole parts, a step and an area, each in the agent's words", async () => {
    const { engine, user, disk } = await workspace()
    const asm = "/work/box.turnery-asm.json"
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    expect((await user("add_note", { text: "整体再矮一点" }, asm)).ok).toBe(true)
    expect((await user("add_note", { text: "盖子换成透明的", parts: ["盖"], point: [0, 0, 15], part: "盖" }, asm)).ok).toBe(true)
    const region = { shape: "box", camera: { position: [100, -100, 80], target: [0, 0, 0], up: [0, 0, 1] }, rect: [0.2, 0.2, 0.5, 0.6], faces: 3, bbox: [[-10, -10, 0], [10, 10, 20]], origins: ["box"], parts: ["block", "盖"], image: PNG }
    expect((await user("add_note", { text: "这一圈倒个圆角", point: [10, -10, 10], region }, asm)).ok).toBe(true)

    // The picture goes beside the notes; the note keeps its name, not the bytes.
    expect(disk.has("/work/box.asm.notes/n3.png")).toBe(true)
    const saved = JSON.parse(disk.get("/work/box.asm.notes.json") as string)
    expect(saved.notes.map((n: { kind: string }) => n.kind)).toEqual(["part", "parts", "region"])
    expect(saved.notes[2].region.image).toBe("n3.png")
    expect(saved.notes[1]).toMatchObject({ parts: ["盖"], part: "盖", point: [0, 0, 15] })

    const r = await engine.run("get_notes", {}, AGENT)
    expect(r.text).toMatch(/关于整个装配/)
    expect(r.text).toMatch(/关于零件「盖」/)
    expect(r.text).toMatch(/在画面上框出的一片区域，从右前上方看：3 个面，零件「block」「盖」，来自特征 box/)
    expect(r.text).toMatch(/当时的画面（画着框）：\/work\/box\.asm\.notes\/n3\.png/)
    expect(r.images).toHaveLength(1)
    expect(r.images?.[0]).toMatch(/^data:image\/png;base64,iVBOR/)
  })

  it("notes a step, pinned or not; changing the words is in the activity list", async () => {
    const { engine, user } = await workspace()
    const part = "/work/parts/block.turnery.json"
    await engine.run("open_part", { path: "parts/block.turnery.json" }, AGENT)
    await user("add_note", { text: "高度改成 12", feature: "box", name: "底座拉伸", point: [0, 0, 5] }, part)
    await user("add_note", { text: "草图换成圆", feature: "sk", name: "草图" }, part)
    const notes = engine.docState()!.notes
    expect(notes[0]).toMatchObject({ kind: "feature", feature: "box", what: "底座拉伸", origins: ["box"] })
    expect(notes[1].pin).toBe(false)
    const text = (await engine.run("get_notes", {}, AGENT)).text
    expect(text).toMatch(/关于步骤「底座拉伸」（特征 id：box）\n- 标在 \(0, 0, 5\)/)
    expect(text).toMatch(/关于步骤「草图」（特征 id：sk）$/m)

    await user("update_note", { id: "n1", text: "高度改成 15" }, part)
    const doc = engine.docState()!
    expect(doc.notes[0].text).toBe("高度改成 15")
    expect(doc.changes[0]).toMatchObject({ summary: "改了备注 n1：「高度改成 15」", note: "changed" })
    // Saving the same words again isn't news.
    await user("update_note", { id: "n1", text: "高度改成 15 " }, part)
    expect(engine.docState()!.changes.filter((c) => c.summary.startsWith("改了备注"))).toHaveLength(1)
  })

  it("shows the assembly's notes on a part while it is edited there", async () => {
    const { engine, files } = await workspace()
    const note = (n: number, part: string, text: string) => ({ id: `n${n}`, n, part, kind: "face", text, what: "平面", where: "顶面", facts: "", origins: ["box"], point: [0, 0, 10], selector: null, sketch: null, status: "open", createdAt: 1 })
    await files.write("/work/box.asm.notes.json", json({ next: 3, notes: [note(1, "block", "底座开个孔"), note(2, "螺钉", "别的零件")] }))
    await engine.run("open_part", { path: "parts/block.turnery.json", context: "box.turnery-asm.json" }, AGENT)
    const text = (await engine.run("get_notes", {}, AGENT)).text
    expect(text).toMatch(/没有未处理的备注。/)
    expect(text).toMatch(/装配「box」里关于这个零件的 1 条备注/)
    expect(text).toMatch(/底座开个孔/)
    expect(text).not.toMatch(/别的零件/)
  })

  it("moves an assembly's pictures with it when it is renamed", async () => {
    const { engine, user, disk } = await workspace()
    const asm = "/work/box.turnery-asm.json"
    await engine.run("open_part", { path: "box.turnery-asm.json" }, AGENT)
    const region = { shape: "pen", camera: { position: [0, 0, 100], target: [0, 0, 0], up: [0, 1, 0] }, strokes: [[[0, 0, 10], [5, 0, 10]]], faces: 1, bbox: null, origins: [], parts: [], image: PNG }
    await user("add_note", { text: "这里", point: [0, 0, 10], region }, asm)
    expect((await user("rename_file", { path: asm, name: "盒子" }, asm)).ok).toBe(true)
    expect(disk.has("/work/盒子.asm.notes/n1.png")).toBe(true)
    expect(disk.has("/work/box.asm.notes/n1.png")).toBe(false)
    expect((await engine.run("get_notes", {}, AGENT)).text).toMatch(/用画笔在模型上圈出的一片区域，从上方看[\s\S]*\/work\/盒子\.asm\.notes\/n1\.png/)
  })
})
