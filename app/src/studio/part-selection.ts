/** Stable names keep selection attached to instances across preview/native meshes. */
export function selectParts(current: string[], name: string, additive: boolean): string[] {
  if (!additive) return current.length === 1 && current[0] === name ? [] : [name]
  return current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
}

/** Every whitespace-separated word must match a name, source file or step ID. */
export function matchesPart(query: string, ...fields: string[]) {
  const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase()
  const text = normalize(fields.join(" "))
  return normalize(query).trim().split(/\s+/).every((word) => text.includes(word))
}
