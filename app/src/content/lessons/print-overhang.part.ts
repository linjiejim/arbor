import * as THREE from "three"

/**
 * The lesson part and its print analysis: a T-shaped bracket (a stem with a
 * cross bar on top), drawn as an XZ profile extruded 24 mm along Y. Under
 * the right arm sits a 45° chamfer; the left arm's underside is flat unless
 * `chamferLeft` is on.
 *
 * `analyse` places the part on the build plate for an orientation and
 * measures, per triangle, the overhang angle against the build direction
 * (+Z): 0° for a vertical wall, 90° for a flat face looking straight down.
 */
export const DEPTH = 24
/** Overhang to ignore when comparing with the threshold, so an exact 45° face counts as printable. */
const EPS = 0.5

export type Orientation = { rotX: number; rotY: number; chamferLeft: boolean }

export function profile(chamferLeft: boolean): [number, number][] {
  return [
    [-8, 0],
    [8, 0],
    [8, 18],
    [30, 40],
    [30, 50],
    [-30, 50],
    [-30, 40],
    ...(chamferLeft ? ([[-8, 18]] as [number, number][]) : ([[-8, 40]] as [number, number][])),
  ]
}

export type Placed = {
  geo: THREE.BufferGeometry
  /** Part frame (profile in XZ, stem along +Z) → build plate. */
  matrix: THREE.Matrix4
  /** Per triangle: overhang angle in degrees (negative for faces looking up), and whether it lies on the plate. */
  alpha: number[]
  onPlate: boolean[]
  areas: number[]
  height: number
  /** |cos| between the stem axis and the build direction: 1 = load straight across the layers. */
  loadAcross: number
}

let cache: { key: string; placed: Placed } | null = null

/** Place the part for an orientation (memoised: the scene and the panel ask for the same one). */
export function place(o: Orientation): Placed {
  const key = `${o.rotX}|${o.rotY}|${o.chamferLeft}`
  if (cache?.key === key) return cache.placed

  const shape = new THREE.Shape(profile(o.chamferLeft).map(([x, z]) => new THREE.Vector2(x, z)))
  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false })
  if (geo.index) geo = geo.toNonIndexed()
  // Profile y → world z; extrusion along world y, centred.
  const toPart = new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, DEPTH / 2, 0))
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(o.rotX), THREE.MathUtils.degToRad(o.rotY), 0, "XYZ"))
  geo.applyMatrix4(toPart).applyMatrix4(rot)
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  const shift = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z)
  geo.applyMatrix4(shift)
  geo.computeVertexNormals()
  geo.userData.shared = true

  const pos = geo.getAttribute("position")
  const alpha: number[] = []
  const onPlate: boolean[] = []
  const areas: number[] = []
  const a = new THREE.Vector3()
  const bb = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    bb.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const n = bb.clone().sub(a).cross(c.clone().sub(a))
    areas.push(n.length() / 2)
    n.normalize()
    alpha.push(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(-n.z, -1, 1))))
    onPlate.push(Math.max(a.z, bb.z, c.z) < 0.01)
  }

  const matrix = shift.clone().multiply(rot)
  const stem = new THREE.Vector3(0, 0, 1).applyMatrix4(rot)
  const placed: Placed = { geo, matrix, alpha, onPlate, areas, height: b.max.z - b.min.z, loadAcross: Math.abs(stem.z) }
  cache?.placed.geo.dispose()
  cache = { key, placed }
  return placed
}

export const needsSupport = (p: Placed, i: number, threshold: number) => !p.onPlate[i] && p.alpha[i] > threshold + EPS

/** Area of the faces that need support, mm². */
export function supportArea(o: Orientation, threshold: number) {
  const p = place(o)
  let sum = 0
  for (let i = 0; i < p.alpha.length; i++) if (needsSupport(p, i, threshold)) sum += p.areas[i]
  return Math.round(sum)
}
