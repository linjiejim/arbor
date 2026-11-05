// FeatureTree studio API: relays the conversation to the model. Geometry never
// touches this server — the browser runs the kernel and executes the tools.
//
//   POST /api/studio/chat    AI SDK UI message stream
//   GET  /api/studio/status  model, whether a hosted key is available
//   GET  /api/health
//
// Env: DEEPSEEK_API_KEY (hosted key, optional), STUDIO_MODEL (deepseek-flash),
// DEEPSEEK_BASE_URL, DAILY_BUDGET_USD (3), STUDIO_THINKING (enabled|disabled),
// STUDIO_DATA_DIR (./data), PORT (18914), HOST (127.0.0.1).
import { serve } from "@hono/node-server"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { Tree } from "../src/studio/dsl"
import { SYSTEM_PROMPT, statePrompt } from "../src/studio/prompt"
import { STUDIO_TOOLS } from "../src/studio/tools"
import { trimMessages } from "../src/studio/trim"
import { Budget, costUSD, RateLimiter } from "./limits"
import { mockModel } from "./mock"

const env = process.env
const MODEL = env.STUDIO_MODEL ?? "deepseek-flash"
const HOSTED_KEY = env.DEEPSEEK_API_KEY
const MOCK = env.STUDIO_MOCK === "1"
const THINKING = env.STUDIO_THINKING === "disabled" ? "disabled" : "enabled"
const budget = new Budget(env.STUDIO_DATA_DIR ?? "./data", Number(env.DAILY_BUDGET_USD ?? 3))
// A user message starts a turn; each tool round-trip is another request.
const turns = new RateLimiter(Number(env.TURNS_PER_HOUR ?? 30), 3600_000)
const requests = new RateLimiter(Number(env.REQUESTS_PER_HOUR ?? 400), 3600_000)

const app = new Hono()

app.get("/api/health", (c) => c.json({ ok: true }))

app.get("/api/studio/status", (c) =>
  c.json({ model: MOCK ? "mock" : MODEL, hostedKey: MOCK || Boolean(HOSTED_KEY), budgetExhausted: MOCK ? false : HOSTED_KEY ? budget.exhausted() : true }),
)

app.post("/api/studio/chat", bodyLimit({ maxSize: 6 * 1024 * 1024 }), async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local"
  const userKey = c.req.header("x-deepseek-key")?.trim() || undefined
  const body = (await c.req.json().catch(() => null)) as { messages?: UIMessage[]; tree?: unknown; summary?: unknown } | null
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)
  const tree = Tree.safeParse(body.tree ?? { params: {}, features: [] })
  if (!tree.success) return c.json({ error: "bad-request", message: "特征树格式不对" }, 400)
  const summary = typeof body.summary === "string" ? body.summary.slice(0, 12000) : ""

  const last = body.messages[body.messages.length - 1]
  const startsTurn = last?.role === "user"
  const wait = requests.take(ip) || (startsTurn && !userKey ? turns.take(ip) : 0)
  if (wait) return c.json({ error: "rate-limit", message: `请求太频繁了，${Math.ceil(wait / 60)} 分钟后再试，或者填自己的 DeepSeek key。` }, 429)

  const apiKey = userKey ?? HOSTED_KEY
  if (!apiKey && !MOCK) return c.json({ error: "no-key", message: "服务器没有配置模型 key：请在设置里填自己的 DeepSeek key。" }, 503)
  if (!userKey && !MOCK && budget.exhausted())
    return c.json({ error: "budget", message: "今天的公共额度用完了：明天再来，或者填自己的 DeepSeek key。" }, 429)

  const deepseek = createDeepSeek({ apiKey, baseURL: env.DEEPSEEK_BASE_URL })
  const messages = await convertToModelMessages(trimMessages(body.messages), { tools: STUDIO_TOOLS, ignoreIncompleteToolCalls: true })
  const result = streamText({
    model: MOCK ? mockModel() : deepseek(MODEL),
    system: `${SYSTEM_PROMPT}\n\n${statePrompt(tree.data, summary)}`,
    messages,
    tools: STUDIO_TOOLS,
    maxOutputTokens: 8000,
    abortSignal: c.req.raw.signal,
    providerOptions: { deepseek: { thinking: { type: THINKING }, ...(THINKING === "enabled" ? { reasoningEffort: "low" } : {}) } },
    onFinish: ({ totalUsage }) => {
      const usage = {
        inputTokens: totalUsage.inputTokens,
        cacheReadTokens: totalUsage.inputTokenDetails?.cacheReadTokens,
        outputTokens: totalUsage.outputTokens,
      }
      const usd = costUSD(MODEL, usage)
      if (!userKey) budget.add(usd)
      console.log(
        JSON.stringify({ t: new Date().toISOString(), turn: startsTurn, byok: Boolean(userKey), ...usage, usd: Math.round(usd * 1e5) / 1e5 }),
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

const port = Number(env.PORT ?? 18914)
serve({ fetch: app.fetch, port, hostname: env.HOST ?? "127.0.0.1" }, () => {
  console.log(`[studio] listening on ${env.HOST ?? "127.0.0.1"}:${port} · model ${MOCK ? "mock" : MODEL} · hosted key ${HOSTED_KEY ? "yes" : "no"}`)
})
