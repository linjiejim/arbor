// Shared links: a snapshot of a feature tree (and, if the sharer ticked the
// box, the text of the chat) that anyone with the link can open.
//
//   POST   /api/studio/share       { title, note?, tree, chat?, app? } → { id, url, deleteToken }
//   GET    /api/studio/share/:id   the snapshot; also marks it opened today
//   DELETE /api/studio/share/:id   header x-share-token
//
// One file per snapshot: <data>/shares/<first two of id>/<id>.json. "Last
// opened" is the file's mtime (touched at most once a day); a snapshot nobody
// opened for a year is deleted by the daily cleanup. No accounts: whoever made
// the link holds a delete token, the server keeps only its hash.
import crypto from "node:crypto"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import type { Tree } from "../src/studio/dsl"
import { byteLength, checkTree, LIMITS } from "../src/studio/limits"
import { clientIp, RateLimiter } from "./limits"

const DAY = 24 * 3600_000
export const SHARE_ID = /^[0-9A-Za-z]{10}$/
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
/** Request bodies above this are refused before parsing. */
export const MAX_BODY = 512 * 1024
/** Something shaped like an API key (DeepSeek, OpenRouter, OpenAI: sk-…). The client never sends one; this is the backstop. */
const KEY_LIKE = /sk-[A-Za-z0-9_-]{20,}/

/** Uniform base62: bytes ≥ 248 are dropped, so every character is equally likely. */
export function randomId(length: number): string {
  let out = ""
  while (out.length < length)
    for (const b of crypto.randomBytes(length * 2)) {
      if (b < 248 && out.length < length) out += B62[b % 62]
    }
  return out
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

export type ChatLine = { role: "user" | "assistant"; text: string }

/** What a link stores. Built field by field from the request, never copied whole. */
export type Snapshot = {
  v: 1
  id: string
  created: string
  /** Build of the app that made it, for when the tree format moves on. */
  app: string
  title: string
  note?: string
  tree: Tree
  chat?: ChatLine[]
  deleteHash: string
}
export type PublicSnapshot = Omit<Snapshot, "deleteHash">
type Fields = Pick<Snapshot, "app" | "title" | "note" | "tree" | "chat">

type Parsed = { ok: true; fields: Fields } | { ok: false; status: 400 | 413; message: string }

/** The request body → the snapshot's fields, or why not. */
export function parseShareBody(body: unknown): Parsed {
  const bad = (message: string): Parsed => ({ ok: false, status: 400, message })
  const big = (message = "模型太大，不能分享"): Parsed => ({ ok: false, status: 413, message })
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("请求格式不对")
  const b = body as Record<string, unknown>

  const title = typeof b.title === "string" ? b.title.trim() : ""
  if (!title) return bad("要有标题")
  if (title.length > LIMITS.title) return big(`标题太长了（最多 ${LIMITS.title} 字）`)
  let note: string | undefined
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== "string") return bad("说明要是文字")
    note = b.note.trim() || undefined
    if (note && note.length > LIMITS.note) return big(`说明太长了（最多 ${LIMITS.note} 字）`)
  }

  const tree = checkTree(b.tree)
  if (!tree.ok) return tree.tooBig ? big(`模型太大，不能分享：${tree.message}`) : bad(`特征树格式不对：${tree.message}`)

  let chat: ChatLine[] | undefined
  if (b.chat !== undefined && b.chat !== null) {
    if (!Array.isArray(b.chat)) return bad("对话格式不对")
    if (b.chat.length > LIMITS.chatMessages) return big(`对话太长了（最多 ${LIMITS.chatMessages} 条）`)
    chat = []
    for (const m of b.chat as unknown[]) {
      const r = (m as { role?: unknown })?.role
      const text = (m as { text?: unknown })?.text
      if ((r !== "user" && r !== "assistant") || typeof text !== "string") return bad("对话只能是学习者和助教的文字")
      if (text.trim()) chat.push({ role: r, text })
    }
    if (byteLength(JSON.stringify(chat)) > LIMITS.chatBytes) return big(`对话太长了（最多 ${LIMITS.chatBytes / 1024} KB）`)
    if (!chat.length) chat = undefined
  }

  const app = typeof b.app === "string" && /^[0-9A-Za-z._-]{1,40}$/.test(b.app) ? b.app : "unknown"
  return { ok: true, fields: { app, title, ...(note ? { note } : {}), tree: tree.tree, ...(chat ? { chat } : {}) } }
}

