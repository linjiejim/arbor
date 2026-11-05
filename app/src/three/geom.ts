import * as THREE from "three"

/**
 * Procedural stand-ins for CAD operations. The prototype builds every step's
 * geometry directly (lathe, sweep, extrude), so parameters regenerate the
 * model instantly. A real B-rep kernel can replace these behind the same
 * model definitions later.
 *
 * 2D profiles are [r, z] pairs in the half-plane of a revolve: r to the right,
 * z up. Walk the cross-section counter-clockwise so normals face outward.
 */
export type V2 = [number, number]

const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]]
const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k]
const len = (a: V2) => Math.hypot(a[0], a[1])
const norm = (a: V2): V2 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}

/** Points along an arc around `c` from angle a0 to a1 (radians), both ends included. */
export function arc(c: V2, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r])
  }
  return out
}

/**
 * Round the corner p1 (between p0→p1→p2) with a tangent arc of radius r.
 * The radius shrinks if the neighbouring segments are too short, like a CAD
 * fillet would fail instead; `clamped` reports that so the UI can warn.
 */
export function filletCorner(p0: V2, p1: V2, p2: V2, r: number, n = 12) {
  const u = norm(sub(p0, p1))
  const v = norm(sub(p2, p1))
  const cos = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))
  const theta = Math.acos(cos)
  if (r <= 1e-6 || theta < 1e-3 || Math.PI - theta < 1e-3) return { pts: [p1], center: p1, r: 0, clamped: false }
  let d = r / Math.tan(theta / 2)
  const maxD = Math.min(len(sub(p0, p1)), len(sub(p2, p1))) * 0.98
  let clamped = false
  if (d > maxD) {
    d = maxD
    r = d * Math.tan(theta / 2)
    clamped = true
  }
  const t1 = add(p1, mul(u, d))
  const t2 = add(p1, mul(v, d))
  const bis = norm(add(u, v))
  const c = add(p1, mul(bis, r / Math.sin(theta / 2)))
  let a0 = Math.atan2(t1[1] - c[1], t1[0] - c[0])
  let a1 = Math.atan2(t2[1] - c[1], t2[0] - c[0])
  let da = a1 - a0
  while (da > Math.PI) da -= 2 * Math.PI
  while (da < -Math.PI) da += 2 * Math.PI
  a1 = a0 + da
  return { pts: arc(c, r, a0, a1, n), center: c, r, clamped }
}

/** Offset the infinite line through a→b by `d` to its left (counter-clockwise normal). */
export function offsetLine(a: V2, b: V2, d: number): [V2, V2] {
  const t = norm(sub(b, a))
  const nrm: V2 = [-t[1], t[0]]
  return [add(a, mul(nrm, d)), add(b, mul(nrm, d))]
}

/** Intersection of lines a1→a2 and b1→b2 (infinite). */
export function intersect(a1: V2, a2: V2, b1: V2, b2: V2): V2 {
  const d1 = sub(a2, a1)
  const d2 = sub(b2, b1)
  const den = d1[0] * d2[1] - d1[1] * d2[0]
  if (Math.abs(den) < 1e-9) return a2
  const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den
  return add(a1, mul(d1, t))
}

/**
 * Revolve a profile about the Z axis. Returns a Z-up geometry. The sweep
 * starts on the +X side of the front (XZ) plane, where the sketch lies, and
 * turns towards +Y, so a growing `phiLength` animates the revolve.
 */
export function lathe(profile: V2[], phiLength = Math.PI * 2, segments = 96): THREE.BufferGeometry {
  const pts = profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0), z))
  const segs = Math.max(3, Math.round((segments * phiLength) / (Math.PI * 2)))
  const g = new THREE.LatheGeometry(pts, segs, Math.PI / 2, phiLength)
  // Lathe revolves about +Y as (r·sinφ, y, r·cosφ); turning +Y into +Z gives (r·sinφ, −r·cosφ, z).
  g.rotateX(Math.PI / 2)
  return g
}

/** Circle (or arc) of radius r at height z around the Z axis, matching lathe()'s angles. */
export function ringPoints(r: number, z: number, phiLength = Math.PI * 2, segments = 96): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  const n = Math.max(3, Math.round((segments * phiLength) / (Math.PI * 2)))
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (phiLength * i) / n
    out.push(new THREE.Vector3(Math.sin(a) * r, -Math.cos(a) * r, z))
  }
  return out
}

/**
 * Sweep an elliptical section along a planar curve. The section keeps a fixed
 * binormal (the sketch plane normal), so it never twists. `a` is the half
 * size inside the sketch plane, `b` along the binormal.
 */
