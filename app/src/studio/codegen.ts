// Feature tree → build123d (algebra mode) Python. The same model as code-CAD,
// one block per feature, so learners can carry it to a real toolchain and
// compare it with the teardowns' code. Selectors become build123d filters;
// `of` (provenance) is approximated by "lies on that feature's tool body".
//
// A tree may come from someone else (a shared link, an imported file), and the
// learner runs the exported file. So nothing from the tree reaches the Python
// as written: expressions are parsed and printed back from the parse (numbers,
// known parameters, operators, the functions expr.ts allows), ids must be ids,
// text goes through JSON.stringify, and comments lose their line breaks. What
// can't be printed safely becomes None and is listed at the top of the file.
import { standardHole } from "./holes"
import type { EdgeSelector, FaceSelector, Feature, PlaneRef, SketchShape } from "./dsl"
import { displayName, Tree } from "./dsl"
import { CONST_NAMES, FUNC_NAMES, namesIn, parse, type ExprNode } from "./expr"

type N = number | string

/** What is being written (for problem messages) and what may be referenced. */
type Ctx = { problems: string[]; params: Set<string>; badParams: Set<string>; where: string; feature: Feature | null }
// Generation is synchronous: one context at a time.
let ctx: Ctx = { problems: [], params: new Set(), badParams: new Set(), where: "", feature: null }

/** One physical line: no line breaks or other control characters (a comment can't end early). */
// eslint-disable-next-line no-control-regex
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
const clip = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s)

function problem(why: string, field?: string) {
  const msg = oneLine(`${ctx.where}${field ? `的 ${field}` : ""}：${why}`)
  if (!ctx.problems.includes(msg)) ctx.problems.push(msg)
  return "None"
}

/** Where a value sits in the feature being written, e.g. "shapes[0].w". */
function fieldOf(v: unknown, target: unknown, path = ""): string | null {
  if (v === target) return path
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const p = fieldOf(v[i], target, `${path}[${i}]`)
      if (p !== null) return p
    }
  } else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      const p = fieldOf(x, target, path ? `${path}.${k}` : k)
      if (p !== null) return p
    }
  return null
}

const bad = (raw: N, why: string) => problem(why, (ctx.feature && fieldOf(ctx.feature, raw)) || undefined)

/** A number or an expression, as Python: printed back from its parse, never copied. */
const py = (raw: N): string => {
  if (typeof raw === "number") return Number.isFinite(raw) ? fmt(raw) : bad(raw, "数值不是有限数")
  if (typeof raw !== "string") return bad(raw, "不是数值或表达式")
  let node: ExprNode
  try {
    node = parse(raw)
  } catch (e) {
    // The reason without the expression itself: what can't be parsed is never written out, not even in a comment.
    return bad(raw, `表达式解析不了（${(e as Error).message.split("：")[0]}）`)
  }
  for (const name of names(node)) {
    if (ctx.badParams.has(name)) return bad(raw, `参数名「${clip(name)}」不能用作 Python 变量名`)
    if (!ctx.params.has(name) && !CONST_NAMES.includes(name)) return bad(raw, `没有名为「${clip(name)}」的参数`)
  }
  const out = pyExpr(node)
  return node.k === "name" || node.k === "num" || node.k === "call" ? out : `(${out})`
}

function names(n: ExprNode): string[] {
  if (n.k === "name") return [n.v]
  if (n.k === "neg") return names(n.a)
  if (n.k === "bin") return [...names(n.a), ...names(n.b)]
  if (n.k === "call") return n.args.flatMap(names)
  return []
}

/** Python precedence, high binds tighter: + - 1, * / 2, unary minus 3, ** 4, atoms 5. */
const prec = (n: ExprNode) => (n.k === "bin" ? (n.op === "^" ? 4 : n.op === "*" || n.op === "/" ? 2 : 1) : n.k === "neg" ? 3 : 5)
const wrap = (n: ExprNode, min: number) => (prec(n) < min ? `(${pyExpr(n)})` : pyExpr(n))

