import * as React from "react"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import type { DrawingData, SheetDim, SheetView, ViewName } from "../kernel/drawing"
import type { Studio } from "../use-studio"

type V2 = [number, number]

/** Preferred scales (GB/T 14690), largest first. */
const SCALES = [5, 2, 1, 1 / 2, 1 / 5, 1 / 10, 1 / 20]
const SHEETS = [
  { name: "A4", w: 297, h: 210 },
  { name: "A3", w: 420, h: 297 },
]
const MARGIN = 10
/** Room around each view for its dimensions, in paper mm. */
const GAP = 24
const TITLE = { w: 180, h: 28 }
const LABEL: Record<ViewName, string> = { front: "主视图", top: "俯视图", left: "左视图", iso: "轴测图" }

const w = (v: SheetView) => v.bbox[1][0] - v.bbox[0][0]
const h = (v: SheetView) => v.bbox[1][1] - v.bbox[0][1]
const scaleText = (s: number) => (s >= 1 ? `${s}:1` : `1:${Math.round(1 / s)}`)

/** Paper size and scale: the biggest preferred scale that fits on A4, else A3. */
function layout(d: DrawingData) {
  const v = (n: ViewName) => d.views.find((x) => x.name === n)!
  const [f, t, l] = [v("front"), v("top"), v("left")]
  for (const sheet of SHEETS)
    for (const s of SCALES) {
      const width = MARGIN * 2 + GAP * 3 + (w(f) + w(l)) * s
      const height = MARGIN * 2 + GAP * 3 + (h(f) + h(t)) * s + TITLE.h
      if (width <= sheet.w && height <= sheet.h) return { sheet, s }
    }
  return { sheet: SHEETS[1], s: SCALES[SCALES.length - 1] }
}

/**
 * The drawing sheet: first-angle views (top view under the front view, left
 * view to its right), hidden lines dashed, centre lines, dimensions, a title
 * block. Recomputed when the model changes while it is open.
 */
