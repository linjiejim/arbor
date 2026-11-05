import * as React from "react"
import { Link } from "react-router"
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Shuffle, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Segmented } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { StateView } from "@/components/ui/state"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Choices } from "@/components/lesson-ui"
import { OpIcon } from "@/components/op-icon"
import { Viewport } from "@/components/viewport"
import { markDone } from "@/lib/progress"
import { useAsync, useModelIndex } from "@/lib/use-async"
import { ORDER_RULES, type OrderRule } from "@/content/practice"
import { loadManifest, variantKey, type PartManifest } from "@/three/baked"
import { BakedPartScene } from "@/three/teardown-scene"
import type { Viewer } from "@/three/viewer"

/**
 * Practice that reading and watching can't replace (research: retrieval
 * practice, Parsons-style ordering, predict-then-check, error diagnosis):
 *   特征树排序  put a part's features back in a buildable, well-intended order
 *   改参预测    predict what a parameter change does, then see the kernel's answer
 */
export function PracticePage() {
  const index = useModelIndex()
  const parts = index.filter((m) => m.kind === "part")
  const orderable = parts.filter((m) => ORDER_RULES[m.id])
  return (
    <Page width="wide" className="mx-auto">
      <PageHeader title="练习" info="练习题全部基于真实模型：顺序对不对、参数改了会不会失败，都是内核实际算出来的结果。" />
      <Tabs defaultValue="order">
        <TabsList>
          <TabsTrigger value="order">特征树排序</TabsTrigger>
          <TabsTrigger value="predict">改参预测</TabsTrigger>
        </TabsList>
        <TabsContent value="order" className="pt-6">
          {orderable.length ? <ModelSwitch models={orderable} render={(id) => <OrderExercise key={id} modelId={id} />} /> : <Spinner label="正在加载" />}
        </TabsContent>
        <TabsContent value="predict" className="pt-6">
          {parts.length ? <ModelSwitch models={parts} render={(id) => <PredictExercise key={id} modelId={id} />} /> : <Spinner label="正在加载" />}
        </TabsContent>
      </Tabs>
    </Page>
  )
}

function ModelSwitch({ models, render }: { models: { id: string; title: string }[]; render: (id: string) => React.ReactNode }) {
  const [id, setId] = React.useState(models[0].id)
  return (
    <>
      {models.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-small text-muted-foreground">模型</span>
          {models.length <= 4 ? (
            <Segmented size="sm" value={id} onValueChange={setId} options={models.map((m) => ({ value: m.id, label: m.title }))} />
          ) : (
            <Select className="w-64" value={id} onValueChange={setId} options={models.map((m) => ({ value: m.id, label: m.title }))} />
          )}
        </div>
      )}
      {render(id)}
    </>
  )
}

// ------------------------------------------------------------------ ordering

