import { MousePointer2, MessageSquarePlus } from "lucide-react"
import * as React from "react"
import { ArrowLeftRight, Expand, Ruler, RulerDimensionLine, ScissorsLineDashed, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint } from "@/components/hint"
import type { MeasureResult } from "../kernel/measure"
import { AXIS_INDEX, newSection, round, type Section } from "../section"

type V3 = [number, number, number]

/** The tools column on the left edge of the view: measure, section, dimensions, explode; panels open beside it. */
export function ViewTools({
  annotation,
  onAnnotation,
  measuring,
  onMeasuring,
  section,
  onSection,
  bbox,
  dims,
  onDims,
  explode,
  onExplode,
  onExplodeEnd,
  tips,
}: {
  annotation?: boolean
  onAnnotation?: (on: boolean) => void
  measuring: boolean
  onMeasuring: (on: boolean) => void
  section: Section | null
  onSection: (s: Section | null) => void
  bbox: [V3, V3] | null
  /** 「显示尺寸」: on or off, and how many of how many it shows. */
  dims: { on: boolean; shown: number; total: number }
  onDims: (on: boolean) => void
  /** 0–1 when the body has parts, else null (no parts to pull apart). */
  explode: number | null
  onExplode: (f: number) => void
  onExplodeEnd: () => void
  /** 「视图怎么用」 under the tools. */
  tips: string[]
}) {
  const [exploding, setExploding] = React.useState(false)
  const on = "bg-selected text-primary"
  return (
    <>
      <div className="absolute top-3 left-3 z-10 flex flex-col items-center gap-1 rounded-md border bg-background/90 p-0.5">
        {onAnnotation && <>
          <IconButton label="查看与选择" tooltipSide="right" size="icon-sm" aria-pressed={!annotation && !measuring} className={cn(!annotation && !measuring && on)} onClick={() => { onAnnotation(false); onMeasuring(false) }}><MousePointer2 /></IconButton>
          <IconButton label="标注" tooltipSide="right" size="icon-sm" aria-pressed={annotation} className={cn(annotation && on)} onClick={() => { onAnnotation(!annotation); onMeasuring(false) }}><MessageSquarePlus /></IconButton>
        </>}
        <IconButton
          label="测量"
          tooltip="测量：点一个面或边看尺寸，再点一个看两者之间"
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={measuring}
          className={cn(measuring && on)}
          onClick={() => { onAnnotation?.(false); onMeasuring(!measuring) }}
        >
          <RulerDimensionLine />
        </IconButton>
        <IconButton
          label="剖视"
          tooltip="剖视：切开看里面"
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
          tooltip={dims.total > dims.shown ? `显示尺寸：标出主要的 ${dims.shown} / ${dims.total} 个，单击可以改` : "显示尺寸：标出模型的尺寸，单击可以改"}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={dims.on}
          className={cn(dims.on && on)}
          disabled={!dims.total}
          onClick={() => onDims(!dims.on)}
        >
          <Ruler />
        </IconButton>
        <IconButton
          label="爆炸"
          tooltip={explode === null ? "爆炸：拆件以后可以把零件分开看" : "爆炸：把零件分开看"}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={exploding}
          className={cn(exploding && on)}
          disabled={explode === null}
          onClick={() => {
            if (exploding) onExplode(0)
            setExploding(!exploding)
          }}
        >
          <Expand />
        </IconButton>
        <div className="my-0.5 h-px w-5 bg-border" />
        <Hint label="视图怎么用" side="right" align="start" className="mb-1" tips={tips} />
      </div>
      {section && bbox && <SectionPanel section={section} onChange={onSection} bbox={bbox} />}
      {exploding && explode !== null && (
        <div role="group" aria-label="爆炸" className={cn(PANEL, section && "top-36")}>
          <div className="flex items-center gap-2">
            <span className="font-medium">爆炸</span>
            <span className="ml-auto font-mono text-caption tabular text-muted-foreground">{Math.round(explode * 100)}%</span>
            <IconButton
              label="合上并关闭"
              size="icon-sm"
              onClick={() => {
                onExplode(0)
                setExploding(false)
              }}
            >
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
