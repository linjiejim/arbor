import * as THREE from "three"
import { datumPlane, edgeLine, face, label, line, linearDim } from "@/three/build"
import { arc, ellipsePoints, filletCorner, flipFaces, intersect, lathe, offsetLine, ringPoints, sweepEllipse, type V2 } from "@/three/geom"
import type { MaterialKit } from "@/three/materials"
import type { BuildInput, BuildOutput, FeatureDef, ParamDef, Params, PartModel } from "./types"

/**
 * 马克杯 — the canonical revolve → fillet → shell → sweep part.
 * Feature order is the teaching point: the outer bottom fillet comes before
 * the shell so the shell offsets it into a concentric inner fillet.
 */
const PARAMS: ParamDef[] = [
  { id: "H", label: "杯高", unit: "mm", min: 70, max: 130, step: 1, value: 96, feature: "sk1" },
  { id: "D", label: "杯口直径", unit: "mm", min: 60, max: 110, step: 1, value: 84, feature: "sk1" },
  { id: "d", label: "杯底直径", unit: "mm", min: 50, max: 110, step: 1, value: 72, feature: "sk1" },
  { id: "rb", label: "杯底圆角", unit: "mm", min: 0, max: 20, step: 0.5, value: 9, feature: "fil1" },
  { id: "t", label: "壁厚", unit: "mm", min: 1.5, max: 8, step: 0.1, value: 3.5, feature: "shell1" },
  { id: "rl", label: "杯口圆角", unit: "mm", min: 0, max: 3, step: 0.1, value: 1.2, feature: "fil2" },
  { id: "reach", label: "把手外伸", unit: "mm", min: 16, max: 46, step: 1, value: 30, feature: "sk2" },
  { id: "span", label: "把手跨度", unit: "mm", min: 28, max: 80, step: 1, value: 54, feature: "sk2" },
  { id: "ha", label: "把手截面厚", unit: "mm", min: 3, max: 9, step: 0.5, value: 5.5, feature: "sk3" },
  { id: "hb", label: "把手截面宽", unit: "mm", min: 5, max: 14, step: 0.5, value: 9, feature: "sk3" },
]

const ISO: [number, number, number] = [1, -1.1, 0.85]

const FEATURES: FeatureDef[] = [
  {
    id: "sk1",
    op: "sketch",
    name: "草图1",
    title: "杯身半截面",
    summary: (p) => `前视基准面 · H${p.H} · Ø${p.D} / Ø${p.d}`,
    why: "旋转体只画一半截面，另一半由旋转生成。直径关于中心线标注，和图纸、卡尺的读数一致。",
    pitfall: "轮廓一旦越过中心线，旋转会自交失败。",
    view: [0, -1, 0],
  },
  {
    id: "rev1",
    op: "revolve",
    name: "旋转1",
    title: "杯身",
    summary: () => "360° · 绕中心线",
    why: "先得到一个实心的「毛坯」。后面的特征都在它上面做加减，就像车床上的一根料。",
    view: ISO,
  },
  {
    id: "fil1",
    op: "fillet",
    name: "圆角1",
    title: "杯底外圆角",
    summary: (p) => `R${p.rb}`,
    why: "在抽壳之前给外底边加圆角：抽壳会把它向内偏移出一个同心的内圆角，转角处的壁厚和别处一样。",
    pitfall: "如果先抽壳再加外圆角，内侧仍是尖角，转角处的壁会被削薄。",
    view: [1, -1.1, -0.5],
  },
  {
    id: "shell1",
    op: "shell",
    name: "抽壳1",
    title: "掏空杯身",
    summary: (p) => `壁厚 ${p.t} · 移除顶面`,
    why: "抽壳把实心件变成等壁厚的薄壁件：选中的顶面被打开，其余所有面向内偏移一个壁厚。",
    pitfall: "壁厚 ≥ 杯底圆角时，内侧圆角会退化成尖角。把壁厚拉大试试。",
    view: [0.8, -1, 1.6],
  },
  {
    id: "fil2",
    op: "fillet",
    name: "圆角2",
    title: "杯口圆角",
    summary: (p) => `R${p.rl} · 内外两条边`,
    why: "嘴唇接触的边必须圆滑。它只依赖杯口，放在抽壳之后、把手之前，以后改把手不会碰到它。",
    pitfall: "半径超过壁厚的一半就放不下：内外两个圆角会撞在一起。",
    view: [0.7, -1, 0.9],
    focus: (p) => new THREE.Box3(new THREE.Vector3(-p.D / 2, -p.D / 2, p.H - 18), new THREE.Vector3(p.D / 2, p.D / 2, p.H + 2)),
  },
  {
    id: "sk2",
    op: "sketch",
    name: "草图2",
    title: "把手路径",
    summary: (p) => `前视基准面 · 外伸 ${p.reach} · 跨度 ${p.span}`,
    why: "路径画在杯身的对称面上，把手天然左右对称。两端伸进杯壁，扫掠出来才能和杯身合成一体。",
    view: [0, -1, 0],
  },
  {
    id: "sk3",
    op: "sketch",
    name: "草图3",
    title: "把手截面",
    summary: (p) => `椭圆 ${round(p.ha * 2)} × ${round(p.hb * 2)}`,
    why: "截面画在路径起点的法平面上。椭圆比圆更好握：窄的一面贴手指，宽的一面承力。",
    view: [1.4, -0.9, 0.5],
  },
  {
    id: "sweep1",
    op: "sweep",
    name: "扫掠1",
    title: "把手",
    summary: () => "沿草图2 · 合并到杯身",
    why: "截面沿路径走一遍得到把手，并与杯身合并成一个实体。正式建模时最后还会给把手根部加圆角（原型未演示）。",
    view: ISO,
  },
]

