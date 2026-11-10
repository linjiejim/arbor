import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { SceneTokens } from "./tokens"
import { hexOf, luminance, type Look } from "@/studio/appearance"

/** What a part draws with: its surface and its edges. */
export type LookMaterials = { surface: THREE.Material; edge: THREE.LineBasicMaterial }

/**
 * Every material the viewport uses, coloured from the scene tokens.
 * One kit per viewer; `applyTokens` recolours in place on theme change.
 *
 * Surface roles:
 *   model / modelDark / metal / glass   resting geometry
 *   highlight / hovered                 selection / pointer hover
 *   added / modified                    opt-in step changes
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
  readonly hovered = this.surface({ roughness: 0.6, metalness: 0 })
  readonly added = this.surface({ roughness: 0.5, metalness: 0 })
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
  /** Parts' own colours, by colour and finish: made on first use, kept for the viewer's life. */
  private looks = new Map<string, LookMaterials>()

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
    this.hovered.color.copy(t.hover)
    this.added.color.copy(t.good)
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
    for (const m of [this.model, this.modelDark, this.metal, this.hovered, this.added, this.highlight, this.modified]) (m.userData.uCut as { value: THREE.Color }).value.copy(t.cut)
  }

  setResolution(w: number, h: number) {
    for (const m of this.lineMaterials) m.resolution.set(w, h)
  }

  surfaceFor(role: SurfaceRole): THREE.Material {
    return this[role]
  }

  /**
   * The materials a part draws with. Nothing set: the theme's own by where it comes from (white model,
   * metal grey for standard parts, a darker grey for STEP files), so light and dark mode still apply.
   * A colour: real colour, the same in either mode, its edges a shade apart so they read on it.
   */
  forLook(look: Look | undefined): LookMaterials {
    const hex = hexOf(look?.color)
    const finish = look?.finish ?? (look?.source === "standard" ? "metal" : "matte")
    if (!hex) {
      if (finish === "clear") return { surface: this.glass, edge: this.edgeSoft }
      if (finish === "metal") return { surface: this.metal, edge: this.edge }
      return look?.source === "step" ? { surface: this.modelDark, edge: this.edgeSoft } : { surface: this.model, edge: this.edge }
    }
    const key = `${hex}|${finish}`
    let m = this.looks.get(key)
    if (!m) {
      m = this.makeLook(hex, finish)
      this.looks.set(key, m)
    }
    return m
  }

  private makeLook(hex: string, finish: "matte" | "metal" | "clear"): LookMaterials {
    const color = new THREE.Color(hex)
    let surface: THREE.MeshStandardMaterial
    if (finish === "clear") {
      // See-through like the reference bodies, tinted: the parts inside stay readable.
      surface = new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })
      // Both sides always: the far wall of a clear shell shows through the near one.
      surface.userData.clear = true
    } else {
      surface = this.surface(finish === "metal" ? { roughness: 0.32, metalness: 0.85 } : { roughness: 0.62, metalness: 0 })
      surface.color.copy(color)
      // The cut face of a section: the part's own colour, darker, so a cut assembly shows whose material is whose.
      ;(surface.userData.uCut as { value: THREE.Color }).value.copy(color).multiplyScalar(0.55)
    }
    // Dark parts get light edges, light ones darker edges of their own hue.
    const edgeColor = luminance(hex) < 0.1 ? color.clone().lerp(new THREE.Color(1, 1, 1), 0.5) : color.clone().multiplyScalar(0.3)
    const edge = new THREE.LineBasicMaterial({ color: edgeColor, ...(finish === "clear" ? { transparent: true, opacity: 0.6 } : {}) })
    this.clip([surface, edge])
    return { surface, edge }
  }

  private lookMaterials() {
    return [...this.looks.values()].flatMap((m) => [m.surface, m.edge])
  }

  /** Clipping for these materials as for the rest (a section may be on when they're made). */
  private clip(list: THREE.Material[]) {
    for (const m of list) {
      m.clippingPlanes = this.sectionOn ? this.clipping : null
      if (m instanceof THREE.MeshStandardMaterial && !m.userData.clear) m.side = this.sectionOn ? THREE.DoubleSide : THREE.FrontSide
      m.needsUpdate = true
    }
  }

  /** Clip every solid surface by `plane` (null turns the section off). */
  setSection(plane: THREE.Plane | null) {
    this.clipping.length = 0
    if (plane) this.clipping.push(plane)
    const on = !!plane
    for (const m of [this.model, this.modelDark, this.metal, this.hovered, this.added, this.highlight, this.modified, this.glass, this.edge, this.edgeSoft, this.edgeHighlight, ...this.lookMaterials()]) {
      m.clippingPlanes = on ? this.clipping : null
      if (m instanceof THREE.MeshStandardMaterial && !m.userData.clear) m.side = on ? THREE.DoubleSide : THREE.FrontSide
      m.needsUpdate = this.sectionOn !== on
    }
    this.sectionOn = on
  }

  dispose() {
    for (const v of Object.values(this)) if (v instanceof THREE.Material) v.dispose()
    for (const m of this.lookMaterials()) m.dispose()
    this.looks.clear()
  }
}
