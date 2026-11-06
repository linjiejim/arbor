// The Arbor engine: open parts (feature-tree files), one OpenCascade kernel,
// undo, the person's notes, and every command the agent or the window runs.
// Platform-neutral: the kernel, the file system and the window come in as
// ports, so the same engine runs in Electron's main process and in the CLI.
import type { PickInfo } from "../../studio/annotations"
import { executeTool, moveFeature, treeText, type KernelPort } from "../../studio/apply"
import { toBuild123d } from "../../studio/codegen"
import { EMPTY_TREE, Tree, displayName } from "../../studio/dsl"
import type { BuildReport, DisplayData } from "../../studio/kernel/build"
import { InputError } from "../../studio/kernel/errors"
import type { MeasureResult, MeasureTarget } from "../../studio/kernel/measure"
import { STARTERS } from "../../studio/starters"
import { STUDIO_TOOLS } from "../../studio/tools"
import { AGENT_GUIDE, COMMAND } from "./catalog"
import { checkText, runChecks, type CheckInput, type Target } from "./check"
import { newNote, notesText, parseNotes, pickLines, type NotesFile } from "./notes"
import {
  NOTES_EXT,
  PART_EXT,
  type AgentActivity,
  type CallContext,
  type Change,
  type CommandResult,
  type DocState,
  type EngineEvent,
  type KernelCall,
  type KernelPhase,
  type LookRequest,
  type PartSummary,
  type PickRequest,
  type Snapshot,
} from "./protocol"
import { describeTreeChange } from "./tree-diff"

type V3 = [number, number, number]

export interface KernelHost {
  readonly phase: KernelPhase
  rebuild(tree: Tree): Promise<BuildReport>
  inspect(what: "body" | "faces" | "edges", selector?: unknown): Promise<string>
  display(index?: number): Promise<DisplayData>
  pick(kind: "face" | "edge", hash: number, point: V3): Promise<PickInfo | null>
  locate(kind: "face" | "edge", selector: unknown): Promise<number[] | null>
  measure(targets: MeasureTarget[]): Promise<MeasureResult | null>
  exportBody(format: "step" | "stl", index?: number): Promise<Uint8Array | null>
}

export interface Files {
  read(path: string): Promise<string | null>
  write(path: string, data: string | Uint8Array): Promise<void>
  /** Call back when the file changes on disk; returns a function that stops watching. */
  watch(path: string, onChange: () => void): () => void
}

/** The window, when there is one: renders views for `look`. */
export interface Screen {
  look(req: LookRequest): Promise<string[]>
}

export type EngineOptions = {
  kernel: KernelHost
  files: Files
  screen?: () => Screen | null
  /** Recently opened parts, most recent first; kept by the host. */
  recent?: string[]
  onRecent?: (paths: string[]) => void
}

type Entry = { tree: Tree; summary: string }

type Doc = {
  path: string
  name: string
  tree: Tree
  rev: number
  report: BuildReport | null
  undo: Entry[]
  redo: Entry[]
  changes: Change[]
  notes: NotesFile
  error?: string
  /** The text last written or read: tells our own writes apart from someone else's. */
  written: string | null
  unwatch: () => void
  /** Changes so far (the activity list is capped; this keeps counting). */
  seq: number
  /** What the agent has been told about: changes up to this one, notes up to this number. */
  agentSeq: number
  agentNoteN: number
}

type PickAnswer = { info: PickInfo; text?: string }

const MAX_UNDO = 100
const MAX_CHANGES = 200
const STUDIO_TOOL_NAMES = new Set(Object.keys(STUDIO_TOOLS).filter((n) => n !== "look"))
/** Agent-side commands the window may run too. */
const WINDOW_OK = new Set(["undo", "redo"])

const fail = (text: string): CommandResult => ({ ok: false, text: `✗ ${text}` })
const clip = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n)}…` : s)

export function partName(path: string) {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.endsWith(PART_EXT) ? base.slice(0, -PART_EXT.length) : base.replace(/\.json$/i, "")
}

export function notesPath(path: string) {
  return path.endsWith(PART_EXT) ? path.slice(0, -PART_EXT.length) + NOTES_EXT : path.replace(/\.json$/i, "") + NOTES_EXT
}

/** A part path as given by a caller: made absolute against its directory, `.arbor.json` added when there's no `.json`. */
export function normalizePartPath(path: string, cwd?: string) {
  let p = path.trim()
  if (!/^([A-Za-z]:)?[\\/]/.test(p) && cwd) p = `${cwd.replace(/[\\/]+$/, "")}/${p}`
  p = p.replace(/\/\.\//g, "/")
  if (!/\.json$/i.test(p)) p += PART_EXT
  return p
}

export function parseTree(text: string): { ok: true; tree: Tree } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `JSON 格式错误：${(e as Error).message}` }
  }
  const parsed = Tree.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "（根）"} ${i.message}`).join("；") }
  return { ok: true, tree: parsed.data }
}

