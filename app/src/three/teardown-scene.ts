import * as THREE from "three"
import { paint, tag } from "./build"
import { displayStep, loadGlb, partsOf, stepsOf, variantKey, type AssemblyManifest, type BakedVariant, type FaceInfo, type FaceStatus, type PartManifest } from "./baked"
import { ease } from "./tween"
import { disposeObject, type Viewer } from "./viewer"
import type { Params, PartModel } from "@/content/procedural/types"

const ISO = new THREE.Vector3(1, -1.1, 0.85)

/**
 * Feature-by-feature rebuild of a part. Rolling back, playing a feature's
 * creation, and changing a parameter all regenerate from the model's build
 * function; the finished part can stay behind as a ghost ("where this is
 * heading"), and the current feature's faces are highlighted.
 */
export class PartScene {
  params: Params
  upto: number
  progress = 1
  hover: string | null = null
  showFuture = true
  onWarnings?: (w: string[]) => void
  private current: THREE.Group | null = null
  private ghost: THREE.Group | null = null
  private v: Viewer
  private model: PartModel

  constructor(v: Viewer, model: PartModel, params: Params) {
    this.v = v
    this.model = model
    this.params = params
    this.upto = model.features.length - 1
    v.setGrid(150, 10)
    this.rebuild()
    this.rebuildGhost()
    v.fit(model.bounds(params), { dir: ISO, padding: 1.35, animate: false })
  }

  get last() {
    return this.model.features.length - 1
  }

  setParams(p: Params) {
    this.params = p
    this.progress = 1
    this.v.tweens.cancel("feature")
    this.rebuild()
    this.rebuildGhost()
  }

  setHover(id: string | null) {
    this.hover = id
    this.paint()
  }

  setShowFuture(on: boolean) {
    this.showFuture = on
    this.updateGhost()
  }

  /** Half-section on the front (XZ) plane: keeps y ≥ 0, so the cut faces the default camera. */
  setSection(on: boolean) {
    this.v.kit.setSection(on ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) : null)
    this.v.invalidate()
  }

  /** Roll the feature tree to step i, replaying that feature's creation. */
  rollTo(i: number, opts: { animate?: boolean; camera?: boolean } = {}) {
    this.upto = Math.max(0, Math.min(this.last, i))
    if (opts.camera !== false) this.focus(this.upto)
    if (opts.animate === false) {
      this.progress = 1
      this.rebuild()
      return Promise.resolve()
    }
    const op = this.model.features[this.upto].op
    const duration = op === "sketch" ? 800 : 1100
    return this.v.tweens.run(
      duration,
      (k) => {
        this.progress = k
        this.rebuild()
      },
      { tag: "feature", ease: ease.inOut },
    )
  }

  focus(i: number) {
    const f = this.model.features[i]
    const box = f.focus?.(this.params) ?? this.model.bounds(this.params)
    return this.v.fit(box, { dir: new THREE.Vector3(...(f.view ?? [1, -1.1, 0.85])), padding: 1.3 })
  }

  private rebuild() {
    const out = this.model.build({ kit: this.v.kit, params: this.params, upto: this.upto, progress: this.progress })
    if (this.current) {
      this.v.content.remove(this.current)
      disposeObject(this.current)
    }
    this.current = out.group
    this.v.content.add(out.group)
    this.paint()
    this.updateGhost()
    this.onWarnings?.(out.warnings)
    this.v.invalidate()
  }

  private rebuildGhost() {
    if (this.ghost) {
      this.v.content.remove(this.ghost)
      disposeObject(this.ghost)
    }
    const out = this.model.build({ kit: this.v.kit, params: this.params, upto: this.last, progress: 1 })
    paint(out.group, this.v.kit, () => "ghost")
    // Edge lines read as clutter on a ghost: keep the faces only.
    out.group.traverse((o) => {
      if (o.userData.kind === "edge") o.visible = false
    })
    this.ghost = out.group
    this.v.content.add(out.group)
    this.updateGhost()
  }

  private updateGhost() {
    if (this.ghost) this.ghost.visible = this.showFuture && this.upto < this.last
    this.v.invalidate()
  }

  private paint() {
    if (!this.current) return
    const cur = this.model.features[this.upto].id
    const target = this.hover ?? cur
    paint(this.current, this.v.kit, (d) => (d.feature === target ? "highlight" : "rest"))
    this.v.invalidate()
  }

  dispose() {
    this.v.tweens.cancel("feature")
    this.v.kit.setSection(null)
    for (const g of [this.current, this.ghost]) {
      if (!g) continue
      this.v.content.remove(g)
      disposeObject(g)
    }
  }
}


