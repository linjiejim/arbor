import { beforeAll, describe, expect, it } from "vitest"
import { getOC } from "replicad"
import type { UIMessage } from "ai"
import { applyEdit, executeTool, type KernelPort } from "@/studio/apply"
import { toBuild123d } from "@/studio/codegen"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { evaluate, resolveParams } from "@/studio/expr"
import { Kernel } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { trimMessages } from "@/studio/trim"
import { annotationText } from "@/studio/annotations"
import { STARTERS } from "@/studio/starters"
import { closeOpen, splitBlocks } from "@/studio/md-blocks"

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
