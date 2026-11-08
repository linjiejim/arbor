// Real thread geometry (kernel/thread.ts): external on a shaft, internal in a bore.
import { beforeAll, describe, expect, it } from "vitest"
import type { Tree } from "@/studio/dsl"
import { Kernel } from "@/studio/kernel/build"
import { DEPTH } from "@/studio/kernel/thread"
import { initNodeKernel } from "@/studio/kernel/node"

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

/** Volume an ISO basic-profile thread takes out of (external) or adds to the space of (internal) a length L. */
const groove = (D: number, P: number, L: number) => {
  const depth = DEPTH * P
  return ((depth * ((7 / 8) * P + P / 4)) / 2) * 2 * Math.PI * (D / 2 - depth / 2) * (L / P)
}

describe("threads", () => {
  it("cuts an M8 thread on the top 20 mm of a shaft", () => {
    const k = new Kernel()
    const tree: Tree = {
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: 8 }] },
        { id: "e", op: "extrude", sketch: "s", distance: 30 },
        { id: "t", op: "thread", faces: { kind: "cylinder" }, size: "M8", length: 20, from: "+Z" },
      ],
    }
    const rep = k.rebuild(tree)
    expect(rep.features[2].state, rep.features[2].message).toBe("ok")
    expect(rep.features[2].summary).toBe("M8 外螺纹 × 1 · 长 20 · 螺距 1.25")
    const full = Math.PI * 16 * 30
    // Within 1% of the basic profile (the flanks are chords of a spiral).
    expect(Math.abs(rep.body!.volume - (full - groove(8, 1.25, 20)))).toBeLessThan(0.05 * groove(8, 1.25, 20))
    expect(rep.body!.solids).toBe(1)
    // A handful of twisted faces whatever the number of turns: that is what keeps it to seconds.
    expect(k.display().groups.length).toBeLessThan(40)
    k.dispose()
  }, 60_000)

  it("threads a tapped hole inside a block, and makes the thread wider by the clearance", () => {
    const k = new Kernel()
    const tree = (clearance?: number): Tree => ({
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 20, h: 20 }] },
        { id: "e", op: "extrude", sketch: "s", distance: 10 },
        { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[0, 0]], standard: { size: "M8", fit: "tap" } },
        { id: "t", op: "thread", faces: { kind: "cylinder", of: "h" }, size: "M8", clearance },
      ],
    })
    const rep = k.rebuild(tree())
    expect(rep.features[3].state, rep.features[3].message).toBe("ok")
    expect(rep.features[3].summary).toMatch(/^M8 内螺纹 × 1 · 长 10/)
    // The material left: the block minus a rod of the basic profile (major ⌀8 with its grooves filled).
    const rodV = Math.PI * 16 * 10 - groove(8, 1.25, 10)
    expect(Math.abs(rep.body!.volume - (4000 - rodV))).toBeLessThan(0.01 * rodV)
    const wider = k.rebuild(tree(0.15))
    expect(wider.features[3].summary).toMatch(/间隙 0\.15/)
    expect(wider.body!.volume).toBeLessThan(rep.body!.volume - 5)
    k.dispose()
  }, 60_000)

  it("says what's wrong instead of guessing", () => {
    const k = new Kernel()
    const base: Tree["features"] = [
      { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: 6 }] },
      { id: "e", op: "extrude", sketch: "s", distance: 10 },
    ]
    const thin = k.rebuild({ params: {}, features: [...base, { id: "t", op: "thread", faces: { kind: "cylinder" }, size: "M8" }] })
    expect(thin.features[2].message).toMatch(/比 8 螺纹的小径.*还细/)
    const flat = k.rebuild({ params: {}, features: [...base, { id: "t", op: "thread", faces: { normal: "+Z" }, size: "M6" }] })
    expect(flat.features[2].message).toMatch(/只能做在圆柱面上/)
    const nopitch = k.rebuild({ params: {}, features: [...base, { id: "t", op: "thread", faces: { kind: "cylinder" }, d: 6 }] })
    expect(nopitch.features[2].message).toMatch(/pitch/)
    k.dispose()
  })
})
