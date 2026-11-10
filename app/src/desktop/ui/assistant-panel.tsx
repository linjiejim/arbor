import * as React from "react"
import type { UIMessage } from "ai"
import { ArrowUp, Check, Settings2, Square, X } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Textarea } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Markdown } from "@/studio/ui/markdown"
import { cn } from "@/lib/utils"
import { turnery } from "../bridge"
import type { ModelSettings } from "../core/protocol"
import { useAssistant } from "../use-assistant"
import { ModelSettingsDialog } from "./model-settings"
import { commandLabel } from "./words"

type ToolPart = { type: string; state?: string; input?: unknown; output?: { ok?: boolean; text?: string; images?: string[] }; errorText?: string }

/** The built-in assistant: say what to build or change; it works with the same commands an outside agent has. */
export function AssistantPanel() {
  const chat = useAssistant()
  const [text, setText] = React.useState("")
  const [settings, setSettings] = React.useState<ModelSettings | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const end = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    void turnery.models().then(setSettings)
  }, [])
  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [chat.messages, chat.busy])

  const current = settings?.presets.find((p) => p.id === settings.current)
  const usable = Boolean(current && (current.keyless || current.hasKey) && (current.model || current.defaultModel))
  const submit = () => {
    if (chat.send(text)) setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-small text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="size-3.5 shrink-0" />
          <span className="truncate">{current ? `${current.name} · ${current.model || current.defaultModel || "还没填模型名"}` : "配置模型"}</span>
        </button>
        <span className="flex-1" />
        {chat.messages.length > 0 && !chat.busy && (
          <Button size="sm" variant="ghost" onClick={chat.clear}>
            清空
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-label="和助手的对话" role="log">
        {chat.messages.length === 0 ? (
          <div className="pt-6 text-body text-muted-foreground">
            <p className="text-heading font-semibold text-foreground">用说的来建和改</p>
            <p className="mt-2">说出要做什么，助手在这个零件上一步步做，每一步你都看得到，做完会核对你说的数字。</p>
            <p className="mt-2">它能用的只有 Turnery 的建模命令：碰不到别的文件，也不能运行程序。</p>
            {!usable && (
              <Button className="mt-4" variant="primary" onClick={() => setSettingsOpen(true)}>
                先配置模型
              </Button>
            )}
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {chat.messages.map((m) => (
              <li key={m.id}>
                <Message message={m} streaming={chat.busy && m === chat.messages[chat.messages.length - 1]} />
              </li>
            ))}
          </ol>
        )}
        {chat.busy && (
          <div className="mt-3 flex items-center gap-2 text-small text-muted-foreground">
            <Spinner className="size-3.5" />
            助手在做…
          </div>
        )}
        {chat.error && !chat.busy && <p className="mt-3 text-small text-destructive">{chat.error.message}</p>}
        <div ref={end} />
      </div>

      <form
        className="shrink-0 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="relative">
          <Textarea
            rows={3}
            value={text}
            disabled={!usable}
            aria-label="对助手说"
            placeholder={usable ? "例如：把壁厚改成 3，再核对一遍" : "先配置模型"}
            className="resize-none pr-11"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <div className="absolute right-1.5 bottom-1.5">
            {chat.busy ? (
              <IconButton label="停止" variant="secondary" size="icon-sm" onClick={() => void chat.stop()}>
                <Square />
              </IconButton>
            ) : (
              <IconButton label="发送" variant="primary" size="icon-sm" type="submit" disabled={!usable || !text.trim()}>
                <ArrowUp />
              </IconButton>
            )}
          </div>
        </div>
      </form>
      <ModelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setSettings} />
    </div>
  )
}

function Message({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  if (message.role === "user")
    return (
      <div className="ml-8 rounded-lg bg-accent px-3 py-2 text-body whitespace-pre-wrap">
        {message.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
      </div>
    )
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((p, i) => {
        if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} streaming={streaming} /> : null
        if (p.type.startsWith("tool-")) return <ToolRow key={i} part={p as ToolPart} />
        return null
      })}
    </div>
  )
}

/** One command the assistant ran: what it was, whether it worked, the first line of the result. */
function ToolRow({ part }: { part: ToolPart }) {
  const name = part.type.slice("tool-".length)
  const done = part.state === "output-available" || part.state === "output-error"
  const ok = part.state === "output-available" && part.output?.ok !== false
  const line = part.errorText ?? part.output?.text?.split("\n")[0] ?? ""
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-2 text-small">
        {!done ? <Spinner className="size-3.5" /> : ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-destructive" />}
        <span className="font-medium">{commandLabel(name)}</span>
        <span className="font-mono text-caption text-faint-foreground">{name}</span>
      </div>
      {line && <p className={cn("mt-1 line-clamp-2 text-caption", ok ? "text-muted-foreground" : "text-destructive")}>{line.replace(/^[✓✗] /, "")}</p>}
      {part.output?.images?.length ? (
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
          {part.output.images.map((src, i) => (
            <img key={i} src={src} alt={`视图 ${i + 1}`} className="h-24 rounded border bg-card" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
