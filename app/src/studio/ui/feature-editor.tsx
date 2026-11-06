import * as React from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X } from "lucide-react"
import type { z } from "zod"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input, Textarea } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { notify } from "@/components/ui/toast"
import { applyEdit, moveFeature, replaceFeature } from "../apply"
import { displayName, Feature, OP_NAMES, TOOL_OPS, type Tree } from "../dsl"
import type { Studio } from "../use-studio"

// ------------------------------------------------------------------ words

const LABEL: Record<string, string> = {
  name: "名称",
  intent: "设计意图",
  on: "草图平面",
  plane: "基准面",
  offset: "偏移",
  face: "贴在面上",
  shapes: "图形",
  sketch: "草图",
  sketches: "截面草图",
  distance: "距离",
  mode: "方式",
  direction: "方向",
  through: "贯穿",
  axis: "轴",
  angle: "角度",
  edges: "选边",
  faces: "选面",
  open: "开口面",
  r: "半径",
  d: "直径",
  t: "壁厚",
  w: "宽",
  h: "高",
  at: "位置",
  depth: "深度",
  cbore: "沉头孔",
  csink: "埋头孔",
  reverse: "反向",
  features: "要复制的特征",
  dir: "方向",
  count: "个数",
  spacing: "间距",
  dir2: "第二方向",
  count2: "第二方向个数",
  spacing2: "第二方向间距",
  path: "路径",
  points: "点",
  corner: "拐角圆角",
  profile: "截面",
  ruled: "直纹",
  neutral: "中性面",
  center: "中心",
  sides: "边数",
  rotate: "旋转",
  length: "总长",
  width: "宽度",
  cut: "挖掉",
  text: "文字",
  size: "字号",
  of: "来自特征",
  normal: "法向",
  kind: "类型",
  parallel: "平行于",
  extreme: "最靠外",
  radius: "半径",
  near: "靠近点",
  not: "排除",
  expect: "预期个数",
  value: "坐标",
  standard: "标准孔",
  fit: "孔的用途",
  head: "沉头",
  tilt: "倾斜",
}

const ENUM_LABEL: Record<string, string> = {
  add: "加料",
  cut: "切除",
  normal: "沿草图法向",
  reverse: "反向",
  both: "两侧对称",
  XY: "上视 XY",
  XZ: "前视 XZ",
  YZ: "右视 YZ",
  plane: "平面",
  cylinder: "圆柱面",
  cone: "圆锥面",
  sphere: "球面",
  torus: "圆环面",
  freeform: "自由曲面",
  line: "直线",
  circle: "圆",
  clearance: "普通过孔",
  close: "精配过孔",
  tap: "螺纹孔（攻丝底孔）",
  cbore: "沉头（圆柱头螺钉）",
  csink: "埋头（沉头螺钉）",
}

const SHAPE_LABEL: Record<string, string> = { rect: "矩形", circle: "圆", polygon: "多边形", slot: "长圆孔", polyline: "轮廓", text: "文字" }

const NEW_SHAPE: Record<string, Record<string, unknown>> = {
  rect: { type: "rect", w: 10, h: 10 },
  circle: { type: "circle", d: 10 },
  polygon: { type: "polygon", sides: 6, d: 10 },
  slot: { type: "slot", length: 20, width: 6 },
  text: { type: "text", text: "ABC", size: 5 },
}

/** Absent sub-objects that can be added, and what they start as. */
const NEW_OBJECT: Record<string, unknown> = {
  face: { normal: "+Z", extreme: "+Z" },
  cbore: { d: 10, depth: 3 },
  csink: { d: 10 },
  not: { extreme: "+Z" },
  standard: { size: "M3" },
  tilt: { axis: "X", angle: 30 },
}

// ------------------------------------------------------------------ schema helpers

// zod 4 schemas, looked at structurally.
type S = z.ZodType & { type: string; options?: unknown; element?: S; shape?: Record<string, S>; unwrap?: () => S; description?: string; def: { discriminator?: string } }

function unwrap(s: S): { s: S; optional: boolean } {
  let optional = false
  while (s.type === "optional") {
    optional = true
    s = s.unwrap!()
  }
  return { s, optional }
}
const isNum = (s: S) => s.type === "union" && (s.options as S[]).every((o) => o.type === "number" || o.type === "string")
const isVec = (s: S) => s.type === "array" && isNum(s.element!)
const isSelector = (s: S) => s.type === "object" && !!s.shape && "extreme" in s.shape && "near" in s.shape
const isScalar = (s: S) => isNum(s) || s.type === "enum" || s.type === "boolean" || s.type === "number"

