import * as THREE from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { faces, label, line, paint } from "@/three/build"
import { VIEW_DIRS, type Viewer } from "@/three/viewer"
import { L, lBlock, type Cylinder } from "./coordinates.solid"
import { LessonScene } from "./scene"

/**
 * 0.2.1 · 0.2.2 「正投影」: the L-block inside a glass box. Its edges are
 * flattened onto three box faces (visible edges solid, hidden ones dashed,
 * found by casting rays towards the observer), then the box unfolds into
 * the flat three-view layout. First angle (GB) projects onto the far faces
 * — front view on the back wall, top view on the floor, left view on the
 * right wall — so the top view lands below and the left view to the right.
 * Third angle projects onto the near faces: top above, right view right.
 */
export type Angle = "first" | "third"
export type ViewKey = "front" | "top" | "side"

export type ProjState = {
  step: number
  angle: Angle
  projected: boolean
  unfold: number
  xray: boolean
  holeX: number
  holeMoved: boolean
  triedThird: boolean
  clicked: ViewKey | null
  foundTop: boolean
}

type Seg = [THREE.Vector3, THREE.Vector3]

type ViewDef = {
  key: ViewKey
  name: string
  /** Viewing direction: from the observer into the scene. */
  dir: THREE.Vector3
  /** The panel is the plane where coordinate `axis` equals `at`. */
  axis: 0 | 1 | 2
  at: number
  pivot: THREE.Vector3
  hingeAxis: THREE.Vector3
  hingeAngle: number
  corners: THREE.Vector3[]
}

// The glass box around the part (mm).
const BX = 46
const BY = 36
const Z0 = -16
const Z1 = 60
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const AX = v3(1, 0, 0)
const AZ = v3(0, 0, 1)

const front = (y: number) => [v3(-BX, y, Z0), v3(BX, y, Z0), v3(BX, y, Z1), v3(-BX, y, Z1)]
const floor = (z: number) => [v3(-BX, -BY, z), v3(BX, -BY, z), v3(BX, BY, z), v3(-BX, BY, z)]
const wall = (x: number) => [v3(x, -BY, Z0), v3(x, BY, Z0), v3(x, BY, Z1), v3(x, -BY, Z1)]

export const VIEWS: Record<Angle, ViewDef[]> = {
  first: [
    { key: "front", name: "主视图", dir: v3(0, 1, 0), axis: 1, at: BY, pivot: v3(0, 0, 0), hingeAxis: AX, hingeAngle: 0, corners: front(BY) },
    { key: "top", name: "俯视图", dir: v3(0, 0, -1), axis: 2, at: Z0, pivot: v3(0, BY, Z0), hingeAxis: AX, hingeAngle: Math.PI / 2, corners: floor(Z0) },
    { key: "side", name: "左视图", dir: v3(1, 0, 0), axis: 0, at: BX, pivot: v3(BX, BY, 0), hingeAxis: AZ, hingeAngle: Math.PI / 2, corners: wall(BX) },
  ],
  third: [
    { key: "front", name: "主视图", dir: v3(0, 1, 0), axis: 1, at: -BY, pivot: v3(0, 0, 0), hingeAxis: AX, hingeAngle: 0, corners: front(-BY) },
    { key: "top", name: "俯视图", dir: v3(0, 0, -1), axis: 2, at: Z1, pivot: v3(0, -BY, Z1), hingeAxis: AX, hingeAngle: Math.PI / 2, corners: floor(Z1) },
    { key: "side", name: "右视图", dir: v3(-1, 0, 0), axis: 0, at: BX, pivot: v3(BX, -BY, 0), hingeAxis: AZ, hingeAngle: -Math.PI / 2, corners: wall(BX) },
  ],
}

export const viewName = (angle: Angle, key: ViewKey) => VIEWS[angle].find((v) => v.key === key)!.name

const HOLE_X = 10

const initial = (): ProjState => ({
  step: 0,
  angle: "first",
  projected: false,
  unfold: 0,
  xray: false,
  holeX: HOLE_X,
  holeMoved: false,
  triedThird: false,
  clicked: null,
  foundTop: false,
})

type Drawing = { vis: Seg[]; hid: Seg[] }
type Panel = { def: ViewDef; hinge: THREE.Group; fill: THREE.Mesh; name: THREE.Object3D; vis: LineSegments2; hid: LineSegments2; drawing: Drawing }

