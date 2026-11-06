import * as React from "react"
import { ArrowLeftRight, Expand, Ruler, RulerDimensionLine, ScissorsLineDashed, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Tooltip } from "@/components/ui/tooltip"
import type { MeasureResult } from "../kernel/measure"
import { AXIS_INDEX, newSection, round, type Section } from "../section"

type V3 = [number, number, number]

/** The tools column under the view cube: measure and section. */
export function ViewTools({
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
}: {
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
}) {
  const [exploding, setExploding] = React.useState(false)
  return (
    <>
      <div className="absolute top-40 right-3 flex flex-col gap-1 rounded-md border bg-background/90 p-0.5">
        <Tooltip content="测量：点一个面或边看尺寸，再点一个看两者之间" side="left">
          <IconButton label="测量" size="icon-sm" aria-pressed={measuring} className={cn(measuring && "bg-selected text-primary")} onClick={() => onMeasuring(!measuring)}>
            <RulerDimensionLine />
          </IconButton>
        </Tooltip>
        <Tooltip content="剖视：切开看里面" side="left">
          <IconButton label="剖视" size="icon-sm" aria-pressed={!!section} className={cn(section && "bg-selected text-primary")} disabled={!bbox} onClick={() => onSection(section ? null : newSection(bbox))}>
            <ScissorsLineDashed />
          </IconButton>
        </Tooltip>
        <Tooltip content={dims.total > dims.shown ? `显示尺寸：标出主要的 ${dims.shown} / ${dims.total} 个，单击可以改` : "显示尺寸：标出模型的尺寸，单击可以改"} side="left">
          <IconButton label="显示尺寸" size="icon-sm" aria-pressed={dims.on} className={cn(dims.on && "bg-selected text-primary")} disabled={!dims.total} onClick={() => onDims(!dims.on)}>
            <Ruler />
          </IconButton>
        </Tooltip>
        <Tooltip content={explode === null ? "爆炸：拆件以后可以把零件分开看" : "爆炸：把零件分开看"} side="left">
          <IconButton
            label="爆炸"
            size="icon-sm"
            aria-pressed={exploding}
            className={cn(exploding && "bg-selected text-primary")}
            disabled={explode === null}
            onClick={() => {
              if (exploding) onExplode(0)
              setExploding(!exploding)
            }}
          >
            <Expand />
          </IconButton>
        </Tooltip>
      </div>
      {section && bbox && <SectionPanel section={section} onChange={onSection} bbox={bbox} />}
      {exploding && explode !== null && (
        <div role="group" aria-label="爆炸" className="absolute right-14 top-40 flex w-56 flex-col gap-2 rounded-md border bg-background/95 p-2.5 text-small shadow-popover">
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

function SectionPanel({ section, onChange, bbox }: { section: Section; onChange: (s: Section | null) => void; bbox: [V3, V3] }) {
  const i = AXIS_INDEX[section.axis]
  const [lo, hi] = [bbox[0][i], bbox[1][i]]
  const pad = Math.max(0.5, (hi - lo) * 0.02)
  return (
    <div role="group" aria-label="剖视" className="absolute right-14 top-40 flex w-56 flex-col gap-2 rounded-md border bg-background/95 p-2.5 text-small shadow-popover">
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
