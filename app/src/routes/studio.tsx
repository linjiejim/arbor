import * as React from "react"
import { useLocation, useNavigate } from "react-router"
import { ArrowLeft, CircleAlert, Download, Ellipsis, Share2, Undo2, X } from "lucide-react"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer"
import { Tour } from "@/components/hint"
import { practiceById, type Practice } from "@/content/practice"
import { PracticeCard } from "@/studio/ui/practice-card"
import { Button, IconButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { ChatPanel } from "@/studio/ui/chat-panel"
import { buildCode } from "@/studio/codegen"
import { saveBlob } from "@/studio/download"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { readTreeFile } from "@/studio/import"
import { checkTree } from "@/studio/limits"
import { PanelResizer } from "@/studio/ui/panel-resizer"
import { usePanelWidth } from "@/studio/ui/panel-width"
import { ShareDialog } from "@/studio/ui/share-dialog"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import type { Hover } from "@/studio/scene"
import { StudioViewport } from "@/studio/ui/studio-viewport"
import { ConnectorOverlay } from "@/studio/ui/connector-overlay"
import { NO_PARTS_VIEW, type PartsView } from "@/studio/scene"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { useReselect } from "@/studio/use-reselect"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useAnnotations } from "@/studio/use-annotations"
import { useStudio } from "@/studio/use-studio"
import { KEY_STORE, useStudioChat } from "@/studio/use-studio-chat"

type Status = { model: string; via?: "deepseek" | "openrouter" | "mock"; hostedKey: boolean; budgetExhausted: boolean }

/** What 「复制到我的工作台」 on a shared link hands over (router state, so it never touches storage). */
export type Incoming = { tree: Tree; title: string }

