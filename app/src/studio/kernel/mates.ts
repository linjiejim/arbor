// Placing a component by mates instead of coordinates: face against face (contact), faces level
// (flush), axes lined up (coaxial). Not a constraint solver: the mates are applied in order, each one
// moving the part only in the ways the earlier ones left free (a contact leaves sliding in the plane
// and turning about its normal; a coaxial leaves sliding along and turning about the axis), so a
// screw goes "into that hole, head down on that face" the way a person would put it there.

export type V3 = [number, number, number]

/** A plane (outward normal, a point on it) or an axis (a point, a direction): what a mate lines up. */
export type MateGeo = { kind: "plane"; n: V3; p: V3 } | { kind: "axis"; a: V3; d: V3 }

export type MateKind = "contact" | "flush" | "coaxial"

/** A rigid placement: x ↦ R·x + t (R row-major 3×3). */
export type Rigid = { R: number[]; t: V3 }

export const IDENTITY: Rigid = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(...a)
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1))

export const applyR = (R: number[], v: V3): V3 => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]
export const applyRigid = (T: Rigid, p: V3): V3 => add(applyR(T.R, p), T.t)
const mulR = (A: number[], B: number[]) => {
  const out = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) out[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]
  return out
}

/** Rotation by `angle` (radians) about the unit axis `u`. */
export function rotation(u: V3, angle: number): number[] {
  const [x, y, z] = u
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const C = 1 - c
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]
}

/** Turn the placement by R about the point `pivot` (in the assembly). */
function turn(T: Rigid, R: number[], pivot: V3): Rigid {
  return { R: mulR(R, T.R), t: add(applyR(R, sub(T.t, pivot)), pivot) }
}

/** A rotation as an axis and an angle in degrees (for replicad's rotate). */
export function axisAngle(R: number[]): { axis: V3; angle: number } {
  const cos = Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2))
  const angle = Math.acos(cos)
  if (angle < 1e-9) return { axis: [0, 0, 1], angle: 0 }
  if (Math.PI - angle < 1e-6) {
    // 180°: the axis from the diagonal.
    const xx = Math.sqrt(Math.max(0, (R[0] + 1) / 2))
    const yy = Math.sqrt(Math.max(0, (R[4] + 1) / 2))
    const zz = Math.sqrt(Math.max(0, (R[8] + 1) / 2))
    let axis: V3 = xx >= yy && xx >= zz ? [xx, R[1] / (2 * xx), R[2] / (2 * xx)] : yy >= zz ? [R[1] / (2 * yy), yy, R[5] / (2 * yy)] : [R[2] / (2 * zz), R[5] / (2 * zz), zz]
    axis = unit(axis)
    return { axis, angle: 180 }
  }
  const axis = unit([R[7] - R[5], R[2] - R[6], R[3] - R[1]])
  return { axis, angle: (angle * 180) / Math.PI }
}

/** How the part may still move: turning (freely, about one axis through a point, or not), sliding (a basis of directions). */
export type Freedom = { turn: "any" | { axis: V3; through: V3 } | "none"; slide: V3[] }
export const FREE: Freedom = { turn: "any", slide: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }

/** The part of `v` in the span of the orthonormal `basis`. */
const project = (v: V3, basis: V3[]): V3 => basis.reduce<V3>((acc, b) => add(acc, mul(b, dot(v, b))), [0, 0, 0])

/** An orthonormal basis of span(basis) ∩ (plane ⊥ n). */
function withoutDir(basis: V3[], n: V3): V3[] {
  const kept: V3[] = []
  for (const b of basis) {
    let v = sub(b, mul(n, dot(b, n)))
    for (const k of kept) v = sub(v, mul(k, dot(v, k)))
    if (len(v) > 1e-6) kept.push(unit(v))
  }
  // Gram-Schmidt of the projections spans the projection of the space; keep only what stays inside it.
  return kept.filter((k) => len(sub(project(k, basis), k)) < 1e-6)
}

/** span(basis) ∩ line along d. */
function alongDir(basis: V3[], d: V3): V3[] {
  return len(sub(project(d, basis), d)) < 1e-6 ? [unit(d)] : []
}

/**
 * Turn so that unit vector `from` (already placed) points along `to`, the way `free` allows, about
 * `pivot`. Returns the new placement and how far off (degrees) it stays.
 */