const schemaFor = (op: string) => (Feature.options as unknown as S[]).find((o) => (o.shape!.op as unknown as { value: string }).value === op)!

type Path = (string | number)[]

/** Radix Select can't hold "": this stands for "not set". */
const NONE = "__none"

function setIn(obj: unknown, path: Path, value: unknown): unknown {
  if (!path.length) return value
  const [k, ...rest] = path
  if (Array.isArray(obj)) {
    const out = [...obj]
    out[k as number] = setIn(out[k as number], rest, value)
    return out
  }
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) }
  const next = setIn(out[k as string], rest, value)
  if (next === undefined) delete out[k as string]
  else out[k as string] = next
  return out
}

/** A typed number stays a number; anything else is an expression for the kernel to check. */
function parseNum(text: string): number | string | undefined {
  const t = text.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : t
}

// ------------------------------------------------------------------ editor

type Ctx = { tree: Tree; self: Feature; set: (path: Path, v: unknown) => void }

/**
 * Edit one feature by hand: every field of its schema as a form, applied as a
 * whole (undoable), plus suppress, move and delete. The same edits the model
 * makes with edit_feature, without the model.
 */
export function FeatureEditor({ studio, feature, onClose }: { studio: Studio; feature: Feature; onClose: () => void }) {
  const { tree } = studio
  const [draft, setDraft] = React.useState<Record<string, unknown>>(() => structuredClone(feature) as Record<string, unknown>)
  const [error, setError] = React.useState<{ text: string; cascade?: boolean } | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(feature)
  const schema = schemaFor(feature.op)
  const index = tree.features.findIndex((f) => f.id === feature.id)
  const viewing = studio.rollback === feature.id
  const set = React.useCallback((path: Path, v: unknown) => setDraft((d) => setIn(d, path, v) as Record<string, unknown>), [])
  const ctx: Ctx = { tree, self: feature, set }

  const run = async (change: (t: Tree) => Tree, done?: () => void) => {
    const err = await studio.editTree(change)
    setError(err ? { text: err } : null)
    if (!err) done?.()
  }
  const apply = () => void run((t) => replaceFeature(t, draft))
  const remove = async (cascade = false) => {
    const err = await studio.editTree((t) => applyEdit(t, "delete_feature", { id: feature.id, cascade }).tree)
    if (err) return setError({ text: err, cascade: /cascade/.test(err) })
    onClose()
    notify.undo(`已删除「${displayName(tree, feature)}」`, studio.undo)
  }

  // Fields in schema order; name and intent last, op / id / suppressed are handled elsewhere.
  const keys = Object.keys(schema.shape!).filter((k) => !["op", "id", "suppressed", "name", "intent"].includes(k))

  return (
    <div
      role="dialog"
      aria-label={`编辑「${displayName(tree, feature)}」`}
      className="flex max-h-full w-80 flex-col rounded-md border bg-popover text-small shadow-popover"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-body font-medium">{displayName(tree, feature)}</span>
        <span className="font-mono text-caption text-faint-foreground">{feature.id}</span>
        <IconButton label="关闭" size="icon-sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div className="text-muted-foreground">
          {OP_NAMES[feature.op]}
          {feature.suppressed && " · 已压缩"}
        </div>
        {keys.map((k) => (
          <Field key={k} schema={schema.shape![k]} value={draft[k]} path={[k]} name={k} ctx={ctx} />
        ))}
        <Field schema={schema.shape!.name} value={draft.name} path={["name"]} name="name" ctx={ctx} />
        <Field schema={schema.shape!.intent} value={draft.intent} path={["intent"]} name="intent" ctx={ctx} />
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
      </div>
      <div className="flex items-center gap-1 border-t px-2 py-2">
        <IconButton label={viewing ? "回到最新" : "在这一步查看模型"} size="icon-sm" onClick={() => studio.showFeature(viewing ? null : feature.id)}>
          {viewing ? <EyeOff /> : <Eye />}
        </IconButton>
        <IconButton label="上移" size="icon-sm" disabled={index <= 0} onClick={() => void run((t) => moveFeature(t, feature.id, -1))}>
          <ArrowUp />
        </IconButton>
        <IconButton label="下移" size="icon-sm" disabled={index >= tree.features.length - 1} onClick={() => void run((t) => moveFeature(t, feature.id, 1))}>
          <ArrowDown />
        </IconButton>
        <IconButton label="删除" size="icon-sm" onClick={() => void remove()}>
          <Trash2 />
        </IconButton>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void run((t) => replaceFeature(t, { ...feature, suppressed: feature.suppressed ? undefined : true }))}
        >
          {feature.suppressed ? "解除压缩" : "压缩"}
        </Button>
        <Button size="sm" variant="primary" className="ml-auto" disabled={!dirty} onClick={apply}>
          应用
        </Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ fields

function FieldLabel({ name, hint, children, onRemove }: { name: string; hint?: string; children?: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="mb-1 flex items-center gap-1 text-muted-foreground" title={hint}>
      <span>{LABEL[name] ?? name}</span>
      {children}
      {onRemove && (
        <button type="button" aria-label={`去掉「${LABEL[name] ?? name}」`} onClick={onRemove} className="ml-auto grid size-5 place-items-center rounded-xs hover:bg-accent hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

function Field({ schema, value, path, name, ctx, onRemove }: { schema: S; value: unknown; path: Path; name: string; ctx: Ctx; onRemove?: () => void }) {
  const { s, optional } = unwrap(schema)
  const hint = schema.description ?? s.description
  const clear = optional ? () => ctx.set(path, undefined) : undefined

  if (isNum(s) || s.type === "number")
    return (
      <label className="block">
        <FieldLabel name={name} hint={hint} onRemove={onRemove} />
        <NumInput value={value as number | string | undefined} placeholder={optional ? "缺省" : undefined} onChange={(v) => ctx.set(path, v)} label={LABEL[name] ?? name} />
      </label>
    )

  if (s.type === "enum") {
    const options = (s.options as string[]).map((o) => ({ value: o, label: ENUM_LABEL[o] ?? o }))
    return (
      <div>
        <FieldLabel name={name} hint={hint} onRemove={onRemove} />
        <Select
          className="h-8"
          aria-label={LABEL[name] ?? name}
          options={optional ? [{ value: NONE, label: "缺省" }, ...options] : options}
          value={(value as string | undefined) ?? NONE}
          onValueChange={(v) => ctx.set(path, v === NONE ? undefined : v)}
        />
      </div>
    )
  }

  if (s.type === "boolean")
    return (
      <label className="flex items-center gap-2">
        <Switch checked={!!value} onCheckedChange={(v) => ctx.set(path, v || undefined)} />
        <span className="text-muted-foreground" title={hint}>
          {LABEL[name] ?? name}
        </span>
      </label>
    )

  if (s.type === "string") {
    if (name === "sketch" || name === "of") {
      const before = ctx.tree.features.slice(0, ctx.tree.features.findIndex((f) => f.id === ctx.self.id))
      const pool = name === "sketch" ? before.filter((f) => f.op === "sketch") : before
      return (
        <div>
          <FieldLabel name={name} hint={hint} onRemove={onRemove} />
          <Select
            className="h-8"
            aria-label={LABEL[name]}
            options={[...(optional ? [{ value: NONE, label: "不限" }] : []), ...pool.map((f) => ({ value: f.id, label: `${displayName(ctx.tree, f)}（${f.id}）` }))]}
            value={(value as string | undefined) ?? NONE}
            onValueChange={(v) => ctx.set(path, v === NONE ? undefined : v)}
          />
        </div>
      )
    }
    const change = (text: string) => ctx.set(path, text || (optional ? undefined : ""))
    return (
      <label className="block">
        <FieldLabel name={name} hint={hint} onRemove={onRemove} />
        {name === "intent" || name === "text" ? (
          <Textarea className="min-h-14 resize-none" rows={2} value={(value as string | undefined) ?? ""} onChange={(e) => change(e.target.value)} />
        ) : (
          <Input className="h-8" value={(value as string | undefined) ?? ""} onChange={(e) => change(e.target.value)} />
        )}
      </label>
    )
  }

  if (isVec(s))
    return (
      <div>
        <FieldLabel name={name} hint={hint} onRemove={onRemove ?? (value !== undefined ? clear : undefined)} />
        <VecInput value={value as (number | string)[] | undefined} n={name === "near" ? 3 : 2} onChange={(v) => ctx.set(path, v)} label={LABEL[name] ?? name} />
      </div>
    )

  if (s.type === "array") return <ArrayField schema={s} value={(value as unknown[] | undefined) ?? []} path={path} name={name} ctx={ctx} hint={hint} />

  if (s.type === "union" && s.def.discriminator) {
    const v = value as Record<string, unknown>
    const option = (s.options as S[]).find((o) => (o.shape!.type as unknown as { value: string }).value === v?.type)
    if (!option) return null
    return <ObjectFields schema={option} value={v} path={path} ctx={ctx} />
  }

  if (s.type === "object") {
    if (value === undefined)
      return name in NEW_OBJECT ? (
        <Button size="sm" variant="ghost" className="-ml-2" onClick={() => ctx.set(path, structuredClone(NEW_OBJECT[name]))}>
          <Plus />
          {LABEL[name] ?? name}
        </Button>
      ) : null
    return (
      <fieldset className="rounded-md border px-2.5 pt-1 pb-2.5">
        <legend className="px-1 text-muted-foreground" title={hint}>
          {LABEL[name] ?? name}
        </legend>
        <div className="flex justify-end">
          {optional && (
            <button type="button" aria-label={`去掉「${LABEL[name] ?? name}」`} onClick={clear} className="-mt-1 grid size-5 place-items-center rounded-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
        <ObjectFields schema={s} value={value as Record<string, unknown>} path={path} ctx={ctx} />
      </fieldset>
    )
  }
  return null
}

/** An object's fields. Selectors show only the conditions they have, plus a menu to add one. */
function ObjectFields({ schema, value, path, ctx }: { schema: S; value: Record<string, unknown>; path: Path; ctx: Ctx }) {
  const shape = schema.shape!
  const selector = isSelector(schema)
  const keys = Object.keys(shape).filter((k) => k !== "type")
  const shown = keys.filter((k) => value[k] !== undefined || (!selector && isScalar(unwrap(shape[k]).s)) || (!selector && unwrap(shape[k]).s.type === "object"))
  const addable = selector ? keys.filter((k) => value[k] === undefined && (isScalar(unwrap(shape[k]).s) || unwrap(shape[k]).s.type === "string")) : []
  return (
    <div className="space-y-2.5">
      {shown.map((k) => (
        <Field key={k} schema={shape[k]} value={value[k]} path={[...path, k]} name={k} ctx={ctx} onRemove={selector ? () => ctx.set([...path, k], undefined) : undefined} />
      ))}
      {addable.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="-ml-2">
              <Plus />
              添加条件
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {addable.map((k) => {
              const s = unwrap(shape[k]).s
              const first = s.type === "enum" ? (s.options as string[])[0] : s.type === "string" ? (ctx.tree.features[0]?.id ?? "") : 1
              return (
                <DropdownMenuItem key={k} onSelect={() => ctx.set([...path, k], first)}>
                  {LABEL[k] ?? k}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function ArrayField({ schema, value, path, name, ctx, hint }: { schema: S; value: unknown[]; path: Path; name: string; ctx: Ctx; hint?: string }) {
  const el = unwrap(schema.element!).s

  // Feature ids (patterns, mirror): tick the ones to copy.
  if (el.type === "string") {
    const before = ctx.tree.features.slice(0, ctx.tree.features.findIndex((f) => f.id === ctx.self.id))
    const pool = name === "sketches" ? before.filter((f) => f.op === "sketch") : before.filter((f) => TOOL_OPS.includes(f.op))
    const picked = new Set(value as string[])
    return (
      <div>
        <FieldLabel name={name} hint={hint} />
        <div className="space-y-1">
          {pool.map((f) => (
            <label key={f.id} className="flex items-center gap-2">
              <Switch
                checked={picked.has(f.id)}
                onCheckedChange={(on) => {
                  const next = on ? [...(value as string[]), f.id] : (value as string[]).filter((x) => x !== f.id)
                  ctx.set(path, next.length ? next : undefined)
                }}
              />
              {displayName(ctx.tree, f)}
            </label>
          ))}
        </div>
      </div>
    )
  }

  // Sketch shapes: one block each; add a shape from a menu.
  if (el.type === "union" && el.def.discriminator) {
    return (
      <div className="space-y-2">
        <FieldLabel name={name} hint={hint} />
        {value.map((item, i) => {
          const type = (item as { type: string }).type
          return (
            <fieldset key={i} className="rounded-md border px-2.5 pt-1 pb-2.5">
              <legend className="px-1 text-muted-foreground">{SHAPE_LABEL[type] ?? type}</legend>
              {value.length > 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    aria-label={`去掉这个${SHAPE_LABEL[type] ?? "图形"}`}
                    onClick={() => ctx.set(path, value.filter((_, k) => k !== i))}
                    className="-mt-1 grid size-5 place-items-center rounded-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
              <Field schema={schema.element!} value={item} path={[...path, i]} name={type} ctx={ctx} />
            </fieldset>
          )
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="-ml-2">
              <Plus />
              添加图形
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.entries(NEW_SHAPE).map(([k, v]) => (
              <DropdownMenuItem key={k} onSelect={() => ctx.set(path, [...value, structuredClone(v)])}>
                {SHAPE_LABEL[k]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  // Points: [x, y] rows, some of them arcs { to, via }.
  const isPointRow = isVec(el) || (el.type === "union" && (el.options as S[]).some(isVec))
  if (isPointRow) {
    return (
      <div>
        <FieldLabel name={name} hint={hint} />
        <div className="space-y-1.5">
          {value.map((p, i) => {
            const arc = !Array.isArray(p) && p && typeof p === "object"
            const row = (
              <div key={i} className="flex items-start gap-1">
                <span className="w-5 shrink-0 pt-1.5 text-right text-caption text-faint-foreground tabular">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  {arc ? (
                    <>
                      <VecInput value={(p as { to: (number | string)[] }).to} n={2} onChange={(v) => ctx.set([...path, i, "to"], v)} label={`第 ${i + 1} 点`} />
                      <div className="flex items-center gap-1 text-caption text-faint-foreground">
                        经过
                        <VecInput value={(p as { via: (number | string)[] }).via} n={2} onChange={(v) => ctx.set([...path, i, "via"], v)} label={`第 ${i + 1} 段圆弧经过的点`} />
                      </div>
                    </>
                  ) : (
                    <VecInput value={p as (number | string)[]} n={2} onChange={(v) => ctx.set([...path, i], v)} label={`第 ${i + 1} 点`} />
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`去掉第 ${i + 1} 点`}
                  disabled={value.length <= 1}
                  onClick={() => ctx.set(path, value.filter((_, k) => k !== i))}
                  className="mt-1 grid size-6 shrink-0 place-items-center rounded-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
            return row
          })}
        </div>
        <Button size="sm" variant="ghost" className="-ml-2 mt-1" onClick={() => ctx.set(path, [...value, [0, 0]])}>
          <Plus />
          加一个点
        </Button>
      </div>
    )
  }
  return null
}

function NumInput({ value, onChange, placeholder, label, className }: { value: number | string | undefined; onChange: (v: number | string | undefined) => void; placeholder?: string; label: string; className?: string }) {
  const [text, setText] = React.useState(value === undefined ? "" : String(value))
  const [shown, setShown] = React.useState(value)
  if (shown !== value) {
    setShown(value)
    setText(value === undefined ? "" : String(value))
  }
  return (
    <Input
      className={cn("h-8 font-mono tabular", className)}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value)
        const v = parseNum(e.target.value)
        setShown(v)
        onChange(v)
      }}
    />
  )
}

function VecInput({ value, n, onChange, label }: { value: (number | string)[] | undefined; n: number; onChange: (v: (number | string)[] | undefined) => void; label: string }) {
  const axes = ["x", "y", "z"].slice(0, n)
  return (
    <div className="flex gap-1">
      {axes.map((a, i) => (
        <NumInput
          key={a}
          className="min-w-0 flex-1"
          label={`${label} ${a}`}
          placeholder={a}
          value={value?.[i]}
          onChange={(v) => {
            const next = axes.map((_, k) => (k === i ? v : value?.[k]))
            onChange(next.every((x) => x === undefined) ? undefined : next.map((x) => x ?? 0))
          }}
        />
      ))}
    </div>
  )
}
