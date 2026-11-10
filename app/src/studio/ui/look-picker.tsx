import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Segmented } from "@/components/ui/segmented"
import { Tooltip } from "@/components/ui/tooltip"
import { FINISHES, FINISH_NAMES, PALETTE, hexOf, isSet, lookTip, paletteOf, type Appearance, type Finish, type Look, type LookChange } from "../appearance"

/** The finish a part shows with nothing set: metal for standard parts, matte for the rest. */
const defaultFinish = (look: Look | undefined): Finish => (look?.source === "standard" ? "metal" : "matte")

/**
 * A part's colour as a dot: filled with it (clear: see-through, metal: a sheen), or an empty ring when
 * nothing is set. The colour comes from the part, not the theme.
 */
export function LookDot({ look, className }: { look: Look | Appearance | undefined; className?: string }) {
  const hex = hexOf(look?.color)
  const finish = look?.finish
  if (!hex) return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full border border-faint-foreground", finish === "clear" && "border-dashed", className)} />
  // Clear: the colour half see-through inside a full ring, so a clear white part still shows a dot.
  return (
    <span
      aria-hidden
      // The ring follows the theme: a black part's dot still shows on a dark sidebar, a white one on a light one.
      className={cn("relative inline-block size-2.5 shrink-0 overflow-hidden rounded-full ring-1", finish === "clear" ? "ring-faint-foreground" : "ring-foreground/25", className)}
      style={{ backgroundColor: finish === "clear" ? `${hex}80` : hex }}
    >
      {finish === "metal" && <span className="absolute top-px left-0.5 size-1 rounded-full bg-background/70" />}
    </span>
  )
}

/**
 * A dot that opens the colour picker: the palette, the finish, a colour of one's own (#RRGGBB).
 * `onChange` gets what changed (null clears it). `extra`: more choices under them (where it is saved).
 */
export function LookPicker({
  look,
  label,
  onChange,
  extra,
  disabled,
  className,
}: {
  look: Look | undefined
  /** 「上盖」的颜色 */
  label: string
  onChange: (change: LookChange) => unknown
  extra?: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const current = paletteOf(look?.color)
  const hex = hexOf(look?.color)
  const [custom, setCustom] = React.useState("")
  const finish = look?.finish ?? defaultFinish(look)
  const customOk = !!hexOf(custom.startsWith("#") ? custom : `#${custom}`)
  const pick = (change: LookChange) => void onChange(change)
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setCustom(hex && !current ? hex : "")
      }}
    >
      <Tooltip content={`${label}：${lookTip(look)}`}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label={`${label}：${lookTip(look)}`}
            className={cn("grid size-5 shrink-0 place-items-center rounded-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none", className)}
            onClick={(e) => e.stopPropagation()}
          >
            <LookDot look={look} />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        className="w-60 space-y-3 p-3"
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
        // Focus the panel, not its first swatch: a swatch's name would pop up over the title. Tab goes on into it.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
      >
        <div className="flex items-center justify-between text-small">
          <span className="font-medium">{label}</span>
          <span className="text-caption text-muted-foreground">{lookTip(look)}</span>
        </div>
        <div role="group" aria-label="颜色" className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((c) => (
            <Tooltip key={c.id} content={c.name}>
              <button
                type="button"
                aria-label={c.name}
                aria-pressed={current?.id === c.id}
                className="relative grid size-7 place-items-center rounded-full ring-1 ring-foreground/20 outline-none transition-transform duration-(--duration-fast) hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: c.hex }}
                onClick={() => pick({ color: c.id })}
              >
                {current?.id === c.id && <Check className="size-3.5 text-background mix-blend-difference" />}
              </button>
            </Tooltip>
          ))}
        </div>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (customOk) pick({ color: custom.startsWith("#") ? custom : `#${custom}` })
          }}
        >
          <Input aria-label="自定义颜色（#RRGGBB）" placeholder="#RRGGBB" value={custom} onChange={(e) => setCustom(e.target.value.trim())} className="h-(--control-sm) min-w-0 flex-1 font-mono text-small" />
          <Button type="submit" size="sm" variant="secondary" disabled={!customOk}>
            用这个
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <span className="text-small text-muted-foreground">质感</span>
          <Segmented
            size="sm"
            aria-label="质感"
            className="ml-auto"
            value={finish}
            onValueChange={(f) => pick({ finish: f === defaultFinish(look) ? null : f })}
            options={FINISHES.map((f) => ({ value: f, label: FINISH_NAMES[f] }))}
          />
        </div>
        {extra}
        <div className="flex justify-between border-t pt-2">
          <Button size="sm" variant="ghost" disabled={!isSet(look)} onClick={() => pick({ color: null, finish: null })}>
            清除颜色和质感
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            完成
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** The palette as a row of choices, for a form (the new part dialog): one colour or none. */
export function PaletteChoice({ value, onChange }: { value: string | null; onChange: (color: string | null) => void }) {
  return (
    <div role="radiogroup" aria-label="颜色" className="flex flex-wrap gap-1.5">
      <Tooltip content="不设颜色（白模）">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="不设颜色"
          className={cn("size-6 rounded-full border border-dashed border-faint-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", value === null && "ring-2 ring-primary ring-offset-1 ring-offset-background")}
          onClick={() => onChange(null)}
        />
      </Tooltip>
      {PALETTE.map((c) => (
        <Tooltip key={c.id} content={c.name}>
          <button
            type="button"
            role="radio"
            aria-checked={value === c.id}
            aria-label={c.name}
            className={cn("size-6 rounded-full ring-1 ring-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring", value === c.id && "ring-2 ring-primary ring-offset-1 ring-offset-background")}
            style={{ backgroundColor: c.hex }}
            onClick={() => onChange(c.id)}
          />
        </Tooltip>
      ))}
    </div>
  )
}
