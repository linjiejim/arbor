import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { face, label, line } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import { cap, circle, rect, walls, WORLD } from "./coordinates.solid"
import { LessonScene } from "./scene"

/**
 * 3.2.1 「尺寸公差与配合」: a Ø20 hole in a housing and a Ø20 shaft above it,
 * cut in half through the axis so the gap (or the overlap) shows. The
 * learner picks tolerance classes; the band diagram (公差带图) in the
 * overlay and the 3D sizes follow. Dragging the shaft down tries to fit it
 * by hand: with clearance it drops in and rocks, with interference it stops
 * at the hole and has to be pressed in.
 *
 * Deviations from nominal are exaggerated 100× in 3D (1 µm shows as 0.1 mm
 * on the diameter); the numbers in the panel are the real ones.
 */

// ------------------------------------------------------------------ ISO 286 values

/**
 * Limit deviations in µm for nominal sizes over 18 up to 30 mm (so Ø20 and
 * Ø25 alike), from ISO 286-2:2010 Tables 2–17, identical in GB/T 1800.2-2020.
 * Every value was checked against two independent copies of the ISO 286-2
 * tables (roymech.co.uk ISO_286_2H / ISO_286_2S, and the simplybearings.co.uk
 * ISO limits tables); s6 against metricmech.com's ISO 286 table and the
 * ASME B4.2 preferred fits for 20 mm (H7/s6: shaft 20.035–20.048).
 * Holes: [ES, EI]. Shafts: [es, ei].
 */
export const HOLES = {
  H6: [13, 0],
  H7: [21, 0],
  H8: [33, 0],
  H9: [52, 0],
  F8: [53, 20],
  G7: [28, 7],
  K7: [6, -15],
  N7: [-7, -28],
  P7: [-14, -35],
} as const
export const SHAFTS = {
  f7: [-20, -41],
  g6: [-7, -20],
  h6: [0, -13],
  h7: [0, -21],
  k6: [15, 2],
  n6: [28, 15],
  p6: [35, 22],
  s6: [48, 35],
} as const
/** Standard tolerance grades, µm, over 18 up to 30 mm (ISO 286-1:2010 Table 1 = GB/T 1800.1-2020 表 1). */
export const IT: Record<number, number> = { 5: 9, 6: 13, 7: 21, 8: 33, 9: 52 }
/** IT7 across neighbouring size ranges (same table): the same grade is wider on a bigger part. */
export const IT7_BY_SIZE: [string, number][] = [
  ["10–18", 18],
  ["18–30", 21],
  ["30–50", 25],
  ["50–80", 30],
]
export const NOMINAL = 20

export type HoleId = keyof typeof HOLES
export type ShaftId = keyof typeof SHAFTS
export type FitKind = "clearance" | "transition" | "interference"
export const FIT_NAME: Record<FitKind, string> = { clearance: "间隙配合", transition: "过渡配合", interference: "过盈配合" }

export type Fit = { kind: FitKind; maxClear: number; minClear: number }

/** Max clearance = ES − ei, min clearance = EI − es (negative = interference). */
export function fitOf(hole: HoleId, shaft: ShaftId): Fit {
  const [ES, EI] = HOLES[hole]
  const [es, ei] = SHAFTS[shaft]
  const maxClear = ES - ei
  const minClear = EI - es
  const kind: FitKind = minClear >= 0 ? "clearance" : maxClear <= 0 ? "interference" : "transition"
  return { kind, maxClear, minClear }
}

/** µm → "+0.041" style millimetres. */
export const mm = (um: number) => `${um > 0 ? "+" : um < 0 ? "−" : ""}${(Math.abs(um) / 1000).toFixed(3)}`
/** Actual size in mm for a deviation. */
export const size = (um: number) => (NOMINAL + um / 1000).toFixed(3)

// ------------------------------------------------------------------ state

