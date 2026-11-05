import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { datumPlane, edgeLine, face, label, line } from "@/three/build"
import { capLoop, ellipsePoints, sweepEllipse, type V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 1.2.8 「扫掠与放样」.
 * Sweep: a circular profile follows a path sketched on the front plane (XZ).
 * The learner scrubs the process, drags path points, and makes a bend
 * tighter than the profile radius (local self-intersection).
 * Loft: square → circle (optionally through a third section), then the top
 * section's start point is rotated (the loft twists), then a guide curve
 * bends the sides.
 */
export type SweepLoftState = {
  step: number
  /** Path control points on the front plane, [x, z]. */
  path: V2[]
  radius: number
  /** Sweep process, %. */
  sweep: number
  /** Smallest radius of curvature along the path, mm. */
  minBend: number
  dragged: boolean
  triedTight: boolean
  /** Loft process, %. */
  loft: number
  sections: 2 | 3
  /** Rotation of the top section's start point, degrees. */
  twist: number
  triedTwist: boolean
  /** Guide curve bulge, mm. */
  bulge: number
  triedBulge: boolean
}

const PATH: V2[] = [
  [-55, 12],
  [-22, 14],
  [8, 34],
  [22, 64],
  [52, 76],
]
const N = 64
const ROWS = 48
const LOFT_H = 60
const OVERVIEW = new THREE.Vector3(150, -230, 140)

export const isTight = (s: SweepLoftState) => s.minBend < s.radius

export class SweepLoftScene extends LessonScene<SweepLoftState> {
  private sweepGroup = new THREE.Group()
  private loftGroup = new THREE.Group()
  private front: THREE.Group
  private handles: CSS2DObject[] = []

  constructor(v: Viewer, emit: (s: SweepLoftState) => void) {
    const path = PATH.map((p) => [...p] as V2)
    super(v, emit, {
      step: 0,
      path,
      radius: 7,
      sweep: 0,
      minBend: minBend(curveOf(path)).r,
      dragged: false,
      triedTight: false,
      loft: 0,
      sections: 2,
      twist: 0,
      triedTwist: false,
      bulge: 0,
      triedBulge: false,
    })
    v.setGrid(120, 10)
    this.front = datumPlane(v.kit, "XZ", 150, "前视基准面 XZ", [1, -1])
    this.front.position.set(0, 0, 45)
    this.root.add(this.front, this.sweepGroup, this.loftGroup)
    this.handles = PATH.map((_, i) => this.handle(i))
    this.root.add(...this.handles)
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<SweepLoftState> = { step }
    if (step >= 1 && step <= 2) patch.sweep = 100
    if (step === 3) Object.assign(patch, { twist: 0, bulge: 0 })
    if (step === 4) Object.assign(patch, { loft: 100, twist: 0, bulge: 0 })
    if (step === 5) Object.assign(patch, { loft: 100, twist: 0 })
    if (step <= 1 && isTight(s)) {
      // Back to a path that sweeps cleanly.
      const path = PATH.map((p) => [...p] as V2)
      Object.assign(patch, { path, minBend: minBend(curveOf(path)).r, radius: 7 })
    }
    this.set(patch)
    const v = this.v
    if (step === 0) v.flyTo(OVERVIEW.clone(), new THREE.Vector3(0, 0, 40), 800)
    else if (step <= 2) v.setView("front", { target: new THREE.Vector3(0, 0, 42), distance: 300 })
    else v.flyTo(new THREE.Vector3(150, -200, 150), new THREE.Vector3(0, 0, 28), 800)
  }

  // ------------------------------------------------------------ actions

  setSweep(p: number) {
    this.set({ sweep: Math.round(p) })
  }

  playSweep() {
    this.v.tweens.run(1300, (k) => this.setSweep(100 * k), { tag: "sweep" })
  }

  setRadius(r: number) {
    this.set({ radius: r, triedTight: this.state.triedTight || r > this.state.minBend })
  }

  /** Pull the middle point in to make the tightest bend visible (the predict reveal). */
  tighten() {
    const from = this.state.path.map((p) => [...p] as V2)
    const to = from.map((p) => [...p] as V2)
    to[2] = [-10, 46]
    to[3] = [16, 38]
    this.v.tweens.run(
      900,
      (k) => {
        const path = from.map((p, i) => [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k] as V2)
        this.setPath(path)
      },
      { tag: "path" },
    )
  }

  resetPath() {
    this.setPath(PATH.map((p) => [...p] as V2))
  }

  setLoft(p: number) {
    this.set({ loft: Math.round(p) })
  }

  playLoft() {
    this.v.tweens.run(1300, (k) => this.setLoft(100 * k), { tag: "loft" })
  }

  setSections(n: 2 | 3) {
    this.set({ sections: n })
  }

  setTwist(deg: number, animate = false) {
    if (!animate) return this.set({ twist: Math.round(deg), triedTwist: this.state.triedTwist || Math.abs(deg) >= 30 })
    const from = this.state.twist
    this.v.tweens.run(1100, (k) => this.setTwist(from + (deg - from) * k), { tag: "twist" })
  }

  setBulge(mm: number) {
    this.set({ bulge: mm, triedBulge: this.state.triedBulge || Math.abs(mm) >= 4 })
  }

  private setPath(path: V2[]) {
    const minR = minBend(curveOf(path)).r
    this.set({ path, minBend: minR, triedTight: this.state.triedTight || minR < this.state.radius })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const sweepStep = s.step <= 2
    this.sweepGroup.visible = sweepStep
    this.loftGroup.visible = !sweepStep
    this.front.visible = sweepStep
    this.handles.forEach((h, i) => {
      h.visible = (s.step === 1 || s.step === 2) && i > 0
      h.position.set(s.path[i][0], -0.2, s.path[i][1])
    })
    if (sweepStep) this.renderSweep()
    else this.renderLoft()
    this.v.invalidate()
  }

  private renderSweep() {
    const s = this.state
    const kit = this.v.kit
    const g = this.sweepGroup
    this.clear(g)
    const curve = curveOf(s.path)
    const tight = isTight(s)
    // The path (dashed, it's a sketch used as a path) and the profile at its start.
    g.add(line(curve.getPoints(160), kit.path))
    const t0 = curve.getTangentAt(0).normalize()
    const B = new THREE.Vector3(0, 1, 0)
    const N0 = new THREE.Vector3().crossVectors(B, t0).normalize()
    const p0 = curve.getPointAt(0)
    g.add(line(ellipsePoints(p0, N0, B, s.radius, s.radius), kit.sketch))
    if (s.step === 0) g.add(label("截面", p0.clone().addScaledVector(N0, s.radius + 6), "border-transparent bg-transparent font-sans text-faint-foreground"))
    if (s.step === 0) g.add(label("路径", curve.getPointAt(0.55).add(new THREE.Vector3(10, 0, -4)), "border-transparent bg-transparent font-sans text-faint-foreground"))

    if (s.sweep > 0) {
      const geo = sweepEllipse(curve, { a: s.radius, b: s.radius, binormal: B, tEnd: s.sweep / 100, tubular: 160, radial: 40 })
      g.add(face(geo, kit, { feature: "sweep", role: tight ? "ghost" : s.step === 0 ? "highlight" : "model", edges: false }))
    }

    if (s.step === 2) {
      // Osculating circle at the tightest bend, next to the profile radius.
      const m = minBend(curve)
      const c = new THREE.Vector3(m.center[0], 0, m.center[1])
      const ring: THREE.Vector3[] = []
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2
        ring.push(new THREE.Vector3(c.x + Math.cos(a) * m.r, -0.3, c.z + Math.sin(a) * m.r))
      }
      g.add(line(ring, kit.construction))
      const at = new THREE.Vector3(m.point[0], 0, m.point[1])
      g.add(
        label(
          tight ? `弯曲半径 R${fmt(m.r)} < 截面半径 R${fmt(s.radius)}：自交` : `最小弯曲半径 R${fmt(m.r)}`,
          at.clone().add(new THREE.Vector3(0, 0, -s.radius - 10)),
          tight ? "border-destructive text-destructive font-sans" : "font-sans",
        ),
      )
    }
  }

  private renderLoft() {
    const s = this.state
    const kit = this.v.kit
    const g = this.loftGroup
    this.clear(g)
    const secs = this.sections()
    const k = s.loft / 100
    // Section sketches and their start points.
    for (const sec of secs) {
      g.add(line([...sec, sec[0]], kit.sketch))
      if (s.step >= 4) g.add(dot(sec[0]))
    }
    if (s.step >= 4) {
      const conn: THREE.Vector3[] = []
      for (let i = 0; i <= ROWS; i++) conn.push(this.loftPoint(secs, i / ROWS, 0))
      g.add(line(conn, s.step === 5 ? kit.sketch : kit.path))
      g.add(label(s.step === 5 ? "引导线" : "起点连线", conn[Math.round(ROWS * 0.55)].clone().add(new THREE.Vector3(8, 0, 0)), "border-transparent bg-transparent font-sans text-faint-foreground"))
    }
    if (k <= 0) return

    const rows = Math.max(1, Math.round(ROWS * k))
    const pos: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j < N; j++) {
        const p = this.loftPoint(secs, i / ROWS, j)
        pos.push(p.x, p.y, p.z)
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < N; j++) {
        const j2 = (j + 1) % N
        idx.push(i * N + j, i * N + j2, (i + 1) * N + j2, i * N + j, (i + 1) * N + j2, (i + 1) * N + j)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const role = s.step === 3 ? "highlight" : "model"
    g.add(face(geo, kit, { feature: "loft", role, edges: false }))
    g.add(face(capLoop(secs[0], true), kit, { feature: "loft", role }))
    const topRow: THREE.Vector3[] = []
    for (let j = 0; j <= N; j++) topRow.push(this.loftPoint(secs, rows / ROWS, j % N))
    g.add(edgeLine(topRow, kit))
    if (k >= 1) g.add(face(capLoop(topRow.slice(0, N)), kit, { feature: "loft", role }))
    // A few rulings make the twist readable.
    for (let j = 0; j < N; j += 8) {
      const r: THREE.Vector3[] = []
      for (let i = 0; i <= rows; i++) r.push(this.loftPoint(secs, i / ROWS, j))
      g.add(edgeLine(r, kit, true))
    }
  }

  /** Sections, each resampled to N points from its start point, counter-clockwise seen from above. */
  private sections(): THREE.Vector3[][] {
    const s = this.state
    const start = THREE.MathUtils.degToRad(-45)
    const bottom = squarePoints(40, 0)
    const top = circlePoints(20, LOFT_H, start + THREE.MathUtils.degToRad(s.twist))
    return s.sections === 3 ? [bottom, circlePoints(12, LOFT_H / 2, start), top] : [bottom, top]
  }

  /** Point j at height fraction t: linear between two sections, a smooth quadratic through three; plus the guide's bulge. */
  private loftPoint(secs: THREE.Vector3[][], t: number, j: number) {
    let p: THREE.Vector3
    if (secs.length === 2) p = secs[0][j].clone().lerp(secs[1][j], t)
    else {
      const [a, b, c] = [secs[0][j], secs[1][j], secs[2][j]]
      p = a
        .clone()
        .multiplyScalar(2 * t * t - 3 * t + 1)
        .addScaledVector(b, -4 * t * t + 4 * t)
        .addScaledVector(c, 2 * t * t - t)
    }
    const bulge = this.state.step === 5 ? this.state.bulge : 0
    if (bulge) {
      const r = Math.hypot(p.x, p.y) || 1
      const k = 1 + (bulge * 4 * t * (1 - t)) / r
      p.x *= k
      p.y *= k
    }
    return p
  }

  private handle(i: number) {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = "拖动路径点"
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      this.v.tweens.cancel("path")
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const path = this.state.path.map((p) => [...p] as V2)
        path[i] = [Math.round(clamp(hit.x, -70, 75)), Math.round(clamp(hit.z, 0, 100))]
        if (!this.state.dragged) this.set({ dragged: true })
        this.setPath(path)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }
}

