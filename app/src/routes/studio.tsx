import * as React from "react"
import * as THREE from "three"
import { useNavigate } from "react-router"
import { ArrowLeft, Download, KeyRound, Undo2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, IconButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { Viewport } from "@/components/viewport"
import type { Viewer } from "@/three/viewer"
import { modelObject, repaint } from "@/studio/scene"
import { ChatPanel } from "@/studio/ui/chat-panel"
import { toBuild123d } from "@/studio/codegen"
import { CodePanel, ParamsPanel, TreePanel } from "@/studio/ui/side-panels"
import { useStudio, type Studio } from "@/studio/use-studio"
import { KEY_STORE, useStudioChat } from "@/studio/use-studio-chat"

type Status = { model: string; via?: "deepseek" | "openrouter" | "mock"; hostedKey: boolean; budgetExhausted: boolean }

export function StudioPage() {
  const navigate = useNavigate()
  const studio = useStudio()
  const chat = useStudioChat(studio)
  const [hover, setHover] = React.useState<string | null>(null)
  const [confirmNew, setConfirmNew] = React.useState(false)
  const [status, setStatus] = React.useState<Status | null>(null)
  const ready = studio.kernel.phase === "ready"
  const panel = usePanelWidth()
  // Arriving with ?start=… (from a teardown) means "let me play with this tree".
  const [tab, setTab] = React.useState(() => (new URLSearchParams(window.location.search).has("start") ? "tree" : "chat"))

  React.useEffect(() => {
    fetch("/api/studio/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStatus(s))
      .catch(() => setStatus(null))
  }, [])

  const download = async (format: "step" | "stl" | "json" | "py") => {
    const blob =
      format === "json"
        ? new Blob([JSON.stringify(studio.tree, null, 2)], { type: "application/json" })
        : format === "py"
          ? new Blob([toBuild123d(studio.tree)], { type: "text/x-python" })
          : await studio.exportBody(format)
    if (!blob) return notify("还没有实体可以导出")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `featuretree-model.${format}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label="返回首页" onClick={() => navigate("/")}>
          <ArrowLeft />
        </IconButton>
        <span className="truncate text-body font-semibold">AI 建模工作台</span>
        <Badge tone="outline" className="max-sm:hidden">
          Beta
        </Badge>
        {status && <span className="font-mono text-caption text-faint-foreground max-md:hidden">{status.model}</span>}
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="撤销上一步" disabled={!studio.canUndo || chat.busy} onClick={studio.undo}>
            <Undo2 />
          </IconButton>
          <KeySettings status={status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="导出">
                <Download />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void download("step")}>导出 STEP</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("stl")}>导出 STL</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("py")}>导出 build123d 代码</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("json")}>导出特征树（JSON）</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" disabled={chat.busy} onClick={() => setConfirmNew(true)}>
            新建模型
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        <main className="relative min-h-0 min-w-0 flex-1">
          <StudioViewport studio={studio} hover={hover} />
        </main>

        <Tabs
          value={tab}
          onValueChange={setTab}
          style={{ "--panel-w": `${panel.width}px` } as React.CSSProperties}
          className="relative flex shrink-0 flex-col border-l lg:w-(--panel-w) max-lg:h-[55dvh] max-lg:w-full max-lg:border-t max-lg:border-l-0"
        >
          <PanelResizer {...panel} />
          <TabsList className="shrink-0 px-3">
            <TabsTrigger value="chat">对话</TabsTrigger>
            <TabsTrigger value="tree">特征树</TabsTrigger>
            <TabsTrigger value="params">参数</TabsTrigger>
            <TabsTrigger value="code">代码</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" forceMount>
            {status && !status.hostedKey && !hasOwnKey() && (
              <div className="shrink-0 border-b px-4 py-2 text-small text-muted-foreground">服务器没有配置公共额度：点右上角钥匙图标，填自己的 DeepSeek key。</div>
            )}
            <ChatPanel
              chat={chat}
              ready={ready}
              onSelectFeature={studio.showFeature}
              onLoad={(t) => {
                studio.load(t)
                setTab("tree")
              }}
            />
          </TabsContent>
          <TabsContent value="tree" className="min-h-0 flex-1 overflow-y-auto">
            <TreePanel studio={studio} onHover={setHover} />
          </TabsContent>
          <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
            <ParamsPanel studio={studio} />
          </TabsContent>
          <TabsContent value="code" className="min-h-0 flex-1 overflow-y-auto">
            <CodePanel studio={studio} />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmNew}
        onOpenChange={setConfirmNew}
        title="新建模型？"
        description="会清空当前的特征树和对话。特征树可以用「撤销」找回，对话不能。"
        confirmLabel="清空并新建"
        tone="danger"
        onConfirm={() => {
          chat.clear()
          studio.reset()
        }}
      />
    </div>
  )
}

const hasOwnKey = () => Boolean(localStorage.getItem(KEY_STORE))

const PANEL_STORE = "ft-studio-panel-w"
const PANEL_DEFAULT = 420
const PANEL_MIN = 320
/** Leave the 3D view at least 360 px. */
const panelMax = () => Math.max(PANEL_MIN, Math.min(960, window.innerWidth - 360))
const clampPanel = (w: number) => Math.round(Math.min(panelMax(), Math.max(PANEL_MIN, w)))

function usePanelWidth() {
  const [width, setWidth] = React.useState(() => {
    const saved = Number(localStorage.getItem(PANEL_STORE))
    return saved ? clampPanel(saved) : PANEL_DEFAULT
  })
  const resize = React.useCallback((w: number, save = false) => {
    const next = clampPanel(w)
    setWidth(next)
    if (save) localStorage.setItem(PANEL_STORE, String(next))
  }, [])
  return { width, resize }
}

/** The side panel's left edge: drag to resize, arrow keys for steps, double-click to reset. */
function PanelResizer({ width, resize }: { width: number; resize: (w: number, save?: boolean) => void }) {
  const drag = React.useRef<{ x: number; w: number } | null>(null)
  const end = () => {
    if (!drag.current) return
    drag.current = null
    document.documentElement.style.removeProperty("cursor")
    resize(width, true)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整面板宽度"
      aria-valuenow={width}
      aria-valuemin={PANEL_MIN}
      tabIndex={0}
      className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none outline-none max-lg:hidden"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, w: width }
        document.documentElement.style.cursor = "col-resize"
      }}
      onPointerMove={(e) => drag.current && resize(drag.current.w + drag.current.x - e.clientX)}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => resize(PANEL_DEFAULT, true)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") resize(width + 24, true)
        else if (e.key === "ArrowRight") resize(width - 24, true)
        else return
        e.preventDefault()
      }}
    >
      <div className="mx-auto h-full w-px transition-colors duration-(--duration-fast) group-hover:bg-primary group-focus-visible:bg-primary group-active:bg-primary" />
    </div>
  )
}

function KeySettings({ status }: { status: Status | null }) {
  const [key, setKey] = React.useState(() => localStorage.getItem(KEY_STORE) ?? "")
  const save = () => {
    const k = key.trim()
    if (k) localStorage.setItem(KEY_STORE, k)
    else localStorage.removeItem(KEY_STORE)
    notify(k ? "已保存，之后的对话用你自己的 key" : "已清除，改用公共额度")
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label="模型与 key">
          <KeyRound />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="text-body font-medium">用自己的 DeepSeek key</div>
        <p className="mt-1 text-small text-muted-foreground">
          {status?.hostedKey
            ? `不填就用本站的公共额度（${status.via === "openrouter" ? "经 OpenRouter 调用同一个模型，" : ""}每天有上限）。`
            : "本站没有配置公共额度，需要填自己的 key。"}
          key 只保存在这个浏览器里，随请求经本站服务器转发给 DeepSeek，服务器不保存。
        </p>
        <Input className="mt-3 font-mono" type="password" autoComplete="off" placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="DeepSeek API key" />
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="primary" onClick={save}>
            保存 key
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function StudioViewport({ studio, hover }: { studio: Studio; hover: string | null }) {
  const [viewer, setViewer] = React.useState<Viewer | null>(null)
  const current = React.useRef<THREE.Group | null>(null)
  const fittedSize = React.useRef(0)
  const { display, kernel } = studio

  const onReady = React.useCallback((v: Viewer) => {
    setViewer(v)
    return () => setViewer(null)
  }, [])

  React.useEffect(() => {
    if (!viewer || !display) return
    const g = modelObject(display, viewer.kit, { status: true, highlight: hover ?? undefined })
    viewer.setContent(g)
    current.current = g
    if (display.bbox) {
      const box = new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1]))
      const size = box.getSize(new THREE.Vector3()).length()
      // Re-frame on the first model and when it changes size a lot; otherwise keep the learner's camera.
      if (!fittedSize.current || size > fittedSize.current * 1.6 || size < fittedSize.current / 2.5) {
        void viewer.fit(box, { view: fittedSize.current ? undefined : "iso", animate: fittedSize.current > 0 })
        fittedSize.current = size
      }
    } else fittedSize.current = 0
    // hover is applied by the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, display])

  React.useEffect(() => {
    if (!viewer || !current.current) return
    repaint(current.current, { status: true, highlight: hover ?? undefined })
    viewer.invalidate()
  }, [viewer, hover])

  return (
    <Viewport className="absolute inset-0" onReady={onReady}>
      {kernel.phase === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-md border bg-background px-4 py-3 text-body">
            <Spinner className="size-4" />
            正在加载建模内核（OpenCascade）… {kernel.loadedMB > 0 ? `${kernel.loadedMB.toFixed(1)} MB` : ""}
          </div>
        </div>
      )}
      {kernel.phase === "error" && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div role="alert" className="max-w-sm rounded-md border border-destructive/40 bg-background p-4 text-body">
            建模内核没能启动：{kernel.message}
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => location.reload()}>
                重新加载
              </Button>
            </div>
          </div>
        </div>
      )}
      {display?.mesh && (
        <div className="pointer-events-none absolute right-3 bottom-3 flex gap-3 rounded-md border bg-background/90 px-3 py-1.5 text-caption text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-primary" /> {hover ? "该特征生成的面" : "这一步新生成"}
          </span>
          {!hover && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-scene-modified" /> 被修改
            </span>
          )}
        </div>
      )}
    </Viewport>
  )
}
