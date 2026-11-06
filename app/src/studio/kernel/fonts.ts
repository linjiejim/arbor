// Fonts for sketch text. Outlines come from two subsets of Noto Sans SC
// (scripts/build-fonts.py): a 35 KB Latin one, and a 2 MB one with every
// GB2312 hanzi that is fetched only when a text has Chinese in it. Both are
// cut from the same font, so a character has the same outline in either.
import { Blueprint, Blueprints, BlueprintSketcher, CompoundBlueprint, cut2D, Drawing, loadFont, type Point2D } from "replicad"
import type { Tree } from "../dsl"
import { InputError } from "./errors"

export type TextFont = "latin" | "sc"
type Font = Awaited<ReturnType<typeof loadFont>>

const FAMILY: Record<TextFont, string> = { latin: "ft-text-latin", sc: "ft-text-sc" }

/** Vite turns these into asset URLs (also inside the worker); in Node they are file URLs. */
export const FONT_URLS: Record<TextFont, URL> = {
  latin: new URL("../fonts/text-latin.ttf", import.meta.url),
  sc: new URL("../fonts/text-sc.ttf", import.meta.url),
}

const loaded: Partial<Record<TextFont, Font>> = {}
const loading: Partial<Record<TextFont, Promise<void>>> = {}

/** Line pitch, in font sizes. */
const LINE = 1.4

const CJK = /[⺀-鿿豈-﫿︰-﹏＀-￯]/

/** ⌀ isn't in the font; Ø is what engraved drawings use anyway. */
export const normalizeText = (s: string) => s.replace(/⌀/g, "Ø")

export const fontFor = (text: string): TextFont => (CJK.test(text) ? "sc" : "latin")

/** Every text in the tree's sketches. */
export function textsIn(tree: Tree): string[] {
  return tree.features.flatMap((f) => (f.op === "sketch" ? f.shapes.flatMap((s) => (s.type === "text" ? [s.text] : [])) : []))
}

/** Load the fonts the tree's texts need (each at most once). Call before `Kernel.rebuild`. */
export async function ensureFonts(tree: Tree, read: (url: URL) => Promise<ArrayBuffer>) {
  const need = new Set(textsIn(tree).map((t) => fontFor(normalizeText(t))))
  await Promise.all([...need].map((name) => loadTextFont(name, read)))
}

export function loadTextFont(name: TextFont, read: (url: URL) => Promise<ArrayBuffer>) {
  loading[name] ??= read(FONT_URLS[name])
    .then(async (buf) => {
      loaded[name] = await loadFont(buf, FAMILY[name])
    })
    .catch((e) => {
      delete loading[name]
      throw e
    })
  return loading[name]
}

/**
 * `text` as a drawing `size` mm high (the em: a hanzi is about that tall, a
 * capital about 0.73 of it), its bounding box centred on the origin. Lines
 * split at "\n" are centred on each other.
 */
export function textDrawing(text: string, size: number): Drawing {
  const name = fontFor(text)
  const font = loaded[name]
  if (!font) throw new InputError("文字的字体没能下载，检查网络后刷新重试")
  const missing = [...new Set(text.replace(/\s/g, ""))].filter((ch) => font.charToGlyphIndex(ch) === 0)
  if (missing.length)
    throw new InputError(`字体里没有这些字：${missing.slice(0, 8).join(" ")}。文字支持常用汉字（GB2312 的 6763 个）、英文、数字和常用符号`)
  const parts: Piece[] = []
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return
    const shapes = outline(font, line, size)
    if (!shapes.length) return
    const x = new Blueprints(shapes).boundingBox.center[0]
    parts.push(...shapes.map((p) => p.translate(-x, -i * LINE * size)))
  })
  if (!parts.length) throw new InputError("文字不能是空的")
  const all = new Blueprints(parts)
  const c = all.boundingBox.center
  return new Drawing(all.translate(-c[0], -c[1]))
}

type Piece = Blueprint | CompoundBlueprint

/**
 * One line of text as filled regions, by the font's own fill rule. CJK fonts
 * keep overlapping strokes, which a plain "inside another contour = hole" pass
 * (what replicad's text does) turns into inverted solids. Here a hole only
 * cuts the outline that wholly contains it; overlapping strokes are fused in
 * 3D after extruding (`mergeOverlaps` in build.ts).
 */
