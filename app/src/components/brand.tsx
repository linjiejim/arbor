import { cn } from "@/lib/utils"

/**
 * FeatureTree mark: three feature rows hanging off a tree trunk, with the
 * rollback bar (accent) under the current one.
 */
export function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold text-foreground", className)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M5 3.5v15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <rect x="8.5" y="2.5" width="12" height="4.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <rect x="8.5" y="9.5" width="9" height="4.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M5 4.75h3.5M5 11.75h3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M3 17.5h18" fill="none" className="stroke-primary" strokeWidth="2.25" strokeLinecap="round" />
        <rect x="8.5" y="19.5" width="6" height="2.5" rx="1" className="fill-faint-foreground" opacity="0.5" />
      </svg>
      {!compact && <span className="text-heading tracking-tight">FeatureTree</span>}
    </span>
  )
}
