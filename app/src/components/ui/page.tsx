import * as React from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { Tooltip } from "@/components/ui/tooltip"

/*
 * Page widths are fixed, never invented per page:
 *   narrow 720   forms, settings, reading
 *   wide   1200  lists, dashboards
 *   full         tables that need every pixel, canvases
 * Content is left-aligned in the main area. "fill" makes the page exactly
 * the viewport tall so a table scrolls inside and the page doesn't.
 */
const widths = { narrow: "max-w-[720px]", wide: "max-w-[1200px]", full: "max-w-none" }

export function Page({
  width = "wide",
  fill,
  className,
  ...props
}: React.ComponentProps<"main"> & { width?: keyof typeof widths; fill?: boolean }) {
  return (
    <main
      className={cn(
        "w-full px-6 pb-10 pt-6 max-sm:px-4 max-sm:pt-4",
        widths[width],
        fill && "flex h-full min-h-0 flex-col pb-0",
        className,
      )}
      {...props}
    />
  )
}

/**
 * Title + the page's primary action. No subtitle sentence: if the page needs
 * explaining, put it behind ⓘ (`info`).
 */
export function PageHeader({
  title,
  info,
  actions,
  back,
  className,
}: {
  title: React.ReactNode
  info?: React.ReactNode
  actions?: React.ReactNode
  back?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("mb-5 flex min-h-(--control-lg) shrink-0 flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {back}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <h1 className="truncate text-title-lg font-semibold">{title}</h1>
        {info && (
          <Tooltip content={info}>
            <button type="button" aria-label={s().moreInfo} className="text-faint-foreground hover:text-foreground [&_svg]:size-4">
              <Info />
            </button>
          </Tooltip>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Section inside a page: heading + content. 32px between sections. */
export function Section({
  title,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("mt-8 first:mt-0", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center gap-2">
          {title && <h2 className="flex-1 text-heading font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
