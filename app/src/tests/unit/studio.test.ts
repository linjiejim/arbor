import { beforeAll, describe, expect, it } from "vitest"
import { getOC } from "replicad"
import type { UIMessage } from "ai"
import { applyEdit, executeTool, moveFeature, promoteToParam, replaceFeature, setFieldAt, type KernelPort } from "@/studio/apply"
import { toBuild123d } from "@/studio/codegen"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { evaluate, resolveParams } from "@/studio/expr"
import { Kernel } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { trimMessages } from "@/studio/trim"
import { annotationText } from "@/studio/annotations"
import { STARTERS } from "@/studio/starters"
import { closeOpen, splitBlocks } from "@/studio/md-blocks"
import { describeUse, drivenFeatures, paramDependents, paramUses } from "@/studio/param-uses"
import { standardHole } from "@/studio/holes"
import { dimSource } from "@/studio/dim-source"
import { selectorWords } from "@/studio/selector-words"
import { glyphArea } from "./glyph-area"

describe("parameter expressions", () => {
  it("evaluates arithmetic, functions in degrees and parameters", () => {
    expect(evaluate("L/2 + 3*t", { L: 80, t: 2 })).toBe(46)
    expect(evaluate("2^3^2", {})).toBe(512)
    expect(evaluate("-sqrt(16) + cos(60)*2", {})).toBeCloseTo(-3)
  })
  it("ignores a stray pair of quotes around an expression", () => {
    expect(evaluate('"d"', { d: 6 })).toBe(6)
    expect(evaluate("'L-2*e'", { L: 100, e: 8 })).toBe(84)
  })

  it("resolves parameters in dependency order and rejects cycles and unknown names", () => {
    expect(resolveParams({ inner: "outer - 2*t", outer: 50, t: 2 })).toEqual({ inner: 46, outer: 50, t: 2 })
    expect(() => resolveParams({ a: "b", b: "a" })).toThrow(/循环/)
    expect(() => resolveParams({ a: "nope + 1" })).toThrow(/nope/)
  })
})

describe("tree edits", () => {
  const sketch = { id: "sk1", on: { plane: "XY" }, shapes: [{ type: "rect", w: 10, h: 10 }] }
  it("adds a feature, refuses duplicate ids, inserts after a given feature", () => {
    let t = applyEdit(EMPTY_TREE, "sketch", sketch).tree
    expect(() => applyEdit(t, "sketch", sketch)).toThrow(/已经有/)
    t = applyEdit(t, "extrude", { id: "b", sketch: "sk1", distance: 5 }).tree
    t = applyEdit(t, "sketch", { ...sketch, id: "sk0", after: "sk1" }).tree
    expect(t.features.map((f) => f.id)).toEqual(["sk1", "sk0", "b"])
  })
  it("will not orphan dependents unless asked to cascade", () => {
    let t = applyEdit(EMPTY_TREE, "sketch", sketch).tree
    t = applyEdit(t, "extrude", { id: "b", sketch: "sk1", distance: 5 }).tree
    t = applyEdit(t, "fillet", { id: "f", edges: { of: "b", parallel: "Z" }, r: 1 }).tree
    expect(() => applyEdit(t, "delete_feature", { id: "sk1" })).toThrow(/b、f/)
    expect(applyEdit(t, "delete_feature", { id: "sk1", cascade: true }).tree.features).toEqual([])
  })
})

