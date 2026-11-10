import * as React from "react"
import { Download, House, MessageSquare, Plug, Redo2, RotateCw, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { StatusDot } from "@/components/ui/badge"
import { Segmented } from "@/components/ui/segmented"
import { Spinner } from "@/components/ui/spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { turnery } from "../bridge"
import type { DocState, PickRequest, Snapshot, UpdateStatus } from "../core/protocol"
import { TurneryMark } from "@/components/turnery-mark"
import { useAssistant } from "../use-assistant"
import { ago, commandLabel, useNow } from "./words"

/** The window's top bar; on macOS it is also the title bar (drag to move, traffic lights on the left). */
export function TitleBar({
  snapshot,
  doc,
  onSetup,
  sheet,
  onSheet,
  chat,
}: {
  snapshot: Snapshot | null
  doc: DocState | null
  onSetup: () => void
  /** 「工程图」 over the 3D view. */
  sheet: boolean
  onSheet: (on: boolean) => void
  /** The built-in assistant's button: shows or puts away the conversation; spins while a turn runs. */
  chat: { open: boolean; onToggle: () => void }
}) {
  const busy = useAssistant().busy
  const mac = turnery.platform === "darwin"
  const call = (name: string) => void turnery.call(name, {}, doc?.path)
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-2 border-b px-3 select-none [-webkit-app-region:drag]", mac && "pl-22")}>
      <TurneryMark />
      <span className="text-body font-semibold">Turnery</span>
      {(doc || snapshot?.project) && (
        <IconButton label="回到首页（⇧⌘H）" size="icon-sm" className="[-webkit-app-region:no-drag]" onClick={() => void turnery.call("close_project", {})}>
          <House />
        </IconButton>
      )}
      {snapshot?.project && snapshot.project.name !== doc?.name && (
        <>
          <span className="text-faint-foreground">/</span>
          <span className="max-w-48 truncate text-body text-muted-foreground" title={snapshot.project.root}>
            {snapshot.project.name}
          </span>
        </>
      )}
      {doc && (
        <>
          <span className="text-faint-foreground">/</span>
          <span className="truncate text-body" title={doc.path}>
            {doc.name}
          </span>
        </>
      )}
      {doc && (
        <Segmented
          size="sm"
          aria-label="视图"
          className="ml-auto [-webkit-app-region:no-drag]"
          value={sheet ? "drawing" : "3d"}
          onValueChange={(v) => onSheet(v === "drawing")}
          options={[
            { value: "3d", label: "3D" },
            { value: "drawing", label: "工程图" },
          ]}
        />
      )}
      <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        <UpdateStatusButton />
        {doc && (
          <>
            <IconButton label="撤销（⌘Z）" disabled={!doc?.canUndo} onClick={() => call("undo")}>
              <Undo2 />
            </IconButton>
            <IconButton label="重做（⇧⌘Z）" disabled={!doc?.canRedo} onClick={() => call("redo")}>
              <Redo2 />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="导出" disabled={!doc}>
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
          </>
        )}
        <Button size="sm" variant={chat.open ? "secondary" : "ghost"} className="ml-1" aria-pressed={chat.open} onClick={chat.onToggle}>
          {busy ? <Spinner /> : <MessageSquare />}
          对话
        </Button>
        <Button size="sm" variant="secondary" onClick={onSetup}>
          <Plug />
          接入 Agent
        </Button>
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
      <Button size="sm" variant="primary" className="mr-1" onClick={() => void turnery.restartToUpdate()}>
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
