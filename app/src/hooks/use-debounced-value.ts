import { useEffect, useState } from "react"

/** Search inputs: query after the user pauses, not on every keystroke. */
export function useDebouncedValue<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
