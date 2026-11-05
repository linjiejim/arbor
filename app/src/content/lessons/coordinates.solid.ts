import * as THREE from "three"
import { face } from "@/three/build"
import { flipFaces, type V2 } from "@/three/geom"
import type { MaterialKit } from "@/three/materials"

/**
 * Small boundary-representation helpers for the T0 lessons: closed solids
 * assembled from planar caps (with holes) and side walls, each face its own
 * mesh so it can be picked, highlighted or cut by a section plane.
 *
 * A `Frame` maps local (x, y, z) to world: x → u, y → v, z → w. Keep it
 * right-handed (u × v = w) so windings, and with them the normals, stay outward.
 */
export type Frame = { u: THREE.Vector3; v: THREE.Vector3; w: THREE.Vector3; o?: THREE.Vector3 }

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

/** Local = world. */
export const WORLD: Frame = { u: X, v: Y, w: Z }
/** Sketch on the front (XZ) plane, extrude towards −Y: local (x, y) = world (x, z), local z = −y. */
export const FRONT: Frame = { u: X, v: Z, w: Y.clone().negate() }
/** Sketch on the right (YZ) plane: local (x, y) = world (y, z), local z = x. */
export const SIDE: Frame = { u: Y, v: Z, w: X }

function matrix(f: Frame) {
  return new THREE.Matrix4().makeBasis(f.u, f.v, f.w).setPosition(f.o ?? new THREE.Vector3())
}

