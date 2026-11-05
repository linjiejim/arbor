// Kernel bootstrap for Node (evals, tests). The browser uses ../worker.ts.
import { setOC } from "replicad"

let ready: Promise<void> | null = null

export function initNodeKernel() {
  ready ??= (async () => {
    const { default: opencascade } = await import("replicad-opencascadejs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOC((await (opencascade as any)()) as any)
  })()
  return ready
}
