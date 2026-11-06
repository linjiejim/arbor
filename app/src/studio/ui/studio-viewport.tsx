import * as React from "react"
import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { notify } from "@/components/ui/toast"
import { Viewport } from "@/components/viewport"
import { disposeObject, type Viewer } from "@/three/viewer"
import { circled, type PickInfo } from "../annotations"
import type { DisplayData } from "../kernel/build"
import type { MeasureResult, MeasureTarget } from "../kernel/measure"
import type { Pin } from "../look"
import { edgeHighlight, groupAt, modelObject, repaint, type Hover, type Paint } from "../scene"
import type { Annotations } from "../use-annotations"
import type { Studio } from "../use-studio"
import { sectionPlane, type Section } from "../section"
import { declutter, dimensionLayer, dimParam } from "../dimension-layer"
import type { Dim } from "../kernel/dims"
import { DimEditor } from "./dim-editor"
import { MeasurePanel, ViewTools } from "./viewport-tools"

type V3 = [number, number, number]
/** A press that moves less than this is a click, not a camera drag. */
const CLICK_PX = 5

/**
 * The studio's 3D view: the model, coloured by step status or by what's
 * highlighted; click a face or an edge to annotate it.
 */
export function StudioViewport({ studio, hover, annotations, busy }: { studio: Studio; hover: Hover | null; annotations: Annotations; busy: boolean }) {
  const [viewer, setViewer] = React.useState<Viewer | null>(null)
  const current = React.useRef<THREE.Group | null>(null)
  const fittedSize = React.useRef(0)
  const { display, kernel } = studio
  const { focus, draft } = annotations

  // Measure mode: up to two picked faces / edges and what the kernel says about them.
  const [measuring, setMeasuring] = React.useState(false)
  const [picked, setPicked] = React.useState<MeasureTarget[]>([])
  const [measured, setMeasured] = React.useState<{ key: string; result: MeasureResult | null } | null>(null)
  const [section, setSection] = React.useState<Section | null>(null)
  // A new model invalidates the picks (hashes belong to the old one).
  const [shownDisplay, setShownDisplay] = React.useState(display)
  if (shownDisplay !== display) {
    setShownDisplay(display)
    if (picked.length) setPicked([])
  }
  const pickKey = JSON.stringify(picked)
  const result = measured?.key === pickKey ? measured.result : null
  React.useEffect(() => {
    if (!picked.length) return
    let live = true
    void studio.measure(picked).then((r) => live && setMeasured({ key: JSON.stringify(picked), result: r }))
    return () => {
      live = false
    }
  }, [studio, picked])
  const stopMeasuring = React.useCallback(() => {
    setMeasuring(false)
    setPicked([])
  }, [])

  // Dimensions on the model: a parameter's or a feature row's when pointed at, the main ones when switched on.
  const [showDims, setShowDims] = React.useState(false)
  const [editingDim, setEditingDim] = React.useState<{ dim: Dim; el: HTMLElement } | null>(null)
  const held = useHeldHover(hover)
  const shownDims = React.useMemo(() => {
    const upTo = new Set(studio.tree.features.slice(0, (display?.index ?? -1) + 1).map((f) => f.id))
    const drawable = studio.dims.filter((d) => d.source.type !== "derived" && upTo.has(d.feature))
    let list: Dim[] = []
    let accent = false
    if (held.hover?.param) {
      list = drawable.filter((d) => dimParam(d) === held.hover!.param)
      accent = true
    } else if (held.hover?.feature) {
      list = drawable.filter((d) => d.feature === held.hover!.feature)
      accent = true
    } else if (showDims) list = [...drawable].sort((a, b) => b.priority - a.priority).slice(0, DIMS_SHOWN)
    const editing = editingDim && studio.dims.find((d) => d.id === editingDim.dim.id)
    if (editing && !list.some((d) => d.id === editing.id)) list = [...list, editing]
    return { list, accent, total: drawable.length }
  }, [studio.dims, studio.tree, display, held.hover, showDims, editingDim])
  const scale = React.useMemo(() => {
    const b = display?.bbox
    return b ? Math.max(1, 0.02 * Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2])) : 2
  }, [display])
  const setLabelPointed = held.setLabelPointed
  React.useEffect(() => {
    if (!viewer || !shownDims.list.length) return
    const layer = dimensionLayer(shownDims.list, viewer.kit, {
      scale,
      accent: new Set(shownDims.accent ? shownDims.list.map((d) => d.id) : editingDim ? [editingDim.dim.id] : []),
      onClick: busy ? undefined : (dim, el) => setEditingDim({ dim, el }),
      onPointLabel: setLabelPointed,
    })
    viewer.scene.add(layer.group)
    viewer.invalidate()
    // Labels move with the camera: sort out overlaps once each move has been drawn.
    let raf = requestAnimationFrame(() => declutter(layer.group))
    const stop = viewer.onCameraChange(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => declutter(layer.group))
    })
    return () => {
      stop()
      cancelAnimationFrame(raf)
      viewer.scene.remove(layer.group)
      disposeObject(layer.group)
      layer.dispose()
      viewer.invalidate()
    }
  }, [viewer, shownDims, scale, busy, editingDim, setLabelPointed])

  const onReady = React.useCallback((v: Viewer) => {
    setViewer(v)
    return () => setViewer(null)
  }, [])

  const paint = React.useMemo<Paint>(() => {
    if (measuring && picked.length) return { status: false, faces: picked.filter((t) => t.kind === "face").map((t) => t.hash) }
    if (focus) return { status: false, faces: focus.kind === "face" ? focus.hashes : [] }
    return { status: true, highlight: hover?.ids.length ? hover.ids : undefined }
  }, [focus, hover, measuring, picked])
  const edgeHashes = React.useMemo(
    () => (measuring ? picked.filter((t) => t.kind === "edge").map((t) => t.hash) : focus?.kind === "edge" ? focus.hashes : []),
    [measuring, picked, focus],
  )
  const paintRef = React.useRef(paint)
  React.useEffect(() => {
    paintRef.current = paint
  }, [paint])

  React.useEffect(() => {
    if (!viewer || !display) return
    const g = modelObject(display, viewer.kit, paintRef.current)
    viewer.setContent(g)
    current.current = g
    if (display.bbox) {
      const box = new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1]))
      const size = box.getSize(new THREE.Vector3()).length()
      // Re-frame on the first model and when it changes size a lot; otherwise keep the learner's camera.
      if (!fittedSize.current || size > fittedSize.current * 1.6 || size < fittedSize.current / 2.5) {
        void viewer.fit(box, { view: fittedSize.current ? undefined : "iso", animate: fittedSize.current > 0 })
        fittedSize.current = size
      }
    } else fittedSize.current = 0
  }, [viewer, display])

  React.useEffect(() => {
    if (!viewer || !current.current) return
    repaint(current.current, paint)
    viewer.invalidate()
  }, [viewer, paint])

  // Highlighted edges: thick lines over the model.
  React.useEffect(() => {
    if (!viewer || !display || !edgeHashes.length) return
    const lines = edgeHighlight(display, edgeHashes, viewer.kit)
    if (!lines) return
    viewer.scene.add(lines)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(lines)
      disposeObject(lines)
      ;((lines as THREE.Mesh).material as THREE.Material).dispose()
      viewer.invalidate()
    }
  }, [viewer, display, edgeHashes])

  // The shortest segment between two measured items, with its length on it.
  const segment = result?.segment
  const distance = result?.between.find((b) => b.name === "最短距离")?.value
  React.useEffect(() => {
    if (!viewer || !segment) return
    const group = new THREE.Group()
    const [a, b] = segment.map((p) => new THREE.Vector3(...p))
    if (a.distanceTo(b) > 1e-6) {
      const geo = new LineSegmentsGeometry()
      geo.setPositions([...segment[0], ...segment[1]])
      const mat = viewer.kit.dimension.clone()
      mat.color.copy(viewer.kit.edgeHighlight.color)
      mat.linewidth = 2
      mat.depthTest = false
      mat.resolution.copy(viewer.kit.dimension.resolution)
      const line = new LineSegments2(geo, mat)
      line.renderOrder = 6
      group.add(line)
    }
    for (const p of [a, b]) {
      const dot = document.createElement("div")
      dot.className = "size-2 rounded-full bg-primary ring-2 ring-background"
      const o = new CSS2DObject(dot)
      o.position.copy(p)
      group.add(o)
    }
    if (distance && a.distanceTo(b) > 1e-6) {
      // The renderer positions the outer box; the tag itself sits a little above the line.
      const box = document.createElement("div")
      const tag = document.createElement("div")
      tag.className = "-translate-y-4 rounded-sm bg-primary px-1.5 py-0.5 font-mono text-caption whitespace-nowrap text-primary-foreground tabular"
      tag.textContent = distance
      box.append(tag)
      const o = new CSS2DObject(box)
      o.position.copy(a).add(b).multiplyScalar(0.5)
      group.add(o)
    }
    viewer.scene.add(group)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(group)
      group.traverse((o) => ((o as LineSegments2).material as THREE.Material | undefined)?.dispose?.())
      disposeObject(group)
      viewer.invalidate()
    }
  }, [viewer, segment, distance])

  // Section: clip the model, paint the cut flat.
  const plane = React.useMemo(() => (section ? sectionPlane(section) : null), [section])
  React.useEffect(() => {
    if (!viewer) return
    viewer.kit.setSection(plane)
    viewer.invalidate()
    return () => {
      viewer.kit.setSection(null)
      viewer.invalidate()
    }
  }, [viewer, plane, display])

  // Esc leaves measure mode.
  React.useEffect(() => {
    if (!measuring) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("input, textarea, [role=dialog]")) stopMeasuring()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [measuring, stopMeasuring])

  // Numbered pins: annotations in the composer and of the message being answered, the draft, a located one.
  const pins = React.useMemo(() => {
    const out: (Pin & { tone: "solid" | "draft" | "ghost" })[] = annotations.pins.map((p) => ({ ...p, tone: "solid" }))
    if (draft) out.push({ n: annotations.pending.length + 1, point: draft.point, tone: "draft" })
    if (focus?.pin) out.push({ ...focus.pin, tone: "ghost" })
    return out
  }, [annotations.pins, annotations.pending.length, draft, focus])

  React.useEffect(() => {
    if (!viewer) return
    const group = new THREE.Group()
    for (const p of pins) {
      const el = document.createElement("div")
      el.className =
        p.tone === "ghost"
          ? "grid size-6 place-items-center rounded-full border-2 border-primary bg-background text-caption font-semibold text-primary shadow-popover"
          : "grid size-6 place-items-center rounded-full border-2 border-background bg-primary text-caption font-semibold text-primary-foreground shadow-popover"
      if (p.tone === "draft") el.classList.add("opacity-80")
      el.textContent = String(p.n)
      const o = new CSS2DObject(el)
      o.position.set(...p.point)
      group.add(o)
    }
    viewer.scene.add(group)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(group)
      disposeObject(group)
      viewer.invalidate()
    }
  }, [viewer, pins])

  // The screenshot sent with annotations is taken from where the learner is looking.
  React.useEffect(() => {
    if (!viewer) return
    return viewer.onCameraChange(() => {
      annotations.viewDir.current.copy(viewer.camera.position).sub(viewer.controls.target).normalize()
    })
  }, [viewer, annotations.viewDir])

  // ---------------------------------------------------------------- clicking

  const latest = React.useRef({ studio, busy, display, open: annotations.open, cancel: annotations.cancel, measuring, plane })
  React.useEffect(() => {
    latest.current = { studio, busy, display, open: annotations.open, cancel: annotations.cancel, measuring, plane }
  }, [studio, busy, display, annotations.open, annotations.cancel, measuring, plane])

  React.useEffect(() => {
    if (!viewer) return
    const canvas = viewer.renderer.domElement
    const press: { at: { x: number; y: number } | null } = { at: null }
    const onDown = (e: PointerEvent) => {
      press.at = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const at = press.at
      press.at = null
      if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) <= CLICK_PX) void onClick(e)
    }
    const onClick = async (e: PointerEvent) => {
      const { studio: s, busy: isBusy, display: d, open, cancel, measuring: isMeasuring, plane: cut } = latest.current
      const mesh = current.current?.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
      if (!d?.mesh || !mesh || s.kernel.phase !== "ready") return
      const { edge, face } = pickTargets(viewer, d, mesh, e, cut)
      if (isMeasuring) {
        if (s.rollback) return notify("先回到最新一步，再测量")
        if (!edge && !face) return setPicked([])
        // Same rule as annotating: a fillet's tangent line means the face under the pointer.
        const info = edge ? await s.pick("edge", edge.hash, edge.point) : null
        const t: MeasureTarget = edge && info && !info.smooth ? { kind: "edge", ...edge } : face ? { kind: "face", ...face } : { kind: "edge", ...edge! }
        setPicked((p) => (p.some((x) => x.kind === t.kind && x.hash === t.hash) ? p.filter((x) => x.hash !== t.hash) : p.length >= 2 ? [t] : [...p, t]))
        return
      }
      if (!edge && !face) return cancel()
      if (isBusy) return notify("助教正在改模型，这一轮结束后再标注")
      if (s.rollback) return notify("先回到最新一步，再在模型上标注")
      let info = edge ? await s.pick("edge", edge.hash, edge.point) : null
      // A fillet's tangent line looks like an edge but has no corner: the face under the pointer is what's meant.
      if ((!info || info.smooth) && face) info = (await s.pick("face", face.hash, face.point)) ?? info
      if (info) open(info)
    }
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointerup", onUp)
    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointerup", onUp)
    }
  }, [viewer])

  return (
    <Viewport className="absolute inset-0" onReady={onReady}>
      {kernel.phase === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-md border bg-background px-4 py-3 text-body">
            <Spinner className="size-4" />
            正在加载建模内核（OpenCascade）… {kernel.loadedMB > 0 ? `${kernel.loadedMB.toFixed(1)} MB` : ""}
          </div>
        </div>
      )}
      {kernel.phase === "error" && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div role="alert" className="max-w-sm rounded-md border border-destructive/40 bg-background p-4 text-body">
            建模内核没能启动：{kernel.message}
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => location.reload()}>
                重新加载
              </Button>
            </div>
          </div>
        </div>
      )}
      {measuring && <MeasurePanel result={result} count={picked.length} onClose={stopMeasuring} />}
      {display?.mesh && kernel.phase === "ready" && (
        <ViewTools
          measuring={measuring}
          onMeasuring={(on) => {
            if (on) annotations.cancel()
            setMeasuring(on)
            setPicked([])
          }}
          section={section}
          onSection={setSection}
          bbox={display.bbox}
          dims={{ on: showDims, shown: Math.min(DIMS_SHOWN, shownDims.total), total: shownDims.total }}
          onDims={setShowDims}
        />
      )}
      {display?.mesh && !busy && !draft && !measuring && annotations.pending.length === 0 && (
        <div className="pointer-events-none absolute top-3 left-1/2 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border bg-background/90 px-2.5 py-1 text-center text-caption text-muted-foreground">
          单击模型上的面或边，标注要改的地方
        </div>
      )}
      {display?.mesh && !measuring && (
        <div className="pointer-events-none absolute right-3 bottom-3 flex gap-3 rounded-md border bg-background/90 px-3 py-1.5 text-caption text-muted-foreground">
          {focus ? (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-primary" /> 标注选中的{focus.kind === "face" ? "面" : "边"}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-primary" /> {hover?.ids.length ? hover.label : "这一步新生成"}
              </span>
              {!hover?.ids.length && (
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-xs bg-scene-modified" /> 被修改
                </span>
              )}
            </>
          )}
        </div>
      )}
      {editingDim && !busy && (
        <DimEditor key={editingDim.dim.id} dim={studio.dims.find((d) => d.id === editingDim.dim.id) ?? editingDim.dim} anchor={editingDim.el} studio={studio} onClose={() => setEditingDim(null)} />
      )}
      {viewer && draft && (
        <AnnotationCard
          key={`${draft.kind}-${draft.hash}-${draft.point.join(",")}`}
          viewer={viewer}
          draft={draft}
          n={annotations.pending.length + 1}
          onAdd={annotations.add}
          onCancel={annotations.cancel}
        />
      )}
    </Viewport>
  )
}

