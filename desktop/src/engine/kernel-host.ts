// The engine's handle on the kernel worker thread. The OpenCascade wasm heap
// only grows; past a threshold the thread is replaced and the last tree is
// rebuilt in the new one, which the engine never notices.
import { Worker } from "node:worker_threads"
import type { KernelHost } from "../../../app/src/desktop/core/engine"
import type { KernelPhase, V3 } from "../../../app/src/desktop/core/protocol"
import type { Tree } from "../../../app/src/studio/dsl"
import type { BuildReport, BuildProgress, DisplayData, ComponentSource, ContextSource } from "../../../app/src/studio/kernel/build"
import type { Dim } from "../../../app/src/studio/kernel/dims"
import type { DrawingData } from "../../../app/src/studio/kernel/drawing"
import type { MeasureResult, MeasureSpec } from "../../../app/src/studio/kernel/measure"
import type { PickInfo } from "../../../app/src/studio/annotations"
import type { KernelReply, KernelRequest } from "./kernel-thread"
import { ComponentPool } from "./component-pool"
import path from "node:path"
import { ProjectPreview } from "./project-preview"
import { AssemblyCache, assemblyKey } from "./assembly-cache"

/** Same limit as the browser studio's worker. */
const RECYCLE_MB = 1400

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

/** What one part's kernel in the thread holds: replayed into a replacement thread. */
type Slot = { assets: { name: string; bytes: Uint8Array | null; error?: string }[]; components: ComponentSource[]; context: ContextSource | null; lastTree: Tree | null }
const newSlot = (): Slot => ({ assets: [], components: [], context: null, lastTree: null })

export class ThreadKernel implements KernelHost {
  phase: KernelPhase = { phase: "loading" }
  progress: BuildProgress | null = null
  private pool: ComponentPool
  private cache: Promise<AssemblyCache | null>
  private diagnosticWorkers = new Map<string, Worker>()
  private generations = new Map<string, number>()
  private projectPreview = new ProjectPreview()
  private writes = new Set<Promise<void>>()
  private preview: DisplayData | null = null
  private worker: Worker | null = null
  private started: Promise<void> | null = null
  private seq = 0
  private pending = new Map<number, Pending>()
  private stale = false
  /** The part the calls go to, and per part what the thread was last handed (a replacement thread gets the current one again). */
  private slot = ""
  private slots = new Map<string, Slot>([["", newSlot()]])
  /** Disposed: a late call (a file change already on its way) must not start a new thread. */
  private closed = false

  constructor(
    private readonly file: URL,
    private readonly onPhase: () => void = () => {},
    private readonly onPreview: (display: DisplayData) => void = () => {},
    private readonly onDiagnostics: (path: string, report: BuildReport) => void = () => {},
  ) {
    this.pool = new ComponentPool(file)
    this.cache = this.pool.directory.then((dir) => dir ? new AssemblyCache(path.join(dir, "assemblies")) : null)
  }

  /** Start the thread now (the app does this at launch so the first command is fast). */
  start() {
    this.started ??= this.spawn()
    return this.started
  }

  private spawn(): Promise<void> {
    // OpenCascade prints (STEP statistics, warnings) to stdout. Under `turnery mcp` stdout is the
    // protocol channel, so the thread gets its own streams and its chatter goes to stderr.
    const worker = new Worker(this.file, { stdout: true, stderr: true })
    worker.stdout.on("data", (b: Buffer) => process.stderr.write(b))
    worker.stderr.on("data", (b: Buffer) => process.stderr.write(b))
    this.worker = worker
    return new Promise<void>((resolve, reject) => {
      worker.on("message", (m: KernelReply) => {
        if ("type" in m) {
          if (m.type === "progress") {
            this.progress = m.progress
            this.onPhase()
          } else if (m.type === "preview") {
            this.preview = m.display
            this.onPreview(m.display)
          } else if (m.type === "ready") {
            this.setPhase({ phase: "ready" })
            resolve()
          } else {
            this.setPhase({ phase: "error", message: m.error })
            reject(new Error(m.error))
          }
          return
        }
        const p = this.pending.get(m.id)
        if (!p) return
        this.pending.delete(m.id)
        if (m.ok) {
          if (m.heapMB > RECYCLE_MB) this.stale = true
          p.resolve(m.result)
        } else p.reject(new Error(m.error))
      })
      const crashed = (why: string) => {
        if (this.worker !== worker) return
        this.worker = null
        this.started = null
        for (const p of this.pending.values()) p.reject(new Error(`建模内核意外退出（${why}），下一次调用会自动重启`))
        this.pending.clear()
        reject(new Error(why))
      }
      worker.on("error", (e) => crashed(e.message))
      worker.on("exit", (code) => crashed(`exit ${code}`))
    })
  }

  private setPhase(p: KernelPhase) {
    this.phase = p
    this.onPhase()
  }

