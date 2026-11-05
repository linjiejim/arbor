import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { datumPlane, edgeLine, face, label, line } from "@/three/build"
import { flipFaces, lathe, ringPoints, type V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 1.2.2 「旋转」: a half profile on the front plane, revolved about the Z
 * axis. The learner drags profile points, scrubs the angle, moves the axis
 * away (a ring), and drags a point across the axis (the classic failure).
 */
export type RevolveState = {
  step: number
  pts: V2[]
  angle: number
  dragged: boolean
  axisOffset: number
  crossed: boolean
  triedCross: boolean
  triedHalf: boolean
  triedOffset: boolean
}

const PROFILE: V2[] = [
  [0, 0],
  [22, 0],
  [24, 6],
  [14, 26],
  [16, 44],
  [19, 52],
  [0, 52],
]
/** Indices of the points the learner may drag (the outline, not the axis ends). */
const EDITABLE = [1, 3, 4, 5]

export class RevolveScene extends LessonScene<RevolveState> {
  private profile = new THREE.Group()
  private solid = new THREE.Group()
  private handles: CSS2DObject[] = []

  constructor(v: Viewer, emit: (s: RevolveState) => void) {
    super(v, emit, {
      step: 0,
      pts: PROFILE.map((p) => [...p] as V2),
      angle: 0,
      dragged: false,
      axisOffset: 0,
      crossed: false,
      triedCross: false,
      triedHalf: false,
      triedOffset: false,
    })
    v.setGrid(100, 10)
    const plane = datumPlane(v.kit, "XZ", 120, "前视基准面")
    plane.position.set(12, 0, 30)
    this.root.add(plane, this.profile, this.solid)
    this.handles = EDITABLE.map((i) => this.handle(i))
    this.root.add(...this.handles)
  }

  enter(step: number) {
    const patch: Partial<RevolveState> = { step }
    if (step >= 2 && this.state.angle < 360) patch.angle = 360
    if (step <= 1) patch.angle = step === 0 ? 0 : this.state.angle
    if (step === 0 || step === 1) patch.axisOffset = 0
    if (step !== 3 && this.state.crossed) Object.assign(patch, { pts: PROFILE.map((p) => [...p] as V2), crossed: false })
    this.set(patch)
    const v = this.v
    if (step === 0) v.setView("front", { target: new THREE.Vector3(10, 0, 26), distance: 210 })
    else v.flyTo(new THREE.Vector3(130, -150, 120), new THREE.Vector3(0, 0, 24), 800)
  }

  setAngle(angle: number) {
    this.set({ angle, triedHalf: this.state.triedHalf || (angle >= 150 && angle <= 210) })
  }

  /** Animate the revolve from 0 to the given angle (the "play" of the process slider). */
  play(to = 360) {
    this.v.tweens.run(1400, (k) => this.setAngle(Math.round(to * k)), { tag: "revolve" })
  }

  setAxisOffset(d: number) {
    this.set({ axisOffset: d, triedOffset: this.state.triedOffset || d >= 10 })
  }

  reset() {
    this.set({ pts: PROFILE.map((p) => [...p] as V2), crossed: false })
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const off = s.axisOffset
    const shifted: V2[] = s.pts.map(([r, z], i) => [i === 0 || i === s.pts.length - 1 ? (off > 0 ? off : 0) : r + off, z])
    // With an offset axis the profile is a closed loop away from the axis: drop the axis segment.
    const loop: V2[] = off > 0 ? shifted.slice(1, -1).concat([[off + 2, 52], [off + 2, 0]]) : shifted
    const crossed = loop.some(([r]) => r < -0.01)

    this.clear(this.profile)
    const pts3 = [...loop, loop[0]].map(([r, z]) => new THREE.Vector3(r, -0.05, z))
    this.profile.add(line(pts3, crossed ? kit.sketchThin : kit.sketch))
    if (crossed) this.profile.add(label("轮廓越过了旋转轴", new THREE.Vector3(0, 0, 58), "border-destructive text-destructive font-sans"))
    this.profile.add(line([new THREE.Vector3(0, 0, -8), new THREE.Vector3(0, 0, 62)], kit.construction))
    this.profile.add(label("旋转轴", new THREE.Vector3(0, 0, 64), "border-transparent bg-transparent font-sans text-faint-foreground"))

    this.clear(this.solid)
    if (!crossed && s.angle > 0) {
      const phi = THREE.MathUtils.degToRad(Math.min(360, s.angle))
      const ccw = signedArea(loop) > 0 ? loop : [...loop].reverse()
      for (let i = 0; i < ccw.length; i++) {
        const a = ccw[i]
        const b = ccw[(i + 1) % ccw.length]
        if (a[0] < 0.01 && b[0] < 0.01) continue // the axis itself makes no surface
        const geo = lathe([a, b], phi)
        this.solid.add(face(geo, kit, { feature: "revolve", edges: false }))
        if (a[0] > 0.01) this.solid.add(edgeLine(ringPoints(a[0], a[1], phi), kit))
      }
      if (phi < Math.PI * 2 - 1e-3) {
        const shape = new THREE.Shape(ccw.map(([r, z]) => new THREE.Vector2(r, z)))
        const start = new THREE.ShapeGeometry(shape)
        start.rotateX(Math.PI / 2)
        const end = flipFaces(start.clone())
        end.rotateZ(phi)
        this.solid.add(face(start, kit, { feature: "revolve", role: "highlight" }), face(end, kit, { feature: "revolve", role: "highlight" }))
      }
    }
    if (crossed !== s.crossed) queueMicrotask(() => this.set({ crossed, triedCross: s.triedCross || crossed }))

    EDITABLE.forEach((idx, k) => {
      const h = this.handles[k]
      h.visible = s.step === 0 || s.step === 3
      const [r, z] = shifted[idx]
      h.position.set(r, -0.1, z)
    })
    this.v.invalidate()
  }

  private handle(idx: number) {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-[scale] hover:scale-125"
    el.title = "拖动轮廓点"
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const pts = this.state.pts.map((p) => [...p] as V2)
        // Free on step 3 (so the point can cross the axis); otherwise kept on the right of it.
        const minR = this.state.step === 3 ? -30 : 2
        pts[idx] = [Math.round(Math.max(minR, Math.min(45, hit.x - this.state.axisOffset))), Math.round(Math.max(1, Math.min(51, hit.z)))]
        this.set({ pts, dragged: true })
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }
}

function signedArea(pts: V2[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}
