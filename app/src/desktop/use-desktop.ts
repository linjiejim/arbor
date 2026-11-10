// The window's state, from the engine in the main process. The web studio's
// components take a `Studio` and an `Annotations`; these hooks provide both,
// backed by the engine, so the viewport, feature tree, parameters, measure and
// section tools are the same code as on the site.
import * as React from "react"
import * as THREE from "three"
import { notify } from "@/components/ui/toast"
import type { PickInfo } from "@/studio/annotations"
import { treeText, type ToolRun } from "@/studio/apply"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import type { DisplayData } from "@/studio/kernel/build"
import type { Dim } from "@/studio/kernel/dims"
import type { DrawingData } from "@/studio/kernel/drawing"
import type { MeasureResult, MeasureTarget } from "@/studio/kernel/measure"
import type { Pin } from "@/studio/look"
import type { Annotations, Focus, Note } from "@/studio/use-annotations"
import type { KernelState, Studio } from "@/studio/use-studio"
import { turnery } from "./bridge"
import type { DocState, PartNote, PickRequest, ShowRequest, Snapshot } from "./core/protocol"

/** Engine snapshot, the active part, and what the agent is asking of the window. */
export function useEngine() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const [doc, setDoc] = React.useState<DocState | null>(null)
  const [pick, setPick] = React.useState<PickRequest | null>(null)
  const [show, setShow] = React.useState<ShowRequest | null>(null)
  const active = React.useRef<string | null>(null)

  React.useEffect(() => {
    const life = { alive: true }
    const off = turnery.subscribe((e) => {
      if (e.type === "snapshot") {
        active.current = e.snapshot.active
        setSnapshot(e.snapshot)
        setDoc((d) => (d && d.path !== e.snapshot.active ? null : d))
      } else if (e.type === "doc") {
        if (e.doc.path === active.current) setDoc(e.doc)
      } else if (e.type === "pick") setPick(e.request)
      else if (e.type === "show") setShow(e.request.clear ? null : e.request)
    })
    void turnery.state().then((s) => {
      if (!life.alive) return
      active.current = s.snapshot.active
      setSnapshot(s.snapshot)
      setDoc(s.doc)
      setPick(s.pick)
    })
    return () => {
      life.alive = false
      off()
    }
  }, [])

  return { snapshot, doc, pick, show, setShow }
}

const kernelState = (s: Snapshot | null): KernelState =>
  !s || s.kernel.phase === "loading" ? { phase: "loading", loadedMB: 0 } : s.kernel.phase === "error" ? { phase: "error", message: s.kernel.message } : { phase: "ready" }