export class ProjectionScene extends LessonScene<ProjState> {
  private part = new THREE.Group()
  private box = new THREE.Group()
  private views = new THREE.Group()
  private guides = new THREE.Group()
  private panels: Panel[] = []
  private builtFor = ""
  private flatK = 0
  private proxyMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  private down: { x: number; y: number } | null = null
  /** Bumped on every step change so a pending fold/unfold sequence can tell it is stale. */
  private seq = 0

  constructor(v: Viewer, emit: (s: ProjState) => void) {
    super(v, emit, initial())
    v.showGrid(false)
    this.own(() => v.showGrid(true))
    this.root.add(this.part, this.box, this.views, this.guides)

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => {
      this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 4) this.onClick(e)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => el.removeEventListener("pointerdown", onDown))
    this.own(() => el.removeEventListener("pointerup", onUp))
  }

  dispose() {
    super.dispose()
    this.proxyMat.dispose()
  }

  enter(step: number) {
    const s = this.state
    this.seq++
    this.v.tweens.cancel("flat")
    this.v.tweens.cancel("unfold")
    const patch: Partial<ProjState> = { step, xray: false, clicked: null }
    if (step >= 1 && !s.projected) {
      patch.projected = true
      this.flatK = 1
    }
    if (step <= 3 && s.angle !== "first") patch.angle = "first"
    if (step <= 2) patch.unfold = 0
    if (step >= 3) patch.unfold = 1
    if (step === 0) {
      patch.projected = false
      this.flatK = 0
    }
    this.set(patch)
    if (step <= 2) this.v.flyTo(v3(0, 0, 22).addScaledVector(v3(1, -1.25, 0.8).normalize(), 470), v3(0, 0, 22), 800)
    else this.fitLayout()
  }

  // ------------------------------------------------------------ actions

  project() {
    if (this.state.projected) return
    this.set({ projected: true })
    this.v.tweens.run(1300, (k) => {
      this.flatK = k
      this.updateLines()
    }, { tag: "flat" })
  }

  /** Show the part as a ghost and face the front view (the hidden-line reveal). */
  xray() {
    this.set({ xray: true })
    this.v.setView("front", { target: v3(0, 0, 22), distance: 280 })
  }

  setUnfold(u: number) {
    this.v.tweens.cancel("unfold")
    const was = this.state.unfold
    this.set({ unfold: clamp(u, 0, 1) })
    if (was < 1 && this.state.unfold >= 1) this.fitLayout()
  }

  unfoldTo(to: number, ms = 1300) {
    const from = this.state.unfold
    return this.v.tweens.run(ms, (k) => this.set({ unfold: from + (to - from) * k }), { tag: "unfold" }).then(() => {
      if (to === 1) this.fitLayout()
    })
  }

  setHoleX(x: number) {
    const holeX = clamp(Math.round(x), -10, 22)
    this.set({ holeX, holeMoved: this.state.holeMoved || holeX !== HOLE_X })
  }

  /** Fold the box, switch the convention, unfold again: the views visibly change places. */
  async setAngle(angle: Angle) {
    if (angle === this.state.angle) return
    this.set({ triedThird: this.state.triedThird || angle === "third", clicked: null })
    const seq = this.seq
    if (this.state.unfold > 0) await this.unfoldTo(0, 700)
    if (seq !== this.seq) return
    this.set({ angle })
    await this.unfoldTo(1, 1100)
  }

  // ------------------------------------------------------------ input

  private onClick(e: PointerEvent) {
    const s = this.state
    if (s.step !== 5 || s.foundTop) return
    const hit = this.v.pick(e, this.panels.map((p) => p.fill), false)
    const key = hit?.object.userData.view as ViewKey | undefined
    if (!key) return
    this.set({ clicked: key, foundTop: key === "top" })
  }

  private fitLayout() {
    const box = new THREE.Box3()
    const yf = this.state.angle === "first" ? BY : -BY
    if (this.state.angle === "first") box.set(v3(-BX, yf, Z0 - 2 * BY), v3(BX + 2 * BY, yf, Z1))
    else box.set(v3(-BX, yf, Z0), v3(BX + 2 * BY, yf, Z1 + 2 * BY))
    this.v.fit(box, { dir: VIEW_DIRS.front, padding: 1.05 })
  }

  // ------------------------------------------------------------ build

  /** The part, its ray proxies, and the projected drawings for the current convention. */
  private rebuild() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.part)
    const { group, cylinder } = lBlock(kit, { kind: "base-through", x: s.holeX })
    this.part.add(group)
    this.part.updateMatrixWorld(true)

    const meshes = faces(this.part)
    const proxies = meshes.map((m) => {
      const p = new THREE.Mesh(m.geometry, this.proxyMat)
      p.matrixAutoUpdate = false
      p.matrixWorld.copy(m.matrixWorld)
      return p
    })
    const edges = sharpEdges(meshes)

    this.clear(this.views)
    this.panels = []
    for (const def of VIEWS[s.angle]) {
      const segs = [...edges, ...limbs(cylinder, def.dir)]
      const drawing = classify(segs, proxies, def.dir)
      const hinge = new THREE.Group()
      hinge.position.copy(def.pivot)
      const local = (p: THREE.Vector3) => p.clone().sub(def.pivot)
      const fill = new THREE.Mesh(quad(def.corners.map(local)), kit.plane)
      fill.userData = { view: def.key }
      const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(def.corners.map(local)), kit.planeEdge)
      border.raycast = () => {}
      // The name sits at the top-left corner of the panel as it lies after unfolding.
      const q = new THREE.Quaternion().setFromAxisAngle(def.hingeAxis, def.hingeAngle)
      const flat = def.corners.map((c) => c.clone().sub(def.pivot).applyQuaternion(q).add(def.pivot))
      const minX = Math.min(...flat.map((p) => p.x))
      const maxZ = Math.max(...flat.map((p) => p.z))
      const yf = flat[0].y - 0.3
      const at = v3(minX + 3, yf, maxZ - 3).sub(def.pivot).applyQuaternion(q.clone().invert())
      const name = label(def.name, at, "font-sans text-small")
      name.center.set(0, 0)
      const vis = new LineSegments2(new LineSegmentsGeometry(), kit.sketchDefined)
      const hid = new LineSegments2(new LineSegmentsGeometry(), kit.construction)
      hinge.add(fill, border, name, hid, vis)
      this.views.add(hinge)
      this.panels.push({ def, hinge, fill, name, vis, hid, drawing })
    }

    // Glass faces that carry no view.
    this.clear(this.box)
    const used = new Set(VIEWS[s.angle].map((d) => `${d.axis}:${d.at}`))
    const all: [string, THREE.Vector3[]][] = [
      [`1:${BY}`, front(BY)],
      [`1:${-BY}`, front(-BY)],
      [`2:${Z0}`, floor(Z0)],
      [`2:${Z1}`, floor(Z1)],
      [`0:${BX}`, wall(BX)],
      [`0:${-BX}`, wall(-BX)],
    ]
    for (const [k, c] of all) {
      if (used.has(k)) continue
      this.box.add(new THREE.Mesh(quad(c), kit.glass))
      const b = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(c), kit.planeEdge)
      b.raycast = () => {}
      this.box.add(b)
    }
    this.updateLines()
  }

  /** Lines slide from the part's edges onto the panel as flatK goes 0 → 1. */
  private updateLines() {
    for (const p of this.panels) {
      const { def } = p
      const flatten = (pt: THREE.Vector3, lift: number) => {
        const q = pt.clone()
        const target = def.at - def.dir.getComponent(def.axis) * lift
        q.setComponent(def.axis, pt.getComponent(def.axis) + (target - pt.getComponent(def.axis)) * this.flatK)
        return q.sub(def.pivot)
      }
      const set = (obj: LineSegments2, segs: Seg[], lift: number) => {
        const arr: number[] = []
        for (const [a, b] of segs) {
          const A = flatten(a, lift)
          const B = flatten(b, lift)
          arr.push(A.x, A.y, A.z, B.x, B.y, B.z)
        }
        obj.geometry.setPositions(arr.length ? arr : [0, 0, 0, 0, 0, 0])
        obj.computeLineDistances()
        obj.visible = arr.length > 0 && (this.state.projected || this.flatK > 0)
      }
      set(p.vis, p.drawing.vis, 0.25)
      set(p.hid, p.drawing.hid, 0.12)
    }
    this.v.invalidate()
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const key = `${s.angle}|${s.holeX}`
    if (key !== this.builtFor) {
      this.builtFor = key
      this.rebuild()
    }
    this.updateLines()

    // Ghost while the box opens; gone once the views lie flat (it would sit in front of them).
    const ghost = s.xray || s.unfold > 0
    paint(this.part, kit, () => (ghost ? "ghost" : "rest"))
    this.part.visible = s.unfold < 0.999
    this.box.visible = s.unfold < 0.02 && !s.xray
    for (const p of this.panels) {
      p.hinge.quaternion.setFromAxisAngle(p.def.hingeAxis, p.def.hingeAngle * s.unfold)
      p.name.visible = s.projected && (s.step !== 5 || s.foundTop || s.clicked === p.def.key)
      // Projection screens are tinted; in the last step only the one clicked keeps the tint.
      p.fill.material = s.step !== 5 || s.clicked === p.def.key ? kit.planeHover : kit.plane
    }
    this.renderGuides()
    this.v.invalidate()
  }

  /** 长对正、高平齐、宽相等: thin construction lines across the unfolded views. */
  private renderGuides() {
    const s = this.state
    this.clear(this.guides)
    if (s.step !== 3 || s.unfold < 1) return
    const kit = this.v.kit
    const first = s.angle === "first"
    const yf = (first ? BY : -BY) - 0.4
    const P = (x: number, z: number) => v3(x, yf, z)
    const sgn = first ? -1 : 1
    const cz = first ? Z0 : Z1
    // Guides run only through the gaps between views, so they never cross a drawing.
    const frontEdge = first ? 0 : L.top
    const topNear = cz + sgn * (first ? BY - L.y1 : L.y0 + BY)
    const sideNear = BX + (first ? BY - L.y1 : L.y0 + BY)
    // Length: front ↔ top share x.
    for (const x of [L.x0, L.upX, s.holeX, L.x1]) this.guides.add(line([P(x, frontEdge), P(x, topNear)], kit.sketchThin))
    // Height: front ↔ side share z.
    for (const z of [0, L.base, L.top]) this.guides.add(line([P(z === L.top ? L.upX : L.x1, z), P(sideNear, z)], kit.sketchThin))
    // Width: top ↔ side through the 45° mitre line.
    this.guides.add(line([P(BX, cz), P(BX + 64, cz + sgn * 64)], kit.path))
    for (const y of [L.y0, L.y1]) {
      const t = first ? BY - y : y + BY
      const zTop = cz + sgn * t
      const xSide = BX + t
      this.guides.add(line([P(L.x1, zTop), P(xSide, zTop), P(xSide, frontEdge)], kit.sketchThin))
    }
  }
}