export class Engine {
  private docs = new Map<string, Doc>()
  private active: string | null = null
  private sessions = new Map<string, string>()
  private listeners = new Set<(e: EngineEvent) => void>()
  private chain: Promise<unknown> = Promise.resolve()
  private kernelDoc: Doc | null = null
  private kernelTree: Tree | null = null
  private agent: AgentActivity = { busy: false, tool: null, at: null }
  private pending: { request: PickRequest; waiters: ((a: PickAnswer | null) => void)[] } | null = null
  /** A pick the person answered after the agent stopped waiting: handed over on the next identical request. */
  private late: { path: string; prompt: string; answer: PickAnswer } | null = null
  private recent: string[]
  private opts: EngineOptions

  constructor(opts: EngineOptions) {
    this.opts = opts
    this.recent = opts.recent ?? []
  }

  // ------------------------------------------------------------------ events

  on(cb: (e: EngineEvent) => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }

  private emit(e: EngineEvent) {
    for (const cb of this.listeners) {
      try {
        cb(e)
      } catch {
        /* a listener's failure isn't the engine's */
      }
    }
  }

  private emitSnapshot() {
    this.emit({ type: "snapshot", snapshot: this.snapshot() })
  }

  /** Snapshot first: the window keeps the doc only when it's the active part, so it must know which that is. */
  private emitDoc(doc: Doc) {
    this.emitSnapshot()
    this.emit({ type: "doc", doc: this.state(doc) })
  }

  /** The kernel came up or failed: the host tells the engine, the engine tells the window. */
  kernelChanged() {
    this.emitSnapshot()
  }

  // ------------------------------------------------------------------- state

  snapshot(): Snapshot {
    const parts: PartSummary[] = [...this.docs.values()].map((d) => ({
      path: d.path,
      name: d.name,
      features: d.tree.features.length,
      openNotes: d.notes.notes.filter((n) => n.status === "open").length,
      error: d.error,
    }))
    return { parts, active: this.active, kernel: this.opts.kernel.phase, agent: { ...this.agent } }
  }

  docState(path?: string | null): DocState | null {
    const doc = this.docs.get(path ?? this.active ?? "")
    return doc ? this.state(doc) : null
  }

  get recentParts() {
    return [...this.recent]
  }

  pickRequest() {
    return this.pending?.request ?? null
  }

  private state(doc: Doc): DocState {
    return {
      path: doc.path,
      name: doc.name,
      tree: doc.tree,
      rev: doc.rev,
      report: doc.report,
      canUndo: doc.undo.length > 0,
      canRedo: doc.redo.length > 0,
      changes: doc.changes.slice(0, 50),
      notes: doc.notes.notes,
      nextNote: doc.notes.next,
      error: doc.error,
    }
  }

  // ---------------------------------------------------------------- commands

  /** Run one command. Everything that touches the kernel or a part runs one at a time. */
  async run(name: string, input: unknown, ctx: CallContext): Promise<CommandResult> {
    const spec = COMMAND.get(name)
    const allowed =
      spec && (spec.audience === "both" || (ctx.actor === "user" ? spec.audience === "user" || WINDOW_OK.has(name) : spec.audience === "agent"))
    if (!spec || !allowed) return fail(`没有这个命令：${name}`)
    const parsed = spec.input.safeParse(input ?? {})
    if (!parsed.success) return fail(`参数不对：${parsed.error.issues.map((i) => `${i.path.join(".") || "（根）"} ${i.message}`).join("；")}`)
    const data = parsed.data as Record<string, unknown>
    if (name === "guide") return { ok: true, text: AGENT_GUIDE }
    try {
      // Waits for the person outside the queue (and without "agent busy"): the window answers through kernel calls.
      if (name === "request_pick") return await this.requestPick(data, ctx)
      return await this.track(ctx, name, () => this.exclusive(() => this.runLocked(name, data, ctx)))
    } catch (e) {
      return fail(e instanceof InputError ? e.message : `出错了：${(e as Error)?.message ?? e}`)
    }
  }

