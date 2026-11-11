import * as React from "react"
import { cn } from "@/lib/utils"

/** A key as printed beside the thing it does: 「隐藏 [H]」. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("rounded-sm border bg-muted px-1 font-mono text-caption leading-4 font-normal whitespace-nowrap text-muted-foreground", className)} {...props} />
}
