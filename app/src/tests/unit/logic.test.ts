import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { clipRange, frameCamera } from "@/three/framing"
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

// The pictures an agent gets from `look` come from one shared camera. Its far plane used to be fixed
// at 5000 mm while the camera backs off about 5 radii, so anything with a bounding radius over
// roughly 980 mm came out as an empty picture.
describe("frameCamera", () => {
  const camera = () => {
    const c = new THREE.PerspectiveCamera(26, 448 / 336, 0.5, 5000)
    c.up.set(0, 0, 1)
    return c
  }
  const corners = (b: THREE.Box3) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z))
  const frustum = (c: THREE.PerspectiveCamera) => {
    c.updateMatrixWorld(true)
    return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse))
  }
  // An exploded 1.6 m machine: 605 × 770.5 × 2435 mm, bounding radius about 1310 mm.
  const big = new THREE.Box3(new THREE.Vector3(-302.5, -570, 0), new THREE.Vector3(302.5, 200.5, 2435))

  it.each([
    ["iso", [1, -1.1, 0.85]],
    ["front", [0, -1, 0]],
    ["right", [1, 0, 0]],
  ] as const)("keeps a large model inside the clipping planes (%s)", (_name, dir) => {
    const c = camera()
    const dist = frameCamera(c, big, new THREE.Vector3(...dir), 1.15)
    expect(dist).toBeGreaterThan(5000)
    const f = frustum(c)
    for (const p of corners(big)) expect(f.containsPoint(p)).toBe(true)
  })

  it("keeps the planes tight around a small part", () => {
    const c = camera()
    const small = new THREE.Box3(new THREE.Vector3(-10, -10, 0), new THREE.Vector3(10, 10, 20))
    const dist = frameCamera(c, small, new THREE.Vector3(1, -1.1, 0.85), 1.15)
    const r = small.getBoundingSphere(new THREE.Sphere()).radius
    expect(c.near).toBeGreaterThan(dist - 1.1 * r)
    expect(c.far).toBeLessThan(dist + 1.1 * r + 1)
    const f = frustum(c)
    for (const p of corners(small)) expect(f.containsPoint(p)).toBe(true)
  })

  it("in a close-up of one part, still reaches the far side of the whole model", () => {
    const c = camera()
    const part = new THREE.Box3(new THREE.Vector3(-40, -40, 400), new THREE.Vector3(40, 40, 535))
    frameCamera(c, part, new THREE.Vector3(1, -1.1, 0.85), 1.15, big)
    const view = c.getWorldDirection(new THREE.Vector3())
    const depths = corners(big).map((p) => p.clone().sub(c.position).dot(view))
    expect(c.far).toBeGreaterThan(Math.max(...depths))
    // The camera sits inside the model's bounds here: the near plane stays close to it.
    expect(c.near).toBeLessThan(1)
  })
})

describe("clipRange", () => {
  it("never lets the depth range grow past what the buffer resolves", () => {
    for (const [dist, radius] of [[100, 20], [300, 1300], [6700, 1310], [40000, 39000], [1000, 30000]]) {
      const [near, far] = clipRange(dist, radius)
      expect(near).toBeGreaterThanOrEqual(0.5)
      expect(far).toBeGreaterThan(dist + radius)
      expect(far / near).toBeLessThanOrEqual(10000 * (1 + 1e-9))
    }
  })

  it("pushes the near plane out when the camera is deep inside a very large model", () => {
    const [near, far] = clipRange(1000, 30000)
    expect(near).toBeGreaterThan(0.5)
    expect(near).toBeCloseTo(far / 10000, 6)
  })
})
