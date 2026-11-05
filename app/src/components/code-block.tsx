import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"

/**
 * A read-only Python snippet with light highlighting (keywords, strings,
 * numbers, calls, comments). Enough for build123d steps; not a full lexer.
 */
const KEYWORDS = new Set(["def", "return", "with", "as", "for", "in", "if", "else", "elif", "and", "or", "not", "lambda", "import", "from", "None", "True", "False"])
const TOKEN = /(#.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)(?=\s*\()|(\b[A-Za-z_]\w*\b)/gm

function highlight(line: string) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > last) out.push(line.slice(last, i))
    const [text, comment, str, num, call, word] = m
    const cls = comment
      ? "text-faint-foreground"
      : str
        ? "text-code-string"
        : num
          ? "text-code-number"
          : call
            ? "text-code-call"
            : word && KEYWORDS.has(word)
              ? "text-code-keyword"
              : undefined
    out.push(cls ? (
      <span key={i} className={cls}>
        {text}
      </span>
    ) : (
      text
    ))
    last = i + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className={cn("group relative rounded-lg border bg-sunken", className)}>
      <IconButton
        label={copied ? "已复制" : "复制代码"}
        size="icon-sm"
        className="absolute right-1.5 top-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          navigator.clipboard?.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check /> : <Copy />}
      </IconButton>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-caption leading-5 text-foreground">
        {code.split("\n").map((l, i) => (
          <div key={i}>{l ? highlight(l) : " "}</div>
        ))}
      </pre>
    </div>
  )
}
