import * as THREE from "three"
import { Line2 } from "three/addons/lines/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import type { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import type { MaterialKit, SurfaceRole } from "./materials"

/**
 * Scene-building helpers shared by lessons, teardowns and the atlas.
 *
 * Every face mesh carries userData { feature, role }: `feature` is the id of
 * the modelling step that created it, which is what lets the UI highlight
 * "the faces this step made" and ghost the steps still to come.
 */
export type FaceData = { kind: "face"; feature?: string; role: SurfaceRole; part?: string }

export function face(
  geo: THREE.BufferGeometry,
  kit: MaterialKit,
  opts: { feature?: string; role?: SurfaceRole; part?: string; edges?: number | false; name?: string } = {},
) {
  const role = opts.role ?? "model"
  const mesh = new THREE.Mesh(geo, kit.surfaceFor(role))
  mesh.name = opts.name ?? ""
  mesh.userData = { kind: "face", feature: opts.feature, role, part: opts.part } satisfies FaceData
  if (opts.edges !== false) mesh.add(edges(geo, kit, opts.edges ?? 30))
  return mesh
}

/** Sharp feature edges of a geometry (crease angle in degrees). */
export function edges(geo: THREE.BufferGeometry, kit: MaterialKit, angle = 30) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), kit.edge)
  l.userData = { kind: "edge" }
  l.raycast = () => {}
  return l
}

/** A polyline drawn as a 3D CAD edge (1px). `soft` for tangent edges. */
export function edgeLine(points: THREE.Vector3[], kit: MaterialKit, soft = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points)
  const l = new THREE.Line(g, soft ? kit.edgeSoft : kit.edge)
  l.userData = { kind: "edge", soft }
  l.raycast = () => {}
  return l
}

/** A thick screen-space line (sketch entities, paths, dimensions). */
export function line(points: THREE.Vector3[], mat: LineMaterial) {
  const g = new LineGeometry()
  g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))
  const l = new Line2(g, mat)
  l.computeLineDistances()
  l.userData = { kind: "sketch" }
  return l
}

/** HTML label pinned to a 3D point. Styling uses the theme utilities. */
export function label(content: string | HTMLElement, pos: THREE.Vector3, className = "") {
  let el: HTMLElement
  if (typeof content === "string") {
    el = document.createElement("div")
    el.textContent = content
  } else el = content
  el.className = cn(
    "rounded-xs border border-border bg-popover px-1.5 py-px font-mono text-caption tabular text-foreground whitespace-nowrap",
    className,
  )
  const o = new CSS2DObject(el)
  o.position.copy(pos)
  o.userData = { kind: "label" }
  return o
}

/** Small uppercase-free tag (feature names, part callouts). */
export function tag(text: string, pos: THREE.Vector3, className = "") {
  const el = document.createElement("div")
  el.textContent = text
  el.className = cn("rounded-sm bg-inverse px-1.5 py-0.5 text-caption text-inverse-foreground whitespace-nowrap", className)
  const o = new CSS2DObject(el)
  o.position.copy(pos)
  o.userData = { kind: "label" }
  return o
}

function cn(...c: string[]) {
  return c.filter(Boolean).join(" ")
}

/**
 * A datum plane drawn as a translucent square with a hairline border and a
 * name tag. `normal` picks the plane; size in mm.
 */
