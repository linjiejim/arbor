// The faces of an imported STEP (a reference body) can be measured against, checked against and
// built on (docs/specs/2026-11-10-turnery-step-faces.md).
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

/** A 60 × 40 × 10 block standing on XY, as a STEP file: the kernel's own export plays a vendor's board. */
async function boardStep() {
  const k = new DirectKernel()
  await k.rebuild({ params: {}, features: [{ id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }] }, { id: "e", op: "extrude", sketch: "s", distance: 10 }] })
  const bytes = (await k.exportBody("step"))!
  k.dispose()
  return bytes
}

/** A tray (70 × 50, floor 2 thick) with the board imported 3 mm above the floor. */
async function trayWithBoard() {
  const mem = memFiles()
  await mem.files.write("/work/board.step", await boardStep())
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
  const run = async (name: string, input: unknown) => {
    const r = await engine.run(name, input, AGENT)
    if (name !== "check" && name !== "fillet") expect(r.ok, `${name}: ${r.text}`).toBe(true)
    return r
  }
  await run("open_part", { path: "tray", create: true })
  await run("set_params", { set: { lift: 3 } })
  await run("sketch", { id: "s", on: { plane: "XY" }, shapes: [{ type: "rect", w: 70, h: 50 }] })
  await run("extrude", { id: "floor", sketch: "s", distance: 2 })
  await run("import", { id: "board", name: "开发板", file: "board.step", at: [0, 0, "2+lift"] })
  return run
}

const BOARD_BOTTOM = { of: "board", normal: "-Z", extreme: "-Z" }
const BOARD_TOP = { of: "board", normal: "+Z", extreme: "+Z" }
const FLOOR_TOP = { of: "floor", normal: "+Z", extreme: "+Z" }

describe("turnery: faces of an imported STEP", () => {
  it("measures and checks from a face of the board to a face of the part, and follows a parameter", async () => {
    const run = await trayWithBoard()
    const listed = await run("inspect", { what: "faces", faces: BOARD_BOTTOM })
    expect(listed.text).toContain("法向 -Z")
    const m = await run("measure", { a: { face: BOARD_BOTTOM }, b: { face: FLOOR_TOP } })
    expect(m.text).toMatch(/平行面间距[^\n]*3 mm|间距 3 mm|3 mm/)
    let res = await run("check", {
      items: [
        { id: "lift", said: "板子底面离内底 3", kind: "distance", a: { face: BOARD_BOTTOM }, b: { face: FLOOR_TOP }, expect: 3 },
        { id: "gap", said: "板子不碰底", kind: "gap", a: { face: BOARD_BOTTOM }, b: { face: FLOOR_TOP }, min: 2.9 },
        { id: "top", said: "板子顶面在 Z 15", kind: "position", at: { face: BOARD_TOP }, axis: "Z", expect: 15 },
      ],
    })
    expect(res.text).toMatch(/✓ lift/)
    expect(res.text).toMatch(/✓ gap/)
    expect(res.text).toMatch(/✓ top/)
    await run("set_params", { set: { lift: 2 } })
    res = await run("check", {})
    expect(res.text).toMatch(/✗ lift[^\n]*实际 2 mm/)
    expect(res.text).toMatch(/✗ top[^\n]*Z = 14/)
  }, 60_000)

  it("puts a sketch on a face of the board; what is built there moves with the board", async () => {
    const run = await trayWithBoard()
    // A post on the board's top face, 10 mm in from its centre.
    await run("sketch", { id: "sk", on: { plane: "XY", face: BOARD_TOP }, shapes: [{ type: "circle", d: 6, center: [10, 0] }] })
    await run("extrude", { id: "post", sketch: "sk", distance: 4, part: "压块" })
    let res = await run("check", { items: [{ id: "seat", said: "压块落在板子上", kind: "gap", a: { feature: "post" }, b: { face: BOARD_TOP }, max: 0 }, { id: "z", said: "压块顶在 Z 19", kind: "position", at: { face: { of: "post", normal: "+Z" } }, axis: "Z", expect: 19 }] })
    expect(res.text).toMatch(/✓ seat/)
    expect(res.text).toMatch(/✓ z/)
    await run("set_params", { set: { lift: 8 } })
    res = await run("check", {})
    expect(res.text).toMatch(/✓ seat/)
    expect(res.text).toMatch(/✗ z[^\n]*Z = 24/)
  }, 60_000)

  it("does not let a reference face be edited, and leaves selectors without `of` on the part", async () => {
    const run = await trayWithBoard()
    const fillet = await run("fillet", { id: "f", edges: { faces: BOARD_TOP }, r: 1 })
    expect(fillet.text).toMatch(/✗/)
    // The board is higher than the tray: "the top face" still means the tray's.
    const top = await run("measure", { a: { face: { normal: "+Z", extreme: "+Z" } } })
    expect(top.text).toContain("3500")
  }, 60_000)
})
