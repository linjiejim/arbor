import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { face, label, line } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 3.2.2 「GD&T 入门：基准与公差带」: a plate 80 × 50 × 20 with a Ø14 hole.
 * Datum A is the bottom face, B the left face, C the front face. Three
 * feature control frames: flatness of the top face, perpendicularity of
 * face B to A, position of the hole to A|B|C.
 *
 * Every geometric deviation is drawn 100× larger than it is (0.05 mm shows
 * as 5 mm) so the tolerance zones can be seen; the readouts give the real
 * values. The part is rebuilt from height functions on each change, so the
 * warped face, the leaning face and the shifted hole are real geometry.
 */
export type FrameKind = "flat" | "perp" | "pos"
export type Datum = "A" | "B" | "C"
export type Standard = "iso" | "asme"

export type GdtState = {
  step: number
  frame: FrameKind | null
  seen: FrameKind[]
  /** Flatness: height of the dome in the top face, and the tilt of the whole face across its length (mm). */
  bulge: number
  tilt: number
  sawFlatFail: boolean
  triedTilt: boolean
  /** Perpendicularity: how far the top edge of face B leans out past its bottom edge (mm). */
  lean: number
  sawPerpFail: boolean
  sawPerpPass: boolean
  /** Position: offset of the hole's axis from its true position (mm). */
  dx: number
  dy: number
  sawPosOut: boolean
  posBack: boolean
  /** Setup: the datum features in the order they were brought against their simulators. */
  order: Datum[]
  doneABC: boolean
  triedBFirst: boolean
  /** GB vs ASME: the plate bent by `bow` mm, judged under either default principle. */
  bow: number
  standard: Standard
  judged: Standard[]
}

// ------------------------------------------------------------------ the part (mm, display)

export const PART = { l: 80, w: 50, t: 20 } as const
/** True position of the hole, from B (left face, x) and C (front face, y). */
export const HOLE = { x: 30, y: 25, r: 7 } as const
/** Exaggeration of every geometric deviation in 3D. */
export const MAG = 100
export const TOL: Record<FrameKind, number> = { flat: 0.05, perp: 0.05, pos: 0.1 }
/** Size tolerance of the thickness in the last step: 20 ± 0.1. */
export const SIZE_TOL = 0.1
/** The part used for the setup demo: face B leans 0.04 (perpendicularity OK), the hole sits 0.06 short of 30 from B's bottom edge. */
export const SETUP = { lean: 0.04, ex: -0.06, ey: 0 } as const

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** The real flatness error of the top face: the dome's height; tilt doesn't count (the zone tilts with it). */
export const flatError = (s: GdtState) => s.bulge
export const perpError = (s: GdtState) => Math.abs(s.lean)
/** Position error is reported as the diameter of the smallest zone that holds the axis: 2 × the offset. */
export const posError = (s: GdtState) => 2 * Math.hypot(s.dx, s.dy)

/** Where each datum's simulator is: table under A, wall left of B, fence behind C. */
const YAW0 = THREE.MathUtils.degToRad(7)
const OFF = v3(16, 14, 18)
const LEAN_D = MAG * SETUP.lean

type Pose = { rotY: number; yaw: number; t: THREE.Vector3 }

/**
 * Where the part ends up for a given order of seating its datum features,
 * for a face B that leans out by `lean` at the top (display or real mm).
 */
export function poseFor(order: Datum[], lean = LEAN_D): Pose {
  const a = order.indexOf("A")
  const b = order.indexOf("B")
  const hasA = a >= 0
  const hasB = b >= 0
  // Pressed flat against the wall first, the leaning face B turns the whole part.
  const beta = Math.atan(lean / PART.t)
  const bSeatedFirst = hasB && (!hasA || b < a)
  const rotY = bSeatedFirst ? beta : 0
  const yaw = hasB ? 0 : YAW0
  const t = OFF.clone()
  if (hasB) t.x = bSeatedFirst ? 0 : lean
  if (hasA) t.z = bSeatedFirst ? PART.l * Math.sin(beta) : 0
  if (order.includes("C")) {
    // Front face to the fence at y = 0: the corner that sticks out furthest touches it.
    t.y = -Math.min(...[0, PART.l].map((x) => x * Math.sin(yaw)))
  }
  return { rotY, yaw, t }
}

function poseMatrix(p: Pose) {
  const m = new THREE.Matrix4().makeRotationZ(p.yaw)
  m.multiply(new THREE.Matrix4().makeRotationY(p.rotY))
  return new THREE.Matrix4().makeTranslation(p.t.x, p.t.y, p.t.z).multiply(m)
}

/** True when B was seated before A. */
export const bFirst = (order: Datum[]) => order.includes("B") && (!order.includes("A") || order.indexOf("B") < order.indexOf("A"))

/**
 * Position error of the setup part's hole in the fixture, in real mm as a
 * zone diameter: the part posed with its real lean, the axis checked at both
 * ends against the zone about (30, 25).
 */
