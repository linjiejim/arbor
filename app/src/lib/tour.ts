/**
 * The first-visit walkthrough of a page: its ⓘ hints, opened one after another
 * in step order. Seen (finished or skipped) is remembered per page in
 * localStorage, so it never starts on its own again.
 */
const PREFIX = "arbor:tour:"

export type Storage = Pick<globalThis.Storage, "getItem" | "setItem">

export function tourSeen(page: string, store: Storage | null = safeStorage()): boolean {
  try {
    return store?.getItem(PREFIX + page) === "seen"
  } catch {
    return true
  }
}

export function markTourSeen(page: string, store: Storage | null = safeStorage()) {
  try {
    store?.setItem(PREFIX + page, "seen")
  } catch {
    /* private mode: the tour may show again, nothing else breaks */
  }
}

/**
 * The step after `current` among the registered ones that can be shown now
 * (null: the tour is over). `current` null means the first.
 */
export function nextStep(steps: Iterable<number>, current: number | null, visible: (step: number) => boolean): number | null {
  const ordered = [...new Set(steps)].sort((a, b) => a - b)
  for (const s of ordered) if ((current === null || s > current) && visible(s)) return s
  return null
}

/** Where the walkthrough is: 「导览 2/4」 counts only the steps that can be shown. */
export function tourPosition(steps: Iterable<number>, current: number, visible: (step: number) => boolean) {
  const shown = [...new Set(steps)].sort((a, b) => a - b).filter((s) => s === current || visible(s))
  return { at: shown.indexOf(current) + 1, of: shown.length }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}
