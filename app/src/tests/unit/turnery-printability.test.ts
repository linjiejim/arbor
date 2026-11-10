// 3D-printing checks (docs/specs/2026-11-10-turnery-printability.md): overhang, minimum wall, bed contact.
import { beforeAll, describe, expect, it } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext } from "@/desktop/core/protocol"
import { initNodeKernel } from "@/studio/kernel/node"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

async function part() {
  const engine = new Engine({ kernel: new DirectKernel(), files: memFiles().files })
  const run = async (name: string, input: unknown) => {
    const r = await engine.run(name, input, AGENT)
    if (name !== "check") expect(r.ok, `${name}: ${r.text}`).toBe(true)
    return r
  }
  await run("open_part", { path: "p", create: true })
  return run
}

const PRINT = [
  { id: "oh", said: "不加支撑能打", kind: "overhang" },
  { id: "bed", said: "底面贴平台", kind: "bed", min: 300 },
]

describe("turnery: printability checks", () => {
  it("a cube prints as it stands; a T needs support under its arms, and none upside down", async () => {
    const run = await part()
    await run("sketch", { id: "s", on: { plane: "XY" }, shapes: [{ type: "rect", w: 20, h: 20 }] })
    await run("extrude", { id: "stem", sketch: "s", distance: 20 })
    let res = await run("check", { items: PRINT })
    expect(res.text).toMatch(/✓ oh[^\n]*不需要支撑/)
    expect(res.text).toMatch(/✓ bed[^\n]*贴在平台上 400 mm²/)

    // A 40 × 20 slab on top: 10 mm sticks out on either side, 2 × 10 × 20 = 400 mm² facing down.
    await run("sketch", { id: "s2", on: { plane: "XY", offset: 20 }, shapes: [{ type: "rect", w: 40, h: 20 }] })
    await run("extrude", { id: "arms", sketch: "s2", distance: 5 })
    res = await run("check", {})
    expect(res.ok).toBe(true)
    expect(res.text).toMatch(/✗ oh[^\n]*需要支撑 400 mm²（最大 90°/)

    res = await run("check", { items: [{ id: "flip", said: "倒过来打", kind: "overhang", up: "-Z" }, { id: "bed2", said: "倒过来贴平台", kind: "bed", up: "-Z" }] })
    expect(res.text).toMatch(/✓ flip[^\n]*不需要支撑/)
    expect(res.text).toMatch(/✓ bed2[^\n]*贴在平台上 800 mm²/)
  }, 60_000)

  it("a 45° chamfer under the arms prints; the limit can be made stricter", async () => {
    const run = await part()
    // The T's profile drawn on XZ with 45° undersides, pulled along Y.
    await run("sketch", { id: "s", on: { plane: "XZ" }, shapes: [{ type: "polyline", points: [[-10, 0], [10, 0], [10, 10], [20, 20], [20, 25], [-20, 25], [-20, 20], [-10, 10]] }] })
    await run("extrude", { id: "t", sketch: "s", distance: 20 })
    const res = await run("check", { items: [{ id: "oh", said: "45° 能打", kind: "overhang" }, { id: "strict", said: "只允许 30°", kind: "overhang", max: 30 }] })
    expect(res.text).toMatch(/✓ oh/)
    expect(res.text).toMatch(/✗ strict[^\n]*最大 45°/)
  }, 60_000)

  it("finds the thinnest wall, per part, and says which part", async () => {
    const run = await part()
    await run("set_params", { set: { t: 2 } })
    await run("sketch", { id: "s", on: { plane: "XY" }, shapes: [{ type: "rect", w: 40, h: 30 }] })
    await run("extrude", { id: "body", sketch: "s", distance: 20 })
    await run("shell", { id: "sh", open: { normal: "+Z", extreme: "+Z" }, t: "t" })
    let res = await run("check", { items: [{ id: "wall", said: "壁不薄于 0.8", kind: "min_wall", min: 0.8 }] })
    expect(res.text).toMatch(/✓ wall[^\n]*没有比 0.8 mm 更薄的地方/)
    await run("set_params", { set: { t: 0.6 } })
    res = await run("check", {})
    expect(res.text).toMatch(/✗ wall[^\n]*最薄 0.6 mm/)

    await run("set_params", { set: { t: 2 } })
    await run("split", { id: "sp", by: { plane: "XY", offset: 10 }, parts: ["下", "上"] })
    res = await run("check", { items: [{ id: "oh", said: "上半能打", kind: "overhang", part: "上" }, { id: "nope", said: "没有的零件", kind: "bed", part: "盖" }] })
    // The upper ring stands on its own cut face: nothing hangs.
    expect(res.text).toMatch(/✓ oh/)
    expect(res.text).toMatch(/\? nope[^\n]*没有叫「盖」的零件（有：下、上）/)
  }, 60_000)
})

describe("turnery: 3MF export", () => {
  it("writes one object per part, in millimetres, that unzips to a valid model", async () => {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
    const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
    await run("open_part", { path: "p", create: true })
    await run("sketch", { id: "s", on: { plane: "XY" }, shapes: [{ type: "rect", w: 20, h: 10 }] })
    await run("extrude", { id: "e", sketch: "s", distance: 8 })
    await run("split", { id: "sp", by: { plane: "XY", offset: 4 }, parts: ["下", "上"] })
    const res = await run("export", { path: "out/p.3mf" })
    expect(res.ok, res.text).toBe(true)
    const bytes = (await mem.files.readBytes("/work/out/p.3mf"))!
    const text = new TextDecoder().decode(bytes)
    // Stored, not deflated: the XML is readable in place.
    expect(text.startsWith("PK")).toBe(true)
    for (const name of ["[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model"]) expect(text).toContain(name)
    expect(text).toContain('unit="millimeter"')
    expect(text.match(/<object /g)?.length).toBe(2)
    expect(text).toContain('name="下"')
    expect(text.match(/<item /g)?.length).toBe(2)
    // A box half: 8 corners, 12 triangles, every index inside the vertex list.
    const first = text.slice(text.indexOf("<object "), text.indexOf("</object>"))
    const nv = first.match(/<vertex /g)!.length
    expect(first.match(/<triangle /g)!.length).toBe(12)
    for (const m of first.matchAll(/v[123]="(\d+)"/g)) expect(Number(m[1])).toBeLessThan(nv)
    const zs = [...first.matchAll(/ z="([\d.-]+)"/g)].map((m) => Number(m[1]))
    expect(Math.min(...zs)).toBe(0)
    expect(Math.max(...zs)).toBe(4)
  }, 60_000)
})