  private async track(ctx: CallContext, name: string, fn: () => Promise<CommandResult>) {
    if (ctx.actor !== "agent") return fn()
    this.agent = { busy: true, tool: name, at: Date.now() }
    this.emitSnapshot()
    try {
      return await fn()
    } finally {
      this.agent = { busy: false, tool: name, at: Date.now() }
      this.emitSnapshot()
    }
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.chain.then(fn)
    this.chain = job.catch(() => undefined)
    return job
  }

  private async runLocked(name: string, input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    try {
      if (name === "open_part") return await this.openPart(input as { path: string; create?: boolean; template?: string }, ctx)
      if (name === "list_parts") return this.listParts()
      if (name === "close_part") return this.closePart(String(input.path))
      const doc = await this.resolveDoc(ctx)
      if (!doc) return fail("还没有打开零件：先用 open_part（path 写零件文件，新零件加 create: true）。")
      // get_notes lists the new notes itself.
      const notice = ctx.actor === "agent" ? this.noticeFor(doc, name === "get_notes") : ""
      const res = await this.onDoc(doc, name, input, ctx)
      if (ctx.actor === "agent") this.markSeen(doc)
      return notice ? { ...res, text: `${notice}\n\n${res.text}` } : res
    } catch (e) {
      if (e instanceof InputError) return fail(e.message)
      return fail(`出错了：${(e as Error)?.message ?? e}`)
    }
  }

  private async onDoc(doc: Doc, name: string, input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    if (STUDIO_TOOL_NAMES.has(name)) {
      await this.ensureKernel(doc)
      const before = doc.tree
      const run = await executeTool(this.port(doc), doc.tree, name, input)
      if (run.tree !== before) await this.adopt(doc, run.tree, ctx.actor, { report: run.report })
      else if (run.report) doc.report = run.report
      return { ok: run.output.ok, text: run.output.text }
    }
    switch (name) {
      case "get_state":
        return { ok: true, text: await this.stateText(doc) }
      case "set_tree": {
        const base = input.base_rev as number | undefined
        if (base !== undefined && base !== doc.rev) return fail(`模型已经是第 ${doc.rev} 版了（你基于第 ${base} 版）：先用 get_state 看最新的，再改。`)
        await this.adopt(doc, input.tree as Tree, ctx.actor)
        return { ok: this.allOk(doc), text: `已替换特征树（第 ${doc.rev} 版）。\n${treeText(doc.tree, doc.report!)}` }
      }
      case "move_feature": {
        const by = input.by as number
        let tree = doc.tree
        for (let i = 0; i < Math.abs(by); i++) tree = moveFeature(tree, String(input.id), by < 0 ? -1 : 1)
        if (tree === doc.tree) return { ok: true, text: "顺序没变。" }
        await this.adopt(doc, tree, ctx.actor)
        return { ok: this.allOk(doc), text: treeText(doc.tree, doc.report!) }
      }
      case "undo":
      case "redo":
        return this.undoRedo(doc, name, ctx)
      case "look":
        return this.look(doc, input)
      case "measure": {
        await this.ensureKernel(doc)
        const a = await this.one(input.a as Target)
        const b = input.b ? await this.one(input.b as Target) : undefined
        const res = await this.opts.kernel.measure(b ? [a, b] : [a])
        if (!res) return fail("量不了：还没有实体。")
        return { ok: true, text: measureText(res) }
      }
      case "check": {
        await this.ensureKernel(doc)
        const lines = await runChecks(input as CheckInput, {
          report: doc.report!,
          locate: (kind, selector) => this.opts.kernel.locate(kind, selector),
          measure: (a, b) => this.opts.kernel.measure(b ? [{ ...a, point: [0, 0, 0] }, { ...b, point: [0, 0, 0] }] : [{ ...a, point: [0, 0, 0] }]),
        })
        return { ok: lines.every((l) => l.pass), text: checkText(lines) }
      }
      case "export":
        return this.exportPart(doc, input as { path: string; format?: "step" | "stl" | "py" | "json" }, ctx)
      case "get_notes": {
        doc.agentNoteN = Math.max(doc.agentNoteN, ...doc.notes.notes.map((n) => n.n))
        return { ok: true, text: notesText(doc.notes.notes, input.status === "all") }
      }
      case "resolve_note": {
        const note = doc.notes.notes.find((n) => n.id === input.id)
        if (!note) return fail(`没有备注 ${input.id}。用 get_notes 看有哪些。`)
        if (input.reopen) {
          note.status = "open"
          note.resolvedAt = undefined
        } else {
          note.status = "resolved"
          note.resolvedAt = Date.now()
        }
        if (typeof input.reply === "string" && input.reply.trim()) note.reply = input.reply.trim()
        this.logNote(doc, ctx.actor, `${input.reopen ? "重新打开" : "处理完"}备注 ${note.id}${note.reply && !input.reopen ? `：${note.reply}` : ""}`)
        await this.saveNotes(doc)
        this.emitDoc(doc)
        const open = doc.notes.notes.filter((n) => n.status === "open").length
        return { ok: true, text: `${note.id} ${note.status === "open" ? "已重新打开" : "已标为已处理"}。还有 ${open} 条未处理。` }
      }
      case "show":
        return this.show(doc, input)
      case "add_note": {
        const note = newNote(doc.notes, input.pick as unknown as PickInfo, String(input.text ?? ""))
        doc.notes = { next: note.n + 1, notes: [...doc.notes.notes, note] }
        this.logNote(doc, ctx.actor, `记下备注 ${note.id}「${clip(note.text) || "只点了位置"}」`, "added")
        await this.saveNotes(doc)
        this.emitDoc(doc)
        return { ok: true, text: `已记下备注 ${note.id}。` }
      }
      case "update_note": {
        const note = doc.notes.notes.find((n) => n.id === input.id)
        if (!note) return fail(`没有备注 ${input.id}`)
        if (input.remove) {
          doc.notes = { ...doc.notes, notes: doc.notes.notes.filter((n) => n !== note) }
          this.logNote(doc, ctx.actor, `删除备注 ${note.id}`)
        } else {
          if (typeof input.text === "string") note.text = input.text.trim()
          if (input.status && input.status !== note.status) {
            note.status = input.status as "open" | "resolved"
            note.resolvedAt = note.status === "resolved" ? Date.now() : undefined
            this.logNote(doc, ctx.actor, `把备注 ${note.id} 标为${note.status === "resolved" ? "已处理" : "未处理"}`)
          }
        }
        await this.saveNotes(doc)
        this.emitDoc(doc)
        return { ok: true, text: "已更新备注。" }
      }
    }
    return fail(`没有这个命令：${name}`)
  }

