import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import type { SketchPrimitive } from "@salusoft89/planegcs"
import { datumPlane, label, line, linearDim } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { loadSolver, type Param, type SolveResult, type Solver } from "./constraints-dof.solver"

/**
 * 1.1.2 · 1.1.3 「几何约束与自由度」: a free four-line profile on the top
 * plane, solved live by FreeCAD's sketch solver (planegcs, wasm). The learner
 * drags corners, adds constraints one at a time and watches the DOF fall to
 * 0, over-defines it (redundant vs conflicting), then compares three
 * constraint schemes for the same rectangle.
 */
export type ConsId = "h" | "v" | "par" | "perp" | "org" | "w" | "ht" | "eq" | "topSame" | "topOther"
export type Scheme = "corner" | "sym" | "ratio"

export type DofState = {
  step: number
  solver: "loading" | "ready" | "failed"
  loadMs: number | null
  pts: V2[]
  cons: ConsId[]
  dof: number
  status: SolveResult["status"]
  /** Constraints the solver flags: the conflicting group, or the redundant ones. */
  flagged: ConsId[]
  /** Steps on which the learner dragged a corner. */
  draggedOn: number[]
  /** A drag was refused because the sketch is fully defined. */
  locked: boolean
  triedRedundant: boolean
  triedConflict: boolean
  scheme: Scheme
  width: number
  /** Schemes in which the width was changed. */
  tried: Scheme[]
}

export const GEO: ConsId[] = ["h", "v", "par", "perp"]
export const WIDTH = 60
export const HEIGHT = 40
/** A rough, hand-drawn quadrilateral: what a learner sketches before any constraint. */
const FREE: V2[] = [
  [-26, -16],
  [30, -22],
  [24, 20],
  [-20, 14],
]
/** The rectangle every design-intent scheme starts from: 60 × 40, centred on the origin. */
const CENTRED: V2[] = [
  [-30, -20],
  [30, -20],
  [30, 20],
  [-30, 20],
]

export const CONS_NAMES: Record<ConsId, string> = {
  h: "水平：下边",
  v: "竖直：左边",
  par: "平行：上边 ∥ 下边",
  perp: "垂直：右边 ⊥ 下边",
  org: "重合：左下角 → 原点",
  w: `尺寸：宽 ${WIDTH}`,
  ht: `尺寸：高 ${HEIGHT}`,
  eq: "相等：左边 = 下边",
  topSame: `尺寸：上边 ${WIDTH}`,
  topOther: `尺寸：上边 ${WIDTH + 10}`,
}

const ALLOWED: ConsId[][] = [
  [],
  GEO,
  [...GEO, "org"],
  [...GEO, "org", "w", "ht", "eq"],
  [...GEO, "org", "w", "ht", "eq", "topSame", "topOther"],
]
const REQUIRED: ConsId[][] = [[], [], GEO, [...GEO, "org"], [...GEO, "org", "w"]]

function prim(id: ConsId): SketchPrimitive {
  switch (id) {
    case "h":
      return { id, type: "horizontal_l", l_id: "l1" }
    case "v":
      return { id, type: "vertical_l", l_id: "l4" }
    case "par":
      return { id, type: "parallel", l1_id: "l3", l2_id: "l1" }
    case "perp":
      return { id, type: "perpendicular_ll", l1_id: "l2", l2_id: "l1" }
    case "org":
      return { id, type: "p2p_coincident", p1_id: "p1", p2_id: "o" }
    case "w":
      return { id, type: "p2p_distance", p1_id: "p1", p2_id: "p2", distance: WIDTH }
    case "ht":
      return { id, type: "p2p_distance", p1_id: "p2", p2_id: "p3", distance: HEIGHT }
    case "eq":
      return { id, type: "equal_length", l1_id: "l4", l2_id: "l1" }
    case "topSame":
      return { id, type: "p2p_distance", p1_id: "p3", p2_id: "p4", distance: WIDTH }
    case "topOther":
      return { id, type: "p2p_distance", p1_id: "p3", p2_id: "p4", distance: WIDTH + 10 }
  }
}

