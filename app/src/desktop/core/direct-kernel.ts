// The kernel called directly, in the same thread: for tests and for the
// kernel worker thread itself. The caller initialises OpenCascade first
// (initNodeKernel in Node).
import { getOC } from "replicad"
import type { Tree } from "../../studio/dsl"
import { Kernel, type BuildHooks, type BuildReport, type ComponentSource, type ContextSource } from "../../studio/kernel/build"
import type { MeasureSpec } from "../../studio/kernel/measure"
import type { KernelHost } from "./engine"
import type { KernelPhase, V3 } from "./protocol"

/** Size of the OpenCascade wasm heap in MB. It only grows; the host replaces the kernel past a limit. */
export function wasmHeapMB() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc = getOC() as any
  return (oc?.wasmMemory?.buffer?.byteLength ?? oc?.HEAPU8?.length ?? 0) / 1048576
}

/** Parts whose last build stays in memory: switching between them doesn't rebuild. */
export const KERNEL_SLOTS = 4

export class DirectKernel implements KernelHost {
  private readonly hooks: BuildHooks
  constructor(hooks: BuildHooks = {}) { this.hooks = hooks }
  readonly phase: KernelPhase = { phase: "ready" }
  private k = new Kernel()
  /** One kernel per part (by path), most recently used last. */
  private slots = new Map<string, Kernel>([["", this.k]])

  /**
   * Make `slot`'s kernel the one the next calls go to. True when it starts empty (never used, or
   * dropped to make room): the caller hands over files and the tree again.
   */
  async use(slot: string) {
    let k = this.slots.get(slot)
    const fresh = !k
    if (k) this.slots.delete(slot)
    else k = new Kernel()
    this.slots.set(slot, k)
    for (const [name, old] of this.slots) {
      if (this.slots.size <= KERNEL_SLOTS) break
      if (old === k) continue
      old.dispose()
      this.slots.delete(name)
    }
    this.k = k
    return fresh
  }

  async rebuild(tree: Tree, options: { background?: boolean; interferences?: BuildReport["interferences"]; deferChecks?: boolean } = {}) {
    return this.k.rebuild(tree, { ...this.hooks, ...options })
  }
  async restyle(tree: Tree) {
    return this.k.restyle(tree)
  }
  async looks() {
    return this.k.looks()
  }
  async inspect(what: "body" | "faces" | "edges", selector?: unknown) {
    return this.k.inspect(what, undefined, selector)
  }
  async display(index?: number) {
    return this.k.display(index)
  }
  async pick(kind: "face" | "edge", hash: number, point: V3) {
    return this.k.pick({ kind, hash, point })
  }
  async locate(kind: "face" | "edge", selector: unknown, before?: number) {
    return this.k.locate(kind, selector, before)
  }
  async selectorFor(kind: "face" | "edge", hashes: number[], before: number) {
    return this.k.selectorFor(kind, hashes, before)
  }
  async faceEdges(hash: number, before: number) {
    return this.k.faceEdges(hash, before)
  }
  async measure(targets: MeasureSpec[]) {
    return this.k.measure(targets)
  }
  async dimensions() {
    return this.k.dimensions()
  }
  async drawing(withIso: boolean) {
    return this.k.drawing(withIso)
  }
  async setAssets(list: { name: string; bytes: Uint8Array | null; error?: string }[]) {
    this.k.setAssets(list)
  }
  async setComponents(list: ComponentSource[]) {
    this.k.setComponents(list)
  }
  async setContext(ctx: ContextSource | null) {
    this.k.setContext(ctx)
  }
  async exportBody(format: "step" | "stl" | "3mf", index?: number) {
    const blob = await this.k.exportBody(format, index)
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null
  }
  dispose() {
    for (const k of this.slots.values()) k.dispose()
    this.slots.clear()
  }
}
