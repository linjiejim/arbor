import * as React from "react"

/**
 * The window's two side panels: how wide each is and whether it is open, and how the left one is
 * shared between the files and the open file's structure. Remembered per machine.
 */
export type Panels = {
  left: { open: boolean; w: number }
  /** Closed, the right panel is a rail of its tabs' icons. */
  right: { open: boolean; w: number }
  /** Height of the left panel's 「结构」 section. */
  structureH: number
  /** Sections of the left panel folded to their title. */
  filesFolded: boolean
  structureFolded: boolean
}

export const LEFT = { min: 180, max: 400, initial: 224 }
export const RIGHT = { min: 300, max: 560, initial: 380 }
export const STRUCTURE = { min: 96, initial: 300 }
/** The closed right panel: a column of icons. */
export const RAIL = 40
/** The model keeps at least this much width between the panels. */
export const VIEW_MIN = 360

const STORE = "turnery:panels"

export function defaultPanels(vw: number): Panels {
  return {
    left: { open: vw >= 1024, w: LEFT.initial },
    right: { open: true, w: vw >= 1280 ? RIGHT.initial : 340 },
    structureH: STRUCTURE.initial,
    filesFolded: false,
    structureFolded: false,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Widths as laid out in a window `vw` wide: the right panel gives way first so the model keeps its room. */
export function panelWidths(p: Panels, vw: number) {
  const left = p.left.open ? clamp(p.left.w, LEFT.min, LEFT.max) : 0
  const room = vw - left - VIEW_MIN
  const right = p.right.open ? clamp(Math.min(p.right.w, room), Math.min(RIGHT.min, Math.max(room, 0)), RIGHT.max) : RAIL
  return { left, right }
}

export function readPanels(vw: number): Panels {
  const base = defaultPanels(vw)
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<Panels> | null
    if (!saved || typeof saved !== "object") return base
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d)
    return {
      left: { open: typeof saved.left?.open === "boolean" ? saved.left.open : base.left.open, w: clamp(num(saved.left?.w, base.left.w), LEFT.min, LEFT.max) },
      right: { open: typeof saved.right?.open === "boolean" ? saved.right.open : base.right.open, w: clamp(num(saved.right?.w, base.right.w), RIGHT.min, RIGHT.max) },
      structureH: Math.max(STRUCTURE.min, num(saved.structureH, base.structureH)),
      filesFolded: saved.filesFolded === true,
      structureFolded: saved.structureFolded === true,
    }
  } catch {
    return base
  }
}

export function usePanels() {
  const [panels, setPanels] = React.useState(() => readPanels(window.innerWidth))
  const [vw, setVw] = React.useState(() => window.innerWidth)
  React.useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(panels))
    } catch {
      /* private mode: this window only */
    }
  }, [panels])
  React.useEffect(() => {
    const fit = () => setVw(window.innerWidth)
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])
  const update = React.useCallback((change: (p: Panels) => Panels) => setPanels(change), [])
  const toggleLeft = React.useCallback(() => setPanels((p) => ({ ...p, left: { ...p.left, open: !p.left.open } })), [])
  const toggleRight = React.useCallback((open?: boolean) => setPanels((p) => ({ ...p, right: { ...p.right, open: open ?? !p.right.open } })), [])
  return { panels, widths: panelWidths(panels, vw), update, toggleLeft, toggleRight }
}

export type PanelsState = ReturnType<typeof usePanels>