/** The three design-intent schemes, all fully defined, all starting as the same 60 × 40 rectangle. */
function schemeSketch(scheme: Scheme, width: number): { cons: SketchPrimitive[]; params: Param[] } {
  const base = GEO.map(prim)
  const params: Param[] = [{ name: "w", value: width, fixed: true }]
  const dimW: SketchPrimitive = { id: "s_w", type: "p2p_distance", p1_id: "p1", p2_id: "p2", distance: "w" }
  const corner: SketchPrimitive[] = [
    { id: "s_x", type: "coordinate_x", p_id: "p1", x: -30 },
    { id: "s_y", type: "coordinate_y", p_id: "p1", y: -20 },
  ]
  if (scheme === "corner") return { params, cons: [...base, ...corner, dimW, { id: "s_h", type: "p2p_distance", p1_id: "p2", p2_id: "p3", distance: HEIGHT }] }
  if (scheme === "sym")
    return {
      params,
      cons: [...base, { id: "s_sym", type: "p2p_symmetric_ppp", p1_id: "p1", p2_id: "p3", p_id: "o" }, dimW, { id: "s_h", type: "p2p_distance", p1_id: "p2", p2_id: "p3", distance: HEIGHT }],
    }
  // Height tied to width by an equation: h = w × 2/3 (a free sketch parameter plus a proportional constraint).
  return {
    params: [...params, { name: "h", value: HEIGHT, fixed: false }],
    cons: [
      ...base,
      ...corner,
      dimW,
      { id: "s_h", type: "p2p_distance", p1_id: "p2", p2_id: "p3", distance: "h" },
      { id: "s_ratio", type: "proportional", param1: "h", param2: "w", ratio: 2 / 3 },
    ],
  }
}

const Z = 0.05
const v3 = ([x, y]: V2, z = Z) => new THREE.Vector3(x, y, z)
const copy = (pts: V2[]) => pts.map((p) => [...p] as V2)

export class ConstraintsDofScene extends LessonScene<DofState> {
  private sketch = new THREE.Group()
  private handles: CSS2DObject[] = []
  private solver: Solver | null = null
  private disposed = false
  /** What is drawn: follows state.pts, through a short tween when the solver snaps the shape. */
  private shown: V2[] = copy(FREE)

