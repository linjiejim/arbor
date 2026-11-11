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
import { edgeHighlight, regionStrokes, facesBox, groupAt, faceTarget, hasLooks, partOffset, partVisible, modelObject, NO_PARTS_VIEW, repaint, type Hover, type Paint, type PartsView } from "../scene"
import type { Annotations, FocusRegion } from "../use-annotations"
import type { Studio } from "../use-studio"
import type { Reselect } from "../use-reselect"
import { displayName } from "../dsl"
import { newSection, sectionPlane, type Section } from "../section"
import type { SketchHost } from "../region"
import type { PinNotes } from "../pin-notes"
import { PinNoteCard } from "./pin-card"
import { SketchLayer } from "./sketch-layer"
import { gatherRegion } from "../region-pick"
import { declutter, dimensionLayer, dimParam } from "../dimension-layer"
import type { Dim } from "../kernel/dims"
import { DimEditor } from "./dim-editor"
import { MeasurePanel, ViewTools } from "./viewport-tools"
import { VIEW_KEYS, type KeyRow, type ViewTool } from "../view-keys"
import { useWords } from "./host-words"

type V3 = [number, number, number]
/** A press that moves less than this is a click, not a camera drag. */
const CLICK_PX = 5

const LOOKS_STORE = "ft-studio-looks"
/** Colours or a white model: the person's own way of looking, kept across parts and launches (never in a file). */
function useLooksSwitch(): [boolean, (on: boolean) => void] {
  const [on, setOn] = React.useState(() => {
    try {
      return localStorage.getItem(LOOKS_STORE) !== "off"
    } catch {
      return true
    }
  })
  const set = React.useCallback((v: boolean) => {
    setOn(v)
    try {
      localStorage.setItem(LOOKS_STORE, v ? "on" : "off")
    } catch {
      /* private mode: this window only */
    }
  }, [])
  return [on, set]
}