  // ------------------------------------------------------------------ parts

  private async openPart(input: { path: string; create?: boolean; template?: string }, ctx: CallContext): Promise<CommandResult> {
    const path = normalizePartPath(input.path, ctx.cwd)
    const existed = this.docs.has(path) || (await this.opts.files.read(path)) !== null
    const doc = await this.load(path, { create: input.create, template: input.template })
    this.active = path
    if (ctx.session) this.sessions.set(ctx.session, path)
    // What was there before the agent arrived isn't news to it.
    if (ctx.actor === "agent") this.markSeen(doc)
    this.emitDoc(doc)
    const head = existed ? `已打开 ${path}（第 ${doc.rev} 版）` : `已新建 ${path}${input.template ? `（从「${STARTERS.find((s) => s.id === input.template)?.title}」开始）` : ""}`
    const open = doc.notes.notes.filter((n) => n.status === "open")
    const notes = open.length ? `\n窗口里有 ${open.length} 条未处理的备注，用 get_notes 读。` : ""
    const warn = existed && input.template ? "\n文件已经存在，没有用 template。" : ""
    return { ok: true, text: `${head}。Arbor 窗口已切到这个零件。${warn}${notes}\n${treeText(doc.tree, doc.report!)}` }
  }

  private listParts(): CommandResult {
    const parts = [...this.docs.values()]
    if (!parts.length) return { ok: true, text: `没有打开的零件。${this.recent.length ? `\n最近打开过：\n${this.recent.slice(0, 10).map((p) => `- ${p}`).join("\n")}` : ""}` }
    const lines = parts.map((d) => {
      const open = d.notes.notes.filter((n) => n.status === "open").length
      return `${d.path === this.active ? "▸" : "-"} ${d.path}：${d.tree.features.length} 个特征${open ? `，${open} 条未处理备注` : ""}${d.error ? `，文件有错：${d.error}` : ""}`
    })
    return { ok: true, text: `打开的零件（▸ = 窗口里正在看的）：\n${lines.join("\n")}` }
  }

  private closePart(path: string): CommandResult {
    const doc = this.docs.get(path)
    if (!doc) return { ok: true, text: "没有打开这个零件。" }
    doc.unwatch()
    this.docs.delete(path)
    if (this.kernelDoc === doc) this.kernelDoc = null
    for (const [s, p] of this.sessions) if (p === path) this.sessions.delete(s)
    if (this.active === path) this.active = [...this.docs.keys()].pop() ?? null
    const next = this.active ? this.docs.get(this.active) : null
    if (next) this.emitDoc(next)
    else this.emitSnapshot()
    return { ok: true, text: "已关闭。" }
  }