  constructor(v: Viewer, emit: (s: DofState) => void) {
    super(v, emit, {
      step: 0,
      solver: "loading",
      loadMs: null,
      pts: copy(FREE),
      cons: [],
      dof: 8,
      status: "ok",
      flagged: [],
      draggedOn: [],
      locked: false,
      triedRedundant: false,
      triedConflict: false,
      scheme: "corner",
      width: WIDTH,
      tried: [],
    })
    v.setGrid(120, 10)
    const plane = datumPlane(v.kit, "XY", 200, "上视基准面 XY", [1, -1])
    plane.position.set(20, 10, -0.03)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), v.kit.modelDark)
    this.root.add(plane, dot, this.sketch)
    this.handles = [0, 1, 2, 3].map((i) => this.handle(i))
    this.root.add(...this.handles)

    loadSolver().then(
      (s) => {
        if (this.disposed) return s.destroy()
        this.solver = s
        this.set({ solver: "ready", loadMs: Math.round(s.loadMs) })
        this.enter(this.state.step, false)
      },
      (err) => {
        console.error("planegcs failed to load", err)
        if (!this.disposed) this.set({ solver: "failed" })
      },
    )
  }

  dispose() {
    this.disposed = true
    this.solver?.destroy()
    this.solver = null
    super.dispose()
  }

  // ------------------------------------------------------------ steps

  enter(step: number, moveCamera = true) {
    const s = this.state
    const patch: Partial<DofState> = { step, locked: false }
    if (step === 0) Object.assign(patch, { cons: [], pts: copy(FREE) })
    else if (step <= 4) {
      const cons = s.cons.filter((c) => ALLOWED[step].includes(c))
      for (const c of REQUIRED[step]) if (!cons.includes(c)) cons.push(c)
      if (step === 4 && !cons.includes("ht") && !cons.includes("eq")) cons.push("ht")
      patch.cons = cons
      if (s.step === 5) patch.pts = copy(CENTRED)
    }
    this.set(patch)
    if (step === 0) this.shown = copy(FREE)
    if (step === 5) this.solveScheme(this.state.scheme, true)
    else this.solveSketch(true)

    if (!moveCamera) return
    const target = step <= 1 ? new THREE.Vector3(2, 0, 0) : step === 5 ? new THREE.Vector3(22, 4, 0) : new THREE.Vector3(30, 18, 0)
    this.v.setView("top", { target, distance: step === 5 ? 380 : 270 })
  }

  // ------------------------------------------------------------ actions

  add(id: ConsId) {
    if (this.state.cons.includes(id) || !this.solver) return
    this.set({ cons: [...this.state.cons, id], locked: false })
    this.solveSketch(true)
  }

  remove(id: ConsId) {
    if (!this.state.cons.includes(id)) return
    this.set({ cons: this.state.cons.filter((c) => c !== id), locked: false })
    this.solveSketch(true)
  }

  setScheme(scheme: Scheme) {
    this.set({ scheme, pts: copy(CENTRED) })
    this.solveScheme(scheme, true)
  }

  setWidth(width: number) {
    const w = Math.round(width)
    const tried = w !== WIDTH && !this.state.tried.includes(this.state.scheme) ? [...this.state.tried, this.state.scheme] : this.state.tried
    this.set({ width: w, tried })
    this.solveScheme(this.state.scheme, false)
  }

  // ------------------------------------------------------------ solving

  private solveSketch(animate: boolean) {
    if (!this.solver) return this.render()
    const r = this.solver.solve(this.state.pts, this.state.cons.map(prim))
    this.apply(r, animate)
  }

  private solveScheme(scheme: Scheme, animate: boolean) {
    if (!this.solver) return this.render()
    const { cons, params } = schemeSketch(scheme, this.state.width)
    this.apply(this.solver.solve(this.state.pts, cons, { params }), animate)
  }

  private apply(r: SolveResult, animate: boolean) {
    const flagged = (r.status === "conflict" ? r.conflicting : r.redundant).filter((id): id is ConsId => id in CONS_NAMES)
    this.set({
      pts: r.pts,
      dof: r.dof,
      status: r.status,
      flagged,
      triedRedundant: this.state.triedRedundant || r.status === "redundant",
      triedConflict: this.state.triedConflict || r.status === "conflict",
    })
    const from = copy(this.shown)
    const to = copy(r.pts)
    if (!animate) {
      this.v.tweens.cancel("snap")
      this.shown = to
      return this.render()
    }
    this.v.tweens.run(
      450,
      (k) => {
        this.shown = from.map((p, i) => [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k] as V2)
        this.render()
      },
      { tag: "snap" },
    )
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.sketch)
    const p = this.shown
    const loop = [...p, p[0]].map((q) => v3(q))
    const defined = s.solver === "ready" && s.dof === 0 && s.status === "ok"
    this.sketch.add(line(loop, s.status === "conflict" ? kit.sketchThin : defined ? kit.sketchDefined : kit.sketch))

    const flagged = (id: ConsId) => s.flagged.includes(id)
    const tone = (id: ConsId) => (!flagged(id) ? "normal" : s.status === "conflict" ? "conflict" : "redundant")
    if (s.step <= 4) {
      // Constraint glyphs sit just inside each line; dimensions outside.
      const c = centroid(p)
      const along: Record<string, string[]> = { l1: [], l2: [], l3: [], l4: [] }
      const glyphs: { line: keyof typeof along; text: string; id: ConsId }[] = []
      for (const id of s.cons) {
        if (id === "h") glyphs.push({ line: "l1", text: "水平", id })
        if (id === "v") glyphs.push({ line: "l4", text: "竖直", id })
        if (id === "par") glyphs.push({ line: "l3", text: "∥", id }, { line: "l1", text: "∥", id })
        if (id === "perp") glyphs.push({ line: "l2", text: "⊥", id })
        if (id === "eq") glyphs.push({ line: "l4", text: "=", id }, { line: "l1", text: "=", id })
      }
      for (const g of glyphs) along[g.line].push(g.text)
      const seen: Record<string, number> = { l1: 0, l2: 0, l3: 0, l4: 0 }
      for (const g of glyphs) {
        const i = ["l1", "l2", "l3", "l4"].indexOf(g.line)
        const a = p[i]
        const b = p[(i + 1) % 4]
        const n = along[g.line].length
        const k = seen[g.line]++
        const t = 0.5 + (k - (n - 1) / 2) * 0.2
        const m: V2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        const inward = norm([c[0] - m[0], c[1] - m[1]])
        this.sketch.add(this.glyph(g.text, v3([m[0] + inward[0] * 5, m[1] + inward[1] * 5]), tone(g.id)))
      }
      if (s.cons.includes("org")) this.sketch.add(this.glyph("重合", v3([p[0][0] - 7, p[0][1] - 5]), tone("org")))
      if (s.cons.includes("w")) this.dim(p[0], p[1], [0, -1], 10, `${WIDTH}`, tone("w"))
      if (s.cons.includes("ht")) this.dim(p[1], p[2], [1, 0], 10, `${HEIGHT}`, tone("ht"))
      if (s.cons.includes("topSame")) this.dim(p[3], p[2], [0, 1], 10, `${WIDTH}`, tone("topSame"))
      if (s.cons.includes("topOther")) this.dim(p[3], p[2], [0, 1], s.cons.includes("topSame") ? 20 : 10, `${WIDTH + 10}`, tone("topOther"))
      const showOrigin = !s.cons.includes("org")
      if (showOrigin) this.sketch.add(label("原点", v3([0, 0]), "translate-x-6 border-transparent bg-transparent font-sans text-faint-foreground"))
    } else {
      // Design intent: the starting rectangle stays as a dashed reference.
      this.sketch.add(line([...CENTRED, CENTRED[0]].map((q) => v3(q, 0.02)), kit.construction))
      this.dim(p[0], p[1], [0, -1], s.scheme === "sym" ? 10 : 22, `${s.width}`, "normal")
      const h = p[2][1] - p[1][1]
      this.dim(p[1], p[2], [1, 0], 10, s.scheme === "ratio" ? `${Math.round(h)} = 宽 × 2/3` : `${HEIGHT}`, "normal")
      if (s.scheme === "sym") {
        this.sketch.add(line([v3(p[0]), v3(p[2])], kit.construction))
        this.sketch.add(this.glyph("对称", v3([0, 0]), "normal"))
      } else {
        // The corner is dimensioned from the origin: 30 across, 20 down.
        this.sketch.add(line([v3([0, 0]), v3([0, p[0][1]])], kit.construction), line([v3([0, 0]), v3([p[0][0], 0])], kit.construction))
        this.dim(p[0], [0, p[0][1]], [0, -1], 10, `${Math.round(-p[0][0])}`, "normal")
        this.dim(p[0], [p[0][0], 0], [-1, 0], 10, `${Math.round(-p[0][1])}`, "normal")
      }
    }

    const draggable = s.step <= 4 && s.solver === "ready"
    this.handles.forEach((hd, i) => {
      hd.visible = draggable
      hd.position.copy(v3(p[i], 0.1))
      hd.element.className = defined
        ? "interactive size-3 rounded-full border-2 border-foreground bg-background cursor-not-allowed"
        : "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
      hd.element.title = defined ? "已完全定义：拖不动" : "拖动这个角点"
    })
    this.v.invalidate()
  }

  private glyph(text: string, pos: THREE.Vector3, tone: "normal" | "conflict" | "redundant") {
    const el = document.createElement("div")
    el.textContent = text
    const colours =
      tone === "conflict" ? "bg-destructive text-background" : tone === "redundant" ? "bg-warning text-background" : "bg-inverse text-inverse-foreground"
    el.className = `rounded-sm px-1.5 py-px font-sans text-caption whitespace-nowrap ${colours}`
    const o = new CSS2DObject(el)
    o.position.copy(pos)
    return o
  }

  private dim(a: V2, b: V2, dir: V2, off: number, text: string, tone: "normal" | "conflict" | "redundant") {
    const g = linearDim(this.v.kit, v3(a), v3(b), new THREE.Vector3(dir[0], dir[1], 0), off, text)
    const el = (g.userData.label as CSS2DObject).element
    if (tone === "conflict") el.classList.add("border-destructive", "text-destructive")
    if (tone === "redundant") el.classList.add("border-warning", "text-warning")
    this.sketch.add(g)
  }

  private handle(index: number) {
    const el = document.createElement("div")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!this.solver) return
      if (this.state.dof === 0 && this.state.status === "ok") {
        this.set({ locked: true })
        el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: 240 })
        return
      }
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      this.v.tweens.cancel("snap")
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const cons = this.state.cons.map(prim)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit || !this.solver) return
        const to: V2 = [clamp(hit.x, -90, 110), clamp(hit.y, -80, 90)]
        const r = this.solver.solve(this.state.pts, cons, { drag: { index, to } })
        // Mutate without emitting on every move: the DOF can't change while dragging.
        this.state.pts = r.pts
        this.shown = copy(r.pts)
        if (!this.state.draggedOn.includes(this.state.step)) this.set({ draggedOn: [...this.state.draggedOn, this.state.step] })
        else this.render()
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
        this.set({ pts: copy(this.state.pts) })
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }
}

function centroid(p: V2[]): V2 {
  return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length]
}
function norm([x, y]: V2): V2 {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
