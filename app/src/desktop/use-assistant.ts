import * as React from "react"
import { useChat } from "@ai-sdk/react"
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai"
import { trimMessages } from "@/studio/trim"
import { turnery } from "./bridge"
import { chatTitle, forStorage, newChatId, type ChatSummary } from "./core/chats"

/** Tool calls allowed per message before the loop stops and says so (the engine-side limit). */
export const MAX_STEPS = 30

/**
 * The chat's line to the main process: a turn is started with an id, its chunks come back as events
 * under that id, and the stream closes on the `null` that ends it. The model is never called from
 * the window (its CSP forbids it, and the key stays in the main process).
 */
function ipcTransport(): ChatTransport<UIMessage> {
  return {
    sendMessages: async ({ messages, abortSignal }) => {
      const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      let off = () => {}
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          let closed = false
          const close = () => {
            if (closed) return
            closed = true
            off()
            controller.close()
          }
          off = turnery.onAssistant((from, chunk) => {
            if (from !== id || closed) return
            if (chunk === null) close()
            else controller.enqueue(chunk as UIMessageChunk)
          })
          abortSignal?.addEventListener("abort", () => {
            void turnery.assistantStop(id)
            close()
          })
        },
        cancel() {
          off()
          void turnery.assistantStop(id)
        },
      })
      // Old pictures stay out of the message: only the latest views matter to the model.
      void turnery.assistantSend(id, trimMessages(messages)).catch(() => undefined)
      return stream
    },
    reconnectToStream: async () => null,
  }
}

export type Assistant = ReturnType<typeof useAssistantState>

const AssistantContext = React.createContext<Assistant | null>(null)

/** The conversation, held by the window itself: it outlives switching parts, projects and panels. */
export function AssistantProvider({ project, part, children }: { project: string | null; part: string | null; children: React.ReactNode }) {
  const value = useAssistantState(project, part)
  return React.createElement(AssistantContext.Provider, { value }, children)
}

export function useAssistant(): Assistant {
  const a = React.useContext(AssistantContext)
  if (!a) throw new Error("useAssistant outside AssistantProvider")
  return a
}

type Meta = { id: string; title: string | null; project: string | null; part: string | null; createdAt: number }

function useAssistantState(project: string | null, part: string | null) {
  const transport = React.useMemo(() => ipcTransport(), [])
  // Re-render (and re-parse the Markdown) at most every 50 ms while an answer streams in.
  const chat = useChat({ transport, throttle: 50 })
  const busy = chat.status === "submitted" || chat.status === "streaming"
  const fresh = (): Meta => ({ id: newChatId(), title: null, project, part, createdAt: Date.now() })
  const [meta, setMeta] = React.useState<Meta>(fresh)
  const [history, setHistory] = React.useState<ChatSummary[]>([])
  const [scope, setScope] = React.useState<"here" | "all">("here")
  /** What the person is typing: kept when the panel moves between floating and docked. */
  const [draft, setDraft] = React.useState("")

  const refresh = React.useCallback(() => {
    void turnery
      .chats(scope)
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [scope])
  React.useEffect(refresh, [refresh, project])

  // A conversation not begun yet belongs to wherever the window is when it begins.
  if (!busy && chat.messages.length === 0 && (meta.project !== project || meta.part !== part)) setMeta({ ...meta, project, part })
  const metaRef = React.useRef(meta)
  React.useLayoutEffect(() => {
    metaRef.current = meta
  })

  // Saved when a turn ends (finished, stopped or failed): the conversation survives a restart.
  // Only a turn ending counts: opening an old conversation doesn't move it to the top of the list.
  const { messages, status } = chat
  const wasBusy = React.useRef(false)
  /** Messages in the saved copy this window started from (see chatSave). */
  const savedCount = React.useRef(0)
  React.useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      wasBusy.current = true
      return
    }
    if (!wasBusy.current || !messages.length) return
    wasBusy.current = false
    const m = metaRef.current
    const base = savedCount.current
    void turnery
      .chatSave({ id: m.id, title: m.title ?? chatTitle(messages), project: m.project, part: m.part, createdAt: m.createdAt, updatedAt: Date.now(), messages: forStorage(messages) }, base)
      .then((id) => {
        savedCount.current = messages.length
        // Another window had carried this conversation on: ours went into a copy, which is now the one open here.
        if (id && id !== m.id) setMeta((cur) => (cur.id === m.id ? { ...cur, id, title: `${m.title ?? chatTitle(messages)}（副本）` } : cur))
        refresh()
      })
      .catch(() => undefined)
  }, [status, messages, refresh])

  const send = (text: string) => {
    const t = text.trim()
    if (!t || busy) return false
    void chat.sendMessage({ text: t })
    return true
  }
  const newChat = () => {
    if (busy) void chat.stop()
    chat.setMessages([])
    chat.clearError()
    savedCount.current = 0
    setMeta(fresh())
  }
  const open = async (id: string) => {
    if (busy || id === meta.id) return
    const record = await turnery.chatRead(id)
    if (!record) return refresh()
    chat.setMessages(record.messages)
    chat.clearError()
    savedCount.current = record.messages.length
    setMeta({ id: record.id, title: record.title, project: record.project, part: record.part, createdAt: record.createdAt })
  }
  const rename = async (title: string) => {
    const t = title.replace(/\s+/g, " ").trim()
    if (!t) return
    setMeta((m) => ({ ...m, title: t }))
    if (chat.messages.length) await turnery.chatRename(meta.id, t).catch(() => undefined)
    refresh()
  }
  const remove = async (id: string) => {
    await turnery.chatDelete(id).catch(() => undefined)
    if (id === meta.id) newChat()
    refresh()
  }

  return {
    id: meta.id,
    title: meta.title ?? (chat.messages.length ? chatTitle(chat.messages) : "新对话"),
    messages: chat.messages,
    status: chat.status,
    busy,
    error: chat.error,
    send,
    stop: chat.stop,
    newChat,
    open,
    rename,
    remove,
    history,
    scope,
    setScope,
    draft,
    setDraft,
  }
}
