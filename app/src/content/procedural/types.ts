import type * as THREE from "three"
import type { MaterialKit, SurfaceRole } from "@/three/materials"
import type { OpId } from "@/content/ops"

/**
 * Procedural illustration models (the home page hero). Real teardowns are
 * baked from build123d (models/ and three/baked.ts).
 *
 * A model is data plus a pure build function: given parameter
 * values and "how far along the feature tree", it returns fresh geometry.
 * Rolling back, scrubbing and changing a parameter all just call build again.
 */
export type ParamDef = {
  id: string
  label: string
  unit: "mm" | "°" | ""
  min: number
  max: number
  step: number
  value: number
  /** The feature that owns this value (shown as "影响：…" in the panel). */
  feature: string
}

export type FeatureDef = {
  id: string
  op: OpId
  /** Name as it would read in a feature tree: 草图1, 旋转1… */
  name: string
  /** What this feature makes: 杯身, 把手… */
  title: string
  /** Short mono summary of its settings. */
  summary: (p: Params) => string
  /** Why this step, why here (design intent). One or two sentences. */
  why: string
  /** What tends to go wrong. */
  pitfall?: string
  /** Best viewpoint for this step: a direction from the target. */
  view?: [number, number, number]
  /** Focus region for the camera (model coordinates). */
  focus?: (p: Params) => THREE.Box3
}

export type Params = Record<string, number>

export type BuildInput = {
  kit: MaterialKit
  params: Params
  /** Index of the last feature included. */
  upto: number
  /** 0–1 progress of feature `upto`, for the creation animation. */
  progress: number
}

export type BuildOutput = {
  group: THREE.Group
  /** Plain-language notes when a value had to be limited (like a CAD rebuild warning). */
  warnings: string[]
}

export type PartModel = {
  kind: "part"
  id: string
  title: string
  subtitle: string
  level: "入门" | "进阶" | "高级"
  params: ParamDef[]
  features: FeatureDef[]
  build: (input: BuildInput) => BuildOutput
  /** Bounding box of the finished part, for framing. */
  bounds: (p: Params) => THREE.Box3
}

export type PartDef = {
  id: string
  name: string
  qty: number
  material: string
  process: string
  role: SurfaceRole
  /** Exploded offset at 100%, mm, along the real removal direction. */
  explode: [number, number, number]
  /** Assembly order (1 = first placed). */
  order: number
  note: string
}

export type AssemblyModel = {
  kind: "assembly"
  id: string
  title: string
  subtitle: string
  level: "入门" | "进阶" | "高级"
  parts: PartDef[]
  /** Build every part at its assembled position; each root object is named by part id. */
  build: (kit: MaterialKit) => Map<string, THREE.Object3D>
  bounds: () => THREE.Box3
}

export type Model = PartModel | AssemblyModel

export const defaults = (defs: ParamDef[]): Params => Object.fromEntries(defs.map((d) => [d.id, d.value]))
