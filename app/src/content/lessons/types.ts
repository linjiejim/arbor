import type * as React from "react"
import type { QuizItem } from "@/components/lesson-ui"
import type { OpId } from "@/content/ops"
import type { Viewer } from "@/three/viewer"

/**
 * A lesson is data plus a scene controller.
 *
 * - The controller owns the 3D scene and the lesson state. `enter(step)`
 *   brings the scene to that step's starting point (so learners can jump
 *   around) and sets the key viewpoint; actions mutate state and emit it.
 * - Steps hold the words, the task (judged from state), and optional
 *   controls rendered in the side panel.
 *
 * Learning-science defaults baked in: one idea per step, a key view per
 * step, the task inside the 3D, predict-then-reveal where useful, a short
 * quiz with explanatory feedback at the end.
 */
export interface LessonController<S> {
  state: S
  enter(step: number): void
  dispose(): void
}

export type StepCtx<S, C> = { s: S; c: C }

export type StepDef<S, C> = {
  title: string
  body: React.ReactNode
  task?: { label: React.ReactNode; done: (s: S) => boolean }
  extra?: (ctx: StepCtx<S, C>) => React.ReactNode
  note?: React.ReactNode
  noteTitle?: string
  terms?: OpId[]
}

export type LessonDef<S = unknown, C extends LessonController<S> = LessonController<S>> = {
  id: string
  /** Curriculum lesson ids this lesson covers. */
  codes: string[]
  title: string
  create: (v: Viewer, emit: (s: S) => void) => C
  steps: StepDef<S, C>[]
  quiz: QuizItem[]
  takeaways: string[]
  next?: { to: string; label: string; text: string }
  /** Floating overlay in the viewport (mode chips, mini feature tree…). */
  overlay?: (ctx: StepCtx<S, C>) => React.ReactNode
  /** Hide the viewer's corner triad (for lessons that draw their own axes frame). */
  triad?: false
}

export type LessonMeta = {
  id: string
  codes: string[]
  title: string
  track: "T0" | "T1" | "T2" | "T3" | "T4" | "T5"
  minutes: number
  gist: string
  load: () => Promise<{ default: LessonDef<any, any> }> // eslint-disable-line @typescript-eslint/no-explicit-any
}
