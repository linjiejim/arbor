import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { Button } from "@/components/ui/button"
import { controlClass } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/*
 * List filtering:
 *   - search first, then up to 3–4 filters; more filters → a "筛选" popover
 *   - every active filter is visible on its own trigger ("状态：进行中 ✕");
 *     nothing filters the list without showing it here
 *   - booleans are All / Yes / No, not a switch
 *   - "清除" appears only when something is active
 *   - filters live in the URL so a filtered view can be shared and restored
 */
export function FilterBar({ className, children, onClear, active }: { className?: string; children: React.ReactNode; onClear?: () => void; active?: boolean }) {
  return (
    <div role="search" className={cn("mb-3 flex shrink-0 flex-wrap items-center gap-2", className)}>
      {children}
      {active && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          {s().clear}
        </Button>
      )}
    </div>
  )
}

/** Search box. Debounce the query yourself (useDebouncedValue, 250ms). Esc clears. */
export function SearchInput({
  value,
  onValueChange,
  placeholder = s().searchPlaceholder,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative w-60 max-sm:w-full", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && value && (e.stopPropagation(), onValueChange(""))}
        className={cn(controlClass, "h-(--control-sm) pl-8 pr-7 text-small [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          aria-label={s().clear}
          onClick={() => onValueChange("")}
          className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-faint-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * One filter as a chip. Unset: "状态 ⌄". Set: "状态：进行中 ✕".
 * Single choice; `options` include no "全部" — clearing is the ✕.
 */
export function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: string | undefined
  onValueChange: (v: string | undefined) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <div
      className={cn(
        "inline-flex h-(--control-sm) items-center rounded-md border text-small",
        current ? "border-input bg-selected" : "border-dashed border-input",
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-full items-center gap-1 rounded-md px-2.5 hover:bg-accent",
              current ? "pr-1.5 font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
            {current ? <span>：{current.label}</span> : <ChevronDown className="size-3.5" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1">
          <ul role="listbox" aria-label={label}>
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onValueChange(o.value)
                    setOpen(false)
                  }}
                  className="relative flex min-h-(--control-md) w-full items-center rounded-sm px-2 pr-8 text-left text-body hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  {o.label}
                  {o.value === value && <Check className="absolute right-2 size-4" />}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {current && (
        <button
          type="button"
          aria-label={`${s().clear} ${label}`}
          onClick={() => onValueChange(undefined)}
          className="mr-1 grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** Boolean filter: All / Yes / No. */
export function FilterBoolean({
  label,
  value,
  onValueChange,
  yes = s().yes,
  no = s().no,
}: {
  label: string
  value: boolean | undefined
  onValueChange: (v: boolean | undefined) => void
  yes?: string
  no?: string
}) {
  return (
    <FilterSelect
      label={label}
      value={value === undefined ? undefined : value ? "1" : "0"}
      onValueChange={(v) => onValueChange(v === undefined ? undefined : v === "1")}
      options={[
        { value: "1", label: yes },
        { value: "0", label: no },
      ]}
    />
  )
}
