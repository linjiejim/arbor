// What 后退 / 前进 (⌘[ / ⌘]) walk through: the files opened in this window, in order. A file opened
// in an assembly is a visit to it there.

export type Visit = { path: string; context?: string }
export type Visits = { list: Visit[]; at: number }

export const sameVisit = (a: Visit | undefined, b: Visit) => Boolean(a && a.path === b.path && a.context === b.context)

/** At most this many visits are kept. */
const MAX = 50

/** A file being renamed (`rename_file` running). */
export type Renaming = { from: string; to: string }

const renamedVisit = (v: Visit, { from, to }: Renaming): Visit => ({ path: v.path === from ? to : v.path, ...(v.context ? { context: v.context === from ? to : v.context } : {}) })

/**
 * A file now shown. The one shown before, reopened under its new name (`renaming`), is the same
 * visit. Where back / forward was going (`travel`), it moves there; otherwise it's a new visit, and
 * what was ahead is dropped, as in a browser.
 */
export function arrive(h: Visits, visit: Visit, travel: number | null, renaming: Renaming | null = null): Visits {
  if (sameVisit(h.list[h.at], visit)) return h
  if (renaming && h.list[h.at] && sameVisit(renamedVisit(h.list[h.at], renaming), visit)) return renameVisits(h, renaming.from, renaming.to)
  if (travel !== null && sameVisit(h.list[travel], visit)) return { ...h, at: travel }
  const list = [...h.list.slice(0, h.at + 1), visit].slice(-MAX)
  return { list, at: list.length - 1 }
}

/** A file renamed: visits to it (and to parts in it, if it is an assembly) go to the new path; the same visit twice in a row is one. */
export function renameVisits(h: Visits, from: string, to: string): Visits {
  const list: Visit[] = []
  let at = -1
  h.list.forEach((v, i) => {
    const w = renamedVisit(v, { from, to })
    if (!sameVisit(list.at(-1), w)) list.push(w)
    if (i === h.at) at = list.length - 1
  })
  return { list, at }
}
