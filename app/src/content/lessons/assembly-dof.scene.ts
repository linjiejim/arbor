import * as THREE from "three"
import { edgeLine, edges, face, label, line, tag } from "@/three/build"
import { extrude, roundedRect } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 2.1.2–2.1.4 「零件的 6 个自由度与配合」: a fixed base with a hole and a
 * free lever with a pin. Arrows show the lever's remaining degrees of
 * freedom; the learner adds mates one at a time (同心, 重合, 角度), drags
 * the lever along what is left, then adds a redundant parallel mate and
 * sees it conflict (过定义).
 */
export type Dof = "tx" | "ty" | "tz" | "rx" | "ry" | "rz"
export const DOFS: { id: Dof; name: string }[] = [
  { id: "tx", name: "沿 X 移动" },
  { id: "ty", name: "沿 Y 移动" },
  { id: "tz", name: "沿 Z 移动" },
  { id: "rx", name: "绕 X 转动" },
  { id: "ry", name: "绕 Y 转动" },
  { id: "rz", name: "绕 Z 转动" },
]

export type AsmState = {
  step: number
  pos: [number, number, number]
  quat: [number, number, number, number]
  concentric: boolean
  coincident: boolean
  angleMate: boolean
  /** Angle mate value: lever's long side vs the base's front face, degrees. */
  angle: number
  parallel: boolean
  used: Dof[]
  slid: boolean
  turned: number
  triedParallel: boolean
}

/** The fixed base: 100 × 70 × 16 with a through hole. */
const BASE = { w: 100, d: 70, h: 16 }
const HOLE = { x: -25, y: 0, r: 6 }
/** The lever: a 16 mm wide, 8 mm thick bar; local origin = pin axis on its bottom face. */
const LEVER = { len: 78, w: 16, t: 8 }
const PIN = { r: 5.6, len: 14 }

const FREE_POS: [number, number, number] = [12, -34, 50]
const FREE_QUAT = (() => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(14), THREE.MathUtils.degToRad(-10), THREE.MathUtils.degToRad(28)))
  return [q.x, q.y, q.z, q.w] as [number, number, number, number]
})()

/** Which degrees of freedom each mate removes, and what is left. */
export function derive(s: AsmState) {
  const removed = new Set<Dof>()
  if (s.concentric) for (const d of ["tx", "ty", "rx", "ry"] as Dof[]) removed.add(d)
  if (s.coincident) for (const d of ["tz", "rx", "ry"] as Dof[]) removed.add(d)
  if (s.angleMate || s.parallel) removed.add("rz")
  const free = DOFS.map((d) => d.id).filter((d) => !removed.has(d))
  const both = s.angleMate && s.parallel
  const conflict = both && Math.round(s.angle) % 180 !== 0
  return { free, removed, conflict, redundant: both && !conflict }
}

const AXES: Record<"x" | "y" | "z", THREE.Vector3> = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

const yawOf = (q: THREE.Quaternion) => {
  const x = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  return THREE.MathUtils.radToDeg(Math.atan2(x.y, x.x))
}
const yawQuat = (deg: number) => new THREE.Quaternion().setFromAxisAngle(AXES.z, THREE.MathUtils.degToRad(deg))
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

type Drag = {
  dof: Dof
  axis: THREE.Vector3
  pivot: THREE.Vector3
  pos0: THREE.Vector3
  quat0: THREE.Quaternion
  t0: number
  a0: number
  x0: number
}

export class AssemblyScene extends LessonScene<AsmState> {
  private lever = new THREE.Group()
  private ghost = new THREE.Group()
  private handles = new THREE.Group()
  private marks = new THREE.Group()
  private mats: Record<"x" | "y" | "z", THREE.MeshBasicMaterial>
  private grab = new THREE.MeshBasicMaterial({ visible: false })
  private drag: Drag | null = null
  private yawAtStep = 0