function outline(font: Font, line: string, size: number): Piece[] {
  const contours = contoursOf(font.getPath(line, 0, 0, size).commands)
  if (!contours.length) return []
  const area = (c: Contour) => Math.abs(signedArea(c.poly))
  const filled = Math.sign(signedArea(contours.reduce((a, b) => (area(b) > area(a) ? b : a)).poly))
  const solids = contours.filter((c) => Math.sign(signedArea(c.poly)) === filled)
  const holes = contours.filter((c) => Math.sign(signedArea(c.poly)) !== filled)

  // Strokes that overlap another get fused in 3D later. Fusing their spline walls
  // grows OpenCascade's heap by tens of MB per glyph (it never comes back), so
  // they are drawn as polylines within 5 µm of the curves instead: flat walls fuse
  // cheaply. Strokes on their own keep their exact curves.
  const box = (c: Contour) => polyBounds(c.poly)
  for (const c of solids) {
    if (!c.run || !solids.some((o) => o !== c && overlaps(box(o), box(c)))) continue
    c.bp = polylineBlueprint(fine(c.run))
    for (const h of holes) if (h.run && contains(box(c), box(h))) h.bp = polylineBlueprint(fine(h.run))
  }

  const owned = new Map<Contour, Contour[]>()
  for (const h of holes) {
    const inner = innerPoint(h.poly)
    const owner = solids
      .filter((s) =>
        h.group !== undefined && s.group === h.group
          ? polyContains(s.poly, inner)
          : contains(s.bp.boundingBox.bounds, h.bp.boundingBox.bounds) && s.bp.isInside(h.bp.firstPoint) && !touches(s.bp, h.bp),
      )
      .reduce<Contour | null>((best, s) => (!best || area(s) < area(best) ? s : best), null)
    if (owner) owned.set(owner, [...(owned.get(owner) ?? []), h])
  }
  const regions = solids.flatMap((s) => {
    const mine = owned.get(s) ?? []
    // Loops of one split outline only touch at the crossings: their holes go in as they are.
    const kept = mine.filter((h) => h.group !== undefined && h.group === s.group)
    let region: Shape = kept.length ? new CompoundBlueprint([s.bp, ...kept.map((h) => h.bp)]) : s.bp
    for (const h of mine.filter((x) => !kept.includes(x))) {
      try {
        region = cut2D(region, h.bp) ?? region
      } catch {
        /* keep the counter filled rather than lose the stroke */
      }
    }
    return pieces(region)
  })

  // Overlapping strokes stay separate regions: replicad's 2D fuse throws on many of
  // them, and where it doesn't it can silently drop pieces (checked against the
  // font's own fill rule). The kernel fuses them in 3D after extruding.
  return regions.filter((p) => solidPiece(p, size))
}


/** A cut can leave a sliver: a one-curve loop or a speck that can't become a face. */
function solidPiece(p: Piece, size: number) {
  const outer = p instanceof CompoundBlueprint ? p.blueprints[0] : p
  const bb = outer.boundingBox
  return outer.curves.length >= 2 && bb.width > size * 1e-3 && bb.height > size * 1e-3
}

/** Do the two outlines cross? Unsure (the 2D intersection can throw) counts as yes. */
function touches(a: Blueprint, b: Blueprint) {
  try {
    return a.intersects(b)
  } catch {
    return true
  }
}

type Shape = Blueprint | Blueprints | CompoundBlueprint

const pieces = (s: Shape | null): Piece[] => (!s ? [] : s instanceof Blueprints ? s.blueprints : [s])

type Bounds = [Point2D, Point2D]
const contains = (a: Bounds, b: Bounds) => a[0][0] <= b[0][0] && a[0][1] <= b[0][1] && a[1][0] >= b[1][0] && a[1][1] >= b[1][1]

type PathCommand = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }

type Contour = {
  bp: Blueprint
  /** The outline flattened, for areas and containment. */
  poly: Point2D[]
  /** Loops split from one self-crossing outline share a group: their holes are kept as is. */
  group?: number
  /** The path commands, to redraw it as a fine polyline. */
  run?: PathCommand[]
}