describe("kernel", () => {
  let k: Kernel
  const port: KernelPort = { rebuild: async (t) => k.rebuild(t), inspect: async (w, s) => k.inspect(w, undefined, s) }
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)

  const box: Tree = {
    params: { L: 80, W: 50, H: 30, t: 2, r: 6 },
    features: [
      { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
      { id: "base", op: "extrude", sketch: "sk", distance: "H" },
      { id: "round", op: "fillet", edges: { of: "base", parallel: "Z", expect: 4 }, r: "r" },
      { id: "hollow", op: "shell", open: { normal: "+Z", extreme: "+Z" }, t: "t" },
      { id: "holes", op: "hole", on: { plane: "XY" }, reverse: true, at: [["L/4", 0], ["-L/4", 0]], d: 4 },
    ],
  }

  it("builds a filleted, shelled, drilled box with the right size and provenance", () => {
    const rep = k.rebuild(box)
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok", "ok"])
    expect(rep.body?.size).toEqual([80, 50, 30])
    expect(rep.body?.solids).toBe(1)
    expect(k.inspect("faces", undefined, { of: "holes", kind: "cylinder" })).toMatch(/R2[\s\S]*R2/)
  })

  it("re-resolves selectors after a parameter change (no topological naming)", () => {
    const rep = k.rebuild({ ...box, params: { ...box.params, L: 120 } })
    expect(rep.features.every((f) => f.state === "ok")).toBe(true)
    expect(rep.body?.size[0]).toBe(120)
  })

  it("explains failures and skips what depends on them", () => {
    const rep = k.rebuild({ ...box, params: { ...box.params, r: 30 } })
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "error", "skipped", "skipped"])
    expect(rep.features[2].hint).toMatch(/半径/)
  })

  it("lists candidates when a selector picks the wrong number of edges", async () => {
    const bad = { ...box, features: [...box.features.slice(0, 2), { id: "f", op: "fillet" as const, edges: { parallel: "Z" as const, expect: 2 }, r: 1 }] }
    const run = await executeTool(port, bad, "inspect", { what: "tree" })
    expect(run.output.text).toMatch(/选中了 4 个边，预期 2 个/)
  })

  it("sweeps a handle, lofts a transition and drafts walls", () => {
    const rep = k.rebuild({
      params: { R: 30 },
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: "2*R" }] },
        { id: "body", op: "extrude", sketch: "s", distance: 60 },
        { id: "h", op: "sweep", path: { on: { plane: "XZ" }, points: [["R-2", 45], [50, 45], [50, 15], ["R-2", 15]], corner: 8 }, profile: { type: "circle", d: 8 } },
        { id: "a", op: "sketch", on: { plane: "XY", offset: 60 }, shapes: [{ type: "circle", d: 60 }] },
        { id: "b", op: "sketch", on: { plane: "XY", offset: 80 }, shapes: [{ type: "rect", w: 30, h: 30 }] },
        { id: "neck", op: "loft", sketches: ["a", "b"] },
      ],
    })
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"])
    expect(rep.body?.solids).toBe(1)
    expect(rep.body?.size[0]).toBeCloseTo(84, 0)
    const drafted = k.rebuild({
      params: {},
      features: [
        { id: "a", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }] },
        { id: "b", op: "extrude", sketch: "a", distance: 25 },
        { id: "d", op: "draft", faces: { kind: "plane", at: { axis: "Z", value: 12.5 } }, angle: 3, neutral: { plane: "XY" } },
      ],
    })
    expect(drafted.features[2].selected).toBe(4)
    expect(drafted.body!.volume).toBeLessThan(60 * 40 * 25)
  })

  it("treats a cylinder's rim as one circle and never selects its seam", () => {
    const rep = k.rebuild({
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }, { type: "circle", d: 10, cut: true }] },
        { id: "b", op: "extrude", sketch: "s", distance: 10 },
        { id: "f", op: "fillet", edges: { parallel: "Z", expect: 4 }, r: 5 },
        { id: "c", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "circle", d: 20, center: [20, 0] }] },
        { id: "boss", op: "extrude", sketch: "c", distance: 10 },
        { id: "ch", op: "chamfer", edges: { kind: "circle", radius: 10, extreme: "+Z", expect: 1 }, d: 1 },
      ],
    })
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"])
    const mug = k.rebuild({
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: 80 }] },
        { id: "b", op: "extrude", sketch: "s", distance: 100 },
        { id: "f", op: "fillet", edges: { kind: "circle", extreme: "-Z", expect: 1 }, r: 5 },
      ],
    })
    expect(mug.features[2].state).toBe("ok")
  })

  it("takes pattern counts and polygon sides from parameters", () => {
    const tree: Tree = {
      params: { n: 6, k: 2.5 },
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "polygon", sides: "n", d: 100 }] },
        { id: "b", op: "extrude", sketch: "s", distance: 5 },
        { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[30, 0]], d: 6 },
        { id: "p", op: "circular_pattern", features: ["h"], axis: "Z", count: "n" },
      ],
    }
    const rep = k.rebuild(tree)
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok"])
    expect(rep.features[3].summary).toMatch(/×6/)
    const bad = k.rebuild({ ...tree, features: tree.features.map((f) => (f.id === "p" ? { ...f, count: "k" } : f)) as Tree["features"] })
    expect(bad.features[3].message).toMatch(/整数/)
  })

  it("turns any clicked face or edge into a selector that picks exactly it", () => {
    const plate: Tree = {
      params: { L: 100, W: 60 },
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
        { id: "b", op: "extrude", sketch: "s", distance: 5 },
        { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [["L/2-8", "W/2-8"], ["8-L/2", "W/2-8"]], d: 6 },
        { id: "f", op: "fillet", edges: { parallel: "Z", not: { of: "h" } }, r: 4 },
      ],
    }
    const models = [plate, ...STARTERS.map((x) => x.tree)]
    let slowest = 0
    for (const tree of models) {
      k.rebuild(tree)
      const d = k.display()
      const v = d.mesh!.vertices
      const t = d.mesh!.triangles
      let faces = 0
      for (const g of d.groups) {
        const p = [0, 1, 2].map((c) => (v[t[g.start] * 3 + c] + v[t[g.start + 1] * 3 + c] + v[t[g.start + 2] * 3 + c]) / 3) as [number, number, number]
        const info = k.pick({ kind: "face", hash: g.hash, point: p })
        expect(info, `face pick on ${tree.features.at(-1)?.id}`).not.toBeNull()
        expect(info!.selector, `${info!.what} ${info!.where}`).not.toBeNull()
        expect(k.locate("face", info!.selector)).toEqual([g.hash])
        faces++
      }
      let edges = 0
      for (const g of d.edgeGroups) {
        const e = d.edges!
        const p = [0, 1, 2].map((c) => (e[g.start * 3 + c] + e[(g.start + 1) * 3 + c]) / 2) as [number, number, number]
        const t0 = performance.now()
        const info = k.pick({ kind: "edge", hash: g.hash, point: p })
        slowest = Math.max(slowest, performance.now() - t0)
        if (!info) continue // seam lines are not edges
        expect(info.selector, `${info.what} ${info.where}`).not.toBeNull()
        expect(k.locate("edge", info.selector)).toEqual([g.hash])
        edges++
      }
      expect(faces).toBeGreaterThan(3)
      expect(edges).toBeGreaterThan(3)
    }
    console.log(`slowest edge pick: ${Math.round(slowest)} ms`)
  }, 120_000)

  it("tells a fillet's tangent line apart from a real edge", () => {
    k.rebuild(STARTERS.find((x) => x.id === "box-fillet-first")!.tree)
    const d = k.display()
    const e = d.edges!
    const picks = d.edgeGroups
      .map((g) => k.pick({ kind: "edge", hash: g.hash, point: [0, 1, 2].map((c) => (e[g.start * 3 + c] + e[(g.start + 1) * 3 + c]) / 2) as [number, number, number] }))
      .filter((p) => p !== null)
    expect(picks.some((p) => p.smooth)).toBe(true)
    // The rim of the open top is a real corner between the wall top and the walls.
    expect(picks.some((p) => !p.smooth)).toBe(true)
  }, 60_000)

  it("keeps pointing at one face after a parameter change, and tells the model where to sketch", () => {
    const tree: Tree = {
      params: { L: 80, W: 50, H: 30 },
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
        { id: "base", op: "extrude", sketch: "s", distance: "H" },
      ],
    }
    k.rebuild(tree)
    const top = k.display().groups.find((g) => g.origin === "base")!
    const info = k.pick({ kind: "face", hash: k.display().groups[0].hash, point: [10, -5, 30] })!
    expect(info).not.toBeNull()
    void top
    const topInfo = k.display().groups.map((g) => k.pick({ kind: "face", hash: g.hash, point: [10, -5, 30] })!).find((x) => x.what.includes("朝上"))!
    expect(topInfo.selector).toMatchObject({ of: "base", normal: "+Z", expect: 1 })
    expect(topInfo.sketch).toEqual({ plane: "XY", offset: 30, uv: [10, -5] })
    k.rebuild({ ...tree, params: { ...tree.params, H: 45, L: 120 } })
    expect(k.locate("face", topInfo.selector)).toHaveLength(1)
    const text = annotationText([{ n: 1, note: "这里开个孔", kind: "face", ...topInfo, point: topInfo.point }])
    expect(text).toMatch(/\[标注 ①\] 学习者的备注：这里开个孔/)
    expect(text).toMatch(/草图坐标 \(10, -5\)/)
  })

  it("refuses a revolve profile that crosses the axis", () => {
    const rep = k.rebuild({
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XZ" }, shapes: [{ type: "rect", w: 20, h: 10, center: [0, 5] }] },
        { id: "r", op: "revolve", sketch: "s", axis: "Z" },
      ],
    })
    expect(rep.features[1].message).toMatch(/跨过了旋转轴/)
  })

  const plate = (on: Tree["features"][number], cut: Tree["features"][number]): Tree => ({
    params: { L: 90, W: 40, H: 6 },
    features: [
      { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
      { id: "base", op: "extrude", sketch: "sk", distance: "H" },
      on,
      cut,
    ],
  })
  const volume = 90 * 40 * 6

  it("engraves and embosses text, Chinese with overlapping strokes included, as one clean solid", () => {
    const text = { type: "text", text: "特征树 回\nFT-01 ⌀8", size: 8 } as const
    const sketch = { id: "tx", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [text] } as const
    const engraved = k.rebuild(plate(sketch, { id: "eng", op: "extrude", sketch: "tx", distance: 0.6, mode: "cut", direction: "reverse" }))
    expect(engraved.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok"])
    expect(engraved.features[2].summary).toContain("文字「特征树 回 FT-01 ⌀8」")
    expect(engraved.body!.solids).toBe(1)
    expect(engraved.body!.volume).toBeLessThan(volume - 5)
    expect(engraved.body!.volume).toBeGreaterThan(volume - 0.6 * 90 * 40 * 0.5)
    expect(engraved.body!.size[2]).toBeCloseTo(6)

    const embossed = k.rebuild(plate(sketch, { id: "emb", op: "extrude", sketch: "tx", distance: 1 }))
    expect(embossed.body!.solids).toBe(1)
    expect(embossed.body!.size[2]).toBeCloseTo(7)
    // Same outlines, so what one adds the other removes.
    expect(embossed.body!.volume - volume).toBeCloseTo(((volume - engraved.body!.volume) / 0.6) * 1, 0)
  }, 60_000)

  it("fills CJK glyphs by the font's own rule: overlapping strokes fused, counters open", () => {
    // These lost strokes or failed outright with replicad's 2D booleans; 4 & 量 cross themselves.
    for (const text of ["坡鞍俺霸健", "海客编", "回器赢疆", "2024 & 量", "偶么蟹"]) {
      const rep = k.rebuild(
        plate(
          { id: "tx", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "text", text, size: 6 }] },
          { id: "eng", op: "extrude", sketch: "tx", distance: 0.5, mode: "cut", direction: "reverse" },
        ),
      )
      expect(rep.features.map((f) => f.state), text).toEqual(["ok", "ok", "ok", "ok"])
      expect(rep.body!.solids).toBe(1)
      const removed = volume - rep.body!.volume
      expect(Math.abs(removed / (glyphArea(text, 6) * 0.5) - 1), text).toBeLessThan(0.005)
    }
  }, 120_000)

  it("mirrors text on a face seen from behind its datum plane, and says which characters it can't draw", () => {
    const engrave = (normal: "+Y" | "-Y", text: string, flush = false) =>
      plate(
        {
          id: "tx",
          op: "sketch",
          // On the face itself, or on the datum plane moved out to where that face is.
          on: flush ? { plane: "XZ", offset: normal === "+Y" ? 20 : -20 } : { plane: "XZ", face: { normal } },
          shapes: [{ type: "text", text, size: 5, center: [-20, 3] }],
        },
        { id: "eng", op: "extrude", sketch: "tx", distance: 0.5, mode: "cut", direction: normal === "+Y" ? "normal" : "reverse" },
      )
    // Where the floor of the engraved "F" has its area, along X, relative to the middle of its box.
    // An F is heavier on its stem side: the left as you read it.
    const stemSide = (normal: "+Y" | "-Y", flush = false) => {
      const rep = k.rebuild(engrave(normal, "F", flush))
      expect(rep.body!.solids).toBe(1)
      const d = k.display()
      const v = d.mesh!.vertices
      const t = d.mesh!.triangles
      let area = 0
      let ax = 0
      let min = Infinity
      let max = -Infinity
      for (const g of d.groups.filter((g) => g.origin === "eng")) {
        for (let i = g.start; i < g.start + g.count; i += 3) {
          const [a, b, c] = [t[i] * 3, t[i + 1] * 3, t[i + 2] * 3]
          const e1 = [v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]]
          const e2 = [v[c] - v[a], v[c + 1] - v[a + 1], v[c + 2] - v[a + 2]]
          const ny = e1[2] * e2[0] - e1[0] * e2[2]
          // Only the floor, which faces the same way as the face it was cut into.
          if (Math.sign(ny) !== (normal === "+Y" ? 1 : -1)) continue
          const w = Math.abs(ny) / 2
          area += w
          ax += (w * (v[a] + v[b] + v[c])) / 3
          for (const x of [v[a], v[b], v[c]]) {
            min = Math.min(min, x)
            max = Math.max(max, x)
          }
        }
      }
      expect(min).toBeGreaterThan(-24)
      expect(max).toBeLessThan(-16)
      return Math.sign(ax / area - (min + max) / 2)
    }
    // Seen from the front (-Y), +X is to the right: the stem is at smaller X.
    expect(stemSide("-Y")).toBe(-1)
    // Seen from the back (+Y), +X is to the left: mirrored, the stem is at larger X, and the F still reads as F.
    expect(stemSide("+Y")).toBe(1)
    expect(stemSide("-Y", true)).toBe(-1)
    expect(stemSide("+Y", true)).toBe(1)

    // Text on two faces: new glyph walls are checked only against old faces near them, so the heap stays put.
    const heap = () => (getOC() as unknown as { wasmMemory?: { buffer: ArrayBuffer }; HEAP8?: Int8Array }).wasmMemory?.buffer.byteLength ?? 0
    const before = heap()
    const both = k.rebuild({
      ...engrave("+Y", "工程 R&D"),
      features: [
        ...engrave("+Y", "工程 R&D").features,
        { id: "tx2", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "text", text: "TOP ⌀8", size: 7 }] },
        { id: "emb", op: "extrude", sketch: "tx2", distance: 1 },
      ],
    })
    expect(both.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"])
    expect(both.body!.solids).toBe(1)
    expect((heap() - before) / 1048576).toBeLessThan(400)

    const bad = k.rebuild(engrave("-Y", "Привет"))
    expect(bad.features[2].state).toBe("error")
    expect(bad.features[2].message).toMatch(/字体里没有这些字：П/)
  }, 60_000)
})