/** Calendar day in Beijing time, like the budget. */
const dayOf = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10)

export class ShareStore {
  readonly dir: string
  readonly maxTotalBytes: number
  readonly keepMs: number
  private total = 0

  constructor(dataDir: string, opts: { maxTotalBytes?: number; keepMs?: number } = {}) {
    this.dir = path.join(dataDir, "shares")
    this.maxTotalBytes = opts.maxTotalBytes ?? 2 * 1024 ** 3
    this.keepMs = opts.keepMs ?? 365 * DAY
    fs.mkdirSync(this.dir, { recursive: true })
  }

  /** Bytes on disk, as of the last cleanup plus what changed since. */
  get totalBytes() {
    return this.total
  }

  full() {
    return this.total >= this.maxTotalBytes
  }

  /** The id is checked here too: nothing unchecked ever becomes part of a path. */
  private file(id: string) {
    if (!SHARE_ID.test(id)) throw new Error("bad share id")
    return path.join(this.dir, id.slice(0, 2), `${id}.json`)
  }

  async create(fields: Fields, now = new Date()): Promise<{ id: string; deleteToken: string; bytes: number }> {
    let id = randomId(10)
    while (await exists(this.file(id))) id = randomId(10)
    const deleteToken = randomId(24)
    const snap: Snapshot = { v: 1, id, created: now.toISOString(), ...fields, deleteHash: `sha256:${sha256(deleteToken)}` }
    const text = JSON.stringify(snap)
    const file = this.file(id)
    await fsp.mkdir(path.dirname(file), { recursive: true })
    // Write then rename: a reader never sees half a file.
    const tmp = `${file}.${randomId(6)}.tmp`
    await fsp.writeFile(tmp, text, { flag: "wx" })
    await fsp.rename(tmp, file)
    const bytes = Buffer.byteLength(text)
    this.total += bytes
    return { id, deleteToken, bytes }
  }

  /** The snapshot without its delete hash, or null. Opening it counts as "used today". */
  async get(id: string, now = Date.now()): Promise<{ snap: PublicSnapshot; bytes: number } | null> {
    const file = this.file(id)
    let text: string
    let stat: fs.Stats
    try {
      ;[text, stat] = await Promise.all([fsp.readFile(file, "utf8"), fsp.stat(file)])
    } catch {
      return null
    }
    if (dayOf(stat.mtimeMs) !== dayOf(now)) await fsp.utimes(file, new Date(now), new Date(now)).catch(() => {})
    const { deleteHash: _hash, ...snap } = JSON.parse(text) as Snapshot
    return { snap, bytes: stat.size }
  }

  async remove(id: string, token: string): Promise<"deleted" | "not-found" | "forbidden"> {
    const file = this.file(id)
    let snap: Snapshot
    let size: number
    try {
      const text = await fsp.readFile(file, "utf8")
      snap = JSON.parse(text)
      size = Buffer.byteLength(text)
    } catch {
      return "not-found"
    }
    const want = Buffer.from(snap.deleteHash ?? "")
    const got = Buffer.from(`sha256:${sha256(token)}`)
    if (!token || want.length !== got.length || !crypto.timingSafeEqual(want, got)) return "forbidden"
    await fsp.rm(file, { force: true })
    this.total = Math.max(0, this.total - size)
    return "deleted"
  }

  /** Delete what nobody opened within `keepMs` (and stray temp files); recount the total. */
  async cleanup(now = Date.now()): Promise<{ removed: number; totalBytes: number }> {
    let removed = 0
    let total = 0
    for (const sub of await fsp.readdir(this.dir).catch(() => [] as string[])) {
      const d = path.join(this.dir, sub)
      for (const name of await fsp.readdir(d).catch(() => [] as string[])) {
        const f = path.join(d, name)
        const st = await fsp.stat(f).catch(() => null)
        if (!st?.isFile()) continue
        const stale = name.endsWith(".tmp") ? now - st.mtimeMs > 3600_000 : now - st.mtimeMs > this.keepMs
        if (stale) {
          await fsp.rm(f, { force: true })
          if (!name.endsWith(".tmp")) removed++
        } else total += st.size
      }
    }
    this.total = total
    return { removed, totalBytes: total }
  }
}

const exists = (f: string) => fsp.access(f).then(
  () => true,
  () => false,
)

type Limiters = { create: RateLimiter; open: RateLimiter; remove: RateLimiter }

