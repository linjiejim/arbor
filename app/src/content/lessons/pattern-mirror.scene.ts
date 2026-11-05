import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { datumPlane, face, label, line, linearDim, tag } from "@/three/build"
import { extrude, lathe } from "@/three/geom"
import type { MaterialKit, SurfaceRole } from "@/three/materials"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 1.2.5 「阵列与镜像」: one seed hole on a plate → linear pattern (count ×
 * spacing vs count × total length, and what each does when the plate
 * shrinks) → edit the seed → circular pattern on a flange → mirror half a
 * bracket about the right plane.
 */
export type PatternMirrorState = {
  step: number
  seedPicked: boolean
  count: number
  spacing: number
  mode: "spacing" | "length"
  plateLen: number
  diameter: number
  diamChanged: boolean
  shrunkSpacing: boolean
  shrunkLength: boolean
  polarCount: number
  polarAngle: number
  polarSix: boolean
  triedPartial: boolean
  bossX: number
  bossY: number
  bossH: number
  mirrorEdited: boolean
}

/** Plate width (Y), thickness, and the edge margin before the first hole, mm. */
export const PLATE_W = 50
export const T = 8
export const MARGIN = 15

const FLANGE_R = 50
const FLANGE_BORE = 14
const BOLT_R = 34
const BOLT_HOLE = 4.5

const HALF_X = 45
const BOSS_R = 7
const BOSS_BORE = 3
const SEG = 32

export type HoleStatus = "in" | "edge" | "off"

/** Where the linear pattern puts its instances, and which fall off the plate. */
export function linearLayout(s: Pick<PatternMirrorState, "count" | "spacing" | "mode" | "plateLen" | "diameter">) {
  const r = s.diameter / 2
  const total = s.plateLen - 2 * MARGIN
  const spacing = s.mode === "spacing" ? s.spacing : total / Math.max(1, s.count - 1)
  const xs = Array.from({ length: s.count }, (_, i) => -s.plateLen / 2 + MARGIN + i * spacing)
  const status: HoleStatus[] = xs.map((x) => (x + r <= s.plateLen / 2 - 0.5 ? "in" : x - r >= s.plateLen / 2 ? "off" : "edge"))
  const outCount = status.filter((st) => st !== "in").length
  return { spacing, total, xs, status, outCount, overlap: spacing < s.diameter + 0.5 }
}

/** Angular step of a circular pattern: a full turn divides by n, a partial angle by n − 1. */
export function polarStep(count: number, angle: number) {
  return angle >= 360 ? 360 / count : angle / Math.max(1, count - 1)
}

export const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1))

const ISO = new THREE.Vector3(150, -190, 150)
const ORIGIN = new THREE.Vector3(0, 0, 0)

export class PatternMirrorScene extends LessonScene<PatternMirrorState> {
  private part = new THREE.Group()
  private mirrorPlane: THREE.Group
  /** Kept across renders: re-creating it mid-drag would drop the pointer capture. */
  private boss: CSS2DObject

  constructor(v: Viewer, emit: (s: PatternMirrorState) => void) {
    super(v, emit, {
      step: 0,
      seedPicked: false,
      count: 3,
      spacing: 22,
      mode: "spacing",
      plateLen: 120,
      diameter: 10,
      diamChanged: false,
      shrunkSpacing: false,
      shrunkLength: false,
      polarCount: 4,
      polarAngle: 360,
      polarSix: false,
      triedPartial: false,
      bossX: 22,
      bossY: 8,
      bossH: 16,
      mirrorEdited: false,
    })
    v.setGrid(150, 10)
    this.mirrorPlane = datumPlane(v.kit, "YZ", 76, "右视基准面 YZ · 镜像平面", [1, 1])
    this.mirrorPlane.position.set(0, 0, 18)
    this.boss = this.bossHandle()
    this.root.add(this.part, this.mirrorPlane, this.boss)
    this.listenForSeedPick()
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<PatternMirrorState> = { step }
    if (step >= 1 && !s.seedPicked) patch.seedPicked = true
    if (step === 1) Object.assign(patch, { mode: "spacing", plateLen: 120 })
    if (step === 2) Object.assign(patch, { count: 5, spacing: 22, mode: "spacing", plateLen: 120 })
    if (step === 3 && s.count < 3) patch.count = 5
    this.v.tweens.cancel("plate")
    this.v.renderer.domElement.style.cursor = ""
    this.set(patch)
    const v = this.v
    if (step === 0) v.flyTo(ISO.clone(), ORIGIN.clone(), 800)
    else if (step === 1 || step === 2) v.setView("top", { target: ORIGIN.clone(), distance: 380 })
    else if (step === 3) v.flyTo(new THREE.Vector3(110, -170, 220), ORIGIN.clone(), 800)
    else if (step === 4) v.flyTo(new THREE.Vector3(0, -140, 215), ORIGIN.clone(), 800)
    else v.flyTo(new THREE.Vector3(125, -165, 125), new THREE.Vector3(0, 0, 10), 800)
  }

