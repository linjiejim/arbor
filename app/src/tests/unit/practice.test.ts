// 练习（docs/specs/2026-11-08-turnery-rename-surfaces.md §5）：每道题的参考答案用真内核建出来，
// 要求全部通过；起始状态至少一项不通过；题目只用网页助教能写的特征和核对项。
import { beforeAll, describe, expect, it } from "vitest"
import type { z } from "zod"
import { PRACTICE } from "@/content/practice"
import { LESSONS } from "@/content/lessons/index"
import { EMPTY_TREE, Tree, type Feature } from "@/studio/dsl"
import { Kernel } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { DESKTOP_OPS, STUDIO_TOOLS } from "@/studio/tools"

const FIRST_BATCH = ["sketch-to-solid", "revolve", "pattern-mirror", "fillet-chamfer", "fillet-shell-order", "sweep-loft", "datum-planes", "print-overhang"]

/** Parses as the site's assistant would write it; zod drops keys it doesn't know, so anything dropped is desktop-only. */
function expectWeb(schema: unknown, value: unknown, what: string) {
  const r = (schema as z.ZodType).safeParse(value)
  expect(r.success, `${what}: ${r.success ? "" : r.error.message}`).toBe(true)
  expect(r.data, `${what}: 有网页助教写不了的字段`).toEqual(value)
}

function expectWebTree(tree: Tree, what: string) {
  expect(Tree.safeParse(tree).success, what).toBe(true)
  expect(tree.uses, `${what}: uses 只有桌面版有`).toBeUndefined()
  expect(tree.checks, `${what}: 要求放在练习的 checks 里，不放进树`).toBeUndefined()
  for (const f of tree.features) {
    const { op, ...input } = f as Feature & Record<string, unknown>
    expect(DESKTOP_OPS.has(op), `${what} / ${f.id}: ${op} 只有桌面版有`).toBe(false)
    expectWeb(STUDIO_TOOLS[op as keyof typeof STUDIO_TOOLS].inputSchema, input, `${what} / ${f.id}`)
  }
}

describe("practice data", () => {
  it("is the first batch: one exercise for each of the eight lessons", () => {
    expect(PRACTICE.map((p) => p.lesson)).toEqual(FIRST_BATCH)
    expect(new Set(PRACTICE.map((p) => p.id)).size).toBe(PRACTICE.length)
    const lessons = new Set(LESSONS.map((l) => l.id))
    for (const p of PRACTICE) {
      expect(lessons.has(p.lesson), p.id).toBe(true)
      expect(p.id).toMatch(new RegExp(`^${p.lesson}-\\d+$`))
    }
  })

  it.each(PRACTICE.map((p) => [p.id, p] as const))("%s: copy, check ids and tips follow the rules", (_, p) => {
    expect(p.title.length).toBeGreaterThan(0)
    expect(p.task.length).toBeGreaterThan(0)
    expect(p.checks.length).toBeGreaterThanOrEqual(2)
    expect(p.checks.length).toBeLessThanOrEqual(4)
    expect(new Set(p.checks.map((c) => c.id)).size).toBe(p.checks.length)
    for (const c of p.checks) {
      expect(c.id).toMatch(/^p-/)
      expect(c.said.length).toBeGreaterThan(0)
    }
    expect(p.tips.length).toBeGreaterThanOrEqual(2)
    expect(p.tips.length).toBeLessThanOrEqual(3)
    for (const tip of p.tips) expect([...tip].length, tip).toBeLessThanOrEqual(40)
    for (const text of [p.title, p.task, ...p.tips, ...p.checks.map((c) => c.said)]) expect(text).not.toMatch(/[!！]/)
  })

  it.each(PRACTICE.map((p) => [p.id, p] as const))("%s: trees and checks are what the site's assistant can write", (_, p) => {
    expectWebTree(p.solution, `${p.id} solution`)
    if (p.start) expectWebTree(p.start, `${p.id} start`)
    expectWeb(STUDIO_TOOLS.check.inputSchema, { items: p.checks }, `${p.id} checks`)
  })

  it.each(PRACTICE.map((p) => [p.id, p] as const))("%s: the reference answer is a clean tree", (_, p) => {
    const { params, paramNotes = {}, features } = p.solution
    for (const name of Object.keys(params)) expect(paramNotes[name], `${p.id}: 参数 ${name} 没有说明`).toBeTruthy()
    for (const f of features) {
      expect(f.name, `${p.id} / ${f.id}: 没有中文名`).toBeTruthy()
      expect(f.intent, `${p.id} / ${f.id}: 没有设计意图`).toBeTruthy()
    }
  })
})

describe("practice grading on the real kernel", () => {
  let k: Kernel
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)

  it.each(PRACTICE.map((p) => [p.id, p] as const))(
    "%s: the reference answer builds and passes every requirement",
    (_, p) => {
      const r = k.rebuild({ ...p.solution, checks: p.checks })
      expect(
        r.features.filter((f) => f.state !== "ok").map((f) => `${f.id}: ${f.state} ${f.message ?? ""}`),
        "every feature builds",
      ).toEqual([])
      expect(r.body?.solids).toBe(1)
      expect(r.checks?.map((c) => c.id)).toEqual(p.checks.map((c) => c.id))
      for (const c of r.checks!) expect(c.pass, `${c.id}「${c.said}」 要 ${c.expected}，量出 ${c.actual}`).toBe(true)
    },
    30_000,
  )

  it.each(PRACTICE.map((p) => [p.id, p] as const))(
    "%s: the starting point does not pass yet",
    (_, p) => {
      const r = k.rebuild({ ...(p.start ?? EMPTY_TREE), checks: p.checks })
      if (p.start) expect(r.features.filter((f) => f.state !== "ok").map((f) => `${f.id}: ${f.message ?? f.state}`), "the start builds").toEqual([])
      // An empty start has no body, so nothing is measured: none passes.
      const passed = (r.checks ?? []).filter((c) => c.pass)
      expect(passed.length).toBeLessThan(p.checks.length)
    },
    30_000,
  )
})
