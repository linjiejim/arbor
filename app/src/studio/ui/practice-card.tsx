import * as React from "react"
import { Link } from "react-router"
import { CircleCheck, CircleDashed, X } from "lucide-react"
import { Hint } from "@/components/hint"
import { IconButton } from "@/components/ui/button"
import type { Practice } from "@/content/practice"
import { markDone, useProgress } from "@/lib/progress"
import { cn } from "@/lib/utils"
import type { CheckResult } from "../kernel/check"
import { practiceKey, practiceState } from "../practice-state"

/**
 * The practice on top of the conversation: the task, its requirements ticking
 * as the model changes, hints behind the ⓘ. All met → done, recorded in the
 * learning progress.
 */
export function PracticeCard({ practice: p, results, rolledBack, onExit }: { practice: Practice; results: CheckResult[] | undefined; rolledBack: boolean; onExit: () => void }) {
  const { rows, passed, done } = practiceState(p, results)
  const progress = useProgress()
  const recorded = progress.done.includes(practiceKey(p.id))
  React.useEffect(() => {
    if (done && !rolledBack && !recorded) markDone(practiceKey(p.id))
  }, [done, rolledBack, recorded, p.id])
  return (
    <section aria-label="练习" className={cn("shrink-0 border-b px-4 py-3", done && "bg-success-subtle")}>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-small font-medium", done ? "text-success" : "text-muted-foreground")}>{done ? "练习完成" : "练习"}</span>
        <span className="truncate text-body font-semibold">{p.title}</span>
        <Hint label="提示" tips={p.tips} />
        <span className="ml-auto text-caption text-faint-foreground tabular">
          {passed}/{rows.length}
        </span>
        <IconButton label="退出练习" size="icon-sm" className="-mr-1.5" onClick={onExit}>
          <X />
        </IconButton>
      </div>
      <p className="mt-1 text-body">{p.task}</p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-small">
            {r.result?.pass ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="做到了" /> : <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-faint-foreground" aria-label="还没做到" />}
            <span className={cn("min-w-0", r.result?.pass ? "text-foreground" : "text-muted-foreground")}>
              {r.said}
              {r.result && !r.result.pass && !r.result.invalid && <span className="text-faint-foreground">（现在 {r.result.actual}）</span>}
            </span>
          </li>
        ))}
      </ul>
      {rolledBack && <p className="mt-2 text-caption text-faint-foreground">回滚中：按最新一步判断</p>}
      {done && (
        <p className="mt-2 text-small text-success">
          全部做到了。
          <Link to={`/lesson/${p.lesson}`} className="ml-1 underline decoration-success/40 underline-offset-4 hover:decoration-success">
            回到课程
          </Link>
        </p>
      )}
    </section>
  )
}
