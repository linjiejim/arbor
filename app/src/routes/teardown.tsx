import * as React from "react"
import * as THREE from "three"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleX, ExternalLink, Pause, Play, SquareDashed, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Page, PageHeader } from "@/components/ui/page"
import { StateView } from "@/components/ui/state"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Viewport } from "@/components/viewport"
import { OpIcon } from "@/components/op-icon"
import { OpTerm } from "@/components/op-term"
import { CodeBlock } from "@/components/code-block"
import { useBakedThumbnail } from "@/components/thumbnail"
import { markDone, markVisited } from "@/lib/progress"
import { PLANNED_MODELS } from "@/content/teardowns"
import { starterFor } from "@/studio/starters"
import { sourceUrl } from "@/lib/site"
import { useAsync } from "@/lib/use-async"
import { loadGlb, loadIndex, loadManifest, type AssemblyManifest, type Manifest, type ModelIndexEntry, type PartManifest } from "@/three/baked"
import { BakedAssemblyScene, BakedPartScene, type BakedState } from "@/three/teardown-scene"
import type { Viewer } from "@/three/viewer"


// ------------------------------------------------------------------ gallery

export function TeardownIndex() {
  const index = useAsync(loadIndex, [])
  const models = index.data ? Object.values(index.data) : []
  return (
    <Page width="wide" className="mx-auto">
      <PageHeader title="案例拆解" info="真实物件按特征树一步步重建：几何由 build123d 和 OpenCascade 内核离线算出，每个面都标明是哪一步生成或修改的。" />
      {index.error ? (
        <StateView kind="error" description="模型清单没加载出来。" onRetry={index.retry} />
      ) : (
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {index.loading && Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[4/3] rounded-lg border bg-sunken" />)}
          {models.map((m) => (
            <ModelCard key={m.id} model={m} />
          ))}
          {PLANNED_MODELS.filter((p) => !models.some((m) => m.title === p.title)).map((p) => (
            <div key={p.title} className="flex flex-col overflow-hidden rounded-lg border">
              <div className="grid aspect-[4/3] place-items-center bg-sunken">
                <div className="flex gap-3 text-faint-foreground [&_svg]:size-6">
                  {p.ops.map((o) => (
                    <OpIcon key={o} op={o} />
                  ))}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 border-t p-3">
                <div className="flex items-center gap-2">
                  <span className="text-heading font-semibold">{p.title}</span>
                  <Badge tone="outline" className="ml-auto">
                    规划中
                  </Badge>
                </div>
                <div className="text-small text-muted-foreground">{p.subtitle}</div>
                <div className="mt-1 text-caption text-faint-foreground">
                  {p.level} · {p.kind}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}

function ModelCard({ model }: { model: ModelIndexEntry }) {
  const src = useBakedThumbnail(model.id)
  return (
    <Link to={`/teardown/${model.id}`} className="group flex flex-col overflow-hidden rounded-lg border transition-colors duration-(--duration-fast) hover:border-input">
      <div className="aspect-[4/3] bg-scene">{src && <img src={src} alt="" className="size-full object-contain" />}</div>
      <div className="flex flex-1 flex-col gap-1 border-t p-3">
        <div className="flex items-center gap-2">
          <span className="text-heading font-semibold">{model.title}</span>
          <span className="ml-auto text-caption text-faint-foreground">{model.level}</span>
        </div>
        <div className="text-small text-muted-foreground">{model.subtitle}</div>
        <div className="mt-1 text-caption text-faint-foreground">
          {model.kind === "part" ? `单零件 · ${model.features} 个特征` : `装配 · ${model.parts} 种零件`}
        </div>
      </div>
    </Link>
  )
}

// ------------------------------------------------------------------ page

export function TeardownPage() {
  const { id = "" } = useParams()
  const manifest = useAsync(() => loadManifest(id), [id])
  React.useEffect(() => {
    if (manifest.data) markVisited(id)
  }, [manifest.data, id])
  if (manifest.loading)
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner label="正在加载模型" />
      </div>
    )
  if (manifest.error || !manifest.data)
    return (
      <div className="grid h-dvh place-items-center">
        <StateView kind="empty" title="没有这个案例" action={<Link to="/teardown">回到案例列表</Link>} />
      </div>
    )
  const m = manifest.data as Manifest
  return m.kind === "part" ? <PartTeardown key={m.id} manifest={m} /> : <AssemblyTeardown key={m.id} manifest={m} />
}

function Shell({
  title,
  meta,
  actions,
  left,
  right,
  children,
}: {
  title: string
  meta: string
  actions?: React.ReactNode
  left: React.ReactNode
  right: React.ReactNode
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label="返回案例列表" onClick={() => navigate("/teardown")}>
          <ArrowLeft />
        </IconButton>
        <span className="truncate text-body font-semibold">{title}</span>
        <span className="truncate text-small text-faint-foreground max-sm:hidden">{meta}</span>
        <div className="ml-auto flex items-center gap-4 pr-2">{actions}</div>
      </header>
      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        <aside className="w-64 shrink-0 overflow-y-auto border-r max-lg:hidden">{left}</aside>
        <div className="relative min-h-0 min-w-0 flex-1 max-lg:min-h-[55dvh]">{children}</div>
        <aside className="w-[340px] shrink-0 overflow-y-auto border-l max-lg:w-full max-lg:border-l-0 max-lg:border-t">{right}</aside>
      </div>
    </div>
  )
}

function ToggleLabel({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-small text-muted-foreground max-sm:hidden">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  )
}

function SourceLink({ path, label, className }: { path: string; label: string; className?: string }) {
  const url = sourceUrl(path)
  const cls = cn("inline-flex items-center gap-1 text-small text-muted-foreground", className)
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cn(cls, "hover:text-foreground")}>
      {label} <span className="font-mono text-caption">{path}</span>
      <ExternalLink className="size-3.5" />
    </a>
  ) : (
    <div className={cls}>
      {label}：<span className="font-mono text-caption">{path}</span>
    </div>
  )
}

// ------------------------------------------------------------------ part

function PartTeardown({ manifest: m }: { manifest: PartManifest }) {
  const scene = React.useRef<BakedPartScene | null>(null)
  const grid = m.params.filter((p) => p.values.length)
  const defaults = React.useMemo(() => Object.fromEntries(m.params.map((p) => [p.id, p.default])), [m])
  const [values, setValues] = React.useState<Record<string, number>>(defaults)
  const [upto, setUpto] = React.useState(m.features.length - 1)
  const [state, setState] = React.useState<BakedState>({ loading: true, error: null, variant: null, available: 0 })
  const [showFuture, setShowFuture] = React.useState(true)
  const [autoCam, setAutoCam] = React.useState(true)
  const [section, setSection] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [tab, setTab] = React.useState("step")
  const playRef = React.useRef(false)
  const available = state.available
  const last = Math.max(0, available - 1)
  const failedAt = state.variant && !state.variant.ok ? state.variant.failedAt : undefined
  const failedIndex = failedAt ? m.features.findIndex((f) => f.id === failedAt) : -1

  const onReady = React.useCallback(
    (v: Viewer) => {
      const s = new BakedPartScene(v, m)
      s.onState = (st) => {
        setState(st)
        setUpto(s.upto)
      }
      scene.current = s
      s.setValues(defaults, { frame: true })
      return () => {
        s.dispose()
        scene.current = null
      }
    },
    [m, defaults],
  )

  const rollTo = React.useCallback(
    (i: number, animate = true) => {
      const n = Math.max(0, Math.min(last, i))
      setUpto(n)
      return scene.current?.rollTo(n, { animate, camera: autoCam }) ?? Promise.resolve()
    },
    [last, autoCam],
  )

  const stop = () => {
    playRef.current = false
    setPlaying(false)
  }

  const play = async () => {
    if (playRef.current) return stop()
    playRef.current = true
    setPlaying(true)
    for (let i = 0; i <= last; i++) {
      if (!playRef.current) break
      await rollTo(i)
      await new Promise((r) => setTimeout(r, 1100))
    }
    stop()
    markDone(m.id)
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [role=tab]")) return
      if (e.key === "ArrowDown" || e.key === "ArrowRight") rollTo(upto + 1)
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") rollTo(upto - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [rollTo, upto])

  const setParam = (id: string, v: number) => {
    const next = { ...values, [id]: v }
    setValues(next)
    scene.current?.setValues(next)
  }

  const f = m.features[upto]
  const summary = state.variant?.summaries?.[f.id] ?? (f.summaryTemplate ? f.summaryTemplate.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? "")) : f.summary)
  const stats = scene.current?.stats()

  return (
    <Shell
      title={m.title}
      meta={`案例拆解 · 单零件 · ${m.features.length} 个特征`}
      actions={
        <>
          <ToggleLabel
            label="显示后续特征"
            checked={showFuture}
            onChange={(v) => {
              setShowFuture(v)
              scene.current?.setShowFuture(v)
            }}
          />
          <ToggleLabel
            label="剖切"
            checked={section}
            onChange={(v) => {
              setSection(v)
              scene.current?.setSection(v)
            }}
          />
          <ToggleLabel label="自动转到关键视角" checked={autoCam} onChange={setAutoCam} />
        </>
      }
      left={
        <div className="p-2">
          <div className="px-2 pb-1 pt-1 text-small font-medium text-muted-foreground">特征树</div>
          <div className="flex h-8 items-center gap-2 rounded-sm px-2 text-body text-faint-foreground">
            <SquareDashed className="size-4" />
            原点与基准面
          </div>
          {m.features.map((x, i) => {
            const failed = i === failedIndex
            const unavailable = i >= available
            return (
              <React.Fragment key={x.id}>
                <button
                  type="button"
                  disabled={unavailable && !failed}
                  onClick={() => {
                    stop()
                    if (failed) setTab("params")
                    else rollTo(i)
                  }}
                  onMouseEnter={() => i <= upto && scene.current?.setHover(x.id)}
                  onMouseLeave={() => scene.current?.setHover(null)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-body transition-colors duration-(--duration-fast) hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-transparent",
                    i === upto && !failed && "bg-selected font-medium",
                    i > upto && !failed && "text-faint-foreground",
                    failed && "text-destructive",
                  )}
                >
                  {failed ? (
                    <CircleX className="size-4" />
                  ) : (
                    <OpIcon op={x.op} className={cn("size-4", i === upto ? "text-primary" : "text-muted-foreground")} />
                  )}
                  <span className="shrink-0">{x.name}</span>
                  <span className="truncate text-small text-faint-foreground">{failed ? "重建失败" : x.title}</span>
                </button>
                {i === upto && i < m.features.length - 1 && !failed && (
                  <div className="mx-2 my-1 flex items-center gap-2" aria-label="回滚条">
                    <span className="h-0.5 flex-1 rounded-full bg-primary" />
                    <span className="text-caption text-primary">回滚到这里</span>
                  </div>
                )}
              </React.Fragment>
            )
          })}
          <p className="mt-4 px-2 text-caption text-faint-foreground">↑ ↓ 逐步回滚。悬停一个特征，看它生成（蓝）和修改（橙）了哪些面。</p>
        </div>
      }
      right={
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-full flex-col">
          <TabsList className="sticky top-0 z-10 bg-background px-4">
            <TabsTrigger value="step">这一步</TabsTrigger>
            <TabsTrigger value="code">代码</TabsTrigger>
            <TabsTrigger value="params">
              参数
              {failedAt && <span className="size-1.5 rounded-full bg-destructive" aria-label="这组参数会失败" />}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="step" className="p-4">
            <div className="text-small text-muted-foreground">
              第 {upto + 1} 步，共 {m.features.length} 步
            </div>
            <h2 className="mt-1 flex items-center gap-2 text-title font-semibold">
              <OpIcon op={f.op} className="size-5 text-primary" />
              {f.name} · {f.title}
            </h2>
            <div className="mt-1 font-mono text-caption tabular text-muted-foreground">{summary}</div>
            <p className="mt-3 text-reading">{f.why}</p>
            {f.pitfall && (
              <div className="mt-3 flex gap-2 rounded-md bg-warning-subtle px-3 py-2 text-body text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{f.pitfall}</span>
              </div>
            )}
            {f.op !== "sketch" && stats && (
              <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1 text-small">
                <span className="size-2.5 rounded-xs bg-primary" />
                <span>这一步新生成的面</span>
                <span className="tabular text-muted-foreground">{stats.new}</span>
                <span className="size-2.5 rounded-xs bg-scene-modified" />
                <span>被这一步修改的面</span>
                <span className="tabular text-muted-foreground">{stats.modified}</span>
                <span className="size-2.5 rounded-xs border bg-muted" />
                <span>没有变化的面</span>
                <span className="tabular text-muted-foreground">{stats.kept}</span>
              </div>
            )}
            <div className="mt-4">
              <OpTerm id={f.op} />
            </div>
            <div className="mt-6 border-t pt-4">
              <div className="text-small font-medium text-muted-foreground">这个案例教什么</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-body">
                {(m.teaches ?? []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </TabsContent>
          <TabsContent value="code" className="space-y-3 p-4">
            <p className="text-small text-muted-foreground">
              这一步在 build123d 里的写法。整个模型就是这样一段 Python：网站上的几何，正是由它离线算出来的。
            </p>
            {f.code ? <CodeBlock code={f.code} /> : <p className="text-small text-faint-foreground">这一步没有单独的代码。</p>}
            <SourceLink path={m.source} label="完整源码" />
          </TabsContent>
          <TabsContent value="params" className="p-4">
            <p className="text-small text-muted-foreground">
              这些组合都在内核里实际算过。失败的组合不隐藏：它们说明了特征之间的约束。
            </p>
            {starterFor(m.id) && (
              <Link
                to={`/studio?start=${starterFor(m.id)!.id}`}
                className="mt-3 flex items-center gap-2 rounded-md border p-3 text-small transition-colors duration-(--duration-fast) hover:bg-accent"
              >
                <span className="flex-1">
                  <span className="font-medium text-foreground">在 AI 工作台里打开</span>
                  <span className="block text-muted-foreground">同一棵特征树，参数可以取任意值，还能接着加特征。</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
            {failedAt && (
              <div className="mt-3 rounded-lg bg-destructive-subtle p-3">
                <div className="flex items-center gap-2 text-body font-medium text-destructive">
                  <CircleX className="size-4" />
                  这组参数在「{m.features[failedIndex]?.name}」失败
                </div>
                <p className="mt-1 text-body">{m.failures[failedAt] ?? "内核没能完成这一步。"}</p>
                <p className="mt-1 font-mono text-caption text-muted-foreground">内核原话：{state.variant?.reason}</p>
              </div>
            )}
            <div className="mt-4 space-y-4">
              {grid.map((p) => (
                <div key={p.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-small font-medium">{p.label}</span>
                    <span className="text-caption text-faint-foreground">在 {m.features.find((x) => x.id === p.feature)?.name} 里生效</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.values.map((val) => {
                      const probe = { ...values, [p.id]: val }
                      const key = grid
                        .map((g) => g.id)
                        .sort()
                        .map((id) => `${id}-${Number(probe[id].toPrecision(6))}`)
                        .join("_")
                      const ok = m.variants[key]?.ok
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setParam(p.id, val)}
                          className={cn(
                            "h-7 min-w-12 rounded-sm border px-2 font-mono text-caption tabular transition-colors duration-(--duration-fast) hover:bg-accent",
                            values[p.id] === val && "border-primary bg-selected text-foreground",
                            !ok && "border-dashed text-destructive",
                          )}
                          title={ok ? undefined : "这个组合会失败"}
                        >
                          {val}
                          {p.unit && <span className="text-faint-foreground">{p.unit}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t pt-4">
              <div className="text-small font-medium text-muted-foreground">其他尺寸（固定）</div>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-small">
                {m.params
                  .filter((p) => !p.values.length)
                  .map((p) => (
                    <div key={p.id} className="contents">
                      <dt className="text-muted-foreground">{p.label}</dt>
                      <dd className="font-mono tabular">
                        {p.default}
                        {p.unit}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          </TabsContent>
        </Tabs>
      }
    >
      <Viewport className="absolute inset-0" onReady={onReady} triadClassName="bottom-16 left-3">
        {state.loading && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md border bg-popover px-3 py-1.5 text-small shadow-popover">
            <Spinner />
            正在加载这组参数的模型
          </div>
        )}
        {state.error && (
          <div className="absolute left-3 top-3">
            <StateView size="sm" kind="error" description={state.error} onRetry={() => scene.current?.setValues(values)} />
          </div>
        )}
        {failedAt && !state.loading && (
          <div className="absolute left-3 top-3 flex max-w-[min(420px,calc(100%-120px))] gap-2 rounded-md border bg-popover px-3 py-2 text-small shadow-popover">
            <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              <span className="font-medium">重建失败 · </span>
              这组参数做到「{m.features[failedIndex]?.name} {m.features[failedIndex]?.title}」就失败了，模型停在上一步。
              <button type="button" className="ml-1 underline underline-offset-4" onClick={() => setTab("params")}>
                为什么
              </button>
            </span>
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-popover">
          <IconButton label="上一步" size="icon-sm" disabled={upto === 0} onClick={() => rollTo(upto - 1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton label={playing ? "暂停" : "从头播放建模过程"} size="icon-sm" onClick={play} disabled={!available}>
            {playing ? <Pause /> : <Play />}
          </IconButton>
          <IconButton label="下一步" size="icon-sm" disabled={upto >= last} onClick={() => rollTo(upto + 1)}>
            <ChevronRight />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {m.features.map((x, i) => (
              <React.Fragment key={x.id}>
                <button
                  type="button"
                  title={`${x.name} · ${x.title}`}
                  disabled={i >= available}
                  onClick={() => {
                    stop()
                    rollTo(i)
                  }}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1 rounded-sm px-1.5 text-caption transition-colors duration-(--duration-fast) hover:bg-accent disabled:cursor-not-allowed [&_svg]:size-3.5",
                    i === upto ? "bg-selected font-medium text-foreground" : i < upto ? "text-foreground" : "text-faint-foreground",
                    i === failedIndex && "text-destructive",
                  )}
                >
                  {i === failedIndex ? <CircleX /> : <OpIcon op={x.op} className={i === upto ? "text-primary" : undefined} />}
                  {x.name}
                </button>
                {i === upto && i < m.features.length - 1 && <span className="h-5 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Viewport>
    </Shell>
  )
}

// ------------------------------------------------------------------ assembly

function AssemblyTeardown({ manifest: m }: { manifest: AssemblyManifest }) {
  const scene = React.useRef<BakedAssemblyScene | null>(null)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [explode, setExplode] = React.useState(0)
  const [hover, setHover] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [section, setSection] = React.useState(false)
  const [cut, setCut] = React.useState(0)
  const [range, setRange] = React.useState<[number, number]>([-40, 40])
  const [playing, setPlaying] = React.useState(false)
  const [joints, setJoints] = React.useState<Record<string, number>>({})
  const cancel = React.useRef(false)
  const moving = m.parts.filter((p) => p.motion)

  const onReady = React.useCallback(
    (v: Viewer) => {
      let alive = true
      let cleanup = () => {}
      loadGlb(m.id, m.file).then(
        (glb) => {
          if (!alive) return
          const s = new BakedAssemblyScene(v, m, glb as THREE.Group)
          scene.current = s
          setRange(s.sectionRange())
          setReady(true)
          const el = v.renderer.domElement
          const down = { x: 0, y: 0, on: false }
          const move = (e: PointerEvent) => {
            if (e.buttons) return
            const id = s.pickPart(e)
            s.setHover(id)
            setHover(id)
            el.style.cursor = id ? "pointer" : ""
          }
          const press = (e: PointerEvent) => Object.assign(down, { x: e.clientX, y: e.clientY, on: true })
          const click = (e: PointerEvent) => {
            if (!down.on || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return
            down.on = false
            const id = s.pickPart(e)
            s.setSelected(id)
            setSelected(id)
          }
          el.addEventListener("pointermove", move)
          el.addEventListener("pointerdown", press)
          el.addEventListener("pointerup", click)
          cleanup = () => {
            el.removeEventListener("pointermove", move)
            el.removeEventListener("pointerdown", press)
            el.removeEventListener("pointerup", click)
            s.dispose()
          }
        },
        (e) => alive && setError(e instanceof Error ? e.message : String(e)),
      )
      return () => {
        alive = false
        cancel.current = true
        cleanup()
        scene.current = null
      }
    },
    [m],
  )

  const parts = [...m.parts].sort((a, b) => a.order - b.order)
  const sel = m.parts.find((p) => p.id === selected)
  const total = m.parts.reduce((n, p) => n + p.qty, 0)

  const play = async () => {
    if (!scene.current) return
    if (playing) {
      cancel.current = true
      return
    }
    cancel.current = false
    setPlaying(true)
    setExplode(0)
    await scene.current.playSequence(
      (id) => setSelected(id),
      () => cancel.current,
    )
    setPlaying(false)
    scene.current?.frame()
    markDone(m.id)
  }

  return (
    <Shell
      title={m.title}
      meta={`案例拆解 · 装配 · ${m.parts.length} 种 ${total} 个零件`}
      actions={
        <ToggleLabel
          label="剖切"
          checked={section}
          onChange={(v) => {
            setSection(v)
            scene.current?.setSection(v ? cut : null)
          }}
        />
      }
      left={
        <div className="p-2">
          <div className="flex items-center px-2 pb-1 pt-1 text-small font-medium text-muted-foreground">
            <span className="flex-1">零件清单</span>
            <span className="text-caption font-normal">装配顺序</span>
          </div>
          {parts.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => {
                scene.current?.setHover(p.id)
                setHover(p.id)
              }}
              onMouseLeave={() => {
                scene.current?.setHover(null)
                setHover(null)
              }}
              onClick={() => {
                const next = selected === p.id ? null : p.id
                scene.current?.setSelected(next)
                setSelected(next)
              }}
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-body transition-colors duration-(--duration-fast) hover:bg-accent",
                (hover === p.id || selected === p.id) && "bg-selected",
              )}
            >
              <span className="w-4 text-right font-mono text-caption tabular text-faint-foreground">{p.order}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.qty > 1 && <span className="text-small tabular text-muted-foreground">×{p.qty}</span>}
            </button>
          ))}
        </div>
      }
      right={
        <div className="p-4">
          {sel ? (
            <>
              <div className="text-small text-muted-foreground">第 {sel.order} 个装上</div>
              <h2 className="mt-1 text-title font-semibold">{sel.name}</h2>
              <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1.5 text-body">
                <dt className="text-muted-foreground">数量</dt>
                <dd className="tabular">{sel.qty}</dd>
                <dt className="text-muted-foreground">材料</dt>
                <dd>{sel.material}</dd>
                <dt className="text-muted-foreground">工艺</dt>
                <dd>{sel.process}</dd>
              </dl>
              <p className="mt-4 text-reading">{sel.note}</p>
              {sel.model && (
                <Button asChild variant="secondary" size="sm" className="mt-4">
                  <Link to={`/teardown/${sel.model}`}>看这个零件的特征树</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <h2 className="text-title font-semibold">怎么看这张爆炸图</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-reading">
                <li>零件沿真实的拆卸方向分开。</li>
                <li>「按装配顺序播放」把零件一个个装回去，顺序就是产线上的工序。</li>
                <li>打开剖切，看零件之间怎么配合、怎么固定。</li>
              </ul>
              {m.notes.length > 0 && (
                <>
                  <h3 className="mt-6 text-heading font-semibold">这件东西里的设计规则</h3>
                  <ul className="mt-2 space-y-2 text-body text-muted-foreground">
                    {m.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              <SourceLink path={m.source} label="build123d 源码" className="mt-6" />
            </>
          )}
        </div>
      }
    >
      <Viewport className="absolute inset-0" onReady={onReady} triadClassName="bottom-16 left-3">
        {!ready && !error && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md border bg-popover px-3 py-1.5 text-small shadow-popover">
            <Spinner />
            正在加载装配
          </div>
        )}
        {error && (
          <div className="absolute left-3 top-3">
            <StateView size="sm" kind="error" description={error} />
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-popover px-3 py-1.5 shadow-popover">
          <label className="flex min-w-48 flex-1 items-center gap-3 text-small font-medium">
            爆炸
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explode}
              disabled={playing || !ready}
              onChange={(e) => {
                const f = Number(e.target.value)
                setExplode(f)
                scene.current?.setExplode(f)
              }}
              onPointerUp={() => scene.current?.frame()}
              className="h-5 flex-1 cursor-pointer accent-primary"
            />
            <span className="w-9 text-right font-mono text-caption tabular text-muted-foreground">{Math.round(explode * 100)}%</span>
          </label>
          {section && (
            <label className="flex min-w-40 items-center gap-3 text-small font-medium">
              剖切位置
              <input
                type="range"
                min={range[0]}
                max={range[1]}
                step={0.5}
                value={cut}
                onChange={(e) => {
                  const x = Number(e.target.value)
                  setCut(x)
                  scene.current?.setSection(x)
                }}
                className="h-5 flex-1 cursor-pointer accent-primary"
              />
            </label>
          )}
          {moving.map((p) => (
            <label key={p.id} className="flex min-w-44 items-center gap-3 text-small font-medium">
              {p.motion!.label}
              <input
                type="range"
                min={p.motion!.min}
                max={p.motion!.max}
                step={1}
                value={joints[p.id] ?? 0}
                disabled={!ready}
                onChange={(e) => {
                  const a = Number(e.target.value)
                  setJoints((j) => ({ ...j, [p.id]: a }))
                  scene.current?.setMotion(p.id, a)
                }}
                className="h-5 flex-1 cursor-pointer accent-primary"
              />
              <span className="w-9 text-right font-mono text-caption tabular text-muted-foreground">{joints[p.id] ?? 0}°</span>
            </label>
          ))}
          <Button size="sm" variant="secondary" onClick={play} disabled={!ready}>
            {playing ? <Pause /> : <Play />}
            {playing ? "停止播放" : "按装配顺序播放"}
          </Button>
        </div>
      </Viewport>
    </Shell>
  )
}
