// How two shapes sit relative to each other: the shortest distance between
// them (and where), and how much two solids overlap. Used by the step
// diagnostics, `measure` between features or parts, and the `gap` check.
import { getOC, measureShapeVolumeProperties, type AnyShape, type Shape3D } from "replicad"

type V3 = [number, number, number]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any

/** Below this a distance is contact. */
export const TOUCH = 1e-3

/** Shortest distance between two shapes and the two closest points (null: OpenCascade found none). */
export function closest(a: AnyShape, b: AnyShape): { d: number; segment: [V3, V3] } | null {
  const oc: OC = getOC()
  const dss = new oc.BRepExtrema_DistShapeShape()
  try {
    dss.LoadS1(a.wrapped)
    dss.LoadS2(b.wrapped)
    dss.Perform()
    if (!dss.IsDone() || dss.NbSolution() < 1) return null
    const pa = dss.PointOnShape1(1)
    const pb = dss.PointOnShape2(1)
    const segment: [V3, V3] = [
      [pa.X(), pa.Y(), pa.Z()],
      [pb.X(), pb.Y(), pb.Z()],
    ]
    pa.delete()
    pb.delete()
    return { d: dss.Value(), segment }
  } finally {
    dss.delete()
  }
}

/** Volume two solids share (0 when either isn't a solid or they only touch). */
export function overlapVolume(a: AnyShape, b: AnyShape): number {
  if (!("intersect" in a) || !("intersect" in b)) return 0
  const common = (a as Shape3D).intersect(b as Shape3D)
  try {
    return measureShapeVolumeProperties(common).volume
  } finally {
    common.delete()
  }
}

/** Distance, and the overlap when they touch and both are solids (a boolean only then: they can be slow). */
export function relation(a: AnyShape, b: AnyShape, solids: boolean): { d: number; overlap: number; segment: [V3, V3] | null } {
  const c = closest(a, b)
  const d = c?.d ?? 0
  const overlap = solids && d <= TOUCH ? overlapVolume(a, b) : 0
  return { d, overlap, segment: c?.segment ?? null }
}

/** 「接触」「相交 12.4 mm³」「0.52 mm」 */
export function relationText(r: { d: number; overlap: number }) {
  if (r.overlap > 1e-6) return `相交 ${fmt(r.overlap)} mm³`
  if (r.d <= TOUCH) return "接触（距离 0）"
  return `${fmt(r.d)} mm`
}

const fmt = (x: number) => String(Math.round(x * 100) / 100)

/** Faces closer than this, facing each other across empty space, are a slit (mm). */
export const SLIT = 1
/** Faces closer than this, back to back across material, are a thin wall (mm). */
export const THIN = 0.8

export type Narrow = { kind: "slit" | "thin"; d: number; at: V3 }

type FaceLike = {
  wrapped: unknown
  geomType: string
  boundingBox: { bounds: [number[], number[]] }
  normalAt(p?: unknown): { x: number; y: number; z: number; delete?(): void }
}

/** A face's surface when it is a plane or a cylinder (where slits and thin walls are): else null. */
type Geo = { kind: "plane"; n: V3; p: V3 } | { kind: "cyl"; a: V3; d: V3; r: number } | null

