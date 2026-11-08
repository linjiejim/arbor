import type * as React from "react"
import { Link } from "react-router"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { TERMS } from "@/content/terms"

/** A glossary concept, one click away: its definition, why it matters, and a link to the glossary. */
export function ConceptTerm({ id, className }: { id: string; className?: string }) {
  const term = TERMS.find((t) => t.id === id)
  if (!term) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-small text-foreground transition-colors duration-(--duration-fast) hover:bg-accent",
            className,
          )}
        >
          {term.name}
          <span className="text-faint-foreground">概念</span>
        </button>
      </PopoverTrigger>
      <TermCard term={term} />
    </Popover>
  )
}

/** The same concept, inline in running text (the tutor's replies): dotted underline, same card. */
export function ConceptText({ id, children }: { id: string; children: React.ReactNode }) {
  const term = TERMS.find((t) => t.id === id)
  if (!term) return <>{children}</>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="underline decoration-faint-foreground decoration-dotted underline-offset-4 hover:decoration-foreground">
          {children}
        </button>
      </PopoverTrigger>
      <TermCard term={term} />
    </Popover>
  )
}

function TermCard({ term }: { term: (typeof TERMS)[number] }) {
  return (
      <PopoverContent className="w-80">
        <div className="text-heading font-semibold">
          {term.name} <span className="font-normal text-muted-foreground">{term.en}</span>
        </div>
        <p className="mt-1 text-small">{term.def}</p>
        <p className="mt-1.5 text-small text-muted-foreground">{term.why}</p>
        <Link
          to={`/glossary?tab=concepts#${term.id}`}
          className="mt-3 inline-block text-small font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          在术语表里看
        </Link>
      </PopoverContent>
  )
}
