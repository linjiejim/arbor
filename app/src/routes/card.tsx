import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { Spinner } from "@/components/ui/spinner"
import { StateView } from "@/components/ui/state"
import { OpTerm } from "@/components/op-term"
import { ConceptTerm } from "@/components/concept-term"
import { Quiz } from "@/components/lesson-ui"
import { cardQuizKey, markDone, markVisited, recordQuiz, useProgress } from "@/lib/progress"
import { useModelIndex } from "@/lib/use-async"
import { CARDS, cardMeta } from "@/content/cards"
import type { CardDef } from "@/content/cards/types"
import { lessonById, placeOf } from "@/content/curriculum"
import { lessonMeta } from "@/content/lessons"

/**
 * 图文卡 reader: a curriculum entry that needs no 3D. A few short sections,
 * one figure or table, a quiz with explanations, then where the facts come
 * from. Finishing marks the curriculum id done and schedules the quiz for
 * review, like a lesson.
 */
export function CardPage() {
  const { code } = useParams()
  const meta = cardMeta(code)
  const [loaded, setLoaded] = React.useState<{ code: string; def: CardDef } | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    if (!meta) return
    const stale = new AbortController()
    meta.load().then(
      (m) => !stale.signal.aborted && setLoaded({ code: meta.code, def: m.default }),
      () => !stale.signal.aborted && setFailed(meta.code),
    )
    return () => stale.abort()
  }, [meta, attempt])

  if (!meta)
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <StateView kind="empty" title="没有这张图文卡" action={<Link to="/learn">回到学习路径</Link>} />
      </div>
    )
  if (failed === meta.code)
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <StateView
          kind="error"
          description="图文卡没加载出来。"
          onRetry={() => {
            setFailed(null)
            setAttempt((a) => a + 1)
          }}
        />
      </div>
    )
  const def = loaded?.code === meta.code ? loaded.def : null
  if (!def)
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Spinner label="正在加载图文卡" />
      </div>
    )
  return <CardReader key={def.code} def={def} />
}

/** Cards in the same curriculum module, in order: the reader's 上一张 / 下一张. */
function siblings(code: string) {
  const place = placeOf(code)
  const inModule = (place?.module.lessons ?? []).map((l) => l.id).filter((id) => CARDS.some((c) => c.code === id))
  const i = inModule.indexOf(code)
  return { prev: i > 0 ? inModule[i - 1] : undefined, next: i >= 0 && i < inModule.length - 1 ? inModule[i + 1] : undefined }
}

/** Reading styles for section bodies, so card files stay plain <p>, <ul>, <code>. */
const prose =
  "space-y-3 text-reading [&_code]:rounded-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-small [&_li]:pl-0.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"

