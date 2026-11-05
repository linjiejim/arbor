import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai"
import { trimMessages } from "./trim"
import type { Studio } from "./use-studio"

const STORE = "ft-studio-chat-v1"
export const KEY_STORE = "ft-studio-deepseek-key"
/** Tool calls allowed per user turn before the loop pauses. */
export const MAX_CALLS_PER_TURN = 30

function loadMessages(): UIMessage[] {
  try {
    const m = JSON.parse(localStorage.getItem(STORE) ?? "[]")
    return Array.isArray(m) ? m : []
  } catch {
    return []
  }
}

/** Images are big and only matter to the model once; don't keep them in storage. */
function forStorage(messages: UIMessage[]) {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) => (p.type === "tool-look" && "output" in p && p.output ? { ...p, output: { ...(p.output as object), images: undefined } } : p)),
  }))
}

export function callsInLastTurn(messages: UIMessage[]) {
  let n = 0
  for (let i = messages.length - 1; i >= 0 && messages[i].role !== "user"; i--) n += messages[i].parts.filter((p) => p.type.startsWith("tool-")).length
  return n
}

/** Server errors arrive as the response body text: pull out our `message`. */
export function errorText(e: Error | undefined) {
  if (!e) return null
  try {
    const j = JSON.parse(e.message)
    if (j?.message) return j.message as string
  } catch {
    /* not JSON */
  }
  return /fetch|network/i.test(e.message) ? "连不上服务器，检查网络后重试。" : e.message || "出错了"
}

/**
 * The chat transport and tool callback outlive renders; they read the latest
 * studio state through this bridge (one studio page at a time).
 */
const bridge: { studio: Studio | null; addOutput: ReturnType<typeof useChat>["addToolOutput"] | null } = { studio: null, addOutput: null }

export function useStudioChat(studio: Studio) {
  React.useEffect(() => {
    bridge.studio = studio
  }, [studio])
  const [initial] = React.useState(loadMessages)
  const [paused, setPaused] = React.useState(false)

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/studio/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const key = localStorage.getItem(KEY_STORE)
          const s = bridge.studio
          return {
            body: { messages: trimMessages(messages), tree: s?.treeRef.current, summary: s?.summary ?? "" },
            headers: key ? { "x-deepseek-key": key } : undefined,
          }
        },
      }),
    [],
  )

  const chat = useChat({
    messages: initial,
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) return false
      if (callsInLastTurn(messages) >= MAX_CALLS_PER_TURN) {
        setPaused(true)
        return false
      }
      return true
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic) return
      const s = bridge.studio
      if (!s) return
      const run = await s.runTool(toolCall.toolName, (toolCall.input ?? {}) as Record<string, unknown>)
      void bridge.addOutput?.({ tool: toolCall.toolName as never, toolCallId: toolCall.toolCallId, output: run.output as never })
    },
  })
  React.useEffect(() => {
    bridge.addOutput = chat.addToolOutput
  }, [chat.addToolOutput])

  React.useEffect(() => {
    if (chat.status !== "ready" && chat.status !== "error") return
    try {
      localStorage.setItem(STORE, JSON.stringify(forStorage(chat.messages).slice(-80)))
    } catch {
      /* quota */
    }
  }, [chat.messages, chat.status])

  const send = React.useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t) return
      setPaused(false)
      bridge.studio?.checkpoint()
      void chat.sendMessage({ text: t })
    },
    [chat],
  )

  const clear = React.useCallback(() => {
    void chat.stop()
    chat.setMessages([])
    setPaused(false)
    localStorage.removeItem(STORE)
  }, [chat])

  return { ...chat, send, clear, paused, busy: chat.status === "submitted" || chat.status === "streaming" }
}

export type StudioChat = ReturnType<typeof useStudioChat>
