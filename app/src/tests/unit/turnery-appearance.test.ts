// Part colours and finishes: saved in part files and on components, resolved through assemblies,
// changed without rebuilding, undone across files, and written into 3MF, STEP, the parts list and code.
import { beforeAll, describe, expect, it, vi } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext, LookRequest } from "@/desktop/core/protocol"
import { hexOf, isColor, lookText, normalColor, sameGeometry, setPartLook, withoutLooks } from "@/studio/appearance"
import { toBuild123d } from "@/studio/codegen"
import { Tree } from "@/studio/dsl"
import { Kernel, type ComponentSource } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { getOC, makeBox, makeCylinder } from "replicad"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }
const USER: CallContext = { actor: "user", cwd: "/work" }

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

const box = (w: number, h: number, d: number): Tree["features"] => [
  { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w, h }] },
  { id: "box", op: "extrude", sketch: "sk", distance: d },
]
const shell: Tree = { params: {}, features: [...box(40, 30, 20), { id: "sp", op: "split", by: { plane: "XY", offset: 12 }, parts: ["底壳", "上盖"] }] }

/** An engine whose kernel counts rebuilds, and a window that hands back what `look` asked it to draw. */
function setup() {
  const mem = memFiles()
  const kernel = new DirectKernel()
  const rebuild = vi.spyOn(kernel, "rebuild")
  const looks: LookRequest[] = []
  const engine = new Engine({ kernel, files: mem.files, screen: () => ({ look: async (req) => (looks.push(req), ["data:image/png;base64,"]) }) })
  const run = async (name: string, input: unknown, ctx: CallContext = AGENT) => engine.run(name, input, ctx)
  return { engine, kernel, rebuild, looks, run, ...mem }
}

describe("appearance: values and tree edits", () => {
  it("takes palette names in English or Chinese and #RRGGBB, saves the palette id", () => {
    expect(isColor("orange") && isColor("橙") && isColor("#F39A2B") && isColor("#abc")).toBe(true)
    expect(isColor("orangey") || isColor("#12345")).toBe(false)
    expect(hexOf("橙")).toBe("#f39a2b")
    expect(hexOf("#ABC")).toBe("#aabbcc")
    expect(normalColor("橙")).toBe("orange")
    expect(normalColor("#F39A2B")).toBe("orange")
    expect(normalColor("#123456")).toBe("#123456")
    expect(lookText({ color: "orange", finish: "metal" })).toBe("橙 · 金属")
    expect(lookText({ color: "#123456" })).toBe("#123456")
    expect(lookText({ finish: "clear" })).toBe("透明")
    expect(Tree.safeParse({ params: {}, features: [], appearance: { color: "purpleish" } }).success).toBe(false)
  })

  it("sets the whole part or some parts, clears with null, leaves the tree alone when nothing changes", () => {
    const a = setPartLook(shell, undefined, { color: "gray" })
    expect(a.appearance).toEqual({ color: "gray" })
    const b = setPartLook(a, ["上盖"], { color: "橙", finish: "metal" })
    expect(b.appearance).toEqual({ color: "gray", parts: { 上盖: { color: "orange", finish: "metal" } } })
    expect(setPartLook(b, ["上盖"], { color: "orange" })).toBe(b)
    const c = setPartLook(setPartLook(b, ["上盖"], { color: null, finish: null }), undefined, { color: null })
    expect(c.appearance).toBeUndefined()
    expect("appearance" in c).toBe(false)
    // Looks are not geometry: the trees differ only in them.
    expect(sameGeometry(shell, b)).toBe(true)
    expect(sameGeometry(shell, { ...b, params: { x: 1 } })).toBe(false)
    const asm: Tree = { params: {}, features: [{ id: "c", op: "component", file: "a.turnery.json", appearance: { color: "red" } }] }
    expect(withoutLooks(asm).features[0]).toEqual({ id: "c", op: "component", file: "a.turnery.json" })
  })
})

