// The kernel is the slowest thing on the studio page (a 5 MB wasm). Start it the
// moment the route is chosen, alongside the page's own code, and hand it over
// when the page mounts.
import { KernelClient } from "./client"

let early: KernelClient | null = null

export function startKernel() {
  early ??= new KernelClient()
}

/** The kernel started early, or a fresh one (the page mounted again). */
export function takeKernel(): KernelClient {
  const c = early ?? new KernelClient()
  early = null
  return c
}