  /** Open a part for the window (File → Open, the parts list): same as the agent's open_part, as the person. */
  openForUser(path: string, create = false) {
    return this.run("open_part", { path, create }, { actor: "user" })
  }

  private async resolveDoc(ctx: CallContext): Promise<Doc | null> {
    if (ctx.part) {
      const path = normalizePartPath(ctx.part, ctx.cwd)
      return this.docs.get(path) ?? (await this.load(path, {}))
    }
    const path = (ctx.session && this.sessions.get(ctx.session)) || this.active
    return path ? (this.docs.get(path) ?? null) : null
  }

  private async load(path: string, opts: { create?: boolean; template?: string }): Promise<Doc> {
    const existing = this.docs.get(path)
    if (existing) return existing
    const text = await this.opts.files.read(path)
    let tree: Tree
    if (text === null) {
      if (!opts.create) throw new InputError(`没有这个文件：${path}。要新建就设 create=true。`)
      tree = (opts.template && STARTERS.find((s) => s.id === opts.template)?.tree) || EMPTY_TREE
    } else {
      const parsed = parseTree(text)
      if (!parsed.ok) throw new InputError(`${path} 不是合法的特征树：${parsed.error}`)
      tree = parsed.tree
    }
    const notes = parseNotes(await this.opts.files.read(notesPath(path)))
    const doc: Doc = {
      path,
      name: partName(path),
      tree,
      rev: 0,
      report: null,
      undo: [],
      redo: [],
      changes: [],
      notes,
      written: text,
      unwatch: () => {},
      seq: 0,
      agentNoteN: 0,
      agentSeq: 0,
    }
    this.docs.set(path, doc)
    if (text === null) await this.save(doc)
    doc.unwatch = this.opts.files.watch(path, () => void this.exclusive(() => this.fileChanged(doc)))
    await this.ensureKernel(doc)
    this.recent = [path, ...this.recent.filter((p) => p !== path)].slice(0, 20)
    this.opts.onRecent?.(this.recent)
    return doc
  }

  /** Someone (the agent with its own editor, git, a person in another editor) changed the file. */
  private async fileChanged(doc: Doc) {
    if (this.docs.get(doc.path) !== doc) return
    const text = await this.opts.files.read(doc.path)
    if (text === doc.written) return
    if (text === null) {
      doc.error = "文件被删除或移走了；窗口里还是删之前的模型"
      this.emitDoc(doc)
      return
    }
    doc.written = text
    const parsed = parseTree(text)
    if (!parsed.ok) {
      doc.error = `文件不是合法的特征树：${parsed.error}`
      this.emitDoc(doc)
      return
    }
    // Don't write it back: an editor that just saved it would see the file change under it.
    await this.adopt(doc, parsed.tree, "file", { save: false })
  }

  // ---------------------------------------------------------- tree changes

  /** Make `tree` the part's current tree: rebuild, record who did what, save, tell the window. Undoable. */
  private async adopt(doc: Doc, tree: Tree, actor: CallContext["actor"], opts: { report?: BuildReport; save?: boolean; summary?: string; undoable?: boolean } = {}) {
    const summary = opts.summary ?? (describeTreeChange(doc.tree, tree) || "重新保存（内容没变）")
    if (opts.undoable !== false) {
      doc.undo = [...doc.undo, { tree: doc.tree, summary }].slice(-MAX_UNDO)
      doc.redo = []
    }
    doc.tree = tree
    doc.rev += 1
    doc.error = undefined
    if (opts.report && this.kernelDoc === doc && this.kernelTree === tree) doc.report = opts.report
    else await this.ensureKernel(doc, true)
    doc.changes = [{ rev: doc.rev, actor, at: Date.now(), summary, seq: ++doc.seq }, ...doc.changes].slice(0, MAX_CHANGES)
    if (opts.save !== false) await this.save(doc)
    this.emitDoc(doc)
  }

  private async undoRedo(doc: Doc, which: "undo" | "redo", ctx: CallContext): Promise<CommandResult> {
    const from = which === "undo" ? doc.undo : doc.redo
    const entry = from[from.length - 1]
    if (!entry) return fail(which === "undo" ? "没有可以撤销的改动。" : "没有可以重做的改动。")
    if (which === "undo") {
      doc.undo = doc.undo.slice(0, -1)
      doc.redo = [...doc.redo, { tree: doc.tree, summary: entry.summary }]
    } else {
      doc.redo = doc.redo.slice(0, -1)
      doc.undo = [...doc.undo, { tree: doc.tree, summary: entry.summary }]
    }
    await this.adopt(doc, entry.tree, ctx.actor, { summary: `${which === "undo" ? "撤销" : "重做"}：${entry.summary}`, undoable: false })
    return { ok: true, text: `已${which === "undo" ? "撤销" : "重做"}：${entry.summary}\n${treeText(doc.tree, doc.report!)}` }
  }

