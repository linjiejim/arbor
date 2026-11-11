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

type Group = DisplayData["groups"][number]

/**
 * A display's faces and edges sorted out by part, once per display: every redraw of the view reads
 * them (a part's triangles and edge points as one run each), and every mesh shares the two vertex
 * buffers, so they reach the graphics card once and not once per part.
 */
type Sorted = {
  position: THREE.BufferAttribute
  normal: THREE.BufferAttribute
  /**
   * Per part: its face groups (starting at 0 in `index`), its triangles, its edge points, and the box
   * round it. The box is the part's own (the vertex buffer is everyone's): a ray or a view that misses
   * it skips the part's triangles altogether.
   */
  parts: { groups: Group[]; index: Uint32Array; edges: Float32Array; box: THREE.Box3 }[] | null
  /** Faces no part claims (there shouldn't be any): drawn in place, never moved or hidden. */
  loose: { groups: Group[]; index: Uint32Array } | null
}
const SORTED = new WeakMap<DisplayData, Sorted>()

function sortedOf(d: DisplayData): Sorted | null {
  const m = d.mesh
  if (!m) return null
  const known = SORTED.get(d)
  if (known) return known
  const out: Sorted = { position: new THREE.BufferAttribute(m.vertices, 3), normal: new THREE.BufferAttribute(m.normals, 3), parts: null, loose: null }
  if (d.parts) {
    const n = d.parts.length
    const pack = (list: Group[]) => {
      const index = new Uint32Array(list.reduce((a, g) => a + g.count, 0))
      let at = 0
      const groups = list.map((g) => {
        index.set(m.triangles.subarray(g.start, g.start + g.count), at)
        at += g.count
        return { ...g, start: at - g.count }
      })
      return { groups, index }
    }
    const faces: Group[][] = Array.from({ length: n }, () => [])
    const loose: Group[] = []
    for (const g of d.groups) (g.part !== undefined && faces[g.part] ? faces[g.part] : loose).push(g)
    const sizes = new Array<number>(n).fill(0)
    for (const g of d.edgeGroups) if (g.part !== undefined && g.part < n) sizes[g.part] += g.count * 3
    const edges = sizes.map((size) => new Float32Array(size))
    const filled = new Array<number>(n).fill(0)
    if (d.edges)
      for (const g of d.edgeGroups) {
        if (g.part === undefined || g.part >= n) continue
        edges[g.part].set(d.edges.subarray(g.start * 3, (g.start + g.count) * 3), filled[g.part])
        filled[g.part] += g.count * 3
      }
    out.parts = faces.map((list, k) => {
      const packed = pack(list)
      const box = new THREE.Box3()
      const v = new THREE.Vector3()
      for (let i = 0; i < packed.index.length; i++) box.expandByPoint(v.fromArray(m.vertices, packed.index[i] * 3))
      return { ...packed, edges: edges[k], box }
    })
    if (loose.length) out.loose = pack(loose)
  }
  SORTED.set(d, out)
  return out
}

/** `paint` with its lists as sets: asked once per face, on every hover. */
type Brush = { status: boolean; selected: Set<number> | null; hovered: Set<number> | null; faces: Set<number> | null; highlight: Set<string> | null }
const brushOf = (p: Paint): Brush => ({
  status: p.status,
  selected: p.selected?.length ? new Set(p.selected) : null,
  hovered: p.hovered?.length ? new Set(p.hovered) : null,
  faces: p.faces ? new Set(p.faces) : null,
  highlight: p.highlight ? new Set(typeof p.highlight === "string" ? [p.highlight] : p.highlight) : null,
})

/**
 * Give a mesh its draw groups: neighbouring faces in the same material are drawn together (a part at
 * rest is one draw, not one per face). Which face a click landed on is read from `userData.groups`,
 * never from these.
 */
function paintMesh(mesh: THREE.Mesh, brush: Brush) {
  const groups = mesh.userData.groups as Group[]
  const rests = mesh.userData.rests as number[] | undefined
  const geo = mesh.geometry
  geo.clearGroups()
  let start = 0
  let count = 0
  let material = -1
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const m = materialIndex(g, brush, rests?.[i])
    if (count && m === material && g.start === start + count) count += g.count
    else {
      if (count) geo.addGroup(start, count, material)
      start = g.start
      count = g.count
      material = m
    }
  }
  if (count) geo.addGroup(start, count, material)
}

/** Parts are shown each on its own (pulled apart, some hidden or alone): what belongs to the whole body steps aside. */
const apart = (d: DisplayData, view: PartsView) => !!d.parts && (view.explode > 0 || view.hidden.size > 0 || !!view.focus || d.parts.some((p) => p.hidden))

