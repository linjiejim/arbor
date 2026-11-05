import * as THREE from "three"
import { edgeLine, face, label, line, linearDim } from "@/three/build"
import { flipFaces } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { buildBlock, D, edgeSegment, failure, frontProfile, H, W, type EdgeId, type Mode, type Treatment } from "./fillet-chamfer.geom"
import { LessonScene } from "./scene"

/**
 * 1.2.6 「圆角与倒角」: a block whose edges the learner clicks into a fillet
 * set, pushes the radius until the fillet fails, switches to a chamfer,
 * compares tangency (G1) with a corner (G0), and sees why fillets go last
 * in the feature tree.
 */
export type Order = "first" | "last"

export type FilletState = {
  step: number
  mode: Mode
  sel: EdgeId[]
  r: number
  c1: number
  c2: number
  /** Why the current fillet / chamfer fails (null when it builds). */
  fail: string | null
  picked: boolean
  triedFail: boolean
  triedUnequal: boolean
  seenFillet: boolean
  seenChamfer: boolean
  /** Step 5: is 圆角1 before or after 孔1 in the tree. */
  order: Order
  filletOn: boolean
  r4: number
  triedFirst: boolean
  triedLast: boolean
}

const ALL: EdgeId[] = ["tf", "tr", "tb", "tl", "vfl", "vfr", "vbr", "vbl"]
const HOLE_R = 4
/** The hole sketch's dimension: 12 mm from the referenced edge to the hole centre. */
const HOLE_DIM = 12
const LAST_STEP = 4

export const treatment = (s: FilletState): Treatment =>
  s.step >= LAST_STEP ? { mode: "fillet", sel: s.filletOn ? ["tf"] : [], r: s.r4, c1: 0, c2: 0 } : { mode: s.mode, sel: s.sel, r: s.r, c1: s.c1, c2: s.c2 }

/** Step 5: where the hole ends up, or null when its reference edge is gone. */
export function holeY(s: FilletState): number | null {
  if (s.order === "last") return -D / 2 + HOLE_DIM
  return s.filletOn ? -D / 2 + s.r4 + HOLE_DIM : null
}

