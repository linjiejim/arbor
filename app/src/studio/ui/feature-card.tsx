import * as React from "react"
import { ArrowDown, ArrowUp, Ellipsis, Eye, EyeOff, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select } from "@/components/ui/select"
import { notify } from "@/components/ui/toast"
import { applyEdit, moveFeature, replaceFeature, setFieldAt } from "../apply"
import { displayName, OP_NAMES, type Feature, type Tree } from "../dsl"
import { applyDimEdit } from "../dim-edit"
import { fmtDim } from "../dim-source"
import { SCREW_SIZES } from "../holes"
import type { Dim } from "../kernel/dims"
import type { FeatureResult } from "../kernel/build"
import { selectorWords } from "../selector-words"
import type { Annotations } from "../use-annotations"
import type { Reselect } from "../use-reselect"
import type { Studio } from "../use-studio"

/** The face / edge selector a feature carries, if any: where it lives and what it picks. */
function selectionOf(f: Feature): { field: (string | number)[]; kind: "face" | "edge"; value: unknown; title: string } | null {
  if (f.op === "fillet" || f.op === "chamfer") return { field: ["edges"], kind: "edge", value: f.edges, title: "选中的边" }
  if (f.op === "shell") return { field: ["open"], kind: "face", value: f.open, title: "开口的面" }
  if (f.op === "draft") return { field: ["faces"], kind: "face", value: f.faces, title: "拔模的面" }
  if ((f.op === "sketch" || f.op === "hole") && f.on.face) return { field: ["on", "face"], kind: "face", value: f.on.face, title: f.op === "sketch" ? "贴在哪个面上" : "打在哪个面上" }
  return null
}

const FIT: Record<string, string> = { clearance: "过孔", close: "精配过孔", tap: "螺纹孔" }

/**
 * One step of the tree in plain words: what it did, its dimensions (edit in
 * place), what it picked (re-pick on the model), and 「让助教改这一步」 for
 * anything structural. Replaces the old all-fields form.
 */
