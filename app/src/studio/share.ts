import type { UIMessage } from "ai"
import { Tree } from "./dsl"
import { byteLength, checkTree, LIMITS } from "./limits"

/**
 * Shared links, browser side: the snapshot is built field by field from the
 * tree and the chat's text, never copied from localStorage, so the learner's
 * own key (and anything else stored there) can't travel with it. A snapshot
 * that comes back is checked again with the same limits as the server.
 */

export type ChatLine = { role: "user" | "assistant"; text: string }

export type SharedSnapshot = {
  v: 1
  id: string
  created: string
  app: string
  title: string
  note?: string
  tree: Tree
  chat?: ChatLine[]
}

/** A line in the chat that marks a change of model (not sent to the model, not shared). */
export const isDivider = (m: UIMessage) => (m.metadata as { divider?: unknown } | undefined)?.divider === true

/** Text only: no images, reasoning, tool calls or their raw input and output. */
export function chatLines(messages: UIMessage[]): ChatLine[] {
  const out: ChatLine[] = []
  for (const m of messages) {
    if ((m.role !== "user" && m.role !== "assistant") || isDivider(m)) continue
    const text = m.parts
      .flatMap((p) => (p.type === "text" && p.text.trim() ? [p.text.trim()] : []))
      .join("\n\n")
    if (text) out.push({ role: m.role, text })
  }
  return out
}

export type SharePayload = { title: string; note?: string; tree: Tree; chat?: ChatLine[]; app: string }

export function sharePayload(input: { title: string; note?: string; tree: Tree; messages?: UIMessage[] }): SharePayload {
  const note = input.note?.trim()
  const chat = input.messages ? chatLines(input.messages).slice(-LIMITS.chatMessages) : undefined
  return {
    title: input.title.trim(),
    ...(note ? { note } : {}),
    // Parsing again keeps only the schema's fields.
    tree: Tree.parse(input.tree),
    ...(chat?.length ? { chat } : {}),
    app: __APP_VERSION__,
  }
}

/** Why the server would refuse this, before sending it. */
export function payloadProblem(p: SharePayload): string | null {
  if (!p.title) return "要有标题"
  if (p.title.length > LIMITS.title) return `标题太长了（最多 ${LIMITS.title} 字）`
  if (p.note && p.note.length > LIMITS.note) return `说明太长了（最多 ${LIMITS.note} 字）`
  const t = checkTree(p.tree)
  if (!t.ok) return t.tooBig ? `模型太大，不能分享：${t.message}` : t.message
  if (p.chat && byteLength(JSON.stringify(p.chat)) > LIMITS.chatBytes) return "对话太长了，不勾选对话再试"
  return null
}

export type ShareCreated = { id: string; url: string; deleteToken: string }

async function failure(r: Response, fallback: string) {
  const j = (await r.json().catch(() => null)) as { message?: string } | null
  return new Error(j?.message ?? fallback)
}

export async function createShare(p: SharePayload): Promise<ShareCreated> {
  let r: Response
  try {
    r = await fetch("/api/studio/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) })
  } catch {
    throw new Error("连不上服务器，检查网络后重试。")
  }
  if (!r.ok) throw await failure(r, "没能生成链接，稍后再试。")
  const created = (await r.json()) as ShareCreated
  rememberShare(created.id, created.deleteToken)
  return created
}

export type Loaded = { kind: "ok"; snap: SharedSnapshot } | { kind: "missing" } | { kind: "broken"; message: string; raw: unknown }

/** Network trouble throws; a missing link and an unreadable snapshot are results. */
export async function loadShare(id: string): Promise<Loaded> {
  if (!/^[0-9A-Za-z]{10}$/.test(id)) return { kind: "missing" }
  let r: Response
  try {
    r = await fetch(`/api/studio/share/${id}`)
  } catch {
    throw new Error("连不上服务器，检查网络后重试。")
  }
  if (r.status === 404 || r.status === 400) return { kind: "missing" }
  if (!r.ok) throw await failure(r, "没能打开这个链接，稍后再试。")
  const raw = (await r.json()) as Record<string, unknown>
  return checkSnapshot(raw)
}

/** The same checks as the server, on what came back. */
export function checkSnapshot(raw: Record<string, unknown>): Loaded {
  const tree = checkTree(raw?.tree)
  if (!tree.ok) return { kind: "broken", message: tree.message, raw }
  const chat: ChatLine[] = []
  if (Array.isArray(raw.chat))
    for (const m of raw.chat.slice(0, LIMITS.chatMessages) as { role?: unknown; text?: unknown }[])
      if ((m?.role === "user" || m?.role === "assistant") && typeof m.text === "string") chat.push({ role: m.role, text: m.text })
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
  return {
    kind: "ok",
    snap: {
      v: 1,
      id: text(raw.id, 10),
      created: text(raw.created, 40),
      app: text(raw.app, 40),
      title: text(raw.title, LIMITS.title) || "分享的模型",
      ...(text(raw.note, LIMITS.note) ? { note: text(raw.note, LIMITS.note) } : {}),
      tree: tree.tree,
      ...(chat.length ? { chat } : {}),
    },
  }
}

export async function deleteShare(id: string, token: string): Promise<void> {
  let r: Response
  try {
    r = await fetch(`/api/studio/share/${id}`, { method: "DELETE", headers: { "x-share-token": token } })
  } catch {
    throw new Error("连不上服务器，检查网络后重试。")
  }
  // Already gone counts as deleted.
  if (!r.ok && r.status !== 404) throw await failure(r, "没能删除，稍后再试。")
  forgetShare(id)
}

export const shareUrl = (id: string) => new URL(`/studio/s/${id}`, location.origin).href

// Delete tokens live only in the browser that made the link.
const TOKENS = "ft-studio-shares-v1"

function tokens(): Record<string, string> {
  try {
    const t = JSON.parse(localStorage.getItem(TOKENS) ?? "{}")
    return t && typeof t === "object" ? t : {}
  } catch {
    return {}
  }
}

function rememberShare(id: string, token: string) {
  try {
    localStorage.setItem(TOKENS, JSON.stringify({ ...tokens(), [id]: token }))
  } catch {
    /* quota: the link works, it just can't be deleted from here */
  }
}

function forgetShare(id: string) {
  const { [id]: _gone, ...rest } = tokens()
  localStorage.setItem(TOKENS, JSON.stringify(rest))
}

/** The delete token, when this browser made the link. */
export const shareToken = (id: string): string | null => {
  const t = tokens()[id]
  return typeof t === "string" ? t : null
}
