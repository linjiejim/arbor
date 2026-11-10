// Turnery studio API: relays the conversation to the model. Geometry never
// touches this server — the browser runs the kernel and executes the tools.
//
//   POST /api/studio/chat    AI SDK UI message stream
//   GET  /api/studio/status  model, whether a hosted key is available
//   /api/studio/share        shared links (shares.ts)
//   GET  /api/health
//
// Env (hosted quota, both optional; OpenRouter wins when both are set):
//   OPENROUTER_API_KEY, OPENROUTER_MODEL (deepseek/deepseek-v4.1-flash-1017)
//   DEEPSEEK_API_KEY, STUDIO_MODEL (deepseek-flash), DEEPSEEK_BASE_URL
// DAILY_BUDGET_USD (3), STUDIO_THINKING (enabled|disabled), STUDIO_DATA_DIR
// (./data), PORT (18914), HOST (127.0.0.1). A learner's own key always goes
// to DeepSeek directly.
import { serve } from "@hono/node-server"
import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { Annotations, annotationText } from "../src/studio/annotations"
import { Tree } from "../src/studio/dsl"
import { SYSTEM_PROMPT, TEACH_PROMPT, statePrompt, withState } from "../src/studio/prompt"
import { STUDIO_TOOLS } from "../src/studio/tools"
import { trimMessages } from "../src/studio/trim"
import { Budget, clientIp, RateLimiter } from "./limits"
import { mockModel } from "./mock"
import { deepseekRoute, hostedRoute } from "./models"
import { scheduleCleanup, ShareStore, shareRoutes } from "./shares"

const env = process.env
const MOCK = env.STUDIO_MOCK === "1"
const THINKING = env.STUDIO_THINKING === "disabled" ? "disabled" : "enabled"
const HOSTED = hostedRoute(env, THINKING)
const BYOK_MODEL = env.STUDIO_MODEL ?? "deepseek-flash"
const DATA_DIR = env.STUDIO_DATA_DIR ?? "./data"
const budget = new Budget(DATA_DIR, Number(env.DAILY_BUDGET_USD ?? 3))
// A user message starts a turn; each tool round-trip is another request.
const turns = new RateLimiter(Number(env.TURNS_PER_HOUR ?? 30), 3600_000)
const requests = new RateLimiter(Number(env.REQUESTS_PER_HOUR ?? 400), 3600_000)
const shares = new ShareStore(DATA_DIR)
scheduleCleanup(shares)

const app = new Hono()

app.get("/api/health", (c) => c.json({ ok: true }))

app.route("/", shareRoutes(shares))

app.get("/api/studio/status", (c) =>
  c.json({
    model: MOCK ? "mock" : (HOSTED?.label ?? BYOK_MODEL),
    via: MOCK ? "mock" : (HOSTED?.via ?? "deepseek"),
    hostedKey: MOCK || Boolean(HOSTED),
    budgetExhausted: MOCK ? false : HOSTED ? budget.exhausted() : true,
  }),
)

app.post("/api/studio/chat", bodyLimit({ maxSize: 6 * 1024 * 1024 }), async (c) => {
  const ip = clientIp((h) => c.req.header(h))
  const userKey = c.req.header("x-deepseek-key")?.trim() || undefined
  const body = (await c.req.json().catch(() => null)) as { messages?: UIMessage[]; tree?: unknown; summary?: unknown; mode?: unknown } | null
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)
  const tree = Tree.safeParse(body.tree ?? { params: {}, features: [] })
  if (!tree.success) return c.json({ error: "bad-request", message: "特征树格式不对" }, 400)
  const summary = typeof body.summary === "string" ? body.summary.slice(0, 12000) : ""

  const last = body.messages[body.messages.length - 1]
  const startsTurn = last?.role === "user"
  const wait = requests.take(ip) || (startsTurn && !userKey ? turns.take(ip) : 0)
  if (wait) return c.json({ error: "rate-limit", message: `请求太频繁了，${Math.ceil(wait / 60)} 分钟后再试，或者填自己的 DeepSeek key。` }, 429)

  const route = userKey ? deepseekRoute(userKey, BYOK_MODEL, THINKING, env.DEEPSEEK_BASE_URL) : HOSTED
  if (!route && !MOCK) return c.json({ error: "no-key", message: "服务器没有配置模型 key：请在设置里填自己的 DeepSeek key。" }, 503)
  if (!userKey && !MOCK && budget.exhausted())
    return c.json({ error: "budget", message: "今天的公共额度用完了：明天再来，或者填自己的 DeepSeek key。" }, 429)

  // The state the learner saw when they sent the message (snapshot in its
  // metadata); older clients only send the live tree.
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user")
  const snap = (lastUser?.metadata ?? {}) as { tree?: unknown; summary?: unknown }
  const snapTree = Tree.safeParse(snap.tree)
  const state = snapTree.success
    ? statePrompt(snapTree.data, typeof snap.summary === "string" ? snap.summary.slice(0, 12000) : "")
    : statePrompt(tree.data, summary)
  const messages = await convertToModelMessages(trimMessages(body.messages.map(withAnnotations)), { tools: STUDIO_TOOLS, ignoreIncompleteToolCalls: true })
  const result = streamText({
    model: MOCK ? mockModel() : route!.model,
    system: `${SYSTEM_PROMPT}${body.mode === "teach" ? `\n\n${TEACH_PROMPT}` : ""}`,
    messages: withState(messages, state),
    tools: STUDIO_TOOLS,
    maxOutputTokens: 8000,
    abortSignal: c.req.raw.signal,
    providerOptions: MOCK ? undefined : route!.providerOptions,
    onFinish: ({ totalUsage, providerMetadata }) => {
      const usage = {
        inputTokens: totalUsage.inputTokens,
        cacheReadTokens: totalUsage.inputTokenDetails?.cacheReadTokens,
        outputTokens: totalUsage.outputTokens,
      }
      const usd = MOCK ? 0 : route!.cost(usage, providerMetadata)
      if (!userKey) budget.add(usd)
      console.log(
        JSON.stringify({ t: new Date().toISOString(), turn: startsTurn, byok: Boolean(userKey), via: route?.via, ...usage, usd: Math.round(usd * 1e6) / 1e6 }),
      )
    },
    onError: ({ error }) => console.error("[studio] model error:", (error as Error)?.message ?? error),
  })
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      const msg = (error as Error)?.message ?? String(error)
      if (/401|auth|api key/i.test(msg)) return "模型 key 无效或没有权限。"
      if (/429|rate/i.test(msg)) return "模型服务繁忙，稍后再试。"
      return "模型服务出错了，稍后再试。"
    },
  })
})

/**
 * Where the learner pointed (message metadata) becomes text the model reads,
 * appended to that message. Deterministic, so history stays a cacheable prefix.
 */
function withAnnotations(m: UIMessage): UIMessage {
  if (m.role !== "user") return m
  const notes = Annotations.safeParse((m.metadata as { annotations?: unknown } | undefined)?.annotations)
  if (!notes.success || !notes.data.length) return m
  return { ...m, parts: [...m.parts, { type: "text", text: annotationText(notes.data) }] }
}

const port = Number(env.PORT ?? 18914)
serve({ fetch: app.fetch, port, hostname: env.HOST ?? "127.0.0.1" }, () => {
  console.log(`[studio] listening on ${env.HOST ?? "127.0.0.1"}:${port} · ${MOCK ? "mock model" : HOSTED ? `hosted ${HOSTED.label} via ${HOSTED.via}` : "no hosted key"}`)
})
