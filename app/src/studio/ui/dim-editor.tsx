import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { promoteToParam, setFieldAt } from "../apply"
import { fmtDim } from "../dim-source"
import type { Dim } from "../kernel/dims"
import { describeUse, paramUses } from "../param-uses"
import type { Studio } from "../use-studio"

/**
 * Edit a dimension in place: a parameter's dimension edits the parameter
 * (everything using it follows); a plain number edits that one field, and can
 * be made a parameter. Enter applies, Esc cancels; every apply is one undo.
 */
export function DimEditor({ dim, anchor, studio, onClose }: { dim: Dim; anchor: HTMLElement; studio: Studio; onClose: () => void }) {
  // The layer is redrawn while editing (the edited label turns accent): find the live label by id.
  const ref = React.useRef({
    getBoundingClientRect: () => (document.querySelector(`[data-dim-id="${CSS.escape(dim.id)}"]`) ?? anchor).getBoundingClientRect(),
  })
  const src = dim.source
  const param = src.type === "param" || src.type === "factor" ? src.name : null
  const k = src.type === "factor" ? src.k : 1
  const [draft, setDraft] = React.useState(fmtDim(dim.value))
  const [error, setError] = React.useState<string | null>(null)
  const [promote, setPromote] = React.useState(false)
  const [name, setName] = React.useState(() => `${dim.feature}_${String(dim.path.filter((p) => typeof p === "string").at(-1) ?? "v")}`.replace(/[^A-Za-z0-9_]/g, "_"))
  const uses = param ? paramUses(studio.tree, param) : []

  const apply = async () => {
    const v = Number(draft)
    if (!Number.isFinite(v)) return setError("请输入一个数")
    let err: string | null
    if (param) err = await studio.setParam(param, Math.round((v / k) * 1e9) / 1e9)
    else if (promote) err = await studio.editTree((t) => promoteToParam(t, dim.feature, dim.path, name.trim(), dim.label, v))
    else err = await studio.editTree((t) => setFieldAt(t, dim.feature, dim.path, v))
    if (err) setError(err)
    else onClose()
  }

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor virtualRef={ref} />
      <PopoverContent side="top" align="center" sideOffset={8} className="w-72" aria-label={`修改 ${dim.label}`}>
        <div className="text-body font-medium">{dim.label}</div>
        <div className="mt-0.5 text-small text-muted-foreground">
          {param ? (
            <>
              参数 <span className="font-mono">{param}</span>
              {src.type === "factor" && `（这里显示的是 ${src.expr}）`}
            </>
          ) : (
            "这一步里的数，没有定成参数"
          )}
        </div>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault()
            void apply()
          }}
        >
          <Input
            autoFocus
            className="font-mono tabular"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={dim.label}
            aria-invalid={error ? true : undefined}
          />
          {promote && (
            <label className="mt-2 block text-small text-muted-foreground">
              参数名
              <Input className="mt-1 font-mono" value={name} onChange={(e) => setName(e.target.value)} aria-label="参数名" />
            </label>
          )}
          {error && <p className="mt-2 text-small text-destructive">{error}</p>}
          {param && uses.length > 1 && <p className="mt-2 text-caption text-faint-foreground">{param} 还用在 {uses.length - 1} 处：{uses.slice(0, 3).map((u) => describeUse(studio.tree, u)).join("、")}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            {!param && !promote && (
              <Button type="button" size="sm" variant="ghost" className="mr-auto" onClick={() => setPromote(true)}>
                设为参数
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" size="sm" variant="primary">
              {promote ? "设为参数" : "应用"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
