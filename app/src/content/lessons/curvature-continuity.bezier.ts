import type { V2 } from "@/three/geom"

/**
 * Bézier curves of any degree in 2D, with the derivatives needed for
 * curvature combs. Shared by 「曲率梳与 G0 / G1 / G2 连续」 and 「斑马纹」.
 *
 * Signed curvature follows the usual convention: positive when the curve
 * turns left (counter-clockwise) as t grows.
 */

export function bezierPoint(P: V2[], t: number): V2 {
  let Q = P.map((p) => [p[0], p[1]] as V2)
  while (Q.length > 1) {
    const next: V2[] = []
    for (let i = 0; i < Q.length - 1; i++) next.push([Q[i][0] + (Q[i + 1][0] - Q[i][0]) * t, Q[i][1] + (Q[i + 1][1] - Q[i][1]) * t])
    Q = next
  }
  return Q[0]
}

/** Control points of the derivative curve (degree n − 1). */
export function hodograph(P: V2[]): V2[] {
  const n = P.length - 1
  const out: V2[] = []
  for (let i = 0; i < n; i++) out.push([n * (P[i + 1][0] - P[i][0]), n * (P[i + 1][1] - P[i][1])])
  return out
}

export type CurveSample = { p: V2; tangent: V2; normal: V2; k: number }

/** Point, unit tangent, left normal and signed curvature at t. */
export function bezierSample(P: V2[], t: number): CurveSample {
  const d1P = hodograph(P)
  const d1 = bezierPoint(d1P, t)
  const d2 = d1P.length > 1 ? bezierPoint(hodograph(d1P), t) : ([0, 0] as V2)
  const sp = Math.hypot(d1[0], d1[1]) || 1e-9
  const tangent: V2 = [d1[0] / sp, d1[1] / sp]
  return {
    p: bezierPoint(P, t),
    tangent,
    normal: [-tangent[1], tangent[0]],
    k: (d1[0] * d2[1] - d1[1] * d2[0]) / (sp * sp * sp),
  }
}

export function sampleBezier(P: V2[], n: number): CurveSample[] {
  const out: CurveSample[] = []
  for (let i = 0; i <= n; i++) out.push(bezierSample(P, i / n))
  return out
}

/**
 * A degree-5 corner blend between two straight lines meeting at `corner`
 * (incoming direction `din`, outgoing `dout`, unit vectors). Three control
 * points sit on each line, so the curvature is zero at both ends: G2 to
 * the lines. The spacing (1.5 / 0.9 / 0.45 × size) gives a single smooth
 * curvature peak close to 1 / size for a 90° corner, so it compares fairly
 * with a circular fillet of radius `size`.
 */
export function g2CornerBlend(corner: V2, din: V2, dout: V2, size: number): V2[] {
  const back = (k: number): V2 => [corner[0] - din[0] * k * size, corner[1] - din[1] * k * size]
  const fwd = (k: number): V2 => [corner[0] + dout[0] * k * size, corner[1] + dout[1] * k * size]
  return [back(1.5), back(0.9), back(0.45), fwd(0.45), fwd(0.9), fwd(1.5)]
}

export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
export const addv = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]]
export const scale = (a: V2, k: number): V2 => [a[0] * k, a[1] * k]
export const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1]
export const cross = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0]
export const length = (a: V2) => Math.hypot(a[0], a[1])
export const unit = (a: V2): V2 => {
  const l = length(a) || 1e-9
  return [a[0] / l, a[1] / l]
}
