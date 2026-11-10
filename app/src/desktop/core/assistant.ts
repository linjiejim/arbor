// The assistant built into the Turnery window: a tool loop over the engine's own commands.
//
// It can do exactly what an outside agent can do over MCP and nothing else: no files beyond the
// part it works on, no shell. Runs wherever the engine runs (the Electron main process, the CLI,
// a unit test); nothing here imports Electron.
import { convertToModelMessages, isStepCount, jsonSchema, streamText, tool, type LanguageModel, type ModelMessage, type ToolSet, type UIMessage } from "ai"
import { withState } from "../../studio/prompt"
import { trimMessages } from "../../studio/trim"
import { AGENT_GUIDE, agentCommands, inputJsonSchema } from "./catalog"
import { normalizePartPath, type Engine } from "./engine"
import type { CallContext, CommandResult } from "./protocol"

/** Tool calls one message from the person may lead to before the loop stops and says so. */
export const MAX_STEPS = 30

/** Commands that make no sense for the built-in assistant: the guide is its system prompt already. */
const LEFT_OUT = new Set(["guide"])

const NO_VISION = `

## 这个模型看不了图
look 的结果里没有图片，只有文字。形状、位置和方向用 inspect 和 measure 确认；不要说「看起来没问题」。`

export type AssistantRun = {
  /** The engine, or anything that runs its commands (the CLI's link to the running app). */
  engine: Pick<Engine, "run">
  model: LanguageModel
  /** The conversation so far, ending with what the person just said. */
  messages: ModelMessage[]
  /** Who the engine should take these calls from: `{ actor: "assistant", part }`. */
  ctx: CallContext
  /** The model takes images: `look` hands it the rendered views. */
  vision?: boolean
  maxSteps?: number
  abortSignal?: AbortSignal
  providerOptions?: Parameters<typeof streamText>[0]["providerOptions"]
  /** Each command as it finishes, in order: for a log line, a test, the CLI's output. */
  onCall?: (call: { name: string; input: unknown; result: CommandResult }) => void
}

/**
 * The engine's commands as AI SDK tools. The SDK starts a step's tool calls together; the engine
 * would still run them one at a time, but in whatever order they reached it, so they queue here.
 */
export function assistantTools({ engine, ctx, vision = true, onCall, abortSignal }: Pick<AssistantRun, "engine" | "ctx" | "vision" | "onCall" | "abortSignal">): ToolSet {
  let queue: Promise<unknown> = Promise.resolve()
  // The part the calls are for. It starts as the one the turn was given and follows open_part: the
  // engine takes a named part over the session's, so a fixed one would keep editing the first file.
  let part = ctx.part
  const entries = agentCommands()
    .filter((spec) => !LEFT_OUT.has(spec.name))
    .map((spec) => [
      spec.name,
      tool({
        description: spec.description,
        inputSchema: jsonSchema(inputJsonSchema(spec)),
        execute: (input: unknown, options?: { abortSignal?: AbortSignal }) => {
          const job = queue.then(async () => {
            // Stopped while an earlier command of the same step was running: nothing further is touched.
            if (abortSignal?.aborted || options?.abortSignal?.aborted) throw new Error("已停止")
            const result = await engine.run(spec.name, input, { ...ctx, part })
            const path = (input as { path?: unknown } | null)?.path
            if (spec.name === "open_part" && result.ok && typeof path === "string") part = normalizePartPath(path, ctx.cwd)
            onCall?.({ name: spec.name, input, result })
            return result
          })
          queue = job.catch(() => undefined)
          return job
        },
        toModelOutput: ({ output }: { output: unknown }) => {
          const o = output as CommandResult
          const text = o?.text ?? String(output)
          if (!vision || !o?.images?.length) return { type: "text" as const, value: text }
          return {
            type: "content" as const,
            value: [
              { type: "text" as const, text },
              ...o.images.map((img) => ({ type: "file" as const, mediaType: "image/png", data: { type: "data" as const, data: img.split(",")[1] ?? img } })),
            ],
          }
        },
      } as never),
    ])
  return Object.fromEntries(entries) as ToolSet
}

/**
 * What the assistant is told about the part before it answers: the same text an outside agent gets
 * from get_state, including what the person changed since the assistant's last turn. It rides on
 * the person's message, so the system prompt and the tool list stay a stable, cacheable prefix.
 */
export async function assistantState(engine: Pick<Engine, "run">, ctx: CallContext): Promise<string> {
  const state = await engine.run("get_state", {}, ctx)
  return `## 发这条消息时的状态\n（Turnery 自动附上，不是用户写的。之后你用工具做的改动以工具结果为准。）\n${state.text.replace(/^✗ /, "")}`
}

/** One turn: the model answers the last message, calling the engine's commands until it is done. */
export async function runAssistant(run: AssistantRun) {
  const { engine, model, ctx, vision = true } = run
  const state = await assistantState(engine, ctx)
  return streamText({
    model,
    system: vision ? AGENT_GUIDE : AGENT_GUIDE + NO_VISION,
    messages: withState(run.messages, state),
    tools: assistantTools({ engine, ctx, vision, onCall: run.onCall, abortSignal: run.abortSignal }),
    stopWhen: isStepCount(run.maxSteps ?? MAX_STEPS),
    abortSignal: run.abortSignal,
    providerOptions: run.providerOptions,
  })
}

/**
 * One turn for a window: the conversation as the chat UI holds it goes in, the UI message stream of
 * the answer comes out (text, reasoning, each tool call and its result). Old turns and old pictures
 * are trimmed first, as on the site.
 */
export async function assistantStream(run: Omit<AssistantRun, "messages"> & { messages: UIMessage[]; onError?: (error: unknown) => string }): Promise<ReadableStream<unknown>> {
  const tools = assistantTools({ engine: run.engine, ctx: run.ctx, vision: run.vision })
  const messages = await convertToModelMessages(trimMessages(run.messages), { tools, ignoreIncompleteToolCalls: true })
  const result = await runAssistant({ ...run, messages })
  // The turn's token use rides on the answer's metadata: the window shows it under the answer.
  return result.toUIMessageStream({
    sendReasoning: true,
    onError: run.onError,
    messageMetadata: ({ part }) => (part.type === "finish" ? { usage: usageOf(part.totalUsage) } : undefined),
  }) as ReadableStream<unknown>
}

/** Tokens a turn used, as the window shows them. */
export type TurnUsage = { input: number; output: number; cached: number; reasoning: number }

export function usageOf(u: { inputTokens?: number; outputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number }; outputTokenDetails?: { reasoningTokens?: number }; cachedInputTokens?: number; reasoningTokens?: number } | undefined): TurnUsage {
  return {
    input: u?.inputTokens ?? 0,
    output: u?.outputTokens ?? 0,
    cached: u?.inputTokenDetails?.cacheReadTokens ?? u?.cachedInputTokens ?? 0,
    reasoning: u?.outputTokenDetails?.reasoningTokens ?? u?.reasoningTokens ?? 0,
  }
}
