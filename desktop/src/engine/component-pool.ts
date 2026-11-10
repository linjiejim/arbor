// Independent component files can build in parallel. Cache native B-reps by the
// complete source content and the worker build, never by file name or mtime.
import { createHash } from "node:crypto"
import { availableParallelism } from "node:os"
import path from "node:path"
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { serialize, deserialize } from "node:v8"
import { Worker } from "node:worker_threads"
import type { ComponentSource, CompiledComponent } from "../../../app/src/studio/kernel/build"
import type { KernelReply, KernelRequest } from "./kernel-thread"
import { contentKey } from "./content-key"
import { HOME } from "./home"

const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex")
export const sourceKey = (s: ComponentSource) => contentKey(s)

/** A disposable cache: corrupt, stale or unwritable entries behave as misses. */
export class ComponentCache {
  constructor(private readonly dir: string) {}
  async get(key: string): Promise<CompiledComponent | null> {
    try {
      const raw = await readFile(path.join(this.dir, `${key}.json`))
      const payload = raw.subarray(64)
      if (hash(payload) !== raw.subarray(0, 64).toString()) return null
      const data = deserialize(payload) as CompiledComponent
      return Array.isArray(data.parts) && data.parts.every((p) => typeof p.brep === "string" && (p.name === null || typeof p.name === "string")) && Number.isInteger(data.failed) ? data : null
    } catch { return null }
  }
  async put(key: string, value: CompiledComponent) {
    const file = path.join(this.dir, `${key}.json`)
    const temp = `${file}.${process.pid}.tmp`
    try {
      await mkdir(this.dir, { recursive: true })
      const data = serialize(value)
      await writeFile(temp, Buffer.concat([Buffer.from(hash(data)), data]), { mode: 0o600 })
      await rename(temp, file)
    } catch {
      await rm(temp, { force: true }).catch(() => {})
    }
  }
  async trim() {
    try {
      const files = await Promise.all((await readdir(this.dir)).filter((f) => /^[a-f0-9]{64}\.json$/.test(f)).map(async (f) => ({ file: path.join(this.dir, f), ...await stat(path.join(this.dir, f)) })))
      files.sort((a, b) => b.mtimeMs - a.mtimeMs)
      let bytes = 0
      await Promise.all(files.map((f, i) => {
        bytes += f.size
        return i >= 128 || bytes > 256 * 1024 * 1024 ? rm(f.file, { force: true }) : Promise.resolve()
      }))
    } catch { /* Cache maintenance must never block opening a model. */ }
  }
}

type Runner = { worker: Worker; call: (source: ComponentSource) => Promise<CompiledComponent> }

export class ComponentPool {
  readonly directory: Promise<string | null>
  private runners: Runner[] = []
  private memory = new Map<string, CompiledComponent>()
  private cache: Promise<ComponentCache | null>
  private closed = false

  constructor(private readonly file: URL) {
    // The bundle includes the kernel and replicad. Include the external WASM too,
    // so even a replaceable OpenCascade binary invalidates old geometry.
    this.directory = Promise.all([
      readFile(file),
      readFile(new URL("../vendor/opencascade/replicad_single.wasm", file)),
    ]).then(([js, wasm]) => path.join(HOME, "cache", "components", hash(Buffer.concat([js, wasm])))).catch(() => null)
    this.cache = this.directory.then((dir) => dir ? new ComponentCache(dir) : null)
  }

  private runner(index: number): Runner {
    if (this.closed) throw new Error("零件工作线程已关闭")
    if (this.runners[index]) return this.runners[index]
    const worker = new Worker(this.file, { stdout: true, stderr: true })
    worker.stdout.on("data", (b: Buffer) => process.stderr.write(b))
    worker.stderr.on("data", (b: Buffer) => process.stderr.write(b))
    let seq = 0
    let pending: { resolve: (c: CompiledComponent) => void; reject: (e: Error) => void } | null = null
    let failure: Error | null = null
    worker.on("message", (m: KernelReply) => {
      if ("type" in m) {
        if (m.type === "failed") { failure = new Error(m.error); pending?.reject(failure); pending = null }
        return
      }
      if (m.ok) pending?.resolve(m.result as CompiledComponent)
      else pending?.reject(new Error(m.error))
      pending = null
    })
    const crashed = (e: Error) => { failure = e; pending?.reject(e); pending = null }
    worker.on("error", crashed)
    worker.on("exit", (code) => crashed(new Error(`零件工作线程退出：${code}`)))
    const runner: Runner = {
      worker,
      call: (source) => new Promise((resolve, reject) => {
        if (failure) return reject(failure)
        pending = { resolve, reject }
        worker.postMessage({ id: ++seq, op: "compileComponent", args: [source] } satisfies KernelRequest)
      }),
    }
    this.runners[index] = runner
    return runner
  }

  async prepare(sources: ComponentSource[], progress: (done: number, total: number, label: string) => void) {
    const cache = await this.cache
    const output = [...sources]
    const jobs: { i: number; key: string }[] = []
    let done = 0
    // Cache reads are independent and cheap; a completely cached assembly starts
    // no extra workers at all.
    await Promise.all(sources.map(async (source, i) => {
      const key = sourceKey(source)
      const hit = this.memory.get(key) ?? await cache?.get(key)
      if (hit) {
        output[i] = { ...source, compiled: hit }
        progress(++done, sources.length, source.file)
      } else if (source.error) progress(++done, sources.length, source.file)
      else jobs.push({ i, key })
    }))
    // Biggest trees first reduces the final straggler on ordinary assemblies.
    const cost = (source: ComponentSource) => {
      const copies = new Map<string, number>()
      return (source.tree?.features ?? []).reduce((total, f) => {
        const count = f.op === "linear_pattern" || f.op === "circular_pattern" ? (typeof f.count === "number" ? f.count : 4) * f.features.reduce((sum, id) => sum + (copies.get(id) ?? 1), 0) : 1
        copies.set(f.id, count)
        return total + count
      }, 0)
    }
    jobs.sort((a, b) => cost(sources[b.i]) - cost(sources[a.i]))
    let next = 0
    await Promise.all(Array.from({ length: Math.min(jobs.length, 4, Math.max(1, availableParallelism() - 1)) }, async (_, runnerIndex) => {
      while (next < jobs.length && !this.closed) {
        const { i, key } = jobs[next++]
        try {
          const started = performance.now()
          const compiled = await this.runner(runnerIndex).call(sources[i])
          if (process.env.TURNERY_PROFILE) process.stderr.write(`COMPONENT ${sources[i].file} ${Math.round(performance.now() - started)} ms\n`)
          output[i] = { ...sources[i], compiled }
          this.memory.set(key, compiled)
          if (!compiled.failed) await cache?.put(key, compiled)
        } catch { /* The main kernel retries and reports the actual feature error. */ }
        progress(++done, sources.length, sources[i].file)
      }
    }))
    for (const key of this.memory.keys()) {
      if (this.memory.size <= 64) break
      this.memory.delete(key)
    }
    // Parallel preparation is a burst. Release the extra WASM heaps afterwards;
    // their exact shapes are now in the main kernel and the content cache.
    await Promise.all(this.runners.splice(0).map((r) => r.worker.terminate()))
    await cache?.trim()
    return output
  }

  async dispose() {
    this.closed = true
    await Promise.all(this.runners.splice(0).map((r) => r.worker.terminate()))
    this.memory.clear()
  }
}
