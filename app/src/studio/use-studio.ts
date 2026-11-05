import * as React from "react"
import { applyEdit, executeTool, treeText, type ToolRun } from "./apply"
import { KernelClient } from "./client"
import { EMPTY_TREE, Tree } from "./dsl"
import type { BuildReport, DisplayData } from "./kernel/build"
import { renderViews, type Pin } from "./look"
import { STARTERS } from "./starters"

const STORE = "ft-studio-v1"

type Saved = { tree: Tree; history: Tree[] }

function loadSaved(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null")
    const tree = Tree.safeParse(raw?.tree)
    if (tree.success) return { tree: tree.data, history: Array.isArray(raw.history) ? raw.history.slice(-30) : [] }
  } catch {
    /* fall through */
  }
  return { tree: EMPTY_TREE, history: [] }
}

export type KernelState = { phase: "loading"; loadedMB: number } | { phase: "ready" } | { phase: "error"; message: string }

/**
 * Studio state: the feature tree (source of truth, persisted), the kernel
 * worker, the latest build report, what the viewport shows, and undo.
 * Tool calls from the model run through `runTool`, one at a time.
 */
export function useStudio() {
  const [saved] = React.useState(loadSaved)
  const [tree, setTreeState] = React.useState<Tree>(saved.tree)
  const [history, setHistory] = React.useState<Tree[]>(saved.history)
  const [report, setReport] = React.useState<BuildReport | null>(null)
  const [display, setDisplay] = React.useState<DisplayData | null>(null)
  const [kernel, setKernel] = React.useState<KernelState>({ phase: "loading", loadedMB: 0 })
  /** Feature the viewport rolls back to; null = latest. */
  const [rollback, setRollback] = React.useState<string | null>(null)
  const client = React.useRef<KernelClient | null>(null)
  const treeRef = React.useRef(tree)
  const rollbackRef = React.useRef(rollback)
  const historyRef = React.useRef(history)
  const queue = React.useRef<Promise<unknown>>(Promise.resolve())
  /** Numbered pins of the current annotations; `look` draws them for the model. */
  const pinsRef = React.useRef<Pin[]>([])
  React.useEffect(() => {
    rollbackRef.current = rollback
  }, [rollback])
  React.useEffect(() => {
    historyRef.current = history
  }, [history])

  const showStep = React.useCallback(async (t: Tree, at: string | null) => {
    const c = client.current
    if (!c) return
    const index = at ? t.features.findIndex((f) => f.id === at) : -1
    setDisplay(await c.display(index >= 0 ? index : undefined))
  }, [])

  /** Rebuild `t`, adopt it as the current tree, refresh the view. */
  const commit = React.useCallback(
    async (t: Tree, rep?: BuildReport) => {
      const c = client.current
      if (!c) return null
      const r = rep ?? (await c.rebuild(t))
      treeRef.current = t
      setTreeState(t)
      setReport(r)
      const at = rollbackRef.current && t.features.some((f) => f.id === rollbackRef.current) ? rollbackRef.current : null
      if (at !== rollbackRef.current) setRollback(null)
      await showStep(t, at)
      return r
    },
    [showStep],
  )

  React.useEffect(() => {
    const c = new KernelClient()
    client.current = c
    c.onProgress = (loadedMB) => setKernel({ phase: "loading", loadedMB })
    const life = { alive: true }
    c.ready
      .then(async () => {
        if (!life.alive) return
        setKernel({ phase: "ready" })
        // /studio?start=<id> opens a ready-made tree (from a teardown, or a shared link).
        const url = new URL(location.href)
        const starter = STARTERS.find((x) => x.id === url.searchParams.get("start"))
        if (starter) {
          url.searchParams.delete("start")
          window.history.replaceState(null, "", url)
          if (treeRef.current.features.length) {
            historyRef.current = [...historyRef.current.slice(-29), treeRef.current]
            setHistory(historyRef.current)
          }
          await commit(starter.tree)
        } else await commit(treeRef.current)
      })
      .catch((e) => life.alive && setKernel({ phase: "error", message: String(e?.message ?? e) }))
    return () => {
      life.alive = false
      c.dispose()
      client.current = null
    }
  }, [commit])

  React.useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ tree, history: history.slice(-30) }))
    } catch {
      /* quota: not fatal */
    }
  }, [tree, history])

  /** Remember the current tree so the next change can be undone. */
  const checkpoint = React.useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-29), treeRef.current]
    setHistory(historyRef.current)
  }, [])

  const undo = React.useCallback(() => {
    const h = historyRef.current
    const prev = h[h.length - 1]
    if (!prev) return
    historyRef.current = h.slice(0, -1)
    setHistory(historyRef.current)
    void commit(prev)
  }, [commit])

  /** Open a ready-made tree (undoable). */
  const load = React.useCallback(
    (t: Tree) => {
      checkpoint()
      rollbackRef.current = null
      setRollback(null)
      void commit(t)
    },
    [checkpoint, commit],
  )

  const reset = React.useCallback(() => {
    checkpoint()
    setRollback(null)
    void commit(EMPTY_TREE)
  }, [checkpoint, commit])

  /** Run one tool call from the model. Serialized: parallel calls apply in order. */
  const runTool = React.useCallback(
    (name: string, input: Record<string, unknown>): Promise<ToolRun> => {
      const job = queue.current.then(async () => {
        const c = client.current
        if (!c) throw new Error("建模内核还没准备好")
        await c.ready
        const look = async (views: string[], highlight?: string) => {
          const d = await c.display()
          return renderViews(d, views, highlight, { pins: pinsRef.current })
        }
        const run = await executeTool(c, treeRef.current, name, input, look)
        if (run.tree !== treeRef.current || run.report) await commit(run.tree, run.report)
        return run
      })
      queue.current = job.catch(() => undefined)
      return job
    },
    [commit],
  )

  /** Change parameters by hand (no model involved). */
  const setParam = React.useCallback(
    async (name: string, value: number | string) => {
      try {
        const { tree: next } = applyEdit(treeRef.current, "set_params", { set: { [name]: value } })
        checkpoint()
        await commit(next)
        return null
      } catch (e) {
        return (e as Error).message
      }
    },
    [checkpoint, commit],
  )

  const showFeature = React.useCallback(
    (id: string | null) => {
      rollbackRef.current = id
      setRollback(id)
      void showStep(treeRef.current, id)
    },
    [showStep],
  )

  const exportBody = React.useCallback(async (format: "step" | "stl") => client.current?.exportBody(format) ?? null, [])

  /** Describe a clicked face or edge of the latest body (null while rolled back or not ready). */
  const pick = React.useCallback(
    async (kind: "face" | "edge", hash: number, point: [number, number, number]) => {
      if (rollbackRef.current || !client.current) return null
      return client.current.pick(kind, hash, point)
    },
    [],
  )

  const locate = React.useCallback(async (kind: "face" | "edge", selector: unknown) => client.current?.locate(kind, selector) ?? null, [])

  const setPins = React.useCallback((pins: Pin[]) => {
    pinsRef.current = pins
  }, [])

  const summary = report ? treeText(tree, report) : ""

  return {
    tree,
    treeRef,
    report,
    summary,
    display,
    kernel,
    rollback,
    canUndo: history.length > 0,
    checkpoint,
    undo,
    reset,
    load,
    runTool,
    setParam,
    showFeature,
    exportBody,
    pick,
    locate,
    setPins,
  }
}

export type Studio = ReturnType<typeof useStudio>
