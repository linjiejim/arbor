// `check`: the agent writes down the numbers the person asked for, the kernel
// measures them, every line comes back ✓ or ✗. Same spirit as the web
// studio's evals: done means measured, not said.
import type { BuildReport } from "../../studio/kernel/build"
import type { MeasureResult } from "../../studio/kernel/measure"

type V3 = [number, number, number]
type Selector = Record<string, unknown>
export type Target = { face?: Selector; edge?: Selector }

export type CheckInput = {
  all_ok?: boolean
  solids?: number
  size?: V3
  min?: V3
  max?: V3
  volume?: number
  count?: { label?: string; faces?: Selector; edges?: Selector; expect: number }[]
  measure?: { label?: string; a: Target; b?: Target; name: string; value: number }[]
  tol?: number
  volume_tol?: number
}

export type CheckPort = {
  report: BuildReport
  /** Hashes a selector picks now (throws with the kernel's message when it can't resolve). */
  locate(kind: "face" | "edge", selector: Selector): Promise<number[] | null>
  measure(a: { kind: "face" | "edge"; hash: number }, b?: { kind: "face" | "edge"; hash: number }): Promise<MeasureResult | null>
}

export type CheckLine = { pass: boolean; text: string }

const r = (x: number) => String(Math.round(x * 1000) / 1000)
const xyz = (v: number[]) => v.map(r).join(" × ")

export async function runChecks(input: CheckInput, port: CheckPort): Promise<CheckLine[]> {
  const tol = input.tol ?? 0.01
  const out: CheckLine[] = []
  const { report } = port
  const body = report.body

  if (input.all_ok !== false) {
    const bad = report.features.filter((f) => f.state === "error" || f.state === "skipped")
    out.push(
      bad.length
        ? { pass: false, text: `特征全部重建成功：${bad.map((f) => `${f.name}（${f.id}）${f.state === "error" ? `失败：${f.message}` : "没有重建"}`).join("；")}` }
        : { pass: !report.paramError, text: report.paramError ? `参数有错：${report.paramError}` : "特征全部重建成功" },
    )
  }
  if (!body) {
    if (input.solids !== undefined || input.size || input.min || input.max || input.volume !== undefined || input.count?.length || input.measure?.length)
      out.push({ pass: false, text: "还没有实体，其余各项无法核对" })
    return out
  }
  if (input.solids !== undefined) out.push({ pass: body.solids === input.solids, text: `实体个数 ${input.solids}：现在 ${body.solids}` })
  if (input.size) {
    const ok = input.size.every((v, i) => Math.abs(body.size[i] - v) <= tol)
    out.push({ pass: ok, text: `尺寸 ${xyz(input.size)}：现在 ${xyz(body.size)}` })
  }
  if (input.min) {
    const ok = input.min.every((v, i) => Math.abs(body.bbox[0][i] - v) <= tol)
    out.push({ pass: ok, text: `包围盒最小角 (${input.min.map(r).join(", ")})：现在 (${body.bbox[0].map(r).join(", ")})` })
  }
  if (input.max) {
    const ok = input.max.every((v, i) => Math.abs(body.bbox[1][i] - v) <= tol)
    out.push({ pass: ok, text: `包围盒最大角 (${input.max.map(r).join(", ")})：现在 (${body.bbox[1].map(r).join(", ")})` })
  }
  if (input.volume !== undefined) {
    const rel = input.volume_tol ?? 0.005
    const ok = Math.abs(body.volume - input.volume) <= Math.abs(input.volume) * rel
    out.push({ pass: ok, text: `体积 ${r(input.volume)} mm³（±${r(rel * 100)}%）：现在 ${r(body.volume)} mm³` })
  }

  for (const c of input.count ?? []) {
    const kind = c.faces ? "face" : "edge"
    const selector = withoutExpect(c.faces ?? c.edges)
    const label = c.label ?? `${kind === "face" ? "面" : "边"} ${JSON.stringify(selector)}`
    if (!selector) {
      out.push({ pass: false, text: `${label}：要写 faces 或 edges` })
      continue
    }
    try {
      const hashes = await port.locate(kind, selector)
      out.push({ pass: hashes?.length === c.expect, text: `${label} 有 ${c.expect} 个：现在 ${hashes?.length ?? 0} 个` })
    } catch (e) {
      out.push({ pass: false, text: `${label}：${(e as Error).message}` })
    }
  }

  for (const m of input.measure ?? []) {
    const label = m.label ?? m.name
    try {
      const a = await one(port, m.a)
      const b = m.b ? await one(port, m.b) : undefined
      const res = await port.measure(a, b)
      const got = res ? valueOf(res, m.name, Boolean(b)) : null
      if (got === null) {
        const names = res ? [...res.items.flatMap((i) => i.facts.map((f) => f.split(" ")[0])), ...res.between.map((x) => x.name)] : []
        out.push({ pass: false, text: `${label}：量不出「${m.name}」${names.length ? `（能量的有：${[...new Set(names)].join("、")}）` : ""}` })
        continue
      }
      out.push({ pass: Math.abs(got - m.value) <= tol, text: `${label} ${r(m.value)}：现在 ${r(got)}` })
    } catch (e) {
      out.push({ pass: false, text: `${label}：${(e as Error).message}` })
    }
  }
  return out
}

