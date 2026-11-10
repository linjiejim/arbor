// Turnery, part two of the agent-modelling spec (docs/specs/2026-11-07-turnery-agent-modeling.md):
// new parts in one file, shared parameter files, assemblies of part files, editing a part
// inside its assembly, and what an assembly exports.
import { beforeAll, describe, expect, it, vi } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext } from "@/desktop/core/protocol"
import { toBuild123d } from "@/studio/codegen"
import type { Tree } from "@/studio/dsl"
import { Kernel, compileComponent } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

const box = (w: number, h: number, d: number, extra: Record<string, unknown> = {}) => [
  { id: "sk", op: "sketch" as const, on: { plane: "XY" as const }, shapes: [{ type: "rect" as const, w, h }] },
  { id: "box", op: "extrude" as const, sketch: "sk", distance: d, ...extra },
]

describe("new parts in one file", () => {
  it("adds material under a new name as a part of its own; the first addition names the body", () => {
    const k = new Kernel()
    const tree: Tree = {
      params: {},
      features: [
        ...box(80, 50, 30, { part: "盒体" }),
        { id: "ls", op: "sketch", on: { plane: "XY", offset: 30 }, shapes: [{ type: "rect", w: 80, h: 50 }] },
        { id: "lid", op: "extrude", sketch: "ls", distance: 3, part: "盖板" },
        { id: "ks", op: "sketch", on: { plane: "XY", offset: 33 }, shapes: [{ type: "circle", d: 6, center: [20, 0] }] },
        { id: "knob", op: "extrude", sketch: "ks", distance: 4, part: "盖板" },
        { id: "pat", op: "linear_pattern", features: ["knob"], dir: "-X", count: 2, spacing: 40 },
        { id: "h", op: "hole", on: { plane: "XY", offset: 33 }, at: [[0, 0]], d: 4, depth: 10 },
      ],
    }
    const rep = k.rebuild(tree)
    expect(rep.features.map((f) => f.state)).toEqual(Array(tree.features.length).fill("ok"))
    expect(rep.features[3].summary).toMatch(/新零件「盖板」$/)
    expect(rep.features[6].summary).toMatch(/盖板$/)
    // A hole without `part` goes through every part it reaches.
    expect(rep.features[7].summary).toMatch(/盒体、盖板/)
    expect(rep.parts?.map((p) => p.name)).toEqual(["盒体", "盖板"])
    expect(rep.parts?.[1].size).toEqual([80, 50, 7])
    // The bigger part stays, the lid moves up.
    const d = k.display()
    expect(d.parts?.[0].explode).toEqual([0, 0, 0])
    expect(d.parts?.[1].explode[2]).toBeGreaterThan(15)
    k.dispose()
  })

  it("calls an unnamed body 「主体」, warns when a new part overlaps, refuses until and unknown names", () => {
    const k = new Kernel()
    const base = box(40, 40, 20)
    let rep = k.rebuild({
      params: {},
      features: [...base, { id: "s2", op: "sketch", on: { plane: "XY", offset: 10 }, shapes: [{ type: "circle", d: 10 }] }, { id: "pin", op: "extrude", sketch: "s2", distance: 30, part: "销" }],
    })
    expect(rep.features[3].summary).toMatch(/新零件「销」；原来的实体叫作「主体」/)
    expect(rep.features[3].warnings?.join()).toMatch(/新零件「销」和「主体」重叠 785\.\d+ mm³/)
    rep = k.rebuild({ params: {}, features: [...base, { id: "s2", op: "sketch", on: { plane: "XY", offset: 30 }, shapes: [{ type: "circle", d: 10 }] }, { id: "pin", op: "extrude", sketch: "s2", until: "next", part: "销" }] })
    expect(rep.features[3].message).toMatch(/新建零件「销」时不能用 until/)
    rep = k.rebuild({ params: {}, features: [...base, { id: "f", op: "fillet", edges: { parallel: "Z" }, r: 2, part: "盖" }] })
    expect(rep.features[2].message).toMatch(/没有叫「盖」的零件/)
    k.dispose()
  })

  it("exports a new part to build123d as its own entry", () => {
    const code = toBuild123d({
      params: {},
      features: [...box(80, 50, 30), { id: "ls", op: "sketch", on: { plane: "XY", offset: 30 }, shapes: [{ type: "rect", w: 80, h: 50 }] }, { id: "lid", op: "extrude", sketch: "ls", distance: 3, part: "盖板" }],
    })
    expect(code).toMatch(/parts = \{"主体": part\}/)
    expect(code).toMatch(/parts\["盖板"\] = tool_lid/)
    expect(code).toMatch(/part = Compound\(list\(parts.values\(\)\)\)/)
  })
})

