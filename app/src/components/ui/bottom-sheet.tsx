"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { Drawer as Vaul } from "vaul"
import { cn } from "@/lib/utils"
import { useGuardedOpen } from "@/hooks/use-guarded-open"
import { DiscardDialog } from "@/components/ui/confirm-dialog"

/*
 * Bottom sheet for touch layouts (mobile web, PWA). Native apps use the
 * platform sheet instead (expo-router formSheet).
 *
 * Height follows content up to 92dvh, or pass snapPoints={[0.6, 1]} for
 * lists. Drag down or tap the scrim to close; with unsaved input dragging is
 * disabled and closing asks first. At most two sheets stacked.
 */
// With unsaved input Vaul is made non-dismissible (no drag-to-close), and it then
// ignores every close request. Route Esc, scrim and Close buttons through the guard ourselves.
const SheetCtx = React.createContext<{ dirty: boolean; requestClose: () => void }>({ dirty: false, requestClose: () => {} })

export function BottomSheet({
  dirty,
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Vaul.Root>, "open" | "defaultOpen" | "onOpenChange"> & {
  dirty?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const g = useGuardedOpen({ open, defaultOpen, onOpenChange, dirty })
  return (
    <>
      {/* @ts-expect-error vaul's union props don't narrow through spread */}
      <Vaul.Root open={g.open} onOpenChange={g.onOpenChange} dismissible={!dirty} {...props}>
        <SheetCtx.Provider value={{ dirty: !!dirty, requestClose: () => g.onOpenChange(false) }}>{children}</SheetCtx.Provider>
      </Vaul.Root>
      <DiscardDialog open={g.discard.open} onKeep={g.discard.keep} onDiscard={g.discard.discard} />
    </>
  )
}

export const BottomSheetTrigger = Vaul.Trigger
export function BottomSheetClose({ onClick, ...props }: React.ComponentProps<typeof Vaul.Close>) {
  const ctx = React.useContext(SheetCtx)
  if (!ctx.dirty) return <Vaul.Close onClick={onClick} {...props} />
  const Comp = props.asChild ? Slot.Root : "button"
  const { asChild: _asChild, ...rest } = props
  return (
    <Comp
      type="button"
      {...rest}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)
        if (!e.defaultPrevented) ctx.requestClose()
      }}
    />
  )
}

export function BottomSheetContent({ className, children, onEscapeKeyDown, onPointerDownOutside, ...props }: React.ComponentProps<typeof Vaul.Content>) {
  const ctx = React.useContext(SheetCtx)
  return (
    <Vaul.Portal>
      <Vaul.Overlay data-slot="scrim" className="fixed inset-0 z-50 bg-scrim" />
      <Vaul.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[640px] flex-col rounded-t-2xl bg-popover shadow-overlay outline-none",
          className,
        )}
        onEscapeKeyDown={(e) => {
          onEscapeKeyDown?.(e)
          if (ctx.dirty) ctx.requestClose()
        }}
        onPointerDownOutside={(e) => {
          onPointerDownOutside?.(e)
          if (ctx.dirty) ctx.requestClose()
        }}
        {...props}
      >
        <div aria-hidden className="mx-auto mb-1 mt-2 h-[5px] w-9 shrink-0 rounded-full bg-input" />
        {children}
      </Vaul.Content>
    </Vaul.Portal>
  )
}

export function BottomSheetHeader({ title, description, className }: { title: React.ReactNode; description?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0 px-5 pb-2 pt-2", className)}>
      <Vaul.Title className="text-heading font-semibold">{title}</Vaul.Title>
      {description ? (
        <Vaul.Description className="mt-0.5 text-body text-muted-foreground">{description}</Vaul.Description>
      ) : (
        <Vaul.Description className="sr-only">{title}</Vaul.Description>
      )}
    </div>
  )
}

export function BottomSheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-2", className)} {...props} />
}

export function BottomSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 gap-2 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [&>button]:flex-1", className)}
      {...props}
    />
  )
}
