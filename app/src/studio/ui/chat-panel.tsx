import * as React from "react"
import { Check, ChevronRight, CircleHelp, Eye, ImagePlus, ListChecks, Pencil, Search, SlidersHorizontal, Square, Trash2, TriangleAlert, X, type LucideIcon } from "lucide-react"
import type { FileUIPart, UIMessage } from "ai"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Textarea } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { OpIcon } from "@/components/op-icon"
import type { OpId } from "@/content/ops"
import { isDivider } from "../share"
import { STARTERS } from "../starters"
import type { Tree } from "../dsl"
import type { ToolOutput } from "../tools"
import { ANNOTATED_VIEW, errorText, MAX_CALLS_PER_TURN, type StudioChat } from "../use-studio-chat"
import { Annotations as AnnotationList, circled, type Annotation } from "../annotations"
import type { Annotations, Note } from "../use-annotations"
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
  rib: { label: "筋", op: "rib" },
  split: { label: "拆件", op: "cut" },
  edit_feature: { label: "修改特征", icon: Pencil },
  delete_feature: { label: "删除特征", icon: Trash2 },
  inspect: { label: "查看模型", icon: Search },
  look: { label: "看一眼", icon: Eye },
  check: { label: "核对要求", icon: ListChecks },
}

/** Tools that only look at the model. */
const READ_TOOLS = new Set(["inspect", "look", "check"])

