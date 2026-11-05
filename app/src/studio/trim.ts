import type { UIMessage } from "ai"

/**
 * Keep what the model needs, not the whole history: the current model state
 * travels in the system prompt anyway.
 *  - only the last `keepTurns` user turns;
 *  - images only from the most recent `look`;
 *  - reasoning only within the current turn (DeepSeek needs it there for tool calls).
 */
export function trimMessages(messages: UIMessage[], keepTurns = 8): UIMessage[] {
  const userIdx = messages.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0)
  const start = userIdx.length > keepTurns ? userIdx[userIdx.length - keepTurns] : 0
  const lastUser = userIdx.length ? userIdx[userIdx.length - 1] : 0
  const kept = messages.slice(start)

  let lastLook: { m: number; p: number } | null = null
  kept.forEach((m, mi) =>
    m.parts.forEach((p, pi) => {
      if (p.type === "tool-look" && "output" in p && p.output) lastLook = { m: mi, p: pi }
    }),
  )

  return kept.map((m, mi) => {
    const before = start + mi < lastUser
    const parts = m.parts
      .filter((p) => !(before && p.type === "reasoning"))
      .map((p, pi) => {
        if (p.type !== "tool-look" || !("output" in p) || !p.output) return p
        const isLast = lastLook && lastLook.m === mi && lastLook.p === m.parts.indexOf(p) && pi >= 0
        if (isLast) return p
        const out = p.output as { images?: string[]; text?: string }
        if (!out.images) return p
        return { ...p, output: { ...out, images: undefined, text: `${out.text ?? ""}（旧视图已省略）` } }
      })
    return { ...m, parts } as UIMessage
  })
}