/** At most this many dimensions with 「显示尺寸」 on, parameters first. */
const DIMS_SHOWN = 12

/**
 * The hover from a panel row, held a moment after the pointer leaves it, and
 * for as long as it rests on a dimension label: so the learner can travel from
 * the row to the label and click it.
 */
function useHeldHover(hover: Hover | null) {
  const [last, setLast] = React.useState<Hover | null>(hover)
  const [expired, setExpired] = React.useState(false)
  const [onLabel, setOnLabel] = React.useState(false)
  if (hover && (hover !== last || expired)) {
    setLast(hover)
    setExpired(false)
  }
  React.useEffect(() => {
    if (hover || onLabel) return
    const t = window.setTimeout(() => setExpired(true), 1200)
    return () => window.clearTimeout(t)
  }, [hover, onLabel])
  return { hover: hover ?? (expired ? null : last), setLabelPointed: setOnLabel }
}

type Target = { hash: number; point: V3 }

/**
 * The face under the pointer, and an edge within a few pixels of it that isn't hidden behind that face.
 * With a section on, what the plane cut away can't be picked, nor the back faces seen through the cut.
 */
function pickTargets(viewer: Viewer, d: DisplayData, mesh: THREE.Mesh, e: PointerEvent, cut: THREE.Plane | null = null): { edge: Target | null; face: Target | null } {
  const kept = (p: THREE.Vector3) => !cut || cut.distanceToPoint(p) >= -1e-6
  const hit = viewer.pick(e, [mesh], false, (h, ray) => kept(h.point) && (!cut || !h.face || h.face.normal.dot(ray.direction) < 0))
  const edge = nearestEdge(viewer, d, e, e.pointerType === "touch" ? 14 : 8, hit?.distance, kept)
  const g = hit && groupAt(hit)
  return { edge, face: hit && g ? { hash: g.hash, point: hit.point.toArray() as V3 } : null }
}

