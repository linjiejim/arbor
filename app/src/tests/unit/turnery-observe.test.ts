// Turnery, part one of the agent-modelling spec (docs/specs/2026-11-07-turnery-agent-modeling.md):
// seeing small things (look focus / section / auto close-up / scale), step diagnostics,
// measuring between features and parts, and the position / gap checks.
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine, type Screen } from "@/desktop/core/engine"
import type { CallContext, LookRequest } from "@/desktop/core/protocol"
import { initNodeKernel } from "@/studio/kernel/node"
import { autoFocus, mmPerPixel } from "@/studio/look-plan"
import { DESKTOP_TOOLS, STUDIO_TOOLS } from "@/studio/tools"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

/** An engine with a fake window that records what `look` asked to draw. */
async function engineWithScreen() {
  const mem = memFiles()
  const looks: LookRequest[] = []
  const screen: Screen = {
    look: async (req) => {
      looks.push(req)
      return (req.shots ?? req.views).map(() => "data:image/png;base64,")
    },
  }
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, screen: () => screen })
  const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
  expect((await run("open_part", { path: "p", create: true })).ok).toBe(true)
  return { engine, run, looks, ...mem }
}

async function block(run: (n: string, i: unknown) => Promise<{ ok: boolean; text: string }>) {
  await run("set_params", { set: { L: 80, W: 50, H: 30 } })
  await run("sketch", { id: "sk", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] })
  const ex = await run("extrude", { id: "base", sketch: "sk", distance: "H" })
  expect(ex.ok, ex.text).toBe(true)
}

describe("turnery look: framing what is small", () => {
  it("adds a close-up of its own when the last change is a small corner of the model", async () => {
    const { run, looks } = await engineWithScreen()
    await block(run)
    await run("sketch", { id: "bs", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "circle", d: 3, center: [30, 15] }] })
    await run("extrude", { id: "boss", sketch: "bs", distance: 2 })
    const res = await run("look", {})
    expect(res.ok, res.text).toBe(true)
    const shots = looks.at(-1)!.shots!
    const auto = shots.at(-1)!
    expect(auto.label).toBe("特写：拉伸2（自动）")
    // Framed on the boss (3 × 3 × 2), not the block.
    const b = auto.box!
    expect(b[1][2] - b[0][2]).toBeCloseTo(2, 1)
    expect(b[1][0] - b[0][0]).toBeLessThan(3.5)
    expect(res.text).toMatch(/整件 80×50×32 mm/)
    expect(res.text).toMatch(/特写（3×3×2 mm） 1 px ≈ 0\.0\d+ mm/)
    expect(res.text).toMatch(/自动加了一张特写/)
  })

  it("no close-up when the change is big, even if it touches a big face (holes modify the face they open in)", async () => {
    const { run, looks } = await engineWithScreen()
    await block(run)
    await run("sketch", { id: "cut", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "rect", w: 60, h: 30 }] })
    await run("extrude", { id: "pocket", sketch: "cut", distance: 10, mode: "cut", direction: "reverse" })
    await run("look", {})
    expect(looks.at(-1)!.shots!.some((s) => /自动/.test(s.label))).toBe(false)
  })

  it("frames every view on a feature, a part or picked faces; cuts a section; hides parts", async () => {
    const { run, looks } = await engineWithScreen()
    await block(run)
    const f = await run("look", { focus: "base" })
    expect(f.ok, f.text).toBe(true)
    expect(looks.at(-1)!.shots!.map((s) => s.label)).toEqual(["特写：拉伸1 · 等轴测", "特写：拉伸1 · 前视（从 -Y 看）"])
    const faces = await run("look", { focus: { faces: { normal: "+Z", extreme: "+Z" } }, views: ["top"] })
    expect(faces.ok, faces.text).toBe(true)
    // A flat face is framed with some depth around it, centred on it.
    const fb = looks.at(-1)!.shots![0].box!
    expect((fb[0][2] + fb[1][2]) / 2).toBeCloseTo(30, 3)
    const sec = await run("look", { section: { plane: "XZ", offset: 5 } })
    expect(sec.ok, sec.text).toBe(true)
    expect(looks.at(-1)!.section).toEqual({ axis: "Y", at: 5 })
    expect(looks.at(-1)!.shots!.map((s) => s.label)).toEqual(["前视（从 -Y 看）", "等轴测"])
    expect(sec.text).toMatch(/在 Y = 5 处剖开，去掉了前面（-Y）那一侧/)
    // An expression offset, and a custom direction.
    const dir = await run("look", { section: { plane: "XY", offset: "H/2" }, dir: [1, 1, 0.3] })
    expect(looks.at(-1)!.section).toEqual({ axis: "Z", at: 15 })
    expect(looks.at(-1)!.shots!.at(-1)!.label).toBe("从 (1, 1, 0.3) 方向看")
    expect(dir.ok).toBe(true)
    const big = await run("look", { size: "large", views: ["iso"] })
    expect(big.ok).toBe(true)
    expect(looks.at(-1)!.size).toBe("large")
    const bad = await run("look", { hide: ["盖子"] })
    expect(bad.ok).toBe(false)
    expect(bad.text).toMatch(/不是零件或参考体的名字/)
    const missing = await run("look", { focus: { part: "盖子" } })
    expect(missing.text).toMatch(/没有叫「盖子」的零件/)
  })

  it("works out millimetres per pixel from the framed box", () => {
    // A 100 mm cube's diagonal sphere fills the 336 px height: about 0.6 mm a pixel.
    const mm = mmPerPixel([[0, 0, 0], [100, 100, 100]], 336)
    expect(mm).toBeGreaterThan(0.5)
    expect(mm).toBeLessThan(0.7)
    expect(autoFocus({ index: 0, mesh: null, groups: [], edges: null, edgeGroups: [], sketch: null, threads: [], bbox: null })).toBeNull()
  })
})

