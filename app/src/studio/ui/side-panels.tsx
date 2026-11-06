import * as React from "react"
import { Input } from "@/components/ui/input"
import { CodeBlock } from "@/components/code-block"
import { toBuild123d } from "../codegen"
import type { Studio } from "../use-studio"

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