function nearestEdge(viewer: Viewer, d: DisplayData, e: PointerEvent, maxPx: number, faceDistance?: number, kept: (p: THREE.Vector3) => boolean = () => true) {
  const pts = d.edges
  if (!pts) return null
  const rect = viewer.renderer.domElement.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const cam = viewer.camera.position
  // Edges on the far side sit deeper than the face under the pointer.
  const slack = faceDistance !== undefined ? Math.max(0.5, faceDistance * 0.02) : Infinity
  let best: { hash: number; point: V3; px: number } | null = null
  for (const g of d.edgeGroups) {
    for (let i = g.start; i + 1 < g.start + g.count; i += 2) {
      a.fromArray(pts, i * 3)
      b.fromArray(pts, (i + 1) * 3)
      const pa = viewer.project(a)
      const pb = viewer.project(b)
      if (pa.behind || pb.behind) continue
      const vx = pb.x - pa.x
      const vy = pb.y - pa.y
      const len2 = vx * vx + vy * vy
      const t = len2 > 0 ? Math.min(1, Math.max(0, ((mx - pa.x) * vx + (my - pa.y) * vy) / len2)) : 0
      const px = Math.hypot(pa.x + t * vx - mx, pa.y + t * vy - my)
      if (px > maxPx || (best && px >= best.px)) continue
      const p = a.clone().lerp(b, t)
      if (!kept(p)) continue
      if (faceDistance !== undefined && p.distanceTo(cam) > faceDistance + slack) continue
      best = { hash: g.hash, point: p.toArray() as V3, px }
    }
  }
  return best && { hash: best.hash, point: best.point }
}

