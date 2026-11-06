import type { MeasureResult, MeasureTarget } from "./kernel/measure"
import type { KernelPort } from "./apply"
import type { Tree } from "./dsl"
import type { PickInfo } from "./annotations"
import type { BuildReport, DisplayData } from "./kernel/build"
import type { WorkerMessage, WorkerRequest } from "./worker"

// Distributive Omit, so each request variant keeps its own fields.
type Payload<T> = T extends unknown ? Omit<T, "id"> : never

/** The OCCT wasm heap only grows; past this, restart the worker and rebuild. */
const RECYCLE_MB = 1400

/** Promise-based handle on the kernel worker. */
export class KernelClient implements KernelPort {
  private worker!: Worker
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private lastTree: Tree | null = null
  ready!: Promise<void>
  onProgress?: (loadedMB: number) => void

  constructor() {
    this.spawn()
  }

  private spawn() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data
      if ("type" in m) return this.onProgress?.(m.loadedMB)
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      if (m.ok) p.resolve(m.result)
      else p.reject(new Error(m.error))
      if (m.ok && m.heapMB > RECYCLE_MB) queueMicrotask(() => this.recycle())
    }
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || "建模内核崩溃了"))
      this.pending.clear()
    }
    this.ready = this.call("init", { type: "init" }).then(() => undefined)
  }

  private call<T>(_label: string, req: Payload<WorkerRequest>): Promise<T> {
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.worker.postMessage({ ...req, id })
    })
  }

  async rebuild(tree: Tree): Promise<BuildReport> {
    this.lastTree = tree
    return this.call("rebuild", { type: "rebuild", tree })
  }

  display(index?: number): Promise<DisplayData> {
    return this.call("display", { type: "display", index })
  }

  inspect(what: "body" | "faces" | "edges", selector?: unknown): Promise<string> {
    return this.call("inspect", { type: "inspect", what, selector })
  }

  pick(kind: "face" | "edge", hash: number, point: [number, number, number]): Promise<PickInfo | null> {
    return this.call("pick", { type: "pick", kind, hash, point })
  }

  locate(kind: "face" | "edge", selector: unknown): Promise<number[] | null> {
    return this.call("locate", { type: "locate", kind, selector })
  }

  measure(targets: MeasureTarget[]): Promise<MeasureResult | null> {
    return this.call("measure", { type: "measure", targets })
  }

  exportBody(format: "step" | "stl", index?: number): Promise<Blob | null> {
    return this.call("export", { type: "export", format, index })
  }

  private async recycle() {
    if (this.pending.size) return
    this.worker.terminate()
    this.spawn()
    await this.ready
    if (this.lastTree) await this.rebuild(this.lastTree)
  }

  dispose() {
    this.worker.terminate()
    this.pending.clear()
  }
}
