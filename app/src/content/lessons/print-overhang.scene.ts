import * as THREE from "three"
import { edges, label, line } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import { needsSupport, place, supportArea, type Orientation, type Placed } from "./print-overhang.part"
import { LessonScene } from "./scene"

/**
 * 4.1.1–4.1.2 「3D 打印：悬垂与摆放方向」: a T bracket on the build plate.
 * Faces are coloured by overhang angle against the build direction, a
 * threshold slider sets the limit (45° for FDM), the learner turns the part
 * to find a support-free orientation, then weighs it against layer
 * strength (layers bond weakest across Z) and fixes the design instead.
 */
export type PrintState = {
  step: number
  rotX: number
  rotY: number
  chamferLeft: boolean
  threshold: number
  showOverhang: boolean
  /** Printed height shown in the layer preview, mm (≥ part height = finished). */
  progress: number
  reachedLedge: boolean
  triedThreshold: boolean
  triedChamfer: boolean
}

/** Drawn layer spacing: 2 mm so the lines read on screen (real FDM layers are about 0.1–0.3 mm). */
export const LAYER = 2
export const FULL = 50
/** Height of the left arm's underside in the upright part. */
export const LEDGE_Z = 40

export const orientationOf = (s: PrintState): Orientation => ({ rotX: s.rotX, rotY: s.rotY, chamferLeft: s.chamferLeft })
export const areaOf = (s: PrintState) => supportArea(orientationOf(s), s.threshold)
export const loadAcrossOf = (s: PrintState) => place(orientationOf(s)).loadAcross

export const PRESETS = {
  upright: { rotX: 0, rotY: 0 },
  flipped: { rotX: 0, rotY: 180 },
  side: { rotX: 90, rotY: 0 },
} as const
export type PresetId = keyof typeof PRESETS

export const presetOf = (s: PrintState): PresetId | null =>
  (Object.keys(PRESETS) as PresetId[]).find((k) => PRESETS[k].rotX === s.rotX && PRESETS[k].rotY === s.rotY) ?? null