  // ------------------------------------------------------------ actions

  pickSeed() {
    if (!this.state.seedPicked) this.set({ seedPicked: true })
  }

  setCount(count: number) {
    this.set({ count })
  }

  setSpacing(spacing: number) {
    this.set({ spacing })
  }

  setMode(mode: PatternMirrorState["mode"]) {
    this.withShrink({ mode })
  }

  setPlateLen(plateLen: number) {
    this.withShrink({ plateLen })
  }

  /** The predict reveal: same five holes, plate shrinks from 120 to 80. */
  revealShrink() {
    this.set({ mode: "spacing", count: 5, spacing: 22, plateLen: 120 })
    this.v.tweens.run(1000, (k) => this.setPlateLen(Math.round(120 - 40 * k)), { tag: "plate" })
  }

  setDiameter(diameter: number) {
    this.set({ diameter, diamChanged: this.state.diamChanged || this.state.step === 3 })
  }

  setPolarCount(polarCount: number) {
    this.set({ polarCount, polarSix: this.state.polarSix || polarCount === 6 })
  }

  setPolarAngle(polarAngle: number) {
    this.set({ polarAngle, triedPartial: this.state.triedPartial || polarAngle < 360 })
  }

  setBossH(bossH: number) {
    this.set({ bossH, mirrorEdited: true })
  }

  private withShrink(p: Partial<PatternMirrorState>) {
    const next = { ...this.state, ...p }
    if (next.step === 2 && next.plateLen < 100) {
      if (next.mode === "spacing") p.shrunkSpacing = true
      else p.shrunkLength = true
    }
    this.set(p)
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    this.clear(this.part)
    if (s.step <= 3) this.renderLinear()
    else if (s.step === 4) this.renderPolar()
    else this.renderMirror()
    this.mirrorPlane.visible = s.step === 5
    this.boss.visible = s.step === 5
    this.boss.position.set(s.bossX, s.bossY, T + s.bossH)
    this.v.invalidate()
  }

