import * as THREE from "three"
import { arc, flipFaces, type V2 } from "@/three/geom"

/**
 * Procedural stand-in for the lesson part: a block (拉伸1) with a blind hole
 * on its top face (孔1), a fillet on the top-front edge (圆角1) and a chamfer
 * on the tangent edge chain where the fillet meets an end face (倒角1).
 *
 * The block is a YZ cross-section run along X, so the fillet is a rounded
 * corner of the section and the chamfer is the section shrinking towards one
 * end. Every face is its own mesh tagged with the feature that created it and
 * the features that later changed it, which is what the rollback and the
 * dependency graph highlight.
 */
export type FeatureId = "extrude1" | "hole1" | "fillet1" | "chamfer1"
export type ChamferEnd = "right" | "left"

/** Block length (X) and width (Y), fillet radius, chamfer distance, mm. */
export const L = 80
export const W = 50
export const R = 8
export const C = 5
/** Blind hole on the top face: position, radius, depth from the top. */
export const HOLE = { x: -14, y: 6, r: 7, depth: 20 }

const yF = -W / 2
const yB = W / 2

export type PartFace = { geo: THREE.BufferGeometry; feature: FeatureId; modifiedBy: FeatureId[] }

export type BuildOpts = { depth: number; hole: boolean; fillet: boolean; chamfer: ChamferEnd | null }

/** The edge chain the chamfer runs along (back plane → top → fillet arc → front → bottom plane), in (y, z). */
function chain(H: number, r: number, d: number): V2[] {
  if (r <= 0) return [[yB, H - d], [yF + d, H - d], [yF + d, 0]]
  return [[yB, H - d], ...arc([yF + r, H - r], r - d, Math.PI / 2, Math.PI, 12), [yF + d, 0]]
}

/** Closed cross-section (y, z), counter-clockwise, with the chain inset by d. */
function section(H: number, r: number, d: number): V2[] {
  return [[yF + d, 0], [yB, 0], ...chain(H, r, d).slice(0, -1)]
}

const circle = (cx: number, cy: number, r: number): V2[] => arc([cx, cy], r, 0, Math.PI * 2, 48).slice(0, -1)

/** A flat face from a 2D outline (plus holes), mapped into 3D and facing `normal`. */
function planar(outline: V2[], holes: V2[][], map: (a: number, b: number) => THREE.Vector3, normal: THREE.Vector3) {
  const shape = new THREE.Shape(dedupe(outline).map(([a, b]) => new THREE.Vector2(a, b)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))))
  const geo = new THREE.ShapeGeometry(shape, 1)
  const pos = geo.getAttribute("position")
  for (let i = 0; i < pos.count; i++) {
    const p = map(pos.getX(i), pos.getY(i))
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  orient(geo, (n) => n.dot(normal) < 0)
  const nrm = geo.getAttribute("normal")
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, normal.x, normal.y, normal.z)
  return geo
}

/** A ruled surface between two polylines with the same point count, facing away from `inside`. */
function ruled(a: THREE.Vector3[], b: THREE.Vector3[], inside: THREE.Vector3) {
  const n = a.length
  const pos: number[] = []
  for (const p of [...a, ...b]) pos.push(p.x, p.y, p.z)
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) idx.push(i, i + 1, n + i + 1, i, n + i + 1, n + i)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  orient(geo, (nrm, c) => nrm.dot(c.clone().sub(inside)) < 0)
  return geo
}

/** Flip the winding when the first triangle faces the wrong way. */
function orient(geo: THREE.BufferGeometry, wrong: (n: THREE.Vector3, centre: THREE.Vector3) => boolean) {
  const pos = geo.getAttribute("position")
  const index = geo.getIndex()
  const at = (k: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(k) : k)
  const [p0, p1, p2] = [at(0), at(1), at(2)]
  const n = p1.clone().sub(p0).cross(p2.clone().sub(p0))
  const c = p0.clone().add(p1).add(p2).multiplyScalar(1 / 3)
  if (!geo.getAttribute("normal")) geo.computeVertexNormals()
  if (wrong(n, c)) flipFaces(geo)
}

function dedupe(pts: V2[]) {
  return pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length]
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6
  })
}

/** The original (un-chamfered) edge chain at one end, in world space: what 「Edge7」 pointed at. */
export function chainAt(end: ChamferEnd, H: number) {
  const x = end === "right" ? L / 2 : -L / 2
  return chain(H, R, 0).map(([y, z]) => new THREE.Vector3(x, y, z))
}

