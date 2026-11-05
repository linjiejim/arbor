import * as THREE from "three"
import { flipFaces } from "@/three/geom"

/**
 * Geometry for 1.2.6 「圆角与倒角」: a 60 × 30 × 20 block whose 4 top edges
 * and 4 vertical edges can be rounded (constant radius) or chamfered
 * (distance × distance).
 *
 * The block is built from horizontal slices. Each slice is the footprint
 * rectangle with every side moved in by its top-edge setback at that height
 * (a quarter circle for a fillet, a straight line for a chamfer), and every
 * corner cut by its vertical-edge treatment. For straight edges this is
 * exact: a top-edge fillet is a cylinder, a vertical-edge fillet a cylinder,
 * three filleted edges at one corner meet in a sphere, two filleted top edges
 * over a sharp vertical edge meet in a mitred intersection. Where only one of
 * the top edges at a filleted vertical edge is selected, the corner blend is
 * an approximation of what a CAD vertex blend would produce.
 */
export const W = 60
export const D = 30
export const H = 20

export type EdgeId = "tf" | "tr" | "tb" | "tl" | "vfl" | "vfr" | "vbr" | "vbl"
export type Mode = "fillet" | "chamfer"

/** Sides in ring order (counter-clockwise from above, starting at the front-left corner). */
export const SIDES = ["front", "right", "back", "left"] as const
const TOP_OF_SIDE: EdgeId[] = ["tf", "tr", "tb", "tl"]
/** Corners: 0 front-left, 1 front-right, 2 back-right, 3 back-left. Corner c sits before side c. */
const VERT_OF_CORNER: EdgeId[] = ["vfl", "vfr", "vbr", "vbl"]
const CORNER_XY: [number, number][] = [
  [-W / 2, -D / 2],
  [W / 2, -D / 2],
  [W / 2, D / 2],
  [-W / 2, D / 2],
]

export const EDGE_NAMES: Record<EdgeId, string> = {
  tf: "前上边",
  tr: "右上边",
  tb: "后上边",
  tl: "左上边",
  vfl: "左前竖边",
  vfr: "右前竖边",
  vbr: "右后竖边",
  vbl: "左后竖边",
}

/** The sharp edge's segment on the unmodified block (picking, highlight). */
export function edgeSegment(id: EdgeId): [THREE.Vector3, THREE.Vector3] {
  const t = TOP_OF_SIDE.indexOf(id)
  if (t >= 0) {
    const [x0, y0] = CORNER_XY[t]
    const [x1, y1] = CORNER_XY[(t + 1) % 4]
    return [new THREE.Vector3(x0, y0, H), new THREE.Vector3(x1, y1, H)]
  }
  const [x, y] = CORNER_XY[VERT_OF_CORNER.indexOf(id)]
  return [new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y, H)]
}

export type Treatment = { mode: Mode; sel: EdgeId[]; r: number; c1: number; c2: number }

/**
 * How far a treatment eats into each neighbouring face. Fillet: R on both.
 * Chamfer: top edges take c1 on the top face and c2 down the side; vertical
 * edges take c1 along the long (front/back) face and c2 along the short one.
 */
function setbacks(t: Treatment) {
  const top = t.mode === "fillet" ? t.r : t.c1
  const side = t.mode === "fillet" ? t.r : t.c2
  const long = t.mode === "fillet" ? t.r : t.c1
  const short = t.mode === "fillet" ? t.r : t.c2
  return { top, side, long, short }
}

export type Failure = { face: string; text: string; at: THREE.Vector3 }