export function sweepEllipse(
  curve: THREE.Curve<THREE.Vector3>,
  opts: { a: number; b: number; binormal: THREE.Vector3; tEnd?: number; tubular?: number; radial?: number; caps?: boolean },
): THREE.BufferGeometry {
  const tEnd = Math.max(1e-3, Math.min(1, opts.tEnd ?? 1))
  const tubular = opts.tubular ?? 96
  const radial = opts.radial ?? 32
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const B0 = opts.binormal.clone().normalize()
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  const B = new THREE.Vector3()
  const frames: { P: THREE.Vector3; T: THREE.Vector3; N: THREE.Vector3; B: THREE.Vector3 }[] = []
  for (let i = 0; i <= tubular; i++) {
    const t = (tEnd * i) / tubular
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T).normalize()
    N.crossVectors(B0, T).normalize()
    B.crossVectors(T, N).normalize()
    frames.push({ P: P.clone(), T: T.clone(), N: N.clone(), B: B.clone() })
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      pos.push(P.x + N.x * c * opts.a + B.x * s * opts.b, P.y + N.y * c * opts.a + B.y * s * opts.b, P.z + N.z * c * opts.a + B.z * s * opts.b)
      const nx = (N.x * c) / opts.a + (B.x * s) / opts.b
      const ny = (N.y * c) / opts.a + (B.y * s) / opts.b
      const nz = (N.z * c) / opts.a + (B.z * s) / opts.b
      const l = Math.hypot(nx, ny, nz) || 1
      nor.push(nx / l, ny / l, nz / l)
    }
  }
  const row = radial + 1
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * row + j
      const b = (i + 1) * row + j
      const c = (i + 1) * row + j + 1
      const d = i * row + j + 1
      idx.push(a, d, b, b, d, c)
    }
  }
  if (opts.caps !== false) {
    for (const [fi, sign] of [
      [0, -1],
      [tubular, 1],
    ] as const) {
      const f = frames[fi]
      const center = pos.length / 3
      pos.push(f.P.x, f.P.y, f.P.z)
      nor.push(f.T.x * sign, f.T.y * sign, f.T.z * sign)
      const start = pos.length / 3
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2
        const c = Math.cos(th)
        const s = Math.sin(th)
        pos.push(
          f.P.x + f.N.x * c * opts.a + f.B.x * s * opts.b,
          f.P.y + f.N.y * c * opts.a + f.B.y * s * opts.b,
          f.P.z + f.N.z * c * opts.a + f.B.z * s * opts.b,
        )
        nor.push(f.T.x * sign, f.T.y * sign, f.T.z * sign)
      }
      for (let j = 0; j < radial; j++) {
        if (sign > 0) idx.push(center, start + j, start + j + 1)
        else idx.push(center, start + j + 1, start + j)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** Ellipse outline in the plane spanned by n and b around p (sketch of a sweep section). */
export function ellipsePoints(p: THREE.Vector3, n: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, segs = 64) {
  const out: THREE.Vector3[] = []
  for (let j = 0; j <= segs; j++) {
    const th = (j / segs) * Math.PI * 2
    out.push(p.clone().addScaledVector(n, Math.cos(th) * ra).addScaledVector(b, Math.sin(th) * rb))
  }
  return out
}

/** Rounded rectangle centred on the origin, as a THREE.Shape (or Path for holes). */
export function roundedRect<T extends THREE.Path>(target: T, w: number, h: number, r: number, cx = 0, cy = 0): T {
  r = Math.max(0, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3))
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  target.moveTo(x0 + r, y0)
  target.lineTo(x0 + w - r, y0)
  if (r) target.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false)
  target.lineTo(x0 + w, y0 + h - r)
  if (r) target.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false)
  target.lineTo(x0 + r, y0 + h)
  if (r) target.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false)
  target.lineTo(x0, y0 + r)
  if (r) target.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false)
  return target
}

/** Rounded rectangle as a closed list of points (for sketches and rings). */
export function roundedRectPoints(w: number, h: number, r: number, z = 0, segs = 8, cx = 0, cy = 0): THREE.Vector3[] {
  const s = roundedRect(new THREE.Path(), w, h, r, cx, cy)
  return s.getPoints(segs).map((p) => new THREE.Vector3(p.x, p.y, z)).concat(new THREE.Vector3(s.getPoint(0).x, s.getPoint(0).y, z))
}