/** `Studio` for the active part: reads come from the engine's state, edits go to it as the person's. */
export function useDesktopStudio(doc: DocState | null, snapshot: Snapshot | null): Studio {
  const path = doc?.path ?? null
  const rev = doc?.rev ?? -1
  const tree = doc?.tree ?? EMPTY_TREE
  const report = doc?.report ?? null
  const treeRef = React.useRef<Tree>(tree)
  const revRef = React.useRef(rev)
  const pinsRef = React.useRef<Pin[]>([])
  const [display, setDisplay] = React.useState<DisplayData | null>(null)
  const [rollback, setRollback] = React.useState<string | null>(null)
  React.useEffect(() => {
    treeRef.current = tree
    revRef.current = rev
  }, [tree, rev])

  // Another part: forget the rollback and the old mesh.
  const [shownPath, setShownPath] = React.useState(path)
  if (shownPath !== path) {
    setShownPath(path)
    setRollback(null)
    setDisplay(null)
  }
  const at = rollback && tree.features.some((f) => f.id === rollback) ? rollback : null
  const atIndex = at ? tree.features.findIndex((f) => f.id === at) : -1
  const ready = snapshot?.kernel.phase === "ready" && snapshot.loading?.path !== path

  const [seenPreview, setSeenPreview] = React.useState<DisplayData | null>(null)
  if (doc?.preview && doc.preview !== seenPreview && atIndex < 0) {
    setSeenPreview(doc.preview)
    setDisplay({ ...doc.preview, provisional: true })
  }

  React.useEffect(() => {
    if (!path || !ready) return
    const life = { alive: true }
    turnery
      .kernel(path, { op: "display", index: atIndex >= 0 ? atIndex : undefined })
      .then((d) => life.alive && setDisplay(d as DisplayData))
      .catch(() => {})
    return () => {
      life.alive = false
    }
  }, [path, rev, atIndex, ready])

  // Dimensions of every feature that built: drawn on the model, listed on the feature card.
  const [dims, setDims] = React.useState<Dim[]>([])
  React.useEffect(() => {
    if (!path || !ready) return
    const life = { alive: true }
    turnery
      .kernel(path, { op: "dims" })
      .then((d) => life.alive && setDims(d as Dim[]))
      .catch(() => {})
    return () => {
      life.alive = false
    }
  }, [path, rev, ready])

  // Which requirements held after the agent's (or the file's) last change: one the person's own edit
  // then moved shows as 「已偏离」, not as the agent's error — the site's rule for its assistant.
  const [checkBaseline, setCheckBaseline] = React.useState<Record<string, boolean>>({})
  const [baselineAt, setBaselineAt] = React.useState<string | null>(null)
  const versionKey = `${path}#${rev}`
  if (baselineAt !== versionKey) {
    setBaselineAt(versionKey)
    if (doc?.changes.find((c) => !c.note)?.actor !== "user") setCheckBaseline(Object.fromEntries((report?.checks ?? []).map((c) => [c.id, c.pass])))
  }

  const call = React.useCallback((name: string, input: Record<string, unknown>) => turnery.call(name, input, path ?? undefined), [path])
  const kernel = React.useCallback(async <T,>(c: Parameters<typeof turnery.kernel>[1]) => (path ? ((await turnery.kernel(path, c)) as T) : null), [path])
  // A refused edit starts with ✗; an applied one may still leave a failing feature, shown in the tree as on the site.
  const errorOf = (r: { text: string }) => (r.text.startsWith("✗") ? r.text.replace(/^✗ /, "") : null)

  return {
    tree,
    treeRef,
    report,
    summary: report ? treeText(tree, report) : "",
    display,
    dims,
    checkBaseline,
    kernel: kernelState(snapshot),
    rollback: at,
    canUndo: Boolean(doc?.canUndo),
    // The engine keeps the history: every change is undoable already.
    checkpoint: React.useCallback(() => {}, []),
    undo: React.useCallback(() => void call("undo", {}), [call]),
    reset: React.useCallback(() => void call("set_tree", { tree: EMPTY_TREE }), [call]),
    load: React.useCallback(
      async (t: Tree) => {
        await call("set_tree", { tree: t })
        return null
      },
      [call],
    ),
    runTool: React.useCallback(
      async (name: string, input: Record<string, unknown>): Promise<ToolRun> => {
        const output = await call(name, input)
        return { tree: treeRef.current, output }
      },
      [call],
    ),
    setParam: React.useCallback(async (name: string, value: number | string) => errorOf(await call("set_params", { set: { [name]: value } })), [call]),
    editTree: React.useCallback(
      async (change: (t: Tree) => Tree) => {
        let next: Tree
        try {
          next = change(treeRef.current)
        } catch (e) {
          return (e as Error).message
        }
        // Based on the version on screen: if the agent changed it meanwhile, the engine refuses rather than overwrite.
        const r = await call("set_tree", { tree: next, base_rev: revRef.current })
        return /^✗ 模型已经是/.test(r.text) ? "Agent 刚改过模型，你的改动没有生效：看一眼最新的模型再改。" : errorOf(r)
      },
      [call],
    ),
    showFeature: React.useCallback((id: string | null) => setRollback(id), []),
    exportBody: React.useCallback(
      async (format: "step" | "stl") => {
        if (!path) return null
        const bytes = (await turnery.kernel(path, { op: "export", format })) as Uint8Array | null
        return bytes ? new Blob([bytes as BlobPart]) : null
      },
      [path],
    ),
    pick: React.useCallback(
      async (kind: "face" | "edge", hash: number, point: [number, number, number]) =>
        path && !at ? ((await turnery.kernel(path, { op: "pick", kind, hash, point })) as PickInfo | null) : null,
      [path, at],
    ),
    locate: React.useCallback(async (kind: "face" | "edge", selector: unknown) => kernel<number[] | null>({ op: "locate", kind, selector }), [kernel]),
    // 「在模型上重选」: a feature's faces or edges are picked on the body it starts from.
    stepInput: React.useCallback(async (index: number) => kernel<DisplayData>({ op: "display", index: index - 1 }), [kernel]),
    locateBefore: React.useCallback(
      async (kind: "face" | "edge", selector: unknown, before: number) => kernel<number[] | null>({ op: "locate", kind, selector, before }),
      [kernel],
    ),
    selectorFor: React.useCallback(
      async (kind: "face" | "edge", hashes: number[], before: number) =>
        kernel<{ selector: Record<string, unknown>; count: number } | null>({ op: "selectorFor", kind, hashes, before }),
      [kernel],
    ),
    faceEdges: React.useCallback(async (hash: number, before: number) => (await kernel<number[]>({ op: "faceEdges", hash, before })) ?? [], [kernel]),
    drawing: React.useCallback(async (iso: boolean) => kernel<DrawingData | null>({ op: "drawing", iso }), [kernel]),
    measure: React.useCallback(
      async (targets: MeasureTarget[]) => (path && !at ? ((await turnery.kernel(path, { op: "measure", targets })) as MeasureResult | null) : null),
      [path, at],
    ),
    setPins: React.useCallback((pins: Pin[]) => {
      pinsRef.current = pins
    }, []),
    // Practices are the site's.
    pinChecks: noop,
  }
}

