import * as React from "react"
import { ArrowLeftRight, BoxSelect, Expand, GitCompareArrows, Keyboard, MessageSquarePlus, MousePointer2, Palette, PenLine, Ruler, RulerDimensionLine, ScissorsLineDashed, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Segmented } from "@/components/ui/segmented"
import type { MeasureResult } from "../kernel/measure"
import { AXIS_INDEX, newSection, round, type Section } from "../section"
import type { KeyRow, ViewTool } from "../view-keys"

type V3 = [number, number, number]

/**
 * The tools column on the left edge of the view, in three groups: what a click does (select, note,
 * frame, draw, measure), how the model is cut and labelled (section, dimensions), and how it looks
 * (explode, colours, changes). Each tool has a one-letter key, shown in its tooltip; ? lists them.
 */
export function ViewTools({
  tool,
  onTool,
  notes = true,
  sketch = false,
  section,
  onSection,
  bbox,
  dims,
  onDims,
  explode,
  exploding,
  onExploding,
  onExplode,
  onExplodeEnd,
  looks,
  onLooks,
  changes,
  onChanges,
  keysOpen,
  onKeysOpen,
  keys,
  tips,
}: {
  tool: ViewTool
  onTool: (t: ViewTool) => void
  /** Select and note tools (the host switches between them; none on a shared link). */
  notes?: boolean
  /** Framing and drawing a note (where the host can keep such a note). */
  sketch?: boolean
  section: Section | null
  onSection: (s: Section | null) => void
  bbox: [V3, V3] | null
  /** 「显示尺寸」: on or off, and how many of how many it shows. */
  dims: { on: boolean; shown: number; total: number }
  onDims: (on: boolean) => void
  /** 0–1 when the body has parts, else null (no parts to pull apart). */
  explode: number | null
  exploding: boolean
  onExploding: (on: boolean) => void
  onExplode: (f: number) => void
  onExplodeEnd: () => void
  /** Parts in their colours and finishes, or a white model; `available`: anything to colour at all. */
  looks?: { on: boolean; available: boolean }
  onLooks?: (on: boolean) => void
  /** 「查看变更」: faces coloured by what the last change did to them. */
  changes: boolean
  onChanges: (on: boolean) => void
  keysOpen: boolean
  onKeysOpen: (open: boolean) => void
  /** The keys the card lists. */
  keys: KeyRow[]
  /** How the view works, over the keys. */
  tips: string[]
}) {
  const on = "bg-selected text-primary"
  const button = (t: ViewTool, label: string, key: string, icon: React.ReactNode, tooltip?: string) => (
    <IconButton label={label} tooltip={`${tooltip ?? label}（${key}）`} tooltipSide="right" size="icon-sm" aria-pressed={tool === t} className={cn(tool === t && on)} onClick={() => onTool(tool === t && t !== "select" ? "select" : t)}>
      {icon}
    </IconButton>
  )
  const rule = <div className="my-0.5 h-px w-5 bg-border" />
  return (
    <>
      <div role="toolbar" aria-label="视图工具" aria-orientation="vertical" className="absolute top-3 left-3 z-10 flex flex-col items-center gap-1 rounded-md border bg-background/90 p-0.5">
        {notes && button("select", "查看与选择", "V", <MousePointer2 />)}
        {notes && button("note", "标注", "C", <MessageSquarePlus />, "标注：点面或边写备注")}
        {sketch && button("box", "框选标注", "R", <BoxSelect />, "框选标注：拖出一个框，给框里的写备注")}
        {sketch && button("pen", "画笔标注", "P", <PenLine />, "画笔标注：在模型上画出要说的地方")}
        {button("measure", "测量", "M", <RulerDimensionLine />, "测量：点一个面或边看尺寸，再点一个看两者之间")}
        {rule}
        <IconButton
          label="剖视"
          tooltip="剖视：切开看里面（X）"
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={!!section}
          className={cn(section && on)}
          disabled={!bbox}
          onClick={() => onSection(section ? null : newSection(bbox))}
        >
          <ScissorsLineDashed />
        </IconButton>
        <IconButton
          label="显示尺寸"
          tooltip={`${dims.total > dims.shown ? `显示尺寸：标出主要的 ${dims.shown} / ${dims.total} 个，单击可以改` : "显示尺寸：标出模型的尺寸，单击可以改"}（D）`}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={dims.on}
          className={cn(dims.on && on)}
          disabled={!dims.total}
          onClick={() => onDims(!dims.on)}
        >
          <Ruler />
        </IconButton>
        {rule}
        <IconButton
          label="爆炸"
          tooltip={explode === null ? "爆炸：拆件以后可以把零件分开看" : "爆炸：把零件分开看（E）"}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={exploding}
          className={cn(exploding && on)}
          disabled={explode === null}
          onClick={() => onExploding(!exploding)}
        >
          <Expand />
        </IconButton>
        {looks && onLooks && (
          <IconButton
            label="颜色"
            tooltip={!looks.available ? "颜色：零件还没有设颜色和质感" : `${looks.on ? "颜色：按零件的颜色和质感显示，单击换成白模" : "颜色：现在是白模，单击按零件的颜色和质感显示"}（A）`}
            tooltipSide="right"
            size="icon-sm"
            aria-pressed={looks.on && looks.available}
            className={cn(looks.on && looks.available && on)}
            disabled={!looks.available}
            onClick={() => onLooks(!looks.on)}
          >
            <Palette />
          </IconButton>
        )}
        <div className="relative">
          <IconButton label="查看变更" tooltip="查看变更：最近一次改动新增和改了哪些面" tooltipSide="right" size="icon-sm" aria-pressed={changes} className={cn(changes && on)} onClick={() => onChanges(!changes)}>
            <GitCompareArrows />
          </IconButton>
          {changes && (
            <span role="status" className="absolute top-0.5 left-full ml-2.5 flex items-center gap-2 rounded-md border bg-background/95 px-2 py-0.5 text-caption whitespace-nowrap">
              <span className="flex items-center gap-1"><span aria-hidden className="size-2.5 rounded-xs bg-scene-good" />新增</span>
              <span className="flex items-center gap-1"><span aria-hidden className="size-2.5 rounded-xs bg-scene-modified" />修改</span>
            </span>
          )}
        </div>
        {rule}
        <Popover open={keysOpen} onOpenChange={onKeysOpen}>
          <PopoverTrigger asChild>
            <IconButton label="快捷键和用法" tooltip="快捷键和用法（?）" tooltipSide="right" size="icon-sm" aria-pressed={keysOpen}>
              <Keyboard />
            </IconButton>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-80 space-y-3 text-small" aria-label="快捷键和用法">
            <ul className="space-y-1 text-muted-foreground">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <table className="w-full">
              <tbody>
                {keys.map((k) => (
                  <tr key={k.keys}>
                    <td className="w-16 py-0.5 pr-2 align-top">
                      <kbd className="rounded-sm border bg-muted px-1 font-mono text-caption whitespace-nowrap">{k.keys}</kbd>
                    </td>
                    <td className="py-0.5 align-top">{k.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PopoverContent>
        </Popover>
      </div>
      {section && bbox && <SectionPanel section={section} onChange={onSection} bbox={bbox} />}
      {exploding && explode !== null && (
        <div role="group" aria-label="爆炸" className={cn(PANEL, section && "top-36")}>
          <div className="flex items-center gap-2">
            <span className="font-medium">爆炸</span>
            <span className="ml-auto font-mono text-caption tabular text-muted-foreground">{Math.round(explode * 100)}%</span>
            <IconButton label="合上并关闭" size="icon-sm" onClick={() => onExploding(false)}>
              <X />
            </IconButton>
          </div>
          <input
            type="range"
            aria-label="零件分开的程度"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            onChange={(e) => onExplode(Number(e.target.value))}
            onPointerUp={onExplodeEnd}
            onKeyUp={onExplodeEnd}
            className="h-5 cursor-pointer accent-primary"
          />
        </div>
      )}
    </>
  )
}

/** A tool's panel, beside the tools column. */
const PANEL = "absolute top-3 left-14 z-10 flex w-56 flex-col gap-2 rounded-md border bg-background/95 p-2.5 text-small shadow-popover"

function SectionPanel({ section, onChange, bbox }: { section: Section; onChange: (s: Section | null) => void; bbox: [V3, V3] }) {
  const i = AXIS_INDEX[section.axis]
  const [lo, hi] = [bbox[0][i], bbox[1][i]]
  const pad = Math.max(0.5, (hi - lo) * 0.02)
  return (
    <div role="group" aria-label="剖视" className={PANEL}>
      <div className="flex items-center gap-2">
        <span className="font-medium">剖视</span>
        <Segmented
          size="sm"
          aria-label="剖切方向"
          className="ml-auto"
          value={section.axis}
          onValueChange={(axis) => onChange(newSection(bbox, axis))}
          options={[
            { value: "X", label: "X" },
            { value: "Y", label: "Y" },
            { value: "Z", label: "Z" },
          ]}
        />
        <IconButton label="关闭剖视" size="icon-sm" onClick={() => onChange(null)}>
          <X />
        </IconButton>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="range"
          aria-label={`剖切位置（${section.axis}）`}
          min={round(lo + pad)}
          max={round(hi - pad)}
          step={0.1}
          value={section.at}
          onChange={(e) => onChange({ ...section, at: Number(e.target.value) })}
          className="h-5 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <span className="w-14 text-right font-mono text-caption tabular text-muted-foreground">
          {section.axis}={section.at}
        </span>
      </label>
      <button type="button" onClick={() => onChange({ ...section, flip: !section.flip })} className="flex items-center gap-1.5 self-start text-muted-foreground hover:text-foreground">
        <ArrowLeftRight className="size-3.5" />
        保留另一侧
      </button>
    </div>
  )
}

/** What the clicked items measure, where the annotation hint usually is. */
export function MeasurePanel({ result, count, onClose }: { result: MeasureResult | null; count: number; onClose: () => void }) {
  return (
    <div role="region" aria-label="测量结果" className="absolute top-3 left-1/2 w-72 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border bg-background/95 p-2.5 text-small shadow-popover">
      <div className="flex items-center gap-2">
        <span className="font-medium">测量</span>
        <span className="text-caption text-faint-foreground">{count === 0 ? "单击面或边" : count === 1 ? "再点一个，量两者之间" : "再点会重新开始"}</span>
        <IconButton label="退出测量" size="icon-sm" className="ml-auto" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      {result && (
        <div className="mt-1.5 space-y-1.5">
          {result.items.map((it, i) => (
            <div key={i}>
              <span className="text-muted-foreground">
                {"①②"[i]} {it.kind === "face" ? "面" : "边"} · {it.what}：
              </span>
              {it.facts.join(" · ")}
            </div>
          ))}
          {result.between.length > 0 && (
            <div className="space-y-0.5 border-t pt-1.5">
              {result.between.map((b) => (
                <div key={b.name} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{b.name}</span>
                  <span className="font-mono tabular">{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