/** The reason a treatment cannot be built, or null. Each face must be wide enough for what its edges take. */
export function failure(t: Treatment): Failure | null {
  if (!t.sel.length) return null
  const has = (e: EdgeId) => t.sel.includes(e)
  const s = setbacks(t)
  const eps = 1e-6
  const what = t.mode === "fillet" ? "圆角" : "倒角"
  const amount = (n: number, v: number) => (n === 1 ? `${fmt(v)} mm` : `${n} × ${fmt(v)} = ${fmt(n * v)} mm`)
  const checks: [number, number, number, string, string, THREE.Vector3][] = [
    // [edge count, setback each, face extent, face name, direction, label position]
    [Number(has("tf")) + Number(has("tb")), s.top, D, "顶面", "宽", new THREE.Vector3(0, 0, H + 2)],
    [Number(has("tl")) + Number(has("tr")), s.top, W, "顶面", "长", new THREE.Vector3(0, 0, H + 2)],
    [Number(has("tf")), s.side, H, "前侧面", "高", new THREE.Vector3(0, -D / 2 - 2, H / 2)],
    [Number(has("tb")), s.side, H, "后侧面", "高", new THREE.Vector3(0, D / 2 + 2, H / 2)],
    [Number(has("tl")), s.side, H, "左侧面", "高", new THREE.Vector3(-W / 2 - 2, 0, H / 2)],
    [Number(has("tr")), s.side, H, "右侧面", "高", new THREE.Vector3(W / 2 + 2, 0, H / 2)],
    [Number(has("vfl")) + Number(has("vfr")), s.long, W, "前侧面", "长", new THREE.Vector3(0, -D / 2 - 2, H / 2)],
    [Number(has("vbl")) + Number(has("vbr")), s.long, W, "后侧面", "长", new THREE.Vector3(0, D / 2 + 2, H / 2)],
    [Number(has("vfl")) + Number(has("vbl")), s.short, D, "左侧面", "宽", new THREE.Vector3(-W / 2 - 2, 0, H / 2)],
    [Number(has("vfr")) + Number(has("vbr")), s.short, D, "右侧面", "宽", new THREE.Vector3(W / 2 + 2, 0, H / 2)],
  ]
  for (const [n, v, extent, face, dir, at] of checks) {
    if (n > 0 && n * v > extent + eps) {
      return {
        face,
        at,
        text: `${face}只有 ${extent} mm ${dir}，${n === 1 ? "这条边" : `${n} 条边`}的${what}要在它上面占掉 ${amount(n, v)}，面不够用了。`,
      }
    }
  }
  return null
}

const fmt = (v: number) => String(Math.round(v * 10) / 10)

/** Corner samples (K + 1 points each); sides are the quads between corner groups. */
const K = 12

export type BlockMesh = {
  /** Faces created by the fillet / chamfer feature. */
  feature: THREE.BufferGeometry
  /** Everything else (original block faces, trimmed). */
  rest: THREE.BufferGeometry
  top: THREE.BufferGeometry
  bottom: THREE.BufferGeometry
  sharp: THREE.Vector3[][]
  soft: THREE.Vector3[][]
  /** A line on each selected edge's new face (for the selection highlight). */
  marks: Partial<Record<EdgeId, THREE.Vector3[]>>
  /** Where the fillet / chamfer meets the top face along the front edge (y). */
  frontTangentY: number
}

/**
 * Build the block. `hole` cuts a through hole (centre x, y, radius) into the
 * top and bottom caps; the caller adds the hole wall.
 */