/** Per IP: 20 links an hour, 300 opens, 60 deletes. */
export const defaultLimiters = (): Limiters => ({
  create: new RateLimiter(20, 3600_000),
  open: new RateLimiter(300, 3600_000),
  remove: new RateLimiter(60, 3600_000),
})

/**
 * The three routes, on their own app so tests can call them directly. Logs one
 * line per request: id, size and a salted hash of the IP, never the content.
 */
export function shareRoutes(store: ShareStore, opts: { limiters?: Limiters; log?: (line: Record<string, unknown>) => void } = {}) {
  const limit = opts.limiters ?? defaultLimiters()
  const log = opts.log ?? ((line) => console.log(JSON.stringify(line)))
  // Per process: hashes link requests from one address together, but can't be reversed by trying every IPv4.
  const salt = randomId(16)
  const ipHash = (ip: string) => sha256(`${salt}${ip}`).slice(0, 12)
  const tooFast = (wait: number) => ({ error: "rate-limit", message: `操作太频繁了，${Math.max(1, Math.ceil(wait / 60))} 分钟后再试。` })
  const app = new Hono()

  app.post(
    "/api/studio/share",
    bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: "too-large", message: "模型太大，不能分享" }, 413) }),
    async (c) => {
      const ip = clientIp((h) => c.req.header(h))
      const wait = limit.create.take(ip)
      if (wait) return c.json(tooFast(wait), 429)
      if (store.full()) {
        console.error(`[share] storage full: ${store.totalBytes} bytes ≥ ${store.maxTotalBytes}, refusing new links`)
        return c.json({ error: "full", message: "分享空间满了，稍后再试。" }, 503)
      }
      const raw = await c.req.text()
      if (KEY_LIKE.test(raw)) return c.json({ error: "secret", message: "内容里像是有密钥，已拒绝分享。" }, 400)
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        return c.json({ error: "bad-request", message: "请求格式不对" }, 400)
      }
      const parsed = parseShareBody(body)
      if (!parsed.ok) return c.json({ error: parsed.status === 413 ? "too-large" : "bad-request", message: parsed.message }, parsed.status)
      const { id, deleteToken, bytes } = await store.create(parsed.fields)
      log({ t: new Date().toISOString(), share: "create", id, bytes, ip: ipHash(ip) })
      return c.json({ id, url: `/studio/s/${id}`, deleteToken })
    },
  )

  app.get("/api/studio/share/:id", async (c) => {
    const ip = clientIp((h) => c.req.header(h))
    const wait = limit.open.take(ip)
    if (wait) return c.json(tooFast(wait), 429)
    const id = c.req.param("id")
    if (!SHARE_ID.test(id)) return c.json({ error: "bad-id", message: "链接格式不对" }, 400)
    const found = await store.get(id)
    if (!found) return c.json({ error: "not-found", message: "这个链接不存在或已被删除" }, 404)
    log({ t: new Date().toISOString(), share: "open", id, bytes: found.bytes, ip: ipHash(ip) })
    c.header("Cache-Control", "no-store")
    c.header("X-Robots-Tag", "noindex")
    return c.json(found.snap)
  })

  app.delete("/api/studio/share/:id", async (c) => {
    const ip = clientIp((h) => c.req.header(h))
    const wait = limit.remove.take(ip)
    if (wait) return c.json(tooFast(wait), 429)
    const id = c.req.param("id")
    if (!SHARE_ID.test(id)) return c.json({ error: "bad-id", message: "链接格式不对" }, 400)
    const result = await store.remove(id, c.req.header("x-share-token")?.trim() ?? "")
    if (result === "not-found") return c.json({ error: "not-found", message: "这个链接不存在或已被删除" }, 404)
    if (result === "forbidden") return c.json({ error: "forbidden", message: "删除口令不对，只有生成链接的浏览器能删除它" }, 403)
    log({ t: new Date().toISOString(), share: "delete", id, ip: ipHash(ip) })
    return c.json({ ok: true })
  })

  return app
}

/** Clean up now and once a day; warn in the log when the store passes its cap. */
export function scheduleCleanup(store: ShareStore) {
  const run = () =>
    store.cleanup().then(
      ({ removed, totalBytes }) => {
        console.log(JSON.stringify({ t: new Date().toISOString(), share: "cleanup", removed, totalBytes }))
        if (totalBytes >= store.maxTotalBytes) console.error(`[share] storage full: ${totalBytes} bytes, new links are refused`)
      },
      (e) => console.error("[share] cleanup failed:", (e as Error).message),
    )
  void run()
  setInterval(run, DAY).unref()
}
