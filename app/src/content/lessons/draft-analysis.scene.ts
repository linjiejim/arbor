import * as THREE from "three"
import { edges, face, label, line, tag } from "@/three/build"
import { draftedPrism } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 4.4.1–4.4.3 「注塑：拔模与分型线」: a small moulded cover (an open box,
 * opening down, with a screw boss and a rib inside). Pull direction +Z: the
 * cavity forms the outside and lifts off upwards, the core forms the inside
 * and drops away downwards. A draft-analysis colouring is computed from the
 * real face normals of the rebuilt geometry, so whatever the slider does to
 * the walls is exactly what the colours report.
 */
export type DraftClass = "pos" | "neg" | "low" | "under"
type Half = "cavity" | "core" | "trapped"

export type DraftState = {
  step: number
  draft: number
  texture: boolean
  analysis: boolean
  showMould: boolean
  showParting: boolean
  window: boolean
  slider: boolean
  solidBoss: boolean
  section: boolean
  /** 0 closed … 1 open. */
  open: number
  stuck: boolean
  hasLow: boolean
  hasUnder: boolean
  opened: boolean
  sawInside: boolean
  openedParting: boolean
  openedSlider: boolean
  triedSolid: boolean
  triedHollow: boolean
}

/** Part dimensions, mm. 25 deep: the 「每 25 mm 深约 1°」 rule of thumb lands on the analysis threshold. */
export const PART = { w: 80, d: 56, h: 25, t: 2.5 }
const BOSS = { x: -18, y: 0, zTip: 9, r: 3, hole: 1.5, solidR: 6.5 }
const RIB = { h: 8.5, root: 1.5 }
const WIN = { y: 8, z0: 8, z1: 16 }
/** Analysis thresholds, degrees. */
export const MIN_SMOOTH = 1
export const MIN_TEXTURE = 3

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Collects flat polygons with their draft class; normals are per face, so the colouring is exact. */
class Mesher {
  pos: number[] = []
  nor: number[] = []
  cls: DraftClass[] = []
  private thr: (textured: boolean) => number
  constructor(thr: (textured: boolean) => number) {
    this.thr = thr
  }

  poly(pts: THREE.Vector3[], hint: THREE.Vector3, half: Half, textured = false) {
    const n = new THREE.Vector3()
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      n.x += (a.y - b.y) * (a.z + b.z)
      n.y += (a.z - b.z) * (a.x + b.x)
      n.z += (a.x - b.x) * (a.y + b.y)
    }
    if (n.lengthSq() < 1e-12) return
    n.normalize()
    if (n.dot(hint) < 0) {
      pts = [...pts].reverse()
      n.negate()
    }
    const c = classify(n, half, this.thr(textured))
    for (let i = 1; i < pts.length - 1; i++) {
      for (const p of [pts[0], pts[i], pts[i + 1]]) {
        this.pos.push(p.x, p.y, p.z)
        this.nor.push(n.x, n.y, n.z)
        this.cls.push(c)
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3))
    return g
  }
}

/**
 * Draft of a face = angle between the face and the pull direction of the
 * mould half that releases it (90° − angle between normal and pull).
 * Cavity faces pull +Z; core faces −Z. Seen from the single +Z arrow of a
 * CAD draft analysis, cavity faces read as positive draft and core faces
 * as negative draft; both are fine. Only faces below the threshold, or
 * leaning against their own half, are problems.
 */
export function classify(n: THREE.Vector3, half: Half, thr: number): DraftClass {
  if (half === "trapped") return "under"
  const along = half === "cavity" ? n.z : -n.z
  const d = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, along))))
  if (d >= thr - 1e-6) return half === "cavity" ? "pos" : "neg"
  if (d > -thr) return "low"
  return "under"
}