export function ChatPanel({
  chat,
  annotations,
  onSelectFeature,
  onLoad,
  ready,
}: {
  chat: StudioChat
  annotations: Annotations
  onSelectFeature: (id: string) => void
  onLoad: (t: Tree) => void
  ready: boolean
}) {
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<FileUIPart[]>([])
  const [fileError, setFileError] = React.useState<string | null>(null)
  const picker = React.useRef<HTMLInputElement>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  /** Follow new output only while the learner is at the bottom; scrolling up to read stops it. */
  const stick = React.useRef(true)
  const err = errorText(chat.error)

  React.useEffect(() => {
    const el = scroller.current
    const inner = content.current
    if (!el || !inner) return
    const follow = () => {
      // The intro reads from the top; only a conversation follows its end.
      if (stick.current && !inner.dataset.empty) el.scrollTop = el.scrollHeight
    }
    // Any growth counts: streamed text, a tool card filling in, a `look` image loading.
    const ro = new ResizeObserver(follow)
    ro.observe(inner)
    follow()
    return () => ro.disconnect()
  }, [])

  // 「让助教改这一步」: start the message with the step's name, cursor at the end.
  const box = React.useRef<HTMLTextAreaElement>(null)
  const [prefilled, setPrefilled] = React.useState(annotations.prefill)
  if (prefilled !== annotations.prefill) {
    setPrefilled(annotations.prefill)
    if (annotations.prefill) setText(annotations.prefill.text)
  }
  React.useEffect(() => {
    const el = box.current
    if (!annotations.prefill || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [annotations.prefill])

  const notes = annotations.pending
  const canSend = (text.trim() || files.length || notes.length) && !chat.busy && ready
  const submit = () => {
    if (!canSend) return
    stick.current = true
    chat.send(text, files.length ? files : undefined, notes, notes.length ? annotations.snapshot() : null)
    annotations.markSent()
    setText("")
    setFiles([])
  }

  // A reply's ①② refer to the annotations of the message it answers.
  const notesFor = React.useMemo(
    () => chat.messages.reduce<(Annotation[] | null)[]>((acc, m, i) => [...acc, m.role === "user" ? annotationsOf(m) : (acc[i - 1] ?? null)], []),
    [chat.messages],
  )

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
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
      >
        <div ref={content} data-empty={chat.messages.length === 0 || undefined} className="px-4 pt-4 pb-2">
          {chat.messages.length === 0 ? (
            <Intro
              onPick={(t) => {
                if (!ready) return
                stick.current = true
                chat.send(t)
              }}
              onLoad={onLoad}
              disabled={!ready}
            />
          ) : (
            <div className="space-y-4">
              {chat.messages.map((m, i) => (
                <Message key={m.id} m={m} notes={notesFor[i]} streaming={chat.busy && i === chat.messages.length - 1} onShow={annotations.show} onSelectFeature={onSelectFeature} />
              ))}
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
        {chat.busy && <TurnStatus chat={chat} />}
      </div>
      <div className="shrink-0 border-t p-3">
        {notes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label="要随消息发出的标注">
            {notes.map((a) => (
              <NoteChip key={a.n} a={a} onClick={() => annotations.setFocus({ kind: a.kind, hashes: [a.hash] })} onRemove={() => annotations.remove(a.n)} />
            ))}
          </div>
        )}
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
          ref={box}
          rows={2}
          value={text}
          placeholder={!ready ? "建模内核加载中…" : notes.length ? "补充说明（可以不写）… Enter 发送" : "描述你想做的零件，或者说要改哪里… Enter 发送"}
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
            <Button size="sm" variant="primary" className="ml-auto" disabled={!canSend} onClick={submit}>
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

function Message({
  m,
  notes,
  streaming,
  onShow,
  onSelectFeature,
}: {
  m: UIMessage
  notes: Annotation[] | null
  /** The reply still coming in: its unfinished Markdown is patched up while it streams. */
  streaming: boolean
  onShow: (a: Annotation) => void
  onSelectFeature: (id: string) => void
}) {
  const onPin = React.useMemo(
    () =>
      notes?.length
        ? (n: number) => {
            const a = notes.find((x) => x.n === n)
            if (a) onShow(a)
          }
        : undefined,
    [notes, onShow],
  )
  if (isDivider(m)) {
    // The model changed under the conversation (a copied link, an import): for the learner only, never sent.
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    return (
      <div role="separator" aria-label={text} className="flex items-center gap-3 text-caption text-faint-foreground">
        <span className="h-px flex-1 bg-border" />
        {text}
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }
  if (m.role === "user") {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    const images = m.parts.filter((p): p is FileUIPart => p.type === "file" && p.mediaType.startsWith("image/"))
    return (
      <div className="ml-8 rounded-lg bg-muted px-3 py-2 text-body whitespace-pre-wrap">
        {images.length > 0 && (
          <div className="mb-2 flex gap-2">
            {images.map((f, i) => (
              <img key={i} src={f.url} alt={f.filename === ANNOTATED_VIEW ? "标注截图" : "参考图"} className="max-h-28 rounded-md border" />
            ))}
          </div>
        )}
        {text}
        {notes && notes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 whitespace-normal">
            {notes.map((a) => (
              <NoteChip key={a.n} a={a} onClick={() => onShow(a)} />
            ))}
          </div>
        )}
      </div>
    )
  }
  // One turn spans many steps, each with its own bit of thinking; show it as one block.
  const thoughts = m.parts.flatMap((p) => (p.type === "reasoning" && p.text.trim() ? [p.text.trim()] : []))
  return (
    <div className="space-y-2">
      {thoughts.length > 0 && <Reasoning parts={thoughts} />}
      {m.parts.map((p, i) => {
        if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} onPin={onPin} streaming={streaming && p.state === "streaming"} /> : null
        if (p.type.startsWith("tool-")) return <ToolCard key={i} part={p as ToolPart} onSelectFeature={onSelectFeature} />
        return null
      })}
    </div>
  )
}

function annotationsOf(m: UIMessage): Annotation[] | null {
  const parsed = AnnotationList.safeParse((m.metadata as { annotations?: unknown } | undefined)?.annotations)
  return parsed.success && parsed.data.length ? parsed.data : null
}

/** ① 平面 · 来自「拉伸1」：开个孔 — click to show it on the model. */
function NoteChip({ a, onClick, onRemove }: { a: Annotation | Note; onClick: () => void; onRemove?: () => void }) {
  const label = a.note.trim() || `${a.kind === "face" ? "面" : "边"} · ${a.what}`
  return (
    <span className="inline-flex max-w-full items-center rounded-md border bg-background text-small">
      <button
        type="button"
        onClick={onClick}
        title={`${a.kind === "face" ? "面" : "边"} · ${a.what} · ${a.where}`}
        className="flex min-w-0 items-center gap-1 px-2 py-1 text-left hover:text-foreground"
      >
        <span className="font-semibold text-primary">{circled(a.n)}</span>
        <span className="truncate">{label}</span>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`删除标注 ${a.n}`} className="grid size-6 shrink-0 place-items-center text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/** What the turn is doing right now, pinned to the bottom of the conversation while it runs. */
function TurnStatus({ chat }: { chat: StudioChat }) {
  const [start] = React.useState(() => Date.now())
  const [now, setNow] = React.useState(start)
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const seconds = Math.round((now - start) / 1000)
  return (
    <div role="status" className="sticky bottom-0 flex items-center gap-2 bg-background/95 px-4 py-2 text-small text-muted-foreground">
      <Spinner className="size-3.5" />
      <span className="truncate">{activity(chat)}…</span>
      {seconds >= 3 && <span className="ml-auto shrink-0 text-caption text-faint-foreground tabular">{seconds} 秒</span>}
    </div>
  )
}

function activity(chat: StudioChat): string {
  const last = chat.messages.at(-1)
  if (chat.status === "submitted" || last?.role !== "assistant") return "思考中"
  const p = last.parts.at(-1)
  if (p?.type === "text" && p.state === "streaming") return "正在回复"
  if (p?.type.startsWith("tool-")) {
    const t = p as ToolPart
    if (t.state === "input-streaming" || t.state === "input-available") {
      const name = t.type.slice(5)
      if (name === "look") return "正在看模型"
      if (name === "inspect") return "正在查看模型"
      const label = TOOL_LABEL[name]?.label ?? name
      const target = (t.input?.name as string | undefined) ?? (t.input?.id as string | undefined)
      return `正在${t.state === "input-streaming" ? "写" : "做"}「${label}${target && target !== label ? ` · ${target}` : ""}」`
    }
  }
  return "思考中"
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
  // A check card is the table itself: one row per requirement, as it stood at that moment.
  const rows = name === "check" && part.state === "output-available" ? (part.output?.text ?? "").split("\n").filter((l) => /^[✓✗?] /.test(l)) : []
  const passed = rows.filter((l) => l.startsWith("✓")).length
  const counted = rows.filter((l) => !l.startsWith("?")).length
  const title = rows.length ? `${meta.label} · ${passed}/${counted}` : [meta.label, (input.name as string) ?? featureId].filter(Boolean).join(" · ")
  const running = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error" || (part.state === "output-available" && part.output && !part.output.ok)
  const text = part.state === "output-error" ? part.errorText : part.output?.text
  const [open, setOpen] = React.useState(false)
  const firstLine = text?.split("\n")[0]
  const clickable = featureId && name !== "delete_feature"
  const Icon = meta.icon
  // Steps that change the model get a fill, so they stand out from the prose and from `inspect` / `look`.
  const changes = !READ_TOOLS.has(name)

  return (
    <div className={cn("rounded-md border text-small", failed ? "border-destructive/40 bg-destructive-subtle" : changes && "border-primary/15 bg-selected")}>
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
      {rows.length > 0 && !open && (
        <ul className="space-y-0.5 px-3 pb-2">
          {rows.map((l, i) => (
            <li key={i} className="flex items-start gap-1.5">
              {l.startsWith("✓") ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="满足" />
              ) : l.startsWith("?") ? (
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-faint-foreground" aria-label="量不了" />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="不满足" />
              )}
              <span className="min-w-0 text-muted-foreground">{l.slice(2).replace(/^\S+「/, "「")}</span>
            </li>
          ))}
        </ul>
      )}
      {!running && firstLine && !open && !rows.length && <div className="truncate px-3 pb-2 text-muted-foreground">{firstLine.replace(/^[✓✗]\s*/, "")}</div>}
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