function CardReader({ def }: { def: CardDef }) {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const progress = useProgress()
  const [quizDone, setQuizDone] = React.useState(false)
  const entry = lessonById(def.code)
  const place = placeOf(def.code)
  const { prev, next } = siblings(def.code)
  const done = progress.done.includes(def.code)

  React.useEffect(() => markVisited(def.code), [def.code])
  // From the review list: go straight to the quiz.
  React.useEffect(() => {
    if (search.get("quiz")) document.getElementById("quiz")?.scrollIntoView({ block: "start" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishQuiz = React.useCallback(
    (score: number) => {
      setQuizDone(true)
      recordQuiz(cardQuizKey(def.code), score, def.quiz.length)
    },
    [def],
  )

  const figureAfter = def.figure ? (def.figure.after ?? 0) : -1
  const tableAfter = def.table ? (def.table.after ?? def.sections.length - 1) : -1
  const hasTerms = (def.terms.ops?.length ?? 0) + (def.terms.concepts?.length ?? 0) > 0

  return (
    <Page width="narrow" className="mx-auto pb-16">
      <nav aria-label="所在位置" className="flex flex-wrap items-center gap-x-1.5 text-small text-muted-foreground">
        <Link to={`/learn#${def.code}`} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          学习路径
        </Link>
        {place && (
          <>
            <span className="text-faint-foreground">/</span>
            <span>
              {place.track.id} {place.track.title.split("：")[0]}
            </span>
            <span className="text-faint-foreground">/</span>
            <span>{place.module.title}</span>
          </>
        )}
      </nav>

      <header className="mt-5">
        <h1 className="text-title-lg font-semibold">{def.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground">
          <span className="font-mono tabular text-faint-foreground">{def.code}</span>
          <Badge tone="info">图文</Badge>
          <span>约 {def.minutes} 分钟</span>
          {done && <Badge tone="success">已完成</Badge>}
        </div>
        {entry && <p className="mt-3 text-body text-muted-foreground">目标：{entry.goal}</p>}
      </header>

      {def.sections.map((s, i) => (
        <React.Fragment key={s.heading}>
          <section className="mt-8">
            <h2 className="text-heading font-semibold">{s.heading}</h2>
            <div className={cn("mt-2", prose)}>{s.body}</div>
          </section>
          {i === figureAfter && def.figure && (
            <figure className="mt-6 rounded-lg border p-4 max-sm:px-3">
              <def.figure.Figure />
              <figcaption className="mt-3 text-small text-muted-foreground">{def.figure.caption}</figcaption>
            </figure>
          )}
          {i === tableAfter && def.table && <CardTableView table={def.table} />}
        </React.Fragment>
      ))}

      {hasTerms && (
        <section className="mt-8">
          <div className="mb-2 text-small text-faint-foreground">本卡用到（点开看各软件的叫法）</div>
          <div className="flex flex-wrap gap-1.5">
            {def.terms.ops?.map((id) => <OpTerm key={id} id={id} />)}
            {def.terms.concepts?.map((id) => <ConceptTerm key={id} id={id} />)}
          </div>
        </section>
      )}

      <section id="quiz" className="mt-10 scroll-mt-16 border-t pt-8">
        <h2 className="text-title font-semibold">小测</h2>
        <p className="mt-1 text-body text-muted-foreground">答完就能完成这张卡。每题都有解释，答错的题会在复习里再出现。</p>
        <Quiz items={def.quiz} onDone={finishQuiz} />
        {quizDone && (
          <div className="mt-6 rounded-lg border p-4">
            <div className="text-heading font-semibold">要点</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-muted-foreground">
              {def.takeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Related def={def} />

      <section className="mt-8">
        <h2 className="text-heading font-semibold">参考来源</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-small text-muted-foreground">
          {def.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {s.title}
              </a>
              {s.publisher && <span> · {s.publisher}</span>}
              <ExternalLink className="ml-1 inline size-3 align-baseline text-faint-foreground" aria-hidden />
            </li>
          ))}
        </ol>
        <p className="mt-3 text-small text-faint-foreground">命令名取自各软件的官方中文帮助，不同版本的叫法可能略有出入。发现错误欢迎在 GitHub 提 Issue。</p>
      </section>

      <footer className="mt-10 border-t pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            className="max-sm:w-full"
            disabled={!quizDone}
            onClick={() => {
              markDone(def.code)
              navigate(next ? `/card/${next}` : `/learn#${def.code}`)
            }}
          >
            {next ? "完成，下一张" : "完成本卡"}
          </Button>
          {!quizDone && <span className="text-small text-muted-foreground">答完小测后可以完成</span>}
        </div>
        {(prev || next) && (
          <div className="mt-6 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {prev ? <Pager code={prev} dir="prev" /> : <span className="max-sm:hidden" />}
            {next && <Pager code={next} dir="next" />}
          </div>
        )}
      </footer>
    </Page>
  )
}

function CardTableView({ table }: { table: NonNullable<CardDef["table"]> }) {
  return (
    <figure className="mt-6">
      <figcaption className="mb-2 text-small font-medium">{table.caption}</figcaption>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-small">
          <thead className="bg-sunken text-muted-foreground">
            <tr>
              {table.head.map((h) => (
                <th key={h} scope="col" className="min-w-24 px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-t align-top">
                {row.map((cell, ci) => (
                  <td key={ci} className={cn("min-w-24 px-3 py-2", ci === 0 && "font-medium", table.nowrap?.includes(ci) && "whitespace-nowrap")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="mt-2 text-small text-muted-foreground">{table.note}</p>}
    </figure>
  )
}

function Pager({ code, dir }: { code: string; dir: "prev" | "next" }) {
  const entry = lessonById(code)
  return (
    <Link
      to={`/card/${code}`}
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border p-3 transition-colors duration-(--duration-fast) hover:bg-accent",
        dir === "next" && "items-end text-right max-sm:items-start max-sm:text-left",
      )}
    >
      <span className="flex items-center gap-1 text-small text-muted-foreground">
        {dir === "prev" && <ArrowLeft className="size-3.5" />}
        {dir === "prev" ? "上一张" : "下一张"}
        {dir === "next" && <ArrowRight className="size-3.5" />}
      </span>
      <span className="text-body font-medium">
        <span className="mr-1.5 font-mono text-small font-normal text-faint-foreground">{code}</span>
        {entry?.title ?? code}
      </span>
    </Link>
  )
}

function Related({ def }: { def: CardDef }) {
  const models = useModelIndex()
  const items = [
    ...(def.related?.lessons ?? []).flatMap((id) => {
      const l = lessonMeta(id)
      return l ? [{ to: `/lesson/${l.id}`, label: "互动课", title: l.title }] : []
    }),
    ...(def.related?.teardowns ?? []).flatMap((id) => {
      const m = models.find((x) => x.id === id)
      return m ? [{ to: `/teardown/${m.id}`, label: "拆解", title: m.title }] : []
    }),
    ...(def.related?.cards ?? []).flatMap((code) => {
      const l = lessonById(code)
      return l ? [{ to: `/card/${code}`, label: "图文", title: l.title }] : []
    }),
  ]
  if (!items.length) return null
  return (
    <section className="mt-8">
      <h2 className="text-heading font-semibold">接着看</h2>
      <div className="mt-2 flex flex-col gap-1">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-body hover:bg-accent">
            <Badge tone="info" className="w-12 justify-center">
              {it.label}
            </Badge>
            {it.title}
          </Link>
        ))}
      </div>
    </section>
  )
}
