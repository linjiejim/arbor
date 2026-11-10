// Conversations with the built-in assistant, as they are kept on disk (~/.turnery/chats/<id>.json):
// what a saved chat holds, how it is named, and what is left out to keep the file small.
import type { UIMessage } from "ai"

/** One saved conversation. `project` and `part` say where it was held, to list it there again. */
export type ChatRecord = {
  id: string
  title: string
  /** The project folder the window had open, or null for loose parts. */
  project: string | null
  /** The part open when the conversation began. */
  part: string | null
  createdAt: number
  updatedAt: number
  messages: UIMessage[]
}

/** The list entry: everything but the messages. */
export type ChatSummary = Omit<ChatRecord, "messages"> & { count: number }

/** Saved chats per folder; older ones go first. */
export const MAX_CHATS = 200

export const CHAT_ID = /^c-[a-z0-9]{6,32}$/

export function newChatId(now = Date.now()) {
  return `c-${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** The first thing the person said, on one line. */
export function chatTitle(messages: UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue
    const text = m.parts
      .flatMap((p) => (p.type === "text" ? [p.text] : []))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (text) return text.length > 40 ? `${text.slice(0, 40)}…` : text
  }
  return "新对话"
}

/**
 * What goes to disk: pictures from `look` are dropped (the text of the result stays, and the views
 * can be looked at again), as are tool calls that never finished (a turn stopped halfway).
 */
export function forStorage(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.flatMap((p) => {
      if (!p.type.startsWith("tool-")) return [p]
      const t = p as { state?: string; output?: { images?: string[] } }
      if (t.state !== "output-available" && t.state !== "output-error") return []
      if (!t.output?.images?.length) return [p]
      return [{ ...p, output: { ...t.output, images: undefined, imagesDropped: t.output.images.length } } as typeof p]
    }),
  }))
}

export function summaryOf(r: ChatRecord): ChatSummary {
  const { messages, ...rest } = r
  return { ...rest, count: messages.length }
}
