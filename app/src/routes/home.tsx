import * as React from "react"
import * as THREE from "three"
import { Link } from "react-router"
import { ArrowRight, BookOpen, Box, Dumbbell, Layers, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Viewport } from "@/components/viewport"
import { OpIcon } from "@/components/op-icon"
import { useBakedThumbnail } from "@/components/thumbnail"
import { useContinue } from "@/lib/progress"
import { LESSONS } from "@/content/lessons"
import { mug } from "@/content/procedural/mug"
import { defaults } from "@/content/procedural/types"
import { OPS } from "@/content/ops"
import { PERSONAS, TRACKS } from "@/content/curriculum"
import { useModelIndex } from "@/lib/use-async"
import { PartScene } from "@/three/teardown-scene"
import type { Viewer } from "@/three/viewer"

export function HomePage() {
  const models = useModelIndex()
  const next = useContinue()
  const lessonCount = TRACKS.reduce((n, t) => n + t.modules.reduce((m, mod) => m + mod.lessons.length, 0), 0)
  return (
    <main>
      <section className="relative overflow-hidden border-b">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-[1fr_1.15fr] items-center gap-10 px-6 pb-16 pt-12 max-lg:grid-cols-1 max-sm:px-4">
          <div>
            <div className="font-mono text-small text-primary">FeatureTree / 工业建模互动课</div>
            <h1 className="mt-3 text-hero font-semibold tracking-tight">
              看懂每一个特征
              <br />
              是怎么长出来的
            </h1>
            <p className="mt-4 max-w-[34em] text-reading text-muted-foreground">
              从草图、约束到抽壳、装配，用能亲手操作的 3D 一步步学参数化建模。先讲清概念，再对照 SOLIDWORKS、Fusion、Onshape 里的叫法。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="primary" size="lg">
                <Link to={next.to}>{next.label}</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link to="/teardown">看案例拆解</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-4 gap-4">
              <Stat value={LESSONS.length} label="节互动课" />
              <Stat value={models.length} label="个拆解案例" />
              <Stat value={OPS.length} label="个建模命令" />
              <Stat value={lessonCount} label="节课的大纲" />
            </dl>
          </div>
          <HeroBuild />
        </div>
      </section>

      <section className="bg-sunken">
        <div className="mx-auto grid max-w-[1200px] grid-cols-4 gap-4 px-6 py-12 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:px-4">
          <Way
            icon={<BookOpen />}
            title="互动课"
            to="/learn"
            link="看学习路径"
            text="一步一个概念。视角自动转到该看的地方，任务在 3D 里完成：拖角点、加约束、拉箭头。先猜结果，再看发生了什么。"
          />
          <Way
            icon={<Layers />}
            title="案例拆解"
            to="/teardown"
            link="看拆解"
            text="真实零件按特征树重建，几何由 OpenCascade 内核算出。每个面都标着是哪一步生成或修改的，还能看每一步的 build123d 代码。"
          />
          <Way icon={<Dumbbell />} title="练习" to="/practice" link="去练习" text="把打乱的特征树排回去；猜一个参数改了会不会失败，再看内核的答案。小测按 1 天、1 周、3 周提醒复习。" />
          <Way icon={<Box />} title="工具图鉴" to="/atlas" link="翻图鉴" text={`${OPS.length} 个建模命令各一张卡：它做什么、要什么输入、常见的坑，以及在 8 个软件里分别叫什么。`} />
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-12 max-sm:px-4">
        <div className="flex items-center">
          <h2 className="flex-1 text-title-lg font-semibold">互动课</h2>
          <Link to="/learn" className="flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
            完整学习路径
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          {LESSONS.map((l) => (
            <Link key={l.id} to={`/lesson/${l.id}`} className="flex flex-col rounded-lg border p-4 transition-colors duration-(--duration-fast) hover:border-input">
              <div className="flex items-center gap-2 font-mono text-caption text-faint-foreground">
                <span>{l.track}</span>
                <span>{l.codes.join(" · ")}</span>
                <span className="ml-auto">{l.minutes} 分钟</span>
              </div>
              <div className="mt-1.5 text-heading font-semibold">{l.title}</div>
              <p className="mt-1 text-small text-muted-foreground">{l.gist}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-12 max-sm:px-4">
        <div className="flex items-center">
          <h2 className="flex-1 text-title-lg font-semibold">案例拆解</h2>
          <Link to="/teardown" className="flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
            全部案例
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {models.slice(0, 8).map((m) => (
            <MiniModelCard key={m.id} id={m.id} title={m.title} subtitle={m.subtitle} />
          ))}
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-[1200px] px-6 py-12 max-sm:px-4">
          <h2 className="text-title-lg font-semibold">为谁设计</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 max-md:grid-cols-1">
            {PERSONAS.map((p) => (
              <div key={p.name}>
                <div className="text-body font-medium">{p.name}</div>
                <div className="mt-0.5 font-mono text-small text-muted-foreground">{p.path}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-1 px-6 py-6 text-small text-faint-foreground max-sm:px-4">
          <span>FeatureTree · 2026</span>
          <span>几何：build123d + OpenCascade · 渲染：three.js · 草图求解：FreeCAD planegcs</span>
        </div>
      </footer>
    </main>
  )
}

function MiniModelCard({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  const src = useBakedThumbnail(id, { w: 280, h: 210 })
  return (
    <Link to={`/teardown/${id}`} className="flex flex-col overflow-hidden rounded-lg border transition-colors duration-(--duration-fast) hover:border-input">
      <div className="aspect-[4/3] bg-scene">{src && <img src={src} alt="" className="size-full object-contain" />}</div>
      <div className="border-t p-3">
        <div className="text-body font-medium">{title}</div>
        <div className="truncate text-small text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <div className="text-display font-semibold tabular">{value}</div>
        <div className="text-small text-muted-foreground">{label}</div>
      </dd>
    </div>
  )
}

function Way({ icon, title, text, to, link }: { icon: React.ReactNode; title: string; text: string; to: string; link: string }) {
  return (
    <div className="flex flex-col rounded-lg border bg-background p-5">
      <div className="text-primary [&_svg]:size-5">{icon}</div>
      <div className="mt-3 text-heading font-semibold">{title}</div>
      <p className="mt-1 flex-1 text-body text-muted-foreground">{text}</p>
      <Link to={to} className="mt-4 flex items-center gap-1 text-body font-medium hover:underline">
        {link}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

/**
 * The mug builds itself once, feature by feature, against the ghost of the
 * finished part. It stops at the end (no decorative loop); Replay restarts.
 */
function HeroBuild() {
  const scene = React.useRef<PartScene | null>(null)
  const [step, setStep] = React.useState(-1)
  const [running, setRunning] = React.useState(false)
  const alive = React.useRef(true)

  const run = React.useCallback(async () => {
    const s = scene.current
    if (!s) return
    setRunning(true)
    for (let i = 0; i < mug.features.length; i++) {
      if (!alive.current || scene.current !== s) return
      setStep(i)
      await s.rollTo(i, { camera: false })
      await new Promise((r) => setTimeout(r, 650))
    }
    setRunning(false)
  }, [])

  const onReady = React.useCallback(
    (v: Viewer) => {
      alive.current = true
      const s = new PartScene(v, mug, defaults(mug.params))
      scene.current = s
      v.showGrid(false)
      v.fit(mug.bounds(defaults(mug.params)), { dir: new THREE.Vector3(1, -1.25, 0.7), padding: 1.15, animate: false })
      s.rollTo(0, { animate: false, camera: false })
      const id = setTimeout(run, 500)
      return () => {
        alive.current = false
        clearTimeout(id)
        s.dispose()
        scene.current = null
      }
    },
    [run],
  )

  const f = step >= 0 ? mug.features[step] : null
  return (
    <div className="relative">
      <Viewport className="aspect-[5/4] rounded-xl border" onReady={onReady} viewCube={false} triad={false}>
        <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1">
          {mug.features.map((x, i) => (
            <div
              key={x.id}
              className={
                i === step
                  ? "flex h-6 items-center gap-1.5 text-small font-medium text-foreground transition-colors duration-(--duration-base) [&_svg]:size-3.5 [&_svg]:text-primary"
                  : i < step
                    ? "flex h-6 items-center gap-1.5 text-small text-muted-foreground transition-colors duration-(--duration-base) [&_svg]:size-3.5"
                    : "flex h-6 items-center gap-1.5 text-small text-faint-foreground/60 transition-colors duration-(--duration-base) [&_svg]:size-3.5"
              }
            >
              <OpIcon op={x.op} />
              {x.name}
              {i === step && <span className="font-normal text-muted-foreground max-sm:hidden">· {x.title}</span>}
            </div>
          ))}
        </div>
        {!running && step >= 0 && (
          <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={run}>
            <RotateCcw />
            重播
          </Button>
        )}
      </Viewport>
      {f && <span className="sr-only">当前步骤：{f.name}</span>}
    </div>
  )
}
