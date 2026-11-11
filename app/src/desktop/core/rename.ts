// Renaming in an assembly: a component's parts are called by its name (「螺钉#2」, 「外壳/上盖」), and
// mates, checks and notes refer to them by those names, so a new name has to reach all of them.
import { componentName, type Check, type Feature, type Tree } from "../../studio/dsl"
import type { PartNote } from "./protocol"

type Component = Extract<Feature, { op: "component" }>

/** A part's name after its component went from `from` to `to`: 「螺钉#2/垫圈」 keeps its #2 and /垫圈. */
export function renamedPart(name: string, from: string, to: string) {
  if (name === from) return to
  if (name.startsWith(`${from}#`) || name.startsWith(`${from}/`)) return to + name.slice(from.length)
  return name
}

/** What a new part name may not be: empty, too long, or with the characters part names are built from. */
export function badPartName(name: string) {
  if (!name) return "名字不能为空"
  if (name.length > 40) return "名字太长了（最多 40 个字）"
  if (/[#/\\]/.test(name)) return "名字里不能有 #、/ 或 \\（它们用来写第几个和拆开后的零件）"
  return null
}

/** What a file name may not be (without its ending). */
export function badFileName(name: string) {
  if (!name) return "文件名不能为空"
  if (name.length > 80) return "文件名太长了（最多 80 个字）"
  if (/[\\/:*?"<>|]/.test(name) || [...name].some((c) => c.charCodeAt(0) < 32)) return "文件名里不能有 \\ / : * ? \" < > |"
  if (name.startsWith(".")) return "文件名不能以 . 开头"
  return null
}

function renameCheck(c: Check, r: (n: string) => string): Check {
  const out: Record<string, unknown> = { ...c }
  let changed = false
  for (const k of ["part", "ref"]) {
    const v = out[k]
    if (typeof v === "string" && r(v) !== v) {
      out[k] = r(v)
      changed = true
    }
  }
  for (const k of ["a", "b"]) {
    const w = out[k] as { part?: unknown } | undefined
    if (w && typeof w === "object" && typeof w.part === "string" && r(w.part) !== w.part) {
      out[k] = { ...w, part: r(w.part) }
      changed = true
    }
  }
  return changed ? (out as Check) : c
}

/**
 * The assembly with the parts called `from…` called `to…`: in later components' mates and in the
 * checks. `set` changes the components too (their `file` or `name`), returning null to leave one as is.
 */
export function renameInAssembly(tree: Tree, from: string, to: string, set: (f: Component) => Component | null): Tree {
  const r = (n: string) => renamedPart(n, from, to)
  let changed = false
  const features = tree.features.map((f) => {
    if (f.op !== "component") return f
    let next = set(f) ?? f
    if (next.mates?.some((m) => r(m.to.part) !== m.to.part)) next = { ...next, mates: next.mates.map((m) => ({ ...m, to: { ...m.to, part: r(m.to.part) } })) }
    if (next !== f) changed = true
    return next
  })
  const checks = tree.checks?.map((c) => renameCheck(c, r))
  if (checks?.some((c, i) => c !== tree.checks![i])) changed = true
  return changed ? { ...tree, features, ...(checks ? { checks } : {}) } : tree
}

/** The component with this id, and the name its parts go by now. */
export function componentById(tree: Tree, id: string) {
  const f = tree.features.find((x): x is Component => x.op === "component" && x.id === id)
  return f ? { f, name: componentName(f) } : null
}

/** Notes on the renamed parts follow them (the part a pin is on, and the parts a note is about). Returns the same list when none were on them. */
export function renameInNotes(notes: PartNote[], from: string, to: string) {
  const r = (n: string) => renamedPart(n, from, to)
  let changed = false
  const out = notes.map((n) => {
    const part = n.part && r(n.part)
    const parts = n.parts?.some((p) => r(p) !== p) ? n.parts.map(r) : n.parts
    if (part === n.part && parts === n.parts) return n
    changed = true
    return { ...n, ...(part ? { part } : {}), ...(parts ? { parts } : {}) }
  })
  return changed ? out : notes
}