/** Extrude a shape along +Z from z0, with an optional tangent round on both caps. */
export function extrude(shape: THREE.Shape, depth: number, opts: { z0?: number; round?: number; curveSegments?: number } = {}) {
  const r = Math.max(0, Math.min(opts.round ?? 0, depth / 2 - 1e-3))
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-3, depth - 2 * r),
    bevelEnabled: r > 0,
    bevelThickness: r,
    bevelSize: r,
    bevelOffset: -r,
    bevelSegments: r > 0 ? 5 : 0,
    curveSegments: opts.curveSegments ?? 16,
  })
  g.translate(0, 0, (opts.z0 ?? 0) + r)
  return g
}

/**
 * A rectangular prism of w × h (centred on the sketch origin) extruded by
 * `depth` with a draft (taper) angle. Positive draft narrows the far end.
 * `mode` mirrors the CAD extrude options: one side, symmetric, or both.
 */
export function draftedPrism(w: number, h: number, depth: number, draftDeg: number, mode: "one" | "symmetric" = "one") {
  const k = Math.tan(THREE.MathUtils.degToRad(draftDeg))
  const z0 = mode === "symmetric" ? -depth / 2 : 0
  const z1 = z0 + depth
  // Draft is measured from the sketch plane (z = 0): a symmetric extrude narrows towards both ends.
  const inset = (z: number) => Math.max(-Math.min(w, h) / 2 + 0.2, -Math.abs(z) * k)
  const ring = (z: number) => {
    const d = inset(z)
    const hw = w / 2 + d
    const hh = h / 2 + d
    return [
      [-hw, -hh, z],
      [hw, -hh, z],
      [hw, hh, z],
      [-hw, hh, z],
    ] as const
  }
  const levels = mode === "symmetric" && draftDeg > 0 ? [z0, 0, z1] : [z0, z1]
  const rings = levels.map(ring)
  const b = rings[0]
  const t = rings[rings.length - 1]
  const pos: number[] = []
  const quad = (p: readonly (readonly [number, number, number])[]) => {
    const [a, c1, c2, d] = p
    pos.push(...a, ...c1, ...c2, ...a, ...c2, ...d)
  }
  quad([b[3], b[2], b[1], b[0]])
  quad([t[0], t[1], t[2], t[3]])
  for (let r = 0; r < rings.length - 1; r++) {
    const lo = rings[r]
    const hi = rings[r + 1]
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      quad([lo[i], lo[j], hi[j], hi[i]])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Loft between two closed planar sections with the same point count, linearly. */
export function loft(a: THREE.Vector3[], b: THREE.Vector3[], steps = 24, k = 1): THREE.BufferGeometry {
  const n = Math.min(a.length, b.length)
  const rows = Math.max(1, Math.round(steps * k))
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= rows; i++) {
    const t = (i / steps)
    for (let j = 0; j < n; j++) {
      const p = a[j].clone().lerp(b[j], t)
      pos.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n
      const p0 = i * n + j
      const p1 = i * n + j2
      const p2 = (i + 1) * n + j2
      const p3 = (i + 1) * n + j
      idx.push(p0, p1, p2, p0, p2, p3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Flat cap (fan) for a closed planar loop; `flip` for the bottom side. */
export function capLoop(loop: THREE.Vector3[], flip = false): THREE.BufferGeometry {
  const shape = new THREE.Shape(loop.map((p) => new THREE.Vector2(p.x, p.y)))
  const g = new THREE.ShapeGeometry(shape, 24)
  const z = loop[0].z
  g.translate(0, 0, z)
  if (flip) {
    const idx = g.getIndex()!
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1)
      idx.setX(i + 1, idx.getX(i + 2))
      idx.setX(i + 2, t)
    }
    const nrm = g.getAttribute("normal")
    for (let i = 0; i < nrm.count; i++) nrm.setZ(i, -nrm.getZ(i))
  }
  return g
}

/** Sample a profile point list as THREE.Vector3 in the XZ plane (y = 0): the front sketch plane. */
export function profileToXZ(profile: V2[], y = 0): THREE.Vector3[] {
  return profile.map(([r, z]) => new THREE.Vector3(r, y, z))
}

/** Reverse triangle winding and normals: the same surface, facing the other way. */
export function flipFaces(geo: THREE.BufferGeometry) {
  const index = geo.getIndex()
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, a)
    }
  } else {
    const pos = geo.getAttribute("position")
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i + 1), y = pos.getY(i + 1), z = pos.getZ(i + 1)
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))
      pos.setXYZ(i + 2, x, y, z)
    }
  }
  const n = geo.getAttribute("normal")
  if (n) for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  return geo
}