function shuffle<T>(a: T[], seed: number) {
  const out = [...a]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function OrderExercise({ modelId }: { modelId: string }) {
  const m = useAsync(() => loadManifest(modelId) as Promise<PartManifest>, [modelId])
  // The learner's own order once they move something; until then, the shuffle for this seed.
  const [moved, setMoved] = React.useState<string[] | null>(null)
  const [checked, setChecked] = React.useState<null | { hard: OrderRule[]; soft: OrderRule[] }>(null)
  const [seed, setSeed] = React.useState(7)
  const order = moved ?? (m.data ? shuffle(m.data.features.map((f) => f.id), seed) : null)
  if (m.error) return <StateView kind="error" description="模型没加载出来。" onRetry={m.retry} />
  if (!m.data || !order) return <Spinner label="正在加载" />
  const feats = new Map(m.data.features.map((f) => [f.id, f]))
  const rules = (ORDER_RULES[modelId] ?? []).filter((r) => feats.has(r.before) && feats.has(r.after))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setMoved(next)
    setChecked(null)
  }
  const check = () => {
    const pos = new Map(order.map((id, i) => [id, i]))
    const broken = rules.filter((r) => pos.get(r.before)! > pos.get(r.after)!)
    const result = { hard: broken.filter((r) => r.hard), soft: broken.filter((r) => !r.hard) }
    setChecked(result)
    if (!result.hard.length && !result.soft.length) markDone(`practice:order:${modelId}`)
  }
  const perfect = checked && !checked.hard.length && !checked.soft.length
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 max-md:grid-cols-1">
      <div>
        <p className="text-reading">
          「{m.data.title}」的 {order.length} 个特征被打乱了。把它们排回一个<span className="font-medium">能重建、而且设计意图最好</span>的顺序。
        </p>
        <ol className="mt-4 overflow-hidden rounded-lg border">
          {order.map((id, i) => {
            const f = feats.get(id)!
            return (
              <li key={id} className="flex h-11 items-center gap-2 border-t px-2 first:border-t-0">
                <span className="w-5 text-right font-mono text-caption tabular text-faint-foreground">{i + 1}</span>
                <OpIcon op={f.op} className="size-4 text-muted-foreground" />
                <span className="text-body">{f.name}</span>
                <span className="truncate text-small text-muted-foreground">{f.title}</span>
                <span className="ml-auto flex">
                  <IconButton label="上移" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton label="下移" size="icon-sm" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </IconButton>
                </span>
              </li>
            )
          })}
        </ol>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={check}>
            检查顺序
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSeed((x) => x + 13)
              setMoved(null)
              setChecked(null)
            }}
          >
            <Shuffle />
            重新打乱
          </Button>
        </div>
      </div>
      <div>
        {!checked ? (
          <div className="rounded-lg border border-dashed p-4 text-body text-muted-foreground">
            提示：先想清楚每个特征「引用了谁」。草图在特征之前，圆角要倒在已经存在的边上，抽壳会作用于此刻的整个实体。
          </div>
        ) : perfect ? (
          <div className="rounded-lg bg-success-subtle p-4">
            <div className="flex items-center gap-2 text-heading font-semibold text-success">
              <CircleCheck className="size-5" />
              顺序正确
            </div>
            <p className="mt-1 text-body">每个特征引用的东西都已经存在，而且关键的设计意图都保住了。</p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link to={`/teardown/${modelId}`}>在拆解页里回放</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {checked.hard.length > 0 && (
              <div className="rounded-lg bg-destructive-subtle p-4">
                <div className="flex items-center gap-2 text-body font-medium text-destructive">
                  <CircleX className="size-4" />
                  按这个顺序会重建失败
                </div>
                <ul className="mt-2 space-y-2 text-body">
                  {checked.hard.map((r) => (
                    <li key={r.before + r.after}>
                      「{feats.get(r.after)!.name}」排在「{feats.get(r.before)!.name}」前面：{r.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {checked.soft.length > 0 && (
              <div className="rounded-lg bg-warning-subtle p-4">
                <div className="flex items-center gap-2 text-body font-medium text-warning">
                  <TriangleAlert className="size-4" />
                  能建出来，但设计意图有问题
                </div>
                <ul className="mt-2 space-y-2 text-body">
                  {checked.soft.map((r) => (
                    <li key={r.before + r.after}>
                      「{feats.get(r.before)!.name}」应该在「{feats.get(r.after)!.name}」之前：{r.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ predict

type Question = { from: Record<string, number>; to: Record<string, number>; param: string; options: string[]; answer: number; explain: string; key: string }

function buildQuestions(m: PartManifest): Question[] {
  const grid = m.params.filter((p) => p.values.length)
  const base = Object.fromEntries(m.params.map((p) => [p.id, p.default]))
  const out: Question[] = []
  const nonSketch = m.features.filter((f) => f.op !== "sketch")
  for (const p of grid) {
    for (const v of p.values) {
      if (v === p.default) continue
      const to = { ...base, [p.id]: v }
      const key = variantKey(grid, to)
      const variant = m.variants[key]
      if (!variant) continue
      const failed = variant.ok ? null : m.features.find((f) => f.id === variant.failedAt)
      const distractors = nonSketch.filter((f) => f.id !== failed?.id).slice(-2)
      const options = ["正常重建，只是尺寸变了", ...(failed ? [failed] : []).concat(distractors).slice(0, 2).map((f) => `在「${f.name} ${f.title}」失败`)]
      const answerText = failed ? `在「${failed.name} ${failed.title}」失败` : options[0]
      const shuffled = shuffle(options, v * 31 + p.id.length)
      out.push({
        from: base,
        to,
        param: p.id,
        key,
        options: shuffled,
        answer: shuffled.indexOf(answerText),
        explain: failed ? (m.failures[failed.id] ?? "内核没能完成这一步。") : "这组参数下每个特征都能重建，设计意图把变化传到了下游。",
      })
    }
  }
  // Failures first: they teach the most.
  return out.sort((a, b) => Number(m.variants[a.key].ok) - Number(m.variants[b.key].ok)).slice(0, 6)
}

function PredictExercise({ modelId }: { modelId: string }) {
  const m = useAsync(() => loadManifest(modelId) as Promise<PartManifest>, [modelId])
  const [qi, setQi] = React.useState(0)
  const [picked, setPicked] = React.useState<number | null>(null)
  const scene = React.useRef<BakedPartScene | null>(null)
  const questions = React.useMemo(() => (m.data ? buildQuestions(m.data) : []), [m.data])
  const q = questions[qi]

  const onReady = React.useCallback(
    (v: Viewer) => {
      if (!m.data) return
      const s = new BakedPartScene(v, m.data)
      s.showFuture = false
      scene.current = s
      s.setValues(Object.fromEntries(m.data.params.map((p) => [p.id, p.default])), { frame: true })
      return () => {
        s.dispose()
        scene.current = null
      }
    },
    [m.data],
  )

  if (m.error) return <StateView kind="error" description="模型没加载出来。" onRetry={m.retry} />
  if (!m.data) return <Spinner label="正在加载" />
  if (!q) return <StateView kind="empty" title="这个模型还没有可练的参数" />
  const p = m.data.params.find((x) => x.id === q.param)!
  const reveal = (i: number) => {
    setPicked(i)
    scene.current?.setValues(q.to)
  }
  const next = () => {
    setPicked(null)
    const n = (qi + 1) % questions.length
    setQi(n)
    scene.current?.setValues(questions[n].from)
    if (n === 0) markDone(`practice:predict:${modelId}`)
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 max-md:grid-cols-1">
      <div>
        <div className="text-small text-muted-foreground">
          第 {qi + 1} 题，共 {questions.length} 题
        </div>
        <p className="mt-1 text-reading">
          其他参数不变，把「{p.label}」从 <span className="font-mono tabular">{q.from[q.param]}</span> 改成{" "}
          <span className="font-mono tabular">{q.to[q.param]}</span> {p.unit}。会怎样？
        </p>
        <Choices options={q.options} answer={q.answer} picked={picked} onPick={reveal} />
        {picked !== null && (
          <>
            <p className="mt-3 text-body">{q.explain}</p>
            <Button variant="primary" className="mt-3" onClick={next}>
              下一题
            </Button>
          </>
        )}
      </div>
      <Section>
        <Viewport className="aspect-[4/3] rounded-lg border" onReady={onReady} viewCube={false} />
        <p className="mt-2 text-caption text-faint-foreground">选完答案后，右边换成新参数下内核的实际结果。</p>
      </Section>
      <span className={cn("sr-only")}>{m.data.title}</span>
    </div>
  )
}