function pyExpr(n: ExprNode): string {
  switch (n.k) {
    case "num":
      return String(n.v)
    case "name":
      return n.v
    case "neg":
      return `-${wrap(n.a, 3)}`
    case "call":
      // Only FUNCS parse as calls; the file defines the ones Python lacks.
      return FUNC_NAMES.includes(n.f) ? `${n.f}(${n.args.map(pyExpr).join(", ")})` : "None"
    case "bin":
      // The expression grammar's base of ^ is a unary, so -2^2 is (-2)**2.
      if (n.op === "^") return `${wrap(n.a, 5)}**${wrap(n.b, 3)}`
      if (n.op === "+" || n.op === "-") return `${wrap(n.a, 1)} ${n.op} ${wrap(n.b, 2)}`
      return `${wrap(n.a, 2)}${n.op}${wrap(n.b, 3)}`
  }
}

/** Counts can be expressions; Python's range() needs an int. */
const pyInt = (v: N) => (typeof v === "number" ? py(v) : `round(${py(v)})`)
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e6) / 1e6))
const neg = (v: N) => (typeof v === "number" ? py(-v) : `-${py(v)}`)

const ID = /^[A-Za-z][A-Za-z0-9_]*$/
/** A feature id inside a Python name (sk_base, tool_base). */
const ref = (prefix: string, id: string) => (typeof id === "string" && ID.test(id) ? `${prefix}_${id}` : problem(`引用的特征 id「${clip(oneLine(String(id)))}」不合法`))

/** Python keywords and the names the file's own helpers live under: not usable as parameter names. */
const RESERVED = new Set([
  ...FUNC_NAMES,
  ...CONST_NAMES,
  ..."math part on_face on_feature show_object".split(" "),
  ..."False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " ",
  ),
])
const safeName = (k: string) => /^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*$/.test(k) && !k.startsWith("__") && !RESERVED.has(k)

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
  if (!on.face) {
    if (!on.tilt) return plane(on)
    const a = py(on.tilt.angle)
    return `${plane(on)}.move(Rot(${on.tilt.axis}=${a}))`
  }
  const axis = { XY: "Z", XZ: "Y", YZ: "X" }[on.plane]
  const sign = on.plane === "XZ" ? "-" : ""
  // The face's coordinate along the plane's axis, then the plane through it; an inclined face gets its own plane.
  const face = `${faces(on.face)}[0]`
  return `on_face(${face}, ${plane(on, `${sign}${face}.center().${axis}`)}, ${on.offset !== undefined ? py(on.offset) : "0"})`
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
      // JSON.stringify escapes quotes, backslashes and line breaks: one line, a valid Python literal.
      return `${at}Text(${JSON.stringify(String(s.text))}, ${py(s.size)}, font="Noto Sans SC"${s.angle !== undefined ? `, rotation=${py(s.angle)}` : ""})`
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
  if (sel.of) e = `on_feature(${e}, ${ref("tool", sel.of)})`
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
  if (sel.of) e = `on_feature(${e}, ${ref("tool", sel.of)})`
  if (sel.kind) e += `.filter_by(GeomType.${KIND_EDGE[sel.kind]})`
  if (sel.parallel) e += `.filter_by(${AXIS[sel.parallel]})`
  if (sel.radius !== undefined) e += `.filter_by(lambda e: abs(e.radius - ${py(sel.radius)}) < 1e-3)`
  if (sel.at) e += `.filter_by_position(${AXIS[sel.at.axis]}, ${py(sel.at.value)} - 1e-3, ${py(sel.at.value)} + 1e-3)`
  if (sel.extreme) e += `.group_by(${AXIS[sel.extreme[1]]})[${sel.extreme[0] === "+" ? "-1" : "0"}]`
  if (sel.near) e += `.sort_by_distance(Vector(${sel.near.map(py).join(", ")}))[:1]`
  return e
}

function combine(id: string, mode: "add" | "cut" | undefined) {
  return mode === "cut" ? `part = part - ${ref("tool", id)}` : `part = ${ref("tool", id)} if part is None else part + ${ref("tool", id)}`
}

