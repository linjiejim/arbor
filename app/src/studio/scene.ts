import * as THREE from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import type { MaterialKit } from "@/three/materials"
import type { DisplayData } from "./kernel/build"

/**
 * How faces are coloured: by this step's status, by provenance (`highlight` =
 * a feature id), or, when `faces` is given, only those faces (by mesh hash).
 */
export type Paint = { status: boolean; highlight?: string; faces?: number[] }

/**
 * The live model as three.js objects: one mesh with a group per B-rep face
 * (painted by this step's new / modified status, or by provenance when a
 * feature is highlighted), its edges, and the sketch outline if any.
 */
export function modelObject(d: DisplayData, kit: MaterialKit, paint: Paint): THREE.Group {
  const root = new THREE.Group()
  root.name = "studio-model"
  if (d.mesh) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(d.mesh.vertices, 3))
    geo.setAttribute("normal", new THREE.BufferAttribute(d.mesh.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(d.mesh.triangles, 1))
    for (const g of d.groups) geo.addGroup(g.start, g.count, materialIndex(g, paint))
    const mesh = new THREE.Mesh(geo, [kit.model, kit.highlight, kit.modified, kit.ghost])
    mesh.userData.groups = d.groups
    root.add(mesh)
  }
  if (d.edges?.length) {
    const eg = new THREE.BufferGeometry()
    eg.setAttribute("position", new THREE.BufferAttribute(d.edges, 3))
    root.add(new THREE.LineSegments(eg, kit.edge))
  }
  if (d.sketch?.length) {
    const sg = new LineSegmentsGeometry()
    sg.setPositions(d.sketch)
    const lines = new LineSegments2(sg, kit.sketch)
    lines.renderOrder = 3
    root.add(lines)
  }
  return root
}

function materialIndex(g: DisplayData["groups"][number], paint: Paint) {
  if (paint.faces) return paint.faces.includes(g.hash) ? 1 : 0
  if (paint.highlight) return g.origin === paint.highlight ? 1 : 0
  if (!paint.status) return 0
  return g.status === "new" ? 1 : g.status === "modified" ? 2 : 0
}

/** Re-paint an existing model object without rebuilding geometry. */
export function repaint(root: THREE.Object3D, paint: Paint) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.userData.groups) return
    const groups = mesh.userData.groups as DisplayData["groups"]
    mesh.geometry.groups.forEach((gr, i) => (gr.materialIndex = materialIndex(groups[i], paint)))
  })
}

/** Thick lines over the given edges (by mesh hash), drawn on top of the model. */
export function edgeHighlight(d: DisplayData, hashes: number[], kit: MaterialKit): THREE.Object3D | null {
  if (!d.edges) return null
  const pts: number[] = []
  for (const g of d.edgeGroups) {
    if (!hashes.includes(g.hash)) continue
    for (let i = g.start * 3; i < (g.start + g.count) * 3; i++) pts.push(d.edges[i])
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

/** The face group a raycast hit landed on. */
export function groupAt(hit: THREE.Intersection): DisplayData["groups"][number] | null {
  const groups = (hit.object as THREE.Mesh).userData.groups as DisplayData["groups"] | undefined
  if (!groups || hit.faceIndex === undefined || hit.faceIndex === null) return null
  const idx = hit.faceIndex * 3
  return groups.find((x) => idx >= x.start && idx < x.start + x.count) ?? null
}