describe("turnery step diagnostics", () => {
  it("says how far added material is from the body when it doesn't join", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    await run("sketch", { id: "s2", on: { plane: "XY", offset: 40 }, shapes: [{ type: "circle", d: 10 }] })
    const res = await run("extrude", { id: "float", sketch: "s2", distance: 5 })
    expect(res.text).toMatch(/新加的料离已有实体 10 mm，没接上/)
  })

  it("tells material touching only along an edge apart from material sharing a face", async () => {
    const { run } = await engineWithScreen()
    await run("sketch", { id: "a", on: { plane: "XY" }, shapes: [{ type: "rect", w: 10, h: 10 }] })
    await run("extrude", { id: "ea", sketch: "a", distance: 10 })
    await run("sketch", { id: "b", on: { plane: "XY" }, shapes: [{ type: "rect", w: 10, h: 10, center: [10, 10] }] })
    const edge = await run("extrude", { id: "eb", sketch: "b", distance: 10 })
    expect(edge.text).toMatch(/只碰到已有实体的边或点/)
    await run("delete_feature", { id: "b", cascade: true })
    await run("sketch", { id: "c", on: { plane: "XY" }, shapes: [{ type: "rect", w: 10, h: 10, center: [10, 0] }] })
    const face = await run("extrude", { id: "ec", sketch: "c", distance: 10 })
    expect(face.ok, face.text).toBe(true)
    expect(face.text).not.toMatch(/没接上|只碰到/)
  })

  it("reports sliver faces", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    await run("sketch", { id: "t", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "rect", w: 0.05, h: 0.05 }] })
    const res = await run("extrude", { id: "tiny", sketch: "t", distance: 0.05 })
    expect(res.text).toMatch(/生成了 \d+ 个极小的面/)
  })

  it("doesn't count where a letter's strokes cross as slivers", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    // The leg of an R runs into its bowl: the fused strokes keep a wall ~0.014 mm wide.
    await run("sketch", { id: "t", on: { plane: "XZ", face: { normal: "-Y", extreme: "-Y" } }, shapes: [{ type: "text", text: "TURNERY", size: 8, center: [0, 15] }] })
    for (const mode of ["cut", "add"] as const) {
      const res = await run("extrude", { id: `e_${mode}`, sketch: "t", mode, distance: 0.6, direction: mode === "cut" ? "reverse" : "normal" })
      expect(res.ok, res.text).toBe(true)
      expect(res.text).not.toMatch(/极小的面/)
      await run("delete_feature", { id: `e_${mode}` })
    }
  })
})

