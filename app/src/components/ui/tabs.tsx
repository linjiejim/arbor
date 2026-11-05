import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Tabs switch between sections of one page (概览 / 成员 / 设置).
 * To switch between 2–4 views of the same content, use Segmented.
 */
export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-5 overflow-x-auto border-b", className)} {...props} />
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-(--control-lg) shrink-0 items-center gap-1.5 whitespace-nowrap text-body font-medium text-muted-foreground",
        "transition-colors duration-(--duration-fast) hover:text-foreground data-[state=active]:text-foreground",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0",
        "after:transition-opacity after:duration-(--duration-fast) data-[state=active]:after:opacity-100",
        "[&_svg]:size-4",
        className,
      )}
      {...props}
    />
  )
}
