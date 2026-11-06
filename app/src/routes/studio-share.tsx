import * as React from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, Download, Undo2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, IconButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { StateView } from "@/components/ui/state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { documentTitle } from "@/lib/page-meta"
import { saveBlob } from "@/studio/download"
import type { Hover } from "@/studio/scene"
import { deleteShare, loadShare, shareToken, type Loaded, type SharedSnapshot } from "@/studio/share"
import { ConnectorOverlay } from "@/studio/ui/connector-overlay"
import { Markdown } from "@/studio/ui/markdown"
import { PanelResizer } from "@/studio/ui/panel-resizer"
import { usePanelWidth } from "@/studio/ui/panel-width"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import { StudioViewport } from "@/studio/ui/studio-viewport"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useAnnotations } from "@/studio/use-annotations"
import { useStudio } from "@/studio/use-studio"
import type { Incoming } from "@/routes/studio"

/** Shared links aren't listed anywhere; keep them out of search results too (crawlers that run JS see this). */
function useNoIndex() {
  React.useEffect(() => {
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex"
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

type Result = Loaded | { kind: "error"; message: string }

/** /studio/s/:id — someone's model, read-only: look, roll back, try parameters, then copy it to your own studio. */
export function StudioSharePage() {
  const { id = "" } = useParams()
  useNoIndex()
  const [attempt, setAttempt] = React.useState(0)
  const [result, setResult] = React.useState<{ key: string; value: Result } | null>(null)
  const key = `${id}#${attempt}`
  React.useEffect(() => {
    let live = true
    loadShare(id).then(
      (value) => live && setResult({ key, value }),
      (e) => live && setResult({ key, value: { kind: "error", message: (e as Error).message } }),
    )
    return () => {
      live = false
    }
  }, [id, key])
  const value = result?.key === key ? result.value : null

  if (!value)
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner className="size-5" label="正在打开分享的模型" />
      </div>
    )
  if (value.kind === "ok") return <SharedStudio key={value.snap.id} snap={value.snap} onDeleted={() => setResult({ key, value: { kind: "missing" } })} />
  const toStudio = (
    <Button asChild size="sm" variant="secondary">
      <Link to="/studio">去工作台</Link>
    </Button>
  )
  if (value.kind === "missing") return <StateView kind="no-match" title="这个链接不存在或已被删除" description="链接可能抄错了，或者分享的人已经删除了它。" action={toStudio} className="min-h-dvh" />
  if (value.kind === "broken")
    return (
      <StateView
        kind="error"
        title="这个链接里的模型打不开"
        description={`特征树格式不对：${value.message}。可能是更新版本的工作台做的，可以下载原始 JSON 留着。`}
        action={
          <Button size="sm" variant="secondary" onClick={() => saveBlob(new Blob([JSON.stringify(value.raw, null, 2)], { type: "application/json" }), `featuretree-share-${id}.json`)}>
            下载原始 JSON
          </Button>
        }
        className="min-h-dvh"
      />
    )
  return <StateView kind="error" title="没能打开这个链接" description={value.message} onRetry={() => setAttempt((n) => n + 1)} className="min-h-dvh" />
}

function SharedStudio({ snap, onDeleted }: { snap: SharedSnapshot; onDeleted: () => void }) {
  const navigate = useNavigate()
  const studio = useStudio(snap.tree)
  const annotations = useAnnotations(studio)
  const [hover, setHover] = React.useState<Hover | null>(null)
  const panel = usePanelWidth()
  const ready = studio.kernel.phase === "ready"
  const [token] = React.useState(() => shareToken(snap.id))
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => {
    document.title = documentTitle(`${snap.title} · 分享的模型`)
  }, [snap.title])

  // What the viewer sees, tried-out parameters included.
  const copy = () => navigate("/studio", { state: { incoming: { tree: studio.treeRef.current, title: snap.title } satisfies Incoming } })

  const download = async (format: "step" | "stl") => {
    const blob = await studio.exportBody(format)
    if (!blob) return notify("还没有实体可以导出")
    saveBlob(blob, `featuretree-${snap.id}.${format}`)
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label="返回首页" onClick={() => navigate("/")}>
          <ArrowLeft />
        </IconButton>
        <span className="truncate text-body font-semibold">{snap.title}</span>
        <Badge tone="outline" className="max-sm:hidden">
          分享
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="撤销上一步" disabled={!studio.canUndo} onClick={studio.undo}>
            <Undo2 />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="导出" disabled={!ready}>
                <Download />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void download("step")}>导出 STEP</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("stl")}>导出 STL</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="primary" size="sm" onClick={copy}>
            复制到我的工作台
          </Button>
        </div>
      </header>
      <div className="flex shrink-0 items-center gap-1 border-b bg-muted px-4 py-1.5 text-small text-muted-foreground">
        这是分享的模型，改动不会保存 ·
        <Button variant="link" size="sm" className="text-small" onClick={copy}>
          复制到我的工作台
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        <main className="relative min-h-0 min-w-0 flex-1">
          <StudioViewport studio={studio} hover={hover} annotations={annotations} busy={false} readOnly />
          <TreeOverlay studio={studio} onHover={setHover} readOnly />
        </main>
        <ConnectorOverlay param={hover?.param ?? null} row={hover?.row ?? null} />
        <Tabs
          defaultValue="about"
          style={{ "--panel-w": `${panel.width}px` } as React.CSSProperties}
          className="relative flex shrink-0 flex-col border-l lg:w-(--panel-w) max-lg:h-[55dvh] max-lg:w-full max-lg:border-t max-lg:border-l-0"
        >
          <PanelResizer {...panel} />
          <TabsList className="shrink-0 px-3">
            <TabsTrigger value="about">说明</TabsTrigger>
            <TabsTrigger value="params">参数</TabsTrigger>
            <TabsTrigger value="code">代码</TabsTrigger>
          </TabsList>
          <TabsContent value="about" className="min-h-0 flex-1 overflow-y-auto">
            <About snap={snap} mine={Boolean(token)} onDelete={() => setConfirmDelete(true)} />
          </TabsContent>
          <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
            <ParamsPanel studio={studio} onHover={setHover} />
          </TabsContent>
          <TabsContent value="code" className="min-h-0 flex-1 overflow-y-auto">
            <CodePanel studio={studio} />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="删除这个链接？"
        description="之后打开它的人只会看到「链接不存在」。删除后不能恢复。"
        confirmLabel="删除链接"
        tone="danger"
        onConfirm={async () => {
          if (!token) return
          await deleteShare(snap.id, token)
          notify.success("已删除链接")
          onDeleted()
        }}
      />
    </div>
  )
}

