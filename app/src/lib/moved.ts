/**
 * The site moved from featuretree.linjiejim.com to arbor.linjiejim.com, and
 * localStorage belongs to the origin. The old host serves public/moved.html,
 * which hands what this browser had there over in the address's fragment
 * (`#arbor-move=…`, never sent to a server); here it is merged in once, before
 * anything reads storage, and the fragment is dropped from the address.
 */
export const MOVE_PREFIX = "#arbor-move="

/** What the old host may hand over: learning progress, the workbench's model and settings, share links. */
export const MOVED_KEYS = ["arbor:progress", "featuretree:progress", "ft-studio-v1", "ft-studio-mode", "ft-studio-panel-w", "ft-studio-shares-v1", "arbor:practice"]

type Store = Pick<Storage, "getItem" | "setItem">
type Progress = { done?: string[]; last?: string; quiz?: Record<string, unknown[]> }

const parse = <T>(text: string | null | undefined): T | null => {
  try {
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

/** Both sides' progress: every lesson done on either, every quiz record kept. */
export function mergeProgress(here: Progress | null, moved: Progress | null): Progress | null {
  if (!moved) return here
  if (!here) return moved
  const quiz: Record<string, unknown[]> = { ...(moved.quiz ?? {}) }
  for (const [k, v] of Object.entries(here.quiz ?? {})) quiz[k] = [...(quiz[k] ?? []), ...v]
  return { ...moved, ...here, done: [...new Set([...(moved.done ?? []), ...(here.done ?? [])])], last: here.last ?? moved.last, quiz }
}

/**
 * Merge a handed-over fragment into `store`. Progress is merged; anything else
 * is taken only where this host has nothing yet (what's here is newer). Returns
 * whether the fragment was a hand-over (the caller then clears it).
 */
export function takeMoved(hash: string, store: Store): boolean {
  if (!hash.startsWith(MOVE_PREFIX)) return false
  let data: Record<string, string> | null = null
  try {
    data = JSON.parse(decodeURIComponent(hash.slice(MOVE_PREFIX.length)))
  } catch {
    return true
  }
  if (!data || typeof data !== "object") return true
  const progress = mergeProgress(parse<Progress>(store.getItem("arbor:progress")), parse<Progress>(data["arbor:progress"] ?? data["featuretree:progress"]))
  if (progress) store.setItem("arbor:progress", JSON.stringify(progress))
  for (const key of MOVED_KEYS) {
    if (key.endsWith(":progress")) continue
    const v = data[key]
    if (typeof v === "string" && store.getItem(key) === null) store.setItem(key, v)
  }
  return true
}

/** Run once at start-up, before the app reads storage. */
export function takeMovedFromAddress() {
  try {
    if (takeMoved(window.location.hash, window.localStorage)) window.history.replaceState(null, "", window.location.pathname + window.location.search)
  } catch {
    /* storage blocked: nothing to merge */
  }
}
