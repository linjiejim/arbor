// The desktop window's side panels (docs/specs/2026-11-11-turnery-workbench-layout.md): their widths
// as laid out, and how the docked conversation leaves the model its room beside them; 后退 / 前进.
import { describe, expect, it } from "vitest"
import { clampLayout, defaultLayout, dockRoom } from "@/desktop/assistant-layout"
import { LEFT, RAIL, RIGHT, VIEW_MIN, defaultPanels, panelWidths } from "@/desktop/panels"
import { arrive, renameVisits, type Visits } from "@/desktop/visits"

describe("side panels", () => {
  it("open both on a wide window, the parts list only from 1024 px", () => {
    expect(defaultPanels(1440)).toMatchObject({ left: { open: true, w: LEFT.initial }, right: { open: true, w: RIGHT.initial } })
    expect(defaultPanels(1000).left.open).toBe(false)
    expect(defaultPanels(1200).right.w).toBe(340)
  })

  it("keep their widths within bounds; a closed right panel is a rail", () => {
    const p = defaultPanels(1440)
    expect(panelWidths({ ...p, left: { open: true, w: 9999 } }, 1440).left).toBe(LEFT.max)
    expect(panelWidths({ ...p, left: { open: false, w: 300 } }, 1440).left).toBe(0)
    expect(panelWidths({ ...p, right: { open: false, w: 400 } }, 1440).right).toBe(RAIL)
  })

  it("give way on a narrow window, right first, so the model keeps its room", () => {
    const p = { ...defaultPanels(1440), right: { open: true, w: 500 } }
    const w = panelWidths(p, 1000)
    expect(w.left).toBe(LEFT.initial)
    expect(w.right).toBe(1000 - LEFT.initial - VIEW_MIN)
    expect(1000 - w.left - w.right).toBeGreaterThanOrEqual(VIEW_MIN)
  })
})

describe("the docked conversation beside the panels", () => {
  it("gets what the panels as laid out leave", () => {
    expect(dockRoom(1440)).toBe(1440 - 224 - 380 - 360)
    expect(dockRoom(1440, 0 + RAIL)).toBe(1440 - RAIL - 360)
  })

  it("floats when the panels leave no room to dock", () => {
    const l = { ...defaultLayout(1440, 900), mode: "dock" as const }
    expect(clampLayout(l, 1440, 900, 224 + 380).mode).toBe("dock")
    expect(clampLayout(l, 1440, 900, 400 + 560).mode).toBe("float")
  })
})

describe("back and forward", () => {
  const A = { path: "/w/a.turnery.json" }
  const B = { path: "/w/b.turnery.json" }
  const C = { path: "/w/c.turnery.json" }
  const walk = (...vs: (typeof A)[]) => vs.reduce<Visits>((h, v) => arrive(h, v, null), { list: [], at: -1 })

  it("goes back to where it was going, and keeps what is ahead", () => {
    const h = walk(A, B)
    // Back: the window shows A again (a file loads in between, which doesn't count).
    const back = arrive(h, A, 0)
    expect(back).toEqual({ list: [A, B], at: 0 })
    expect(arrive(back, B, 1)).toEqual({ list: [A, B], at: 1 })
    // Opening another file from there drops what was ahead.
    expect(arrive(back, C, null)).toEqual({ list: [A, C], at: 1 })
  })

  it("follows a renamed file, and a part in a renamed assembly", () => {
    const asm = "/w/box.turnery-asm.json"
    const inBox = { path: A.path, context: asm }
    // B was renamed while open: the window already shows it under the new name.
    const h: Visits = { list: [A, B, inBox, { path: "/w/b2.turnery.json" }], at: 3 }
    expect(renameVisits(h, B.path, "/w/b2.turnery.json")).toEqual({ list: [A, { path: "/w/b2.turnery.json" }, inBox, { path: "/w/b2.turnery.json" }], at: 3 })
    expect(renameVisits({ list: [A, B, { path: "/w/b2.turnery.json" }], at: 2 }, B.path, "/w/b2.turnery.json")).toEqual({ list: [A, { path: "/w/b2.turnery.json" }], at: 1 })
    expect(renameVisits({ list: [inBox, B], at: 0 }, asm, "/w/盒子.turnery-asm.json").list[0]).toEqual({ path: A.path, context: "/w/盒子.turnery-asm.json" })
  })

  it("takes the file shown again under its new name, while it is renamed, for the same visit", () => {
    const B2 = { path: "/w/b2.turnery.json" }
    const renaming = { from: B.path, to: B2.path }
    // B is shown, with C ahead: renaming it keeps C ahead.
    expect(arrive({ list: [A, B, C], at: 1 }, B2, null, renaming)).toEqual({ list: [A, B2, C], at: 1 })
    // Another file opened meanwhile is a visit as usual.
    expect(arrive({ list: [A, B], at: 1 }, C, null, renaming)).toEqual({ list: [A, B, C], at: 2 })
  })
})