export function buildPart(o: BuildOpts): PartFace[] {
  const H = o.depth
  const r = o.fillet ? R : 0
  const cR = o.chamfer === "right" ? C : 0
  const cL = o.chamfer === "left" ? C : 0
  const xa = -L / 2 + cL
  const xb = L / 2 - cR
  const through = o.hole && H <= HOLE.depth
  const inside = new THREE.Vector3(0, 0, H / 2)
  const ch: FeatureId[] = o.chamfer ? ["chamfer1"] : []
  const fi: FeatureId[] = o.fillet ? ["fillet1"] : []
  const out: PartFace[] = []
  const hole = o.hole ? [circle(HOLE.x, HOLE.y, HOLE.r)] : []

  // Top face: trimmed by the fillet and the chamfer, pierced by the hole.
  out.push({
    geo: planar([[xa, yF + r], [xb, yF + r], [xb, yB], [xa, yB]], hole, (a, b) => new THREE.Vector3(a, b, H), new THREE.Vector3(0, 0, 1)),
    feature: "extrude1",
    modifiedBy: [...(o.hole ? (["hole1"] as FeatureId[]) : []), ...fi, ...ch],
  })
  // Front face (y = −W/2).
  out.push({
    geo: planar([[xa, 0], [xb, 0], [xb, H - r], [xa, H - r]], [], (a, b) => new THREE.Vector3(a, yF, b), new THREE.Vector3(0, -1, 0)),
    feature: "extrude1",
    modifiedBy: [...fi, ...ch],
  })
  // Back face (y = +W/2): the chamfer notches its top corner at the chamfered end.
  out.push({
    geo: planar(
      [[-L / 2, 0], [L / 2, 0], [L / 2, H - cR], [L / 2 - cR, H], [-L / 2 + cL, H], [-L / 2, H - cL]],
      [],
      (a, b) => new THREE.Vector3(a, yB, b),
      new THREE.Vector3(0, 1, 0),
    ),
    feature: "extrude1",
    modifiedBy: ch,
  })
  // Bottom face: notched by the chamfer, pierced once the hole breaks through.
  out.push({
    geo: planar(
      [[-L / 2, yB], [-L / 2, yF + cL], [-L / 2 + cL, yF], [L / 2 - cR, yF], [L / 2, yF + cR], [L / 2, yB]],
      through ? hole : [],
      (a, b) => new THREE.Vector3(a, b, 0),
      new THREE.Vector3(0, 0, -1),
    ),
    feature: "extrude1",
    modifiedBy: [...(through ? (["hole1"] as FeatureId[]) : []), ...ch],
  })
  // End caps.
  for (const [end, x, c] of [["right", L / 2, cR], ["left", -L / 2, cL]] as const) {
    out.push({
      geo: planar(section(H, r, c), [], (a, b) => new THREE.Vector3(x, a, b), new THREE.Vector3(Math.sign(x), 0, 0)),
      feature: "extrude1",
      modifiedBy: [...fi, ...(o.chamfer === end ? (["chamfer1"] as FeatureId[]) : [])],
    })
  }
  // Fillet surface.
  if (r > 0) {
    const a3 = (x: number) => arc([yF + r, H - r], r, Math.PI / 2, Math.PI, 12).map(([y, z]) => new THREE.Vector3(x, y, z))
    out.push({ geo: ruled(a3(xa), a3(xb), inside), feature: "fillet1", modifiedBy: ch })
  }
  // Chamfer band: the chain at the inner station → the chain inset by C at the end face.
  if (o.chamfer) {
    const sgn = o.chamfer === "right" ? 1 : -1
    const inner = chain(H, r, 0).map(([y, z]) => new THREE.Vector3(sgn * (L / 2 - C), y, z))
    const outer = chain(H, r, C).map(([y, z]) => new THREE.Vector3(sgn * (L / 2), y, z))
    out.push({ geo: ruled(inner, outer, inside), feature: "chamfer1", modifiedBy: [] })
  }
  // Hole: wall (normals towards the axis) and, while blind, a flat bottom.
  if (o.hole) {
    const z0 = Math.max(0, H - HOLE.depth)
    const wall = new THREE.CylinderGeometry(HOLE.r, HOLE.r, H - z0, 48, 1, true)
    wall.rotateX(Math.PI / 2)
    flipFaces(wall)
    wall.translate(HOLE.x, HOLE.y, (H + z0) / 2)
    out.push({ geo: wall, feature: "hole1", modifiedBy: [] })
    if (!through) {
      const floor = new THREE.CircleGeometry(HOLE.r, 48)
      floor.translate(HOLE.x, HOLE.y, z0)
      out.push({ geo: floor, feature: "hole1", modifiedBy: [] })
    }
  }
  return out
}
