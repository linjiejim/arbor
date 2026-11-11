import * as React from "react"
import { createPortal } from "react-dom"
import { CircleAlert, CircleDashed, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { OpIcon } from "@/components/op-icon"
import { displayName, OP_NAMES, type Feature } from "../dsl"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "../scene"
import { StepPanel } from "./step-panel"
import { iconOf } from "../feature-icon"
import type { Annotations } from "../use-annotations"
import type { Reselect } from "../use-reselect"
import type { Studio } from "../use-studio"
import { Hint } from "@/components/hint"
import { setPartLook, type LookChange } from "../appearance"
import { LookDot, LookPicker } from "./look-picker"


/**
 * The feature tree as a timeline along the bottom of the 3D view: one step
 * per feature. At rest it is a low, faint strip of icons; pointed at (or with a
 * step open) it lights up and shows the names. Pointing at a step lights up the
 * faces it made and shows a small card above it. Click a step: the model goes
 * back to it and its details open in the side panel (`detailsIn`), live
 * (dimensions, re-pick, delete); click it again, 关闭 or Esc to come back to the
 * latest. `readOnly` (a shared link): look only. `timeline` off (an assembly,
 * whose parts are listed elsewhere): only the details of the selected step.
 *
 * Its height is published on the parent as `--timeline-h`, so what sits above
 * it (the selected parts' toolbar) keeps clear of it.
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
  selectedFeature,
  locateStep,
  onSelectFeature,
  partsList = true,
  looks = true,
  footer,
  detailsIn,
  timeline = true,
  onDetails,
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
  selectedFeature?: string | null
  locateStep?: { id: string; request: number } | null
  onSelectFeature?: (id: string | null) => void
  rowActions?: (f: Feature) => React.ReactNode
  /** The list of parts with their eyes over the timeline (off when the steps carry them). */
  partsList?: boolean
  /** Colour pickers for the part and its parts (off in an assembly: its sidebar has them). */
  looks?: boolean
  /** At the end of the timeline (the desktop's 「+ 零件」). */
  footer?: React.ReactNode
  /** Where a step's details go: an empty layer over the host's side panel. */
  detailsIn: HTMLElement | null
  /** Off: no strip of steps, only the selected step's details (an assembly). */
  timeline?: boolean
  /** Which step's details are open (pinned or selected), so the host can show its panel. */
  onDetails?: (id: string | null) => void
}) {
  const { tree, report, rollback } = studio
  const list = React.useRef<HTMLOListElement>(null)
  const nav = React.useRef<HTMLElement>(null)
  /** The step pointed at, and where its card goes (the middle of the step, from the strip's left edge). */
  const [peek, setPeek] = React.useState<{ id: string; x: number } | null>(null)
  /** The step clicked: the model shows it and the panel stays on it. */
  const [pinned, setPinned] = React.useState<string | null>(null)
  /** A step double-clicked: its details open with the name being edited (cleared once it is). */
  const [renaming, setRenaming] = React.useState<string | null>(null)
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

  React.useEffect(() => {
    if (!selectedFeature) return
    list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(selectedFeature)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [selectedFeature])
  React.useEffect(() => {
    if (!locateStep) return
    const step = list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(locateStep.id)}"]`)
    step?.scrollIntoView({ block: "nearest", inline: "center" })
    step?.focus({ preventScroll: true })
  }, [locateStep])

  const show = (f: Feature, el: HTMLElement) => {
    const bar = el.closest("[data-timeline-bar]")?.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    setPeek({ id: f.id, x: bar ? box.left + box.width / 2 - bar.left : 0 })
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

  const panelId = pinned ?? selectedFeature ?? null
  const panelIndex = panelId ? tree.features.findIndex((f) => f.id === panelId) : -1
  const detailsId = panelIndex >= 0 ? panelId : null
  React.useEffect(() => onDetails?.(detailsId), [onDetails, detailsId])

  // What sits above the strip keeps clear of it: its resting height, on the parent.
  React.useLayoutEffect(() => {
    const el = nav.current
    const host = el?.parentElement
    if (!el || !host) return
    const put = () => host.style.setProperty("--timeline-h", `${el.offsetHeight}px`)
    put()
    const ro = new ResizeObserver(put)
    ro.observe(el)
    return () => {
      ro.disconnect()
      host.style.removeProperty("--timeline-h")
    }
  }, [timeline, tree.features.length])

  const details =
    detailsIn &&
    panelIndex >= 0 &&
    createPortal(
      <StepPanel
        key={pinned ? `pin-${pinned}` : `sel-${panelId}`}
        studio={studio}
        feature={tree.features[panelIndex]}
        result={report?.features[panelIndex]}
        pinned
        readOnly={readOnly}
        reselect={reselect}
        annotations={annotations}
        busy={busy}
        rename={renaming === panelId}
        onRenameStart={() => setRenaming(null)}
        onClose={() => { unpin(); onSelectFeature?.(null) }}
        onPointDim={(id) => onHover(id ? { ids: [], label: "", dim: id } : null)}
      />,
      detailsIn,
    )
  if (!timeline || !tree.features.length) return details || null
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
  // Colours are a tree edit like any other: undoable, and only restyled (nothing rebuilds).
  const setLook = (parts: string[] | undefined, change: LookChange) => void studio.editTree((t) => setPartLook(t, parts, change))
  const canColor = looks && !readOnly
  // Lit up and named while something on it is open; otherwise only while pointed at or focused.
  const open = Boolean(rollback || pinned || selectedFeature)
  const peekIndex = peek ? tree.features.findIndex((f) => f.id === peek.id) : -1
  const peekFeature = peekIndex >= 0 ? tree.features[peekIndex] : null
  const peekResult = peekIndex >= 0 ? report?.features[peekIndex] : undefined

  return (
    <nav ref={nav} aria-label="特征树" className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 flex flex-col items-start gap-1.5">
      {details}
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
                {canColor ? <LookPicker look={p.look} label={`「${p.name}」的颜色`} onChange={(c) => setLook([p.name], c)} className="-ml-1" /> : <LookDot look={p.look} />}
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
      <div className="relative h-9 w-full">
      <div
        data-timeline-bar
        data-open={open}
        className={cn(
          "pointer-events-auto absolute bottom-0 left-0 flex max-w-full items-stretch rounded-lg border border-transparent bg-background/40 opacity-70",
          "transition-[background-color,opacity,border-color,box-shadow] duration-(--duration-fast) ease-out",
          "timeline-lit:border-border timeline-lit:bg-background/90 timeline-lit:opacity-100 timeline-lit:shadow-sm",
        )}
        onMouseLeave={hide}
      >
        {peekFeature && peek && <StepPeek feature={peekFeature} result={peekResult} index={peekIndex} name={displayName(tree, peekFeature)} x={peek.x} />}
        <div className="flex shrink-0 flex-col items-start justify-center gap-1 border-r border-transparent px-2 py-1 text-caption text-faint-foreground timeline-lit:border-border">
          <div className="flex items-center gap-1 whitespace-nowrap">
            {canColor && studio.display?.mesh && (
              <span className={LIT}>
                <LookPicker
                  look={{ ...(tree.appearance?.color ? { color: tree.appearance.color } : {}), ...(tree.appearance?.finish ? { finish: tree.appearance.finish } : {}), source: "part" }}
                  label={splitParts ? "整个零件的颜色（各零件自己设的优先）" : "零件的颜色"}
                  onChange={(c) => setLook(undefined, c)}
                  className="-ml-1"
                />
              </span>
            )}
            <span className="tabular">{tree.features.length} 个特征</span>
            <span className={LIT}>
              <Hint
                label="特征树怎么用"
                side="top"
                tips={[
                  "点一步：模型回到这一步，右侧显示它的详情，可以直接改尺寸、在模型上重选面或边。",
                  "指向一步只看一眼；蓝色是这一步新生成的面，橙色是被它修改的面。",
                  "再点一次、点「关闭」或按 Esc，回到最新一步；← → 在各步之间移动；双击一步改名。",
                ]}
              />
            </span>
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
                  // The second click of a double-click renames; it doesn't let go of the step again.
                  onClick={(e) => e.detail < 2 && pin(f)}
                  onDoubleClick={() => {
                    // A part of an assembly is renamed in the parts list.
                    if (readOnly || f.op === "component") return
                    if (pinned !== f.id) pin(f)
                    setRenaming(f.id)
                  }}
                  aria-expanded={pinned === f.id}
                  aria-label={displayName(tree, f)}
                  onMouseEnter={(e) => show(f, e.currentTarget)}
                  onFocus={(e) => show(f, e.currentTarget)}
                  onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) hide() }}
                  aria-describedby={peek?.id === f.id ? "feature-peek" : undefined}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative flex w-8 flex-col items-center gap-1 rounded-md border border-transparent px-1 py-1 text-muted-foreground",
                    "timeline-lit:w-16 timeline-lit:pt-1.5",
                    "transition-[background-color,color,border-color] duration-(--duration-fast) ease-out",
                    "hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground",
                    peek?.id === f.id && "bg-muted text-foreground",
                    (active || pinned === f.id || selectedFeature === f.id) && "border-border bg-selected text-foreground",
                    (after || f.suppressed) && "opacity-50",
                  )}
                >
                  <span className="relative">
                    <OpIcon op={iconOf(f)} className="size-4 timeline-lit:size-5" />
                    {r?.state === "error" ? (
                      <CircleAlert className="absolute -top-1 -right-2 size-3 rounded-full bg-background text-destructive" aria-label="失败" />
                    ) : r?.state === "skipped" ? (
                      <CircleDashed className="absolute -top-1 -right-2 size-3 rounded-full bg-background text-faint-foreground" aria-label="未重建" />
                    ) : null}
                  </span>
                  <span aria-hidden className={cn("hidden w-full truncate text-center text-caption leading-tight timeline-lit:block", rowActions && "group-hover/row:invisible group-focus-within/row:invisible", f.suppressed && "line-through")}>{displayName(tree, f)}</span>
                  {f.part && <span className="hidden max-w-full truncate rounded-xs bg-muted px-1 text-caption leading-tight text-faint-foreground timeline-lit:block">{f.part}</span>}
                  {f.suppressed && <span className="sr-only">（已压缩）</span>}
                </button>
                {rowActions && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-center justify-center opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">{rowActions(f)}</div>}
              </li>
            )
          })}
        </ol>
        {footer && <div className="flex shrink-0 items-center border-l px-1">{footer}</div>}
      </div>
      </div>
    </nav>
  )
}

