// The colours a STEP file gives its solids and faces (a board's green, a connector's black), put onto
// the faces OpenCascade read from it. This OpenCascade build reads geometry only (no XCAF reader and
// no map from file entities to shapes), so the styles are read from the file's text and each solid is
// matched by its faces: how many, and which are flat, in order. A solid that matches nothing stays
// uncoloured: no colour beats a wrong one.
import type { AnyShape, Face } from "replicad"
import { facesOf, solidsOf } from "./topo"

/** STEP's predefined colours (ISO 10303-46). */
const NAMED: Record<string, string> = {
  red: "#ff0000", green: "#00ff00", blue: "#0000ff", yellow: "#ffff00", magenta: "#ff00ff", cyan: "#00ffff", black: "#000000", white: "#ffffff", // design-allow: STEP's own colour names
}

/** Entities on the way from a styled item to its colour. */
const STYLE = new Set(["PRESENTATION_STYLE_ASSIGNMENT", "PRESENTATION_STYLE_BY_CONTEXT", "SURFACE_STYLE_USAGE", "SURFACE_SIDE_STYLE", "SURFACE_STYLE_FILL_AREA", "FILL_AREA_STYLE", "FILL_AREA_STYLE_COLOUR", "COLOUR_RGB", "DRAUGHTING_PRE_DEFINED_COLOUR"])
const SOLIDS = new Set(["MANIFOLD_SOLID_BREP", "BREP_WITH_VOIDS"])
const SHELLS = new Set(["CLOSED_SHELL", "OPEN_SHELL"])

type Entity = { type: string; args: string }

/** Simple instances of the DATA section (`#12 = TYPE(…);`), by number; complex ones are not needed here. */
function entities(text: string): Map<number, Entity> {
  const out = new Map<number, Entity>()
  const start = text.indexOf("DATA;")
  if (start < 0) return out
  let i = start + 5
  const n = text.length
  while (i < n) {
    // One record: up to the next `;` outside a quoted string ('' is a quote inside one).
    let j = i
    let quoted = false
    for (; j < n; j++) {
      const c = text.charCodeAt(j)
      if (c === 39) quoted = !quoted
      else if (c === 59 && !quoted) break
    }
    const rec = text.slice(i, j)
    i = j + 1
    const m = /^\s*#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)\s*$/.exec(rec)
    if (m) out.set(Number(m[1]), { type: m[2], args: m[3] })
    else if (/^\s*ENDSEC\s*$/.test(rec)) break
  }
  return out
}

const refs = (args: string) => [...args.matchAll(/#(\d+)/g)].map((m) => Number(m[1]))
const hex2 = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0")

/** The colour a style (or a list of them) comes down to, or null. */
function colourOf(ents: Map<number, Entity>, id: number, depth = 0): string | null {
  const e = ents.get(id)
  if (!e || depth > 10 || !STYLE.has(e.type)) return null
  if (e.type === "COLOUR_RGB") {
    const nums = e.args.replace(/'[^']*'/g, "").split(",").map((s) => Number(s.trim())).filter((x) => Number.isFinite(x))
    return nums.length >= 3 ? `#${nums.slice(-3).map(hex2).join("")}` : null
  }
  if (e.type === "DRAUGHTING_PRE_DEFINED_COLOUR") return NAMED[/'([^']*)'/.exec(e.args)?.[1]?.toLowerCase() ?? ""] ?? null
  for (const r of refs(e.args)) {
    const c = colourOf(ents, r, depth + 1)
    if (c) return c
  }
  return null
}

type StepSolid = { flat: string; faces: (string | null)[] }

/** Every solid of the file in order: its faces (flat or not) and their colours (face, else shell, else solid). */
function stepSolids(ents: Map<number, Entity>): StepSolid[] | null {
  const styled = new Map<number, string>()
  for (const e of ents.values()) {
    if (e.type !== "STYLED_ITEM" && e.type !== "OVER_RIDING_STYLED_ITEM") continue
    const r = refs(e.args)
    // STYLED_ITEM(name, (styles), item); the overriding one adds the style it overrides after the item.
    const item = e.type === "STYLED_ITEM" ? r[r.length - 1] : r[r.length - 2]
    const colour = r.slice(0, e.type === "STYLED_ITEM" ? -1 : -2).map((s) => colourOf(ents, s)).find(Boolean)
    if (item !== undefined && colour && (e.type === "OVER_RIDING_STYLED_ITEM" || !styled.has(item))) styled.set(item, colour)
  }
  if (!styled.size) return null
  const out: StepSolid[] = []
  for (const [id, e] of ents) {
    if (!SOLIDS.has(e.type)) continue
    const solidColour = styled.get(id) ?? null
    const flat: string[] = []
    const faces: (string | null)[] = []
    for (const shellId of refs(e.args)) {
      const shell = ents.get(shellId)
      if (!shell || !SHELLS.has(shell.type)) continue
      const shellColour = styled.get(shellId) ?? solidColour
      for (const faceId of refs(shell.args)) {
        const face = ents.get(faceId)
        if (!face) continue
        const r = refs(face.args)
        flat.push(ents.get(r[r.length - 1])?.type === "PLANE" ? "P" : "C")
        faces.push(styled.get(faceId) ?? shellColour)
      }
    }
    out.push({ flat: flat.join(""), faces })
  }
  return out.some((s) => s.faces.some(Boolean)) ? out : null
}

/**
 * Colours of `shape`'s faces (in facesOf order; null where the file sets none), from the STEP file it
 * was read from; null when the file sets no colours, or none of its solids could be matched.
 */
export function stepFaceColors(bytes: Uint8Array, shape: AnyShape): (string | null)[] | null {
  const text = new TextDecoder("latin1").decode(bytes)
  if (!text.includes("STYLED_ITEM")) return null
  const solids = stepSolids(entities(text))
  if (!solids) return null
  // Solids of the same shape (instances, or identical parts) take the file's candidates in turn.
  const bySignature = new Map<string, StepSolid[]>()
  for (const s of solids) bySignature.set(s.flat, [...(bySignature.get(s.flat) ?? []), s])
  const used = new Map<string, number>()
  const coloured = new Map<number, { face: Face; colour: string }[]>()
  const held: { delete(): void }[] = []
  try {
    for (const solid of solidsOf(shape)) {
      const faces = facesOf(solid)
      held.push(solid, ...faces)
      const flat = faces.map((f) => (f.geomType === "PLANE" ? "P" : "C")).join("")
      const candidates = bySignature.get(flat)
      if (!candidates) continue
      const k = used.get(flat) ?? 0
      used.set(flat, k + 1)
      const from = candidates[k % candidates.length]
      faces.forEach((face, i) => {
        const colour = from.faces[i]
        if (colour) coloured.set(face.hashCode, [...(coloured.get(face.hashCode) ?? []), { face, colour }])
      })
    }
    if (!coloured.size) return null
    const all = facesOf(shape)
    held.push(...all)
    const native = (f: Face) => f.wrapped as { IsSame(o: unknown): boolean }
    const out = all.map((f) => coloured.get(f.hashCode)?.find((x) => native(x.face).IsSame(f.wrapped))?.colour ?? null)
    return out.some(Boolean) ? out : null
  } finally {
    held.forEach((x) => x.delete())
  }
}

/** The colour covering most faces: what a dot or a legend says this file is. */
export function mainColor(colors: (string | null)[]): string | undefined {
  const count = new Map<string, number>()
  for (const c of colors) if (c) count.set(c, (count.get(c) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0]
}
