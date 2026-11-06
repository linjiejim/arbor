// The feature-tree interpreter. Rebuilds a Tree feature by feature with
// replicad (OpenCascade), caches every step by tree prefix so an edit only
// recomputes what follows it, and records for every face which feature first
// made it (face provenance) and whether this step made it new / modified it.
//
// Runs unchanged in a Web Worker (the studio) and in Node (evals, tests).
import {
  Blueprints,
  cast,
  draw,
  Drawing,
  drawCircle,
  drawPolysides,
  drawRoundedRectangle,
  getOC,
  makeCompound,
  makePlane,
  measureArea,
  measureShapeVolumeProperties,
  Plane,
  sketchCircle,
  sketchRectangle,
  type Blueprint,
  type CompoundBlueprint,
  type Shape3D,
} from "replicad"
import type { PickInfo } from "../annotations"
import { displayName, EMPTY_TREE, type EdgeSelector, type Feature, type FeatureOp, type FaceSelector, type PlaneRef, type SketchShape, type Tree } from "../dsl"
import { num, resolveParams, type Scope } from "../expr"
import { referencesOf } from "../apply"
import { describeError, explain, InputError } from "./errors"
import { normalizeText, textDrawing } from "./fonts"
import { measure, type MeasureResult, type MeasureTarget } from "./measure"
import { countOf, edgesOf, facesOf, solidsOf } from "./topo"
import { dimensionsOf, type Dim, type Frame, type StepGeom } from "./dims"
import { runChecks, type CheckResult } from "./check"
import { standardHole } from "../holes"
import { classifyFaces, faceSignatures, meshEdges, meshShape, type EdgeMesh, type FaceSig, type FaceStatus, type Mesh } from "./mesh"
import {
  axisDir,
  DIRS,
  describeEdge,
  describeFace,
  disposeInfos,
  edgeInfos,
  faceInfos,
  groupEdgeSelector,
  groupFaceSelector,
  selectEdges,
  selectFaces,
  uniqueEdgeSelector,
  uniqueFaceSelector,
  type EdgeInfo,
  type FaceInfo,
} from "./select"

type V3 = [number, number, number]
type PlaneName = "XY" | "XZ" | "YZ"
type Tool = { tool: Shape3D; mode: "add" | "cut" }

const PLANES: Record<PlaneName, { normal: V3; x: V3; y: V3; axis: 0 | 1 | 2; label: string }> = {
  XY: { normal: [0, 0, 1], x: [1, 0, 0], y: [0, 1, 0], axis: 2, label: "上视基准面" },
  XZ: { normal: [0, -1, 0], x: [1, 0, 0], y: [0, 0, 1], axis: 1, label: "前视基准面" },
  YZ: { normal: [1, 0, 0], x: [0, 1, 0], y: [0, 0, 1], axis: 0, label: "右视基准面" },
}
const AXIS: Record<string, V3> = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const r2 = (x: number) => Math.round(x * 100) / 100
const fmt = (x: number) => String(r2(x))

/**
 * Where a sketch lies: the datum plane it was named after, and its actual frame
 * (sketch x → `x`, y → `y`, extrusion along `normal`). `flipped`: sketched on a
 * face that looks the other way from its datum plane (the back, the bottom…).
 * `custom`: an inclined face or a tilted datum, not an axis-aligned plane.
 */
type ResolvedPlane = { name: PlaneName; origin: V3; x: V3; y: V3; normal: V3; label: string; flipped?: boolean; custom?: boolean }

const unit = (a: V3): V3 => mul(a, 1 / (Math.hypot(...a) || 1))

