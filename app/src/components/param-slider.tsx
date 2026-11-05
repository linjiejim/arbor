import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A parameter: label, live value, slider and an exact number field.
 * The kit has no slider yet; this one uses the native range input tinted
 * with the accent, so keyboard and screen readers work out of the box.
 */
export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "mm",
  onChange,
  hint,
  active,
  className,
}: {
  label: React.ReactNode
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  hint?: React.ReactNode
  active?: boolean
  className?: string
}) {
  const id = React.useId()
  const [text, setText] = React.useState(String(value))
  // Follow outside changes (dragging, presets) without an effect.
  const [shownValue, setShownValue] = React.useState(value)
  if (value !== shownValue) {
    setShownValue(value)
    setText(String(value))
  }
  const commit = () => {
    const n = Number(text)
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    else setText(String(value))
  }
  return (
    <div className={cn("rounded-md px-2 py-1.5", active && "bg-selected", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            aria-label={typeof label === "string" ? `${label}数值` : undefined}
            value={text}
            inputMode="decimal"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="h-6 w-14 rounded-xs border border-input bg-background px-1.5 text-right font-mono text-caption tabular outline-none focus:border-primary"
          />
          {unit && <span className="w-5 text-caption text-faint-foreground">{unit}</span>}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block h-5 w-full cursor-pointer accent-primary"
      />
      {hint && <div className="text-caption text-muted-foreground">{hint}</div>}
    </div>
  )
}