describe("appearance: the kernel", () => {
  it("draws each part in its own look and restyles without rebuilding", () => {
    const k = new Kernel()
    k.rebuild(shell)
    const steps = (k as unknown as { steps: { body: unknown }[] }).steps.map((s) => s.body)
    const coloured = setPartLook(setPartLook(shell, undefined, { color: "gray" }), ["上盖"], { color: "orange", finish: "clear" })
    expect(k.restyle(coloured)).toBe(true)
    // Same bodies: nothing was built again.
    expect((k as unknown as { steps: { body: unknown }[] }).steps.map((s) => s.body)).toEqual(steps)
    const d = k.display()
    expect(d.parts?.map((p) => [p.name, p.look])).toEqual([
      ["底壳", { color: "gray", source: "part" }],
      ["上盖", { color: "orange", finish: "clear", source: "part" }],
    ])
    // A geometry change is not a restyle.
    expect(k.restyle({ ...coloured, params: { a: 1 } })).toBe(false)
    expect(k.looks().map((l) => l.look.color)).toEqual(["gray", "orange"])
    k.dispose()
  })

  it("resolves an assembly's looks: placement over file, standard parts as metal, down a sub-assembly", () => {
    const part = (look?: Tree["appearance"]): Tree => ({ params: {}, features: box(10, 10, 10), ...(look ? { appearance: look } : {}) })
    const sub: Tree = {
      params: {},
      features: [
        { id: "inner", op: "component", name: "内块", file: "a.turnery.json" },
        { id: "tinted", op: "component", name: "染色块", file: "a.turnery.json", at: [20, 0, 0], appearance: { color: "green" } },
      ],
    }
    const sources = (aLook?: Tree["appearance"]): ComponentSource[] => [
      { file: "a.turnery.json", tree: part(aLook) },
      { file: "sub.turnery-asm.json", tree: sub, components: [{ file: "a.turnery.json", tree: part(aLook) }] },
    ]
    const tree: Tree = {
      params: {},
      features: [
        { id: "plain", op: "component", name: "白块", file: "a.turnery.json" },
        { id: "red", op: "component", name: "红块", file: "a.turnery.json", at: [0, 20, 0], appearance: { color: "red", finish: "metal" } },
        { id: "screw", op: "component", name: "螺钉", standard: { type: "screw", size: "M3", length: 10 }, at: [0, 40, 0] },
        { id: "nest", op: "component", name: "子", file: "sub.turnery-asm.json", at: [0, 60, 0] },
      ],
    }
    const k = new Kernel()
    k.setComponents(sources({ color: "blue" }))
    const rep = k.rebuild(tree)
    expect(rep.features.every((f) => f.state === "ok"), JSON.stringify(rep.features)).toBe(true)
    const looks = () => Object.fromEntries(k.display().parts!.map((p) => [p.name, p.look]))
    expect(looks()).toEqual({
      白块: { color: "blue", source: "part" },
      红块: { color: "red", finish: "metal", source: "part" },
      螺钉: { source: "standard" },
      "子/内块": { color: "blue", source: "part" },
      "子/染色块": { color: "green", source: "part" },
    })
    expect(k.display().parts!.find((p) => p.name === "子/内块")).toMatchObject({ component: "nest", sub: "内块" })
    // The part file changes colour only: handed over again, restyled, not rebuilt.
    k.setComponents(sources({ color: "yellow" }))
    expect(k.restyle(tree)).toBe(true)
    expect(looks().白块).toEqual({ color: "yellow", source: "part" })
    expect(looks()["子/内块"]).toEqual({ color: "yellow", source: "part" })
    // Its geometry changes: that needs a rebuild.
    k.setComponents([{ file: "a.turnery.json", tree: { ...part(), features: box(10, 10, 12) } }, sources()[1]])
    expect(k.restyle(tree)).toBe(false)
    k.dispose()
  })
})

