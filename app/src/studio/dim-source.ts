// Where a dimension's number comes from, so the model shows only design
// dimensions: a parameter (W), a parameter times a factor (pcd/2), or a plain
// number. Anything else (Rb-rb, R-11.2) is derived: listed, never drawn.
import { namesIn, num, type Scope } from "./expr"

export type DimSource =
  | { type: "param"; name: string }
  | { type: "factor"; name: string; k: number; expr: string }
  | { type: "literal" }
  | { type: "derived"; text: string }

/**
 * Classified by evaluating, not by reading the syntax: an expression in one
 * name that scales with it (0, 1, 2, 7 → 0, k, 2k, 7k) is a factor.
 */
export function dimSource(raw: number | string, scope: Scope): DimSource {
  if (typeof raw === "number") return { type: "literal" }
  const s = raw.trim()
  if (s !== "" && Number.isFinite(Number(s))) return { type: "literal" }
  if (s in scope) return { type: "param", name: s }
  const names = [...new Set(namesIn(s))]
  if (names.length === 1 && names[0] in scope) {
    const name = names[0]
    const at = (x: number) => {
      try {
        return num(s, { ...scope, [name]: x })
      } catch {
        return NaN
      }
    }
    const k = at(1)
    const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
    if (Number.isFinite(k) && k !== 0 && near(at(0), 0) && near(at(2), 2 * k) && near(at(7), 7 * k)) return { type: "factor", name, k, expr: s }
  }
  return { type: "derived", text: s }
}

const r2 = (x: number) => Math.round(x * 100) / 100
export const fmtDim = (x: number) => String(r2(x))

export type DimKind = "linear" | "diameter" | "radius" | "chamfer" | "angle" | "count" | "callout"

const PREFIX: Partial<Record<DimKind, string>> = { diameter: "⌀", radius: "R", chamfer: "C" }

/** The words on the label: 「W = 50」「⌀120（D）」「R4」「pcd/2 = 45」. */
export function dimText(kind: DimKind, value: number, source: DimSource, count = 1): string {
  const many = count > 1 ? `${count}×` : ""
  const unit = kind === "angle" ? "°" : ""
  const v = `${PREFIX[kind] ?? ""}${fmtDim(value)}${unit}`
  if (source.type === "param") return PREFIX[kind] || unit ? `${many}${v}（${source.name}）` : `${source.name} = ${fmtDim(value)}`
  if (source.type === "factor") return `${many}${source.expr} = ${PREFIX[kind] ?? ""}${fmtDim(value)}${unit}`
  return `${many}${v}`
}
