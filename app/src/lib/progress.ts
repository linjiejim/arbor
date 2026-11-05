import { useSyncExternalStore } from "react"
import { LESSONS } from "@/content/lessons"

/**
 * Learning progress, kept locally (no account in the prototype).
 * Lessons are keyed by curriculum id ("1.1.3"); teardowns by model id.
 */
type QuizRecord = { score: number; total: number; at: number }
type Progress = { done: string[]; last?: string; quiz?: Record<string, QuizRecord[]> }

const KEY = "featuretree:progress"
const listeners = new Set<() => void>()
let cache: Progress | null = null

function read(): Progress {
  if (cache) return cache
  try {
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

/** The next lesson to open: the first one in curriculum order not yet finished. */
export function useContinue(): { to: string; label: string } {
  const p = useProgress()
  const started = p.done.length > 0
  const next = LESSONS.find((l) => !l.codes.every((c) => p.done.includes(c)))
  if (!next) return { to: "/learn", label: "复习" }
  return { to: `/lesson/${next.id}`, label: started ? "继续学习" : "开始第一课" }
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