function curveOf(path: V2[]) {
  return new THREE.CatmullRomCurve3(
    path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  )
}

/** Smallest radius of curvature along a planar (XZ) curve, where it occurs, and its centre. */
function minBend(curve: THREE.Curve<THREE.Vector3>) {
  let best = { r: Infinity, point: [0, 0] as V2, center: [0, 0] as V2 }
  const h = 1e-3
  for (let i = 1; i < 400; i++) {
    const t = i / 400
    const a = curve.getPoint(t - h)
    const b = curve.getPoint(t)
    const c = curve.getPoint(t + h)
    const d1x = (c.x - a.x) / (2 * h)
    const d1z = (c.z - a.z) / (2 * h)
    const d2x = (c.x - 2 * b.x + a.x) / (h * h)
    const d2z = (c.z - 2 * b.z + a.z) / (h * h)
    const cross = d1x * d2z - d1z * d2x
    const speed = Math.hypot(d1x, d1z)
    if (speed < 1e-9 || Math.abs(cross) < 1e-12) continue
    const r = speed ** 3 / Math.abs(cross)
    if (r < best.r) {
      // Centre: along the normal, towards the inside of the bend.
      const nx = -d1z / speed
      const nz = d1x / speed
      const sgn = Math.sign(cross)
      best = { r, point: [b.x, b.z], center: [b.x + nx * r * sgn, b.z + nz * r * sgn] }
    }
  }
  return best
}

function squarePoints(size: number, z: number) {
  const h = size / 2
  const corners = [
    new THREE.Vector3(h, -h, z),
    new THREE.Vector3(h, h, z),
    new THREE.Vector3(-h, h, z),
    new THREE.Vector3(-h, -h, z),
  ]
  const per = N / 4
  const out: THREE.Vector3[] = []
  for (let c = 0; c < 4; c++) for (let i = 0; i < per; i++) out.push(corners[c].clone().lerp(corners[(c + 1) % 4], i / per))
  return out
}

function circlePoints(r: number, z: number, start: number) {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < N; i++) {
    const a = start + (i / N) * Math.PI * 2
    out.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z))
  }
  return out
}

function dot(p: THREE.Vector3) {
  const el = document.createElement("div")
  el.className = "size-2.5 rounded-full border-2 border-background bg-primary"
  const o = new CSS2DObject(el)
  o.position.copy(p)
  return o
}

const fmt = (n: number) => (n >= 100 ? "∞" : n.toFixed(n < 10 ? 1 : 0))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
