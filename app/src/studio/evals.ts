// Phase-0 evaluation set: prompts with checks a kernel can verify. Sizes are
// compared sorted (orientation-agnostic); `upright` additionally checks the
// expected X/Y/Z extents for prompts that state an orientation.
import type { PickInfo } from "./annotations"
import type { BuildReport } from "./kernel/build"
import type { Tree } from "./dsl"

type V3 = [number, number, number]

/** A click the learner makes before asking: which face / edge, where, and the note. */
export type EvalNote = { kind: "face" | "edge"; match: (p: PickInfo) => boolean; point?: V3; note: string }

/** Read access to the finished model, for checks the generic ones can't express. */
export type EvalQuery = { inspect: (what: "body" | "faces" | "edges", selector: unknown) => string }

export type EvalCase = {
  id: string
  prompt: string
  size: [number, number, number]
  upright?: boolean
  volume?: number
  ops?: string[]
  /** Upper bound on volume: proves a part is hollow without prescribing how. */
  maxVolume?: number
  /** Annotation cases: the model the learner starts from, and what they clicked. */
  start?: Tree
  notes?: EvalNote[]
  extra?: (q: EvalQuery) => EvalCheck[]
  /** A sketch text that must be in the tree. */
  text?: string
  /** A field the tree must use (design intent, e.g. "until"): searched in the features' JSON. */
  uses?: string
}

