import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { datumPlane, face, label, line, linearDim, tag } from "@/three/build"
import { arc } from "@/three/geom"
import { VIEW_DIRS, type Viewer } from "@/three/viewer"
import { boxFaces } from "./coordinates.solid"
import { LessonScene } from "./scene"

/**
 * 0.1.3 「基准面」: the three default planes, then the three ways to make a
 * new one: offset (drag a handle), at an angle through an axis (drag or
 * slider), and mid-plane between two faces (click both). A sketch hangs on
 * the offset plane and rides along when the offset changes.
 */
export type PlaneId = "XY" | "XZ" | "YZ"
export type EndFace = "-x" | "+x"

export type DatumState = {
  step: number
  clicked: PlaneId[]
  lastClicked: PlaneId | null
  offset: number
  offsetDragged: boolean
  sketchMoved: boolean
  angle: number
  angleTouched: boolean
  picked: EndFace[]
  width: number
  widthChanged: boolean
}

export const PLANE_NAMES: Record<PlaneId, string> = { XY: "上视基准面", XZ: "前视基准面", YZ: "右视基准面" }

const OFFSET_START = 15
const PLANE = 80
const BLOCK_X0 = 20
const SKETCH_R = 14

const initial = (): DatumState => ({
  step: 0,
  clicked: [],
  lastClicked: null,
  offset: OFFSET_START,
  offsetDragged: false,
  sketchMoved: false,
  angle: 0,
  angleTouched: false,
  picked: [],
  width: 60,
  widthChanged: false,
})

export class DatumPlanesScene extends LessonScene<DatumState> {
  private defaults = new Map<PlaneId, THREE.Group>()
  private hover: PlaneId | EndFace | null = null
  private offsetGroup = new THREE.Group()
  private angleGroup = new THREE.Group()
  private block = new THREE.Group()
  private mid = new THREE.Group()
  private offsetHandle: CSS2DObject
  private angleHandle: CSS2DObject
  private down: { x: number; y: number } | null = null
  private originLabel: THREE.Object3D