/**
 * Shown only while the timeline is lit up (pointed at, focused, a step or one of these popovers
 * open). It goes a moment after the timeline dims, so a popover fading out keeps its anchor and
 * doesn't jump to the corner of the window.
 */
const LIT = "hidden items-center transition-[display] transition-discrete duration-(--duration-base) timeline-lit:inline-flex"

/** The card over a step pointed at: what it is and what it did, without taking over the side panel. */
function StepPeek({ feature: f, result: r, index, name, x }: { feature: Feature; result?: { state: string; message?: string; faces?: { new: number; modified: number }; ms: number }; index: number; name: string; x: number }) {
  const kind = `${OP_NAMES[f.op]}${"mode" in f && f.mode === "cut" ? " · 切除" : ""}`
  return (
    <div
      id="feature-peek"
      role="tooltip"
      className="pointer-events-none absolute bottom-full mb-2 w-max max-w-64 -translate-x-1/2 rounded-md border bg-background px-2.5 py-1.5 text-small shadow-popover"
      style={{ left: Math.max(80, x) }}
    >
      <div className="font-medium">{name}</div>
      <div className="text-caption text-faint-foreground tabular">
        第 {index + 1} 步 · {kind}
        {r?.state === "ok" && r.faces ? ` · 新面 ${r.faces.new}${r.faces.modified ? ` · 改动 ${r.faces.modified}` : ""}` : ""}
      </div>
      {r?.state === "error" && <div className="mt-0.5 line-clamp-2 text-caption text-destructive">{r.message ?? "这一步没建成"}</div>}
      {r?.state === "skipped" && <div className="mt-0.5 text-caption text-faint-foreground">前面的步骤失败了，这一步没有重建</div>}
      {f.intent && <div className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">{f.intent}</div>}
    </div>
  )
}
