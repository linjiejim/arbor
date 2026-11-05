import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { SOFTWARE, opById, type OpId } from "@/content/ops"

/**
 * A modelling term with its name in each package, one click away. The site
 * teaches the concept; this is the bridge back to whatever software the
 * learner opens next.
 */
export function OpTerm({ id, className }: { id: OpId; className?: string }) {
  const op = opById(id)
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
          {op.name}
          <span className="text-faint-foreground">{op.en}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="text-heading font-semibold">
          {op.name} <span className="font-normal text-muted-foreground">{op.en}</span>
        </div>
        <p className="mt-1 text-small text-muted-foreground">{op.gist}</p>
        <dl className="mt-3 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-small">
          {SOFTWARE.filter((s) => op.names[s.id]).map((s) => (
            <div key={s.id} className="contents">
              <dt className="text-faint-foreground">{s.name}</dt>
              <dd className={cn(s.id === "build123d" && "font-mono text-caption leading-5")}>{op.names[s.id]}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}