/** The note card next to a fresh pick. Hidden while the camera moves, then placed again. */
function AnnotationCard({ viewer, draft, n, onAdd, onCancel }: { viewer: Viewer; draft: PickInfo; n: number; onAdd: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = React.useState("")
  const [moving, setMoving] = React.useState(false)
  const [place, setPlace] = React.useState(0)
  const anchor = React.useRef({ getBoundingClientRect: () => new DOMRect() })

  // Re-anchor to the pick whenever the view settles (and for a new pick).
  React.useLayoutEffect(() => {
    const p = viewer.project(new THREE.Vector3(...draft.point))
    const r = viewer.renderer.domElement.getBoundingClientRect()
    anchor.current = { getBoundingClientRect: () => new DOMRect(r.left + p.x, r.top + p.y, 0, 0) }
  }, [viewer, draft, place])

  React.useEffect(() => {
    const start = () => setMoving(true)
    const end = () => {
      setMoving(false)
      setPlace((k) => k + 1)
    }
    viewer.controls.addEventListener("start", start)
    viewer.controls.addEventListener("end", end)
    return () => {
      viewer.controls.removeEventListener("start", start)
      viewer.controls.removeEventListener("end", end)
    }
  }, [viewer])

  const add = () => onAdd(note)
  // Beside the pin on wide screens; below it on a phone, where there's no room to the side.
  const [narrow] = React.useState(() => window.matchMedia("(max-width: 640px)").matches)
  return (
    <Popover open={!moving} onOpenChange={(open) => !open && onCancel()}>
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        key={`${draft.hash}-${place}`}
        side={narrow ? "bottom" : "right"}
        align={narrow ? "center" : "start"}
        sideOffset={16}
        className="w-80 max-w-[calc(100vw-1rem)]"
        aria-label={`标注 ${circled(n)}`}
        // Clicks on the model pick something else or drag the camera; they don't dismiss the card.
        onInteractOutside={(e) => {
          if (viewer.renderer.domElement.contains(e.target as Node)) e.preventDefault()
        }}
      >
        <div className="text-body font-medium">
          {circled(n)} {draft.kind === "face" ? "面" : "边"} · {draft.what}
        </div>
        <div className="mt-0.5 text-small text-muted-foreground">
          {draft.where} · {draft.facts}
        </div>
        <Textarea
          className="mt-3 resize-none"
          rows={3}
          value={note}
          placeholder={draft.kind === "face" ? "这里想怎么改？例如：开一个 ⌀8 的通孔" : "这条边想怎么改？例如：倒 R3 圆角"}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add()
            }
          }}
          aria-label="标注备注"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" variant="primary" onClick={add}>
            加到消息
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
