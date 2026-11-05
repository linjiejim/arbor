import * as React from "react"
import { Check, ChevronRight, Eye, ImagePlus, Pencil, Search, SlidersHorizontal, Square, Trash2, TriangleAlert, X, type LucideIcon } from "lucide-react"
import type { FileUIPart, UIMessage } from "ai"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Textarea } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { OpIcon } from "@/components/op-icon"
import type { OpId } from "@/content/ops"
import { STARTERS } from "../starters"
import type { Tree } from "../dsl"
import type { ToolOutput } from "../tools"
import { errorText, MAX_CALLS_PER_TURN, type StudioChat } from "../use-studio-chat"
import { Markdown } from "./markdown"

const EXAMPLES = [
  "做一个 80×50×30 的小盒子，顶部开口，壁厚 2，竖边 R6 圆角",
  "做一个外径 80、高 100 的杯子，壁厚 3，杯底外缘 R5 圆角",
  "做一个法兰盘：外径 120、厚 10，中心孔 ⌀40，在 ⌀90 圆周上均布 6 个 ⌀8 孔",
  "做一块 100×60×5 的安装板，四角各一个 ⌀6 通孔，离边 8 mm",
]

const TOOL_LABEL: Record<string, { label: string; op?: OpId; icon?: LucideIcon }> = {
  set_params: { label: "参数", icon: SlidersHorizontal },
  sketch: { label: "草图", op: "sketch" },
  extrude: { label: "拉伸", op: "extrude" },
  revolve: { label: "旋转", op: "revolve" },
  fillet: { label: "圆角", op: "fillet" },
  chamfer: { label: "倒角", op: "chamfer" },
  shell: { label: "抽壳", op: "shell" },
  hole: { label: "孔", op: "hole" },
  linear_pattern: { label: "线性阵列", op: "pattern" },
  circular_pattern: { label: "圆周阵列", op: "pattern" },
  mirror: { label: "镜像", op: "mirror" },
  sweep: { label: "扫掠", op: "sweep" },
  loft: { label: "放样", op: "loft" },
  draft: { label: "拔模", op: "draft" },
  edit_feature: { label: "修改特征", icon: Pencil },
  delete_feature: { label: "删除特征", icon: Trash2 },
  inspect: { label: "查看模型", icon: Search },
  look: { label: "看一眼", icon: Eye },
}

