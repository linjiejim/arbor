// A part's look: a colour and a finish. Saved in the part file (or on a component in an assembly),
// drawn in the 3D view and the agent's pictures, written into 3MF and STEP. Colours are real colours:
// the same in light and dark mode, unlike the scene palette (turnery-theme.css).
import { z } from "zod"

export const FINISHES = ["matte", "metal", "clear"] as const
export type Finish = (typeof FINISHES)[number]
export const FINISH_NAMES: Record<Finish, string> = { matte: "哑光", metal: "金属", clear: "透明" }

/**
 * The palette: what the window offers and an agent writes by name. Hues stay clear of the view's own
 * signals (the accent blue of a selection, the orange of 「修改」, the teal of hovering).
 */
export const PALETTE = [
  { id: "white", name: "白", hex: "#f5f5f2" }, // design-allow: part colours are data saved in files, not theme
  { id: "silver", name: "银灰", hex: "#c3c6cb" }, // design-allow: part colour
  { id: "gray", name: "灰", hex: "#85888d" }, // design-allow: part colour
  { id: "black", name: "黑", hex: "#2a2b2e" }, // design-allow: part colour
  { id: "red", name: "红", hex: "#d9473f" }, // design-allow: part colour
  { id: "orange", name: "橙", hex: "#f39a2b" }, // design-allow: part colour
  { id: "yellow", name: "黄", hex: "#f2cc3d" }, // design-allow: part colour
  { id: "green", name: "绿", hex: "#46a05a" }, // design-allow: part colour
  { id: "teal", name: "青", hex: "#26a69a" }, // design-allow: part colour
  { id: "blue", name: "蓝", hex: "#3d9be9" }, // design-allow: part colour
  { id: "purple", name: "紫", hex: "#8a63d2" }, // design-allow: part colour
  { id: "pink", name: "粉", hex: "#ec82ae" }, // design-allow: part colour
] as const
export type PaletteId = (typeof PALETTE)[number]["id"]

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const byKey = new Map<string, (typeof PALETTE)[number]>(PALETTE.flatMap((c) => [[c.id, c], [c.name, c]] as const))

/** A palette name (English id or 中文名) or #RRGGBB. */
export function isColor(s: string) {
  return byKey.has(s.trim().toLowerCase()) || byKey.has(s.trim()) || HEX.test(s.trim())
}

