import * as React from "react"
import { Download, Plug, Redo2, RotateCw, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { StatusDot } from "@/components/ui/badge"
import { Segmented } from "@/components/ui/segmented"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { arbor } from "../bridge"
import type { DocState, PickRequest, Snapshot, UpdateStatus } from "../core/protocol"
import { ArborMark } from "@/components/arbor-mark"
import { ago, commandLabel, useNow } from "./words"

/** The window's top bar; on macOS it is also the title bar (drag to move, traffic lights on the left). */
export function TitleBar({
  snapshot,
  doc,
  pick,
  onSetup,
  sheet,
  onSheet,
}: {
  snapshot: Snapshot | null
  doc: DocState | null
  pick: PickRequest | null
  onSetup: () => void
  /** 「工程图」 over the 3D view. */
  sheet: boolean
  onSheet: (on: boolean) => void
}) {
  const mac = arbor.platform === "darwin"
  const call = (name: string) => void arbor.call(name, {}, doc?.path)
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-2 border-b px-3 select-none [-webkit-app-region:drag]", mac && "pl-22")}>
      <ArborMark />
      <span className="text-body font-semibold">Arbor</span>
      {doc && (
        <>
          <span className="text-faint-foreground">/</span>
          <span className="truncate text-body" title={doc.path}>
            {doc.name}
          </span>
          <span className="font-mono text-caption text-faint-foreground tabular max-md:hidden">第 {doc.rev} 版</span>
        </>
      )}
      <div className="ml-3 min-w-0 max-lg:hidden">
        <AgentStatus snapshot={snapshot} pick={pick} />
      </div>
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
            <DropdownMenuItem onSelect={() => void arbor.exportPart("step")}>导出 STEP…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void arbor.exportPart("stl")}>导出 STL…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void arbor.exportPart("py")}>导出 build123d 代码…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void arbor.exportPart("json")}>导出特征树 JSON…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="secondary" className="ml-1" onClick={onSetup}>
          <Plug />
          接入 Agent
        </Button>
      </div>
    </header>
  )
}

/** What the agent is doing right now, or when it last did something. */
export function AgentStatus({ snapshot, pick }: { snapshot: Snapshot | null; pick: PickRequest | null }) {
  const now = useNow()
  const a = snapshot?.agent
  if (pick) return <StatusDot tone="warning">Agent 在等你点选</StatusDot>
  if (a?.busy && a.tool) return <StatusDot tone="info">Agent 正在{commandLabel(a.tool)}…</StatusDot>
  if (a?.at && a.tool)
    return (
      <StatusDot tone="success" className="text-muted-foreground">
        Agent {ago(a.at, now)}{commandLabel(a.tool)}
      </StatusDot>
    )
  return <StatusDot className="text-muted-foreground">等 agent 连上</StatusDot>
}

function useUpdateStatus() {
  const [status, setStatus] = React.useState<UpdateStatus>({ phase: "idle" })
  React.useEffect(() => {
    let alive = true
    const off = arbor.onUpdate(setStatus)
    void arbor.update().then((s) => alive && setStatus(s))
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
      <Button size="sm" variant="primary" className="mr-1" onClick={() => void arbor.restartToUpdate()}>
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
