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
import { edgeHighlight, groupAt, faceTarget, partOffset, partVisible, modelObject, NO_PARTS_VIEW, repaint, type Hover, type Paint, type PartsView } from "../scene"
import type { Annotations } from "../use-annotations"
import type { Studio } from "../use-studio"
import type { Reselect } from "../use-reselect"
import { displayName } from "../dsl"
import { sectionPlane, type Section } from "../section"
import { declutter, dimensionLayer, dimParam } from "../dimension-layer"
import type { Dim } from "../kernel/dims"
import { DimEditor } from "./dim-editor"
import { MeasurePanel, ViewTools } from "./viewport-tools"
import { useWords } from "./host-words"

type V3 = [number, number, number]
/** A press that moves less than this is a click, not a camera drag. */
const CLICK_PX = 5

/** Wording and numbering for hosts other than the web studio (the desktop app's notes). */
export type ViewportCopy = {
  /** The hint over an unmarked model; null hides it. */
  hint?: string | null
  /** The note card's button. */
  add?: string
  /** Number on the next pin (default: after the pending ones). */
  next?: number
  /** Told when a click lands while `busy`. */
  busy?: string
}

/**
 * The studio's 3D view: the model, coloured by step status or by what's
 * highlighted; click a face or an edge to annotate it.
 */