function aim(T: Rigid, free: Freedom, from: V3, to: V3, pivot: V3): { T: Rigid; off: number } {
  const angleOf = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI
  if (angleOf(from, to) < 1e-6 || free.turn === "none") return { T, off: angleOf(from, to) }
  if (free.turn === "any") {
    let axis = cross(from, to)
    if (len(axis) < 1e-9) {
      // Opposite: any axis across it.
      axis = Math.abs(from[0]) < 0.9 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0])
    }
    const R = rotation(unit(axis), (angleOf(from, to) * Math.PI) / 180)
    return { T: turn(T, R, pivot), off: 0 }
  }
  // About one axis only: the angle between the two directions' components across that axis.
  const u = free.turn.axis
  const a = sub(from, mul(u, dot(from, u)))
  const b = sub(to, mul(u, dot(to, u)))
  if (len(a) < 1e-9 || len(b) < 1e-9) return { T, off: angleOf(from, to) }
  const ang = Math.atan2(dot(cross(unit(a), unit(b)), u), dot(unit(a), unit(b)))
  const next = turn(T, rotation(u, ang), free.turn.through)
  return { T: next, off: angleOf(applyR(rotation(u, ang), from), to) }
}

export type MateStep = { kind: MateKind; mine: MateGeo; target: MateGeo; offset?: number; flip?: boolean }

/**
 * Apply one mate to placement `T` with freedom `free`: `mine` is in the part's own frame, `target` in the
 * assembly. Returns the new placement and freedom, and a reason when it couldn't be met exactly.
 */
export function applyMate(T: Rigid, free: Freedom, m: MateStep): { T: Rigid; free: Freedom; miss?: string } {
  const offset = m.offset ?? 0
  if (m.kind === "coaxial") {
    if (m.mine.kind !== "axis" || m.target.kind !== "axis") throw new Error("同轴（coaxial）要两边都选圆柱面或圆锥面")
    const d = applyR(T.R, m.mine.d)
    const a = applyRigid(T, m.mine.a)
    const want = dot(d, m.target.d) >= 0 !== !!m.flip ? m.target.d : mul(m.target.d, -1)
    const turned = aim(T, free, d, want, a)
    T = turned.T
    const a2 = applyRigid(T, m.mine.a)
    // Onto the target's line: the part of the gap across the axis.
    const gap = sub(m.target.a, a2)
    const across = sub(gap, mul(m.target.d, dot(gap, m.target.d)))
    const move = project(across, free.slide)
    T = { R: T.R, t: add(T.t, move) }
    const left = len(sub(across, move))
    const next: Freedom = {
      turn: free.turn === "none" ? "none" : free.turn === "any" || Math.abs(dot(free.turn.axis, m.target.d)) > 1 - 1e-6 ? { axis: unit(m.target.d), through: m.target.a } : "none",
      slide: alongDir(free.slide, m.target.d),
    }
    const miss = turned.off > 0.05 ? `方向差 ${round(turned.off)}°` : left > 1e-3 ? `轴线还差 ${round(left)} mm` : undefined
    return { T, free: next, miss }
  }
  if (m.mine.kind !== "plane" || m.target.kind !== "plane") throw new Error(`${m.kind === "contact" ? "贴合（contact）" : "平齐（flush）"}要两边都选平面`)
  const n = applyR(T.R, m.mine.n)
  const p = applyRigid(T, m.mine.p)
  const want = m.kind === "contact" ? mul(m.target.n, -1) : m.target.n
  const turned = aim(T, free, n, want, p)
  T = turned.T
  const p2 = applyRigid(T, m.mine.p)
  // Along the target's normal onto its plane (plus the offset, away from it).
  const s = dot(sub(add(m.target.p, mul(m.target.n, offset)), p2), m.target.n)
  const dir = project(m.target.n, free.slide)
  const k = dot(dir, m.target.n)
  const move = k > 1e-9 ? mul(dir, s / k) : ([0, 0, 0] as V3)
  T = { R: T.R, t: add(T.t, move) }
  const left = k > 1e-9 ? 0 : Math.abs(s)
  const next: Freedom = {
    turn: free.turn === "none" ? "none" : free.turn === "any" ? { axis: unit(m.target.n), through: p2 } : Math.abs(dot(free.turn.axis, m.target.n)) > 1 - 1e-6 ? free.turn : "none",
    slide: withoutDir(free.slide, m.target.n),
  }
  const miss = turned.off > 0.05 ? `方向差 ${round(turned.off)}°（前面的贴合不让它这样转）` : left > 1e-3 ? `还差 ${round(left)} mm（前面的贴合不让它这样移）` : undefined
  return { T, free: next, miss }
}

const round = (x: number) => Math.round(x * 100) / 100