/**
 * opentype.js path commands (y down) → closed contours (y up). An outline that
 * crosses itself (the crossbar of a 4, the loop of an &) is split at the
 * crossings into simple loops, drawn as polylines: winding numbers add up
 * over the loops, so loops running the other way are holes.
 */
function contoursOf(commands: PathCommand[]): Contour[] {
  const runs: PathCommand[][] = []
  for (const c of commands) {
    if (c.type === "M") runs.push([c])
    else if (c.type !== "Z") runs[runs.length - 1]?.push(c)
  }
  const out: Contour[] = []
  let group = 0
  for (const run of runs) {
    const poly = flatten(run)
    if (poly.length < 3 || Math.abs(signedArea(poly)) < 1e-9) continue
    if (!crosses(poly)) {
      const bp = curveBlueprint(run)
      if (bp) out.push({ bp, poly, run })
      continue
    }
    group++
    for (const raw of splitLoops(poly, 0)) {
      // No zero-length segments: replicad's sketcher can't take them.
      const loop = raw.filter((p, k) => {
        const q = raw[(k + 1) % raw.length]
        return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-7
      })
      if (loop.length < 3 || Math.abs(signedArea(loop)) < 1e-6) continue
      out.push({ bp: polylineBlueprint(loop), poly: loop, group })
    }
  }
  return out
}

function curveBlueprint(run: PathCommand[]): Blueprint | null {
  let pen: BlueprintSketcher | null = null
  let last: Point2D | null = null
  let segments = 0
  const same = (a: Point2D | null, b: Point2D) => !!a && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9
  for (const c of run) {
    const p: Point2D = [c.x!, -c.y!]
    if (c.type === "M") {
      pen = new BlueprintSketcher()
      pen.movePointerTo(p)
      last = p
      continue
    }
    if (!pen || same(last, p)) continue
    if (c.type === "L") pen.lineTo(p)
    else if (c.type === "Q") pen.quadraticBezierCurveTo(p, [c.x1!, -c.y1!])
    else if (c.type === "C") pen.cubicBezierCurveTo(p, [c.x1!, -c.y1!], [c.x2!, -c.y2!])
    segments++
    last = p
  }
  // Two points and back is not an outline.
  return pen && segments >= 2 ? pen.close() : null
}

/** The outline as a closed polygon (last point not repeated), curves cut into 12 pieces. */
function flatten(run: PathCommand[]): Point2D[] {
  const pts: Point2D[] = []
  let last: Point2D = [0, 0]
  for (const c of run) {
    const p: Point2D = [c.x!, -c.y!]
    if (c.type === "M" || c.type === "L") pts.push(p)
    else {
      const q1: Point2D = [c.x1!, -c.y1!]
      const q2: Point2D = c.type === "C" ? [c.x2!, -c.y2!] : q1
      for (let k = 1; k <= 12; k++) {
        const t = k / 12
        const u = 1 - t
        pts.push(
          c.type === "C"
            ? [u ** 3 * last[0] + 3 * u * u * t * q1[0] + 3 * u * t * t * q2[0] + t ** 3 * p[0], u ** 3 * last[1] + 3 * u * u * t * q1[1] + 3 * u * t * t * q2[1] + t ** 3 * p[1]]
            : [u * u * last[0] + 2 * u * t * q1[0] + t * t * p[0], u * u * last[1] + 2 * u * t * q1[1] + t * t * p[1]],
        )
      }
    }
    last = p
  }
  while (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop()
  return pts
}

function polylineBlueprint(loop: Point2D[]): Blueprint {
  const pen = new BlueprintSketcher()
  pen.movePointerTo(loop[0])
  for (const p of loop.slice(1)) pen.lineTo(p)
  return pen.close()
}

/** The outline as a polyline within `tol` mm of its curves (closed, no repeated points). */
function fine(run: PathCommand[], tol = 0.005): Point2D[] {
  const pts: Point2D[] = []
  let last: Point2D = [0, 0]
  for (const c of run) {
    const p: Point2D = [c.x!, -c.y!]
    if (c.type === "M" || c.type === "L") pts.push(p)
    else {
      const q1: Point2D = [c.x1!, -c.y1!]
      const q2: Point2D = c.type === "C" ? [c.x2!, -c.y2!] : q1
      // How far the curve strays from its chord bounds how many pieces it needs.
      const bend = Math.hypot(last[0] - 2 * q1[0] + (c.type === "C" ? q2[0] : p[0]), last[1] - 2 * q1[1] + (c.type === "C" ? q2[1] : p[1])) + (c.type === "C" ? Math.hypot(q1[0] - 2 * q2[0] + p[0], q1[1] - 2 * q2[1] + p[1]) : 0)
      const n = Math.max(1, Math.ceil(Math.sqrt(bend / (8 * tol))))
      for (let k = 1; k <= n; k++) {
        const t = k / n
        const u = 1 - t
        pts.push(
          c.type === "C"
            ? [u ** 3 * last[0] + 3 * u * u * t * q1[0] + 3 * u * t * t * q2[0] + t ** 3 * p[0], u ** 3 * last[1] + 3 * u * u * t * q1[1] + 3 * u * t * t * q2[1] + t ** 3 * p[1]]
            : [u * u * last[0] + 2 * u * t * q1[0] + t * t * p[0], u * u * last[1] + 2 * u * t * q1[1] + t * t * p[1]],
        )
      }
    }
    last = p
  }
  return pts.filter((p, k) => {
    const q = pts[(k + 1) % pts.length]
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-7
  })
}

function polyBounds(poly: Point2D[]): Bounds {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ]
}

