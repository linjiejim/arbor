import * as THREE from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import type { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { face, label, line } from "@/three/build"
import { VIEW_DIRS, type Viewer } from "@/three/viewer"
import { cap, circle, FRONT, rect, walls, WORLD } from "./coordinates.solid"
import { LessonScene } from "./scene"

/**
 * 3.1.3 「尺寸标注原则」: a stepped block with two through holes, drawn as a
 * first-angle three-view drawing (front top-left, top view below it, left
 * view to its right) on the XZ plane and seen head-on. The learner clicks
 * edges, circles and centre lines to add a dimension in that view, and
 * clicks a dimension again to remove it.
 *
 * The checker treats each direction as a graph: the nodes are the planes a
 * dimension can start or end on (left face, step, hole 1, hole 2, right face
 * along X…), the dimensions are edges. Fully defined = every node connected
 * to the datum; the same pair twice = a duplicate; a cycle = a closed
 * dimension chain. Dimensions given in a view where the feature is hidden
 * are flagged against the GB/T 4458.4 rule 3.4 (标注在反映该结构最清晰的图形上).
 */
export type ViewKey = "front" | "top" | "side"
type Axis = "x" | "z" | "y" | "d"
type Pt = [number, number]

export type DimId =
  | "L80F"
  | "L80T"
  | "L30F"
  | "L30T"
  | "L50F"
  | "H1F"
  | "H2F"
  | "H1T"
  | "H2T"
  | "C1T"
  | "C2T"
  | "C3T"
  | "Z30F"
  | "Z30S"
  | "Z12F"
  | "Z12S"
  | "Z18F"
  | "W40T"
  | "W40S"
  | "D10T"
  | "D10F"

export type Scheme = "chain" | "base"

export type DimState = {
  step: number
  dims: DimId[]
  /** Reference dimensions: shown in parentheses, left out of every check. */
  refs: DimId[]
  scheme: Scheme
  playedChain: boolean
  playedBase: boolean
  /** Text of the last thing that can't take a dimension (the symmetry line, hidden hole lines). */
  note: string | null
}

// ------------------------------------------------------------------ the part (mm)

/** Stepped block: base 80 × 40 × 12, upright on the left 30 long and 30 high, two Ø10 through holes in the base. */
export const P = { len: 80, wid: 40, hgt: 30, base: 12, step: 30, h1: 45, h2: 65, r: 5 } as const
/** Gap between views. */
const G = 40
/** Drawing (u, w) of each view. First angle: top view below the front view, left view to its right. */
const topW = (y: number) => -G - (P.wid / 2 - y)
const sideU = (y: number) => P.len + G + (P.wid / 2 - y)
const TOP = { w0: topW(-P.wid / 2), w1: topW(P.wid / 2), wc: topW(0) }
const SIDE = { u0: sideU(P.wid / 2), u1: sideU(-P.wid / 2), uc: sideU(0) }

const NODES: Record<Exclude<Axis, "d">, { datum: string; nodes: string[] }> = {
  x: { datum: "x0", nodes: ["x0", "xs", "h1", "h2", "x1"] },
  z: { datum: "z0", nodes: ["z0", "zb", "zt"] },
  y: { datum: "y0", nodes: ["y0", "y1"] },
}
const NODE_VALUE: Record<string, number> = { x0: 0, xs: P.step, h1: P.h1, h2: P.h2, x1: P.len, z0: 0, zb: P.base, zt: P.hgt, y0: -P.wid / 2, y1: P.wid / 2 }
const NODE_NAME: Record<string, string> = { xs: "台阶的位置", h1: "孔 1 的位置", h2: "孔 2 的位置", x1: "总长", zb: "底板厚度", zt: "总高", y1: "总宽" }
export const VIEW_NAME: Record<ViewKey, string> = { front: "主视图", top: "俯视图", side: "左视图" }

type Cand = { id: DimId; view: ViewKey; axis: Axis; a: string; b: string; text: string; bad?: string }

const CANDS: Cand[] = [
  { id: "L80F", view: "front", axis: "x", a: "x0", b: "x1", text: "80" },
  { id: "L80T", view: "top", axis: "x", a: "x0", b: "x1", text: "80" },
  { id: "L30F", view: "front", axis: "x", a: "x0", b: "xs", text: "30" },
  { id: "L30T", view: "top", axis: "x", a: "x0", b: "xs", text: "30" },
  { id: "L50F", view: "front", axis: "x", a: "xs", b: "x1", text: "50" },
  { id: "H1F", view: "front", axis: "x", a: "x0", b: "h1", text: "45", bad: "孔 1 的位置标在了主视图的虚线孔上，应标在俯视图里孔的圆心" },
  { id: "H2F", view: "front", axis: "x", a: "x0", b: "h2", text: "65", bad: "孔 2 的位置标在了主视图的虚线孔上，应标在俯视图里孔的圆心" },
  { id: "H1T", view: "top", axis: "x", a: "x0", b: "h1", text: "45" },
  { id: "H2T", view: "top", axis: "x", a: "x0", b: "h2", text: "65" },
  { id: "C1T", view: "top", axis: "x", a: "xs", b: "h1", text: "15" },
  { id: "C2T", view: "top", axis: "x", a: "h1", b: "h2", text: "20" },
  { id: "C3T", view: "top", axis: "x", a: "h2", b: "x1", text: "15" },
  { id: "Z30F", view: "front", axis: "z", a: "z0", b: "zt", text: "30" },
  { id: "Z30S", view: "side", axis: "z", a: "z0", b: "zt", text: "30" },
  { id: "Z12F", view: "front", axis: "z", a: "z0", b: "zb", text: "12" },
  { id: "Z12S", view: "side", axis: "z", a: "z0", b: "zb", text: "12", bad: "底板厚度标在了左视图的虚线上，应标在主视图，那里台阶看得见" },
  { id: "Z18F", view: "front", axis: "z", a: "zb", b: "zt", text: "18" },
  { id: "W40T", view: "top", axis: "y", a: "y0", b: "y1", text: "40" },
  { id: "W40S", view: "side", axis: "y", a: "y0", b: "y1", text: "40" },
  { id: "D10T", view: "top", axis: "d", a: "", b: "", text: "2×Ø10" },
  { id: "D10F", view: "front", axis: "d", a: "", b: "", text: "2×Ø10", bad: "孔径标在了主视图的虚线上，应标在俯视图里投影为圆的地方" },
]
const CAND = Object.fromEntries(CANDS.map((c) => [c.id, c])) as Record<DimId, Cand>

/** One fully defined, clean scheme. */
export const CLEAN: DimId[] = ["L80F", "L30F", "H1T", "H2T", "Z30F", "Z12F", "W40T", "D10T"]
const START: DimId[][] = [
  ["L80F", "Z30F", "W40T"],
  [...CLEAN, "L80T", "Z30S"],
  [...CLEAN, "L50F"],
  [],
  ["L80F", "L30F", "H1F", "H2F", "Z30F", "Z12S", "W40T", "D10F"],
]
const OTHERS: DimId[] = ["Z30F", "Z12F", "W40T", "D10T"]
export const SCHEMES: Record<Scheme, { dims: DimId[]; refs: DimId[]; links: DimId[] }> = {
  chain: { dims: [...OTHERS, "L30T", "C1T", "C2T", "C3T", "L80T"], refs: ["L80T"], links: ["L30T", "C1T", "C2T", "C3T"] },
  base: { dims: [...OTHERS, "L30T", "H1T", "H2T", "L80T"], refs: [], links: ["L30T", "H1T", "H2T", "L80T"] },
}
/** Features along X the stack-up follows, and how many links of each scheme reach them. */
const STACK_NODES = ["xs", "h1", "h2", "x1"] as const
export const TOL = 0.1
/** Exaggeration of the error bands in the stack-up strip. */
export const MAG = 20

// ------------------------------------------------------------------ checking

export type Flag = "dup" | "loop" | "bad"
export type Issue = { kind: "missing" | "dup" | "loop" | "bad"; text: string; ids: DimId[] }
export type Analysis = { issues: Issue[]; flags: Partial<Record<DimId, Flag>>; missing: number; count: number; complete: boolean; clean: boolean }

export function analyse(dims: DimId[], refs: DimId[]): Analysis {
  const active = dims.filter((d) => !refs.includes(d)).map((d) => CAND[d])
  const issues: Issue[] = []
  const flags: Partial<Record<DimId, Flag>> = {}
  let missing = 0
  const missingNames: string[] = []

  for (const axis of ["x", "z", "y"] as const) {
    const { datum, nodes } = NODES[axis]
    const mine = active.filter((c) => c.axis === axis)
    // Duplicates: the same pair of planes dimensioned more than once.
    const byPair = new Map<string, Cand[]>()
    for (const c of mine) {
      const k = [c.a, c.b].sort().join("|")
      byPair.set(k, [...(byPair.get(k) ?? []), c])
    }
    const unique: Cand[] = []
    for (const list of byPair.values()) {
      unique.push(list[0])
      if (list.length > 1) {
        for (const c of list) flags[c.id] = "dup"
        issues.push({ kind: "dup", text: `「${list[0].text}」标了 ${list.length} 次：${list.map((c) => VIEW_NAME[c.view]).join("和")}`, ids: list.map((c) => c.id) })
      }
    }
    // Spanning forest; an edge between two nodes already connected closes a chain.
    const parent = new Map(nodes.map((n) => [n, n]))
    const find = (n: string): string => (parent.get(n) === n ? n : find(parent.get(n)!))
    const tree: Cand[] = []
    for (const c of unique) {
      const ra = find(c.a)
      const rb = find(c.b)
      if (ra !== rb) {
        parent.set(ra, rb)
        tree.push(c)
        continue
      }
      const path = treePath(tree, c.a, c.b)
      const loop = [...path, c]
      for (const l of loop) if (!flags[l.id]) flags[l.id] = "loop"
      issues.push({ kind: "loop", text: `${loop.map((l) => l.text).sort((x, y) => Number(x) - Number(y)).join("、")} 首尾相接，围成了封闭尺寸链`, ids: loop.map((l) => l.id) })
    }
    for (const n of nodes) {
      if (find(n) !== find(datum)) {
        missing++
        missingNames.push(NODE_NAME[n])
      }
    }
  }

  const holes = active.filter((c) => c.axis === "d")
  if (holes.length === 0) {
    missing++
    missingNames.push("孔径")
  }
  if (holes.length > 1) {
    for (const c of holes) flags[c.id] = "dup"
    issues.push({ kind: "dup", text: `孔径标了 ${holes.length} 次：${holes.map((c) => VIEW_NAME[c.view]).join("和")}`, ids: holes.map((c) => c.id) })
  }
  if (missingNames.length) issues.unshift({ kind: "missing", text: `还没定：${missingNames.join("、")}`, ids: [] })

  for (const c of active) {
    if (!c.bad) continue
    if (!flags[c.id]) flags[c.id] = "bad"
    issues.push({ kind: "bad", text: c.bad, ids: [c.id] })
  }
  const has = (k: Issue["kind"]) => issues.some((i) => i.kind === k)
  const complete = missing === 0
  return { issues, flags, missing, count: active.length, complete, clean: complete && !has("dup") && !has("loop") && !has("bad") }
}

/** Dimensions on the tree path from a to b. */
function treePath(tree: Cand[], a: string, b: string): Cand[] {
  const prev = new Map<string, { node: string; via: Cand }>()
  const seen = new Set([a])
  const queue = [a]
  while (queue.length) {
    const n = queue.shift()!
    if (n === b) break
    for (const c of tree) {
      const o = c.a === n ? c.b : c.b === n ? c.a : null
      if (!o || seen.has(o)) continue
      seen.add(o)
      prev.set(o, { node: n, via: c })
      queue.push(o)
    }
  }
  const out: Cand[] = []
  for (let n = b; n !== a && prev.has(n); n = prev.get(n)!.node) out.unshift(prev.get(n)!.via)
  return out
}

export const has = (an: Analysis, kind: Issue["kind"]) => an.issues.some((i) => i.kind === kind)

/** Fully defined, and free of the given kinds of problem. */
export function complete(s: DimState, ...without: Issue["kind"][]) {
  const an = analyse(s.dims, s.refs)
  return an.complete && without.every((k) => !has(an, k))
}
export const candText = (id: DimId) => CAND[id].text

/** Worst-case error of each X feature relative to the left face, for a scheme. */
export function stackUp(scheme: Scheme): Record<(typeof STACK_NODES)[number], number> {
  if (scheme === "base") return { xs: TOL, h1: TOL, h2: TOL, x1: TOL }
  return { xs: TOL, h1: 2 * TOL, h2: 3 * TOL, x1: 4 * TOL }
}

// ------------------------------------------------------------------ the drawing

/** Something in the drawing that can be clicked: a line, a circle's outline, or a hole's centre (the area around it). */
type Target = { cand: DimId | null; view: ViewKey; seg?: [Pt, Pt]; circle?: { c: Pt; r: number }; centre?: { c: Pt; r: number }; note?: string }

const TARGETS: Target[] = [
  // Front view.
  { view: "front", cand: "L80F", seg: [[0, 0], [P.len, 0]] },
  { view: "front", cand: "L30F", seg: [[0, P.hgt], [P.step, P.hgt]] },
  { view: "front", cand: "L50F", seg: [[P.step, P.base], [P.len, P.base]] },
  { view: "front", cand: "Z30F", seg: [[0, 0], [0, P.hgt]] },
  { view: "front", cand: "Z18F", seg: [[P.step, P.base], [P.step, P.hgt]] },
  { view: "front", cand: "Z12F", seg: [[P.len, 0], [P.len, P.base]] },
  ...[P.h1, P.h2].flatMap((x) => [-P.r, P.r].map((d): Target => ({ view: "front", cand: "D10F", seg: [[x + d, 0], [x + d, P.base]] }))),
  { view: "front", cand: "H1F", seg: [[P.h1, -3], [P.h1, P.base + 3]] },
  { view: "front", cand: "H2F", seg: [[P.h2, -3], [P.h2, P.base + 3]] },
  // Top view.
  { view: "top", cand: "L80T", seg: [[0, TOP.w1], [P.len, TOP.w1]] },
  { view: "top", cand: "L80T", seg: [[0, TOP.w0], [P.len, TOP.w0]] },
  { view: "top", cand: "W40T", seg: [[0, TOP.w0], [0, TOP.w1]] },
  { view: "top", cand: "W40T", seg: [[P.len, TOP.w0], [P.len, TOP.w1]] },
  { view: "top", cand: "L30T", seg: [[P.step, TOP.w0], [P.step, TOP.w1]] },
  { view: "top", cand: "D10T", circle: { c: [P.h1, TOP.wc], r: P.r } },
  { view: "top", cand: "D10T", circle: { c: [P.h2, TOP.wc], r: P.r } },
  { view: "top", cand: "H1T", centre: { c: [P.h1, TOP.wc], r: P.r * 0.5 } },
  { view: "top", cand: "H2T", centre: { c: [P.h2, TOP.wc], r: P.r * 0.5 } },
  { view: "top", cand: "H1T", seg: [[P.h1, TOP.wc - P.r - 3], [P.h1, TOP.wc - P.r]] },
  { view: "top", cand: "H2T", seg: [[P.h2, TOP.wc - P.r - 3], [P.h2, TOP.wc - P.r]] },
  { view: "top", cand: "H1T", seg: [[P.h1, TOP.wc + P.r], [P.h1, TOP.wc + P.r + 3]] },
  { view: "top", cand: "H2T", seg: [[P.h2, TOP.wc + P.r], [P.h2, TOP.wc + P.r + 3]] },
  { view: "top", cand: null, seg: [[-4, TOP.wc], [P.len + 4, TOP.wc]], note: "对称中心线：孔在零件的对称面上，宽度方向不用再标位置" },
  // Left view.
  { view: "side", cand: "Z30S", seg: [[SIDE.u0, 0], [SIDE.u0, P.hgt]] },
  { view: "side", cand: "Z30S", seg: [[SIDE.u1, 0], [SIDE.u1, P.hgt]] },
  { view: "side", cand: "W40S", seg: [[SIDE.u0, P.hgt], [SIDE.u1, P.hgt]] },
  { view: "side", cand: "W40S", seg: [[SIDE.u0, 0], [SIDE.u1, 0]] },
  { view: "side", cand: "Z12S", seg: [[SIDE.u0, P.base], [SIDE.u1, P.base]] },
  ...[-P.r, P.r].map((d): Target => ({ view: "side", cand: null, seg: [[SIDE.uc + d, 0], [SIDE.uc + d, P.base]], note: "孔在左视图里只是虚线，孔径和孔的位置都标在俯视图" })),
]

/** Where an extension line starts for a node in a view (the outermost visible point of that plane). */
function anchor(view: ViewKey, node: string): Pt {
  const v = NODE_VALUE[node]
  if (view === "front") {
    if (node[0] === "x" || node[0] === "h") return [v, node === "x1" ? P.base : node === "h1" || node === "h2" ? P.base + 3 : P.hgt]
    return [node === "zt" ? P.step : P.len, v]
  }
  if (view === "top") {
    if (node[0] === "x" || node[0] === "h") return [v, node === "h1" || node === "h2" ? TOP.wc - P.r - 3 : TOP.w0]
    return [0, topW(v)]
  }
  if (node[0] === "z") return [SIDE.u1, v]
  return [sideU(v), P.hgt]
}

/** Which way a view's dimensions in a direction are stacked: along u or w, from where, and outwards by how much. */
function lane(view: ViewKey, axis: Axis): { horizontal: boolean; at: number; out: number } {
  if (axis === "x") return view === "front" ? { horizontal: true, at: P.hgt + 10, out: 8 } : { horizontal: true, at: TOP.w0 - 10, out: -8 }
  if (axis === "z") return view === "front" ? { horizontal: false, at: P.len + 10, out: 8 } : { horizontal: false, at: SIDE.u1 + 10, out: 8 }
  return view === "top" ? { horizontal: false, at: -10, out: -8 } : { horizontal: true, at: P.hgt + 10, out: 8 }
}

const v3 = (p: Pt, d = 0) => new THREE.Vector3(p[0], d, p[1])
const STRIP = TOP.w0 - 60

export class DimensioningScene extends LessonScene<DimState> {
  private drawing = new THREE.Group()
  private dimsGroup = new THREE.Group()
  private hoverGroup = new THREE.Group()
  private strip = new THREE.Group()
  private iso = new THREE.Group()
  private hover: number | null = null
  private down: { x: number; y: number } | null = null
  private stackT = 0
  private stackSeq = 0
  private lastLive: DimId | null = null

  constructor(v: Viewer, emit: (s: DimState) => void) {
    super(v, emit, { step: 0, dims: [...START[0]], refs: [], scheme: "chain", playedChain: false, playedBase: false, note: null })
    v.showGrid(false)
    this.own(() => v.showGrid(true))
    // A drawing is flat: pan and zoom, but don't tip it over.
    v.controls.enableRotate = false
    this.own(() => (v.controls.enableRotate = true))
    this.buildDrawing()
    this.buildIso()
    this.root.add(this.drawing, this.dimsGroup, this.hoverGroup, this.strip, this.iso)

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => {
      this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 4) this.onClick(e)
    }
    const onMove = (e: PointerEvent) => this.onHover(e)
    const onLeave = () => this.setHover(null)
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerleave", onLeave)
    this.own(() => el.removeEventListener("pointerdown", onDown))
    this.own(() => el.removeEventListener("pointerup", onUp))
    this.own(() => el.removeEventListener("pointermove", onMove))
    this.own(() => el.removeEventListener("pointerleave", onLeave))
    this.own(() => (el.style.cursor = ""))
  }

  enter(step: number) {
    this.stackSeq++
    this.v.tweens.cancel("stack")
    this.hover = null
    const patch: Partial<DimState> = { step, note: null }
    if (step === 3) {
      Object.assign(patch, { scheme: "chain", dims: [...SCHEMES.chain.dims], refs: [...SCHEMES.chain.refs] })
      this.stackT = 0
    } else Object.assign(patch, { dims: [...START[step]], refs: [] })
    this.set(patch)
    this.fitDrawing()
  }

  // ------------------------------------------------------------ actions

  toggle(id: DimId) {
    const s = this.state
    if (s.dims.includes(id)) this.set({ dims: s.dims.filter((d) => d !== id), refs: s.refs.filter((d) => d !== id), note: null })
    else this.set({ dims: [...s.dims, id], note: null })
  }

  /** Turn a dimension into a reference dimension: (50). */
  makeRef(id: DimId) {
    const s = this.state
    if (!s.dims.includes(id) || s.refs.includes(id)) return
    this.set({ refs: [...s.refs, id] })
  }

  setScheme(scheme: Scheme) {
    this.set({ scheme, dims: [...SCHEMES[scheme].dims], refs: [...SCHEMES[scheme].refs] })
    this.playStack()
  }

  /** Animate the error of each feature building up link by link. */
  playStack() {
    const seq = ++this.stackSeq
    const scheme = this.state.scheme
    this.stackT = 0
    this.renderStrip()
    this.v.tweens
      .run(2600, (k) => {
        this.stackT = k * STACK_NODES.length
        this.renderStrip()
        if (this.liveLink() !== this.lastLive) this.renderDims()
      }, { tag: "stack" })
      .then(() => {
        if (seq !== this.stackSeq) return
        this.stackT = STACK_NODES.length
        this.set(scheme === "chain" ? { playedChain: true } : { playedBase: true })
      })
  }

  // ------------------------------------------------------------ input

  private toDrawing(e: PointerEvent): Pt | null {
    const hit = this.v.rayOnPlane(e, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    return hit ? [hit.x, hit.z] : null
  }

  /** The target nearest the pointer, within a few pixels. */
  private targetAt(e: PointerEvent): number | null {
    const p = this.toDrawing(e)
    if (!p) return null
    const v = this.v
    const dist = Math.abs(v.camera.position.y)
    const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2))) / v.size.h
    const tol = 7 * perPx
    let best: number | null = null
    let bestD = tol
    TARGETS.forEach((t, i) => {
      let d: number
      if (t.seg) d = segDist(p, t.seg[0], t.seg[1])
      else if (t.circle) d = Math.abs(Math.hypot(p[0] - t.circle.c[0], p[1] - t.circle.c[1]) - t.circle.r)
      else d = Math.max(0, Math.hypot(p[0] - t.centre!.c[0], p[1] - t.centre!.c[1]) - t.centre!.r)
      // The symmetry line runs through both holes: it loses every tie.
      const bias = t.cand ? 0 : perPx
      if (d + bias < bestD) {
        bestD = d + bias
        best = i
      }
    })
    return best
  }

  private onHover(e: PointerEvent) {
    if (e.buttons) return
    this.setHover(this.targetAt(e))
  }

  private setHover(i: number | null) {
    if (i === this.hover) return
    this.hover = i
    this.v.renderer.domElement.style.cursor = i !== null && TARGETS[i].cand ? "pointer" : ""
    this.renderHover()
  }

  private onClick(e: PointerEvent) {
    const i = this.targetAt(e)
    if (i === null) return
    const t = TARGETS[i]
    if (!t.cand) {
      this.set({ note: t.note ?? null })
      return
    }
    this.toggle(t.cand)
  }

  /** Frame the whole sheet head-on: the box's width and height, not its bounding sphere, set the distance. */
  private fitDrawing() {
    const v = this.v
    const u0 = -34
    const u1 = SIDE.u1 + 30
    const w0 = STRIP - 10
    const w1 = P.hgt + 52
    const tanV = Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2))
    const dist = Math.max((u1 - u0) / 2 / (tanV * v.camera.aspect), (w1 - w0) / 2 / tanV) * 1.04
    const target = new THREE.Vector3((u0 + u1) / 2, 0, (w0 + w1) / 2)
    v.flyTo(target.clone().addScaledVector(VIEW_DIRS.front, dist), target, 800)
  }

  // ------------------------------------------------------------ build

  private buildDrawing() {
    const kit = this.v.kit
    const vis: [Pt, Pt][] = []
    const hid: [Pt, Pt][] = []
    const ctr: [Pt, Pt][] = []
    const loop = (pts: Pt[]) => pts.forEach((p, i) => vis.push([p, pts[(i + 1) % pts.length]]))
    // Front view: the stepped outline, the holes as hidden lines, their axes.
    loop([[0, 0], [P.len, 0], [P.len, P.base], [P.step, P.base], [P.step, P.hgt], [0, P.hgt]])
    for (const x of [P.h1, P.h2]) {
      hid.push([[x - P.r, 0], [x - P.r, P.base]], [[x + P.r, 0], [x + P.r, P.base]])
      ctr.push([[x, -3], [x, P.base + 3]])
    }
    // Top view: outline, the step's edge, the two circles, centre lines.
    loop([[0, TOP.w0], [P.len, TOP.w0], [P.len, TOP.w1], [0, TOP.w1]])
    vis.push([[P.step, TOP.w0], [P.step, TOP.w1]])
    for (const x of [P.h1, P.h2]) {
      loop(circle(x, TOP.wc, P.r, 48) as Pt[])
      ctr.push([[x, TOP.wc - P.r - 3], [x, TOP.wc + P.r + 3]])
    }
    ctr.push([[-4, TOP.wc], [P.len + 4, TOP.wc]])
    // Left view: the upright hides everything behind it.
    loop([[SIDE.u0, 0], [SIDE.u1, 0], [SIDE.u1, P.hgt], [SIDE.u0, P.hgt]])
    hid.push([[SIDE.u0, P.base], [SIDE.u1, P.base]])
    for (const d of [-P.r, P.r]) hid.push([[SIDE.uc + d, 0], [SIDE.uc + d, P.base]])
    ctr.push([[SIDE.uc, -3], [SIDE.uc, P.hgt + 3]])

    this.drawing.add(segments(vis, kit.sketchDefined), segments(hid, kit.construction), segments(ctr.flatMap(dashDot), kit.dimension))
    const name = (text: string, p: Pt) => {
      const l = label(text, v3(p), "border-transparent bg-transparent font-sans text-faint-foreground")
      l.center.set(0, 1)
      return l
    }
    this.drawing.add(name("主视图", [-30, P.hgt + 34]), name("俯视图", [-30, TOP.w1 + 4]), name("左视图", [SIDE.u0, P.hgt + 34]))
  }

  /** A small shaded model in the empty corner, like the axonometric view on a real drawing. */
  private buildIso() {
    const kit = this.v.kit
    const g = new THREE.Group()
    const profile: [number, number][] = [[0, 0], [P.len, 0], [P.len, P.base], [P.step, P.base], [P.step, P.hgt], [0, P.hgt]]
    const holes = [P.h1, P.h2].map((x) => circle(x, 0, P.r))
    const add = (geo: THREE.BufferGeometry, smooth = false) => g.add(face(geo, kit, { feature: "part", edges: smooth ? 40 : 30 }))
    add(cap(profile, [], P.wid / 2, FRONT, true))
    add(cap(profile, [], -P.wid / 2, FRONT, false))
    add(walls(profile, -P.wid / 2, P.wid / 2, FRONT, { skip: [0, 2] }))
    add(cap(rect(0, -P.wid / 2, P.len, P.wid / 2), holes, 0, WORLD, false))
    add(cap(rect(P.step, -P.wid / 2, P.len, P.wid / 2), holes, P.base, WORLD, true))
    for (const h of holes) add(walls(h, 0, P.base, WORLD, { inward: true, smooth: true }), true)
    g.position.set(-P.len / 2, 0, -P.hgt / 2)
    // Turn the part so the camera (looking along +Y) sees it from the usual iso corner.
    const back = VIEW_DIRS.iso.clone()
    const right = new THREE.Vector3(0, 0, 1).cross(back).normalize()
    const up = back.clone().cross(right)
    const from = new THREE.Matrix4().makeBasis(right, up, back)
    const to = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0))
    this.iso.quaternion.setFromRotationMatrix(to.multiply(from.invert()))
    this.iso.scale.setScalar(0.5)
    this.iso.position.set(SIDE.uc - 2, -60, TOP.wc - 8)
    this.iso.add(g)
  }

  protected render() {
    this.renderDims()
    this.renderHover()
    this.renderStrip()
  }

  private renderDims() {
    const s = this.state
    const an = analyse(s.dims, s.refs)
    this.lastLive = this.liveLink()
    this.clear(this.dimsGroup)
    // Pack each view's dimensions in one direction into rows: small inside, big outside.
    const groups = new Map<string, Cand[]>()
    for (const id of s.dims) {
      const c = CAND[id]
      if (c.axis === "d") continue
      const k = `${c.view}|${c.axis}`
      groups.set(k, [...(groups.get(k) ?? []), c])
    }
    const live = this.liveLink()
    for (const list of groups.values()) {
      const rows: [number, number][][] = []
      const span = (c: Cand) => [NODE_VALUE[c.a], NODE_VALUE[c.b]].sort((a, b) => a - b) as [number, number]
      for (const c of [...list].sort((a, b) => span(a)[1] - span(a)[0] - (span(b)[1] - span(b)[0]))) {
        const [lo, hi] = span(c)
        let row = rows.findIndex((r) => r.every(([a, b]) => hi <= a + 0.01 || lo >= b - 0.01))
        if (row < 0) row = rows.push([]) - 1
        rows[row].push([lo, hi])
        const ln = lane(c.view, c.axis)
        this.dimsGroup.add(this.dim(c, anchor(c.view, c.a), anchor(c.view, c.b), ln.horizontal, ln.at + row * ln.out, an.flags[c.id], s.refs.includes(c.id), live === c.id))
      }
    }
    if (s.dims.includes("D10T")) this.dimsGroup.add(this.leader(an.flags.D10T))
    if (s.dims.includes("D10F")) {
      const c = CAND.D10F
      this.dimsGroup.add(this.dim(c, [P.h1 - P.r, 0], [P.h1 + P.r, 0], true, -10, an.flags.D10F, false, false))
    }
    this.v.invalidate()
  }

  /** The chain link being added right now in the stack-up animation. */
  private liveLink(): DimId | null {
    const s = this.state
    if (s.step !== 3 || this.stackT <= 0 || this.stackT >= STACK_NODES.length) return null
    return SCHEMES[s.scheme].links[Math.floor(this.stackT)]
  }

  /** A linear dimension between two anchor points, measured along u (horizontal) or w. */
  private dim(c: Cand, a: Pt, b: Pt, horizontal: boolean, at: number, flag: Flag | undefined, ref: boolean, live: boolean) {
    const kit = this.v.kit
    const g = new THREE.Group()
    const mat = live ? kit.sketch : kit.dimension
    const along = (p: Pt) => (horizontal ? p[1] : p[0])
    const put = (p: Pt, q: number): Pt => (horizontal ? [p[0], q] : [q, p[1]])
    const d = 0.1
    for (const p of [a, b]) {
      const sign = Math.sign(at - along(p)) || 1
      g.add(line([v3(put(p, along(p) + sign * 1.5), -d), v3(put(p, at + sign * 2.5), -d)], kit.dimension))
    }
    const A = put(a, at)
    const B = put(b, at)
    g.add(line([v3(A, -d), v3(B, -d)], mat))
    const len = Math.hypot(B[0] - A[0], B[1] - A[1])
    const dir: Pt = [(B[0] - A[0]) / len, (B[1] - A[1]) / len]
    const nrm: Pt = [-dir[1], dir[0]]
    const t = Math.min(3, len / 4)
    for (const [P0, s] of [[A, 1], [B, -1]] as const) {
      const back: Pt = [P0[0] + dir[0] * t * s, P0[1] + dir[1] * t * s]
      g.add(line([v3([back[0] + nrm[0] * t * 0.35, back[1] + nrm[1] * t * 0.35], -d), v3(P0, -d), v3([back[0] - nrm[0] * t * 0.35, back[1] - nrm[1] * t * 0.35], -d)], mat))
    }
    g.add(this.dimLabel(c, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], flag, ref, live))
    return g
  }

  /** 2×Ø10 on a leader from the right-hand circle of the top view. */
  private leader(flag: Flag | undefined) {
    const kit = this.v.kit
    const g = new THREE.Group()
    const c: Pt = [P.h2, TOP.wc]
    const a = -Math.PI / 4
    const p0: Pt = [c[0] + Math.cos(a) * P.r, c[1] + Math.sin(a) * P.r]
    const p1: Pt = [c[0] + Math.cos(a) * (P.r + 13), c[1] + Math.sin(a) * (P.r + 13)]
    const p2: Pt = [p1[0] + 12, p1[1]]
    g.add(line([v3(p0, -0.1), v3(p1, -0.1), v3(p2, -0.1)], kit.dimension))
    const t = 2.6
    const dir: Pt = [Math.cos(a), Math.sin(a)]
    const nrm: Pt = [-dir[1], dir[0]]
    const back: Pt = [p0[0] + dir[0] * t, p0[1] + dir[1] * t]
    g.add(line([v3([back[0] + nrm[0] * t * 0.35, back[1] + nrm[1] * t * 0.35], -0.1), v3(p0, -0.1), v3([back[0] - nrm[0] * t * 0.35, back[1] - nrm[1] * t * 0.35], -0.1)], kit.dimension))
    const l = this.dimLabel(CAND.D10T, [p1[0] + 6, p1[1] + 2.5], flag, false, false)
    g.add(l)
    return g
  }

  private dimLabel(c: Cand, at: Pt, flag: Flag | undefined, ref: boolean, live: boolean) {
    const tone = flag === "dup" || flag === "loop" ? "border-destructive text-destructive" : flag === "bad" ? "border-warning text-warning" : live ? "border-primary text-primary" : ""
    const l = label(ref ? `(${c.text})` : c.text, v3(at, -0.3), `interactive cursor-pointer hover:border-primary ${tone}`)
    l.element.title = ref ? "参考尺寸 · 点击删除" : "点击删除这个尺寸"
    l.element.addEventListener("pointerdown", (e) => e.stopPropagation())
    l.element.addEventListener("click", () => this.toggle(c.id))
    return l
  }

  /** The element under the pointer, and a dashed preview of the dimension a click would add. */
  private renderHover() {
    const kit = this.v.kit
    this.clear(this.hoverGroup)
    const i = this.hover
    if (i === null) return this.v.invalidate()
    const t = TARGETS[i]
    const hl = (pts: Pt[]) => this.hoverGroup.add(line(pts.map((p) => v3(p, -0.2)), kit.sketch))
    if (t.seg) hl(t.seg)
    if (t.circle) hl([...(circle(t.circle.c[0], t.circle.c[1], t.circle.r, 48) as Pt[]), [t.circle.c[0] + t.circle.r, t.circle.c[1]]])
    if (t.centre) {
      const [x, w] = t.centre.c
      const e = P.r + 3
      hl([[x, w - e], [x, w + e]])
      hl([[x - e, w], [x + e, w]])
    }
    const tip = (text: string, p: Pt) => {
      const l = label(text, v3(p, -0.4), "pointer-events-none border-primary font-sans text-primary")
      l.center.set(0.5, 1.6)
      return l
    }
    const round = t.circle ?? t.centre
    const mid: Pt = t.seg ? [(t.seg[0][0] + t.seg[1][0]) / 2, Math.max(t.seg[0][1], t.seg[1][1])] : [round!.c[0], round!.c[1] + P.r]
    if (!t.cand) this.hoverGroup.add(tip("这里不标尺寸", mid))
    else {
      const on = this.state.dims.includes(t.cand)
      this.hoverGroup.add(tip(on ? `删除 ${CAND[t.cand].text}` : `标注 ${CAND[t.cand].text} · ${VIEW_NAME[t.view]}`, mid))
    }
    this.v.invalidate()
  }

  /** Step 4: each feature's worst-case position error, exaggerated, building up as the animation runs. */
  private renderStrip() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.strip)
    if (s.step !== 3) return this.v.invalidate()
    const t = this.stackT
    const w = STRIP
    this.strip.add(line([v3([0, w]), v3([P.len, w])], kit.dimension))
    this.strip.add(line([v3([0, w - 6]), v3([0, w + 6])], kit.sketchDefined))
    const title = label(`位置误差 · 放大 ${MAG} 倍`, v3([-30, w + 15]), "border-transparent bg-transparent font-sans text-muted-foreground")
    title.center.set(0, 1)
    const datum = label("基准", v3([-2, w]), "border-transparent bg-transparent font-sans text-faint-foreground")
    datum.center.set(1, 0.5)
    this.strip.add(title, datum)
    STACK_NODES.forEach((n, j) => {
      // Chain: link i moves every feature after it. Baseline: link j moves only feature j.
      let e = 0
      if (s.scheme === "chain") for (let i = 0; i <= j; i++) e += TOL * clamp(t - i, 0, 1)
      else e = TOL * clamp(t - j, 0, 1)
      const x = NODE_VALUE[n]
      this.strip.add(line([v3([x, w - 4]), v3([x, w + 4])], kit.dimension))
      if (e <= 1e-4) return
      const half = e * MAG
      const geo = new THREE.BufferGeometry().setFromPoints([v3([x - half, w - 4], 0.05), v3([x + half, w - 4], 0.05), v3([x + half, w + 4], 0.05), v3([x - half, w + 4], 0.05)])
      geo.setIndex([0, 2, 1, 0, 3, 2])
      this.strip.add(new THREE.Mesh(geo, kit.planeHover))
      this.strip.add(line([v3([x - half, w - 4], -0.05), v3([x + half, w - 4], -0.05), v3([x + half, w + 4], -0.05), v3([x - half, w + 4], -0.05), v3([x - half, w - 4], -0.05)], kit.sketchThin))
      const tenths = Math.abs(e * 10 - Math.round(e * 10)) < 1e-6
      const l = label(`±${e.toFixed(tenths ? 1 : 2)}`, v3([x, w + 5]), "border-transparent bg-transparent text-primary")
      l.center.set(0.5, 1)
      this.strip.add(l)
    })
    this.v.invalidate()
  }
}

// ------------------------------------------------------------------ helpers

function segments(segs: [Pt, Pt][], mat: LineMaterial) {
  const geo = new LineSegmentsGeometry()
  geo.setPositions(segs.flatMap(([a, b]) => [a[0], 0, a[1], b[0], 0, b[1]]))
  const l = new LineSegments2(geo, mat)
  l.computeLineDistances()
  l.raycast = () => {}
  return l
}

/** A thin chain line (点画线) as short dashes and dots: long dash, gap, dot, gap. */
function dashDot([a, b]: [Pt, Pt]): [Pt, Pt][] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const d: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const at = (t: number): Pt => [a[0] + d[0] * t, a[1] + d[1] * t]
  const out: [Pt, Pt][] = []
  const pattern = [7, 1.4, 0.8, 1.4]
  let t = 0
  let i = 0
  while (t < len) {
    const step = pattern[i % 4]
    if (i % 2 === 0) out.push([at(t), at(Math.min(len, t + step))])
    t += step
    i++
  }
  return out
}

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const k = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1)
  return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
