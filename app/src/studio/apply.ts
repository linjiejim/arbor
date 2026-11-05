// Executing a tool call: a pure edit of the feature tree, a rebuild through a
// kernel port (a Web Worker in the browser, the Kernel directly in Node), and
// a short plain-text result the model can act on.
import { Feature, OP_NAMES, Tree, displayName, type FeatureOp } from "./dsl"
import { resolveParams } from "./expr"
import type { BuildReport } from "./kernel/build"
import { InputError } from "./kernel/errors"
import type { ToolOutput } from "./tools"

export type KernelPort = {
  rebuild(tree: Tree): Promise<BuildReport>
  inspect(what: "body" | "faces" | "edges", selector?: unknown): Promise<string>
}

export type LookFn = (views: string[], highlight?: string) => Promise<string[]>

export type ToolRun = { tree: Tree; output: ToolOutput; report?: BuildReport; focus?: string }

const FEATURE_OPS = new Set(Object.keys(OP_NAMES))
const r1 = (x: number) => Math.round(x * 10) / 10

/** Ids a feature depends on (sketch, patterned features, selector `of`). */
export function referencesOf(f: Feature): string[] {
  const out = new Set<string>()
  const walk = (v: unknown, key?: string) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, key === "features" ? "feature-item" : undefined))
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k)
    else if (typeof v === "string" && (key === "of" || key === "sketch" || key === "feature-item")) out.add(v)
  }
  walk(f)
  out.delete(f.id)
  return [...out]
}

export function applyEdit(tree: Tree, name: string, input: Record<string, unknown>): { tree: Tree; target?: string } {
  if (name === "set_params") {
    const params = { ...tree.params }
    for (const k of (input.remove as string[] | undefined) ?? []) delete params[k]
    for (const [k, v] of Object.entries((input.set as Record<string, number | string>) ?? {})) {
      if (!/^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*$/.test(k)) throw new InputError(`参数名「${k}」不合法：用字母、数字、下划线或中文，不以数字开头`)
      params[k] = v
    }
    resolveParams(params) // unknown names / cycles fail here, before the tree changes
    return { tree: { ...tree, params } }
  }
  if (FEATURE_OPS.has(name)) {
    const { after, ...rest } = input as { after?: string } & Record<string, unknown>
    const parsed = Feature.safeParse({ ...rest, op: name })
    if (!parsed.success) throw new InputError(`参数不对：${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("；")}`)
    const f = parsed.data
    if (tree.features.some((x) => x.id === f.id)) throw new InputError(`已经有 id 为「${f.id}」的特征了，换一个 id，或用 edit_feature 修改它`)
    const features = [...tree.features]
    const at = after ? features.findIndex((x) => x.id === after) : features.length - 1
    if (after && at < 0) throw new InputError(`找不到特征「${after}」`)
    features.splice(at + 1, 0, f)
    return { tree: { ...tree, features }, target: f.id }
  }
  if (name === "edit_feature") {
    const { id, changes } = input as { id: string; changes: Record<string, unknown> }
    const i = tree.features.findIndex((x) => x.id === id)
    if (i < 0) throw new InputError(`找不到特征「${id}」`)
    const { op: _op, id: _id, ...rest } = changes ?? {}
    void _op
    void _id
    const parsed = Feature.safeParse({ ...tree.features[i], ...rest })
    if (!parsed.success) throw new InputError(`修改后的特征不合法：${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("；")}`)
    const features = [...tree.features]
    features[i] = parsed.data
    return { tree: { ...tree, features }, target: id }
  }
  if (name === "delete_feature") {
    const { id, cascade } = input as { id: string; cascade?: boolean }
    if (!tree.features.some((x) => x.id === id)) throw new InputError(`找不到特征「${id}」`)
    const doomed = new Set([id])
    let grew = true
    while (grew) {
      grew = false
      for (const f of tree.features) {
        if (!doomed.has(f.id) && referencesOf(f).some((r) => doomed.has(r))) {
          doomed.add(f.id)
          grew = true
        }
      }
    }
    doomed.delete(id)
    if (doomed.size && !cascade) throw new InputError(`后面的特征引用了「${id}」：${[...doomed].join("、")}。要一起删，设 cascade=true；或者先改它们的引用`)
    doomed.add(id)
    return { tree: { ...tree, features: tree.features.filter((f) => !doomed.has(f.id)) } }
  }
  throw new InputError(`未知工具「${name}」`)
}

