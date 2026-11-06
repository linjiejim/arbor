// Feature tree → build123d (algebra mode) Python. The same model as code-CAD,
// one block per feature, so learners can carry it to a real toolchain and
// compare it with the teardowns' code. Selectors become build123d filters;
// `of` (provenance) is approximated by "lies on that feature's tool body".
import type { EdgeSelector, FaceSelector, Feature, PlaneRef, SketchShape, Tree } from "./dsl"
import { displayName } from "./dsl"
import { namesIn, unquote } from "./expr"

type N = number | string

/** A number or an expression, as Python. */
/** Counts can be expressions; Python's range() needs an int. */
const pyInt = (v: N) => (typeof v === "number" ? String(v) : `round(${py(v)})`)
const py = (raw: N) => {
  if (typeof raw === "number") return fmt(raw)
  const v = unquote(raw).trim()
  return /^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*$/.test(v) ? v : `(${v.replace(/\^/g, "**")})`
}
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e6) / 1e6))
const neg = (v: N) => (typeof v === "number" ? fmt(-v) : `-${py(v)}`)

const AXIS: Record<string, string> = { X: "Axis.X", Y: "Axis.Y", Z: "Axis.Z" }
const KIND_FACE: Record<string, string> = { plane: "PLANE", cylinder: "CYLINDER", cone: "CONE", sphere: "SPHERE", torus: "TORUS", freeform: "BSPLINE" }
const KIND_EDGE: Record<string, string> = { line: "LINE", circle: "CIRCLE", freeform: "BSPLINE" }
const DIR_VEC: Record<string, string> = { "+X": "(1, 0, 0)", "-X": "(-1, 0, 0)", "+Y": "(0, 1, 0)", "-Y": "(0, -1, 0)", "+Z": "(0, 0, 1)", "-Z": "(0, 0, -1)" }

function plane(ref: { plane: "XY" | "XZ" | "YZ"; offset?: N }, extra?: string) {
  // build123d's XZ plane faces -Y, so a Y coordinate is a negative offset; XY and YZ offset along +Z / +X.
  const parts = [ref.offset !== undefined ? (ref.plane === "XZ" ? neg(ref.offset) : py(ref.offset)) : null, extra].filter(Boolean)
  return parts.length ? `Plane.${ref.plane}.offset(${parts.join(" + ")})` : `Plane.${ref.plane}`
}

function sketchPlane(on: PlaneRef) {
  if (!on.face) return plane(on)
  const axis = { XY: "Z", XZ: "Y", YZ: "X" }[on.plane]
  const sign = on.plane === "XZ" ? "-" : ""
  // The face's coordinate along the plane's axis, then the plane through it.
  return `${plane(on, `${sign}${faces(on.face)}[0].center().${axis}`)}`
}

function shape2d(s: SketchShape): string {
  const at = s.type !== "polyline" && s.center ? `Pos(${py(s.center[0])}, ${py(s.center[1])}) * ` : ""
  switch (s.type) {
    case "rect":
      return s.r !== undefined ? `${at}RectangleRounded(${py(s.w)}, ${py(s.h)}, ${py(s.r)})` : `${at}Rectangle(${py(s.w)}, ${py(s.h)})`
    case "circle":
      return `${at}Circle(${py(s.d)} / 2)`
    case "polygon":
      return `${at}RegularPolygon(${py(s.d)} / 2, ${pyInt(s.sides)}${s.rotate !== undefined ? `, rotation=${py(s.rotate)}` : ""})`
    case "text":
      // Needs Noto Sans SC installed (or font_path=…) for the same outlines as the studio.
      return `${at}Text(${JSON.stringify(s.text)}, ${py(s.size)}, font="Noto Sans SC"${s.angle !== undefined ? `, rotation=${py(s.angle)}` : ""})`
    case "slot":
      return `${at}SlotOverall(${py(s.length)}, ${py(s.width)}${s.angle !== undefined ? `, rotation=${py(s.angle)}` : ""})`
    case "polyline": {
      const pts = s.points.map((p) => (Array.isArray(p) ? { to: p } : p))
      const xy = (p: [N, N]) => `(${py(p[0])}, ${py(p[1])})`
      const segs: string[] = []
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i].to as [N, N]
        const next = pts[(i + 1) % pts.length]
        const b = next.to as [N, N]
        if (i === pts.length - 1 && !("via" in next && next.via) && JSON.stringify(a) === JSON.stringify(pts[0].to)) break
        segs.push("via" in next && next.via ? `ThreePointArc(${xy(a)}, ${xy(next.via as [N, N])}, ${xy(b)})` : `Line(${xy(a)}, ${xy(b)})`)
      }
      return `make_face([${segs.join(", ")}])`
    }
  }
}