const round = (v: number) => Math.round(v * 10) / 10
const idx = (id: string) => FEATURES.findIndex((f) => f.id === id)

type Seg = { pts: V2[]; feature: string }

/** The mug cross-section for a given state, as tagged segments (counter-clockwise). */
function profile(p: Params, s: { rb: number; shell: boolean; cavity: number; rl: number }, warnings: string[]) {
  const H = p.H
  const R0 = p.d / 2
  const R1 = p.D / 2
  const A: V2 = [0, 0]
  const B: V2 = [R0, 0]
  const C: V2 = [R1, H]
  const fb = filletCorner(A, B, C, s.rb, 16)
  if (fb.clamped) warnings.push("杯底圆角太大，侧壁放不下，已按最大可用半径生成。")
  const tB1 = fb.pts[0]
  const tB2 = fb.pts[fb.pts.length - 1]
  const segs: Seg[] = [{ pts: [A, tB1], feature: "rev1" }]
  if (fb.r > 0) segs.push({ pts: fb.pts, feature: "fil1" })

  if (!s.shell) {
    segs.push({ pts: [tB2, C], feature: "rev1" }, { pts: [C, [0, H]], feature: "rev1" })
    return segs
  }

  const t = p.t
  const [is0, is1] = offsetLine(B, C, t)
  const Ci = intersect(is0, is1, [0, H], [1, H])
  const Bi = intersect(is0, is1, [0, t], [1, t])
  const rimW = R1 - Ci[0]

  // Inner side: from the rim down to the bottom, with the concentric inner fillet when it fits.
  const rbIn = fb.r - t
  let inner: { pts: V2[]; feature: string }[]
  if (fb.r > 0 && rbIn > 0.05) {
    const c = fb.center
    const a0 = Math.atan2(tB1[1] - c[1], tB1[0] - c[0])
    const a1 = Math.atan2(tB2[1] - c[1], tB2[0] - c[0])
    const ia = arc(c, rbIn, a1, a0, 14)
    inner = [
      { pts: [Ci, ia[0]], feature: "shell1" },
      { pts: ia, feature: "shell1" },
      { pts: [ia[ia.length - 1], [0, t]], feature: "shell1" },
    ]
  } else {
    if (fb.r > 0) warnings.push("壁厚 ≥ 杯底圆角：抽壳后内侧是尖角，转角处壁厚不均。")
    inner = [
      { pts: [Ci, Bi], feature: "shell1" },
      { pts: [Bi, [0, t]], feature: "shell1" },
    ]
  }

  // Lip rounds on the two rim edges.
  let rl = s.rl
  if (rl > rimW / 2 - 0.05) {
    rl = Math.max(0, rimW / 2 - 0.05)
    if (s.rl > 0) warnings.push("杯口圆角超过壁厚的一半，已按最大可用半径生成。")
  }
  const innerDown = inner[0].pts[1]
  const lo = filletCorner(tB2, C, Ci, rl, 8)
  const li = filletCorner(C, Ci, innerDown, rl, 8)
  segs.push({ pts: [tB2, lo.pts[0]], feature: "rev1" })
  if (lo.r > 0) segs.push({ pts: lo.pts, feature: "fil2" })
  segs.push({ pts: [lo.pts[lo.pts.length - 1], li.pts[0]], feature: "shell1" })
  if (li.r > 0) segs.push({ pts: li.pts, feature: "fil2" })
  inner[0] = { pts: [li.pts[li.pts.length - 1], innerDown], feature: "shell1" }

  // While the shell animates, the cavity is dug from the top down to its floor at z = t.
  const flat = inner.flatMap((sg, i) => sg.pts.slice(i ? 1 : 0).map((pt) => ({ pt, feature: sg.feature, seg: i })))
  const zCut = Math.min(H - (H - t) * s.cavity, flat[0].pt[1])
  const kept: Seg[] = []
  let cur: Seg | null = null
  let lastSeg = -1
  for (let i = 0; i < flat.length; i++) {
    const { pt, seg, feature } = flat[i]
    if (pt[1] < zCut - 1e-6) {
      const prev = flat[i - 1].pt
      const k = (prev[1] - zCut) / (prev[1] - pt[1])
      const hit: V2 = [prev[0] + (pt[0] - prev[0]) * k, zCut]
      cur!.pts.push(hit)
      kept.push(cur!, { pts: [hit, [0, zCut]], feature: "shell1" })
      cur = null
      break
    }
    if (seg !== lastSeg) {
      if (cur) kept.push(cur)
      cur = { pts: cur ? [cur.pts[cur.pts.length - 1], pt] : [pt], feature }
      lastSeg = seg
    } else cur!.pts.push(pt)
  }
  if (cur) kept.push(cur)
  return segs.concat(kept.filter((k) => k.pts.length > 1))
}

