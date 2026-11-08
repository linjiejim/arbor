/**
 * Concept links in the assistant's replies (边做边学): the first mention of a
 * glossary concept in prose becomes a `#term-<id>` link, which the Markdown
 * renderer turns into a concept card. Never in code or in a link's text.
 */
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { TERMS } from "@/content/terms"

export type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] }

/** Glossary concepts, longest name first (so 「特征顺序」 wins over a shorter name inside it). */
const TERM_NAMES = TERMS.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => b.name.length - a.name.length)

/** Text that never becomes a concept link: link text and code. */
const NOT_PROSE = new Set(["link", "inlineCode", "code"])

/** The first mention of each concept in `ids` becomes a `#term-<id>` link (not inside links or code). */
export function remarkTerms(ids: string[]) {
  return () => (tree: MdNode) => {
    const left = TERM_NAMES.filter((t) => ids.includes(t.id))
    const walk = (node: MdNode) => {
      if (!node.children || NOT_PROSE.has(node.type)) return
      node.children = node.children.flatMap((c): MdNode[] => {
        if (c.type !== "text" || !c.value) {
          walk(c)
          return [c]
        }
        const out: MdNode[] = []
        let rest = c.value
        for (;;) {
          let best: { at: number; t: (typeof left)[number] } | null = null
          for (const t of left) {
            const at = rest.indexOf(t.name)
            if (at >= 0 && (!best || at < best.at)) best = { at, t }
          }
          if (!best) break
          left.splice(left.indexOf(best.t), 1)
          if (best.at > 0) out.push({ type: "text", value: rest.slice(0, best.at) })
          out.push({ type: "link", url: `#term-${best.t.id}`, children: [{ type: "text", value: best.t.name }] })
          rest = rest.slice(best.at + best.t.name.length)
        }
        if (rest) out.push({ type: "text", value: rest })
        return out
      })
    }
    walk(tree)
  }
}

const proseParser = unified().use(remarkParse).use(remarkGfm)
const PROSE = new Map<string, string>()

/** A block's prose as remarkTerms sees it: its text nodes outside links and code, one per line. */
function proseOf(block: string): string {
  let prose = PROSE.get(block)
  if (prose === undefined) {
    const parts: string[] = []
    const walk = (node: MdNode) => {
      if (NOT_PROSE.has(node.type)) return
      if (node.type === "text" && node.value) parts.push(node.value)
      node.children?.forEach(walk)
    }
    walk(proseParser.parse(block) as MdNode)
    prose = parts.join("\n")
    // Parsed once per block, not on every streamed token; finished replies don't need it kept.
    if (PROSE.size >= 500) PROSE.clear()
    PROSE.set(block, prose)
  }
  return prose
}

/**
 * Which concepts each block marks: a concept only at its first mention in the
 * reply's prose (a mention in code or link text doesn't use it up). Parsed
 * with the same parser as the rendering, so both agree on what is prose.
 */
export function termMentions(blocks: string[]): string[][] {
  const seen = new Set<string>()
  return blocks.map((b) => {
    const prose = proseOf(b)
    return TERM_NAMES.filter((t) => !seen.has(t.id) && prose.includes(t.name)).map((t) => {
      seen.add(t.id)
      return t.id
    })
  })
}
