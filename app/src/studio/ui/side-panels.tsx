import * as React from "react"
import { Check, ChevronRight, CircleHelp, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CodeBlock } from "@/components/code-block"
import { toBuild123d } from "../codegen"
import type { Tree } from "../dsl"
import { drivenFeatures, paramDependents, paramUses, describeUse } from "../param-uses"
import type { Hover } from "../scene"
import type { Studio } from "../use-studio"
import type { Annotations } from "../use-annotations"
import type { CheckResult } from "../kernel/check"
import { Hint } from "@/components/hint"
import { useWords } from "./host-words"

/**
 * Named parameters: edit a number and the whole tree rebuilds, no model
 * involved. Each says what it is (the note the model wrote) and where it's
 * used; pointing at one lights up the features it drives.
 */
export function ParamsPanel({ studio, onHover, annotations }: { studio: Studio; onHover: (h: Hover | null) => void; annotations?: Annotations }) {
  const { tree } = studio
  const entries = Object.entries(tree.params)
  const checks = studio.report?.checks ?? []
  const words = useWords()
  if (!entries.length && !checks.length)
    return (
      <p className="flex items-center gap-1 px-4 py-4 text-body text-muted-foreground">
        还没有参数
        <Hint tips={[words.noParams]} />
      </p>
    )
  return (
    <div className="space-y-1 px-2 py-3" onMouseLeave={() => onHover(null)}>
      {checks.length > 0 && <Checklist rows={checks} baseline={studio.checkBaseline} rolledBack={!!studio.rollback} onHover={onHover} onFix={annotations?.startMessage} />}
      {entries.length > 0 && (
        <div className="flex h-6 items-center gap-1 px-2 text-caption text-faint-foreground">
          {entries.length} 个参数
          <Hint label="参数怎么用" tips={["改完按 Enter，整棵特征树按新参数重算。", "指向一个参数，模型上会标出它的尺寸。"]} />
        </div>
      )}
      {studio.report?.paramError && <p className="px-2 text-small text-destructive">{studio.report.paramError}</p>}
      {entries.map(([k, v]) => {
        const uses = paramUses(tree, k)
        const deps = paramDependents(tree, k)
        const driven = drivenBy(tree, k)
        return (
          <ParamRow
            key={k}
            name={k}
            value={v}
            note={tree.paramNotes?.[k]}
            uses={[...uses.map((u) => describeUse(tree, u)), ...deps.map((d) => `参数 ${d}`)]}
            computed={studio.report?.params[k]}
            onCommit={(x) => studio.setParam(k, x)}
            onPoint={(row) => onHover({ ids: driven, label: `受 ${k} 影响的特征`, param: k, row })}
          />
        )
      })}
    </div>
  )
}

type CheckState = "pass" | "drift" | "fail" | "invalid"

/**
 * 「要求核对 4/5」: the learner's numbers re-measured after every rebuild.
 * A requirement the assistant met that the learner's own edit moved is
 * 「已偏离」 (warning), not an error. Opens by itself when something doesn't hold.
 */
