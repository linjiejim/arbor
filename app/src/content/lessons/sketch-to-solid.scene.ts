import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { datumPlane, edges, face, label, line, linearDim, tag } from "@/three/build"
import { draftedPrism } from "@/three/geom"
import { disposeObject, type Viewer } from "@/three/viewer"

/**
 * Lesson 1.1 「从草图到实体」: plane → sketch → constraints → dimensions →
 * extrude → options → change a parameter. The controller owns the 3D scene;
 * the React page owns the words and calls the actions below.
 *
 * Entering any step first brings the model to that step's starting point,
 * so learners can jump around without breaking the scene.
 */
export type PlaneId = "XY" | "XZ" | "YZ"

export type LessonState = {
  step: number
  plane: PlaneId | null
  wrongPlane: PlaneId | null
  rect: { x0: number; y0: number; x1: number; y1: number }
  drawn: boolean
  dragged: boolean
  symmetric: boolean
  dimW: boolean
  dimH: boolean
  dof: number
  /** A drag was refused because the sketch is fully defined. */
  locked: boolean
  extruded: boolean
  depth: number
  mode: "one" | "symmetric"
  draft: number
  triedSymmetric: boolean
  triedDraft: boolean
  widthChanged: boolean
  /** Step 1 task: orbit away from the sketch plane, then come back with the view cube. */
  orbited: boolean
  backToTop: boolean
}

const OVERVIEW = new THREE.Vector3(215, -250, 185)

export const PLANE_NAMES: Record<PlaneId, string> = { XY: "上视基准面", XZ: "前视基准面", YZ: "右视基准面" }

const initial = (): LessonState => ({
  step: 0,
  plane: null,
  wrongPlane: null,
  rect: { x0: -22, y0: -16, x1: 26, y1: 18 },
  drawn: false,
  dragged: false,
  symmetric: false,
  dimW: false,
  dimH: false,
  dof: 4,
  locked: false,
  extruded: false,
  depth: 0,
  mode: "one",
  draft: 0,
  triedSymmetric: false,
  triedDraft: false,
  widthChanged: false,
  orbited: false,
  backToTop: false,
})

export class SketchToSolid {
  state: LessonState = initial()
  private v: Viewer
  private emit: (s: LessonState) => void
  private planes = new Map<PlaneId, THREE.Group>()
  private hover: PlaneId | null = null
  private sketch = new THREE.Group()
  private body = new THREE.Group()
  private handle = new THREE.Group()
  private origin = new THREE.Group()
  private originLabel: THREE.Object3D | null = null
  /** Kept across renders: re-creating it mid-drag would drop the pointer capture. */
  private corner: CSS2DObject
  private draw = 1
  private unsub: (() => void)[] = []
  private dragging: "extrude" | null = null
  private flash = 0
  private trackView = false

  constructor(viewer: Viewer, emit: (s: LessonState) => void) {
    this.v = viewer
    this.emit = emit
    viewer.setGrid(120, 10)
    for (const id of ["XY", "XZ", "YZ"] as PlaneId[]) {
      const corner: [number, number] = id === "XY" ? [1, -1] : id === "XZ" ? [-1, 1] : [1, 1]
      const p = datumPlane(viewer.kit, id, 90, `${PLANE_NAMES[id]} ${id}`, corner)
      this.planes.set(id, p)
      viewer.helpers.add(p)
    }
    this.buildOrigin()
    this.corner = this.cornerHandle()
    viewer.content.add(this.sketch, this.body, this.handle, this.corner)
    viewer.camera.position.copy(OVERVIEW)
    viewer.controls.target.set(0, 0, 0)
    viewer.camera.lookAt(0, 0, 0)

    const el = viewer.renderer.domElement
    const move = (e: PointerEvent) => this.onMove(e)
    const down = (e: PointerEvent) => this.onDown(e)
    const up = () => this.onUp()
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerdown", down, { capture: true })
    window.addEventListener("pointerup", up)
    this.unsub.push(
      () => el.removeEventListener("pointermove", move),
      () => el.removeEventListener("pointerdown", down, { capture: true }),
      () => window.removeEventListener("pointerup", up),
      viewer.onTheme(() => this.render()),
      viewer.onCameraChange(() => this.checkView()),
      viewer.onFrame((dt) => {
        if (this.flash > 0) {
          this.flash = Math.max(0, this.flash - dt)
          this.paintBody()
          return true
        }
      }),
    )
    this.enter(0)
  }

