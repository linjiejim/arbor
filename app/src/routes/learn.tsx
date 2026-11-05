import * as React from "react"
import { Link, useLocation } from "react-router"
import { Box, CircleCheck, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Tooltip } from "@/components/ui/tooltip"
import { useProgress } from "@/lib/progress"
import { availableFor, PERSONAS, PROJECTS, TRACKS, type Lesson } from "@/content/curriculum"
import { reviewDue, useContinue } from "@/lib/progress"
import { LESSONS } from "@/content/lessons"

export function LearnPage() {
  const progress = useProgress()
  const next = useContinue()
  const { hash } = useLocation()
  React.useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    el?.scrollIntoView({ block: "center" })
  }, [hash])

  const total = TRACKS.reduce((n, t) => n + t.modules.reduce((m, mod) => m + mod.lessons.length, 0), 0)
  const done = progress.done.filter((id) => /^\d/.test(id)).length

  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        title="学习路径"
        info="一条公共地基加五条主轨。每节课一个概念、一个可以亲手试的 3D 场景，学完有小测。课程大纲依据各厂商官方课程、认证考纲和 DFM 设计指南整理。"
        actions={
          <Button asChild variant="primary">
            <Link to={next.to}>{next.label}</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-muted-foreground">
        <span>
          已完成 <span className="font-medium tabular text-foreground">{done}</span> / <span className="tabular">{total}</span> 节
        </span>
        <span className="flex items-center gap-1.5">
          <Box className="size-3.5" />
          标 3D 的课，交互是必需的：自由度、特征依赖、剖视这类概念看视频学不会
        </span>
      </div>

      <ReviewList due={reviewDue(progress)} />

      <Section title="按你的背景选入口" className="mt-8">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {PERSONAS.map((p) => (
            <div key={p.name} className="rounded-lg border p-3">
              <div className="text-body font-medium">{p.name}</div>
              <div className="mt-1 text-small text-muted-foreground">{p.path}</div>
            </div>
          ))}
        </div>
      </Section>

      {TRACKS.map((t) => (
        <Section
          key={t.id}
          title={
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-small text-faint-foreground">{t.id}</span>
              {t.title}
            </span>
          }
          actions={<span className="text-small text-faint-foreground max-sm:hidden">{t.note}</span>}
        >
          <div className="overflow-hidden rounded-lg border">
            {t.modules.map((m, mi) => (
              <div key={m.id} className={cn(mi > 0 && "border-t")}>
                <div className="flex items-baseline gap-2 bg-sunken px-3 py-2">
                  <span className="font-mono text-caption text-faint-foreground">{m.id}</span>
                  <span className="text-small font-medium">{m.title}</span>
                  {m.note && <span className="truncate text-caption text-faint-foreground">{m.note}</span>}
                </div>
                {m.lessons.map((l) => (
                  <LessonRow key={l.id} lesson={l} done={progress.done.includes(l.id)} current={progress.last === l.id} />
                ))}
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section title="贯穿项目">
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          {PROJECTS.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-caption text-faint-foreground">{p.id}</span>
                <span className="text-body font-medium">{p.title}</span>
              </div>
              <div className="mt-1 text-caption text-muted-foreground">先修：{p.prereq}</div>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  )
}

function LessonRow({ lesson: l, done, current }: { lesson: Lesson; done: boolean; current: boolean }) {
  const avail = availableFor(l.id)
  const body = (
    <>
      {done ? <CircleCheck className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-input" />}
      <span className="w-10 shrink-0 font-mono text-caption tabular text-faint-foreground">{l.id}</span>
      <span className="min-w-0 shrink-0 text-body">{l.title}</span>
      <span className="min-w-0 flex-1 truncate text-small text-muted-foreground max-md:hidden">{l.goal}</span>
      {l.interactive === 2 && (
        <Tooltip content={l.interactiveNote ? `3D 交互：${l.interactiveNote}` : "3D 交互是这节课的核心"}>
          <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
            <Box className="size-3.5" />
            3D
          </span>
        </Tooltip>
      )}
      <span className="w-16 shrink-0 text-right">
        {avail ? (
          <Badge tone="info">{avail.label}</Badge>
        ) : (
          <span className="text-caption text-faint-foreground">规划中</span>
        )}
      </span>
    </>
  )
  const cls = cn("flex h-10 items-center gap-3 border-t px-3", current && "bg-selected")
  return avail ? (
    <Link id={l.id} to={avail.to} className={cn(cls, "transition-colors duration-(--duration-fast) hover:bg-accent")}>
      {body}
    </Link>
  ) : (
    <div id={l.id} className={cls}>
      {body}
    </div>
  )
}

function ReviewList({ due }: { due: { lessonId: string; reason: string }[] }) {
  const items = due.map((d) => ({ ...d, lesson: LESSONS.find((l) => l.id === d.lessonId) })).filter((d) => d.lesson)
  if (!items.length) return null
  return (
    <Section title="该复习了" className="mt-8">
      <div className="overflow-hidden rounded-lg border">
        {items.map((d) => (
          <Link key={d.lessonId} to={`/lesson/${d.lessonId}?quiz=1`} className="flex h-10 items-center gap-3 border-t px-3 first:border-t-0 hover:bg-accent">
            <span className="text-body">{d.lesson!.title}</span>
            <span className="text-small text-muted-foreground">{d.reason}</span>
            <span className="ml-auto text-small font-medium">重做小测</span>
          </Link>
        ))}
      </div>
    </Section>
  )
}
