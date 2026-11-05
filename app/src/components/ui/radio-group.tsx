import * as React from "react"
import { RadioGroup as RadioPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { useFieldControl } from "@/components/ui/field"

/**
 * 2–5 options in a form when seeing all of them at once helps the choice
 * (plans, visibility, frequency). More options → Select; switching a view →
 * Segmented. Vertical list; each option may carry one line of description.
 */
export function RadioGroup<T extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  options: { value: T; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean }[]
  value?: T
  defaultValue?: T
  onValueChange?: (v: T) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const field = useFieldControl()
  const base = React.useId()
  return (
    <RadioPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as T)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={field.id ? `${field.id}-label` : undefined}
      aria-describedby={field["aria-describedby"]}
      aria-invalid={field["aria-invalid"]}
      aria-required={field["aria-required"]}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {options.map((o) => {
        const id = `${base}-${o.value}`
        return (
          <div key={o.value} className="flex items-start gap-2.5">
            <RadioPrimitive.Item
              id={id}
              value={o.value}
              disabled={o.disabled}
              className={cn(
                "relative mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border border-input bg-background",
                "transition-colors duration-(--duration-fast) hover:border-faint-foreground",
                "data-[state=checked]:border-primary disabled:cursor-not-allowed disabled:opacity-50",
                "after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5",
              )}
            >
              <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary" />
            </RadioPrimitive.Item>
            <label htmlFor={id} className={cn("min-w-0 text-body", o.disabled && "text-faint-foreground")}>
              {o.label}
              {o.description && <span className="block text-small text-muted-foreground">{o.description}</span>}
            </label>
          </div>
        )
      })}
    </RadioPrimitive.Root>
  )
}
