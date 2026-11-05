// A scripted stand-in for the model (STUDIO_MOCK=1): builds a small box with
// the real tools, one call per request, so the whole loop — stream, client
// tool execution, kernel, result — can be exercised without an API key.
import type { LanguageModelV4, LanguageModelV4StreamPart } from "@ai-sdk/provider"
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test"

const SCRIPT: { text?: string; tool?: [string, Record<string, unknown>] }[] = [
  { text: "（演示模式）我来做一个 80 × 50 × 30 的小盒子：先定参数，再拉伸、倒圆角、抽壳，最后打两个孔。", tool: ["set_params", { set: { L: 80, W: 50, H: 30, t: 2, r: 6 } }] },
  { tool: ["sketch", { id: "sk1", name: "底面草图", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "盒子的外轮廓画在上视基准面上，尺寸用参数" }] },
  { tool: ["extrude", { id: "base", name: "盒体", sketch: "sk1", distance: "H", intent: "拉出实心的盒体，高度 = H" }] },
  { tool: ["fillet", { id: "corners", name: "竖边圆角", edges: { of: "base", parallel: "Z", expect: 4 }, r: "r", intent: "先做外圆角，抽壳后内侧会自动跟着变圆" }] },
  { tool: ["shell", { id: "hollow", name: "抽壳", open: { normal: "+Z", extreme: "+Z" }, t: "t", intent: "去掉顶面，留 t 的壁厚" }] },
  { tool: ["hole", { id: "holes", name: "底孔", on: { plane: "XY" }, reverse: true, at: [["L/4", 0], ["-L/4", 0]], d: 4, intent: "底部两个固定孔，位置跟着 L 走" }] },
  { tool: ["look", {}] },
  { text: "做好了：拉伸 → 竖边圆角 → 抽壳 → 底孔。试着把参数 r 拖到比 t 小，看看抽壳后内角怎么变——这就是「先圆角还是先抽壳」那一课讲的事：/lesson/fillet-shell-order" },
]

const usage = { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }

export function mockModel(): LanguageModelV4 {
  return new MockLanguageModelV4({
    modelId: "mock",
    doStream: async ({ prompt }) => {
      const lastUser = prompt.map((m) => m.role).lastIndexOf("user")
      const done = prompt.slice(lastUser + 1).filter((m) => m.role === "tool").length
      const step = SCRIPT[Math.min(done, SCRIPT.length - 1)]
      const parts: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }]
      if (step.text) parts.push({ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: step.text }, { type: "text-end", id: "t" })
      if (step.tool && done < SCRIPT.length - 1)
        parts.push({ type: "tool-call", toolCallId: `call-${done}-${Date.now()}`, toolName: step.tool[0], input: JSON.stringify(step.tool[1]) })
      const hasTool = parts.some((p) => p.type === "tool-call")
      parts.push({ type: "finish", usage, finishReason: { unified: hasTool ? "tool-calls" : "stop", raw: undefined } })
      return { stream: convertArrayToReadableStream(parts) }
    },
  })
}
