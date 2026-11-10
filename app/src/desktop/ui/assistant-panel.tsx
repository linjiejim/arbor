import * as React from "react"
import type { UIMessage } from "ai"
import { ArrowUp, Check, ChevronRight, History, Settings2, Square, SquarePen, Trash2, X } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Input, Textarea } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Segmented } from "@/components/ui/segmented"
import { Spinner } from "@/components/ui/spinner"
import { Markdown } from "@/studio/ui/markdown"
import { cn } from "@/lib/utils"
import { turnery } from "../bridge"
import type { TurnUsage } from "../core/assistant"
import type { ModelSettings } from "../core/protocol"
import { activity } from "../assistant-activity"
import { useAssistant, type Assistant } from "../use-assistant"
import { ModelSettingsDialog } from "./model-settings"
import { ago, commandLabel, useNow } from "./words"

type ToolPart = { type: string; state?: string; input?: Record<string, unknown>; output?: { ok?: boolean; text?: string; images?: string[]; imagesDropped?: number }; errorText?: string }

/**
 * The built-in assistant: say what to build or change; it works with the same commands an outside
 * agent has. `head` is the strip the window frames it with (drag handle, dock and minimize buttons).
 */
export function AssistantPanel({ head }: { head: { props?: React.HTMLAttributes<HTMLDivElement>; actions: React.ReactNode } }) {
  const chat = useAssistant()
  const { draft: text, setDraft: setText } = chat
  const [settings, setSettings] = React.useState<ModelSettings | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  React.useEffect(() => {
    void turnery.models().then(setSettings)
  }, [])

  const current = settings?.presets.find((p) => p.id === settings.current)
  const usable = Boolean(current && (current.keyless || current.hasKey) && (current.model || current.defaultModel))
  const submit = () => {
    if (chat.send(text)) setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div {...head.props} className={cn("flex h-10 shrink-0 items-center gap-0.5 border-b pr-1.5 pl-3", head.props?.className)}>
        <ChatTitle chat={chat} />
        <span className="flex-1" />
        <HistoryButton chat={chat} />
        <IconButton label="新对话" size="icon-sm" disabled={chat.busy || chat.messages.length === 0} onClick={chat.newChat}>
          <SquarePen />
        </IconButton>
        {head.actions}
      </div>

      <Conversation chat={chat} usable={usable} onSettings={() => setSettingsOpen(true)} />

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
        <button
          type="button"
          className="mt-1.5 flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-caption text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="size-3.5 shrink-0" />
          <span className="truncate">{current ? `${current.name} · ${current.model || current.defaultModel || "还没填模型名"}` : "配置模型"}</span>
        </button>
      </form>
      <ModelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setSettings} />
    </div>
  )
}

/** The conversation's name; click to rename it. */
function ChatTitle({ chat }: { chat: Assistant }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  if (editing)
    return (
      <Input
        autoFocus
        aria-label="对话名称"
        value={draft}
        className="h-7 min-w-0 flex-1 text-small"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          void chat.rename(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") {
            setDraft(chat.title)
            setEditing(false)
          }
        }}
      />
    )
  return (
    <button
      type="button"
      title="改名"
      className="min-w-0 truncate rounded-md px-1 py-0.5 text-left text-small font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        setDraft(chat.title)
        setEditing(true)
      }}
    >
      {chat.title}
    </button>
  )
}

