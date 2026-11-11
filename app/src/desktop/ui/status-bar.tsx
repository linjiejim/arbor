import * as React from "react"
import { StatusDot } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { DocState, PickRequest, Snapshot } from "../core/protocol"
import { AgentStatus } from "./title-bar"
import { ACTOR_LABEL, ago, useNow } from "./words"

/** Where a status item leads: a panel, the first step that didn't build, or how to plug an agent in. */
export type StatusTarget = "activity" | "failed" | "params" | "notes" | "setup"

/**
 * The strip along the bottom: how things stand, never what to do. Who is working on the model, whether
 * it built, how many of the stated requirements hold, notes waiting, and the version with who made it.
 * Each item says itself in a few words; the panels hold the detail, and an item with one clear place to
 * go (the activity, the failed step, the checks, the notes) goes there when clicked.
 */
export function StatusBar({ snapshot, doc, pick, onGo, agentSeen = true, sheet = false, onSheet }: {
  snapshot: Snapshot | null
  doc: DocState | null
  pick: PickRequest | null
  onGo: (to: StatusTarget) => void
  agentSeen?: boolean
  /** 「工程图」 over the 3D view: switched now and then, so it lives down here, at the far right. */
  sheet?: boolean
  onSheet?: (on: boolean) => void
}) {
  const now = useNow()
  const kernel = snapshot?.kernel
  const loading = snapshot?.loading
  const report = doc?.report
  const failed = report?.features.filter((f) => f.state === "error").length ?? 0
  const checks = report?.checks?.filter((c) => !c.invalid) ?? []
  const passed = checks.filter((c) => c.pass).length
  const openNotes = doc?.notes.filter((n) => n.status === "open").length ?? 0
  const last = doc?.changes[0]
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t px-3 text-caption text-muted-foreground select-none" aria-label="状态">
      <Go label={agentSeen ? "看动态" : "接入 Agent"} onClick={() => onGo(agentSeen ? "activity" : "setup")}>
        <AgentStatus snapshot={snapshot} pick={pick} className="text-caption" />
      </Go>
      {kernel?.phase === "loading" && <Item><Spinner className="size-3" />内核加载中</Item>}
      {kernel?.phase === "error" && <StatusDot className="text-caption" tone="danger">内核出错</StatusDot>}
      {doc && (
        <>
          {loading ? (
            <Item>
              <Spinner className="size-3" />
              {loading.progress?.stage === "checks" ? "正在核对" : "正在重建"}
            </Item>
          ) : doc.error ? (
            <StatusDot className="text-caption" tone="danger">文件读不了，显示的是上一版</StatusDot>
          ) : failed ? (
            <Go label="到没建成的那一步" onClick={() => onGo("failed")}>
              <StatusDot className="text-caption" tone="danger">{failed} 步没建成</StatusDot>
            </Go>
          ) : report ? (
            <StatusDot className="text-caption" tone="success">已重建{report.ms ? ` · ${report.ms < 1000 ? `${Math.round(report.ms)} ms` : `${(report.ms / 1000).toFixed(1)} s`}` : ""}</StatusDot>
          ) : null}
          {checks.length > 0 && !loading && (
            <Go label="看核对" onClick={() => onGo("params")}>
              <StatusDot className="text-caption" tone={passed === checks.length ? "success" : "warning"}>
                核对 {passed}/{checks.length}
              </StatusDot>
            </Go>
          )}
          {report?.checksPending && <Item><Spinner className="size-3" />后台核对中</Item>}
          {openNotes > 0 && (
            <Go label="看备注" onClick={() => onGo("notes")}>
              {openNotes} 条备注待处理
            </Go>
          )}
          <span className="flex-1" />
          <Go label="看动态" onClick={() => onGo("activity")}>
            <span className="tabular">
              第 {doc.rev} 版{last ? ` · ${ACTOR_LABEL[last.actor]} ${ago(last.at, now)}` : ""}
            </span>
          </Go>
          {onSheet && (
            <div role="radiogroup" aria-label="视图" className="-mr-1.5 flex items-center gap-0.5">
              {([["3D", false], ["工程图", true]] as const).map(([label, on]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={sheet === on}
                  className={cn("h-5 rounded-sm px-1.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", sheet === on && "bg-muted font-medium text-foreground")}
                  onClick={() => onSheet(on)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </footer>
  )
}

/** A status item that leads somewhere: looks like the others until pointed at. */
function Go({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} className="-mx-1 flex items-center rounded px-1 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick}>
      {children}
    </button>
  )
}

function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("flex items-center gap-1.5", className)}>{children}</span>
}