describe("turnery measure between features and parts, with coordinates", () => {
  it("gives a plane's centre, a circle's centre, and the distance between two features", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    const top = await run("measure", { a: { face: { of: "base", normal: "+Z" } } })
    expect(top.text).toMatch(/中心 \(0, 0, 30\)/)
    for (const [id, x] of [["b1", -20], ["b2", 20]] as const) {
      await run("sketch", { id: `${id}s`, on: { plane: "XY", offset: "H" }, shapes: [{ type: "circle", d: 4, center: [x, 0] }] })
      await run("extrude", { id, sketch: `${id}s`, distance: 5 })
    }
    const rim = await run("measure", { a: { edge: { of: "b1", kind: "circle", extreme: "+Z" } } })
    expect(rim.text).toMatch(/圆心 \(-20, 0, 35\)/)
    const between = await run("measure", { a: { feature: "b1" }, b: { feature: "b2" } })
    expect(between.ok, between.text).toBe(true)
    expect(between.text).toMatch(/最短距离：36 mm/)
    expect(between.text).toMatch(/特征 · 「拉伸2」的面/)
  })

  it("measures parts against each other after a split: touching, no overlap", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    await run("split", { id: "sp", by: { plane: "XY", offset: 10 }, parts: ["底", "盖"] })
    const res = await run("measure", { a: { part: "底" }, b: { part: "盖" } })
    expect(res.text).toMatch(/最短距离：0（接触）/)
    expect(res.text).not.toMatch(/重叠体积/)
    const bad = await run("measure", { a: { part: "壳" } })
    expect(bad.text).toMatch(/没有叫「壳」的零件或参考体：现在有 底、盖/)
  })
})

describe("turnery checks: position and gap", () => {
  it("checks where a hole's axis is and how far two features are apart", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    await run("hole", { id: "h", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[12, -5]], d: 4 })
    for (const [id, x] of [["b1", -30], ["b2", -20]] as const) {
      await run("sketch", { id: `${id}s`, on: { plane: "XY", offset: "H" }, shapes: [{ type: "circle", d: 4, center: [x, 15] }] })
      await run("extrude", { id, sketch: `${id}s`, distance: 5 })
    }
    const res = await run("check", {
      items: [
        { id: "hx", said: "孔中心 X = 12", kind: "position", at: { face: { of: "h", kind: "cylinder" } }, axis: "X", expect: 12 },
        { id: "hxyz", said: "孔在 (12, -5)", kind: "position", at: { edge: { of: "h", kind: "circle", extreme: "+Z" } }, expect: [12, -5, 30] },
        { id: "apart", said: "两个柱子隔 6", kind: "gap", a: { feature: "b1" }, b: { feature: "b2" }, min: 5.9, max: 6.1 },
        { id: "touch", said: "柱子贴在顶面上", kind: "gap", a: { feature: "b1" }, b: { face: { of: "base", normal: "+Z" } }, max: 0 },
        { id: "wrong", said: "孔中心 X = 10", kind: "position", at: { face: { of: "h", kind: "cylinder" } }, axis: "X", expect: 10 },
      ],
    })
    expect(res.text).toMatch(/✓[^\n]*孔中心 X = 12/)
    expect(res.text).toMatch(/✓[^\n]*孔在 \(12, -5\)/)
    expect(res.text).toMatch(/✓[^\n]*两个柱子隔 6/)
    expect(res.text).toMatch(/✓[^\n]*柱子贴在顶面上/)
    expect(res.text).toMatch(/✗[^\n]*孔中心 X = 10[^\n]*X = 12/)
  })

  it("checks clearance and interference against a part by name", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    await run("split", { id: "sp", by: { plane: "XY", offset: 10 }, parts: ["底", "盖"] })
    const res = await run("check", {
      items: [
        { id: "i", said: "盖不和底相交", kind: "interference", ref: "盖" },
        { id: "c", said: "盖和底隔 0.5", kind: "clearance", ref: "盖", min: 0.5 },
        { id: "g", said: "盖压在底上", kind: "gap", a: { part: "盖" }, b: { part: "底" }, max: 0 },
      ],
    })
    expect(res.text).toMatch(/✓[^\n]*盖不和底相交/)
    expect(res.text).toMatch(/✗[^\n]*盖和底隔 0\.5[^\n]*贴在一起/)
    expect(res.text).toMatch(/✓[^\n]*盖压在底上/)
  })

  it("keeps the new kinds out of the site assistant's check tool", () => {
    const web = JSON.stringify(z.toJSONSchema(STUDIO_TOOLS.check.inputSchema as z.ZodType, { io: "input", unrepresentable: "any" }))
    const desk = JSON.stringify(z.toJSONSchema(DESKTOP_TOOLS.check.inputSchema as z.ZodType, { io: "input", unrepresentable: "any" }))
    expect(web).not.toMatch(/"position"|"gap"/)
    expect(desk).toMatch(/"position"/)
    expect(desk).toMatch(/"gap"/)
  })
})