  dispose() {
    for (const u of this.unsub) u()
    for (const p of this.planes.values()) {
      this.v.helpers.remove(p)
      disposeObject(p)
    }
    this.v.helpers.remove(this.origin)
    disposeObject(this.origin)
  }

  private set(patch: Partial<LessonState>) {
    this.state = { ...this.state, ...patch }
    const s = this.state
    this.state.dof = 4 - (s.symmetric ? 2 : 0) - (s.dimW ? 1 : 0) - (s.dimH ? 1 : 0)
    this.emit(this.state)
  }

  // ------------------------------------------------------------ steps

  enter(step: number) {
    const s = this.state
    const patch: Partial<LessonState> = { step, wrongPlane: null, locked: false }
    // Bring the model to this step's starting point.
    if (step >= 1 && !s.plane) patch.plane = "XY"
    if (step >= 3 && !s.drawn) patch.drawn = true
    if (step >= 4 && !s.symmetric) Object.assign(patch, { symmetric: true, rect: centred(s.rect) })
    if (step >= 5 && !(s.dimW && s.dimH)) Object.assign(patch, { dimW: true, dimH: true, rect: { x0: -30, y0: -20, x1: 30, y1: 20 } })
    if (step >= 6 && !s.extruded) Object.assign(patch, { extruded: true, depth: 20 })
    this.set(patch)

    const v = this.v
    if (step === 0) v.flyTo(OVERVIEW.clone(), new THREE.Vector3(0, 0, 0), 700)
    this.trackView = false
    if (step >= 1 && step <= 4) {
      const fly = v.setView("top", { target: new THREE.Vector3(0, 0, 0), distance: 230 })
      if (step === 1) fly.then(() => (this.trackView = this.state.step === 1))
    }
    if (step >= 5) v.flyTo(new THREE.Vector3(120, -150, 110), new THREE.Vector3(0, 0, 8), 800)

    if (step === 2 && !this.state.drawn) {
      this.set({ drawn: true })
      this.draw = 0
      v.tweens.run(700, (k) => {
        this.draw = k
        this.render()
      }, { tag: "draw" })
    }
    if (step === 5 && !this.state.extruded) {
      // Show the handle at zero depth; the learner drags it.
      this.set({ depth: 0 })
    }
    this.render()
  }

  // ------------------------------------------------------------ actions (called by the UI)

  pickPlane(id: PlaneId) {
    if (id === "XY") this.set({ plane: "XY", wrongPlane: null })
    else this.set({ wrongPlane: id })
    this.render()
  }

  addSymmetric() {
    if (this.state.symmetric) return
    const from = { ...this.state.rect }
    const to = centred(from)
    this.set({ symmetric: true })
    this.v.tweens.run(450, (k) => {
      this.state.rect = {
        x0: lerp(from.x0, to.x0, k),
        y0: lerp(from.y0, to.y0, k),
        x1: lerp(from.x1, to.x1, k),
        y1: lerp(from.y1, to.y1, k),
      }
      this.render()
    }, { tag: "rect" }).then(() => this.set({ rect: to }))
  }

  addDim(which: "w" | "h") {
    if (which === "w" && !this.state.dimW) {
      this.set({ dimW: true })
      this.setSize("w", 60)
    }
    if (which === "h" && !this.state.dimH) {
      this.set({ dimH: true })
      this.setSize("h", 40)
    }
  }

