import { cn } from "@/lib/utils"
import { MARK_DEPTH, MARK_FRONT, MARK_VIEWBOX } from "./arbor-mark-paths"

/**
 * Arbor's mark: a lowercase a pulled into depth, the way a sketch becomes a
 * solid. The face follows the text colour; the depth is the accent. The paths
 * come from desktop/resources/logo/make-logo.py.
 */
export function ArborMark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn("size-5", className)} aria-hidden>
      <path d={MARK_DEPTH} className="fill-primary" />
      <path d={MARK_FRONT} fill="currentColor" />
    </svg>
  )
}