function feature(f: Feature, tree: Tree): string[] {
  const head = [`# ${oneLine(`${displayName(tree, f)}（${f.id}）${f.intent ? `：${f.intent}` : ""}`)}`]
  switch (f.op) {
    case "sketch": {
      const [first, ...rest] = f.shapes
      const body = rest.reduce((acc, s) => `${acc} ${s.cut ? "-" : "+"} ${shape2d(s)}`, shape2d(first))
      return [...head, `${ref("sk", f.id)} = ${sketchPlane(f.on)} * (${body})`]
    }
    case "extrude": {
      const sk = ref("sk", f.sketch)
      if (f.through) return [...head, `${ref("tool", f.id)} = extrude(${sk}, amount=1000, both=True)`, combine(f.id, "cut")]
      const opts = f.direction === "both" ? `amount=${py(f.distance)} / 2, both=True` : f.direction === "reverse" ? `amount=${py(f.distance)}, dir=-${sk}.faces()[0].normal_at()` : `amount=${py(f.distance)}`
      return [...head, `${ref("tool", f.id)} = extrude(${sk}, ${opts})`, combine(f.id, f.mode)]
    }
    case "revolve":
      return [...head, `${ref("tool", f.id)} = revolve(${ref("sk", f.sketch)},axis=${AXIS[f.axis]}${f.angle !== undefined ? `, revolution_arc=${py(f.angle)}` : ""})`, combine(f.id, f.mode)]
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
      // A standard hole is written out as the numbers the table gives.
      let std: ReturnType<typeof standardHole> | null = null
      try {
        std = f.standard ? standardHole(f.standard) : null
      } catch {
        /* the kernel reports it */
      }
      const r = `${std ? std.d : py(f.d ?? 0)} / 2`
      const cbore = f.cbore ? { d: py(f.cbore.d), depth: py(f.cbore.depth) } : std?.cbore && { d: String(std.cbore.d), depth: String(std.cbore.depth) }
      const csink = f.csink ? { d: py(f.csink.d), angle: f.csink.angle !== undefined ? py(f.csink.angle) : "90" } : std?.csink && { d: String(std.csink.d), angle: "90" }
      let tool = `Cylinder(${r}, ${depth}, align=(Align.CENTER, Align.CENTER, Align.MAX))`
      if (cbore) tool += ` + Cylinder(${cbore.d} / 2, ${cbore.depth}, align=(Align.CENTER, Align.CENTER, Align.MAX))`
      if (csink) {
        const R = `${csink.d} / 2`
        const a = csink.angle
        tool += ` + Cone(${r}, ${R}, (${R} - ${r}) / tan(${a} / 2), align=(Align.CENTER, Align.CENTER, Align.MAX))`
      }
      const at = f.at.map(([x, y]) => `(${py(x)}, ${py(y)})`).join(", ")
      return [
        ...head,
        ...(std ? [`# ${std.label}${std.thread ? "：只钻底孔，装饰螺纹不导出" : ""}`] : []),
        `hole_plane = ${sketchPlane(f.on)}`,
        `${ref("tool", f.id)} = Compound([Plane(origin=hole_plane.from_local_coords(xy), z_dir=${out}) * (${tool}) for xy in [${at}]])`,
        combine(f.id, "cut"),
      ]
    }
    case "linear_pattern": {
      const v = `Vector${DIR_VEC[f.dir]} * ${py(f.spacing)}`
      const v2 = f.dir2 && f.count2 !== undefined && f.spacing2 !== undefined ? `Vector${DIR_VEC[f.dir2]} * ${py(f.spacing2)}` : null
      const rng = v2 ? `for i in range(${pyInt(f.count)}) for j in range(${pyInt(f.count2!)}) if i or j` : `for i in range(1, ${pyInt(f.count)})`
      const move = v2 ? `Pos(${v} * i + ${v2} * j)` : `Pos(${v} * i)`
      return [...head, ...f.features.map((id) => `for copy in [${move} * ${ref("tool", id)} ${rng}]:\n    part = part ${modeOf(tree, id) === "cut" ? "-" : "+"} copy`)]
    }
    case "circular_pattern": {
      const total = f.angle !== undefined ? py(f.angle) : "360"
      const c = pyInt(f.count)
      const step = f.angle === undefined || Number(f.angle) >= 360 ? `360 / ${c}` : `${total} / (${c} - 1)`
      const rot = { X: "Rot(X=a)", Y: "Rot(Y=a)", Z: "Rot(Z=a)" }[f.axis]
      return [...head, ...f.features.map((id) => `for a in [${step} * i for i in range(1, ${c})]:\n    part = part ${modeOf(tree, id) === "cut" ? "-" : "+"} ${rot} * ${ref("tool", id)}`)]
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
        `${ref("path", f.id)} = ${pl} * ${wire}`,
        `t0 = ${ref("path", f.id)} % 0`,
        `${ref("prof", f.id)} = Plane(origin=${ref("path", f.id)} @ 0, x_dir=t0.cross(${pl}.z_dir), z_dir=-t0) * ${prof}`,
        `${ref("tool", f.id)} = sweep(${ref("prof", f.id)}, path=${ref("path", f.id)})`,
        combine(f.id, f.mode),
      ]
    }
    case "loft":
      return [...head, `${ref("tool", f.id)} = loft([${f.sketches.map((id) => ref("sk", id)).join(", ")}], ruled=${f.ruled ? "True" : "False"})`, combine(f.id, f.mode)]
    case "draft":
      return [...head, `part = draft(${faces(f.faces)}, ${plane(f.neutral)}, ${py(f.angle)})`]
    case "mirror": {
      const about = plane({ plane: f.plane, offset: f.offset })
      if (!f.features?.length) return [...head, `part = part + mirror(part, about=${about})`]
      return [...head, ...f.features.map((id) => `part = part ${modeOf(tree, id) === "cut" ? "-" : "+"} mirror(${ref("tool", id)}, about=${about})`)]
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
    if (done.has(k) || !Object.hasOwn(tree.params, k)) return
    done.add(k)
    const v = tree.params[k]
    if (typeof v === "string") {
      try {
        namesIn(v).forEach(visit)
      } catch {
        /* py() reports it */
      }
    }
    ctx.where = `参数「${clip(oneLine(k))}」`
    ctx.feature = null
    if (ctx.badParams.has(k)) return void problem("名字不能用作 Python 变量名，没有导出")
    const note = tree.paramNotes?.[k]
    out.push(`${k} = ${py(v)}${note ? `  # ${oneLine(note).trim()}` : ""}`)
  }
  Object.keys(tree.params).forEach(visit)
  return out
}

