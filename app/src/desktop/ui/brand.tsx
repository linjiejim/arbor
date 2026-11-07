import { cn } from "@/lib/utils"

/**
 * Arbor's mark, after the app icon: a turned shaft whose steps stack into a
 * pine tree. An arbor is both a tree and the shaft a cutter turns on; the
 * accent step is the feature being looked at.
 */
export function ArborMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="9.75" y="1.25" width="4.5" height="3.5" rx="1" />
        <rect x="7.75" y="5.25" width="8.5" height="3.5" rx="1" />
        <rect x="3.25" y="13.75" width="17.5" height="3.75" rx="1.25" />
        <rect x="10" y="18" width="4" height="4.5" rx="1" />
      </g>
      <rect x="5.5" y="9.25" width="13" height="4" rx="1.1" className="fill-primary" />
    </svg>
  )
}
