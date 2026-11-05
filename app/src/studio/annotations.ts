// Annotations: the learner clicks a face or an edge, writes what should change
// there, and the message carries exactly which geometry they meant — as a
// selector the kernel has already checked picks only that one.
import { z } from "zod"

type V3 = [number, number, number]

/** What the kernel says about a clicked face or edge of the latest body. */
export type PickInfo = {
  kind: "face" | "edge"
  /** Mesh hash of the face / edge, to highlight it in the viewport. */
  hash: number
  point: V3
  /** 「平面 · 朝上（+Z）」 */
  what: string
  /** 「来自「拉伸1」」 or 「在「拉伸1」和「圆角1」的面之间」 */
  where: string
  /** Feature ids behind `where`, for the model. */
  origins: string[]
  /** 「面积 2400 mm²」 */
  facts: string
  /** Verified to pick exactly this face / edge; null when no selector could. */
  selector: Record<string, unknown> | null
  /** Edges: the faces on both sides meet smoothly (a fillet's tangent line), so it can't be filleted itself. */
  smooth?: boolean
  /** Planar faces facing along an axis: the datum plane, its offset and the click in sketch coordinates. */
  sketch: { plane: "XY" | "XZ" | "YZ"; offset: number; uv: [number, number] } | null
}

const Short = z.string().max(300)

/** As stored in the user message's metadata (and checked again on the server). */
export const Annotation = z.object({
  n: z.number().int().min(1).max(20),
  note: z.string().max(600),
  kind: z.enum(["face", "edge"]),
  what: Short,
  where: Short,
  origins: z.array(z.string().max(64)).max(4),
  facts: Short,
  point: z.array(z.number()).length(3),
  selector: z.record(z.string(), z.unknown()).nullable(),
  smooth: z.boolean().optional(),
  sketch: z
    .object({ plane: z.enum(["XY", "XZ", "YZ"]), offset: z.number(), uv: z.array(z.number()).length(2) })
    .nullable(),
})
export type Annotation = z.infer<typeof Annotation>
export const Annotations = z.array(Annotation).max(20)

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
export const circled = (n: number) => CIRCLED[n - 1] ?? `(${n})`
/** ① → 1, for links in replies. */
export const circledNumber = (ch: string) => CIRCLED.indexOf(ch) + 1
export const CIRCLED_RE = /[①-⑳]/g

const r = (x: number) => Math.round(x * 100) / 100
const xyz = (p: number[]) => `(${p.map(r).join(", ")})`

/** The block appended to a user message for the model. */
export function annotationText(list: Annotation[]): string {
  const blocks = list.map((a) => {
    const what = a.kind === "face" ? "面" : "边"
    const ids = a.origins.length ? `（特征 id：${a.origins.join("、")}）` : ""
    const lines = [
      `[标注 ${circled(a.n)}] 学习者的备注：${a.note.trim() || "（没写备注，结合正文理解）"}`,
      `- 选中：${what} · ${a.what} · ${a.where}${ids} · ${a.facts}`,
      `- 点击位置：${xyz(a.point)}`,
    ]
    if (a.smooth) lines.push("- 这是圆角和相邻面之间的相切线：两侧光滑过渡，没有棱角，不能单独倒圆角或倒角")
    if (a.selector) {
      const use = a.kind === "edge" && !a.smooth ? "（圆角、倒角的 edges 直接用它）" : ""
      lines.push(`- 已验证只选中它的选择器${use}：${JSON.stringify(a.selector)}`)
    } else lines.push("- 没能找到只选中它的选择器：用 inspect 和点击位置（near）确认")
    if (a.sketch && a.selector) {
      const { expect: _expect, ...face } = a.selector
      lines.push(
        `- 在这个面上画草图：on = ${JSON.stringify({ plane: a.sketch.plane, face })}；点击处的草图坐标 (${a.sketch.uv.map(r).join(", ")})（这个面在 ${a.sketch.plane} 基准面偏移 ${r(a.sketch.offset)} 处）`,
      )
    }
    return lines.join("\n")
  })
  return `## 标注（学习者在模型上点选的位置；附图里的编号和这里一致）\n${blocks.join("\n\n")}`
}