/** `v` turned `deg` degrees about the unit vector `k` (right-hand rule). */
function rotate(v: V3, k: V3, deg: number): V3 {
  const t = (deg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
}

/** Put a drawing (or blueprint) on a resolved plane, optionally moved to `origin`. */
function sketchOn<T>(d: { sketchOnPlane(p: Plane): T }, p: ResolvedPlane, origin: V3 = p.origin): T {
  const pl = new Plane(origin, p.x, p.normal)
  try {
    return d.sketchOnPlane(pl)
  } finally {
    pl.delete()
  }
}

export type FeatureResult = {
  id: string
  op: FeatureOp
  name: string
  state: "ok" | "error" | "skipped" | "suppressed"
  summary?: string
  message?: string
  hint?: string
  warnings?: string[]
  /** How many edges / faces a selector picked. */
  selected?: number
  /** Faces this step created and modified. */
  faces?: { new: number; modified: number }
  ms: number
}

export type BodyStats = {
  bbox: [V3, V3]
  size: V3
  volume: number
  centerOfMass: V3
  faces: number
  edges: number
  solids: number
}

export type BuildReport = {
  params: Record<string, number>
  paramError?: string
  features: FeatureResult[]
  /** Index of the last feature that built. -1 = nothing built. */
  lastOk: number
  body: BodyStats | null
  /** The learner's requirements (`tree.checks`) measured on the latest body. */
  checks?: CheckResult[]
  ms: number
}

export type DisplayData = {
  index: number
  mesh: { vertices: Float32Array; normals: Float32Array; triangles: Uint32Array } | null
  /** One per B-rep face, in mesh order. `hash` identifies the face for picking. */
  groups: { start: number; count: number; status: FaceStatus; origin: string; hash: number }[]
  edges: Float32Array | null
  /** One per edge: a run of points in `edges` (segment pairs). */
  edgeGroups: { start: number; count: number; hash: number }[]
  /** Outline of the sketch, when the shown step is a sketch. */
  sketch: Float32Array | null
  /** Cosmetic threads: a ring at the nominal diameter at each end of a tapped hole. */
  threads: { center: V3; axis: V3; r: number }[]
  bbox: [V3, V3] | null
}

type Step = {
  key: string
  feature: Feature
  result: FeatureResult
  body: Shape3D | null
  ownsBody: boolean
  origins: string[]
  status: FaceStatus[]
  sigs: FaceSig[]
  mesh: Mesh | null
  edges: EdgeMesh | null
  sketch?: { drawing: Drawing; plane: ResolvedPlane; lines: Float32Array }
  tools?: Tool[]
  /** Tapped holes this step drilled: drill radius and the thread's nominal diameter. */
  threads?: Thread[]
  /** Where this step's dimensions go (kernel/dims.ts). */
  geom?: StepGeom
}

type Thread = { r: number; major: number }

export class Kernel {
  private steps: Step[] = []
  private paramsKey = ""
  private scope: Scope = {}
  private tree: Tree = EMPTY_TREE

  rebuild(tree: Tree): BuildReport {
    const t0 = performance.now()
    this.tree = tree
    const paramsKey = JSON.stringify(tree.params)
    let paramError: string | undefined
    try {
      this.scope = resolveParams(tree.params)
    } catch (e) {
      paramError = (e as Error).message
      this.scope = {}
    }
    if (paramsKey !== this.paramsKey) {
      this.disposeFrom(0)
      this.paramsKey = paramsKey
    }

    // Suppressing a feature suppresses what is built on it, as in SolidWorks.
    const off = new Map<string, string | null>()
    for (const f of tree.features) {
      if (f.suppressed) off.set(f.id, null)
      else {
        const parent = referencesOf(f).find((r) => off.has(r))
        if (parent) off.set(f.id, parent)
      }
    }

    let key = paramsKey
    let failed = paramError !== undefined
    for (let i = 0; i < tree.features.length; i++) {
      const f = tree.features[i]
      key += "\n" + JSON.stringify(f) + (off.has(f.id) ? "\noff" : "")
      const cached = this.steps[i]
      if (cached && cached.key === key) {
        if (cached.result.state === "error" || cached.result.state === "skipped") failed = true
        continue
      }
      this.disposeFrom(i)
      const prev = this.lastBuilt(i)
      // A suppressed feature passes the body through untouched; what depends on it fails on its own.
      const step = off.has(f.id)
        ? this.base(f, key, prev, tree, { state: "suppressed", summary: off.get(f.id) ? `已压缩（它用到的「${displayName(tree, tree.features.find((x) => x.id === off.get(f.id))!)}」被压缩了）` : "已压缩" })
        : failed
          ? this.skip(f, key, prev, tree)
          : this.run(f, key, prev, tree)
      if (step.result.state === "error" || step.result.state === "skipped") failed = true
      this.steps.push(step)
    }
    this.disposeFrom(tree.features.length)

    const features = this.steps.map((s) => s.result)
    let lastOk = -1
    features.forEach((r, i) => {
      if (r.state === "ok") lastOk = i
    })
    const last = this.lastBuilt(this.steps.length)
    return {
      params: this.scope,
      paramError,
      features,
      lastOk,
      body: last?.body ? stats(last.body) : null,
      checks: tree.checks?.length && last?.body ? runChecks(last.body, last.origins, tree.checks, this.scope) : undefined,
      ms: performance.now() - t0,
    }
  }

  /** Mesh + per-face status of one step (default: the last that built). */
  display(index?: number): DisplayData {
    const i = index ?? this.steps.findLastIndex((s) => s.result.state === "ok")
    const step = this.steps[i]
    const empty: DisplayData = { index: i, mesh: null, groups: [], edges: null, edgeGroups: [], sketch: null, bbox: null, threads: [] }
    if (!step) return empty
    const body = step.result.state === "ok" ? step : this.lastBuilt(i)
    const out: DisplayData = { ...empty, sketch: step.sketch ? step.sketch.lines.slice() : null }
    if (body?.body && body.mesh) {
      const faces = facesOf(body.body)
      const indexByHash = new Map(faces.map((f, k) => [f.hashCode, k]))
      faces.forEach((f) => f.delete())
      const isThisStep = body === step && step.ownsBody
      out.mesh = { vertices: body.mesh.vertices.slice(), normals: body.mesh.normals.slice(), triangles: body.mesh.triangles.slice() }
      out.groups = body.mesh.faceGroups.map((g) => {
        const k = indexByHash.get(g.faceId) ?? -1
        return {
          start: g.start,
          count: g.count,
          status: isThisStep && k >= 0 ? body.status[k] : "kept",
          origin: k >= 0 ? body.origins[k] : "?",
          hash: g.faceId,
        }
      })
      out.edges = body.edges ? body.edges.lines.slice() : null
      out.edgeGroups = body.edges ? body.edges.edgeGroups.map((g) => ({ start: g.start, count: g.count, hash: g.edgeId })) : []
      const bb = body.body.boundingBox.bounds as [V3, V3]
      out.bbox = [[...bb[0]], [...bb[1]]] as [V3, V3]
      out.threads = this.threadRings(this.steps.indexOf(body), body)
    }
    return out
  }

  /** Rings for the tapped holes in `step`'s body, the ones patterns and mirrors copied included. */
  private threadRings(upto: number, step: Step): DisplayData["threads"] {
    const tapped = new Map<string, Thread[]>()
    for (const s of this.steps.slice(0, upto + 1)) {
      if (s.result.state !== "ok") continue
      if (s.threads) tapped.set(s.feature.id, s.threads)
      const f = s.feature
      if (f.op === "linear_pattern" || f.op === "circular_pattern" || f.op === "mirror") {
        const copied = (f.features ?? [...tapped.keys()]).flatMap((id) => tapped.get(id) ?? [])
        if (copied.length) tapped.set(f.id, copied)
      }
    }
    if (!tapped.size || !step.body || !step.mesh) return []
    const out: DisplayData["threads"] = []
    const faces = faceInfos(step.body, step.origins)
    try {
      const groups = new Map(step.mesh.faceGroups.map((g) => [g.faceId, g]))
      for (const f of faces) {
        const t = f.kind === "cylinder" && f.radius !== undefined ? tapped.get(f.origin)?.find((x) => Math.abs(x.r - f.radius!) < 1e-4) : undefined
        const g = t && groups.get(f.face.hashCode)
        if (!t || !g) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ad: any = (f.face as any)._geomAdaptor()
        try {
          const ax = ad.Cylinder().Axis()
          const lp = ax.Location()
          const dp = ax.Direction()
          const p: V3 = [lp.X(), lp.Y(), lp.Z()]
          const a: V3 = [dp.X(), dp.Y(), dp.Z()]
          // The hole's extent along its axis, from the face's own triangles.
          const v = step.mesh.vertices
          const tri = step.mesh.triangles
          let lo = Infinity
          let hi = -Infinity
          for (let k = g.start; k < g.start + g.count; k++) {
            const q: V3 = [v[tri[k] * 3], v[tri[k] * 3 + 1], v[tri[k] * 3 + 2]]
            const s = dot([q[0] - p[0], q[1] - p[1], q[2] - p[2]], a)
            lo = Math.min(lo, s)
            hi = Math.max(hi, s)
          }
          for (const s of [lo, hi]) out.push({ center: add(p, mul(a, s)), axis: a, r: t.major / 2 })
        } finally {
          ad.delete?.()
        }
      }
    } finally {
      disposeInfos(faces)
    }
    return out
  }

  /** Text the model (or a curious learner) can read: faces, edges, or the body. */
  inspect(what: "body" | "faces" | "edges", index?: number, selector?: unknown): string {
    const step = this.lastBuilt(index === undefined ? this.steps.length : index + 1)
    if (!step?.body) return "还没有实体。"
    if (what === "body") {
      const s = stats(step.body)
      return [
        `包围盒 X ${fmt(s.bbox[0][0])}…${fmt(s.bbox[1][0])}，Y ${fmt(s.bbox[0][1])}…${fmt(s.bbox[1][1])}，Z ${fmt(s.bbox[0][2])}…${fmt(s.bbox[1][2])}`,
        `尺寸 ${s.size.map(fmt).join(" × ")} mm，体积 ${fmt(s.volume / 1000)} cm³，质心 (${s.centerOfMass.map(fmt).join(", ")})`,
        `${s.solids} 个实体，${s.faces} 个面，${s.edges} 条边`,
      ].join("\n")
    }
    const faces = faceInfos(step.body, step.origins)
    try {
      if (what === "faces") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = selector ? selectFaces(selector as any, faces, this.scope) : faces
        return list.slice(0, 40).map(describeFace).join("\n") + (list.length > 40 ? `\n…共 ${list.length} 个面` : "")
      }
      const edges = edgeInfos(step.body, faces)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = selector ? selectEdges(selector as any, edges, faces, this.scope) : edges
        return list.slice(0, 40).map(describeEdge).join("\n") + (list.length > 40 ? `\n…共 ${list.length} 条边` : "")
      } finally {
        disposeInfos([], edges)
      }
    } catch (e) {
      return describeError(e).message
    } finally {
      disposeInfos(faces)
    }
  }

  /**
   * What the learner clicked on the latest body (by mesh hash): a description,
   * a selector verified to pick exactly it, and sketch coordinates on a face.
   */
  pick(target: { kind: "face" | "edge"; hash: number; point: V3 }): PickInfo | null {
    const step = this.lastBuilt(this.steps.length)
    if (!step?.body) return null
    const faces = faceInfos(step.body, step.origins)
    const name = (id: string) => {
      const f = this.tree.features.find((x) => x.id === id)
      return f ? displayName(this.tree, f) : id
    }
    try {
      if (target.kind === "face") {
        const face = faces.find((f) => f.face.hashCode === target.hash)
        if (!face) return null
        const n = face.normal ? axisDir(face.normal) : null
        const kind = { plane: "平面", cylinder: "圆柱面", cone: "圆锥面", sphere: "球面", torus: "环面", freeform: "自由曲面" }[face.kind]
        const facing = n ? `朝${{ "+Z": "上", "-Z": "下", "+X": "右（+X）", "-X": "左（-X）", "+Y": "后（+Y）", "-Y": "前（-Y）" }[n]}` : null
        const what = [kind, facing && `${facing}${n?.[1] === "Z" ? `（${n}）` : ""}`, face.radius !== undefined && `R${fmt(face.radius)}`].filter(Boolean).join(" · ")
        const origins = face.origin && face.origin !== "?" ? [face.origin] : []
        const plane = n ? ({ Z: "XY", Y: "XZ", X: "YZ" } as const)[n[1] as "X" | "Y" | "Z"] : null
        const uv = (p: V3): [number, number] => (plane === "XY" ? [p[0], p[1]] : plane === "XZ" ? [p[0], p[2]] : [p[1], p[2]])
        return {
          kind: "face",
          hash: target.hash,
          point: target.point,
          what,
          where: origins.length ? `来自「${name(origins[0])}」` : "来源不明",
          origins,
          facts: `面积 ${fmt(measureArea(face.face))} mm²`,
          selector: uniqueFaceSelector(face, faces, this.scope, target.point),
          sketch: plane && n ? { plane, offset: r2(face.center["XYZ".indexOf(n[1])]), uv: uv(target.point).map(r2) as [number, number] } : null,
        }
      }
      const edges = edgeInfos(step.body, faces)
      try {
        const edge = edges.find((e) => e.edge.hashCode === target.hash)
        if (!edge) return null
        const d = edge.dir ? axisDir(edge.dir) : null
        const kind = { line: "直线边", circle: "圆弧边", freeform: "曲线边" }[edge.kind]
        const what = [kind, d && `沿 ${d[1]} 方向`, edge.radius !== undefined && `R${fmt(edge.radius)}`].filter(Boolean).join(" · ")
        const origins = [...new Set(edge.faces.map((i) => faces[i]?.origin).filter((o): o is string => !!o && o !== "?"))]
        const where =
          origins.length === 0 ? "来源不明" : origins.length === 1 ? `「${name(origins[0])}」的面相交处` : `在「${name(origins[0])}」和「${name(origins[1])}」的面之间`
        // Tangent line between a fillet and its neighbour: drawn like an edge, but there's no corner there.
        let smooth = false
        if (edge.faces.length === 2) {
          const [na, nb] = edge.faces.map((i) => faces[i].face.normalAt(edge.mid))
          smooth = na.dot(nb) > 0.999
          na.delete()
          nb.delete()
        }
        return {
          kind: "edge",
          hash: target.hash,
          point: target.point,
          what,
          where,
          origins,
          facts: `长 ${fmt(edge.length)} mm`,
          selector: uniqueEdgeSelector(edge, edges, faces, this.scope, target.point),
          smooth,
          sketch: null,
        }
      } finally {
        disposeInfos([], edges)
      }
    } finally {
      disposeInfos(faces)
    }
  }

  /**
   * A selector for exactly these clicked faces / edges of the body that step
   * `before` starts from (what a fillet is applied to), with what it says and
   * picks; null when there's no plain description for this set.
   */
  selectorFor(kind: "face" | "edge", hashes: number[], before: number): { selector: Record<string, unknown>; count: number } | null {
    const step = this.lastBuilt(before)
    if (!step?.body || !hashes.length) return null
    const faces = faceInfos(step.body, step.origins)
    try {
      if (kind === "face") {
        const targets = faces.filter((f) => hashes.includes(f.face.hashCode))
        const sel = targets.length === hashes.length ? groupFaceSelector(targets, faces, this.scope) : null
        return sel ? { selector: sel, count: targets.length } : null
      }
      const edges = edgeInfos(step.body, faces)
      try {
        const targets = edges.filter((e) => hashes.includes(e.edge.hashCode))
        const sel = targets.length === hashes.length ? groupEdgeSelector(targets, edges, faces, this.scope) : null
        return sel ? { selector: sel, count: targets.length } : null
      } finally {
        disposeInfos([], edges)
      }
    } finally {
      disposeInfos(faces)
    }
  }

  /** The edges around a face of the body step `before` starts from (clicking a face in an edge box picks its rim). */
  faceEdges(faceHash: number, before: number): number[] {
    const step = this.lastBuilt(before)
    if (!step?.body) return []
    const faces = faceInfos(step.body, step.origins)
    const edges = edgeInfos(step.body, faces)
    try {
      const face = faces.find((f) => f.face.hashCode === faceHash)
      return face ? edges.filter((e) => e.faces.includes(face.index)).map((e) => e.edge.hashCode) : []
    } finally {
      disposeInfos(faces, edges)
    }
  }

  /** Mesh hashes a selector picks on the latest body now (or on the body step `before` starts from); null when it no longer resolves. */
  locate(kind: "face" | "edge", selector: unknown, before?: number): number[] | null {
    const step = this.lastBuilt(before ?? this.steps.length)
    if (!step?.body) return null
    const faces = faceInfos(step.body, step.origins)
    try {
      if (kind === "face") return selectFaces(selector as FaceSelector, faces, this.scope).map((f) => f.face.hashCode)
      const edges = edgeInfos(step.body, faces)
      try {
        return selectEdges(selector as EdgeSelector, edges, faces, this.scope).map((e) => e.edge.hashCode)
      } finally {
        disposeInfos([], edges)
      }
    } catch {
      return null
    } finally {
      disposeInfos(faces)
    }
  }

  /** Dimensions of every feature that built (kernel/dims.ts). */
  dimensions(): Dim[] {
    const geoms = new Map<string, StepGeom>()
    for (const s of this.steps) if (s.result.state === "ok" && s.geom) geoms.set(s.feature.id, s.geom)
    const last = this.lastBuilt(this.steps.length)
    const bb = last?.body ? (last.body.boundingBox.bounds as [V3, V3]) : null
    const diag = bb ? Math.hypot(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1], bb[1][2] - bb[0][2]) : 50
    return dimensionsOf(this.tree, this.scope, geoms, Math.max(3, 0.06 * diag))
  }

  /** Sizes of one or two clicked faces / edges of the latest body, and how they relate. */
  measure(targets: MeasureTarget[]): MeasureResult | null {
    const step = this.lastBuilt(this.steps.length)
    if (!step?.body || !targets.length) return null
    return measure(step.body, step.origins, targets.slice(0, 2))
  }

  exportBody(format: "step" | "stl", index?: number): Blob | null {
    const step = this.lastBuilt(index === undefined ? this.steps.length : index + 1)
    if (!step?.body) return null
    return format === "step" ? step.body.blobSTEP() : (step.body.blobSTL({ binary: true }) as Blob)
  }

  dispose() {
    this.disposeFrom(0)
  }

  // ---------------------------------------------------------------- internals

  /** Last step before `i` that produced a body (ok state). */
  private lastBuilt(i: number): Step | null {
    for (let k = Math.min(i, this.steps.length) - 1; k >= 0; k--) if (this.steps[k].result.state === "ok") return this.steps[k]
    return null
  }

  private disposeFrom(i: number) {
    for (const s of this.steps.slice(i)) {
      if (s.ownsBody) s.body?.delete()
      s.tools?.forEach((t) => t.tool.delete())
    }
    this.steps.length = Math.min(this.steps.length, i)
  }

  private base(f: Feature, key: string, prev: Step | null, tree: Tree, result: Partial<FeatureResult>): Step {
    return {
      key,
      feature: f,
      result: { id: f.id, op: f.op, name: displayName(tree, f), state: "ok", ms: 0, ...result },
      body: prev?.body ?? null,
      ownsBody: false,
      origins: prev?.origins ?? [],
      status: (prev?.origins ?? []).map(() => "kept"),
      sigs: prev?.sigs ?? [],
      mesh: prev?.mesh ?? null,
      edges: prev?.edges ?? null,
    }
  }

  private skip(f: Feature, key: string, prev: Step | null, tree: Tree): Step {
    return this.base(f, key, prev, tree, { state: "skipped", message: "前面的特征失败了，这一步没有重建" })
  }

  private run(f: Feature, key: string, prev: Step | null, tree: Tree): Step {
    const t0 = performance.now()
    const step = this.base(f, key, prev, tree, {})
    const warnings: string[] = []
    try {
      const dup = tree.features.findIndex((x) => x.id === f.id)
      if (tree.features[dup] !== f) throw new InputError(`特征 id「${f.id}」重复了`)
      const out = this.apply(f, prev, warnings)
      Object.assign(step.result, { summary: out.summary, selected: out.selected })
      if (out.sketch) step.sketch = out.sketch
      if (out.tools) step.tools = out.tools
      if (out.threads) step.threads = out.threads
      if (out.geom) step.geom = out.geom
      if (out.body) this.commitBody(step, prev, out.body, f.id)
    } catch (e) {
      const ex = explain(f.op, describeError(e))
      Object.assign(step.result, { state: "error", message: ex.message, hint: ex.hint })
    }
    if (warnings.length) step.result.warnings = warnings
    step.result.ms = performance.now() - t0
    return step
  }

  /** Mesh the new body, classify its faces against the previous one, carry provenance forward. */
  private commitBody(step: Step, prev: Step | null, body: Shape3D, id: string) {
    const mesh = meshShape(body)
    const faces = facesOf(body)
    const sigs = faceSignatures(faces, mesh)
    const prevFaces = prev?.body ? facesOf(prev.body) : null
    const cls = classifyFaces(prevFaces, prev?.sigs ?? null, sigs)
    prevFaces?.forEach((pf) => pf.delete())
    faces.forEach((x) => x.delete())
    step.body = body
    step.ownsBody = true
    step.mesh = mesh
    step.edges = meshEdges(body)
    step.sigs = sigs
    step.status = cls.map((c) => c.status)
    step.origins = cls.map((c) => (c.match >= 0 && prev ? prev.origins[c.match] : id))
    step.result.faces = {
      new: step.status.filter((s) => s === "new").length,
      modified: step.status.filter((s) => s === "modified").length,
    }
  }

  private plane(ref: PlaneRef, prev: Step | null): ResolvedPlane {
    const P = PLANES[ref.plane]
    let coord = ref.offset !== undefined ? num(ref.offset, this.scope) : 0
    let label = ref.offset !== undefined && coord !== 0 ? `${P.label}偏移 ${fmt(coord)}` : P.label
    let flipped = false
    if (ref.face) {
      if (!prev?.body) throw new InputError("还没有实体，草图不能贴在面上")
      const faces = faceInfos(prev.body, prev.origins)
      try {
        const sel = selectFaces(ref.face, faces, this.scope)
        if (sel.some((x) => x.kind !== "plane" || !x.normal)) throw new InputError("选中的面不是平面，草图贴不上去")
        // An inclined face: the sketch lies on it, centred on it, x level, y up the slope.
        if (sel.some((x) => Math.abs(dot(x.normal!, P.normal)) < 0.9999)) {
          if (sel.length > 1) throw new InputError("斜面只能选一个：加 near 或 expect: 1")
          if (ref.tilt) throw new InputError("贴在斜面上时不用 tilt")
          const f = sel[0]
          const normal = unit(f.normal!)
          const x = Math.abs(normal[2]) < 0.999 ? unit(cross([0, 0, 1], normal)) : ([1, 0, 0] as V3)
          return { name: ref.plane, origin: add(f.center, mul(normal, coord)), x, y: cross(normal, x), normal, label: `斜面（${describeFace(f).split(" 来自")[0]}）`, custom: true }
        }
        const coords = new Set(sel.map((x) => r2(x.center[P.axis])))
        if (coords.size > 1) throw new InputError("选中的面不在同一高度，加 near 或 expect 只选一个")
        coord += sel[0].center[P.axis]
        flipped = dot(sel[0].normal!, P.normal) < 0
        label = `面（${describeFace(sel[0]).split(" 来自")[0]}）`
      } finally {
        disposeInfos(faces)
      }
    }
    // A datum plane flush with the body's far side (the back, the bottom…) is seen from outside that side too.
    if (!ref.face && !ref.tilt && prev?.body) {
      const [lo, hi] = (prev.body.boundingBox.bounds as [V3, V3]).map((b) => b[P.axis])
      const outward = Math.abs(coord - hi) < 1e-3 ? 1 : Math.abs(coord - lo) < 1e-3 ? -1 : 0
      flipped = outward !== 0 && outward !== Math.sign(P.normal[P.axis])
    }
    const origin: V3 = [0, 0, 0]
    origin[P.axis] = coord
    if (ref.tilt) {
      const k = AXIS[ref.tilt.axis]
      const a = num(ref.tilt.angle, this.scope)
      const turn = (v: V3) => rotate(v, k, a)
      return { name: ref.plane, origin: turn(origin), x: turn(P.x), y: turn(P.y), normal: turn(P.normal), label: `${label} · 绕 ${ref.tilt.axis} 转 ${fmt(a)}°`, custom: true }
    }
    return { name: ref.plane, origin, x: P.x, y: P.y, normal: P.normal, label, flipped }
  }

  private sketchOf(id: string): NonNullable<Step["sketch"]> {
    const s = this.steps.find((x) => x.feature.id === id)
    if (!s) throw new InputError(`找不到草图「${id}」（必须在这个特征之前）`)
    if (s.result.state === "suppressed") throw new InputError(`草图「${id}」被压缩了`)
    if (s.feature.op !== "sketch" || !s.sketch) throw new InputError(`「${id}」不是草图`)
    return s.sketch
  }

  private toolsOf(id: string): Tool[] {
    const s = this.steps.find((x) => x.feature.id === id)
    if (!s) throw new InputError(`找不到特征「${id}」（必须在这个特征之前）`)
    if (s.result.state === "suppressed") throw new InputError(`「${id}」被压缩了，不能阵列或镜像`)
    if (!s.tools?.length) throw new InputError(`「${id}」不是加料、切除或孔特征，不能阵列或镜像`)
    return s.tools
  }

  private bigLength(body: Shape3D | null) {
    if (!body) return 1000
    const [a, b] = body.boundingBox.bounds as [V3, V3]
    return 2 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) + 10
  }

  private apply(
    f: Feature,
    prev: Step | null,
    warnings: string[],
  ): { body?: Shape3D; summary: string; selected?: number; sketch?: Step["sketch"]; tools?: Tool[]; threads?: Thread[]; geom?: StepGeom } {
    const n = (v: number | string) => num(v, this.scope)
    const int = (v: number | string, min: number, what: string) => count(n(v), min, what)
    const body = prev?.body ?? null
    switch (f.op) {
      case "sketch": {
        const plane = this.plane(f.on, prev)
        const drawing = sketchDrawing(f.shapes, this.scope, plane.flipped)
        const sk = sketchOn(drawing.clone(), plane)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const faceShape: any = (sk as any).faces()
        const lines = meshEdges(faceShape).lines
        faceShape.delete?.()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(sk as any).delete?.()
        return { sketch: { drawing, plane, lines }, geom: { op: "sketch", plane: frameOf(plane) }, summary: `${plane.label} · ${f.shapes.map(shapeName).join("、")}` }
      }
      case "extrude": {
        const { drawing, plane } = this.sketchOf(f.sketch)
        const mode = f.mode ?? "add"
        let d = n(f.distance)
        let origin = plane.origin
        let dir = plane.normal
        if (f.through) {
          if (mode !== "cut") throw new InputError("「贯穿」只用于切除")
          d = 2 * this.bigLength(body)
          origin = add(origin, mul(plane.normal, -d / 2))
        } else {
          if (!(d > 0)) throw new InputError("拉伸距离必须大于 0")
          if (f.direction === "both") origin = add(origin, mul(plane.normal, -d / 2))
          if (f.direction === "reverse") dir = mul(plane.normal, -1)
        }
        const tool = mergeOverlaps(sketchOn(drawing.clone(), plane, origin).extrude(d, { extrusionDirection: dir }) as Shape3D)
        const next = applyTool(body, tool, mode, warnings)
        const how = f.through ? "贯穿" : `${f.direction === "both" ? "两侧对称 " : f.direction === "reverse" ? "反向 " : ""}${fmt(d)} mm`
        const box = drawing.boundingBox.bounds as [[number, number], [number, number]]
        return {
          body: next,
          tools: [{ tool, mode }],
          geom: { op: "extrude", plane: frameOf(plane), start: origin, dir, box: [box[0], box[1]] },
          summary: `${mode === "cut" ? "切除" : "加料"} ${how}`,
        }
      }
      case "revolve": {
        const { drawing, plane } = this.sketchOf(f.sketch)
        const P = PLANES[plane.name]
        const axis = AXIS[f.axis]
        const angle = f.angle !== undefined ? n(f.angle) : 360
        if (!(angle > 0 && angle <= 360)) throw new InputError("旋转角度要在 0–360° 之间")
        // The profile may touch the axis but not cross it.
        if (!plane.custom && plane.origin[P.axis] === 0) {
          const bb = drawing.boundingBox.bounds
          const across = (lo: number, hi: number) => lo < -1e-6 && hi > 1e-6
          if ((dot(axis, P.y) > 0.999 && across(bb[0][0], bb[1][0])) || (dot(axis, P.x) > 0.999 && across(bb[0][1], bb[1][1])))
            throw new InputError("轮廓跨过了旋转轴：旋转体只画轴一侧的半截面")
        }
        const mode = f.mode ?? "add"
        const tool = mergeOverlaps(sketchOn(drawing.clone(), plane).revolve(axis, { origin: [0, 0, 0], angle }) as Shape3D)
        const next = applyTool(body, tool, mode, warnings)
        return { body: next, tools: [{ tool, mode }], geom: { op: "revolve", plane: frameOf(plane) }, summary: `${mode === "cut" ? "旋转切除" : "旋转"} ${fmt(angle)}° · 绕 ${f.axis} 轴` }
      }
      case "fillet":
      case "chamfer": {
        if (!body) throw new InputError("还没有实体")
        const size = n(f.op === "fillet" ? f.r : f.d)
        if (!(size > 0)) throw new InputError(`${f.op === "fillet" ? "半径" : "距离"}必须大于 0`)
        const faces = faceInfos(body, prev!.origins)
        const edges = edgeInfos(body, faces)
        try {
          const sel = selectEdges(f.edges, edges, faces, this.scope)
          const list = sel.map((e) => e.edge)
          const next = f.op === "fillet" ? body.fillet(size, (e) => e.inList(list)) : body.chamfer(size, (e) => e.inList(list))
          const first = sel[0]
          const geom: StepGeom = { op: "edges", at: first.mid, out: outward(first, faces), count: sel.length }
          return { body: next, selected: sel.length, geom, summary: `${f.op === "fillet" ? "R" : "C"}${fmt(size)} · ${sel.length} 条边` }
        } finally {
          disposeInfos(faces, edges)
        }
      }
      case "shell": {
        if (!body) throw new InputError("还没有实体")
        const t = n(f.t)
        if (!(t > 0)) throw new InputError("壁厚必须大于 0")
        const faces = faceInfos(body, prev!.origins)
        try {
          const sel = selectFaces(f.open, faces, this.scope)
          const list = sel.map((x) => x.face)
          const next = body.shell(t, (ff) => ff.inList(list))
          const before = measureShapeVolumeProperties(body).volume
          const after = measureShapeVolumeProperties(next).volume
          if (after > before * 0.98) throw new InputError("抽壳后体积几乎没变：内核没有真正抽空，试试更小的壁厚")
          return { body: next, selected: sel.length, geom: shellGeom(sel[0]), summary: `壁厚 ${fmt(t)} · 开口 ${sel.length} 个面` }
        } finally {
          disposeInfos(faces)
        }
      }
      case "hole": {
        if (!body) throw new InputError("还没有实体，不能打孔")
        const plane = this.plane(f.on, prev)
        let std: ReturnType<typeof standardHole> | null = null
        try {
          std = f.standard ? standardHole(f.standard) : null
        } catch (e) {
          throw new InputError((e as Error).message)
        }
        if (!std && f.d === undefined) throw new InputError("孔要么给 d（孔径），要么给 standard（标准孔）")
        const d = std ? std.d : n(f.d!)
        if (!(d > 0)) throw new InputError("孔径必须大于 0")
        const depth = f.depth !== undefined ? n(f.depth) : this.bigLength(body)
        const drill = f.reverse ? plane.normal : mul(plane.normal, -1)
        const cbore = f.cbore ? { r: n(f.cbore.d) / 2, depth: n(f.cbore.depth) } : std?.cbore && { r: std.cbore.d / 2, depth: std.cbore.depth }
        const csink = f.csink ? { r: n(f.csink.d) / 2, angle: f.csink.angle !== undefined ? n(f.csink.angle) : 90 } : std?.csink && { r: std.csink.d / 2, angle: 90 }
        const template = () => holeTool(d / 2, depth, cbore, csink)
        const centers = f.at.map(([u, v]) => add(plane.origin, add(mul(plane.x, n(u)), mul(plane.y, n(v)))))
        const parts = centers.map((c) => orient(template(), drill, c))
        const tool = parts.length === 1 ? parts[0] : (makeCompound(parts) as unknown as Shape3D)
        const next = applyTool(body, tool, "cut", warnings)
        const kind = std ? std.label : `${cbore ? "沉头孔" : csink ? "埋头孔" : "孔"} ⌀${fmt(d)}`
        return {
          body: next,
          tools: [{ tool, mode: "cut" }],
          summary: `${kind} × ${f.at.length} · ${f.depth !== undefined ? `深 ${fmt(depth)}` : "贯穿"}`,
          threads: std?.thread ? [{ r: d / 2, major: std.thread.major }] : undefined,
          geom: { op: "hole", plane: frameOf(plane), centers, r: d / 2 },
        }
      }
      case "linear_pattern":
      case "circular_pattern": {
        if (!body) throw new InputError("还没有实体")
        const sources = f.features.flatMap((id) => this.toolsOf(id))
        const moves: ((s: Shape3D) => Shape3D)[] = []
        let summary: string
        if (f.op === "linear_pattern") {
          const v = mul(DIRS[f.dir], n(f.spacing))
          const v2 = f.dir2 && f.count2 !== undefined && f.spacing2 !== undefined ? mul(DIRS[f.dir2], n(f.spacing2)) : null
          const c1 = int(f.count, 2, "个数")
          const c2 = v2 ? int(f.count2!, 2, "第二方向的个数") : 1
          for (let i = 0; i < c1; i++)
            for (let j = 0; j < c2; j++) {
              if (i === 0 && j === 0) continue
              const t = add(mul(v, i), v2 ? mul(v2, j) : [0, 0, 0])
              moves.push((s) => s.translate(t))
            }
          summary = `×${c1}${v2 ? ` × ${c2}` : ""} · 间距 ${fmt(n(f.spacing))}`
        } else {
          const total = f.angle !== undefined ? n(f.angle) : 360
          const c = int(f.count, 2, "个数")
          const stepA = total >= 360 - 1e-9 ? 360 / c : total / (c - 1)
          for (let i = 1; i < c; i++) moves.push((s) => s.rotate(stepA * i, [0, 0, 0], AXIS[f.axis]))
          summary = `×${c} · ${fmt(total)}° · 绕 ${f.axis} 轴`
        }
        return { ...this.copyTools(body, sources, moves, summary, warnings), geom: { op: "pattern", seed: centerOf(sources) } as StepGeom }
      }
      case "sweep": {
        const plane = this.plane(f.path.on, prev)
        const pts = f.path.points.map((p) => (Array.isArray(p) ? { to: [n(p[0]), n(p[1])] as [number, number] } : { to: [n(p.to[0]), n(p.to[1])] as [number, number], via: [n(p.via[0]), n(p.via[1])] as [number, number] }))
        const corner = f.path.corner !== undefined ? n(f.path.corner) : 0
        let pen = draw(pts[0].to)
        pts.slice(1).forEach((p, i) => {
          pen = p.via ? pen.threePointsArcTo(p.to, p.via) : pen.lineTo(p.to)
          if (corner > 0 && i < pts.length - 2 && !pts[i + 2].via && !p.via) pen = pen.customCorner(corner)
        })
        const path = sketchOn(pen.done(), plane)
        const prof = f.profile
        const tool = (path as unknown as { sweepSketch: (fn: unknown) => Shape3D }).sweepSketch((pl: unknown, origin: unknown) =>
          prof.type === "circle" ? sketchCircle(n(prof.d) / 2, { plane: pl as never, origin: origin as never }) : sketchRectangle(n(prof.w), n(prof.h), { plane: pl as never, origin: origin as never }),
        )
        const mode = f.mode ?? "add"
        const next = applyTool(body, tool, mode, warnings)
        const shape = prof.type === "circle" ? `⌀${fmt(n(prof.d))}` : `${fmt(n(prof.w))}×${fmt(n(prof.h))}`
        return { body: next, tools: [{ tool, mode }], summary: `${mode === "cut" ? "扫掠切除" : "扫掠"} · 截面 ${shape} · 路径 ${pts.length} 点` }
      }
      case "loft": {
        const sketches = f.sketches.map((id) => {
          const { drawing, plane } = this.sketchOf(id)
          const sk = sketchOn(drawing.clone(), plane)
          if (!("wire" in sk)) throw new InputError(`放样的草图「${id}」有多个轮廓：每个截面只能是一个闭合轮廓`)
          return sk
        })
        const [first, ...rest] = sketches
        const tool = (first as unknown as { loftWith: (o: unknown[], c: unknown) => Shape3D }).loftWith(rest, { ruled: f.ruled ?? false })
        const mode = f.mode ?? "add"
        const next = applyTool(body, tool, mode, warnings)
        return { body: next, tools: [{ tool, mode }], summary: `${mode === "cut" ? "放样切除" : "放样"} · ${f.sketches.length} 个截面${f.ruled ? " · 直纹" : ""}` }
      }
      case "draft": {
        if (!body) throw new InputError("还没有实体")
        const angle = n(f.angle)
        if (!(Math.abs(angle) > 0 && Math.abs(angle) < 45)) throw new InputError("拔模角要在 0–45° 之间（常用 1–3°）")
        const faces = faceInfos(body, prev!.origins)
        try {
          const sel = selectFaces(f.faces, faces, this.scope)
          const list = sel.map((x) => x.face)
          const origin: V3 = [0, 0, 0]
          origin[PLANES[f.neutral.plane].axis] = f.neutral.offset !== undefined ? n(f.neutral.offset) : 0
          const next = body.draft(angle, (ff) => ff.inList(list), makePlane(f.neutral.plane, origin))
          const geom: StepGeom = { op: "faces", at: sel[0].center, out: sel[0].normal ?? [0, 0, 1] }
          return { body: next, selected: sel.length, geom, summary: `${fmt(angle)}° · ${sel.length} 个面 · 中性面 ${PLANES[f.neutral.plane].label}` }
        } finally {
          disposeInfos(faces)
        }
      }
      case "mirror": {
        if (!body) throw new InputError("还没有实体")
        const off = f.offset !== undefined ? n(f.offset) : 0
        const origin: V3 = [0, 0, 0]
        origin[PLANES[f.plane].axis] = off
        const label = `关于${PLANES[f.plane].label}${off ? `偏移 ${fmt(off)}` : ""}`
        if (!f.features?.length) {
          const mirrored = body.clone().mirror(f.plane, origin)
          const next = body.fuse(mirrored)
          mirrored.delete()
          return { body: next, summary: `镜像整个实体 · ${label}` }
        }
        const sources = f.features.flatMap((id) => this.toolsOf(id))
        return this.copyTools(body, sources, [(s) => s.mirror(f.plane, origin)], `镜像 ${f.features.length} 个特征 · ${label}`, warnings)
      }
    }
  }

  private copyTools(body: Shape3D, sources: Tool[], moves: ((s: Shape3D) => Shape3D)[], summary: string, warnings: string[]) {
    let cur = body
    const tools: Tool[] = []
    for (const { tool, mode } of sources) {
      const copies = moves.map((m) => m(tool.clone()))
      const comp = makeCompound(copies) as unknown as Shape3D
      const next = applyTool(cur, comp, mode, warnings)
      if (cur !== body) cur.delete()
      cur = next
      tools.push({ tool: comp, mode })
    }
    return { body: cur, tools, summary }
  }
}