function faces(sel: FaceSelector, base = "part.faces()"): string {
  const main = faceFilter(sel, base)
  return sel.not ? `(${main} - ${faceFilter(sel.not, base)})` : main
}

function faceFilter(sel: Omit<FaceSelector, "not" | "expect">, base: string) {
  let e = base
  if (sel.of) e = `on_feature(${e}, tool_${sel.of})`
  if (sel.kind) e += `.filter_by(GeomType.${KIND_FACE[sel.kind]})`
  if (sel.normal) {
    const [s, a] = [sel.normal[0], sel.normal[1]]
    e += `.filter_by(lambda f: f.geom_type == GeomType.PLANE and ${s === "-" ? "-" : ""}f.normal_at().${a} > 0.9999)`
  }
  if (sel.radius !== undefined) e += `.filter_by(lambda f: abs(f.radius - ${py(sel.radius)}) < 1e-3)`
  if (sel.at) e += `.filter_by_position(${AXIS[sel.at.axis]}, ${py(sel.at.value)} - 1e-3, ${py(sel.at.value)} + 1e-3)`
  if (sel.extreme) e += `.group_by(${AXIS[sel.extreme[1]]})[${sel.extreme[0] === "+" ? "-1" : "0"}]`
  if (sel.near) e += `.sort_by_distance(Vector(${sel.near.map(py).join(", ")}))[:1]`
  return e
}

function edges(sel: EdgeSelector): string {
  const main = edgeFilter(sel)
  return sel.not ? `(${main} - ${edgeFilter(sel.not)})` : main
}

function edgeFilter(sel: Omit<EdgeSelector, "not" | "expect">) {
  let e = sel.faces ? `${faces(sel.faces)}.edges()` : "part.edges()"
  if (sel.of) e = `on_feature(${e}, tool_${sel.of})`
  if (sel.kind) e += `.filter_by(GeomType.${KIND_EDGE[sel.kind]})`
  if (sel.parallel) e += `.filter_by(${AXIS[sel.parallel]})`
  if (sel.radius !== undefined) e += `.filter_by(lambda e: abs(e.radius - ${py(sel.radius)}) < 1e-3)`
  if (sel.at) e += `.filter_by_position(${AXIS[sel.at.axis]}, ${py(sel.at.value)} - 1e-3, ${py(sel.at.value)} + 1e-3)`
  if (sel.extreme) e += `.group_by(${AXIS[sel.extreme[1]]})[${sel.extreme[0] === "+" ? "-1" : "0"}]`
  if (sel.near) e += `.sort_by_distance(Vector(${sel.near.map(py).join(", ")}))[:1]`
  return e
}

function combine(id: string, mode: "add" | "cut" | undefined) {
  return mode === "cut" ? `part = part - tool_${id}` : `part = tool_${id} if part is None else part + tool_${id}`
}