  constructor(v: Viewer, emit: (s: DatumState) => void) {
    super(v, emit, initial())
    v.setGrid(100, 10)
    for (const id of ["XY", "XZ", "YZ"] as PlaneId[]) {
      const corner: [number, number] = id === "XY" ? [1, -1] : id === "XZ" ? [-1, 1] : [1, 1]
      const p = datumPlane(v.kit, id, 100, `${PLANE_NAMES[id]} ${id}`, corner)
      this.defaults.set(id, p)
      this.root.add(p)
    }
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), v.kit.modelDark)
    this.originLabel = label("原点", new THREE.Vector3(0, 0, 0), "translate-x-6 border-transparent bg-transparent font-sans text-faint-foreground")
    this.root.add(dot, this.originLabel)

    this.offsetHandle = this.handle("拖动，改变偏移距离", (e) => this.dragOffset(e))
    this.angleHandle = this.handle("拖动，改变角度", (e) => this.dragAngle(e))
    this.root.add(this.offsetGroup, this.angleGroup, this.block, this.mid, this.offsetHandle, this.angleHandle)

    const el = v.renderer.domElement
    const onMove = (e: PointerEvent) => this.onHover(e)
    const onDown = (e: PointerEvent) => {
      this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 4) this.onClick(e)
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => el.removeEventListener("pointermove", onMove))
    this.own(() => el.removeEventListener("pointerdown", onDown))
    this.own(() => el.removeEventListener("pointerup", onUp))
  }

  enter(step: number) {
    this.hover = null
    this.v.renderer.domElement.style.cursor = ""
    this.set({ step, lastClicked: null })
    const v = this.v
    const fly = (target: THREE.Vector3, dir: THREE.Vector3, dist: number) => v.flyTo(target.clone().addScaledVector(dir.clone().normalize(), dist), target, 800)
    if (step === 0) fly(new THREE.Vector3(0, 0, 8), VIEW_DIRS.iso, 340)
    if (step === 1 || step === 2) fly(new THREE.Vector3(0, 0, 26), new THREE.Vector3(0.8, -1, 0.55), 300)
    if (step === 3) fly(new THREE.Vector3(0, 26, 18), new THREE.Vector3(-1, -0.75, 0.55), 290)
    if (step === 4) fly(new THREE.Vector3(BLOCK_X0 + 30, 0, 14), VIEW_DIRS.iso, 300)
  }

  // ------------------------------------------------------------ actions

  setOffset(d: number, fromUser = true) {
    const offset = clamp(Math.round(d), 5, 80)
    const patch: Partial<DatumState> = { offset }
    if (fromUser && this.state.step === 1) patch.offsetDragged = true
    if (this.state.step >= 2 && offset !== this.state.offset) patch.sketchMoved = true
    this.set(patch)
  }

  /** Animate the offset (the predict reveal). */
  moveOffsetBy(dd: number) {
    const from = this.state.offset
    const to = clamp(from + dd, 5, 80)
    this.v.tweens.run(900, (k) => this.setOffset(from + (to - from) * k, false), { tag: "offset" })
  }

  setAngle(a: number) {
    this.set({ angle: clamp(Math.round(a), 0, 90), angleTouched: true })
  }

  setWidth(w: number) {
    const width = clamp(Math.round(w), 30, 90)
    this.set({ width, widthChanged: this.state.widthChanged || (this.state.picked.length === 2 && width !== this.state.width) })
  }

  // ------------------------------------------------------------ input

  private planeHit(e: PointerEvent): PlaneId | null {
    const hit = this.v.pick(e, [...this.defaults.values()].map((p) => p.children[0]), false)
    return (hit?.object.userData.plane as PlaneId | undefined) ?? null
  }

  private faceHit(e: PointerEvent): EndFace | null {
    const hit = this.v.pick(e, this.block.children)
    const n = hit?.object.name
    return n === "-x" || n === "+x" ? n : null
  }

  private onHover(e: PointerEvent) {
    if (e.buttons) return
    const s = this.state
    const h = s.step === 0 ? this.planeHit(e) : s.step === 4 ? this.faceHit(e) : null
    if (h !== this.hover) {
      this.hover = h
      this.v.renderer.domElement.style.cursor = h ? "pointer" : ""
      this.render()
    }
  }

  private onClick(e: PointerEvent) {
    const s = this.state
    if (s.step === 0) {
      const id = this.planeHit(e)
      if (id) this.set({ lastClicked: id, clicked: s.clicked.includes(id) ? s.clicked : [...s.clicked, id] })
    }
    if (s.step === 4) {
      const f = this.faceHit(e)
      if (!f || s.picked.includes(f)) return
      this.set({ picked: [...s.picked, f] })
      // Turn round so the other end face can be clicked, then face the new mid-plane.
      const c = new THREE.Vector3(BLOCK_X0 + s.width / 2, 0, 14)
      const dir = this.state.picked.length === 1 ? new THREE.Vector3(f === "+x" ? -1 : 1, -1.1, 0.85) : new THREE.Vector3(0.35, -1, 0.6)
      this.v.flyTo(c.clone().addScaledVector(dir.normalize(), 300), c, 900)
    }
  }

  private dragOffset(e: PointerEvent) {
    // Closest point on the vertical line through the handle to the pointer ray.
    const t = closestOnLine(this.v.ray(e), new THREE.Vector3(-PLANE / 2, -PLANE / 2, 0), new THREE.Vector3(0, 0, 1))
    // Snap to 5 mm while dragging; the slider gives exact values.
    if (t !== null) this.setOffset(Math.round(t / 5) * 5)
  }

  private dragAngle(e: PointerEvent) {
    const hit = this.v.rayOnPlane(e, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0))
    if (!hit) return
    this.setAngle(Math.round(THREE.MathUtils.radToDeg(Math.atan2(hit.z, Math.max(0.001, hit.y))) / 5) * 5)
  }

  private handle(title: string, onDrag: (e: PointerEvent) => void) {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = title
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const move = (ev: PointerEvent) => onDrag(ev)
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    const o = new CSS2DObject(el)
    o.visible = false
    return o
  }

  // ------------------------------------------------------------ scene

  protected render() {
    const s = this.state
    const kit = this.v.kit

    for (const [id, p] of this.defaults) {
      const fill = p.children[0] as THREE.Mesh
      const lit = s.step === 0 && (this.hover === id || s.lastClicked === id)
      // After the tour only 上视 stays: it is the reference for the offset and the angle.
      p.visible = s.step === 0 || id === "XY"
      fill.material = lit || (s.step >= 1 && s.step <= 2 && id === "XY") || (s.step === 3 && id === "XY") ? kit.planeHover : kit.plane
    }

    // 基准面1: offset from 上视, with its distance and (from step 2) a sketch on it.
    this.clear(this.offsetGroup)
    const showOffset = s.step === 1 || s.step === 2
    if (showOffset) {
      const z = s.offset
      const p = datumPlane(kit, "XY", PLANE, "基准面1", [1, 1])
      p.position.z = z
      ;(p.children[0] as THREE.Mesh).material = kit.planeHover
      this.offsetGroup.add(p)
      const a = new THREE.Vector3(PLANE / 2, -PLANE / 2, 0)
      this.offsetGroup.add(linearDim(kit, a, a.clone().setZ(z), new THREE.Vector3(1, 0, 0), 10, `${z} mm`))
      if (s.step === 2) {
        const pts = arc([0, 0], SKETCH_R, 0, Math.PI * 2, 64).map(([x, y]) => new THREE.Vector3(x, y, z + 0.05))
        this.offsetGroup.add(line(pts, kit.sketch))
        this.offsetGroup.add(line([new THREE.Vector3(-3, 0, z + 0.05), new THREE.Vector3(3, 0, z + 0.05)], kit.sketchThin))
        this.offsetGroup.add(line([new THREE.Vector3(0, -3, z + 0.05), new THREE.Vector3(0, 3, z + 0.05)], kit.sketchThin))
        this.offsetGroup.add(tag("草图1", new THREE.Vector3(SKETCH_R + 2, -SKETCH_R, z)))
      }
    }
    this.offsetHandle.visible = showOffset
    this.offsetHandle.position.set(-PLANE / 2, -PLANE / 2, s.offset)

    // 基准面2: through the X axis, at an angle to 上视.
    this.clear(this.angleGroup)
    const showAngle = s.step === 3
    const th = THREE.MathUtils.degToRad(s.angle)
    if (showAngle) {
      const pivot = new THREE.Group()
      const p = datumPlane(kit, "XY", PLANE, `基准面2 · ${s.angle}°`, [1, 1])
      p.position.y = PLANE / 2
      ;(p.children[0] as THREE.Mesh).material = kit.planeHover
      pivot.add(p)
      pivot.rotation.x = th
      this.angleGroup.add(pivot)
      this.angleGroup.add(line([new THREE.Vector3(-PLANE / 2 - 12, 0, 0), new THREE.Vector3(PLANE / 2 + 12, 0, 0)], kit.construction))
      this.angleGroup.add(label("参考轴：X 轴", new THREE.Vector3(PLANE / 2 + 14, 0, 0), "border-transparent bg-transparent font-sans text-faint-foreground"))
      if (s.angle > 0) {
        const r = 34
        const pts = arc([0, 0], r, 0, th, 32).map(([y, z]) => new THREE.Vector3(-PLANE / 2, y, z))
        this.angleGroup.add(line(pts, kit.dimension))
      }
      const mid = th / 2
      this.angleGroup.add(label(`${s.angle}°`, new THREE.Vector3(-PLANE / 2, Math.cos(mid) * 42, Math.sin(mid) * 42), "border-primary"))
    }
    this.angleHandle.visible = showAngle
    this.angleHandle.position.set(0, Math.cos(th) * PLANE, Math.sin(th) * PLANE)

    this.originLabel.visible = s.step !== 4

    // A block and its mid-plane.
    this.clear(this.block)
    this.clear(this.mid)
    if (s.step === 4) {
      const x1 = BLOCK_X0 + s.width
      const fs = boxFaces(BLOCK_X0, x1, -25, 25, 0, 30)
      for (const [name, geo] of Object.entries(fs)) {
        const end = name === "-x" || name === "+x"
        const picked = end && s.picked.includes(name as EndFace)
        const role = picked ? "highlight" : "model"
        const m = face(geo, kit, { name, role })
        if (end && !picked && this.hover === name) m.material = kit.highlight
        this.block.add(m)
      }
      if (s.picked.length === 2) {
        const xm = BLOCK_X0 + s.width / 2
        const p = datumPlane(kit, "YZ", 70, "基准面3 · 中面", [1, 1])
        p.position.set(xm, 0, 15)
        ;(p.children[0] as THREE.Mesh).material = kit.planeHover
        this.mid.add(p)
        const half = `${s.width / 2}`
        const y = -25
        this.mid.add(linearDim(kit, new THREE.Vector3(BLOCK_X0, y, 30), new THREE.Vector3(xm, y, 30), new THREE.Vector3(0, 0, 1), 10, half))
        this.mid.add(linearDim(kit, new THREE.Vector3(xm, y, 30), new THREE.Vector3(x1, y, 30), new THREE.Vector3(0, 0, 1), 10, half))
      }
    }
    this.v.invalidate()
  }
}

/** Parameter t along the line p0 + t·dir closest to the ray (null when parallel). */
function closestOnLine(ray: THREE.Ray, p0: THREE.Vector3, dir: THREE.Vector3) {
  const w0 = ray.origin.clone().sub(p0)
  const a = ray.direction.dot(ray.direction)
  const b = ray.direction.dot(dir)
  const c = dir.dot(dir)
  const d = ray.direction.dot(w0)
  const e = dir.dot(w0)
  const den = a * c - b * b
  if (Math.abs(den) < 1e-6) return null
  return (a * e - b * d) / den
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