/** The code plus what could not be written safely (field by field); those spots read None. */
export function buildCode(raw: Tree, opts: { title?: string; body?: boolean } = {}): { code: string; problems: string[] } {
  const parsed = Tree.safeParse(raw)
  if (!parsed.success) return { code: "# 特征树格式不对，没有生成代码", problems: ["特征树格式不对"] }
  const tree = parsed.data
  const names = Object.keys(tree.params)
  ctx = { problems: [], params: new Set(names.filter(safeName)), badParams: new Set(names.filter((k) => !safeName(k))), where: "", feature: null }
  const head = params(tree)
  const body: string[] = []
  for (const f of tree.features) {
    ctx.where = `特征「${clip(oneLine(displayName(tree, f)))}」（${f.id}）`
    ctx.feature = f
    body.push(...feature(f, tree), "")
  }
  const { problems } = ctx
  ctx = { problems: [], params: new Set(), badParams: new Set(), where: "", feature: null }
  const warn = problems.length ? [`# 有 ${problems.length} 处没能导出，代码里写成了 None，运行前要先改好：`, ...problems.map((p) => `#   ${p}`), ""] : []
  if (opts.body) return { code: [...warn, "# 参数", ...head, "", "part = None", "", ...body].join("\n").trimEnd(), problems }
  return { code: [...prelude(opts.title ?? "FeatureTree 工作台导出"), ...warn, "# 参数", ...head, "", "part = None", "", ...body, "show_object(part) if 'show_object' in globals() else None", ""].join("\n"), problems }
}

/** `body: true` = just parameters and features (for reading); otherwise a runnable file. */
export function toBuild123d(tree: Tree, opts: { title?: string; body?: boolean } = {}): string {
  return buildCode(tree, opts).code
}

function prelude(title: string): string[] {
  // A docstring: one line, and nothing that could close it.
  const safeTitle = oneLine(title).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return [
    `"""${safeTitle}

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
    "def on_face(face, flat, offset=0):",
    '    """Sketch plane on a face: `flat` when the face is parallel to the datum; an inclined face gets its own (origin at its centre, x level, y up the slope)."""',
    "    n = face.normal_at()",
    "    if abs(n.dot(flat.z_dir)) > 0.9999:",
    "        return flat",
    "    x = Vector(0, 0, 1).cross(n) if abs(n.Z) < 0.999 else Vector(1, 0, 0)",
    "    return Plane(origin=face.center() + n * offset, x_dir=x.normalized(), z_dir=n)",
    "",
    "",
    "def on_feature(items, tool):",
    '    """Faces / edges lying on a feature\'s tool body: an approximation of "made by that feature"."""',
    "    skin = tool.faces()",
    "    return ShapeList(i for i in items if min(f.distance_to(i.center()) for f in skin) < 1e-3)",
    "",
    "",
  ]
}