const frameOf = (p: ResolvedPlane): Frame => ({ origin: p.origin, x: p.x, y: p.y, normal: p.normal })

/** Away from the part at an edge: the mean of its two faces' normals there. */
function outward(e: EdgeInfo, faces: FaceInfo[]): V3 {
  let sum: V3 = [0, 0, 0]
  for (const i of e.faces) {
    const n = faces[i].face.normalAt(e.mid)
    sum = add(sum, [n.x, n.y, n.z])
    n.delete?.()
  }
  return unit(Math.hypot(...sum) > 1e-9 ? sum : [0, 0, 1])
}

/** The wall thickness at the opening: from the middle of its longest edge, inwards. */
function shellGeom(open: FaceInfo): StepGeom | undefined {
  const edges = edgesOf(open.face)
  try {
    const longest = edges.reduce((a, b) => (b.length > a.length ? b : a))
    const p = longest.pointAt(0.5)
    const mid: V3 = [p.x, p.y, p.z]
    p.delete?.()
    const n = open.normal ?? [0, 0, 1]
    const toward = sub(open.center, mid)
    const inward = unit(sub(toward, mul(n, dot(toward, n))))
    return { op: "shell", at: mid, inward, out: n }
  } catch {
    return undefined
  } finally {
    edges.forEach((e) => e.delete())
  }
}

