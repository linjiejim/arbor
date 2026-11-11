import * as React from "react"
import { Code, History, MessageSquare, PanelRightClose, PanelRightOpen, SlidersHorizontal, SquareMousePointer } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RIGHT, RAIL } from "../panels"
import { Resizer } from "./resizer"

export type PanelTab = "details" | "notes" | "params" | "activity" | "code"

const TABS: { value: PanelTab; label: string; icon: React.ReactNode }[] = [
  { value: "details", label: "详情", icon: <SquareMousePointer /> },
  { value: "notes", label: "备注", icon: <MessageSquare /> },
  { value: "params", label: "参数", icon: <SlidersHorizontal /> },
  { value: "activity", label: "动态", icon: <History /> },
  { value: "code", label: "代码", icon: <Code /> },
]

/**
 * The right panel: the selected step's or part's details, the notes, parameters, activity and code.
 * Its left edge drags it wider; closed, it is a rail of its tabs' icons (notes and failing checks
 * as badges) and a click on one opens the panel there.
 */
export function RightPanel({
  open,
  width,
  onWidth,
  onOpen,
  tab,
  onTab,
  details,
  openNotes,
  checksFailing,
  slot,
  children,
}: {
  open: boolean
  width: number
  onWidth: (w: number) => void
  onOpen: (open: boolean) => void
  tab: PanelTab
  onTab: (t: PanelTab) => void
  /** A step or part is selected: its details are a tab. */
  details: boolean
  openNotes: number
  checksFailing: number
  /** Where the details go (the timeline renders them there). */
  slot: (el: HTMLDivElement | null) => void
  children: Record<Exclude<PanelTab, "details">, React.ReactNode>
}) {
  const tabs = TABS.filter((t) => t.value !== "details" || details)
  const badge = (t: PanelTab) => (t === "notes" && openNotes ? String(openNotes) : t === "params" && checksFailing ? "!" : null)
  if (!open)
    return (
      <nav aria-label="右栏（已收起）" className="flex shrink-0 flex-col items-center gap-1 border-l py-2" style={{ width: RAIL }}>
        <IconButton label="展开右栏（⌥⌘B）" size="icon-sm" onClick={() => onOpen(true)}>
          <PanelRightOpen />
        </IconButton>
        <div className="my-1 h-px w-5 bg-border" />
        {tabs.map((t) => (
          <IconButton
            key={t.value}
            label={t.label}
            tooltipSide="left"
            size="icon-sm"
            className={cn("relative", tab === t.value && "bg-selected text-primary")}
            onClick={() => {
              onTab(t.value)
              onOpen(true)
            }}
          >
            {t.icon}
            {badge(t.value) && (
              <span className={cn("absolute -top-0.5 -right-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full px-0.5 text-caption leading-none font-semibold tabular", t.value === "params" ? "bg-warning-subtle text-warning" : "bg-primary text-primary-foreground")}>
                {badge(t.value)}
              </span>
            )}
          </IconButton>
        ))}
      </nav>
    )
  return (
    <Tabs value={tab} onValueChange={(v) => onTab(v as PanelTab)} className="relative flex shrink-0 flex-col border-l" style={{ width }}>
      <Resizer edge="left" label="拖动调整右栏宽度" value={width} min={RIGHT.min} max={RIGHT.max} initial={RIGHT.initial} onChange={onWidth} />
      <div className="flex shrink-0 items-center border-b pr-1.5">
        <TabsList className="min-w-0 flex-1 border-b-0 px-3">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {t.value === "notes" && openNotes > 0 ? ` ${openNotes}` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
        <IconButton label="收起右栏（⌥⌘B）" size="icon-sm" onClick={() => onOpen(false)}>
          <PanelRightClose />
        </IconButton>
      </div>
      {details && (
        <TabsContent value="details" className="relative min-h-0 flex-1">
          <div ref={slot} className="absolute inset-0" />
        </TabsContent>
      )}
      <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        {children.notes}
      </TabsContent>
      <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
        {children.params}
      </TabsContent>
      <TabsContent value="activity" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        {children.activity}
      </TabsContent>
      <TabsContent value="code" className="min-h-0 flex-1 overflow-y-auto">
        {children.code}
      </TabsContent>
    </Tabs>
  )
}