/**
 * The live model as three.js objects: its faces (painted by this step's new / modified status, or by
 * provenance when a feature is highlighted), its edges, and the sketch outline if any. At rest each
 * part shows its own colour and finish (`looks`; off: a white model). A body in parts is one mesh and
 * one set of edges per part, all of them always there: hiding, isolating and pulling apart only show,
 * hide and move them (`applyView`), without building anything again.
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
  const sorted = sortedOf(d)
  const brush = brushOf(paint)
  const meshOf = (groups: Group[], index: THREE.BufferAttribute, box?: THREE.Box3) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", sorted!.position)
    geo.setAttribute("normal", sorted!.normal)
    geo.setIndex(index)
    if (box && !box.isEmpty()) {
      geo.boundingBox = box.clone()
      geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere())
    }
    const mesh = new THREE.Mesh(geo, materials)
    mesh.userData.groups = groups
    mesh.userData.rests = groups.map((g) => restOf(g.part, g.color))
    mesh.userData.materials = materials
    paintMesh(mesh, brush)
    return mesh
  }
  if (sorted?.parts && d.parts) {
    sorted.parts.forEach((part, k) => {
      const mesh = meshOf(part.groups, new THREE.BufferAttribute(part.index, 1), part.box)
      mesh.userData.part = k
      root.add(mesh)
      if (part.edges.length) {
        const eg = new THREE.BufferGeometry()
        eg.setAttribute("position", new THREE.BufferAttribute(part.edges, 3))
        if (!part.box.isEmpty()) {
          eg.boundingBox = part.box.clone()
          eg.boundingSphere = part.box.getBoundingSphere(new THREE.Sphere())
        }
        const lines = new THREE.LineSegments(eg, edgeOf(k))
        lines.userData.part = k
        lines.userData.rest = lines.material
        root.add(lines)
      }
    })
    if (sorted.loose) root.add(meshOf(sorted.loose.groups, new THREE.BufferAttribute(sorted.loose.index, 1)))
    root.userData.parts = true
  } else if (sorted && d.mesh) {
    root.add(meshOf(d.groups, new THREE.BufferAttribute(d.mesh.triangles, 1)))
    if (d.edges?.length) {
      const eg = new THREE.BufferGeometry()
      eg.setAttribute("position", new THREE.BufferAttribute(d.edges, 3))
      root.add(new THREE.LineSegments(eg, edgeOf(undefined)))
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
    // Drawn where the body is whole: they don't follow a part that moves or goes.
    rings.userData.whole = true
    root.add(rings)
  }
  if (d.sketch?.length) {
    const sg = new LineSegmentsGeometry()
    sg.setPositions(d.sketch)
    const lines = new LineSegments2(sg, kit.sketch)
    lines.renderOrder = 3
    lines.userData.whole = true
    root.add(lines)
  }
  addRefs(root, d, kit)
  applyView(root, d, view, kit)
  return root
}

/**
 * Show a model the way `view` says: each part visible or not, where it is when pulled apart, and
 * see-through when others are kept solid. Cheap enough for every step of the explode slider.
 */
export function applyView(root: THREE.Object3D, d: DisplayData, view: PartsView, kit: MaterialKit) {
  if (!root.userData.parts || !d.parts) return
  const split = apart(d, view)
  const solid = view.focus?.mode === "ghost" ? new Set(view.focus.parts) : null
  for (const o of root.children) {
    const k = o.userData.part as number | undefined
    if (k === undefined) {
      if (o.userData.whole) o.visible = !split
      continue
    }
    const part = d.parts[k]
    o.visible = partVisible(d, view, k)
    o.position.set(part.explode[0] * view.explode, part.explode[1] * view.explode, part.explode[2] * view.explode)
    const ghost = !!solid && !solid.has(part.name)
    if ((o as THREE.Mesh).isMesh) {
      ;(o as THREE.Mesh).material = ghost ? kit.ghost : (o.userData.materials as THREE.Material[])
      o.userData.contextGhost = ghost
    } else (o as THREE.LineSegments).material = ghost ? kit.edgeGhost : (o.userData.rest as THREE.Material)
  }
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

function materialIndex(g: Group, paint: Brush, rest = 0) {
  // At rest: the part's own look (or the neutral white model); interaction and optional changes go on top.
  if (g.part !== undefined && paint.selected?.has(g.part)) return 1
  if (paint.hovered?.has(g.hash)) return 5
  if (paint.faces) return paint.faces.has(g.hash) ? 1 : rest
  if (paint.highlight) return paint.highlight.has(g.origin) ? 1 : rest
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
  const brush = brushOf(paint)
  for (const o of root.children) {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.userData.groups) paintMesh(mesh, brush)
  }
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
export function groupAt(hit: THREE.Intersection): Group | null {
  const groups = (hit.object as THREE.Mesh).userData.groups as Group[] | undefined
  if (!groups || hit.faceIndex === undefined || hit.faceIndex === null) return null
  const idx = hit.faceIndex * 3
  // Groups come in the order of their triangles: halve the way to the one holding `idx`.
  let lo = 0
  let hi = groups.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const g = groups[mid]
    if (idx < g.start) hi = mid - 1
    else if (idx >= g.start + g.count) lo = mid + 1
    else return g
  }
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
