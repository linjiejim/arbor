// The feature-tree interpreter. Rebuilds a Tree feature by feature with
// replicad (OpenCascade), caches every step by tree prefix so an edit only
// recomputes what follows it, and records for every face which feature first
// made it (face provenance) and whether this step made it new / modified it.
//
// Runs unchanged in a Web Worker (the studio) and in Node (evals, tests).
import {
  draw,
  drawCircle,
  drawPolysides,
  drawRoundedRectangle,
  makeCompound,
  makePlane,
  measureShapeVolumeProperties,
  sketchCircle,
  sketchRectangle,
  type Drawing,
  type Shape3D,
} from "replicad"
import { displayName, type Feature, type FeatureOp, type PlaneRef, type SketchShape, type Tree } from "../dsl"
import { num, resolveParams, type Scope } from "../expr"
import { describeError, explain, InputError } from "./errors"
import { classifyFaces, faceSignatures, meshEdges, meshShape, type EdgeMesh, type FaceSig, type FaceStatus, type Mesh } from "./mesh"
import { DIRS, describeEdge, describeFace, disposeInfos, edgeInfos, faceInfos, selectEdges, selectFaces } from "./select"

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
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const r2 = (x: number) => Math.round(x * 100) / 100
const fmt = (x: number) => String(r2(x))

type ResolvedPlane = { name: PlaneName; origin: V3; label: string }

export type FeatureResult = {
  id: string
  op: FeatureOp
  name: string
  state: "ok" | "error" | "skipped"
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
  ms: number
}

export type DisplayData = {
  index: number
  mesh: { vertices: Float32Array; normals: Float32Array; triangles: Uint32Array } | null
  /** One per B-rep face, in mesh order. */
  groups: { start: number; count: number; status: FaceStatus; origin: string }[]
  edges: Float32Array | null
  /** Outline of the sketch, when the shown step is a sketch. */
  sketch: Float32Array | null
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
}

export class Kernel {
  private steps: Step[] = []
  private paramsKey = ""
  private scope: Scope = {}

  rebuild(tree: Tree): BuildReport {
    const t0 = performance.now()
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

    let key = paramsKey
    let failed = paramError !== undefined
    for (let i = 0; i < tree.features.length; i++) {
      const f = tree.features[i]
      key += "\n" + JSON.stringify(f)
      const cached = this.steps[i]
      if (cached && cached.key === key) {
        if (cached.result.state !== "ok") failed = true
        continue
      }
      this.disposeFrom(i)
      const prev = this.lastBuilt(i)
      const step = failed ? this.skip(f, key, prev, tree) : this.run(f, key, prev, tree)
      if (step.result.state !== "ok") failed = true
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
      ms: performance.now() - t0,
    }
  }

