import * as React from "react"
import { Check, Crosshair, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { StateView } from "@/components/ui/state"
import { arbor } from "../bridge"
import type { Actor, DocState, PartNote, Snapshot } from "../core/protocol"
import { AgentStatus } from "./title-bar"
import { ACTOR_LABEL, ago, useNow } from "./words"

/** The person's notes on the part: what the agent reads with get_notes, and what it answered. */
export function NotesPanel({ doc, onLocate }: { doc: DocState; onLocate: (n: PartNote) => void }) {
  const [filter, setFilter] = React.useState<"open" | "all">("open")
  const open = doc.notes.filter((n) => n.status === "open")
  const list = (filter === "open" ? open : [...doc.notes].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.n - a.n)).slice()
  const update = (n: PartNote, input: Record<string, unknown>) => void arbor.call("update_note", { id: n.id, ...input }, doc.path)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
        <Segmented
          size="sm"
          aria-label="显示哪些备注"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "open", label: `未处理 ${open.length}` },
            { value: "all", label: `全部 ${doc.notes.length}` },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <StateView
            size="sm"
            kind="empty"
            title={filter === "open" && doc.notes.length ? "备注都处理完了" : "还没有备注"}
            description="在模型上单击一个面或一条边，写下要改什么。Agent 用 get_notes 读到它们，每条都带着只选中那个面或边的选择器。"
          />
        ) : (
          <ul className="divide-y">
            {list.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-caption font-semibold tabular",
                      n.status === "open" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {n.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-body", !n.text && "text-muted-foreground")}>{n.text || "（只点了位置）"}</p>
                      <Badge tone={n.status === "open" ? "warning" : "success"}>{n.status === "open" ? "未处理" : "已处理"}</Badge>
                    </div>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {n.kind === "face" ? "面" : "边"} · {n.what} · {n.where} · {n.id}
                    </p>
                    {n.reply && (
                      <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-small">
                        <span className="font-medium">Agent：</span>
                        {n.reply}
                      </p>
                    )}
                    <div className="mt-1.5 -ml-2 flex flex-wrap gap-0.5">
                      <Button size="sm" variant="ghost" onClick={() => onLocate(n)}>
                        <Crosshair />
                        定位
                      </Button>
                      {n.status === "open" ? (
                        <Button size="sm" variant="ghost" onClick={() => update(n, { status: "resolved" })}>
                          <Check />
                          标为已处理
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => update(n, { status: "open" })}>
                          <RotateCcw />
                          重新打开
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => update(n, { remove: true })}>
                        <Trash2 />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const ACTOR_TONE: Record<Actor, "info" | "neutral" | "outline"> = { agent: "info", user: "neutral", file: "outline" }

/** Who changed the part and how, newest first. */
export function ActivityPanel({ doc, snapshot }: { doc: DocState; snapshot: Snapshot | null }) {
  const now = useNow()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center border-b px-4">
        <AgentStatus snapshot={snapshot} pick={null} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {doc.changes.length === 0 ? (
          <StateView size="sm" kind="empty" title="还没有改动" description="Agent、你在窗口里，或者有人直接改了文件，每一次改动都会记在这里，并且都能撤销。" />
        ) : (
          <ul className="divide-y">
            {doc.changes.map((c) => (
              <li key={c.seq ?? `${c.rev}-${c.at}`} className="flex items-start gap-2.5 px-4 py-2.5">
                <Badge tone={ACTOR_TONE[c.actor]} className="mt-0.5 w-11 justify-center">
                  {ACTOR_LABEL[c.actor]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-body break-words">{c.summary}</p>
                  <p className="mt-0.5 text-caption text-faint-foreground tabular">
                    第 {c.rev} 版 · {ago(c.at, now)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
