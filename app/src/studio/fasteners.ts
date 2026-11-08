// Standard parts an assembly can place without a part file: socket, button, flat and pan head
// screws, hex nuts, washers and heat-set inserts. Dimensions are the nominal values of the ISO
// standards named below (heat-set inserts: the common Ruthex / CNC Kitchen standard size); real
// parts vary within the standard's tolerances, so check the supplier's sheet for a tight fit.
import { INSERT_HOLE, METRIC, SCREW_SIZES, type ScrewSize } from "./holes"

export const FASTENER_TYPES = ["screw", "nut", "washer", "insert"] as const
export type FastenerType = (typeof FASTENER_TYPES)[number]
export const SCREW_HEADS = ["socket", "button", "flat", "pan"] as const
export type ScrewHead = (typeof SCREW_HEADS)[number]

export type FastenerSpec = { type: FastenerType; size: ScrewSize; head?: ScrewHead; length?: number }

/** Head diameter dk, head height k, hex socket key s and its depth t (mm). */
type Head = { dk: number; k: number; s?: number; t?: number }

/** ISO 4762 socket head cap screws. */
const SOCKET: Partial<Record<ScrewSize, Head>> = {
  M2: { dk: 3.8, k: 2, s: 1.5, t: 1 },
  "M2.5": { dk: 4.5, k: 2.5, s: 2, t: 1.1 },
  M3: { dk: 5.5, k: 3, s: 2.5, t: 1.3 },
  M4: { dk: 7, k: 4, s: 3, t: 2 },
  M5: { dk: 8.5, k: 5, s: 4, t: 2.5 },
  M6: { dk: 10, k: 6, s: 5, t: 3 },
  M8: { dk: 13, k: 8, s: 6, t: 4 },
  M10: { dk: 16, k: 10, s: 8, t: 5 },
  M12: { dk: 18, k: 12, s: 10, t: 6 },
}
/** ISO 7380-1 button head (M3 and up). */
const BUTTON: Partial<Record<ScrewSize, Head>> = {
  M3: { dk: 5.7, k: 1.65, s: 2, t: 1.04 },
  M4: { dk: 7.6, k: 2.2, s: 2.5, t: 1.3 },
  M5: { dk: 9.5, k: 2.75, s: 3, t: 1.56 },
  M6: { dk: 10.5, k: 3.3, s: 4, t: 2.08 },
  M8: { dk: 14, k: 4.4, s: 5, t: 2.6 },
  M10: { dk: 17.5, k: 5.5, s: 6, t: 3.12 },
  M12: { dk: 21, k: 6.6, s: 8, t: 4.16 },
}
/** ISO 10642 flat (countersunk) head, 90° (M3 and up): dk is the theoretical diameter at the top. */
const FLAT: Partial<Record<ScrewSize, Head>> = {
  M3: { dk: 6.72, k: 1.86, s: 2, t: 1.1 },
  M4: { dk: 8.96, k: 2.48, s: 2.5, t: 1.5 },
  M5: { dk: 11.2, k: 3.1, s: 3, t: 1.9 },
  M6: { dk: 13.44, k: 3.72, s: 4, t: 2.2 },
  M8: { dk: 17.92, k: 4.96, s: 5, t: 3 },
  M10: { dk: 22.4, k: 6.2, s: 6, t: 3.6 },
  M12: { dk: 26.88, k: 7.44, s: 8, t: 4.3 },
}
/** ISO 7045 pan head, cross recess (M2–M8). */
const PAN: Partial<Record<ScrewSize, Head>> = {
  M2: { dk: 4, k: 1.6 },
  "M2.5": { dk: 5, k: 1.75 },
  M3: { dk: 5.6, k: 2.4 },
  M4: { dk: 8, k: 3.1 },
  M5: { dk: 9.5, k: 3.7 },
  M6: { dk: 12, k: 4.6 },
  M8: { dk: 16, k: 6 },
}
export const HEADS: Record<ScrewHead, { table: Partial<Record<ScrewSize, Head>>; iso: string; name: string }> = {
  socket: { table: SOCKET, iso: "ISO 4762", name: "内六角圆柱头螺钉" },
  button: { table: BUTTON, iso: "ISO 7380", name: "内六角半圆头螺钉" },
  flat: { table: FLAT, iso: "ISO 10642", name: "内六角沉头螺钉" },
  pan: { table: PAN, iso: "ISO 7045", name: "十字盘头螺钉" },
}