// ======================================================================
// Baked models (build123d → GLB). These replace the procedural stand-ins on
// the teardown pages: geometry and face tags come from the real kernel.
// ======================================================================

export type BakedState = {
  loading: boolean
  error: string | null
  variant: BakedVariant | null
  /** Steps available in this variant (fewer than features when it failed). */
  available: number
}

/** Faces of the shown step by status, and how much of the surface the modified ones cover. */
export type FaceStats = { new: number; modified: number; kept: number; /** 0–1, by area. */ modifiedShare: number }

/** Surface area of a face mesh, cached on the (shared) geometry. */
function areaOf(geo: THREE.BufferGeometry) {
  if (typeof geo.userData.area === "number") return geo.userData.area as number
  const pos = geo.getAttribute("position")
  const idx = geo.getIndex()
  const n = idx ? idx.count : pos.count
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let area = 0
  for (let i = 0; i + 2 < n; i += 3) {
    const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2]
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1).sub(a)
    c.fromBufferAttribute(pos, i2).sub(a)
    area += b.cross(c).length() / 2
  }
  geo.userData.area = area
  return area
}

export class BakedPartScene {
  upto = 0
  hover: string | null = null
  showFuture = true
  onState?: (s: BakedState) => void
  /** Called whenever the shown step changes. */
  onStats?: (s: FaceStats) => void
  private steps: THREE.Object3D[] = []
  private current: THREE.Group | null = null
  private ghost: THREE.Group | null = null
  private variant: BakedVariant | null = null
  private token = 0
  private v: Viewer
  readonly manifest: PartManifest

  constructor(v: Viewer, manifest: PartManifest) {
    this.v = v
    this.manifest = manifest
    this.upto = manifest.features.length - 1
    v.setGrid(150, 10)
  }

  get last() {
    return this.steps.length - 1
  }

  /** Load the baked variant for these parameter values. */
  async setValues(values: Record<string, number>, opts: { frame?: boolean } = {}) {
    const grid = this.manifest.params.filter((p) => p.values.length)
    const key = variantKey(grid, values)
    const variant = this.manifest.variants[key] ?? null
    const token = ++this.token
    this.variant = variant
    if (!variant?.file) {
      this.steps = []
      this.clear()
      this.emit(false, variant ? null : "没有这组参数的烘焙结果")
      return
    }
    this.emit(true, null)
    try {
      const scene = await loadGlb(this.manifest.id, variant.file)
      if (token !== this.token) return
      this.steps = stepsOf(scene)
      this.upto = Math.min(this.upto, this.last)
      this.rebuild(false)
      this.rebuildGhost()
      if (opts.frame) {
        const bb = this.boundsOf(this.steps[this.last])
        this.v.fit(bb, { dir: ISO, padding: 1.3, animate: false })
      }
      this.emit(false, null)
    } catch (e) {
      if (token === this.token) this.emit(false, e instanceof Error ? e.message : String(e))
    }
  }

  private emit(loading: boolean, error: string | null) {
    this.onState?.({ loading, error, variant: this.variant, available: this.steps.length })
  }

  setHover(id: string | null) {
    this.hover = id
    this.paint()
  }

  setShowFuture(on: boolean) {
    this.showFuture = on
    this.updateGhost()
  }

