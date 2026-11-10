import type { UIMessage } from "ai"
import { commandLabel } from "./ui/words"

/** 「思考中」「正在写「做拉伸」的参数」「看结果，想下一步」 */
export function activity(chat: { messages: UIMessage[]; status: string }): string {
  const last = chat.messages.at(-1)
  if (chat.status === "submitted" || last?.role !== "assistant") return "等模型回应"
  const p = last.parts.at(-1)
  if (!p) return "等模型回应"
  if (p.type === "reasoning") return "思考中"
  if (p.type === "text") return p.state === "streaming" ? "正在回复" : "想下一步"
  if (p.type.startsWith("tool-")) {
    const t = p as { type: string; state?: string }
    const label = commandLabel(t.type.slice(5))
    if (t.state === "input-streaming") return `正在写「${label}」的参数`
    if (t.state === "input-available") return `正在${label}`
    return "看结果，想下一步"
  }
  return "想下一步"
}
