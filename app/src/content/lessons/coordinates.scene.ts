import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { datumPlane, faces, paint } from "@/three/build"
import { VIEW_DIRS, type Viewer } from "@/three/viewer"
import { lBlock } from "./coordinates.solid"
import { LessonScene } from "./scene"

/**
 * 0.1.1 · 0.1.2 「坐标系与视图」: three labelled axes at the origin and an
 * asymmetric L-block beside them. The learner finds +Z by the right-hand
 * rule, orbits / pans / zooms, uses the view cube to reach the right view and
 * to find the face with the hole, then flips between Z-up and Y-up.
 *
 * The viewer's world is always Z-up. "Y-up" turns the axis frame a quarter
 * turn about X while the part stays upright on screen: the same picture,
 * different names (上视 looks at XZ instead of XY).
 */
export type Up = "z" | "y"

export type CoordState = {
  step: number
  zFound: boolean
  wrongZ: boolean
  orbited: boolean
  panned: boolean
  zoomed: boolean
  backToIso: boolean
  atRight: boolean
  foundHole: boolean
  /** Direction (+X, −Y…) of the last face clicked that has no hole. */
  wrongFace: string | null
  up: Up
  triedY: boolean
  /** Looked straight down (上视) while in Y-up mode. */
  topInY: boolean
}

const AXIS_LEN = 62
/** The part sits beside the origin so the axes stay readable. */
const PART_AT = new THREE.Vector3(-52, 40, 0)
const FOCUS = new THREE.Vector3(-20, 20, 6)
const DIR_NAMES: [THREE.Vector3, string][] = [
  [new THREE.Vector3(1, 0, 0), "+X"],
  [new THREE.Vector3(-1, 0, 0), "−X"],
  [new THREE.Vector3(0, 1, 0), "+Y"],
  [new THREE.Vector3(0, -1, 0), "−Y"],
  [new THREE.Vector3(0, 0, 1), "+Z"],
  [new THREE.Vector3(0, 0, -1), "−Z"],
]

const initial = (): CoordState => ({
  step: 0,
  zFound: false,
  wrongZ: false,
  orbited: false,
  panned: false,
  zoomed: false,
  backToIso: false,
  atRight: false,
  foundHole: false,
  wrongFace: null,
  up: "z",
  triedY: false,
  topInY: false,
})

