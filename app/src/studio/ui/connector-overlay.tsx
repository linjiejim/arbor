import * as React from "react"

/** At most this many lines from one parameter row. */
const MAX_LINES = 3

/**
 * While a parameter row is pointed at, thin lines from the row to its
 * dimension labels on the model, so name and number visibly match. Follows the
 * labels as the camera moves; gone the moment the pointer leaves.
 */
export function ConnectorOverlay({ param, row }: { param: string | null; row: HTMLElement | null }) {
  const [paths, setPaths] = React.useState<string[]>([])
  React.useEffect(() => {
    if (!param || !row) return
    let raf = 0
    const tick = () => {
      const r = row.getBoundingClientRect()
      const from = { x: r.left, y: r.top + Math.min(r.height / 2, 18) }
      const labels = [...document.querySelectorAll<HTMLElement>(`[data-dim-param="${CSS.escape(param)}"]`)]
        .map((el) => el.getBoundingClientRect())
        // Off-screen or squeezed behind the panel: no line.
        .filter((b) => b.width > 0 && b.right < r.left - 8 && b.top >= 0 && b.bottom <= window.innerHeight)
        .slice(0, MAX_LINES)
      const next = labels.map((b) => {
        const to = { x: b.right + 2, y: b.top + b.height / 2 }
        const bend = Math.max(40, (from.x - to.x) / 2)
        return `M ${from.x} ${from.y} C ${from.x - bend} ${from.y}, ${to.x + bend} ${to.y}, ${to.x} ${to.y}`
      })
      setPaths((prev) => (prev.join() === next.join() ? prev : next))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setPaths([])
    }
  }, [param, row])
  if (!paths.length) return null
  return (
    <svg aria-hidden className="pointer-events-none fixed top-0 left-0 z-30 h-dvh w-dvw">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" className="stroke-primary" strokeWidth={1.5} strokeLinecap="round" />
      ))}
    </svg>
  )
}
