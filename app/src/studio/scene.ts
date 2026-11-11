import * as THREE from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import type { MaterialKit } from "@/three/materials"
import { isSet } from "./appearance"
import type { DisplayData } from "./kernel/build"

/**
 * How faces are coloured: by this step's status, by provenance (`highlight` =
 * feature ids), or, when `faces` is given, only those faces (by mesh hash).
 */
export type Paint = { status: boolean; selected?: number[]; hovered?: number[]; highlight?: string | string[]; faces?: number[] }

/** Features lit up from outside the viewport (a tree row, a parameter), and what the legend calls them. */
export type Hover = {
  ids: string[]
  label: string
  /** Pointing at a parameter: its dimensions on the model, joined to `row` by a line. */
  param?: string
  row?: HTMLElement
  /** Pointing at a feature row: that step's dimensions. */
  feature?: string
  /** Pointing at one dimension (a row of the feature card). */
  dim?: string
  /** Pointing at a requirement: the faces and edges it measures. */
  faces?: number[]
  edges?: number[]
}

/** The look a part (by index; none: the unsplit body) is drawn with. */
const lookAt = (d: DisplayData, k: number | undefined) => (k !== undefined && d.parts ? d.parts[k]?.look : d.look)

/** Something to colour: a part with a colour or finish set, or a standard part or a STEP file (they draw apart). */
export function hasLooks(d: DisplayData | null | undefined) {
  if (!d) return false
  const list = d.parts ? d.parts.map((p) => p.look) : [d.look]
  return list.some((l) => !!l && (isSet(l) || l.source !== "part" || !!l.fileColor))
}

/**
 * The live model as three.js objects: one mesh with a group per B-rep face
 * (painted by this step's new / modified status, or by provenance when a
 * feature is highlighted), its edges, and the sketch outline if any. At rest
 * each part shows its own colour and finish (`looks`; off: a white model).
 */