  /** Notes don't change the tree (no new version) but belong in the activity list: who wrote, handled or removed what. */
  private logNote(doc: Doc, actor: CallContext["actor"], summary: string, note: "added" | "changed" = "changed") {
    doc.changes = [{ rev: doc.rev, actor, at: Date.now(), summary, note, seq: ++doc.seq }, ...doc.changes].slice(0, MAX_CHANGES)
  }

  private allOk(doc: Doc) {
    return !!doc.report && !doc.report.paramError && doc.report.features.every((f) => f.state === "ok" || f.state === "suppressed")
  }

  private async save(doc: Doc) {
    const text = `${JSON.stringify(doc.tree, null, 2)}\n`
    doc.written = text
    await this.opts.files.write(doc.path, text)
  }

  private async saveNotes(doc: Doc) {
    await this.opts.files.write(notesPath(doc.path), `${JSON.stringify(doc.notes, null, 2)}\n`)
  }

  // ------------------------------------------------------------------ kernel

  /** The kernel holds one tree at a time: make it this part's current one. */
  private async ensureKernel(doc: Doc, force = false) {
    if (force || this.kernelDoc !== doc || this.kernelTree !== doc.tree) {
      const tree = doc.tree
      doc.report = await this.opts.kernel.rebuild(tree)
      this.kernelDoc = doc
      this.kernelTree = tree
    }
    return doc.report!
  }

  private port(doc: Doc): KernelPort {
    return {
      rebuild: async (t) => {
        this.kernelTree = null
        const r = await this.opts.kernel.rebuild(t)
        this.kernelDoc = doc
        this.kernelTree = t
        return r
      },
      inspect: (what, selector) => this.opts.kernel.inspect(what, selector),
    }
  }

  /** The window's own kernel calls: drawing, clicking, measuring, exporting the part it shows. */
  kernelCall(path: string, call: KernelCall): Promise<unknown> {
    return this.exclusive(async () => {
      const doc = this.docs.get(path)
      if (!doc) throw new Error("这个零件已经关闭了")
      await this.ensureKernel(doc)
      const k = this.opts.kernel
      switch (call.op) {
        case "display":
          return k.display(call.index)
        case "pick":
          return k.pick(call.kind, call.hash, call.point)
        case "locate":
          return k.locate(call.kind, call.selector)
        case "measure":
          return k.measure(call.targets)
        case "export":
          return k.exportBody(call.format, call.index)
      }
    })
  }

  private async one(t: Target): Promise<MeasureTarget> {
    const kind = t.face ? "face" : "edge"
    const selector = t.face ?? t.edge
    if (!selector) throw new InputError("要写 face 或 edge 选择器")
    const hashes = await this.opts.kernel.locate(kind, selector)
    if (!hashes?.length) throw new InputError(`选择器什么都没选中：${JSON.stringify(selector)}`)
    if (hashes.length > 1) throw new InputError(`选择器选中了 ${hashes.length} 个，要正好一个（加 near 或更多条件）：${JSON.stringify(selector)}`)
    return { kind, hash: hashes[0], point: [0, 0, 0] }
  }

  // ----------------------------------------------------------- observation

  private async stateText(doc: Doc) {
    const report = await this.ensureKernel(doc)
    const open = doc.notes.notes.filter((n) => n.status === "open")
    const lines = [`零件：${doc.path}（第 ${doc.rev} 版）`]
    if (doc.error) lines.push(`⚠ ${doc.error}`)
    lines.push(treeText(doc.tree, report))
    lines.push(open.length ? `未处理的备注 ${open.length} 条：${open.map((n) => `${n.id}「${clip(n.text)}」`).join("、")}（get_notes 看详情）` : "没有未处理的备注。")
    if (doc.changes.length) {
      const who = { agent: "你", user: "用户", file: "文件" } as const
      lines.push(`最近的改动：\n${doc.changes.slice(0, 6).map((c) => `- 第 ${c.rev} 版 · ${who[c.actor]}：${c.summary}`).join("\n")}`)
    }
    return lines.join("\n")
  }