describe("trimMessages", () => {
  const look = (id: string): UIMessage => ({
    id,
    role: "assistant",
    parts: [{ type: "tool-look", toolCallId: id, state: "output-available", input: {}, output: { ok: true, text: "视图", images: ["data:image/png;base64,AA"] } } as never],
  })
  it("keeps images only for the latest look", () => {
    const out = trimMessages([{ id: "u", role: "user", parts: [{ type: "text", text: "hi" }] }, look("a"), look("b")])
    const imgs = out.map((m) => ((m.parts[0] as { output?: { images?: string[] } }).output?.images ?? null))
    expect(imgs).toEqual([null, null, ["data:image/png;base64,AA"]])
  })
})

describe("streaming Markdown", () => {
  it("splits at blank lines, but not inside a fence or before a list item's continuation", () => {
    expect(splitBlocks("a\n\nb")).toEqual(["a", "b"])
    expect(splitBlocks("```\nx\n\ny\n```\n\nz")).toEqual(["```\nx\n\ny\n```", "z"])
    expect(splitBlocks("1. a\n\n   more\n\nnext")).toEqual(["1. a\n\n   more", "next"])
  })
  it("closes what a half-written block opened", () => {
    expect(closeOpen("this is **bold")).toBe("this is **bold**")
    expect(closeOpen("call `inspect")).toBe("call `inspect`")
    expect(closeOpen("```json\n{")).toBe("```json\n{\n```")
    expect(closeOpen("done **ok**")).toBe("done **ok**")
  })
})

