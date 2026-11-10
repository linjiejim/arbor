import * as React from "react"
import { useChat } from "@ai-sdk/react"
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai"
import { trimMessages } from "@/studio/trim"
import { turnery } from "./bridge"

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

/** The conversation with the built-in assistant in this window (kept while the window is open). */
export function useAssistant() {
  const transport = React.useMemo(() => ipcTransport(), [])
  const chat = useChat({ transport })
  const busy = chat.status === "submitted" || chat.status === "streaming"
  const send = (text: string) => {
    const t = text.trim()
    if (!t || busy) return false
    void chat.sendMessage({ text: t })
    return true
  }
  return { messages: chat.messages, busy, error: chat.error, send, stop: chat.stop, clear: () => chat.setMessages([]) }
}
