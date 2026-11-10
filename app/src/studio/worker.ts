/// <reference lib="webworker" />
// Owns the OpenCascade kernel (wasm) so modelling never blocks the page.
import opencascade from "replicad-opencascadejs"
import wasmUrl from "replicad-opencascadejs/wasm?url"
import { setOC } from "replicad"
import type { Tree } from "./dsl"
import { Kernel } from "./kernel/build"
import { ensureFonts } from "./kernel/fonts"
import type { MeasureTarget } from "./kernel/measure"

export type WorkerRequest =
  | { id: number; type: "init" }
  | { id: number; type: "rebuild"; tree: Tree }
  | { id: number; type: "display"; index?: number }
  | { id: number; type: "inspect"; what: "body" | "faces" | "edges"; selector?: unknown }
  | { id: number; type: "export"; format: "step" | "stl" | "3mf"; index?: number }
  | { id: number; type: "pick"; kind: "face" | "edge"; hash: number; point: [number, number, number] }
  | { id: number; type: "locate"; kind: "face" | "edge"; selector: unknown; before?: number }
  | { id: number; type: "measure"; targets: MeasureTarget[] }
  | { id: number; type: "dimensions" }
  | { id: number; type: "drawing"; iso: boolean }
  | { id: number; type: "selectorFor"; kind: "face" | "edge"; hashes: number[]; before: number }
  | { id: number; type: "faceEdges"; hash: number; before: number }

export type WorkerMessage =
  | { id: number; ok: true; result: unknown; heapMB: number }
  | { id: number; ok: false; error: string }
  | { type: "progress"; loadedMB: number }

const post = (m: WorkerMessage, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer)

const fetchBuffer = async (url: URL) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.arrayBuffer()
}

let kernel: Kernel | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let oc: any = null

const ready = (async () => {
  // Stream the 23 MB wasm ourselves so the page can show progress.
  const res = await fetch(wasmUrl)
  if (!res.ok || !res.body) throw new Error(`下载建模内核失败（HTTP ${res.status}）`)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  let lastPost = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    if (loaded - lastPost > 512 * 1024) {
      lastPost = loaded
      post({ type: "progress", loadedMB: loaded / 1048576 })
    }
  }
  const bytes = new Uint8Array(loaded)
  let off = 0
  for (const c of chunks) {
    bytes.set(c, off)
    off += c.byteLength
  }
  const module = await WebAssembly.compile(bytes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oc = await (opencascade as any)({
    instantiateWasm(imports: WebAssembly.Imports, receive: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
      WebAssembly.instantiate(module, imports).then((instance) => receive(instance, module))
      return {}
    },
  })
  setOC(oc)
  kernel = new Kernel()
})()

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  try {
    await ready
    const k = kernel!
    let result: unknown = null
    const transfer: Transferable[] = []
    switch (req.type) {
      case "init":
        break
      case "rebuild":
        // A text whose font didn't arrive fails on its own step, with a message saying so.
        await ensureFonts(req.tree, fetchBuffer).catch(() => {})
        result = k.rebuild(req.tree)
        break
      case "display": {
        const d = k.display(req.index)
        if (d.mesh) transfer.push(d.mesh.vertices.buffer, d.mesh.normals.buffer, d.mesh.triangles.buffer)
        if (d.edges) transfer.push(d.edges.buffer)
        if (d.sketch) transfer.push(d.sketch.buffer)
        result = d
        break
      }
      case "inspect":
        result = k.inspect(req.what, undefined, req.selector)
        break
      case "export":
        result = await k.exportBody(req.format, req.index)
        break
      case "pick":
        result = k.pick({ kind: req.kind, hash: req.hash, point: req.point })
        break
      case "locate":
        result = k.locate(req.kind, req.selector, req.before)
        break
      case "measure":
        result = k.measure(req.targets)
        break
      case "dimensions":
        result = k.dimensions()
        break
      case "drawing":
        result = k.drawing(req.iso)
        break
      case "selectorFor":
        result = k.selectorFor(req.kind, req.hashes, req.before)
        break
      case "faceEdges":
        result = k.faceEdges(req.hash, req.before)
        break
    }
    post({ id: req.id, ok: true, result, heapMB: oc.wasmMemory.buffer.byteLength / 1048576 }, transfer)
  } catch (err) {
    post({ id: req.id, ok: false, error: String((err as Error)?.message ?? err) })
  }
}