export class FilletScene extends LessonScene<FilletState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private extras = new THREE.Group()
  private pickers: THREE.Mesh[] = []
  private pickMat = new THREE.MeshBasicMaterial({ visible: false })
  private hover: EdgeId | null = null

  constructor(v: Viewer, emit: (s: FilletState) => void) {
    super(v, emit, {
      step: 0,
      mode: "fillet",
      sel: [],
      r: 5,
      c1: 5,
      c2: 5,
      fail: null,
      picked: false,
      triedFail: false,
      triedUnequal: false,
      seenFillet: false,
      seenChamfer: false,
      order: "first",
      filletOn: true,
      r4: 5,
      triedFirst: false,
      triedLast: false,
    })
    v.setGrid(100, 10)
    this.root.add(this.body, this.marks, this.extras)
    for (const id of ALL) {
      const [a, b] = edgeSegment(id)
      const size = b.clone().sub(a)
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(size.x) + 5, Math.abs(size.y) + 5, Math.abs(size.z) + 5), this.pickMat)
      m.position.copy(a).add(b).multiplyScalar(0.5)
      m.userData = { edge: id }
      this.pickers.push(m)
    }
    this.root.add(...this.pickers)
    this.own(() => this.pickMat.dispose())
    this.listen()
  }

  /** Recompute the failure with every change; remember a failure seen on step 2. */
  protected set(patch: Partial<FilletState>) {
    const next = { ...this.state, ...patch }
    const f = next.step < LAST_STEP ? failure(treatment(next)) : null
    super.set({ ...patch, fail: f?.text ?? null, triedFail: next.triedFail || (!!f && next.step === 1) })
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<FilletState> = { step }
    if (step <= 1) patch.mode = "fillet"
    if (step >= 1 && step < LAST_STEP && s.sel.length === 0) patch.sel = ["tf", "tb"]
    if (step === 2) patch.mode = "chamfer"
    if (step === 3) {
      // One edge only, so the end face shows the plain profile of the front top edge.
      patch.sel = ["tf"]
      if (failure({ ...treatment({ ...s, ...patch }) })) Object.assign(patch, { r: 6, c1: 6, c2: 6 })
      Object.assign(patch, s.mode === "fillet" ? { seenFillet: true } : { seenChamfer: true })
    }
    if (step === LAST_STEP) patch.filletOn = true
    this.set(patch)
    const v = this.v
    if (step < 3) v.flyTo(new THREE.Vector3(95, -135, 100), new THREE.Vector3(0, 0, 8), 800)
    if (step === 3) v.flyTo(new THREE.Vector3(-125, -70, 55), new THREE.Vector3(-24, -10, 12), 800)
    if (step === LAST_STEP) v.flyTo(new THREE.Vector3(45, -105, 150), new THREE.Vector3(0, -2, 10), 800)
  }

  // ------------------------------------------------------------ actions

  toggle(id: EdgeId) {
    const sel = this.state.sel.includes(id) ? this.state.sel.filter((e) => e !== id) : [...this.state.sel, id]
    this.set({ sel, picked: true })
  }

  selectLongTop(r: number) {
    this.set({ sel: ["tf", "tb"], r, mode: "fillet" })
  }

  setRadius(r: number) {
    this.set({ r })
  }

  setChamfer(c1: number, c2: number) {
    this.set({ c1, c2, triedUnequal: this.state.triedUnequal || (this.state.step === 2 && c1 !== c2) })
  }

  setMode(mode: Mode) {
    const patch: Partial<FilletState> = { mode }
    if (this.state.step === 3) Object.assign(patch, mode === "fillet" ? { seenFillet: true } : { seenChamfer: true })
    this.set(patch)
  }

  clearSel() {
    this.set({ sel: [] })
  }

  setOrder(order: Order) {
    this.set({ order, filletOn: true })
  }

  setR4(r4: number) {
    this.set({ r4, ...this.tried() })
  }

  setFilletOn(filletOn: boolean) {
    this.set({ filletOn, ...(filletOn ? {} : this.tried()) })
  }

  private tried(): Partial<FilletState> {
    return this.state.order === "first" ? { triedFirst: true } : { triedLast: true }
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const t = treatment(s)
    const failed = !!s.fail
    const last = s.step >= LAST_STEP
    const hy = last ? holeY(s) : null
    const hole = hy !== null ? { x: 0, y: hy, r: HOLE_R } : undefined
    const mesh = buildBlock(failed ? { ...t, sel: [] } : t, hole)

    this.clear(this.body)
    const featureRole = last ? "model" : "highlight"
    this.body.add(
      face(mesh.rest, kit, { feature: "extrude1", edges: false }),
      face(mesh.top, kit, { feature: "extrude1", edges: false }),
      face(mesh.bottom, kit, { feature: "extrude1", edges: false }),
    )
    if (mesh.feature.getAttribute("position").count > 0) this.body.add(face(mesh.feature, kit, { feature: "fillet1", role: featureRole, edges: false }))
    for (const p of mesh.sharp) this.body.add(edgeLine(p, kit))
    for (const p of mesh.soft) this.body.add(edgeLine(p, kit, true))

    if (hole) {
      const wall = new THREE.CylinderGeometry(HOLE_R, HOLE_R, H, 40, 1, true)
      wall.rotateX(Math.PI / 2)
      wall.translate(hole.x, hole.y, H / 2)
      this.body.add(face(flipFaces(wall), kit, { feature: "hole1", role: "highlight", edges: false }))
      for (const z of [0, H]) {
        const ring: THREE.Vector3[] = []
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2
          ring.push(new THREE.Vector3(hole.x + Math.cos(a) * HOLE_R, hole.y + Math.sin(a) * HOLE_R, z))
        }
        this.body.add(edgeLine(ring, kit))
      }
    }

    // Selection and hover: a thick line on each chosen edge.
    this.clear(this.marks)
    if (!last) {
      for (const id of s.sel) {
        const pts = !failed && mesh.marks[id] ? mesh.marks[id]! : edgeSegment(id)
        this.marks.add(line(lift(pts, id), kit.sketch))
      }
      if (this.hover && !s.sel.includes(this.hover)) this.marks.add(line(lift(edgeSegment(this.hover), this.hover), kit.sketchThin))
    }
    for (const p of this.pickers) p.visible = !last

    this.clear(this.extras)
    if (failed && !last) {
      const f = failure(t)
      if (f) this.extras.add(label(`${s.mode === "fillet" ? "圆角" : "倒角"}失败：${f.face}不够`, f.at, "border-destructive text-destructive font-sans"))
    }
    if (s.step === 3 && !failed) this.addComb(t)
    if (last) this.addHoleNotes(s, mesh.frontTangentY)
    this.v.invalidate()
  }

  /** Normals along the front top edge's profile: they turn smoothly on a fillet, jump on a chamfer. */
  private addComb(t: Treatment) {
    const kit = this.v.kit
    const prof = frontProfile(t, -W / 2 - 0.3)
    for (const { p, n } of prof) this.extras.add(line([p.clone().addScaledVector(n, 0.3), p.clone().addScaledVector(n, 7)], kit.dimension))
    const tip = prof[Math.floor(prof.length / 2)]
    this.extras.add(
      label(t.mode === "fillet" ? "法向连续转过去：G1 相切" : "法向在两条棱上突变：G0", tip.p.clone().addScaledVector(tip.n, 11), "font-sans"),
    )
  }

  private addHoleNotes(s: FilletState, tangentY: number) {
    const kit = this.v.kit
    const hy = holeY(s)
    const refY = s.order === "first" ? tangentY : -D / 2
    const z = H + 0.15
    if (s.order === "first" && s.filletOn) {
      this.extras.add(line([new THREE.Vector3(-W / 2, refY, z), new THREE.Vector3(W / 2, refY, z)], kit.sketch))
      this.extras.add(label("参照：圆角的切线边", new THREE.Vector3(W / 2 + 4, refY, z), "font-sans translate-x-1/2"))
    }
    if (s.order === "last") {
      this.extras.add(line([new THREE.Vector3(-W / 2, refY, H), new THREE.Vector3(W / 2, refY, H)], kit.construction))
      this.extras.add(label("参照：拉伸1 的原始棱边", new THREE.Vector3(W / 2 + 4, refY, H), "font-sans translate-x-1/2"))
    }
    if (hy === null) {
      this.extras.add(label("孔1：参照边不存在了", new THREE.Vector3(0, -D / 2 + HOLE_DIM, H + 6), "border-destructive text-destructive font-sans"))
      return
    }
    const a = new THREE.Vector3(-HOLE_R - 2, refY, z)
    const b = new THREE.Vector3(-HOLE_R - 2, hy, z)
    this.extras.add(linearDim(kit, a, b, new THREE.Vector3(-1, 0, 0), 18, `${HOLE_DIM}`))
    // Hole centre mark, so the dimension clearly ends at the centre.
    this.extras.add(line([new THREE.Vector3(-HOLE_R - 2, hy, z), new THREE.Vector3(HOLE_R + 2, hy, z)], kit.construction))
    this.extras.add(label(`孔中心到前面 ${Math.round((hy + D / 2) * 10) / 10} mm`, new THREE.Vector3(0, hy, H + 12), "font-sans"))
  }

  // ------------------------------------------------------------ pointer

  private listen() {
    const el = this.v.renderer.domElement
    let down: { x: number; y: number } | null = null
    const pickEdge = (e: PointerEvent): EdgeId | null => {
      if (this.state.step >= LAST_STEP) return null
      const hit = this.v.pick(e, this.pickers, false)
      return (hit?.object.userData.edge as EdgeId | undefined) ?? null
    }
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 5) return
      const id = pickEdge(e)
      if (id) this.toggle(id)
    }
    const onMove = (e: PointerEvent) => {
      if (down) return
      const id = pickEdge(e)
      if (id !== this.hover) {
        this.hover = id
        el.style.cursor = id ? "pointer" : ""
        this.render()
      }
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointermove", onMove)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointermove", onMove)
      el.style.cursor = ""
    })
  }
}

/** Nudge a highlight line off the surface, outwards from the block. */
function lift(pts: THREE.Vector3[], id: EdgeId) {
  const [a, b] = edgeSegment(id)
  const m = a.clone().add(b).multiplyScalar(0.5)
  const dir = new THREE.Vector3(
    Math.abs(Math.abs(m.x) - W / 2) < 1e-6 ? Math.sign(m.x) : 0,
    Math.abs(Math.abs(m.y) - D / 2) < 1e-6 ? Math.sign(m.y) : 0,
    Math.abs(m.z - H) < 1e-6 ? 1 : 0,
  ).normalize()
  return pts.map((p) => p.clone().addScaledVector(dir, 0.4))
}