  /** Change a sketch dimension: the parametric heart of the lesson. */
  setSize(which: "w" | "h", value: number) {
    const r = this.state.rect
    const v = clamp(Math.round(value), 10, 110)
    const cur = which === "w" ? r.x1 - r.x0 : r.y1 - r.y0
    const from = { ...r }
    const to = { ...r }
    if (which === "w") Object.assign(to, { x0: -v / 2, x1: v / 2 })
    else Object.assign(to, { y0: -v / 2, y1: v / 2 })
    if (this.state.step >= 7 && which === "w" && v !== cur) this.set({ widthChanged: true })
    this.v.tweens.run(350, (k) => {
      this.state.rect = { x0: lerp(from.x0, to.x0, k), y0: lerp(from.y0, to.y0, k), x1: lerp(from.x1, to.x1, k), y1: lerp(from.y1, to.y1, k) }
      this.render()
    }, { tag: "rect" }).then(() => {
      this.set({ rect: to })
      if (this.state.extruded) this.flash = 1.2
      this.render()
    })
  }

  setDepth(d: number, commit = true) {
    const depth = clamp(Math.round(d), 1, 80)
    this.set({ depth, extruded: commit || this.state.extruded })
    this.render()
  }

  setMode(mode: "one" | "symmetric") {
    this.set({ mode, triedSymmetric: this.state.triedSymmetric || mode === "symmetric" })
    this.render()
  }

  setDraft(draft: number) {
    this.set({ draft, triedDraft: this.state.triedDraft || draft > 0 })
    this.render()
  }

