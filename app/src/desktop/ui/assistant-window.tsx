import * as React from "react"
import { Minus, PanelRight, PictureInPicture2 } from "lucide-react"
import { IconButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { clampLayout, MIN_H, MIN_W, type AssistantLayoutState } from "../assistant-layout"
import { AssistantPanel } from "./assistant-panel"

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
const EDGES: { edge: Edge; className: string }[] = [
  { edge: "n", className: "inset-x-2 -top-1 h-2 cursor-ns-resize" },
  { edge: "s", className: "inset-x-2 -bottom-1 h-2 cursor-ns-resize" },
  { edge: "e", className: "inset-y-2 -right-1 w-2 cursor-ew-resize" },
  { edge: "w", className: "inset-y-2 -left-1 w-2 cursor-ew-resize" },
  { edge: "nw", className: "-top-1 -left-1 size-3 cursor-nwse-resize" },
  { edge: "se", className: "-right-1 -bottom-1 size-3 cursor-nwse-resize" },
  { edge: "ne", className: "-top-1 -right-1 size-3 cursor-nesw-resize" },
  { edge: "sw", className: "-bottom-1 -left-1 size-3 cursor-nesw-resize" },
]

/** Follow the pointer from a press until it is let go: `move` gets how far it went. */
function drag(e: React.PointerEvent, move: (dx: number, dy: number) => void) {
  if (e.button !== 0) return
  e.preventDefault()
  const target = e.currentTarget as HTMLElement
  const x0 = e.clientX
  const y0 = e.clientY
  try {
    target.setPointerCapture(e.pointerId)
  } catch {
    /* a pointer the browser no longer tracks: the moves still arrive while it is over the target */
  }
  const onMove = (ev: PointerEvent) => move(ev.clientX - x0, ev.clientY - y0)
  const onUp = () => {
    target.removeEventListener("pointermove", onMove)
    target.removeEventListener("pointerup", onUp)
    target.removeEventListener("pointercancel", onUp)
  }
  target.addEventListener("pointermove", onMove)
  target.addEventListener("pointerup", onUp)
  target.addEventListener("pointercancel", onUp)
}

/** The floating panel. The conversation and the draft live in AssistantProvider, so it can come and go. */
export function AssistantFloat({ state }: { state: AssistantLayoutState }) {
  const { layout, setLayout } = state
  const fit = (l: AssistantLayoutState["layout"]) => clampLayout(l, window.innerWidth, window.innerHeight)

  const moveBy = (e: React.PointerEvent) => {
    // Buttons and the title field in the header are for clicking, not for dragging.
    if ((e.target as HTMLElement).closest("button, input")) return
    const start = layout
    drag(e, (dx, dy) => setLayout(fit({ ...start, x: start.x + dx, y: start.y + dy })))
  }
  const resizeBy = (edge: Edge) => (e: React.PointerEvent) => {
    const s = layout
    drag(e, (dx, dy) => {
      let { x, y, w, h } = s
      if (edge.includes("e")) w = s.w + dx
      if (edge.includes("s")) h = s.h + dy
      if (edge.includes("w")) {
        w = Math.max(MIN_W, s.w - dx)
        x = s.x + s.w - w
      }
      if (edge.includes("n")) {
        h = Math.max(MIN_H, s.h - dy)
        y = s.y + s.h - h
      }
      setLayout(fit({ ...s, x, y, w, h }))
    })
  }

  return (
    <section
      aria-label="对话"
      className="fixed z-40 flex flex-col rounded-lg border bg-background shadow-popover"
      style={{ left: layout.x, top: layout.y, width: layout.w, height: layout.h }}
    >
      {EDGES.map(({ edge, className }) => (
        <div key={edge} aria-hidden className={cn("absolute z-10 touch-none", className)} onPointerDown={resizeBy(edge)} />
      ))}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
        <AssistantPanel head={{ props: { onPointerDown: moveBy, className: "cursor-grab touch-none active:cursor-grabbing" }, actions: <Actions state={state} /> }} />
      </div>
    </section>
  )
}

/** The docked column on the right, sized from its left edge. */
export function AssistantDock({ state }: { state: AssistantLayoutState }) {
  const { layout, setLayout } = state
  const resize = (e: React.PointerEvent) => {
    const start = layout
    drag(e, (dx) => setLayout(clampLayout({ ...start, dockW: start.dockW - dx }, window.innerWidth, window.innerHeight)))
  }
  return (
    <aside aria-label="对话" className="relative flex shrink-0 flex-col border-l" style={{ width: layout.dockW }}>
      <div aria-hidden className="absolute inset-y-0 -left-1 z-10 w-2 cursor-ew-resize touch-none" onPointerDown={resize} />
      <AssistantPanel head={{ actions: <Actions state={state} /> }} />
    </aside>
  )
}

function Actions({ state }: { state: AssistantLayoutState }) {
  const docked = state.layout.mode === "dock"
  return (
    <>
      <IconButton label={docked ? "浮动显示" : "固定在右侧"} size="icon-sm" onClick={() => state.show(docked ? "float" : "dock")}>
        {docked ? <PictureInPicture2 /> : <PanelRight />}
      </IconButton>
      <IconButton label="收起到右上角" size="icon-sm" onClick={state.hide}>
        <Minus />
      </IconButton>
    </>
  )
}