function handleCurve(p: Params, warnings: string[]) {
  const H = p.H
  const R0 = p.d / 2
  const R1 = p.D / 2
  const rAt = (z: number) => R0 + ((R1 - R0) * z) / H
  const zc = H * 0.54
  let z1 = zc + p.span / 2
  let z2 = zc - p.span / 2
  const zMax = H - Math.max(p.rl, 0) - p.ha - 4
  const zMin = Math.max(p.rb, 2) + p.ha + 3
  if (z1 > zMax || z2 < zMin) {
    warnings.push("把手跨度超出杯壁的直段，已缩短到能放下的长度。")
    z1 = Math.min(z1, zMax)
    z2 = Math.max(z2, zMin)
  }
  const inset = p.t * 0.5
  const c = (p.reach * 4) / 3
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(rAt(z1) - inset, 0, z1),
    new THREE.Vector3(rAt(z1) + c, 0, z1 + p.reach * 0.12),
    new THREE.Vector3(rAt(z2) + c, 0, z2 - p.reach * 0.12),
    new THREE.Vector3(rAt(z2) - inset, 0, z2),
  )
  return { curve, z1, z2, rAt }
}

function revolveCaps(segs: Seg[], phi: number, kit: MaterialKit, g: THREE.Group) {
  // A partly revolved solid shows its cross-section on both cut planes.
  const loop = segs.flatMap((s, i) => s.pts.slice(i ? 1 : 0))
  const shape = new THREE.Shape(loop.map(([r, z]) => new THREE.Vector2(r, z)))
  const start = new THREE.ShapeGeometry(shape, 8)
  start.rotateX(Math.PI / 2) // into the XZ plane, facing −Y: the side the revolve leaves from
  const end = flipFaces(start.clone())
  end.rotateZ(phi)
  g.add(face(start, kit, { feature: "rev1" }), face(end, kit, { feature: "rev1" }))
}

