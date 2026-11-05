/**
 * Content guards for 图文卡: every card is reachable, sourced, and has a
 * proper quiz. Run with the rest of `npm run check`.
 */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { CARDS } from "@/content/cards"
import type { CardDef } from "@/content/cards/types"
import { ALL_LESSONS, availableFor, TEARDOWN_CODES } from "@/content/curriculum"
import { LESSONS } from "@/content/lessons"
import { OPS } from "@/content/ops"
import { TERMS } from "@/content/terms"

const dir = path.join(process.cwd(), "src/content/cards")
const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d+\.\d+\.\d+\.tsx$/.test(f))
  .map((f) => f.replace(/\.tsx$/, ""))
const models = Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/models/index.json"), "utf8")))
const order = ALL_LESSONS.map((l) => l.id)

const defs: CardDef[] = await Promise.all(CARDS.map(async (c) => (await c.load()).default))

describe("图文卡 registry", () => {
  it("registers every card file once, in curriculum order", () => {
    const codes = CARDS.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect([...codes].sort()).toEqual([...files].sort())
    const idx = codes.map((c) => order.indexOf(c))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it("only uses codes that exist in curriculum.json", () => {
    for (const c of CARDS) expect(order, c.code).toContain(c.code)
  })

  it("prefers an interactive lesson, then a teardown, then a card", () => {
    for (const code of order) {
      const kind = LESSONS.some((l) => l.codes.includes(code))
        ? "lesson"
        : TEARDOWN_CODES[code]
          ? "teardown"
          : CARDS.some((c) => c.code === code)
            ? "card"
            : undefined
      expect(availableFor(code)?.kind, code).toBe(kind)
    }
    for (const c of CARDS) {
      const a = availableFor(c.code)
      if (a?.kind === "card") expect(a).toEqual({ to: `/card/${c.code}`, label: "图文", kind: "card" })
    }
  })
})

describe.each(defs.map((d) => [d.code, d] as const))("图文卡 %s", (code, def) => {
  it("matches its file and registry entry", () => {
    expect(def.code).toBe(code)
    expect(def.title.trim()).not.toBe("")
    expect(def.minutes).toBeGreaterThanOrEqual(2)
    expect(def.minutes).toBeLessThanOrEqual(6)
  })

  it("has 2–4 sections, each with a heading", () => {
    expect(def.sections.length).toBeGreaterThanOrEqual(2)
    expect(def.sections.length).toBeLessThanOrEqual(4)
    for (const s of def.sections) expect(s.heading.trim()).not.toBe("")
    if (def.figure?.after != null) expect(def.figure.after).toBeLessThan(def.sections.length)
    if (def.table?.after != null) expect(def.table.after).toBeLessThan(def.sections.length)
  })

  it("cites at least one source with an http(s) URL", () => {
    expect(def.sources.length).toBeGreaterThanOrEqual(1)
    for (const s of def.sources) {
      expect(s.title.trim(), s.url).not.toBe("")
      expect(s.url).toMatch(/^https?:\/\//)
      expect(() => new URL(s.url)).not.toThrow()
    }
    expect(new Set(def.sources.map((s) => s.url)).size).toBe(def.sources.length)
  })

  it("has a quiz of 2–3 items, each with an explanation", () => {
    expect(def.quiz.length).toBeGreaterThanOrEqual(2)
    expect(def.quiz.length).toBeLessThanOrEqual(3)
    for (const q of def.quiz) {
      expect(q.explain.trim(), q.q).not.toBe("")
      expect(q.options.length, q.q).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size, q.q).toBe(q.options.length)
      expect(q.answer, q.q).toBeGreaterThanOrEqual(0)
      expect(q.answer, q.q).toBeLessThan(q.options.length)
    }
    expect(new Set(def.quiz.map((q) => q.q)).size).toBe(def.quiz.length)
  })

  it("has takeaways", () => {
    expect(def.takeaways.length).toBeGreaterThanOrEqual(1)
  })

  it("links only to glossary entries, lessons, teardowns and cards that exist", () => {
    for (const id of def.terms.ops ?? []) expect(OPS.map((o) => o.id)).toContain(id)
    for (const id of def.terms.concepts ?? []) expect(TERMS.map((t) => t.id)).toContain(id)
    for (const id of def.related?.lessons ?? []) expect(LESSONS.map((l) => l.id)).toContain(id)
    for (const id of def.related?.teardowns ?? []) expect(models).toContain(id)
    for (const c of def.related?.cards ?? []) {
      expect(CARDS.map((x) => x.code)).toContain(c)
      expect(c).not.toBe(code)
    }
  })
})