/** Wording and numbering for hosts other than the web studio (the desktop app's notes). */
/** Where the camera was left in a file. */
export type ViewCamera = { position: THREE.Vector3; target: THREE.Vector3; size: number }

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
  selectedParts = [],
  onLocateStep,
  copy,
  selectionActions,
  onNoteSelection,
  onOpenPart,
  sketch,
  keys = [],
  active = true,
  viewKey,
  cameras: cameraMemory,
  pinNotes,
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
  onSelectFeature?: (id: string | null, part?: number, additive?: boolean) => void
  onPresented?: (display: DisplayData) => void
  selectedParts?: number[]
  onLocateStep?: () => void
  readOnly?: boolean
  copy?: ViewportCopy
  /** More buttons on the selected parts' toolbar, after their name (the desktop's 打开零件, 备注). */
  selectionActions?: React.ReactNode
  /** C with parts selected: a note about them, not a click on a face. */
  onNoteSelection?: () => void
  /** A part double-clicked (or ↵ with one selected): open its own file. */
  onOpenPart?: (part: number) => void
  /** Framing (R) and drawing (P) a note: how the host keeps it. Without it, neither tool is offered. */
  sketch?: SketchHost
  /** The host's keys, listed after the view's own in the 「快捷键」 card. */
  keys?: KeyRow[]
  /** Off while something covers the view (the drawing sheet): its keys do nothing. */
  active?: boolean
  /** Which file is shown: going back to one puts the camera where it was left. */
  viewKey?: string
  /** Where the camera was left in each file (`viewKey`), kept by the host: the view may be closed in between (a file loading). */
  cameras?: Map<string, ViewCamera>
  /** Notes already on the model: a click on a pin opens its card (none on the site). */
  pinNotes?: PinNotes
}) {
  const [viewer, setViewer] = React.useState<Viewer | null>(null)
  const current = React.useRef<THREE.Group | null>(null)
  const fittedSize = React.useRef(0)
  /** Where the camera was in each file shown before (`viewKey`), and which one is shown now (none yet: the first one may be gone back to). */
  const [ownCameras] = React.useState(() => new Map<string, ViewCamera>())
  const cameras = cameraMemory ?? ownCameras
  const shownKey = React.useRef<string | undefined>(undefined)
  // While re-picking a feature's faces or edges, the view shows the body that feature starts from.
  const rs = reselect?.state ?? null
  const display = rs?.display ?? studio.display
  const { kernel } = studio
  const { focus, draft } = annotations
  const nextPin = copy?.next ?? annotations.pending.length + 1

  // Measure mode: up to two picked faces / edges and what the kernel says about them.
  const [measuring, setMeasuring] = React.useState(false)
  /** Framing or drawing a note: one go, then back to the tool before. */
  const [sketching, setSketching] = React.useState<"box" | "pen" | null>(null)
  const [exploding, setExploding] = React.useState(false)
  const [keysOpen, setKeysOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<MeasureTarget[]>([])
  const [measured, setMeasured] = React.useState<{ key: string; result: MeasureResult | null } | null>(null)
  const [section, setSection] = React.useState<Section | null>(null)
  const [looks, setLooks] = useLooksSwitch()
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

  const [showChanges, setShowChanges] = React.useState(false)
  const tool: ViewTool = sketching ?? (measuring ? "measure" : onAnnotation && annotation ? "note" : "select")
  /** The tool before framing or drawing: one note, then back to it. */
  const sketchFrom = React.useRef<ViewTool>("select")
  const chooseTool = React.useCallback(
    (t: ViewTool) => {
      if ((t === "box" || t === "pen") && tool !== "box" && tool !== "pen") sketchFrom.current = tool
      if (t !== "measure") {
        setMeasuring(false)
        setPicked([])
      }
      if (t !== "box" && t !== "pen") setSketching(null)
      if (t === "select" || t === "measure" || t === "box" || t === "pen") {
        if (onAnnotation && annotation) onAnnotation(false)
        annotations.cancel()
        onPointFeature?.(null)
      }
      if (t === "note") onAnnotation?.(true)
      if (t === "measure") setMeasuring(true)
      if (t === "box" || t === "pen") setSketching(t)
    },
    [annotation, onAnnotation, annotations, onPointFeature, tool],
  )
  const paint = React.useMemo<Paint>(() => {
    if (rs) return { status: false, faces: rs.kind === "face" ? rs.hashes : [] }
    if (measuring && picked.length) return { status: false, faces: picked.filter((t) => t.kind === "face").map((t) => t.hash) }
    if (focus) return { status: false, faces: focus.kind === "face" ? focus.hashes : [] }
    return { status: showChanges, selected: selectedParts, hovered: hover?.faces ?? display?.groups.filter((g) => hover?.ids.includes(g.origin)).map((g) => g.hash) }
  }, [focus, hover, measuring, picked, rs, selectedParts, showChanges, display])
  // Selected parts are outlined as well as lit: a part already blue still shows it is the one selected.
  const selectedEdges = React.useMemo(
    () => (selectedParts.length && display ? display.edgeGroups.filter((g) => g.part !== undefined && selectedParts.includes(g.part)).map((g) => g.hash) : []),
    [selectedParts, display],
  )
  const edgeHashes = React.useMemo(
    () =>
      rs
        ? rs.kind === "edge"
          ? rs.hashes
          : []
        : hover?.edges?.length
          ? hover.edges
          : measuring
            ? picked.filter((t) => t.kind === "edge").map((t) => t.hash)
            : focus?.kind === "edge"
              ? focus.hashes
              : focus
                ? []
                : selectedEdges,
    [measuring, picked, focus, rs, hover, selectedEdges],
  )
  const paintRef = React.useRef(paint)
  React.useEffect(() => {
    paintRef.current = paint
  }, [paint])

  const view = React.useMemo(() => {
    if (!display?.parts || rs) return NO_PARTS_VIEW
    if (!parts.focus) return parts
    const names = parts.focus.parts.filter((name) => display.parts!.some((p) => p.name === name))
    return names.length === parts.focus.parts.length ? parts : { ...parts, focus: names.length ? { ...parts.focus, parts: names } : undefined }
  }, [display, rs, parts])
  React.useEffect(() => {
    if (!viewer || !display) return
    const g = modelObject(display, viewer.kit, paintRef.current, view, looks)
    viewer.setContent(g)
    current.current = g
    if (viewKey !== shownKey.current) {
      if (shownKey.current && fittedSize.current) cameras.set(shownKey.current, { position: viewer.camera.position.clone(), target: viewer.controls.target.clone(), size: fittedSize.current })
      shownKey.current = viewKey
      const back = viewKey ? cameras.get(viewKey) : undefined
      if (back) void viewer.flyTo(back.position, back.target, 0)
      fittedSize.current = back?.size ?? 0
    }
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
  }, [viewer, display, view, onPresented, looks, viewKey, cameras])
  // Closed (another file loading): where the camera is now is kept for coming back.
  React.useEffect(() => {
    if (!viewer) return
    return () => {
      if (shownKey.current && fittedSize.current) cameras.set(shownKey.current, { position: viewer.camera.position.clone(), target: viewer.controls.target.clone(), size: fittedSize.current })
    }
  }, [viewer, cameras])

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

  // The note card a pin opened (by its number).
  const [openPin, setOpenPin] = React.useState<number | null>(null)
  const openPinAt = openPin === null ? null : (pins.find((p) => p.n === openPin && p.tone === "solid") ?? null)
  const openNote = openPinAt && pinNotes ? pinNotes.get(openPinAt.n) : null
  if (openPin !== null && !openNote) setOpenPin(null)
  const pinNotesRef = React.useRef(pinNotes)
  React.useEffect(() => {
    pinNotesRef.current = pinNotes
  }, [pinNotes])
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
      // Saved notes' pins open their card; hovering shows the words.
      const note = p.tone === "solid" ? pinNotesRef.current?.get(p.n) : null
      if (note) {
        el.classList.add("interactive", "cursor-pointer")
        el.title = note.text || note.about
        el.setAttribute("role", "button")
        el.setAttribute("aria-label", `备注 ${p.n}：${note.text || note.about}`)
        el.addEventListener("pointerdown", (e) => e.stopPropagation())
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          setOpenPin(p.n)
        })
      }
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
  }, [viewer, pins, pinNotes])

  // Locating a note on an area: back to the view it was marked from, its strokes on the model, its box
  // over the view until the camera moves again.
  const focusRegion = focus?.region
  const [regionBox, setRegionBox] = React.useState<FocusRegion | null>(null)
  const [seenRegion, setSeenRegion] = React.useState(focusRegion)
  if (focusRegion !== seenRegion) {
    setSeenRegion(focusRegion)
    setRegionBox(focusRegion?.rect ? focusRegion : null)
  }
  React.useEffect(() => {
    if (!viewer || !focusRegion) return
    void viewer.flyTo(new THREE.Vector3(...focusRegion.camera.position), new THREE.Vector3(...focusRegion.camera.target))
    const lines = focusRegion.strokes ? regionStrokes(focusRegion.strokes, viewer.kit) : null
    if (lines) viewer.scene.add(lines)
    // Turning the view away puts the box out of place: it goes.
    let flying = true
    const t = window.setTimeout(() => (flying = false), 900)
    const moved = () => !flying && setRegionBox(null)
    viewer.controls.addEventListener("start", moved)
    viewer.invalidate()
    return () => {
      window.clearTimeout(t)
      viewer.controls.removeEventListener("start", moved)
      if (lines) {
        viewer.scene.remove(lines)
        disposeObject(lines)
      }
      viewer.invalidate()
    }
  }, [viewer, focusRegion])

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
  const latest = React.useRef({ studio, busy, busyText, display, open: annotations.open, cancel: annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view, onOpenPart, sketching })
  const pickRevision = React.useRef(0)
  React.useEffect(() => { pickRevision.current++ }, [annotation, measuring, display, view, busy])
  React.useEffect(() => {
    latest.current = { studio, busy, busyText, display, open: annotations.open, cancel: annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view, onOpenPart, sketching }
  }, [studio, busy, busyText, display, annotations.open, annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view, onOpenPart, sketching])

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
        latest.current.onSelectFeature?.(group?.origin ?? null, group?.part, e.shiftKey)
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
    // A double-click on a part (selecting, not noting or measuring) opens its own file.
    const onDouble = (e: MouseEvent) => {
      const l = latest.current
      if (!l.onOpenPart || l.annotation || l.measuring || l.sketching || l.reselect?.state) return
      const meshes = current.current?.children.filter((c) => (c as THREE.Mesh).isMesh && !c.userData.reference) ?? []
      const hit = pickVisible(viewer, e, meshes, l.plane)
      const part = hit ? groupAt(hit)?.part : undefined
      if (part !== undefined) l.onOpenPart(part)
    }
    canvas.addEventListener("dblclick", onDouble)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointerup", onUp)
    return () => {
      revisions.current++
      cancelAnimationFrame(hoverFrame.current)
      canvas.removeEventListener("dblclick", onDouble)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointerup", onUp)
    }
  }, [viewer])

  const selectionNames = selectedParts.flatMap((i) => display?.parts?.[i] ? [display.parts[i].name] : [])
  // H hides the selected parts, ⇧H brings every hidden one back (the eyes in the tree do one at a time).
  const hideSelected = () => {
    if (!onParts || !selectionNames.length) return
    onParts({ ...view, hidden: new Set([...view.hidden, ...selectedParts]) })
    onSelectFeature?.(null)
  }
  const showAll = () => onParts?.({ ...view, hidden: new Set() })
  const focusMatches = !!view.focus && selectionNames.length === view.focus.parts.length && selectionNames.every((n) => view.focus!.parts.includes(n))
  const isolateSelected = () => {
    if (!onParts) return
    if (view.focus && (focusMatches || !selectionNames.length)) return onParts({ ...view, focus: undefined })
    if (selectionNames.length) onParts({ ...view, focus: { parts: selectionNames, mode: "isolate" } })
  }
  /** F: the selected parts, or everything (pulled apart as shown). */
  const frame = () => {
    if (!viewer || !display?.bbox) return
    const box = selectedParts.length ? facesBox(display, view, (g) => g.part !== undefined && selectedParts.includes(g.part)) : null
    if (box) return void viewer.fit(new THREE.Box3(new THREE.Vector3(...box[0]), new THREE.Vector3(...box[1])), { animate: true })
    if (display.parts && parts.explode > 0) return frameExploded()
    void viewer.fit(new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1])), { animate: true })
  }

  // The view's one-letter keys (the card behind ? lists them). Not while typing, in a dialog or a menu,
  // with ⌘ / Ctrl / ⌥ held, or while the drawing sheet covers the view. By key position, so they work
  // with a Chinese input method on too. Esc goes back one level at a time: the open card or panel
  // handles its own, then the tool, then (the timeline's own handler) the selection and the step.
  const keyActions = { tool, chooseTool, sketch, onAnnotation, onNoteSelection, selectedParts, section, bbox: display?.bbox ?? null, showDims, dimsTotal: shownDims.total, explodable: Boolean(display?.parts && display.parts.length > 1), exploding, looks, hasLooks: hasLooks(display), canHide: Boolean(onParts && display?.parts), hideSelected, showAll, isolateSelected, frame, onOpenPart, busyCard: Boolean(draft || keysOpen || editingDim || openNote), stopMeasuring, onParts, parts }
  const keyRef = React.useRef(keyActions)
  React.useEffect(() => {
    keyRef.current = keyActions
  })
  React.useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.("input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=menu], [role=listbox]")) return
      const k = keyRef.current
      const handled = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
      if (e.key === "Escape") {
        if (k.busyCard) return
        if (k.tool === "box" || k.tool === "pen") return handled(), k.chooseTool("select")
        if (k.tool === "measure") return handled(), k.stopMeasuring()
        if (k.tool === "note") return handled(), k.chooseTool("select")
        return
      }
      if (e.repeat) return
      if (e.key === "?") return handled(), setKeysOpen(true)
      if (e.key === "Enter") {
        if (target?.closest?.("button, a, [role=button], [role=tab], [role=separator]")) return
        if (k.onOpenPart && k.selectedParts.length === 1) return handled(), k.onOpenPart(k.selectedParts[0])
        return
      }
      if (e.shiftKey && e.code !== "KeyH") return
      switch (e.code) {
        case "KeyV":
          if (k.onAnnotation) return handled(), k.chooseTool("select")
          return
        case "KeyC":
          if (k.onNoteSelection && k.selectedParts.length) return handled(), k.onNoteSelection()
          if (k.onAnnotation) return handled(), k.chooseTool(k.tool === "note" ? "select" : "note")
          return
        case "KeyR":
          if (k.sketch) return handled(), k.chooseTool("box")
          return
        case "KeyP":
          if (k.sketch) return handled(), k.chooseTool("pen")
          return
        case "KeyM":
          return handled(), k.chooseTool(k.tool === "measure" ? "select" : "measure")
        case "KeyX":
          if (k.bbox) return handled(), setSection(k.section ? null : newSection(k.bbox))
          return
        case "KeyD":
          if (k.dimsTotal) return handled(), setShowDims(!k.showDims)
          return
        case "KeyE":
          if (!k.explodable) return
          handled()
          if (k.exploding) k.onParts?.({ ...k.parts, explode: 0 })
          return setExploding(!k.exploding)
        case "KeyA":
          if (k.hasLooks) return handled(), setLooks(!k.looks)
          return
        case "KeyF":
          return handled(), k.frame()
        case "KeyH":
          if (!k.canHide) return
          handled()
          return e.shiftKey ? k.showAll() : k.hideSelected()
        case "KeyI":
          if (k.canHide) return handled(), k.isolateSelected()
          return
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [active, setLooks])
  return (
    <Viewport className="absolute inset-0" onReady={onReady} triadBesideCube>
      {onParts && display?.parts && (selectedParts.length > 0 || view.focus || view.hidden.size > 0) && (
        <div role="toolbar" aria-label="选中零件" className="absolute left-3 z-20 flex max-w-[calc(100%_-_1.5rem)] flex-wrap items-center gap-1 rounded-md border bg-background/95 p-1 shadow-popover" style={{ bottom: "calc(var(--timeline-h, 0px) + 1.25rem)" }}>
          <span className="max-w-40 truncate px-2 text-caption" title={selectionNames.join("、")}>
            {selectionNames.length > 1 ? `已选 ${selectionNames.length} 个零件` : selectionNames[0] ?? (view.focus ? `${view.focus.mode === "ghost" ? "保留实体" : "已隔离"} ${view.focus.parts.length} 个零件` : `已隐藏 ${view.hidden.size} 个零件`)}
          </span>
          {selectionNames.length > 0 && selectionActions}
          {selectionNames.length > 0 && selectionActions && <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />}
          <Button size="sm" variant="ghost" disabled={!selectionNames.length} title="H" onClick={hideSelected}>隐藏</Button>
          <Button size="sm" variant={focusMatches && view.focus?.mode === "isolate" ? "secondary" : "ghost"} aria-pressed={focusMatches && view.focus?.mode === "isolate"} disabled={!selectionNames.length} title="I" onClick={isolateSelected}>隔离</Button>
          <Button size="sm" variant={focusMatches && view.focus?.mode === "ghost" ? "secondary" : "ghost"} aria-pressed={focusMatches && view.focus?.mode === "ghost"} disabled={!selectionNames.length} onClick={() => onParts({ ...view, focus: focusMatches && view.focus?.mode === "ghost" ? undefined : { parts: selectionNames, mode: "ghost" } })}>其余透明</Button>
          <Button size="sm" variant="ghost" disabled={!onLocateStep} onClick={onLocateStep}>定位步骤</Button>
          {selectionNames.length > 0 && <Button size="sm" variant="ghost" onClick={() => onSelectFeature?.(null)}>清除选择</Button>}
          {view.focus && <Button size="sm" variant="ghost" onClick={() => onParts({ ...view, focus: undefined })}>恢复显示</Button>}
          {view.hidden.size > 0 && <Button size="sm" variant="ghost" title="⇧H" onClick={showAll}>显示隐藏的 {view.hidden.size} 个</Button>}
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
          tool={tool}
          onTool={chooseTool}
          notes={Boolean(onAnnotation)}
          sketch={Boolean(sketch) && !readOnly}
          section={section}
          onSection={setSection}
          bbox={display.bbox}
          dims={{ on: showDims, shown: Math.min(DIMS_SHOWN, shownDims.total), total: shownDims.total }}
          onDims={setShowDims}
          explode={display.parts && display.parts.length > 1 ? parts.explode : null}
          exploding={exploding}
          onExploding={(on) => {
            if (!on) onParts?.({ ...parts, explode: 0 })
            setExploding(on)
          }}
          onExplode={(explode) => onParts?.({ ...parts, explode })}
          onExplodeEnd={frameExploded}
          looks={{ on: looks, available: hasLooks(display) }}
          onLooks={setLooks}
          changes={showChanges}
          onChanges={setShowChanges}
          keysOpen={keysOpen}
          onKeysOpen={setKeysOpen}
          keys={[...VIEW_KEYS.filter((k) => (onAnnotation || !"VCRP".includes(k.keys)) && (sketch || !"RP".includes(k.keys)) && (onParts || !["H / ⇧H", "I"].includes(k.keys))), ...keys]}
          tips={[
            ...(readOnly || copy?.hint === null ? [] : [`${copy?.hint ?? "单击模型上的面或边，标注要改的地方"}。`]),
            "拖动转视角，滚轮缩放；拖右上角的方块也能转，点它的面、棱或角转到对应的视图。",
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
      {regionBox?.rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[5] rounded-sm border-2 border-primary bg-primary/5"
          style={{ left: `${regionBox.rect[0] * 100}%`, top: `${regionBox.rect[1] * 100}%`, width: `${(regionBox.rect[2] - regionBox.rect[0]) * 100}%`, height: `${(regionBox.rect[3] - regionBox.rect[1]) * 100}%` }}
        />
      )}
      {viewer && display && sketch && sketching && (
        <SketchLayer
          key={sketching}
          viewer={viewer}
          shape={sketching}
          gather={(marks) => {
            const meshes = current.current?.children.filter((c) => (c as THREE.Mesh).isMesh && !c.userData.reference) ?? []
            return gatherRegion(viewer, display, (at) => pickVisible(viewer, at, meshes, plane), marks)
          }}
          onSave={sketch.save}
          onClose={() => chooseTool(sketchFrom.current)}
        />
      )}
      {viewer && openPinAt && openNote && pinNotes && (
        <PinNoteCard
          key={openPinAt.n}
          viewer={viewer}
          point={openPinAt.point}
          note={openNote}
          onSave={(text) => pinNotes.save(openPinAt.n, text)}
          onResolve={() => {
            pinNotes.resolve(openPinAt.n)
            setOpenPin(null)
          }}
          onRemove={() => {
            pinNotes.remove(openPinAt.n)
            setOpenPin(null)
          }}
          onClose={() => setOpenPin(null)}
        />
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
function pickVisible(viewer: Viewer, e: { clientX: number; clientY: number }, meshes: THREE.Object3D[], cut: THREE.Plane | null) {
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
