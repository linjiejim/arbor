// Starting an engine on this machine: the kernel thread, the file system,
// recent parts. Used by the app (with a window) and by the CLI (headless).
import os from "node:os"
import { Engine, type Screen } from "../../../app/src/desktop/core/engine"
import { nodeFiles } from "./files"
import { readRecent, writeRecent } from "./home"
import { ThreadKernel } from "./kernel-host"

/** `distDir`: the folder with kernel/kernel-thread.mjs (the build output). */
export function startEngine(opts: { distDir: URL; screen?: () => Screen | null; onKernel?: () => void }) {
  let engine: Engine | null = null
  const kernel = new ThreadKernel(new URL("kernel/kernel-thread.mjs", opts.distDir), () => {
    opts.onKernel?.()
    engine?.kernelChanged()
  }, (display) => engine?.kernelPreview(display), (path, report) => engine?.kernelDiagnostics(path, report))
  engine = new Engine({ kernel, files: nodeFiles, screen: opts.screen, recent: readRecent(), onRecent: writeRecent, home: os.homedir() })
  return { engine, kernel }
}
