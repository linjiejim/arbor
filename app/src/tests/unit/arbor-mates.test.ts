// Standard parts (fasteners.ts), placing components by mates (kernel/mates.ts), heat-set insert holes,
// and what the BOM says about them.
import { beforeAll, describe, expect, it } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext } from "@/desktop/core/protocol"
import type { Tree } from "@/studio/dsl"
import { Kernel } from "@/studio/kernel/build"
import { applyMate, applyRigid, FREE, IDENTITY } from "@/studio/kernel/mates"
import { initNodeKernel } from "@/studio/kernel/node"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

describe("mates as math", () => {
  it("puts a face against a face, then lines up an axis without undoing the contact", () => {
    // A part whose bottom face (normal -Z at z = 0) goes onto a top face at z = 30, axis onto x = 35, y = 20.
    let r = applyMate(IDENTITY, FREE, { kind: "contact", mine: { kind: "plane", n: [0, 0, -1], p: [0, 0, 0] }, target: { kind: "plane", n: [0, 0, 1], p: [10, 10, 30] } })
    expect(r.miss).toBeUndefined()
    expect(applyRigid(r.T, [0, 0, 0])[2]).toBeCloseTo(30, 9)
    r = applyMate(r.T, r.free, { kind: "coaxial", mine: { kind: "axis", a: [0, 0, 0], d: [0, 0, 1] }, target: { kind: "axis", a: [35, 20, 0], d: [0, 0, -1] } })
    expect(r.miss).toBeUndefined()
    const o = applyRigid(r.T, [0, 0, 0])
    expect(o.map((x) => Math.round(x * 1e6) / 1e6)).toEqual([35, 20, 30])
    // Nothing left to slide: a third mate that wants it moved says so.
    const r3 = applyMate(r.T, r.free, { kind: "flush", mine: { kind: "plane", n: [0, 0, -1], p: [0, 0, 0] }, target: { kind: "plane", n: [0, 0, -1], p: [0, 0, 25] } })
    expect(r3.miss).toMatch(/还差 5 mm/)
  })

  it("keeps sliding along the line two slanted flush mates leave free", () => {
    const n2: [number, number, number] = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)]
    let r = applyMate(IDENTITY, FREE, { kind: "flush", mine: { kind: "plane", n: [0, 0, 1], p: [0, 0, 0] }, target: { kind: "plane", n: [0, 0, 1], p: [0, 0, 0] } })
    r = applyMate(r.T, r.free, { kind: "flush", mine: { kind: "plane", n: n2, p: [0, 0, 0] }, target: { kind: "plane", n: n2, p: [0, 0, 0] } })
    // Left: sliding along (1, -1, 0). A third mate that needs exactly that is met.
    expect(r.free.slide).toHaveLength(1)
    expect(Math.abs(r.free.slide[0][0] + r.free.slide[0][1])).toBeLessThan(1e-9)
    const u: [number, number, number] = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0]
    const r3 = applyMate(r.T, r.free, { kind: "flush", mine: { kind: "plane", n: u, p: [0, 0, 0] }, target: { kind: "plane", n: u, p: [3, -3, 0] } })
    expect(r3.miss).toBeUndefined()
  })

  it("turns a part over to put a face against another", () => {
    // The part's top (normal +Z) goes down onto a floor facing +Z: it has to turn upside down.
    const r = applyMate(IDENTITY, FREE, { kind: "contact", mine: { kind: "plane", n: [0, 0, 1], p: [0, 0, 5] }, target: { kind: "plane", n: [0, 0, 1], p: [0, 0, 0] } })
    expect(r.miss).toBeUndefined()
    expect(applyRigid(r.T, [0, 0, 5])[2]).toBeCloseTo(0, 9)
    expect(applyRigid(r.T, [0, 0, 0])[2]).toBeCloseTo(5, 9)
  })
})

/** A box with four tapped corner posts, a lid with four countersunk holes, an assembly holding both. */
async function enclosure() {
  const mem = memFiles()
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
  const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
  const corners = [[30, 15], [-30, 15], [30, -15], [-30, -15]]
  const box: Tree = {
    params: {},
    features: [
      { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 80, h: 50 }] },
      { id: "e", op: "extrude", sketch: "s", distance: 30 },
      { id: "sh", op: "shell", open: { normal: "+Z", extreme: "+Z" }, t: 2 },
      { id: "ps", op: "sketch", on: { plane: "XY", offset: 2 }, shapes: corners.map((c) => ({ type: "circle" as const, d: 7, center: c })) },
      { id: "p", op: "extrude", sketch: "ps", distance: 28 },
      { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: corners, standard: { size: "M3", fit: "insert" } },
    ],
  }
  const lid: Tree = {
    params: {},
    features: [
      { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 80, h: 50 }] },
      { id: "e", op: "extrude", sketch: "s", distance: 3 },
      { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: corners, standard: { size: "M3", head: "csink" } },
    ],
  }
  await mem.files.write("/work/parts/box.arbor.json", JSON.stringify(box))
  await mem.files.write("/work/parts/lid.arbor.json", JSON.stringify(lid))
  expect((await run("open_part", { path: "box.arbor-asm.json", create: true })).ok).toBe(true)
  const c1 = await run("component", { id: "box", name: "盒体", file: "parts/box.arbor.json" })
  expect(c1.ok, c1.text).toBe(true)
  return { engine, run, ...mem }
}

