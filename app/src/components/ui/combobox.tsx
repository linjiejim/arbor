import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { Command } from "cmdk"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { useFieldControl } from "@/components/ui/field"
import { controlClass } from "@/components/ui/input"

export type ComboOption = { value: string; label: string; hint?: string }

/** Searchable single select. Use when there are more than ~8 options. */
export function Combobox({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder = s().selectPlaceholder,
  searchPlaceholder = s().searchPlaceholder,
  disabled,
  className,
}: {
  options: ComboOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp !== undefined ? valueProp : inner
  const field = useFieldControl()
  const current = options.find((o) => o.value === value)
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        {...field}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        className={cn(
          controlClass,
          "flex h-(--control-md) items-center justify-between gap-2 px-2.5 text-left",
          !current && "text-faint-foreground",
          className,
        )}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown className="size-4 text-faint-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 w-(--radix-popover-trigger-width) min-w-56 overflow-hidden rounded-lg bg-popover shadow-popover",
            "data-[state=open]:animate-drop-in data-[state=closed]:animate-drop-out",
          )}
        >
          <Command>
            <div className="flex items-center gap-2 border-b px-2.5">
              <Search className="size-4 text-faint-foreground" />
              <Command.Input
                placeholder={searchPlaceholder}
                className="h-(--control-md) w-full bg-transparent text-body outline-none placeholder:text-faint-foreground"
              />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-6 text-center text-body text-muted-foreground">{s().noOptions}</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""} ${o.value}`}
                  onSelect={() => {
                    if (valueProp === undefined) setInner(o.value)
                    onValueChange?.(o.value)
                    setOpen(false)
                  }}
                  className="relative flex min-h-(--control-md) cursor-default items-center gap-2 rounded-sm py-1 pl-2 pr-8 text-body outline-none data-[selected=true]:bg-accent"
                >
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto shrink-0 text-small text-faint-foreground">{o.hint}</span>}
                  {o.value === value && <Check className="absolute right-2 size-4" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
