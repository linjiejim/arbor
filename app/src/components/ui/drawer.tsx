"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { useGuardedOpen } from "@/hooks/use-guarded-open"
import { IconButton } from "@/components/ui/button"
import { DiscardDialog } from "@/components/ui/confirm-dialog"
import { FieldControlProvider } from "@/components/ui/field"

/*
 * Side drawer from the right: view, edit (in place, see DetailList) and
 * create a list object; a filter panel. The page behind keeps its context.
 * One drawer at a time — never stack a second one; navigate inside instead.
 *
 * Widths: sm 400 (filters, small settings), md 560 (details, default),
 * lg min(60vw, 960) (rich details). Full width on phones.
 */
let openCount = 0

export function Drawer({
  dirty,
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & { dirty?: boolean }) {
  const g = useGuardedOpen({ open, defaultOpen, onOpenChange, dirty })

  React.useEffect(() => {
    if (!g.open) return
    openCount++
    // No bundler-specific env check: the kit must typecheck in Vite and Next alike.
    if (openCount > 1) console.warn("[jim-uiux] Two drawers are open. Use one drawer and navigate inside it.")
    return () => {
      openCount--
    }
  }, [g.open])

  return (
    <>
      <DialogPrimitive.Root open={g.open} onOpenChange={g.onOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
      <DiscardDialog open={g.discard.open} onKeep={g.discard.keep} onDiscard={g.discard.discard} />
    </>
  )
}

export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

const widths = {
  sm: "sm:w-[400px]",
  md: "sm:w-[560px]",
  lg: "sm:w-[min(60vw,960px)] sm:min-w-[560px]",
}

export function DrawerContent({
  size = "md",
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { size?: keyof typeof widths }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="scrim" className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        // Details are read first: focus the panel, not the first icon button (which would pop its
        // tooltip). A field marked autoFocus (creating, editing) keeps its focus.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const panel = e.currentTarget as HTMLElement
          if (!panel.contains(document.activeElement)) panel.focus()
        }}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-full flex-col bg-popover shadow-overlay outline-none",
          "data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
          widths[size],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** Title, optional meta line, actions (≤2 icon buttons), then ✕. */
export function DrawerHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex shrink-0 items-start gap-2 border-b px-5 py-3.5", className)}>
      <div className="min-w-0 flex-1 py-0.5">
        <DialogPrimitive.Title className="truncate text-heading font-semibold">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-0.5 truncate text-small text-muted-foreground">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
      </div>
      {actions}
      <DialogPrimitive.Close asChild>
        <IconButton label={s().close} size="icon-sm" tooltip={false} className="text-muted-foreground">
          <X />
        </IconButton>
      </DialogPrimitive.Close>
    </div>
  )
}

export function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable]", className)} {...props} />
}

export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]", className)}
      {...props}
    />
  )
}

export type DetailItem = {
  label: React.ReactNode
  /** Shown when reading. Full contrast, selectable. */
  value: React.ReactNode
  /** Control shown in the same place while editing. Omit for read-only rows (ID, timestamps). */
  edit?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
}

/**
 * Key–value details that edit in place. Reading and editing share one layout:
 * every row is at least one control tall and values start where an input's
 * text starts, so switching modes moves nothing — the values just become
 * editable. Use it in a drawer for view → edit → save; creating uses the same
 * list with `editing` and empty values.
 */
export function DetailList({ items, editing = false, className }: { items: DetailItem[]; editing?: boolean; className?: string }) {
  const base = React.useId()
  return (
    <dl className={cn("grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-6 gap-y-1.5 text-body", className)}>
      {items.map((it, i) => {
        const id = `${base}-${i}`
        const live = editing && it.edit !== undefined
        return (
          <React.Fragment key={i}>
            <dt className="flex min-h-(--control-md) items-center self-start text-muted-foreground">
              {live ? (
                <label htmlFor={id}>
                  {it.label}
                  {it.required && (
                    <span className="ml-0.5 text-destructive" aria-hidden>
                      *
                    </span>
                  )}
                </label>
              ) : (
                it.label
              )}
            </dt>
            <dd className="flex min-h-(--control-md) min-w-0 flex-col justify-center">
              {live ? (
                <FieldControlProvider id={id} invalid={!!it.error} required={it.required} describedBy={it.error ? `${id}-error` : undefined}>
                  {it.edit}
                  {it.error && (
                    <p id={`${id}-error`} aria-live="polite" className="mt-1 text-caption text-destructive">
                      {it.error}
                    </p>
                  )}
                </FieldControlProvider>
              ) : (
                // 11px = an input's 1px border + 10px padding, so text doesn't jump when editing starts
                <div className="break-words py-1 pl-[11px] select-text">{it.value}</div>
              )}
            </dd>
          </React.Fragment>
        )
      })}
    </dl>
  )
}
