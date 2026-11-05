import type { CardMeta } from "./types"

/**
 * Every 图文卡, in curriculum order. Each card is its own module, loaded on
 * demand, so no card text lands in the entry bundle. Titles and goals for
 * lists come from curriculum.json.
 */
export const CARDS: CardMeta[] = []

export const cardMeta = (code: string | undefined) => CARDS.find((c) => c.code === code)
