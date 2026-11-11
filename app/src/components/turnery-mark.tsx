import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { MARK_DEPTH, MARK_FRONT, MARK_VIEWBOX, WORD_DEPTH, WORD_FRONT, WORD_VIEWBOX } from "./turnery-mark-paths"

/**
 * Turnery's mark: a lowercase t pulled into depth, the way a sketch becomes a
 * solid. The face follows the text colour; the depth is the accent. The paths
 * come from desktop/resources/logo/make-logo.py.
 */
export function TurneryMark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn("size-5", className)} aria-hidden>
      <path d={MARK_DEPTH} className="fill-primary" />
      <path d={MARK_FRONT} fill="currentColor" />
    </svg>
  )
}

/** The wordmark is this many times as wide as it is tall. */
export const WORDMARK_ASPECT = ((w, h) => w / h)(...(WORD_VIEWBOX.split(" ").slice(2).map(Number) as [number, number]))

/** The name, every letter drawn and pulled like the mark. Size it by its height (`h-4`); the width follows. */
export function TurneryWordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={WORD_VIEWBOX} className={cn("h-4 w-auto", className)} style={style} role="img" aria-label="Turnery">
      <path d={WORD_DEPTH} className="fill-primary" />
      <path d={WORD_FRONT} fill="currentColor" />
    </svg>
  )
}
