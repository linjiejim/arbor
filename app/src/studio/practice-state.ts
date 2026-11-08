import type { Practice } from "@/content/practice"
import type { CheckResult } from "./kernel/check"

/** Where a finished practice is recorded in the learning progress. */
export const practiceKey = (id: string) => `practice:${id}`

/** Which of a practice's checks pass now (a missing result is not a pass: no body yet). */
export function practiceState(p: Practice, results: CheckResult[] | undefined) {
  const byId = new Map((results ?? []).map((r) => [r.id, r]))
  const rows = p.checks.map((c) => ({ id: c.id, said: c.said, result: byId.get(c.id) }))
  const passed = rows.filter((r) => r.result?.pass).length
  return { rows, passed, done: passed === rows.length }
}