describe("build123d export", () => {
  it("writes parameters in dependency order and one block per feature", () => {
    const code = toBuild123d(
      {
        params: { inner: "L - 2*t", L: 80, t: 2 },
        features: [
          { id: "sk", op: "sketch", on: { plane: "XZ", offset: 5 }, shapes: [{ type: "rect", w: "inner", h: 10 }] },
          { id: "b", op: "extrude", sketch: "sk", distance: 3, direction: "both" },
          { id: "f", op: "fillet", edges: { of: "b", parallel: "Z", extreme: "+X" }, r: 1 },
        ],
      },
      { body: true },
    )
    expect(code.indexOf("L = 80")).toBeLessThan(code.indexOf("inner = (L - 2*t)"))
    expect(code).toContain("Plane.XZ.offset(-5) * (Rectangle(inner, 10))")
    expect(code).toContain("extrude(sk_sk, amount=3 / 2, both=True)")
    expect(code).toContain("fillet(on_feature(part.edges(), tool_b).filter_by(Axis.Z).group_by(Axis.X)[-1], radius=1)")
  })
})

describe("tier-1 tools", () => {
  let k: Kernel
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)
  const flange = STARTERS.find((s) => s.id === "flange")!.tree
  const at = (x: number, y: number, z: number): [number, number, number] => [x, y, z]

  it("says where each parameter is used and what it drives, through patterns too", () => {
    const uses = paramUses(flange, "pcd").map((u) => describeUse(flange, u))
    expect(uses).toEqual(["螺栓孔 · 位置"])
    expect(paramUses(flange, "d0").map((u) => describeUse(flange, u))).toEqual(["盘面草图 · 圆直径"])
    expect(drivenFeatures(flange, paramUses(flange, "pcd")).sort()).toEqual(["h1", "ring"])
    expect(drivenFeatures(flange, paramUses(flange, "D"))).toContain("disc")
    expect(paramDependents({ params: { L: 80, inner: "L - 2*t", t: 2 }, features: [] }, "t")).toEqual(["inner"])
  })

  it("keeps parameter notes with set_params, and drops them with the parameter", () => {
    let t = applyEdit(EMPTY_TREE, "set_params", { set: { L: 80, W: 50 }, notes: { L: "总长，沿 X", nope: "x" } }).tree
    expect(t.paramNotes).toEqual({ L: "总长，沿 X" })
    t = applyEdit(t, "set_params", { remove: ["L"] }).tree
    expect(t.paramNotes).toBeUndefined()
    expect(toBuild123d({ ...flange }, { body: true })).toContain("pcd = 90  # 螺栓孔所在圆的直径（节圆）")
  })

  it("edits a feature as a whole, moves it only where its references allow, and suppresses it", () => {
    const hole = flange.features.find((f) => f.id === "h1")!
    const { depth: _depth, ...rest } = { ...hole, depth: 4 } as typeof hole & { depth?: number }
    void _depth
    const t = replaceFeature({ ...flange, features: flange.features.map((f) => (f.id === "h1" ? { ...hole, depth: 4 } : f)) }, rest)
    expect(t.features.find((f) => f.id === "h1")).not.toHaveProperty("depth")
    expect(() => replaceFeature(flange, { ...hole, d: undefined, at: [] })).toThrow(/有字段不对/)
    expect(() => moveFeature(flange, "disc", -1)).toThrow(/用到了/)
    expect(moveFeature(flange, "ch", -1).features.map((f) => f.id)).toEqual(["sk", "disc", "h1", "ch", "ring"])

    const rep = k.rebuild({ ...flange, features: flange.features.map((f) => (f.id === "h1" ? { ...f, suppressed: true } : f)) })
    // The pattern of the suppressed hole goes with it; the chamfer still builds.
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "suppressed", "suppressed", "ok"])
    expect(rep.features[3].summary).toMatch(/螺栓孔/)
    // No bolt holes: only the 1 mm chamfers (≈ 377 mm³) came off the disc.
    expect(rep.body!.volume).toBeGreaterThan(Math.PI * (3600 - 400) * 10 - 500)
  }, 60_000)

  it("measures faces and edges: sizes, parallel gaps, axis and centre distances", () => {
    k.rebuild(flange)
    const d = k.display()
    const facePicks = d.groups.map((g) => ({ g, p: k.pick({ kind: "face", hash: g.hash, point: at(0, 0, 0) })! }))
    const face = (pred: (what: string) => boolean) => facePicks.filter((x) => pred(x.p.what)).map((x) => ({ kind: "face" as const, hash: x.g.hash, point: at(0, 0, 0) }))
    const [top] = face((w) => w.includes("朝上"))
    const [bottom] = face((w) => w.includes("朝下"))
    const holes = face((w) => w.includes("R4"))
    const gap = k.measure([top, bottom])!
    expect(gap.between).toContainEqual({ name: "平行面间距", value: "10 mm" })
    expect(gap.segment).not.toBeNull()
    const pair = k.measure([holes[0], holes[1]])!
    expect(pair.items[0].facts[0]).toBe("直径 ⌀8（R4）")
    // Neighbouring holes on the ⌀90 circle, 60° apart: 45 mm between axes.
    expect(pair.between.find((b) => b.name === "轴线间距")?.value).toBe("45 mm")
    const rim = d.edgeGroups.map((g) => ({ g, p: k.pick({ kind: "edge", hash: g.hash, point: at(0, 0, 0) })! })).find((x) => x.p?.what.includes("R60"))!
    const one = k.measure([{ kind: "edge", hash: rim.g.hash, point: at(0, 0, 0) }])!
    expect(one.items[0]).toMatchObject({ what: "整圆边", facts: ["直径 ⌀120（R60）", "长 376.99 mm"] })
  }, 60_000)

  it("drills standard holes from the metric table and marks tapped ones with thread rings", () => {
    const top = { plane: "XY", face: { normal: "+Z", extreme: "+Z" } } as const
    const rep = k.rebuild({
      params: {},
      features: [
        { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }] },
        { id: "b", op: "extrude", sketch: "sk", distance: 10 },
        { id: "t", op: "hole", on: top, at: [[-20, 0]], standard: { size: "M4", fit: "tap" }, depth: 8 },
        { id: "p", op: "linear_pattern", features: ["t"], dir: "+Y", count: 2, spacing: 12 },
        { id: "c", op: "hole", on: top, at: [[20, 0]], standard: { size: "M3", head: "cbore" } },
      ],
    })
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok", "ok"])
    expect(rep.features[2].summary).toBe("M4 螺纹孔（底孔 ⌀3.3） × 1 · 深 8")
    expect(rep.features[4].summary).toContain("沉孔 ⌀6.5 深 3.3")
    const rings = k.display().threads
    expect(rings).toHaveLength(4)
    expect(rings.every((r) => r.r === 2)).toBe(true)
    expect(rings.map((r) => r.center[2]).sort((a, b) => a - b)).toEqual([2, 2, 10, 10])
    const bad = k.rebuild({ params: {}, features: [...rep.features.slice(0, 2).map((_, i) => [
      { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }] },
      { id: "b", op: "extrude", sketch: "sk", distance: 10 },
    ][i]), { id: "x", op: "hole", on: top, at: [[0, 0]], standard: { size: "M5", fit: "tap", head: "cbore" } }] } as Tree)
    expect(bad.features[2].message).toMatch(/螺纹孔不带沉头/)
    expect(standardHole({ size: "M6" }).d).toBe(6.6)
    expect(standardHole({ size: "M6", fit: "close" }).d).toBe(6.4)
  }, 60_000)

  it("sketches on an inclined face (centred, x level, y up the slope) and on a tilted datum plane", () => {
    const slope = { kind: "plane", near: [0, 0, 20], expect: 1 } as const
    const wedge: Tree["features"] = [
      { id: "s", op: "sketch", on: { plane: "YZ" }, shapes: [{ type: "polyline", points: [[-20, 0], [20, 0], [20, 30], [-20, 10]] }] },
      { id: "w", op: "extrude", sketch: "s", distance: 40, direction: "both" },
    ]
    const rep = k.rebuild({
      params: {},
      features: [
        ...wedge,
        { id: "s2", op: "sketch", on: { plane: "XY", face: slope }, shapes: [{ type: "circle", d: 6, center: [10, 0] }] },
        { id: "boss", op: "extrude", sketch: "s2", distance: 2 },
      ],
    })
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok", "ok", "ok"])
    expect(rep.features[2].summary).toMatch(/^斜面/)
    expect(rep.body!.solids).toBe(1)
    // The boss sits on the slope's centre line, 10 mm to the +X side, standing out along the face normal.
    const top = k.inspect("faces", undefined, { of: "boss", kind: "plane" })
    const c = [...top.matchAll(/中心\(([^)]+)\)/g)].map((m) => m[1].split(",").map(Number))[0]
    expect(c[0]).toBeCloseTo(10, 1)
    expect(c[2]).toBeGreaterThan(20)

    const tilted = k.rebuild({
      params: {},
      features: [
        { id: "t", op: "sketch", on: { plane: "XY", tilt: { axis: "Y", angle: 30 } }, shapes: [{ type: "rect", w: 20, h: 10 }] },
        { id: "e", op: "extrude", sketch: "t", distance: 5 },
      ],
    })
    expect(tilted.features[0].summary).toContain("绕 Y 转 30°")
    // A 20×10×5 block turned 30° about Y: its X extent is 20·cos30 + 5·sin30.
    expect(tilted.body!.size[0]).toBeCloseTo(20 * Math.cos(Math.PI / 6) + 5 * Math.sin(Math.PI / 6), 1)
    const code = toBuild123d({ params: {}, features: [...wedge, { id: "s2", op: "sketch", on: { plane: "XY", face: slope, tilt: undefined }, shapes: [{ type: "circle", d: 6 }] }] }, { body: true })
    expect(code).toContain("on_face(")
    expect(toBuild123d(tilted.features.length ? { params: {}, features: [{ id: "t", op: "sketch", on: { plane: "XY", tilt: { axis: "Y", angle: 30 } }, shapes: [{ type: "rect", w: 20, h: 10 }] }] } : EMPTY_TREE, { body: true })).toContain(".move(Rot(Y=30))")
  }, 60_000)
})

