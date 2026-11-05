import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { ArrowLeft } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { StateView } from "@/components/ui/state"
import { Spinner } from "@/components/ui/spinner"
import { Viewport } from "@/components/viewport"
import { OpTerm } from "@/components/op-term"
import { Note, Quiz, StepBar, TaskCard } from "@/components/lesson-ui"
import { markDone, markVisited, recordQuiz } from "@/lib/progress"
import { LESSONS, lessonMeta } from "@/content/lessons"
import type { LessonController, LessonDef } from "@/content/lessons/types"
import type { Viewer } from "@/three/viewer"

/**
 * Lesson player: text on the left, model on the right (stacked on phones).
 * Each step sets a key view, asks for one small task in the viewport, and
 * the last step is a short quiz with explanatory feedback.
 */
/** Lesson files not yet in the registry still open in dev at /lesson/<file-name>. */
const lessonFiles = import.meta.glob<{ default: LessonDef<any, any> }>(["../content/lessons/*.tsx"]) // eslint-disable-line @typescript-eslint/no-explicit-any

export function LessonPage() {
  const { id } = useParams()
  // Memoised on id: a fresh object every render would re-run the loader effect forever.
  const meta = React.useMemo(() => {
    const registered = lessonMeta(id)
    if (registered) return registered
    const devFile = import.meta.env.DEV ? lessonFiles[`../content/lessons/${id}.tsx`] : undefined
    return devFile ? { id: id!, codes: [], title: id!, track: "T1" as const, minutes: 5, gist: "", load: devFile } : undefined
  }, [id])
  const [def, setDef] = React.useState<LessonDef<any, any> | null>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    setDef(null)
    setError(false)
    meta?.load().then(
      (m) => setDef(m.default),
      () => setError(true),
    )
  }, [meta])
  if (!meta)
    return (
      <div className="grid h-dvh place-items-center">
        <StateView kind="empty" title="没有这节课" action={<Link to="/learn">回到学习路径</Link>} />
      </div>
    )
  if (error)
    return (
      <div className="grid h-dvh place-items-center">
        <StateView kind="error" description="课程没加载出来。" onRetry={() => location.reload()} />
      </div>
    )
  if (!def)
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner label="正在加载课程" />
      </div>
    )
  return <Player key={def.id} def={def} />
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Player({ def }: { def: LessonDef<any, LessonController<any>> }) {
  const navigate = useNavigate()
  const ctrl = React.useRef<LessonController<unknown> | null>(null)
  const [controller, setController] = React.useState<LessonController<unknown> | null>(null)
  const [state, setState] = React.useState<unknown>(null)
  const [search] = useSearchParams()
  const [step, setStep] = React.useState(() => (search.get("quiz") ? def.steps.length : 0))
  const [quizDone, setQuizDone] = React.useState(false)
  const total = def.steps.length + 1
  const isQuiz = step === def.steps.length
  const meta = lessonMeta(def.id) ?? { minutes: 5 }
  const index = LESSONS.findIndex((l) => l.id === def.id)
  const nextLesson = LESSONS[index + 1]

  React.useEffect(() => markVisited(def.codes[0]), [def])

  const onReady = React.useCallback(
    (v: Viewer) => {
      const c = def.create(v, (s) => setState(s))
      ctrl.current = c
      setController(c)
      setState(c.state)
      c.enter(search.get("quiz") ? def.steps.length - 1 : 0)
      return () => {
        c.dispose()
        ctrl.current = null
        setController(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def],
  )

  const go = React.useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(total - 1, i))
      setStep(n)
      ctrl.current?.enter(Math.min(n, def.steps.length - 1))
    },
    [total, def],
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowRight") go(step + 1)
      if (e.key === "ArrowLeft") go(step - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, step])

  const finishQuiz = React.useCallback(
    (score: number) => {
      setQuizDone(true)
      recordQuiz(def.id, score, def.quiz.length)
    },
    [def],
  )

  const s = def.steps[Math.min(step, def.steps.length - 1)]
  const done = !isQuiz && state && s.task ? s.task.done(state) : true
  const ctx = state && controller ? { s: state, c: controller } : null

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label="返回学习路径" onClick={() => navigate("/learn")}>
          <ArrowLeft />
        </IconButton>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-body font-semibold">{def.title}</span>
          <span className="text-small text-faint-foreground max-sm:hidden">
            {def.codes.join(" · ")} · 约 {meta.minutes} 分钟
          </span>
        </div>
        <StepBar titles={[...def.steps.map((x) => x.title), "小测"]} current={step} onJump={go} className="mx-auto max-sm:hidden" />
        <span className="ml-auto pr-2 text-small tabular text-muted-foreground sm:ml-0">
          {step + 1} / {total}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 max-md:flex-col-reverse">
        <aside className="flex w-[400px] shrink-0 flex-col border-r max-md:h-[50dvh] max-md:w-full max-md:border-r-0 max-md:border-t">
          <div key={step} className="min-h-0 flex-1 animate-fade-in overflow-y-auto px-5 py-5">
            <div className="text-small text-muted-foreground">{isQuiz ? "最后" : `第 ${step + 1} 步`}</div>
            <h1 className="mt-1 text-title font-semibold">{isQuiz ? "小测" : s.title}</h1>
            {isQuiz ? (
              <>
                <p className="mt-3 text-reading">答完就完成本课。每题都有解释，答错也有收获。</p>
                <Quiz items={def.quiz} onDone={finishQuiz} />
                {quizDone && (
                  <div className="mt-6 rounded-lg border p-4">
                    <div className="text-heading font-semibold">本课要点</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-muted-foreground">
                      {def.takeaways.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {def.next && (
                      <div className="mt-3 text-small text-muted-foreground">
                        接着看{" "}
                        <Link to={def.next.to} className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                          {def.next.label}
                        </Link>
                        ：{def.next.text}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mt-3 space-y-3 text-reading text-foreground">{s.body}</div>
                {s.task && state != null && <TaskCard done={s.task.done(state)}>{s.task.label}</TaskCard>}
                {ctx && s.extra?.(ctx)}
                {s.note && <Note title={s.noteTitle}>{s.note}</Note>}
                {s.terms && (
                  <div className="mt-6">
                    <div className="mb-2 text-small text-faint-foreground">本步用到</div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.terms.map((t) => (
                        <OpTerm key={t} id={t} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t px-4 py-3">
            <Button variant="secondary" disabled={step === 0} onClick={() => go(step - 1)}>
              上一步
            </Button>
            {isQuiz ? (
              <Button
                variant="primary"
                className="flex-1"
                disabled={!quizDone}
                onClick={() => {
                  for (const c of def.codes) markDone(c)
                  navigate(nextLesson ? `/lesson/${nextLesson.id}` : "/learn")
                }}
              >
                {nextLesson ? "完成，下一课" : "完成本课"}
              </Button>
            ) : (
              <Button variant={done ? "primary" : "secondary"} className="flex-1" onClick={() => go(step + 1)}>
                {done ? "下一步" : "先跳过"}
              </Button>
            )}
          </div>
        </aside>

        <Viewport className="min-h-0 flex-1" onReady={onReady} triad={def.triad !== false}>
          {ctx && def.overlay?.(ctx)}
        </Viewport>
      </div>
    </div>
  )
}
