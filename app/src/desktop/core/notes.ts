// Notes: the person clicks a face or an edge in the window and writes what
// should change there. Stored next to the part file; read by the agent with
// get_notes, in the same words the web studio uses for its annotations.
import type { PickInfo } from "../../studio/annotations"
import type { NoteAbout, PartNote, V3 } from "./protocol"

const r = (x: number) => Math.round(x * 100) / 100
const xyz = (p: number[]) => `(${p.map(r).join(", ")})`

export type NotesFile = { next: number; notes: PartNote[] }

export const EMPTY_NOTES: NotesFile = { next: 1, notes: [] }

export function parseNotes(text: string | null): NotesFile {
  if (!text) return { ...EMPTY_NOTES, notes: [] }
  try {
    const raw = JSON.parse(text) as Partial<NotesFile>
    const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is PartNote => typeof n?.id === "string" && typeof n?.n === "number") : []
    const next = Math.max(typeof raw.next === "number" ? raw.next : 1, ...notes.map((n) => n.n + 1))
    return { next, notes }
  } catch {
    return { ...EMPTY_NOTES, notes: [] }
  }
}

/**
 * A note on a clicked face or an edge; or (no pick) about parts, a step or an area (`about`), or
 * else the part or assembly as a whole. `image`: where the area's picture was saved, if it was.
 */
export function newNote(file: NotesFile, pick: PickInfo | null, text: string, about: NoteAbout = {}, image?: string): PartNote {
  const n = file.next
  const base = { id: `n${n}`, n, text: text.trim(), status: "open" as const, createdAt: Date.now() }
  const blank = { what: "", where: "", facts: "", origins: [] as string[], point: [0, 0, 0] as V3, selector: null, sketch: null }
  if (pick)
    return {
      ...base,
      kind: pick.kind,
      what: pick.what,
      where: pick.where,
      facts: pick.facts,
      origins: pick.origins,
      part: pick.part,
      point: pick.point as V3,
      selector: pick.selector,
      sketch: pick.sketch,
      smooth: pick.smooth || undefined,
    }
  const at = about.point ? { point: about.point, ...(about.part ? { part: about.part } : {}) } : { pin: false as const }
  if (about.region) {
    const { origins, parts, image: _drop, ...region } = about.region
    void _drop
    return { ...base, ...blank, kind: "region", origins, parts, ...at, region: { ...region, ...(image ? { image } : {}) } }
  }
  if (about.feature) return { ...base, ...blank, kind: "feature", feature: about.feature, what: about.name ?? about.feature, origins: [about.feature], ...at }
  if (about.parts?.length) return { ...base, ...blank, kind: "parts", parts: about.parts, ...at }
  return { ...base, ...blank, kind: "part" }
}

/** Notes with a pin on the model (the whole file has none, nor a step without faces). */
export const pinned = (n: PartNote) => n.kind !== "part" && n.pin !== false

const SIDES: [V3, string][] = [
  [[1, 0, 0], "右"],
  [[-1, 0, 0], "左"],
  [[0, -1, 0], "前"],
  [[0, 1, 0], "后"],
  [[0, 0, 1], "上"],
  [[0, 0, -1], "下"],
]
/** Where a camera looks from, in words: 「从右前上方看」. */
export function viewWords(camera: { position: V3; target: V3 }) {
  const d = camera.position.map((v, k) => v - camera.target[k])
  const len = Math.hypot(...d) || 1
  const sides = SIDES.filter(([dir]) => dir.reduce((a, v, k) => a + (v * d[k]) / len, 0) > 0.35).map(([, w]) => w)
  return sides.length ? `从${sides.join("")}方看` : "从正面看"
}

const quote = (names: string[]) => names.map((n) => `「${n}」`).join("")

type Where = Pick<PartNote, "kind" | "what" | "where" | "origins" | "facts" | "point" | "selector" | "sketch" | "smooth"> & Partial<Pick<PartNote, "parts" | "feature" | "region" | "pin">>

/** What the agent reads about where a note is. `whole`: 零件 or 装配, for a note about the file as a whole. */
export function pickLines(p: Where, whole = "零件"): string[] {
  if (p.kind === "part") return [`- 关于整个${whole}（没有点在某个面或边上）`]
  const at = p.pin === false ? [] : [`- 标在 ${xyz(p.point)}`]
  if (p.kind === "parts") return [`- 关于零件${quote(p.parts ?? [])}（选中的整个零件，没有点在某个面或边上）`, ...at]
  if (p.kind === "feature") return [`- 关于步骤「${p.what}」（特征 id：${p.feature}）`, ...at]
  if (p.kind === "region") {
    const r = p.region
    const how = r?.shape === "pen" ? "用画笔在模型上圈出" : "在画面上框出"
    const lines = [`- ${how}的一片区域${r ? `，${viewWords(r.camera)}` : ""}：${r?.faces ?? 0} 个面${p.parts?.length ? `，零件${quote(p.parts)}` : ""}${p.origins.length ? `，来自特征 ${p.origins.join("、")}` : ""}`]
    if (r?.bbox) lines.push(`- 范围 ${xyz(r.bbox[0])} 到 ${xyz(r.bbox[1])}`)
    if (r?.image) lines.push(`- 当时的画面（画着${r.shape === "pen" ? "笔画" : "框"}）：${r.image}`)
    return [...lines, ...at]
  }
  const what = p.kind === "face" ? "面" : "边"
  const ids = p.origins.length ? `（特征 id：${p.origins.join("、")}）` : ""
  const lines = [`- 选中：${what} · ${p.what} · ${p.where}${ids} · ${p.facts}`, `- 点击位置：${xyz(p.point)}`]
  if (p.smooth) lines.push("- 这是圆角和相邻面之间的相切线：两侧光滑过渡，没有棱角，不能单独倒圆角或倒角")
  if (p.selector) {
    const use = p.kind === "edge" && !p.smooth ? "（圆角、倒角的 edges 直接用它）" : ""
    lines.push(`- 已验证只选中它的选择器${use}：${JSON.stringify(p.selector)}`)
  } else lines.push("- 没能找到只选中它的选择器：用 inspect 和点击位置（near）确认")
  if (p.sketch && p.selector) {
    const { expect: _expect, ...face } = p.selector
    void _expect
    lines.push(
      `- 在这个面上画草图：on = ${JSON.stringify({ plane: p.sketch.plane, face })}；点击处的草图坐标 (${p.sketch.uv.map(r).join(", ")})（这个面在 ${p.sketch.plane} 基准面偏移 ${r(p.sketch.offset)} 处）`,
    )
  }
  return lines
}

export function noteText(note: PartNote, whole = "零件") {
  const head = `[备注 ${note.id}${note.status === "resolved" ? " · 已处理" : ""}] ${note.text || "（没写字，只点了位置）"}`
  const lines = [head, ...pickLines(note, whole)]
  if (note.reply) lines.push(`- 你的回复：${note.reply}`)
  return lines.join("\n")
}

export function notesText(notes: PartNote[], all: boolean, whole = "零件") {
  const list = all ? notes : notes.filter((n) => n.status === "open")
  if (!list.length) return all ? `这个${whole}还没有备注。` : "没有未处理的备注。"
  const head = all ? `共 ${list.length} 条备注：` : `${list.length} 条未处理的备注（look 的图里画着同样的编号）：`
  return [head, ...list.map((n) => noteText(n, whole))].join("\n\n")
}
