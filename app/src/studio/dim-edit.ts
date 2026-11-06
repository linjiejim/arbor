import { promoteToParam, setFieldAt } from "./apply"
import type { Dim } from "./kernel/dims"
import type { Studio } from "./use-studio"

/**
 * The one rule for changing a dimension, from the model or the feature card:
 * a parameter's edits the parameter (÷ the factor for pcd/2), a plain number
 * edits its field or becomes parameter `promoteAs`. Error text or null.
 */
export async function applyDimEdit(studio: Studio, dim: Dim, text: string, promoteAs?: string): Promise<string | null> {
  const v = Number(text)
  if (text.trim() === "" || !Number.isFinite(v)) return "请输入一个数"
  const src = dim.source
  if (src.type === "param") return studio.setParam(src.name, v)
  if (src.type === "factor") return studio.setParam(src.name, Math.round((v / src.k) * 1e9) / 1e9)
  if (src.type === "derived") return "这个数由公式算出，改它用到的参数，或者让助教来改"
  if (promoteAs !== undefined) return studio.editTree((t) => promoteToParam(t, dim.feature, dim.path, promoteAs.trim(), dim.label, v))
  return studio.editTree((t) => setFieldAt(t, dim.feature, dim.path, v))
}
