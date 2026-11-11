import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { Viewer } from "@/three/viewer"
import type { RegionPick } from "../region"
import { regionImage, type Marks, type ViewPoint } from "../region-pick"

/** A drag shorter than this is a click, not a box. */
const MIN_BOX = 8

/**
 * Framing (R) or drawing (P) a note: a layer over the view that takes the drag. A box replaces the
 * last one; strokes add up (the card stays open while more are drawn). The wheel still zooms until
 * something is marked: after that the marks would no longer sit on what they marked.
 */
export function SketchLayer({
  viewer,
  shape,
  gather,
  onSave,
  onClose,
}: {
  viewer: Viewer
  shape: "box" | "pen"
  /** What the marks cover on the model (asked when a mark is finished). */
  gather: (marks: Marks) => Omit<RegionPick, "image">
  /** False when the note wasn't kept (the card stays open). */
  onSave: (pick: RegionPick, text: string) => Promise<boolean>
  /** Done (saved), or left with Esc. */
  onClose: () => void
}) {
  const layer = React.useRef<HTMLDivElement>(null)
  const [box, setBox] = React.useState<{ from: ViewPoint; to: ViewPoint } | null>(null)
  const [strokes, setStrokes] = React.useState<ViewPoint[][]>([])
  const [drawing, setDrawing] = React.useState(false)
  const [pick, setPick] = React.useState<Omit<RegionPick, "image"> | null>(null)
  /** Where the card sits: the box's top-right corner, or the end of the stroke last finished. */
  const [corner, setCorner] = React.useState<ViewPoint | null>(null)
  const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const local = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const rectOf = (b: { from: ViewPoint; to: ViewPoint }): [number, number, number, number] => [Math.min(b.from.x, b.to.x), Math.min(b.from.y, b.to.y), Math.max(b.from.x, b.to.x), Math.max(b.from.y, b.to.y)]
  const marks: Marks | null = shape === "box" ? (box && !drawing ? { shape, rect: rectOf(box) } : null) : strokes.length ? { shape, strokes } : null
  const clear = () => {
    setBox(null)
    setStrokes([])
    setPick(null)
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = local(e)
    setDrawing(true)
    if (shape === "box") {
      setBox({ from: p, to: p })
      setPick(null)
    } else setStrokes((s) => [...s, [p]])
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drawing) return
    const p = local(e)
    if (shape === "box") setBox((b) => (b ? { ...b, to: p } : b))
    else setStrokes((s) => [...s.slice(0, -1), [...s.at(-1)!, p]])
  }
  const onUp = () => {
    if (!drawing) return
    setDrawing(false)
    if (shape === "box") {
      if (!box) return
      const rect = rectOf(box)
      if (rect[2] - rect[0] < MIN_BOX || rect[3] - rect[1] < MIN_BOX) return clear()
      setPick(gather({ shape, rect }))
      setCorner({ x: rect[2], y: rect[1] })
    } else if (strokes.length) {
      setPick(gather({ shape, strokes }))
      setCorner(strokes.at(-1)!.at(-1)!)
    }
  }

  const anchor = React.useRef({ getBoundingClientRect: () => new DOMRect() })
  React.useLayoutEffect(() => {
    const r = layer.current?.getBoundingClientRect()
    const at = new DOMRect((r?.left ?? 0) + (corner?.x ?? 0), (r?.top ?? 0) + (corner?.y ?? 0), 0, 0)
    anchor.current = { getBoundingClientRect: () => at }
  }, [corner])

  const save = async () => {
    if (!pick || !marks || saving) return
    setSaving(true)
    try {
      if (await onSave({ ...pick, image: regionImage(viewer, marks) }, text)) onClose()
    } finally {
      setSaving(false)
    }
  }

  const covered = pick ? (pick.faces ? `${pick.faces} 个面${pick.parts.length ? ` · ${pick.parts.map((p) => `「${p}」`).join("")}` : ""}` : "没有碰到模型：会按画面位置记下") : ""
  const shown = box ? rectOf(box) : null
  return (
    <div
      ref={layer}
      className="absolute inset-0 z-10 cursor-crosshair touch-none"
      data-testid="sketch-layer"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={(e) => {
        if (marks || drawing) return
        viewer.renderer.domElement.dispatchEvent(
          new WheelEvent("wheel", { deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, bubbles: true, cancelable: true }),
        )
      }}
    >
      <div role="status" className="pointer-events-none absolute top-3 left-1/2 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border border-primary bg-background/95 px-2.5 py-1 text-center text-caption text-foreground">
        {shape === "box" ? "拖出一个框，框住要说的地方" : "在模型上画，圈出或指出要说的地方，可以画几笔"} · Esc 退出
      </div>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        {shape === "box" && shown && <rect x={shown[0]} y={shown[1]} width={shown[2] - shown[0]} height={shown[3] - shown[1]} rx={2} className="fill-primary/10 stroke-primary" strokeWidth={2} />}
        {shape === "pen" &&
          strokes.map((s, i) => <polyline key={i} points={s.map((p) => `${p.x},${p.y}`).join(" ")} className="fill-none stroke-primary" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      {pick && corner && (
        <Popover
          open
          onOpenChange={(open) => {
            if (!open) clear()
          }}
        >
          <PopoverAnchor virtualRef={anchor} />
          <PopoverContent
            side="right"
            align="start"
            sideOffset={12}
            className="w-80 max-w-[calc(100vw-1rem)]"
            aria-label={shape === "box" ? "框选的备注" : "画笔的备注"}
            // More strokes may go on while the card is open; a click on the layer doesn't close it.
            onInteractOutside={(e) => {
              if (layer.current?.contains(e.target as Node)) e.preventDefault()
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="text-body font-medium">{shape === "box" ? "框选的区域" : "画笔圈出的地方"}</div>
            <div className="mt-0.5 text-small text-muted-foreground">{covered}</div>
            <Textarea
              className="mt-3 resize-none"
              rows={3}
              autoFocus
              maxLength={600}
              value={text}
              placeholder={shape === "box" ? "这一片想怎么改？例如：这几个孔都改成沉头" : "这里想怎么改？例如：这条边倒 R2"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void save()
                }
              }}
              aria-label="备注"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={clear}>
                {shape === "box" ? "重新框" : "擦掉重画"}
              </Button>
              <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
                记下备注
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