  constructor(v: Viewer, emit: (s: AsmState) => void) {
    super(v, emit, {
      step: 0,
      pos: [...FREE_POS],
      quat: [...FREE_QUAT],
      concentric: false,
      coincident: false,
      angleMate: false,
      angle: 40,
      parallel: false,
      used: [],
      slid: false,
      turned: 0,
      triedParallel: false,
    })
    v.setGrid(120, 10)
    const kit = v.kit
    const handleMat = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })
    this.mats = { x: handleMat(), y: handleMat(), z: handleMat() }
    this.own(() => {
      for (const m of [...Object.values(this.mats), this.grab]) m.dispose()
    })

    // Base: fixed in space (the first part in an assembly usually is).
    const baseShape = roundedRect(new THREE.Shape(), BASE.w, BASE.d, 0)
    baseShape.holes.push(new THREE.Path().absarc(HOLE.x, HOLE.y, HOLE.r, 0, Math.PI * 2, true))
    const base = face(extrude(baseShape, BASE.h, { curveSegments: 40 }), kit, { role: "modelDark", part: "base" })
    this.root.add(base, tag("底座 · 固定", new THREE.Vector3(BASE.w / 2 - 6, -BASE.d / 2, BASE.h + 2)))

    // Lever with its pin, built once and moved by the pose.
    for (const target of [this.lever, this.ghost]) {
      const bar = roundedRect(new THREE.Shape(), LEVER.len + LEVER.w / 2, LEVER.w, LEVER.w / 2, (LEVER.len - LEVER.w / 2) / 2, 0)
      const role = target === this.ghost ? "ghost" : "model"
      const ghostEdges = (m: THREE.Mesh) => {
        if (target === this.ghost) {
          const e = edges(m.geometry, kit, 30)
          e.material = kit.edgeGhost
          m.add(e)
        }
        return m
      }
      target.add(ghostEdges(face(extrude(bar, LEVER.t, { curveSegments: 24 }), kit, { role, part: "lever", edges: target === this.ghost ? false : 30 })))
      const pin = new THREE.CylinderGeometry(PIN.r, PIN.r, PIN.len, 40)
      pin.rotateX(Math.PI / 2)
      pin.translate(0, 0, -PIN.len / 2)
      target.add(ghostEdges(face(pin, kit, { role, part: "lever", edges: target === this.ghost ? false : 30 })))
    }
    this.root.add(this.lever, this.ghost, this.handles, this.marks)

    const el = v.renderer.domElement
    const down = (e: PointerEvent) => this.onDown(e)
    const move = (e: PointerEvent) => this.onMove(e)
    const up = () => this.onUp()
    el.addEventListener("pointerdown", down, { capture: true })
    el.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    this.own(() => {
      el.removeEventListener("pointerdown", down, { capture: true })
      el.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    })
  }

  enter(step: number) {
    const mates: Partial<AsmState> = {
      concentric: step >= 2,
      coincident: step >= 3,
      angleMate: step >= 4,
      parallel: false,
    }
    const patch: Partial<AsmState> = { step, ...mates }
    if (step === 0) Object.assign(patch, { pos: [...FREE_POS], quat: [...FREE_QUAT], used: [] })
    if (step === 1 && (this.state.concentric || this.state.coincident)) Object.assign(patch, { pos: [...FREE_POS], quat: [...FREE_QUAT] })
    if (step === 4) patch.angle = 40
    this.set(patch)
    this.snap(true)
    this.yawAtStep = yawOf(this.q())
    if (step === 1) this.set({ slid: false })
    if (step === 2) this.set({ turned: 0 })
    this.v.flyTo(new THREE.Vector3(195, -265, 215), new THREE.Vector3(-4, 0, 22), 800)
  }

  // ------------------------------------------------------------ actions

  addConcentric() {
    if (this.state.concentric) return
    this.set({ concentric: true })
    this.snap(true)
  }

  addCoincident() {
    if (this.state.coincident || !this.state.concentric) return
    this.set({ coincident: true })
    this.snap(true)
  }

  addAngle() {
    if (this.state.angleMate) return
    this.set({ angleMate: true, angle: 40 })
    this.snap(true)
  }

  setAngle(angle: number) {
    this.set({ angle: Math.round(angle) })
    this.snap(false)
  }

  setParallel(on: boolean) {
    this.set({ parallel: on, triedParallel: this.state.triedParallel || on })
  }

  /** Move the lever to the pose its mates demand (animated when it visibly jumps). */
  private snap(animate: boolean) {
    const s = this.state
    const from = { p: new THREE.Vector3(...s.pos), q: this.q() }
    const to = { p: from.p.clone(), q: from.q.clone() }
    if (s.concentric || s.coincident) to.q.copy(yawQuat(yawOf(from.q)))
    if (s.concentric) to.p.set(HOLE.x, HOLE.y, s.coincident ? BASE.h : BASE.h + 24)
    if (s.angleMate) to.q.copy(yawQuat(s.angle))
    if (from.p.distanceTo(to.p) < 1e-3 && from.q.angleTo(to.q) < 1e-4) return
    const apply = (k: number) => {
      const p = from.p.clone().lerp(to.p, k)
      const q = from.q.clone().slerp(to.q, k)
      this.set({ pos: [p.x, p.y, p.z], quat: [q.x, q.y, q.z, q.w] })
    }
    if (animate) this.v.tweens.run(800, apply, { tag: "mate" })
    else apply(1)
  }

  private q() {
    return new THREE.Quaternion(...this.state.quat)
  }

  /** Where the gizmo sits: on the pin axis, on top of the lever. */
  private pivot() {
    return new THREE.Vector3(0, 0, LEVER.t + 0.5).applyQuaternion(this.q()).add(new THREE.Vector3(...this.state.pos))
  }

  // ------------------------------------------------------------ dragging

  private onDown(e: PointerEvent) {
    if (e.button !== 0) return
    const hit = this.v.pick(e, [this.handles], true)
    const dof = hit?.object.userData.dof as Dof | undefined
    if (!dof || !derive(this.state).free.includes(dof)) return
    e.stopImmediatePropagation()
    this.v.controls.enabled = false
    this.v.tweens.cancel("mate")
    const axis = AXES[dof[1] as "x" | "y" | "z"].clone()
    const pivot = this.pivot()
    this.drag = { dof, axis, pivot, pos0: new THREE.Vector3(...this.state.pos), quat0: this.q(), t0: 0, a0: 0, x0: e.clientX }
    if (dof[0] === "t") this.drag.t0 = this.axisParam(e, pivot, axis) ?? 0
    else this.drag.a0 = this.angleAt(e, pivot, axis) ?? 0
  }

  private onMove(e: PointerEvent) {
    const d = this.drag
    if (!d) {
      const hit = this.v.pick(e, [this.handles], true)
      this.v.renderer.domElement.style.cursor = hit ? "grab" : ""
      return
    }
    const s = this.state
    const used = s.used.includes(d.dof) ? s.used : [...s.used, d.dof]
    if (d.dof[0] === "t") {
      const t = this.axisParam(e, d.pivot, d.axis)
      if (t === null) return
      const p = d.pos0.clone().addScaledVector(d.axis, t - d.t0)
      if (s.concentric) p.z = THREE.MathUtils.clamp(p.z, BASE.h, 70)
      else p.set(THREE.MathUtils.clamp(p.x, -90, 90), THREE.MathUtils.clamp(p.y, -90, 90), THREE.MathUtils.clamp(p.z, 30, 95))
      this.set({ pos: [p.x, p.y, p.z], used, slid: s.slid || (s.step === 1 && d.dof === "tz" && Math.abs(p.z - d.pos0.z) > 4) })
    } else {
      const a = this.angleAt(e, d.pivot, d.axis)
      const delta = a === null ? (e.clientX - d.x0) * 0.012 : a - d.a0
      const r = new THREE.Quaternion().setFromAxisAngle(d.axis, delta)
      const q = r.clone().multiply(d.quat0)
      const p = d.pos0.clone().sub(d.pivot).applyQuaternion(r).add(d.pivot)
      const turned = s.step === 2 ? Math.max(s.turned, Math.abs(wrap(yawOf(q) - this.yawAtStep))) : s.turned
      this.set({ pos: [p.x, p.y, p.z], quat: [q.x, q.y, q.z, q.w], used, turned })
    }
  }

  private onUp() {
    if (!this.drag) return
    this.drag = null
    this.v.controls.enabled = true
  }

  /** Parameter along the line (pivot, axis) closest to the pointer ray. */
  private axisParam(e: PointerEvent, o: THREE.Vector3, u: THREE.Vector3) {
    const ray = this.v.ray(e)
    const w0 = ray.origin.clone().sub(o)
    const b = ray.direction.dot(u)
    const den = 1 - b * b
    if (Math.abs(den) < 1e-4) return null
    const d = ray.direction.dot(w0)
    const ee = u.dot(w0)
    return (ee - b * d) / den
  }

  /** Pointer angle around the axis, in the plane through the pivot; null when that plane is edge-on. */
  private angleAt(e: PointerEvent, o: THREE.Vector3, u: THREE.Vector3) {
    const ray = this.v.ray(e)
    if (Math.abs(ray.direction.dot(u)) < 0.25) return null
    const hit = this.v.rayOnPlane(e, new THREE.Plane().setFromNormalAndCoplanarPoint(u, o))
    if (!hit) return null
    const a = Math.abs(u.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const b = u.clone().cross(a)
    const v = hit.sub(o)
    return Math.atan2(v.dot(b), v.dot(a))
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const t = this.v.tokens
    this.mats.x.color.copy(t.axisX)
    this.mats.y.color.copy(t.axisY)
    this.mats.z.color.copy(t.axisZ)
    const d = derive(s)

    this.lever.position.set(...s.pos)
    this.lever.quaternion.set(...s.quat)
    for (const c of this.lever.children) {
      const m = c as THREE.Mesh
      if (m.isMesh) m.material = d.conflict ? kit.modified : kit.model
    }
    // The pose the parallel mate wants, when it fights the angle mate.
    this.ghost.visible = d.conflict
    this.ghost.position.set(...s.pos)
    this.ghost.quaternion.copy(yawQuat(0))

    // Arrows for the degrees of freedom that are still free.
    this.clear(this.handles)
    const pivot = this.pivot()
    this.handles.position.copy(pivot)
    for (const dof of d.free) this.handles.add(this.handle(dof))

    this.clear(this.marks)
    const top = BASE.h + LEVER.t
    if (s.concentric) {
      this.marks.add(line([new THREE.Vector3(HOLE.x, HOLE.y, -6), new THREE.Vector3(HOLE.x, HOLE.y, Math.max(s.pos[2] + 34, 60))], kit.construction))
      this.marks.add(tag("同心1", new THREE.Vector3(HOLE.x, HOLE.y, Math.max(s.pos[2] + 36, 62))))
    }
    if (s.coincident) this.marks.add(tag("重合1", new THREE.Vector3(HOLE.x - 14, -BASE.d / 2 + 4, BASE.h + 0.5)))
    if (s.angleMate) {
      const r = 46
      const a1 = THREE.MathUtils.degToRad(s.angle)
      const n = 32
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= n; i++) {
        const a = (a1 * i) / n
        pts.push(new THREE.Vector3(HOLE.x + Math.cos(a) * r, HOLE.y + Math.sin(a) * r, top + 0.5))
      }
      this.marks.add(line([new THREE.Vector3(HOLE.x, HOLE.y, top + 0.5), new THREE.Vector3(HOLE.x + r + 8, HOLE.y, top + 0.5)], kit.construction))
      if (pts.length > 1 && s.angle > 0) this.marks.add(line(pts, kit.dimension))
      const mid = a1 / 2
      this.marks.add(
        label(`角度1 · ${s.angle}°`, new THREE.Vector3(HOLE.x + Math.cos(mid) * (r + 10), HOLE.y + Math.sin(mid) * (r + 10), top + 1), d.conflict ? "border-destructive text-destructive" : ""),
      )
    }
    if (d.conflict) {
      this.marks.add(label("平行1 要它在这里", new THREE.Vector3(HOLE.x + LEVER.len + 6, HOLE.y, top + 4), "border-destructive text-destructive font-sans"))
    }
    if (s.step === 0) {
      // Faint drop line so the floating part reads as "above the base".
      const p = new THREE.Vector3(...s.pos)
      this.marks.add(edgeLine([p.clone().setZ(BASE.h), p.clone().setZ(p.z - PIN.len)], kit, true))
    }
    this.v.invalidate()
  }

  private handle(dof: Dof) {
    const ax = dof[1] as "x" | "y" | "z"
    const mat = this.mats[ax]
    const g = new THREE.Group()
    const tagIt = (o: THREE.Object3D) => {
      o.userData.dof = dof
      o.renderOrder = 10
      return o
    }
    if (dof[0] === "t") {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 10), mat)
      const h1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 16), mat)
      h1.position.y = 23
      const h2 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 16), mat)
      h2.position.y = -23
      h2.rotation.z = Math.PI
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 52, 8), this.grab)
      g.add(tagIt(shaft), tagIt(h1), tagIt(h2), tagIt(hit))
      // Cylinders run along +Y; turn them onto the axis.
      if (ax === "x") g.rotation.z = -Math.PI / 2
      if (ax === "z") g.rotation.x = Math.PI / 2
    } else {
      const R = 15
      const sweep = Math.PI * 1.6
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 8, 48, sweep), mat)
      const head = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.5, 16), mat)
      head.position.set(Math.cos(sweep) * R, Math.sin(sweep) * R, 0)
      head.rotation.z = sweep
      const hit = new THREE.Mesh(new THREE.TorusGeometry(R, 3.2, 6, 32, sweep), this.grab)
      g.add(tagIt(ring), tagIt(head), tagIt(hit))
      // Torus lies in XY (around Z); turn it to circle the right axis.
      if (ax === "x") g.rotation.y = Math.PI / 2
      if (ax === "y") g.rotation.x = Math.PI / 2
    }
    return g
  }
}
