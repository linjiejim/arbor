// Faster stand-ins for replicad's `shape.faces`, `shape.edges` and `face.center`,
// with the same results:
// - replicad compares each new face or edge with every one before it. The 2,600
//   edges of five engraved hanzi took 2 s; bucketed by hash it is 13 ms. Order is
//   kept (first time the explorer meets each), so indices still match.
// - `face.center` integrates to 1e-7 adaptively. The default rule agrees to within
//   1e-7 mm on every face we build and is 6–10 times faster.
import { cast, getOC, HASH_CODE_MAX, type Edge, type Face, type Shape3D } from "replicad"

type V3 = [number, number, number]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any
type Native = { IsSame(other: unknown): boolean; delete(): void }

const ENUM = { face: "TopAbs_FACE", edge: "TopAbs_EDGE", solid: "TopAbs_SOLID" } as const

/** Each distinct sub-shape once, in explorer order; `keep` decides what is built for it. */
function distinct<T>(shape: { wrapped: unknown }, kind: keyof typeof ENUM, keep: (item: Native) => T): T[] {
  const oc: OC = getOC()
  const ex = new oc.TopExp_Explorer(shape.wrapped, oc.TopAbs_ShapeEnum[ENUM[kind]], oc.TopAbs_ShapeEnum.TopAbs_SHAPE)
  const out: T[] = []
  const seen = new Map<number, Native[]>()
  try {
    for (; ex.More(); ex.Next()) {
      const item: Native = ex.Current()
      const h: number = oc.ReplicadShapeHasher.HashCode(item, HASH_CODE_MAX)
      const bucket = seen.get(h)
      if (bucket?.some((s) => s.IsSame(item))) {
        item.delete()
        continue
      }
      if (bucket) bucket.push(item)
      else seen.set(h, [item])
      out.push(keep(item))
    }
  } finally {
    ex.delete()
    for (const bucket of seen.values()) bucket.forEach((s) => s.delete())
  }
  return out
}

export const facesOf = (shape: { wrapped: unknown }) => distinct(shape, "face", (f) => cast(f as never) as Face)
export const edgesOf = (shape: { wrapped: unknown }) => distinct(shape, "edge", (e) => cast(e as never) as Edge)
export const solidsOf = (shape: { wrapped: unknown }) => distinct(shape, "solid", (s) => cast(s as never) as Shape3D)
export const countOf = (shape: { wrapped: unknown }, kind: keyof typeof ENUM) => distinct(shape, kind, () => 0).length

/** Area and centroid of a face in one integration. */
export function faceProps(face: { wrapped: unknown }): { area: number; center: V3 } {
  const oc: OC = getOC()
  const props = new oc.GProp_GProps()
  oc.BRepGProp.SurfaceProperties(face.wrapped, props, false, false)
  const c = props.CentreOfMass()
  const out = { area: props.Mass() as number, center: [c.X(), c.Y(), c.Z()] as V3 }
  c.delete()
  props.delete()
  return out
}

/**
 * True when a face of `shape` has no edges at all. Merging same-domain faces (replicad's simplify, and the
 * clean-up after every boolean) turns the two halves of a revolved full circle (an O-ring) into one torus face
 * with no boundary. OCCT's mesher leaves such a face empty: nothing on screen, and the STL writer refuses the shape.
 */
function hasBareFace(shape: { wrapped: unknown }): boolean {
  const oc: OC = getOC()
  const faces = new oc.TopExp_Explorer(shape.wrapped, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE)
  try {
    for (; faces.More(); faces.Next()) {
      const face = faces.Current()
      const edges = new oc.TopExp_Explorer(face, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE)
      const bare = !edges.More()
      edges.delete()
      face.delete()
      if (bare) return true
    }
    return false
  } finally {
    faces.delete()
  }
}

/**
 * `shape` with every boundaryless face given its natural boundary (seam edges) back, so it meshes; solids
 * without such a face are kept as they are. Returns `shape` itself when nothing needed it, else a new
 * shape (and frees `shape`).
 */
export function bounded(shape: Shape3D): Shape3D {
  if (!hasBareFace(shape)) return shape
  const oc: OC = getOC()
  const fix = (solid: { wrapped: unknown }) => {
    const fixer = new oc.ShapeFix_Solid(solid.wrapped)
    const progress = new oc.Message_ProgressRange()
    fixer.Perform(progress)
    const out = cast(fixer.Solid()) as Shape3D
    progress.delete()
    fixer.delete()
    return out
  }
  const solids = solidsOf(shape)
  if (!solids.length) return shape
  let out: Shape3D
  // A lone solid is fixed whole; a compound (parts, or bodies that don't touch) is rebuilt from its solids.
  if (solids.length === 1 && (solids[0].wrapped as Native).IsSame(shape.wrapped)) out = fix(shape)
  else {
    const pieces = solids.map((s) => (hasBareFace(s) ? fix(s) : s))
    out = compoundOf(pieces)
    // The compound holds its own handles: the wrappers can go.
    pieces.forEach((p) => !solids.includes(p) && p.delete())
  }
  solids.forEach((s) => s.delete())
  shape.delete()
  return out
}

/** A compound of `shapes` that, unlike replicad's makeCompound, leaves them alive (the parts of a split body). */
export function compoundOf(shapes: { wrapped: unknown }[]): Shape3D {
  const oc: OC = getOC()
  const builder = new oc.TopoDS_Builder()
  const compound = new oc.TopoDS_Compound()
  builder.MakeCompound(compound)
  for (const s of shapes) builder.Add(compound, s.wrapped)
  builder.delete()
  return cast(compound as never) as Shape3D
}