export function signedArea(loop: V2[]) {
  let a = 0
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i]
    const [x2, y2] = loop[(i + 1) % loop.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

/** Circle as a counter-clockwise loop (no repeated end point). */
export function circle(cx: number, cy: number, r: number, n = 48): V2[] {
  const out: V2[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return out
}

/** Axis-aligned rectangle as a counter-clockwise loop. */
export function rect(x0: number, y0: number, x1: number, y1: number): V2[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

/**
 * Side walls of a closed loop between local z0 < z1. Normals face away from
 * the loop's inside, or into it with `inward` (the wall of a hole or pocket).
 * `smooth` shares vertices so a circle shades round and draws no seams.
 * `skip` leaves out edges (index i joins point i to i + 1 of a CCW loop).
 */
export function walls(loop: V2[], z0: number, z1: number, f: Frame, opts: { inward?: boolean; smooth?: boolean; skip?: number[] } = {}) {
  let pts = signedArea(loop) >= 0 ? loop : [...loop].reverse()
  const skip = new Set(opts.skip ?? [])
  if (opts.inward) {
    // Reversing the loop flips the walls; remap skipped edges to the new indices.
    const n = pts.length
    pts = [...pts].reverse()
    const remapped = new Set<number>()
    for (const i of skip) remapped.add((2 * n - i - 2) % n)
    skip.clear()
    for (const i of remapped) skip.add(i)
  }
  const n = pts.length
  const g = new THREE.BufferGeometry()
  if (opts.smooth) {
    const pos: number[] = []
    for (const z of [z0, z1]) for (const [x, y] of pts) pos.push(x, y, z)
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      if (skip.has(i)) continue
      const j = (i + 1) % n
      idx.push(i, j, n + j, i, n + j, n + i)
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
  } else {
    const pos: number[] = []
    for (let i = 0; i < n; i++) {
      if (skip.has(i)) continue
      const [ax, ay] = pts[i]
      const [bx, by] = pts[(i + 1) % n]
      pos.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1)
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  }
  g.computeVertexNormals()
  g.applyMatrix4(matrix(f))
  return g
}

/** A flat face at local z: an outer loop minus holes. Faces local +z, or −z when `up` is false. */
export function cap(outer: V2[], holes: V2[][], z: number, f: Frame, up = true) {
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  const g = new THREE.ShapeGeometry(shape, 1)
  if (!up) flipFaces(g)
  g.translate(0, 0, z)
  g.applyMatrix4(matrix(f))
  return g
}

/** A box as six named faces (−x, +x, −y, +y, −z, +z). */
export function boxFaces(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return {
    "-x": cap(rect(y0, z0, y1, z1), [], x0, SIDE, false),
    "+x": cap(rect(y0, z0, y1, z1), [], x1, SIDE, true),
    "-y": cap(rect(x0, z0, x1, z1), [], -y0, FRONT, true),
    "+y": cap(rect(x0, z0, x1, z1), [], -y1, FRONT, false),
    "-z": cap(rect(x0, y0, x1, y1), [], z0, WORLD, false),
    "+z": cap(rect(x0, y0, x1, y1), [], z1, WORLD, true),
  }
}

// ------------------------------------------------------------------ the L-block

/**
 * The T0 demo part: an L-shaped block (base plate + upright on the −X end)
 * that reads differently from every side. Millimetres, Z up, base on z = 0.
 *   base     x −30…30, y −20…20, z 0…12
 *   upright  x −30…−18,          z 12…44
 */
export const L = { x0: -30, x1: 30, y0: -20, y1: 20, base: 12, upX: -18, top: 44 } as const

/** The L outline on the front plane, counter-clockwise; edge 0 is the bottom, 2 the base top, 5 the left side. */
export const L_PROFILE: V2[] = [
  [L.x0, 0],
  [L.x1, 0],
  [L.x1, L.base],
  [L.upX, L.base],
  [L.upX, L.top],
  [L.x0, L.top],
]

export type Cylinder = { center: THREE.Vector3; axis: THREE.Vector3; r: number; length: number }

export type LBlockHole =
  /** A blind hole Ø12 × 8 in the outer −X face of the upright (only one view shows it). */
  | { kind: "left-blind" }
  /** A vertical through hole Ø12 in the base plate at x = `x`. */
  | { kind: "base-through"; x: number }

export const HOLE_R = 6

/**
 * Build the L-block as named face meshes. Returns the group plus the hole as
 * a cylinder (projection needs its silhouette lines).
 */
export function lBlock(kit: MaterialKit, hole: LBlockHole) {
  const g = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, name: string, smooth = false) => {
    const m = face(geo, kit, { feature: "part", name, edges: smooth ? 40 : 30 })
    g.add(m)
    return m
  }
  add(cap(L_PROFILE, [], -L.y0, FRONT, true), "front")
  add(cap(L_PROFILE, [], -L.y1, FRONT, false), "back")
  let cyl: Cylinder
  if (hole.kind === "left-blind") {
    const c = circle(0, 30, HOLE_R)
    add(walls(L_PROFILE, -L.y1, -L.y0, FRONT, { skip: [5] }), "sides")
    add(cap(rect(L.y0, 0, L.y1, L.top), [c], L.x0, SIDE, false), "left")
    add(walls(c, L.x0, L.x0 + 8, SIDE, { inward: true, smooth: true }), "hole", true)
    add(cap(c, [], L.x0 + 8, SIDE, false), "hole-bottom")
    cyl = { center: new THREE.Vector3(L.x0 + 4, 0, 30), axis: X.clone(), r: HOLE_R, length: 8 }
  } else {
    const c = circle(hole.x, 0, HOLE_R)
    add(walls(L_PROFILE, -L.y1, -L.y0, FRONT, { skip: [0, 2] }), "sides")
    add(cap(rect(L.x0, L.y0, L.x1, L.y1), [c], 0, WORLD, false), "bottom")
    add(cap(rect(L.upX, L.y0, L.x1, L.y1), [c], L.base, WORLD, true), "base-top")
    add(walls(c, 0, L.base, WORLD, { inward: true, smooth: true }), "hole", true)
    cyl = { center: new THREE.Vector3(hole.x, 0, L.base / 2), axis: Z.clone(), r: HOLE_R, length: L.base }
  }
  return { group: g, cylinder: cyl }
}