  private checkView() {
    if (!this.trackView || this.state.step !== 1) return
    const dir = this.v.camera.position.clone().sub(this.v.controls.target).normalize()
    const angle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(dir.z, -1, 1)))
    if (!this.state.orbited && angle > 25) this.set({ orbited: true })
    else if (this.state.orbited && !this.state.backToTop && angle < 3) this.set({ backToTop: true })
  }

  // ------------------------------------------------------------ pointer

  private onMove(e: PointerEvent) {
    if (this.dragging === "extrude") {
      const ray = this.v.ray(e)
      const o = new THREE.Vector3(0, 0, 0)
      const u = new THREE.Vector3(0, 0, 1)
      // Closest point on the Z axis to the pointer ray.
      const w0 = ray.origin.clone().sub(o)
      const a = ray.direction.dot(ray.direction)
      const b = ray.direction.dot(u)
      const c = u.dot(u)
      const d = ray.direction.dot(w0)
      const ee = u.dot(w0)
      const den = a * c - b * b
      if (Math.abs(den) < 1e-6) return
      const t = (a * ee - b * d) / den
      const depth = this.state.mode === "symmetric" ? t * 2 : t
      this.setDepth(depth, true)
      return
    }
    if (this.state.step !== 0) return
    const hit = this.v.pick(e, [...this.planes.values()].map((p) => p.children[0]), false)
    const id = (hit?.object.userData.plane as PlaneId | undefined) ?? null
    if (id !== this.hover) {
      this.hover = id
      this.v.renderer.domElement.style.cursor = id ? "pointer" : ""
      this.render()
    }
  }

  private onDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (this.state.step === 0) {
      const hit = this.v.pick(e, [...this.planes.values()].map((p) => p.children[0]), false)
      if (hit) this.pickPlane(hit.object.userData.plane as PlaneId)
      return
    }
    if (this.state.step === 5 || this.state.step === 6) {
      const hit = this.v.pick(e, [this.handle], true)
      if (hit) {
        this.dragging = "extrude"
        this.v.controls.enabled = false
        e.stopImmediatePropagation()
      }
    }
  }

  private onUp() {
    if (this.dragging) {
      this.dragging = null
      this.v.controls.enabled = true
    }
  }

  // ------------------------------------------------------------ rendering

  private buildOrigin() {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), this.v.kit.modelDark)
    this.originLabel = label("原点", new THREE.Vector3(0, 0, 0), "translate-x-6 border-transparent bg-transparent font-sans text-faint-foreground")
    this.origin.add(dot, this.originLabel)
    this.v.helpers.add(this.origin)
  }

  private render() {
    const s = this.state
    const kit = this.v.kit
    // Datum planes: all three on step 0, then only the sketch plane while sketching.
    for (const [id, p] of this.planes) {
      const fill = p.children[0] as THREE.Mesh
      const chosen = s.plane === id
      p.visible = s.step === 0 || (chosen && s.step <= 4)
      fill.material = (s.step === 0 && (this.hover === id || chosen)) || (chosen && s.step >= 1) ? kit.planeHover : kit.plane
    }

    // The origin's name competes with the 对称 tag and would show through solids.
    if (this.originLabel) this.originLabel.visible = s.step <= 2 || (s.step <= 4 && !s.symmetric)

    // Sketch: blue while under-defined, black once fully defined.
    clear(this.sketch)
    if (s.drawn && s.step >= 2) {
      const { x0, y0, x1, y1 } = s.rect
      const z = 0.05
      const loop = [
        new THREE.Vector3(x0, y0, z),
        new THREE.Vector3(x1, y0, z),
        new THREE.Vector3(x1, y1, z),
        new THREE.Vector3(x0, y1, z),
        new THREE.Vector3(x0, y0, z),
      ]
      const pts = this.draw < 1 ? partial(loop, this.draw) : loop
      const defined = s.dof === 0
      const mat = defined ? kit.sketchDefined : kit.sketch
      if (s.step <= 4 || !s.extruded) this.sketch.add(line(pts, mat))
      if (this.draw >= 1 && s.step <= 4) {
        if (s.symmetric) this.sketch.add(tag("对称", new THREE.Vector3(0, 0, z)))
        if (s.dimW) this.sketch.add(this.dim("w", new THREE.Vector3(x0, y1, z), new THREE.Vector3(x1, y1, z), new THREE.Vector3(0, 1, 0), 10, x1 - x0))
        if (s.dimH) this.sketch.add(this.dim("h", new THREE.Vector3(x1, y0, z), new THREE.Vector3(x1, y1, z), new THREE.Vector3(1, 0, 0), 10, y1 - y0))
      }
    }
    const showCorner = s.drawn && this.draw >= 1 && s.step >= 2 && s.step <= 4
    this.corner.visible = showCorner
    if (showCorner) {
      this.corner.position.set(s.rect.x1, s.rect.y1, 0.05)
      this.corner.element.className =
        s.dof === 0
          ? "interactive size-3 rounded-full border-2 border-foreground bg-background cursor-not-allowed"
          : "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
      this.corner.element.title = s.dof === 0 ? "已完全定义：拖不动" : "拖动这个点"
    }

    // Body.
    clear(this.body)
    clear(this.handle)
    if (s.step >= 5 && (s.extruded || s.depth > 0)) {
      const { x0, y0, x1, y1 } = s.rect
      const depth = Math.max(0.5, s.depth)
      const geo = draftedPrism(x1 - x0, y1 - y0, depth, s.step >= 6 ? s.draft : 0, s.step >= 6 ? s.mode : "one")
      const m = face(geo, kit, { feature: "extrude1", edges: false })
      m.add(edges(geo, kit, 20))
      this.body.add(m)
      this.paintBody()
    }
    if (s.step === 5 || s.step === 6) {
      const top = s.step >= 6 && s.mode === "symmetric" ? s.depth / 2 : Math.max(0, s.depth)
      this.handle.add(this.arrow(top))
      if (s.step === 5) {
        const l = label(`${s.depth} mm`, new THREE.Vector3(0, 0, top + 22), "border-primary text-small")
        this.handle.add(l)
      }
    }
    this.v.invalidate()
  }

  private paintBody() {
    const s = this.state
    const kit = this.v.kit
    const current = s.step === 5 || s.step === 6 || this.flash > 0
    for (const c of this.body.children) (c as THREE.Mesh).material = current ? kit.highlight : kit.model
    this.v.invalidate()
  }

  private arrow(z: number) {
    const g = new THREE.Group()
    const mat = this.v.kit.highlight
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 14, 12), mat)
    shaft.rotation.x = Math.PI / 2
    shaft.position.z = z + 7
    const head = new THREE.Mesh(new THREE.ConeGeometry(3, 7, 20), mat)
    head.rotation.x = Math.PI / 2
    head.position.z = z + 17
    // A fat invisible grab zone: the handle is small on screen.
    const grab = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 24, 8), new THREE.MeshBasicMaterial({ visible: false }))
    grab.rotation.x = Math.PI / 2
    grab.position.z = z + 11
    g.add(shaft, head, grab)
    return g
  }

  private cornerHandle() {
    const el = document.createElement("div")
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this.state.dof === 0) {
        this.set({ locked: true })
        el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: 240 })
        return
      }
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const onMove = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const x = Math.round(hit.x)
        const y = Math.round(hit.y)
        const s = this.state
        let r = { ...s.rect }
        if (s.symmetric) {
          const hw = s.dimW ? (r.x1 - r.x0) / 2 : clamp(Math.abs(x), 5, 55)
          const hh = s.dimH ? (r.y1 - r.y0) / 2 : clamp(Math.abs(y), 5, 55)
          r = { x0: -hw, x1: hw, y0: -hh, y1: hh }
        } else {
          r = { ...r, x1: Math.max(r.x0 + 8, Math.min(x, 60)), y1: Math.max(r.y0 + 8, Math.min(y, 60)) }
        }
        this.state.rect = r
        if (!s.dragged) this.set({ dragged: true })
        this.render()
      }
      const onUp = () => {
        el.removeEventListener("pointermove", onMove)
        el.removeEventListener("pointerup", onUp)
        this.v.controls.enabled = true
        this.set({ rect: { ...this.state.rect } })
      }
      el.addEventListener("pointermove", onMove)
      el.addEventListener("pointerup", onUp)
    })
    const o = new CSS2DObject(el)
    o.visible = false
    return o
  }

  /** A dimension whose value can be clicked and typed over. */
  private dim(which: "w" | "h", a: THREE.Vector3, b: THREE.Vector3, dir: THREE.Vector3, off: number, value: number) {
    const g = linearDim(this.v.kit, a, b, dir, off, `${Math.round(value)}`, { interactive: true })
    const lbl = g.userData.label as CSS2DObject
    const el = lbl.element
    el.title = "点击修改"
    el.addEventListener("pointerdown", (e) => e.stopPropagation())
    el.addEventListener("click", () => {
      const input = document.createElement("input")
      input.type = "number"
      input.value = String(Math.round(value))
      input.className = "w-14 bg-transparent font-mono text-caption tabular outline-none"
      el.replaceChildren(input)
      input.focus()
      input.select()
      let done = false
      const commit = (ok: boolean) => {
        if (done) return
        done = true
        const n = Number(input.value)
        if (ok && Number.isFinite(n) && n > 0) this.setSize(which, n)
        else this.render()
      }
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commit(true)
        if (e.key === "Escape") commit(false)
        e.stopPropagation()
      })
      input.addEventListener("blur", () => commit(true))
    })
    return g
  }
}

function centred(r: LessonState["rect"]) {
  const hw = Math.round((r.x1 - r.x0) / 2)
  const hh = Math.round((r.y1 - r.y0) / 2)
  return { x0: -hw, x1: hw, y0: -hh, y1: hh }
}

function clear(g: THREE.Group) {
  for (const c of [...g.children]) {
    g.remove(c)
    disposeObject(c)
  }
}

function partial(loop: THREE.Vector3[], k: number) {
  const lens = [0]
  for (let i = 1; i < loop.length; i++) lens.push(lens[i - 1] + loop[i].distanceTo(loop[i - 1]))
  const target = lens[lens.length - 1] * Math.max(0.001, k)
  const out = [loop[0]]
  for (let i = 1; i < loop.length; i++) {
    if (lens[i] <= target) out.push(loop[i])
    else {
      out.push(loop[i - 1].clone().lerp(loop[i], (target - lens[i - 1]) / (lens[i] - lens[i - 1])))
      break
    }
  }
  return out.length > 1 ? out : [loop[0], loop[0].clone().addScalar(0.01)]
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
