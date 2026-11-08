import type { Check, Tree } from "./dsl"

/**
 * A practice's checks stay in the tree as given: added back when deleted,
 * restored when edited (matched by id). Other checks are left alone. Returns
 * the same tree when nothing had to change.
 */
export function withPinned(tree: Tree, pinned: readonly Check[] | null): Tree {
  if (!pinned?.length) return tree
  const have = tree.checks ?? []
  const byId = new Map(have.map((c) => [c.id, c]))
  const same = pinned.every((p) => {
    const c = byId.get(p.id)
    return c !== undefined && JSON.stringify(c) === JSON.stringify(p)
  })
  if (same) return tree
  const ids = new Set(pinned.map((p) => p.id))
  return { ...tree, checks: [...pinned, ...have.filter((c) => !ids.has(c.id))] }
}
