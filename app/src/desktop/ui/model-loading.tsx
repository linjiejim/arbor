import * as React from "react"
import { Spinner } from "@/components/ui/spinner"
import type { LoadState } from "../core/protocol"

const STAGES = { prepare: "准备零件", build: "组装模型", mesh: "生成视图", checks: "检查装配" }

/** Stays visible while the worker is busy, without blocking orbiting the preview. */
export function ModelLoading({ load, visible }: { load: LoadState; visible: boolean }) {
  const [mountedAt] = React.useState(Date.now)
  const [now, setNow] = React.useState(Date.now)
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [load.startedAt])
  const p = load.progress
  const title = !load.startedAt ? "正在显示模型" : p ? STAGES[p.stage] : "正在打开模型"
  const elapsed = Math.max(0, Math.floor((now - (load.startedAt || mountedAt)) / 1000))
  const determinate = p && p.total > 0
  const percent = determinate ? Math.min(100, Math.round(100 * p.completed / p.total)) : 0
  return (
    <div className={`pointer-events-none absolute inset-0 z-30 flex justify-center px-6 ${visible ? "items-end pb-28" : "items-center bg-background/80"}`}>
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="model-loading" className="w-80 max-w-full rounded-lg border bg-background p-4 shadow-popover">
        <div className="flex items-center gap-2 text-body font-medium">
          <Spinner />
          <span>{title}</span>
          <span className="ml-auto font-mono text-caption font-normal text-muted-foreground tabular-nums">{elapsed} 秒</span>
        </div>
        <div className="mt-2 truncate text-caption text-muted-foreground" title={load.name}>{load.name}</div>
        {determinate && (
          <>
            <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.completed} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-1.5 flex gap-2 text-caption text-muted-foreground">
              <span className="min-w-0 flex-1 truncate" title={p.label}>{p.label ?? title}</span>
              <span className="shrink-0 font-mono tabular-nums">{p.completed} / {p.total}</span>
            </div>
          </>
        )}
        <p className="mt-3 text-caption text-muted-foreground">{visible ? "模型正在呈现，可以旋转查看。" : "正在计算模型，完成后会自动显示。"}</p>
      </div>
    </div>
  )
}
