// Real thread geometry: ISO metric basic profile (60°), external on a shaft or internal in a bore.
//
// Sweeping a profile along a helix and cutting it from the body is what CAD tutorials do, and it is
// what OpenCascade's booleans get wrong most often: the helical faces graze the cylinder they cut,
// and the result loses the whole shaft or keeps it whole. So the thread is built without that boolean:
//
// 1. The cross-section of a threaded rod at one height is a fixed outline (root arc, two flanks, crest
//    arc); the rod is that outline twist-extruded along the axis, a full turn per pitch. Its sides are a
//    handful of faces whatever the number of turns.
// 2. A ring: that rod with a core taken out (external), or a tube with the rod taken out (internal).
//    These booleans only meet the helical faces at the end planes.
// 3. The body gives up the same ring-shaped space (plain coaxial cylinders) and takes the ring in, glued
//    on faces that coincide exactly.
import { cast, draw, getOC, makeCompound, makeCylinder, twistExtrude, type Shape3D } from "replicad"
import { InputError } from "./errors"

type V3 = [number, number, number]

/** Thread depth of the ISO basic profile, as a share of the pitch: 5/8 of the 60° triangle's height. */
export const DEPTH = (5 / 8) * (Math.sqrt(3) / 2)

/** One thread to make: on the cylinder with axis `p` + t·`d`, from `t0` to `t1` along it. */
export type ThreadJob = {
  p: V3
  d: V3
  t0: number
  t1: number
  /** Nominal (major) diameter, and the pitch. */
  major: number
  pitch: number
  internal: boolean
  /** Radial allowance for printing: an external thread made this much thinner, an internal one this much wider. */
  clearance: number
  left: boolean
}

/** The outline of a threaded rod at height 0: outer radius `R`, groove centred on +X. */
function outline(R: number, P: number, seg = 12) {
  const depth = DEPTH * P
  const deg = (s: number) => (s / P) * 360
  const pt = (r: number, a: number): [number, number] => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)]
  // Root flat P/4 wide (centred on the groove), flanks to the crest at 7P/16 from the groove's centre, crest flat P/8.
  const a1 = deg(P / 8)
  const a2 = deg((7 / 16) * P)
  const rRoot = R - depth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pen: any = draw(pt(rRoot, -a1)).threePointsArcTo(pt(rRoot, a1), pt(rRoot, 0))
  // A flank is a spiral in this section (radius grows with the angle): close enough as short chords.
  for (let k = 1; k <= seg; k++) pen = pen.lineTo(pt(rRoot + (k / seg) * depth, a1 + (k / seg) * (a2 - a1)))
  pen = pen.threePointsArcTo(pt(R, 360 - a2), pt(R, 180))
  for (let k = 1; k <= seg; k++) pen = pen.lineTo(pt(R - (k / seg) * depth, 360 - a2 + (k / seg) * (a2 - a1)))
  return pen.close()
}

/** A threaded rod of outer radius `R` along +Z from 0 to `L`: right hand unless `left`. */
function rod(R: number, P: number, L: number, left: boolean): Shape3D {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sk: any = outline(R, P).sketchOnPlane("XY", [0, 0, 0])
  const r = twistExtrude(sk.wire, (360 * L) / P, [0, 0, 0], [0, 0, L]) as Shape3D
  if (!left) return r
  // A mirror through a plane holding the axis turns the helix the other way.
  const m = r.mirror("YZ", [0, 0, 0]) as Shape3D
  r.delete()
  return m
}

const cyl = (r: number, z0: number, z1: number) => makeCylinder(r, z1 - z0, [0, 0, z0], [0, 0, 1]) as unknown as Shape3D

/** OpenCascade's boolean, with the glue option for shapes that only share faces (much faster on these). */
function bop(kind: "cut" | "fuse", a: Shape3D, b: Shape3D, glue = false): Shape3D {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc: any = getOC()
  const args = new oc.NCollection_List_TopoDS_Shape()
  const tools = new oc.NCollection_List_TopoDS_Shape()
  const op = kind === "cut" ? new oc.BRepAlgoAPI_Cut() : new oc.BRepAlgoAPI_Fuse()
  const progress = new oc.Message_ProgressRange()
  try {
    args.Append(a.wrapped)
    tools.Append(b.wrapped)
    op.SetArguments(args)
    op.SetTools(tools)
    if (glue) op.SetGlue(oc.BOPAlgo_GlueEnum.BOPAlgo_GlueShift)
    op.Build(progress)
    if (!op.IsDone()) throw new InputError("螺纹没能并进实体（内核的布尔运算失败）")
    return cast(op.Shape()) as Shape3D
  } finally {
    for (const x of [op, progress, args, tools]) x.delete()
  }
}