  private async call<T>(op: KernelRequest["op"], args: unknown[]): Promise<T> {
    if (this.closed) throw new Error("建模内核已关闭")
    if (this.stale || !this.worker) await this.restart()
    else await this.start()
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.worker!.postMessage({ id, op, args } satisfies KernelRequest)
    })
  }

  /** A fresh thread holding the same files and tree as the old one. */
  private async restart() {
    const old = this.worker
    this.stale = false
    this.worker = null
    this.started = null
    if (old) {
      old.removeAllListeners("exit")
      void old.terminate()
    }
    await this.start()
    const send = (op: KernelRequest["op"], args: unknown[]) =>
      new Promise((resolve, reject) => {
        const id = ++this.seq
        this.pending.set(id, { resolve, reject })
        this.worker!.postMessage({ id, op, args } satisfies KernelRequest)
      })
    // The other parts' kernels are gone with the old thread: the next `use` of each says it's empty.
    const cur = this.slots.get(this.slot) ?? newSlot()
    this.slots = new Map([[this.slot, cur]])
    await send("use", [this.slot])
    if (cur.assets.length) await send("setAssets", [cur.assets])
    if (cur.components.length) await send("setComponents", [cur.components])
    if (cur.context) await send("setContext", [cur.context])
    if (cur.lastTree) await send("rebuild", [cur.lastTree])
  }

  private get cur() {
    let s = this.slots.get(this.slot)
    if (!s) this.slots.set(this.slot, (s = newSlot()))
    return s
  }

  /** One kernel per part in the thread: true when this part's starts empty (the engine hands everything over again). */
  async use(slot: string) {
    const fresh = await this.call<boolean>("use", [slot])
    this.slot = slot
    if (fresh) this.slots.set(slot, newSlot())
    return fresh
  }

  /** A dependency change invalidates any in-flight result for this slot. */
  private cancelDiagnostics() {
    this.generations.set(this.slot, (this.generations.get(this.slot) ?? 0) + 1)
    const prior = this.diagnosticWorkers.get(this.slot)
    if (prior) { this.diagnosticWorkers.delete(this.slot); void prior.terminate() }
  }

  async preparePreview(file: string, tree: Tree, assets: ComponentSource["assets"], components: ComponentSource[], context: ContextSource | null) {
    if (!tree.features.some((f) => f.op === "component")) return
    const directory = await this.pool.directory
    if (!directory) return
    const key = assemblyKey([tree, assets ?? [], components, context])
    const display = await this.projectPreview.read(file, key, path.basename(directory))
    if (display) this.onPreview(display)
  }

  async setAssets(list: { name: string; bytes: Uint8Array | null; error?: string }[]) {
    this.cancelDiagnostics()
    this.cur.assets = list
    await this.call<void>("setAssets", [list])
  }

  /** An assembly's components and the context of a part edited inside one; kept for a replacement thread too. */
  async setComponents(list: ComponentSource[]) {
    this.cancelDiagnostics()
    this.progress = { stage: "prepare", completed: 0, total: list.length }
    this.onPhase()
    const prepared = await this.pool.prepare(list, (completed, total, label) => {
      this.progress = { stage: "prepare", completed, total, label }
      this.onPhase()
    })
    this.cur.components = prepared
    await this.call<void>("setComponents", [prepared])
  }

  async setContext(ctx: ContextSource | null) {
    this.cancelDiagnostics()
    this.cur.context = ctx
    await this.call<void>("setContext", [ctx])
  }

  async rebuild(tree: Tree, { background = false }: { background?: boolean } = {}) {
    const slot = this.slot
    const generation = (this.generations.get(slot) ?? 0) + 1
    this.generations.set(slot, generation)
    const prior = this.diagnosticWorkers.get(slot)
    if (prior) { void prior.terminate(); this.diagnosticWorkers.delete(slot) }
    try {
      const assembly = tree.features.some((f) => f.op === "component")
      const key = assembly ? assemblyKey([tree, this.cur.assets, this.cur.components, this.cur.context]) : null
      const cache = await this.cache
      const cached = key ? await cache?.get(key) : null
      this.preview = null
      if (cached) this.onPreview(cached.display)
      const deferred = background && assembly
      const r = await this.call<BuildReport>("rebuild", [tree, { interferences: cached?.interferences, deferChecks: deferred }])
      this.cur.lastTree = tree
      if (key && this.preview && !r.paramError && r.features.every((f) => f.state !== "error" && f.state !== "skipped")) {
        const directory = await this.pool.directory
        if (directory && path.isAbsolute(slot)) {
          const write = this.projectPreview.write(slot, key, path.basename(directory), this.preview)
          this.writes.add(write)
          void write.finally(() => this.writes.delete(write))
        }
      }
      if (key && this.preview && !r.checksPending && !r.paramError && r.features.every((f) => f.state !== "error" && f.state !== "skipped")) {
        await cache?.put(key, { display: this.preview, interferences: r.interferences })
      }
      if (deferred && key && this.preview) this.checkInBackground(slot, generation, tree, { ...this.cur }, this.preview, key, cache, r, cached?.interferences)
      return r
    } finally {
      this.progress = null
      this.onPhase()
    }
  }
  private checkInBackground(slot: string, generation: number, tree: Tree, source: Slot, display: DisplayData, key: string, cache: AssemblyCache | null, initial: BuildReport, known?: BuildReport["interferences"]) {
    const worker = new Worker(this.file, { stdout: true, stderr: true })
    this.diagnosticWorkers.set(slot, worker)
    worker.stdout.on("data", (b: Buffer) => process.stderr.write(b))
    worker.stderr.on("data", (b: Buffer) => process.stderr.write(b))
    const requests: [KernelRequest["op"], unknown[]][] = [["setAssets", [source.assets]], ["setComponents", [source.components]], ["setContext", [source.context]], ["rebuild", [tree, { interferences: known }]]]
    let index = 0
    let checkedDisplay: DisplayData | null = null
    const send = () => {
      const [op, args] = requests[index]
      worker.postMessage({ id: ++index, op, args } satisfies KernelRequest)
    }
    const finish = () => { if (this.diagnosticWorkers.get(slot) === worker) this.diagnosticWorkers.delete(slot); void worker.terminate() }
    const fail = (message: string) => {
      if (this.generations.get(slot) === generation && !this.closed) this.onDiagnostics(slot, { ...initial, checksPending: false, checksError: message })
      finish()
    }
    worker.on("error", (e) => fail(e.message))
    worker.on("exit", (code) => { if (this.diagnosticWorkers.get(slot) === worker) fail(`检查线程退出：${code}`) })
    worker.on("message", async (m: KernelReply) => {
      if ("type" in m) {
        if (m.type === "ready") send()
        if (m.type === "preview") checkedDisplay = m.display
        if (m.type === "failed") fail(m.error)
        return
      }
      if (!m.ok) { fail(m.error); return }
      if (index < requests.length) { send(); return }
      if (this.generations.get(slot) !== generation || this.closed) { finish(); return }
      const report = m.result as BuildReport
      // Hashes are process-local. The same ordered topology maps check highlights
      // back to the interactive kernel; never publish another worker's hashes.
      const faces = new Map(checkedDisplay?.groups.map((g, i) => [g.hash, display.groups[i]?.hash]))
      const edges = new Map(checkedDisplay?.edgeGroups.map((g, i) => [g.hash, display.edgeGroups[i]?.hash]))
      report.checks?.forEach((c) => { c.faces = c.faces.flatMap((h) => faces.get(h) === undefined ? [] : [faces.get(h)!]); c.edges = c.edges.flatMap((h) => edges.get(h) === undefined ? [] : [edges.get(h)!]) })
      this.onDiagnostics(slot, report)
      finish()
      if (report.features.every((f) => f.state !== "error" && f.state !== "skipped")) await cache?.put(key, { display, interferences: report.interferences })
    })
  }

  inspect(what: "body" | "faces" | "edges", selector?: unknown) {
    return this.call<string>("inspect", [what, selector])
  }
  display(index?: number) {
    return this.call<DisplayData>("display", [index])
  }
  pick(kind: "face" | "edge", hash: number, point: V3) {
    return this.call<PickInfo | null>("pick", [kind, hash, point])
  }
  locate(kind: "face" | "edge", selector: unknown, before?: number) {
    return this.call<number[] | null>("locate", [kind, selector, before])
  }
  selectorFor(kind: "face" | "edge", hashes: number[], before: number) {
    return this.call<{ selector: Record<string, unknown>; count: number } | null>("selectorFor", [kind, hashes, before])
  }
  faceEdges(hash: number, before: number) {
    return this.call<number[]>("faceEdges", [hash, before])
  }
  measure(targets: MeasureSpec[]) {
    return this.call<MeasureResult | null>("measure", [targets])
  }
  dimensions() {
    return this.call<Dim[]>("dimensions", [])
  }
  drawing(withIso: boolean) {
    return this.call<DrawingData | null>("drawing", [withIso])
  }
  exportBody(format: "step" | "stl" | "3mf", index?: number) {
    return this.call<Uint8Array | null>("exportBody", [format, index])
  }

  async dispose() {
    this.closed = true
    await Promise.all(this.writes)
    await Promise.all([...this.diagnosticWorkers.values()].map((w) => w.terminate()))
    this.diagnosticWorkers.clear()
    await this.pool.dispose()
    const w = this.worker
    this.worker = null
    if (w) {
      w.removeAllListeners("exit")
      await w.terminate()
    }
  }
}
