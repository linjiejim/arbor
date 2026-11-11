import * as React from "react"
import { Download, MessageSquare, PanelLeft, Plug, Redo2, RotateCw, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { StatusDot } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { turnery } from "../bridge"
import type { DocState, PickRequest, Snapshot, UpdateStatus } from "../core/protocol"
import { TurneryWordmark } from "@/components/turnery-mark"
import { useAssistant } from "../use-assistant"
import { ago, commandLabel, useNow } from "./words"

/**
 * The window's top bar, beside the left panel (which has the brand, and on macOS the traffic lights, at its
 * top). Left: where you are (project / assembly / part), or with the panel closed the button that brings it
 * back. Right: the update, undo, redo, export, the conversation, and 「接入 Agent」 until one has worked here.
 * The bar drags the window.
 */
export function TitleBar({
  snapshot,
  doc,
  onSetup,
  setup,
  chat,
  sidebar,
  onSidebar,
}: {
  snapshot: Snapshot | null
  doc: DocState | null
  onSetup: () => void
  /** 「接入 Agent」 in the bar: until an agent has worked here (the menu and the status bar keep it after). */
  setup: boolean
  /** The built-in assistant's button: shows or puts away the conversation; spins while a turn runs. */
  chat: { open: boolean; onToggle: () => void }
  /** The left panel: open (it holds the brand and the traffic lights), closed, or none at all (the start page). */
  sidebar: boolean | null
  onSidebar: () => void
}) {
  const busy = useAssistant().busy
  const mac = turnery.platform === "darwin"
  const call = (name: string) => void turnery.call(name, {}, doc?.path)
  const project = snapshot?.project
  const context = doc?.context
  const noDrag = "[-webkit-app-region:no-drag]"
  // With the left panel open the traffic lights are over it; otherwise they are over this bar.
  const lights = mac && !sidebar
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-1 border-b pr-2 pl-3 select-none [-webkit-app-region:drag]", lights && "pl-22")}>
      {sidebar === null ? (
        <TurneryWordmark className="mr-1 h-[18px]" />
      ) : (
        !sidebar && (
          <IconButton label="展开左栏（⌘B）" size="icon-sm" className={cn("-ml-1 text-muted-foreground", noDrag)} onClick={onSidebar}>
            <PanelLeft />
          </IconButton>
        )
      )}
      <nav aria-label="位置" className="ml-1 flex min-w-0 items-center gap-1.5">
        {project && project.name !== doc?.name && (
          <>
            <span className="max-w-48 truncate text-body text-muted-foreground" title={project.root}>
              {project.name}
            </span>
            {doc && <span className="text-faint-foreground">/</span>}
          </>
        )}
        {context && (
          <>
            <button type="button" title={`回到装配：${context.assembly}`} className={cn("max-w-40 truncate rounded-sm text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", noDrag)} onClick={() => void turnery.call("open_part", { path: context.assembly })}>
              {context.name}
            </button>
            <span className="text-faint-foreground">/</span>
          </>
        )}
        {doc && (
          <span className="truncate text-body font-medium" title={doc.path}>
            {doc.name}
          </span>
        )}
        {context && <span className="shrink-0 rounded-sm bg-muted px-1.5 text-caption text-muted-foreground">在装配里</span>}
      </nav>
      <div className={cn("ml-auto flex items-center gap-0.5", noDrag)}>
        <UpdateStatusButton />
        {doc && (
          <>
            <IconButton label="撤销（⌘Z）" size="icon-sm" disabled={!doc?.canUndo} onClick={() => call("undo")}>
              <Undo2 />
            </IconButton>
            <IconButton label="重做（⇧⌘Z）" size="icon-sm" disabled={!doc?.canRedo} onClick={() => call("redo")}>
              <Redo2 />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="导出" size="icon-sm" disabled={!doc}>
                  <Download />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void turnery.exportPart("step")}>导出 STEP…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("stl")}>导出 STL…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("3mf")}>导出 3MF…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("py")}>导出 build123d 代码…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("json")}>导出特征树 JSON…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        <IconButton label={chat.open ? "收起对话" : "对话"} size="icon-sm" aria-pressed={chat.open} className={cn(chat.open && "bg-selected text-primary")} onClick={chat.onToggle}>
          {busy ? <Spinner /> : <MessageSquare />}
        </IconButton>
        {setup && (
          <Button size="sm" variant="secondary" className="ml-1" onClick={onSetup}>
            <Plug />
            接入 Agent
          </Button>
        )}
      </div>
    </header>
  )
}

/** What the agent is doing right now, or when it last did something. */
export function AgentStatus({ snapshot, pick, className }: { snapshot: Snapshot | null; pick: PickRequest | null; className?: string }) {
  const now = useNow()
  const a = snapshot?.agent
  const who = a?.who === "assistant" ? "助手" : "Agent"
  if (pick) return <StatusDot tone="warning" className={className}>{who} 在等你点选</StatusDot>
  if (a?.busy && a.tool)
    return (
      <StatusDot tone="info" className={className}>
        {who} 正在{commandLabel(a.tool)}…
      </StatusDot>
    )
  if (a?.at && a.tool)
    return (
      <StatusDot tone="success" className={cn("text-muted-foreground", className)}>
        {who} {ago(a.at, now)}{commandLabel(a.tool)}
      </StatusDot>
    )
  return <StatusDot className={cn("text-muted-foreground", className)}>没有 agent 在动</StatusDot>
}

function useUpdateStatus() {
  const [status, setStatus] = React.useState<UpdateStatus>({ phase: "idle" })
  React.useEffect(() => {
    let alive = true
    const off = turnery.onUpdate(setStatus)
    void turnery.update().then((s) => alive && setStatus(s))
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

/** A downloaded update waits for a restart; a download the person asked for shows its progress. */
function UpdateStatusButton() {
  const status = useUpdateStatus()
  if (status.phase === "ready")
    return (
      <Button size="sm" variant="primary" className="mr-2" onClick={() => void turnery.restartToUpdate()}>
        <RotateCw />
        重启以更新到 {status.version}
      </Button>
    )
  if (status.phase === "downloading" && status.asked)
    return (
      <span className="mr-2 text-caption text-muted-foreground tabular">
        正在下载 {status.version}
        {status.percent !== null ? ` · ${status.percent}%` : "…"}
      </span>
    )
  return null
}
