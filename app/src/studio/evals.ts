// Phase-0 evaluation set: prompts with checks a kernel can verify. Sizes are
// compared sorted (orientation-agnostic); `upright` additionally checks the
// expected X/Y/Z extents for prompts that state an orientation.
import type { BuildReport } from "./kernel/build"
import type { Tree } from "./dsl"

export type EvalCase = {
  id: string
  prompt: string
  size: [number, number, number]
  upright?: boolean
  volume?: number
  ops?: string[]
  /** Upper bound on volume: proves a part is hollow without prescribing how. */
  maxVolume?: number
}

const PI = Math.PI

export const EVALS: EvalCase[] = [
  { id: "block-fillet", prompt: "做一个 60×40×20 的长方体（长沿 X、宽沿 Y、高沿 Z），竖直的 4 条棱倒 R5 圆角。", size: [60, 40, 20], upright: true, volume: 60 * 40 * 20 - 4 * (25 - (PI * 25) / 4) * 20, ops: ["extrude", "fillet"] },
  { id: "plate-holes", prompt: "做一块 100×60×5 的安装板，四角各一个 ⌀6 的通孔，孔中心离两条边各 8 mm。", size: [100, 60, 5], upright: true, volume: 100 * 60 * 5 - 4 * PI * 9 * 5, ops: ["hole"] },
  { id: "box-shell", prompt: "做一个外形 80×50×30 的盒子，顶部开口，壁厚 2，外部 4 条竖边 R6 圆角。", size: [80, 50, 30], upright: true, ops: ["shell", "fillet"] },
  { id: "flange", prompt: "做一个法兰盘：外径 120、厚 10 的圆盘，中心 ⌀40 通孔，在 ⌀90 的圆周上均布 6 个 ⌀8 通孔。", size: [120, 120, 10], upright: true, volume: PI * (3600 - 400) * 10 - 6 * PI * 16 * 10 },
  { id: "stepped-shaft", prompt: "做一根阶梯轴，轴线沿 Z：⌀20 长 30，接着 ⌀14 长 25，再接 ⌀10 长 15。", size: [20, 20, 70], upright: true, volume: PI * (100 * 30 + 49 * 25 + 25 * 15), ops: ["revolve"] },
  { id: "mug", prompt: "做一个杯子：外径 80、高 100，壁厚 3，杯口开口，杯底外缘 R5 圆角。", size: [80, 80, 100], upright: true, maxVolume: 0.25 * PI * 1600 * 100 },
  { id: "boss-plate", prompt: "做一块 100×100×10 的底板，顶面中间放一个 ⌀30、高 40 的圆柱凸台，凸台中心有一个 ⌀10 的通孔，贯穿凸台和底板。", size: [100, 100, 50], upright: true, volume: 100 * 100 * 10 + PI * 225 * 40 - PI * 25 * 50 },
  { id: "l-bracket", prompt: "做一个 L 形支架：底板 80×40×5（长沿 X），在底板 +Y 一侧的边上立一块 80×5 的立板，立板总高 50（从底板底面算起），两板内侧交线做 R3 圆角。", size: [80, 40, 50], upright: true },
  { id: "hex-nut", prompt: "做一个简化的六角螺母：对边 13、厚 6.5，中心 ⌀6.8 通孔，上下两个端面的外缘各倒角 C0.8。", size: [15.01, 13, 6.5], ops: ["chamfer"] },
  { id: "rib-plate", prompt: "做一块 120×80×4 的底板，顶面上沿 X 方向等距放 3 条加强筋（每条长 100、宽 3、高 12），筋间距 25，中间那条在 Y=0。", size: [120, 80, 16], upright: true, volume: 120 * 80 * 4 + 3 * 100 * 3 * 12 },
]

export type EvalCheck = { name: string; pass: boolean; detail: string }

export function checkCase(c: EvalCase, tree: Tree, report: BuildReport): EvalCheck[] {
  const out: EvalCheck[] = []
  const b = report.body
  const failed = report.features.filter((f) => f.state !== "ok")
  out.push({ name: "重建成功", pass: !!b && failed.length === 0, detail: failed.map((f) => `${f.id}: ${f.message ?? f.state}`).join("; ") || "ok" })
  if (!b) return out
  const sorted = (v: number[]) => [...v].sort((a, z) => z - a)
  const close = (a: number, z: number, rel = 0.02) => Math.abs(a - z) <= Math.max(0.2, rel * Math.abs(z))
  const sz = sorted(b.size)
  const want = sorted(c.size)
  out.push({ name: "尺寸", pass: sz.every((x, i) => close(x, want[i])), detail: `${b.size.join("×")} vs ${c.size.join("×")}` })
  if (c.upright) out.push({ name: "方向", pass: b.size.every((x, i) => close(x, c.size[i])), detail: `X/Y/Z = ${b.size.join(" / ")}` })
  if (c.volume) out.push({ name: "体积", pass: close(b.volume, c.volume, 0.02), detail: `${Math.round(b.volume)} vs ${Math.round(c.volume)}` })
  out.push({ name: "单一实体", pass: b.solids === 1, detail: `${b.solids}` })
  out.push({ name: "参数化", pass: Object.keys(tree.params).length >= 2, detail: `${Object.keys(tree.params).length} 个参数` })
  if (c.maxVolume) out.push({ name: "空心", pass: b.volume <= c.maxVolume, detail: `${Math.round(b.volume)} ≤ ${Math.round(c.maxVolume)}` })
  if (c.ops) {
    const have = new Set(tree.features.map((f) => f.op))
    const missing = c.ops.filter((o) => !have.has(o as never))
    out.push({ name: "用到的特征", pass: missing.length === 0, detail: missing.length ? `缺 ${missing.join(", ")}` : "ok" })
  }
  return out
}