function feature(f: Feature, tree: Tree): string[] {
  const head = [`# ${displayName(tree, f)}（${f.id}）${f.intent ? `：${f.intent}` : ""}`]
  switch (f.op) {
    case "sketch": {
      const [first, ...rest] = f.shapes
      const body = rest.reduce((acc, s) => `${acc} ${s.cut ? "-" : "+"} ${shape2d(s)}`, shape2d(first))
      return [...head, `sk_${f.id} = ${sketchPlane(f.on)} * (${body})`]
    }
    case "extrude": {
      const sk = `sk_${f.sketch}`
      if (f.through) return [...head, `tool_${f.id} = extrude(${sk}, amount=1000, both=True)`, combine(f.id, "cut")]
      const opts = f.direction === "both" ? `amount=${py(f.distance)} / 2, both=True` : f.direction === "reverse" ? `amount=${py(f.distance)}, dir=-${sk}.faces()[0].normal_at()` : `amount=${py(f.distance)}`
      return [...head, `tool_${f.id} = extrude(${sk}, ${opts})`, combine(f.id, f.mode)]
    }
    case "revolve":
      return [...head, `tool_${f.id} = revolve(sk_${f.sketch}, axis=${AXIS[f.axis]}${f.angle !== undefined ? `, revolution_arc=${py(f.angle)}` : ""})`, combine(f.id, f.mode)]
    case "fillet":
      return [...head, `part = fillet(${edges(f.edges)}, radius=${py(f.r)})`]
    case "chamfer":
      return [...head, `part = chamfer(${edges(f.edges)}, length=${py(f.d)})`]
    case "shell":
      return [...head, `part = offset(part, amount=-${py(f.t)}, openings=${faces(f.open)})`]
    case "hole": {
      const n = { XY: "Vector(0, 0, 1)", XZ: "Vector(0, -1, 0)", YZ: "Vector(1, 0, 0)" }[f.on.plane]
      const out = f.reverse ? `-${n}` : n
      const depth = f.depth !== undefined ? py(f.depth) : "1000"
      const r = `${py(f.d)} / 2`
      let tool = `Cylinder(${r}, ${depth}, align=(Align.CENTER, Align.CENTER, Align.MAX))`
      if (f.cbore) tool += ` + Cylinder(${py(f.cbore.d)} / 2, ${py(f.cbore.depth)}, align=(Align.CENTER, Align.CENTER, Align.MAX))`
      if (f.csink) {
        const R = `${py(f.csink.d)} / 2`
        const a = f.csink.angle !== undefined ? py(f.csink.angle) : "90"
        tool += ` + Cone(${r}, ${R}, (${R} - ${r}) / tan(${a} / 2), align=(Align.CENTER, Align.CENTER, Align.MAX))`
      }
      const at = f.at.map(([x, y]) => `(${py(x)}, ${py(y)})`).join(", ")
      return [
        ...head,
        `hole_plane = ${sketchPlane(f.on)}`,
        `tool_${f.id} = Compound([Plane(origin=hole_plane.from_local_coords(xy), z_dir=${out}) * (${tool}) for xy in [${at}]])`,
        combine(f.id, "cut"),
      ]
    }
    case "linear_pattern": {
      const v = `Vector${DIR_VEC[f.dir]} * ${py(f.spacing)}`
      const v2 = f.dir2 && f.count2 !== undefined && f.spacing2 !== undefined ? `Vector${DIR_VEC[f.dir2]} * ${py(f.spacing2)}` : null
      const rng = v2 ? `for i in range(${pyInt(f.count)}) for j in range(${pyInt(f.count2!)}) if i or j` : `for i in range(1, ${pyInt(f.count)})`
      const move = v2 ? `Pos(${v} * i + ${v2} * j)` : `Pos(${v} * i)`
      return [...head, ...f.features.map((id) => `for copy in [${move} * tool_${id} ${rng}]:\n    part = part ${modeOf(tree, id) === "cut" ? "-" : "+"} copy`)]
    }
    case "circular_pattern": {
      const total = f.angle !== undefined ? py(f.angle) : "360"
      const c = pyInt(f.count)
      const step = f.angle === undefined || Number(f.angle) >= 360 ? `360 / ${c}` : `${total} / (${c} - 1)`
      const rot = { X: "Rot(X=a)", Y: "Rot(Y=a)", Z: "Rot(Z=a)" }[f.axis]
      return [...head, ...f.features.map((id) => `for a in [${step} * i for i in range(1, ${c})]:\n    part = part ${modeOf(tree, id) === "cut" ? "-" : "+"} ${rot} * tool_${id}`)]
    }
    case "sweep": {
      const pts = f.path.points.map((p) => (Array.isArray(p) ? { to: p as [N, N] } : { to: p.to as [N, N], via: p.via as [N, N] }))
      const xy = (p: [N, N]) => `(${py(p[0])}, ${py(p[1])})`
      const pl = sketchPlane(f.path.on)
      const straight = pts.every((p) => !p.via)
      const wire =
        straight && f.path.corner !== undefined
          ? `FilletPolyline(${pts.map((p) => xy(p.to)).join(", ")}, radius=${py(f.path.corner)})`
          : `Wire([${pts
              .slice(1)
              .map((p, i) => (p.via ? `ThreePointArc(${xy(pts[i].to)}, ${xy(p.via)}, ${xy(p.to)})` : `Line(${xy(pts[i].to)}, ${xy(p.to)})`))
              .join(", ")}])`
      const prof = f.profile.type === "circle" ? `Circle(${py(f.profile.d)} / 2)` : `Rectangle(${py(f.profile.w)}, ${py(f.profile.h)})`
      return [
        ...head,
        `path_${f.id} = ${pl} * ${wire}`,
        `t0 = path_${f.id} % 0`,
        `prof_${f.id} = Plane(origin=path_${f.id} @ 0, x_dir=t0.cross(${pl}.z_dir), z_dir=-t0) * ${prof}`,
        `tool_${f.id} = sweep(prof_${f.id}, path=path_${f.id})`,
        combine(f.id, f.mode),
      ]
    }
    case "loft":
      return [...head, `tool_${f.id} = loft([${f.sketches.map((id) => `sk_${id}`).join(", ")}], ruled=${f.ruled ? "True" : "False"})`, combine(f.id, f.mode)]
    case "draft":
      return [...head, `part = draft(${faces(f.faces)}, ${plane(f.neutral)}, ${py(f.angle)})`]
    case "mirror": {
      const about = plane({ plane: f.plane, offset: f.offset })
      if (!f.features?.length) return [...head, `part = part + mirror(part, about=${about})`]
      return [...head, ...f.features.map((id) => `part = part ${modeOf(tree, id) === "cut" ? "-" : "+"} mirror(tool_${id}, about=${about})`)]
    }
  }
}