/** Which actual pair is shown: band middles, the loosest pair, the tightest, a random one, or a hole size set by hand. */
export type Pair = "mid" | "loose" | "tight" | "sample" | "custom"
export type System = "hole" | "shaft"

export type FitState = {
  step: number
  system: System
  hole: HoleId
  shaft: ShaftId
  pair: Pair
  /** Actual deviations (µm) of the hole and the shaft in 3D. */
  dHole: number
  dShaft: number
  /** 0: shaft above the hole … 1: all the way in. */
  insert: number
  pressed: boolean
  /** The learner pushed and the shaft wouldn't go in. */
  blocked: boolean
  grades: HoleId[]
  sawOut: boolean
  letters: ShaftId[]
  fits: FitKind[]
  /** Clearances (µm) of the random pairs drawn in step 4. */
  samples: number[]
  pairs: string[]
}

// ------------------------------------------------------------------ the scene (mm)

const BLOCK = { x: 30, y: 20, h: 24 }
const LEN = 52
/** Shaft bottom height when it hovers above the hole, and when it's all the way in. */
const Z_UP = BLOCK.h + 8
const Z_IN = 0
const ENTRY = (Z_UP - BLOCK.h) / (Z_UP - Z_IN)
/** Exaggeration of the deviations in 3D. */
export const EXAG = 100
const radius = (um: number) => (NOMINAL + (um * EXAG) / 1000) / 2

const initial = (): FitState => ({
  step: 0,
  system: "hole",
  hole: "H7",
  shaft: "g6",
  pair: "mid",
  dHole: 10.5,
  dShaft: -13.5,
  insert: 0,
  pressed: false,
  blocked: false,
  grades: ["H7"],
  sawOut: false,
  letters: [],
  fits: [],
  samples: [],
  pairs: [],
})

