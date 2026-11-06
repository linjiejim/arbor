import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type FileUIPart, type UIMessage } from "ai"
import { isDivider } from "./share"
import { trimMessages } from "./trim"
import type { Studio } from "./use-studio"
import type { Note } from "./use-annotations"

/** Filename of the annotated view sent with a message; not kept in storage, the annotations are. */
export const ANNOTATED_VIEW = "标注截图.png"

const STORE = "ft-studio-chat-v1"
export const KEY_STORE = "ft-studio-deepseek-key"
const MODE_STORE = "ft-studio-mode"
export type ChatMode = "build" | "teach"
/** How long `busy` holds after a request ends, in case the next step of the turn follows. */
const BETWEEN_STEPS_MS = 400
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
function forStorage(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.flatMap((p): UIMessage["parts"] => {
      if (p.type === "file") return p.filename === ANNOTATED_VIEW ? [] : [{ type: "text" as const, text: "（参考图未保存）" }]
      if (p.type === "tool-look" && "output" in p && p.output) return [{ ...p, output: { ...(p.output as object), images: undefined } } as UIMessage["parts"][number]]
      return [p]
    }),
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
const bridge: { studio: Studio | null; addOutput: ReturnType<typeof useChat>["addToolOutput"] | null; mode: ChatMode } = {
  studio: null,
  addOutput: null,
  mode: "build",
}

export function useStudioChat(studio: Studio) {
  React.useEffect(() => {
    bridge.studio = studio
  }, [studio])
  const [initial] = React.useState(loadMessages)
  const [paused, setPaused] = React.useState(false)
  const [mode, setModeState] = React.useState<ChatMode>(() => (localStorage.getItem(MODE_STORE) === "teach" ? "teach" : "build"))
  React.useEffect(() => {
    bridge.mode = mode
    localStorage.setItem(MODE_STORE, mode)
  }, [mode])

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/studio/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const key = localStorage.getItem(KEY_STORE)
          const s = bridge.studio
          return {
            // Dividers are for the learner; each message already carries the tree it was sent with.
            body: { messages: trimMessages(messages.filter((m) => !isDivider(m))), tree: s?.treeRef.current, summary: s?.summary ?? "", mode: bridge.mode },
            headers: key ? { "x-deepseek-key": key } : undefined,
          }
        },
      }),
    [],
  )

  const chat = useChat({
    messages: initial,
    transport,
    // Re-render (and re-parse the Markdown) at most every 40 ms while text streams in.
    throttle: 40,
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
    (text: string, files?: FileUIPart[], notes?: Note[], shot?: string | null) => {
      const t = text.trim()
      if (!t && !files?.length && !notes?.length) return
      setPaused(false)
      const s = bridge.studio
      s?.checkpoint()
      // What the model is told the part looks like for this whole turn, and where the learner pointed.
      const annotations = notes?.length ? notes.map(({ hash: _hash, ...a }) => a) : undefined
      const metadata = s ? { tree: s.treeRef.current, summary: s.summary, annotations } : { annotations }
      const all = [...(files ?? []), ...(shot ? [{ type: "file" as const, mediaType: "image/png", filename: ANNOTATED_VIEW, url: shot }] : [])]
      void chat.sendMessage({ text: t || (notes?.length ? "按标注修改" : "照着这张图建模"), files: all.length ? all : undefined, metadata })
    },
    [chat],
  )

  /** 「—— 换成了分享的模型「法兰盘」——」: the model changed under the conversation. Nothing to mark in an empty chat. */
  const { setMessages } = chat
  const addDivider = React.useCallback(
    (text: string) =>
      setMessages((list) =>
        list.length ? [...list, { id: `divider-${Date.now()}`, role: "assistant", parts: [{ type: "text", text }], metadata: { divider: true } }] : list,
      ),
    [setMessages],
  )

  const clear = React.useCallback(() => {
    void chat.stop()
    chat.setMessages([])
    setPaused(false)
    localStorage.removeItem(STORE)
  }, [chat])

  // Between the steps of one turn the status drops to "ready" for a moment before the next
  // request starts; hold `busy` over that gap so the UI doesn't flicker between steps.
  const requesting = chat.status === "submitted" || chat.status === "streaming"
  const [wasRequesting, setWasRequesting] = React.useState(requesting)
  const [linger, setLinger] = React.useState(0)
  if (requesting !== wasRequesting) {
    setWasRequesting(requesting)
    if (!requesting) setLinger((n) => n + 1)
  }
  React.useEffect(() => {
    if (!linger) return
    const t = setTimeout(() => setLinger(0), BETWEEN_STEPS_MS)
    return () => clearTimeout(t)
  }, [linger])
  const busy = requesting || (linger > 0 && chat.status === "ready" && !paused)

  return { ...chat, send, clear, addDivider, paused, mode, setMode: setModeState, busy }
}

export type StudioChat = ReturnType<typeof useStudioChat>
