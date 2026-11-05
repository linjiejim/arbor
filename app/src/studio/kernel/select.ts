// Semantic face / edge selection. Selectors describe *what* to pick (the top
// face, the vertical edges of the pocket…) and are re-resolved on every
// rebuild, so they survive upstream parameter changes — the opposite of
// "edge #7", which is exactly the topological naming problem.
import { makeVertex, measureDistanceBetween, type Edge, type Face, type Shape3D } from "replicad"
import type { EdgeSelector, FaceSelector } from "../dsl"
import { num, type Scope } from "../expr"
import { InputError } from "./errors"

type V3 = [number, number, number]

export type FaceInfo = {
  index: number
  face: Face
  kind: "plane" | "cylinder" | "cone" | "sphere" | "torus" | "freeform"
  normal?: V3
  center: V3
  area: number
  radius?: number
  origin: string
}

export type EdgeInfo = {
  index: number
  edge: Edge
  kind: "line" | "circle" | "freeform"
  dir?: V3
  start: V3
  mid: V3
  end: V3
  length: number
  radius?: number
  faces: number[]
}

const SURF: Record<string, FaceInfo["kind"]> = { PLANE: "plane", CYLINDRE: "cylinder", CONE: "cone", SPHERE: "sphere", TORUS: "torus" }
const AXES: Record<string, V3> = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }
export const DIRS: Record<string, V3> = {
  "+X": [1, 0, 0],
  "-X": [-1, 0, 0],
  "+Y": [0, 1, 0],
  "-Y": [0, -1, 0],
  "+Z": [0, 0, 1],
  "-Z": [0, 0, -1],
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const v3 = (v: any): V3 => {
  const out: V3 = [v.x, v.y, v.z]
  v.delete?.()
  return out
}
const r2 = (x: number) => Math.round(x * 100) / 100

/** Per-face facts used by selectors, inspect and the UI. `origins[i]` = feature that first made face i. */
export function faceInfos(shape: Shape3D, origins: string[]): FaceInfo[] {
  return shape.faces.map((face, index) => {
    const kind = SURF[face.geomType] ?? "freeform"
    const center = v3(face.center)
    const info: FaceInfo = { index, face, kind, center, area: 0, origin: origins[index] ?? "?" }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adaptor: any = (face as any)._geomAdaptor()
      if (kind === "cylinder") info.radius = adaptor.Cylinder().Radius()
      else if (kind === "sphere") info.radius = adaptor.Sphere().Radius()
      else if (kind === "cone") info.radius = adaptor.Cone().RefRadius()
      else if (kind === "torus") info.radius = adaptor.Torus().MinorRadius()
      adaptor.delete?.()
    } catch {
      /* radius is optional */
    }
    if (kind === "plane") info.normal = v3(face.normalAt())
    return info
  })
}

export function edgeInfos(shape: Shape3D, faces: FaceInfo[]): EdgeInfo[] {
  const edges = shape.edges
  const byHash = new Map<number, number[]>()
  edges.forEach((e, i) => byHash.set(e.hashCode, [...(byHash.get(e.hashCode) ?? []), i]))
  const adjacent: number[][] = edges.map(() => [])
  for (const f of faces) {
    for (const fe of f.face.edges) {
      for (const i of byHash.get(fe.hashCode) ?? []) {
        if (edges[i].isSame(fe) && !adjacent[i].includes(f.index)) adjacent[i].push(f.index)
      }
      fe.delete()
    }
  }
  // A seam (where a cylinder or a revolved face closes on itself) borders one
  // face on both sides. It isn't an edge anyone means, and filleting it fails.
  const real = edges.flatMap((edge, i) => {
    if (adjacent[i].length >= 2) return [{ edge, faces: adjacent[i] }]
    edge.delete()
    return []
  })
  return real.map(({ edge, faces: adj }, index) => {
    const t = edge.geomType
    const kind: EdgeInfo["kind"] = t === "LINE" ? "line" : t === "CIRCLE" ? "circle" : "freeform"
    const start = v3(edge.startPoint)
    const end = v3(edge.endPoint)
    const mid = v3(edge.pointAt(0.5))
    const info: EdgeInfo = { index, edge, kind, start, mid, end, length: edge.length, faces: adj }
    if (kind === "line") {
      const d: V3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]]
      const n = Math.hypot(...d) || 1
      info.dir = [d[0] / n, d[1] / n, d[2] / n]
    }
    if (kind === "circle") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adaptor: any = (edge as any)._geomAdaptor()
        info.radius = adaptor.Circle().Radius()
        adaptor.delete?.()
      } catch {
        /* optional */
      }
    }
    return info
  })
}

export function disposeInfos(faces: FaceInfo[], edges: EdgeInfo[] = []) {
  faces.forEach((f) => f.face.delete())
  edges.forEach((e) => e.edge.delete())
}

function sizeOf(items: { center?: V3; mid?: V3 }[]) {
  let m = 1
  for (const it of items) for (const c of it.center ?? it.mid ?? [0, 0, 0]) m = Math.max(m, Math.abs(c))
  return m
}

function extremeFilter<T>(items: T[], coord: (t: T) => number, tol: number) {
  if (!items.length) return items
  const best = Math.max(...items.map(coord))
  return items.filter((t) => coord(t) >= best - tol)
}

function nearest<T>(items: T[], shapeOf: (t: T) => Face | Edge, p: V3): T[] {
  if (items.length <= 1) return items
  const vtx = makeVertex(p)
  let best = items[0]
  let bestD = Infinity
  for (const it of items) {
    const d = measureDistanceBetween(shapeOf(it), vtx)
    if (d < bestD) {
      bestD = d
      best = it
    }
  }
  vtx.delete()
  return [best]
}

