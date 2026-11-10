import { cn } from "@/lib/utils"
import { TurneryMark } from "./turnery-mark"

/** The mark and the name, for the site header. */
export function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold text-foreground", className)}>
      <TurneryMark className="size-6" />
      {!compact && <span className="text-heading tracking-tight">Turnery</span>}
    </span>
  )
}
