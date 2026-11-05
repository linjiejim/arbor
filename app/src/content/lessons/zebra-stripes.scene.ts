import * as THREE from "three"
import { edgeLine, face } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { g2CornerBlend, sampleBezier } from "./curvature-continuity.bezier"

/**
 * 5.3.1 · 5.3.3 「斑马纹：用反光看曲面质量」: two surfaces (a top and a
 * side, like the shoulder of a product shell) meet along an edge that is
 * left sharp (G0), rolled with a circular fillet (G1) or blended with a
 * curvature-continuous blend (G2). The whole section is swept around a far
 * axis so both surfaces curve gently and the reflections have somewhere
 * to flow. Zebra stripes are reflections of parallel light tubes: a shader
 * maps the reflected view direction to black-and-white bands.
 */
export type Blend = "G0" | "G1" | "G2"

export type ZebraState = {
  step: number
  blend: Blend
  zebra: boolean
  radius: number
  freq: number
  seenG0: boolean
  seenG1: boolean
  seenG2: boolean
  /** Blind test: which blend each sample shows. */
  order: Blend[]
  sample: number
  guess: number | null
  guessedRight: boolean
  radiusChanged: boolean
  orbited: boolean
}

const TOP = 55
const SIDE = 45
const HALF_Y = 55
/** Sweep: rotate the section about an axis along the corner's diagonal, far inside the body. */
const RHO = 240
const AXIS = new THREE.Vector3(1, 0, -1).normalize()
const CENTRE = new THREE.Vector3(-1, 0, -1).normalize().multiplyScalar(RHO)
const KEY_POS = new THREE.Vector3(180, -180, 145)
const KEY_TARGET = new THREE.Vector3(-14, 0, -12)

type SectionSample = { p: V2; n: V2 }

/** The section in the XZ plane (x right, z up): top line, corner, side line. Each piece keeps its own normals. */
export function section(blend: Blend, r: number): SectionSample[][] {
  const reach = blend === "G0" ? 0 : blend === "G1" ? r : 1.5 * r
  const lineSeg = (a: V2, b: V2, n: V2, steps: number) => Array.from({ length: steps + 1 }, (_, i) => ({ p: [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps] as V2, n }))
  const top = lineSeg([-TOP, 0], [-reach, 0], [0, 1], 24)
  const side = lineSeg([0, -reach], [0, -SIDE], [1, 0], 24)
  if (blend === "G0") return [top, side]
  let corner: SectionSample[]
  if (blend === "G1") {
    corner = Array.from({ length: 41 }, (_, i) => {
      const a = Math.PI / 2 - ((Math.PI / 2) * i) / 40
      return { p: [-r + Math.cos(a) * r, -r + Math.sin(a) * r] as V2, n: [Math.cos(a), Math.sin(a)] as V2 }
    })
  } else corner = sampleBezier(g2CornerBlend([0, 0], [1, 0], [0, -1], r), 48).map((q) => ({ p: q.p, n: q.normal }))
  return [top, corner, side]
}

