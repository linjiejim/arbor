import * as React from "react"
import { Input } from "@/components/ui/input"
import { CodeBlock } from "@/components/code-block"
import { toBuild123d } from "../codegen"
import type { Tree } from "../dsl"
import { drivenFeatures, paramDependents, paramUses, describeUse } from "../param-uses"
import type { Hover } from "../scene"
import type { Studio } from "../use-studio"

/**
 * Named parameters: edit a number and the whole tree rebuilds, no model
 * involved. Each says what it is (the note the model wrote) and where it's
 * used; pointing at one lights up the features it drives.
 */
export function ParamsPanel({ studio, onHover }: { studio: Studio; onHover: (h: Hover | null) => void }) {
  const { tree } = studio
  const entries = Object.entries(tree.params)
  if (!entries.length) return <p className="px-4 py-4 text-body text-muted-foreground">还没有参数。助教会把关键尺寸定成参数，之后可以在这里直接改。</p>
  return (
    <div className="space-y-1 px-2 py-3" onMouseLeave={() => onHover(null)}>
      <p className="px-2 pb-1 text-small text-muted-foreground">改完按 Enter，整棵特征树按新参数重算。指向一个参数，模型上会标出它影响的特征。</p>
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
            onPoint={() => onHover(driven.length ? { ids: driven, label: `受 ${k} 影响的特征` } : null)}
          />
        )
      })}
    </div>
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
  onPoint: () => void
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
    <div className="rounded-md px-2 py-2 transition-colors duration-(--duration-fast) hover:bg-accent focus-within:bg-accent" onMouseEnter={onPoint} onFocus={onPoint}>
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
