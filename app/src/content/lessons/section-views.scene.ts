import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { face, label, line } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { cap, circle, FRONT, rect, walls, WORLD } from "./coordinates.solid"
import { LessonScene } from "./scene"

/**
 * 0.2.3 「剖视」: a block with a counterbored through hole and a pocket
 * opening from the bottom (invisible from above). A section plane parallel
 * to the front plane is dragged through it; the kit's clipping fills the cut
 * solid, and the exact cross-section is drawn on the plane with optional
 * 45° hatching. The learner clicks the hollow regions that take no hatching.
 */
export type Region = "solid" | "hole" | "cavity"

export type SectionState = {
  step: number
  /** Section plane position along Y (mm). The part spans y −25…25; the front part (y < cut) is removed. */
  cut: number
  sawBelow: boolean
  hatch: boolean
  region: Region | null
  foundHole: boolean
  foundCavity: boolean
}

// The part (mm): block 90 × 50 × 30.
const BX = 45
const BY = 25
const H = 30
// Counterbored through hole on the left: Ø10 through, Ø18 × 8 deep counterbore.
const HX = -22
const HR = 5
const CR = 9
const CB_Z = 22
// A pocket opening from the bottom on the right: 30 × 26 × 18 deep.
const CAV = { x0: 5, x1: 35, y: 13, h: 18 }

const START = -32

const initial = (): SectionState => ({
  step: 0,
  cut: START,
  sawBelow: false,
  hatch: true,
  region: null,
  foundHole: false,
  foundCavity: false,
})

/** What a cut at y = d passes through. */
export function cutsThrough(d: number) {
  const a = Math.abs(d)
  return { part: a < BY, hole: a < HR, counterbore: a < CR, cavity: a < CAV.y }
}