/** Middle of the first tool a pattern copies. */
function centerOf(tools: Tool[]): V3 | null {
  if (!tools.length) return null
  const [a, b] = tools[0].tool.boundingBox.bounds as [V3, V3]
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

function applyTool(body: Shape3D | null, tool: Shape3D, mode: "add" | "cut", warnings: string[]): Shape3D {
  if (mode === "cut") {
    if (!body) throw new InputError("还没有实体，不能切除")
    const before = measureShapeVolumeProperties(body).volume
    const next = body.cut(tool)
    const after = measureShapeVolumeProperties(next).volume
    if (Math.abs(before - after) < 1e-6 * Math.max(1, before)) warnings.push("切除没有碰到实体，模型没有变化")
    return next
  }
  // Booleans already unify same-domain faces; the first solid needs it too,
  // or an extruded circle keeps two half-cylinders and two half-arcs per rim.
  const next = body ? body.fuse(tool) : unified(tool)
  if (body) {
    const before = measureShapeVolumeProperties(body).volume
    const after = measureShapeVolumeProperties(next).volume
    if (Math.abs(after - before) < 1e-6 * Math.max(1, before)) warnings.push("加的料完全在原实体里面，模型没有变化")
  }
  const solids = countOf(next, "solid")
  if (solids > 1) warnings.push(`现在是 ${solids} 个不相连的实体：新加的料没有和原来的实体接上`)
  return next
}

/** Counts may be expressions; they must land on a whole number. */
function count(v: number, min: number, what: string): number {
  const r = Math.round(v)
  if (Math.abs(v - r) > 1e-6 || r < min) throw new InputError(`${what}要是不小于 ${min} 的整数，现在是 ${fmt(v)}`)
  return r
}

function unified(tool: Shape3D): Shape3D {
  const copy = tool.clone()
  const out = copy.simplify()
  copy.delete()
  return out
}

function stats(body: Shape3D): BodyStats {
  const [a, b] = body.boundingBox.bounds as [V3, V3]
  const props = measureShapeVolumeProperties(body)
  const c = props.centerOfMass as unknown as V3
  const out: BodyStats = {
    bbox: [[r2(a[0]), r2(a[1]), r2(a[2])], [r2(b[0]), r2(b[1]), r2(b[2])]],
    size: [r2(b[0] - a[0]), r2(b[1] - a[1]), r2(b[2] - a[2])],
    volume: r2(props.volume),
    centerOfMass: [r2(c[0]), r2(c[1]), r2(c[2])],
    faces: countOf(body, "face"),
    edges: countOf(body, "edge"),
    solids: countOf(body, "solid"),
  }
  props.delete?.()
  return out
}

function shapeName(s: SketchShape) {
  const tag = s.cut ? "（挖）" : ""
  switch (s.type) {
    case "rect":
      return `矩形 ${s.w}×${s.h}${tag}`
    case "circle":
      return `圆 ⌀${s.d}${tag}`
    case "polygon":
      return `正${s.sides}边形${tag}`
    case "slot":
      return `长圆孔 ${s.length}×${s.width}${tag}`
    case "polyline":
      return `轮廓 ${s.points.length} 点${tag}`
    case "text":
      return `文字「${s.text.replace(/\n/g, " ")}」${tag}`
  }
}

/** `mirrorText`: the sketch is seen from behind its datum plane, so text is mirrored to read right from outside. */
function sketchDrawing(shapes: SketchShape[], scope: Scope, mirrorText = false): Drawing {
  const n = (v: number | string) => num(v, scope)
  let parts: Drawing[] = []
  for (const s of shapes) {
    const c = s.type !== "polyline" && s.center ? [n(s.center[0]), n(s.center[1])] : [0, 0]
    let d: Drawing
    switch (s.type) {
      case "rect": {
        const w = n(s.w)
        const h = n(s.h)
        const r = s.r !== undefined ? n(s.r) : 0
        if (!(w > 0 && h > 0)) throw new InputError("矩形的宽和高必须大于 0")
        if (r < 0 || r >= Math.min(w, h) / 2) throw new InputError("矩形圆角半径要小于短边的一半")
        d = drawRoundedRectangle(w, h, r).translate(c[0], c[1])
        break
      }
      case "circle": {
        const dd = n(s.d)
        if (!(dd > 0)) throw new InputError("圆的直径必须大于 0")
        d = drawCircle(dd / 2).translate(c[0], c[1])
        break
      }
      case "polygon": {
        const dd = n(s.d)
        if (!(dd > 0)) throw new InputError("多边形的外接圆直径必须大于 0")
        d = drawPolysides(dd / 2, count(n(s.sides), 3, "边数"))
        if (s.rotate !== undefined) d = d.rotate(n(s.rotate), [0, 0])
        d = d.translate(c[0], c[1])
        break
      }
      case "slot": {
        const L = n(s.length)
        const W = n(s.width)
        if (!(W > 0 && L > W)) throw new InputError("长圆孔的总长必须大于宽")
        const a = (L - W) / 2
        d = draw([-a, -W / 2])
          .lineTo([a, -W / 2])
          .threePointsArcTo([a, W / 2], [a + W / 2, 0])
          .lineTo([-a, W / 2])
          .threePointsArcTo([-a, -W / 2], [-a - W / 2, 0])
          .close()
        if (s.angle !== undefined) d = d.rotate(n(s.angle), [0, 0])
        d = d.translate(c[0], c[1])
        break
      }
      case "text": {
        const size = n(s.size)
        if (!(size > 0)) throw new InputError("字号必须大于 0")
        d = textDrawing(normalizeText(s.text), size)
        if (s.angle !== undefined) d = d.rotate(n(s.angle), [0, 0])
        if (mirrorText) d = d.mirror([0, 1], [0, 0], "plane")
        d = d.translate(c[0], c[1])
        break
      }
      case "polyline": {
        const pts = s.points.map((p) => (Array.isArray(p) ? { to: [n(p[0]), n(p[1])] as [number, number] } : { to: [n(p.to[0]), n(p.to[1])] as [number, number], via: [n(p.via[0]), n(p.via[1])] as [number, number] }))
        const first = pts[0].to
        const last = pts[pts.length - 1]
        if (!last.via && Math.hypot(last.to[0] - first[0], last.to[1] - first[1]) < 1e-9) pts.pop()
        if (pts.length < 3 && !pts.some((p) => p.via)) throw new InputError("轮廓至少要 3 个点才能围成面")
        let pen = draw(first)
        for (const p of pts.slice(1)) pen = p.via ? pen.threePointsArcTo(p.to, p.via) : pen.lineTo(p.to)
        d = pen.close()
        break
      }
    }
    // 2D booleans only between shapes that overlap: separate shapes (a circle beside a
    // text) stay separate regions. replicad's 2D boolean can fail on glyph outlines.
    const hit = parts.filter((p) => overlaps(p.boundingBox.bounds, d.boundingBox.bounds))
    if (s.cut) {
      if (!parts.length) throw new InputError("「挖掉」的图形前面要先有图形")
      for (const p of hit) parts[parts.indexOf(p)] = p.cut(d)
    } else {
      const merged = hit.reduce((acc, p) => acc.fuse(p), d)
      parts = [...parts.filter((p) => !hit.includes(p)), merged]
    }
  }
  if (parts.length === 1) return parts[0]
  // Drawing keeps its shape private; disjoint regions are just listed together.
  const inner = (x: Drawing) => (x as unknown as { innerShape: Blueprint | Blueprints | CompoundBlueprint | null }).innerShape
  return new Drawing(new Blueprints(parts.flatMap((p) => { const i = inner(p); return !i ? [] : i instanceof Blueprints ? i.blueprints : [i] })))
}

const overlaps = (a: [number[], number[]], b: [number[], number[]]) => a[0][0] <= b[1][0] && b[0][0] <= a[1][0] && a[0][1] <= b[1][1] && b[0][1] <= a[1][1]

/**
 * A sketch may hold regions that overlap (a text's strokes): its extrusion is
 * then several solids crossing each other, which a boolean can't take as a
 * tool. Fuse them; separate ones come out as separate solids of the compound.
 */
export function mergeOverlaps(shape: Shape3D): Shape3D {
  const solids = solidsOf(shape)
  const boxes = solids.map((s) => s.boundingBox.bounds as [V3, V3])
  const meet = (a: [V3, V3], b: [V3, V3]) => [0, 1, 2].every((k) => a[0][k] <= b[1][k] + 1e-9 && b[0][k] <= a[1][k] + 1e-9)
  const crossing = boxes.some((a, i) => boxes.some((b, j) => j > i && meet(a, b)))
  if (!crossing) {
    solids.forEach((s) => s.delete())
    return shape
  }
  // One fuse with every other solid as a tool: five hanzi take 0.27 s instead of
  // 1.4 s fused pair by pair, and the wasm heap grows a quarter as much. No
  // same-domain clean-up: on these polyline walls it loses whole strokes (偶 kept
  // a quarter of its area). The body's own boolean cleans up afterwards.
  const oc = getOC() as unknown as OCFuse
  const args = new oc.NCollection_List_TopoDS_Shape()
  const tools = new oc.NCollection_List_TopoDS_Shape()
  const progress = new oc.Message_ProgressRange()
  const fuse = new oc.BRepAlgoAPI_Fuse()
  try {
    args.Append(solids[0].wrapped)
    for (const s of solids.slice(1)) tools.Append(s.wrapped)
    fuse.SetArguments(args)
    fuse.SetTools(tools)
    fuse.Build(progress)
    if (!fuse.IsDone()) throw new Error("重叠的笔画没能合并")
    return cast(fuse.Shape() as never) as Shape3D
  } finally {
    for (const x of [fuse, progress, args, tools, ...solids, shape]) x.delete()
  }
}

type OCList = { Append(s: unknown): unknown; delete(): void }
type OCFuse = {
  NCollection_List_TopoDS_Shape: new () => OCList
  Message_ProgressRange: new () => { delete(): void }
  BRepAlgoAPI_Fuse: new () => { SetArguments(l: OCList): void; SetTools(l: OCList): void; Build(p: unknown): void; IsDone(): boolean; Shape(): unknown; delete(): void }
}

/** A hole as a revolved half-section pointing down -Z from the origin. */
function holeTool(r: number, depth: number, cbore?: { r: number; depth: number }, csink?: { r: number; angle: number }): Shape3D {
  if (!(depth > 0)) throw new InputError("孔深必须大于 0")
  const pts: [number, number][] = [[0, 0]]
  if (cbore) {
    if (!(cbore.r > r && cbore.depth > 0 && cbore.depth < depth)) throw new InputError("沉孔直径要大于孔径，沉孔深度要小于孔深")
    pts.push([cbore.r, 0], [cbore.r, -cbore.depth], [r, -cbore.depth])
  } else if (csink) {
    if (!(csink.r > r)) throw new InputError("埋头孔直径要大于孔径")
    const h = (csink.r - r) / Math.tan(((csink.angle / 2) * Math.PI) / 180)
    if (!(h < depth)) throw new InputError("埋头锥比孔还深")
    pts.push([csink.r, 0], [r, -h])
  } else pts.push([r, 0])
  pts.push([r, -depth], [0, -depth])
  let pen = draw(pts[0])
  for (const p of pts.slice(1)) pen = pen.lineTo(p)
  return pen.close().sketchOnPlane("XZ").revolve([0, 0, 1], { origin: [0, 0, 0] }) as Shape3D
}

/** Turn a tool built along -Z at the origin to point along `dir`, then move it to `at`. */
function orient(shape: Shape3D, dir: V3, at: V3): Shape3D {
  const from: V3 = [0, 0, -1]
  const c = cross(from, dir)
  const s = Math.hypot(...c)
  const cosA = dot(from, dir)
  let out = shape
  if (s < 1e-9) {
    if (cosA < 0) out = out.rotate(180, [0, 0, 0], [1, 0, 0])
  } else out = out.rotate((Math.atan2(s, cosA) * 180) / Math.PI, [0, 0, 0], mul(c, 1 / s))
  return out.translate(at)
}