describe("appearance: the engine", () => {
  it("colours a part file and its split parts without rebuilding, undoably", async () => {
    const { run, rebuild, disk } = setup()
    expect((await run("open_part", { path: "box.turnery.json", create: true })).ok).toBe(true)
    expect((await run("set_tree", { tree: shell })).ok).toBe(true)
    const builds = rebuild.mock.calls.length
    let r = await run("set_appearance", { color: "gray" })
    expect(r.ok, r.text).toBe(true)
    r = await run("set_appearance", { parts: ["上盖"], color: "橙", finish: "metal" })
    expect(r.text).toMatch(/外观：底壳 灰、上盖 橙 · 金属/)
    expect(rebuild.mock.calls.length).toBe(builds)
    expect(JSON.parse(disk.get("/work/box.turnery.json") as string).appearance).toEqual({ color: "gray", parts: { 上盖: { color: "orange", finish: "metal" } } })
    r = await run("set_appearance", { parts: ["盖子"], color: "red" })
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/没有叫「盖子」的零件：现在有 底壳、上盖/)
    expect((await run("undo", {})).ok).toBe(true)
    expect(JSON.parse(disk.get("/work/box.turnery.json") as string).appearance).toEqual({ color: "gray" })
    const st = await run("get_state", {})
    expect(st.text).toMatch(/外观：底壳 灰、上盖 灰/)
    expect(rebuild.mock.calls.length).toBe(builds)
  })

  it("puts a self-made part's colour in its file and a standard part's on the component; undo puts the file back", async () => {
    const { run, rebuild, disk, files } = setup()
    await files.write("/work/parts/block.turnery.json", JSON.stringify({ params: {}, features: box(10, 10, 10) }))
    await run("open_part", { path: "asm.turnery-asm.json", create: true })
    expect((await run("component", { id: "a", name: "块", file: "parts/block.turnery.json" })).ok).toBe(true)
    expect((await run("component", { id: "b", name: "副本", file: "parts/block.turnery.json", at: [20, 0, 0] })).ok).toBe(true)
    const s = await run("component", { id: "s", name: "螺钉", standard: { type: "screw", size: "M3", length: 8 }, at: [0, 20, 0], appearance: { color: "black" } })
    expect(s.ok, s.text).toBe(true)
    const builds = rebuild.mock.calls.length

    let r = await run("set_appearance", { parts: ["块"], color: "orange" }, USER)
    expect(r.ok, r.text).toBe(true)
    expect(r.text).toMatch(/写进 parts\/block\.turnery\.json/)
    // Both copies of the part file follow; the screw keeps its own.
    expect(r.text).toMatch(/外观：块 橙、副本 橙、螺钉 黑/)
    expect(JSON.parse(disk.get("/work/parts/block.turnery.json") as string).appearance).toEqual({ color: "orange" })
    r = await run("set_appearance", { parts: ["副本"], color: "teal", where: "assembly" }, USER)
    expect(r.text).toMatch(/写在装配的 component「副本」上/)
    expect(r.text).toMatch(/块 橙、副本 青/)
    r = await run("set_appearance", { parts: ["螺钉"], finish: "matte" }, USER)
    expect(r.text).toMatch(/螺钉 黑/)
    r = await run("set_appearance", { parts: ["螺钉"], color: "red", where: "file" }, USER)
    expect(r.ok).toBe(false)
    expect(rebuild.mock.calls.length).toBe(builds)

    // Undo three times: the screw, the copy, then the part file goes back to no colour.
    for (let i = 0; i < 3; i++) expect((await run("undo", {}, USER)).ok).toBe(true)
    expect(JSON.parse(disk.get("/work/parts/block.turnery.json") as string).appearance).toBeUndefined()
    let st = await run("get_state", {})
    expect(st.text).toMatch(/外观：块 未设置（白模）、副本 未设置（白模）、螺钉 黑/)
    expect((await run("redo", {}, USER)).ok).toBe(true)
    expect(JSON.parse(disk.get("/work/parts/block.turnery.json") as string).appearance).toEqual({ color: "orange" })
    st = await run("get_state", {})
    expect(st.text).toMatch(/块 橙、副本 橙/)
    expect(rebuild.mock.calls.length).toBe(builds)
  })

  it("follows a part file whose colour someone else changed, without rebuilding the assembly", async () => {
    const { run, rebuild, touch, files } = setup()
    await files.write("/work/parts/block.turnery.json", JSON.stringify({ params: {}, features: box(10, 10, 10) }))
    await run("open_part", { path: "asm.turnery-asm.json", create: true })
    await run("component", { id: "a", name: "块", file: "parts/block.turnery.json" })
    await run("component", { id: "b", name: "块2", file: "parts/block.turnery.json", at: [20, 0, 0] })
    const builds = rebuild.mock.calls.length
    await touch("/work/parts/block.turnery.json", JSON.stringify({ params: {}, features: box(10, 10, 10), appearance: { color: "purple" } }))
    const st = await run("get_state", {})
    expect(st.text).toMatch(/块 紫、块2 紫/)
    expect(st.text).toMatch(/block\.turnery\.json 更新了（只改了外观）/)
    expect(rebuild.mock.calls.length).toBe(builds)
  })

  it("new parts in an assembly can start with a colour; look draws and names the colours, or a white model", async () => {
    const { run, engine, looks, disk } = setup()
    await run("open_part", { path: "asm.turnery-asm.json", create: true })
    const add = await engine.run("add_part", { name: "外壳", color: "blue" }, USER)
    expect(add.ok, add.text).toBe(true)
    expect(JSON.parse(disk.get("/work/parts/外壳.turnery.json") as string).appearance).toEqual({ color: "blue" })
    await run("open_part", { path: "parts/外壳.turnery.json" })
    await run("set_tree", { tree: { ...shell, appearance: { color: "blue" } } })
    await run("set_appearance", { parts: ["上盖"], color: "white", finish: "clear" })
    let r = await run("look", {})
    expect(r.text).toMatch(/按零件的颜色画（蓝：底壳；白 · 透明：上盖）/)
    expect(looks.at(-1)?.plain).toBe(false)
    r = await run("look", { plain: true })
    expect(r.text).toMatch(/白模/)
    expect(looks.at(-1)?.plain).toBe(true)
  })
})

