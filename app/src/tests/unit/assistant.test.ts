import { beforeAll, describe, expect, it } from "vitest"
import type { LanguageModelV4, LanguageModelV4StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test"
import { initNodeKernel } from "@/studio/kernel/node"
import { assistantState, assistantTools, runAssistant } from "@/desktop/core/assistant"
import { agentCommands } from "@/desktop/core/catalog"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext, CommandResult } from "@/desktop/core/protocol"
import { memFiles } from "./mem-files"

type Step = { text?: string; tool?: [string, Record<string, unknown>] }

/** A box from an empty folder, one command per model step, then a closing line. */
const BOX: Step[] = [
  { text: "先打开零件。", tool: ["open_part", { path: "box", create: true }] },
  { tool: ["set_params", { set: { L: 80, W: 50, H: 30 } }] },
  { tool: ["sketch", { id: "sk1", name: "底面草图", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] }] },
  { tool: ["extrude", { id: "base", name: "盒体", sketch: "sk1", distance: "H" }] },
  { tool: ["check", { items: [{ id: "size", said: "80×50×30", kind: "size", expect: [80, 50, 30] }] }] },
  { text: "做好了：80 × 50 × 30，核对通过。" },
]

const usage = { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }

/** Plays `script`: which step it is on is read off the prompt (tool results since the last user message). */
function scripted(script: Step[], seen: { prompts: string[] } = { prompts: [] }): LanguageModelV4 {
  return new MockLanguageModelV4({
    modelId: "scripted",
    doStream: async ({ prompt }) => {
      seen.prompts.push(JSON.stringify(prompt))
      const lastUser = prompt.map((m) => m.role).lastIndexOf("user")
      const done = prompt.slice(lastUser + 1).filter((m) => m.role === "tool").length
      const step = script[Math.min(done, script.length - 1)]
      const parts: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }]
      if (step.text) parts.push({ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: step.text }, { type: "text-end", id: "t" })
      if (step.tool) parts.push({ type: "tool-call", toolCallId: `call-${done}`, toolName: step.tool[0], input: JSON.stringify(step.tool[1]) })
      parts.push({ type: "finish", usage, finishReason: { unified: step.tool ? "tool-calls" : "stop", raw: undefined } })
      return { stream: convertArrayToReadableStream(parts) }
    },
  })
}

const ASSISTANT: CallContext = { actor: "assistant", session: "assistant-1", cwd: "/work" }
const AGENT: CallContext = { actor: "agent", session: "mcp-1", cwd: "/work", part: "/work/box.turnery.json" }
const USER: CallContext = { actor: "user", part: "/work/box.turnery.json" }

function freshEngine() {
  const mem = memFiles()
  return new Engine({ kernel: new DirectKernel(), files: mem.files })
}

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

