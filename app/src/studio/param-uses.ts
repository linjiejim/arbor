// Where each parameter is used: 「草图1 · 矩形宽」「拉伸1 · 距离」, so the
// parameters panel can say what a name means and light up what it drives.
import { displayName, type Feature, type Tree } from "./dsl"
import { namesIn } from "./expr"

const FIELD: Record<string, string> = {
  distance: "距离",
  d: "直径",
  r: "半径",
  w: "宽",
  h: "高",
  t: "壁厚",
  count: "个数",
  count2: "第二方向个数",
  spacing: "间距",
  spacing2: "第二方向间距",
  angle: "角度",
  size: "字号",
  offset: "偏移",
  depth: "深度",
  length: "长度",
  width: "宽度",
  sides: "边数",
  center: "中心",
  at: "位置",
  points: "轮廓点",
  rotate: "旋转角",
  corner: "拐角圆角",
  radius: "半径",
  value: "坐标",
  near: "靠近点",
}

const SHAPE: Record<string, string> = { rect: "矩形", circle: "圆", polygon: "多边形", slot: "长圆孔", polyline: "轮廓", text: "文字" }

const SELECTORS = new Set(["edges", "faces", "open", "face", "not"])

export type ParamUse = { feature: Feature; what: string }

/** What a field path means, in words: ["shapes", 0, "w"] on a rect → 「矩形宽」. */
export function fieldLabel(f: Feature, path: (string | number)[]): string {
  if (path.some((k) => typeof k === "string" && SELECTORS.has(k))) return "选择条件"
  const keys = path.filter((k): k is string => typeof k === "string")
  const last = keys[keys.length - 1] ?? ""
  if (f.op === "sketch" && path[0] === "shapes" && typeof path[1] === "number") return `${SHAPE[f.shapes[path[1]].type] ?? ""}${FIELD[last] ?? last}`
  if (keys.includes("cbore")) return `沉孔${FIELD[last] ?? last}`
  if (keys.includes("csink")) return `埋头孔${FIELD[last] ?? last}`
  if (keys.includes("profile")) return `截面${FIELD[last] ?? last}`
  if (keys[0] === "on" || keys[0] === "neutral") return "草图平面偏移"
  if (f.op === "hole" && last === "d") return "孔径"
  if (f.op === "chamfer" && last === "d") return "倒角距离"
  if (f.op === "fillet" && last === "r") return "圆角半径"
  return FIELD[last] ?? last
}

/** Every place `name` appears in the tree's features, as 「特征名 · 字段」. */
export function paramUses(tree: Tree, name: string): ParamUse[] {
  const out: ParamUse[] = []
  for (const f of tree.features) {
    const whats = new Set<string>()
    const walk = (v: unknown, path: (string | number)[]) => {
      if (typeof v === "string") {
        if (path.length && !["id", "name", "intent", "sketch", "of", "text", "op"].includes(String(path[path.length - 1])) && safeNames(v).includes(name)) whats.add(fieldLabel(f, path))
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]))
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...path, k])
    }
    walk(f, [])
    for (const what of whats) out.push({ feature: f, what })
  }
  return out
}

/** Other parameters whose expression uses `name`. */
export function paramDependents(tree: Tree, name: string): string[] {
  return Object.entries(tree.params).flatMap(([k, v]) => (typeof v === "string" && safeNames(v).includes(name) ? [k] : []))
}

/** Features whose faces show what a parameter drives: a sketch shows through the features built from it. */
export function drivenFeatures(tree: Tree, uses: ParamUse[]): string[] {
  const ids = new Set<string>()
  for (const { feature: f } of uses) {
    if (f.op !== "sketch") ids.add(f.id)
    else
      for (const g of tree.features)
        if (("sketch" in g && g.sketch === f.id) || ("sketches" in g && g.sketches.includes(f.id))) ids.add(g.id)
  }
  // Patterns and mirrors copy what they're given: their copies change too.
  for (const g of tree.features)
    if ((g.op === "linear_pattern" || g.op === "circular_pattern" || g.op === "mirror") && g.features?.some((x) => ids.has(x))) ids.add(g.id)
  return [...ids]
}

export const describeUse = (tree: Tree, u: ParamUse) => `${displayName(tree, u.feature)} · ${u.what}`

function safeNames(src: string): string[] {
  try {
    return namesIn(src)
  } catch {
    return []
  }
}