/** ISO 4032 hex nuts: width across flats s, height m. */
export const NUT: Record<ScrewSize, { s: number; m: number }> = {
  M2: { s: 4, m: 1.6 },
  "M2.5": { s: 5, m: 2 },
  M3: { s: 5.5, m: 2.4 },
  M4: { s: 7, m: 3.2 },
  M5: { s: 8, m: 4.7 },
  M6: { s: 10, m: 5.2 },
  M8: { s: 13, m: 6.8 },
  M10: { s: 16, m: 8.4 },
  M12: { s: 18, m: 10.8 },
}

/** ISO 7089 plain washers: inner d1, outer d2, thickness h. */
export const WASHER: Record<ScrewSize, { d1: number; d2: number; h: number }> = {
  M2: { d1: 2.2, d2: 5, h: 0.3 },
  "M2.5": { d1: 2.7, d2: 6, h: 0.5 },
  M3: { d1: 3.2, d2: 7, h: 0.5 },
  M4: { d1: 4.3, d2: 9, h: 0.8 },
  M5: { d1: 5.3, d2: 10, h: 1 },
  M6: { d1: 6.4, d2: 12, h: 1.6 },
  M8: { d1: 8.4, d2: 16, h: 1.6 },
  M10: { d1: 10.5, d2: 20, h: 2 },
  M12: { d1: 13, d2: 24, h: 2.5 },
}

/**
 * Heat-set inserts for 3D prints, the common standard size (Ruthex / CNC Kitchen): length L and the hole
 * to print from holes.ts (the brass melts into a hole slightly smaller than its knurl; blind, L + 1 deep).
 * The outer diameter is approximate (the knurl), only for the picture.
 */
const INSERT_OD: Partial<Record<ScrewSize, number>> = { M2: 3.6, "M2.5": 4.6, M3: 4.6, M4: 6.3, M5: 7.1, M6: 8.7 }
export const INSERT: Partial<Record<ScrewSize, { L: number; hole: number; od: number }>> = Object.fromEntries(
  SCREW_SIZES.flatMap((s) => {
    const h = INSERT_HOLE[s]
    const od = INSERT_OD[s]
    return h && od ? [[s, { L: h.L, hole: h.d, od }]] : []
  }),
)

/** ISO 4762 / 10642 preferred lengths: other lengths build but get a note. */
export const SCREW_LENGTHS = [3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100]

const nominal = (size: ScrewSize) => Number(size.slice(1))

/** What the part is called in the BOM, and a note when something is unusual (a non-standard length). */
export function designation(s: FastenerSpec): { name: string; note?: string } {
  const d = s.size
  if (s.type === "screw") {
    const head = HEADS[s.head ?? "socket"]
    if (!head.table[d]) throw new Error(`${head.name}（${head.iso}）没有 ${d}：有 ${SCREW_SIZES.filter((x) => head.table[x]).join("、")}`)
    if (s.length === undefined) throw new Error("螺钉要写 length（长度，mm）")
    if (!(s.length > 0)) throw new Error("螺钉长度必须大于 0")
    const note = SCREW_LENGTHS.includes(s.length) ? undefined : `${s.length} mm 不是常见的螺钉长度（常见：${SCREW_LENGTHS.filter((l) => l <= 60).join("、")}…）`
    return { name: `${head.iso} ${d}×${s.length} ${head.name}`, note }
  }
  if (s.type === "nut") return { name: `ISO 4032 ${d} 六角螺母` }
  if (s.type === "washer") return { name: `ISO 7089 ${d} 平垫圈` }
  const ins = INSERT[d]
  if (!ins) throw new Error(`热熔螺母只有 ${SCREW_SIZES.filter((x) => INSERT[x]).join("、")}`)
  return { name: `热熔螺母 ${d}×${ins.L}（开孔 ⌀${ins.hole}）` }
}

/**
 * The profile of each standard part as plain numbers, in the part's own frame: axis along Z, the screw's
 * bearing face (under the head) at z = 0 with the shank down to z = -length (a flat head screw's top at
 * z = 0, its length measured from there); a nut and a washer from z = 0 up; an insert's top at z = 0.
 */
export function fastenerGeometry(s: FastenerSpec) {
  const d = nominal(s.size)
  const pitch = METRIC[s.size].pitch
  if (s.type === "screw") {
    const head = HEADS[s.head ?? "socket"].table[s.size]!
    return { kind: "screw" as const, head: s.head ?? "socket", d, pitch, L: s.length!, ...head }
  }
  if (s.type === "nut") return { kind: "nut" as const, d, ...NUT[s.size] }
  if (s.type === "washer") return { kind: "washer" as const, ...WASHER[s.size] }
  return { kind: "insert" as const, d, ...INSERT[s.size]! }
}
