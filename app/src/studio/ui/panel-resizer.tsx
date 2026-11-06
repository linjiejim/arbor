import * as React from "react"
import { PANEL_DEFAULT, PANEL_MIN } from "./panel-width"

/** The side panel's left edge: drag to resize, arrow keys for steps, double-click to reset. */
export function PanelResizer({ width, resize }: { width: number; resize: (w: number, save?: boolean) => void }) {
  const drag = React.useRef<{ x: number; w: number } | null>(null)
  const end = () => {
    if (!drag.current) return
    drag.current = null
    document.documentElement.style.removeProperty("cursor")
    resize(width, true)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整面板宽度"
      aria-valuenow={width}
      aria-valuemin={PANEL_MIN}
      tabIndex={0}
      className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none outline-none max-lg:hidden"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, w: width }
        document.documentElement.style.cursor = "col-resize"
      }}
      onPointerMove={(e) => drag.current && resize(drag.current.w + drag.current.x - e.clientX)}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => resize(PANEL_DEFAULT, true)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") resize(width + 24, true)
        else if (e.key === "ArrowRight") resize(width - 24, true)
        else return
        e.preventDefault()
      }}
    >
      <div className="mx-auto h-full w-px transition-colors duration-(--duration-fast) group-hover:bg-primary group-focus-visible:bg-primary group-active:bg-primary" />
    </div>
  )
}