export class SectionViewsScene extends LessonScene<SectionState> {
  private part = new THREE.Group()
  private planeGroup = new THREE.Group()
  private section = new THREE.Group()
  private planeFill: THREE.Mesh | null = null
  private handleObj: CSS2DObject
  private clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -START)
  private down: { x: number; y: number } | null = null
  private tracking = false
  private gridOn = true
  /** Flat fill for the cut, in the kit's cut colour: hides edges behind the plane that the back-face fill would let through. */
  private capMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })

  constructor(v: Viewer, emit: (s: SectionState) => void) {
    super(v, emit, initial())
    v.setGrid(100, 10)
    this.buildPart()
    this.handleObj = this.handle()
    this.root.add(this.part, this.planeGroup, this.section, this.handleObj)

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => {
      this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 4) this.onClick(e)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => el.removeEventListener("pointerdown", onDown))
    this.own(() => el.removeEventListener("pointerup", onUp))
    this.own(v.onCameraChange(() => this.checkCamera()))
    // The kit's clipping is shared by every lesson: always switch it off on the way out.
    this.own(() => v.kit.setSection(null))
    this.own(() => v.showGrid(true))
    this.own(() => this.capMat.dispose())
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<SectionState> = { step, region: null }
    if (step <= 1) patch.cut = START
    if (step === 2 && Math.abs(s.cut) >= HR) patch.cut = 3
    if (step === 3) Object.assign(patch, { cut: 0, hatch: true })
    if (step === 4 && Math.abs(s.cut) >= BY) patch.cut = 0
    this.set(patch)
    this.tracking = false
    const v = this.v
    const target = new THREE.Vector3(0, 0, 12)
    if (step === 3) v.setView("front", { target: new THREE.Vector3(0, 0, 15), distance: 300 })
    else {
      const fly = v.flyTo(target.clone().addScaledVector(new THREE.Vector3(0.85, -1.15, 0.8).normalize(), 320), target, 800)
      if (step === 0) fly.then(() => (this.tracking = this.state.step === 0))
    }
  }

  // ------------------------------------------------------------ actions

  setCut(d: number) {
    const cut = Math.max(-32, Math.min(32, Math.round(d)))
    if (cut !== this.state.cut) this.set({ cut })
  }

  /** Slide the plane to y = d (predict reveal, "对准孔中心"). */
  cutAt(d: number) {
    const from = this.state.cut
    this.v.tweens.run(900, (k) => this.setCut(from + (d - from) * k), { tag: "cut" })
  }

  view(name: "bottom" | "front" | "iso") {
    this.v.setView(name)
  }

  setHatch(on: boolean) {
    this.set({ hatch: on })
  }

  // ------------------------------------------------------------ input

  private checkCamera() {
    const v = this.v
    const dir = v.camera.position.clone().sub(v.controls.target).normalize()
    // Seen from below, the ground grid would be drawn over the part's bottom face.
    const gridOn = dir.z > -0.05
    if (gridOn !== this.gridOn) {
      this.gridOn = gridOn
      v.showGrid(gridOn)
    }
    if (!this.tracking || this.state.step !== 0 || this.state.sawBelow) return
    if (dir.z < -0.4) this.set({ sawBelow: true })
  }

  private onClick(e: PointerEvent) {
    const s = this.state
    if (s.step !== 3 || !this.planeFill) return
    const hit = this.v.pick(e, [this.planeFill], false)
    if (!hit) return
    const r = regionAt(hit.point.x, hit.point.z, s.cut)
    if (!r) return
    this.set({ region: r, foundHole: s.foundHole || r === "hole", foundCavity: s.foundCavity || r === "cavity" })
  }

  private handle() {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-transform hover:scale-125"
    el.title = "拖动剖切平面"
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(H + 8))
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (hit) this.setCut(hit.y)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    const o = new CSS2DObject(el)
    o.visible = false
    return o
  }

  // ------------------------------------------------------------ scene

  private buildPart() {
    const kit = this.v.kit
    const outer = rect(-BX, -BY, BX, BY)
    const cb = circle(HX, 0, CR)
    const hole = circle(HX, 0, HR)
    const cav = rect(CAV.x0, -CAV.y, CAV.x1, CAV.y)
    const add = (geo: THREE.BufferGeometry, name: string, smooth = false) => this.part.add(face(geo, kit, { name, edges: smooth ? 40 : 30 }))
    add(walls(outer, 0, H, WORLD), "sides")
    add(cap(outer, [cb], H, WORLD, true), "top")
    add(walls(cb, CB_Z, H, WORLD, { inward: true, smooth: true }), "counterbore", true)
    add(cap(cb, [hole], CB_Z, WORLD, true), "counterbore-floor")
    add(walls(hole, 0, CB_Z, WORLD, { inward: true, smooth: true }), "hole", true)
    add(cap(outer, [hole, cav], 0, WORLD, false), "bottom")
    add(walls(cav, 0, CAV.h, WORLD, { inward: true }), "cavity")
    add(cap(cav, [], CAV.h, WORLD, false), "cavity-ceiling")
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const d = s.cut
    const on = s.step >= 1

    this.clip.constant = -d
    kit.setSection(on ? this.clip : null)

    // The section plane itself.
    this.clear(this.planeGroup)
    this.planeFill = null
    if (on) {
      const w = BX + 12
      const z0 = -8
      const z1 = H + 8
      const corners = [new THREE.Vector3(-w, d, z0), new THREE.Vector3(w, d, z0), new THREE.Vector3(w, d, z1), new THREE.Vector3(-w, d, z1)]
      const geo = new THREE.BufferGeometry().setFromPoints([corners[0], corners[1], corners[2], corners[0], corners[2], corners[3]])
      this.planeFill = new THREE.Mesh(geo, kit.plane)
      const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners), kit.planeEdge)
      border.raycast = () => {}
      const name = label("剖切平面", new THREE.Vector3(-w, d, z1), "border-transparent bg-transparent font-sans text-faint-foreground")
      name.center.set(0, 1)
      this.planeGroup.add(this.planeFill, border, name)
    }
    this.handleObj.visible = on && s.step !== 3
    this.handleObj.position.set(BX + 12, d, H + 8)

    // The exact cross-section on the plane, and its hatching.
    this.clear(this.section)
    if (on) {
      const y = d - 0.06
      const loops = sectionLoops(d)
      this.capMat.color.copy(this.v.tokens.cut)
      for (const loop of loops) this.section.add(new THREE.Mesh(cap(loop, [], -(d - 0.02), FRONT, true), this.capMat))
      for (const loop of loops) this.section.add(line([...loop, loop[0]].map(([x, z]) => new THREE.Vector3(x, y, z)), kit.sketch))
      if (s.hatch && s.step >= 3) {
        for (const [a, b] of hatch(loops, 3)) this.section.add(line([new THREE.Vector3(a[0], y - 0.02, a[1]), new THREE.Vector3(b[0], y - 0.02, b[1])], kit.dimension))
      }
    }
    this.v.invalidate()
  }
}

