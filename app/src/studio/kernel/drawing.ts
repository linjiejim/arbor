// Engineering drawings: first-angle views (front, top, left, optional
// isometric) by OpenCascade's hidden-line removal, hidden lines only where no
// visible line already is, centre lines for holes and shafts, and the model's
// own dimensions (kernel/dims.ts) projected into the view that shows each one
// best. All in each view's 2D coordinates (mm); the sheet is laid out in the UI.
import { makeProjectedEdges, ProjectionCamera, type Edge, type Shape3D } from "replicad"
import type { Dim } from "./dims"
import { meshEdges } from "./mesh"
import { disposeInfos, faceInfos } from "./select"
import { compoundOf } from "./topo"

type V3 = [number, number, number]
type V2 = [number, number]

export type ViewName = "front" | "top" | "left" | "iso"

/** Viewer direction (from the part towards the eye) and the paper's right. */
export const VIEWS: Record<ViewName, { dir: V3; x: V3; label: string }> = {
  front: { dir: [0, -1, 0], x: [1, 0, 0], label: "主视图" },
  top: { dir: [0, 0, 1], x: [1, 0, 0], label: "俯视图" },
  left: { dir: [-1, 0, 0], x: [0, -1, 0], label: "左视图" },
  iso: { dir: [1, -1, 1], x: [1, 1, 0], label: "轴测图" },
}

export type SheetDim = {
  /** With the parameter name (「L = 80」) and without (「80」), for the 显示参数名 switch. */
  text: string
  plain: string
  geom: { type: "line"; a: V2; b: V2; offset: V2 } | { type: "leader"; at: V2; dir: V2 } | { type: "circle"; c: V2; r: number }
}

export type SheetView = {
  name: ViewName
  /** Segment pairs [u0, v0, u1, v1, …]. */
  visible: number[]
  hidden: number[]
  centre: number[]
  bbox: [V2, V2]
  dims: SheetDim[]
}

export type DrawingData = { views: SheetView[]; size: V3; note?: string }

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const fmt = (x: number) => String(Math.round(x * 100) / 100)

/** Model point → view coordinates (u right, v up). */
export function project(p: V3, view: ViewName): V2 {
  const { dir, x } = frame(view)
  const y = cross(dir, x)
  return [dot(p, x), dot(p, y)]
}

function frame(view: ViewName) {
  const v = VIEWS[view]
  return { dir: unit(v.dir), x: unit(v.x) }
}

export function makeDrawing(body: Shape3D, origins: string[], dims: Dim[], withIso: boolean, note?: string): DrawingData {
  const names: ViewName[] = withIso ? ["front", "top", "left", "iso"] : ["front", "top", "left"]
  const [lo, hi] = body.boundingBox.bounds as [V3, V3]
  const size = sub(hi, lo)
  const centres = centreLines(body, origins)
  const used = new Set<string>()
  const views = names.map((name) => {
    const { dir, x } = frame(name)
    const cam = new ProjectionCamera([0, 0, 0], dir, x)
    const { visible, hidden } = makeProjectedEdges(body, cam)
    cam.delete()
    const vis = segments(visible)
    const hid = dedupe(segments(hidden), vis)
    const box = bounds(vis)
    const view: SheetView = { name, visible: vis, hidden: hid, centre: name === "iso" ? [] : centres(name, box), bbox: box, dims: [] }
    return view
  })
  // Each dimension in the one view that shows it truest; the same words only once.
  for (const d of dims) {
    if (d.source.type === "derived") continue
    const best = bestView(d)
    const plain = plainText(d)
    if (!best || used.has(plain)) continue
    used.add(plain)
    views.find((v) => v.name === best)?.dims.push(toView(d, best, plain))
  }
  // Overall size: length under the front view, height beside it, width beside the top view;
  // left out when a dimension already says the same number (a disc's ⌀120 is its length).
  const pad = 0.08 * Math.max(...size)
  const f = views.find((v) => v.name === "front")!
  const t = views.find((v) => v.name === "top")!
  const said = (x: number) => [...used].some((p) => p.replace(/^[⌀R]/, "") === fmt(x))
  const overall = (view: SheetView, x: number, a: V2, b: V2, offset: V2) => !said(x) && view.dims.push({ text: fmt(x), plain: fmt(x), geom: { type: "line", a, b, offset } })
  overall(f, size[0], [f.bbox[0][0], f.bbox[0][1]], [f.bbox[1][0], f.bbox[0][1]], [0, -2 * pad])
  overall(f, size[2], [f.bbox[0][0], f.bbox[0][1]], [f.bbox[0][0], f.bbox[1][1]], [-2 * pad, 0])
  overall(t, size[1], [t.bbox[1][0], t.bbox[0][1]], [t.bbox[1][0], t.bbox[1][1]], [2 * pad, 0])
  return { views, size, note }
}

