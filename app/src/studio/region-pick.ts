// What a box dragged over the view, or strokes drawn on it, cover on the model: the faces under them
// (by casting rays through the marks), their parts and steps, where the pin goes, and a picture of
// the view with the marks on it. See region.ts for what the note keeps.
import * as THREE from "three"
import type { Viewer } from "@/three/viewer"
import type { DisplayData } from "./kernel/build"
import { groupAt } from "./scene"
import type { RegionPick, V3 } from "./region"

/** A point on the view, in CSS pixels from its top-left corner. */
export type ViewPoint = { x: number; y: number }
/** What was marked: a box (two corners), or strokes. */
export type Marks = { shape: "box"; rect: [number, number, number, number] } | { shape: "pen"; strokes: ViewPoint[][] }

/** The nearest visible hit at a point of the view (the host's rules: section, see-through references). */
export type ViewPick = (at: { clientX: number; clientY: number }) => THREE.Intersection | null

type Hit = { at: ViewPoint; group: DisplayData["groups"][number]; native: THREE.Vector3; depth: number }

/** Rays through a box: about one every 10 px, at most 48 a side. */
const GRID_STEP = 10
const GRID_MAX = 48
/** Stroke points closer than this to the last one kept are skipped. */
const PEN_STEP = 4

const toV3 = (v: THREE.Vector3) => v.toArray().map((x) => Math.round(x * 1000) / 1000) as V3

export function gatherRegion(viewer: Viewer, display: DisplayData, pick: ViewPick, marks: Marks): Omit<RegionPick, "image"> {
  const r = viewer.renderer.domElement.getBoundingClientRect()
  const camera = viewer.camera
  const hitAt = (at: ViewPoint): Hit | null => {
    const h = pick({ clientX: r.left + at.x, clientY: r.top + at.y })
    const group = h ? groupAt(h) : null
    if (!h || !group) return null
    // Where it is with the parts put back together (a pulled-apart part's mesh is moved as a whole).
    return { at, group, native: h.point.clone().sub(h.object.position), depth: h.distance }
  }

  const hits: Hit[] = []
  let strokes: V3[][] | undefined
  let centre: ViewPoint
  if (marks.shape === "box") {
    const [x0, y0, x1, y1] = marks.rect
    const nx = Math.min(GRID_MAX, Math.max(2, Math.ceil((x1 - x0) / GRID_STEP)))
    const ny = Math.min(GRID_MAX, Math.max(2, Math.ceil((y1 - y0) / GRID_STEP)))
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= ny; j++) {
        const h = hitAt({ x: x0 + ((x1 - x0) * i) / nx, y: y0 + ((y1 - y0) * j) / ny })
        if (h) hits.push(h)
      }
    centre = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
  } else {
    const all: ViewPoint[] = []
    const lines = marks.strokes.map((stroke) => {
      const kept: ViewPoint[] = []
      for (const p of stroke) if (!kept.length || Math.hypot(p.x - kept.at(-1)!.x, p.y - kept.at(-1)!.y) >= PEN_STEP) kept.push(p)
      if (stroke.length && kept.at(-1) !== stroke.at(-1)) kept.push(stroke.at(-1)!)
      all.push(...kept)
      return kept.map((p) => ({ p, hit: hitAt(p) }))
    })
    for (const line of lines) for (const { hit } of line) if (hit) hits.push(hit)
    // Points off the model sit at the depth of the stroke's points on it (or of the view's centre).
    const fallback = camera.position.distanceTo(viewer.controls.target)
    strokes = lines.map((line) => {
      const on = line.filter((x) => x.hit)
      const depth = on.length ? on.reduce((a, x) => a + x.hit!.depth, 0) / on.length : fallback
      return line.map(({ p, hit }) => toV3(hit ? hit.native : viewer.ray({ clientX: r.left + p.x, clientY: r.top + p.y }).at(depth, new THREE.Vector3())))
    })
    centre = all.length ? { x: all.reduce((a, p) => a + p.x, 0) / all.length, y: all.reduce((a, p) => a + p.y, 0) / all.length } : { x: r.width / 2, y: r.height / 2 }
  }

  const groups = new Map(hits.map((h) => [h.group.hash, h.group]))
  const partIndexes = [...new Set([...groups.values()].flatMap((g) => (g.part === undefined ? [] : [g.part])))]
  const parts = partIndexes.flatMap((i) => (display.parts?.[i] ? [display.parts[i].name] : []))
  const origins = [...new Set([...groups.values()].map((g) => g.origin).filter((o) => o && o !== "?"))]
  let bbox: [V3, V3] | null = null
  if (hits.length) {
    const b = new THREE.Box3()
    for (const h of hits) b.expandByPoint(h.native)
    bbox = [toV3(b.min), toV3(b.max)]
  }
  // The pin: on the model, at the hit nearest the middle of what was marked.
  const near = hits.reduce<Hit | null>((best, h) => (!best || Math.hypot(h.at.x - centre.x, h.at.y - centre.y) < Math.hypot(best.at.x - centre.x, best.at.y - centre.y) ? h : best), null)
  const point = near
    ? toV3(near.native)
    : toV3(viewer.ray({ clientX: r.left + centre.x, clientY: r.top + centre.y }).at(camera.position.distanceTo(viewer.controls.target), new THREE.Vector3()))
  const part = near?.group.part !== undefined ? display.parts?.[near.group.part]?.name : undefined
  return {
    shape: marks.shape,
    camera: { position: toV3(camera.position), target: toV3(viewer.controls.target), up: toV3(camera.up) },
    ...(marks.shape === "box"
      ? { rect: [marks.rect[0] / r.width, marks.rect[1] / r.height, marks.rect[2] / r.width, marks.rect[3] / r.height].map((v) => Math.round(v * 1e4) / 1e4) as [number, number, number, number] }
      : { strokes }),
    point,
    ...(part ? { part } : {}),
    parts,
    origins,
    faces: groups.size,
    bbox,
  }
}

/** Longest side of the picture kept with the note. */
const IMAGE_MAX = 1280

/** The view as it is now with the marks drawn on it, as a PNG data URL (for the note and the agent). */
export function regionImage(viewer: Viewer, marks: Marks) {
  viewer.renderNow()
  const src = viewer.renderer.domElement
  const css = src.getBoundingClientRect()
  const scale = Math.min(1, IMAGE_MAX / Math.max(src.width, src.height))
  const out = document.createElement("canvas")
  out.width = Math.round(src.width * scale)
  out.height = Math.round(src.height * scale)
  const ctx = out.getContext("2d")
  if (!ctx) return undefined
  ctx.drawImage(src, 0, 0, out.width, out.height)
  // Marks in the view's pixels → the picture's.
  const k = out.width / css.width
  ctx.strokeStyle = `#${viewer.tokens.highlight.getHexString(THREE.SRGBColorSpace)}`
  ctx.lineWidth = Math.max(2, 3 * k)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  if (marks.shape === "box") {
    const [x0, y0, x1, y1] = marks.rect
    ctx.strokeRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k)
  } else
    for (const s of marks.strokes) {
      ctx.beginPath()
      s.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)))
      ctx.stroke()
    }
  return out.toDataURL("image/png")
}
