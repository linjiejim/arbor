import type * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Drawing kit for 图文卡 figures. One SVG user unit ≈ one CSS pixel at phone
 * width: keep `w` ≤ 320 and labels at text-small (13) or larger, so text never
 * renders under 12px. Colours come from theme classes only (currentColor,
 * fill-*, stroke-*, text-*).
 */
export function Svg({ w, h, label, className, children }: { w: number; h: number; label: string; className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className={cn("mx-auto block h-auto w-full max-w-[400px] text-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** A label. `tone` picks the text colour; size defaults to text-small. */
export function T({
  x,
  y,
  children,
  anchor = "start",
  tone,
  className,
}: {
  x: number
  y: number
  children: React.ReactNode
  anchor?: "start" | "middle" | "end"
  tone?: "muted" | "primary" | "faint"
  className?: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={cn(
        "fill-current stroke-none text-small",
        tone === "muted" && "text-muted-foreground",
        tone === "primary" && "text-primary",
        tone === "faint" && "text-faint-foreground",
        className,
      )}
    >
      {children}
    </text>
  )
}

/** A line from (x1, y1) to (x2, y2) with an arrowhead at the end (both ends with `both`). */
export function Arrow({ x1, y1, x2, y2, both, className, dashed }: { x1: number; y1: number; x2: number; y2: number; both?: boolean; className?: string; dashed?: boolean }) {
  const head = (ax: number, ay: number, bx: number, by: number) => {
    const a = Math.atan2(by - ay, bx - ax)
    const s = 6
    const p = (da: number) => `${bx - s * Math.cos(a + da)},${by - s * Math.sin(a + da)}`
    return <path d={`M ${p(0.45)} L ${bx},${by} L ${p(-0.45)}`} />
  }
  return (
    <g className={className}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? "4 3" : undefined} />
      {head(x1, y1, x2, y2)}
      {both && head(x2, y2, x1, y1)}
    </g>
  )
}