export function setupError(order: Datum[]) {
  const m = poseMatrix(poseFor(order, SETUP.lean))
  let worst = 0
  for (const z of [0, PART.t]) {
    const p = v3(HOLE.x + SETUP.ex, HOLE.y + SETUP.ey, z).applyMatrix4(m)
    worst = Math.max(worst, Math.hypot(p.x - HOLE.x, p.y - HOLE.y))
  }
  return 2 * worst
}

// ------------------------------------------------------------------ geometry

type Shape = {
  top: (x: number, y: number) => number
  bottom: (x: number, y: number) => number
  /** x of face B's top edge (its bottom edge is at x = 0). */
  leanTop: number
  hole: { x: number; y: number; r: number }
}

/** Triangles from rows of points: each consecutive pair of rows becomes a band, wound to face `out`. */
function bands(rows: THREE.Vector3[][], out: (p: THREE.Vector3) => THREE.Vector3) {
  const pos: number[] = []
  let flip: boolean | null = null
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    for (let j = 0; j + 1 < a.length; j++) {
      const tris = [
        [a[j], a[j + 1], b[j + 1]],
        [a[j], b[j + 1], b[j]],
      ]
      for (const [p, q, r] of tris) {
        const n = q.clone().sub(p).cross(r.clone().sub(p))
        if (n.lengthSq() < 1e-10) continue
        if (flip === null) flip = n.dot(out(p)) < 0
        const t = flip ? [p, r, q] : [p, q, r]
        for (const v of t) pos.push(v.x, v.y, v.z)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** A rectangle with a round hole, meshed by rays from the hole's centre so it can be bent by a height function. */
function holedFace(x0: number, x1: number, s: Shape, z: (x: number, y: number) => number, up: boolean) {
  const { x: hx, y: hy, r } = s.hole
  const corners = [
    [x0, 0],
    [x1, 0],
    [x1, PART.w],
    [x0, PART.w],
  ].map(([x, y]) => Math.atan2(y - hy, x - hx))
  const angles = new Set<number>()
  const n = 96
  for (let i = 0; i < n; i++) angles.add((i / n) * Math.PI * 2 - Math.PI)
  for (const c of corners) angles.add(c)
  const list = [...angles].sort((a, b) => a - b)
  list.push(list[0] + Math.PI * 2)
  const rows = list.map((a) => {
    const d = v3(Math.cos(a), Math.sin(a), 0)
    // Distance to the rectangle's edge along this ray.
    const ts: number[] = []
    if (d.x > 1e-9) ts.push((x1 - hx) / d.x)
    if (d.x < -1e-9) ts.push((x0 - hx) / d.x)
    if (d.y > 1e-9) ts.push((PART.w - hy) / d.y)
    if (d.y < -1e-9) ts.push((0 - hy) / d.y)
    const R = Math.min(...ts)
    const out: THREE.Vector3[] = []
    const m = 14
    for (let j = 0; j <= m; j++) {
      const rho = r + (R - r) * (j / m)
      const x = hx + d.x * rho
      const y = hy + d.y * rho
      out.push(v3(x, y, z(x, y)))
    }
    return out
  })
  return bands(rows, () => v3(0, 0, up ? 1 : -1))
}

/** The plate as named faces. */
function plate(s: Shape) {
  const { l, w } = PART
  const N = 40
  const leanAt = (frac: number) => s.leanTop * frac
  const faces: Record<string, THREE.BufferGeometry> = {}
  faces.top = holedFace(s.leanTop, l, s, s.top, true)
  faces.bottom = holedFace(0, l, s, s.bottom, false)
  const wall = (pt: (u: number, top: boolean) => THREE.Vector3, out: THREE.Vector3) => {
    const bottom: THREE.Vector3[] = []
    const top: THREE.Vector3[] = []
    for (let i = 0; i <= N; i++) {
      bottom.push(pt(i / N, false))
      top.push(pt(i / N, true))
    }
    return bands([bottom, top], () => out)
  }
  const xAt = (u: number, top: boolean) => (top ? s.leanTop + u * (l - s.leanTop) : u * l)
  faces.front = wall((u, top) => {
    const x = xAt(u, top)
    return v3(x, 0, top ? s.top(x, 0) : s.bottom(x, 0))
  }, v3(0, -1, 0))
  faces.back = wall((u, top) => {
    const x = xAt(u, top)
    return v3(x, w, top ? s.top(x, w) : s.bottom(x, w))
  }, v3(0, 1, 0))
  faces.right = wall((u, top) => v3(l, u * w, top ? s.top(l, u * w) : s.bottom(l, u * w)), v3(1, 0, 0))
  faces.left = wall((u, top) => {
    const x = top ? leanAt(1) : 0
    return v3(x, u * w, top ? s.top(x, u * w) : s.bottom(x, u * w))
  }, v3(-1, 0, 0))
  // The hole wall faces its axis.
  const ring = (top: boolean) => {
    const out: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      const x = s.hole.x + Math.cos(a) * s.hole.r
      const y = s.hole.y + Math.sin(a) * s.hole.r
      out.push(v3(x, y, top ? s.top(x, y) : s.bottom(x, y)))
    }
    return out
  }
  faces.hole = bands([ring(false), ring(true)], (p) => v3(s.hole.x - p.x, s.hole.y - p.y, 0))
  return faces
}

// ------------------------------------------------------------------ HTML: frames and datum symbols

/** The tolerance characteristic symbols of GB/T 1182 / ISO 1101, drawn as small SVGs. */
export const SYMBOL_PATHS: Record<FrameKind, string> = {
  flat: "M4 13 L9 4 L21 4 L16 13 Z",
  perp: "M12 3 L12 13 M5 13 L19 13",
  pos: "M12 1.5 L12 14.5 M5 8 L19 8 M16.5 8 A4.5 4.5 0 1 1 7.5 8 A4.5 4.5 0 1 1 16.5 8",
}
export const FRAME_CELLS: Record<FrameKind, string[]> = {
  flat: ["0.05"],
  perp: ["0.05", "A"],
  pos: ["Ø0.1", "A", "B", "C"],
}
export const FRAME_NAME: Record<FrameKind, string> = { flat: "平面度", perp: "垂直度", pos: "位置度" }

const SVG_NS = "http://www.w3.org/2000/svg"

function symbolSvg(kind: FrameKind) {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("viewBox", "0 0 24 16")
  svg.setAttribute("width", "24")
  svg.setAttribute("height", "16")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.4")
  const p = document.createElementNS(SVG_NS, "path")
  p.setAttribute("d", SYMBOL_PATHS[kind])
  svg.appendChild(p)
  return svg
}

/** A feature control frame (公差框格) as plain HTML. */
function frameEl(kind: FrameKind, opts: { active: boolean; clickable: boolean; tone?: "ok" | "bad" }) {
  const el = document.createElement("div")
  el.className = [
    "flex border bg-popover font-mono text-small tabular text-foreground",
    opts.active ? "border-primary" : "border-foreground",
    opts.tone === "ok" ? "text-success" : opts.tone === "bad" ? "text-destructive" : "",
    opts.clickable ? "interactive cursor-pointer hover:border-primary" : "",
  ].join(" ")
  const cell = (child: Node | string, first = false) => {
    const c = document.createElement("div")
    c.className = `flex items-center px-1.5 py-0.5 ${first ? "" : "border-l border-foreground"}`
    c.append(child)
    el.appendChild(c)
  }
  cell(symbolSvg(kind), true)
  for (const t of FRAME_CELLS[kind]) cell(t)
  return el
}

/** Datum feature symbol: the letter in a square, a short line, a filled triangle on the feature. */
function datumEl(letter: Datum, dir: "down" | "left", opts: { clickable: boolean; done: boolean }) {
  const el = document.createElement("div")
  el.className = [
    "flex items-center text-foreground",
    dir === "down" ? "flex-col" : "flex-row-reverse",
    opts.clickable ? "interactive cursor-pointer" : "",
  ].join(" ")
  const tri = document.createElementNS(SVG_NS, "svg")
  tri.setAttribute("width", "12")
  tri.setAttribute("height", "12")
  tri.setAttribute("viewBox", "0 0 12 12")
  const poly = document.createElementNS(SVG_NS, "polygon")
  // The triangle's base sits on the feature.
  poly.setAttribute("points", dir === "down" ? "1,0 11,0 6,9" : "12,1 12,11 3,6")
  poly.setAttribute("fill", "currentColor")
  tri.appendChild(poly)
  const stem = document.createElement("div")
  stem.className = dir === "left" ? "h-px w-3 bg-foreground" : "h-3 w-px bg-foreground"
  const box = document.createElement("div")
  box.className = [
    "grid size-5 place-items-center border bg-popover font-mono text-small font-medium",
    opts.done ? "border-primary text-primary" : "border-foreground",
    opts.clickable ? "hover:border-primary" : "",
  ].join(" ")
  box.textContent = letter
  el.append(tri, stem, box)
  return el
}

// ------------------------------------------------------------------ scene

const initial = (): GdtState => ({
  step: 0,
  frame: null,
  seen: [],
  bulge: 0.03,
  tilt: 0,
  sawFlatFail: false,
  triedTilt: false,
  lean: 0.02,
  sawPerpFail: false,
  sawPerpPass: false,
  dx: 0.02,
  dy: -0.01,
  sawPosOut: false,
  posBack: false,
  order: [],
  doneABC: false,
  triedBFirst: false,
  bow: 0.05,
  standard: "iso",
  judged: [],
})

type HandleKind = "bulge" | "lean" | "hole" | "bow"

export class GdtScene extends LessonScene<GdtState> {
  private part = new THREE.Group()
  private zones = new THREE.Group()
  private notes = new THREE.Group()
  private fixture = new THREE.Group()
  private handles: Record<HandleKind, CSS2DObject>
  private okMat: THREE.MeshStandardMaterial
  private badMat: THREE.MeshStandardMaterial
  private dotMat = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true })
  private pose: Pose = poseFor([])
  private seq = 0
  private animating = false

  constructor(v: Viewer, emit: (s: GdtState) => void) {
    super(v, emit, initial())
    v.setGrid(120, 10)
    this.okMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    this.badMat = this.okMat.clone()
    this.own(() => this.okMat.dispose())
    this.own(() => this.badMat.dispose())
    this.own(() => this.dotMat.dispose())
    this.handles = {
      bulge: this.handle("bulge", "上下拖，改变顶面的起伏"),
      lean: this.handle("lean", "左右拖，让 B 面倾斜"),
      hole: this.handle("hole", "拖动孔的位置"),
      bow: this.handle("bow", "上下拖，把板压弯"),
    }
    this.root.add(this.fixture, this.part, this.zones, this.notes, ...Object.values(this.handles))
  }

  enter(step: number) {
    this.seq++
    this.v.tweens.cancel("pose")
    const patch: Partial<GdtState> = { step }
    if (step === 0) patch.frame = null
    this.animating = false
    if (step === 4) {
      patch.order = []
      this.pose = poseFor([])
    }
    this.set(patch)
    const views: [THREE.Vector3, THREE.Vector3, number][] = [
      [v3(-0.75, -1.25, 0.9), v3(38, 22, 10), 330],
      [v3(0.35, -1, 0.42), v3(40, 25, 16), 250],
      [v3(-0.55, -1, 0.34), v3(26, 25, 12), 270],
      [v3(0.05, -0.45, 1), v3(42, 24, 12), 200],
      [v3(-0.55, -1.3, 0.75), v3(44, 30, 14), 380],
      [v3(0.18, -1, 0.28), v3(40, 25, 14), 260],
    ]
    const [dir, target, dist] = views[step]
    this.v.flyTo(target.clone().addScaledVector(dir.normalize(), dist), target, 800)
  }

  // ------------------------------------------------------------ actions

  showFrame(kind: FrameKind) {
    const s = this.state
    this.set({ frame: kind, seen: s.seen.includes(kind) ? s.seen : [...s.seen, kind] })
  }

  setBulge(bulge: number) {
    const b = clamp(round3(bulge), 0, 0.1)
    const s = this.state
    this.set({ bulge: b, sawFlatFail: s.sawFlatFail || b > TOL.flat })
  }

  setTilt(tilt: number) {
    const s = this.state
    this.set({ tilt, triedTilt: s.triedTilt || (Math.abs(tilt) >= 0.05 && s.bulge <= TOL.flat) })
  }

  setLean(lean: number) {
    const l = clamp(round3(lean), -0.1, 0.1)
    const s = this.state
    const fail = Math.abs(l) > TOL.perp
    this.set({ lean: l, sawPerpFail: s.sawPerpFail || fail, sawPerpPass: s.sawPerpPass || (s.sawPerpFail && !fail) })
  }

  setHole(dx: number, dy: number) {
    const s = this.state
    const x = clamp(round3(dx), -0.09, 0.09)
    const y = clamp(round3(dy), -0.09, 0.09)
    const out = 2 * Math.hypot(x, y) > TOL.pos
    this.set({ dx: x, dy: y, sawPosOut: s.sawPosOut || out, posBack: s.posBack || (s.sawPosOut && !out) })
  }

  /** Seat the next datum feature against its simulator. */
  seat(d: Datum) {
    const s = this.state
    if (s.order.includes(d)) return
    const order = [...s.order, d]
    const from = this.pose
    const to = poseFor(order)
    const done = order.length === 3
    const abc = done && order.join("") === "ABC"
    this.set({ order, doneABC: s.doneABC || abc, triedBFirst: s.triedBFirst || (done && bFirst(order)) })
    const seq = this.seq
    this.animating = true
    this.v.tweens
      .run(900, (k) => {
        if (seq !== this.seq) return
        this.pose = {
          rotY: from.rotY + (to.rotY - from.rotY) * k,
          yaw: from.yaw + (to.yaw - from.yaw) * k,
          t: from.t.clone().lerp(to.t, k),
        }
        this.render()
      }, { tag: "pose" })
      .then(() => {
        if (seq !== this.seq) return
        this.animating = false
        this.pose = to
        this.render()
      })
  }

  resetSetup() {
    this.seq++
    this.animating = false
    this.v.tweens.cancel("pose")
    this.pose = poseFor([])
    this.set({ order: [] })
  }

  setBow(bow: number) {
    const b = clamp(Math.round(bow * 200) / 200, 0, 0.2)
    this.set({ bow: b, judged: this.judgedWith(b, this.state.standard) })
  }

  setStandard(standard: Standard) {
    this.set({ standard, judged: this.judgedWith(this.state.bow, standard) })
  }

  private judgedWith(bow: number, std: Standard) {
    const j = this.state.judged
    return bow > SIZE_TOL && !j.includes(std) ? [...j, std] : j
  }

  // ------------------------------------------------------------ handles

  private handle(kind: HandleKind, title: string) {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-colors hover:bg-selected"
    el.title = title
    const o = new CSS2DObject(el)
    o.visible = false
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const cam = this.v.camera.position.clone().sub(this.v.controls.target)
      // Vertical drags use a plane facing the camera; the others slide on the top face.
      const vertical = kind === "bulge" || kind === "bow"
      const plane = vertical
        ? new THREE.Plane().setFromNormalAndCoplanarPoint(v3(cam.x, cam.y, 0).normalize(), o.position.clone())
        : new THREE.Plane(v3(0, 0, 1), -PART.t)
      const s0 = { ...this.state }
      const start = o.position.clone()
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        if (kind === "bulge") this.setBulge(s0.bulge + (hit.z - start.z) / MAG)
        if (kind === "bow") this.setBow(s0.bow + (hit.z - start.z) / MAG)
        if (kind === "lean") this.setLean(s0.lean - (hit.x - start.x) / MAG)
        if (kind === "hole") this.setHole(s0.dx + (hit.x - start.x) / MAG, s0.dy + (hit.y - start.y) / MAG)
      }
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
    return o
  }

  // ------------------------------------------------------------ render

  /** The part's shape in this step, in display millimetres. */
  private shape(): Shape {
    const s = this.state
    const { l, w, t } = PART
    const flat = (z: number) => () => z
    if (s.step === 1) {
      const dome = (x: number, y: number) => MAG * s.bulge * (1 - ((x - l / 2) / (l / 2)) ** 2) * (1 - ((y - w / 2) / (w / 2)) ** 2)
      return { top: (x, y) => t + (MAG * s.tilt * (x - l / 2)) / l + dome(x, y), bottom: flat(0), leanTop: 0, hole: { ...HOLE } }
    }
    if (s.step === 2) return { top: flat(t), bottom: flat(0), leanTop: -MAG * s.lean, hole: { ...HOLE } }
    if (s.step === 3) return { top: flat(t), bottom: flat(0), leanTop: 0, hole: { x: HOLE.x + MAG * s.dx, y: HOLE.y + MAG * s.dy, r: HOLE.r } }
    if (s.step === 4) return { top: flat(t), bottom: flat(0), leanTop: -LEAN_D, hole: { x: HOLE.x + MAG * SETUP.ex, y: HOLE.y + MAG * SETUP.ey, r: HOLE.r } }
    if (s.step === 5) {
      const bend = (x: number) => MAG * s.bow * (1 - ((x - l / 2) / (l / 2)) ** 2)
      return { top: (x) => t + bend(x), bottom: (x) => bend(x), leanTop: 0, hole: { ...HOLE } }
    }
    return { top: flat(t), bottom: flat(0), leanTop: 0, hole: { ...HOLE } }
  }

  /** Which face is judged in this step, and whether it passes. */
  private verdict(): { face: string[]; ok: boolean } | null {
    const s = this.state
    if (s.step === 1) return { face: ["top"], ok: flatError(s) <= TOL.flat + 1e-9 }
    if (s.step === 2) return { face: ["left"], ok: perpError(s) <= TOL.perp + 1e-9 }
    if (s.step === 3) return { face: ["hole"], ok: posError(s) <= TOL.pos + 1e-9 }
    if (s.step === 4 && s.order.length === 3) return { face: ["hole"], ok: setupError(s.order) <= TOL.pos + 1e-9 }
    if (s.step === 5) return { face: ["top", "bottom", "front", "back", "left", "right", "hole"], ok: s.standard === "iso" || s.bow <= SIZE_TOL + 1e-9 }
    return null
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.okMat.color.copy(this.v.tokens.good)
    this.badMat.color.copy(this.v.tokens.bad)
    this.dotMat.color.copy(this.v.tokens.highlight)

    // The part.
    this.clear(this.part)
    const sh = this.shape()
    const geos = plate(sh)
    const verdict = this.verdict()
    const lit: Record<FrameKind, string> = { flat: "top", perp: "left", pos: "hole" }
    for (const [name, geo] of Object.entries(geos)) {
      const m = face(geo, kit, { feature: "plate", name, edges: 25 })
      if (verdict?.face.includes(name)) m.material = verdict.ok ? this.okMat : this.badMat
      else if (s.step === 0 && s.frame && lit[s.frame] === name) m.material = kit.highlight
      this.part.add(m)
    }
    this.part.matrixAutoUpdate = false
    this.part.matrix.copy(s.step === 4 ? poseMatrix(this.pose) : new THREE.Matrix4())
    this.part.matrixWorldNeedsUpdate = true

    this.clear(this.zones)
    this.clear(this.notes)
    this.clear(this.fixture)
    if (s.step === 0) this.renderFrames()
    if (s.step === 1) this.renderFlatness()
    if (s.step === 2) this.renderPerp()
    if (s.step === 3) this.renderPosition()
    if (s.step === 4) this.renderSetup()
    if (s.step === 5) this.renderEnvelope()

    // Handles.
    const { l, w, t } = PART
    for (const h of Object.values(this.handles)) h.visible = false
    if (s.step === 1) {
      this.handles.bulge.visible = true
      this.handles.bulge.position.set(l / 2, w / 2, sh.top(l / 2, w / 2))
    }
    if (s.step === 2) {
      this.handles.lean.visible = true
      this.handles.lean.position.set(sh.leanTop, w * 0.2, t)
    }
    if (s.step === 3) {
      this.handles.hole.visible = true
      this.handles.hole.position.set(sh.hole.x, sh.hole.y, t)
    }
    if (s.step === 5) {
      this.handles.bow.visible = true
      this.handles.bow.position.set(l / 2, 0, sh.top(l / 2, 0))
    }
    this.v.invalidate()
  }

  /** Step 1: the three frames, each on a leader to its feature, and the datum symbols. */
  private renderFrames() {
    const s = this.state
    const kit = this.v.kit
    const { l, w, t } = PART
    const put: Record<FrameKind, [THREE.Vector3, THREE.Vector3]> = {
      flat: [v3(l - 6, w * 0.5, t + 30), v3(l - 14, w * 0.5, t)],
      perp: [v3(-34, w * 0.3, t + 18), v3(0, w * 0.3, t * 0.6)],
      pos: [v3(HOLE.x - 6, -4, t + 30), v3(HOLE.x - HOLE.r * 0.7, HOLE.y - HOLE.r * 0.7, t)],
    }
    for (const kind of ["flat", "perp", "pos"] as FrameKind[]) {
      const [at, to] = put[kind]
      this.notes.add(line([at, to], kit.dimension))
      const el = frameEl(kind, { active: s.frame === kind, clickable: true })
      el.title = `${FRAME_NAME[kind]} · 点击查看`
      el.addEventListener("pointerdown", (e) => e.stopPropagation())
      el.addEventListener("click", () => this.showFrame(kind))
      const o = new CSS2DObject(el)
      o.position.copy(at)
      this.notes.add(o)
    }
    this.datumSymbols(false)
  }

  /** The datum feature symbols on A (bottom), B (left) and C (front). */
  private datumSymbols(clickable: boolean) {
    const s = this.state
    const { l, w, t } = PART
    const m = s.step === 4 ? poseMatrix(this.pose) : new THREE.Matrix4()
    const spots: Record<Datum, [THREE.Vector3, "down" | "left", [number, number]]> = {
      A: [v3(l * 0.62, 0, 0), "down", [0.5, 0]],
      B: [v3(s.step === 2 ? -MAG * s.lean * 0.5 : s.step === 4 ? -LEAN_D * 0.5 : 0, w * 0.75, t * 0.5), "left", [1, 0.5]],
      C: [v3(l * 0.86, -0.2, t * 0.55), "down", [0.5, 0]],
    }
    for (const d of ["A", "B", "C"] as Datum[]) {
      const [p, dir, center] = spots[d]
      const el = datumEl(d, dir, { clickable, done: s.order.includes(d) })
      if (clickable) {
        el.title = `把基准 ${d} 靠上去`
        el.addEventListener("pointerdown", (e) => e.stopPropagation())
        el.addEventListener("click", () => this.seat(d))
      }
      const o = new CSS2DObject(el)
      o.position.copy(p.clone().applyMatrix4(m))
      o.center.set(center[0], center[1])
      this.notes.add(o)
    }
  }

  /** Step 2: two parallel planes 0.05 apart, free to tilt with the face. */
  private renderFlatness() {
    const s = this.state
    const { l, w, t } = PART
    const base = (x: number) => t + (MAG * s.tilt * (x - l / 2)) / l
    for (const dz of [0, MAG * TOL.flat]) this.zones.add(...this.quad([v3(-4, -4, base(-4) + dz), v3(l + 4, -4, base(l + 4) + dz), v3(l + 4, w + 4, base(l + 4) + dz), v3(-4, w + 4, base(-4) + dz)]))
    this.frameAt("flat", v3(l + 2, w * 0.5, base(l) + 26), v3(l - 12, w * 0.5, base(l - 12)), flatError(s) <= TOL.flat)
    const z = label(`公差带 ${TOL.flat}`, v3(l + 4, -4, base(l + 4) + MAG * TOL.flat), "border-transparent bg-transparent font-sans text-muted-foreground")
    z.center.set(0, 0.5)
    this.notes.add(z)
  }

  /** Step 3: two parallel planes 0.05 apart, perpendicular to datum A, floating to hold face B. */
  private renderPerp() {
    const s = this.state
    const { w, t } = PART
    const mid = (-MAG * s.lean) / 2
    for (const dx of [-1, 1]) {
      const x = mid + (dx * MAG * TOL.perp) / 2
      this.zones.add(...this.quad([v3(x, -4, -3), v3(x, w + 4, -3), v3(x, w + 4, t + 6), v3(x, -4, t + 6)]))
    }
    this.frameAt("perp", v3(-40, w * 0.3, t + 22), v3(-MAG * s.lean * 0.6, w * 0.3, t * 0.6), perpError(s) <= TOL.perp)
    this.datumSymbols(false)
  }

  /** Step 4: a cylinder Ø0.1 about the true position, set by theoretically exact dimensions from B and C. */
  private renderPosition() {
    const s = this.state
    const kit = this.v.kit
    const { w, t } = PART
    const r = (MAG * TOL.pos) / 2
    const cyl = new THREE.CylinderGeometry(r, r, t + 8, 48, 1, true)
    cyl.rotateX(Math.PI / 2)
    cyl.translate(HOLE.x, HOLE.y, t / 2)
    this.zones.add(new THREE.Mesh(cyl, kit.planeHover))
    for (const z of [-4, t + 4]) {
      const ring: THREE.Vector3[] = []
      for (let i = 0; i <= 48; i++) ring.push(v3(HOLE.x + Math.cos((i / 48) * Math.PI * 2) * r, HOLE.y + Math.sin((i / 48) * Math.PI * 2) * r, z))
      this.zones.add(line(ring, kit.sketchThin))
    }
    // The ± coordinate zone for comparison: a square 0.1 × 0.1.
    const q = r
    this.zones.add(line([v3(HOLE.x - q, HOLE.y - q, t + 4.2), v3(HOLE.x + q, HOLE.y - q, t + 4.2), v3(HOLE.x + q, HOLE.y + q, t + 4.2), v3(HOLE.x - q, HOLE.y + q, t + 4.2), v3(HOLE.x - q, HOLE.y - q, t + 4.2)], kit.construction))
    // The actual axis.
    const hx = HOLE.x + MAG * s.dx
    const hy = HOLE.y + MAG * s.dy
    this.zones.add(line([v3(hx, hy, -6), v3(hx, hy, t + 6)], kit.sketch))
    // Theoretically exact dimensions: boxed, no tolerance.
    const ted = (text: string, a: THREE.Vector3, b: THREE.Vector3, at: THREE.Vector3) => {
      this.notes.add(line([a, b], kit.dimension))
      const l = label(text, at, "border-foreground")
      this.notes.add(l)
    }
    // 30 from B (x = 0), 25 from C (y = 0), both measured to the true position.
    ted("30", v3(0, w + 8, t), v3(HOLE.x, w + 8, t), v3(HOLE.x / 2, w + 8, t))
    this.notes.add(line([v3(HOLE.x, HOLE.y + HOLE.r + 1, t), v3(HOLE.x, w + 10, t)], kit.dimension), line([v3(0, w, t), v3(0, w + 10, t)], kit.dimension))
    ted("25", v3(PART.l + 8, 0, t), v3(PART.l + 8, HOLE.y, t), v3(PART.l + 8, HOLE.y / 2, t))
    this.notes.add(line([v3(HOLE.x + HOLE.r + 1, HOLE.y, t), v3(PART.l + 10, HOLE.y, t)], kit.dimension), line([v3(PART.l, 0, t), v3(PART.l + 10, 0, t)], kit.dimension))
    this.frameAt("pos", v3(HOLE.x + 18, -12, t + 2), v3(HOLE.x + HOLE.r * 0.7, HOLE.y - HOLE.r * 0.7, t), posError(s) <= TOL.pos)
  }

  /** Step 5: datum simulators (table, wall, fence), contact points, and the position zone once the frame is complete. */
  private renderSetup() {
    const s = this.state
    const kit = this.v.kit
    const { l, w, t } = PART
    const sim = (corners: THREE.Vector3[], name: string, at: THREE.Vector3) => {
      this.fixture.add(...this.quad(corners, kit.plane))
      const n = label(name, at, "border-transparent bg-transparent font-sans text-faint-foreground")
      n.center.set(0, 1)
      this.fixture.add(n)
    }
    sim([v3(-10, 0, 0), v3(l + 34, 0, 0), v3(l + 34, w + 24, 0), v3(-10, w + 24, 0)], "A 的模拟体：平台", v3(l + 6, 0, 0))
    sim([v3(0, 0, 0), v3(0, w + 24, 0), v3(0, w + 24, t + 24), v3(0, 0, t + 24)], "B：靠山", v3(0, w + 24, t + 24))
    sim([v3(-10, 0, 0), v3(l + 34, 0, 0), v3(l + 34, 0, t + 24), v3(-10, 0, t + 24)], "C：挡块", v3(l + 10, 0, t + 24))

    // Contact points: 3 on the primary, 2 on the secondary, 1 on the tertiary.
    const m = poseMatrix(this.pose)
    const first = bFirst(s.order)
    const pts: THREE.Vector3[] = []
    if (s.order.includes("A")) pts.push(...(first ? [v3(l, 10, 0), v3(l, w - 10, 0)] : [v3(8, 8, 0), v3(l - 8, 10, 0), v3(l * 0.45, w - 6, 0)]))
    if (s.order.includes("B")) pts.push(...(first ? [v3(0, 8, 3), v3(-LEAN_D * 0.9, 12, t * 0.9), v3(-LEAN_D * 0.5, w - 8, t * 0.5)] : [v3(-LEAN_D, 10, t), v3(-LEAN_D, w - 10, t)]))
    if (s.order.includes("C")) pts.push(v3(l * 0.5, 0, t * 0.5))
    const done = !this.animating
    if (done) for (const p of pts) this.fixture.add(this.dot(p.applyMatrix4(m)))

    // Once A, B and C are all in, the frame is complete: the zone is fixed to the fixture.
    if (s.order.length === 3 && done) {
      const ok = setupError(s.order) <= TOL.pos
      const r = (MAG * TOL.pos) / 2
      const cyl = new THREE.CylinderGeometry(r, r, t + 22, 48, 1, true)
      cyl.rotateX(Math.PI / 2)
      cyl.translate(HOLE.x, HOLE.y, (t + 18) / 2)
      this.zones.add(new THREE.Mesh(cyl, kit.planeHover))
      const a = v3(HOLE.x + MAG * SETUP.ex, HOLE.y + MAG * SETUP.ey, -4).applyMatrix4(m)
      const b = v3(HOLE.x + MAG * SETUP.ex, HOLE.y + MAG * SETUP.ey, t + 4).applyMatrix4(m)
      this.zones.add(line([a, b], kit.sketch))
      const tag = label(`位置度误差 Ø${setupError(s.order).toFixed(2)} · ${ok ? "合格" : "超差"}`, v3(HOLE.x, HOLE.y, t + 26), ok ? "border-transparent bg-success-subtle text-success font-sans" : "border-destructive text-destructive font-sans")
      this.zones.add(tag)
    }
    this.datumSymbols(true)
  }

  /** Step 6: the envelope at maximum material size (ASME Rule #1), and two-point sizes (GB/ISO). */
  private renderEnvelope() {
    const s = this.state
    const kit = this.v.kit
    const { l, w, t } = PART
    const sh = this.shape()
    if (s.standard === "asme") {
      const top = t + MAG * SIZE_TOL
      for (const z of [0, top]) this.zones.add(...this.quad([v3(-4, -4, z), v3(l + 4, -4, z), v3(l + 4, w + 4, z), v3(-4, w + 4, z)]))
      const n = label(`最大实体边界 ${(t + SIZE_TOL).toFixed(1)}`, v3(l + 4, -4, top), "border-transparent bg-transparent font-sans text-muted-foreground")
      n.center.set(0, 0.5)
      this.notes.add(n)
    } else {
      for (const x of [12, l / 2, l - 12]) {
        const a = v3(x, -1, sh.bottom(x, 0))
        const b = v3(x, -1, sh.top(x, 0))
        this.notes.add(line([a, b], kit.sketch))
        const n = label("20.00", a.clone().add(b).multiplyScalar(0.5).add(v3(0, -2, 0)), "border-primary text-primary")
        this.notes.add(n)
      }
    }
  }

  /** A frame on a leader, coloured by its verdict. */
  private frameAt(kind: FrameKind, at: THREE.Vector3, to: THREE.Vector3, ok: boolean) {
    this.notes.add(line([at, to], this.v.kit.dimension))
    const o = new CSS2DObject(frameEl(kind, { active: false, clickable: false, tone: ok ? "ok" : "bad" }))
    o.position.copy(at)
    this.notes.add(o)
  }

  private quad(c: THREE.Vector3[], mat: THREE.Material = this.v.kit.planeHover) {
    const g = new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[0], c[2], c[3]])
    g.computeVertexNormals()
    const fill = new THREE.Mesh(g, mat)
    fill.raycast = () => {}
    const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(c), this.v.kit.planeEdge)
    border.raycast = () => {}
    return [fill, border]
  }

  /** A contact point, drawn over the part so the ones underneath still show. */
  private dot(p: THREE.Vector3) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), this.dotMat)
    m.position.copy(p)
    m.renderOrder = 10
    return m
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000