export function modelObject(d: DisplayData, kit: MaterialKit, paint: Paint, view: PartsView = NO_PARTS_VIEW, looks = true): THREE.Group {
  const root = new THREE.Group()
  root.name = "studio-model"
  const materials: THREE.Material[] = [kit.model, kit.highlight, kit.modified, kit.ghost, kit.modelDark, kit.hovered, kit.added]
  // Each face's resting material: an index into `materials` (0, the white model, when looks are off).
  // A colour set on the part wins; else a STEP file's own colour for that face; else by where it comes from.
  const restOf = (k: number | undefined, fileColor?: string) => {
    const look = lookAt(d, k)
    if (!looks || !look) return 0
    const m = kit.forLook(!look.color && fileColor ? { ...look, color: fileColor } : look).surface
    const i = materials.indexOf(m)
    return i >= 0 ? i : materials.push(m) - 1
  }
  const edgeOf = (k: number | undefined) => {
    const look = lookAt(d, k)
    if (!looks || !look) return kit.edge
    return kit.forLook(!look.color && look.fileColor ? { ...look, color: look.fileColor } : look).edge
  }
  // Parts pulled apart or hidden: one mesh (and edge set) per part, moved along its explode vector.
  if (d.parts && (view.explode > 0 || view.hidden.size || view.focus || d.parts.some((p) => p.hidden))) {
    d.parts.forEach((part, k) => {
      if (!partVisible(d, view, k) || !d.mesh) return
      const ghost = view.focus?.mode === "ghost" && !view.focus.parts.includes(part.name)
      const groups = d.groups.filter((g) => g.part === k)
      const index: number[] = []
      const own = groups.map((g) => {
        const start = index.length
        for (let i = g.start; i < g.start + g.count; i++) index.push(d.mesh!.triangles[i])
        return { ...g, start }
      })
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.BufferAttribute(d.mesh.vertices, 3))
      geo.setAttribute("normal", new THREE.BufferAttribute(d.mesh.normals, 3))
      geo.setIndex(index)
      const rests = own.map((g) => restOf(k, g.color))
      own.forEach((g, i) => geo.addGroup(g.start, g.count, materialIndex(g, paint, rests[i])))
      const mesh = new THREE.Mesh(geo, ghost ? kit.ghost : materials)
      mesh.userData.contextGhost = ghost
      mesh.userData.groups = own
      mesh.userData.rests = rests
      mesh.userData.part = k
      const at = new THREE.Vector3(...part.explode).multiplyScalar(view.explode)
      mesh.position.copy(at)
      root.add(mesh)
      if (d.edges) {
        const pts: number[] = []
        for (const g of d.edgeGroups) if (g.part === k) for (let i = g.start * 3; i < (g.start + g.count) * 3; i++) pts.push(d.edges[i])
        const eg = new THREE.BufferGeometry()
        eg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
        const lines = new THREE.LineSegments(eg, ghost ? kit.edgeGhost : edgeOf(k))
        lines.position.copy(at)
        root.add(lines)
      }
    })
    addRefs(root, d, kit)
    root.userData.partsMode = true
    return root
  }
  if (d.mesh) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(d.mesh.vertices, 3))
    geo.setAttribute("normal", new THREE.BufferAttribute(d.mesh.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(d.mesh.triangles, 1))
    const rests = d.groups.map((g) => restOf(g.part, g.color))
    d.groups.forEach((g, i) => geo.addGroup(g.start, g.count, materialIndex(g, paint, rests[i])))
    const mesh = new THREE.Mesh(geo, materials)
    mesh.userData.groups = d.groups
    mesh.userData.rests = rests
    root.add(mesh)
  }
  if (d.edges?.length) {
    // One set of lines per edge material (parts in different colours have edges of their own).
    const runs = new Map<THREE.Material, number[]>()
    const parted = looks && d.parts && d.edgeGroups.some((g) => g.part !== undefined)
    if (parted) {
      for (const g of d.edgeGroups) {
        const m = edgeOf(g.part)
        const pts = runs.get(m) ?? []
        for (let i = g.start * 3; i < (g.start + g.count) * 3; i++) pts.push(d.edges[i])
        runs.set(m, pts)
      }
    }
    if (!parted || runs.size === 1) {
      const eg = new THREE.BufferGeometry()
      eg.setAttribute("position", new THREE.BufferAttribute(d.edges, 3))
      root.add(new THREE.LineSegments(eg, parted ? [...runs.keys()][0] : edgeOf(undefined)))
    } else {
      for (const [m, pts] of runs) {
        const eg = new THREE.BufferGeometry()
        eg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
        root.add(new THREE.LineSegments(eg, m))
      }
    }
  }
  if (d.threads?.length) {
    // Cosmetic threads: dashed rings at the nominal diameter, as on a drawing.
    const pts: number[] = []
    for (const t of d.threads) {
      const axis = new THREE.Vector3(...t.axis).normalize()
      const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)).normalize()
      const v = new THREE.Vector3().crossVectors(axis, u)
      const c = new THREE.Vector3(...t.center)
      const at = (k: number) => {
        const a = (k / 48) * Math.PI * 2
        return c.clone().addScaledVector(u, Math.cos(a) * t.r).addScaledVector(v, Math.sin(a) * t.r)
      }
      for (let k = 0; k < 48; k++) pts.push(...at(k).toArray(), ...at(k + 1).toArray())
    }
    const tg = new LineSegmentsGeometry()
    tg.setPositions(pts)
    const rings = new LineSegments2(tg, kit.construction)
    rings.computeLineDistances()
    rings.name = "threads"
    root.add(rings)
  }
  if (d.sketch?.length) {
    const sg = new LineSegmentsGeometry()
    sg.setPositions(d.sketch)
    const lines = new LineSegments2(sg, kit.sketch)
    lines.renderOrder = 3
    root.add(lines)
  }
  addRefs(root, d, kit)
  return root
}

/** Reference bodies (`import`, desktop app): see-through, faint edges, not pickable, never painted. */
function addRefs(root: THREE.Group, d: DisplayData, kit: MaterialKit) {
  for (const r of d.refs ?? []) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(r.mesh.vertices, 3))
    geo.setAttribute("normal", new THREE.BufferAttribute(r.mesh.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(r.mesh.triangles, 1))
    const mesh = new THREE.Mesh(geo, kit.glass)
    mesh.userData.reference = r.id
    mesh.renderOrder = 2
    root.add(mesh)
    if (r.edges?.length) {
      const eg = new THREE.BufferGeometry()
      eg.setAttribute("position", new THREE.BufferAttribute(r.edges, 3))
      root.add(new THREE.LineSegments(eg, kit.edgeGhost))
    }
  }
}

function materialIndex(g: DisplayData["groups"][number], paint: Paint, rest = 0) {
  // At rest: the part's own look (or the neutral white model); interaction and optional changes go on top.
  if (g.part !== undefined && paint.selected?.includes(g.part)) return 1
  if (paint.hovered?.includes(g.hash)) return 5
  if (paint.faces) return paint.faces.includes(g.hash) ? 1 : rest
  if (paint.highlight) return (typeof paint.highlight === "string" ? g.origin === paint.highlight : paint.highlight.includes(g.origin)) ? 1 : rest
  if (!paint.status) return rest
  return g.status === "new" ? 6 : g.status === "modified" ? 2 : rest
}

/** How a split body is shown: parts pulled apart (0–1 of their explode vectors) and hidden ones. */
export type PartsView = { explode: number; hidden: Set<number>; focus?: { parts: string[]; mode: "isolate" | "ghost" } }
export const NO_PARTS_VIEW: PartsView = { explode: 0, hidden: new Set() }