export function buildBlock(t: Treatment, hole?: { x: number; y: number; r: number }): BlockMesh {
  const sel = new Set(t.sel)
  const fillet = t.mode === "fillet"
  const s = setbacks(t)
  const topSel = TOP_OF_SIDE.map((e) => sel.has(e))
  const vertSel = VERT_OF_CORNER.map((e) => sel.has(e))
  const zone = topSel.some(Boolean) ? s.side : 0
  const M = fillet ? 16 : 8

  // Row heights and the top-edge setback at each row (0 below the zone).
  const rows: { z: number; d: number }[] = [{ z: 0, d: 0 }]
  if (zone > 0) {
    for (let k = 0; k <= M; k++) {
      const u = k / M
      if (fillet) {
        const th = (u * Math.PI) / 2
        rows.push({ z: H - zone + zone * Math.sin(th), d: s.top - s.top * Math.cos(th) })
      } else rows.push({ z: H - zone + zone * u, d: s.top * u })
    }
  } else rows.push({ z: H, d: 0 })
  const lowerTop = 1 // rows[1] is the top of the plain wall

  const ring = (d: number) => {
    const inset = topSel.map((on) => (on ? d : 0))
    // Inset footprint: front y, right x, back y, left x.
    const yF = -D / 2 + inset[0]
    const xR = W / 2 - inset[1]
    const yB = D / 2 - inset[2]
    const xL = -W / 2 + inset[3]
    const corners: [number, number][] = [
      [xL, yF],
      [xR, yF],
      [xR, yB],
      [xL, yB],
    ]
    const pts: THREE.Vector2[] = []
    for (let c = 0; c < 4; c++) {
      const prev = (c + 3) % 4
      const dmax = Math.max(inset[prev], inset[c])
      const [px, py] = corners[c]
      // Travel directions of the incoming and outgoing sides.
      const dirs: [number, number][] = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]
      const uin = dirs[prev]
      const uout = dirs[c]
      let a = 0
      let b = 0
      if (vertSel[c]) {
        if (fillet) a = b = Math.max(0, s.long - dmax)
        else {
          // Incoming side along X for corners 1 and 3: c1 lies on the long face.
          const xCut = Math.max(0, s.long - dmax)
          const yCut = Math.max(0, s.short - dmax)
          const inIsX = c % 2 === 1
          a = inIsX ? xCut : yCut
          b = inIsX ? yCut : xCut
        }
      }
      for (let j = 0; j <= K; j++) {
        const u = j / K
        if (fillet && a > 0) {
          const th = (u * Math.PI) / 2
          const cx = px - uin[0] * a + uout[0] * a
          const cy = py - uin[1] * a + uout[1] * a
          pts.push(new THREE.Vector2(cx + a * (-uout[0] * Math.cos(th) + uin[0] * Math.sin(th)), cy + a * (-uout[1] * Math.cos(th) + uin[1] * Math.sin(th))))
        } else {
          const ax = px - uin[0] * a
          const ay = py - uin[1] * a
          const bx = px + uout[0] * b
          const by = py + uout[1] * b
          pts.push(new THREE.Vector2(ax + (bx - ax) * u, ay + (by - ay) * u))
        }
      }
    }
    return pts
  }

  const grid = rows.map((r) => ring(r.d).map((p) => new THREE.Vector3(p.x, p.y, r.z)))
  const cols = grid[0].length
  const featIdx: number[] = []
  const restIdx: number[] = []
  for (let i = 0; i < rows.length - 1; i++) {
    const inZone = i >= lowerTop
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols
      const g = Math.floor(j / (K + 1))
      const isSide = j % (K + 1) === K
      let isFeature: boolean
      if (isSide) isFeature = inZone && topSel[g]
      else isFeature = vertSel[g] || (inZone && (topSel[g] || topSel[(g + 3) % 4]))
      const target = isFeature ? featIdx : restIdx
      const a = i * cols + j
      const b = i * cols + j2
      const c = (i + 1) * cols + j2
      const d = (i + 1) * cols + j
      target.push(a, b, c, a, c, d)
    }
  }
  const flat = grid.flat()
  const mk = (idx: number[]) => {
    const map = new Map<number, number>()
    const pos: number[] = []
    const out: number[] = []
    for (const k of idx) {
      let m = map.get(k)
      if (m === undefined) {
        m = pos.length / 3
        map.set(k, m)
        pos.push(flat[k].x, flat[k].y, flat[k].z)
      }
      out.push(m)
    }
    let g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(out)
    // Chamfers are planar: flat normals. Fillets: smooth across the rows.
    if (!fillet) g = g.toNonIndexed()
    g.computeVertexNormals()
    return g
  }

  const cap = (pts: THREE.Vector3[], z: number, flip: boolean) => {
    const clean: THREE.Vector2[] = []
    for (const p of pts) {
      const q = new THREE.Vector2(p.x, p.y)
      if (!clean.length || clean[clean.length - 1].distanceTo(q) > 1e-6) clean.push(q)
    }
    if (clean.length > 1 && clean[0].distanceTo(clean[clean.length - 1]) < 1e-6) clean.pop()
    const shape = new THREE.Shape(clean)
    if (hole) shape.holes.push(new THREE.Path().absarc(hole.x, hole.y, hole.r, 0, Math.PI * 2, true))
    const g = new THREE.ShapeGeometry(shape, 48)
    g.translate(0, 0, z)
    return flip ? flipFaces(g) : g
  }

  // Edge lines.
  const sharp: THREE.Vector3[][] = []
  const soft: THREE.Vector3[][] = []
  const col = (j: number, i0: number, i1: number) => grid.slice(i0, i1 + 1).map((r) => r[j])
  const last = rows.length - 1
  sharp.push([...grid[0], grid[0][0]])
  // Top outline, split by whether the wall meets the top face tangentially.
  for (let j = 0; j < cols; j++) {
    const g = Math.floor(j / (K + 1))
    const isSide = j % (K + 1) === K
    const tangent = fillet && (isSide ? topSel[g] : topSel[g] || topSel[(g + 3) % 4])
    const seg = [grid[last][j], grid[last][(j + 1) % cols]]
    if (seg[0].distanceTo(seg[1]) < 1e-6) continue
    ;(tangent ? soft : sharp).push(seg)
  }
  for (let c = 0; c < 4; c++) {
    const j0 = c * (K + 1)
    const j1 = j0 + K
    if (vertSel[c]) {
      ;(fillet ? soft : sharp).push(col(j0, 0, last), col(j1, 0, last))
    } else sharp.push(col(j0, 0, last))
    if (topSel[c] && zone > 0) {
      // Where the side wall turns into the fillet / chamfer.
      ;(fillet ? soft : sharp).push([grid[lowerTop][j1], grid[lowerTop][(j1 + 1) % cols]])
    }
  }

  // Selection marks: the middle of each new face.
  const marks: BlockMesh["marks"] = {}
  const midRow = zone > 0 ? lowerTop + Math.round(M / 2) : lowerTop
  for (let c = 0; c < 4; c++) {
    const j1 = c * (K + 1) + K
    if (topSel[c]) marks[TOP_OF_SIDE[c]] = [grid[midRow][j1], grid[midRow][(j1 + 1) % cols]]
    if (vertSel[c]) marks[VERT_OF_CORNER[c]] = col(c * (K + 1) + K / 2, 0, lowerTop)
  }

  return {
    feature: mk(featIdx),
    rest: mk(restIdx),
    top: cap(grid[last], H, false),
    bottom: cap(grid[0], 0, true),
    sharp,
    soft,
    marks,
    frontTangentY: -D / 2 + (topSel[0] ? s.top : 0),
  }
}