/** #rrggbb for any accepted colour; null when it isn't one. */
export function hexOf(color: string | undefined | null): string | null {
  if (!color) return null
  const s = color.trim()
  const named = byKey.get(s.toLowerCase()) ?? byKey.get(s)
  if (named) return named.hex
  if (!HEX.test(s)) return null
  const h = s.slice(1).toLowerCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`
}

/** The palette entry a colour is (by name or by its exact value). */
export function paletteOf(color: string | undefined | null) {
  const hex = hexOf(color)
  return hex ? PALETTE.find((c) => c.hex === hex) ?? null : null
}

/** How people read a colour: 「橙」, or the value for one outside the palette. */
export function colorName(color: string | undefined | null) {
  return paletteOf(color)?.name ?? hexOf(color) ?? "未设置"
}

/** A colour inside a Chinese sentence: 「主要是绿」, 「主要是 #1f6e3a」 (a value gets a space before it). */
export function colorWord(color: string | undefined | null) {
  const p = paletteOf(color)
  return p ? p.name : ` ${hexOf(color) ?? "未设置"}`
}

/** The form saved in files: the palette id when it is one, else lowercase #rrggbb. */
export function normalColor(color: string): string {
  return paletteOf(color)?.id ?? hexOf(color) ?? color
}

export const Color = z
  .string()
  .refine(isColor, { message: "颜色写色板名（white、silver、gray、black、red、orange、yellow、green、teal、blue、purple、pink）或 #RRGGBB" })
  .describe("颜色：色板名 white 白、silver 银灰、gray 灰、black 黑、red 红、orange 橙、yellow 黄、green 绿、teal 青、blue 蓝、purple 紫、pink 粉；或 #RRGGBB（还原具体的耗材、喷漆颜色时用）")
export const Finish = z.enum(FINISHES).describe("质感：matte 哑光（缺省）、metal 金属、clear 透明")

/** A colour and a finish, each optional (left out: from the part file, or by where the part comes from). */
export const Appearance = z.object({ color: Color.optional(), finish: Finish.optional() })
export type Appearance = z.infer<typeof Appearance>

/** A part file's look: the whole part, and per part after a split (those win). */
export const PartAppearance = Appearance.extend({
  parts: z.record(z.string(), Appearance).optional().describe("拆件或多个零件时，按零件名分别设置；比整体的优先"),
})
export type PartAppearance = z.infer<typeof PartAppearance>

/** Where a part comes from: how it looks when nothing is set (white, metal grey, a darker grey). */
export type LookSource = "part" | "standard" | "step"

/**
 * A part as drawn: its colour and finish where set, and where it comes from. `fileColor`: a STEP file's
 * own colours (by face; this is the one most faces have), shown when no colour is set.
 */
export type Look = Appearance & { source: LookSource; fileColor?: string }

/** Field by field: `a` wins. */
export function mergeLook(a: Appearance | undefined, b: Appearance | undefined): Appearance {
  const out: Appearance = {}
  const color = a?.color ?? b?.color
  const finish = a?.finish ?? b?.finish
  if (color) out.color = color
  if (finish) out.finish = finish
  return out
}

/** A part file's own look for one of its parts (`name`; none: the whole part). */
export function ownLook(appearance: PartAppearance | undefined, name?: string | null): Appearance {
  if (!appearance) return {}
  return mergeLook(name ? appearance.parts?.[name] : undefined, appearance)
}

/** Something set besides where it comes from: what the toggle and the legend are about. */
export const isSet = (l: Appearance | undefined) => !!(l?.color || l?.finish)

/** A model with nothing to colour: every part plain, made here. */
export function plainOnly(looks: (Look | undefined)[]) {
  return looks.every((l) => !l || (!isSet(l) && l.source === "part"))
}

/** 「橙 · 金属」 */
export function lookText(l: Appearance | undefined, unset = "未设置") {
  if (!l || !isSet(l)) return unset
  // Matte is the default: named only when it is all that was set.
  const finish = l.finish && (l.finish !== "matte" || !l.color) ? FINISH_NAMES[l.finish] : null
  return [l.color ? colorName(l.color) : null, finish].filter(Boolean).join(" · ")
}

/** What drawing it means when nothing is set. */
export const SOURCE_DEFAULT: Record<LookSource, string> = { part: "白模", standard: "标准件按金属色显示", step: "外购件按深灰显示" }

/** What a colour dot says when pointed at: 「橙 · 金属」, or that nothing is set and how it shows then. */
export function lookTip(look: Look | Appearance | undefined) {
  if (look && isSet(look)) return lookText(look)
  if (look && "fileColor" in look && look.fileColor) return `未设置颜色（按 STEP 文件自带的颜色，主要是${colorWord(look.fileColor)}）`
  const source = look && "source" in look ? look.source : "part"
  return `未设置颜色（${SOURCE_DEFAULT[source]}）`
}

/** Without what a part looks like: the geometry, for keys that decide when to rebuild. */
export function withoutLooks<T extends { appearance?: unknown; features: unknown[] }>(tree: T): T {
  const { appearance: _a, ...rest } = tree
  void _a
  return {
    ...rest,
    features: tree.features.map((f) => {
      if (!f || typeof f !== "object" || (f as { op?: string }).op !== "component" || !("appearance" in f)) return f
      const { appearance: _b, ...plain } = f as Record<string, unknown>
      void _b
      return plain
    }),
  } as T
}

/** Same shape: the trees differ at most in their looks. */
export function sameGeometry(a: { appearance?: unknown; features: unknown[] }, b: { appearance?: unknown; features: unknown[] }) {
  return JSON.stringify(withoutLooks(a)) === JSON.stringify(withoutLooks(b))
}

/**
 * Set (or clear, with null) the colour and finish on a part file's tree: the whole part, or the parts
 * named. Fields left out stay as they are. Returns the tree unchanged when nothing changes.
 */
/** A change of look: a field left out stays, null clears it. */
export type LookChange = { color?: string | null; finish?: Finish | null }

/** `cur` with `change` applied (undefined: nothing left set). */
export function applyLook(cur: Appearance | undefined, change: LookChange): Appearance | undefined {
  const next: Appearance = { ...cur }
  if (change.color === null) delete next.color
  else if (change.color !== undefined) next.color = normalColor(change.color)
  if (change.finish === null) delete next.finish
  else if (change.finish !== undefined) next.finish = change.finish
  return isSet(next) ? next : undefined
}

/** 「颜色 橙、质感 金属」「清除颜色」: what a change does, for the activity list. */
export function changeText(change: LookChange) {
  const bits: string[] = []
  if (change.color === null) bits.push("清除颜色")
  else if (change.color !== undefined) bits.push(`颜色 ${colorName(change.color)}`)
  if (change.finish === null) bits.push("清除质感")
  else if (change.finish !== undefined) bits.push(`质感 ${FINISH_NAMES[change.finish]}`)
  return bits.join("、")
}

export function setPartLook<T extends { appearance?: PartAppearance }>(tree: T, parts: string[] | undefined, change: LookChange): T {
  const apply = (cur: Appearance | undefined) => applyLook(cur, change)
  const cur = tree.appearance ?? {}
  let next: PartAppearance
  if (!parts?.length) {
    const top = apply({ color: cur.color, finish: cur.finish })
    next = { ...(top ?? {}), ...(cur.parts ? { parts: cur.parts } : {}) }
  } else {
    const map = { ...cur.parts }
    for (const p of parts) {
      const v = apply(map[p])
      if (v) map[p] = v
      else delete map[p]
    }
    next = { ...(cur.color ? { color: cur.color } : {}), ...(cur.finish ? { finish: cur.finish } : {}), ...(Object.keys(map).length ? { parts: map } : {}) }
  }
  const empty = !isSet(next) && !next.parts
  if (JSON.stringify(empty ? undefined : next) === JSON.stringify(tree.appearance)) return tree
  const { appearance: _drop, ...rest } = tree
  void _drop
  return (empty ? rest : { ...rest, appearance: next }) as T
}

/** sRGB #rrggbb → [r, g, b] in 0–1. */
export function rgbOf(hex: string): [number, number, number] {
  const h = hexOf(hex)?.slice(1) ?? "cccccc"
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** Relative luminance (WCAG), 0 black – 1 white. */
export function luminance(hex: string) {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgbOf(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