/** Projected HLR edges as segment pairs (they lie in the view plane, z = 0). */
function segments(edges: Edge[]): number[] {
  if (!edges.length) return []
  const comp = compoundOf(edges)
  const lines = meshEdges(comp, 0.02).lines
  comp.delete()
  edges.forEach((e) => e.delete())
  const out: number[] = []
  for (let i = 0; i < lines.length; i += 6) out.push(lines[i], lines[i + 1], lines[i + 3], lines[i + 4])
  return out
}

/** Hidden segments that lie on a visible one are dropped (HLR repeats outlines as hidden). */
function dedupe(hidden: number[], visible: number[], tol = 0.02): number[] {
  const cell = 2
  const grid = new Map<string, number[]>()
  const key = (u: number, v: number) => `${Math.floor(u / cell)},${Math.floor(v / cell)}`
  for (let i = 0; i < visible.length; i += 4) {
    const [u0, v0, u1, v1] = visible.slice(i, i + 4)
    const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / cell))
    for (let k = 0; k <= n; k++) {
      const kk = key(u0 + ((u1 - u0) * k) / n, v0 + ((v1 - v0) * k) / n)
      const list = grid.get(kk) ?? []
      if (!list.includes(i)) list.push(i)
      grid.set(kk, list)
    }
  }
  const near = (u: number, v: number) => {
    for (let du = -1; du <= 1; du++)
      for (let dv = -1; dv <= 1; dv++)
        for (const i of grid.get(`${Math.floor(u / cell) + du},${Math.floor(v / cell) + dv}`) ?? []) {
          const [u0, v0, u1, v1] = visible.slice(i, i + 4)
          const L2 = (u1 - u0) ** 2 + (v1 - v0) ** 2
          const t = L2 ? Math.max(0, Math.min(1, ((u - u0) * (u1 - u0) + (v - v0) * (v1 - v0)) / L2)) : 0
          if (Math.hypot(u - (u0 + t * (u1 - u0)), v - (v0 + t * (v1 - v0))) < tol) return true
        }
    return false
  }
  const out: number[] = []
  for (let i = 0; i < hidden.length; i += 4) {
    const [u0, v0, u1, v1] = hidden.slice(i, i + 4)
    if (near(u0, v0) && near(u1, v1) && near((u0 + u1) / 2, (v0 + v1) / 2)) continue
    out.push(u0, v0, u1, v1)
  }
  return out
}

function bounds(segs: number[]): [V2, V2] {
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < segs.length; i += 2) {
    a = Math.min(a, segs[i])
    b = Math.min(b, segs[i + 1])
    c = Math.max(c, segs[i])
    d = Math.max(d, segs[i + 1])
  }
  return Number.isFinite(a) ? [[a, b], [c, d]] : [[0, 0], [1, 1]]
}

/**
 * Centre lines of every cylindrical face: a cross where the view looks down its
 * axis, the axis itself where it looks across. Coaxial faces give one.
 */
