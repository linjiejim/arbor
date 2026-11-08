// Shapes of the standard parts (fasteners.ts): simplified but true to the outline and the main sizes,
// threads shown as plain cylinders at the nominal diameter (cosmetic), the hex socket cut into the head.
import { draw, drawPolysides, makeCylinder, type Shape3D } from "replicad"
import { fastenerGeometry, type FastenerSpec } from "../fasteners"

const cyl = (r: number, z0: number, z1: number) => makeCylinder(r, z1 - z0, [0, 0, z0], [0, 0, 1]) as unknown as Shape3D

/** A hexagonal prism `s` across flats from z0 to z1, flats facing ±Y. */
function hex(s: number, z0: number, z1: number): Shape3D {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (drawPolysides(s / Math.sqrt(3), 6).sketchOnPlane("XY", [0, 0, z0]) as any).extrude(z1 - z0) as Shape3D
}

/** Revolve a half profile drawn in XZ (x = radius ≥ 0, y = Z) about the Z axis. */
function revolved(points: [number, number][], arc?: { from: number; via: [number, number] }): Shape3D {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pen: any = draw(points[0])
  for (let i = 1; i < points.length; i++) pen = arc && arc.from === i - 1 ? pen.threePointsArcTo(points[i], arc.via) : pen.lineTo(points[i])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (pen.close().sketchOnPlane("XZ") as any).revolve() as Shape3D
}

function fuse(a: Shape3D, b: Shape3D) {
  const out = a.fuse(b)
  a.delete()
  b.delete()
  return out
}

function cut(a: Shape3D, b: Shape3D) {
  const out = a.cut(b)
  a.delete()
  b.delete()
  return out
}

export function fastenerShape(spec: FastenerSpec): Shape3D {
  const g = fastenerGeometry(spec)
  if (g.kind === "nut") return cut(hex(g.s, 0, g.m), cyl(g.d / 2, -1, g.m + 1))
  if (g.kind === "washer") return cut(cyl(g.d2 / 2, 0, g.h), cyl(g.d1 / 2, -1, g.h + 1))
  if (g.kind === "insert") return cut(cyl(g.od / 2, -g.L, 0), cyl((g.d * 0.85) / 2, -g.L - 1, 1))
  const r = g.d / 2
  const R = g.dk / 2
  let head: Shape3D
  let top: number
  let shankTop = 0
  if (g.head === "flat") {
    // 90° countersunk: top at z = 0, cone down to the shank; length measured from the top.
    const depth = R - r
    head = revolved([[0, 0], [R, 0], [r, -depth], [0, -depth]])
    top = 0
    shankTop = -depth
  } else if (g.head === "button") {
    // A spherical cap dk across, k high.
    const sr = (R * R + g.k * g.k) / (2 * g.k)
    const cz = g.k - sr
    const a0 = Math.atan2(-cz, R)
    const am = (a0 + Math.PI / 2) / 2
    head = revolved([[0, 0], [R, 0], [0, g.k]], { from: 1, via: [sr * Math.cos(am), cz + sr * Math.sin(am)] })
    top = g.k
  } else if (g.head === "pan") {
    head = revolved([[0, 0], [R, 0], [R, 0.6 * g.k], [0.8 * R, g.k], [0, g.k]])
    top = g.k
  } else {
    head = cyl(R, 0, g.k)
    top = g.k
  }
  if (g.s && g.t) head = cut(head, hex(g.s, top - g.t, top + 1))
  if (!(g.L > -shankTop)) throw new Error(`螺钉长度 ${g.L} 比沉头的高度还短`)
  return fuse(head, cyl(r, -g.L, shankTop))
}