/** A pen-like assembly on an in-memory disk: shared diameter and length, a barrel and a cap. */
async function penWorkspace() {
  const mem = memFiles()
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
  const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
  await mem.files.write("/work/pen.params.json", JSON.stringify({ params: { D: 10, L: 60 }, paramNotes: { D: "笔杆直径" } }))
  const barrel: Tree = {
    uses: "../pen.params.json",
    params: {},
    features: [
      { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: "D" }] },
      { id: "e", op: "extrude", sketch: "s", distance: "L" },
    ],
  }
  const cap: Tree = {
    uses: "../pen.params.json",
    params: { t: 1 },
    features: [
      { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: "D+2*t" }] },
      { id: "e", op: "extrude", sketch: "s", distance: 20 },
    ],
  }
  await mem.files.write("/work/parts/barrel.turnery.json", JSON.stringify(barrel))
  await mem.files.write("/work/parts/cap.turnery.json", JSON.stringify(cap))
  const open = await run("open_part", { path: "pen.turnery-asm.json", create: true })
  expect(open.ok, open.text).toBe(true)
  expect(open.text).toMatch(/已新建装配/)
  const sp = await run("share_params", { file: "pen.params.json" })
  expect(sp.ok, sp.text).toBe(true)
  const c1 = await run("component", { id: "barrel", name: "笔杆", file: "parts/barrel.turnery.json" })
  expect(c1.ok, c1.text).toBe(true)
  const c2 = await run("component", { id: "cap", name: "笔帽", file: "parts/cap.turnery.json", at: [0, 0, "L"] })
  expect(c2.ok, c2.text).toBe(true)
  return { engine, run, ...mem }
}