export class ToleranceFitsScene extends LessonScene<FitState> {
  private housing = new THREE.Group()
  private shaftG = new THREE.Group()
  private marks = new THREE.Group()
  private ram = new THREE.Group()
  private handle: CSS2DObject
  private tilt = 0
  private ramZ: number | null = null
  private builtHole = NaN
  private builtTone = ""
  /** Hole wall coloured by the step 1 check: inside the band or not. */
  private okMat: THREE.MeshStandardMaterial
  private badMat: THREE.MeshStandardMaterial
  /** The shaft stays whole (not cut by the section), so its outline reads against the cut hole. */
  private shaftMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.55 })
  private ramMat = new THREE.MeshStandardMaterial({ roughness: 0.6 })

  constructor(v: Viewer, emit: (s: FitState) => void) {
    super(v, emit, initial())
    v.setGrid(80, 10)
    v.kit.setSection(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    this.own(() => v.kit.setSection(null))
    this.okMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide, clippingPlanes: v.kit.clipping })
    this.badMat = this.okMat.clone()
    this.own(() => this.okMat.dispose())
    this.own(() => this.badMat.dispose())
    this.own(() => this.shaftMat.dispose())
    this.own(() => this.ramMat.dispose())
    this.handle = this.makeHandle()
    this.root.add(this.housing, this.shaftG, this.marks, this.ram, this.handle)
  }

  enter(step: number) {
    this.v.tweens.cancel("press")
    this.v.tweens.cancel("wobble")
    this.v.tweens.cancel("insert")
    this.tilt = 0
    this.ramZ = null
    const presets: [HoleId, ShaftId, Pair][] = [
      ["H7", "g6", "custom"],
      ["H7", this.state.letters.length ? this.state.shaft : "g6", "mid"],
      ["H7", "g6", "tight"],
      ["H7", "k6", "mid"],
      ["H7", "g6", "tight"],
    ]
    const [hole, shaft, pair] = presets[step]
    const pairs = step === 4 && !this.state.pairs.includes("H7/g6") ? [...this.state.pairs, "H7/g6"] : this.state.pairs
    this.set({ step, insert: 0, pressed: false, blocked: false, system: "hole", hole, shaft, pairs, ...this.pairPatch(hole, shaft, pair) })
    // The band diagram covers the left of the viewport: aim left of the part so it sits on the right.
    const target = new THREE.Vector3(-38, 0, step === 0 ? 30 : 42)
    this.v.flyTo(target.clone().add(new THREE.Vector3(0.38, -1, 0.3).normalize().multiplyScalar(step === 0 ? 250 : 300)), target, 800)
  }

  // ------------------------------------------------------------ actions

  setHole(hole: HoleId) {
    const s = this.state
    const grades = s.grades.includes(hole) ? s.grades : [...s.grades, hole]
    const patch: Partial<FitState> = { hole, grades, insert: 0, pressed: false, blocked: false, ...this.pairPatch(hole, s.shaft, s.pair) }
    if (s.pair === "custom") patch.dHole = s.dHole
    this.set(patch)
    this.notePair()
    this.checkOut()
  }

  setShaft(shaft: ShaftId) {
    const s = this.state
    const letters = s.letters.includes(shaft) ? s.letters : [...s.letters, shaft]
    this.set({ shaft, letters, insert: 0, pressed: false, blocked: false, ...this.pairPatch(s.hole, shaft, s.pair === "sample" ? "mid" : s.pair) })
    this.notePair()
  }

  /** 基孔制 keeps the hole at H7 and changes the shaft; 基轴制 keeps the shaft at h6. */
  setSystem(system: System) {
    const s = this.state
    const hole: HoleId = "H7"
    const shaft: ShaftId = system === "hole" ? "g6" : "h6"
    this.set({ system, hole, shaft, insert: 0, pressed: false, blocked: false, ...this.pairPatch(hole, shaft, s.pair) })
    this.notePair()
  }

  setPair(pair: Pair) {
    const s = this.state
    this.set({ insert: 0, pressed: false, blocked: false, ...this.pairPatch(s.hole, s.shaft, pair) })
  }

  /** Step 1: the actual size the hole came out at. */
  setActualHole(um: number) {
    this.set({ pair: "custom", dHole: um, insert: 0, pressed: false })
    this.checkOut()
  }

  /** A random hole and a random shaft from their tolerance bands. */
  sample() {
    const s = this.state
    const [ES, EI] = HOLES[s.hole]
    const [es, ei] = SHAFTS[s.shaft]
    const dHole = Math.round(EI + Math.random() * (ES - EI))
    let dShaft = Math.round(ei + Math.random() * (es - ei))
    // An exact zero would be neither: nudge it so every pair is clearly one or the other.
    if (dHole === dShaft) dShaft += Math.random() < 0.5 ? 1 : -1
    dShaft = Math.max(ei, Math.min(es, dShaft))
    const samples = [...s.samples, dHole - dShaft].slice(-24)
    this.set({ pair: "sample", dHole, dShaft, samples, insert: 0, pressed: false, blocked: false })
  }

  /** Drop the shaft in by hand (the Predict reveal and the 「推进去」 button). */
  pushIn() {
    const from = this.state.insert
    const free = this.state.dHole - this.state.dShaft >= 0
    const to = free ? 1 : ENTRY
    this.v.tweens.run(free ? 900 : 500, (k) => this.setInsert(from + (to - from) * k), { tag: "insert" }).then(() => {
      if (!free) this.set({ blocked: true })
      else this.landed()
    })
  }

  /** Press the shaft in: a ram comes down and pushes it home. */
  press() {
    const s = this.state
    if (s.pressed || s.dHole - s.dShaft >= 0) return
    this.set({ blocked: true, pressed: true })
    const from = Math.max(s.insert, ENTRY)
    this.v.tweens
      .run(1400, (k) => {
        const ramTop = Z_UP + LEN + 10
        const contact = this.shaftBottom(from) + LEN
        // The ram drops onto the shaft in the first quarter, then pushes it down.
        if (k < 0.25) this.ramZ = ramTop + (contact - ramTop) * (k / 0.25)
        else {
          const ins = from + (1 - from) * ((k - 0.25) / 0.75)
          this.state.insert = ins
          this.ramZ = this.shaftBottom(ins) + LEN
        }
        this.render()
      }, { tag: "press" })
      .then(() => {
        this.ramZ = null
        this.set({ insert: 1 })
        this.landed()
      })
  }

  /** Called by dragging and by the push animation. With interference the shaft stops at the hole (zero clearance still slides). */
  private setInsert(k: number) {
    const s = this.state
    let insert = Math.max(0, Math.min(1, k))
    let blocked = s.blocked
    if (!s.pressed && s.dHole - s.dShaft < 0 && insert > ENTRY) {
      insert = ENTRY
      blocked = true
    }
    if (insert !== s.insert || blocked !== s.blocked) this.set({ insert, blocked })
  }

  private landed() {
    const s = this.state
    if (s.insert < 0.999) return
    const kind = fitOf(s.hole, s.shaft).kind
    if (s.step === 2 && !s.fits.includes(kind)) this.set({ fits: [...s.fits, kind] })
    const gap = s.dHole - s.dShaft
    if (gap <= 0) return
    // A loose shaft rocks in its hole: the tilt the clearance allows over the engaged length.
    const max = ((gap * EXAG) / 1000 / BLOCK.h) * 0.9
    this.v.tweens.run(1600, (k) => {
      this.tilt = max * Math.sin(k * Math.PI * 4) * (1 - k)
      this.render()
    }, { tag: "wobble", ease: (t) => t })
  }

  private notePair() {
    const s = this.state
    if (s.step !== 4) return
    const key = `${s.hole}/${s.shaft}`
    if (!s.pairs.includes(key)) this.set({ pairs: [...s.pairs, key] })
  }

  private checkOut() {
    const s = this.state
    if (s.step !== 0 || s.sawOut) return
    const [ES, EI] = HOLES[s.hole]
    if (s.dHole > ES || s.dHole < EI) this.set({ sawOut: true })
  }

  private pairPatch(hole: HoleId, shaft: ShaftId, pair: Pair): Partial<FitState> {
    const [ES, EI] = HOLES[hole]
    const [es, ei] = SHAFTS[shaft]
    if (pair === "loose") return { pair, dHole: ES, dShaft: ei }
    if (pair === "tight") return { pair, dHole: EI, dShaft: es }
    // A new random pair is drawn on demand; until then show the band middles.
    return { pair: pair === "sample" ? "mid" : pair, dHole: (ES + EI) / 2, dShaft: (es + ei) / 2 }
  }

  private shaftBottom(insert: number) {
    return Z_UP + (Z_IN - Z_UP) * insert
  }

  // ------------------------------------------------------------ build

  private makeHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-colors hover:bg-selected"
    el.title = "往下拖，把轴装进孔里"
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      this.v.tweens.cancel("wobble")
      this.tilt = 0
      const cam = this.v.camera.position
      const plane = new THREE.Plane(new THREE.Vector3(cam.x, cam.y, 0).normalize(), 0)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const bottom = hit.z - LEN
        this.setInsert((Z_UP - bottom) / (Z_UP - Z_IN))
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = true
        this.landed()
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    return new CSS2DObject(el)
  }

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const rh = radius(s.dHole)
    const rs = radius(s.dShaft)

    // Step 1 colours the hole wall: inside the tolerance band or out of it.
    const [ES, EI] = HOLES[s.hole]
    const tone = s.step === 0 ? (s.dHole > ES || s.dHole < EI ? "bad" : "ok") : ""
    this.okMat.color.copy(this.v.tokens.good)
    this.badMat.color.copy(this.v.tokens.bad)
    this.shaftMat.color.copy(this.v.tokens.metal)
    this.ramMat.color.copy(this.v.tokens.modelDark)
    if (rh !== this.builtHole || tone !== this.builtTone) {
      this.builtHole = rh
      this.builtTone = tone
      this.clear(this.housing)
      const outer = rect(-BLOCK.x, -BLOCK.y, BLOCK.x, BLOCK.y)
      const hole = circle(0, 0, rh, 72)
      const add = (geo: THREE.BufferGeometry) => this.housing.add(face(geo, kit, { feature: "housing" }))
      add(walls(outer, 0, BLOCK.h, WORLD))
      add(cap(outer, [hole], BLOCK.h, WORLD, true))
      add(cap(outer, [hole], 0, WORLD, false))
      const wall = face(walls(hole, 0, BLOCK.h, WORLD, { inward: true, smooth: true }), kit, { feature: "housing", edges: 40 })
      if (tone) wall.material = tone === "ok" ? this.okMat : this.badMat
      this.housing.add(wall)
    }

    // The shaft: pressed in, the part inside the hole is squeezed to the hole's size.
    this.clear(this.shaftG)
    const zb = this.shaftBottom(s.insert)
    const squeezed = s.dHole - s.dShaft < 0 && zb < BLOCK.h - 0.01
    const pieces: [number, number, number][] = squeezed ? [[zb, BLOCK.h, rh * 0.995], [BLOCK.h, zb + LEN, rs]] : [[zb, zb + LEN, rs]]
    for (const [z0, z1, r] of pieces) {
      const c = circle(0, 0, r, 72)
      for (const geo of [walls(c, z0, z1, WORLD, { smooth: true }), cap(c, [], z1, WORLD, true), cap(c, [], z0, WORLD, false)]) {
        const m = face(geo, kit, { feature: "shaft", role: "metal", edges: false })
        m.material = this.shaftMat
        this.shaftG.add(m)
      }
    }
    // A loose shaft rocks about the middle of the hole.
    const pivot = new THREE.Vector3(0, 0, BLOCK.h / 2)
    this.shaftG.position.copy(pivot).sub(pivot.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.tilt))
    this.shaftG.rotation.set(0, this.tilt, 0)

    // The ram of the press.
    this.clear(this.ram)
    if (this.ramZ !== null) {
      const g = new THREE.BoxGeometry(32, 32, 10)
      g.translate(0, 0, this.ramZ + 5)
      const m = face(g, kit, { feature: "press", role: "modelDark", edges: false })
      m.material = this.ramMat
      this.ram.add(m)
    }

    // Labels and the nominal Ø20 ring (the zero line, in 3D).
    this.clear(this.marks)
    const ring: THREE.Vector3[] = []
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI
      ring.push(new THREE.Vector3(Math.cos(a) * (NOMINAL / 2), Math.sin(a) * (NOMINAL / 2), BLOCK.h + 0.2))
    }
    this.marks.add(line(ring, kit.construction))
    const holeTag = label(`孔 Ø${size(s.dHole)}`, new THREE.Vector3(-BLOCK.x, 0, BLOCK.h * 0.55), "font-sans")
    holeTag.center.set(1.08, 0.5)
    const shaftTag = label(`轴 Ø${size(s.dShaft)}`, new THREE.Vector3(-rs, 0, zb + LEN * 0.7), "font-sans")
    shaftTag.center.set(1.1, 0.5)
    this.marks.add(holeTag)
    if (s.step > 0) this.marks.add(shaftTag)
    if (s.blocked && !s.pressed && s.dHole - s.dShaft < 0) {
      const t = label("推不进去：轴比孔大", new THREE.Vector3(rs + 2, 0, BLOCK.h + 4), "border-warning text-warning font-sans")
      t.center.set(0, 0.5)
      this.marks.add(t)
    }

    this.shaftG.visible = s.step > 0
    this.handle.visible = s.step >= 2 && this.ramZ === null && !s.pressed
    this.handle.position.set(0, 0, zb + LEN)
    this.v.invalidate()
  }
}
