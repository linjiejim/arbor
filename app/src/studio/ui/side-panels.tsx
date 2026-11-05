import * as React from "react"
import { CircleAlert, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OpIcon } from "@/components/op-icon"
import type { OpId } from "@/content/ops"
import { displayName, type Feature } from "../dsl"
import type { Studio } from "../use-studio"

const OP_ICON: Record<Feature["op"], OpId> = {
  sketch: "sketch",
  extrude: "extrude",
  revolve: "revolve",
  fillet: "fillet",
  chamfer: "chamfer",
  shell: "shell",
  hole: "hole",
  linear_pattern: "pattern",
  circular_pattern: "pattern",
  mirror: "mirror",
}

function iconOf(f: Feature): OpId {
  return f.op === "extrude" && f.mode === "cut" ? "cut" : OP_ICON[f.op]
}

/** The feature tree: click a row to roll the view back to it, hover to see which faces it made. */
export function TreePanel({ studio, onHover }: { studio: Studio; onHover: (id: string | null) => void }) {
  const { tree, report, rollback } = studio
  if (!tree.features.length)
    return <p className="px-4 py-4 text-body text-muted-foreground">特征树是空的。在对话里描述零件，助教建的每个特征都会出现在这里。</p>
  return (
    <div className="py-2">
      <div className="flex items-center px-4 pb-2">
        <span className="text-small text-muted-foreground">{tree.features.length} 个特征</span>
        {rollback && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => studio.showFeature(null)}>
            回到最新
          </Button>
        )}
      </div>
      <ol onMouseLeave={() => onHover(null)}>
        {tree.features.map((f, i) => {
          const r = report?.features[i]
          const active = rollback === f.id
          const after = rollback ? i > tree.features.findIndex((x) => x.id === rollback) : false
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => studio.showFeature(active ? null : f.id)}
                onMouseEnter={() => onHover(f.op === "sketch" ? null : f.id)}
                onFocus={() => onHover(f.op === "sketch" ? null : f.id)}
                className={cn(
                  "flex w-full items-start gap-2 px-4 py-2 text-left transition-colors duration-(--duration-fast) hover:bg-accent",
                  active && "bg-pressed",
                  after && "opacity-50",
                )}
              >
                <OpIcon op={iconOf(f)} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body font-medium">{displayName(tree, f)}</span>
                    <span className="font-mono text-caption text-faint-foreground">{f.id}</span>
                  </span>
                  {r?.summary && <span className="block truncate text-small text-muted-foreground">{r.summary}</span>}
                  {r?.state === "error" && <span className="block text-small text-destructive">{r.message}</span>}
                  {r?.state === "skipped" && <span className="block text-small text-faint-foreground">前面失败，未重建</span>}
                </span>
                {r?.state === "error" ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="失败" />
                ) : r?.state === "skipped" ? (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint-foreground" aria-label="未重建" />
                ) : null}
              </button>
              {active && f.intent && <p className="px-4 pb-2 pl-10 text-small text-muted-foreground">设计意图：{f.intent}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Named parameters: edit a number and the whole tree rebuilds, no model involved. */
export function ParamsPanel({ studio }: { studio: Studio }) {
  const entries = Object.entries(studio.tree.params)
  if (!entries.length) return <p className="px-4 py-4 text-body text-muted-foreground">还没有参数。助教会把关键尺寸定成参数，之后可以在这里直接改。</p>
  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-small text-muted-foreground">改完按 Enter，整棵特征树按新参数重算。</p>
      {studio.report?.paramError && <p className="text-small text-destructive">{studio.report.paramError}</p>}
      {entries.map(([k, v]) => (
        <ParamRow key={k} name={k} value={v} computed={studio.report?.params[k]} onCommit={(x) => studio.setParam(k, x)} />
      ))}
    </div>
  )
}

function ParamRow({ name, value, computed, onCommit }: { name: string; value: number | string; computed?: number; onCommit: (v: number | string) => Promise<string | null> }) {
  const [draft, setDraft] = React.useState(String(value))
  const [error, setError] = React.useState<string | null>(null)
  const [shown, setShown] = React.useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(String(value))
  }
  const commit = async () => {
    if (draft === String(value)) return
    const n = Number(draft)
    setError(await onCommit(draft.trim() !== "" && Number.isFinite(n) ? n : draft.trim()))
  }
  const isExpr = typeof value === "string"
  return (
    <label className="block">
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-small font-medium">{name}</span>
        {isExpr && computed !== undefined && <span className="text-caption tabular text-faint-foreground">= {Math.round(computed * 100) / 100}</span>}
      </span>
      <Input
        className="mt-1 font-mono tabular"
        value={draft}
        inputMode={isExpr ? "text" : "decimal"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit()
          if (e.key === "Escape") setDraft(String(value))
        }}
        aria-invalid={error ? true : undefined}
      />
      {error && <span className="mt-1 block text-small text-destructive">{error}</span>}
    </label>
  )
}