export function DrawingSheet({ studio, title }: { studio: Studio; title: string }) {
  const [iso, setIso] = React.useState(false)
  const [names, setNames] = React.useState(false)
  const [data, setData] = React.useState<DrawingData | null | undefined>(undefined)
  // The local date (sv-SE writes it as YYYY-MM-DD), not UTC: a sheet printed at 1 a.m. in China carries today.
  const [date] = React.useState(() => new Date().toLocaleDateString("sv-SE"))
  const svg = React.useRef<SVGSVGElement>(null)
  const { report, drawing } = studio
  React.useEffect(() => {
    let live = true
    const t = window.setTimeout(() => void drawing(iso).then((d) => live && setData(d)), 150)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [drawing, report, iso])

  if (data === undefined)
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    )
  if (data === null) return <p className="grid h-full place-items-center text-body text-muted-foreground">还没有实体，建出零件后这里会出三视图。</p>

  const { sheet, s } = layout(data)
  const view = (n: ViewName) => data.views.find((x) => x.name === n)
  const f = view("front")!
  const x0 = MARGIN + GAP
  const y0 = MARGIN + GAP
  // Paper origin of each view's (minU, maxV) corner: 长对正、高平齐、宽相等.
  const at: Partial<Record<ViewName, V2>> = {
    front: [x0, y0],
    left: [x0 + w(f) * s + GAP, y0],
    top: [x0, y0 + h(f) * s + GAP],
  }
  const isoView = iso ? view("iso") : undefined
  let isoScale = s
  if (isoView) {
    const room: V2 = [sheet.w - MARGIN - (x0 + w(f) * s + GAP), sheet.h - MARGIN - TITLE.h - 6 - (y0 + h(f) * s + GAP)]
    isoScale = Math.min(s, room[0] / Math.max(1e-9, w(isoView)), room[1] / Math.max(1e-9, h(isoView))) * 0.9
    at.iso = [x0 + w(f) * s + GAP, y0 + h(f) * s + GAP]
  }
  const no = `FT-${hash(JSON.stringify(studio.tree)).slice(0, 6).toUpperCase()}`

  const exportSvg = () => {
    if (!svg.current) return
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg.current.outerHTML}`], { type: "image/svg+xml" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${title || "arbor"}-工程图.svg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const print = () => {
    if (!svg.current) return
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} 工程图</title><style>@page{size:${sheet.name} landscape;margin:0}html,body{margin:0}svg{width:${sheet.w}mm;height:${sheet.h}mm;display:block}</style></head><body>${svg.current.outerHTML}</body></html>`,
    )
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background px-3 py-2 text-small">
        <span className="text-muted-foreground">
          {sheet.name} 横版 · 比例 {scaleText(s)} · 第一角投影
        </span>
        <label className="ml-auto flex items-center gap-1.5">
          <Switch checked={names} onCheckedChange={setNames} aria-label="显示参数名" />
          显示参数名
        </label>
        <label className="flex items-center gap-1.5">
          <Switch checked={iso} onCheckedChange={setIso} aria-label="轴测图" />
          轴测图
        </label>
        <Button size="sm" variant="secondary" onClick={exportSvg}>
          <Download /> 导出 SVG
        </Button>
        <Button size="sm" variant="secondary" onClick={print}>
          <Printer /> 打印 / 存 PDF
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted p-4">
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${sheet.w} ${sheet.h}`}
          width={`${sheet.w}mm`}
          height={`${sheet.h}mm`}
          role="img"
          aria-label={`${title} 工程图`}
          className="mx-auto h-auto max-h-full w-full max-w-[1200px] shadow-popover"
          fontFamily="'Noto Sans SC', 'PingFang SC', sans-serif"
        >
          {/* Paper is white in every theme: it is what gets printed and exported. */}
          <rect width={sheet.w} height={sheet.h} fill="white" />
          <rect x={5} y={5} width={sheet.w - 10} height={sheet.h - 10} fill="none" stroke="black" strokeWidth={0.7} />
          {(Object.keys(at) as ViewName[]).map((n) => {
            const v = view(n)
            const o = at[n]
            if (!v || !o) return null
            const k = n === "iso" ? isoScale : s
            return <ViewGroup key={n} v={v} origin={o} k={k} names={names} />
          })}
          {data.note && (
            <text x={sheet.w - MARGIN - TITLE.w} y={sheet.h - MARGIN - TITLE.h - 3} fontSize={3}>
              注：{data.note}
            </text>
          )}
          <TitleBlock x={sheet.w - MARGIN - TITLE.w} y={sheet.h - MARGIN - TITLE.h} title={title} scale={scaleText(s)} date={date} no={no} />
        </svg>
      </div>
    </div>
  )
}

/** One view at paper `origin` (its bbox's top-left), `k` paper mm per model mm. */
function ViewGroup({ v, origin, k, names }: { v: SheetView; origin: V2; k: number; names: boolean }) {
  const P = (u: number, vv: number): V2 => [origin[0] + (u - v.bbox[0][0]) * k, origin[1] + (v.bbox[1][1] - vv) * k]
  const path = (segs: number[]) => {
    let d = ""
    for (let i = 0; i < segs.length; i += 4) {
      const a = P(segs[i], segs[i + 1])
      const b = P(segs[i + 2], segs[i + 3])
      d += `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`
    }
    return d
  }
  const labelAt = P((v.bbox[0][0] + v.bbox[1][0]) / 2, v.bbox[0][1])
  return (
    <g>
      <path d={path(v.hidden)} fill="none" stroke="black" strokeWidth={0.25} strokeDasharray="2.5 1" />
      <path d={path(v.centre)} fill="none" stroke="black" strokeWidth={0.18} strokeDasharray="8 1.5 1 1.5" />
      <path d={path(v.visible)} fill="none" stroke="black" strokeWidth={0.5} strokeLinecap="round" />
      {v.dims.map((d, i) => (
        <DimMark key={i} d={d} P={P} k={k} names={names} />
      ))}
      {v.name === "iso" && (
        <text x={labelAt[0]} y={labelAt[1] + 6} fontSize={3} textAnchor="middle" fill="dimgray">
          {LABEL[v.name]}
        </text>
      )}
    </g>
  )
}

/** A dimension on paper: extension lines, arrowed dimension line and value; leaders and pitch circles. */
function DimMark({ d, P, k, names }: { d: SheetDim; P: (u: number, v: number) => V2; k: number; names: boolean }) {
  const text = names ? d.text : d.plain
  const g = d.geom
  const stroke = { stroke: "black", strokeWidth: 0.18, fill: "none" }
  if (g.type === "circle") {
    const c = P(g.c[0], g.c[1])
    const r = g.r * k
    return (
      <g>
        <circle cx={c[0]} cy={c[1]} r={r} {...stroke} strokeDasharray="8 1.5 1 1.5" />
        <text x={c[0] + r * 0.72 + 1} y={c[1] - r * 0.72 - 1} fontSize={3}>
          {text}
        </text>
      </g>
    )
  }
  if (g.type === "leader") {
    const a = P(g.at[0], g.at[1])
    const len = Math.hypot(g.dir[0], g.dir[1]) || 1
    const dir: V2 = [g.dir[0] / len, -g.dir[1] / len]
    const b: V2 = [a[0] + dir[0] * 8, a[1] + dir[1] * 8]
    const right = dir[0] >= 0
    const c: V2 = [b[0] + (right ? 3 : -3), b[1]]
    return (
      <g>
        <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${c[0]} ${c[1]}`} {...stroke} />
        <circle cx={a[0]} cy={a[1]} r={0.4} fill="black" />
        <text x={c[0] + (right ? 0.8 : -0.8)} y={c[1] + 1} fontSize={3} textAnchor={right ? "start" : "end"}>
          {text}
        </text>
      </g>
    )
  }
  const a = P(g.a[0], g.a[1])
  const b = P(g.b[0], g.b[1])
  // Offset in paper mm: at least 7 mm off the part.
  const ol = Math.hypot(g.offset[0], g.offset[1])
  const on: V2 = ol > 1e-9 ? [g.offset[0] / ol, -g.offset[1] / ol] : [0, 0]
  const off = Math.max(ol * k, ol > 1e-9 ? 7 : 0)
  const a2: V2 = [a[0] + on[0] * off, a[1] + on[1] * off]
  const b2: V2 = [b[0] + on[0] * off, b[1] + on[1] * off]
  const L = Math.hypot(b2[0] - a2[0], b2[1] - a2[1])
  if (L < 0.5) return null
  const u: V2 = [(b2[0] - a2[0]) / L, (b2[1] - a2[1]) / L]
  const n: V2 = [-u[1], u[0]]
  const arrow = (p: V2, s: number) => `M${p[0]} ${p[1]}L${p[0] + s * u[0] * 2.5 + n[0] * 0.6} ${p[1] + s * u[1] * 2.5 + n[1] * 0.6}L${p[0] + s * u[0] * 2.5 - n[0] * 0.6} ${p[1] + s * u[1] * 2.5 - n[1] * 0.6}Z`
  const over = 1.5
  const mid: V2 = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]
  let angle = (Math.atan2(u[1], u[0]) * 180) / Math.PI
  if (angle > 90 || angle <= -90) angle += 180
  return (
    <g>
      {off > 0 && <path d={`M${a[0] + on[0]}  ${a[1] + on[1]}L${a2[0] + on[0] * over} ${a2[1] + on[1] * over}M${b[0] + on[0]} ${b[1] + on[1]}L${b2[0] + on[0] * over} ${b2[1] + on[1] * over}`} {...stroke} />}
      <path d={`M${a2[0]} ${a2[1]}L${b2[0]} ${b2[1]}`} {...stroke} />
      <path d={`${arrow(a2, 1)}${arrow(b2, -1)}`} fill="black" />
      <text x={mid[0]} y={mid[1]} fontSize={3} textAnchor="middle" transform={`rotate(${angle} ${mid[0]} ${mid[1]}) translate(0 -1)`}>
        {text}
      </text>
    </g>
  )
}

