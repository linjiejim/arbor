import * as React from "react"
import { StatusDot } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { DocState, PickRequest, Snapshot } from "../core/protocol"
import { AgentStatus } from "./title-bar"
import { ACTOR_LABEL, ago, useNow } from "./words"

/**
 * The strip along the bottom: how things stand, never what to do. Who is working on the model, whether
 * it built, how many of the stated requirements hold, notes waiting, and the version with who made it.
 * Each item says itself in a few words; the panels hold the detail.
 */
export function StatusBar({ snapshot, doc, pick, onNotes }: { snapshot: Snapshot | null; doc: DocState | null; pick: PickRequest | null; onNotes: () => void }) {
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
      <AgentStatus snapshot={snapshot} pick={pick} className="text-caption" />
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
            <StatusDot className="text-caption" tone="danger">{failed} 步没建成</StatusDot>
          ) : report ? (
            <StatusDot className="text-caption" tone="success">已重建{report.ms ? ` · ${report.ms < 1000 ? `${Math.round(report.ms)} ms` : `${(report.ms / 1000).toFixed(1)} s`}` : ""}</StatusDot>
          ) : null}
          {checks.length > 0 && !loading && (
            <StatusDot className="text-caption" tone={passed === checks.length ? "success" : "warning"}>
              核对 {passed}/{checks.length}
            </StatusDot>
          )}
          {report?.checksPending && <Item><Spinner className="size-3" />后台核对中</Item>}
          {openNotes > 0 && (
            <button type="button" className="rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={onNotes}>
              {openNotes} 条备注待处理
            </button>
          )}
          <span className="flex-1" />
          <span className="tabular">
            第 {doc.rev} 版{last ? ` · ${ACTOR_LABEL[last.actor]} ${ago(last.at, now)}` : ""}
          </span>
        </>
      )}
    </footer>
  )
}

function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("flex items-center gap-1.5", className)}>{children}</span>
}