/** Visibility and translations are shared by rendering, picking and annotation pins. */
export function partVisible(d: DisplayData, view: PartsView, index: number) {
  const part = d.parts?.[index]
  return !!part && !part.hidden && !view.hidden.has(index) && (view.focus?.mode !== "isolate" || view.focus.parts.includes(part.name))
}
export function partOffset(d: DisplayData, view: PartsView, index?: number): [number, number, number] {
  const part = index === undefined ? undefined : d.parts?.[index]
  return part ? part.explode.map((v) => v * view.explode) as [number, number, number] : [0, 0, 0]
}

/** Re-paint an existing model object without rebuilding geometry. */
export function repaint(root: THREE.Object3D, paint: Paint) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.userData.groups || mesh.userData.contextGhost) return
    const groups = mesh.userData.groups as DisplayData["groups"]
    const rests = mesh.userData.rests as number[] | undefined
    mesh.geometry.groups.forEach((gr, i) => (gr.materialIndex = materialIndex(groups[i], paint, rests?.[i])))
  })
}

/** Thick lines over the given edges (by mesh hash), drawn on top of the model. */
export function edgeHighlight(d: DisplayData, hashes: number[], kit: MaterialKit, view: PartsView = NO_PARTS_VIEW): THREE.Object3D | null {
  if (!d.edges) return null
  const pts: number[] = []
  for (const g of d.edgeGroups) {
    if (!hashes.includes(g.hash) || (g.part !== undefined && !partVisible(d, view, g.part))) continue
    const offset = partOffset(d, view, g.part)
    for (let i = g.start * 3; i < (g.start + g.count) * 3; i++) pts.push(d.edges[i] + offset[i % 3])
  }
  if (!pts.length) return null
  const geo = new LineSegmentsGeometry()
  geo.setPositions(pts)
  // Its own material: thicker, in the highlight colour, and never hidden by the faces it borders.
  const mat = kit.sketch.clone()
  mat.color.copy(kit.edgeHighlight.color)
  mat.linewidth = 4
  mat.depthTest = false
  mat.resolution.copy(kit.sketch.resolution)
  const lines = new LineSegments2(geo, mat)
  lines.renderOrder = 4
  return lines
}

/** Strokes drawn for a note (P), shown again when it is located: thick, highlighted, never hidden. */
export function regionStrokes(strokes: [number, number, number][][], kit: MaterialKit): THREE.Object3D | null {
  const pts: number[] = []
  for (const s of strokes) for (let i = 1; i < s.length; i++) pts.push(...s[i - 1], ...s[i])
  if (!pts.length) return null
  const geo = new LineSegmentsGeometry()
  geo.setPositions(pts)
  const mat = kit.sketch.clone()
  mat.color.copy(kit.edgeHighlight.color)
  mat.linewidth = 3
  mat.depthTest = false
  mat.resolution.copy(kit.sketch.resolution)
  const lines = new LineSegments2(geo, mat)
  lines.renderOrder = 5
  return lines
}

/** The face group a raycast hit landed on. */
export function groupAt(hit: THREE.Intersection): DisplayData["groups"][number] | null {
  const groups = (hit.object as THREE.Mesh).userData.groups as DisplayData["groups"] | undefined
  if (!groups || hit.faceIndex === undefined || hit.faceIndex === null) return null
  const idx = hit.faceIndex * 3
  return groups.find((x) => idx >= x.start && idx < x.start + x.count) ?? null
}

/** A rendered face pick expressed in the native assembly's coordinates. */
export function faceTarget(hit: THREE.Intersection) {
  const group = groupAt(hit)
  return group ? { hash: group.hash, point: hit.point.clone().sub(hit.object.position).toArray() as [number, number, number] } : null
}

/**
 * The box round some faces as shown (each moved with its part when pulled apart): what 「对准选中的」
 * frames, and where a note about a part or a step puts its pin. `faces` picks the face groups.
 */
export function facesBox(d: DisplayData, view: PartsView, faces: (g: DisplayData["groups"][number]) => boolean): [[number, number, number], [number, number, number]] | null {
  const m = d.mesh
  if (!m) return null
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const g of d.groups) {
    if (!faces(g)) continue
    const off = partOffset(d, view, g.part)
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = m.triangles[i] * 3
      for (let k = 0; k < 3; k++) {
        const x = m.vertices[v + k] + off[k]
        if (x < lo[k]) lo[k] = x
        if (x > hi[k]) hi[k] = x
      }
    }
  }
  return lo[0] <= hi[0] ? [lo as [number, number, number], hi as [number, number, number]] : null
}