const overlaps = (a: Bounds, b: Bounds) => a[0][0] <= b[1][0] && b[0][0] <= a[1][0] && a[0][1] <= b[1][1] && b[0][1] <= a[1][1]

const signedArea = (poly: Point2D[]) => poly.reduce((a, p, i) => a + (p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1]), 0) / 2

/** Where segments a→b and c→d cross properly (not at their ends), or null. */
function crossing(a: Point2D, b: Point2D, c: Point2D, d: Point2D): Point2D | null {
  const r = [b[0] - a[0], b[1] - a[1]]
  const s = [d[0] - c[0], d[1] - c[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-12) return null
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
  const e = 1e-9
  return t > e && t < 1 - e && u > e && u < 1 - e ? [a[0] + t * r[0], a[1] + t * r[1]] : null
}

/** The first crossing of the polygon with itself: segment indices and the point. */
function firstCrossing(poly: Point2D[]): { i: number; j: number; x: Point2D } | null {
  const n = poly.length
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const x = crossing(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])
      if (x) return { i, j, x }
    }
  return null
}

const crosses = (poly: Point2D[]) => firstCrossing(poly) !== null

/** Split at crossings until every loop is simple. */
function splitLoops(poly: Point2D[], depth: number): Point2D[][] {
  const hit = depth < 32 ? firstCrossing(poly) : null
  if (!hit) return [poly]
  const { i, j, x } = hit
  const a = [x, ...poly.slice(i + 1, j + 1)]
  const b = [x, ...poly.slice(j + 1), ...poly.slice(0, i + 1)]
  return [...splitLoops(a, depth + 1), ...splitLoops(b, depth + 1)]
}

/** Is `pt` inside the simple polygon? */
function polyContains(poly: Point2D[], pt: Point2D) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** A point just inside a simple polygon: beside the middle of its longest edge, on the inner side. */
function innerPoint(poly: Point2D[]): Point2D {
  const ccw = signedArea(poly) > 0
  let best = 0
  let len = -1
  poly.forEach((p, k) => {
    const q = poly[(k + 1) % poly.length]
    const l = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (l > len) [best, len] = [k, l]
  })
  const p = poly[best]
  const q = poly[(best + 1) % poly.length]
  const e = len * 1e-3
  const nx = ((ccw ? -1 : 1) * (q[1] - p[1])) / len
  const ny = ((ccw ? 1 : -1) * (q[0] - p[0])) / len
  return [(p[0] + q[0]) / 2 + nx * e, (p[1] + q[1]) / 2 + ny * e]
}