  private async look(doc: Doc, input: Record<string, unknown>): Promise<CommandResult> {
    const screen = this.opts.screen?.()
    if (!screen) return fail("看图要在 Arbor 窗口里渲染：先打开 Arbor App（命令行 arbor open <零件>），再调用 look。其余命令不需要窗口。")
    await this.ensureKernel(doc)
    const at = input.at as string | undefined
    const index = at ? doc.tree.features.findIndex((f) => f.id === at) : -1
    if (at && index < 0) return fail(`找不到特征「${at}」`)
    const display = await this.opts.kernel.display(index >= 0 ? index : undefined)
    if (!display.mesh) return fail("还没有实体可以看。")
    const views = (input.views as string[] | undefined)?.length ? (input.views as string[]) : ["iso", "front", "top", "right"]
    const pins = input.notes === false ? [] : doc.notes.notes.filter((n) => n.status === "open").map((n) => ({ n: n.n, point: n.point }))
    const images = await screen.look({ display, views, highlight: input.highlight as string | undefined, pins })
    const step = at ? `（回滚到「${displayName(doc.tree, doc.tree.features[index])}」这一步）` : ""
    const legend = input.highlight ? "蓝色 = 高亮的特征，灰色 = 其余" : "蓝色 = 最后一步新生成的面，橙色 = 被它修改的面"
    return { ok: true, text: `视图：${views.join("、")}${step}。${legend}${pins.length ? "；圆圈数字 = 备注编号" : ""}。`, images }
  }

  private async show(doc: Doc, input: Record<string, unknown>): Promise<CommandResult> {
    if (this.active !== doc.path) {
      this.active = doc.path
      this.emitDoc(doc)
    }
    if (input.clear) {
      this.emit({ type: "show", request: { path: doc.path, clear: true } })
      return { ok: true, text: "已取消高亮。" }
    }
    const label = input.label as string | undefined
    if (input.feature) {
      const f = doc.tree.features.find((x) => x.id === input.feature)
      if (!f) return fail(`找不到特征「${input.feature}」`)
      this.emit({ type: "show", request: { path: doc.path, feature: f.id, label: label ?? displayName(doc.tree, f) } })
      return { ok: true, text: `已在窗口里高亮「${displayName(doc.tree, f)}」。` }
    }
    const kind = input.faces ? "face" : input.edges ? "edge" : null
    if (!kind) return fail("写 feature、faces 或 edges 之一。")
    await this.ensureKernel(doc)
    const hashes = await this.opts.kernel.locate(kind, input.faces ?? input.edges)
    if (!hashes?.length) return fail("选择器什么都没选中。")
    this.emit({ type: "show", request: { path: doc.path, kind, hashes, label } })
    return { ok: true, text: `已在窗口里高亮 ${hashes.length} ${kind === "face" ? "个面" : "条边"}。` }
  }

  private async exportPart(doc: Doc, input: { path: string; format?: "step" | "stl" | "py" | "json" }, ctx: CallContext): Promise<CommandResult> {
    let path = input.path.trim()
    if (!/^([A-Za-z]:)?[\\/]/.test(path) && ctx.cwd) path = `${ctx.cwd.replace(/[\\/]+$/, "")}/${path}`
    const ext = path.split(".").pop()?.toLowerCase()
    const format = input.format ?? (ext === "stp" ? "step" : ext)
    if (format !== "step" && format !== "stl" && format !== "py" && format !== "json") return fail("不知道导出成什么：扩展名用 .step / .stl / .py / .json，或者写 format。")
    let data: string | Uint8Array | null
    if (format === "py") data = toBuild123d(doc.tree, { title: doc.name })
    else if (format === "json") data = `${JSON.stringify(doc.tree, null, 2)}\n`
    else {
      await this.ensureKernel(doc)
      data = await this.opts.kernel.exportBody(format)
    }
    if (!data) return fail("还没有实体可以导出。")
    await this.opts.files.write(path, data)
    const bytes = typeof data === "string" ? new TextEncoder().encode(data).length : data.byteLength
    const failed = format === "step" || format === "stl" ? doc.report?.features.filter((f) => f.state === "error").length : 0
    return { ok: true, text: `已导出 ${format.toUpperCase()} 到 ${path}（${(bytes / 1024).toFixed(1)} KB）${failed ? `。注意：有 ${failed} 个特征失败，导出的是最后一个成功的步骤` : ""}` }
  }

  // ------------------------------------------------------------------ picks