  private renderLinear() {
    const s = this.state
    const kit = this.v.kit
    const L = s.plateLen
    const r = s.diameter / 2
    const lay = linearLayout(s)
    const n = s.step === 0 ? 1 : s.count
    const holes: Hole[] = []
    for (let i = 0; i < n; i++) {
      const x = lay.xs[i]
      const st = lay.status[i]
      if (st === "in") {
        const role: SurfaceRole =
          i === 0 ? (s.step === 0 ? (s.seedPicked ? "highlight" : "model") : s.step === 3 ? "highlight" : "model") : s.step === 3 ? "modified" : "highlight"
        holes.push({ x, y: 0, r, role })
      } else {
        this.part.add(ghostHole(kit, x, 0, r))
        this.part.add(label(st === "off" ? "在板外" : "切到板边", new THREE.Vector3(x, 14, T + 1), "border-destructive text-destructive font-sans"))
      }
    }
    const outline = new THREE.Shape()
    outline.moveTo(-L / 2, -PLATE_W / 2)
    outline.lineTo(L / 2, -PLATE_W / 2)
    outline.lineTo(L / 2, PLATE_W / 2)
    outline.lineTo(-L / 2, PLATE_W / 2)
    outline.closePath()
    this.addPlate(outline, holes, [])

    const top = T + 0.1
    if (s.step === 0) {
      const seed = new THREE.Vector3(lay.xs[0], 14, T + 1)
      this.part.add(
        s.seedPicked
          ? tag("种子特征", seed)
          : label("点选这个孔", seed, "border-primary text-primary font-sans"),
      )
      return
    }
    this.part.add(label("种子", new THREE.Vector3(lay.xs[0], -14, T + 1), "font-sans text-muted-foreground"))
    if (s.step === 3) return
    // Plate length along the far edge, spacing (and total length) along the near edge.
    this.part.add(linearDim(kit, new THREE.Vector3(-L / 2, PLATE_W / 2, top), new THREE.Vector3(L / 2, PLATE_W / 2, top), new THREE.Vector3(0, 1, 0), 10, `板长 ${L}`))
    if (s.count >= 2) {
      const driven = s.mode === "length"
      this.part.add(
        linearDim(kit, new THREE.Vector3(lay.xs[0], 0, top), new THREE.Vector3(lay.xs[1], 0, top), new THREE.Vector3(0, -1, 0), PLATE_W / 2 + 10, driven ? `(${fmt(lay.spacing)})` : fmt(lay.spacing)),
      )
      if (driven) {
        this.part.add(
          linearDim(kit, new THREE.Vector3(lay.xs[0], 0, top), new THREE.Vector3(lay.xs[s.count - 1], 0, top), new THREE.Vector3(0, -1, 0), PLATE_W / 2 + 24, `总长 ${fmt(lay.total)}`),
        )
      }
    }
  }

  private renderPolar() {
    const s = this.state
    const kit = this.v.kit
    const step = polarStep(s.polarCount, s.polarAngle)
    const holes: Hole[] = []
    for (let i = 0; i < s.polarCount; i++) {
      const a = THREE.MathUtils.degToRad(i * step)
      holes.push({ x: Math.cos(a) * BOLT_R, y: Math.sin(a) * BOLT_R, r: BOLT_HOLE, role: i === 0 ? "model" : "highlight" })
    }
    const outline = new THREE.Shape()
    outline.absarc(0, 0, FLANGE_R, 0, Math.PI * 2, false)
    const bore = new THREE.Path()
    bore.absarc(0, 0, FLANGE_BORE, 0, Math.PI * 2, true)
    outline.holes.push(bore)
    this.addPlate(outline, holes, [
      { x: 0, y: 0, r: FLANGE_R },
      { x: 0, y: 0, r: FLANGE_BORE },
    ])

    const top = T + 0.1
    this.part.add(line(arcPoints(BOLT_R, 0, 360, top), kit.construction))
    this.part.add(line([new THREE.Vector3(0, 0, -14), new THREE.Vector3(0, 0, 38)], kit.construction))
    this.part.add(label("旋转轴", new THREE.Vector3(0, 0, 42), "font-sans text-muted-foreground"))
    // One spacing, and the total angle when it is less than a full turn.
    this.part.add(line(arcPoints(BOLT_R + 10, 0, step, top), kit.dimension))
    const mid = THREE.MathUtils.degToRad(step / 2)
    this.part.add(label(`${fmt(step)}°`, new THREE.Vector3(Math.cos(mid) * (BOLT_R + 17), Math.sin(mid) * (BOLT_R + 17), top)))
    if (s.polarAngle < 360) {
      this.part.add(line(arcPoints(FLANGE_R + 7, 0, s.polarAngle, top), kit.construction))
      const end = THREE.MathUtils.degToRad(s.polarAngle)
      this.part.add(
        label(`总角度 ${s.polarAngle}°`, new THREE.Vector3(Math.cos(end) * (FLANGE_R + 15), Math.sin(end) * (FLANGE_R + 15), top), "border-transparent bg-transparent font-sans text-muted-foreground"),
      )
    }
    this.part.add(label("种子", new THREE.Vector3(BOLT_R, -11, T + 1), "font-sans text-muted-foreground"))
  }

