import * as THREE from "three"
import { face, faces, label, line, tag } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import type { OpId } from "@/content/ops"
import { buildPart, chainAt, HOLE, W, type ChamferEnd, type FeatureId } from "./feature-tree.model"
import { LessonScene } from "./scene"

/**
 * 1.3.1–1.3.3 「特征树、父子关系与拓扑命名」: a block → hole → fillet →
 * chamfer part. The learner selects features to see their faces, rolls the
 * tree back, suppresses the fillet (the chamfer loses its edge and fails),
 * changes the extrude depth so edges are renumbered (the chamfer silently
 * jumps to the wrong edge), and fixes it with a reference that survives.
 */
export type RefMode = "index" | "intent"

export type FtState = {
  step: number
  /** Feature picked in the tree or in the viewport (step 1). */
  selected: FeatureId | null
  seen: FeatureId[]
  /** Rollback bar: number of solid features still computed (1 = 拉伸1 … 4 = 倒角1). */
  upTo: number
  triedRollback: boolean
  filletSuppressed: boolean
  triedSuppress: boolean
  depth: number
  refMode: RefMode
}

export type FeatureInfo = { id: FeatureId; name: string; op: OpId }

export const FEATURES: FeatureInfo[] = [
  { id: "extrude1", name: "拉伸1", op: "extrude" },
  { id: "hole1", name: "孔1", op: "hole" },
  { id: "fillet1", name: "圆角1", op: "fillet" },
  { id: "chamfer1", name: "倒角1", op: "chamfer" },
]

export const DEFAULT_DEPTH = 30

/** What the model computes from a state: shared by the scene and the tree overlay. */
export function derive(s: FtState) {
  const fillet = s.upTo >= 3 && !s.filletSuppressed
  const through = s.depth <= HOLE.depth
  const wantsChamfer = s.upTo >= 4
  const chamferError = wantsChamfer && !fillet
  const chamferEnd: ChamferEnd | null = !wantsChamfer || !fillet ? null : s.refMode === "index" && through ? "left" : "right"
  return { fillet, through, chamferError, chamferEnd, wrongEdge: chamferEnd === "left" }
}

/** Key view, shifted so the part sits right of the tree overlay. */
const SHIFT = new THREE.Vector3(-16, -13, 0)
const VIEW = new THREE.Vector3(150, -175, 135).add(SHIFT)
const TARGET = new THREE.Vector3(0, 0, 12).add(SHIFT)

export class FeatureTreeScene extends LessonScene<FtState> {
  private body = new THREE.Group()
  private notes = new THREE.Group()
  private down: { x: number; y: number } | null = null

  constructor(v: Viewer, emit: (s: FtState) => void) {
    super(v, emit, {
      step: 0,
      selected: null,
      seen: [],
      upTo: 4,
      triedRollback: false,
      filletSuppressed: false,
      triedSuppress: false,
      depth: DEFAULT_DEPTH,
      refMode: "index",
    })
    v.setGrid(100, 10)
    this.root.add(this.body, this.notes)

    // Click a face (without dragging the view) to select the feature that made it.
    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => (this.down = { x: e.clientX, y: e.clientY })
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || this.state.step !== 0) return
      const hit = this.v.pick(e, faces(this.body), false)
      const id = hit?.object.userData.feature as FeatureId | undefined
      this.select(id ?? null)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
    })
  }

  enter(step: number) {
    const patch: Partial<FtState> = { step }
    // Each step starts from the finished, healthy tree, except for what that step is about.
    if (step !== 1) patch.upTo = 4
    if (step !== 2) patch.filletSuppressed = false
    if (step <= 2) Object.assign(patch, { depth: DEFAULT_DEPTH, refMode: "index" })
    if (step === 3) patch.refMode = "index"
    if (step === 4 && this.state.depth > HOLE.depth) patch.depth = 16
    if (step === 4) patch.refMode = "index"
    this.set(patch)
    if (step === 3 || step === 4) this.v.flyTo(new THREE.Vector3(4, -215, 215), new THREE.Vector3(-4, 0, 4), 800)
    else this.v.flyTo(VIEW.clone(), TARGET.clone(), 800)
  }

  // ------------------------------------------------------------ actions

  select(id: FeatureId | null) {
    const seen = id && !this.state.seen.includes(id) ? [...this.state.seen, id] : this.state.seen
    this.set({ selected: id === this.state.selected ? null : id, seen })
  }

  rollTo(upTo: number) {
    const n = Math.max(1, Math.min(4, Math.round(upTo)))
    this.set({ upTo: n, triedRollback: this.state.triedRollback || n <= 2 })
  }

  suppressFillet(on: boolean) {
    this.set({ filletSuppressed: on, triedSuppress: this.state.triedSuppress || on })
  }

  setDepth(d: number) {
    this.set({ depth: Math.max(12, Math.min(40, Math.round(d))) })
  }

  setRefMode(refMode: RefMode) {
    this.set({ refMode })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const d = derive(s)
    const H = s.depth

    this.clear(this.body)
    for (const f of buildPart({ depth: H, hole: s.upTo >= 2, fillet: d.fillet, chamfer: d.chamferEnd })) {
      const m = face(f.geo, kit, { feature: f.feature })
      m.userData.modifiedBy = f.modifiedBy
      this.body.add(m)
    }

    // Which feature's faces to light up: the selected one, or the one at the rollback bar.
    const focus: FeatureId | null = s.step === 0 ? s.selected : s.step === 1 ? FEATURES[s.upTo - 1].id : null
    for (const m of faces(this.body)) {
      const id = m.userData.feature as FeatureId
      const mod = (m.userData.modifiedBy as FeatureId[]).includes(focus as FeatureId)
      let mat: THREE.Material = kit.model
      if (focus) mat = id === focus ? kit.highlight : mod ? kit.modified : kit.model
      else if (id === "chamfer1" && s.step >= 3) mat = d.wrongEdge ? kit.modified : kit.highlight
      m.material = mat
    }

    this.clear(this.notes)
    const destructive = "border-destructive text-destructive font-sans"
    const midOf = (pts: THREE.Vector3[]) => pts[Math.floor(pts.length / 2)].clone()
    if (d.chamferError && s.step >= 2) {
      // The edge the chamfer was attached to no longer exists: show where it used to be.
      const lost = chainAt("right", H)
      this.notes.add(line(lost, kit.path))
      this.notes.add(label("倒角1：找不到 Edge7", midOf(lost).add(new THREE.Vector3(8, -10, 16)), destructive))
    }
    if (d.wrongEdge) {
      const meant = chainAt("right", H)
      this.notes.add(line(meant, kit.path))
      this.notes.add(label("想要的边：现在叫 Edge9", midOf(meant).add(new THREE.Vector3(6, -8, 18)), "border-transparent bg-popover font-sans text-muted-foreground"))
      const now = chainAt("left", H)
      this.notes.add(label("倒角1 落在这里：新的 Edge7", midOf(now).add(new THREE.Vector3(0, -8, -20)), "border-scene-modified font-sans"))
    }
    if (s.step >= 3 && d.chamferEnd === "right" && s.refMode === "intent") {
      this.notes.add(tag("倒角1 · 右端面 ∩ 圆角面", midOf(chainAt("right", H)).add(new THREE.Vector3(6, -8, 18))))
    }
    if (s.step >= 3 && d.through && s.upTo >= 2) {
      this.notes.add(label("孔1 打穿了底面：多出一圈边", new THREE.Vector3(HOLE.x, -W / 2, 0), "border-transparent bg-popover font-sans text-muted-foreground"))
    }
    this.v.invalidate()
  }
}