describe("standard parts and mates in an assembly", () => {
  it("drills a heat-set insert hole blind, insert length + 1 deep", () => {
    const k = new Kernel()
    const rep = k.rebuild({
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 20, h: 20 }] },
        { id: "e", op: "extrude", sketch: "s", distance: 10 },
        { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[0, 0]], standard: { size: "M3", fit: "insert" } },
      ],
    })
    expect(rep.features[2].summary).toBe("M3 热熔螺母孔（⌀4，螺母长 5.7） × 1 · 深 6.7")
    expect(rep.body!.volume).toBeCloseTo(4000 - Math.PI * 4 * 6.7, 0)
    k.dispose()
  })

  it("seats a lid by mates, puts a screw in each of its four holes, and lists them in the BOM", async () => {
    const { run, disk } = await enclosure()
    // The lid: bottom on the box's rim, its sides flush with the box's.
    const lid = await run("component", {
      id: "lid",
      name: "盖子",
      file: "parts/lid.arbor.json",
      mates: [
        { type: "contact", face: { normal: "-Z" }, to: { part: "盒体", face: { normal: "+Z", extreme: "+Z" } } },
        { type: "flush", face: { normal: "-X" }, to: { part: "盒体", face: { normal: "-X", extreme: "-X" } } },
        { type: "flush", face: { normal: "-Y" }, to: { part: "盒体", face: { normal: "-Y", extreme: "-Y" } } },
      ],
    })
    expect(lid.ok, lid.text).toBe(true)
    expect(lid.text).not.toMatch(/没有完全做到|重叠/)
    let st = await run("get_state", {})
    expect(st.text).toMatch(/盖子（80×50×3）/)
    const seat = await run("check", { items: [{ id: "seat", said: "盖子落在盒口上", kind: "gap", a: { part: "盖子" }, b: { part: "盒体" }, max: 0 }] })
    expect(seat.text).toMatch(/✓ seat/)
    // Flat head screws: into each countersunk hole (coaxial), head top flush with the lid's top.
    const screws = await run("component", {
      id: "screws",
      name: "螺钉",
      standard: { type: "screw", size: "M3", head: "flat", length: 10 },
      mates: [
        { type: "coaxial", face: { kind: "cylinder" }, to: { part: "盖子", face: { kind: "cylinder", radius: 1.7 } } },
        { type: "flush", face: { normal: "+Z", extreme: "+Z" }, to: { part: "盖子", face: { normal: "+Z", extreme: "+Z" } } },
      ],
    })
    expect(screws.ok, screws.text).toBe(true)
    expect(screws.text).toMatch(/标准件 ISO 10642 M3×10 内六角沉头螺钉 · .* × 4 · 贴合 2 条/)
    expect(screws.text).not.toMatch(/没有完全做到/)
    st = await run("get_state", {})
    expect(st.text).toMatch(/螺钉#1/)
    expect(st.text).toMatch(/螺钉#4/)
    // Each screw stands in a hole: its axis at a corner, its top at the lid's top (z = 33), its tip 10 below.
    const m = await run("measure", { a: { part: "螺钉#1" } })
    expect(m.ok, m.text).toBe(true)
    const pos = await run("check", {
      items: [
        // ISO 10642 head ⌀6.72 in a ⌀6.9 countersink: 0.06 mm all round the cone, and that is right.
        { id: "top", said: "螺钉头落在锥孔里", kind: "gap", a: { part: "螺钉#2" }, b: { part: "盖子" }, min: 0.01, max: 0.1 },
        { id: "size", said: "整体 80×50×33", kind: "size", expect: [80, 50, 33] },
      ],
    })
    expect(pos.text).toMatch(/✓ top/)
    expect(pos.text).toMatch(/✓ size/)
    const bom = await run("export", { path: "bom.md" })
    expect(bom.ok, bom.text).toBe(true)
    const md = disk.get("/work/bom.md") as string
    expect(md).toMatch(/\| ISO 10642 M3×10 内六角沉头螺钉 \| 标准件 \| 4 \|/)
    expect(md).toMatch(/\| 盖子 \| parts\/lid\.arbor\.json \| 1 \|/)
    expect(md).toMatch(/共 6 件/)
  }, 120_000)

  it("shows the screws placed by mates around the lid when the lid is edited in place", async () => {
    const { run } = await enclosure()
    await run("component", { id: "lid", name: "盖子", file: "parts/lid.arbor.json", at: [0, 0, 30] })
    await run("component", {
      id: "nuts",
      name: "垫圈",
      standard: { type: "washer", size: "M3" },
      mates: [
        { type: "coaxial", face: { kind: "cylinder", radius: 1.6 }, to: { part: "盖子", face: { kind: "cylinder", radius: 1.7 } } },
        { type: "contact", face: { normal: "-Z" }, to: { part: "盖子", face: { normal: "+Z", extreme: "+Z" } } },
      ],
    })
    const open = await run("open_part", { path: "parts/lid.arbor.json", context: "box.arbor-asm.json" })
    expect(open.ok, open.text).toBe(true)
    // In the lid's own frame: the washers sit on its top (z = 3), the box below it.
    const g = await run("check", { items: [{ id: "w", said: "垫圈压在盖子上", kind: "gap", a: { part: "垫圈#3" }, b: { face: { normal: "+Z", extreme: "+Z" } }, max: 0 }] })
    expect(g.text).toMatch(/✓ w/)
  }, 120_000)

  it("shows the assembly around a part that has nothing in it yet", async () => {
    const { run } = await enclosure()
    const add = await run("component", { id: "knob", name: "旋钮", file: "parts/knob.arbor.json", at: [0, 0, 30] })
    expect(add.text).toMatch(/读不到|没有读到|找不到/)
    await run("delete_feature", { id: "knob" })
    // A new empty part file, placed on top of the box, edited in place: the box shows below it.
    await run("open_part", { path: "parts/knob.arbor.json", create: true })
    await run("open_part", { path: "box.arbor-asm.json" })
    await run("component", { id: "knob", name: "旋钮", file: "parts/knob.arbor.json", at: [0, 0, 30] })
    const open = await run("open_part", { path: "parts/knob.arbor.json", context: "box.arbor-asm.json" })
    expect(open.ok, open.text).toBe(true)
    const st = await run("get_state", {})
    expect(st.text).toMatch(/盒体/)
  }, 120_000)

  it("leaves the context empty, without failing, when an empty part's placement doesn't work out", () => {
    const k = new Kernel()
    const box = { file: "box.arbor.json", tree: { params: {}, features: [{ id: "s", op: "sketch" as const, on: { plane: "XY" as const }, shapes: [{ type: "rect" as const, w: 20, h: 20 }] }, { id: "e", op: "extrude" as const, sketch: "s", distance: 10 }] } }
    const empty = { file: "new.arbor.json", tree: { params: {}, features: [] } }
    expect(() =>
      k.setContext({
        assembly: "a",
        self: "new.arbor.json",
        tree: { params: {}, features: [{ id: "b", op: "component", file: "box.arbor.json" }, { id: "n", op: "component", file: "new.arbor.json", at: ["missing", 0, 0] }] },
        components: [box, empty],
      }),
    ).not.toThrow()
    expect(k.rebuild({ params: {}, features: [] }).refs).toBeUndefined()
    k.dispose()
  })

  it("refuses what it can't make sense of", async () => {
    const { run } = await enclosure()
    // Each failure is taken out again, or everything after it waits for it.
    const tryOne = async (input: Record<string, unknown>) => {
      const r = await run("component", input)
      if (!r.ok) await run("delete_feature", { id: input.id })
      return r.text
    }
    expect(await tryOne({ id: "x", file: "parts/lid.arbor.json", standard: { type: "nut", size: "M3" } })).toMatch(/file 和 standard 只写一个/)
    expect(await tryOne({ id: "y", standard: { type: "screw", size: "M3" } })).toMatch(/螺钉要写 length/)
    expect(await tryOne({ id: "z", standard: { type: "screw", size: "M3", length: 11 } })).toMatch(/11 mm 不是常见的螺钉长度/)
    expect(await tryOne({ id: "w", standard: { type: "nut", size: "M3" }, mates: [{ type: "contact", face: { normal: "-Z" }, to: { part: "盖", face: { normal: "+Z" } } }] })).toMatch(/没有叫「盖」的零件/)
  }, 120_000)
})
