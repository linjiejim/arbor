import * as React from "react"
import { Link } from "react-router"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

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

const components: Components = {
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
  a: ({ href, children }) =>
    href && SITE_PATH.test(href) ? (
      <SiteLink to={href}>{children}</SiteLink>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {children}
      </a>
    ),
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

/**
 * The assistant's replies: Markdown (GFM) with the site's type and colours.
 * Raw HTML is not rendered. Bare lesson paths become links too.
 */
export function Markdown({ text }: { text: string }) {
  const source = React.useMemo(() => text.replace(BARE_SITE_PATH, "$1[$2]($2)"), [text])
  return (
    <div className="text-reading break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