describe("dimensions on the model", () => {
  let k: Kernel
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)
  const box = STARTERS.find((s) => s.id === "box-fillet-first")!.tree
  const flange = STARTERS.find((s) => s.id === "flange")!.tree
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

  it("tells parameters, factors and plain numbers from derived values", () => {
    const scope = { W: 60, pcd: 90, R: 30, rb: 5, L: 80, r: 4 }
    expect(dimSource("W", scope)).toEqual({ type: "param", name: "W" })
    for (const e of ["pcd/2", "-L/2", "2*r", "L/4"]) expect(dimSource(e, scope).type).toBe("factor")
    expect(dimSource("pcd/2", scope)).toMatchObject({ name: "pcd", k: 0.5 })
    expect(dimSource(12, scope).type).toBe("literal")
    expect(dimSource("12", scope).type).toBe("literal")
    for (const e of ["R-rb", "R-11.2", "R-0.293*rb", "L+36.5"]) expect(dimSource(e, scope).type).toBe("derived")
  })

  it("draws a box's sketch, height, fillet and wall where they are", () => {
    k.rebuild(box)
    const dims = k.dimensions()
    const by = (id: string) => dims.find((d) => d.id === id)!
    const L = by("sk1:shapes.0.w")
    expect(L.text).toBe("L = 60")
    expect(L.geom.type === "line" && dist(L.geom.a, L.geom.b)).toBeCloseTo(60)
    expect(by("sk1:shapes.0.h").geom.type === "line" && dist((by("sk1:shapes.0.h").geom as { a: number[] }).a, (by("sk1:shapes.0.h").geom as { b: number[] }).b)).toBeCloseTo(40)
    const H = by("ext1:distance")
    expect(H.geom.type === "line" && H.geom.b[2] - H.geom.a[2]).toBeCloseTo(30)
    expect(by("fil1:r").text).toMatch(/^\d+×R4（r）$/)
    const t = by("shell1:t")
    expect(t.geom.type === "line" && dist(t.geom.a, t.geom.b)).toBeCloseTo(2.5)
    expect(t.label).toBe("壁厚（抽壳向内）")
  })

  it("draws a bolt circle as one pitch diameter, with the count", () => {
    k.rebuild(flange)
    const dims = k.dimensions()
    const pcd = dims.find((d) => d.id === "ring:pcd")!
    expect(pcd.text).toBe("⌀90（pcd）")
    expect(pcd.geom.type === "circle" && pcd.geom.r).toBeCloseTo(45)
    expect(pcd.source).toEqual({ type: "param", name: "pcd" })
    expect(dims.find((d) => d.id === "ring:count")!.text).toBe("6× 均布（n）")
    expect(dims.find((d) => d.id === "h1:d")!.text).toBe("⌀8（bolt）")
    // The seed hole's position is the pitch circle, not a separate x dimension.
    expect(dims.some((d) => d.id === "h1:at.0.0")).toBe(false)
  })

  it("edits one field in place, or makes it a parameter without changing the model", () => {
    const t = setFieldAt(flange, "ch", ["d"], 2)
    expect((t.features.find((f) => f.id === "ch") as { d: number }).d).toBe(2)
    expect(t.features.filter((f) => f.id !== "ch")).toEqual(flange.features.filter((f) => f.id !== "ch"))
    const before = k.rebuild(flange).body!.volume
    const p = promoteToParam(flange, "ch", ["d"], "c", "外缘倒角", 1)
    expect(p.params.c).toBe(1)
    expect(p.paramNotes?.c).toBe("外缘倒角")
    expect((p.features.find((f) => f.id === "ch") as { d: unknown }).d).toBe("c")
    expect(k.rebuild(p).body!.volume).toBeCloseTo(before)
    expect(() => promoteToParam(flange, "ch", ["d"], "pcd", "", 1)).toThrow(/已经有参数/)
  })
})