/** Past conversations held here (or everywhere): open one to look back or carry on. */
function HistoryButton({ chat }: { chat: Assistant }) {
  const [open, setOpen] = React.useState(false)
  const now = useNow(30_000)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label="历史对话" size="icon-sm">
          <History />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-small font-medium">历史对话</span>
          <span className="flex-1" />
          <Segmented
            size="sm"
            aria-label="范围"
            value={chat.scope}
            onValueChange={(v) => chat.setScope(v as "here" | "all")}
            options={[
              { value: "here", label: "这个项目" },
              { value: "all", label: "全部" },
            ]}
          />
        </div>
        {chat.history.length === 0 ? (
          <p className="px-3 py-6 text-center text-small text-muted-foreground">还没有保存的对话。每一轮回答完都会自动保存。</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1" aria-label="历史对话">
            {chat.history.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button
                  type="button"
                  disabled={chat.busy}
                  className={cn("flex min-w-0 flex-1 flex-col px-3 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50", c.id === chat.id && "bg-accent")}
                  onClick={() => {
                    void chat.open(c.id)
                    setOpen(false)
                  }}
                >
                  <span className="truncate text-small">{c.title}</span>
                  <span className="truncate text-caption text-faint-foreground">
                    {ago(c.updatedAt, now)} · {c.count} 条{chat.scope === "all" && c.project ? ` · ${c.project.split(/[\\/]/).pop()}` : ""}
                  </span>
                </button>
                <IconButton label="删除这段对话" size="icon-sm" className="mr-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" disabled={chat.busy && c.id === chat.id} onClick={() => void chat.remove(c.id)}>
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** The messages, kept at the bottom while the answer grows unless the person scrolled up to read. */
function Conversation({ chat, usable, onSettings }: { chat: Assistant; usable: boolean; onSettings: () => void }) {
  const box = React.useRef<HTMLDivElement>(null)
  const stuck = React.useRef(true)
  React.useEffect(() => {
    stuck.current = true
  }, [chat.id])
  React.useLayoutEffect(() => {
    const el = box.current
    if (el && stuck.current) el.scrollTop = el.scrollHeight
  }, [chat.messages, chat.busy, chat.id])
  const last = chat.messages.at(-1)
  return (
    <div
      ref={box}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      aria-label="和助手的对话"
      role="log"
      onScroll={(e) => {
        const el = e.currentTarget
        stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
    >
      {chat.messages.length === 0 ? (
        <div className="pt-6 text-body text-muted-foreground">
          <p className="text-heading font-semibold text-foreground">用说的来建和改</p>
          <p className="mt-2">说出要做什么，助手在这个零件上一步步做，每一步你都看得到，做完会核对你说的数字。</p>
          <p className="mt-2">它能用的只有 Turnery 的建模命令：碰不到别的文件，也不能运行程序。</p>
          {!usable && (
            <Button className="mt-4" variant="primary" onClick={onSettings}>
              先配置模型
            </Button>
          )}
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {chat.messages.map((m) => (
            <li key={m.id}>
              <Message message={m} live={chat.busy && m === last} />
            </li>
          ))}
        </ol>
      )}
      {chat.busy && <TurnStatus chat={chat} />}
      {chat.error && !chat.busy && <p className="mt-3 text-small text-destructive">{chat.error.message}</p>}
    </div>
  )
}

/** Earlier messages don't change: only the one being written re-renders while it streams. */
const Message = React.memo(function Message({ message, live }: { message: UIMessage; live: boolean }) {
  if (message.role === "user")
    return (
      <div className="ml-8 rounded-lg bg-accent px-3 py-2 text-body whitespace-pre-wrap">
        {message.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
      </div>
    )
  const usage = (message.metadata as { usage?: TurnUsage } | undefined)?.usage
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((p, i) => {
        if (p.type === "reasoning") return p.text.trim() ? <Reasoning key={i} text={p.text} live={live && p.state === "streaming"} /> : null
        if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} streaming={live && p.state === "streaming"} /> : null
        if (p.type.startsWith("tool-")) return <ToolRow key={i} part={p as ToolPart} />
        return null
      })}
      {usage && !live && <UsageLine usage={usage} />}
    </div>
  )
})

/**
 * What the model is thinking. While it thinks, the latest lines show as they come (a long silence
 * was the worst part of waiting); afterwards it folds into one line that opens on a click.
 */
function Reasoning({ text, live }: { text: string; live: boolean }) {
  const tail = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    if (live && tail.current) tail.current.scrollTop = tail.current.scrollHeight
  }, [text, live])
  if (live)
    return (
      <div className="text-small text-faint-foreground">
        <div className="flex items-center gap-1">
          <Spinner className="size-3" />
          思考中
        </div>
        <div ref={tail} className="mt-1 max-h-24 overflow-hidden border-l pl-3 whitespace-pre-wrap">
          {text.trim()}
        </div>
      </div>
    )
  return (
    <details className="group text-small text-faint-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 select-none hover:text-muted-foreground">
        <ChevronRight className="size-3.5 transition-transform duration-(--duration-fast) group-open:rotate-90" />
        思考过程
      </summary>
      <div className="mt-1 border-l pl-3 whitespace-pre-wrap">{text.trim()}</div>
    </details>
  )
}

/** One command the assistant ran: what it was, whether it worked, the first line of the result. */
function ToolRow({ part }: { part: ToolPart }) {
  const name = part.type.slice("tool-".length)
  const done = part.state === "output-available" || part.state === "output-error"
  const ok = part.state === "output-available" && part.output?.ok !== false
  const line = part.errorText ?? part.output?.text?.split("\n")[0] ?? ""
  const target = typeof part.input?.name === "string" ? part.input.name : typeof part.input?.id === "string" ? part.input.id : null
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-2 text-small">
        {!done ? <Spinner className="size-3.5" /> : ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-destructive" />}
        <span className="font-medium">{commandLabel(name)}</span>
        {target && <span className="min-w-0 truncate text-muted-foreground">{target}</span>}
        <span className="ml-auto shrink-0 font-mono text-caption text-faint-foreground">{name}</span>
      </div>
      {line && <p className={cn("mt-1 line-clamp-2 text-caption", ok ? "text-muted-foreground" : "text-destructive")}>{line.replace(/^[✓✗] /, "")}</p>}
      {part.output?.images?.length ? (
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
          {part.output.images.map((src, i) => (
            <img key={i} src={src} alt={`视图 ${i + 1}`} className="h-24 rounded border bg-card" />
          ))}
        </div>
      ) : part.output?.imagesDropped ? (
        <p className="mt-1 text-caption text-faint-foreground">{part.output.imagesDropped} 张视图没有保存</p>
      ) : null}
    </div>
  )
}

const k = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

function UsageLine({ usage }: { usage: TurnUsage }) {
  if (!usage.input && !usage.output) return null
  const cached = usage.input && usage.cached ? `（缓存 ${Math.round((usage.cached / usage.input) * 100)}%）` : ""
  return (
    <p className="text-caption text-faint-foreground tabular">
      输入 {k(usage.input)}
      {cached} · 输出 {k(usage.output)} tokens
    </p>
  )
}

/** What the turn is doing right now, under the conversation while it runs, with how long it has taken. */
function TurnStatus({ chat }: { chat: Assistant }) {
  const [start] = React.useState(() => Date.now())
  const now = useNow(1000)
  const seconds = Math.round((now - start) / 1000)
  return (
    <div role="status" className="mt-3 flex items-center gap-2 text-small text-muted-foreground">
      <Spinner className="size-3.5" />
      <span className="truncate">{activity(chat)}…</span>
      {seconds >= 3 && <span className="ml-auto shrink-0 text-caption text-faint-foreground tabular">{seconds} 秒</span>}
    </div>
  )
}
