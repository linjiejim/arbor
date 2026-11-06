import * as React from "react"
import { setFieldAt } from "./apply"
import type { DisplayData } from "./kernel/build"
import type { Studio } from "./use-studio"

export type ReselectState = {
  feature: string
  /** Where the selector lives in the feature: ["edges"], ["open"], ["on", "face"]. */
  field: (string | number)[]
  kind: "face" | "edge"
  /** The feature's place in the tree: picks are made on the body it starts from. */
  index: number
  /** That body, shown instead of the model while re-picking. */
  display: DisplayData | null
  hashes: number[]
  /** The selector for the picks; null = none fits, undefined = still working it out. */
  result?: { selector: Record<string, unknown>; count: number } | null
}

/**
 * 「在模型上重选」: the view goes back to what a feature starts from; each click
 * adds or removes a face / edge; the kernel turns the set into a semantic
 * selector; apply writes it into the feature (one undo).
 */
export function useReselect(studio: Studio) {
  const [state, setState] = React.useState<ReselectState | null>(null)
  const ref = React.useRef(state)
  React.useEffect(() => {
    ref.current = state
  }, [state])

  const resolve = React.useCallback(
    async (next: ReselectState) => {
      setState({ ...next, result: undefined })
      const result = next.hashes.length ? await studio.selectorFor(next.kind, next.hashes, next.index) : null
      setState((s) => (s && s.hashes === next.hashes ? { ...s, result } : s))
    },
    [studio],
  )

  const start = React.useCallback(
    async (feature: string, field: (string | number)[], kind: "face" | "edge", current: unknown) => {
      const index = studio.treeRef.current.features.findIndex((f) => f.id === feature)
      if (index < 0) return
      const [display, hashes] = await Promise.all([studio.stepInput(index), current ? studio.locateBefore(kind, current, index) : Promise.resolve([])])
      await resolve({ feature, field, kind, index, display, hashes: hashes ?? [] })
    },
    [studio, resolve],
  )

  /** A click on the shown body: an edge (or, in an edge box, a face = all its edges), or a face. */
  const toggle = React.useCallback(
    async (hit: { edge: number | null; face: number | null }) => {
      const s = ref.current
      if (!s) return
      let add: number[] = []
      if (s.kind === "edge") add = hit.edge !== null ? [hit.edge] : hit.face !== null ? await studio.faceEdges(hit.face, s.index) : []
      else if (hit.face !== null) add = [hit.face]
      if (!add.length) return
      const all = add.every((h) => s.hashes.includes(h))
      const hashes = all ? s.hashes.filter((h) => !add.includes(h)) : [...new Set([...s.hashes, ...add])]
      await resolve({ ...s, hashes })
    },
    [studio, resolve],
  )

  const cancel = React.useCallback(() => setState(null), [])

  const apply = React.useCallback(async () => {
    const s = ref.current
    if (!s?.result) return "还没有选中能描述的面或边"
    const err = await studio.editTree((t) => setFieldAt(t, s.feature, s.field, s.result!.selector))
    if (!err) setState(null)
    return err
  }, [studio])

  return { state, start, toggle, cancel, apply }
}

export type Reselect = ReturnType<typeof useReselect>