function centreLines(body: Shape3D, origins: string[]) {
  const faces = faceInfos(body, origins)
  const axes: { p: V3; d: V3; r: number; lo: number; hi: number }[] = []
  try {
    for (const f of faces) {
      if (f.kind !== "cylinder") continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ad: any = (f.face as any)._geomAdaptor()
      try {
        const c = ad.Cylinder()
        const ax = c.Axis()
        const loc = ax.Location()
        const di = ax.Direction()
        const p: V3 = [loc.X(), loc.Y(), loc.Z()]
        const d = unit([di.X(), di.Y(), di.Z()])
        const [a, b] = f.face.boundingBox.bounds as [V3, V3]
        const span = [a, b].flatMap((u) => [a, b].map((w) => dot(sub([u[0], w[1], (u[2] + w[2]) / 2], p), d)))
        const same = axes.find((x) => Math.abs(Math.abs(dot(x.d, d)) - 1) < 1e-6 && Math.hypot(...cross(sub(p, x.p), x.d)) < 1e-4)
        const lo = Math.min(...span)
        const hi = Math.max(...span)
        if (same) {
          same.r = Math.max(same.r, c.Radius())
          same.lo = Math.min(same.lo, lo)
          same.hi = Math.max(same.hi, hi)
        } else axes.push({ p, d, r: c.Radius(), lo, hi })
      } catch {
        /* not a plain cylinder */
      } finally {
        ad.delete?.()
      }
    }
  } finally {
    disposeInfos(faces)
  }
  return (view: ViewName, box: [V2, V2]) => {
    const { dir } = frame(view)
    const out: number[] = []
    const ext = Math.max(1.5, 0.02 * Math.max(box[1][0] - box[0][0], box[1][1] - box[0][1]))
    for (const a of axes) {
      const along = Math.abs(dot(a.d, dir))
      if (along > 0.999) {
        const [u, v] = project(a.p, view)
        const L = a.r + ext
        out.push(u - L, v, u + L, v, u, v - L, u, v + L)
      } else if (along < 1e-3) {
        const p0 = project(sub(a.p, [-a.d[0] * a.lo, -a.d[1] * a.lo, -a.d[2] * a.lo].map((x) => -x) as V3), view)
        const p1 = project([a.p[0] + a.d[0] * a.hi, a.p[1] + a.d[1] * a.hi, a.p[2] + a.d[2] * a.hi], view)
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1
        const e: V2 = [((p1[0] - p0[0]) / len) * ext, ((p1[1] - p0[1]) / len) * ext]
        out.push(p0[0] - e[0], p0[1] - e[1], p1[0] + e[0], p1[1] + e[1])
      }
    }
    return out
  }
}

/** The view that shows a dimension truest: a length across the line of sight, a circle face on. */
function bestView(d: Dim): ViewName | null {
  const g = d.geom
  const score = (view: ViewName) => {
    const { dir } = frame(view)
    if (g.type === "line") {
      const ab = unit(sub(g.b, g.a))
      const off = Math.hypot(...g.offset) > 1e-9 ? Math.abs(dot(unit(g.offset), dir)) : 0
      return Math.abs(dot(ab, dir)) + 0.5 * off
    }
    if (g.type === "circle") return 1 - Math.abs(dot(unit(g.normal), dir))
    return Math.abs(dot(unit(g.dir), dir))
  }
  const views: ViewName[] = ["front", "top", "left"]
  const best = views.reduce((a, b) => (score(b) < score(a) ? b : a))
  return score(best) < 0.3 ? best : null
}

/** The words on a drawing: the value with its sign, no parameter name (「⌀8」「R4」「6×⌀8 均布」). */
function plainText(d: Dim): string {
  if (d.kind === "linear") {
    const words = d.text.match(/^(壁厚 |偏移 |长 |宽 |\d+× 间距 )/)?.[1] ?? ""
    return `${words}${fmt(d.value)}`
  }
  return d.text.replace(/（[^）]*）/g, "").replace(/^[A-Za-z_]\w*\/?\d* = /, "").trim()
}

function toView(d: Dim, view: ViewName, plain: string): SheetDim {
  const g = d.geom
  const p = (x: V3) => project(x, view)
  if (g.type === "line") {
    const a = p(g.a)
    const b = p(g.b)
    const o0 = p([0, 0, 0])
    const o = p(g.offset)
    return { text: d.text, plain, geom: { type: "line", a, b, offset: [o[0] - o0[0], o[1] - o0[1]] } }
  }
  if (g.type === "circle") return { text: d.text, plain, geom: { type: "circle", c: p(g.center), r: g.r } }
  const at = p(g.at)
  const e = p([g.at[0] + g.dir[0], g.at[1] + g.dir[1], g.at[2] + g.dir[2]])
  return { text: d.text, plain, geom: { type: "leader", at, dir: [e[0] - at[0], e[1] - at[1]] } }
}
