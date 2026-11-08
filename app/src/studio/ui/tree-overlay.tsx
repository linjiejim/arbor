import * as React from "react"
import { createPortal } from "react-dom"
import { CircleAlert, CircleDashed, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { OpIcon } from "@/components/op-icon"
import { displayName, type Feature } from "../dsl"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "../scene"
import { StepPanel } from "./step-panel"
import { iconOf } from "../feature-icon"
import type { Annotations } from "../use-annotations"
import type { Reselect } from "../use-reselect"
import type { Studio } from "../use-studio"
import { Hint } from "@/components/hint"


/**
 * The feature tree as a timeline along the bottom of the 3D view: one step
 * per feature, icon over a short name. Pointing at a step lights up the faces
 * it made and previews its details over the side panel (`detailsIn`), so the
 * model stays in view. Click a step: the model goes back to it and the details
 * stay, live (dimensions, re-pick, delete); click it again, 关闭 or Esc to come
 * back to the latest. `readOnly` (a shared link): look only.
 */
export function TreeOverlay({
  studio,
  onHover,
  reselect,
  annotations,
  busy = false,
  parts = NO_PARTS_VIEW,
  onParts,
  readOnly = false,
  rowActions,
  pointedFeature,
  selectedFeature,
  onSelectFeature,
  partsList = true,
  footer,
  detailsIn,
}: {
  studio: Studio
  onHover: (h: Hover | null) => void
  reselect?: Reselect
  annotations?: Annotations
  busy?: boolean
  parts?: PartsView
  onParts?: (v: PartsView) => void
  /** A shared link: a click rolls back to that step; nothing to change. */
  readOnly?: boolean
  /** Buttons under a step (the desktop's assembly: show or hide a part, edit it in place). */
  pointedFeature?: string | null
  selectedFeature?: string | null
  onSelectFeature?: (id: string | null) => void
  rowActions?: (f: Feature) => React.ReactNode
  /** The list of parts with their eyes over the timeline (off when the steps carry them). */
  partsList?: boolean
  /** At the end of the timeline (the desktop's 「+ 零件」). */
  footer?: React.ReactNode
  /** Where a step's details go: an empty layer over the host's side panel. */
  detailsIn: HTMLElement | null
}) {
  const { tree, report, rollback } = studio
  const list = React.useRef<HTMLOListElement>(null)
  const [peek, setPeek] = React.useState<string | null>(null)
  /** The step clicked: the model shows it and the panel stays on it. */
  const [pinned, setPinned] = React.useState<string | null>(null)
  const rollbackIndex = rollback ? tree.features.findIndex((x) => x.id === rollback) : -1
  const last = tree.features.at(-1)?.id ?? null

  // The view went elsewhere (「回到最新」, a link in the chat, the step deleted): let go of the pinned step.
  if (pinned && rollback !== pinned && !(rollback === null && pinned === last)) setPinned(null)

  // A new step (the helper building) scrolls the timeline to the end; a rollback brings its step into view.
  const count = tree.features.length
  const seen = React.useRef(count)
  React.useEffect(() => {
    const el = list.current
    if (el && count > seen.current) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
    seen.current = count
  }, [count])
  React.useEffect(() => {
    if (rollback) list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(rollback)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [rollback])

  const show = (f: Feature) => {
    setPeek(f.id)
    onHover({ ids: f.op === "sketch" ? [] : [f.id], label: "该特征生成的面", feature: f.id })
  }
  const hide = () => {
    setPeek(null)
    onHover(null)
  }
  const unpin = React.useCallback(() => {
    if (reselect?.state) reselect.cancel()
    setPinned(null)
    studio.showFeature(null)
  }, [reselect, studio])
  const pin = (f: Feature) => {
    if (pinned === f.id) return unpin()
    if (reselect?.state) reselect.cancel()
    setPinned(f.id)
    // The last step is the latest model: no rollback, so measuring and notes keep working.
    studio.showFeature(f.id === last ? null : f.id)
  }

  // Esc lets go of the pinned step (not while typing, re-picking or in a dialog).
  React.useEffect(() => {
    if (!pinned && !selectedFeature) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || reselect?.state || (e.target as HTMLElement)?.closest?.("input, textarea, select, [role=menu], [role=alertdialog]")) return
      unpin()
      onSelectFeature?.(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pinned, selectedFeature, onSelectFeature, reselect?.state, unpin])

  if (!tree.features.length)
    return footer ? <nav aria-label="特征树" className="pointer-events-auto absolute bottom-3 left-3 z-10">{footer}</nav> : null
  const panelId = pinned ?? peek ?? pointedFeature ?? selectedFeature
  const panelIndex = panelId ? tree.features.findIndex((f) => f.id === panelId) : -1
  // ← → move along the steps.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    const steps = [...(list.current?.querySelectorAll<HTMLElement>("[data-step]") ?? [])]
    const at = steps.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    e.preventDefault()
    steps[Math.max(0, Math.min(steps.length - 1, at + (e.key === "ArrowRight" ? 1 : -1)))]?.focus()
  }
  const splitParts = partsList && studio.display?.parts && studio.display.parts.length > 1 ? studio.display.parts : null

  return (
    <nav aria-label="特征树" className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 flex flex-col items-start gap-1.5">
      {detailsIn &&
        panelIndex >= 0 &&
        createPortal(
          <StepPanel
            key={pinned ? `pin-${pinned}` : "peek"}
            studio={studio}
            feature={tree.features[panelIndex]}
            result={report?.features[panelIndex]}
            pinned={pinned !== null || panelId === selectedFeature}
            readOnly={readOnly}
            reselect={reselect}
            annotations={annotations}
            busy={busy}
            onClose={() => { unpin(); onSelectFeature?.(null) }}
            onPointDim={(id) => onHover(id ? { ids: [], label: "", dim: id } : null)}
          />,
          detailsIn,
        )}
      {splitParts && (
        <ul aria-label="零件" className="pointer-events-auto flex flex-wrap gap-1">
          {splitParts.map((p, k) => {
            const hidden = parts.hidden.has(k)
            const faces = studio.display!.groups.filter((g) => g.part === k).map((g) => g.hash)
            return (
              <li
                key={p.name}
                className="flex items-center gap-1.5 rounded-md border bg-background/90 py-0.5 pr-0.5 pl-2 text-small text-muted-foreground"
                onMouseEnter={() => onHover({ ids: [], label: `零件「${p.name}」`, faces })}
                onMouseLeave={() => onHover(null)}
              >
                <span aria-hidden className={cn("size-3 shrink-0 rounded-xs border", k % 2 ? "bg-scene-model-dark" : "bg-scene-model")} />
                <span className={cn("max-w-32 truncate", hidden && "line-through opacity-60")}>{p.name}</span>
                <IconButton
                  label={hidden ? `显示「${p.name}」` : `隐藏「${p.name}」`}
                  size="icon-sm"
                  className="size-6"
                  onClick={() => {
                    const next = new Set(parts.hidden)
                    if (hidden) next.delete(k)
                    else next.add(k)
                    onParts?.({ ...parts, hidden: next })
                  }}
                >
                  {hidden ? <EyeOff /> : <Eye />}
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <div className="pointer-events-auto flex max-w-full items-stretch rounded-lg border bg-background/90 shadow-sm" onMouseLeave={hide}>
        <div className="flex shrink-0 flex-col items-start justify-center gap-1 border-r px-2.5 py-1.5 text-caption text-faint-foreground">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>{tree.features.length} 个特征</span>
            <Hint
              step={2}
              label="特征树怎么用"
              side="top"
              tips={[
                "点一步：模型回到这一步，右侧显示它的详情，可以直接改尺寸、在模型上重选面或边。",
                "指向一步只看一眼；蓝色是这一步新生成的面，橙色是被它修改的面。",
                "再点一次、点「关闭」或按 Esc，回到最新一步；← → 在各步之间移动。",
              ]}
            />
          </div>
          {rollback && (
            <Button size="sm" variant="secondary" className="h-6 px-2 text-caption" onClick={() => studio.showFeature(null)}>
              回到最新
            </Button>
          )}
        </div>
        <ol
          ref={list}
          className="flex min-w-0 items-start gap-0.5 overflow-x-auto overflow-y-hidden overscroll-contain p-1 [scrollbar-width:thin]"
          onKeyDown={onKeyDown}
          // A plain wheel scrolls the timeline sideways.
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
          }}
        >
          {tree.features.map((f, i) => {
            const r = report?.features[i]
            const active = rollback === f.id
            const after = rollbackIndex >= 0 && i > rollbackIndex
            return (
              <li key={f.id} className="group/row relative flex shrink-0 flex-col items-center">
                <button
                  type="button"
                  data-step={f.id}
                  onClick={() => pin(f)}
                  aria-expanded={pinned === f.id}
                  onMouseEnter={() => show(f)}
                  onFocus={() => show(f)}
                  aria-describedby={peek === f.id && !pinned ? "feature-peek" : undefined}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative flex w-16 flex-col items-center gap-1 rounded-md border border-transparent px-1 pt-1.5 pb-1 text-muted-foreground",
                    "transition-[background-color,color,border-color] duration-(--duration-fast) ease-out",
                    "hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground",
                    peek === f.id && "bg-muted text-foreground",
                    (active || pinned === f.id) && "border-border bg-selected text-foreground",
                    (after || f.suppressed) && "opacity-50",
                  )}
                >
                  <span className="relative">
                    <OpIcon op={iconOf(f)} className="size-5" />
                    {r?.state === "error" ? (
                      <CircleAlert className="absolute -top-1 -right-2 size-3 rounded-full bg-background text-destructive" aria-label="失败" />
                    ) : r?.state === "skipped" ? (
                      <CircleDashed className="absolute -top-1 -right-2 size-3 rounded-full bg-background text-faint-foreground" aria-label="未重建" />
                    ) : null}
                  </span>
                  <span className={cn("w-full truncate text-center text-caption leading-tight", rowActions && "group-hover/row:invisible group-focus-within/row:invisible", f.suppressed && "line-through")}>{displayName(tree, f)}</span>
                  {f.part && <span className="max-w-full truncate rounded-xs bg-muted px-1 text-caption leading-tight text-faint-foreground">{f.part}</span>}
                  {f.suppressed && <span className="sr-only">（已压缩）</span>}
                </button>
                {rowActions && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-center justify-center opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">{rowActions(f)}</div>}
              </li>
            )
          })}
        </ol>
        {footer && <div className="flex shrink-0 items-center border-l px-1">{footer}</div>}
      </div>
    </nav>
  )
}