describe("appearance: exports", () => {
  it("writes colours into 3MF and STEP (unset parts stay unset), the parts list and build123d", async () => {
    const { run, disk } = setup()
    await run("open_part", { path: "box.turnery.json", create: true })
    await run("set_tree", { tree: setPartLook(shell, ["上盖"], { color: "orange", finish: "clear" }) })

    expect((await run("export", { path: "out.3mf" })).ok).toBe(true)
    // Stored, not compressed: the model's XML is in the zip as written.
    const zip = new TextDecoder().decode(disk.get("/work/out.3mf") as Uint8Array)
    expect(zip).toMatch(/<basematerials id="3"><base name="橙" displaycolor="#F39A2B66"\/><\/basematerials>/)
    expect(zip).toMatch(/<object id="1" type="model" name="底壳"><mesh>/)
    expect(zip).toMatch(/<object id="2" type="model" name="上盖" pid="3" pindex="0">/)

    expect((await run("export", { path: "out.step" })).ok).toBe(true)
    const step = disk.get("/work/out.step") as Uint8Array
    const text = new TextDecoder().decode(step)
    const rgb = [...text.matchAll(/COLOUR_RGB\('',([\d.]+),([\d.]+),([\d.]+)\)/g)].map((m) => m.slice(1).map(Number))
    // One colour (the lid's), written back as the sRGB it was given; no default red for the other part.
    expect(rgb.length).toBeGreaterThan(0)
    for (const [r, g, b] of rgb) {
      expect(r).toBeCloseTo(0xf3 / 255, 2)
      expect(g).toBeCloseTo(0x9a / 255, 2)
      expect(b).toBeCloseTo(0x2b / 255, 2)
    }

    expect((await run("export", { path: "bom.md" })).ok).toBe(true)
    const bom = disk.get("/work/bom.md") as string
    expect(bom).toMatch(/\| 序号 \| 名称 \| 文件 \| 数量 \| 颜色 \|/)
    expect(bom).toMatch(/\| 底壳 \| box\.turnery\.json \| 1 \| — \|/)
    expect(bom).toMatch(/\| 上盖 \| box\.turnery\.json \| 1 \| 橙 · 透明 \|/)

    const code = toBuild123d(setPartLook(setPartLook(shell, undefined, { color: "gray" }), ["上盖"], { color: "orange" }))
    expect(code).toMatch(/parts\["底壳"\]\.color = Color\(0\.522, 0\.533, 0\.553\)  # 灰/)
    expect(code).toMatch(/parts\["上盖"\]\.color = Color\(0\.953, 0\.604, 0\.169\)  # 橙/)
  })

  it("keeps an uncoloured single body's STEP as before", async () => {
    const k = new Kernel()
    k.rebuild({ params: {}, features: box(10, 10, 10) })
    const plain = new TextDecoder().decode(new Uint8Array(await (await k.exportBody("step"))!.arrayBuffer()))
    expect(plain).not.toMatch(/COLOUR_RGB/)
    k.restyle({ params: {}, features: box(10, 10, 10), appearance: { color: "#336699" } })
    const coloured = new TextDecoder().decode(new Uint8Array(await (await k.exportBody("step"))!.arrayBuffer()))
    const [r, g, b] = coloured.match(/COLOUR_RGB\('',([\d.]+),([\d.]+),([\d.]+)\)/)!.slice(1).map(Number)
    expect([r, g, b].map((x) => Math.round(x * 255))).toEqual([0x33, 0x66, 0x99])
    k.dispose()
  })
})

/** A STEP file the way a vendor ships a board: one solid coloured whole, one with a face of its own colour. */
function colouredStep(): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc = getOC() as any
  const board = makeBox([-20, -15, 0], [20, 15, 1.6])
  const chip = makeBox([-5, -5, 1.6], [5, 5, 4])
  const text = (s: string) => new oc.TCollection_ExtendedString(s, true)
  const doc = new oc.TDocStd_Document(text("XmlOcaf"))
  const main = doc.Main()
  const shapes = oc.XCAFDoc_DocumentTool.ShapeTool(main)
  const colors = oc.XCAFDoc_DocumentTool.ColorTool(main)
  const rgba = (r: number, g: number, b: number) => new oc.Quantity_ColorRGBA(r, g, b, 1)
  const a = shapes.NewShape()
  shapes.SetShape(a, board.wrapped)
  colors.SetColor(a, rgba(0, 0.5, 0), oc.XCAFDoc_ColorType.XCAFDoc_ColorSurf)
  const b = shapes.NewShape()
  shapes.SetShape(b, chip.wrapped)
  colors.SetColor(b, rgba(0.02, 0.02, 0.02), oc.XCAFDoc_ColorType.XCAFDoc_ColorSurf)
  // The chip's top face (the last of a box's faces here) gets a colour of its own.
  const top = chip.faces.find((f) => f.normalAt().z > 0.9)!
  const sub = shapes.AddSubShape(b, top.wrapped)
  colors.SetColor(sub, rgba(1, 1, 1), oc.XCAFDoc_ColorType.XCAFDoc_ColorSurf)
  shapes.UpdateAssemblies()
  const writer = new oc.STEPCAFControl_Writer(new oc.XSControl_WorkSession(), false)
  writer.SetColorMode(true)
  writer.Perform(doc, "/coloured-board.step", new oc.Message_ProgressRange())
  const bytes = oc.FS.readFile("/coloured-board.step") as Uint8Array
  oc.FS.unlink("/coloured-board.step")
  return bytes
}

describe("appearance: a STEP file's own colours", () => {
  it("reads them per face, shows them until a colour is set, and exports the main one", async () => {
    const bytes = colouredStep()
    const text = new TextDecoder().decode(bytes)
    expect(text).toMatch(/STYLED_ITEM/)
    const k = new Kernel()
    k.setComponents([{ file: "board.step", bytes }, { file: "a.turnery.json", tree: { params: {}, features: box(5, 5, 5) } }])
    const tree: Tree = { params: {}, features: [{ id: "b", op: "component", name: "板", file: "board.step" }, { id: "a", op: "component", name: "块", file: "a.turnery.json", at: [40, 0, 0] }] }
    expect(k.rebuild(tree).features.every((f) => f.state === "ok")).toBe(true)
    let d = k.display()
    const board = d.parts!.findIndex((p) => p.name === "板")
    const colours = d.groups.filter((g) => g.part === board).map((g) => g.color)
    // 6 board faces green (#00bc00 is linear 0.5 written back as sRGB), 6 chip faces: 5 near black, the top white.
    expect(colours.filter((c) => c === "#00bc00")).toHaveLength(6)
    expect(colours.filter((c) => c === "#ffffff")).toHaveLength(1)
    expect(colours.filter((c) => c === "#272727")).toHaveLength(5)
    expect(d.parts![board].look).toEqual({ source: "step", fileColor: "#00bc00" })
    expect(d.groups.filter((g) => g.part !== board).every((g) => !g.color)).toBe(true)
    // A colour set on the component wins over the file's (in the view: the face colours are only a fallback).
    k.restyle({ ...tree, features: [{ ...tree.features[0], appearance: { color: "orange" } } as Tree["features"][number], tree.features[1]] })
    d = k.display()
    expect(d.parts![board].look).toEqual({ color: "orange", source: "step", fileColor: "#00bc00" })
    k.restyle(tree)
    const zip = new TextDecoder().decode(new Uint8Array(await (await k.exportBody("3mf"))!.arrayBuffer()))
    expect(zip).toMatch(/<base name="#00bc00" displaycolor="#00BC00FF"\/>/)
    k.dispose()
  })

  it("leaves the colours out when the file's solids don't match what was read", async () => {
    const { stepFaceColors } = await import("@/studio/kernel/step-colors")
    const bytes = colouredStep()
    // A cylinder: none of the file's solids has its faces (two flat, one round).
    expect(stepFaceColors(bytes, makeCylinder(2, 5))).toBeNull()
    expect(stepFaceColors(new TextEncoder().encode("ISO-10303-21;\nDATA;\nENDSEC;\n"), makeBox([0, 0, 0], [1, 1, 1]))).toBeNull()
  })
})

describe("appearance: the project list and the site's assistant", () => {
  it("lists part files with their colours, and colours a part file nobody has open (undoable from its assembly)", async () => {
    const { run, rebuild, disk, files, engine } = setup()
    await files.write("/work/proj/parts/block.turnery.json", JSON.stringify({ params: {}, features: box(10, 10, 10), appearance: { color: "red" } }))
    await files.write("/work/proj/parts/plain.turnery.json", JSON.stringify({ params: {}, features: box(5, 5, 5) }))
    await run("open_part", { path: "proj/asm.turnery-asm.json", create: true })
    await run("component", { id: "a", name: "块", file: "parts/block.turnery.json" })
    await run("component", { id: "b", name: "块2", file: "parts/block.turnery.json", at: [20, 0, 0] })
    await engine.run("scan_project", {}, USER)
    const listed = (p: string) => engine.snapshot().project?.files.find((f) => f.path.endsWith(p))
    expect(listed("block.turnery.json")?.look).toEqual({ color: "red" })
    expect(listed("plain.turnery.json")?.look).toBeUndefined()
    const builds = rebuild.mock.calls.length

    // From the sidebar: the file isn't open, so it is written as it is and not built.
    const r = await engine.run("set_appearance", { color: "green" }, { ...USER, part: "/work/proj/parts/block.turnery.json" })
    expect(r.ok, r.text).toBe(true)
    expect(engine.snapshot().parts.some((p) => p.path.endsWith("block.turnery.json"))).toBe(false)
    expect(JSON.parse(disk.get("/work/proj/parts/block.turnery.json") as string).appearance).toEqual({ color: "green" })
    expect(listed("block.turnery.json")?.look).toEqual({ color: "green" })
    expect((await run("get_state", {})).text).toMatch(/块 绿、块2 绿/)
    expect(rebuild.mock.calls.length).toBe(builds)
    // The assembly on screen reads that file: its undo puts the file back.
    expect((await run("undo", {}, USER)).ok).toBe(true)
    expect(JSON.parse(disk.get("/work/proj/parts/block.turnery.json") as string).appearance).toEqual({ color: "red" })
    expect(rebuild.mock.calls.length).toBe(builds)
  })

  it("gives the site's assistant its own set_appearance, and the desktop one command of that name", async () => {
    const { executeTool } = await import("@/studio/apply")
    const { COMMANDS } = await import("@/desktop/core/catalog")
    expect(COMMANDS.filter((c) => c.name === "set_appearance")).toHaveLength(1)
    expect(COMMANDS.find((c) => c.name === "set_appearance")?.input.shape).toHaveProperty("where")
    const k = new Kernel()
    const port = { rebuild: async (t: Tree) => k.rebuild(t), inspect: async () => "" }
    let run = await executeTool(port, shell, "set_appearance", { parts: ["上盖"], color: "orange", finish: "clear" })
    expect(run.output.ok, run.output.text).toBe(true)
    expect(run.output.text).toMatch(/外观：底壳 未设置（白模）、上盖 橙 · 透明/)
    expect(run.tree.appearance).toEqual({ parts: { 上盖: { color: "orange", finish: "clear" } } })
    run = await executeTool(port, run.tree, "set_appearance", { parts: ["顶盖"], color: "red" })
    expect(run.output.text).toMatch(/没有叫「顶盖」的零件：现在有 底壳、上盖/)
    k.dispose()
  })
})