// ------------------------------------------------------------------ section geometry

/** Which region of the section (x, z) falls in, at a cut y = d; null outside the part. */
export function regionAt(x: number, z: number, d: number): Region | null {
  if (Math.abs(d) >= BY || x < -BX || x > BX || z < 0 || z > H) return null
  const hw = Math.abs(d) < HR ? Math.sqrt(HR * HR - d * d) : 0
  const cw = Math.abs(d) < CR ? Math.sqrt(CR * CR - d * d) : 0
  if ((z < CB_Z && Math.abs(x - HX) < hw) || (z >= CB_Z && Math.abs(x - HX) < cw)) return "hole"
  if (Math.abs(d) < CAV.y && x > CAV.x0 && x < CAV.x1 && z < CAV.h) return "cavity"
  return "solid"
}

/** The cross-section at y = d as closed (x, z) loops, counter-clockwise. */
export function sectionLoops(d: number): V2[][] {
  if (Math.abs(d) >= BY) return []
  const hw = Math.abs(d) < HR ? Math.sqrt(HR * HR - d * d) : 0
  const cw = Math.abs(d) < CR ? Math.sqrt(CR * CR - d * d) : 0
  const pocket: V2[] = Math.abs(d) < CAV.y ? [[CAV.x0, 0], [CAV.x0, CAV.h], [CAV.x1, CAV.h], [CAV.x1, 0]] : []
  if (hw > 0) {
    const left: V2[] = [[-BX, 0], [HX - hw, 0], [HX - hw, CB_Z], [HX - cw, CB_Z], [HX - cw, H], [-BX, H]]
    const right: V2[] = [[HX + hw, 0], ...pocket, [BX, 0], [BX, H], [HX + cw, H], [HX + cw, CB_Z], [HX + hw, CB_Z]]
    return [left, right]
  }
  const top: V2[] = cw > 0 ? [[HX + cw, H], [HX + cw, CB_Z], [HX - cw, CB_Z], [HX - cw, H]] : []
  return [[[-BX, 0], ...pocket, [BX, 0], [BX, H], ...top, [-BX, H]]]
}

/** 45° hatch segments inside the loops (even-odd), `gap` mm apart. */
export function hatch(loops: V2[][], gap: number): [V2, V2][] {
  const out: [V2, V2][] = []
  if (!loops.length) return out
  const all = loops.flat()
  const cs = all.map(([x, z]) => x - z)
  const step = gap * Math.SQRT2
  const lo = Math.ceil(Math.min(...cs) / step) * step
  const hi = Math.max(...cs)
  for (let c = lo; c <= hi; c += step) {
    const ts: number[] = []
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const p = loop[i]
        const q = loop[(i + 1) % loop.length]
        const fp = p[0] - p[1] - c
        const fq = q[0] - q[1] - c
        if (fp > 0 === fq > 0) continue
        const k = fp / (fp - fq)
        ts.push(p[1] + (q[1] - p[1]) * k)
      }
    }
    ts.sort((a, b) => a - b)
    for (let i = 0; i + 1 < ts.length; i += 2) out.push([[c + ts[i], ts[i]], [c + ts[i + 1], ts[i + 1]]])
  }
  return out
}

/** Width of the hole and of the counterbore as they appear in a cut at y = d (0 when not cut). */
export function holeWidths(d: number) {
  const a = Math.abs(d)
  return { hole: a < HR ? 2 * Math.sqrt(HR * HR - d * d) : 0, counterbore: a < CR ? 2 * Math.sqrt(CR * CR - d * d) : 0 }
}