  private async requestPick(input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    if (!this.opts.screen?.()) return fail("要请用户在 Arbor 窗口里点选：先打开 Arbor App。")
    const doc = await this.exclusive(() => this.resolveDoc(ctx))
    if (!doc) return fail("还没有打开零件：先用 open_part。")
    const prompt = String(input.prompt)
    if (this.late && this.late.path === doc.path && this.late.prompt === prompt) {
      const { answer } = this.late
      this.late = null
      return pickResult(answer)
    }
    if (this.active !== doc.path) {
      this.active = doc.path
      this.emitDoc(doc)
    }
    let p = this.pending
    if (!p || p.request.path !== doc.path || p.request.prompt !== prompt) {
      if (p) this.settlePick(null)
      p = this.pending = { request: { id: `pick-${Date.now().toString(36)}`, path: doc.path, prompt, kind: (input.kind as PickRequest["kind"]) ?? "any" }, waiters: [] }
      this.emit({ type: "pick", request: p.request })
    }
    const req = p
    const answer = await new Promise<PickAnswer | null | "timeout">((resolve) => {
      const waiter = (a: PickAnswer | null) => {
        clearTimeout(timer)
        resolve(a)
      }
      const timer = setTimeout(() => {
        req.waiters = req.waiters.filter((w) => w !== waiter)
        resolve("timeout")
      }, ((input.timeout_sec as number | undefined) ?? 120) * 1000)
      req.waiters.push(waiter)
    })
    if (answer === "timeout") return { ok: false, text: "用户还没点。请求还显示在窗口里：可以用同一句 prompt 再调用 request_pick 接着等，或者先做别的。" }
    if (!answer) return { ok: false, text: "用户取消了点选。" }
    return pickResult(answer)
  }

  /** The person clicked (or cancelled) in the window. */
  answerPick(id: string, answer: PickAnswer | null) {
    const p = this.pending
    if (!p || p.request.id !== id) return
    if (answer && !p.waiters.length) this.late = { path: p.request.path, prompt: p.request.prompt, answer }
    this.settlePick(answer)
  }

  private settlePick(answer: PickAnswer | null) {
    const p = this.pending
    if (!p) return
    this.pending = null
    for (const w of p.waiters) w(answer)
    this.emit({ type: "pick", request: null })
  }

  // ----------------------------------------------------------------- agent

  /** What changed under the agent since its last call: told first, so it doesn't undo the person's edits. */
  private noticeFor(doc: Doc, skipNewNotes = false) {
    const theirs = doc.changes.filter((c) => c.actor !== "agent" && (c.seq ?? 0) > doc.agentSeq).reverse()
    const tree = theirs.filter((c) => !c.note)
    // New notes get their own line below; what happened to existing ones (handled, removed) goes here.
    const notes = theirs.filter((c) => c.note === "changed")
    const fresh = skipNewNotes ? [] : doc.notes.notes.filter((n) => n.status === "open" && n.n > doc.agentNoteN)
    const lines: string[] = []
    if (tree.length) {
      lines.push(`⚠ 自你上次调用以来，模型被改过（以现在的状态为准，不要改回去）：`)
      for (const c of tree.slice(-8)) lines.push(`- ${c.actor === "user" ? "用户在窗口里" : "文件被直接修改"}：${c.summary}`)
      lines.push(`现在是第 ${doc.rev} 版。`)
    }
    if (notes.length) lines.push(`备注有变化：${notes.slice(-6).map((c) => `用户${c.summary}`).join("；")}。`)
    if (fresh.length) lines.push(`◆ 用户在窗口里留了 ${fresh.length} 条新备注：${fresh.map((n) => `${n.id}「${clip(n.text)}」`).join("、")}。用 get_notes 读详情。`)
    return lines.join("\n")
  }

  /** The agent has seen the part as it is now. */
  private markSeen(doc: Doc) {
    doc.agentSeq = doc.seq
    doc.agentNoteN = Math.max(doc.agentNoteN, ...doc.notes.notes.map((n) => n.n))
  }

  dispose() {
    for (const d of this.docs.values()) d.unwatch()
    this.settlePick(null)
  }
}

function pickResult(answer: PickAnswer): CommandResult {
  const lines = ["用户在窗口里点了：", ...pickLines({ ...answer.info, point: answer.info.point as V3 })]
  if (answer.text?.trim()) lines.push(`- 用户补充：${answer.text.trim()}`)
  return { ok: true, text: lines.join("\n") }
}

export function measureText(res: MeasureResult) {
  const items = res.items.map((i, k) => `${res.items.length > 1 ? (k ? "B" : "A") + "：" : ""}${i.kind === "face" ? "面" : "边"} · ${i.what} · ${i.facts.join("，")}`)
  const between = res.between.map((b) => `${b.name}：${b.value}`)
  return [...items, ...between].join("\n")
}
