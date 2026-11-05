"use client"

import * as React from "react"
import { Menu, PanelLeft } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { IconButton } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"

/*
 * App shell: sidebar 240 (collapsible to 56, remembered, never changed by
 * resizing), main area scrolls on its own. Below md the sidebar becomes a
 * drawer opened from a 48px top bar.
 */
const KEY = "sidebar:collapsed"
const ShellCtx = React.createContext<{ collapsed: boolean; closeMobile: () => void }>({ collapsed: false, closeMobile: () => {} })

export function AppShell({
  sidebar,
  brand,
  footer,
  children,
}: {
  sidebar: React.ReactNode
  brand: React.ReactNode
  /** Account, settings entry. Hidden while collapsed. */
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(() => typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1")
  const [mobileOpen, setMobileOpen] = React.useState(false)
  // The drawer is CSS-hidden at md+, but a still-open modal would keep blocking the page.
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const on = () => mq.matches && setMobileOpen(false)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(KEY, c ? "0" : "1")
      return !c
    })
  }
  return (
    <div className="flex h-dvh overflow-hidden">
      <ShellCtx.Provider value={{ collapsed, closeMobile: () => {} }}>
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r bg-sunken transition-[width] duration-(--duration-base) ease-out max-md:hidden",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
            {!collapsed && <div className="min-w-0 flex-1 truncate">{brand}</div>}
            <IconButton label={collapsed ? s().expandSidebar : s().collapseSidebar} size="icon-sm" onClick={toggle} className="text-muted-foreground">
              <PanelLeft />
            </IconButton>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{sidebar}</nav>
          {footer && !collapsed && <div className="shrink-0 border-t p-2">{footer}</div>}
        </aside>
      </ShellCtx.Provider>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:hidden">
          <IconButton label={s().openMenu} onClick={() => setMobileOpen(true)}>
            <Menu />
          </IconButton>
          <div className="min-w-0 flex-1 truncate">{brand}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay data-slot="scrim" className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out md:hidden" />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-[min(80vw,300px)] flex-col bg-sunken shadow-overlay outline-none md:hidden",
              "data-[state=open]:animate-slide-in-left data-[state=closed]:animate-fade-out",
            )}
          >
            <DialogPrimitive.Title className="sr-only">{s().openMenu}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{s().openMenu}</DialogPrimitive.Description>
            <div className="flex h-12 shrink-0 items-center px-4">{brand}</div>
            <ShellCtx.Provider value={{ collapsed: false, closeMobile: () => setMobileOpen(false) }}>
              <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{sidebar}</nav>
            </ShellCtx.Provider>
            {footer && <div className="shrink-0 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}

export function NavGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  const { collapsed } = React.useContext(ShellCtx)
  return (
    <div className="mt-4 first:mt-1">
      {label && !collapsed && <div className="mb-1 px-2 text-caption font-medium text-faint-foreground">{label}</div>}
      <ul className="flex flex-col gap-px">{children}</ul>
    </div>
  )
}

/** Current item: fill + full-strength text. No bars, no accent colour. Collapsed: icon only, label as a tooltip on the right. */
export function NavItem({
  icon,
  label,
  active,
  href,
  onClick,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  href?: string
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  const { collapsed, closeMobile } = React.useContext(ShellCtx)
  const cls = cn(
    "flex h-(--nav-item-h) w-full items-center gap-2 rounded-md px-2 text-body text-muted-foreground",
    "transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground [&_svg]:size-4",
    active && "bg-pressed font-medium text-foreground hover:bg-pressed",
    collapsed && "justify-center px-0",
  )
  const inner = (
    <>
      {icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && trailing}
    </>
  )
  const handle = () => {
    onClick?.()
    closeMobile()
  }
  const el = href ? (
    <a href={href} aria-current={active ? "page" : undefined} onClick={handle} className={cls} aria-label={collapsed ? label : undefined}>
      {inner}
    </a>
  ) : (
    <button type="button" aria-current={active ? "page" : undefined} onClick={handle} className={cls} aria-label={collapsed ? label : undefined}>
      {inner}
    </button>
  )
  return (
    <li>
      {collapsed ? (
        <Tooltip content={label} side="right" delayDuration={0}>
          {el}
        </Tooltip>
      ) : (
        el
      )}
    </li>
  )
}
