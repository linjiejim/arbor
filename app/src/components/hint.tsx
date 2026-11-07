import * as React from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { markTourSeen, nextStep, tourPosition, tourSeen } from "@/lib/tour"
import { cn } from "@/lib/utils"

/**
 * The explanations a panel used to print in full, behind a grey ⓘ: one tip at a
 * time, 「上一条 / 下一条」. Inside a <Tour>, hints with a `step` are also
 * walked through in order the first time the page is opened.
 */
export function Hint({
  tips,
  label = "说明",
  step,
  side = "bottom",
  align = "start",
  className,
}: {
  tips: string[]
  /** Accessible name of the ⓘ button. */
  label?: string
  /** Order in the page's walkthrough; leave out to keep this hint out of it. */
  step?: number
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
}) {
  const tour = React.useContext(TourContext)
  const button = React.useRef<HTMLButtonElement>(null)
  const [own, setOwn] = React.useState(false)
  const [at, setAt] = React.useState(0)
  const touring = tour !== null && step !== undefined && tour.active === step

  React.useEffect(() => {
    if (!tour || step === undefined) return
    return tour.register(step, () => isShown(button.current))
  }, [tour, step])
  // The walkthrough arriving here starts at this hint's first tip.
  const [wasTouring, setWasTouring] = React.useState(touring)
  if (wasTouring !== touring) {
    setWasTouring(touring)
    if (touring) setAt(0)
  }

  const open = touring || own
  const last = at === tips.length - 1
  const position = touring && tour ? tour.position(step!) : null
  const close = () => {
    setOwn(false)
    setAt(0)
  }
  const forward = () => {
    if (!last) return setAt(at + 1)
    if (touring) tour!.next(step!)
    else close()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setAt(0)
          setOwn(true)
        } else if (touring) tour!.finish()
        else close()
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={button}
          type="button"
          aria-label={label}
          className={cn(
            "inline-grid size-5 shrink-0 place-items-center rounded-full text-faint-foreground outline-none transition-colors duration-(--duration-fast) hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
            open && "text-muted-foreground",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-64"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Handing over to the next hint: focus stays put, so the next one isn't dismissed by it.
        onCloseAutoFocus={(e) => tour?.active !== null && tour?.active !== undefined && e.preventDefault()}
        // During the walkthrough only a click elsewhere, Esc or 「跳过导览」 ends it.
        onFocusOutside={(e) => touring && e.preventDefault()}
      >
        {position && (
          <div className="mb-1.5 text-caption text-faint-foreground tabular">
            导览 {position.at}/{position.of}
          </div>
        )}
        <p className="text-body">{tips[at]}</p>
        <div className="mt-3 flex items-center gap-1.5">
          {touring ? (
            <button type="button" className="text-caption text-faint-foreground hover:text-muted-foreground" onClick={() => tour!.finish()}>
              跳过导览
            </button>
          ) : (
            tips.length > 1 && (
              <span className="text-caption text-faint-foreground tabular">
                {at + 1}/{tips.length}
              </span>
            )
          )}
          <span className="flex-1" />
          {at > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setAt(at - 1)}>
              上一条
            </Button>
          )}
          <Button size="sm" variant={last && !(touring && tour!.hasNext(step!)) ? "secondary" : "primary"} onClick={forward}>
            {!last || (touring && tour!.hasNext(step!)) ? "下一条" : "知道了"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

type TourApi = {
  active: number | null
  register(step: number, visible: () => boolean): () => void
  next(from: number): void
  hasNext(from: number): boolean
  position(step: number): { at: number; of: number }
  finish(): void
}

const TourContext = React.createContext<TourApi | null>(null)

/**
 * Walks the page's hints in `step` order the first time `page` is opened, once
 * `ready` (there is something for the hints to point at: a model, an open part).
 */
export function Tour({ page, children, delay = 700, ready = true }: { page: string; children: React.ReactNode; delay?: number; ready?: boolean }) {
  const hints = React.useRef(new Map<number, () => boolean>())
  const [active, setActive] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!ready || tourSeen(page)) return
    const t = window.setTimeout(() => setActive(nextStep(hints.current.keys(), null, (s) => hints.current.get(s)?.() ?? false)), delay)
    return () => window.clearTimeout(t)
  }, [page, delay, ready])

  const api = React.useMemo<TourApi>(() => {
    const visible = (step: number) => hints.current.get(step)?.() ?? false
    const finish = () => {
      markTourSeen(page)
      setActive(null)
    }
    return {
      active,
      register(step, isVisible) {
        hints.current.set(step, isVisible)
        return () => {
          if (hints.current.get(step) === isVisible) hints.current.delete(step)
        }
      },
      next(from) {
        const n = nextStep(hints.current.keys(), from, visible)
        if (n === null) finish()
        else setActive(n)
      },
      hasNext: (from) => nextStep(hints.current.keys(), from, visible) !== null,
      position: (step) => tourPosition(hints.current.keys(), step, visible),
      finish,
    }
  }, [active, page])

  return <TourContext.Provider value={api}>{children}</TourContext.Provider>
}

/** On screen: laid out, not inside a hidden tab or a collapsed panel. */
function isShown(el: HTMLElement | null) {
  if (!el || el.getClientRects().length === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
}
