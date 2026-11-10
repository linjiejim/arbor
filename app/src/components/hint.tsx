import * as React from "react"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * The explanations a panel used to print in full, behind a grey ⓘ. Pointing at it shows all of
 * them at once; nothing to click through. A click (or Enter, or a tap) opens it too and keeps it
 * open until a click elsewhere or Esc, for keyboards and touch screens.
 */
export function Hint({
  tips,
  label = "说明",
  side = "bottom",
  align = "start",
  className,
}: {
  tips: string[]
  /** Accessible name of the ⓘ button. */
  label?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const timer = React.useRef<number | null>(null)
  // Opened by a click: stays until a click elsewhere or Esc, whatever the pointer does.
  const pinned = React.useRef(false)
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  // A short delay both ways: the pointer can cross the gap to the card, and passing over the ⓘ doesn't flash it.
  const hover = (on: boolean) => {
    if (pinned.current) return
    cancel()
    timer.current = window.setTimeout(() => setOpen(on), on ? 90 : 180)
  }
  React.useEffect(() => cancel, [])
  const mouse = (e: React.PointerEvent, on: boolean) => e.pointerType === "mouse" && hover(on)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        cancel()
        if (!o) pinned.current = false
        setOpen(o)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-grid size-5 shrink-0 place-items-center rounded-full text-faint-foreground outline-none transition-colors duration-(--duration-fast) hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
            open && "text-muted-foreground",
            className,
          )}
          onPointerEnter={(e) => mouse(e, true)}
          onPointerLeave={(e) => mouse(e, false)}
          // Already open from pointing at it: a click must not close it again.
          onClick={(e) => {
            e.preventDefault()
            cancel()
            pinned.current = true
            setOpen(true)
          }}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-72"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={(e) => mouse(e, true)}
        onPointerLeave={(e) => mouse(e, false)}
      >
        {tips.length === 1 ? (
          <p className="text-body">{tips[0]}</p>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body marker:text-faint-foreground">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
