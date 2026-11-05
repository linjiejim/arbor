import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { label, line } from "@/three/build"
import { arc, type V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { addv, bezierSample, cross, dot, g2CornerBlend, length, sampleBezier, scale, sub, unit, type CurveSample } from "./curvature-continuity.bezier"

/**
 * 5.1.3–5.1.5 「曲率梳与 G0 / G1 / G2 连续」: two cubic Béziers on the top
 * plane meeting at a joint. Curvature combs on both; a G0 / G1 / G2 switch
 * that drives curve B's first control points from curve A (like Rhino's
 * MatchCrv); then a rounded rectangle with circular corners (G1) against
 * curvature-continuous blends (G2).
 */
export type Continuity = "G0" | "G1" | "G2"
export type CornerKind = "arc" | "blend"
type HandleKey = "a0" | "a1" | "a2" | "a3" | "b1" | "b2" | "b3"

export type CurvatureState = {
  step: number
  a: V2[]
  b: V2[]
  mode: Continuity
  combScale: number
  corner: CornerKind
  /** Derived at the joint. */
  angleDiff: number
  kA: number
  kB: number
  inflection: boolean
  draggedB: boolean
  draggedInG2: boolean
  triedArc: boolean
  triedBlend: boolean
}

const A0: V2[] = [
  [-95, -18],
  [-68, 24],
  [-30, 32],
  [0, 12],
]
const B0: V2[] = [
  [0, 12],
  [10, -14],
  [36, -50],
  [88, -62],
]

const RECT = { w: 150, h: 90, r: 22 }
/** Longest comb tooth drawn, mm: spikes near a cusp would swamp the view. */
const MAX_TOOTH = 70

const copy = (pts: V2[]) => pts.map((p) => [p[0], p[1]] as V2)

/** Drive curve B's leading control points from curve A for the chosen continuity. */
export function constrain(a: V2[], bIn: V2[], mode: Continuity): V2[] {
  const b = copy(bIn)
  b[0] = [a[3][0], a[3][1]]
  if (mode === "G0") return b
  const u = unit(sub(a[3], a[2]))
  const n: V2 = [-u[1], u[0]]
  const f = Math.max(4, length(sub(bIn[1], bIn[0])))
  b[1] = addv(b[0], scale(u, f))
  if (mode === "G2") {
    // κA(1) = 2/3 · hA / |a3 − a2|², κB(0) = 2/3 · hB / |b1 − b0|², h = signed distance of the third point from the tangent line.
    const dA = Math.max(1e-6, length(sub(a[3], a[2])))
    const hA = cross(u, sub(a[1], a[2]))
    const hB = hA * (f / dA) ** 2
    const along = dot(sub(bIn[2], bIn[1]), u)
    b[2] = addv(addv(b[1], scale(u, along)), scale(n, hB))
  }
  return b
}

function derive(a: V2[], b: V2[]) {
  const ea = bezierSample(a, 1)
  const sb = bezierSample(b, 0)
  const c = Math.max(-1, Math.min(1, dot(ea.tangent, sb.tangent)))
  const samples = sampleBezier(a, 60)
  let inflection = false
  for (let i = 1; i < samples.length; i++) if (Math.sign(samples[i].k) !== Math.sign(samples[i - 1].k) && Math.abs(samples[i].k) > 1e-5) inflection = true
  return { angleDiff: THREE.MathUtils.radToDeg(Math.acos(c)), kA: ea.k, kB: sb.k, inflection }
}

export class CurvatureScene extends LessonScene<CurvatureState> {
  private curves = new THREE.Group()
  private combs = new THREE.Group()
  private marks = new THREE.Group()
  private handles = new Map<HandleKey, CSS2DObject>()

  constructor(v: Viewer, emit: (s: CurvatureState) => void) {
    const d = derive(A0, B0)
    super(v, emit, {
      step: 0,
      a: copy(A0),
      b: copy(B0),
      mode: "G0",
      combScale: 500,
      corner: "arc",
      ...d,
      draggedB: false,
      draggedInG2: false,
      triedArc: false,
      triedBlend: false,
    })
    v.setGrid(150, 10)
    this.root.add(this.combs, this.curves, this.marks)
    for (const k of ["a0", "a1", "a2", "a3", "b1", "b2", "b3"] as HandleKey[]) {
      const h = this.handle(k)
      this.handles.set(k, h)
      this.root.add(h)
    }
  }

  enter(step: number) {
    const patch: Partial<CurvatureState> = { step }
    if (step === 1 && this.state.mode !== "G0") patch.mode = "G0"
    if (step === 3 && this.state.mode === "G0") patch.mode = "G1"
    if (step === 4) patch.triedArc = this.state.triedArc || this.state.corner === "arc"
    this.update(patch)
    const target = step === 4 ? new THREE.Vector3(0, 0, 0) : step === 0 ? new THREE.Vector3(-45, 4, 0) : new THREE.Vector3(0, -14, 0)
    this.v.setView("top", { target, distance: step === 0 ? 260 : 330 })
  }

  // ------------------------------------------------------------ actions

  setMode(mode: Continuity) {
    const from = copy(this.state.b)
    const to = constrain(this.state.a, from, mode)
    // Show the switch first, then move B's control points into place: the match itself is the lesson.
    this.set({ mode })
    this.v.tweens
      .run(
        650,
        (k) => {
          this.state.b = from.map((p, i) => [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k] as V2)
          this.render()
        },
        { tag: "match" },
      )
      .then(() => this.update({ mode, b: to }))
  }

  setCombScale(combScale: number) {
    this.set({ combScale })
  }

  setCorner(corner: CornerKind) {
    this.set({ corner, triedArc: this.state.triedArc || corner === "arc", triedBlend: this.state.triedBlend || corner === "blend" })
  }

  reset() {
    this.update({ a: copy(A0), b: constrain(A0, B0, this.state.mode) })
  }

  /** Apply the continuity constraint and refresh the joint readouts. */
  private update(patch: Partial<CurvatureState>) {
    const next = { ...this.state, ...patch }
    const b = constrain(next.a, next.b, next.mode)
    this.set({ ...patch, b, ...derive(next.a, b) })
  }

  private drag(key: HandleKey, p: V2) {
    const s = this.state
    const a = copy(s.a)
    const b = copy(s.b)
    const patch: Partial<CurvatureState> = {}
    if (key === "a3") {
      // Moving the joint carries both tangent arms with it.
      const d = sub(p, a[3])
      a[3] = p
      a[2] = addv(a[2], d)
      b[1] = addv(b[1], d)
    } else if (key[0] === "a") a[Number(key[1])] = p
    else {
      const i = Number(key[1])
      const u = unit(sub(a[3], a[2]))
      if (i === 1 && s.mode !== "G0") b[1] = addv(b[0], scale(u, Math.max(4, dot(sub(p, b[0]), u))))
      else if (i === 2 && s.mode === "G2") b[2] = addv(b[1], scale(u, dot(sub(p, b[1]), u)))
      else b[i] = p
      patch.draggedB = true
    }
    if (s.mode === "G2" && s.step >= 3) patch.draggedInG2 = true
    this.update({ ...patch, a, b })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.curves)
    this.clear(this.combs)
    this.clear(this.marks)
    const z = 0.05
    const P = (p: V2, dz = z) => new THREE.Vector3(p[0], p[1], dz)

    if (s.step === 4) {
      const loop = roundedRectLoop(s.corner)
      this.curves.add(line(loop.map((q) => P(q.p)), kit.sketchDefined))
      this.addComb(loop, s.combScale)
      for (const t of loop.filter((q) => q.joint)) this.marks.add(dot3(P(t.p, 0.1), kit))
      const tl = new THREE.Vector3(0, -RECT.h / 2 - 8, 0)
      this.marks.add(label(s.corner === "arc" ? "直线 + 1/4 圆弧：G1" : "直线 + G2 混接", tl, "border-transparent bg-transparent font-sans text-muted-foreground"))
    } else {
      const showB = s.step >= 1
      const curves = showB ? [s.a, s.b] : [s.a]
      for (const pts of curves) {
        const smp = sampleBezier(pts, 90)
        this.curves.add(line(smp.map((q) => P(q.p)), kit.sketchDefined))
        this.curves.add(line(pts.map((q) => P(q, 0.02)), kit.construction))
        this.addComb(smp, s.combScale)
      }
      this.marks.add(label("A", P(addv(s.a[0], [-6, 4])), "border-transparent bg-transparent font-sans text-muted-foreground"))
      if (showB) {
        this.marks.add(label("B", P(addv(s.b[3], [6, 4])), "border-transparent bg-transparent font-sans text-muted-foreground"))
        const tone = s.mode === "G0" && s.angleDiff > 0.5 ? "border-warning text-warning" : "border-primary text-primary"
        this.marks.add(label(`接点 · ${s.mode}`, P(addv(s.a[3], [-24, -14])), tone))
      }
    }

    const driven = (k: HandleKey) => (k === "b1" && s.mode !== "G0") || (k === "b2" && s.mode === "G2")
    for (const [k, h] of this.handles) {
      const isA = k[0] === "a"
      h.visible = s.step < 4 && (isA || s.step >= 1)
      const p = isA ? s.a[Number(k[1])] : s.b[Number(k[1])]
      h.position.set(p[0], p[1], 0.1)
      h.element.className = handleClass(isA, driven(k))
      h.element.title = driven(k) ? `由 ${s.mode} 约束：只能沿切线方向移动` : k === "a3" ? "拖动接点" : "拖动控制点"
    }
    this.v.invalidate()
  }

  /** Porcupine plot: a tooth along the normal, length ∝ curvature, on the convex side; the envelope joins the tips. */
  private addComb(smp: CurveSample[], k: number) {
    const kit = this.v.kit
    const teeth: number[] = []
    const tips: THREE.Vector3[] = []
    for (const q of smp) {
      const len = Math.max(-MAX_TOOTH, Math.min(MAX_TOOTH, q.k * k))
      const tip = new THREE.Vector3(q.p[0] - q.normal[0] * len, q.p[1] - q.normal[1] * len, 0.03)
      teeth.push(q.p[0], q.p[1], 0.03, tip.x, tip.y, tip.z)
      tips.push(tip)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(teeth, 3))
    const l = new THREE.LineSegments(g, kit.edgeSoft)
    l.raycast = () => {}
    this.combs.add(l)
    // A jump in curvature shows as consecutive samples at the same point: draw each run separately so the step stays visible.
    let run: THREE.Vector3[] = []
    smp.forEach((q, i) => {
      run.push(tips[i])
      const next = smp[i + 1]
      const split = next && Math.hypot(next.p[0] - q.p[0], next.p[1] - q.p[1]) < 1e-6
      if (split || !next) {
        if (run.length > 1) this.combs.add(line(run, kit.sketchThin))
        run = []
      }
    })
  }

  private handle(key: HandleKey) {
    const el = document.createElement("div")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        this.drag(key, [Math.max(-140, Math.min(140, hit.x)), Math.max(-90, Math.min(90, hit.y))])
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

function handleClass(isA: boolean, driven: boolean) {
  const base = "interactive size-3.5 border-2 bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
  if (driven) return `${base} rounded-xs border-primary`
  return `${base} rounded-full ${isA ? "border-primary" : "border-foreground"}`
}

function dot3(p: THREE.Vector3, kit: Viewer["kit"]) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), kit.modelDark)
  m.position.copy(p)
  return m
}