  setSection(on: boolean) {
    this.v.kit.setSection(on ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) : null)
    this.v.invalidate()
  }

  rollTo(i: number, opts: { animate?: boolean; camera?: boolean } = {}) {
    if (!this.steps.length) return Promise.resolve()
    this.upto = Math.max(0, Math.min(this.last, i))
    if (opts.camera !== false) this.focus(this.upto)
    this.rebuild(opts.animate !== false)
    return new Promise<void>((r) => setTimeout(r, opts.animate === false ? 0 : 700))
  }

  focus(i: number) {
    const f = this.manifest.features[i]
    const box = f.focus
      ? new THREE.Box3(new THREE.Vector3(...f.focus[0]), new THREE.Vector3(...f.focus[1]))
      : this.boundsOf(this.steps[this.last] ?? this.steps[i])
    return this.v.fit(box, { dir: new THREE.Vector3(...f.view), padding: 1.3 })
  }

  private boundsOf(step: THREE.Object3D | undefined) {
    const box = new THREE.Box3()
    step?.traverse((o) => {
      if (o.userData.kind === "face" && (o as THREE.Mesh).geometry) {
        const g = (o as THREE.Mesh).geometry
        g.computeBoundingBox()
        box.union(g.boundingBox!)
      }
    })
    if (box.isEmpty()) box.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100))
    return box
  }

  private clear() {
    for (const g of [this.current, this.ghost]) {
      if (!g) continue
      this.v.content.remove(g)
      disposeObject(g)
    }
    this.current = this.ghost = null
    this.onStats?.(this.stats())
    this.v.invalidate()
  }

  private rebuild(animate: boolean) {
    if (this.current) {
      this.v.content.remove(this.current)
      disposeObject(this.current)
    }
    this.current = displayStep(this.steps[this.upto], this.v.kit)
    this.v.content.add(this.current)
    this.paint()
    this.updateGhost()
    this.onStats?.(this.stats())
    if (animate) {
      // The new and changed faces flare, then settle: "this is what the step did".
      const kit = this.v.kit
      this.v.tweens.run(
        900,
        (k) => {
          kit.highlight.emissiveIntensity = 0.9 - 0.68 * k
          kit.modified.emissiveIntensity = 0.8 - 0.62 * k
          this.v.invalidate()
        },
        { tag: "flare", ease: ease.out },
      )
    }
    this.v.invalidate()
  }

  private rebuildGhost() {
    if (this.ghost) {
      this.v.content.remove(this.ghost)
      disposeObject(this.ghost)
    }
    if (!this.steps.length) return
    this.ghost = displayStep(this.steps[this.last], this.v.kit)
    this.ghost.traverse((o) => {
      const k = o.userData.kind
      if (k === "edge" || k === "sketch" || k === "construction" || k === "plane-overlay" || k === "dimension" || k === "label") o.visible = false
    })
    paint(this.ghost, this.v.kit, () => "ghost")
    this.v.content.add(this.ghost)
    this.updateGhost()
  }

  private updateGhost() {
    if (this.ghost) {
      this.ghost.visible = this.showFuture && this.upto < this.last
      // Only preview what is still to come: faces created by later features.
      const order = new Map(this.manifest.features.map((f, i) => [f.id, i]))
      this.ghost.traverse((o) => {
        if (o.userData.kind === "face") o.visible = (order.get(o.userData.origin as string) ?? 0) > this.upto
      })
    }
    this.v.invalidate()
  }

  private paint() {
    if (!this.current) return
    const hover = this.hover
    paint(this.current, this.v.kit, (d) => {
      const f = d as unknown as FaceInfo
      if (hover) return f.origin === hover ? "highlight" : f.modifiedBy?.includes(hover) ? "modified" : "rest"
      return f.status === "new" ? "highlight" : f.status === "modified" ? "modified" : "rest"
    })
    this.v.invalidate()
  }

  /** Count faces by status in the current step (for the panel). */
  stats(): FaceStats {
    const s = { new: 0, modified: 0, kept: 0 }
    let total = 0
    let modified = 0
    this.current?.traverse((o) => {
      const st = o.userData.status as FaceStatus | undefined
      if (o.userData.kind !== "face" || !st) return
      s[st]++
      const a = areaOf((o as THREE.Mesh).geometry)
      total += a
      if (st === "modified") modified += a
    })
    return { ...s, modifiedShare: total ? modified / total : 0 }
  }

  dispose() {
    this.onState = this.onStats = undefined
    this.v.tweens.cancel("flare")
    this.v.kit.setSection(null)
    this.clear()
  }
}

/** A baked assembly: parts with explode, order playback, BOM linkage, section. */
export class BakedAssemblyScene {
  explode = 0
  /** Joint values for parts that keep a degree of freedom (degrees). */
  motion = new Map<string, number>()
  hover: string | null = null
  selected: string | null = null
  private seq = new Map<string, number>()
  private parts = new Map<string, THREE.Object3D>()
  private tags = new Map<string, THREE.Object3D>()
  private v: Viewer
  private bounds = new THREE.Box3()
  readonly manifest: AssemblyManifest