const noop = () => {}

/** A note on a face or an edge, as the viewport's annotations. */
export const asNote = (n: PartNote & { kind: "face" | "edge" }): Note => ({
  n: n.n,
  note: n.text,
  kind: n.kind,
  what: n.what,
  where: n.where,
  origins: n.origins,
  facts: n.facts,
  point: n.point,
  part: n.part,
  selector: n.selector,
  smooth: n.smooth,
  sketch: n.sketch,
  hash: 0,
})

/**
 * `Annotations` for the window: a click opens the note card; the note is saved
 * to the part at once (no message to send). While the agent waits for a pick,
 * the same click answers it instead.
 */
export function useDesktopNotes(
  studio: Studio,
  doc: DocState | null,
  pick: PickRequest | null,
): Annotations & { nextPin: number; compose: string | null; setCompose: (text: string | null) => void; addPartNote: (text: string) => Promise<boolean> } {
  const [draft, setDraft] = React.useState<PickInfo | null>(null)
  /** A note about the part or a feature being written (the site's 「让助教改」 becomes one). */
  const [compose, setCompose] = React.useState<string | null>(null)
  const [focus, setFocus] = React.useState<Focus | null>(null)
  const viewDir = React.useRef(new THREE.Vector3(1, -1.1, 0.85).normalize())
  const path = doc?.path
  // A draft belongs to the part it was picked on; a pick request only to the part it asks about.
  const [draftPath, setDraftPath] = React.useState(path)
  if (draftPath !== path) {
    setDraftPath(path)
    setDraft(null)
    setFocus(null)
  }
  const request = pick && pick.path === path ? pick : null
  const notes = doc?.notes
  // Only notes on a face or an edge have a pin on the model.
  const open = React.useMemo(() => (notes ?? []).filter((n): n is PartNote & { kind: "face" | "edge" } => n.status === "open" && n.kind !== "part"), [notes])
  const pins: Pin[] = React.useMemo(() => open.map((n) => ({ n: n.n, point: n.point, part: n.part })), [open])
  const pending = React.useMemo(() => open.map(asNote), [open])
  const { setPins, locate } = studio
  React.useEffect(() => setPins(pins), [setPins, pins])

  const openDraft = React.useCallback(
    (info: PickInfo | null) => {
      if (info && request && request.kind !== "any" && info.kind !== request.kind) {
        notify(request.kind === "face" ? "这次要点一个面：点在面的中间，离边远一点" : "这次要点一条边")
        return
      }
      setDraft(info)
      setFocus(info ? { kind: info.kind, hashes: [info.hash] } : null)
    },
    [request],
  )
  const cancel = React.useCallback(() => {
    setDraft(null)
    setFocus(null)
  }, [])

  const add = React.useCallback(
    async (text: string) => {
      if (!draft) return
      const info = draft
      setDraft(null)
      setFocus(null)
      if (request) {
        await turnery.answerPick(request.id, { info, text })
        notify.success("已告诉 agent 你点的位置")
        return
      }
      const r = await turnery.call("add_note", { pick: info, text }, path)
      if (!r.ok) notify.error(r.text)
    },
    [draft, request, path],
  )

  const remove = React.useCallback(
    (n: number) => {
      const note = notes?.find((x) => x.n === n)
      if (note) void turnery.call("update_note", { id: note.id, remove: true }, path)
    },
    [notes, path],
  )

  /** Light up a note's face or edge on the model as it is now. */
  const show = React.useCallback(
    async (a: { part?: string; kind: "face" | "edge"; selector: Record<string, unknown> | null; n: number; point: number[] }) => {
      const hashes = a.selector ? await locate(a.kind, a.selector) : null
      if (!hashes?.length) {
        setFocus(null)
        notify(`${a.kind === "face" ? "这个面" : "这条边"}已经变了，在现在的模型上找不到`)
        return
      }
      setFocus({ kind: a.kind, hashes, pin: { n: a.n, point: a.point as Pin["point"], part: a.part } })
    },
    [locate],
  )

  /** Save a note about the whole part; false (and the reason shown) when it wasn't saved, so the draft stays. */
  const addPartNote = React.useCallback(
    async (text: string) => {
      const r = await turnery.call("add_note", { text }, path)
      if (!r.ok) {
        notify.error(r.text.replace(/^✗ /, ""))
        return false
      }
      notify.success("已记下，agent 用 get_notes 会读到")
      return true
    },
    [path],
  )

  const none = React.useCallback(() => {}, [])
  return {
    prefill: null,
    startMessage: setCompose,
    compose,
    setCompose,
    addPartNote,
    draft,
    pending,
    sent: [],
    pins,
    focus,
    viewDir,
    open: openDraft,
    cancel,
    add,
    remove,
    show,
    setFocus,
    snapshot: React.useCallback(() => null, []),
    markSent: none,
    clearSent: none,
    reset: cancel,
    nextPin: doc?.nextNote ?? 1,
  }
}
