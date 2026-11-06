import type { z } from "zod"
import { Tree } from "./dsl"

/**
 * Limits on a feature tree that came from someone else (a shared link, an
 * imported file). The server and the browser check the same numbers, so a
 * link the server took is a link every browser opens.
 */
export const LIMITS = {
  /** Serialised tree, bytes. */
  treeBytes: 200 * 1024,
  features: 200,
  params: 100,
  /** Any string in the tree (names, intents, notes, expressions), characters. */
  string: 500,
  title: 60,
  note: 200,
  /** Serialised chat replay, bytes; and messages. */
  chatBytes: 300 * 1024,
  chatMessages: 200,
}

/**
 * Counts a tree may ask the kernel for (pattern copies, polygon sides). The
 * values can be expressions, so the cap is applied after evaluating them: a
 * link with `count: "10^6"` fails at that step instead of freezing the tab.
 */
export const MAX_COUNT = 500

export const byteLength = (s: string) => new TextEncoder().encode(s).length

export type TreeCheck = { ok: true; tree: Tree } | { ok: false; tooBig: boolean; message: string }

/** Schema plus limits; the message says where, e.g. 「第 3 个特征（拉伸1）缺少 sketch 字段」. */
export function checkTree(raw: unknown): TreeCheck {
  const parsed = Tree.safeParse(raw)
  if (!parsed.success) return { ok: false, tooBig: false, message: issueText(parsed.error, raw) }
  const tree = parsed.data
  const tooBig = (message: string): TreeCheck => ({ ok: false, tooBig: true, message })
  if (tree.features.length > LIMITS.features) return tooBig(`特征太多了（${tree.features.length} 个，最多 ${LIMITS.features} 个）`)
  if (Object.keys(tree.params).length > LIMITS.params) return tooBig(`参数太多了（${Object.keys(tree.params).length} 个，最多 ${LIMITS.params} 个）`)
  const holes = tree.features.findIndex((f) => f.op === "hole" && f.at.length > MAX_COUNT)
  if (holes >= 0) return tooBig(`第 ${holes + 1} 个特征的孔太多了（最多 ${MAX_COUNT} 个）`)
  const long = longString(tree)
  if (long) return tooBig(`有一段文字太长了（${long.length} 字，最多 ${LIMITS.string} 字）：${long.slice(0, 20)}…`)
  const bytes = byteLength(JSON.stringify(tree))
  if (bytes > LIMITS.treeBytes) return tooBig(`特征树太大了（${Math.ceil(bytes / 1024)} KB，最多 ${LIMITS.treeBytes / 1024} KB）`)
  return { ok: true, tree }
}

/** The first string (or key) over the limit, anywhere in the value. */
function longString(v: unknown): string | null {
  if (typeof v === "string") return v.length > LIMITS.string ? v : null
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = longString(x)
      if (s) return s
    }
    return null
  }
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      const s = k.length > LIMITS.string ? k : longString(x)
      if (s) return s
    }
  return null
}

/** One zod issue in words a learner can act on. */
function issueText(error: z.ZodError, raw: unknown): string {
  const issue = error.issues[0]
  if (!issue) return "特征树格式不对"
  const path = issue.path
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "不是特征树：要有 params 和 features 两个字段"
  const root = raw as Record<string, unknown>
  if (path[0] === "features" && typeof path[1] === "number") {
    const list = Array.isArray(root.features) ? root.features : []
    const f = list[path[1]] as Record<string, unknown> | undefined
    const id = typeof f?.id === "string" ? f.id : ""
    const name = typeof f?.name === "string" && f.name ? f.name : id
    const who = `第 ${path[1] + 1} 个特征${name ? `（${name}）` : ""}`
    const rest = path.slice(2)
    if (!rest.length) return `${who}不是对象`
    return `${who}${fieldText(rest, valueAt(f, rest), issue)}`
  }
  if (path.length === 1 && root[String(path[0])] === undefined) return `缺少 ${String(path[0])} 字段`
  if (path[0] === "params") return path.length > 1 ? `参数「${String(path[1])}」要是数字或表达式` : "params 要是参数名到数值的对象"
  if (path[0] === "paramNotes") return path.length > 1 ? `参数「${String(path[1])}」的说明要是文字` : "paramNotes 要是参数名到说明的对象"
  if (path[0] === "features") return "features 要是特征列表"
  return valueAt(root, path) === undefined ? `缺少 ${path.join(".")} 字段` : `${path.join(".")} 字段格式不对`
}

function fieldText(rest: PropertyKey[], value: unknown, issue: z.core.$ZodIssue): string {
  const field = rest.map((k) => (typeof k === "number" ? `[${k}]` : `.${String(k)}`)).join("").replace(/^\./, "")
  if (field === "op") return value === undefined ? "缺少 op 字段" : `的类型「${String(value)}」不认识`
  if (value === undefined) return `缺少 ${field} 字段`
  if (issue.code === "too_small") return `的 ${field} 太短或太小`
  if (issue.code === "too_big") return `的 ${field} 太长或太大`
  if (issue.code === "invalid_value") return `的 ${field} 只能是 ${issue.values.map((v) => JSON.stringify(v)).join(" / ")}`
  if (issue.code === "invalid_format") return `的 ${field} 格式不对`
  return `的 ${field} 格式不对`
}

function valueAt(v: unknown, path: PropertyKey[]): unknown {
  let cur = v
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined
    cur = (cur as Record<PropertyKey, unknown>)[k]
  }
  return cur
}