  private renderMirror() {
    const s = this.state
    const kit = this.v.kit
    const half = new THREE.Shape()
    half.moveTo(0, -PLATE_W / 2)
    half.lineTo(HALF_X, -PLATE_W / 2)
    half.lineTo(HALF_X, PLATE_W / 2)
    half.lineTo(0, PLATE_W / 2)
    half.closePath()
    const hole = new THREE.Path()
    hole.absarc(34, -14, 4, 0, Math.PI * 2, true)
    half.holes.push(hole)
    const plate = extrude(half, T, { curveSegments: SEG })
    const boss = lathe(
      [
        [BOSS_BORE, T],
        [BOSS_R, T],
        [BOSS_R, T + s.bossH],
        [BOSS_BORE, T + s.bossH],
        [BOSS_BORE, T],
      ],
      Math.PI * 2,
      48,
    )
    boss.translate(s.bossX, s.bossY, 0)
    this.part.add(face(plate, kit, { feature: "half", role: "model" }), face(boss, kit, { feature: "half", role: "model" }))
    this.part.add(face(mirrorX(plate), kit, { feature: "mirror", role: "highlight" }), face(mirrorX(boss), kit, { feature: "mirror", role: "highlight" }))
    const faint = "border-transparent bg-transparent font-sans text-faint-foreground"
    this.part.add(label("建模的一半", new THREE.Vector3(HALF_X / 2, -PLATE_W / 2 - 9, 0), faint))
    this.part.add(label("镜像出来的一半", new THREE.Vector3(-HALF_X / 2, -PLATE_W / 2 - 9, 0), faint))
  }

  /** A plate with patterned holes whose walls are separate meshes, so each instance can carry its own role. */
  private addPlate(outline: THREE.Shape, holes: Hole[], smooth: Circle[]) {
    const kit = this.v.kit
    for (const h of holes) outline.holes.push(circlePath(h, true))
    const raw = extrude(outline, T, { curveSegments: SEG })
    const geo = stripWalls(raw, holes, smooth)
    raw.dispose()
    this.part.add(face(geo, kit, { feature: "plate", role: "model", edges: 20 }))
    for (const h of holes) this.part.add(face(holeWall(h), kit, { feature: "pattern", role: h.role, edges: false }))
  }

  // ------------------------------------------------------------ pointer

  private seedHit(e: PointerEvent) {
    const hit = this.v.rayOnPlane(e, new THREE.Plane(new THREE.Vector3(0, 0, 1), -T))
    if (!hit) return false
    const x0 = linearLayout(this.state).xs[0]
    return Math.hypot(hit.x - x0, hit.y) < this.state.diameter / 2 + 6
  }

  private listenForSeedPick() {
    const el = this.v.renderer.domElement
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      const d = down
      down = null
      if (!d || this.state.step !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
      if (this.seedHit(e)) this.pickSeed()
    }
    const onMove = (e: PointerEvent) => {
      if (this.state.step !== 0 || down) return
      el.style.cursor = this.seedHit(e) ? "pointer" : ""
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

  private bossHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-transform hover:scale-125"
    el.title = "拖动凸台"
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(T + this.state.bossH))
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const bossX = Math.round(clamp(hit.x, BOSS_R + 3, HALF_X - BOSS_R - 1))
        const bossY = Math.round(clamp(hit.y, -PLATE_W / 2 + BOSS_R + 1, PLATE_W / 2 - BOSS_R - 1))
        if (bossX !== this.state.bossX || bossY !== this.state.bossY) this.set({ bossX, bossY, mirrorEdited: true })
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    o.visible = false
    return o
  }
}

// ------------------------------------------------------------ geometry helpers

type Circle = { x: number; y: number; r: number }
type Hole = Circle & { role: SurfaceRole }

function circlePath(c: Circle, clockwise = false) {
  const p = new THREE.Path()
  p.absarc(c.x, c.y, c.r, 0, Math.PI * 2, clockwise)
  return p
}

const onCircle = (x: number, y: number, c: Circle) => Math.abs(Math.hypot(x - c.x, y - c.y) - c.r) < 1e-3

/**
 * Copy an extruded plate without the side walls of `holes` (drawn separately),
 * and give the walls of `smooth` circles radial normals so they read round.
 */
