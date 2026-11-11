/** Stable names keep selection attached to instances across preview/native meshes. */
export function selectParts(current: string[], name: string, additive: boolean): string[] {
  return selectGroup(current, [name], additive)
}

/**
 * Select several parts as one thing (the pieces of a part): alone, they replace the selection (and a
 * second click on exactly them clears it); with Shift they join it, or leave it when all were in it.
 */
export function selectGroup(current: string[], names: string[], additive: boolean): string[] {
  if (!names.length) return current
  const all = names.every((n) => current.includes(n))
  if (!additive) return all && current.length === names.length ? [] : names
  return all ? current.filter((n) => !names.includes(n)) : [...current, ...names.filter((n) => !current.includes(n))]
}

type Piece = { name: string; whole?: string }

/** What a piece is part of: the part file's instance it was split from, or itself. */
export const wholeName = (p: Piece) => p.whole ?? p.name

/** Every piece of the part the one at `index` belongs to (just itself when that part isn't split). */
export function wholeOf(parts: readonly Piece[], index: number): number[] {
  const p = parts[index]
  if (!p) return []
  const key = wholeName(p)
  return parts.flatMap((x, i) => (wholeName(x) === key ? [i] : []))
}

/**
 * Names as a person reads them: a part with all its pieces among `names` goes by its own name
 * (「外壳/上盖」「外壳/下盖」→「外壳」); pieces picked on their own keep theirs.
 */
export function wholeNames(parts: readonly Piece[], names: readonly string[]): string[] {
  const picked = new Set(names)
  const sizes = new Map<string, number>()
  for (const p of parts) sizes.set(wholeName(p), (sizes.get(wholeName(p)) ?? 0) + 1)
  const got = new Map<string, number>()
  for (const p of parts) if (picked.has(p.name)) got.set(wholeName(p), (got.get(wholeName(p)) ?? 0) + 1)
  const out: string[] = []
  const seen = new Set<string>()
  const byName = new Map(parts.map((p) => [p.name, p]))
  for (const n of names) {
    const p = byName.get(n)
    const key = p ? wholeName(p) : n
    const complete = p && got.get(key) === sizes.get(key)
    const label = complete ? key : n
    if (!seen.has(label)) out.push(label)
    seen.add(label)
  }
  return out
}

/** Every whitespace-separated word must match a name, source file or step ID. */
export function matchesPart(query: string, ...fields: string[]) {
  const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase()
  const text = normalize(fields.join(" "))
  return normalize(query).trim().split(/\s+/).every((word) => text.includes(word))
}