export function StudioViewport({
  studio,
  hover,
  annotations,
  busy,
  reselect,
  parts = NO_PARTS_VIEW,
  onParts,
  readOnly = false,
  annotation = true,
  onAnnotation,
  onPointFeature,
  onSelectFeature,
  onPresented,
  selectedPart,
  onLocateStep,
  copy,
}: {
  studio: Studio
  hover: Hover | null
  annotations: Annotations
  busy: boolean
  /** 「在模型上重选」 (none on a shared link). */
  reselect?: Reselect
  /** A split body: explode amount and hidden parts. */
  parts?: PartsView
  onParts?: (v: PartsView) => void
  /** A shared link: measure and section, but no annotating (there is no chat to send it to). */
  annotation?: boolean
  onAnnotation?: (on: boolean) => void
  onPointFeature?: (id: string | null, part?: number) => void
  onSelectFeature?: (id: string | null, part?: number) => void
  onPresented?: (display: DisplayData) => void
  selectedPart?: number
  onLocateStep?: () => void
  readOnly?: boolean
  copy?: ViewportCopy
}) {
  const [viewer, setViewer] = React.useState<Viewer | null>(null)
  const current = React.useRef<THREE.Group | null>(null)
  const fittedSize = React.useRef(0)
  // While re-picking a feature's faces or edges, the view shows the body that feature starts from.
  const rs = reselect?.state ?? null
  const display = rs?.display ?? studio.display
  const { kernel } = studio
  const { focus, draft } = annotations
  const nextPin = copy?.next ?? annotations.pending.length + 1

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
    if (held.hover?.dim) {
      list = drawable.filter((d) => d.id === held.hover!.dim)
      accent = true
    } else if (held.hover?.param) {
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
    if (!viewer || !shownDims.list.length || rs) return
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
  }, [viewer, shownDims, scale, busy, editingDim, setLabelPointed, rs])

  const onReady = React.useCallback((v: Viewer) => {
    setViewer(v)
    return () => setViewer(null)
  }, [])

  const paint = React.useMemo<Paint>(() => {
    if (rs) return { status: false, faces: rs.kind === "face" ? rs.hashes : [] }
    if (measuring && picked.length) return { status: false, faces: picked.filter((t) => t.kind === "face").map((t) => t.hash) }
    if (focus) return { status: false, faces: focus.kind === "face" ? focus.hashes : [] }
    if (hover?.faces?.length || hover?.edges?.length) return { status: false, faces: hover.faces ?? [] }
    return { status: true, highlight: hover?.ids.length ? hover.ids : undefined }
  }, [focus, hover, measuring, picked, rs])
  const edgeHashes = React.useMemo(
    () => (rs ? (rs.kind === "edge" ? rs.hashes : []) : hover?.edges?.length ? hover.edges : measuring ? picked.filter((t) => t.kind === "edge").map((t) => t.hash) : focus?.kind === "edge" ? focus.hashes : []),
    [measuring, picked, focus, rs, hover],
  )
  const paintRef = React.useRef(paint)
  React.useEffect(() => {
    paintRef.current = paint
  }, [paint])

  const view = display?.parts && !rs ? parts : NO_PARTS_VIEW
  React.useEffect(() => {
    if (!viewer || !display) return
    const g = modelObject(display, viewer.kit, paintRef.current, view)
    viewer.setContent(g)
    current.current = g
    const stop = viewer.onRendered(() => { stop(); onPresented?.(display) })
    if (display.bbox) {
      const box = new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1]))
      const size = box.getSize(new THREE.Vector3()).length()
      // Re-frame on the first model and when it changes size a lot; otherwise keep the learner's camera.
      if (!fittedSize.current || size > fittedSize.current * 1.6 || size < fittedSize.current / 2.5) {
        void viewer.fit(box, { view: fittedSize.current ? undefined : "iso", animate: fittedSize.current > 0 })
        fittedSize.current = size
      }
    } else fittedSize.current = 0
    return stop
  }, [viewer, display, view, onPresented])

  // Frame the pulled-apart parts once the learner lets go of the explode slider.
  const frameExploded = React.useCallback(() => {
    if (!viewer || !display?.bbox || !display.parts) return
    const box = new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1]))
    for (const p of display.parts) box.expandByPoint(new THREE.Vector3(...p.center).addScaledVector(new THREE.Vector3(...p.explode), parts.explode))
    void viewer.fit(box, { animate: true })
  }, [viewer, display, parts.explode])

  React.useEffect(() => {
    if (!viewer || !current.current) return
    repaint(current.current, paint)
    viewer.invalidate()
  }, [viewer, paint])

  // Highlighted edges: thick lines over the model.
  React.useEffect(() => {
    if (!viewer || !display || !edgeHashes.length) return
    const lines = edgeHighlight(display, edgeHashes, viewer.kit, view)
    if (!lines) return
    viewer.scene.add(lines)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(lines)
      disposeObject(lines)
      ;((lines as THREE.Mesh).material as THREE.Material).dispose()
      viewer.invalidate()
    }
  }, [viewer, display, edgeHashes, view])

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

  // Esc leaves re-picking (the card's 取消 does the same).
  const cancelReselect = reselect?.cancel
  React.useEffect(() => {
    if (!rs) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("input, textarea")) cancelReselect?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [rs, cancelReselect])

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
    if (draft) out.push({ n: nextPin, point: draft.point, part: draft.part, tone: "draft" })
    if (focus?.pin) out.push({ ...focus.pin, tone: "ghost" })
    return out.flatMap((pin) => {
      const index = pin.part ? display?.parts?.findIndex((p) => p.name === pin.part) : undefined
      if (display && index !== undefined && index >= 0 && !partVisible(display, view, index)) return []
      const offset = display ? partOffset(display, view, index) : [0, 0, 0]
      return [{ ...pin, point: pin.point.map((v, k) => v + offset[k]) as V3 }]
    })
  }, [annotations.pins, nextPin, draft, focus, display, view])

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

  const words = useWords()
  const busyText = copy?.busy ?? `${words.helper}正在改模型，这一轮结束后再标注`
  const latest = React.useRef({ studio, busy, busyText, display, open: annotations.open, cancel: annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view })
  const pickRevision = React.useRef(0)
  React.useEffect(() => { pickRevision.current++ }, [annotation, measuring, display, view, busy])
  React.useEffect(() => {
    latest.current = { studio, busy, busyText, display, open: annotations.open, cancel: annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view }
  }, [studio, busy, busyText, display, annotations.open, annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view])

  React.useEffect(() => {
    if (!viewer) return
    const canvas = viewer.renderer.domElement
    const revisions = pickRevision
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
      const revision = ++pickRevision.current
      const { studio: s, busy: isBusy, busyText: whyBusy, display: d, open, cancel, measuring: isMeasuring, plane: cut, reselect: rsel } = latest.current
      if (!latest.current.annotation && !isMeasuring && !rsel?.state) {
        const meshes = current.current?.children.filter((c) => (c as THREE.Mesh).isMesh && !c.userData.reference) ?? []
        const hit = pickVisible(viewer, e, meshes, cut)
        const group = hit ? groupAt(hit) : null
        latest.current.onSelectFeature?.(group?.origin ?? null, group?.part)
        return
      }
      if (isBusy) return notify(whyBusy)
      if (isMeasuring && latest.current.view.explode > 0) return notify("测量使用装配位置：先把爆炸拖回 0。爆炸状态仍可选件和标注。")
      // The model's own mesh (not a see-through reference body, which can't be picked).
      const meshes = current.current?.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && !c.userData.reference) ?? []
      if (!d?.mesh || !meshes.length || s.kernel.phase !== "ready") return
      const { edge, face } = pickTargets(viewer, d, meshes, e, cut, latest.current.view)
      if (rsel?.state) return void rsel.toggle({ edge: edge?.hash ?? null, face: face?.hash ?? null })
      if (isMeasuring) {
        if (s.rollback) return notify("先回到最新一步，再测量")
        if (!edge && !face) return setPicked([])
        // Same rule as annotating: a fillet's tangent line means the face under the pointer.
        const info = edge ? await s.pick("edge", edge.hash, edge.point) : null
        if (revision !== pickRevision.current) return
        const t: MeasureTarget = edge && info && !info.smooth ? { kind: "edge", ...edge } : face ? { kind: "face", ...face } : { kind: "edge", ...edge! }
        setPicked((p) => (p.some((x) => x.kind === t.kind && x.hash === t.hash) ? p.filter((x) => x.hash !== t.hash) : p.length >= 2 ? [t] : [...p, t]))
        return
      }
      if (!edge && !face) return cancel()
      if (latest.current.readOnly) return
      if (s.rollback) return notify("先回到最新一步，再在模型上标注")
      let info = edge ? await s.pick("edge", edge.hash, edge.point) : null
      // A fillet's tangent line looks like an edge but has no corner: the face under the pointer is what's meant.
      if ((!info || info.smooth) && face) info = (await s.pick("face", face.hash, face.point)) ?? info
      if (revision !== pickRevision.current) return
      if (info) {
        const part = (info.kind === "face" ? d.groups : d.edgeGroups).find((g) => g.hash === info.hash)?.part
        open({ ...info, part: part === undefined ? undefined : d.parts?.[part]?.name })
      }
    }
    const hoverFrame = { current: 0 }
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(hoverFrame.current)
      hoverFrame.current = requestAnimationFrame(() => {
        if (e.buttons || !latest.current.onPointFeature || latest.current.annotation) return
        const meshes = current.current?.children.filter((c) => (c as THREE.Mesh).isMesh && !c.userData.reference) ?? []
        const hit = pickVisible(viewer, e, meshes, latest.current.plane)
        const group = hit ? groupAt(hit) : null
        latest.current.onPointFeature(group?.origin ?? null, group?.part)
      })
    }
    const onLeave = () => { cancelAnimationFrame(hoverFrame.current); latest.current.onPointFeature?.(null) }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointerup", onUp)
    return () => {
      revisions.current++
      cancelAnimationFrame(hoverFrame.current)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointerup", onUp)
    }
  }, [viewer])

  return (
    <Viewport className="absolute inset-0" onReady={onReady} triadBesideCube>
      {onParts && display?.parts && (selectedPart !== undefined && selectedPart >= 0 || view.focus) && (
        <div role="toolbar" aria-label="选中零件" className="absolute bottom-24 left-3 z-20 flex max-w-[calc(100%_-_1.5rem)] items-center gap-1 rounded-md border bg-background/95 p-1 shadow-popover">
          <span className="max-w-40 truncate px-2 text-caption" title={display.parts[selectedPart ?? -1]?.name ?? view.focus?.part}>{display.parts[selectedPart ?? -1]?.name ?? view.focus?.part}</span>
          <Button size="sm" variant={view.focus?.mode === "isolate" ? "secondary" : "ghost"} aria-pressed={view.focus?.mode === "isolate"} disabled={selectedPart === undefined || selectedPart < 0} onClick={() => onParts({ ...view, focus: view.focus?.mode === "isolate" ? undefined : { part: display.parts![selectedPart!].name, mode: "isolate" } })}>隔离零件</Button>
          <Button size="sm" variant={view.focus?.mode === "ghost" ? "secondary" : "ghost"} aria-pressed={view.focus?.mode === "ghost"} disabled={selectedPart === undefined || selectedPart < 0} onClick={() => onParts({ ...view, focus: view.focus?.mode === "ghost" ? undefined : { part: display.parts![selectedPart!].name, mode: "ghost" } })}>其余透明</Button>
          <Button size="sm" variant="ghost" disabled={!onLocateStep} onClick={onLocateStep}>定位步骤</Button>
          {view.focus && <Button size="sm" variant="ghost" onClick={() => onParts({ ...view, focus: undefined })}>恢复显示</Button>}
        </div>
      )}
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
      {display?.mesh && kernel.phase === "ready" && !rs && (
        <ViewTools
          annotation={annotation}
          onAnnotation={onAnnotation ? (on) => { onAnnotation(on); annotations.cancel(); onPointFeature?.(null) } : undefined}
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
          explode={display.parts && display.parts.length > 1 ? parts.explode : null}
          onExplode={(explode) => onParts?.({ ...parts, explode })}
          onExplodeEnd={frameExploded}
          tips={[
            ...(readOnly || copy?.hint === null ? [] : [`${copy?.hint ?? "单击模型上的面或边，标注要改的地方"}。`]),
            "拖动右上角的方块转动视角；点它的面、棱或角，转到对应的视图。",
            "这一列工具可以测量、剖开看、标尺寸、把零件分开看。",
          ]}
        />
      )}
      {rs && (
        <div role="status" className="pointer-events-none absolute top-3 left-1/2 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border border-primary bg-background/95 px-2.5 py-1 text-center text-caption text-foreground">
          现在显示的是「{displayName(studio.tree, studio.tree.features[rs.index])}」之前的样子：
          {rs.kind === "edge" ? "点要选的边，再点一次取消；点一个面等于选它的一圈边" : "点要选的面，再点一次取消"}。Esc 退出
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
          offset={display ? partOffset(display, view, display.parts?.findIndex((p) => p.name === draft.part)) : [0, 0, 0]}
          n={nextPin}
          addLabel={copy?.add ?? "加到消息"}
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

/** Prefer solid geometry behind transparent context; context remains selectable in empty space. */
function pickVisible(viewer: Viewer, e: PointerEvent, meshes: THREE.Object3D[], cut: THREE.Plane | null) {
  const accept = (h: THREE.Intersection, ray: THREE.Ray) => (!cut || cut.distanceToPoint(h.point) >= -1e-6) && (!cut || !h.face || h.face.normal.dot(ray.direction) < 0)
  return viewer.pick(e, meshes.filter((m) => !m.userData.contextGhost), false, accept) ?? viewer.pick(e, meshes, false, accept)
}

/**
 * The face under the pointer, and an edge within a few pixels of it that isn't hidden behind that face.
 * With a section on, what the plane cut away can't be picked, nor the back faces seen through the cut.
 */
function pickTargets(viewer: Viewer, d: DisplayData, meshes: THREE.Mesh[], e: PointerEvent, cut: THREE.Plane | null = null, view: PartsView = NO_PARTS_VIEW): { edge: Target | null; face: Target | null } {
  const kept = (p: THREE.Vector3) => !cut || cut.distanceToPoint(p) >= -1e-6
  const hit = pickVisible(viewer, e, meshes, cut)
  const edge = nearestEdge(viewer, d, e, e.pointerType === "touch" ? 14 : 8, hit?.distance, kept, view, hit ? groupAt(hit)?.part : undefined)
  return { edge, face: hit ? faceTarget(hit) : null }
}

function nearestEdge(viewer: Viewer, d: DisplayData, e: PointerEvent, maxPx: number, faceDistance?: number, kept: (p: THREE.Vector3) => boolean = () => true, view: PartsView = NO_PARTS_VIEW, hitPart?: number) {
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
    if (g.part !== undefined && (!partVisible(d, view, g.part) || (hitPart !== undefined && g.part !== hitPart))) continue
    const offset = new THREE.Vector3(...partOffset(d, view, g.part))
    for (let i = g.start; i + 1 < g.start + g.count; i += 2) {
      a.fromArray(pts, i * 3).add(offset)
      b.fromArray(pts, (i + 1) * 3).add(offset)
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
      best = { hash: g.hash, point: p.sub(offset).toArray() as V3, px }
    }
  }
  return best && { hash: best.hash, point: best.point }
}

/** The note card next to a fresh pick. Hidden while the camera moves, then placed again. */
function AnnotationCard({
  viewer,
  offset,
  draft,
  n,
  addLabel,
  onAdd,
  onCancel,
}: {
  viewer: Viewer
  offset: V3
  draft: PickInfo
  n: number
  addLabel: string
  onAdd: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = React.useState("")
  const [moving, setMoving] = React.useState(false)
  const [place, setPlace] = React.useState(0)
  const anchor = React.useRef({ getBoundingClientRect: () => new DOMRect() })

  // Re-anchor to the pick whenever the view settles (and for a new pick).
  React.useLayoutEffect(() => {
    const p = viewer.project(new THREE.Vector3(...draft.point).add(new THREE.Vector3(...offset)))
    const r = viewer.renderer.domElement.getBoundingClientRect()
    anchor.current = { getBoundingClientRect: () => new DOMRect(r.left + p.x, r.top + p.y, 0, 0) }
  }, [viewer, draft, place, offset])

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
            {addLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
