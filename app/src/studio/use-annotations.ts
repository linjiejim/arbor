import * as React from "react"
import * as THREE from "three"
import { notify } from "@/components/ui/toast"
import type { Annotation, PickInfo } from "./annotations"
import { renderViews, type Pin } from "./look"
import type { Studio } from "./use-studio"

/** An annotation in the composer: what the message will carry, plus the mesh hash to highlight. */
export type Note = Annotation & { hash: number }

/** Faces or edges lit up in the viewport (a draft, a chip, a ① in a reply). */
export type Focus = { kind: "face" | "edge"; hashes: number[]; pin?: Pin }

/**
 * The learner's marks on the model for the next message: the card being
 * written, the numbered pins, and what's highlighted. Pins of a sent message
 * stay until the reply is done.
 */
export function useAnnotations(studio: Studio) {
  const [draft, setDraft] = React.useState<PickInfo | null>(null)
  const [pending, setPending] = React.useState<Note[]>([])
  const [sent, setSent] = React.useState<Note[]>([])
  const [focus, setFocus] = React.useState<Focus | null>(null)
  /** Direction from the target to the camera, kept by the viewport: the screenshot uses the learner's view. */
  const viewDir = React.useRef(new THREE.Vector3(1, -1.1, 0.85).normalize())

  const pins: Pin[] = React.useMemo(() => [...pending, ...sent].map((a) => ({ n: a.n, point: a.point as Pin["point"] })), [pending, sent])
  // `look` draws this turn's pins too, so the model can check it changed the right spot.
  const { setPins } = studio
  React.useEffect(() => setPins(pins), [setPins, pins])

  const open = React.useCallback((info: PickInfo | null) => {
    setDraft(info)
    setFocus(info ? { kind: info.kind, hashes: [info.hash] } : null)
  }, [])

  const cancel = React.useCallback(() => {
    setDraft(null)
    setFocus(null)
  }, [])

  const add = React.useCallback(
    (note: string) => {
      if (!draft) return
      setPending((list) => [...list, { ...draft, n: list.length + 1, note: note.trim() }])
      setDraft(null)
      setFocus(null)
    },
    [draft],
  )

  const remove = React.useCallback((n: number) => {
    setPending((list) => list.filter((a) => a.n !== n).map((a, i) => ({ ...a, n: i + 1 })))
    setFocus(null)
  }, [])

  /** Light up an annotation on the model as it is now; say so when it no longer resolves. */
  const show = React.useCallback(
    async (a: Annotation) => {
      const hashes = a.selector ? await studio.locate(a.kind, a.selector) : null
      if (!hashes?.length) {
        setFocus(null)
        notify(`${a.kind === "face" ? "这个面" : "这条边"}已经变了，在现在的模型上找不到`)
        return
      }
      setFocus({ kind: a.kind, hashes, pin: { n: a.n, point: a.point as Pin["point"] } })
    },
    [studio],
  )

  /** The picture sent with the message: the learner's view, numbered pins drawn on it. */
  const snapshot = React.useCallback(() => {
    const d = studio.display
    if (!d?.mesh || !pending.length) return null
    return renderViews(d, ["current"], undefined, { pins, dir: viewDir.current })[0] ?? null
  }, [studio.display, pending.length, pins])

  /** The message went out: its pins stay until the reply is done. */
  const markSent = React.useCallback(() => {
    setSent(pending)
    setPending([])
    setDraft(null)
    setFocus(null)
  }, [pending])

  const clearSent = React.useCallback(() => setSent([]), [])

  const reset = React.useCallback(() => {
    setPending([])
    setSent([])
    setDraft(null)
    setFocus(null)
  }, [])

  /** Text to start the next message with (「让助教改这一步」); the composer takes it and focuses. */
  const [prefill, setPrefill] = React.useState<{ text: string; n: number } | null>(null)
  const startMessage = React.useCallback((text: string) => setPrefill((p) => ({ text, n: (p?.n ?? 0) + 1 })), [])

  return { draft, pending, sent, pins, focus, viewDir, open, cancel, add, remove, show, setFocus, snapshot, markSent, clearSent, reset, prefill, startMessage }
}

export type Annotations = ReturnType<typeof useAnnotations>