export function buildPart(o: { draft: number; texture: boolean; window: boolean; solidBoss: boolean }) {
  const { w, d, h, t } = PART
  const k = Math.tan(THREE.MathUtils.degToRad(o.draft))
  const m = new Mesher((textured) => (textured && o.texture ? MIN_TEXTURE : MIN_SMOOTH))
  const ceil = h - t
  const ox = (z: number) => w / 2 - z * k
  const oy = (z: number) => d / 2 - z * k
  const ix = (z: number) => w / 2 - t - z * k
  const iy = (z: number) => d / 2 - t - z * k

  // Top and ceiling.
  m.poly([V(-ox(h), -oy(h), h), V(ox(h), -oy(h), h), V(ox(h), oy(h), h), V(-ox(h), oy(h), h)], V(0, 0, 1), "cavity", true)
  m.poly([V(-ix(ceil), -iy(ceil), ceil), V(ix(ceil), -iy(ceil), ceil), V(ix(ceil), iy(ceil), ceil), V(-ix(ceil), iy(ceil), ceil)], V(0, 0, -1), "core")
  // Rim on the parting plane (z = 0): the shut-off between the halves.
  const O = [V(-w / 2, -d / 2, 0), V(w / 2, -d / 2, 0), V(w / 2, d / 2, 0), V(-w / 2, d / 2, 0)]
  const I = [V(-ix(0), -iy(0), 0), V(ix(0), -iy(0), 0), V(ix(0), iy(0), 0), V(-ix(0), iy(0), 0)]
  for (let i = 0; i < 4; i++) m.poly([O[i], O[(i + 1) % 4], I[(i + 1) % 4], I[i]], V(0, 0, -1), "core")

  // Walls: outer (cavity, cosmetic) and inner (core). Each wall as a function wall(u, z) in its own plane.
  type Wall = { pt: (u: number, z: number) => THREE.Vector3; half: (z: number) => number; out: THREE.Vector3 }
  const walls = (outer: boolean): Wall[] => {
    const fx = outer ? ox : ix
    const fy = outer ? oy : iy
    const s = outer ? 1 : -1
    return [
      { pt: (u, z) => V(fx(z), u, z), half: fy, out: V(s, 0, 0) },
      { pt: (u, z) => V(-fx(z), u, z), half: fy, out: V(-s, 0, 0) },
      { pt: (u, z) => V(u, fy(z), z), half: fx, out: V(0, s, 0) },
      { pt: (u, z) => V(u, -fy(z), z), half: fx, out: V(0, -s, 0) },
    ]
  }
  const wallFace = (wl: Wall, z0: number, z1: number, u0?: number, u1?: number, half: Half = "cavity", textured = false) => {
    const a0 = u0 ?? -wl.half(z0)
    const a1 = u0 ?? -wl.half(z1)
    const b0 = u1 ?? wl.half(z0)
    const b1 = u1 ?? wl.half(z1)
    m.poly([wl.pt(a0, z0), wl.pt(b0, z0), wl.pt(b1, z1), wl.pt(a1, z1)], wl.out, half, textured)
  }
  const wallWithWindow = (wl: Wall, zTop: number, half: Half, textured: boolean) => {
    // A 3 × 3 grid minus the window cell, so neighbouring pieces share exact edges (no T-junctions in the edge lines).
    const us = (z: number) => [-wl.half(z), -WIN.y, WIN.y, wl.half(z)]
    const zs = [0, WIN.z0, WIN.z1, zTop]
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue
        const [za, zb] = [zs[j], zs[j + 1]]
        m.poly([wl.pt(us(za)[i], za), wl.pt(us(za)[i + 1], za), wl.pt(us(zb)[i + 1], zb), wl.pt(us(zb)[i], zb)], wl.out, half, textured)
      }
  }
  walls(true).forEach((wl, i) => (i === 0 && o.window ? wallWithWindow(wl, h, "cavity", true) : wallFace(wl, 0, h, undefined, undefined, "cavity", true)))
  walls(false).forEach((wl, i) => (i === 0 && o.window ? wallWithWindow(wl, ceil, "core", false) : wallFace(wl, 0, ceil, undefined, undefined, "core", false)))

  // The side window: neither half can pull out the steel that fills it.
  if (o.window) {
    const [z0, z1, y] = [WIN.z0, WIN.z1, WIN.y]
    m.poly([V(ix(z1), -y, z1), V(ox(z1), -y, z1), V(ox(z1), y, z1), V(ix(z1), y, z1)], V(0, 0, -1), "trapped")
    m.poly([V(ix(z0), -y, z0), V(ox(z0), -y, z0), V(ox(z0), y, z0), V(ix(z0), y, z0)], V(0, 0, 1), "trapped")
    for (const s of [-1, 1]) m.poly([V(ix(z0), s * y, z0), V(ox(z0), s * y, z0), V(ox(z1), s * y, z1), V(ix(z1), s * y, z1)], V(0, -s, 0), "trapped")
  }

  // Screw boss hanging from the ceiling: thicker at the root so the core can let go; the hole opens at the tip.
  const seg = 32
  const zt = BOSS.zTip
  const rOut = (z: number) => (o.solidBoss ? BOSS.solidR : BOSS.r) + (z - zt) * k
  const rHole = (z: number) => Math.max(0.2, BOSS.hole - (z - zt) * k)
  const ring = (r: number, z: number, i: number) => V(BOSS.x + Math.cos((i / seg) * Math.PI * 2) * r, BOSS.y + Math.sin((i / seg) * Math.PI * 2) * r, z)
  for (let i = 0; i < seg; i++) {
    const mid = ((i + 0.5) / seg) * Math.PI * 2
    const radial = V(Math.cos(mid), Math.sin(mid), 0)
    m.poly([ring(rOut(zt), zt, i), ring(rOut(zt), zt, i + 1), ring(rOut(ceil), ceil, i + 1), ring(rOut(ceil), ceil, i)], radial, "core")
    if (o.solidBoss) m.poly([V(BOSS.x, BOSS.y, zt), ring(rOut(zt), zt, i), ring(rOut(zt), zt, i + 1)], V(0, 0, -1), "core")
    else {
      m.poly([ring(rHole(zt), zt, i), ring(rHole(zt), zt, i + 1), ring(rHole(ceil), ceil, i + 1), ring(rHole(ceil), ceil, i)], radial.clone().negate(), "core")
      m.poly([ring(rHole(zt), zt, i), ring(rOut(zt), zt, i), ring(rOut(zt), zt, i + 1), ring(rHole(zt), zt, i + 1)], V(0, 0, -1), "core")
    }
  }

  // Rib from the −X wall to the boss: thinner at the tip, both sides drafted.
  const zr = ceil - RIB.h
  const tip = Math.max(0.3, RIB.root - 2 * RIB.h * k)
  const xa = -(w / 2 - t)
  const xb = BOSS.x
  for (const s of [-1, 1]) m.poly([V(xa, (s * tip) / 2, zr), V(xb, (s * tip) / 2, zr), V(xb, (s * RIB.root) / 2, ceil), V(xa, (s * RIB.root) / 2, ceil)], V(0, s, -0.01), "core")
  m.poly([V(xa, -tip / 2, zr), V(xb, -tip / 2, zr), V(xb, tip / 2, zr), V(xa, tip / 2, zr)], V(0, 0, -1), "core")

  return { geo: m.geometry(), cls: m.cls, hasLow: m.cls.includes("low"), hasUnder: m.cls.includes("under") }
}