export async function executeTool(port: KernelPort, tree: Tree, name: string, input: Record<string, unknown>, look?: LookFn): Promise<ToolRun> {
  try {
    if (name === "inspect") {
      const what = input.what as "tree" | "body" | "faces" | "edges"
      if (what === "tree") {
        const report = await port.rebuild(tree)
        return { tree, output: { ok: true, text: treeText(tree, report) }, report }
      }
      const text = await port.inspect(what, what === "faces" ? input.faces : what === "edges" ? input.edges : undefined)
      return { tree, output: { ok: true, text } }
    }
    if (name === "look") {
      if (!look) return { tree, output: { ok: false, text: "这个环境不能渲染视图。" } }
      const views = (input.views as string[] | undefined)?.length ? (input.views as string[]) : ["iso", "front", "top", "right"]
      const images = await look(views, input.highlight as string | undefined)
      return { tree, output: { ok: true, text: `视图：${views.join("、")}（蓝色 = 高亮的特征，灰色 = 其余）`, images } }
    }
    const { tree: next, target } = applyEdit(tree, name, input)
    const report = await port.rebuild(next)
    return { tree: next, output: { ok: resultOk(report, target), text: resultText(name, report, target) }, report, focus: target }
  } catch (e) {
    if (e instanceof InputError || (e as Error)?.name === "ExprError") return { tree, output: { ok: false, text: `✗ ${(e as Error).message}` } }
    return { tree, output: { ok: false, text: `✗ 出错了：${(e as Error)?.message ?? e}` } }
  }
}

function resultOk(report: BuildReport, target?: string) {
  if (report.paramError) return false
  if (!target) return report.features.every((f) => f.state === "ok")
  return report.features.find((f) => f.id === target)?.state === "ok"
}

export function bodyLine(report: BuildReport) {
  const b = report.body
  if (!b) return "还没有实体。"
  const solids = b.solids > 1 ? `，${b.solids} 个不相连的实体` : ""
  return `实体：${b.size.join(" × ")} mm，体积 ${r1(b.volume / 1000)} cm³${solids}。`
}

function resultText(name: string, report: BuildReport, target?: string) {
  const lines: string[] = []
  if (report.paramError) lines.push(`✗ 参数有错：${report.paramError}`)
  if (name === "set_params") lines.push(`参数：${Object.entries(report.params).map(([k, v]) => `${k}=${r1(v)}`).join("，")}`)
  if (name === "delete_feature") lines.push("已删除。")
  const r = target ? report.features.find((f) => f.id === target) : undefined
  if (r) {
    if (r.state === "ok") {
      const faces = r.faces ? `新生成 ${r.faces.new} 个面，修改 ${r.faces.modified} 个。` : ""
      lines.push(`✓ ${r.name}（${r.id}）：${r.summary ?? ""}。${faces}`)
    } else if (r.state === "error") {
      lines.push(`✗ ${r.name}（${r.id}）失败：${r.message}`)
      if (r.hint) lines.push(`建议：${r.hint}`)
      lines.push("这个特征留在特征树里并标为失败：用 edit_feature 修好它，或 delete_feature 删掉。")
    } else lines.push(`… ${r.name}（${r.id}）没有重建：前面有特征失败。`)
    for (const w of r.warnings ?? []) lines.push(`⚠ ${w}`)
  }
  const failed = report.features.filter((f) => f.state === "error" && f.id !== target)
  if (failed.length) lines.push(`特征树里还有失败的特征：${failed.map((f) => `${f.name}（${f.id}）：${f.message}`).join("；")}`)
  const skipped = report.features.filter((f) => f.state === "skipped").length
  if (skipped) lines.push(`因此后面 ${skipped} 个特征没有重建。`)
  lines.push(bodyLine(report))
  return lines.join("\n")
}

export function treeText(tree: Tree, report: BuildReport) {
  const params = Object.entries(tree.params)
    .map(([k, v]) => `${k} = ${v}${typeof v === "string" ? `（= ${r1(report.params[k] ?? NaN)}）` : ""}`)
    .join("，")
  const rows = tree.features.map((f, i) => {
    const r = report.features[i]
    const mark = r?.state === "ok" ? "✓" : r?.state === "error" ? "✗" : "…"
    const why = f.intent ? ` — ${f.intent}` : ""
    const msg = r?.state === "error" ? ` 失败：${r.message}` : ""
    return `${i + 1}. ${mark} ${f.id}（${displayName(tree, f)}，${OP_NAMES[f.op as FeatureOp]}）${r?.summary ? `：${r.summary}` : ""}${msg}${why}`
  })
  return [`参数：${params || "无"}`, ...(rows.length ? rows : ["（特征树是空的）"]), bodyLine(report)].join("\n")
}