/**
 * The front-top-edge profile in the plane x = `x` with outward normals, for
 * the tangency comb: side wall → fillet / chamfer → top face.
 */
export function frontProfile(t: Treatment, x = 0, n = 22) {
  const fillet = t.mode === "fillet"
  const s = setbacks(t)
  const on = t.sel.includes("tf")
  const out: { p: THREE.Vector3; n: THREE.Vector3 }[] = []
  const y0 = -D / 2
  const lead = 8
  const sideH = on ? s.side : 0
  const topW = on ? s.top : 0
  for (let k = 0; k <= 4; k++) out.push({ p: new THREE.Vector3(x, y0, H - sideH - lead + (lead * k) / 4), n: new THREE.Vector3(0, -1, 0) })
  if (on && fillet) {
    for (let k = 1; k < n; k++) {
      const th = ((k / n) * Math.PI) / 2
      const nrm = new THREE.Vector3(0, -Math.cos(th), Math.sin(th))
      out.push({ p: new THREE.Vector3(x, y0 + s.top - s.top * Math.cos(th), H - s.side + s.side * Math.sin(th)), n: nrm })
    }
  } else if (on) {
    // Chamfer face: a single normal; points at both ends make the jump visible.
    const nrm = new THREE.Vector3(0, -s.side, s.top).normalize()
    for (let k = 0; k <= 4; k++) {
      const u = k / 4
      out.push({ p: new THREE.Vector3(x, y0 + s.top * u, H - s.side + s.side * u), n: nrm })
    }
  }
  for (let k = 0; k <= 4; k++) out.push({ p: new THREE.Vector3(x, y0 + topW + (lead * k) / 4, H), n: new THREE.Vector3(0, 0, 1) })
  return out
}
