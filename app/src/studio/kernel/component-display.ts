// Portable component tessellations. Face/edge ordinals cross worker boundaries;
// OCCT hashes belong only to the kernel that owns the current native shape.
import type { Shape3D } from "replicad"
import { meshShape, meshEdges, type Mesh, type EdgeMesh } from "./mesh"
import { facesOf, edgesOf } from "./topo"
import type { Rigid } from "./mates"

export type ComponentDisplay = { mesh: Mesh; edges: EdgeMesh }
const displays = new WeakMap<Shape3D, ComponentDisplay>()

function ids(shape: Shape3D, edges = false) {
  const items = edges ? edgesOf(shape) : facesOf(shape)
  const result = items.map((s) => s.hashCode)
  items.forEach((s) => s.delete())
  return result
}

export function packDisplay(shape: Shape3D): ComponentDisplay {
  const mesh = meshShape(shape, 0.05, 0.5)
  const edges = meshEdges(shape, 0.05, 0.5)
  const faces = new Map(ids(shape).map((h, i) => [h, i]))
  const edgeIds = new Map(ids(shape, true).map((h, i) => [h, i]))
  return {
    mesh: { ...mesh, faceGroups: mesh.faceGroups.map((g) => ({ ...g, faceId: faces.get(g.faceId)! })) },
    edges: { ...edges, edgeGroups: edges.edgeGroups.map((g) => ({ ...g, edgeId: edgeIds.get(g.edgeId)! })) },
  }
}

export function restoreDisplay(shape: Shape3D, data: ComponentDisplay) {
  const faces = ids(shape), edges = ids(shape, true)
  if (data.mesh.faceGroups.some((g) => faces[g.faceId] === undefined) || data.edges.edgeGroups.some((g) => edges[g.edgeId] === undefined)) return
  displays.set(shape, {
    mesh: { ...data.mesh, faceGroups: data.mesh.faceGroups.map((g) => ({ ...g, faceId: faces[g.faceId] })) },
    edges: { ...data.edges, edgeGroups: data.edges.edgeGroups.map((g) => ({ ...g, edgeId: edges[g.edgeId] })) },
  })
}

/** Move the mesh with the exact rigid placement used for its native solid. */
export function placeDisplay(source: Shape3D, target: Shape3D, { R, t }: Rigid) {
  const data = displays.get(source)
  if (!data) return
  const points = (a: Float32Array, translate: boolean) => {
    const out = new Float32Array(a.length)
    for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) out[i + k] = R[k * 3] * a[i] + R[k * 3 + 1] * a[i + 1] + R[k * 3 + 2] * a[i + 2] + (translate ? t[k] : 0)
    return out
  }
  const idsForTarget = { faces: ids(target), edges: ids(target, true) }
  const faceMap = new Map(ids(source).map((h, i) => [h, idsForTarget.faces[i]]))
  const edgeMap = new Map(ids(source, true).map((h, i) => [h, idsForTarget.edges[i]]))
  displays.set(target, {
    mesh: { vertices: points(data.mesh.vertices, true), normals: points(data.mesh.normals, false), triangles: data.mesh.triangles, faceGroups: data.mesh.faceGroups.map((g) => ({ ...g, faceId: faceMap.get(g.faceId)! })) },
    edges: { lines: points(data.edges.lines, true), edgeGroups: data.edges.edgeGroups.map((g) => ({ ...g, edgeId: edgeMap.get(g.edgeId)! })) },
  })
}

/** Concatenate placed component meshes, retaining their interactive face IDs. */
export function assemblyDisplay(parts: Shape3D[]): ComponentDisplay | null {
  const data = parts.map((p) => displays.get(p))
  if (data.some((d) => !d)) return null
  const all = data as ComponentDisplay[]
  const mesh: Mesh = { vertices: new Float32Array(all.reduce((n, d) => n + d.mesh.vertices.length, 0)), normals: new Float32Array(all.reduce((n, d) => n + d.mesh.normals.length, 0)), triangles: new Uint32Array(all.reduce((n, d) => n + d.mesh.triangles.length, 0)), faceGroups: [] }
  const edges: EdgeMesh = { lines: new Float32Array(all.reduce((n, d) => n + d.edges.lines.length, 0)), edgeGroups: [] }
  let v = 0, tri = 0, line = 0
  for (const d of all) {
    mesh.vertices.set(d.mesh.vertices, v)
    mesh.normals.set(d.mesh.normals, v)
    for (let i = 0; i < d.mesh.triangles.length; i++) mesh.triangles[tri + i] = d.mesh.triangles[i] + v / 3
    mesh.faceGroups.push(...d.mesh.faceGroups.map((g) => ({ ...g, start: g.start + tri })))
    edges.lines.set(d.edges.lines, line)
    edges.edgeGroups.push(...d.edges.edgeGroups.map((g) => ({ ...g, start: g.start + line / 3 })))
    v += d.mesh.vertices.length
    tri += d.mesh.triangles.length
    line += d.edges.lines.length
  }
  return { mesh, edges }
}
