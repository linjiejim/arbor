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