function valid(s: Shape3D) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc: any = getOC()
  const a = new oc.BRepCheck_Analyzer(s.wrapped, true)
  try {
    return a.IsValid() as boolean
  } finally {
    a.delete()
  }
}

/** Rotate +Z onto `d`, then move the origin to `at`. */
function place(s: Shape3D, d: V3, at: V3): Shape3D {
  const c: V3 = [-d[1], d[0], 0]
  const sin = Math.hypot(...c)
  let out = s
  if (sin > 1e-9) out = out.rotate((Math.atan2(sin, d[2]) * 180) / Math.PI, [0, 0, 0], [c[0] / sin, c[1] / sin, 0])
  else if (d[2] < 0) out = out.rotate(180, [0, 0, 0], [1, 0, 0])
  return out.translate(at)
}

/**
 * The ring that carries the thread, along +Z from 0 to L, and the radius of the space the body gives up
 * for it (from `inner` to `outer`): the ring fills that space exactly where it isn't thread or groove.
 */
function ring(job: ThreadJob, L: number): { ring: Shape3D; inner: number; outer: number } {
  const R = job.major / 2
  const P = job.pitch
  const depth = DEPTH * P
  if (!job.internal) {
    const Rt = R - job.clearance
    const core = Rt - depth - 0.25 * P
    if (core <= 0.05 * R) throw new InputError(`螺距 ${P} 对 ⌀${job.major} 太粗了：螺纹会切到轴心`)
    const r = rod(Rt, P, L, job.left)
    const c = cyl(core, -1, L + 1)
    const out = bop("cut", r, c)
    r.delete()
    c.delete()
    return { ring: out, inner: core, outer: R + 0.5 * P }
  }
  const Rs = R + job.clearance
  const outer = Rs + 0.25 * P
  const t = cyl(outer, 0, L)
  const space = rod(Rs, P, L, job.left)
  const out = bop("cut", t, space)
  t.delete()
  space.delete()
  return { ring: out, inner: 0, outer }
}

/** Put real threads into `body` (each job one cylinder); the same size is built once and copied. */
export function cutThreads(body: Shape3D, jobs: ThreadJob[]): Shape3D {
  const made = new Map<string, { ring: Shape3D; inner: number; outer: number }>()
  const rings: Shape3D[] = []
  const spaces: Shape3D[] = []
  try {
    for (const job of jobs) {
      const L = job.t1 - job.t0
      const key = JSON.stringify([job.major, job.pitch, job.internal, job.clearance, job.left, Math.round(L * 1e6)])
      let r = made.get(key)
      if (!r) made.set(key, (r = ring(job, L)))
      const at: V3 = [job.p[0] + job.d[0] * job.t0, job.p[1] + job.d[1] * job.t0, job.p[2] + job.d[2] * job.t0]
      rings.push(place(r.ring.clone(), job.d, at))
      const space = r.inner > 0 ? bop("cut", cyl(r.outer, 0, L), cyl(r.inner, -1, L + 1)) : cyl(r.outer, 0, L)
      spaces.push(place(space, job.d, at))
    }
    const space = spaces.length === 1 ? spaces[0] : (makeCompound(spaces) as unknown as Shape3D)
    const tool = rings.length === 1 ? rings[0] : (makeCompound(rings) as unknown as Shape3D)
    const cleared = bop("cut", body, space)
    const out = bop("fuse", cleared, tool, true)
    cleared.delete()
    if (space !== spaces[0]) space.delete()
    if (tool !== rings[0]) tool.delete()
    if (!valid(out)) {
      out.delete()
      throw new InputError("螺纹并进实体后形状不完整（内核的布尔运算没算对）：换一个长度、螺距或间隙试试")
    }
    return out
  } finally {
    for (const r of made.values()) r.ring.delete()
    rings.forEach((x) => x.delete())
    spaces.forEach((x) => x.delete())
  }
}