export function describeFace(f: FaceInfo) {
  const kindName = { plane: "平面", cylinder: "圆柱面", cone: "圆锥面", sphere: "球面", torus: "环面", freeform: "自由曲面" }[f.kind]
  const n = f.normal ? ` 法向 ${dirName(f.normal)}` : ""
  const r = f.radius !== undefined ? ` R${r2(f.radius)}` : ""
  return `面#${f.index} ${kindName}${n}${r} 中心(${f.center.map(r2).join(", ")}) 来自 ${f.origin}`
}

export function describeEdge(e: EdgeInfo) {
  const kindName = { line: "直线", circle: "圆弧", freeform: "曲线" }[e.kind]
  const d = e.dir ? ` 方向 ${dirName(e.dir)}` : ""
  const r = e.radius !== undefined ? ` R${r2(e.radius)}` : ""
  return `边#${e.index} ${kindName}${d}${r} 中点(${e.mid.map(r2).join(", ")}) 长 ${r2(e.length)}`
}

function dirName(v: V3) {
  for (const [name, d] of Object.entries(DIRS)) if (dot(v, d) > 0.9999) return name
  return `(${v.map(r2).join(", ")})`
}

function checkCount<T>(found: T[], expect: number | undefined, what: string, all: T[], describe: (t: T) => string) {
  if (found.length && (expect === undefined || found.length === expect)) return found
  const list = all.slice(0, 16).map(describe).join("\n")
  const more = all.length > 16 ? `\n…共 ${all.length} 个` : ""
  const head = found.length ? `选中了 ${found.length} 个${what}，预期 ${expect} 个` : `没有${what}满足这个选择条件`
  throw new InputError(`${head}。候选：\n${list}${more}`)
}

export function selectFaces(sel: FaceSelector, faces: FaceInfo[], scope: Scope): FaceInfo[] {
  let out = filterFaces(sel, faces, scope)
  if (sel.not) {
    const drop = new Set(filterFaces(sel.not, faces, scope).map((f) => f.index))
    out = out.filter((f) => !drop.has(f.index))
  }
  return checkCount(out, sel.expect, "面", faces, describeFace)
}

function filterFaces(sel: Omit<FaceSelector, "not" | "expect">, faces: FaceInfo[], scope: Scope): FaceInfo[] {
  const tol = 1e-3 * Math.max(1, sizeOf(faces) / 100)
  let out = faces
  if (sel.of) out = out.filter((f) => f.origin === sel.of)
  if (sel.kind) out = out.filter((f) => f.kind === sel.kind)
  if (sel.normal) {
    const n = DIRS[sel.normal]
    out = out.filter((f) => f.normal && dot(f.normal, n) > 0.9999)
  }
  if (sel.radius !== undefined) {
    const r = num(sel.radius, scope)
    out = out.filter((f) => f.radius !== undefined && Math.abs(f.radius - r) <= tol)
  }
  if (sel.at) {
    const a = AXES[sel.at.axis]
    const v = num(sel.at.value, scope)
    out = out.filter((f) => Math.abs(dot(f.center, a) - v) <= tol)
  }
  if (sel.extreme) {
    const d = DIRS[sel.extreme]
    out = extremeFilter(out, (f) => dot(f.center, d), tol)
  }
  if (sel.near) {
    const p = sel.near.map((c) => num(c, scope)) as V3
    out = nearest(out, (f) => f.face, p)
  }
  return out
}

export function selectEdges(sel: EdgeSelector, edges: EdgeInfo[], faces: FaceInfo[], scope: Scope): EdgeInfo[] {
  let out = filterEdges(sel, edges, faces, scope)
  if (sel.not) {
    const drop = new Set(filterEdges(sel.not, edges, faces, scope).map((e) => e.index))
    out = out.filter((e) => !drop.has(e.index))
  }
  return checkCount(out, sel.expect, "边", edges, describeEdge)
}

function filterEdges(sel: Omit<EdgeSelector, "not" | "expect">, edges: EdgeInfo[], faces: FaceInfo[], scope: Scope): EdgeInfo[] {
  const tol = 1e-3 * Math.max(1, sizeOf(edges) / 100)
  let out = edges
  if (sel.of) {
    const ids = new Set(faces.filter((f) => f.origin === sel.of).map((f) => f.index))
    out = out.filter((e) => e.faces.some((i) => ids.has(i)))
  }
  if (sel.faces) {
    const ids = new Set(selectFaces(sel.faces, faces, scope).map((f) => f.index))
    out = out.filter((e) => e.faces.some((i) => ids.has(i)))
  }
  if (sel.kind) out = out.filter((e) => e.kind === sel.kind)
  if (sel.parallel) {
    const a = AXES[sel.parallel]
    out = out.filter((e) => e.dir && Math.abs(dot(e.dir, a)) > 0.9999)
  }
  if (sel.radius !== undefined) {
    const r = num(sel.radius, scope)
    out = out.filter((e) => e.radius !== undefined && Math.abs(e.radius - r) <= tol)
  }
  if (sel.at) {
    const a = AXES[sel.at.axis]
    const v = num(sel.at.value, scope)
    out = out.filter((e) => [e.start, e.mid, e.end].every((p) => Math.abs(dot(p, a) - v) <= tol))
  }
  if (sel.extreme) {
    const d = DIRS[sel.extreme]
    out = extremeFilter(out, (e) => dot(e.mid, d), tol)
  }
  if (sel.near) {
    const p = sel.near.map((c) => num(c, scope)) as V3
    out = nearest(out, (e) => e.edge, p)
  }
  return out
}
