// Notes: the person clicks a face or an edge in the window and writes what
// should change there. Stored next to the part file; read by the agent with
// get_notes, in the same words the web studio uses for its annotations.
import type { PickInfo } from "../../studio/annotations"
import type { PartNote, V3 } from "./protocol"

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

/** A note on a clicked face or edge, or (no pick) about the part as a whole. */
export function newNote(file: NotesFile, pick: PickInfo | null, text: string): PartNote {
  const n = file.next
  const base = { id: `n${n}`, n, text: text.trim(), status: "open" as const, createdAt: Date.now() }
  if (!pick) return { ...base, kind: "part", what: "", where: "", facts: "", origins: [], point: [0, 0, 0], selector: null, sketch: null }
  return {
    ...base,
    kind: pick.kind,
    what: pick.what,
    where: pick.where,
    facts: pick.facts,
    origins: pick.origins,
    point: pick.point as V3,
    selector: pick.selector,
    sketch: pick.sketch,
    smooth: pick.smooth || undefined,
  }
}

/** What the agent reads about a pick: the same facts an annotation carries. */
export function pickLines(p: Pick<PartNote, "kind" | "what" | "where" | "origins" | "facts" | "point" | "selector" | "sketch" | "smooth">): string[] {
  if (p.kind === "part") return ["- 关于整个零件（没有点在某个面或边上）"]
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

export function noteText(note: PartNote) {
  const head = `[备注 ${note.id}${note.status === "resolved" ? " · 已处理" : ""}] ${note.text || "（没写字，只点了位置）"}`
  const lines = [head, ...pickLines(note)]
  if (note.reply) lines.push(`- 你的回复：${note.reply}`)
  return lines.join("\n")
}

export function notesText(notes: PartNote[], all: boolean) {
  const list = all ? notes : notes.filter((n) => n.status === "open")
  if (!list.length) return all ? "这个零件还没有备注。" : "没有未处理的备注。"
  const head = all ? `共 ${list.length} 条备注：` : `${list.length} 条未处理的备注（look 的图里画着同样的编号）：`
  return [head, ...list.map(noteText)].join("\n\n")
}