function geoOf(face: FaceLike): Geo {
  if (face.geomType !== "PLANE" && face.geomType !== "CYLINDRE") return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ad: any = (face as any)._geomAdaptor()
  try {
    if (face.geomType === "PLANE") {
      const pl = ad.Plane()
      const loc = pl.Location()
      const n = face.normalAt()
      const out: Geo = { kind: "plane", n: [n.x, n.y, n.z], p: [loc.X(), loc.Y(), loc.Z()] }
      n.delete?.()
      return out
    }
    const c = ad.Cylinder()
    const ax = c.Axis()
    const loc = ax.Location()
    const dir = ax.Direction()
    return { kind: "cyl", a: [loc.X(), loc.Y(), loc.Z()], d: [dir.X(), dir.Y(), dir.Z()], r: c.Radius() }
  } catch {
    return null
  } finally {
    ad.delete?.()
  }
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Could these two surfaces be closer than `reach` without touching, facing each other? Exact for the infinite surfaces. */
function mayBeNarrow(g: Geo, h: Geo, reach: number): boolean {
  if (!g || !h) return false
  const within = (gap: number) => gap > TOUCH && gap < reach
  if (g.kind === "plane" && h.kind === "plane") return dot3(g.n, h.n) < -0.99 && within(Math.abs(dot3(sub3(h.p, g.p), g.n)))
  if (g.kind === "cyl" && h.kind === "cyl") {
    if (Math.abs(dot3(g.d, h.d)) < 0.99) return false
    const axisGap = Math.hypot(...cross3(sub3(h.a, g.a), g.d))
    return within(axisGap - g.r - h.r) || within(Math.abs(g.r - h.r) - axisGap)
  }
  const [pl, cy] = g.kind === "plane" ? [g, h as Extract<Geo, { kind: "cyl" }>] : [h as Extract<Geo, { kind: "plane" }>, g]
  if (Math.abs(dot3(cy.d, pl.n)) > 0.01) return false
  return within(Math.abs(dot3(sub3(cy.a, pl.p), pl.n)) - cy.r)
}

/**
 * The narrowest slit or thin wall a step left between one of its new faces and another face of the same
 * solid: two faces facing each other (normals opposite, the gap along them) closer than SLIT across empty
 * space, or closer than THIN across material. Only planes and cylinders are looked at, screened by their
 * exact surfaces before OpenCascade measures the bounded faces, so it stays cheap. Faces that meet and
 * faces at an angle (the two sides of a small fillet) don't count. `group[i]`: which solid face i is on
 * (parts are apart on purpose).
 */
export function narrowSpot(faces: FaceLike[], isNew: boolean[], group: number[], maxPairs = 60): Narrow | null {
  const reach = Math.max(SLIT, THIN)
  const boxes = faces.map((f) => f.boundingBox.bounds as [V3, V3])
  const near = (a: [V3, V3], b: [V3, V3]) => [0, 1, 2].every((k) => a[0][k] <= b[1][k] + reach && b[0][k] <= a[1][k] + reach)
  const geo = faces.map(geoOf)
  let best: Narrow | null = null
  let pairs = 0
  for (let i = 0; i < faces.length; i++) {
    if (!isNew[i] || !geo[i]) continue
    for (let j = 0; j < faces.length; j++) {
      if (j === i || (isNew[j] && j < i) || group[i] !== group[j] || !near(boxes[i], boxes[j]) || !mayBeNarrow(geo[i], geo[j], reach)) continue
      if (++pairs > maxPairs) return best
      const c = closest(faces[i] as unknown as AnyShape, faces[j] as unknown as AnyShape)
      if (!c || c.d <= TOUCH || c.d >= reach || (best && c.d >= best.d)) continue
      const [pa, pb] = c.segment
      const v = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]
      const len = Math.hypot(...v)
      const u = v.map((x) => x / len)
      const na = normalAt(faces[i], pa)
      const nb = normalAt(faces[j], pb)
      if (!na || !nb) continue
      // Facing each other, the gap running along the normals.
      if (dot3(na, nb) > -0.7 || Math.abs(dot3(na, u)) < 0.7) continue
      const kind = dot3(na, u) > 0 ? "slit" : "thin"
      if (c.d >= (kind === "slit" ? SLIT : THIN)) continue
      best = { kind, d: c.d, at: [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2] }
    }
  }
  return best
}

const dot3 = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Outward normal of a face at a point on it (null where OpenCascade can't tell). */
function normalAt(face: FaceLike, p: V3): V3 | null {
  try {
    const n = face.normalAt(p)
    const out: V3 = [n.x, n.y, n.z]
    n.delete?.()
    return out
  } catch {
    return null
  }
}