  constructor(v: Viewer, manifest: AssemblyManifest, scene: THREE.Group) {
    this.v = v
    this.manifest = manifest
    v.setGrid(150, 10)
    const raw = partsOf(scene)
    for (const def of manifest.parts) {
      const node = raw.get(def.id)
      if (!node) continue
      const obj = displayStep(node, v.kit, { role: def.role, part: def.id })
      obj.userData = { kind: "part", part: def.id }
      obj.traverse((o) => {
        if (o.userData.kind === "face") o.userData.part = def.id
      })
      const bb = new THREE.Box3().setFromObject(obj)
      this.bounds.union(bb)
      const anchor = new THREE.Vector3(bb.max.x + 4, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2)
      const t = tag(def.qty > 1 ? `${def.name} ×${def.qty}` : def.name, anchor, "translate-x-1/2")
      t.visible = false
      obj.add(t)
      this.tags.set(def.id, t)
      this.parts.set(def.id, obj)
      v.content.add(obj)
    }
    this.apply()
    this.frame(false)
  }

  frame(animate = true) {
    const box = this.bounds.clone()
    for (const p of this.manifest.parts) {
      const off = new THREE.Vector3(...p.explode).multiplyScalar(this.explode)
      box.expandByPoint(this.bounds.min.clone().add(off))
      box.expandByPoint(this.bounds.max.clone().add(off))
    }
    return this.v.fit(box, { dir: ISO, padding: 1.2, animate })
  }

  setExplode(f: number) {
    this.explode = f
    this.apply()
  }

  setMotion(part: string, value: number) {
    this.motion.set(part, value)
    this.apply()
  }

  setHover(id: string | null) {
    if (id === this.hover) return
    this.hover = id
    this.paint()
  }

  setSelected(id: string | null) {
    this.selected = id
    this.paint()
  }

  setSection(x: number | null) {
    this.v.kit.setSection(x === null ? null : new THREE.Plane(new THREE.Vector3(-1, 0, 0), x))
    this.v.invalidate()
  }

  sectionRange(): [number, number] {
    return [Math.floor(this.bounds.min.x), Math.ceil(this.bounds.max.x)]
  }

  pickPart(ev: { clientX: number; clientY: number }) {
    const hit = this.v.pick(ev, [...this.parts.values()])
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && !o.userData.part) o = o.parent
    return (o?.userData.part as string | undefined) ?? null
  }

  async playSequence(onStep: (id: string | null) => void, isCancelled: () => boolean) {
    const order = [...this.manifest.parts].sort((a, b) => a.order - b.order)
    for (const p of order) this.seq.set(p.id, 1)
    this.apply()
    const prev = this.explode
    this.explode = 1
    await this.frame(true)
    this.explode = prev
    for (const p of order) {
      if (isCancelled()) break
      onStep(p.id)
      this.setSelected(p.id)
      await this.v.tweens.run(
        700,
        (k) => {
          this.seq.set(p.id, 1 - k)
          this.apply()
        },
        { tag: `seq-${p.id}`, ease: ease.inOut },
      )
      await new Promise((r) => setTimeout(r, 250))
    }
    this.seq.clear()
    this.explode = 0
    this.apply()
    this.setSelected(null)
    onStep(null)
  }

  private apply() {
    for (const def of this.manifest.parts) {
      const obj = this.parts.get(def.id)
      if (!obj) continue
      const f = this.seq.get(def.id) ?? this.explode
      obj.position.set(def.explode[0] * f, def.explode[1] * f, def.explode[2] * f)
      obj.quaternion.identity()
      const m = def.motion
      const angle = this.motion.get(def.id) ?? 0
      if (m && angle) {
        // Rotate about the joint axis: R about the axis through `origin`.
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...m.axis).normalize(), THREE.MathUtils.degToRad(angle))
        const o = new THREE.Vector3(...m.origin)
        obj.quaternion.copy(q)
        obj.position.add(o.clone().sub(o.clone().applyQuaternion(q)))
      }
      const t = this.tags.get(def.id)!
      t.visible = (this.seq.size ? f > 0.02 || this.selected === def.id : this.explode > 0.45) || this.hover === def.id
    }
    this.v.invalidate()
  }

  private paint() {
    for (const [id, obj] of this.parts) {
      const on = id === this.hover || id === this.selected
      paint(obj, this.v.kit, () => (on ? "highlight" : "rest"))
    }
    this.apply()
  }

  dispose() {
    this.v.kit.setSection(null)
    for (const obj of this.parts.values()) {
      this.v.content.remove(obj)
      disposeObject(obj)
    }
  }
}