type LoopSample = CurveSample & { joint?: boolean }

/** A rounded rectangle walked counter-clockwise: lines plus either quarter arcs (G1) or G2 corner blends. */
export function roundedRectLoop(kind: CornerKind): LoopSample[] {
  const { w, h, r } = RECT
  const hw = w / 2
  const hh = h / 2
  const corners: { c: V2; din: V2; dout: V2 }[] = [
    { c: [hw, -hh], din: [1, 0], dout: [0, 1] },
    { c: [hw, hh], din: [0, 1], dout: [-1, 0] },
    { c: [-hw, hh], din: [-1, 0], dout: [0, -1] },
    { c: [-hw, -hh], din: [0, -1], dout: [1, 0] },
  ]
  const reach = kind === "arc" ? r : 1.5 * r
  const out: LoopSample[] = []
  const pushLine = (p0: V2, p1: V2) => {
    const t = unit(sub(p1, p0))
    const n: V2 = [-t[1], t[0]]
    for (let i = 0; i <= 12; i++) {
      const k = i / 12
      out.push({ p: [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k], tangent: t, normal: n, k: 0, joint: i === 0 || i === 12 })
    }
  }
  corners.forEach((c, i) => {
    const prev = corners[(i + 3) % 4]
    const start: V2 = addv(prev.c, scale(prev.dout, reach))
    const end: V2 = sub(c.c, scale(c.din, reach))
    pushLine(start, end)
    if (kind === "arc") {
      const centre = addv(end, scale([-c.din[1], c.din[0]], r))
      const a0 = Math.atan2(end[1] - centre[1], end[0] - centre[0])
      arc(centre, r, a0, a0 + Math.PI / 2, 24).forEach((p, j) => {
        const ang = a0 + (Math.PI / 2) * (j / 24)
        const t: V2 = [-Math.sin(ang), Math.cos(ang)]
        out.push({ p, tangent: t, normal: [-t[1], t[0]], k: 1 / r })
      })
    } else sampleBezier(g2CornerBlend(c.c, c.din, c.dout, r), 36).forEach((q) => out.push(q))
  })
  return out
}