describe("feature card", () => {
  let k: Kernel
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)
  const box = STARTERS.find((s) => s.id === "box-fillet-first")!.tree
  const fil = box.features.findIndex((f) => f.id === "fil1")

  it("puts selectors in plain words", () => {
    expect(selectorWords({ not: { extreme: "+Z" } }, "edge", box)).toBe("除了最上面一圈以外的边")
    expect(selectorWords({ parallel: "Z", of: "ext1", expect: 4 }, "edge", box)).toBe("平行于 Z 的边 · 来自 拉伸1 · 4 条")
    expect(selectorWords({ normal: "+Z", extreme: "+Z" }, "face", box)).toBe("最上面那个朝上的平面")
  })

  it("turns clicked edges on the body a fillet starts from into one selector that survives a resize", () => {
    k.rebuild(box)
    const vertical = k.locate("edge", { parallel: "Z" }, fil)!
    expect(vertical).toHaveLength(4)
    const four = k.selectorFor("edge", vertical, fil)!
    expect(four.count).toBe(4)
    expect(four.selector).toMatchObject({ parallel: "Z", expect: 4 })
    // Two of them: narrowed by a side.
    const front = k.locate("edge", { parallel: "Z", extreme: "-Y" }, fil)!
    const two = k.selectorFor("edge", front, fil)!
    expect(two.selector).toMatchObject({ extreme: "-Y", expect: 2 })
    // The same selector on a longer box still picks four vertical edges.
    k.rebuild({ ...box, params: { ...box.params, L: 90 } })
    expect(k.locate("edge", four.selector, fil)).toHaveLength(4)
    // A face in an edge box means its rim.
    k.rebuild(box)
    const top = k.locate("face", { normal: "+Z", extreme: "+Z" }, fil)!
    expect(k.faceEdges(top[0], fil)).toHaveLength(4)
  })
})