describe("shared parameters and assemblies", () => {
  it("shows stable geometry before interference checks, and keeps cached checks on a repeated build", () => {
    const k = new Kernel()
    k.setComponents([{ file: "preview-cube", tree: { params: {}, features: box(12, 12, 12) } }])
    const tree: Tree = { params: {}, features: [
      { op: "component", id: "a", name: "a", file: "preview-cube" },
      { op: "component", id: "b", name: "b", file: "preview-cube", at: [6, 0, 0] },
    ] }
    const order: string[] = []
    const report = k.rebuild(tree, {
      progress: (p) => order.push(p.stage),
      preview: (d) => { order.push("preview"); expect(d.parts).toHaveLength(2); expect(d.mesh!.triangles.length).toBeGreaterThan(0) },
    })
    expect(order.indexOf("preview")).toBeLessThan(order.indexOf("checks"))
    expect(report.features[1].warnings).toEqual(["「b」和「a」重叠 864 mm³"])
    expect(k.rebuild(tree).interferences).toEqual(report.interferences)
    const moved = structuredClone(tree)
    moved.features[1] = { ...moved.features[1], at: [12, 0, 0] } as Tree["features"][number]
    expect(k.rebuild(moved).features[1].warnings).toBeUndefined()
    k.dispose()
  })

  it("defers exact checks without losing pending intersections on a later explicit check", () => {
    const k = new Kernel()
    k.setComponents([{ file: "deferred", tree: { params: {}, features: box(12, 12, 12) } }])
    const tree: Tree = { params: {}, features: [
      { op: "component", id: "a", file: "deferred", name: "a" },
      { op: "component", id: "b", file: "deferred", name: "b", at: [6, 0, 0] },
    ], checks: [{ id: "size", said: "宽 18", kind: "size", expect: [18, 12, 12] }] }
    const initial = k.rebuild(tree, { deferChecks: true })
    expect(initial.checksPending).toBe(true)
    expect(initial.checks).toBeUndefined()
    expect(initial.interferences).toEqual([])
    const d = k.display()
    expect(k.pick({ kind: "face", hash: d.groups[0].hash, point: [0, 0, 0] })).not.toBeNull()
    const checked = k.rebuild(tree)
    expect(checked.checksPending).toBeUndefined()
    expect(checked.features[1].warnings).toEqual(["「b」和「a」重叠 864 mm³"])
    expect(checked.checks?.[0].pass).toBe(true)
    expect(k.rebuild(tree).features[1].warnings).toHaveLength(1)
    k.dispose()
  })

  it("prepares exact native parts without losing provenance-based selectors or geometry after serialization", () => {
    const tree: Tree = { params: {}, features: [
      ...box(16, 12, 8),
      { id: "round", op: "fillet", edges: { of: "box", parallel: "Z" }, r: 1 },
    ] }
    const direct = new Kernel()
    const expected = direct.rebuild(tree).body
    const compiled = compileComponent({ file: "native-part", tree })
    const k = new Kernel()
    // A different content key forces the serialized path instead of the in-memory shape.
    k.setComponents([{ file: "restored", tree: { ...tree, paramNotes: { note: "serialized test" } }, compiled }])
    const rep = k.rebuild({ params: {}, features: [{ id: "restored", op: "component", file: "restored" }] })
    expect(rep.features[0].state).toBe("ok")
    expect(rep.body).toEqual(expected)
    // No growing assembly prefix is meshed until it is actually requested.
    expect(k.lastBuilt(Infinity)?.mesh).toBeNull()
    const display = k.display()
    expect(display.mesh!.triangles.length).toBeGreaterThan(0)
    expect(k.measure([{ kind: "face", hash: display.groups[0].hash, point: [0, 0, 0] }])?.items).toHaveLength(1)
    const rotated = k.rebuild({ params: {}, features: [
      { id: "restored", op: "component", file: "restored", rotate: [{ axis: "X", angle: 90 }], at: [40, 20, 10] },
    ] })
    const placed = k.display()
    expect(rotated.body?.size).toEqual([16, 8, 12])
    expect(placed.bbox?.[0][0]).toBeCloseTo(32)
    expect(placed.mesh!.vertices[0]).toBeCloseTo(display.mesh!.vertices[0] + 40)
    expect(placed.mesh!.vertices[1]).toBeCloseTo(-display.mesh!.vertices[2] + 20)
    expect(placed.mesh!.vertices[2]).toBeCloseTo(display.mesh!.vertices[1] + 10)
    for (const g of placed.groups) expect(k.pick({ kind: "face", hash: g.hash, point: [40, 20, 10] })).not.toBeNull()
    expect(placed.groups.every((g) => g.origin === "restored")).toBe(true)
    direct.dispose()
    k.dispose()
  })

  it("keeps each component's face ownership when their contacting faces coincide", () => {
    const k = new Kernel()
    k.setComponents([{ file: "cube.turnery.json", tree: { params: {}, features: box(10, 10, 10) } }])
    const tree: Tree = {
      params: {},
      features: [
        { op: "component", id: "lower", name: "下块", file: "cube.turnery.json" },
        { op: "component", id: "upper", name: "上块", file: "cube.turnery.json", at: [0, 0, 10] },
      ],
    }
    const rep = k.rebuild(tree)
    expect(rep.features.every((f) => f.state === "ok" && !f.warnings?.length)).toBe(true)
    expect(rep.features[1].faces).toEqual({ new: 6, modified: 0 })
    const d = k.display()
    expect(d.groups.filter((g) => g.part === 0).every((g) => g.origin === "lower" && g.status === "kept")).toBe(true)
    expect(d.groups.filter((g) => g.part === 1).every((g) => g.origin === "upper" && g.status === "new")).toBe(true)
    // Going back in the tree still shows exactly the first component.
    expect(k.display(0).groups).toHaveLength(6)
    expect(k.display(0).bbox).toEqual([[-5, -5, 0], [5, 5, 10]])
    const hash = d.groups.find((g) => g.part === 1)!.hash
    expect(k.measure([{ kind: "face", hash, point: [0, 0, 10] }])?.items).toHaveLength(1)
    k.dispose()
  })

  it("reports exact overlap while preserving contact and separated component measurements", () => {
    const k = new Kernel()
    k.setComponents([{ file: "overlap-cube.turnery.json", tree: { params: {}, features: box(10, 10, 10) } }])
    const rep = k.rebuild({
      params: {},
      features: [
        { op: "component", id: "base", name: "基准块", file: "overlap-cube.turnery.json" },
        { op: "component", id: "touch", name: "接触块", file: "overlap-cube.turnery.json", at: [10, 0, 0] },
        { op: "component", id: "overlap", name: "干涉块", file: "overlap-cube.turnery.json", at: [0, 0, 5] },
        { op: "component", id: "far", name: "远处块", file: "overlap-cube.turnery.json", at: [100, 0, 0] },
      ],
    })
    expect(rep.features.every((f) => f.state === "ok")).toBe(true)
    expect(rep.features[1].warnings).toBeUndefined()
    expect(rep.features[2].warnings).toEqual(["「干涉块」和「基准块」重叠 500 mm³"])
    expect(rep.features[3].warnings).toBeUndefined()
    expect(rep.body?.volume).toBe(4000)
    const touch = k.measure([{ kind: "part", name: "基准块" }, { kind: "part", name: "接触块" }])
    expect(touch?.between).toContainEqual({ name: "最短距离", value: "0（接触）" })
    const far = k.measure([{ kind: "part", name: "基准块" }, { kind: "part", name: "远处块" }])
    expect(far?.between).toContainEqual({ name: "最短距离", value: "90 mm" })
    k.dispose()
  })

  it("places part files in an assembly, checks how they meet, and follows a shared parameter", async () => {
    const { run, disk } = await penWorkspace()
    let st = await run("get_state", {})
    expect(st.text).toMatch(/装配：\/work\/pen\.turnery-asm\.json/)
    expect(st.text).toMatch(/零件：笔杆（10×10×60）、笔帽（12×12×20）/)
    const chk = await run("check", {
      items: [
        { id: "size", said: "总长 80", kind: "size", expect: [12, 12, 80] },
        { id: "seat", said: "笔帽压在笔杆上", kind: "gap", a: { part: "笔帽" }, b: { part: "笔杆" }, max: 0 },
        { id: "no", said: "笔帽和笔杆不相交", kind: "interference", ref: "笔帽" },
      ],
    })
    expect(chk.text).toMatch(/✓[^\n]*总长 80/)
    expect(chk.text).toMatch(/✓[^\n]*笔帽压在笔杆上/)
    expect(chk.text).toMatch(/✓[^\n]*笔帽和笔杆不相交/)
    // A shared parameter changed from the assembly: the file changes, the parts follow.
    const set = await run("set_params", { set: { L: 70 } })
    expect(set.ok, set.text).toBe(true)
    expect(set.text).toMatch(/共享参数（pen\.params\.json）：L = 70/)
    expect(JSON.parse(disk.get("/work/pen.params.json") as string).params.L).toBe(70)
    st = await run("get_state", {})
    expect(st.text).toMatch(/笔杆（10×10×70）/)
    const chk2 = await run("check", {})
    expect(chk2.text).toMatch(/✗[^\n]*总长 80[^\n]*12 × 12 × 90/)
  })

  it("doesn't tell the agent its own shared-parameter write, or a save that changed nothing, came from the file", async () => {
    const { run, touch, disk } = await penWorkspace()
    await run("get_state", {})
    const set = await run("set_params", { set: { L: 70 } })
    expect(set.ok, set.text).toBe(true)
    // The file system reports the write back (the components reach it as parts/../pen.params.json).
    await touch("/work/pen.params.json", disk.get("/work/pen.params.json") as string)
    // Someone (another engine's headless check) saves a part file again without changing it.
    await touch("/work/parts/cap.turnery.json", disk.get("/work/parts/cap.turnery.json") as string)
    const st = await run("get_state", {})
    expect(st.text).not.toMatch(/文件被直接修改/)
    expect(st.text).toMatch(/笔杆（10×10×70）/)
    // A real change by someone else still shows.
    const cap = JSON.parse(disk.get("/work/parts/cap.turnery.json") as string) as Tree
    cap.features[1] = { ...cap.features[1], distance: 22 } as Tree["features"][number]
    await touch("/work/parts/cap.turnery.json", JSON.stringify(cap))
    const st2 = await run("get_state", {})
    expect(st2.text).toMatch(/文件被直接修改：cap\.turnery\.json 更新了/)
  })

  it("rebuilds when a part file changes on disk, and exports a BOM, a STEP and a zip of STLs", async () => {
    const { run, touch, disk } = await penWorkspace()
    const cap = JSON.parse(disk.get("/work/parts/cap.turnery.json") as string) as Tree
    cap.features[1] = { ...cap.features[1], distance: 25 } as Tree["features"][number]
    await touch("/work/parts/cap.turnery.json", JSON.stringify(cap))
    const st = await run("get_state", {})
    expect(st.text).toMatch(/笔帽（12×12×25）/)
    expect(st.text).toMatch(/cap\.turnery\.json 更新了，已重建/)
    const bom = await run("export", { path: "pen-bom.md" })
    expect(bom.ok, bom.text).toBe(true)
    const md = disk.get("/work/pen-bom.md") as string
    expect(md).toMatch(/\| 1 \| 笔杆 \| parts\/barrel\.turnery\.json \| 1 \| — \| 4\.71 \| 10 × 10 × 60 \|/)
    expect(md).toMatch(/共 2 件/)
    const step = await run("export", { path: "pen.step" })
    expect(step.ok, step.text).toBe(true)
    const text = new TextDecoder().decode(disk.get("/work/pen.step") as Uint8Array)
    expect(text.match(/PRODUCT\(/g)?.length).toBeGreaterThanOrEqual(2)
    const stl = await run("export", { path: "pen.stl" })
    expect(stl.text).toMatch(/pen\.zip/)
    expect(disk.has("/work/pen.zip")).toBe(true)
    const py = await run("export", { path: "pen.py" })
    expect(py.text).toMatch(/装配不能导出成 build123d 代码/)
  })

  it("edits a part inside its assembly: the others show around it, and checks can name them", async () => {
    const { run } = await penWorkspace()
    const open = await run("open_part", { path: "parts/barrel.turnery.json", context: "pen.turnery-asm.json" })
    expect(open.ok, open.text).toBe(true)
    expect(open.text).toMatch(/在装配「pen」里编辑：装配里的其他零件（笔帽）/)
    const st = await run("get_state", {})
    expect(st.text).toMatch(/共享参数文件：\.\.\/pen\.params\.json（D、L）/)
    const chk = await run("check", { items: [{ id: "top", said: "笔杆顶面贴着笔帽", kind: "gap", a: { face: { normal: "+Z" } }, b: { part: "笔帽" }, max: 0 }] })
    expect(chk.text).toMatch(/✓[^\n]*笔杆顶面贴着笔帽/)
    const m = await run("measure", { a: { part: "笔帽" } })
    expect(m.text).toMatch(/参考体「笔帽」 · 外形 12×12×20/)
    // Out of the assembly again.
    const out = await run("open_part", { path: "parts/barrel.turnery.json" })
    expect(out.text).not.toMatch(/在装配/)
    const bad = await run("open_part", { path: "parts/barrel.turnery.json", context: "nothing.turnery-asm.json" })
    expect(bad.ok).toBe(false)
  })

  it("keeps assemblies and parts apart, refuses cycles, and uses the last good shape of a failing part", async () => {
    const { run, files } = await penWorkspace()
    const ext = await run("sketch", { id: "x", on: { plane: "XY" }, shapes: [{ type: "circle", d: 2 }] })
    expect(ext.text).toMatch(/装配里只能放零件/)
    await run("open_part", { path: "parts/barrel.turnery.json" })
    const comp = await run("component", { id: "c", file: "cap.turnery.json" })
    expect(comp.text).toMatch(/零件文件里不能放 component/)
    // A sub-assembly that contains the assembly that contains it.
    await files.write("/work/sub.turnery-asm.json", JSON.stringify({ params: {}, features: [{ id: "back", op: "component", file: "pen.turnery-asm.json" }] }))
    await run("open_part", { path: "pen.turnery-asm.json" })
    const loop = await run("component", { id: "sub", file: "sub.turnery-asm.json" })
    expect(loop.text).toMatch(/循环引用：pen\.turnery-asm\.json → sub\.turnery-asm\.json → pen\.turnery-asm\.json/)
    await run("delete_feature", { id: "sub" })
    // A part with a failing fillet still shows, as it was before the fillet.
    await run("open_part", { path: "parts/barrel.turnery.json" })
    await run("fillet", { id: "f", edges: { kind: "circle", extreme: "+Z" }, r: 50 })
    await run("open_part", { path: "pen.turnery-asm.json" })
    const st = await run("get_state", {})
    expect(st.text).toMatch(/零件「笔杆」有 1 个特征失败，用的是失败前的形状/)
  })

  it("writes shared parameters onto the file as it is now, lets own parameters use them, and stops keeping the values in use", async () => {
    const { run, files, disk } = await penWorkspace()
    // Someone edits the shared file; before the watcher fires, the agent sets another shared parameter.
    await files.write("/work/pen.params.json", JSON.stringify({ params: { D: 10, L: 30 } }))
    const set = await run("set_params", { set: { D: 12 } })
    expect(set.ok, set.text).toBe(true)
    expect(JSON.parse(disk.get("/work/pen.params.json") as string).params).toEqual({ D: 12, L: 30 })
    await run("open_part", { path: "parts/cap.turnery.json" })
    const own = await run("set_params", { set: { R: "D/2" } })
    expect(own.ok, own.text).toBe(true)
    const saved = JSON.parse(disk.get("/work/parts/cap.turnery.json") as string)
    expect(saved.params).toEqual({ t: 1, R: "D/2" })
    // An own parameter the shared file overrides: stopping keeps the shared value that was in use.
    await run("set_params", { set: { t: 1 } })
    disk.set("/work/parts/cap.turnery.json", JSON.stringify({ ...saved, params: { ...saved.params, D: 5 } }))
    await files.write("/work/parts/cap.turnery.json", disk.get("/work/parts/cap.turnery.json") as string)
    await run("get_state", {})
    const stop = await run("share_params", { stop: true })
    expect(stop.ok, stop.text).toBe(true)
    expect(JSON.parse(disk.get("/work/parts/cap.turnery.json") as string).params.D).toBe(12)
  })

  it("leaves a shadowed own parameter alone on other edits, and won't write a shared file that no longer resolves", async () => {
    const { run, files, disk } = await penWorkspace()
    await run("open_part", { path: "parts/cap.turnery.json" })
    const cap = JSON.parse(disk.get("/work/parts/cap.turnery.json") as string)
    await files.write("/work/parts/cap.turnery.json", JSON.stringify({ ...cap, params: { ...cap.params, D: 5 }, paramNotes: { D: "自己的直径" } }))
    expect((await run("set_params", { set: { R: "D/2" } })).ok).toBe(true)
    const saved = JSON.parse(disk.get("/work/parts/cap.turnery.json") as string)
    expect(saved.params.D).toBe(5)
    expect(saved.paramNotes.D).toBe("自己的直径")
    // The shared file changed on disk to depend on D; removing D would leave L unresolvable.
    await files.write("/work/pen.params.json", JSON.stringify({ params: { D: 10, L: "D*6" } }))
    const bad = await run("set_params", { remove: ["D"] })
    expect(bad.ok).toBe(false)
    expect(bad.text).toMatch(/共享参数不对，没有写入/)
    expect(JSON.parse(disk.get("/work/pen.params.json") as string).params).toEqual({ D: 10, L: "D*6" })
  })

  it("keeps a single component a named part: measured by name, hidden when asked", async () => {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
    const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
    await mem.files.write("/work/block.turnery.json", JSON.stringify({ params: {}, features: box(10, 10, 10) }))
    await run("open_part", { path: "one.turnery-asm.json", create: true })
    await run("component", { id: "b", name: "块", file: "block.turnery.json", hidden: true })
    const m = await run("measure", { a: { part: "块" } })
    expect(m.text).toMatch(/零件「块」 · 体积 1000/)
    const k = new Kernel()
    k.setComponents([{ file: "block.turnery.json", tree: { params: {}, features: box(10, 10, 10) } }])
    k.rebuild({ params: {}, features: [{ id: "b", op: "component", name: "块", file: "block.turnery.json", hidden: true }] })
    expect(k.display().parts?.[0]).toMatchObject({ name: "块", hidden: true })
    k.dispose()
  })

  it("builds a component once while only another one changes", async () => {
    const { run, touch, disk } = await penWorkspace()
    const spy = vi.spyOn(Kernel.prototype, "rebuild")
    const cap = JSON.parse(disk.get("/work/parts/cap.turnery.json") as string) as Tree
    cap.params.t = 2
    await touch("/work/parts/cap.turnery.json", JSON.stringify(cap))
    await run("get_state", {})
    const built = spy.mock.calls.map(([t]) => (t.features[1] as { distance?: unknown })?.distance)
    spy.mockRestore()
    // The cap's tree was built again; the barrel's (distance "L") came from the cache.
    expect(built).toContain(20)
    expect(built).not.toContain("L")
  })
})