/** Title, note, and the chat replay when the sharer included it. All plain text except the replies' Markdown (no raw HTML). */
function About({ snap, mine, onDelete }: { snap: SharedSnapshot; mine: boolean; onDelete: () => void }) {
  const when = new Date(snap.created)
  const date = Number.isNaN(when.getTime()) ? null : when.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
  return (
    <div className="px-4 py-4">
      <h2 className="text-heading font-semibold break-words">{snap.title}</h2>
      {snap.note && <p className="mt-1 text-body break-words whitespace-pre-wrap text-muted-foreground">{snap.note}</p>}
      <p className="mt-2 text-caption text-faint-foreground">
        {[date && `${date}分享`, `${snap.tree.features.length} 个特征`, `${Object.keys(snap.tree.params).length} 个参数`].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-4 text-small text-muted-foreground">指向左侧的特征看每一步做了什么、为什么这样做，单击回到那一步；「参数」里可以临时改尺寸。</p>
      {snap.chat ? (
        <section aria-label="建模对话回放" className="mt-6">
          <h3 className="text-small font-medium">建模对话</h3>
          <p className="mt-0.5 text-caption text-faint-foreground">分享的人附上的对话，只能回看，不会带进你的对话。</p>
          <div className="mt-3 space-y-4">
            {snap.chat.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-8 rounded-lg bg-muted px-3 py-2 text-body break-words whitespace-pre-wrap">
                  {m.text}
                </div>
              ) : (
                <Markdown key={i} text={m.text} />
              ),
            )}
          </div>
        </section>
      ) : (
        <p className="mt-6 text-small text-faint-foreground">分享的人没有附上和助教的对话。</p>
      )}
      {mine && (
        <div className="mt-8 flex items-center gap-2 border-t pt-3 text-small text-muted-foreground">
          这个链接是你生成的。
          <Button variant="link" size="sm" className="text-small text-destructive" onClick={onDelete}>
            删除这个链接
          </Button>
        </div>
      )}
    </div>
  )
}
