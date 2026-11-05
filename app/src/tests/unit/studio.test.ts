import { beforeAll, describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { applyEdit, executeTool, type KernelPort } from "@/studio/apply"
import { toBuild123d } from "@/studio/codegen"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { evaluate, resolveParams } from "@/studio/expr"
import { Kernel } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { trimMessages } from "@/studio/trim"

describe("parameter expressions", () => {
  it("evaluates arithmetic, functions in degrees and parameters", () => {
    expect(evaluate("L/2 + 3*t", { L: 80, t: 2 })).toBe(46)
    expect(evaluate("2^3^2", {})).toBe(512)
    expect(evaluate("-sqrt(16) + cos(60)*2", {})).toBeCloseTo(-3)
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
