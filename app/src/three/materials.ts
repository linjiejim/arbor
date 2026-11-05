import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { SceneTokens } from "./tokens"

/**
 * Every material the viewport uses, coloured from the scene tokens.
 * One kit per viewer; `applyTokens` recolours in place on theme change.
 *
 * Surface roles:
 *   model / modelDark / metal / glass   resting geometry
 *   highlight                           faces created by the current step
 *   ghost                               geometry from later steps (preview)
 * Line roles:
 *   edge / edgeSoft (tangent edges) / edgeGhost / edgeHighlight
 *   sketch (under-defined, accent) / sketchDefined / construction (dashed)
 */
export type SurfaceRole = "model" | "modelDark" | "metal" | "glass" | "highlight" | "modified" | "ghost"

export class MaterialKit {
  readonly clipping: THREE.Plane[] = []

  readonly model = this.surface({ roughness: 0.62, metalness: 0 })
  readonly modelDark = this.surface({ roughness: 0.5, metalness: 0 })
  readonly metal = this.surface({ roughness: 0.32, metalness: 0.85 })
  readonly glass = new THREE.MeshPhysicalMaterial({
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  readonly highlight = this.surface({ roughness: 0.5, metalness: 0, emissiveIntensity: 0.22 })
  readonly modified = this.surface({ roughness: 0.5, metalness: 0, emissiveIntensity: 0.18 })
  // Pushed back in depth so it never shimmers over coincident resting faces.
  readonly ghost = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    roughness: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  })
  readonly plane = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })
  readonly planeHover = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })

  readonly edge = new THREE.LineBasicMaterial()
  readonly edgeSoft = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75 })
  readonly edgeGhost = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false })
  readonly edgeHighlight = new THREE.LineBasicMaterial()
  readonly planeEdge = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 })
  readonly gridMinor = new THREE.LineBasicMaterial({ transparent: true, opacity: 1, depthWrite: false })
  readonly gridMajor = new THREE.LineBasicMaterial({ transparent: true, opacity: 1, depthWrite: false })

  readonly sketch = new LineMaterial({ linewidth: 2.2, worldUnits: false })
  readonly sketchThin = new LineMaterial({ linewidth: 1.2, worldUnits: false })
  readonly sketchDefined = new LineMaterial({ linewidth: 2.2, worldUnits: false })
  readonly construction = new LineMaterial({ linewidth: 1.2, worldUnits: false, dashed: true, dashSize: 4, gapSize: 3 })
  readonly dimension = new LineMaterial({ linewidth: 1, worldUnits: false })
  readonly path = new LineMaterial({ linewidth: 2.2, worldUnits: false, dashed: true, dashSize: 3, gapSize: 2 })

  private lineMaterials = [this.sketch, this.sketchThin, this.sketchDefined, this.construction, this.dimension, this.path]
  private sectionOn = false

  constructor(tokens: SceneTokens) {
    this.applyTokens(tokens)
  }

  private surface(p: THREE.MeshStandardMaterialParameters & { emissiveIntensity?: number }) {
    const m = new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...p })
    this.withCutFaces(m)
    return m
  }

  /** With a section plane active, back faces seen through the cut are painted flat: the solid looks filled. */
  private withCutFaces(m: THREE.MeshStandardMaterial) {
    const uCut = { value: new THREE.Color() }
    m.userData.uCut = uCut
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCutColor = uCut
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
        .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCutColor, 1.0);")
    }
    m.customProgramCacheKey = () => "ft-cut"
  }

  applyTokens(t: SceneTokens) {
    this.model.color.copy(t.model)
    this.modelDark.color.copy(t.modelDark)
    this.metal.color.copy(t.metal)
    this.glass.color.copy(t.dark ? t.edgeSoft : t.ghost)
    this.highlight.color.copy(t.highlight)
    this.highlight.emissive.copy(t.highlight)
    this.modified.color.copy(t.modified)
    this.modified.emissive.copy(t.modified)
    this.ghost.color.copy(t.ghost)
    this.plane.color.copy(t.plane)
    this.planeHover.color.copy(t.highlight)
    this.edge.color.copy(t.edge)
    this.edgeSoft.color.copy(t.edgeSoft)
    this.edgeGhost.color.copy(t.ghost)
    this.edgeHighlight.color.copy(t.highlight)
    this.planeEdge.color.copy(t.plane)
    this.gridMinor.color.copy(t.grid)
    this.gridMajor.color.copy(t.gridStrong)
    this.sketch.color.copy(t.sketch)
    this.sketchThin.color.copy(t.sketch)
    this.sketchDefined.color.copy(t.defined)
    this.construction.color.copy(t.edgeSoft)
    this.dimension.color.copy(t.defined)
    this.path.color.copy(t.sketch)
    for (const m of [this.model, this.modelDark, this.metal, this.highlight, this.modified]) (m.userData.uCut as { value: THREE.Color }).value.copy(t.cut)
  }

  setResolution(w: number, h: number) {
    for (const m of this.lineMaterials) m.resolution.set(w, h)
  }

  surfaceFor(role: SurfaceRole): THREE.Material {
    return this[role]
  }

  /** Clip every solid surface by `plane` (null turns the section off). */
  setSection(plane: THREE.Plane | null) {
    this.clipping.length = 0
    if (plane) this.clipping.push(plane)
    const on = !!plane
    for (const m of [this.model, this.modelDark, this.metal, this.highlight, this.modified, this.glass, this.edge, this.edgeSoft, this.edgeHighlight]) {
      m.clippingPlanes = on ? this.clipping : null
      if (m instanceof THREE.MeshStandardMaterial) m.side = on ? THREE.DoubleSide : THREE.FrontSide
      m.needsUpdate = this.sectionOn !== on
    }
    this.sectionOn = on
  }

  dispose() {
    for (const v of Object.values(this)) if (v instanceof THREE.Material) v.dispose()
  }
}
