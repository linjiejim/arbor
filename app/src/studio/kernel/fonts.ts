// Fonts for sketch text. Outlines come from two subsets of Noto Sans SC
// (scripts/build-fonts.py): a 35 KB Latin one, and a 2 MB one with every
// GB2312 hanzi that is fetched only when a text has Chinese in it. Both are
// cut from the same font, so a character has the same outline in either.
import { Blueprint, Blueprints, BlueprintSketcher, CompoundBlueprint, cut2D, Drawing, fuse2D, loadFont, type Point2D } from "replicad"
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
 * cuts the outline that wholly contains it, and overlapping outlines are fused.
 */
function outline(font: Font, line: string, size: number): Piece[] {
  const contours = contoursOf(font.getPath(line, 0, 0, size).commands)
  if (!contours.length) return []
  const area = (b: Blueprint) => b.boundingBox.width * b.boundingBox.height
  const filled = contours.reduce((a, b) => (area(b) > area(a) ? b : a)).orientation
  const solids = contours.filter((b) => b.orientation === filled)
  const holes = contours.filter((b) => b.orientation !== filled)

  const owned = new Map<Blueprint, Blueprint[]>()
  for (const h of holes) {
    const owner = solids
      .filter((s) => contains(s.boundingBox.bounds, h.boundingBox.bounds) && s.isInside(h.firstPoint) && !s.intersects(h))
      .reduce<Blueprint | null>((best, s) => (!best || area(s) < area(best) ? s : best), null)
    if (owner) owned.set(owner, [...(owned.get(owner) ?? []), h])
  }
  const regions = solids.map((s) => (owned.get(s) ?? []).reduce<Shape | null>((acc, h) => (acc ? cut2D(acc, h) : null), s)).filter((x): x is Shape => !!x)

  // Fuse only what overlaps; separate letters stay separate pieces.
  const groups: Shape[][] = []
  for (const r of regions) {
    const hit = groups.filter((g) => g.some((o) => overlaps(o.boundingBox.bounds, r.boundingBox.bounds)))
    const merged = [r, ...hit.flat()]
    for (const g of hit) groups.splice(groups.indexOf(g), 1)
    groups.push(merged)
  }
  return groups.flatMap((g) => pieces(g.reduce<Shape | null>((acc, r) => (acc ? fuse2D(acc, r) : r), null)))
}

type Shape = Blueprint | Blueprints | CompoundBlueprint

const pieces = (s: Shape | null): Piece[] => (!s ? [] : s instanceof Blueprints ? s.blueprints : [s])

type Bounds = [Point2D, Point2D]
const contains = (a: Bounds, b: Bounds) => a[0][0] <= b[0][0] && a[0][1] <= b[0][1] && a[1][0] >= b[1][0] && a[1][1] >= b[1][1]
const overlaps = (a: Bounds, b: Bounds) => a[0][0] <= b[1][0] && b[0][0] <= a[1][0] && a[0][1] <= b[1][1] && b[0][1] <= a[1][1]

type PathCommand = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }

/** opentype.js path commands (y down) → closed contours (y up). */
function contoursOf(commands: PathCommand[]): Blueprint[] {
  const out: Blueprint[] = []
  let pen: BlueprintSketcher | null = null
  let last: Point2D | null = null
  const same = (a: Point2D | null, b: Point2D) => !!a && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9
  const close = () => {
    if (pen) out.push(pen.close())
    pen = null
  }
  for (const c of commands) {
    if (c.type === "Z") {
      close()
      continue
    }
    const p: Point2D = [c.x!, -c.y!]
    if (c.type === "M") {
      close()
      pen = new BlueprintSketcher()
      pen.movePointerTo(p)
      last = p
      continue
    }
    if (!pen || same(last, p)) continue
    if (c.type === "L") pen.lineTo(p)
    else if (c.type === "Q") pen.quadraticBezierCurveTo(p, [c.x1!, -c.y1!])
    else if (c.type === "C") pen.cubicBezierCurveTo(p, [c.x1!, -c.y1!], [c.x2!, -c.y2!])
    last = p
  }
  if (pen) close()
  return out
}