export class DraftScene extends LessonScene<DraftState> {
  private part = new THREE.Group()
  private mould = new THREE.Group()
  private marks = new THREE.Group()
  private analysisMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  private steelMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false })
  private gridHidden = false

  constructor(v: Viewer, emit: (s: DraftState) => void) {
    super(v, emit, {
      step: 0,
      draft: 0,
      texture: false,
      analysis: false,
      showMould: true,
      showParting: false,
      window: false,
      slider: false,
      solidBoss: false,
      section: false,
      open: 0,
      stuck: false,
      hasLow: true,
      hasUnder: false,
      opened: false,
      sawInside: false,
      openedParting: false,
      openedSlider: false,
      triedSolid: false,
      triedHollow: false,
    })
    v.setGrid(120, 10)
    this.root.add(this.part, this.mould, this.marks)
    this.own(
      v.onCameraChange(() => {
        const dir = v.camera.position.clone().sub(v.controls.target).normalize()
        // The ground grid would sit between the camera and the part when looking from below.
        const below = dir.z < 0
        if (below !== this.gridHidden) {
          this.gridHidden = below
          v.showGrid(!below)
        }
        if (this.state.step === 1 && !this.state.sawInside && dir.z < -0.2) this.set({ sawInside: true })
      }),
    )
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("mould")
    const patch: Partial<DraftState> = {
      step,
      open: 0,
      stuck: false,
      analysis: step >= 1 && step <= 5,
      showMould: step === 0 || step === 4 || step === 5,
      showParting: step >= 4 && step <= 5,
      window: step === 5,
      section: step === 6,
    }
    if (step <= 1) Object.assign(patch, { draft: 0, texture: false })
    if (step === 2) patch.texture = false
    if (step >= 3 && s.draft < 2) patch.draft = 2
    if (step >= 4 && s.texture && s.draft < MIN_TEXTURE) patch.draft = MIN_TEXTURE
    if (step !== 5) patch.slider = false
    if (step !== 6) patch.solidBoss = false
    this.update(patch)
    const v = this.v
    const target = V(0, 0, 10)
    if (step === 1) v.flyTo(V(150, -190, -140), target, 900)
    else if (step === 4) v.flyTo(V(220, -250, -45), V(0, 0, 6), 900)
    else if (step === 5) v.flyTo(V(230, -150, 115), V(8, 0, 8), 900)
    else if (step === 6) v.setView("front", { target: V(0, 0, 12), distance: 165 })
    else v.flyTo(step === 0 ? V(210, -280, 190) : V(180, -215, 150), target, 900)
  }

  // ------------------------------------------------------------ actions

  setDraft(draft: number) {
    this.update({ draft })
  }

  setTexture(texture: boolean) {
    this.update({ texture })
  }

  setAnalysis(analysis: boolean) {
    this.set({ analysis })
  }

  setSlider(slider: boolean) {
    this.v.tweens.cancel("mould")
    this.set({ slider, open: 0, stuck: false })
  }

  setSolidBoss(solidBoss: boolean) {
    this.update({ solidBoss, triedSolid: this.state.triedSolid || solidBoss, triedHollow: this.state.triedHollow || !solidBoss })
  }

  lookBelow() {
    this.v.flyTo(V(140, -180, -150), V(0, 0, 8), 900)
  }

  /** Open (or close) the mould. With an untreated side window the cavity cannot lift: it stops after a millimetre. */
  toggleMould() {
    const s = this.state
    const from = s.open
    const to = from > 0 ? 0 : 1
    const blocked = to === 1 && s.window && !s.slider
    this.set({ stuck: false })
    this.v.tweens
      .run(blocked ? 500 : 1300, (k) => {
        this.state.open = from + (to - from) * k * (blocked ? 0.04 : 1)
        this.render()
      }, { tag: "mould" })
      .then(() => {
        if (this.state.step !== s.step) return
        const opened = to === 1
        this.set({
          open: this.state.open,
          stuck: blocked,
          opened: s.opened || opened,
          openedParting: s.openedParting || (opened && s.step === 4),
          openedSlider: s.openedSlider || (opened && s.slider && s.step === 5),
        })
      })
  }

  private update(patch: Partial<DraftState>) {
    const n = { ...this.state, ...patch }
    const r = buildPart(n)
    r.geo.dispose()
    this.set({ ...patch, hasLow: r.hasLow, hasUnder: r.hasUnder })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.part)
    this.clear(this.mould)
    this.clear(this.marks)
    kit.setSection(s.section ? new THREE.Plane(V(0, 1, 0), 0) : null)

    const { geo, cls } = buildPart(s)
    const colours: Record<DraftClass, THREE.Color> = { pos: tk.good, neg: tk.highlight, low: tk.warn, under: tk.bad }
    const col: number[] = []
    for (const c of cls) col.push(colours[c].r, colours[c].g, colours[c].b)
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
    const mesh = face(geo, kit, { feature: "part", edges: false })
    if (s.analysis) mesh.material = this.analysisMat
    mesh.add(edges(geo, kit, 25))
    this.part.add(mesh)

    const { w, d, h } = PART
    // Mould halves: ghost blocks that split along the pull direction.
    if (s.showMould) {
      const lift = s.open * 42
      const drop = s.open * 34
      const pad = 9
      const block = (z0: number, z1: number) => {
        const g = new THREE.BoxGeometry(w + pad * 2, d + pad * 2, z1 - z0)
        g.translate(0, 0, (z0 + z1) / 2)
        const m = face(g, kit, { feature: "mould", role: "ghost", edges: false })
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), kit.edgeGhost)
        e.raycast = () => {}
        m.add(e)
        return m
      }
      const cavity = block(0, h + pad)
      cavity.position.z = lift
      const core = block(-pad, 0)
      // The core's plug: the hollow of the part, tapered by the same draft.
      const plugGeo = draftedPrism(w - 2 * PART.t, d - 2 * PART.t, h - PART.t, s.draft)
      const plug = face(plugGeo, kit, { feature: "mould", role: "ghost", edges: false })
      const plugEdges = new THREE.LineSegments(new THREE.EdgesGeometry(plugGeo), kit.edgeGhost)
      plugEdges.raycast = () => {}
      plug.add(plugEdges)
      core.add(plug)
      core.position.z = -drop
      this.mould.add(cavity, core)
      this.mould.add(tag("型腔 · 定模", V(-w / 2 - pad, -d / 2 - pad, h + pad + lift)), tag("型芯 · 动模", V(-w / 2 - pad, -d / 2 - pad, -pad - drop)))
      if (s.window) {
        // The steel that fills the window: part of the cavity, or a slider that backs out along +X first.
        const g = new THREE.BoxGeometry(pad + PART.t + 1, WIN.y * 2, WIN.z1 - WIN.z0)
        g.translate(w / 2 + (pad - PART.t - 1) / 2, 0, (WIN.z0 + WIN.z1) / 2)
        this.steelMat.color.copy(s.slider ? tk.highlight : tk.bad)
        const pin = new THREE.Mesh(g, this.steelMat)
        const slide = s.slider ? Math.min(1, s.open / 0.35) * 24 : 0
        pin.position.set(slide, 0, s.slider ? 0 : lift)
        this.mould.add(pin)
        if (s.slider) this.mould.add(tag("滑块 · 沿 +X 抽出", V(w / 2 + pad + slide, 0, WIN.z1 + 6)))
        if (s.stuck) this.mould.add(label("型腔被窗口上沿勾住，拔不出来", V(w / 2, 0, h + 14), "border-warning text-warning font-sans"))
      }
      if (s.slider && s.window) {
        // Halves wait until the slider is out.
        const k = Math.max(0, (s.open - 0.35) / 0.65)
        cavity.position.z = k * 42
        core.position.z = -k * 34
      }
      this.mould.add(...pullArrows(kit, -w / 2 - pad - 14, h))
    }

    if (s.showParting) {
      const pl = [V(-w / 2, -d / 2, 0), V(w / 2, -d / 2, 0), V(w / 2, d / 2, 0), V(-w / 2, d / 2, 0), V(-w / 2, -d / 2, 0)]
      this.marks.add(line(pl, kit.sketchDefined))
      this.marks.add(label("分型线", V(-w / 2, -d / 2, 0), "font-sans"))
    }
    if (s.step === 6 && s.solidBoss) {
      const ring: THREE.Vector3[] = []
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2
        ring.push(V(BOSS.x + Math.cos(a) * 7, BOSS.y + Math.sin(a) * 7, h + 0.1))
      }
      this.marks.add(line(ring, kit.construction))
      this.marks.add(label("缩痕：厚处最后冷却，表面被拉凹", V(BOSS.x, 0, h + 8), "border-warning text-warning font-sans"))
    }
    this.v.invalidate()
  }

  dispose() {
    this.v.kit.setSection(null)
    this.v.showGrid(true)
    super.dispose()
    this.analysisMat.dispose()
    this.steelMat.dispose()
  }
}

function pullArrows(kit: Viewer["kit"], x: number, h: number) {
  const out: THREE.Object3D[] = []
  for (const dir of [1, -1]) {
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 18, 12), kit.modelDark)
    shaft.rotation.x = Math.PI / 2
    shaft.position.z = 9
    const head = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 20), kit.modelDark)
    head.rotation.x = Math.PI / 2
    head.position.z = 21
    g.add(shaft, head)
    g.position.set(x, 0, dir > 0 ? h / 2 + 3 : h / 2 - 3)
    if (dir < 0) g.rotation.x = Math.PI
    out.push(g)
  }
  out.push(label("开模方向", V(x - 4, 0, h / 2), "border-transparent bg-transparent font-sans text-muted-foreground"))
  return out
}