function stripWalls(geo: THREE.BufferGeometry, holes: Circle[], smooth: Circle[]) {
  const pos = geo.getAttribute("position")
  const nor = geo.getAttribute("normal")
  const outP: number[] = []
  const outN: number[] = []
  const v = [0, 1, 2]
  for (let i = 0; i < pos.count; i += 3) {
    const side = Math.abs(nor.getZ(i)) < 0.5
    const all = (c: Circle) => v.every((k) => onCircle(pos.getX(i + k), pos.getY(i + k), c))
    if (side && holes.some(all)) continue
    const round = side ? smooth.find(all) : undefined
    for (const k of v) {
      const x = pos.getX(i + k)
      const y = pos.getY(i + k)
      outP.push(x, y, pos.getZ(i + k))
      if (round) {
        const rx = (x - round.x) / round.r
        const ry = (y - round.y) / round.r
        const s = rx * nor.getX(i + k) + ry * nor.getY(i + k) >= 0 ? 1 : -1
        outN.push(rx * s, ry * s, 0)
      } else outN.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(outP, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(outN, 3))
  return g
}

/** The wall of a through hole, facing its axis, on the same points the plate's rim uses. */
function holeWall(h: Circle) {
  const pts = circlePath(h).getPoints(SEG)
  const pos: number[] = []
  const nor: number[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    if (a.distanceTo(b) < 1e-6) continue
    const quad = [
      [a, 0],
      [b, 0],
      [b, T],
      [a, 0],
      [b, T],
      [a, T],
    ] as const
    // Front faces look at the axis: flip the winding if the triangle faces away from it.
    const p0 = new THREE.Vector3(a.x, a.y, 0)
    const e1 = new THREE.Vector3(b.x, b.y, 0).sub(p0)
    const e2 = new THREE.Vector3(b.x, b.y, T).sub(p0)
    const fn = e1.cross(e2)
    const inward = new THREE.Vector3(h.x - (a.x + b.x) / 2, h.y - (a.y + b.y) / 2, 0)
    const order = fn.dot(inward) >= 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4]
    for (const j of order) {
      const [p, z] = quad[j]
      pos.push(p.x, p.y, z)
      nor.push((h.x - p.x) / h.r, (h.y - p.y) / h.r, 0)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  return g
}

/** A pattern instance that missed the plate: a faint cylinder where the hole would have been. */
function ghostHole(kit: MaterialKit, x: number, y: number, r: number) {
  const geo = new THREE.CylinderGeometry(r, r, T + 0.6, 40, 1)
  geo.rotateX(Math.PI / 2)
  geo.translate(x, y, T / 2)
  const m = new THREE.Mesh(geo, kit.ghost)
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), kit.edgeGhost)
  e.raycast = () => {}
  m.add(e)
  return m
}

/** Mirror a geometry about the YZ plane (x → −x), keeping faces outward. */
function mirrorX(src: THREE.BufferGeometry) {
  const g = src.index ? src.toNonIndexed() : src.clone()
  if (g.getAttribute("uv")) g.deleteAttribute("uv")
  g.clearGroups()
  const p = g.getAttribute("position")
  const n = g.getAttribute("normal")
  for (let i = 0; i < p.count; i++) {
    p.setX(i, -p.getX(i))
    n?.setX(i, -n.getX(i))
  }
  // Mirroring turns the winding inside out: swap two corners of every triangle.
  for (const attr of [p, n]) {
    if (!attr) continue
    for (let i = 0; i < attr.count; i += 3) {
      const x = attr.getX(i + 1)
      const y = attr.getY(i + 1)
      const z = attr.getZ(i + 1)
      attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2))
      attr.setXYZ(i + 2, x, y, z)
    }
  }
  return g
}

function arcPoints(r: number, a0Deg: number, a1Deg: number, z: number) {
  const n = Math.max(4, Math.round(Math.abs(a1Deg - a0Deg) / 3))
  const out: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const a = THREE.MathUtils.degToRad(a0Deg + ((a1Deg - a0Deg) * i) / n)
    out.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z))
  }
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
