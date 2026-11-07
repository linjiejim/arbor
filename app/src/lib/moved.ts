/**
 * The site moved from featuretree.linjiejim.com to arbor.linjiejim.com, and
 * localStorage belongs to the origin. The old host serves public/moved.html,
 * which hands what this browser had there over in the address's fragment
 * (`#arbor-move=…`, never sent to a server); here it is merged in before
 * anything reads storage. The old host sends it on every visit, so taking it
 * must be safe to repeat: progress is merged and de-duplicated, share links are
 * merged by id, everything else is taken only where this host has nothing yet.
 */
export const MOVE_PREFIX = "#arbor-move="

/** What the old host may hand over: learning progress, the workbench's model and settings, share links. */
export const MOVED_KEYS = ["arbor:progress", "featuretree:progress", "ft-studio-v1", "ft-studio-mode", "ft-studio-panel-w", "ft-studio-shares-v1", "arbor:practice"]

/** The hand-over: storage values by key, and the fragment the visitor's own link had (`h`). */
export type Envelope = { d: Record<string, string>; h?: string }

type Store = Pick<Storage, "getItem" | "setItem">
type Attempt = { score?: number; total?: number; at?: number }
type Progress = { done?: string[]; last?: string; quiz?: Record<string, Attempt[]> }

const parse = <T>(text: string | null | undefined): T | null => {
  try {
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v)

/** Both sides' progress: every lesson done on either; quiz attempts once each, oldest first. */
export function mergeProgress(here: Progress | null, moved: Progress | null): Progress | null {
  if (!moved) return here
  if (!here) return moved
  const quiz: Record<string, Attempt[]> = {}
  for (const k of new Set([...Object.keys(moved.quiz ?? {}), ...Object.keys(here.quiz ?? {})])) {
    const all = [...(moved.quiz?.[k] ?? []), ...(here.quiz?.[k] ?? [])].filter(isObject) as Attempt[]
    const seen = new Set<string>()
    quiz[k] = all
      .filter((a) => {
        const key = JSON.stringify([a.at, a.score, a.total])
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  }
  return { ...moved, ...here, done: [...new Set([...(moved.done ?? []), ...(here.done ?? [])])], last: here.last ?? moved.last, quiz }
}

/** Read a fragment: the envelope, or null when it isn't a hand-over (or is broken). */
export function readEnvelope(hash: string): Envelope | null {
  if (!hash.startsWith(MOVE_PREFIX)) return null
  try {
    const e = JSON.parse(decodeURIComponent(hash.slice(MOVE_PREFIX.length))) as unknown
    if (!isObject(e) || !isObject(e.d)) return { d: {} }
    const d = Object.fromEntries(Object.entries(e.d).filter((kv): kv is [string, string] => MOVED_KEYS.includes(kv[0]) && typeof kv[1] === "string"))
    return { d, h: typeof e.h === "string" && e.h.startsWith("#") && !e.h.startsWith(MOVE_PREFIX) ? e.h : undefined }
  } catch {
    return { d: {} }
  }
}

/** Merge a hand-over into `store` (safe to repeat). */
export function takeMoved(e: Envelope, store: Store) {
  const d = e.d
  const progress = mergeProgress(parse<Progress>(store.getItem("arbor:progress")), parse<Progress>(d["arbor:progress"] ?? d["featuretree:progress"]))
  if (progress) store.setItem("arbor:progress", JSON.stringify(progress))
  // Share links: by id, this host's token winning (it is the newer).
  const theirs = parse<unknown>(d["ft-studio-shares-v1"])
  if (isObject(theirs)) {
    const ours = parse<unknown>(store.getItem("ft-studio-shares-v1"))
    store.setItem("ft-studio-shares-v1", JSON.stringify({ ...theirs, ...(isObject(ours) ? ours : {}) }))
  }
  for (const key of MOVED_KEYS) {
    if (key.endsWith(":progress") || key === "ft-studio-shares-v1") continue
    const v = d[key]
    if (typeof v === "string" && store.getItem(key) === null) store.setItem(key, v)
  }
}

/**
 * Run once at start-up, before the router and anything else read the address
 * or storage. The hand-over leaves the address first (it carries share-delete
 * tokens), giving back the visitor's own fragment, then goes into storage.
 */
export function takeMovedFromAddress() {
  const e = readEnvelope(window.location.hash)
  if (!e) return
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + (e.h ?? ""))
  try {
    takeMoved(e, window.localStorage)
  } catch {
    /* storage blocked or full: the old host sends it again next time */
  }
}
