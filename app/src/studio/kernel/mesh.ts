// Meshing and per-face bookkeeping. Ported from the kernel spike
// (spikes/replicad-kernel/src/kernel/mesh.js), where the geometric face
// classification agreed with OCCT's own history on all but 1 of 1,694 faces.
import { getOC, measureArea, type AnyShape } from "replicad"

// The opencascade.js bindings are untyped from our side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any

export type Mesh = {
  vertices: Float32Array
  normals: Float32Array
  triangles: Uint32Array
  /** One group per B-rep face: a range of `triangles` (index count) and the face's hash. */
  faceGroups: { start: number; count: number; faceId: number }[]
}
export type EdgeMesh = { lines: Float32Array; edgeGroups: { start: number; count: number; edgeId: number }[] }

/**
 * Triangulate a shape: same C++ entry point as replicad's shape.mesh(), but
 * the buffers are copied out of the wasm heap as typed arrays (transferable).
 */
export function meshShape(shape: AnyShape, tolerance = 0.05, angularTolerance = 0.2): Mesh {
  const oc: OC = getOC()
  const raw = oc.ReplicadMeshExtractor.extract(shape.wrapped, tolerance, angularTolerance, false)
  const buf = oc.wasmMemory.buffer
  const f32 = (ptr: number, n: number) => new Float32Array(buf, ptr >>> 0, n).slice()
  const u32 = (ptr: number, n: number) => new Uint32Array(buf, ptr >>> 0, n).slice()
  const i32 = (ptr: number, n: number) => new Int32Array(buf, ptr >>> 0, n).slice()
  const vertices = f32(raw.getVerticesPtr(), raw.getVerticesSize())
  const normals = f32(raw.getNormalsPtr(), raw.getNormalsSize())
  const triangles = u32(raw.getTrianglesPtr(), raw.getTrianglesSize())
  const groupsRaw = i32(raw.getFaceGroupsPtr(), raw.getFaceGroupsSize())
  raw.delete()
  const faceGroups: Mesh["faceGroups"] = []
  for (let i = 0; i < groupsRaw.length; i += 3) faceGroups.push({ start: groupsRaw[i], count: groupsRaw[i + 1], faceId: groupsRaw[i + 2] })
  return { vertices, normals, triangles, faceGroups }
}

export function meshEdges(shape: AnyShape, tolerance = 0.05, angularTolerance = 0.2): EdgeMesh {
  const oc: OC = getOC()
  const raw = oc.ReplicadEdgeMeshExtractor.extract(shape.wrapped, tolerance, angularTolerance)
  const buf = oc.wasmMemory.buffer
  const lines = new Float32Array(buf, raw.getLinesPtr() >>> 0, raw.getLinesSize()).slice()
  const groupsRaw = new Int32Array(buf, raw.getEdgeGroupsPtr() >>> 0, raw.getEdgeGroupsSize()).slice()
  raw.delete()
  const edgeGroups: EdgeMesh["edgeGroups"] = []
  for (let i = 0; i < groupsRaw.length; i += 3) edgeGroups.push({ start: groupsRaw[i], count: groupsRaw[i + 1], edgeId: groupsRaw[i + 2] })
  return { lines, edgeGroups }
}

export type FaceSig = {
  type: string
  area: number
  center: [number, number, number]
  /** A point inside the face, on the exact surface. */
  sample: [number, number, number] | null
}

/**
 * Geometric signature of every face (type, area, centroid) plus one interior
 * sample point: the centroid of the face's biggest triangle, snapped onto the
 * exact surface.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function faceSignatures(faces: any[], mesh: Mesh): FaceSig[] {
  const oc: OC = getOC()
  const groupByHash = new Map(mesh.faceGroups.map((g) => [g.faceId, g]))
  return faces.map((f) => {
    const c = f.center
    const sig: FaceSig = { type: f.geomType, area: measureArea(f), center: [c.x, c.y, c.z], sample: null }
    c.delete()
    const g = groupByHash.get(f.hashCode)
    if (g) {
      const v = mesh.vertices
      const t = mesh.triangles
      let best = -1
      let bestArea = -1
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const a = t[k] * 3
        const b = t[k + 1] * 3
        const d = t[k + 2] * 3
        const ux = v[b] - v[a]
        const uy = v[b + 1] - v[a + 1]
        const uz = v[b + 2] - v[a + 2]
        const wx = v[d] - v[a]
        const wy = v[d + 1] - v[a + 1]
        const wz = v[d + 2] - v[a + 2]
        const cx = uy * wz - uz * wy
        const cy = uz * wx - ux * wz
        const cz = ux * wy - uy * wx
        const area2 = cx * cx + cy * cy + cz * cz
        if (area2 > bestArea) {
          bestArea = area2
          best = k
        }
      }
      if (best >= 0) {
        const ids = [t[best], t[best + 1], t[best + 2]]
        const p = [0, 1, 2].map((dd) => (v[ids[0] * 3 + dd] + v[ids[1] * 3 + dd] + v[ids[2] * 3 + dd]) / 3)
        const surf = oc.BRep_Tool.Surface(f.wrapped)
        const pnt = new oc.gp_Pnt(p[0], p[1], p[2])
        const proj = new oc.GeomAPI_ProjectPointOnSurf(pnt, surf)
        if (proj.NbPoints() > 0) {
          const q = proj.NearestPoint()
          sig.sample = [q.X(), q.Y(), q.Z()]
          q.delete()
        } else sig.sample = [p[0], p[1], p[2]]
        proj.delete()
        pnt.delete()
        surf.delete?.()
      }
    }
    return sig
  })
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export type FaceStatus = "new" | "modified" | "kept"

/**
 * Classify each current face against the previous step, geometry only:
 *  kept     = a previous face has the same surface type, area and centroid
 *  modified = a previous face's underlying surface passes through this face's
 *             interior sample point (trimmed / split / extended)
 *  new      = otherwise
 * Also returns which previous face it matched, so face provenance (which
 * feature first made the surface) can be carried forward.
 */
export function classifyFaces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prevFaces: any[] | null,
  prevSigs: FaceSig[] | null,
  curSigs: FaceSig[],
  tol = 1e-4,
): { status: FaceStatus; match: number }[] {
  if (!prevFaces || !prevSigs) return curSigs.map(() => ({ status: "new", match: -1 }))
  const oc: OC = getOC()
  const surfaces = prevFaces.map((f) => oc.BRep_Tool.Surface(f.wrapped))
  const out = curSigs.map((s) => {
    const kept = prevSigs.findIndex(
      (p) => p.type === s.type && Math.abs(p.area - s.area) <= 1e-6 * Math.max(1, s.area) + 1e-6 && dist(p.center, s.center) <= tol * 10,
    )
    if (kept >= 0) return { status: "kept" as const, match: kept }
    if (!s.sample) return { status: "new" as const, match: -1 }
    for (let i = 0; i < prevSigs.length; i++) {
      if (prevSigs[i].type !== s.type) continue
      const pnt = new oc.gp_Pnt(s.sample[0], s.sample[1], s.sample[2])
      const proj = new oc.GeomAPI_ProjectPointOnSurf(pnt, surfaces[i])
      const d = proj.NbPoints() > 0 ? proj.LowerDistance() : Infinity
      proj.delete()
      pnt.delete()
      if (d <= tol) return { status: "modified" as const, match: i }
    }
    return { status: "new" as const, match: -1 }
  })
  surfaces.forEach((s) => s.delete?.())
  return out
}