describe("turnery: what tripped an agent up while building a box", () => {
  /** The demo box: rounded block, bottom fillet, shelled open at the top, posts in the corners. */
  async function shelledBox(run: (n: string, i: unknown) => Promise<{ ok: boolean; text: string }>, inset: number) {
    await run("set_params", { set: { L: 80, W: 50, H: 30, t: 2, inset, bd: 7 } })
    await run("sketch", { id: "sb", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W", r: 4 }] })
    await run("extrude", { id: "base", sketch: "sb", distance: "H" })
    await run("fillet", { id: "fb", edges: { faces: { normal: "-Z" } }, r: 3 })
    const sh = await run("shell", { id: "sh", open: { normal: "+Z", extreme: "+Z" }, t: "t" })
    expect(sh.text).not.toMatch(/窄缝|薄壁/)
    const corners = [["L/2-inset", "W/2-inset"], ["-(L/2-inset)", "W/2-inset"], ["L/2-inset", "-(W/2-inset)"], ["-(L/2-inset)", "-(W/2-inset)"]]
    await run("sketch", { id: "sp", on: { plane: "XY", offset: "t" }, shapes: corners.map((c) => ({ type: "circle", d: "bd", center: c })) })
    return run("extrude", { id: "boss", sketch: "sp", distance: "H-t" })
  }

  it("warns about a post that stops 0.5 mm short of the wall, and not once it joins it", async () => {
    const { run } = await engineWithScreen()
    const boss = await shelledBox(run, 6)
    expect(boss.ok, boss.text).toBe(true)
    expect(boss.text).toMatch(/只有 0\.5 mm 的窄缝/)
    await run("set_params", { set: { inset: 5 } })
    const st = await run("inspect", { what: "tree" })
    expect(st.text).not.toMatch(/窄缝/)
  })

  it("says why `of` finds nothing when the feature's face merged into an older one", async () => {
    const { run } = await engineWithScreen()
    await shelledBox(run, 5)
    const h = await run("hole", { id: "h1", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z", of: "boss" } }, at: [[35, 20]], standard: { size: "M3", fit: "tap" }, depth: 8 })
    expect(h.ok).toBe(false)
    expect(h.text).toMatch(/满足其余条件的面记在「base」名下，不在「boss」名下.*合成了一个/)
  })

  it("rounds a lid's outer rim with `outer`, leaving the hole rims alone", async () => {
    const { run } = await engineWithScreen()
    await run("sketch", { id: "s", on: { plane: "XY" }, shapes: [{ type: "rect", w: 80, h: 50, r: 4 }] })
    await run("extrude", { id: "plate", sketch: "s", distance: 3 })
    await run("hole", { id: "hs", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[30, 15], [-30, 15], [30, -15], [-30, -15]], d: 3.4 })
    const all = await run("inspect", { what: "edges", edges: { faces: { normal: "+Z", extreme: "+Z" } } })
    expect(all.text.split("\n").filter((l) => l.startsWith("边#")).length).toBe(12)
    const f = await run("fillet", { id: "ft", edges: { faces: { normal: "+Z", extreme: "+Z" }, outer: true }, r: 1 })
    expect(f.ok, f.text).toBe(true)
    expect(f.text).toMatch(/R1 · 8 条边/)
  })

  it("warns about a hole that leaves a wall thinner than a printer can make", async () => {
    const { run } = await engineWithScreen()
    await block(run)
    const h = await run("hole", { id: "h", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[37.5, 0]], d: 4.4, depth: 10 })
    expect(h.ok, h.text).toBe(true)
    expect(h.text).toMatch(/只有 0\.3 mm 的薄壁/)
  })
})

describe("turnery look: a close-up of a flat face", () => {
  it("frames the face with some of what is around it and adds a picture straight at it", async () => {
    const { run, looks } = await engineWithScreen()
    await block(run)
    const res = await run("look", { focus: { faces: { normal: "+X" } } })
    expect(res.ok, res.text).toBe(true)
    const shots = looks.at(-1)!.shots!
    expect(shots.map((s) => s.label)).toEqual(["特写：1 个面 · 等轴测", "特写：1 个面 · 正对着看"])
    expect(shots[1].dir[0]).toBeCloseTo(1, 3)
    // The +X wall is 0 thick along X; framed at least a fifth of its 50 mm side.
    const b = shots[0].box!
    expect(b[1][0] - b[0][0]).toBeCloseTo(10, 1)
  })
})

describe("lettering stays last", () => {
  it("puts a feature added without `after` before the text at the end, and says so", async () => {
    const { applyEdit } = await import("@/studio/apply")
    const tree = {
      params: {},
      features: [
        { id: "s", op: "sketch" as const, on: { plane: "XY" as const }, shapes: [{ type: "rect" as const, w: 40, h: 20 }] },
        { id: "e", op: "extrude" as const, sketch: "s", distance: 10 },
        { id: "ts", op: "sketch" as const, on: { plane: "XY" as const, offset: 10 }, shapes: [{ type: "text" as const, text: "AB", size: 5 }] },
        { id: "tx", op: "extrude" as const, sketch: "ts", distance: 0.5, mode: "cut" as const, direction: "reverse" as const },
      ],
    }
    const f = applyEdit(tree, "fillet", { id: "f", edges: { parallel: "Z" }, r: 2 })
    expect(f.tree.features.map((x) => x.id)).toEqual(["s", "e", "f", "ts", "tx"])
    expect(f.note).toMatch(/已放在文字特征（「拉伸2」）前面/)
    // A new sketch and the extrusion made from it both go before the text.
    const s2 = applyEdit(f.tree, "sketch", { id: "s2", on: { plane: "XY", offset: 10 }, shapes: [{ type: "circle", d: 4, center: [15, 5] }] })
    const e2 = applyEdit(s2.tree, "extrude", { id: "e2", sketch: "s2", distance: 3 })
    expect(e2.tree.features.map((x) => x.id)).toEqual(["s", "e", "f", "s2", "e2", "ts", "tx"])
    // More lettering goes at the end; `after` is obeyed.
    const t2 = applyEdit(e2.tree, "sketch", { id: "t2", on: { plane: "XY" }, shapes: [{ type: "text", text: "C", size: 5 }] })
    expect(t2.tree.features.at(-1)!.id).toBe("t2")
    const late = applyEdit(t2.tree, "chamfer", { id: "c", edges: { parallel: "X" }, d: 0.5, after: "tx" })
    expect(late.tree.features.map((x) => x.id).indexOf("c")).toBe(late.tree.features.findIndex((x) => x.id === "tx") + 1)
  })
})