function Checklist({
  rows,
  baseline,
  rolledBack,
  onHover,
  onFix,
}: {
  rows: CheckResult[]
  baseline: Record<string, boolean>
  rolledBack: boolean
  onHover: (h: Hover | null) => void
  /** 「让助教修正」: not on a shared link, which has no chat. */
  onFix?: (text: string) => void
}) {
  const words = useWords()
  const state = (r: CheckResult): CheckState => (r.pass ? "pass" : r.invalid ? "invalid" : baseline[r.id] ? "drift" : "fail")
  const states = rows.map(state)
  const passed = states.filter((x) => x === "pass").length
  const counted = states.filter((x) => x !== "invalid").length
  const [open, setOpen] = React.useState<boolean | null>(null)
  const shown = open ?? passed < counted
  return (
    <section aria-label="要求核对" className={cn("mb-2 rounded-md border px-2 py-1.5", rolledBack && "opacity-60")}>
      <button type="button" className="flex w-full items-center gap-2 text-left text-small" aria-expanded={shown} onClick={() => setOpen(!shown)}>
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-(--duration-fast)", shown && "rotate-90")} />
        <span className="font-medium">要求核对</span>
        <span className={cn("tabular", passed === counted ? "text-success" : "text-muted-foreground")}>
          {passed}/{counted}
        </span>
        {rolledBack && <span className="ml-auto text-caption text-faint-foreground">回滚中，按最新一步核对</span>}
      </button>
      {shown && (
        <ul className="mt-1 space-y-1">
          {rows.map((r, i) => {
            const st = states[i]
            return (
              <li
                key={r.id}
                className="rounded-sm px-1 py-0.5 text-small hover:bg-accent"
                onMouseEnter={() => onHover(r.faces.length || r.edges.length ? { ids: [], label: "核对量的位置", faces: r.faces, edges: r.edges } : null)}
              >
                <div className="flex items-start gap-1.5">
                  {st === "pass" ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="满足" />
                  ) : st === "invalid" ? (
                    <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-faint-foreground" aria-label="量不了" />
                  ) : st === "drift" ? (
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="已偏离" />
                  ) : (
                    <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="不满足" />
                  )}
                  <span className="min-w-0 flex-1">
                    「{r.said}」
                    <span className="text-muted-foreground">
                      {st === "pass" ? ` 实际 ${r.actual}` : st === "invalid" ? ` 量不了：${r.actual}（核对项写得不对，不是零件的问题）` : st === "drift" ? ` 已偏离：要求 ${r.expected}，现在 ${r.actual}（你改过参数）` : ` 要求 ${r.expected}，实际 ${r.actual}`}
                    </span>
                  </span>
                </div>
                {st === "fail" && onFix && (
                  <Button size="sm" variant="ghost" className="mt-0.5 ml-5 h-6 px-2 text-caption" onClick={() => onFix(`核对没通过：「${r.said}」要求 ${r.expected}，现在是 ${r.actual}，请修正。`)}>
                    {words.fixCheck}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Features a parameter drives, directly or through parameters computed from it. */
function drivenBy(tree: Tree, name: string): string[] {
  const names = new Set([name])
  for (let grew = true; grew; ) {
    grew = false
    for (const n of [...names])
      for (const d of paramDependents(tree, n))
        if (!names.has(d)) {
          names.add(d)
          grew = true
        }
  }
  return [...new Set([...names].flatMap((n) => drivenFeatures(tree, paramUses(tree, n))))]
}

function ParamRow({
  name,
  value,
  note,
  uses,
  computed,
  onCommit,
  onPoint,
}: {
  name: string
  value: number | string
  note?: string
  uses: string[]
  computed?: number
  onCommit: (v: number | string) => Promise<string | null>
  onPoint: (row: HTMLElement) => void
}) {
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
    <div className="rounded-md px-2 py-2 transition-colors duration-(--duration-fast) hover:bg-accent focus-within:bg-accent" onMouseEnter={(e) => onPoint(e.currentTarget)} onFocus={(e) => onPoint(e.currentTarget)}>
      <label className="block">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-small font-medium">{name}</span>
          {note && <span className="min-w-0 truncate text-small text-muted-foreground">{note}</span>}
          {isExpr && computed !== undefined && <span className="ml-auto shrink-0 text-caption tabular text-faint-foreground">= {Math.round(computed * 100) / 100}</span>}
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
          aria-label={name}
          aria-description={note}
        />
      </label>
      {error && <span className="mt-1 block text-small text-destructive">{error}</span>}
      <p className="mt-1 text-caption text-faint-foreground">{uses.length ? `用在：${uses.join("、")}` : "还没有特征用到它"}</p>
    </div>
  )
}

/** The same model as build123d code: what the teardowns show, for the learner's own part. */
export function CodePanel({ studio }: { studio: Studio }) {
  const code = React.useMemo(() => toBuild123d(studio.tree, { body: true }), [studio.tree])
  if (!studio.tree.features.length) return <p className="px-4 py-4 text-body text-muted-foreground">建出特征后，这里会显示等价的 build123d 代码。</p>
  return (
    <div className="px-3 py-3">
      <p className="mb-2 px-1 text-small text-muted-foreground">同一棵特征树写成 build123d 代码。能直接运行的完整文件（含辅助函数）在右上角「导出」里。</p>
      <CodeBlock code={code} className="text-caption" />
    </div>
  )
}
