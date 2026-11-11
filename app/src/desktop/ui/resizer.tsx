import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A panel's edge to drag: `edge` is the side of the panel it sits on (the left panel's is "right",
 * the right panel's "left", a lower section's "top"). Arrow keys move it in steps, double-click resets.
 */
export function Resizer({
  edge,
  value,
  min,
  max,
  initial,
  label,
  onChange,
  className,
}: {
  edge: "left" | "right" | "top"
  value: number
  min: number
  /** A function when it depends on the room at the time (the left panel's height). */
  max: number | (() => number)
  initial: number
  label: string
  onChange: (v: number) => void
  className?: string
}) {
  const start = React.useRef<{ at: number; v: number } | null>(null)
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(typeof max === "function" ? max() : max, v)))
  const vertical = edge !== "top"
  // Dragging the handle towards the panel makes it smaller.
  const sign = edge === "right" ? 1 : -1
  const end = () => {
    start.current = null
    document.documentElement.style.removeProperty("cursor")
  }
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={typeof max === "number" ? max : undefined}
      tabIndex={0}
      title="拖动调整，双击复位"
      className={cn(
        "group absolute z-20 touch-none outline-none",
        vertical ? "inset-y-0 w-2 cursor-col-resize" : "inset-x-0 h-2 cursor-row-resize",
        edge === "left" && "-left-1",
        edge === "right" && "-right-1",
        edge === "top" && "-top-1",
        className,
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { at: vertical ? e.clientX : e.clientY, v: value }
        document.documentElement.style.cursor = vertical ? "col-resize" : "row-resize"
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const moved = (vertical ? e.clientX : e.clientY) - start.current.at
        onChange(clamp(start.current.v + sign * moved))
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => onChange(clamp(initial))}
      onKeyDown={(e) => {
        const grow = vertical ? (edge === "right" ? "ArrowRight" : "ArrowLeft") : "ArrowUp"
        const shrink = vertical ? (edge === "right" ? "ArrowLeft" : "ArrowRight") : "ArrowDown"
        if (e.key === grow) onChange(clamp(value + 24))
        else if (e.key === shrink) onChange(clamp(value - 24))
        else return
        e.preventDefault()
      }}
    >
      <div
        className={cn(
          "transition-colors duration-(--duration-fast) group-hover:bg-primary group-focus-visible:bg-primary group-active:bg-primary",
          vertical ? "mx-auto h-full w-px" : "my-auto h-px w-full translate-y-[3px]",
        )}
      />
    </div>
  )
}
