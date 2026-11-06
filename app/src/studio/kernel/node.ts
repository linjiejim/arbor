// Kernel bootstrap for Node (evals, tests). The browser uses ../worker.ts.
import { setOC } from "replicad"
import { loadTextFont } from "./fonts"

let ready: Promise<void> | null = null

export function initNodeKernel() {
  ready ??= (async () => {
    const { default: opencascade } = await import("replicad-opencascadejs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOC((await (opencascade as any)()) as any)
    // Both text fonts up front (≈40 ms): Node callers rebuild without awaiting anything.
    // Typed by hand: this file is also checked with the browser's tsconfig, which has no Node types.
    const { readFile } = (await import(/* @vite-ignore */ `node:${"fs/promises"}`)) as { readFile: (p: URL) => Promise<Uint8Array> }
    const read = async (url: URL) => {
      const b = await readFile(url)
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    }
    await Promise.all([loadTextFont("latin", read), loadTextFont("sc", read)])
  })()
  return ready
}