export class CoordinatesScene extends LessonScene<CoordState> {
  /** The model coordinate frame: arrows + labels. Rotated a quarter turn for Y-up. */
  private frame = new THREE.Group()
  private arrows: THREE.Group[] = []
  private axisMats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 }))
  private candidates = new THREE.Group()
  private part: THREE.Group
  private planes = new THREE.Group()
  private planesFor: Up | null = null
  private frameAngle = 0
  /** Camera tracking starts once the step's own camera move has finished. */
  private track: { dir: THREE.Vector3; target: THREE.Vector3; dist: number } | null = null
  private down: { x: number; y: number } | null = null

  constructor(v: Viewer, emit: (s: CoordState) => void) {
    super(v, emit, initial())
    v.setGrid(100, 10)
    this.buildFrame()
    this.buildCandidates()
    const { group } = lBlock(v.kit, { kind: "left-blind" })
    group.position.copy(PART_AT)
    this.part = group
    this.root.add(this.frame, this.candidates, this.part, this.planes)

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => {
      this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
      this.onClick(e)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => el.removeEventListener("pointerdown", onDown))
    this.own(() => el.removeEventListener("pointerup", onUp))
    this.own(v.onCameraChange(() => this.checkCamera()))
  }

  dispose() {
    super.dispose()
    for (const m of this.axisMats) m.dispose()
  }

  enter(step: number) {
    const patch: Partial<CoordState> = { step, wrongZ: false, wrongFace: null }
    if (step >= 1 && !this.state.zFound) patch.zFound = true
    if (step <= 3 && this.state.up !== "z") {
      patch.up = "z"
      this.frameAngle = 0
    }
    this.set(patch)
    this.track = null
    const fly = this.v.flyTo(FOCUS.clone().addScaledVector(VIEW_DIRS.iso, 360), FOCUS.clone(), 800)
    fly.then(() => {
      if (this.state.step !== step) return
      const v = this.v
      this.track = {
        dir: v.camera.position.clone().sub(v.controls.target).normalize(),
        target: v.controls.target.clone(),
        dist: v.camera.position.distanceTo(v.controls.target),
      }
    })
  }

  // ------------------------------------------------------------ actions

  pickZ(upwards: boolean) {
    if (this.state.zFound) return
    if (!upwards) {
      this.set({ wrongZ: true })
      return
    }
    this.set({ zFound: true, wrongZ: false })
    const z = this.arrows[2]
    this.v.tweens.run(700, (k) => {
      z.scale.setScalar(Math.max(0.001, k))
      this.v.invalidate()
    }, { tag: "z-grow" })
  }

  view(name: "right" | "top" | "iso") {
    this.v.setView(name)
  }

  setUp(up: Up) {
    if (up === this.state.up) return
    const from = this.frameAngle
    const to = up === "y" ? Math.PI / 2 : 0
    this.set({ up, triedY: this.state.triedY || up === "y" })
    this.v.tweens.run(1100, (k) => {
      this.frameAngle = from + (to - from) * k
      this.render()
    }, { tag: "frame" })
  }

  /** Screen-space directions of the model axes (for the corner triad). */
  screenAxes() {
    const m = this.v.camera.matrixWorldInverse
    return [0, 1, 2].map((i) => {
      const d = new THREE.Vector3().setComponent(i, 1).applyQuaternion(this.frame.quaternion).transformDirection(m)
      return { x: d.x, y: -d.y }
    })
  }

  onCamera(cb: () => void) {
    return this.v.onCameraChange(cb)
  }

  // ------------------------------------------------------------ input

  private onClick(e: PointerEvent) {
    if (this.state.step !== 3 || this.state.foundHole) return
    const hit = this.v.pick(e, faces(this.part))
    if (!hit) return
    const name = hit.object.name
    if (name === "left" || name === "hole" || name === "hole-bottom") {
      this.set({ foundHole: true, wrongFace: null })
      return
    }
    const n = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld) ?? new THREE.Vector3()
    const best = DIR_NAMES.reduce((a, b) => (b[0].dot(n) > a[0].dot(n) ? b : a))
    this.set({ wrongFace: best[1] })
  }

  private checkCamera() {
    const t = this.track
    if (!t) return
    const s = this.state
    const v = this.v
    const dir = v.camera.position.clone().sub(v.controls.target).normalize()
    const near = (d: THREE.Vector3, deg: number) => dir.dot(d) > Math.cos(THREE.MathUtils.degToRad(deg))
    const patch: Partial<CoordState> = {}
    if (s.step === 1) {
      if (!s.orbited && dir.angleTo(t.dir) > THREE.MathUtils.degToRad(25)) patch.orbited = true
      if (!s.panned && v.controls.target.distanceTo(t.target) > 12) patch.panned = true
      const dist = v.camera.position.distanceTo(v.controls.target)
      if (!s.zoomed && Math.abs(dist - t.dist) > t.dist * 0.2) patch.zoomed = true
      if ((s.orbited || patch.orbited) && !s.backToIso && near(VIEW_DIRS.iso, 2)) patch.backToIso = true
    }
    if (s.step === 2 && !s.atRight && near(VIEW_DIRS.right, 3)) patch.atRight = true
    if (s.step === 4 && s.up === "y" && !s.topInY && this.frameAngle > 1.5 && near(new THREE.Vector3(0, 0, 1), 3)) patch.topInY = true
    if (Object.keys(patch).length) this.set(patch)
  }

  // ------------------------------------------------------------ scene

  private buildFrame() {
    const names = ["X", "Y", "Z"]
    const cls = ["text-axis-x", "text-axis-y", "text-axis-z"]
    for (let i = 0; i < 3; i++) {
      const dir = new THREE.Vector3().setComponent(i, 1)
      const g = arrow(dir, AXIS_LEN, this.axisMats[i], 1, 3, 9)
      const el = document.createElement("div")
      el.textContent = names[i]
      el.className = `font-sans text-title font-semibold ${cls[i]}`
      const l = new CSS2DObject(el)
      l.position.copy(dir).multiplyScalar(AXIS_LEN + 8)
      g.add(l)
      this.arrows.push(g)
      this.frame.add(g)
    }
    const dot = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 14), this.v.kit.modelDark)
    this.frame.add(dot)
  }

  private buildCandidates() {
    for (const upwards of [true, false]) {
      const dir = new THREE.Vector3(0, 0, upwards ? 1 : -1)
      const g = arrow(dir, AXIS_LEN * 0.8, this.v.kit.ghost, 1, 3, 9)
      const el = document.createElement("button")
      el.type = "button"
      el.textContent = upwards ? "Z 朝这边？" : "还是这边？"
      el.className =
        "interactive cursor-pointer rounded-sm border border-primary bg-popover px-2 py-0.5 font-sans text-small text-primary transition-colors hover:bg-selected"
      el.addEventListener("pointerdown", (e) => e.stopPropagation())
      el.addEventListener("click", () => this.pickZ(upwards))
      const l = new CSS2DObject(el)
      l.position.copy(dir).multiplyScalar(AXIS_LEN * 0.8 + 10)
      g.add(l)
      this.candidates.add(g)
    }
  }

  protected render() {
    const s = this.state
    const t = this.v.tokens
    const kit = this.v.kit
    this.axisMats[0].color.copy(t.axisX)
    this.axisMats[1].color.copy(t.axisY)
    this.axisMats[2].color.copy(t.axisZ)

    // Step 0 hides +Z until the learner has found it.
    const z = this.arrows[2]
    z.visible = s.zFound
    if (s.zFound && s.step > 0) z.scale.setScalar(1)
    this.candidates.visible = s.step === 0 && !s.zFound

    this.frame.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.frameAngle)

    // The face with the hole lights up once found.
    const lit = s.foundHole && s.step === 3
    paint(this.part, kit, () => "rest")
    if (lit) for (const m of faces(this.part)) if (m.name === "left" || m.name === "hole" || m.name === "hole-bottom") m.material = kit.highlight

    // Datum planes (step 4): the same three squares, named after the current convention.
    const planeFor: Up | null = s.step === 4 && this.frameAngleSettled() ? s.up : null
    if (planeFor !== this.planesFor) {
      this.clear(this.planes)
      this.planesFor = planeFor
      if (planeFor) {
        const n = planeFor === "z" ? { top: "XY", front: "XZ" } : { top: "XZ", front: "XY" }
        const top = datumPlane(kit, "XY", 100, `上视基准面 ${n.top}`, [1, -1])
        ;(top.children[0] as THREE.Mesh).material = kit.planeHover
        const front = datumPlane(kit, "XZ", 100, `前视基准面 ${n.front}`, [-1, 1])
        const right = datumPlane(kit, "YZ", 100, "右视基准面 YZ", [1, 1])
        this.planes.add(top, front, right)
      }
    }
    this.v.invalidate()
  }

  private frameAngleSettled() {
    const target = this.state.up === "y" ? Math.PI / 2 : 0
    return Math.abs(this.frameAngle - target) < 1e-3
  }
}

/** An arrow from the origin along `dir`: shaft + cone. */
function arrow(dir: THREE.Vector3, length: number, mat: THREE.Material, shaftR: number, headR: number, headLen: number) {
  const g = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, length - headLen, 16), mat)
  shaft.position.y = (length - headLen) / 2
  const head = new THREE.Mesh(new THREE.ConeGeometry(headR, headLen, 24), mat)
  head.position.y = length - headLen / 2
  const inner = new THREE.Group()
  inner.add(shaft, head)
  inner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  g.add(inner)
  return g
}
