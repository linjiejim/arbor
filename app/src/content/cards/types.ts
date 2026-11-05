import type * as React from "react"
import type { QuizItem } from "@/components/lesson-ui"
import type { OpId } from "@/content/ops"

/**
 * A 图文卡 (reading card): a curriculum entry that doesn't need 3D, taught in
 * a few short sections, one figure or table, and a 2–3 question quiz.
 *
 * Text is plain Chinese and short (3–5 minutes to read). Every fact that a
 * learner could check comes with a source; engineering conventions follow
 * GB. Command names are each package's official Chinese UI names.
 */
export type CardSection = {
  heading: string
  /** A few sentences: <p>, short lists. */
  body: React.ReactNode
}

export type CardFigure = {
  /** A small SVG drawn with theme classes only (stroke-current, text-*). */
  Figure: React.ComponentType
  caption: string
  /** Shown after this section (0-based). Defaults to the first section. */
  after?: number
}

export type CardTable = {
  caption: string
  head: string[]
  rows: React.ReactNode[][]
  /** Shown after this section (0-based). Defaults to the last section. */
  after?: number
  /** Columns that must not wrap (standard numbers, part numbers). */
  nowrap?: number[]
  note?: React.ReactNode
}

export type CardSource = { title: string; url: string; publisher?: string }

export type CardDef = {
  /** Curriculum id, same as the file name ("0.3.2"). */
  code: string
  title: string
  minutes: number
  sections: CardSection[]
  figure?: CardFigure
  table?: CardTable
  /** Glossary links: commands (ops.ts, shown with every package's name) and concepts (terms.ts). */
  terms: { ops?: OpId[]; concepts?: string[] }
  quiz: QuizItem[]
  takeaways: string[]
  sources: CardSource[]
  /** Where to go next: interactive lessons (lesson id), teardowns (model id), other cards (code). */
  related?: { lessons?: string[]; teardowns?: string[]; cards?: string[] }
}

export type CardMeta = {
  code: string
  load: () => Promise<{ default: CardDef }>
}
