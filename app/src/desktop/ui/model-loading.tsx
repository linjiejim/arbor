import * as React from "react"
import { Spinner } from "@/components/ui/spinner"
import type { LoadState } from "../core/protocol"

const STAGES = { prepare: "准备零件", build: "组装模型", mesh: "生成视图", checks: "检查装配" }

/** A slim card at the top of the viewport while the worker is busy: the model stays in view and can be orbited. */
export function ModelLoading({ load, visible }: { load: LoadState; visible: boolean }) {
  const [mountedAt] = React.useState(Date.now)
  const [now, setNow] = React.useState(Date.now)
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [load.startedAt])
  const p = load.progress
  const title = visible && load.startedAt ? "正在恢复精确几何" : !load.startedAt ? "正在显示模型" : p ? STAGES[p.stage] : "正在打开模型"
  const elapsed = Math.max(0, Math.floor((now - (load.startedAt || mountedAt)) / 1000))
  const determinate = p && p.total > 0
  const percent = determinate ? Math.min(100, Math.round(100 * p.completed / p.total)) : 0
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="model-loading" title={visible ? "预览已显示，可旋转、选件和隔离；标注与测量等精确几何就绪后可用。" : undefined} className="pointer-events-auto w-80 max-w-full rounded-lg border bg-background/95 px-3 py-2 shadow-popover">
      <div className="flex items-center gap-2 text-body">
        <Spinner />
        <span className="shrink-0 font-medium">{title}</span>
        <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground" title={determinate ? p.label ?? load.name : load.name}>
          {determinate ? p.label ?? load.name : load.name}
        </span>
        {determinate && <span className="shrink-0 font-mono text-caption text-muted-foreground tabular-nums">{p.completed} / {p.total}</span>}
        <span className="shrink-0 font-mono text-caption text-muted-foreground tabular-nums">{elapsed} 秒</span>
      </div>
      {determinate && (
        <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.completed} className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  )
}
