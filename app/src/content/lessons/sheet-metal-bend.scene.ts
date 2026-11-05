import * as THREE from "three"
import { edgeLine, edges, face, label, line, linearDim } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 4.3.1–4.3.3 「钣金：折弯、K 因子与展开」: an L bracket bent up from a
 * flat blank. The base flange lies on the top plane; the bend has inside
 * radius R and the sheet thickness T; the neutral layer sits K·T from the
 * inside surface. Folding conserves the neutral length: the press brake
 * draws material from the flange into the bend, so the flat pattern is
 * a + BA + b at every moment of the animation.
 */
export type SheetState = {
  step: number
  T: number
  R: number
  K: number
  /** Design bend angle, degrees. */
  theta: number
  /** 0 flat … 1 bent to theta. */
  fold: number
  /** Straight lengths of the base flange and the upright flange (tangent line to edge), mm. */
  a: number
  b: number
  /** The flange covers only part of the edge: the bend ends run into unbent material. */
  partial: boolean
  relief: boolean
  triedK: boolean
  kHigh: boolean
  unfolded: boolean
  triedShort: boolean
}

export const WIDTH = { flange: 40, plate: 70 }

/** Bend allowance: neutral-layer length through the bend, BA = π · (R + K·T) · θ / 180. */
export const bendAllowance = (s: Pick<SheetState, "R" | "K" | "T" | "theta">) => (Math.PI * (s.R + s.K * s.T) * s.theta) / 180
export const flatLength = (s: SheetState) => s.a + bendAllowance(s) + s.b

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export class SheetScene extends LessonScene<SheetState> {
  private body = new THREE.Group()
  private notes = new THREE.Group()

  constructor(v: Viewer, emit: (s: SheetState) => void) {
    super(v, emit, {
      step: 0,
      T: 1.5,
      R: 2,
      K: 0.4,
      theta: 90,
      fold: 0,
      a: 40,
      b: 25,
      partial: false,
      relief: false,
      triedK: false,
      kHigh: false,
      unfolded: false,
      triedShort: false,
    })
    v.setGrid(100, 10)
    this.root.add(this.body, this.notes)
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("fold")
    const patch: Partial<SheetState> = { step, partial: step >= 4 }
    if (step === 0) patch.fold = 0
    if (step >= 1) patch.fold = 1
    if (step < 4) patch.relief = false
    if (step === 5) patch.relief = true
    if (step !== 5 && s.b < 4 * s.T) patch.b = 25
    this.set(patch)
    const v = this.v
    const bend = V(s.a + s.R / 2, -WIDTH.flange / 2, s.T + s.R / 2)
    if (step === 1 || step === 2) v.setView("front", { target: bend, distance: 38 })
    else if (step === 3) v.flyTo(V(70, -110, 150), V(38, 0, 0), 900)
    else if (step === 4) v.flyTo(V(120, -125, 90), V(38, -10, 6), 900)
    else v.flyTo(V(110, -130, 90), V(32, 0, 10), 900)
  }

  // ------------------------------------------------------------ actions

  setFold(fold: number) {
    this.set({ fold })
  }

  playFold() {
    const from = this.state.fold >= 1 ? 0 : this.state.fold
    this.v.tweens.run(1300, (k) => this.setFold(from + (1 - from) * k), { tag: "fold" })
  }

  /** Unfold to the flat pattern, or fold back. */
  toggleFlat() {
    const from = this.state.fold
    const to = from > 0.5 ? 0 : 1
    this.v.tweens.run(1200, (k) => this.set({ fold: from + (to - from) * k }), { tag: "fold" }).then(() => {
      if (to === 0 && this.state.fold === 0) this.set({ unfolded: true })
    })
  }

  setParam(key: "T" | "R" | "K" | "b", value: number) {
    const s = this.state
    const patch: Partial<SheetState> = { [key]: value }
    if (key === "K") Object.assign(patch, { triedK: true, kHigh: s.kHigh || value >= 0.48 })
    if (key === "b" && value < 4 * s.T) patch.triedShort = true
    this.set(patch)
  }

  /** Predict reveal: sweep K up to 0.5 so the flat length visibly grows. */
  raiseK() {
    const from = this.state.K
    this.v.tweens.run(900, (k) => this.setParam("K", Math.round((from + (0.5 - from) * k) * 100) / 100), { tag: "k" })
  }

  setRelief(relief: boolean) {
    this.set({ relief })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.body)
    this.clear(this.notes)
    const { T, R, K, a, b } = s
    const wf = WIDTH.flange
    const W = s.partial ? WIDTH.plate : wf
    const theta = THREE.MathUtils.degToRad(s.theta)
    const phi = theta * s.fold
    const rn = R + K * T
    // Material not yet drawn into the bend stays on the flange.
    const bStraight = b + rn * (theta - phi)
    const e = R + T

    // Base flange: a plate in XY, thickness along Z; with a partial flange the side lands run on past the bend.
    const base = new THREE.Shape()
    const pts: [number, number][] = []
    const hw = W / 2
    const hf = wf / 2
    if (!s.partial) pts.push([0, -hw], [a, -hw], [a, hw], [0, hw])
    else if (!s.relief) pts.push([0, -hw], [a + e, -hw], [a + e, -hf], [a, -hf], [a, hf], [a + e, hf], [a + e, hw], [0, hw])
    else {
      const wr = T
      const d = 1.5 * T
      pts.push([0, -hw], [a + e, -hw], [a + e, -hf - wr], [a - d, -hf - wr], [a - d, -hf], [a, -hf], [a, hf], [a - d, hf], [a - d, hf + wr], [a + e, hf + wr], [a + e, hw], [0, hw])
    }
    base.moveTo(...pts[0])
    for (const p of pts.slice(1)) base.lineTo(...p)
    base.closePath()
    const baseGeo = new THREE.ExtrudeGeometry(base, { depth: T, bevelEnabled: false })
    this.addSolid(baseGeo, "model")

    // Bend + upright flange: one profile in XZ, extruded across the flange width.
    const prof = bendProfile(a, T, R, phi, bStraight)
    const shape = new THREE.Shape(prof.map(([x, z]) => new THREE.Vector2(x, z)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: wf, bevelEnabled: false, curveSegments: 4 })
    g.rotateX(Math.PI / 2)
    g.translate(0, hf, 0)
    this.addSolid(g, s.step === 0 || s.step === 3 ? "highlight" : "model")

    // Bend lines: the tangent edges of the bend zone, and its centre line on the flat pattern.
    const yEdge = (x: number, z: number) => [V(x, -hf, z), V(x, hf, z)]
    if (phi > 1e-3) {
      const endIn = onArc(a, T, R, phi, R)
      this.notes.add(edgeLine(yEdge(a, T), kit, true), edgeLine(yEdge(endIn[0], endIn[1]), kit, true))
    } else {
      const BA = rn * theta
      const top = T + 0.05
      this.notes.add(line(yEdge(a, top), kit.construction), line(yEdge(a + BA, top), kit.construction))
      this.notes.add(line(yEdge(a + BA / 2, top), kit.path))
      if (s.step >= 3) {
        this.notes.add(label("折弯线", V(a + BA / 2, hf + 4, top), "font-sans"))
        const L = flatLength(s)
        this.notes.add(linearDim(kit, V(0, -hw, top), V(L, -hw, top), V(0, -1, 0), 10, `展开长 ${L.toFixed(2)}`))
      }
    }

    // Neutral layer, drawn on the front side face: through the base, the bend and the flange.
    if (s.step >= 1 && s.step <= 3) {
      const y = -hf - 0.06
      const nl: THREE.Vector3[] = [V(0, y, T - K * T), V(a, y, T - K * T)]
      const n = 24
      for (let i = 1; i <= n; i++) {
        const p = onArc(a, T, R, (phi * i) / n, rn)
        nl.push(V(p[0], y, p[1]))
      }
      const end = onArc(a, T, R, phi, rn)
      nl.push(V(end[0] + Math.cos(phi) * bStraight, y, end[1] + Math.sin(phi) * bStraight))
      this.notes.add(line(nl, kit.path))
      if (s.step <= 2 && s.fold > 0.5) {
        const mid = phi / 2
        const lab = (r: number, text: string, cls: string) => {
          const p = onArc(a, T, R, mid, r)
          return label(text, V(p[0], y - 0.5, p[1]), `border-transparent bg-transparent font-sans ${cls}`)
        }
        const inside = lab(R - 0.3, "内侧受压", "text-muted-foreground")
        inside.center.set(1, 1)
        const outside = lab(R + T + 0.3, "外侧受拉", "text-muted-foreground")
        outside.center.set(0, 0)
        const neutral = label(`虚线：中性层，距内侧 K·T = ${(K * T).toFixed(2)} mm`, V(a - 1, y - 0.5, -1.2), "border-transparent bg-transparent font-sans text-primary")
        neutral.center.set(0.5, 0)
        this.notes.add(inside, outside, neutral)
      }
    }

    // Checks.
    if (s.partial && !s.relief) {
      for (const sy of [-1, 1]) this.notes.add(label("撕裂 · 鼓包", V(a + e / 2, sy * hf, T + 1), "border-warning text-warning font-sans"))
    }
    if (b < 4 * T && s.step >= 5) {
      const tipBase = onArc(a, T, R, phi, R + T)
      this.notes.add(label(`法兰 ${b} < 4T = ${(4 * T).toFixed(1)}`, V(tipBase[0] + 6, -hf, tipBase[1] + b / 2), "border-warning text-warning font-sans"))
    }
    this.v.invalidate()
  }

  private addSolid(geo: THREE.BufferGeometry, role: "model" | "highlight") {
    const m = face(geo, this.v.kit, { feature: "sheet", role, edges: false })
    m.add(edges(geo, this.v.kit, 20))
    this.body.add(m)
  }
}

/** Point at bend angle φ on a circle of radius r around the bend centre (a, T + R). */
function onArc(a: number, T: number, R: number, phi: number, r: number): [number, number] {
  return [a + Math.sin(phi) * r, T + R - Math.cos(phi) * r]
}

/** Closed XZ profile of bend + flange: inside surface out to the flange tip, outside surface back. */
function bendProfile(a: number, T: number, R: number, phi: number, bStraight: number): [number, number][] {
  const n = Math.max(1, Math.ceil((phi / (Math.PI / 2)) * 18))
  const inner: [number, number][] = []
  const outer: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const p = (phi * i) / n
    inner.push(onArc(a, T, R, p, R))
    outer.push(onArc(a, T, R, p, R + T))
  }
  const d: [number, number] = [Math.cos(phi), Math.sin(phi)]
  const ie = inner[inner.length - 1]
  const oe = outer[outer.length - 1]
  inner.push([ie[0] + d[0] * bStraight, ie[1] + d[1] * bStraight])
  outer.push([oe[0] + d[0] * bStraight, oe[1] + d[1] * bStraight])
  if (phi < 1e-6) return [inner[0], inner[inner.length - 1], outer[outer.length - 1], outer[0]]
  return [...inner, ...outer.reverse()]
}
