import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { datumPlane, label, linearDim } from "./build"
import type { MaterialKit } from "./materials"
import type { OpId } from "@/content/ops"

/**
 * Models baked offline from build123d (models/arborbake). A manifest describes
 * the feature tree and the parameter sandbox; each parameter combination is
 * one GLB whose top-level nodes are the steps of the feature tree.
 *
 * Face nodes carry { status: "new" | "modified" | "kept", origin, modifiedBy }:
 * the kernel-accurate answer to "which faces did this feature make or change".
 */
export type FaceStatus = "new" | "modified" | "kept"

export type BakedParam = { id: string; label: string; unit: string; default: number; values: number[]; feature: string }

export type BakedFeature = {
  id: string
  op: OpId
  name: string
  title: string
  why: string
  summary: string
  summaryTemplate: string
  pitfall: string
  view: [number, number, number]
  focus: [[number, number, number], [number, number, number]] | null
  code: string
}

export type BakedVariant = {
  ok: boolean
  values: Record<string, number>
  file?: string
  bytes?: number
  steps?: number
  failedAt?: string
  reason?: string
  triangles?: number
  /** Feature summaries for this parameter set (derived values included). */
  summaries?: Record<string, string>
  volume?: number
  bbox?: [[number, number, number], [number, number, number]]
}

export type PartManifest = {
  kind: "part"
  id: string
  title: string
  subtitle: string
  level: string
  teaches: string[]
  params: BakedParam[]
  features: BakedFeature[]
  failures: Record<string, string>
  defaultVariant: string
  variants: Record<string, BakedVariant>
  source: string
}

export type BakedPart = {
  id: string
  name: string
  qty: number
  material: string
  process: string
  role: "model" | "modelDark" | "metal" | "glass"
  explode: [number, number, number]
  order: number
  note: string
  model: string | null
  motion: { type: "revolute"; origin: [number, number, number]; axis: [number, number, number]; min: number; max: number; label: string } | null
}

export type AssemblyManifest = {
  kind: "assembly"
  id: string
  title: string
  subtitle: string
  level: string
  teaches: string[]
  parts: BakedPart[]
  notes: string[]
  file: string
  bytes: number
  source: string
}

export type Manifest = PartManifest | AssemblyManifest

export type ModelIndexEntry = {
  kind: "part" | "assembly"
  id: string
  title: string
  subtitle: string
  level: string
  teaches: string[]
  features?: number
  parts?: number
}

const base = `${import.meta.env.BASE_URL}models`
const json = new Map<string, Promise<unknown>>()
const fetchJson = <T,>(url: string) => {
  if (!json.has(url)) json.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${url}`)))))
  return json.get(url) as Promise<T>
}

export const loadIndex = () => fetchJson<Record<string, ModelIndexEntry>>(`${base}/index.json`)
export const loadManifest = (id: string) => fetchJson<Manifest>(`${base}/${id}/manifest.json`)

export const variantKey = (grid: BakedParam[], values: Record<string, number>) =>
  grid
    .map((p) => p.id)
    .sort()
    .map((id) => `${id}-${fmt(values[id])}`)
    .join("_") || "default"

/** Python's "%g" for the values we use. */
const fmt = (v: number) => String(Number(v.toPrecision(6)))

const loader = new GLTFLoader()
const gltfCache = new Map<string, Promise<THREE.Group>>()

/** Raw scene of a variant file (shared, never mutated: callers clone what they display). */
export function loadGlb(modelId: string, file: string) {
  const url = `${base}/${modelId}/${file}`
  if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url).then((g) => g.scene))
  return gltfCache.get(url)!
}

export type FaceInfo = { kind: "face"; id: number; status: FaceStatus; origin: string; modifiedBy: string[]; geom: string }

/**
 * Convert one baked step node into display objects coloured by the kit.
 * Geometry is shared with the cached GLB (marked shared so disposal skips it).
 */
export function displayStep(node: THREE.Object3D, kit: MaterialKit, opts: { role?: "model" | "modelDark" | "metal" | "glass"; part?: string } = {}) {
  const g = new THREE.Group()
  g.userData = { ...node.userData }
  for (const child of node.children) {
    const d = child.userData as Record<string, unknown>
    if (d.kind === "face" && child instanceof THREE.Mesh) {
      const geo = child.geometry as THREE.BufferGeometry
      if (!geo.getAttribute("normal")) geo.computeVertexNormals()
      geo.userData.shared = true
      const m = new THREE.Mesh(geo, kit.surfaceFor(opts.role ?? "model"))
      m.userData = { ...d, kind: "face", feature: d.origin, role: opts.role ?? "model", part: opts.part }
      g.add(m)
    } else if (d.kind === "edges" && child instanceof THREE.LineSegments) {
      const geo = child.geometry as THREE.BufferGeometry
      geo.userData.shared = true
      const l = new THREE.LineSegments(geo, d.soft ? kit.edgeSoft : kit.edge)
      l.userData = { kind: "edge", soft: d.soft }
      l.raycast = () => {}
      g.add(l)
    } else if ((d.kind === "sketch" || d.kind === "construction") && child instanceof THREE.LineSegments) {
      const pos = (child.geometry as THREE.BufferGeometry).getAttribute("position").array as Float32Array
      const lg = new LineSegmentsGeometry().setPositions(Array.from(pos))
      const l = new LineSegments2(lg, d.kind === "sketch" ? kit.sketch : kit.construction)
      l.computeLineDistances()
      l.userData = { kind: d.kind }
      g.add(l)
    } else if (d.kind === "plane") {
      const p = d as unknown as { origin: number[]; x: number[]; normal: number[]; size: number; name: string }
      const plane = datumPlane(kit, "XY", p.size, p.name || undefined)
      const x = new THREE.Vector3(...p.x)
      const z = new THREE.Vector3(...p.normal)
      const y = new THREE.Vector3().crossVectors(z, x)
      plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
      plane.position.set(p.origin[0], p.origin[1], p.origin[2])
      plane.userData = { kind: "plane-overlay" }
      g.add(plane)
    } else if (d.kind === "dim") {
      const p = d as unknown as { a: number[]; b: number[]; dir: number[]; offset: number; text: string }
      g.add(linearDim(kit, new THREE.Vector3(...p.a), new THREE.Vector3(...p.b), new THREE.Vector3(...p.dir), p.offset, p.text))
    } else if (d.kind === "label") {
      const p = d as unknown as { at: number[]; text: string }
      g.add(label(p.text, new THREE.Vector3(...p.at)))
    }
  }
  return g
}

/** Steps of a part variant, in feature order. */
export function stepsOf(scene: THREE.Group) {
  return [...scene.children].filter((c) => c.userData.kind === "step").sort((a, b) => a.userData.index - b.userData.index)
}

export function partsOf(scene: THREE.Group) {
  return new Map([...scene.children].filter((c) => c.userData.kind === "part").map((c) => [c.userData.part as string, c]))
}