export function datumPlane(kit: MaterialKit, which: "XY" | "XZ" | "YZ", size = 120, name?: string, corner: [number, number] = [-1, 1]) {
  const g = new THREE.Group()
  const geo = new THREE.PlaneGeometry(size, size)
  const fill = new THREE.Mesh(geo, kit.plane)
  fill.userData = { kind: "plane", plane: which }
  const half = size / 2
  const loop = [
    new THREE.Vector3(-half, -half, 0),
    new THREE.Vector3(half, -half, 0),
    new THREE.Vector3(half, half, 0),
    new THREE.Vector3(-half, half, 0),
    new THREE.Vector3(-half, -half, 0),
  ]
  const border = new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop), kit.planeEdge)
  border.raycast = () => {}
  g.add(fill, border)
  if (which === "XZ") g.rotation.x = Math.PI / 2
  if (which === "YZ") {
    g.rotation.y = Math.PI / 2
    g.rotation.z = Math.PI / 2
  }
  if (name) {
    // `corner` picks which corner carries the name (plane-local signs), so names of crossing planes don't collide.
    const t = label(name, new THREE.Vector3(corner[0] * (half - 2), corner[1] * (half - 2), 0), "border-transparent bg-transparent font-sans text-faint-foreground")
    t.center.set(corner[0] < 0 ? 0 : 1, corner[1] > 0 ? 0 : 1)
    g.add(t)
  }
  g.userData = { kind: "datum", plane: which }
  return g
}

/** World-space plane for a datum name (sketch dragging, picking). */
export function planeOf(which: "XY" | "XZ" | "YZ") {
  const n = which === "XY" ? new THREE.Vector3(0, 0, 1) : which === "XZ" ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(1, 0, 0)
  return new THREE.Plane(n, 0)
}

/**
 * Linear dimension between a and b, offset along `dir` by `offset` mm:
 * two extension lines, a dimension line with ticks, and a value label.
 */
export function linearDim(kit: MaterialKit, a: THREE.Vector3, b: THREE.Vector3, dir: THREE.Vector3, offset: number, text: string, opts: { interactive?: boolean } = {}) {
  const g = new THREE.Group()
  const d = dir.clone().normalize()
  const a2 = a.clone().addScaledVector(d, offset)
  const b2 = b.clone().addScaledVector(d, offset)
  const over = d.clone().multiplyScalar(Math.sign(offset) * 2.5)
  g.add(line([a.clone().addScaledVector(d, Math.sign(offset) * 1.2), a2.clone().add(over)], kit.dimension))
  g.add(line([b.clone().addScaledVector(d, Math.sign(offset) * 1.2), b2.clone().add(over)], kit.dimension))
  g.add(line([a2, b2], kit.dimension))
  // Arrowheads as short open ticks, drawn as lines so they stay crisp at any zoom.
  const along = b2.clone().sub(a2).normalize()
  const tickLen = Math.min(3, a2.distanceTo(b2) / 4)
  const perp = d.clone()
  for (const [p, s] of [
    [a2, 1],
    [b2, -1],
  ] as const) {
    const tip = p.clone()
    const back = tip.clone().addScaledVector(along, s * tickLen)
    g.add(line([back.clone().addScaledVector(perp, tickLen * 0.45), tip, back.clone().addScaledVector(perp, -tickLen * 0.45)], kit.dimension))
  }
  const mid = a2.clone().add(b2).multiplyScalar(0.5)
  const lbl = label(text, mid, opts.interactive ? "interactive cursor-pointer hover:border-primary" : "")
  g.add(lbl)
  g.userData = { kind: "dimension", label: lbl }
  return g
}

/** Collect face meshes under root, optionally filtered. */
export function faces(root: THREE.Object3D, pred?: (d: FaceData, m: THREE.Mesh) => boolean): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse((o) => {
    const d = o.userData as FaceData
    if (d?.kind === "face" && (!pred || pred(d, o as THREE.Mesh))) out.push(o as THREE.Mesh)
  })
  return out
}

/** Give faces their display material: highlight / ghost / resting role. */
export function paint(root: THREE.Object3D, kit: MaterialKit, decide: (d: FaceData) => "rest" | "highlight" | "modified" | "ghost" | "hidden") {
  for (const m of faces(root)) {
    const d = m.userData as FaceData
    const how = decide(d)
    m.visible = how !== "hidden"
    m.material = how === "highlight" ? kit.highlight : how === "modified" ? kit.modified : how === "ghost" ? kit.ghost : kit.surfaceFor(d.role)
    for (const c of m.children) if (c.userData.kind === "edge") (c as THREE.LineSegments).material = how === "ghost" ? kit.edgeGhost : kit.edge
  }
}