// ------------------------------------------------------------------ projection helpers

/** Sharp edges of every face, in world space, without duplicates. */
function sharpEdges(meshes: THREE.Mesh[]): Seg[] {
  const out: Seg[] = []
  const seen = new Set<string>()
  const key = (p: THREE.Vector3) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`
  for (const m of meshes) {
    const e = m.children.find((c) => c.userData.kind === "edge") as THREE.LineSegments | undefined
    if (!e) continue
    const pos = e.geometry.getAttribute("position")
    for (let i = 0; i < pos.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(e.matrixWorld)
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(e.matrixWorld)
      const ka = key(a)
      const kb = key(b)
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push([a, b])
    }
  }
  return out
}

/** Silhouette lines of a cylinder seen side-on (a hole's walls in a drawing). */
function limbs(c: Cylinder, dir: THREE.Vector3): Seg[] {
  if (Math.abs(c.axis.dot(dir)) > 0.01) return []
  const side = c.axis.clone().cross(dir).normalize().multiplyScalar(c.r)
  const half = c.axis.clone().multiplyScalar(c.length / 2)
  return [1, -1].map((k) => {
    const p = c.center.clone().addScaledVector(side, k)
    return [p.clone().sub(half), p.clone().add(half)] as Seg
  })
}

const rc = new THREE.Raycaster()

/**
 * Split each edge into short pieces and cast a ray from each piece towards
 * the observer: anything in the way makes that piece a hidden line.
 */
function classify(segs: Seg[], proxies: THREE.Mesh[], dir: THREE.Vector3): Drawing {
  const vis: Seg[] = []
  const hid: Seg[] = []
  const back = dir.clone().negate()
  rc.near = 0.02
  rc.far = 1000
  const o = new THREE.Vector3()
  for (const [a, b] of segs) {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 1.5))
    let start = a.clone()
    let prev = a.clone()
    let hiddenRun: boolean | null = null
    for (let i = 1; i <= n; i++) {
      const p = a.clone().lerp(b, i / n)
      o.copy(prev).add(p).multiplyScalar(0.5).addScaledVector(back, 0.05)
      rc.set(o, back)
      const hidden = rc.intersectObjects(proxies, false).length > 0
      if (hiddenRun === null) hiddenRun = hidden
      else if (hidden !== hiddenRun) {
        ;(hiddenRun ? hid : vis).push([start, prev.clone()])
        start = prev.clone()
        hiddenRun = hidden
      }
      prev = p
    }
    ;(hiddenRun ? hid : vis).push([start, b.clone()])
  }
  return { vis, hid }
}

function quad(c: THREE.Vector3[]) {
  const g = new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[0], c[2], c[3]])
  g.computeVertexNormals()
  return g
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