function build({ kit, params: p, upto, progress }: BuildInput): BuildOutput {
  const warnings: string[] = []
  const g = new THREE.Group()
  const has = (id: string) => idx(id) <= upto
  const cur = FEATURES[upto]?.id
  const k = (id: string) => (cur === id ? progress : 1)
  const H = p.H
  const R1 = p.D / 2

  // ---- body
  if (has("rev1")) {
    const segs = profile(
      p,
      {
        rb: has("fil1") ? p.rb * k("fil1") : 0,
        shell: has("shell1"),
        cavity: k("shell1"),
        rl: has("fil2") ? p.rl * k("fil2") : 0,
      },
      warnings,
    )
    const phi = Math.PI * 2 * Math.max(0.002, k("rev1"))
    for (const s of segs) g.add(face(lathe(s.pts, phi), kit, { feature: s.feature, edges: false }))
    // Edges where faces meet: sharp corners dark, tangent (fillet) boundaries soft.
    for (let i = 0; i < segs.length; i++) {
      const a = segs[i]
      const b = segs[(i + 1) % segs.length]
      const pt = a.pts[a.pts.length - 1]
      if (pt[0] < 0.01) continue
      const tangent = a.feature.startsWith("fil") || b.feature.startsWith("fil") || a.pts.length > 2 || b.pts.length > 2
      g.add(edgeLine(ringPoints(pt[0], pt[1], phi), kit, tangent))
    }
    if (phi < Math.PI * 2 - 1e-3) revolveCaps(segs, phi, kit, g)
  }

  // ---- handle
  const handle = handleCurve(p, warnings)
  if (has("sweep1")) {
    const geo = sweepEllipse(handle.curve, { a: p.ha, b: p.hb, binormal: new THREE.Vector3(0, 1, 0), tEnd: k("sweep1") })
    g.add(face(geo, kit, { feature: "sweep1", edges: false }))
  }

  // ---- sketches (only while that sketch is the current step)
  if (cur === "sk1") {
    const plane = datumPlane(kit, "XZ", Math.max(H, p.D) * 1.7, "前视基准面")
    plane.position.set(R1 * 0.5, 0, H / 2)
    g.add(plane)
    const R0 = p.d / 2
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(R0, 0, 0), new THREE.Vector3(R1, 0, H), new THREE.Vector3(0, 0, H)]
    g.add(line(trimPolyline([...pts, pts[0]], progress), kit.sketch))
    g.add(line([new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, H + 12)], kit.construction))
    if (progress > 0.95) {
      const fwd = new THREE.Vector3(0, -1, 0)
      g.add(linearDim(kit, new THREE.Vector3(R1, 0, 0).add(fwd), new THREE.Vector3(R1, 0, H).add(fwd), new THREE.Vector3(1, 0, 0), 14, `${p.H}`))
      g.add(linearDim(kit, new THREE.Vector3(0, 0, H), new THREE.Vector3(R1, 0, H), new THREE.Vector3(0, 0, 1), 10, `Ø${p.D}`))
      g.add(linearDim(kit, new THREE.Vector3(0, 0, 0), new THREE.Vector3(R0, 0, 0), new THREE.Vector3(0, 0, 1), -10, `Ø${p.d}`))
    }
  }
  if (cur === "sk2" || cur === "sk3") {
    const plane = datumPlane(kit, "XZ", Math.max(H, p.D + p.reach * 2) * 1.5, cur === "sk2" ? "前视基准面" : undefined)
    plane.position.set(R1 * 0.5, 0, H / 2)
    if (cur === "sk2") g.add(plane)
    const pts = handle.curve.getSpacedPoints(64)
    g.add(line(cur === "sk2" ? trimPolyline(pts, progress) : pts, cur === "sk2" ? kit.sketch : kit.path))
    if (cur === "sk2" && progress > 0.95) {
      const xMax = Math.max(...pts.map((q) => q.x))
      const wall = handle.rAt(H * 0.54)
      const zMid = H * 0.54
      g.add(linearDim(kit, new THREE.Vector3(wall, 0, zMid), new THREE.Vector3(xMax, 0, zMid), new THREE.Vector3(0, 0, 1), handle.z1 - zMid + 10, `${p.reach}`))
      g.add(
        linearDim(
          kit,
          new THREE.Vector3(xMax, 0, handle.z1),
          new THREE.Vector3(xMax, 0, handle.z2),
          new THREE.Vector3(1, 0, 0),
          12,
          `${round(handle.z1 - handle.z2)}`,
        ),
      )
    }
    if (cur === "sk3") {
      const P0 = handle.curve.getPointAt(0)
      const T0 = handle.curve.getTangentAt(0).normalize()
      const B = new THREE.Vector3(0, 1, 0)
      const N = new THREE.Vector3().crossVectors(B, T0).normalize()
      const B2 = new THREE.Vector3().crossVectors(T0, N).normalize()
      const sp = datumPlane(kit, "XY", Math.max(p.ha, p.hb) * 4)
      sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), T0)
      sp.position.copy(P0)
      g.add(sp)
      g.add(line(trimPolyline(ellipsePoints(P0, N, B2, p.ha, p.hb), progress), kit.sketch))
      if (progress > 0.95) {
        g.add(label(`${round(p.ha * 2)} × ${round(p.hb * 2)}`, P0.clone().addScaledVector(B2, p.hb + 6)))
      }
    }
  }
  return { group: g, warnings: [...new Set(warnings)] }
}

/** Keep the first `k` (0–1) of a polyline's length: sketches draw themselves in. */
export function trimPolyline(pts: THREE.Vector3[], k: number): THREE.Vector3[] {
  if (k >= 1) return pts
  const lens = [0]
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const target = lens[lens.length - 1] * Math.max(0.001, k)
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] <= target) out.push(pts[i])
    else {
      const f = (target - lens[i - 1]) / (lens[i] - lens[i - 1])
      out.push(pts[i - 1].clone().lerp(pts[i], f))
      break
    }
  }
  return out.length > 1 ? out : [pts[0], pts[0].clone().addScalar(1e-3)]
}

export const mug: PartModel = {
  kind: "part",
  id: "mug",
  title: "马克杯",
  subtitle: "旋转 · 圆角 · 抽壳 · 扫掠",
  level: "入门",
  params: PARAMS,
  features: FEATURES,
  build,
  bounds: (p) => new THREE.Box3(new THREE.Vector3(-p.D / 2, -p.D / 2, 0), new THREE.Vector3(p.D / 2 + p.reach + 6, p.D / 2, p.H)),
}