export class PrintScene extends LessonScene<PrintState> {
  private part = new THREE.Group()
  private extras = new THREE.Group()
  private mat: THREE.MeshStandardMaterial
  private uCut = { value: new THREE.Color() }
  private clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), FULL)
  private ray = new THREE.Raycaster()

  constructor(v: Viewer, emit: (s: PrintState) => void) {
    super(v, emit, {
      step: 0,
      rotX: 0,
      rotY: 0,
      chamferLeft: false,
      threshold: 45,
      showOverhang: false,
      progress: 14,
      reachedLedge: false,
      triedThreshold: false,
      triedChamfer: false,
    })
    v.setGrid(80, 5)
    // Per-face colours come from the theme tokens (see render); the material only multiplies them.
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    // Inside faces seen through the layer-preview cut are painted flat, like the kit's section view.
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCutColor = this.uCut
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
        .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCutColor, 1.0);")
    }
    this.mat.customProgramCacheKey = () => "ft-print-cut"
    this.own(() => this.mat.dispose())
    this.root.add(this.part, this.extras)
    this.root.add(label("打印平台", new THREE.Vector3(48, -40, 0), "border-transparent bg-transparent font-sans text-faint-foreground"))
  }

  enter(step: number) {
    const patch: Partial<PrintState> = { step }
    if (step === 0) Object.assign(patch, { ...PRESETS.upright, chamferLeft: false, showOverhang: false, progress: 14 })
    if (step >= 1) patch.progress = FULL + 100
    if (step === 1) Object.assign(patch, { ...PRESETS.upright, chamferLeft: false })
    if (step >= 2) Object.assign(patch, { showOverhang: true, threshold: 45 })
    if (step === 2 || step === 3) patch.chamferLeft = false
    if (step === 3) Object.assign(patch, PRESETS.flipped)
    if (step === 4) Object.assign(patch, { ...PRESETS.upright, chamferLeft: false })
    this.set(patch)
    // Layer steps look down on the layers; overhang steps look from just below the arms, so faces that point down show.
    if (step === 0 || step === 3) this.v.flyTo(new THREE.Vector3(120, -215, 135), new THREE.Vector3(-6, 0, 22), 800)
    else this.v.flyTo(new THREE.Vector3(35, -245, 6), new THREE.Vector3(-4, 0, 28), 800)
  }

  // ------------------------------------------------------------ actions

  setProgress(h: number) {
    this.set({ progress: h, reachedLedge: this.state.reachedLedge || (h > LEDGE_Z && h < FULL) })
  }

  setThreshold(t: number) {
    this.set({ threshold: t, triedThreshold: this.state.triedThreshold || t !== 45 })
  }

  reveal() {
    this.set({ showOverhang: true })
  }

  setRotation(patch: { rotX?: number; rotY?: number }) {
    this.set(patch)
  }

  preset(id: PresetId) {
    this.set({ ...PRESETS[id] })
  }

  setChamferLeft(on: boolean) {
    this.set({ chamferLeft: on, triedChamfer: this.state.triedChamfer || on })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const t = this.v.tokens
    const p = place(orientationOf(s))
    this.uCut.value.copy(t.cut)

    // Colour every triangle: resting grey, warming towards the warning tone near the limit, full warning past it.
    const n = p.alpha.length
    const prev = p.geo.getAttribute("color") as THREE.BufferAttribute | undefined
    const colors = prev ? (prev.array as Float32Array) : new Float32Array(n * 9)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      let k = 0
      if (s.showOverhang && !p.onPlate[i]) {
        if (needsSupport(p, i, s.threshold)) k = 1
        else if (p.alpha[i] > s.threshold - 15) k = 0.35 * ((p.alpha[i] - (s.threshold - 15)) / 15)
      }
      c.copy(t.model).lerp(t.modified, k)
      for (let j = 0; j < 3; j++) colors.set([c.r, c.g, c.b], i * 9 + j * 3)
    }
    if (prev) prev.needsUpdate = true
    else p.geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    const top = Math.min(s.progress, p.height + 0.01)
    const cutting = s.progress < p.height
    this.clip.constant = top
    if (cutting !== !!this.mat.clippingPlanes) {
      this.mat.clippingPlanes = cutting ? [this.clip] : null
      this.mat.side = cutting ? THREE.DoubleSide : THREE.FrontSide
      this.mat.needsUpdate = true
    }

    this.clear(this.part)
    const mesh = new THREE.Mesh(p.geo, this.mat)
    if (!cutting) mesh.add(edges(p.geo, kit, 20))
    this.part.add(mesh)

    this.clear(this.extras)
    if (s.step === 0 || s.step === 3) this.extras.add(this.layers(p, top, cutting))
    if (cutting && s.step === 0) {
      const contour = this.slice(p, top - 0.01)
      for (let i = 0; i < contour.length; i += 2) this.extras.add(line([contour[i], contour[i + 1]], kit.sketch))
      if (top > LEDGE_Z && top < FULL) this.extras.add(label("这一层左边下面是空的", new THREE.Vector3(-19, -14, top + 2), "border-scene-modified font-sans"))
    }
    if (s.showOverhang && !cutting && s.step !== 3) this.extras.add(this.supports(p, s.threshold, mesh))
    if (s.step === 3) this.extras.add(...this.load(p))
    this.v.invalidate()
  }

  /** Layer lines: the part sliced every LAYER mm up to `top`. */
  private layers(p: Placed, top: number, cutting: boolean) {
    const pts: THREE.Vector3[] = []
    for (let z = LAYER; z < (cutting ? top : p.height); z += LAYER) pts.push(...this.slice(p, z))
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    const l = new THREE.LineSegments(g, this.v.kit.edgeSoft)
    l.raycast = () => {}
    return l
  }

  /** Segments where the plane at height z cuts the mesh (pairs of points). */
  private slice(p: Placed, z: number) {
    const pos = p.geo.getAttribute("position")
    const out: THREE.Vector3[] = []
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    for (let i = 0; i < pos.count; i += 3) {
      for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(pos, i + j)
      const hits: THREE.Vector3[] = []
      for (let j = 0; j < 3; j++) {
        const a = v[j]
        const b = v[(j + 1) % 3]
        if ((a.z - z) * (b.z - z) < 0) hits.push(a.clone().lerp(b, (z - a.z) / (b.z - a.z)))
      }
      if (hits.length === 2) out.push(...hits)
    }
    return out
  }

  /** Support sketch: vertical lines from each overhanging face down to the plate or the part below. */
  private supports(p: Placed, threshold: number, mesh: THREE.Mesh) {
    const pos = p.geo.getAttribute("position")
    const out: THREE.Vector3[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const down = new THREE.Vector3(0, 0, -1)
    mesh.updateMatrixWorld()
    for (let i = 0; i < p.alpha.length; i++) {
      if (!needsSupport(p, i, threshold)) continue
      a.fromBufferAttribute(pos, i * 3)
      b.fromBufferAttribute(pos, i * 3 + 1)
      c.fromBufferAttribute(pos, i * 3 + 2)
      const m = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 4))
      for (let u = 0; u <= m; u++) {
        for (let w = 0; w + u <= m; w++) {
          const q = a.clone().multiplyScalar(1 - (u + w) / m).addScaledVector(b, u / m).addScaledVector(c, w / m)
          this.ray.set(q.clone().addScaledVector(down, 0.05), down)
          const hit = this.ray.intersectObject(mesh, false)[0]
          out.push(q, hit ? hit.point : q.clone().setZ(0))
        }
      }
    }
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(out), this.v.kit.edgeSoft)
    l.raycast = () => {}
    const g = new THREE.Group()
    g.add(l)
    return g
  }

  /** The service load: the stem is pulled along its own axis. */
  private load(p: Placed) {
    const kit = this.v.kit
    const from = new THREE.Vector3(0, 0, 0).applyMatrix4(p.matrix)
    const to = new THREE.Vector3(0, 0, -26).applyMatrix4(p.matrix)
    const dir = to.clone().sub(from).normalize()
    const side = Math.abs(dir.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
    const wing = side.clone().cross(dir).normalize().multiplyScalar(3)
    const back = to.clone().addScaledVector(dir, -5)
    return [
      line([from, to], kit.sketch),
      line([back.clone().add(wing), to, back.clone().sub(wing)], kit.sketch),
      label("拉力", to.clone().addScaledVector(dir, 6), "border-primary text-primary font-sans"),
    ]
  }
}
