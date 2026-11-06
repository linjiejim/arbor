import type { Tree } from "./dsl"
import { checkTree } from "./limits"

/** A shared snapshot's raw JSON (with chat) is the largest thing worth importing. */
const MAX_FILE = 1024 * 1024

export type Imported = { ok: true; tree: Tree; name: string } | { ok: false; message: string }

/**
 * A feature tree from a file: what 「导出特征树（JSON）」 writes, or a shared
 * link's raw snapshot ({ title, tree, … }). Checked like a shared link, since
 * it may come from anyone.
 */
export async function readTreeFile(file: File): Promise<Imported> {
  if (!/\.json$/i.test(file.name) && file.type !== "application/json") return { ok: false, message: "只能导入 .json 文件（「导出特征树（JSON）」导出的那种）" }
  if (file.size > MAX_FILE) return { ok: false, message: `文件太大了（${Math.ceil(file.size / 1024)} KB，最多 ${MAX_FILE / 1024} KB）` }
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch (e) {
    return { ok: false, message: `不是有效的 JSON：${(e as Error).message}` }
  }
  return parseTreeJson(raw, file.name.replace(/\.json$/i, ""))
}

export function parseTreeJson(raw: unknown, fallbackName: string): Imported {
  const wrapped = raw && typeof raw === "object" && !Array.isArray(raw) && !("features" in raw) && "tree" in raw
  const snap = wrapped ? (raw as { title?: unknown; tree: unknown }) : null
  const checked = checkTree(snap ? snap.tree : raw)
  if (!checked.ok) return { ok: false, message: checked.message }
  if (!checked.tree.features.length) return { ok: false, message: "这棵特征树是空的，没有特征" }
  const name = snap && typeof snap.title === "string" && snap.title.trim() ? snap.title.trim().slice(0, 60) : fallbackName
  return { ok: true, tree: checked.tree, name }
}