async function one(port: CheckPort, t: Target) {
  const kind = t.face ? "face" : "edge"
  const selector = withoutExpect(t.face ?? t.edge)
  if (!selector) throw new Error("要写 face 或 edge 选择器")
  const hashes = await port.locate(kind, selector)
  if (!hashes?.length) throw new Error(`${kind === "face" ? "面" : "边"}的选择器什么都没选中：${JSON.stringify(selector)}`)
  if (hashes.length > 1) throw new Error(`${kind === "face" ? "面" : "边"}的选择器选中了 ${hashes.length} 个，要正好一个（加 near 或更多条件）：${JSON.stringify(selector)}`)
  return { kind, hash: hashes[0] } as const
}

/** `expect` is for building; here the count is what's being checked. */
function withoutExpect(s?: Selector) {
  if (!s) return null
  const { expect: _expect, ...rest } = s
  void _expect
  return rest
}

/** English names agents reach for first, to the kernel's own. */
const ALIASES: Record<string, string[]> = {
  diameter: ["直径"],
  area: ["面积"],
  length: ["长"],
  distance: ["最短距离"],
  min_distance: ["最短距离"],
  gap: ["平行面间距", "平行，间距"],
  parallel_distance: ["平行面间距", "平行，间距"],
  thickness: ["平行面间距"],
  angle: ["两面夹角", "夹角", "轴线夹角", "边与平面夹角", "轴线与平面夹角"],
  center_distance: ["圆心距"],
  axis_distance: ["轴线间距"],
}

/** The number in 「直径 ⌀8（R4）」 or 「最短距离 12.5 mm」 under the asked name (or an English alias). */
export function valueOf(res: MeasureResult, name: string, pair: boolean): number | null {
  const lines = pair ? res.between.map((b) => `${b.name} ${b.value}`) : res.items[0]?.facts ?? []
  for (const n of [name, ...(ALIASES[name.trim().toLowerCase()] ?? [])]) {
    const hit = lines.find((l) => l.startsWith(n))
    const m = hit?.slice(n.length).match(/-?\d+(?:\.\d+)?/)
    if (m) return Number(m[0])
  }
  return null
}

export function checkText(lines: CheckLine[]) {
  const failed = lines.filter((l) => !l.pass).length
  const head = failed ? `核对：${lines.length - failed}/${lines.length} 通过，${failed} 项不满足` : `核对：${lines.length}/${lines.length} 全部通过`
  return [head, ...lines.map((l) => `${l.pass ? "✓" : "✗"} ${l.text}`)].join("\n")
}