function modeOf(tree: Tree, id: string) {
  const f = tree.features.find((x) => x.id === id)
  return f && "mode" in f ? f.mode : f?.op === "hole" ? "cut" : "add"
}

/** Parameters in dependency order, as Python assignments. */
function params(tree: Tree) {
  const out: string[] = []
  const done = new Set<string>()
  const visit = (k: string) => {
    if (done.has(k) || !(k in tree.params)) return
    done.add(k)
    const v = tree.params[k]
    if (typeof v === "string") namesIn(v).forEach(visit)
    out.push(`${k} = ${py(v)}`)
  }
  Object.keys(tree.params).forEach(visit)
  return out
}

/** `body: true` = just parameters and features (for reading); otherwise a runnable file. */
export function toBuild123d(tree: Tree, opts: { title?: string; body?: boolean } = {}): string {
  const title = opts.title ?? "FeatureTree 工作台导出"
  if (opts.body) {
    const lines = ["# 参数", ...params(tree), "", "part = None", ""]
    for (const f of tree.features) lines.push(...feature(f, tree), "")
    return lines.join("\n").trimEnd()
  }
  const lines = [
    `"""${title}

由 FeatureTree AI 建模工作台的特征树生成（build123d 代数写法）。
Z 轴朝上，单位毫米。选择器按语义转成 build123d 的过滤；「来自某特征」按「落在该特征的工具体表面上」近似。
"""`,
    "import math",
    "from build123d import *",
    "",
    "",
    "def sin(d): return math.sin(math.radians(d))",
    "def cos(d): return math.cos(math.radians(d))",
    "def tan(d): return math.tan(math.radians(d))",
    "def atan(x): return math.degrees(math.atan(x))",
    "sqrt, pi, floor, ceil = math.sqrt, math.pi, math.floor, math.ceil",
    "",
    "",
    "def on_feature(items, tool):",
    '    """Faces / edges lying on a feature\'s tool body: an approximation of "made by that feature"."""',
    "    skin = tool.faces()",
    "    return ShapeList(i for i in items if min(f.distance_to(i.center()) for f in skin) < 1e-3)",
    "",
    "",
    "# 参数",
    ...params(tree),
    "",
    "part = None",
    "",
  ]
  for (const f of tree.features) lines.push(...feature(f, tree), "")
  lines.push("show_object(part) if 'show_object' in globals() else None", "")
  return lines.join("\n")
}