describe("requirement checks", () => {
  let k: Kernel
  const port: KernelPort = { rebuild: async (t) => k.rebuild(t), inspect: async (w, s) => k.inspect(w, undefined, s) }
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)
  const box = STARTERS.find((s) => s.id === "box-fillet-first")!.tree
  const flange = STARTERS.find((s) => s.id === "flange")!.tree

  it("measures size, wall, holes, pitch circle, distance, angle and volume", () => {
    const r = k.rebuild({
      ...flange,
      checks: [
        { id: "size", said: "外径 120、厚 10", kind: "size", expect: [120, 120, 10] },
        { id: "holes", said: "6 个 ⌀8 孔", kind: "holes", faces: { kind: "cylinder", radius: 4 }, count: 6, d: 8 },
        { id: "pcd", said: "在 ⌀90 圆周上", kind: "pcd", faces: { kind: "cylinder", radius: 4 }, count: 6, expect: 90 },
        { id: "t", said: "厚 10", kind: "distance", a: { face: { normal: "+Z", extreme: "+Z" } }, b: { face: { normal: "-Z", extreme: "-Z" } }, expect: 10 },
        { id: "ang", said: "外圆柱面和顶面垂直", kind: "angle", a: { normal: "+Z", extreme: "+Z" }, b: { kind: "cylinder", radius: 60 }, expect: 90 },
        { id: "vol", said: "体积不超过 100 cm³", kind: "volume", max: 100_000 },
        { id: "wrong", said: "8 个孔", kind: "holes", faces: { kind: "cylinder", radius: 4 }, count: 8 },
      ],
    })
    const by = Object.fromEntries(r.checks!.map((c) => [c.id, c]))
    for (const id of ["size", "holes", "pcd", "t", "ang", "vol"]) expect(by[id].pass, `${id}: ${by[id].actual}`).toBe(true)
    expect(by.holes.actual).toBe("6 个 ⌀8")
    expect(by.pcd.actual).toBe("6 个在 ⌀90 上")
    expect(by.wrong.pass).toBe(false)
  })

  it("measures a shelled box's wall, and says so when nothing matches", () => {
    const r = k.rebuild({
      ...box,
      checks: [
        { id: "wall", said: "壁厚 2.5", kind: "thickness", faces: { normal: "+X", extreme: "+X" }, expect: 2.5 },
        { id: "none", said: "顶面的孔", kind: "holes", faces: { kind: "cylinder", radius: 99 }, count: 1 },
      ],
    })
    expect(r.checks![0]).toMatchObject({ pass: true, actual: "2.5 mm" })
    expect(r.checks![1].pass).toBe(false)
    expect(r.checks![1].actual).toMatch(/没有|没找到/)
  })

  it("the check tool merges by id, removes, and re-measures after a parameter change", async () => {
    let run = await executeTool(port, box, "check", { items: [{ id: "size", said: "60×40×30", kind: "size", expect: [60, 40, 30] }] })
    expect(run.output.text).toMatch(/^✓ size「60×40×30」/)
    run = await executeTool(port, run.tree, "check", { items: [{ id: "size", said: "60×40×35", kind: "size", expect: [60, 40, 35] }] })
    expect(run.tree.checks).toHaveLength(1)
    expect(run.output.text).toMatch(/^✗ size/)
    const taller = k.rebuild({ ...run.tree, params: { ...run.tree.params, H: 35 } })
    expect(taller.checks![0].pass).toBe(true)
    run = await executeTool(port, run.tree, "check", { remove: ["size"] })
    expect(run.tree.checks).toBeUndefined()
  })
})