describe("turnery: the built-in assistant", () => {
  it("builds a part from an empty folder with the engine's own commands, one at a time, as itself", async () => {
    const engine = freshEngine()
    const calls: { name: string; result: CommandResult }[] = []
    const seen = { prompts: [] as string[] }
    const res = await runAssistant({
      engine,
      model: scripted(BOX, seen),
      messages: [{ role: "user", content: "做一个 80×50×30 的盒子" }],
      ctx: ASSISTANT,
      onCall: (c) => calls.push(c),
    })
    expect(await res.text).toContain("做好了")
    expect(calls.map((c) => c.name)).toEqual(["open_part", "set_params", "sketch", "extrude", "check"])
    for (const c of calls) expect(c.result.ok, `${c.name}: ${c.result.text}`).toBe(true)
    expect(calls.at(-1)!.result.text).toContain("全部满足")
    const body = await engine.run("inspect", { what: "body" }, AGENT)
    expect(body.text).toContain("80 × 50 × 30")
    expect(engine.docState()!.changes.every((c) => c.actor === "assistant")).toBe(true)
    // The state rides on the person's message; the system prompt stays the same text every step.
    expect(seen.prompts[0]).toContain("发这条消息时的状态")
    expect(seen.prompts[0]).toContain("做一个 80×50×30 的盒子")
  }, 60_000)

  it("tells an outside agent what the assistant changed, and the assistant what the person changed", async () => {
    const engine = freshEngine()
    const res = await runAssistant({ engine, model: scripted(BOX), messages: [{ role: "user", content: "做一个盒子" }], ctx: ASSISTANT })
    await res.text
    const forAgent = await engine.run("get_state", {}, AGENT)
    expect(forAgent.text).toContain("自你上次调用以来")
    expect(forAgent.text).toContain("窗口里的内置助手")
    // The agent has now seen it; nothing new the second time.
    expect((await engine.run("get_state", {}, AGENT)).text).not.toContain("自你上次调用以来")
    // The agent's own call must not swallow what the assistant still has to hear about the person's edit.
    expect((await engine.run("set_params", { set: { H: 40 } }, USER)).ok).toBe(true)
    await engine.run("get_state", {}, AGENT)
    const forAssistant = await assistantState(engine, ASSISTANT)
    expect(forAssistant).toContain("用户在窗口里")
    expect(forAssistant).toContain("H")
  }, 60_000)

  it("stops after the step limit instead of running on", async () => {
    const engine = freshEngine()
    const calls: string[] = []
    const res = await runAssistant({ engine, model: scripted(BOX), messages: [{ role: "user", content: "做一个盒子" }], ctx: ASSISTANT, maxSteps: 2, onCall: (c) => calls.push(c.name) })
    await res.consumeStream()
    expect(calls).toEqual(["open_part", "set_params"])
  }, 60_000)

  it("follows open_part: the commands after it go to the part just opened, not the one the turn started on", async () => {
    const engine = freshEngine()
    await engine.run("open_part", { path: "first", create: true }, ASSISTANT)
    const tools = assistantTools({ engine, ctx: { ...ASSISTANT, part: "/work/first.turnery.json" } })
    const call = (name: string, input: unknown) => (tools[name] as unknown as { execute: (i: unknown) => Promise<CommandResult> }).execute(input)
    expect((await call("open_part", { path: "second", create: true })).ok).toBe(true)
    expect((await call("set_params", { set: { L: 7 } })).ok).toBe(true)
    const second = (await engine.run("get_state", {}, { ...AGENT, part: "/work/second.turnery.json" })).text
    expect(second).toContain("参数：L = 7")
    expect((await engine.run("get_state", {}, { ...AGENT, part: "/work/first.turnery.json" })).text).not.toContain("L = 7")
  }, 60_000)

  it("runs nothing more once the turn is stopped", async () => {
    const engine = freshEngine()
    await engine.run("open_part", { path: "box", create: true }, ASSISTANT)
    const stop = new AbortController()
    const ran: string[] = []
    const tools = assistantTools({ engine, ctx: ASSISTANT, abortSignal: stop.signal, onCall: (c) => ran.push(c.name) })
    const call = (name: string, input: unknown) => (tools[name] as unknown as { execute: (i: unknown) => Promise<CommandResult> }).execute(input)
    // Two calls of one step: the second is queued behind the first when the person presses stop.
    const first = call("set_params", { set: { L: 5 } })
    const second = call("set_params", { set: { L: 9 } })
    stop.abort()
    await first.catch(() => undefined)
    await expect(second).rejects.toThrow("已停止")
    expect((await engine.run("get_state", {}, AGENT)).text).not.toContain("L = 9")
    expect(ran.length).toBeLessThanOrEqual(1)
  }, 60_000)

  it("offers every agent command but the guide, and only hands images to a model that can see", () => {
    const engine = freshEngine()
    const tools = assistantTools({ engine, ctx: ASSISTANT })
    expect(Object.keys(tools)).not.toContain("guide")
    expect(Object.keys(tools).length).toBe(agentCommands().length - 1)
    const look = { ok: true, text: "视图：等轴测。", images: ["data:image/png;base64,AAAA"] }
    type Out = (a: { output: unknown }) => { type: string; value: unknown }
    const withEyes = (tools.look as unknown as { toModelOutput: Out }).toModelOutput({ output: look })
    expect(withEyes.type).toBe("content")
    expect(JSON.stringify(withEyes.value)).toContain('"data":"AAAA"')
    const blind = (assistantTools({ engine, ctx: ASSISTANT, vision: false }).look as unknown as { toModelOutput: Out }).toModelOutput({ output: look })
    expect(blind).toEqual({ type: "text", value: "视图：等轴测。" })
  })
})