  /** Mesh + per-face status of one step (default: the last that built). */
  display(index?: number): DisplayData {
    const i = index ?? this.steps.findLastIndex((s) => s.result.state === "ok")
    const step = this.steps[i]
    const empty: DisplayData = { index: i, mesh: null, groups: [], edges: null, sketch: null, bbox: null }
    if (!step) return empty
    const body = step.result.state === "ok" ? step : this.lastBuilt(i)
    const out: DisplayData = { ...empty, sketch: step.sketch ? step.sketch.lines.slice() : null }
    if (body?.body && body.mesh) {
      const faces = body.body.faces
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
        }
      })
      out.edges = body.edges ? body.edges.lines.slice() : null
      const bb = body.body.boundingBox.bounds as [V3, V3]
      out.bbox = [[...bb[0]], [...bb[1]]] as [V3, V3]
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
    const faces = body.faces
    const sigs = faceSignatures(faces, mesh)
    const prevFaces = prev?.body ? prev.body.faces : null
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
    if (ref.face) {
      if (!prev?.body) throw new InputError("还没有实体，草图不能贴在面上")
      const faces = faceInfos(prev.body, prev.origins)
      try {
        const sel = selectFaces(ref.face, faces, this.scope)
        const coords = new Set(sel.map((x) => r2(x.center[P.axis])))
        if (sel.some((x) => x.kind !== "plane" || !x.normal || Math.abs(dot(x.normal, P.normal)) < 0.9999))
          throw new InputError(`选中的面不是与 ${ref.plane} 平行的平面，草图贴不上去`)
        if (coords.size > 1) throw new InputError("选中的面不在同一高度，加 near 或 expect 只选一个")
        coord += sel[0].center[P.axis]
        label = `面（${describeFace(sel[0]).split(" 来自")[0]}）`
      } finally {
        disposeInfos(faces)
      }
    }
    const origin: V3 = [0, 0, 0]
    origin[P.axis] = coord
    return { name: ref.plane, origin, label }
  }

  private sketchOf(id: string): NonNullable<Step["sketch"]> {
    const s = this.steps.find((x) => x.feature.id === id)
    if (!s) throw new InputError(`找不到草图「${id}」（必须在这个特征之前）`)
    if (s.feature.op !== "sketch" || !s.sketch) throw new InputError(`「${id}」不是草图`)
    return s.sketch
  }

  private toolsOf(id: string): Tool[] {
    const s = this.steps.find((x) => x.feature.id === id)
    if (!s) throw new InputError(`找不到特征「${id}」（必须在这个特征之前）`)
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
  ): { body?: Shape3D; summary: string; selected?: number; sketch?: Step["sketch"]; tools?: Tool[] } {
    const n = (v: number | string) => num(v, this.scope)
    const body = prev?.body ?? null
    switch (f.op) {
      case "sketch": {
        const plane = this.plane(f.on, prev)
        const drawing = sketchDrawing(f.shapes, this.scope)
        const sk = drawing.clone().sketchOnPlane(plane.name, plane.origin)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const faceShape: any = (sk as any).faces()
        const lines = meshEdges(faceShape).lines
        faceShape.delete?.()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(sk as any).delete?.()
        return { sketch: { drawing, plane, lines }, summary: `${plane.label} · ${f.shapes.map(shapeName).join("、")}` }
      }
      case "extrude": {
        const { drawing, plane } = this.sketchOf(f.sketch)
        const P = PLANES[plane.name]
        const mode = f.mode ?? "add"
        let d = n(f.distance)
        let origin = plane.origin
        let dir = P.normal
        if (f.through) {
          if (mode !== "cut") throw new InputError("「贯穿」只用于切除")
          d = 2 * this.bigLength(body)
          origin = add(origin, mul(P.normal, -d / 2))
        } else {
          if (!(d > 0)) throw new InputError("拉伸距离必须大于 0")
          if (f.direction === "both") origin = add(origin, mul(P.normal, -d / 2))
          if (f.direction === "reverse") dir = mul(P.normal, -1)
        }
        const tool = drawing.clone().sketchOnPlane(plane.name, origin).extrude(d, { extrusionDirection: dir }) as Shape3D
        const next = applyTool(body, tool, mode, warnings)
        const how = f.through ? "贯穿" : `${f.direction === "both" ? "两侧对称 " : f.direction === "reverse" ? "反向 " : ""}${fmt(d)} mm`
        return { body: next, tools: [{ tool, mode }], summary: `${mode === "cut" ? "切除" : "加料"} ${how}` }
      }
      case "revolve": {
        const { drawing, plane } = this.sketchOf(f.sketch)
        const P = PLANES[plane.name]
        const axis = AXIS[f.axis]
        const angle = f.angle !== undefined ? n(f.angle) : 360
        if (!(angle > 0 && angle <= 360)) throw new InputError("旋转角度要在 0–360° 之间")
        // The profile may touch the axis but not cross it.
        if (plane.origin[P.axis] === 0) {
          const bb = drawing.boundingBox.bounds
          const across = (lo: number, hi: number) => lo < -1e-6 && hi > 1e-6
          if ((dot(axis, P.y) > 0.999 && across(bb[0][0], bb[1][0])) || (dot(axis, P.x) > 0.999 && across(bb[0][1], bb[1][1])))
            throw new InputError("轮廓跨过了旋转轴：旋转体只画轴一侧的半截面")
        }
        const mode = f.mode ?? "add"
        const tool = drawing.clone().sketchOnPlane(plane.name, plane.origin).revolve(axis, { origin: [0, 0, 0], angle }) as Shape3D
        const next = applyTool(body, tool, mode, warnings)
        return { body: next, tools: [{ tool, mode }], summary: `${mode === "cut" ? "旋转切除" : "旋转"} ${fmt(angle)}° · 绕 ${f.axis} 轴` }
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
          return { body: next, selected: sel.length, summary: `${f.op === "fillet" ? "R" : "C"}${fmt(size)} · ${sel.length} 条边` }
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
          return { body: next, selected: sel.length, summary: `壁厚 ${fmt(t)} · 开口 ${sel.length} 个面` }
        } finally {
          disposeInfos(faces)
        }
      }
      case "hole": {
        if (!body) throw new InputError("还没有实体，不能打孔")
        const plane = this.plane(f.on, prev)
        const P = PLANES[plane.name]
        const d = n(f.d)
        if (!(d > 0)) throw new InputError("孔径必须大于 0")
        const depth = f.depth !== undefined ? n(f.depth) : this.bigLength(body)
        const drill = f.reverse ? P.normal : mul(P.normal, -1)
        const template = () => holeTool(d / 2, depth, f.cbore && { r: n(f.cbore.d) / 2, depth: n(f.cbore.depth) }, f.csink && { r: n(f.csink.d) / 2, angle: f.csink.angle !== undefined ? n(f.csink.angle) : 90 })
        const parts = f.at.map(([u, v]) => orient(template(), drill, add(plane.origin, add(mul(P.x, n(u)), mul(P.y, n(v))))))
        const tool = parts.length === 1 ? parts[0] : (makeCompound(parts) as unknown as Shape3D)
        const next = applyTool(body, tool, "cut", warnings)
        const kind = f.cbore ? "沉头孔" : f.csink ? "埋头孔" : "孔"
        return {
          body: next,
          tools: [{ tool, mode: "cut" }],
          summary: `${kind} ⌀${fmt(d)} × ${f.at.length} · ${f.depth !== undefined ? `深 ${fmt(depth)}` : "贯穿"}`,
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
          const v2 = f.dir2 && f.count2 && f.spacing2 !== undefined ? mul(DIRS[f.dir2], n(f.spacing2)) : null
          for (let i = 0; i < f.count; i++)
            for (let j = 0; j < (v2 ? f.count2! : 1); j++) {
              if (i === 0 && j === 0) continue
              const t = add(mul(v, i), v2 ? mul(v2, j) : [0, 0, 0])
              moves.push((s) => s.translate(t))
            }
          summary = `×${f.count}${v2 ? ` × ${f.count2}` : ""} · 间距 ${fmt(n(f.spacing))}`
        } else {
          const total = f.angle !== undefined ? n(f.angle) : 360
          const stepA = total >= 360 - 1e-9 ? 360 / f.count : total / (f.count - 1)
          for (let i = 1; i < f.count; i++) moves.push((s) => s.rotate(stepA * i, [0, 0, 0], AXIS[f.axis]))
          summary = `×${f.count} · ${fmt(total)}° · 绕 ${f.axis} 轴`
        }
        return this.copyTools(body, sources, moves, summary, warnings)
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
        const path = pen.done().sketchOnPlane(plane.name, plane.origin)
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
          const sk = drawing.clone().sketchOnPlane(plane.name, plane.origin)
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
          return { body: next, selected: sel.length, summary: `${fmt(angle)}° · ${sel.length} 个面 · 中性面 ${PLANES[f.neutral.plane].label}` }
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

function applyTool(body: Shape3D | null, tool: Shape3D, mode: "add" | "cut", warnings: string[]): Shape3D {
  if (mode === "cut") {
    if (!body) throw new InputError("还没有实体，不能切除")
    const before = measureShapeVolumeProperties(body).volume
    const next = body.cut(tool)
    const after = measureShapeVolumeProperties(next).volume
    if (Math.abs(before - after) < 1e-6 * Math.max(1, before)) warnings.push("切除没有碰到实体，模型没有变化")
    return next
  }
  const next = body ? body.fuse(tool) : tool.clone()
  if (body) {
    const before = measureShapeVolumeProperties(body).volume
    const after = measureShapeVolumeProperties(next).volume
    if (Math.abs(after - before) < 1e-6 * Math.max(1, before)) warnings.push("加的料完全在原实体里面，模型没有变化")
  }
  const solids = next.solids?.length ?? 1
  if (solids > 1) warnings.push(`现在是 ${solids} 个不相连的实体：新加的料没有和原来的实体接上`)
  return next
}

function stats(body: Shape3D): BodyStats {
  const [a, b] = body.boundingBox.bounds as [V3, V3]
  const props = measureShapeVolumeProperties(body)
  const c = props.centerOfMass as unknown as V3
  const faces = body.faces
  const edges = body.edges
  const out: BodyStats = {
    bbox: [[r2(a[0]), r2(a[1]), r2(a[2])], [r2(b[0]), r2(b[1]), r2(b[2])]],
    size: [r2(b[0] - a[0]), r2(b[1] - a[1]), r2(b[2] - a[2])],
    volume: r2(props.volume),
    centerOfMass: [r2(c[0]), r2(c[1]), r2(c[2])],
    faces: faces.length,
    edges: edges.length,
    solids: body.solids?.length ?? 1,
  }
  faces.forEach((f) => f.delete())
  edges.forEach((e) => e.delete())
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
  }
}

function sketchDrawing(shapes: SketchShape[], scope: Scope): Drawing {
  const n = (v: number | string) => num(v, scope)
  let out: Drawing | null = null
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
        d = drawPolysides(dd / 2, s.sides)
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
    if (s.cut) {
      if (!out) throw new InputError("「挖掉」的图形前面要先有图形")
      out = out.cut(d)
    } else out = out ? out.fuse(d) : d
  }
  return out!
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
