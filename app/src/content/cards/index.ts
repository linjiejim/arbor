import type { CardMeta } from "./types"

/**
 * Every 图文卡, in curriculum order. Each card is its own module, loaded on
 * demand, so no card text lands in the entry bundle. Titles and goals for
 * lists come from curriculum.json.
 */
export const CARDS: CardMeta[] = [
  // ---------------------------------------------------------------- T0 公共地基
  { code: "0.1.4", load: () => import("./0.1.4") },
  { code: "0.2.4", load: () => import("./0.2.4") },
  { code: "0.3.2", load: () => import("./0.3.2") },
  { code: "0.3.3", load: () => import("./0.3.3") },
  // ---------------------------------------------------------------- T1 参数化零件
  { code: "1.1.4", load: () => import("./1.1.4") },
  { code: "1.1.6", load: () => import("./1.1.6") },
  { code: "1.2.4", load: () => import("./1.2.4") },
  { code: "1.3.5", load: () => import("./1.3.5") },
  { code: "1.3.6", load: () => import("./1.3.6") },
  { code: "1.4.2", load: () => import("./1.4.2") },
  { code: "1.4.3", load: () => import("./1.4.3") },
  { code: "1.5.1", load: () => import("./1.5.1") },
  { code: "1.5.2", load: () => import("./1.5.2") },
  { code: "1.5.3", load: () => import("./1.5.3") },
  { code: "1.5.4", load: () => import("./1.5.4") },
  // ---------------------------------------------------------------- T2 装配与机构
  { code: "2.3.1", load: () => import("./2.3.1") },
  { code: "2.3.3", load: () => import("./2.3.3") },
]

export const cardMeta = (code: string | undefined) => CARDS.find((c) => c.code === code)