/** A simplified GB title block with the first-angle projection symbol. */
function TitleBlock({ x, y, title, scale, date, no }: { x: number; y: number; title: string; scale: string; date: string; no: string }) {
  const cell = (cx: number, cy: number, cw: number, ch: number, label: string, value: string, big = false) => (
    <g>
      <rect x={x + cx} y={y + cy} width={cw} height={ch} fill="none" stroke="black" strokeWidth={0.35} />
      <text x={x + cx + 1.5} y={y + cy + 3.2} fontSize={2.2} fill="dimgray">
        {label}
      </text>
      <text x={x + cx + cw / 2} y={y + cy + ch / 2 + (big ? 3 : 2)} fontSize={big ? 5 : 3.2} textAnchor="middle">
        {value}
      </text>
    </g>
  )
  return (
    <g>
      <rect x={x} y={y} width={TITLE.w} height={TITLE.h} fill="white" stroke="black" strokeWidth={0.7} />
      {cell(0, 0, 80, 18, "名称", title, true)}
      {cell(0, 18, 40, 10, "日期", date)}
      {cell(40, 18, 40, 10, "设计", "")}
      {cell(80, 0, 30, 9, "比例", scale)}
      {cell(80, 9, 30, 9, "材料", "未注")}
      {cell(80, 18, 30, 10, "单位", "mm")}
      {cell(110, 0, 70, 18, "图号", no)}
      <g transform={`translate(${x + 118} ${y + 19.5})`} stroke="black" strokeWidth={0.3} fill="none" aria-label="第一角投影">
        {/* First angle: the cone's end view sits to the right of its side view. */}
        <path d="M0 1L10 0L10 7L0 6Z" />
        <path d="M-1 3.5H11" strokeDasharray="2 0.6 0.4 0.6" strokeWidth={0.18} />
        <circle cx={18} cy={3.5} r={3.5} />
        <circle cx={18} cy={3.5} r={2.5} />
      </g>
      <text x={x + 157} y={y + 25} fontSize={2.6} textAnchor="middle">
        第一角投影
      </text>
    </g>
  )
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, "0")
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
