import * as React from "react"

/**
 * Where the conversation sits: floating over the window (moved by its header, sized from any edge),
 * docked as a column on the right, or put away into the title bar's 对话 button. Remembered per machine.
 */
export type AssistantLayout = {
  mode: "float" | "dock" | "hidden"
  /** The mode the 对话 button brings back. */
  last: "float" | "dock"
  x: number
  y: number
  w: number
  h: number
  dockW: number
}

const STORE = "turnery:assistant-layout"
export const MIN_W = 320
export const MIN_H = 300
/** The title bar: the panel stays below it (it is the window's drag area on macOS). */
const TOP = 48
const MARGIN = 8

export function defaultLayout(vw: number, vh: number): AssistantLayout {
  const w = 400
  const h = Math.min(640, vh - TOP - 2 * MARGIN - 28)
  return { mode: "hidden", last: "float", x: vw - w - 24, y: TOP + 56, w, h, dockW: 380 }
}

/** Kept inside the window: at least the header stays reachable after the window shrinks. */
export function clampLayout(l: AssistantLayout, vw: number, vh: number): AssistantLayout {
  const w = Math.max(MIN_W, Math.min(l.w, vw - 2 * MARGIN))
  const h = Math.max(MIN_H, Math.min(l.h, vh - TOP - 2 * MARGIN))
  const x = Math.max(MARGIN, Math.min(l.x, vw - w - MARGIN))
  const y = Math.max(TOP + MARGIN, Math.min(l.y, vh - h - MARGIN))
  const dockW = Math.max(MIN_W, Math.min(l.dockW, Math.round(vw * 0.5)))
  return { ...l, x, y, w, h, dockW }
}

function readLayout(): AssistantLayout {
  const base = defaultLayout(window.innerWidth, window.innerHeight)
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<AssistantLayout> | null
    const l = { ...base, ...(saved && typeof saved === "object" ? saved : {}) }
    if (!["float", "dock", "hidden"].includes(l.mode)) l.mode = "hidden"
    if (l.last !== "dock") l.last = "float"
    return clampLayout(l, window.innerWidth, window.innerHeight)
  } catch {
    return base
  }
}

export function useAssistantLayout() {
  const [layout, setLayout] = React.useState(readLayout)
  React.useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify(layout))
  }, [layout])
  React.useEffect(() => {
    const fit = () => setLayout((l) => clampLayout(l, window.innerWidth, window.innerHeight))
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])
  const show = (mode?: "float" | "dock") => setLayout((l) => ({ ...l, mode: mode ?? l.last, last: mode ?? l.last }))
  const hide = () => setLayout((l) => ({ ...l, mode: "hidden" }))
  const toggle = () => (layout.mode === "hidden" ? show() : hide())
  return { layout, setLayout, show, hide, toggle }
}

export type AssistantLayoutState = ReturnType<typeof useAssistantLayout>
