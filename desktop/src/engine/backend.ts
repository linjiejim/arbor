// Where the MCP server and the CLI send commands: the running app's engine
// (so the person sees every step), starting the app if needed, or, without a
// window, an engine of their own in this process.
import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { normalizePartPath } from "../../../app/src/desktop/core/engine"
import type { CallContext, CommandResult } from "../../../app/src/desktop/core/protocol"
import { readAppInfo, readEngineInfo, type EngineInfo } from "./home"
import { startEngine } from "./host"
import type { CallBody } from "./rpc"

export type Ctx = Omit<CallContext, "actor">

export interface Backend {
  readonly kind: "app" | "local"
  call(command: string, input: unknown, ctx: Ctx): Promise<CommandResult>
  close(): Promise<void>
}

export type ConnectOptions = {
  /** Start the app when it isn't running. */
  launch: boolean
  /** Start it without windows (`--headless`): it runs in the background, `look` still renders. */
  hidden?: boolean
  /** Never use the app, even when it runs (`--no-app`). */
  noApp?: boolean
  /** Fall back to an in-process engine (no window: no look, no picks). */
  fallback: boolean
  /** The build output folder (has kernel/kernel-thread.mjs). */
  distDir: URL
  log?: (msg: string) => void
}

async function alive(info: EngineInfo | null): Promise<EngineInfo | null> {
  if (!info) return null
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/health`, { signal: AbortSignal.timeout(1500) })
    const body = (await res.json()) as { name?: string; pid?: number }
    return res.ok && body.name === "arbor" && body.pid === info.pid ? info : null
  } catch {
    return null
  }
}

export const runningApp = () => alive(readEngineInfo())

class AppBackend implements Backend {
  readonly kind = "app"
  constructor(private info: EngineInfo) {}
  async call(command: string, input: unknown, ctx: Ctx): Promise<CommandResult> {
    const res = await fetch(`http://127.0.0.1:${this.info.port}/call`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.info.token}` },
      body: JSON.stringify({ command, input, ctx } satisfies CallBody),
    })
    if (!res.ok) throw new Error(`Arbor 返回 HTTP ${res.status}`)
    return (await res.json()) as CommandResult
  }
  async close() {}
}

class LocalBackend implements Backend {
  readonly kind = "local"
  private started: ReturnType<typeof startEngine>
  constructor(distDir: URL) {
    this.started = startEngine({ distDir })
  }
  call(command: string, input: unknown, ctx: Ctx) {
    return this.started.engine.run(command, input, { actor: "agent", ...ctx })
  }
  async close() {
    this.started.engine.dispose()
    await this.started.kernel.dispose()
  }
}

/** Start the app in the background: its window shows without taking focus, or not at all when `hidden`. */
export function launchApp(hidden = false): boolean {
  const app = readAppInfo()
  if (!app) return false
  const env = { ...process.env }
  // We may be running as Node inside Electron; the app must not.
  delete env.ELECTRON_RUN_AS_NODE
  try {
    const child = spawn(app.exec, [...app.args, "--from-agent", ...(hidden ? ["--headless"] : [])], { detached: true, stdio: "ignore", env })
    child.on("error", () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

async function waitForApp(ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const info = await alive(readEngineInfo())
    if (info) return info
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

export async function connect(opts: ConnectOptions): Promise<Backend> {
  if (opts.noApp) return new LocalBackend(opts.distDir)
  const running = await runningApp()
  if (running) return new AppBackend(running)
  if (opts.launch && launchApp(opts.hidden)) {
    opts.log?.("正在启动 Arbor App…")
    const info = await waitForApp(30_000)
    if (info) return new AppBackend(info)
    opts.log?.("Arbor App 没有在 30 秒内启动")
  }
  if (opts.fallback) return new LocalBackend(opts.distDir)
  throw new Error("Arbor App 没在运行。先打开 Arbor（或运行 arbor open），再试一次。")
}

/**
 * A connection that follows the app: uses it whenever it runs, starts it when
 * asked, and moves from a headless engine to the app as soon as one appears.
 */
export class Link {
  readonly session = `s-${process.pid}-${randomBytes(3).toString("hex")}`
  private backend: Promise<Backend> | null = null

  constructor(private opts: ConnectOptions) {}

  private async get(): Promise<Backend> {
    this.backend ??= connect(this.opts).catch((e) => {
      this.backend = null
      throw e
    })
    const b = await this.backend
    if (b.kind === "local" && !this.opts.noApp) {
      const app = await runningApp()
      if (app) {
        await b.close()
        this.backend = Promise.resolve(new AppBackend(app))
        return this.backend
      }
    }
    return b
  }

  get kind() {
    return this.backend ? this.backend.then((b) => b.kind) : Promise.resolve(null)
  }

  async call(command: string, input: unknown, ctx: Omit<Ctx, "session">): Promise<CommandResult> {
    // Every command names this agent's part: a backend we move to (headless → app, a restarted app)
    // doesn't know the session, and must not fall back to whatever the window shows.
    const full = { ...ctx, part: ctx.part ?? this.part, session: this.session }
    const b = await this.get()
    let res: CommandResult
    try {
      res = await b.call(command, input, full)
    } catch (e) {
      // The app quit (or restarted): the request never arrived, so it's safe to send it again.
      const code = (e as { cause?: { code?: string } }).cause?.code
      if (b.kind !== "app" || code !== "ECONNREFUSED") throw e
      this.backend = null
      res = await (await this.get()).call(command, input, full)
    }
    const path = (input as { path?: unknown } | null)?.path
    if (command === "open_part" && res.ok && typeof path === "string") this.part = normalizePartPath(path, ctx.cwd)
    return res
  }

  /** The part this agent opened last (absolute). */
  private part: string | undefined

  async close() {
    if (this.backend) await (await this.backend.catch(() => null))?.close()
  }
}
