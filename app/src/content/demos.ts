import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { datumPlane, edgeLine, face, line, linearDim } from "@/three/build"
import { capLoop, draftedPrism, ellipsePoints, extrude, flipFaces, lathe, loft, ringPoints, roundedRect, roundedRectPoints, sweepEllipse, type V2 } from "@/three/geom"
import type { MaterialKit } from "@/three/materials"
import type { OpId } from "./ops"

/**
 * One small, parameterised scene per operation for the atlas. `t` (0–1) is
 * the creation progress, so every card can replay "how this shape comes to
 * be"; options are the operation's real knobs.
 */
export type DemoOption = { id: string; label: string; min: number; max: number; step: number; value: number; unit: string }

export type Demo = {
  op: OpId
  options: DemoOption[]
  modes?: { id: string; label: string }[]
  build: (kit: MaterialKit, t: number, o: Record<string, number>, mode: string) => THREE.Group
  box: THREE.Box3
  dir?: THREE.Vector3
}

const box3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))

function solid(kit: MaterialKit, geo: THREE.BufferGeometry, role: "model" | "highlight" | "ghost" = "model", edges: number | false = 30) {
  const m = face(geo, kit, { feature: "demo", edges })
  if (role !== "model") m.material = kit[role]
  return m
}

function block(w: number, l: number, z0: number, z1: number, holes: { r: number }[] = [], r = 3) {
  const s = roundedRect(new THREE.Shape(), w, l, r)
  for (const h of holes) s.holes.push(new THREE.Path().absarc(0, 0, h.r, 0, Math.PI * 2, true))
  return extrude(s, z1 - z0, { z0, curveSegments: 24 })
}

