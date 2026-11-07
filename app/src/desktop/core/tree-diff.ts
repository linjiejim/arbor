// One line saying how a feature tree changed: shown in the window's activity
// list, and told to the agent when someone else changed the model under it.
import { displayName, OP_NAMES, type Feature, type FeatureOp, type Tree } from "../../studio/dsl"

const MAX_ITEMS = 4

/** 「参数 W 40 → 45；加了「圆角1」（f1）」; empty when nothing that matters changed. */
export function describeTreeChange(before: Tree, after: Tree): string {
  const parts: string[] = []

  const params: string[] = []
  for (const [k, v] of Object.entries(after.params)) {
    if (!(k in before.params)) params.push(`+${k} = ${v}`)
    else if (before.params[k] !== v) params.push(`${k} ${before.params[k]} → ${v}`)
  }
  for (const k of Object.keys(before.params)) if (!(k in after.params)) params.push(`删 ${k}`)
  if (params.length) parts.push(`参数 ${clip(params)}`)

  const was = new Map(before.features.map((f) => [f.id, f]))
  const now = new Map(after.features.map((f) => [f.id, f]))
  const label = (t: Tree, f: Feature) => `「${displayName(t, f)}」（${f.id}）`

  const added = after.features.filter((f) => !was.has(f.id)).map((f) => `${label(after, f)}`)
  if (added.length) parts.push(`加了 ${clip(added)}`)
  const removed = before.features.filter((f) => !now.has(f.id)).map((f) => label(before, f))
  if (removed.length) parts.push(`删了 ${clip(removed)}`)

  const edited: string[] = []
  for (const f of after.features) {
    const old = was.get(f.id)
    if (!old) continue
    const keys = changedKeys(old, f)
    if (!keys.length) continue
    if (keys.length === 1 && keys[0] === "suppressed") edited.push(`${f.suppressed ? "压缩" : "恢复"}${label(after, f)}`)
    else edited.push(`${label(after, f)} 的 ${keys.filter((k) => k !== "intent").join("、") || "设计意图"}`)
  }
  if (edited.length) parts.push(`改了 ${clip(edited)}`)

  const order = (t: Tree) => t.features.map((f) => f.id).filter((id) => was.has(id) && now.has(id))
  if (order(before).join() !== order(after).join()) parts.push("调整了特征顺序")

  return parts.join("；")
}

/** Top-level fields that differ (nested objects compared whole). */
function changedKeys(a: Feature, b: Feature): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: string[] = []
  for (const k of keys) {
    if (JSON.stringify((a as Record<string, unknown>)[k]) !== JSON.stringify((b as Record<string, unknown>)[k])) out.push(k)
  }
  return out
}

function clip(items: string[]) {
  return items.length > MAX_ITEMS ? `${items.slice(0, MAX_ITEMS).join("、")} 等 ${items.length} 项` : items.join("、")
}

export const opName = (op: string) => OP_NAMES[op as FeatureOp] ?? op
