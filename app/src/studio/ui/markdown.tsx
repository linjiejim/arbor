import * as React from "react"
import { Link } from "react-router"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { ConceptText } from "@/components/concept-term"
import { remarkTerms, termMentions, type MdNode } from "../md-terms"
import { CIRCLED_RE, circledNumber } from "../annotations"
import { closeOpen, splitBlocks } from "../md-blocks"

/** Paths on this site the assistant may cite; they open in a new tab so the model stays put. */
const SITE_PATH = /^\/(?:lesson|teardown|card|atlas|glossary)\/[A-Za-z0-9._-]+$/
// Not after "(" — that's already a Markdown link target.
const BARE_SITE_PATH = /(^|[\s（，。：、*])(\/(?:lesson|teardown|card|atlas|glossary)\/[A-Za-z0-9._-]+)/g

const linkClass = "font-medium text-primary underline decoration-primary/40 underline-offset-4"

function SiteLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} target="_blank" className={linkClass}>
      {children}
    </Link>
  )
}

function Anchor({ href, children }: { href?: string; children?: React.ReactNode }) {
  return href && SITE_PATH.test(href) ? (
    <SiteLink to={href}>{children}</SiteLink>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  )
}

const base: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-heading font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 text-heading font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1 text-body font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-3 mb-1 text-body font-semibold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-3 border-t" />,
  a: ({ href, children }) => <Anchor href={href}>{children}</Anchor>,
  code: ({ className, children }) => {
    const text = String(children)
    // Fenced blocks carry a language class or a newline; everything else is inline.
    if (className || text.includes("\n")) return <code className="font-mono">{children}</code>
    if (SITE_PATH.test(text)) return <SiteLink to={text}>{text}</SiteLink>
    return <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-small">{children}</code>
  },
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-md border bg-muted p-3 text-small leading-relaxed">{children}</pre>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-small">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border px-2 py-1 tabular">{children}</td>,
}

/** ①②… in prose become links to `#pin-N`, so a reply can point back at an annotation. */
function remarkPins() {
  const walk = (node: MdNode) => {
    if (!node.children || node.type === "link") return
    node.children = node.children.flatMap((c): MdNode[] => {
      if (c.type !== "text" || !c.value?.match(CIRCLED_RE)) {
        walk(c)
        return [c]
      }
      const out: MdNode[] = []
      let last = 0
      for (const m of c.value.matchAll(CIRCLED_RE)) {
        const at = m.index ?? 0
        if (at > last) out.push({ type: "text", value: c.value.slice(last, at) })
        out.push({ type: "link", url: `#pin-${circledNumber(m[0])}`, children: [{ type: "text", value: m[0] }] })
        last = at + m[0].length
      }
      if (last < c.value.length) out.push({ type: "text", value: c.value.slice(last) })
      return out
    })
  }
  return (tree: MdNode) => walk(tree)
}

/** Plugin lists by what they do, so finished blocks keep the same props while a reply streams. */
const PLUGINS = new Map<string, Plugins>()
function pluginsFor(pins: boolean, ids: string[]): Plugins {
  const key = `${pins ? 1 : 0}|${ids.join(",")}`
  let p = PLUGINS.get(key)
  if (!p) {
    p = [remarkGfm, ...(pins ? [remarkPins] : []), ...(ids.length ? [remarkTerms(ids)] : [])]
    PLUGINS.set(key, p)
  }
  return p
}

/**
 * The assistant's replies: Markdown (GFM) with the site's type and colours.
 * Raw HTML is not rendered. Bare lesson paths become links too; with `onPin`,
 * ①②… are buttons that show that annotation on the model. While `streaming`,
 * finished blocks stay put and only the last one re-renders.
 */
export function Markdown({ text, onPin, streaming = false, terms = false }: { text: string; onPin?: (n: number) => void; streaming?: boolean; terms?: boolean }) {
  const blocks = React.useMemo(() => {
    const list = splitBlocks(text.replace(BARE_SITE_PATH, "$1[$2]($2)"))
    if (streaming && list.length) list[list.length - 1] = closeOpen(list[list.length - 1])
    return list
  }, [text, streaming])
  const termIds = React.useMemo(() => (terms ? termMentions(blocks) : blocks.map(() => [] as string[])), [blocks, terms])
  const components = React.useMemo<Components>(
    () =>
      onPin || terms
        ? {
            ...base,
            a: (props) => {
              const term = props.href?.match(/^#term-(.+)$/)
              if (term) return <ConceptText id={term[1]}>{props.children}</ConceptText>
              const pin = onPin ? props.href?.match(/^#pin-(\d+)$/) : null
              if (!pin || !onPin) return <Anchor href={props.href}>{props.children}</Anchor>
              return (
                <button
                  type="button"
                  onClick={() => onPin(Number(pin[1]))}
                  className="mx-0.5 font-semibold text-primary underline decoration-primary/40 underline-offset-4"
                  aria-label={`在模型上显示标注 ${pin[1]}`}
                >
                  {props.children}
                </button>
              )
            },
          }
        : base,
    [onPin, terms],
  )
  return (
    <div className="text-reading break-words">
      {blocks.map((b, i) => (
        <Block key={i} source={b} plugins={pluginsFor(Boolean(onPin), termIds[i] ?? [])} components={components} />
      ))}
    </div>
  )
}

type Plugins = NonNullable<React.ComponentProps<typeof ReactMarkdown>["remarkPlugins"]>

const Block = React.memo(function Block({ source, plugins, components }: { source: string; plugins: Plugins; components: Components }) {
  return (
    <ReactMarkdown remarkPlugins={plugins} components={components}>
      {source}
    </ReactMarkdown>
  )
})
