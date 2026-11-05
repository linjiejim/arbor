import { describe, expect, it } from "vitest"
import { filletCorner, intersect, offsetLine, type V2 } from "@/three/geom"
import { variantKey, type BakedParam } from "@/three/baked"
import { reviewDue } from "@/lib/progress"

const param = (id: string, values: number[]): BakedParam => ({ id, label: id, unit: "mm", default: values[0], values, feature: "" })

describe("variantKey", () => {
  it("matches the baker's key: params sorted by id, values in %g form", () => {
    const grid = [param("t", [2.5, 3.5]), param("rb", [2, 9])]
    expect(variantKey(grid, { t: 3.5, rb: 9 })).toBe("rb-9_t-3.5")
    expect(variantKey(grid, { t: 7, rb: 13 })).toBe("rb-13_t-7")
  })
  it("is 'default' with no sandbox params", () => {
    expect(variantKey([], {})).toBe("default")
  })
})

describe("filletCorner", () => {
  it("rounds a right angle with tangent points at distance r", () => {
    const f = filletCorner([0, 10], [0, 0], [10, 0], 3)
    const first = f.pts[0]
    const last = f.pts[f.pts.length - 1]
    expect(first[0]).toBeCloseTo(0)
    expect(first[1]).toBeCloseTo(3)
    expect(last[0]).toBeCloseTo(3)
    expect(last[1]).toBeCloseTo(0)
    expect(f.center[0]).toBeCloseTo(3)
    expect(f.center[1]).toBeCloseTo(3)
    expect(f.clamped).toBe(false)
  })
  it("shrinks the radius when the legs are too short, and says so", () => {
    const f = filletCorner([0, 2], [0, 0], [2, 0], 5)
    expect(f.clamped).toBe(true)
    expect(f.r).toBeLessThan(2)
  })
})

describe("offsetLine / intersect", () => {
  it("offsets to the left of the direction", () => {
    const [a, b] = offsetLine([0, 0], [10, 0], 2)
    expect(a[1]).toBeCloseTo(2)
    expect(b[1]).toBeCloseTo(2)
  })
  it("intersects two lines", () => {
    const p: V2 = intersect([0, 0], [10, 10], [0, 10], [10, 0])
    expect(p[0]).toBeCloseTo(5)
    expect(p[1]).toBeCloseTo(5)
  })
})

describe("reviewDue", () => {
  const DAY = 24 * 3600 * 1000
  const now = 100 * DAY
  it("brings a quiz with mistakes back after a day", () => {
    const due = reviewDue({ done: [], quiz: { a: [{ score: 2, total: 3, at: now - 1.5 * DAY }] } }, now)
    expect(due.map((d) => d.lessonId)).toEqual(["a"])
  })
  it("spaces perfect quizzes out to 1, 7, then 21 days", () => {
    const one = reviewDue({ done: [], quiz: { a: [{ score: 3, total: 3, at: now - 2 * DAY }] } }, now)
    expect(one).toHaveLength(1)
    const twoEarly = reviewDue({ done: [], quiz: { a: [{ score: 3, total: 3, at: 0 }, { score: 3, total: 3, at: now - 3 * DAY }] } }, now)
    expect(twoEarly).toHaveLength(0)
  })
  it("stops after three perfect reviews", () => {
    const r = { score: 3, total: 3, at: 0 }
    expect(reviewDue({ done: [], quiz: { a: [r, r, r] } }, now)).toHaveLength(0)
  })
})