const DEMOS: Demo[] = [
  {
    op: "plane",
    options: [{ id: "d", label: "偏移距离", min: 5, max: 40, step: 1, value: 22, unit: "mm" }],
    box: box3(-30, -22, 0, 30, 22, 56),
    build(kit, t, o) {
      const g = new THREE.Group()
      g.add(solid(kit, block(50, 34, 0, 16)))
      const z = 16 + o.d * t
      const p = datumPlane(kit, "XY", 58)
      p.position.z = z
      g.add(p)
      g.add(line([new THREE.Vector3(27, 0, 16), new THREE.Vector3(27, 0, z)], kit.dimension))
      return g
    },
  },
  {
    op: "sketch",
    options: [{ id: "w", label: "宽度", min: 30, max: 60, step: 1, value: 44, unit: "mm" }],
    box: box3(-32, -22, 0, 32, 22, 4),
    dir: new THREE.Vector3(0.2, -0.5, 1),
    build(kit, t, o) {
      const g = new THREE.Group()
      const loop = roundedRectPoints(o.w, 28, 0, 0.05, 1)
      const n = Math.max(2, Math.round(loop.length * t))
      g.add(line(loop.slice(0, n), t < 1 ? kit.sketch : kit.sketchDefined))
      if (t >= 1) {
        g.add(line(ringPoints(5, 0.05), kit.sketchDefined))
        g.add(linearDim(kit, new THREE.Vector3(-o.w / 2, 14, 0), new THREE.Vector3(o.w / 2, 14, 0), new THREE.Vector3(0, 1, 0), 7, `${o.w}`))
      }
      return g
    },
  },
  {
    op: "cut",
    options: [{ id: "d", label: "深度", min: 3, max: 18, step: 1, value: 10, unit: "mm" }],
    modes: [
      { id: "blind", label: "给定深度" },
      { id: "through", label: "完全贯穿" },
    ],
    box: box3(-26, -18, 0, 26, 18, 20),
    dir: new THREE.Vector3(0.8, -1, 1.3),
    build(kit, t, o, mode) {
      const g = new THREE.Group()
      const H = 18
      const depth = (mode === "through" ? H : Math.min(o.d, H)) * Math.max(0.02, t)
      const floor = H - depth
      // The outer walls are one full-height mesh (the block with the pocket through it), and a
      // plug fills the pocket up to its floor. Stacking two blocks instead drew a seam around the
      // outside at the floor height. Edges are drawn by hand so only the real ones show.
      const s2 = roundedRect(new THREE.Shape(), 50, 34, 3)
      s2.holes.push(roundedRect(new THREE.Path(), 26, 14, 3))
      g.add(solid(kit, extrude(s2, H), "model", false))
      if (floor > 0.01) g.add(solid(kit, extrude(roundedRect(new THREE.Shape(), 26, 14, 3), floor), "model", false))
      g.add(edgeLine(roundedRectPoints(50, 34, 3, 0, 16), kit), edgeLine(roundedRectPoints(50, 34, 3, H, 16), kit))
      g.add(edgeLine(roundedRectPoints(26, 14, 3, H, 16), kit))
      if (floor > 0.01) g.add(edgeLine(roundedRectPoints(26, 14, 3, floor, 16), kit))
      g.add(line(roundedRectPoints(26, 14, 3, H + 0.05), kit.sketch))
      return g
    },
  },
  {
    op: "rib",
    options: [{ id: "w", label: "筋厚", min: 0.8, max: 3, step: 0.1, value: 1.2, unit: "mm" }],
    box: box3(-26, -18, 0, 26, 18, 24),
    dir: new THREE.Vector3(0.6, -1, 1.4),
    build(kit, t, o) {
      const g = new THREE.Group()
      const H = 22
      const T = 2
      const ring = roundedRect(new THREE.Shape(), 50, 34, 4)
      ring.holes.push(roundedRect(new THREE.Path(), 50 - 2 * T, 34 - 2 * T, 2))
      g.add(solid(kit, extrude(ring, H)))
      g.add(solid(kit, block(50, 34, 0, T)))
      const h = (H - T) * 0.8 * Math.max(0.02, t)
      const rib = new THREE.BoxGeometry(o.w, 34 - 2 * T, h)
      rib.translate(0, 0, T + h / 2)
      g.add(solid(kit, rib, t < 1 ? "highlight" : "model"))
      return g
    },
  },
  {
    op: "thicken",
    options: [{ id: "th", label: "厚度", min: 1, max: 8, step: 0.5, value: 4, unit: "mm" }],
    box: box3(-10, -30, 0, 34, 10, 40),
    dir: new THREE.Vector3(1, -1.2, 0.7),
    build(kit, t, o) {
      const g = new THREE.Group()
      const R = 30
      const phi = Math.PI / 2
      const surf = lathe([[R, 0], [R, 40]], phi)
      const m = solid(kit, surf, "ghost", false)
      g.add(m)
      g.add(line(ringPoints(R, 0.02, phi), kit.sketch), line(ringPoints(R, 40, phi), kit.sketch))
      const th = o.th * Math.max(0.02, t)
      const prof: V2[] = [[R, 0], [R + th, 0], [R + th, 40], [R, 40]]
      for (let i = 0; i < 4; i++) g.add(solid(kit, lathe([prof[i], prof[(i + 1) % 4]], phi), t < 1 ? "highlight" : "model", false))
      const shape = new THREE.Shape(prof.map(([r, z]) => new THREE.Vector2(r, z)))
      const a = new THREE.ShapeGeometry(shape)
      a.rotateX(Math.PI / 2)
      const b = flipFaces(a.clone())
      b.rotateZ(phi)
      g.add(solid(kit, a, "model"), solid(kit, b, "model"))
      return g
    },
  },
  {
    op: "thread",
    options: [{ id: "p", label: "螺距", min: 2, max: 8, step: 0.5, value: 4, unit: "mm" }],
    box: box3(-14, -14, 0, 14, 14, 40),
    dir: new THREE.Vector3(1, -1, 0.5),
    build(kit, t, o) {
      const g = new THREE.Group()
      g.add(solid(kit, cylinder(9, 40, 0, 0, 0)))
      const turns = 32 / o.p
      const helix = new Helix(9.6, turns, 4, 32)
      g.add(solid(kit, sweepEllipse(helix, { a: 1.1, b: 1.1, binormal: new THREE.Vector3(0, 0, 1), tEnd: Math.max(0.01, t), tubular: 240, radial: 12 }), t < 1 ? "highlight" : "model", false))
      return g
    },
  },
  {
    op: "extrude",
    options: [{ id: "depth", label: "深度", min: 6, max: 40, step: 1, value: 24, unit: "mm" }],
    box: box3(-28, -20, 0, 28, 20, 34),
    build(kit, t, o) {
      const g = new THREE.Group()
      const s = roundedRect(new THREE.Shape(), 50, 34, 8)
      s.holes.push(new THREE.Path().absarc(0, 0, 7, 0, Math.PI * 2, true))
      g.add(solid(kit, extrude(s, Math.max(0.2, o.depth * t), { curveSegments: 24 }), t < 1 ? "highlight" : "model"))
      g.add(line(roundedRectPoints(50, 34, 8, 0.05), kit.sketch))
      g.add(line(ringPoints(7, 0.05), kit.sketch))
      return g
    },
  },
  {
    op: "revolve",
    options: [{ id: "angle", label: "角度", min: 30, max: 360, step: 15, value: 360, unit: "°" }],
    box: box3(-22, -22, 0, 22, 22, 40),
    build(kit, t, o) {
      const g = new THREE.Group()
      const prof: V2[] = [
        [0, 0],
        [17, 0],
        [19, 4],
        [12, 20],
        [14, 34],
        [17, 40],
        [0, 40],
      ]
      const phi = THREE.MathUtils.degToRad(o.angle) * Math.max(0.01, t)
      for (let i = 0; i < prof.length - 1; i++) g.add(solid(kit, lathe([prof[i], prof[i + 1]], phi), t < 1 ? "highlight" : "model", false))
      if (phi < Math.PI * 2 - 1e-3) {
        const shape = new THREE.Shape(prof.map(([r, z]) => new THREE.Vector2(r, z)))
        const a = new THREE.ShapeGeometry(shape)
        a.rotateX(Math.PI / 2)
        const b = flipFaces(a.clone())
        b.rotateZ(phi)
        g.add(solid(kit, a, "model"), solid(kit, b, "model"))
      }
      g.add(line(prof.map(([r, z]) => new THREE.Vector3(r, -0.05, z)), kit.sketch))
      g.add(line([new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, 46)], kit.construction))
      return g
    },
  },
  {
    op: "sweep",
    options: [{ id: "r", label: "截面半径", min: 2, max: 8, step: 0.5, value: 4.5, unit: "mm" }],
    box: box3(-34, -18, 0, 34, 18, 34),
    build(kit, t, o) {
      const g = new THREE.Group()
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-30, -8, 4),
        new THREE.Vector3(-14, 12, 14),
        new THREE.Vector3(6, -10, 24),
        new THREE.Vector3(22, 6, 28),
        new THREE.Vector3(30, -4, 12),
      ])
      g.add(solid(kit, sweepEllipse(curve, { a: o.r, b: o.r, binormal: new THREE.Vector3(0, 0, 1), tEnd: Math.max(0.01, t) }), t < 1 ? "highlight" : "model", false))
      g.add(line(curve.getSpacedPoints(80), kit.path))
      const p0 = curve.getPointAt(0)
      const t0 = curve.getTangentAt(0)
      const n = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), t0).normalize()
      const b = new THREE.Vector3().crossVectors(t0, n).normalize()
      g.add(line(ellipsePoints(p0, n, b, o.r, o.r), kit.sketch))
      return g
    },
  },
  {
    op: "loft",
    options: [
      { id: "r", label: "顶部半径", min: 6, max: 20, step: 1, value: 13, unit: "mm" },
      { id: "h", label: "高度", min: 20, max: 60, step: 1, value: 40, unit: "mm" },
    ],
    box: box3(-22, -22, 0, 22, 22, 46),
    build(kit, t, o) {
      const g = new THREE.Group()
      const n = 64
      const sq: THREE.Vector3[] = []
      const ci: THREE.Vector3[] = []
      const half = 18
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 4
        const c = Math.cos(a)
        const s = Math.sin(a)
        const k = half / Math.max(Math.abs(c), Math.abs(s))
        sq.push(new THREE.Vector3(c * k, s * k, 0))
        ci.push(new THREE.Vector3(c * o.r, s * o.r, o.h))
      }
      const k = Math.max(0.02, t)
      g.add(solid(kit, loft(sq, ci, 32, k), t < 1 ? "highlight" : "model", 40))
      g.add(solid(kit, capLoop(sq, true), "model", false))
      if (t >= 1) g.add(solid(kit, capLoop(ci), "model", false))
      g.add(line([...sq, sq[0]].map((p) => p.clone().setZ(0.05)), kit.sketch))
      g.add(line([...ci, ci[0]], kit.sketch))
      return g
    },
  },
  {
    op: "fillet",
    options: [{ id: "r", label: "半径", min: 1, max: 11, step: 0.5, value: 7, unit: "mm" }],
    box: box3(-26, -18, 0, 26, 18, 24),
    build(kit, t, o) {
      const g = new THREE.Group()
      const r = Math.max(0.01, o.r * t)
      const geo = new RoundedBoxGeometry(50, 34, 24, 6, r)
      geo.translate(0, 0, 12)
      g.add(solid(kit, geo, "model", 40))
      return g
    },
  },
  {
    op: "chamfer",
    options: [{ id: "c", label: "距离", min: 1, max: 8, step: 0.5, value: 4, unit: "mm" }],
    box: box3(-26, -18, 0, 26, 18, 24),
    build(kit, t, o) {
      const g = new THREE.Group()
      const c = Math.max(0.05, o.c * t)
      const w = 50 - 2 * c
      const l = 34 - 2 * c
      const s = new THREE.Shape()
      s.moveTo(-w / 2 + c, -l / 2)
      s.lineTo(w / 2 - c, -l / 2)
      s.lineTo(w / 2, -l / 2 + c)
      s.lineTo(w / 2, l / 2 - c)
      s.lineTo(w / 2 - c, l / 2)
      s.lineTo(-w / 2 + c, l / 2)
      s.lineTo(-w / 2, l / 2 - c)
      s.lineTo(-w / 2, -l / 2 + c)
      s.closePath()
      const geo = new THREE.ExtrudeGeometry(s, { depth: 24 - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1 })
      geo.translate(0, 0, c)
      g.add(solid(kit, geo, "model", 20))
      return g
    },
  },
  {
    op: "shell",
    options: [{ id: "th", label: "壁厚", min: 1, max: 6, step: 0.5, value: 2.5, unit: "mm" }],
    box: box3(-26, -18, 0, 26, 18, 28),
    dir: new THREE.Vector3(0.9, -1, 1.5),
    build(kit, t, o) {
      const g = new THREE.Group()
      const H = 28
      const depth = (H - o.th) * Math.max(0.001, t)
      const s = roundedRect(new THREE.Shape(), 50, 34, 5)
      s.holes.push(roundedRect(new THREE.Path(), 50 - 2 * o.th, 34 - 2 * o.th, Math.max(0.6, 5 - o.th)))
      g.add(solid(kit, extrude(roundedRect(new THREE.Shape(), 50, 34, 5), H - depth), "model"))
      g.add(solid(kit, extrude(s, depth, { z0: H - depth }), "model"))
      // The new inner faces: floor of the cavity.
      const floor = extrude(roundedRect(new THREE.Shape(), 50 - 2 * o.th, 34 - 2 * o.th, Math.max(0.6, 5 - o.th)), 0.01, { z0: H - depth })
      g.add(solid(kit, floor, "highlight", false))
      return g
    },
  },
  {
    op: "draft",
    options: [{ id: "a", label: "拔模角", min: 1, max: 15, step: 0.5, value: 8, unit: "°" }],
    box: box3(-24, -17, 0, 24, 17, 30),
    dir: new THREE.Vector3(1, -1.4, 0.45),
    build(kit, t, o) {
      const g = new THREE.Group()
      g.add(solid(kit, draftedPrism(44, 30, 28, o.a * t), "model", 20))
      g.add(line([new THREE.Vector3(0, 0, 30), new THREE.Vector3(0, 0, 44)], kit.sketch))
      return g
    },
  },
  {
    op: "hole",
    options: [{ id: "r", label: "孔半径", min: 2, max: 6, step: 0.5, value: 3.5, unit: "mm" }],
    modes: [
      { id: "simple", label: "简单孔" },
      { id: "cbore", label: "锪平孔" },
      { id: "csink", label: "沉头孔" },
    ],
    box: box3(-26, -18, 0, 26, 18, 20),
    dir: new THREE.Vector3(0.8, -1, 1.3),
    build(kit, t, o, mode) {
      const g = new THREE.Group()
      const H = 20
      const d = H * Math.max(0.02, t)
      const head = mode === "simple" ? 0 : Math.min(6, d)
      const headR = mode === "cbore" ? o.r * 1.9 : o.r
      // Stack: solid below the hole bottom, then the hole, then the head.
      if (H - d > 0.01) g.add(solid(kit, block(50, 34, 0, H - d)))
      g.add(solid(kit, block(50, 34, H - d, H - head, [{ r: o.r }])))
      if (head > 0) {
        if (mode === "cbore") g.add(solid(kit, block(50, 34, H - head, H, [{ r: headR }])))
        else {
          const top = o.r + head
          g.add(solid(kit, block(50, 34, H - head, H, [{ r: top }])))
          g.add(solid(kit, lathe([[top, H], [o.r, H - head]]), "model", false))
        }
      }
      return g
    },
  },
  {
    op: "pattern",
    options: [{ id: "n", label: "数量", min: 2, max: 12, step: 1, value: 8, unit: "个" }],
    modes: [
      { id: "polar", label: "圆周" },
      { id: "linear", label: "线性" },
    ],
    box: box3(-36, -32, 0, 36, 32, 14),
    dir: new THREE.Vector3(0.7, -1, 1.1),
    build(kit, t, o, mode) {
      const g = new THREE.Group()
      const shown = Math.max(1, Math.round(1 + (o.n - 1) * t))
      if (mode === "linear") {
        g.add(solid(kit, block(72, 22, 0, 4)))
        for (let i = 0; i < shown; i++) {
          const x = -30 + (60 * i) / Math.max(1, o.n - 1)
          g.add(solid(kit, cylinder(4, 10, x, 0, 4), i === 0 ? "model" : "highlight", 30))
        }
      } else {
        const disc = extrude(new THREE.Shape().absarc(0, 0, 32, 0, Math.PI * 2, false), 4, { curveSegments: 48 })
        g.add(solid(kit, disc))
        for (let i = 0; i < shown; i++) {
          const a = (i / o.n) * Math.PI * 2
          g.add(solid(kit, cylinder(4, 10, Math.cos(a) * 22, Math.sin(a) * 22, 4), i === 0 ? "model" : "highlight", 30))
        }
      }
      return g
    },
  },
  {
    op: "mirror",
    options: [{ id: "w", label: "宽度", min: 14, max: 34, step: 1, value: 26, unit: "mm" }],
    box: box3(-36, -14, 0, 36, 14, 30),
    dir: new THREE.Vector3(0.6, -1.2, 0.8),
    build(kit, t, o) {
      const g = new THREE.Group()
      const half = () => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(o.w, 0)
        s.lineTo(o.w, 6)
        s.lineTo(8, 6)
        s.lineTo(8, 28)
        s.lineTo(0, 28)
        s.closePath()
        const geo = extrude(s, 24)
        geo.rotateX(Math.PI / 2)
        geo.translate(0, 12, 0)
        return geo
      }
      g.add(solid(kit, half(), "model", 20))
      const m = solid(kit, half(), t < 1 ? "highlight" : "model", 20)
      m.scale.x = -Math.max(0.02, t)
      g.add(m)
      const p = datumPlane(kit, "YZ", 40)
      p.position.set(0, 0, 16)
      g.add(p)
      return g
    },
  },
  {
    op: "boolean",
    options: [{ id: "r", label: "工具半径", min: 4, max: 14, step: 0.5, value: 9, unit: "mm" }],
    modes: [
      { id: "subtract", label: "减去" },
      { id: "union", label: "合并" },
      { id: "intersect", label: "相交" },
    ],
    box: box3(-26, -18, -6, 26, 18, 30),
    build(kit, t, o, mode) {
      const g = new THREE.Group()
      const done = t >= 0.999
      if (!done) {
        g.add(solid(kit, block(50, 34, 0, 18), "model"))
        g.add(solid(kit, cylinder(o.r, 30, 0, 0, -6 + 36 * (1 - t)), "ghost", false))
        return g
      }
      if (mode === "subtract") g.add(solid(kit, block(50, 34, 0, 18, [{ r: o.r }])))
      if (mode === "union") g.add(solid(kit, block(50, 34, 0, 18)), solid(kit, cylinder(o.r, 30, 0, 0, -6), "highlight"))
      if (mode === "intersect") g.add(solid(kit, cylinder(o.r, 18, 0, 0, 0), "highlight"))
      return g
    },
  },
]

/** A helix about Z: radius r, `turns` turns from z0 over `height`. */
class Helix extends THREE.Curve<THREE.Vector3> {
  r: number
  turns: number
  z0: number
  height: number
  constructor(r: number, turns: number, z0: number, height: number) {
    super()
    this.r = r
    this.turns = turns
    this.z0 = z0
    this.height = height
  }
  getPoint(u: number, out = new THREE.Vector3()) {
    const a = u * this.turns * Math.PI * 2
    return out.set(Math.cos(a) * this.r, Math.sin(a) * this.r, this.z0 + u * this.height)
  }
}

function cylinder(r: number, h: number, x: number, y: number, z0: number) {
  return extrude(new THREE.Shape().absarc(x, y, r, 0, Math.PI * 2, false), h, { z0, curveSegments: 32 })
}

export const demoFor = (op: OpId) => DEMOS.find((d) => d.op === op)
export const demoDefaults = (d: Demo) => Object.fromEntries(d.options.map((o) => [o.id, o.value]))
