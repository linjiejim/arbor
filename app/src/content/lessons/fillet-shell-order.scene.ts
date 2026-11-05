import * as THREE from "three"
import { paint, tag } from "@/three/build"
import { displayStep, loadGlb, loadManifest, stepsOf, variantKey, type FaceInfo, type PartManifest } from "@/three/baked"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 1.3.4 「圆角与抽壳的先后」: the same box built two ways, side by side,
 * from the baked build123d models box_fillet_first (A) and box_shell_first
 * (B). Geometry, face tags and failures are the real kernel's.
 */
export type OrderState = {
  step: number
  ready: boolean
  error: string | null
  r: number
  t: number
  /** Feature tree position shown for A and B (index into their features). */
  ua: number
  ub: number
  section: boolean
  failA: string | null
  failB: string | null
  steppedA: boolean
  steppedB: boolean
  cutSeen: boolean
  triedFail: boolean
}

const IDS = ["box_fillet_first", "box_shell_first"] as const
const GAP = 46

export class FilletShellOrderScene extends LessonScene<OrderState> {
  private manifests: PartManifest[] = []
  private steps: THREE.Object3D[][] = [[], []]
  private groups = [new THREE.Group(), new THREE.Group()]
  private token = 0

  constructor(v: Viewer, emit: (s: OrderState) => void) {
    super(v, emit, {
      step: 0,
      ready: false,
      error: null,
      r: 4,
      t: 2.5,
      ua: 3,
      ub: 3,
      section: false,
      failA: null,
      failB: null,
      steppedA: false,
      steppedB: false,
      cutSeen: false,
      triedFail: false,
    })
    v.setGrid(120, 10)
    this.groups[0].position.x = -GAP
    this.groups[1].position.x = GAP
    this.root.add(...this.groups)
    Promise.all(IDS.map((id) => loadManifest(id) as Promise<PartManifest>)).then(
      (ms) => {
        this.manifests = ms
        this.load()
      },
      (e) => this.set({ error: String(e) }),
    )
  }

  enter(step: number) {
    const patch: Partial<OrderState> = { step }
    if (step === 0) Object.assign(patch, { ua: 3, ub: 3, section: false })
    if (step === 1) Object.assign(patch, { ua: 2, ub: 3, section: false })
    if (step === 2) Object.assign(patch, { ua: 3, ub: 2, section: false })
    if (step === 3) Object.assign(patch, { ua: 3, ub: 3, section: true })
    if (step === 4) Object.assign(patch, { ua: 3, ub: 3, section: true })
    this.set(patch)
    this.applySection()
    const both = new THREE.Box3(new THREE.Vector3(-GAP - 32, -22, 0), new THREE.Vector3(GAP + 32, 22, 30))
    if (step === 3 || step === 4) this.v.fit(both, { view: "top", padding: 0.8 })
    else this.v.fit(both, { dir: new THREE.Vector3(0.35, -1, 0.8), padding: 1.1 })
  }

  /** Walk one of the two feature trees to a position. */
  stepTo(which: 0 | 1, i: number) {
    const n = Math.max(1, Math.min(3, i))
    this.set(which === 0 ? { ua: n, steppedA: true } : { ub: n, steppedB: true })
  }

  setSection(on: boolean) {
    this.set({ section: on, cutSeen: this.state.cutSeen || on })
    this.applySection()
  }

  setParams(r: number, t: number) {
    this.set({ r, t })
    this.load()
  }

  /** Wall thickness at the corner: uniform for A; for B the outer arc cuts into a sharp inner corner. */
  static cornerWall(r: number, t: number) {
    return { a: t, b: r > t ? r - (r - t) * Math.SQRT2 : r + (t - r) * Math.SQRT2 }
  }

  private applySection() {
    // A horizontal cut at half height, seen from the top, shows the corners in plan.
    this.v.kit.setSection(this.state.section ? new THREE.Plane(new THREE.Vector3(0, 0, -1), 15) : null)
    this.v.invalidate()
  }

  private async load() {
    if (this.manifests.length < 2) return
    const token = ++this.token
    const values = { r: this.state.r, t: this.state.t }
    try {
      const out = await Promise.all(
        this.manifests.map(async (m) => {
          const grid = m.params.filter((p) => p.values.length)
          const v = m.variants[variantKey(grid, { ...Object.fromEntries(m.params.map((p) => [p.id, p.default])), ...values })]
          if (!v?.file) return { steps: [] as THREE.Object3D[], fail: v?.failedAt ?? "missing" }
          const scene = await loadGlb(m.id, v.file)
          return { steps: stepsOf(scene), fail: v.ok ? null : (v.failedAt ?? null) }
        }),
      )
      if (token !== this.token) return
      this.steps = [out[0].steps, out[1].steps]
      this.set({
        ready: true,
        failA: out[0].fail,
        failB: out[1].fail,
        triedFail: this.state.triedFail || !!out[0].fail || !!out[1].fail,
      })
    } catch (e) {
      this.set({ error: String(e) })
    }
  }

  failureText(which: 0 | 1) {
    const m = this.manifests[which]
    const f = which === 0 ? this.state.failA : this.state.failB
    return f && m ? (m.failures[f] ?? "内核没能完成这一步。") : null
  }

  protected render() {
    const s = this.state
    const labels = ["A 先圆角，再抽壳", "B 先抽壳，再圆角"]
    for (const which of [0, 1] as const) {
      const g = this.groups[which]
      this.clear(g)
      const steps = this.steps[which]
      if (!steps.length) continue
      const want = which === 0 ? s.ua : s.ub
      const idx = Math.min(want, steps.length - 1)
      const shown = displayStep(steps[idx], this.v.kit)
      paint(shown, this.v.kit, (d) => {
        const f = d as unknown as FaceInfo
        return f.status === "new" ? "highlight" : f.status === "modified" ? "modified" : "rest"
      })
      g.add(shown)
      const fail = which === 0 ? s.failA : s.failB
      const m = this.manifests[which]
      const name = m?.features[idx]?.name ?? ""
      g.add(tag(fail && idx < want ? `${labels[which]} · 停在${name}（下一步失败）` : `${labels[which]} · ${name}`, new THREE.Vector3(0, -26, 31)))
    }
    this.v.invalidate()
  }

  dispose() {
    this.v.kit.setSection(null)
    super.dispose()
  }
}