export function FeatureCard({
  studio,
  feature: f,
  result: r,
  reselect,
  annotations,
  busy,
  onClose,
  onPointDim,
}: {
  studio: Studio
  feature: Feature
  result?: FeatureResult
  reselect: Reselect
  annotations: Annotations
  busy: boolean
  onClose: () => void
  onPointDim: (id: string | null) => void
}) {
  const { tree } = studio
  const name = displayName(tree, f)
  const index = tree.features.findIndex((x) => x.id === f.id)
  const viewing = studio.rollback === f.id
  const failed = r?.state === "error" || r?.state === "skipped"
  const [error, setError] = React.useState<{ text: string; cascade?: boolean } | null>(null)
  const dims = studio.dims.filter((d) => d.feature === f.id)
  const shown = dims.filter((d) => d.source.type !== "derived")
  const derived = dims.filter((d) => d.source.type === "derived")
  const sel = selectionOf(f)
  const picking = reselect.state?.feature === f.id ? reselect.state : null

  const run = async (change: (t: Tree) => Tree, done?: () => void) => {
    const err = await studio.editTree(change)
    setError(err ? { text: err } : null)
    if (!err) done?.()
  }
  const remove = async (cascade = false) => {
    const err = await studio.editTree((t) => applyEdit(t, "delete_feature", { id: f.id, cascade }).tree)
    if (err) return setError({ text: err, cascade: /cascade/.test(err) })
    onClose()
    notify.undo(`已删除「${name}」`, studio.undo)
  }
  const askAssistant = () =>
    annotations.startMessage(failed && r?.message ? `「${name}」（${f.id}）报错了：${r.message}。帮我改好。` : `改「${name}」（${f.id}）：`)

  return (
    <div
      role="dialog"
      aria-label={`「${name}」`}
      className="flex max-h-full w-80 flex-col rounded-md border bg-popover text-small shadow-popover"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !picking) onClose()
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-body font-medium">{name}</span>
        <span className="shrink-0 text-caption text-faint-foreground">
          第 {index + 1} 步 · {OP_NAMES[f.op]}
        </span>
        <IconButton label="关闭" size="icon-sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {failed ? (
          <div role="alert" className="text-destructive">
            {r?.message ?? "前面的特征失败了，这一步没有重建"}
            {r?.hint && <div className="mt-1 text-muted-foreground">{r.hint}</div>}
          </div>
        ) : (
          <div>
            <div className="text-body">{r?.summary ?? ""}</div>
            {f.suppressed && <div className="text-muted-foreground">已压缩：这一步不参与重建</div>}
          </div>
        )}
        {f.intent && <p className="text-muted-foreground">设计意图：{f.intent}</p>}

        <section aria-label="尺寸">
          <h3 className="mb-1 text-caption text-faint-foreground">尺寸</h3>
          {shown.length ? (
            <ul className="space-y-0.5">
              {shown.map((d) => (
                <DimRow key={d.id} dim={d} studio={studio} busy={busy} onPoint={onPointDim} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{derived.length ? "这一步的数都由公式算出" : "这一步没有自己的尺寸"}</p>
          )}
          {derived.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground">由公式算出的 {derived.length} 个（只读）</summary>
              <ul className="mt-1 space-y-0.5 pl-2 font-mono text-caption text-muted-foreground">
                {derived.map((d) => (
                  <li key={d.id}>
                    {d.label} = {d.source.type === "derived" ? d.source.text : ""} = {fmtDim(d.value)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <DirectOptions f={f} studio={studio} busy={busy} onError={(t) => setError(t ? { text: t } : null)} />

        {sel && (
          <section aria-label={sel.title}>
            <h3 className="mb-1 text-caption text-faint-foreground">{sel.title}</h3>
            {picking ? (
              <div className="rounded-md border border-primary p-2">
                <p>
                  {picking.result === undefined
                    ? "正在找共同的描述…"
                    : picking.result
                      ? selectorWords(picking.result.selector, sel.kind, tree)
                      : picking.hashes.length
                        ? `这 ${picking.hashes.length} ${sel.kind === "edge" ? "条边" : "个面"}找不到一句共同的描述：少选几个，或者让助教来选`
                        : `在模型上点要选的${sel.kind === "edge" ? "边" : "面"}`}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  {picking.result === null && picking.hashes.length > 0 && (
                    <Button size="sm" variant="ghost" className="mr-auto" onClick={() => void askToPick(studio, reselect, annotations, f, name, sel.kind)}>
                      让助教来选
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={reselect.cancel}>
                    取消
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!picking.result || busy}
                    onClick={async () => {
                      const err = await reselect.apply()
                      setError(err ? { text: err } : null)
                    }}
                  >
                    应用
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1">
                  {selectorWords(sel.value, sel.kind, tree)}
                  {r?.selected !== undefined && <span className="text-muted-foreground"> · 实际 {r.selected} {sel.kind === "edge" ? "条" : "个"}</span>}
                </p>
                <Button size="sm" variant="secondary" className="shrink-0 max-sm:hidden" disabled={busy} onClick={() => void reselect.start(f.id, sel.field, sel.kind, sel.value)}>
                  在模型上重选
                </Button>
              </div>
            )}
          </section>
        )}

        {error && (
          <div role="alert" className="text-destructive">
            {error.text}
            {error.cascade && (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => void remove(true)}>
                连同它们一起删除
              </Button>
            )}
          </div>
        )}
        {busy && <p className="text-caption text-faint-foreground">助教正在改模型，这一轮结束后再改。</p>}
      </div>

      <div className="flex items-center gap-1 border-t px-2 py-2">
        <IconButton label={viewing ? "回到最新" : "在这一步查看模型"} size="icon-sm" onClick={() => studio.showFeature(viewing ? null : f.id)}>
          {viewing ? <EyeOff /> : <Eye />}
        </IconButton>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run((t) => replaceFeature(t, { ...f, suppressed: f.suppressed ? undefined : true }))}>
          {f.suppressed ? "解除压缩" : "压缩"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="更多操作" size="icon-sm" disabled={busy}>
              <Ellipsis />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={index <= 0} onSelect={() => void run((t) => moveFeature(t, f.id, -1))}>
              <ArrowUp /> 上移一步
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index >= tree.features.length - 1} onSelect={() => void run((t) => moveFeature(t, f.id, 1))}>
              <ArrowDown /> 下移一步
            </DropdownMenuItem>
            <DropdownMenuItem tone="danger" onSelect={() => void remove()}>
              <Trash2 /> 删除这一步
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="primary" className="ml-auto" disabled={busy} onClick={askAssistant}>
          {failed ? "让助教修这一步" : "让助教改这一步…"}
        </Button>
      </div>
    </div>
  )
}

/** A dimension in the card: name, value; point at it to see it on the model, click to change it. */
function DimRow({ dim, studio, busy, onPoint }: { dim: Dim; studio: Studio; busy: boolean; onPoint: (id: string | null) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const param = dim.source.type === "param" || dim.source.type === "factor" ? dim.source.name : null
  const apply = async () => {
    const err = await applyDimEdit(studio, dim, draft)
    setError(err)
    if (!err) setEditing(false)
  }
  return (
    <li onMouseEnter={() => onPoint(dim.id)} onMouseLeave={() => onPoint(null)}>
      {editing ? (
        <form
          className="flex items-center gap-2 py-0.5"
          onSubmit={(e) => {
            e.preventDefault()
            void apply()
          }}
        >
          <span className="min-w-0 flex-1 truncate">{dim.label}</span>
          <Input
            autoFocus
            className="h-7 w-24 font-mono tabular"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => !error && setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation()
                setEditing(false)
              }
            }}
            aria-label={dim.label}
          />
        </form>
      ) : (
        <button
          type="button"
          disabled={busy || !dim.editable}
          onClick={() => {
            setDraft(fmtDim(dim.value))
            setError(null)
            setEditing(true)
          }}
          className={cn("flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left", dim.editable && !busy && "hover:bg-accent")}
        >
          <span className="min-w-0 flex-1 truncate">{dim.label}</span>
          <span className="font-mono tabular">{dim.text}</span>
          {param && <span className="sr-only">（参数 {param}）</span>}
        </button>
      )}
      {error && <p className="px-1 text-caption text-destructive">{error}</p>}
    </li>
  )
}

/** The two common targeted edits that aren't a number: the text an engraving says, a standard hole's size and use. */
function DirectOptions({ f, studio, busy, onError }: { f: Feature; studio: Studio; busy: boolean; onError: (t: string | null) => void }) {
  const set = async (path: (string | number)[], v: unknown) => onError(await studio.editTree((t) => setFieldAt(t, f.id, path, v)))
  if (f.op === "sketch") {
    const texts = f.shapes.map((s, i) => [s, i] as const).filter(([s]) => s.type === "text")
    if (!texts.length) return null
    return (
      <section aria-label="文字内容" className="space-y-1">
        <h3 className="text-caption text-faint-foreground">文字内容</h3>
        {texts.map(([s, i]) => (
          <TextField key={i} value={s.type === "text" ? s.text : ""} disabled={busy} onCommit={(v) => void set(["shapes", i, "text"], v)} />
        ))}
      </section>
    )
  }
  if (f.op === "hole" && f.standard) {
    const std = f.standard
    return (
      <section aria-label="标准孔" className="space-y-1">
        <h3 className="text-caption text-faint-foreground">标准孔</h3>
        <div className="flex gap-2">
          <Select
            className="w-24"
            aria-label="螺钉规格"
            value={std.size}
            disabled={busy}
            options={SCREW_SIZES.map((x) => ({ value: x, label: x }))}
            onValueChange={(v) => void set(["standard"], { ...std, size: v })}
          />
          <Select
            className="flex-1"
            aria-label="用途"
            value={std.fit ?? "clearance"}
            disabled={busy}
            options={Object.entries(FIT).map(([value, label]) => ({ value, label }))}
            onValueChange={(v) => void set(["standard"], { ...std, fit: v, ...(v === "tap" ? { head: undefined } : {}) })}
          />
        </div>
      </section>
    )
  }
  return null
}

function TextField({ value, disabled, onCommit }: { value: string; disabled: boolean; onCommit: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value)
  const [shown, setShown] = React.useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }
  const commit = () => draft.trim() && draft !== value && onCommit(draft)
  return (
    <Input
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
      }}
      aria-label="文字内容"
    />
  )
}

/** Picks with no common description: hand them to the assistant, one plain description each. */
async function askToPick(studio: Studio, reselect: Reselect, annotations: Annotations, f: Feature, name: string, kind: "face" | "edge") {
  const s = reselect.state
  if (!s) return
  const each = await Promise.all(s.hashes.map((h) => studio.selectorFor(kind, [h], s.index)))
  const lines = each.map((x, i) => `${i + 1}. ${x ? `${selectorWords(x.selector, kind, studio.tree)}（${JSON.stringify(x.selector)}）` : "（描述不出来）"}`)
  reselect.cancel()
  annotations.startMessage(`「${name}」（${f.id}）改成选这几${kind === "edge" ? "条边" : "个面"}：\n${lines.join("\n")}`)
}