const plate = (L: number, W: number, T: number): Tree => ({
  params: { L, W, T },
  features: [
    { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
    { id: "base", op: "extrude", sketch: "sk", distance: "T" },
  ],
})

/** Centres of the faces an `inspect faces` listing shows. */
const centres = (listing: string) => [...listing.matchAll(/中心\(([^)]+)\)/g)].map((m) => m[1].split(",").map(Number))

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
  {
    id: "anno-hole",
    prompt: "按标注修改。",
    start: plate(100, 60, 10),
    notes: [{ kind: "face", match: (p) => p.what.includes("朝上"), point: [25, 10, 10], note: "在这里开一个 ⌀8 的通孔" }],
    size: [100, 60, 10],
    upright: true,
    volume: 100 * 60 * 10 - PI * 16 * 10,
    extra: (q) => {
      const c = centres(q.inspect("faces", { kind: "cylinder", radius: 4 }))
      const ok = c.length === 1 && Math.abs(c[0][0] - 25) < 1 && Math.abs(c[0][1] - 10) < 1
      return [{ name: "孔在点的位置", pass: ok, detail: c.map((x) => `(${x.join(", ")})`).join(" ") || "没有 R4 的孔" }]
    },
  },
  {
    id: "anno-slope",
    prompt: "按标注修改。",
    start: {
      params: {},
      features: [
        { id: "s", op: "sketch", name: "楔形截面", on: { plane: "XZ" }, shapes: [{ type: "polyline", points: [[-20, 0], [20, 0], [20, 30], [-20, 10]] }] },
        { id: "w", op: "extrude", name: "楔形块", sketch: "s", distance: 40, direction: "both" },
      ],
    },
    notes: [{ kind: "face", match: (p) => p.sketch?.face !== undefined, point: [8, -10, 24], note: "在这里开一个 ⌀6、深 5 的孔，孔垂直于斜面" }],
    size: [40, 40, 30],
    upright: true,
    extra: (q) => {
      const c = centres(q.inspect("faces", { kind: "cylinder", radius: 3 }))
      // The hole's axis is the slope's normal; it must pass within 1 mm of the click.
      const n = [-0.447, 0, 0.894]
      const off = c.map((x) => {
        const d = [8 - x[0], -10 - x[1], 24 - x[2]]
        return Math.hypot(d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0])
      })
      return [{ name: "孔在点的位置、垂直斜面", pass: c.length === 1 && off[0] < 1, detail: c.map((x, i) => `(${x.join(", ")}) 偏 ${off[i].toFixed(2)}`).join(" ") || "没有 R3 的孔" }]
    },
  },
  {
    id: "anno-edge",
    prompt: "按标注修改。",
    start: plate(60, 40, 20),
    notes: [{ kind: "edge", match: (p) => p.what.includes("沿 Z") && Math.abs(p.point[0] - 30) < 1 && Math.abs(p.point[1] - 20) < 1, note: "这条棱倒 R5 圆角，其他棱不动" }],
    size: [60, 40, 20],
    upright: true,
    volume: 60 * 40 * 20 - (25 - (PI * 25) / 4) * 20,
    extra: (q) => {
      const c = centres(q.inspect("faces", { kind: "cylinder", radius: 5 }))
      return [{ name: "只倒了那一条棱", pass: c.length === 1 && c[0][0] > 20 && c[0][1] > 10, detail: c.map((x) => `(${x.join(", ")})`).join(" ") || "没有 R5 圆角" }]
    },
  },
  {
    id: "anno-boss",
    prompt: "按标注修改。",
    start: {
      params: { L: 100, T: 10, D: 30, h: 20 },
      features: [
        { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "L" }] },
        { id: "base", op: "extrude", sketch: "sk", distance: "T" },
        { id: "bsk", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "circle", d: "D" }] },
        { id: "boss", op: "extrude", sketch: "bsk", distance: "h" },
      ],
    },
    notes: [{ kind: "face", match: (p) => p.what.includes("朝上") && p.origins.includes("boss"), note: "把这个凸台加高 10 mm" }],
    size: [100, 100, 40],
    upright: true,
    volume: 100 * 100 * 10 + PI * 225 * 30,
  },
  {
    id: "nameplate",
    prompt: "做一块 70×30×4 的铭牌，四个竖角 R3 圆角，顶面居中刻上「FeatureTree」，字号 7，深 0.5。",
    size: [70, 30, 4],
    upright: true,
    maxVolume: 70 * 30 * 4 - 10,
    text: "FeatureTree",
    extra: (q) => {
      const floor = centres(q.inspect("faces", { normal: "+Z" })).filter((c) => Math.abs(c[2] - 3.5) < 0.05)
      return [{ name: "刻在顶面下 0.5", pass: floor.length > 0, detail: `${floor.length} 个字底面在 z=3.5` }]
    },
  },
  {
    id: "back-text",
    prompt: "做一个 60×40×20 的方块（长沿 X、宽沿 Y），在朝 +Y 的背面中间刻上「工程」两个字，字号 10，深 0.5。",
    size: [60, 40, 20],
    upright: true,
    maxVolume: 60 * 40 * 20 - 10,
    text: "工程",
    extra: (q) => {
      const floor = centres(q.inspect("faces", { normal: "+Y" })).filter((c) => Math.abs(c[1] - 19.5) < 0.05)
      return [{ name: "刻在背面里 0.5", pass: floor.length > 0, detail: `${floor.length} 个字底面在 y=19.5` }]
    },
  },
  {
    id: "tapped-plate",
    prompt: "做一块 60×40×8 的板，四角各一个 M4 螺纹孔，孔中心离两条边各 6 mm，螺纹孔深 6。",
    size: [60, 40, 8],
    upright: true,
    extra: (q) => {
      // Tapped M4: the tap drill is ⌀3.3, from the standard table rather than a guess.
      const c = centres(q.inspect("faces", { kind: "cylinder", radius: 1.65 }))
      const corners = c.filter((p) => Math.abs(Math.abs(p[0]) - 24) < 0.5 && Math.abs(Math.abs(p[1]) - 14) < 0.5)
      return [{ name: "四个 M4 底孔 ⌀3.3", pass: corners.length === 4, detail: `${c.length} 个 R1.65 的孔面，${corners.length} 个在角上` }]
    },
  },
  {
    id: "slope-boss",
    prompt: "做一个楔形块：底面 40×40（中心在原点），X=-20 那头高 10、X=20 那头高 30，顶面是一个斜面。在斜面中心放一个 ⌀10、高 3 的圆柱凸台，凸台轴线垂直于斜面。",
    size: [40, 40, 30],
    upright: true,
    extra: (q) => {
      const c = centres(q.inspect("faces", { kind: "cylinder", radius: 5 }))
      const ok = c.length === 1 && Math.abs(c[0][0]) < 2 && Math.abs(c[0][1]) < 1 && c[0][2] > 20
      return [{ name: "凸台立在斜面中心", pass: ok, detail: c.map((x) => `(${x.join(", ")})`).join(" ") || "没有 R5 的圆柱面" }]
    },
  },
  {
    id: "up-to-next",
    prompt: "做一个门字形支架：底板 80×60×8，左右两侧各一块厚 8、高 40 的竖板（和底板一样宽，贴着底板两端），顶上盖一块 80×60×6 的顶板；在底板中心立一根 ⌀16 的圆柱，向上一直长到碰到顶板为止。",
    size: [80, 60, 54],
    upright: true,
    volume: 80 * 60 * 8 + 2 * 8 * 60 * 40 + 80 * 60 * 6 + PI * 64 * 40,
    uses: "until",
  },
  {
    id: "thin-angle",
    prompt: "用一条 L 形的开放线（横 40、竖 30，画在前视基准面上）做一根厚 3、长 50 的角钢：用薄壁拉伸，厚度向里。",
    size: [40, 50, 30],
    volume: (40 + 30 - 3) * 3 * 50,
    uses: "thin",
  },
  {
    id: "gusset",
    prompt: "做一个 L 形支架：底板 60×30×6（长沿 X、宽沿 Y，中心在原点），在 X=-30 那头立一块厚 6、总高 50 的立板（和底板一样宽）。中间加一条厚 4 的三角加强筋：从立板内侧离地 40 处，斜着连到底板顶面 X=10 处。",
    size: [60, 30, 50],
    upright: true,
    volume: 60 * 30 * 6 + 6 * 30 * 44 + (34 * 34) / 2 * 4,
    uses: "rib",
  },
  {
    id: "split-enclosure",
    prompt: "做一个 80×50×30 的封闭外壳（长沿 X、宽沿 Y），壁厚 2，在离底 20 mm 处拆成底壳和上盖；上盖顶面中间开一个 ⌀10 的按键孔。",
    size: [80, 50, 30],
    upright: true,
    volume: 80 * 50 * 30 - 76 * 46 * 26 - PI * 25 * 2,
    uses: "split",
    extra: (q) => {
      const body = q.inspect("body", undefined)
      const parts = body.match(/零件：(.*)/)?.[1] ?? ""
      const ok = /底壳（80 × 50 × 20 mm/.test(parts) && /上盖（80 × 50 × 10 mm/.test(parts)
      const hole = centres(q.inspect("faces", { kind: "cylinder", radius: 5 }))
      return [
        { name: "两个零件：底壳高 20、上盖高 10", pass: ok, detail: parts || "没有零件" },
        { name: "按键孔只在上盖", pass: hole.length === 1 && hole[0][2] > 25, detail: hole.map((x) => `(${x.join(", ")})`).join(" ") || "没有 R5 的孔" },
      ]
    },
  },
  {
    id: "split-long",
    prompt: "做一根 300×20×20 的方杆（长沿 X，中心在原点）。打印机最长只能打 200，从中间把它拆成两段。",
    size: [300, 20, 20],
    upright: true,
    volume: 300 * 20 * 20,
    uses: "split",
    extra: (q) => {
      const parts = q.inspect("body", undefined).match(/零件：(.*)/)?.[1] ?? ""
      const sizes = [...parts.matchAll(/（(\d+(?:\.\d+)?) × 20 × 20 mm/g)].map((m) => Number(m[1]))
      return [{ name: "两段，各长 150", pass: sizes.length === 2 && sizes.every((x) => Math.abs(x - 150) < 0.5), detail: parts || "没有零件" }]
    },
  },
  { id: "rib-plate", prompt: "做一块 120×80×4 的底板，顶面上沿 X 方向等距放 3 条加强筋（每条长 100、宽 3、高 12），筋间距 25，中间那条在 Y=0。", size: [120, 80, 16], upright: true, volume: 120 * 80 * 4 + 3 * 100 * 3 * 12 },
]

export type EvalCheck = { name: string; pass: boolean; detail: string }

export function checkCase(c: EvalCase, tree: Tree, report: BuildReport, q?: EvalQuery): EvalCheck[] {
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
  if (c.text) {
    const texts = tree.features.flatMap((f) => (f.op === "sketch" ? f.shapes.flatMap((s) => (s.type === "text" ? [s.text] : [])) : []))
    out.push({ name: "文字", pass: texts.some((t) => t.includes(c.text!)), detail: texts.join(" / ") || "没有文字" })
  }
  if (c.uses) {
    const used = tree.features.some((f) => JSON.stringify(f).includes(`"${c.uses}"`))
    out.push({ name: `用到 ${c.uses}`, pass: used, detail: used ? "ok" : "没用到，手算了尺寸" })
  }
  if (c.extra && q) out.push(...c.extra(q))
  return out
}
