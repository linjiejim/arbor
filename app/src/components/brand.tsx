import { cn } from "@/lib/utils"
import { ArborMark } from "./arbor-mark"

/** The mark and the name, for the site header. */
export function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold text-foreground", className)}>
      <ArborMark className="size-6" />
      {!compact && <span className="text-heading tracking-tight">Arbor</span>}
    </span>
  )
}
