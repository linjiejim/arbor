// Standard holes for metric screws (the hole wizard): clearance holes after
// ISO 273, tap drills for coarse threads, counterbores for ISO 4762 socket head
// cap screws and countersinks for ISO 10642 flat heads. Reference values, as
// in common design handbooks; check the screw supplier's sheet for real parts.

export const SCREW_SIZES = ["M2", "M2.5", "M3", "M4", "M5", "M6", "M8", "M10", "M12"] as const
export type ScrewSize = (typeof SCREW_SIZES)[number]

type Row = {
  /** Coarse thread pitch. */
  pitch: number
  /** ISO 273 fine series: a close fit. */
  close: number
  /** ISO 273 medium series: the usual clearance hole. */
  normal: number
  /** Tap drill for the coarse thread. */
  tap: number
  /** Counterbore for a socket head cap screw: diameter, depth. */
  cbore: [number, number]
  /** Countersink diameter for a 90° flat head. */
  csink: number
}

export const METRIC: Record<ScrewSize, Row> = {
  M2: { pitch: 0.4, close: 2.2, normal: 2.4, tap: 1.6, cbore: [4.4, 2.3], csink: 4.0 },
  "M2.5": { pitch: 0.45, close: 2.7, normal: 2.9, tap: 2.05, cbore: [5.5, 2.8], csink: 5.0 },
  M3: { pitch: 0.5, close: 3.2, normal: 3.4, tap: 2.5, cbore: [6.5, 3.3], csink: 6.9 },
  M4: { pitch: 0.7, close: 4.3, normal: 4.5, tap: 3.3, cbore: [8, 4.4], csink: 9.2 },
  M5: { pitch: 0.8, close: 5.3, normal: 5.5, tap: 4.2, cbore: [9.5, 5.4], csink: 11.4 },
  M6: { pitch: 1, close: 6.4, normal: 6.6, tap: 5, cbore: [11, 6.5], csink: 13.7 },
  M8: { pitch: 1.25, close: 8.4, normal: 9, tap: 6.8, cbore: [14, 8.6], csink: 18.2 },
  M10: { pitch: 1.5, close: 10.5, normal: 11, tap: 8.5, cbore: [17.5, 10.8], csink: 22.7 },
  M12: { pitch: 1.75, close: 13, normal: 13.5, tap: 10.2, cbore: [20, 13], csink: 27.2 },
}

export type HoleStandard = { size: ScrewSize; fit?: "clearance" | "close" | "tap" | "insert"; head?: "cbore" | "csink" }

/**
 * Holes for heat-set inserts in 3D prints, the common standard size (Ruthex / CNC Kitchen): the hole to
 * print and the insert's length (the hole goes 1 mm deeper). Also in fasteners.ts for the part itself.
 */
export const INSERT_HOLE: Partial<Record<ScrewSize, { d: number; L: number }>> = {
  M2: { d: 3.2, L: 4 },
  "M2.5": { d: 4, L: 5.7 },
  M3: { d: 4, L: 5.7 },
  M4: { d: 5.6, L: 8.1 },
  M5: { d: 6.4, L: 9.5 },
  M6: { d: 8, L: 12.7 },
}

/** A standard hole as plain numbers: diameter, optional counterbore / countersink, the thread if tapped, a default depth for blind ones. */
export function standardHole(s: HoleStandard): { d: number; cbore?: { d: number; depth: number }; csink?: { d: number }; thread?: { major: number; pitch: number }; depth?: number; label: string } {
  const row = METRIC[s.size]
  const fit = s.fit ?? "clearance"
  if (fit === "insert") {
    if (s.head) throw new Error("热熔螺母孔不带沉头")
    const ins = INSERT_HOLE[s.size]
    if (!ins) throw new Error(`热熔螺母孔只有 ${SCREW_SIZES.filter((x) => INSERT_HOLE[x]).join("、")}`)
    const depth = Math.round((ins.L + 1) * 10) / 10
    return { d: ins.d, depth, label: `${s.size} 热熔螺母孔（⌀${ins.d}，螺母长 ${ins.L}）` }
  }
  if (fit === "tap") {
    if (s.head) throw new Error(`螺纹孔不带沉头：沉头孔、埋头孔用在过孔上（fit 用 clearance 或 close）`)
    const major = Number(s.size.slice(1))
    return { d: row.tap, thread: { major, pitch: row.pitch }, label: `${s.size} 螺纹孔（底孔 ⌀${row.tap}）` }
  }
  const d = fit === "close" ? row.close : row.normal
  const name = fit === "close" ? "精配过孔" : "过孔"
  if (s.head === "cbore") return { d, cbore: { d: row.cbore[0], depth: row.cbore[1] }, label: `${s.size} 沉头${name}（⌀${d}，沉孔 ⌀${row.cbore[0]} 深 ${row.cbore[1]}）` }
  if (s.head === "csink") return { d, csink: { d: row.csink }, label: `${s.size} 埋头${name}（⌀${d}，锥口 ⌀${row.csink}）` }
  return { d, label: `${s.size} ${name}（⌀${d}）` }
}