export function StudioPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const studio = useStudio()
  const chat = useStudioChat(studio)
  const annotations = useAnnotations(studio)
  // Pins of a sent message stay on the model until the reply is done.
  const { clearSent } = annotations
  React.useEffect(() => {
    if (!chat.busy) clearSent()
  }, [chat.busy, clearSent])
  const [hover, setHover] = React.useState<Hover | null>(null)
  const reselect = useReselect(studio)
  // A split body: how far its parts are pulled apart, and which are hidden.
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  // A message started from a feature card brings the conversation forward.
  const [tab, setTab] = React.useState("chat")
  /** 「工程图」: the drawing sheet over the 3D view; the side panel stays, so parameters can be changed while looking at it. */
  const [sheet, setSheet] = React.useState(false)
  const [seenPrefill, setSeenPrefill] = React.useState(annotations.prefill)
  if (seenPrefill !== annotations.prefill) {
    setSeenPrefill(annotations.prefill)
    if (annotations.prefill) setTab("chat")
  }
  const [confirmNew, setConfirmNew] = React.useState(false)
  const [sharing, setSharing] = React.useState(false)
  const [codeOpen, setCodeOpen] = React.useState(false)
  /** A practice from a lesson (/studio?practice=<id>): its card over the chat, its checks pinned in the tree. */
  // From the address (a lesson's link) or, after a reload, from storage.
  const [arriving] = React.useState(() => new URL(window.location.href).searchParams.get("practice"))
  const [practice, setPractice] = React.useState<Practice | null>(() => practiceById(arriving ?? localStorage.getItem(PRACTICE_STORE) ?? "") ?? null)
  const { pinChecks } = studio
  React.useEffect(() => pinChecks(practice?.checks ?? null), [practice, pinChecks])
  const exitPractice = React.useCallback(() => {
    setPractice(null)
    localStorage.removeItem(PRACTICE_STORE)
  }, [])
  const [keyOpen, setKeyOpen] = React.useState(false)
  const [status, setStatus] = React.useState<Status | null>(null)
  const ready = studio.kernel.phase === "ready"
  const panel = usePanelWidth()

  React.useEffect(() => {
    fetch("/api/studio/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStatus(s))
      .catch(() => setStatus(null))
  }, [])

  const partCount = studio.report?.parts?.length ?? 0
  /** Swap in another model: undoable, and the chat gets a line saying so. */
  const { load, undo } = studio
  const { addDivider } = chat
  const { reset: resetAnnotations } = annotations
  const replaceModel = React.useCallback(
    (tree: Tree, divider: string, done: string) => {
      resetAnnotations()
      addDivider(divider)
      void load(tree).then(() => notify.undo(done, undo))
    },
    [resetAnnotations, addDivider, load, undo],
  )

  // A practice from a lesson: once the kernel is up, start from its tree (undoable) and drop the parameter.
  const practiceTaken = React.useRef(false)
  React.useEffect(() => {
    if (!ready || arriving === null || practiceTaken.current) return
    practiceTaken.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete("practice")
    window.history.replaceState(null, "", url)
    const p = practiceById(arriving)
    if (!p) return void notify.error("没有找到这道练习")
    localStorage.setItem(PRACTICE_STORE, p.id)
    pinChecks(p.checks)
    replaceModel({ ...(p.start ?? EMPTY_TREE), checks: p.checks }, `开始练习「${p.title}」`, "已换成练习的起始模型")
  }, [ready, arriving, pinChecks, replaceModel])

  // 「复制到我的工作台」 from a shared link: replace once the kernel is up, then drop the state so a reload doesn't do it again.
  const incoming = (location.state as { incoming?: Incoming } | null)?.incoming
  const took = React.useRef(false)
  React.useEffect(() => {
    if (!ready || !incoming || took.current) return
    took.current = true
    navigate(".", { replace: true, state: null })
    const checked = checkTree(incoming.tree)
    if (!checked.ok) return void notify.error(`没能复制这个模型：${checked.message}`)
    replaceModel(checked.tree, `换成了分享的模型「${incoming.title}」`, "已替换当前模型")
  }, [ready, incoming, navigate, replaceModel])

  // Import: a file from the menu or dropped on the view. Errors stay over the view until closed.
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [importError, setImportError] = React.useState<{ file: string; message: string } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const importFile = async (file: File) => {
    setImportError(null)
    if (!ready) return setImportError({ file: file.name, message: "建模内核还没准备好，稍等再试" })
    if (chat.busy) return setImportError({ file: file.name, message: "助教正在改模型，这一轮结束后再导入" })
    const r = await readTreeFile(file)
    if (!r.ok) return setImportError({ file: file.name, message: r.message })
    replaceModel(r.tree, `导入了特征树「${r.name}」`, `已导入「${r.name}」`)
  }

  const download = async (format: "step" | "stl" | "json" | "py") => {
    if (format === "py") {
      const { code, problems } = buildCode(studio.tree)
      if (problems.length) return notify.error(`有 ${problems.length} 处不能安全地写成代码，没有导出：${problems[0]}`)
      return saveBlob(new Blob([code], { type: "text/x-python" }), "arbor-model.py")
    }
    const blob = format === "json" ? new Blob([JSON.stringify(studio.tree, null, 2)], { type: "application/json" }) : await studio.exportBody(format)
    if (!blob) return notify("还没有实体可以导出")
    saveBlob(blob, `arbor-model.${format === "stl" && blob.type === "application/zip" ? "zip" : format}`)
  }

  return (
    <Tour page="studio">
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label="返回首页" onClick={() => navigate("/")}>
          <ArrowLeft />
        </IconButton>
        <span className="truncate text-body font-semibold">工作台</span>
        {sheet ? (
          <Button size="sm" variant="secondary" className="mx-auto" onClick={() => setSheet(false)}>
            回到 3D
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex items-center gap-1">
          <IconButton label="撤销上一步" disabled={!studio.canUndo || chat.busy} onClick={studio.undo}>
            <Undo2 />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="导出">
                <Download />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void download("step")}>{partCount > 1 ? `导出 STEP（${partCount} 个零件）` : "导出 STEP"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("stl")}>{partCount > 1 ? "导出 STL（zip，每个零件一个文件）" : "导出 STL"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("py")}>导出 build123d 代码</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("json")}>导出特征树（JSON）</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton label="分享" disabled={!studio.tree.features.length || chat.busy} onClick={() => setSharing(true)}>
            <Share2 />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="更多">
                <Ellipsis />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSheet(!sheet)}>{sheet ? "回到 3D" : "工程图"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCodeOpen(true)}>代码</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!ready || chat.busy} onSelect={() => fileInput.current?.click()}>
                导入特征树（JSON）…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setKeyOpen(true)}>使用自己的 key…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" disabled={chat.busy} onClick={() => setConfirmNew(true)}>
            新建零件
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="选择特征树文件"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0]
            e.currentTarget.value = ""
            if (f) void importFile(f)
          }}
        />
      </header>

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        <main
          className="relative min-h-0 min-w-0 flex-1"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
            if (!dragging) setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) void importFile(f)
          }}
        >
          <StudioViewport studio={studio} hover={hover} annotations={annotations} busy={chat.busy} reselect={reselect} parts={partsView} onParts={setPartsView} />
          <TreeOverlay studio={studio} onHover={setHover} reselect={reselect} annotations={annotations} busy={chat.busy} parts={partsView} onParts={setPartsView} />
          {sheet && (
            <div className="absolute inset-0 z-30 bg-background">
              <DrawingSheet studio={studio} title={studio.tree.features.length ? "零件" : ""} />
            </div>
          )}
          {dragging && (
            <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-body font-medium">
              松开鼠标，导入这个特征树（JSON）
            </div>
          )}
          {importError && (
            <div
              role="alert"
              className="absolute top-3 left-1/2 z-20 flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-start gap-2 rounded-md border border-destructive/40 bg-background p-3 text-small shadow-popover"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 break-words">
                <div className="font-medium">没能导入「{importError.file}」</div>
                <div className="mt-0.5 text-muted-foreground">{importError.message}</div>
                <div className="mt-0.5 text-faint-foreground">当前模型没有改动。</div>
              </div>
              <IconButton label="关闭" size="icon-sm" tooltip={false} className="-mt-1 -mr-1 text-muted-foreground" onClick={() => setImportError(null)}>
                <X />
              </IconButton>
            </div>
          )}
        </main>
        <ConnectorOverlay param={hover?.param ?? null} row={hover?.row ?? null} />

        <Tabs
          value={tab}
          onValueChange={setTab}
          style={{ "--panel-w": `${panel.width}px` } as React.CSSProperties}
          className="relative flex shrink-0 flex-col border-l lg:w-(--panel-w) max-lg:h-[55dvh] max-lg:w-full max-lg:border-t max-lg:border-l-0"
        >
          <PanelResizer {...panel} />
          <TabsList className="shrink-0 px-3">
            <TabsTrigger value="chat">对话</TabsTrigger>
            <TabsTrigger value="params">参数</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" forceMount>
            {status && !status.hostedKey && !hasOwnKey() && (
              <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-small text-muted-foreground">
                这里没有公共额度，要用自己的 DeepSeek key
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setKeyOpen(true)}>
                  填 key
                </Button>
              </div>
            )}
            {practice && <PracticeCard practice={practice} results={studio.report?.checks} rolledBack={Boolean(studio.rollback)} onExit={exitPractice} />}
            <ChatPanel
              chat={chat}
              annotations={annotations}
              ready={ready}
              onSelectFeature={studio.showFeature}
              onLoad={studio.load}
              model={status?.model}
              practicing={Boolean(practice)}
            />
          </TabsContent>
          <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
            <ParamsPanel studio={studio} onHover={setHover} annotations={annotations} />
          </TabsContent>
        </Tabs>
      </div>

      <ShareDialog open={sharing} onOpenChange={setSharing} tree={studio.tree} messages={chat.messages} />
      <KeyDialog open={keyOpen} onOpenChange={setKeyOpen} status={status} />
      <Drawer open={codeOpen} onOpenChange={setCodeOpen}>
        <DrawerContent size="lg">
          <DrawerHeader title="代码" description="和特征树等价的 build123d 代码" />
          <DrawerBody className="p-0">
            <CodePanel studio={studio} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmNew}
        onOpenChange={setConfirmNew}
        title="新建零件？"
        description="会清空当前的特征树和对话。特征树可以用「撤销」找回，对话不能。"
        confirmLabel="清空并新建"
        tone="danger"
        onConfirm={() => {
          exitPractice()
          chat.clear()
          annotations.reset()
          studio.reset()
        }}
      />
    </div>
    </Tour>
  )
}

const PRACTICE_STORE = "arbor:practice"

const hasOwnKey = () => Boolean(localStorage.getItem(KEY_STORE))

function KeyDialog({ open, onOpenChange, status }: { open: boolean; onOpenChange: (o: boolean) => void; status: Status | null }) {
  const [key, setKey] = React.useState(() => localStorage.getItem(KEY_STORE) ?? "")
  const save = () => {
    const k = key.trim()
    if (k) localStorage.setItem(KEY_STORE, k)
    else localStorage.removeItem(KEY_STORE)
    notify(k ? "已保存，之后的对话用你自己的 key" : "已清除，改用公共额度")
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title="使用自己的 DeepSeek key" />
        <DialogBody>
        <p className="text-small text-muted-foreground">
          {status?.hostedKey
            ? `不填就用本站的公共额度（${status.via === "openrouter" ? "经 OpenRouter 调用同一个模型，" : ""}每天有上限）。`
            : "本站没有配置公共额度，需要填自己的 key。"}
          key 只保存在这个浏览器里，随请求经本站服务器转发给 DeepSeek，服务器不保存。
        </p>
        <Input className="mt-3 font-mono" type="password" autoComplete="off" placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="DeepSeek API key" />
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={save}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