export function ChatPanel({
  chat,
  onSelectFeature,
  onLoad,
  ready,
}: {
  chat: StudioChat
  onSelectFeature: (id: string) => void
  onLoad: (t: Tree) => void
  ready: boolean
}) {
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<FileUIPart[]>([])
  const [fileError, setFileError] = React.useState<string | null>(null)
  const picker = React.useRef<HTMLInputElement>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const err = errorText(chat.error)

  React.useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages, chat.status])

  const submit = () => {
    if ((!text.trim() && !files.length) || chat.busy || !ready) return
    chat.send(text, files.length ? files : undefined)
    setText("")
    setFiles([])
  }

  const attach = async (list: FileList | null) => {
    setFileError(null)
    const picked = [...(list ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, 2 - files.length)
    try {
      const parts = await Promise.all(picked.map(toImagePart))
      setFiles((f) => [...f, ...parts].slice(0, 2))
    } catch {
      setFileError("这张图读不出来，换一张 JPG 或 PNG 试试。")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {chat.messages.length === 0 ? (
          <Intro onPick={(t) => ready && chat.send(t)} onLoad={onLoad} disabled={!ready} />
        ) : (
          <div className="space-y-4">
            {chat.messages.map((m) => (
              <Message key={m.id} m={m} onSelectFeature={onSelectFeature} />
            ))}
            {chat.status === "submitted" && (
              <div className="flex items-center gap-2 text-small text-muted-foreground">
                <Spinner className="size-3.5" /> 思考中…
              </div>
            )}
            {chat.paused && (
              <div className="rounded-md border p-3 text-small text-muted-foreground">
                这一轮已经调用了 {MAX_CALLS_PER_TURN} 次工具，先停一下。看看模型，需要的话说「继续」。
              </div>
            )}
            {err && (
              <div role="alert" className="rounded-md border border-destructive/40 p-3 text-small">
                <div className="flex items-start gap-2 text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{err}</span>
                </div>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => void chat.regenerate()}>
                  重试
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t p-3">
        {files.length > 0 && (
          <div className="mb-2 flex gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative">
                <img src={f.url} alt="参考图" className="size-14 rounded-md border object-cover" />
                <button
                  type="button"
                  aria-label="移除这张图"
                  onClick={() => setFiles((x) => x.filter((_, k) => k !== i))}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {fileError && <p className="mb-2 text-small text-destructive">{fileError}</p>}
        <Textarea
          rows={2}
          value={text}
          placeholder={ready ? "描述你想做的零件，或者说要改哪里… Enter 发送" : "建模内核加载中…"}
          disabled={!ready}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="resize-none"
          aria-label="给建模助教的消息"
        />
        <div className="mt-2 flex items-center gap-2">
          <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => void attach(e.target.files).finally(() => (e.target.value = ""))} />
          <IconButton label="附参考图（照片或草图）" size="icon-sm" disabled={!ready || files.length >= 2} onClick={() => picker.current?.click()}>
            <ImagePlus />
          </IconButton>
          <Segmented
            size="sm"
            aria-label="对话模式"
            value={chat.mode}
            onValueChange={chat.setMode}
            options={[
              { value: "build", label: "直接做" },
              { value: "teach", label: "边做边学" },
            ]}
          />
          {chat.busy ? (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => void chat.stop()}>
              <Square />
              停止
            </Button>
          ) : (
            <Button size="sm" variant="primary" className="ml-auto" disabled={(!text.trim() && !files.length) || !ready} onClick={submit}>
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Intro({ onPick, onLoad, disabled }: { onPick: (t: string) => void; onLoad: (t: Tree) => void; disabled: boolean }) {
  return (
    <div>
      <h2 className="text-heading font-semibold">用说的来建模</h2>
      <p className="mt-2 text-body text-muted-foreground">
        描述零件的形状和尺寸，助教会一步步建出参数化特征树：每一步都能回滚查看，参数可以直接拖。几何由 OpenCascade 内核在你的浏览器里算出。
      </p>
      <div className="mt-4 text-small text-faint-foreground">试试这些</div>
      <div className="mt-2 flex flex-col gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            disabled={disabled}
            onClick={() => onPick(e)}
            className="rounded-md border px-3 py-2 text-left text-body transition-colors duration-(--duration-fast) hover:bg-accent disabled:opacity-50"
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-6 text-small text-faint-foreground">或者从现成的特征树开始（不用 AI）</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {STARTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            title={s.note}
            onClick={() => onLoad(s.tree)}
            className="rounded-md border px-3 py-2 text-left text-body transition-colors duration-(--duration-fast) hover:bg-accent disabled:opacity-50"
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  )
}

function Message({ m, onSelectFeature }: { m: UIMessage; onSelectFeature: (id: string) => void }) {
  if (m.role === "user") {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    const images = m.parts.filter((p): p is FileUIPart => p.type === "file" && p.mediaType.startsWith("image/"))
    return (
      <div className="ml-8 rounded-lg bg-muted px-3 py-2 text-body whitespace-pre-wrap">
        {images.length > 0 && (
          <div className="mb-2 flex gap-2">
            {images.map((f, i) => (
              <img key={i} src={f.url} alt="参考图" className="max-h-28 rounded-md border" />
            ))}
          </div>
        )}
        {text}
      </div>
    )
  }
  // One turn spans many steps, each with its own bit of thinking; show it as one block.
  const thoughts = m.parts.flatMap((p) => (p.type === "reasoning" && p.text.trim() ? [p.text.trim()] : []))
  return (
    <div className="space-y-2">
      {thoughts.length > 0 && <Reasoning parts={thoughts} />}
      {m.parts.map((p, i) => {
        if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} /> : null
        if (p.type.startsWith("tool-")) return <ToolCard key={i} part={p as ToolPart} onSelectFeature={onSelectFeature} />
        return null
      })}
    </div>
  )
}

function Reasoning({ parts }: { parts: string[] }) {
  return (
    <details className="group text-small text-faint-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 select-none">
        <ChevronRight className="size-3.5 transition-transform duration-(--duration-fast) group-open:rotate-90" />
        思考过程
      </summary>
      <div className="mt-1 space-y-3 border-l pl-3 whitespace-pre-wrap">
        {parts.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
    </details>
  )
}

type ToolPart = {
  type: string
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string
  input?: Record<string, unknown>
  output?: ToolOutput
  errorText?: string
}

function ToolCard({ part, onSelectFeature }: { part: ToolPart; onSelectFeature: (id: string) => void }) {
  const name = part.type.slice(5)
  const meta = TOOL_LABEL[name] ?? { label: name }
  const input = part.input ?? {}
  const featureId = (input.id as string | undefined) ?? undefined
  const title = [meta.label, (input.name as string) ?? featureId].filter(Boolean).join(" · ")
  const running = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error" || (part.state === "output-available" && part.output && !part.output.ok)
  const text = part.state === "output-error" ? part.errorText : part.output?.text
  const [open, setOpen] = React.useState(false)
  const firstLine = text?.split("\n")[0]
  const clickable = featureId && name !== "delete_feature"
  const Icon = meta.icon

  return (
    <div className={cn("rounded-md border text-small", failed && "border-destructive/40")}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => {
          setOpen((o) => !o)
          if (clickable && !failed) onSelectFeature(featureId)
        }}
        aria-expanded={open}
      >
        {meta.op ? <OpIcon op={(name === "extrude" && input.mode === "cut" ? "cut" : meta.op) as OpId} className="size-4 shrink-0 text-muted-foreground" /> : Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {running ? <Spinner className="size-3.5" /> : failed ? <X className="size-4 text-destructive" /> : <Check className="size-4 text-success" />}
      </button>
      {!running && firstLine && !open && <div className="truncate px-3 pb-2 text-muted-foreground">{firstLine.replace(/^[✓✗]\s*/, "")}</div>}
      {open && text && <div className="border-t px-3 py-2 whitespace-pre-wrap text-muted-foreground">{text}</div>}
      {open && typeof input.intent === "string" && <div className="border-t px-3 py-2 text-muted-foreground">设计意图：{input.intent}</div>}
      {part.output?.images?.length ? (
        <div className="grid grid-cols-2 gap-1 border-t p-1">
          {part.output.images.map((src, i) => (
            <img key={i} src={src} alt="助教看到的视图" className="w-full rounded-sm border" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Read an image, shrink it to at most 1024 px, return it as a data-URL file part. */
async function toImagePart(file: File): Promise<FileUIPart> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { type: "file", mediaType: "image/jpeg", filename: file.name, url: canvas.toDataURL("image/jpeg", 0.85) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
