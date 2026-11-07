import { useSyncExternalStore } from "react"
import { lessonForCode } from "@/content/lessons"
import { CARDS } from "@/content/cards"
import { ALL_LESSONS } from "@/content/curriculum"

/**
 * Learning progress, kept locally (no account in the prototype).
 * Lessons and 图文卡 are marked done by curriculum id ("1.1.3"); teardowns by
 * model id. Quiz records are keyed by lesson id, or `card:<code>` for cards.
 */
type QuizRecord = { score: number; total: number; at: number }
type Progress = { done: string[]; last?: string; quiz?: Record<string, QuizRecord[]> }

const KEY = "arbor:progress"
/** Before the site was called Arbor: read once, moved to KEY, then removed. */
const OLD_KEY = "featuretree:progress"
const listeners = new Set<() => void>()
let cache: Progress | null = null

function read(): Progress {
  if (cache) return cache
  try {
    const old = localStorage.getItem(KEY) === null ? localStorage.getItem(OLD_KEY) : null
    if (old !== null) {
      localStorage.setItem(KEY, old)
      localStorage.removeItem(OLD_KEY)
    }
    cache = JSON.parse(localStorage.getItem(KEY) ?? "") as Progress
  } catch {
    cache = { done: [] }
  }
  if (!Array.isArray(cache.done)) cache = { done: [] }
  return cache
}

function write(p: Progress) {
  cache = p
  localStorage.setItem(KEY, JSON.stringify(p))
  listeners.forEach((l) => l())
}

export function markDone(id: string) {
  const p = read()
  if (!p.done.includes(id)) write({ ...p, done: [...p.done, id], last: id })
}

export function markVisited(id: string) {
  const p = read()
  if (p.last !== id) write({ ...p, last: id })
}

export function useProgress() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    read,
  )
}

/** Quiz results drive the review list (spaced repetition: 1 day, 1 week, 3 weeks). */
export function recordQuiz(lessonId: string, score: number, total: number) {
  const p = read()
  const quiz = { ...(p.quiz ?? {}) }
  quiz[lessonId] = [...(quiz[lessonId] ?? []), { score, total, at: Date.now() }]
  write({ ...p, quiz })
}

/** Quiz-record key of a 图文卡. */
export const cardQuizKey = (code: string) => `card:${code}`

/**
 * The learning path in curriculum order: interactive lessons and 图文卡.
 * A lesson that covers several codes appears once, at its first code.
 * Teardowns are references, not steps, so they stay out.
 */
const PATH: { to: string; codes: string[] }[] = (() => {
  const out: { to: string; codes: string[] }[] = []
  const seen = new Set<string>()
  for (const { id } of ALL_LESSONS) {
    const lesson = lessonForCode(id)
    const step = lesson
      ? { to: `/lesson/${lesson.id}`, codes: lesson.codes }
      : CARDS.some((c) => c.code === id)
        ? { to: `/card/${id}`, codes: [id] }
        : null
    if (step && !seen.has(step.to)) {
      seen.add(step.to)
      out.push(step)
    }
  }
  return out
})()

/** The next step to open: the first lesson or card in curriculum order not yet finished. */
export function useContinue(): { to: string; label: string } {
  const p = useProgress()
  const started = p.done.length > 0
  const next = PATH.find((step) => !step.codes.every((c) => p.done.includes(c)))
  if (!next) return { to: "/learn", label: "复习" }
  return { to: next.to, label: started ? "继续学习" : "开始第一课" }
}

const DAY = 24 * 3600 * 1000
/** Review after 1 day, 1 week, 3 weeks; a quiz with mistakes comes back the next day. */
const INTERVALS = [1, 7, 21]

export type ReviewItem = { lessonId: string; dueAt: number; reason: string }

export function reviewDue(p: Progress, now = Date.now()): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const [lessonId, records] of Object.entries(p.quiz ?? {})) {
    const last = records[records.length - 1]
    if (!last) continue
    const perfectRuns = records.filter((r) => r.score === r.total).length
    if (perfectRuns >= INTERVALS.length && last.score === last.total) continue
    const days = last.score < last.total ? 1 : INTERVALS[Math.min(perfectRuns - 1, INTERVALS.length - 1)]
    const dueAt = last.at + days * DAY
    if (dueAt <= now) out.push({ lessonId, dueAt, reason: last.score < last.total ? "上次有题答错" : `距上次 ${days} 天` })
  }
  return out.sort((a, b) => a.dueAt - b.dueAt)
}