function sweptPatch(samples: SectionSample[], ny = 72) {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let j = 0; j <= ny; j++) {
    const y = -HALF_Y + (2 * HALF_Y * j) / ny
    q.setFromAxisAngle(AXIS, y / RHO)
    for (const s of samples) {
      p.set(s.p[0], 0, s.p[1]).sub(CENTRE).applyQuaternion(q).add(CENTRE)
      n.set(s.n[0], 0, s.n[1]).applyQuaternion(q)
      pos.push(p.x, p.y, p.z)
      nor.push(n.x, n.y, n.z)
    }
  }
  const row = samples.length
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < row - 1; i++) {
      const a = j * row + i
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  // Make the winding agree with the outward normals so front faces are the outside.
  const pa = new THREE.Vector3().fromArray(pos, 0)
  const pb = new THREE.Vector3().fromArray(pos, 3)
  const pc = new THREE.Vector3().fromArray(pos, row * 3)
  const geoN = pb.sub(pa).cross(pc.sub(pa))
  if (geoN.dot(new THREE.Vector3().fromArray(nor, 0)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    g.setIndex(idx)
  }
  return g
}

/** A boundary curve of the swept surface at one section point. */
function sweepLine(s: V2, ny = 72) {
  const out: THREE.Vector3[] = []
  const q = new THREE.Quaternion()
  for (let j = 0; j <= ny; j++) {
    const y = -HALF_Y + (2 * HALF_Y * j) / ny
    q.setFromAxisAngle(AXIS, y / RHO)
    out.push(new THREE.Vector3(s[0], 0, s[1]).sub(CENTRE).applyQuaternion(q).add(CENTRE))
  }
  return out
}

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/** Stripes from the reflected view direction: a row of parallel light tubes, like Zebra / Light tunnel in CAD. */
const FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDir;
uniform float uFreq;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 r = reflect(normalize(vP - cameraPosition), n);
  float s = asin(clamp(dot(r, uDir), -1.0, 1.0)) * uFreq;
  float t = abs(fract(s) - 0.5) * 2.0;
  float w = clamp(fwidth(s) * 1.5, 0.001, 0.5);
  float m = smoothstep(0.5 - w, 0.5 + w, t);
  gl_FragColor = vec4(mix(uA, uB, m), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const shuffle = (): Blend[] => {
  const a: Blend[] = ["G0", "G1", "G2"]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class ZebraScene extends LessonScene<ZebraState> {
  private body = new THREE.Group()
  private zebraMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uDir: { value: new THREE.Vector3(0.3, 1, 0.25).normalize() },
      uFreq: { value: 9 },
    },
  })
  private trackOrbit = false

  constructor(v: Viewer, emit: (s: ZebraState) => void) {
    super(v, emit, {
      step: 0,
      blend: "G1",
      zebra: false,
      radius: 14,
      freq: 9,
      seenG0: false,
      seenG1: false,
      seenG2: false,
      order: shuffle(),
      sample: 0,
      guess: null,
      guessedRight: false,
      radiusChanged: false,
      orbited: false,
    })
    v.setGrid(120, 10)
    v.showGrid(false)
    this.root.add(this.body)
    this.own(
      v.onCameraChange(() => {
        if (!this.trackOrbit || this.state.orbited) return
        const d = v.camera.position.clone().sub(v.controls.target).normalize()
        if (d.angleTo(KEY_POS.clone().sub(KEY_TARGET).normalize()) > THREE.MathUtils.degToRad(20)) this.set({ orbited: true })
      }),
    )
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<ZebraState> = { step }
    if (step === 0) Object.assign(patch, { zebra: false, blend: "G1" })
    if (step >= 1) patch.zebra = true
    if (step === 1) patch.blend = s.blend
    if (step === 2) Object.assign(patch, { sample: 0, guess: null })
    if (step === 3 && s.blend === "G0") patch.blend = "G1"
    this.set(patch)
    this.markSeen()
    this.trackOrbit = false
    this.v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 900).then(() => (this.trackOrbit = this.state.step === 4))
  }

  // ------------------------------------------------------------ actions

  setZebra(zebra: boolean) {
    this.set({ zebra })
  }

  setBlend(blend: Blend) {
    this.set({ blend })
    this.markSeen()
  }

  setSample(sample: number) {
    this.set({ sample, guess: null })
  }

  /** Blind test: claim the sample on screen is G2. */
  guess() {
    const s = this.state
    this.set({ guess: s.sample, guessedRight: s.guessedRight || s.order[s.sample] === "G2" })
  }

  setRadius(radius: number) {
    this.set({ radius, radiusChanged: true })
  }

  setFreq(freq: number) {
    this.set({ freq })
  }

  resetView() {
    this.v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 700)
  }

  private markSeen() {
    const b = this.shownBlend()
    if (this.state.step !== 1 && this.state.step !== 3) return
    const key = `seen${b}` as "seenG0" | "seenG1" | "seenG2"
    if (!this.state[key]) this.set({ [key]: true })
  }

  shownBlend(): Blend {
    const s = this.state
    return s.step === 2 ? s.order[s.sample] : s.blend
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.body)
    const u = this.zebraMat.uniforms
    ;(u.uA.value as THREE.Color).copy(tk.defined)
    ;(u.uB.value as THREE.Color).copy(tk.bg)
    u.uFreq.value = s.freq

    const blend = this.shownBlend()
    const pieces = section(blend, s.radius)
    pieces.forEach((pc, i) => {
      const g = sweptPatch(pc)
      const m = face(g, kit, { feature: "surface", role: pieces.length === 3 && i === 1 ? "highlight" : "model", edges: false })
      if (s.zebra) m.material = this.zebraMat
      this.body.add(m)
    })
    // Boundaries: outer edges, and the seams between pieces (tangent edges are drawn soft).
    const first = pieces[0][0].p
    const last = pieces[pieces.length - 1][pieces[pieces.length - 1].length - 1].p
    this.body.add(edgeLine(sweepLine(first), kit), edgeLine(sweepLine(last), kit))
    for (let i = 0; i < pieces.length - 1; i++) {
      const seam = pieces[i][pieces[i].length - 1].p
      this.body.add(edgeLine(sweepLine(seam), kit, blend !== "G0"))
    }
    for (const yEnd of [0, 1]) {
      const all = pieces.flat()
      const q = new THREE.Quaternion().setFromAxisAngle(AXIS, (yEnd ? HALF_Y : -HALF_Y) / RHO)
      const pts = all.map((x) => new THREE.Vector3(x.p[0], 0, x.p[1]).sub(CENTRE).applyQuaternion(q).add(CENTRE))
      this.body.add(edgeLine(pts, kit))
    }
    this.v.invalidate()
  }

  dispose() {
    this.v.showGrid(true)
    super.dispose()
    this.zebraMat.dispose()
  }
}
