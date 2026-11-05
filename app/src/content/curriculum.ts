import data from "./curriculum.json"
import { LESSONS } from "./lessons"
import { CARDS } from "./cards"

/**
 * The curriculum (tracks → modules → lessons), drafted from the research
 * notes. `available` marks what the prototype can already open.
 */
export type Lesson = {
  id: string
  title: string
  en: string | null
  goal: string
  prereq: string
  /** 2 = 3D interaction is essential, 1 = helps, 0 = mostly text/2D. */
  interactive: number
  interactiveNote: string | null
}
export type Module = { id: string; title: string; note: string; lessons: Lesson[] }
export type Track = { id: string; title: string; note: string; modules: Module[] }
export type Project = { id: string; title: string; prereq: string; interactive: number }
export type Persona = { name: string; path: string }

export const TRACKS = data.tracks as Track[]
export const PROJECTS = data.projects as Project[]
export const PERSONAS = data.personas as Persona[]

/** Curriculum ids taught by a teardown (model id). Lessons register their own ids. */
export const TEARDOWN_CODES: Record<string, string> = {
  "1.2.2": "mug",
  "1.2.5": "brick",
  "1.3.4": "box_fillet_first",
  "4.4.5": "enclosure_bottom",
  "2.1.1": "enclosure",
  "2.1.3": "hinge_box",
}

export type Availability = { to: string; label: string; kind: "lesson" | "teardown" | "card" }

/**
 * Where a curriculum lesson can be opened today, if anywhere: an interactive
 * lesson first, then a teardown, then a 图文卡.
 */
export function availableFor(code: string): Availability | null {
  const lesson = LESSONS.find((l) => l.codes.includes(code))
  if (lesson) return { to: `/lesson/${lesson.id}`, label: "互动课", kind: "lesson" }
  const model = TEARDOWN_CODES[code]
  if (model) return { to: `/teardown/${model}`, label: "拆解", kind: "teardown" }
  if (CARDS.some((c) => c.code === code)) return { to: `/card/${code}`, label: "图文", kind: "card" }
  return null
}

export const ALL_LESSONS = TRACKS.flatMap((t) => t.modules.flatMap((m) => m.lessons))
export const lessonById = (id: string) => ALL_LESSONS.find((l) => l.id === id)

/** The track and module a curriculum lesson sits in. */
export function placeOf(code: string): { track: Track; module: Module } | undefined {
  for (const track of TRACKS) for (const mod of track.modules) if (mod.lessons.some((l) => l.id === code)) return { track, module: mod }
  return undefined
}
