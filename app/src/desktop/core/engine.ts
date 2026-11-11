// The Turnery engine: open parts (feature-tree files), one OpenCascade kernel,
// undo, the person's notes, and every command the agent or the window runs.
// Platform-neutral: the kernel, the file system and the window come in as
// ports, so the same engine runs in Electron's main process and in the CLI.
import type { PickInfo } from "../../studio/annotations"
import { executeTool, moveFeature, treeText, type KernelPort } from "../../studio/apply"
import { applyLook, changeText, colorName, colorWord, isSet, lookText, mergeLook, ownLook, sameGeometry, setPartLook, SOURCE_DEFAULT, type Appearance, type Finish, type Look, type LookChange } from "../../studio/appearance"
import { toBuild123d } from "../../studio/codegen"
import { EMPTY_TREE, Feature, Tree, componentName, displayName } from "../../studio/dsl"
import { designation } from "../../studio/fasteners"
import type { BuildReport, BuildProgress, ComponentSource, ContextSource, DisplayData } from "../../studio/kernel/build"
import { num as evalNum } from "../../studio/expr"
import {
  FOCUS_PADDING,
  LOOK_PADDING,
  LOOK_SIZE,
  VIEW_DIR,
  VIEW_LABEL,
  autoFocus,
  boxOfGroups,
  facingOf,
  padFlat,
  mmPerPixel,
  modelBox,
  scaleText,
  sizeText,
  type Box,
  type LookSection,
  type LookShot,
} from "../../studio/look-plan"
import type { Dim } from "../../studio/kernel/dims"
import type { DrawingData } from "../../studio/kernel/drawing"
import { InputError } from "../../studio/kernel/errors"
import type { MeasureResult, MeasureSpec } from "../../studio/kernel/measure"
import { STARTERS } from "../../studio/starters"
import { resolveParams } from "../../studio/expr"
import { ASM_EXT, asmExtOf, besides, effectiveTree, gather, isAssembly, loadShared, shadowed, sharedText, type Shared } from "./sources"
import { baseName, canBeRoot, dirName, inside, isAssemblyFile, partFileName, projectSkeleton, relativePath, rootFor, scanProject, stripEnding, type Scan, type ScanCache } from "./project"
import { DESKTOP_TOOLS, STUDIO_TOOLS } from "../../studio/tools"
import { AGENT_GUIDE, COMMAND } from "./catalog"
import { newNote, notesText, parseNotes, pickLines, pinned, type NotesFile } from "./notes"
import { badFileName, badPartName, componentById, renameInAssembly, renameInNotes } from "./rename"
import {
  NOTES_EXT,
  PART_EXT,
  partExtOf,
  type Actor,
  type AgentActivity,
  type CallContext,
  type Change,
  type CommandResult,
  type DocState,
  type EngineEvent,
  type KernelCall,
  type KernelPhase,
  type LookRequest,
  type LoadState,
  type NoteAbout,
  type PartSummary,
  type PickRequest,
  type ProjectFile,
  type ProjectSummary,
  type Snapshot,
} from "./protocol"
import { describeTreeChange } from "./tree-diff"

type V3 = [number, number, number]
/** One face or one edge, by selector (measure). */
type Target = { face?: Record<string, unknown>; edge?: Record<string, unknown>; feature?: string; part?: string }

export interface KernelHost {
  readonly phase: KernelPhase
  readonly progress?: BuildProgress | null
  rebuild(tree: Tree, options?: { background?: boolean; interferences?: BuildReport["interferences"]; deferChecks?: boolean }): Promise<BuildReport>
  /** Only colours or finishes changed since the last build: take the tree without rebuilding. False: rebuild. */
  restyle?(tree: Tree): Promise<boolean>
  /** Each part of the last body that built and how it looks (one entry for an unsplit body). */
  looks?(): Promise<{ name: string; look: Look; here?: Appearance }[]>
  inspect(what: "body" | "faces" | "edges", selector?: unknown): Promise<string>
  display(index?: number): Promise<DisplayData>
  pick(kind: "face" | "edge", hash: number, point: V3): Promise<PickInfo | null>
  /** `before`: on the body a step starts from (re-picking a feature's faces or edges). */
  locate(kind: "face" | "edge", selector: unknown, before?: number): Promise<number[] | null>
  selectorFor(kind: "face" | "edge", hashes: number[], before: number): Promise<{ selector: Record<string, unknown>; count: number } | null>
  faceEdges(hash: number, before: number): Promise<number[]>
  measure(targets: MeasureSpec[]): Promise<MeasureResult | null>
  dimensions(): Promise<Dim[]>
  drawing(withIso: boolean): Promise<DrawingData | null>
  exportBody(format: "step" | "stl" | "3mf", index?: number): Promise<Uint8Array | null>
  /** Show a source-validated portable mesh before preparing native components. `root`: the project folder that keeps it (its cache). */
  preparePreview?(path: string, tree: Tree, assets: ComponentSource["assets"], components: ComponentSource[], context: ContextSource | null, root?: string | null): Promise<void>
  /** Files `import` features read (absent: this host can't read files). */
  setAssets?(list: { name: string; bytes: Uint8Array | null; error?: string }[]): Promise<void>
  /** What an assembly's components read (absent: this host can't read files). */
  setComponents?(list: ComponentSource[]): Promise<void>
  /** Editing a part inside an assembly: the other parts around it (null: none). */
  setContext?(ctx: ContextSource | null): Promise<void>
  /**
   * Hosts that keep several parts built (one kernel per part): make `slot` current. Resolves true when
   * that kernel starts empty, so files and the tree must be handed over again.
   */
  use?(slot: string): Promise<boolean>
}

export interface Files {
  read(path: string): Promise<string | null>
  write(path: string, data: string | Uint8Array): Promise<void>
  /** Call back when the file changes on disk; returns a function that stops watching. */
  watch(path: string, onChange: () => void): () => void
  /** The path with symlinks resolved (/tmp → /private/tmp), so one file is one part. */
  canonical?(path: string): string
  /** For `import`: the bytes of a file, and its size and modification time (to tell when it changed). */
  readBytes?(path: string): Promise<Uint8Array | null>
  stat?(path: string): Promise<{ size: number; mtimeMs: number } | null>
  /** A folder's entries (null: no such folder). Without it there are no projects, only open files. */
  list?(dir: string): Promise<{ name: string; dir: boolean }[] | null>
  /** Move a file (or folder) to a path that doesn't exist yet. Without it, files can't be renamed. */
  rename?(from: string, to: string): Promise<void>
  /** Two paths are one file or folder on disk (a change of case, on a disk that ignores case). */
  same?(a: string, b: string): Promise<boolean>
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
  /** The person's home folder: never a project (nor anything above it). */
  home?: string
}

/** A file this change rewrote besides the part's own (a component's part file, given a colour from its assembly). */
type FileEdit = { path: string; before: string; after: string }
type Entry = { tree: Tree; summary: string; files?: FileEdit[] }

type Doc = {
  path: string
  name: string
  tree: Tree
  rev: number
  report: BuildReport | null
  preview?: DisplayData
  undo: Entry[]
  redo: Entry[]
  changes: Change[]
  notes: NotesFile
  error?: string
  /** A save found the file changed under it this command: the result says so. */
  conflict?: boolean
  /** The text last written or read: tells our own writes apart from someone else's. */
  written: string | null
  unwatch: () => void
  /** Watchers on the files the part reads (STEP imports, components, shared parameters), by absolute path. */
  assetWatch: Map<string, () => void>
  /** What each watched file held when last looked at (text, or size and time for binary files): a save that changes nothing isn't news. */
  assetSeen: Map<string, string>
  /** The shared parameter file (`uses`), loaded. */
  shared: Shared | null
  /** Editing inside an assembly: the assembly file (absolute), else null. */
  context: string | null
  /** Changes so far (the activity list is capped; this keeps counting). */
  seq: number
  /** What the agent has been told about: changes up to this one, notes up to this number. */
  /** How far each of the two kinds of agent has seen this part: its last change and its newest note. */
  seen: Record<Reader, { seq: number; note: number }>
}

type PickAnswer = { info: PickInfo; text?: string }

const MAX_UNDO = 100
const MAX_CHANGES = 200
const FEATURE_TOOLS = new Set<string>(Feature.options.map((o) => o.shape.op.value))
const STUDIO_TOOL_NAMES = new Set([...Object.keys(STUDIO_TOOLS), ...Object.keys(DESKTOP_TOOLS)].filter((n) => n !== "look" && n !== "set_appearance"))
/** Agent-side commands the window may run too. */
const WINDOW_OK = new Set(["undo", "redo"])

const fail = (text: string): CommandResult => ({ ok: false, text: `✗ ${text}` })
const clip = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n)}…` : s)

export function partName(path: string) {
  const base = path.split(/[\\/]/).pop() ?? path
  const ext = asmExtOf(base) ?? partExtOf(base)
  return ext ? base.slice(0, -ext.length) : base.replace(/\.json$/i, "")
}

/** The folder beside the notes where pictures of framed or drawn areas go: 「盒子.notes」. */
export const notesDir = (path: string) => notesPath(path).replace(/\.json$/i, "")

/** At most this many pictures with get_notes (the newest). */
const MAX_NOTE_IMAGES = 4

const toBase64 = (bytes: Uint8Array) => {
  let s = ""
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

export function notesPath(path: string) {
  // An assembly's notes don't share a name with a part of the same name next to it.
  const asm = asmExtOf(path)
  if (asm) return path.slice(0, -asm.length) + ".asm" + NOTES_EXT
  const part = partExtOf(path)
  return part ? path.slice(0, -part.length) + NOTES_EXT : path.replace(/\.json$/i, "") + NOTES_EXT
}

/**
 * A part path as given by a caller: made absolute against its directory, `.` and repeated
 * separators dropped, `.turnery.json` added when there's no `.json`. `..` stays: after a symlinked
 * folder it means the link target's parent, so only the file system (`Files.canonical`) resolves it.
 */
export function normalizePartPath(path: string, cwd?: string) {
  let p = path.trim().replace(/\\/g, "/")
  if (!/^([A-Za-z]:)?\//.test(p) && cwd) p = `${cwd.replace(/\\/g, "/").replace(/\/+$/, "")}/${p}`
  const drive = /^[A-Za-z]:/.exec(p)?.[0] ?? ""
  const parts = p
    .slice(drive.length)
    .split("/")
    .filter((seg) => seg && seg !== ".")
  p = `${drive}/${parts.join("/")}`
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

/** The two kinds of agent that are told what changed since their last call; each keeps its own place. */
type Reader = "agent" | "assistant"
const readerOf = (actor: Actor): Reader | null => (actor === "agent" || actor === "assistant" ? actor : null)
/** How a change by someone else is introduced to an agent. */
const BY: Record<Actor, string> = { user: "用户在窗口里", file: "文件被直接修改", agent: "另一个 agent（通过 MCP）", assistant: "窗口里的内置助手" }
const WHO: Record<Actor, string> = { user: "用户", file: "文件", agent: "另一个 agent ", assistant: "内置助手" }

export class Engine {
  private loading: LoadState | null = null
  private docs = new Map<string, Doc>()
  private active: string | null = null
  private sessions = new Map<string, string>()
  private listeners = new Set<(e: EngineEvent) => void>()
  private chain: Promise<unknown> = Promise.resolve()
  /** After dispose: changes on disk are no longer followed (the CLI exits as soon as its command is done). */
  private disposed = false
  /** The tree each part's kernel last built (absent: it must build again). */
  private built = new Map<string, Tree>()
  /** The part whose kernel the next kernel calls go to. */
  private slot: string | null = null
  /** Which part's files (and versions) the kernel holds for `import`. */
  /** Per part: what its kernel was last handed (files, components, context), to skip handing it again. */
  private assetsKeys = new Map<string, string>()
  /** Shared parameter files written by this engine, as written (their watchers then see no change). */
  /** What the engine itself last wrote to a path, and for whom: a watcher seeing it again is that change, not someone else's. */
  private wrote = new Map<string, { text: string; actor: CallContext["actor"] }>()
  private agent: AgentActivity = { busy: false, tool: null, at: null }
  private pending: { request: PickRequest; waiters: ((a: PickAnswer | null) => void)[] } | null = null
  /** A pick the person answered after the agent stopped waiting: handed over on the next identical request. */
  private late: { path: string; prompt: string; answer: PickAnswer } | null = null
  private recent: string[]
  private opts: EngineOptions
  /** The project folder and what's in it (see project.ts). */
  private project: Scan | null = null
  private scanCache: ScanCache = new Map()

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

  kernelDiagnostics(path: string, report: BuildReport) {
    const doc = this.docs.get(path)
    if (!doc) return
    // The checks ran the whole build again on the side: the time to show is still the time the model took.
    doc.report = doc.report && !doc.report.paramError ? { ...report, ms: doc.report.ms } : report
    this.emitDoc(doc)
  }

  /** Stable geometry arrives before exact checks finish in the kernel worker. */
  kernelPreview(display: DisplayData) {
    const doc = this.docs.get(this.loading?.path ?? "")
    if (!doc) return
    doc.preview = display
    this.emitDoc(doc)
  }

  // ------------------------------------------------------------------- state

  snapshot(): Snapshot {
    const parts: PartSummary[] = [...this.docs.values()].map((d) => ({
      path: d.path,
      name: d.name,
      features: d.tree.features.length,
      openNotes: d.notes.notes.filter((n) => n.status === "open").length,
      error: d.error,
      kind: isAssembly(d.path) ? ("assembly" as const) : ("part" as const),
    }))
    return { parts, active: this.active, kernel: this.opts.kernel.phase, agent: { ...this.agent }, project: this.projectSummary(), loading: this.loading ? { ...this.loading, progress: this.opts.kernel.progress } : null }
  }

  private projectSummary(): ProjectSummary | null {
    const p = this.project
    if (!p) return null
    return {
      root: p.root,
      name: baseName(p.root),
      truncated: p.truncated,
      files: p.entries.map((e) => {
        const doc = this.docs.get(e.path)
        return {
          ...e,
          features: doc ? doc.tree.features.length : e.features,
          open: Boolean(doc),
          openNotes: doc ? doc.notes.notes.filter((n) => n.status === "open").length : 0,
        }
      }),
    }
  }

  docState(path?: string | null): DocState | null {
    const doc = this.docs.get(path ?? this.active ?? "")
    return doc ? this.state(doc) : null
  }

  /** The project folder, if any: the app sends an agent's calls about files in it to this engine. */
  get projectRoot() {
    return this.project?.root ?? null
  }

  /** This engine has the file open, or it lies in its project. */
  owns(path: string) {
    const p = this.partKey(path)
    return this.docs.has(p) || Boolean(this.project && inside(this.project.root, p))
  }

  /** Nothing open: a window on the start page, free to take a project. */
  get empty() {
    return !this.project && this.docs.size === 0 && !this.loading
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
      tree: this.windowTree(doc),
      kind: isAssembly(doc.path) ? "assembly" : "part",
      shared: doc.tree.uses ? { file: doc.tree.uses, names: Object.keys(doc.shared?.params ?? {}), error: doc.shared?.error } : undefined,
      context: doc.context ? { assembly: doc.context, name: partName(doc.context) } : undefined,
      rev: doc.rev,
      report: doc.report,
      preview: doc.preview,
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
    const who = readerOf(ctx.actor)
    if (!who) return fn()
    this.agent = { busy: true, tool: name, at: Date.now(), who }
    this.emitSnapshot()
    try {
      return await fn()
    } finally {
      this.agent = { busy: false, tool: name, at: Date.now(), who }
      this.emitSnapshot()
    }
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.chain.then(fn)
    this.chain = job.catch(() => undefined)
    return job
  }

  /**
   * A file changed on disk: follow it in turn with the commands, unless the engine was disposed
   * meanwhile (a write of our own can be reported just after). Nobody waits for the result, so a
   * failure (the kernel closed or crashed) is dropped; the next command reports the state.
   */
  private onDisk(fn: () => Promise<void>) {
    if (this.disposed) return
    this.exclusive(() => (this.disposed ? Promise.resolve() : fn())).catch(() => {})
  }

  private async runLocked(name: string, input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    try {
      if (name === "open_part") return await this.openPart(input as { path: string; create?: boolean; template?: string; context?: string }, ctx)
      if (name === "list_parts") return await this.listParts()
      if (name === "open_project") return await this.openProject(input as { path: string; create?: boolean }, ctx)
      if (name === "scan_project") return await this.rescan()
      if (name === "add_part") return await this.addPart(input as Parameters<Engine["addPart"]>[0], ctx)
      if (name === "close_part") return this.closePart(this.partKey(String(input.path)))
      if (name === "close_project") return this.closeProject()
      if (name === "rename_file") return await this.renameFile(input as { path: string; name: string }, ctx)
      const doc = await this.resolveDoc(ctx)
      if (!doc) return fail("还没有打开零件：先用 open_part（path 写零件文件，新零件加 create: true）。")
      // Catch up with the file first: an editor may have saved it a moment ago (the watcher is debounced).
      await this.fileChanged(doc)
      // get_notes lists the new notes itself.
      const reader = readerOf(ctx.actor)
      const notice = reader ? this.noticeFor(doc, reader, name === "get_notes") : ""
      let res = await this.onDoc(doc, name, input, ctx)
      if (doc.conflict) {
        doc.conflict = false
        res = { ok: false, text: `${res.text}\n\n⚠ 这次修改期间，文件被别人保存过：已经以文件里的版本为准，刚才的改动没有写进文件（undo 可以找回）。` }
      }
      if (reader) this.markSeen(doc, reader)
      return notice ? { ...res, text: `${notice}\n\n${res.text}` } : res
    } catch (e) {
      if (e instanceof InputError) return fail(e.message)
      return fail(`出错了：${(e as Error)?.message ?? e}`)
    }
  }

  private async onDoc(doc: Doc, name: string, input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    if (name === "set_params" && (doc.tree.uses || input.shared)) return this.setParams(doc, input, ctx)
    if (name === "share_params") return this.shareParams(doc, input as { file?: string; create?: boolean; move?: string[]; stop?: boolean }, ctx)
    if (FEATURE_TOOLS.has(name)) {
      const asm = isAssembly(doc.path)
      if (name === "component" && !asm) return fail(`零件文件里不能放 component。新建一个装配文件（open_part，路径以 ${ASM_EXT} 结尾，create: true），在那里放零件`)
      if (asm && name !== "component") return fail("装配里只能放零件（component）。要改零件的形状，用 open_part 打开它的文件（加 context 写这个装配文件，就能看着其他零件改）")
    }
    if (STUDIO_TOOL_NAMES.has(name)) {
      await this.ensureKernel(doc)
      // With shared parameters merged in, so expressions that use them check out; saved without them.
      const before = this.effective(doc, doc.tree)
      const run = await executeTool(this.port(doc, name !== "check"), before, name, input)
      if (run.tree !== before) await this.adopt(doc, this.unshare(doc, run.tree), ctx.actor, { report: run.report })
      else if (run.report) doc.report = run.report
      return { ok: run.output.ok, text: run.output.text }
    }
    switch (name) {
      case "get_state":
        return { ok: true, text: await this.stateText(doc, readerOf(ctx.actor)) }
      case "set_tree": {
        const base = input.base_rev as number | undefined
        if (base !== undefined && base !== doc.rev) return fail(`模型已经是第 ${doc.rev} 版了（你基于第 ${base} 版）：先用 get_state 看最新的，再改。`)
        await this.adopt(doc, await this.stripShared(doc, input.tree as Tree, ctx), ctx.actor)
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
      case "set_appearance":
        return this.setAppearance(doc, input as Parameters<Engine["setAppearance"]>[1], ctx)
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
      case "export":
        return this.exportPart(doc, input as { path: string; format?: "step" | "stl" | "3mf" | "py" | "json" | "bom" }, ctx)
      case "get_notes": {
        const who = readerOf(ctx.actor)
        if (who) doc.seen[who].note = Math.max(doc.seen[who].note, ...doc.notes.notes.map((n) => n.n))
        const all = input.status === "all"
        const list = doc.notes.notes.map((n) => (n.region?.image ? { ...n, region: { ...n.region, image: this.noteImagePath(doc, n.region.image) } } : n))
        // The pictures of areas framed or drawn on (open ones), so the agent sees what was marked.
        const shown = list.filter((n) => n.region?.image && (all || n.status === "open")).slice(-MAX_NOTE_IMAGES)
        const images = (await Promise.all(shown.map((n) => this.dataUrl(n.region!.image!)))).filter((x): x is string => !!x)
        const own = notesText(list, all, isAssembly(doc.path) ? "装配" : "零件")
        const text = [own, await this.contextNotes(doc, all), images.length ? `附了 ${images.length} 张框选或画笔标注时的画面（按备注顺序）。` : ""].filter(Boolean).join("\n\n")
        return { ok: true, text, ...(images.length ? { images } : {}) }
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
      case "rename_part":
        return this.renamePart(doc, input as { id: string; name: string }, ctx)
      case "add_note": {
        const about = { parts: input.parts, feature: input.feature, name: input.name, point: input.point, part: input.part, region: input.region } as NoteAbout
        const image = about.region?.image ? await this.saveNoteImage(doc, doc.notes.next, about.region.image) : undefined
        const note = newNote(doc.notes, (input.pick as unknown as PickInfo | undefined) ?? null, String(input.text ?? ""), about, image)
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
          if (typeof input.text === "string" && input.text.trim() !== note.text) {
            note.text = input.text.trim()
            this.logNote(doc, ctx.actor, `改了备注 ${note.id}：「${clip(note.text) || "（没写字）"}」`)
          }
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

  // ------------------------------------------------------- shared params

  /**
   * set_params on a part with a shared parameter file: names the file holds (or all, with shared: true)
   * are written there and every open part using it rebuilds; the rest go to the part's own table.
   */
  private async setParams(doc: Doc, input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    const set = (input.set as Record<string, number | string> | undefined) ?? {}
    const remove = (input.remove as string[] | undefined) ?? []
    const notes = (input.notes as Record<string, string> | undefined) ?? {}
    const toShared = input.shared === true
    const sh = doc.shared
    if (toShared && !sh) return fail("这个零件还没有共享参数文件：先用 share_params 指定一个（例如 pen.params.json）")
    if (sh?.error) return fail(sh.error)
    const inShared = (k: string) => toShared || (!!sh && k in sh.params)
    const pick = <T,>(o: Record<string, T>, keep: boolean) => Object.fromEntries(Object.entries(o).filter(([k]) => inShared(k) === keep))
    const sharedSet = pick(set, true)
    const sharedRemove = remove.filter((k) => !!sh && k in sh.params)
    const sharedNotes = pick(notes, true)
    const lines: string[] = []
    if (sh && (Object.keys(sharedSet).length || sharedRemove.length || Object.keys(sharedNotes).length)) {
      const apply = (cur: { params: Shared["params"]; notes: Record<string, string> }) => {
        const params = { ...cur.params, ...sharedSet }
        const pnotes = { ...cur.notes, ...sharedNotes }
        for (const k of sharedRemove) {
          delete params[k]
          delete pnotes[k]
        }
        return { params, notes: pnotes }
      }
      try {
        resolveParams({ ...doc.tree.params, ...apply({ params: sh.params, notes: sh.notes }).params })
      } catch (e) {
        return fail(`参数不对：${(e as Error).message}`)
      }
      const users = await this.writeShared(sh, apply, ctx)
      const what = [...Object.entries(sharedSet).map(([k, v]) => `${k} = ${v}`), ...sharedRemove.map((k) => `删除 ${k}`)].join("，") || "参数说明"
      lines.push(`共享参数（${sh.file}）：${what}。${users.length > 1 ? `用到它的 ${users.map((d) => d.name).join("、")} 都已重建。` : ""}`)
    }
    const own = { set: pick(set, false), remove: remove.filter((k) => !sharedRemove.includes(k)), notes: pick(notes, false) }
    if (Object.keys(own.set).length || own.remove.length || Object.keys(own.notes).length) {
      // Checked against the merged table (own parameters may use shared ones), saved without the shared ones.
      const eff = this.effective(doc, doc.tree)
      const run = await executeTool(this.port(doc), eff, "set_params", own)
      if (run.tree !== eff) await this.adopt(doc, this.unshare(doc, run.tree), ctx.actor, { report: run.report })
      lines.push(run.output.text)
    } else lines.push(treeText(doc.tree, doc.report!))
    const shadow = shadowed(doc.tree, doc.shared)
    if (shadow.length) lines.push(`⚠ 参数 ${shadow.join("、")} 在共享参数文件里也有，以共享的为准`)
    return { ok: this.allOk(doc), text: lines.join("\n") }
  }

  /**
   * Change a shared parameter file and rebuild every open part that uses it. The change applies to the
   * file as it is on disk now (someone may have edited it since it was loaded). Returns those parts.
   */
  private async writeShared(sh: Shared, change: (cur: { params: Shared["params"]; notes: Record<string, string> }) => { params: Shared["params"]; notes: Record<string, string> }, ctx: CallContext) {
    const latest = await loadShared(this.opts.files, sh.path, sh.path.split(/[\\/]/).pop()!)
    if (latest.error && latest.text !== null) throw new InputError(latest.error)
    const { params, notes } = change(latest.text === null ? { params: {}, notes: {} } : { params: latest.params, notes: latest.notes })
    // Checked as it will be written: the file on disk may differ from what was checked before.
    try {
      resolveParams(params)
    } catch (e) {
      throw new InputError(`共享参数不对，没有写入 ${sh.file}：${(e as Error).message}`)
    }
    const text = sharedText({ params, notes })
    this.wrote.set(sh.path, { text, actor: ctx.actor })
    await this.opts.files.write(sh.path, text)
    const users = [...this.docs.values()].filter((d) => d.shared?.path === sh.path || d.context)
    for (const d of users) {
      if (d.shared?.path === sh.path) await this.refreshShared(d)
      d.rev += 1
      d.changes = [{ rev: d.rev, actor: ctx.actor, at: Date.now(), summary: `改了共享参数 ${sh.file}`, seq: ++d.seq }, ...d.changes].slice(0, MAX_CHANGES)
      this.built.delete(d.path)
    }
    this.assetsKeys.clear()
    const active = users.find((d) => d.path === this.active) ?? users[0]
    if (active) {
      await this.ensureKernel(active, true)
      this.emitDoc(active)
    }
    return users.filter((d) => d.shared?.path === sh.path)
  }

  /** Start using a shared parameter file (creating it, moving some of the part's own parameters into it), or stop. */
  private async shareParams(doc: Doc, input: { file?: string; create?: boolean; move?: string[]; stop?: boolean }, ctx: CallContext): Promise<CommandResult> {
    if (input.stop) {
      if (!doc.tree.uses) return { ok: true, text: "这个零件本来就没有用共享参数文件。" }
      const { uses: _drop, ...rest } = doc.tree
      void _drop
      // The values in use: the shared ones won, so they stay.
      const kept = { ...doc.tree.params, ...(doc.shared?.params ?? {}) }
      const keptNotes = { ...(doc.tree.paramNotes ?? {}), ...(doc.shared?.notes ?? {}) }
      await this.adopt(doc, { ...rest, params: kept, paramNotes: Object.keys(keptNotes).length ? keptNotes : undefined }, ctx.actor, { summary: `不再用共享参数文件 ${doc.tree.uses}（参数抄回零件里）` })
      return { ok: this.allOk(doc), text: `已停用共享参数文件，共享参数的当前值抄回了零件自己的参数表。\n${treeText(doc.tree, doc.report!)}` }
    }
    const file = input.file?.trim()
    if (!file) return fail("file 写共享参数文件的路径，相对零件文件所在的文件夹，例如 pen.params.json")
    const abs = besides(doc.path, file)
    let sh = await loadShared(this.opts.files, doc.path, file)
    if (sh.text === null) {
      if (!input.create) return fail(`没有 ${abs}。要新建就设 create: true`)
      await this.opts.files.write(abs, sharedText({ params: {}, notes: {} }))
      sh = await loadShared(this.opts.files, doc.path, file)
    }
    if (sh.error) return fail(sh.error)
    const move = input.move ?? []
    const missing = move.filter((k) => !(k in doc.tree.params))
    if (missing.length) return fail(`零件里没有参数 ${missing.join("、")}`)
    let tree: Tree = { ...doc.tree, uses: file }
    if (move.length) {
      const params = { ...sh.params, ...Object.fromEntries(move.map((k) => [k, doc.tree.params[k]])) }
      const notes = { ...sh.notes, ...Object.fromEntries(move.flatMap((k) => (doc.tree.paramNotes?.[k] ? [[k, doc.tree.paramNotes[k]]] : []))) }
      const own = Object.fromEntries(Object.entries(doc.tree.params).filter(([k]) => !move.includes(k)))
      const ownNotes = Object.fromEntries(Object.entries(doc.tree.paramNotes ?? {}).filter(([k]) => !move.includes(k)))
      tree = { ...tree, params: own, paramNotes: Object.keys(ownNotes).length ? ownNotes : undefined }
      await this.writeShared(sh, (cur) => ({ params: { ...cur.params, ...Object.fromEntries(move.map((k) => [k, params[k]])) }, notes: { ...cur.notes, ...Object.fromEntries(Object.entries(notes).filter(([k]) => move.includes(k))) } }), ctx)
    }
    await this.adopt(doc, tree, ctx.actor, { summary: `用共享参数文件 ${file}${move.length ? `，移进去 ${move.join("、")}` : ""}` })
    const shadow = shadowed(doc.tree, doc.shared)
    return {
      ok: this.allOk(doc),
      text: `已用共享参数文件 ${file}（${Object.keys(doc.shared?.params ?? {}).length} 个参数）。别的零件和装配写同一个 uses（share_params）就共用这些尺寸；改它们用 set_params，会写回这个文件。${shadow.length ? `\n⚠ 参数 ${shadow.join("、")} 在共享参数文件里也有，以共享的为准` : ""}\n${treeText(doc.tree, doc.report!)}`,
    }
  }

  /** A whole tree from the window (it shows shared parameters in the table): those go back to the shared file. */
  private async stripShared(doc: Doc, tree: Tree, ctx: CallContext): Promise<Tree> {
    const sh = doc.shared
    if (!sh || sh.error || !tree.uses || tree.uses !== doc.tree.uses) return tree
    const params = { ...tree.params }
    const notes = { ...(tree.paramNotes ?? {}) }
    const changed: Record<string, number | string> = {}
    for (const k of Object.keys(sh.params)) {
      if (!(k in params)) continue
      if (params[k] !== sh.params[k]) changed[k] = params[k]
      delete params[k]
      delete notes[k]
    }
    if (Object.keys(changed).length) await this.writeShared(sh, (cur) => ({ params: { ...cur.params, ...changed }, notes: cur.notes }), ctx)
    return { ...tree, params, paramNotes: Object.keys(notes).length ? notes : undefined }
  }

  /** A tree worked on with the shared parameters merged in, back to the part's own: shared ones out (unless it had its own). */
  private unshare(doc: Doc, tree: Tree): Tree {
    const sh = doc.shared
    if (!sh || sh.error) return tree
    const ownParams = doc.tree.params
    const ownNotes = doc.tree.paramNotes ?? {}
    // Shared names go; an own parameter they shadowed comes back as it was (the merge overwrote it).
    const params = Object.fromEntries(
      Object.entries(tree.params).flatMap(([k, v]) => (k in sh.params ? (k in ownParams ? [[k, ownParams[k]]] : []) : [[k, v]])),
    )
    const notes = Object.fromEntries(
      Object.entries(tree.paramNotes ?? {}).flatMap(([k, v]) => (k in sh.params || k in sh.notes ? (k in ownNotes ? [[k, ownNotes[k]]] : []) : [[k, v]])),
    )
    return { ...tree, params, paramNotes: Object.keys(notes).length ? notes : undefined }
  }

  // ------------------------------------------------------------------ parts

  private async openPart(input: { path: string; create?: boolean; template?: string; context?: string }, ctx: CallContext): Promise<CommandResult> {
    const path = this.partKey(input.path, ctx.cwd)
    const previous = this.active
    this.active = path
    this.loading = { path, name: partName(path), startedAt: Date.now() }
    this.emitSnapshot()
    try {
      const result = await this.finishOpenPart(input, ctx, path)
      if (!result.ok) this.active = previous
      return result
    } catch (e) {
      this.active = previous
      throw e
    } finally {
      this.loading = null
      const doc = this.docs.get(this.active ?? "")
      if (doc) this.emitDoc(doc)
      else this.emitSnapshot()
    }
  }

  private async finishOpenPart(input: { path: string; create?: boolean; template?: string; context?: string }, ctx: CallContext, path: string): Promise<CommandResult> {
    const existed = this.docs.has(path) || (await this.opts.files.read(path)) !== null
    const doc = await this.load(path, { create: input.create, template: isAssembly(path) ? undefined : input.template })
    // In an assembly (or out of one): the other parts come along as see-through references.
    const context = input.context ? this.partKey(input.context, ctx.cwd) : null
    let contextNote = ""
    if (context !== doc.context) {
      if (context) {
        if (isAssembly(path)) return fail("context 用来在装配里改一个零件；打开的是装配本身，不用写 context")
        const before = doc.context
        doc.context = context
        const found = await this.contextOf(doc, false)
        if (!found) {
          doc.context = before
          return fail(`${input.context} 里没有用到这个零件（要有一个 component 的 file 指向 ${partName(path)}），或者装配文件读不了`)
        }
        contextNote = found.note ? `\n${found.note}。` : ""
      } else doc.context = null
      this.assetsKeys.delete(path)
      await this.ensureKernel(doc, true)
    }
    this.active = path
    if (ctx.session) this.sessions.set(ctx.session, path)
    await this.joinProject(path)
    // What was there before the agent arrived isn't news to it.
    const opener = readerOf(ctx.actor)
    if (opener) this.markSeen(doc, opener)
    this.emitDoc(doc)
    const what = isAssembly(path) ? "装配" : "零件"
    const head = existed ? `已打开${what} ${path}（第 ${doc.rev} 版）` : `已新建${what} ${path}${input.template && !isAssembly(path) ? `（从「${STARTERS.find((s) => s.id === input.template)?.title}」开始）` : ""}`
    const open = doc.notes.notes.filter((n) => n.status === "open")
    const notes = open.length ? `\n窗口里有 ${open.length} 条未处理的备注，用 get_notes 读。` : ""
    const warn = existed && input.template ? "\n文件已经存在，没有用 template。" : ""
    const inCtx = doc.context ? `\n在装配「${partName(doc.context)}」里编辑：装配里的其他零件（${(doc.report?.refs ?? []).map((r) => r.name).join("、") || "无"}）半透明地显示在旁边，可以 look、measure、check（gap / clearance / interference 写它们的名字）。${contextNote}` : ""
    const asmHint = isAssembly(path) && !doc.tree.features.length ? "\n这是空装配：用 component 放零件（file 写零件文件，rotate、at 摆位置）。" : ""
    return { ok: true, text: `${head}。Turnery 窗口已切到这个${what}。${warn}${notes}${inCtx}${asmHint}\n${treeText(doc.tree, doc.report!)}` }
  }

  private async listParts(): Promise<CommandResult> {
    if (this.project) {
      await this.rescan()
      return { ok: true, text: this.projectText() }
    }
    const parts = [...this.docs.values()]
    if (!parts.length) return { ok: true, text: `没有打开的零件。${this.recent.length ? `\n最近打开过：\n${this.recent.slice(0, 10).map((p) => `- ${p}`).join("\n")}` : ""}` }
    const lines = parts.map((d) => {
      const open = d.notes.notes.filter((n) => n.status === "open").length
      return `${d.path === this.active ? "▸" : "-"} ${d.path}（${isAssembly(d.path) ? "装配" : "零件"}）：${d.tree.features.length} 个${isAssembly(d.path) ? "零件" : "特征"}${open ? `，${open} 条未处理备注` : ""}${d.error ? `，文件有错：${d.error}` : ""}`
    })
    return { ok: true, text: `打开的零件（▸ = 窗口里正在看的）：\n${lines.join("\n")}` }
  }

  // ---------------------------------------------------------------- renaming

  /**
   * A component's name in this assembly (not its file's): its parts, and the mates, checks and notes
   * that name them, follow. Undoable like any change to the assembly (the notes stay renamed).
   */
  private async renamePart(doc: Doc, input: { id: string; name: string }, ctx: CallContext): Promise<CommandResult> {
    if (!isAssembly(doc.path)) return fail("只有装配里的零件能这样改名；零件文件改的是文件名（rename_file）。")
    const hit = componentById(doc.tree, input.id)
    if (!hit) return fail(`装配里没有 id 为 ${input.id} 的零件`)
    const to = input.name.trim()
    const bad = badPartName(to)
    if (bad) return fail(bad)
    if (to === hit.name) return { ok: true, text: "名字没变。" }
    const taken = doc.tree.features.some((f) => f.op === "component" && f.id !== input.id && componentName(f) === to)
    if (taken) return fail(`装配里已经有叫「${to}」的零件了`)
    const tree = renameInAssembly(doc.tree, hit.name, to, (f) => (f.id === input.id ? { ...f, name: to } : null))
    const notes = renameInNotes(doc.notes.notes, hit.name, to)
    if (notes !== doc.notes.notes) {
      doc.notes = { ...doc.notes, notes }
      await this.saveNotes(doc)
    }
    await this.adopt(doc, tree, ctx.actor, { summary: `零件「${hit.name}」改名为「${to}」` })
    return { ok: true, text: `已把「${hit.name}」改名为「${to}」（只在这个装配里，零件文件不变）。` }
  }

  /**
   * A part or assembly file renamed on disk, its notes with it. Every assembly in the project (and every
   * open one) that uses it is rewritten to the new name; where a component went by the file's name, the
   * mates, checks and notes naming its parts follow. An open file stays open under its new name, with its
   * history.
   */
  private async renameFile(input: { path: string; name: string }, ctx: CallContext): Promise<CommandResult> {
    const files = this.opts.files
    const move = files.rename
    if (!move) return fail("这里不能改文件名。")
    const from = this.partKey(input.path, ctx.cwd)
    const base = baseName(from)
    const ext = asmExtOf(base) ?? partExtOf(base)
    if (!ext) return fail("只能改零件和装配文件的名字。")
    const name = input.name.trim()
    const bad = badFileName(name)
    if (bad) return fail(bad)
    const oldName = base.slice(0, -ext.length)
    if (name === oldName) return { ok: true, text: "名字没变。" }
    const to = this.partKey(`${dirName(from)}/${name}${ext}`)
    if ((await files.read(from)) === null) return fail(`没有这个文件：${from}`)

    // Everything is checked before anything moves. Something already at a new path is in the way,
    // unless it is this very file under another case (most Mac disks ignore case).
    const inWay = async (a: string, b: string, there: boolean) => there && !(a.toLowerCase() === b.toLowerCase() && (await files.same?.(a, b)))
    if (this.docs.has(to) || (await inWay(from, to, (await files.read(to)) !== null))) return fail(`这个文件夹里已经有 ${name}${ext} 了`)
    if (await inWay(notesPath(from), notesPath(to), (await files.read(notesPath(to))) !== null)) return fail(`这个文件夹里已经有 ${name}${ext} 的备注文件，先把它移走`)
    if (await inWay(notesDir(from), notesDir(to), files.list ? (await files.list(notesDir(to))) !== null : false))
      return fail(`这个文件夹里已经有 ${baseName(notesDir(to))} 文件夹（备注的截图放在这里），先把它移走`)

    // Assemblies that use it: the project's, and any open one (a file opened on its own may be outside it).
    const asms = new Set([...(this.project?.entries ?? []).filter((e) => e.kind === "assembly").map((e) => e.path), ...[...this.docs.keys()].filter(isAssembly)])
    asms.delete(from)
    asms.delete(to)
    /** An assembly pointed at the new file; the parts named after the file (no `name` of their own) and the references to them renamed too. */
    const retarget = (asm: string, raw: Tree) => {
      let hit = false
      let renamedParts = false
      let tree = renameInAssembly(raw, "\u0000", "\u0000", (f) => {
        if (!f.file || this.partKey(besides(asm, f.file)) !== from) return null
        hit = true
        if (!f.name) renamedParts = true
        return { ...f, file: f.file.slice(0, f.file.length - base.length) + name + ext }
      })
      if (!hit) return null
      if (renamedParts) tree = renameInAssembly(tree, oldName, name, () => null)
      return { tree, renamedParts }
    }
    const treeOf = async (asm: string) => {
      const open = this.docs.get(asm)
      if (open) return open.tree
      try {
        const raw = JSON.parse((await files.read(asm)) ?? "null") as Tree
        return Array.isArray(raw?.features) ? raw : null
      } catch {
        return null
      }
    }
    // A part taking the new name must not meet another part already called that.
    for (const asm of asms) {
      const tree = await treeOf(asm)
      if (!tree) continue
      const takes = (f: Feature) => f.op === "component" && !f.name && !!f.file && this.partKey(besides(asm, f.file)) === from
      if (!tree.features.some(takes)) continue
      if (tree.features.some((f) => f.op === "component" && !takes(f) && componentName(f) === name))
        return fail(`装配「${partName(asm)}」里已经有叫「${name}」的零件，换个名字，或者先给那个零件改名`)
    }

    // The open file goes with what it remembers (undo, activity, what the agents have seen).
    const open = this.docs.get(from)
    const kept = open ? { undo: open.undo, redo: open.redo, changes: open.changes, seq: open.seq, seen: open.seen, context: open.context } : null
    const wasActive = this.active === from
    const sessions = [...this.sessions].filter(([, p]) => p === from).map(([s]) => s)
    if (open) this.closePart(from, false)
    /** The file opened again where it now is, as it was. */
    const reopen = async (at: string, summary?: string) => {
      if (!kept) return
      const doc = await this.load(at, {})
      Object.assign(doc, { undo: kept.undo, redo: kept.redo, changes: kept.changes, seq: kept.seq, seen: kept.seen })
      if (summary) doc.changes = [{ rev: doc.rev, actor: ctx.actor, at: Date.now(), summary, seq: ++doc.seq }, ...doc.changes].slice(0, MAX_CHANGES)
      if (kept.context) {
        doc.context = kept.context === from ? to : kept.context
        await this.ensureKernel(doc, true)
      }
      for (const s of sessions) this.sessions.set(s, at)
      if (wasActive) this.active = at
    }

    /** The window told what it shows now (the file reopened, or what was active before). */
    const publish = () => {
      const now = this.active ? this.docs.get(this.active) : null
      if (now) this.emitDoc(now)
      else this.emitSnapshot()
    }

    const moves: [string, string][] = [[from, to]]
    if ((await files.read(notesPath(from))) !== null) moves.push([notesPath(from), notesPath(to)])
    if (files.list && (await files.list(notesDir(from))) !== null) moves.push([notesDir(from), notesDir(to)])
    const done: [string, string][] = []
    try {
      for (const [a, b] of moves) {
        await move(a, b)
        done.push([a, b])
      }
    } catch (e) {
      // Halfway is worse than not at all: what moved goes back.
      for (const [a, b] of done.reverse()) await move(b, a).catch(() => {})
      await reopen(from)
      publish()
      return fail(`没能改名：${(e as Error).message}`)
    }
    this.recent = this.recent.map((p) => (p === from ? to : p))
    this.opts.onRecent?.(this.recent)

    const summary = `文件改名：${oldName} → ${name}`
    const updated: string[] = []
    for (const asm of asms) {
      let renamedParts = false
      const edit = await this.rewrite(
        asm,
        (text) => {
          let raw: Tree
          try {
            raw = JSON.parse(text) as Tree
          } catch {
            return null
          }
          if (!Array.isArray(raw?.features)) return null
          const next = retarget(asm, raw)
          if (!next) return null
          renamedParts = next.renamedParts
          return `${JSON.stringify(next.tree, null, 2)}\n`
        },
        ctx,
        summary,
        undefined,
        // Undoing it there can't move the file back: the old name would be gone from disk.
        { undoable: false },
      )
      // Its earlier versions, one undo away, use the new name too: also when it no longer uses the file
      // but an undo would bring it back, and the version an outside save just made (caught up in rewrite).
      const doc = this.docs.get(asm)
      if (doc) {
        const entry = (x: Entry): Entry => ({ ...x, tree: retarget(asm, x.tree)?.tree ?? x.tree, ...(x.files ? { files: x.files.map((f) => (f.path === from ? { ...f, path: to } : f)) } : {}) })
        doc.undo = doc.undo.map(entry)
        doc.redo = doc.redo.map(entry)
      }
      if (!edit) continue
      updated.push(partName(asm))
      if (renamedParts) await this.renameNotesOf(asm, oldName, name)
    }

    // A part being edited inside the renamed assembly stays in it.
    for (const d of this.docs.values()) {
      if (d.context !== from) continue
      d.context = to
      await this.ensureKernel(d)
    }

    await reopen(to, summary)
    if (this.project) this.project = await scanProject(files, this.project.root, this.scanCache)
    publish()
    const asmText = updated.length ? `用到它的 ${updated.join("、")} 已经改成新名字。` : ""
    return { ok: true, text: `已把 ${base} 改名为 ${name}${ext}。${asmText}` }
  }

  /** An assembly's notes on parts that were renamed (open or not). */
  private async renameNotesOf(asm: string, from: string, to: string) {
    const open = this.docs.get(asm)
    const file = open?.notes ?? parseNotes(await this.opts.files.read(notesPath(asm)))
    const notes = renameInNotes(file.notes, from, to)
    if (notes === file.notes) return
    if (open) {
      open.notes = { ...open.notes, notes }
      await this.saveNotes(open)
    } else await this.opts.files.write(notesPath(asm), `${JSON.stringify({ ...file, notes }, null, 2)}\n`)
  }

  // ---------------------------------------------------------------- project

  /** The project the file just opened belongs to (project.ts `rootFor`), scanned again. */
  private async joinProject(path: string) {
    if (!this.opts.files.list) return
    const root = await rootFor(this.opts.files, path, this.project?.root ?? null, this.opts.home)
    if (!root) return
    this.project = await scanProject(this.opts.files, root, this.scanCache)
  }

  private async rescan(): Promise<CommandResult> {
    if (!this.project) return { ok: true, text: "没有打开项目。" }
    this.project = await scanProject(this.opts.files, this.project.root, this.scanCache)
    this.emitSnapshot()
    return { ok: true, text: this.projectText() }
  }

  private projectText() {
    const p = this.projectSummary()
    if (!p) return "没有打开项目。"
    const line = (f: ProjectFile) =>
      `${f.path === this.active ? "▸" : "-"} ${relativePath(p.root, f.path)}（${f.kind === "assembly" ? "装配" : "零件"}）：${f.features ?? "?"} 个${f.kind === "assembly" ? "零件" : "特征"}${f.open ? "，打开着" : ""}${f.openNotes ? `，${f.openNotes} 条未处理备注` : ""}`
    const asm = p.files.filter((f) => f.kind === "assembly")
    const parts = p.files.filter((f) => f.kind === "part")
    const others = [...this.docs.values()].filter((d) => !inside(p.root, d.path))
    return [
      `项目 ${p.name}（${p.root}）。▸ = 窗口里正在看的；路径相对项目文件夹。`,
      asm.length ? `装配：\n${asm.map(line).join("\n")}` : "还没有装配。",
      parts.length ? `零件：\n${parts.map(line).join("\n")}` : "还没有零件。",
      others.length ? `项目外打开着的：\n${others.map((d) => `- ${d.path}`).join("\n")}` : "",
      p.truncated ? "（文件太多，只列出了一部分）" : "",
    ]
      .filter(Boolean)
      .join("\n")
  }

  /** A folder as the project: `create` writes an empty assembly and parameter file named after it, and opens the assembly. */
  private async openProject(input: { path: string; create?: boolean }, ctx: CallContext): Promise<CommandResult> {
    const files = this.opts.files
    if (!files.list) return fail("这里不能打开项目（没有文件夹列表）")
    let root = input.path.trim().replace(/\\/g, "/").replace(/\/+$/, "")
    if (!/^([A-Za-z]:)?\//.test(root) && ctx.cwd) root = `${ctx.cwd.replace(/[\\/]+$/, "")}/${root}`
    root = files.canonical?.(root) ?? root
    if (!canBeRoot(root, this.opts.home)) return fail(`${root} 不能做项目文件夹（不能是主目录或更上层）`)
    const list = await files.list(root)
    let created = ""
    if (input.create) {
      const sk = projectSkeleton(root)
      if (!list?.some((e) => !e.dir && isAssemblyFile(e.name))) {
        // An existing parameter file is the project's: keep it, the new assembly uses it.
        const hadParams = (await files.read(sk.params)) !== null
        if (!hadParams) await files.write(sk.params, sk.paramsText)
        await files.write(sk.assembly, sk.assemblyText)
        created = `新建了装配 ${baseName(sk.assembly)}${hadParams ? `，用已有的参数文件 ${baseName(sk.params)}` : ` 和参数文件 ${baseName(sk.params)}`}。`
      }
    } else if (list === null) return fail(`没有这个文件夹：${root}。要新建就设 create=true。`)
    // Another project: what was open from the last one goes (else the window keeps showing it, and its sidebar mixes both).
    if (this.project?.root !== root) {
      for (const p of [...this.docs.keys()]) if (!inside(root, p)) this.closePart(p, false)
    }
    this.project = await scanProject(files, root, this.scanCache)
    // The top-level assembly is what the project is about: the only one, or the one named after the folder.
    const top = this.project.entries.filter((e) => e.kind === "assembly" && e.folder === "")
    const main = top.length === 1 ? top[0] : top.find((e) => e.name === baseName(root))
    if (main) {
      const r = await this.openPart({ path: main.path }, ctx)
      if (!r.ok) return r
    } else this.emitSnapshot()
    return {
      ok: true,
      text: `${created ? created : ""}${this.projectText()}\n多个零件的东西：零件放在 parts/ 下（open_part path=parts/<名字>.turnery.json create=true），用装配里的 component 放进来；共用的尺寸写进项目的参数文件（share_params）。`,
    }
  }

  /**
   * The window's 「+ 零件」 on an assembly: `name` makes parts/<name>.turnery.json (using the assembly's
   * parameter file) and opens it inside the assembly; `file` puts an existing part, assembly or STEP in.
   */
  private async addPart(input: { name?: string; file?: string; color?: string; finish?: Finish }, ctx: CallContext): Promise<CommandResult> {
    const asm = await this.resolveDoc(ctx)
    if (!asm || !isAssembly(asm.path)) return fail("先打开一个装配")
    const dir = dirName(asm.path)
    let file: string
    let label: string
    if (input.name !== undefined) {
      const fname = partFileName(input.name)
      if (!fname) return fail("零件要有名字")
      const path = `${dir}/parts/${fname}`
      if ((await this.opts.files.read(path)) !== null) return fail(`已经有这个零件了：parts/${fname}`)
      const uses = asm.tree.uses ? relativePath(`${dir}/parts`, besides(asm.path, asm.tree.uses)) : undefined
      // A colour chosen with the name: the part file's own, so it shows wherever the part is used.
      const look = applyLook(undefined, { color: input.color, finish: input.finish })
      await this.opts.files.write(path, `${JSON.stringify({ ...(uses ? { uses } : {}), params: {}, features: [], ...(look ? { appearance: look } : {}) }, null, 2)}\n`)
      file = `parts/${fname}`
      label = stripEnding(fname)
    } else if (input.file) {
      const abs = this.opts.files.canonical?.(input.file) ?? input.file
      if (abs === asm.path) return fail("装配不能放进它自己")
      file = relativePath(dir, abs)
      label = stripEnding(baseName(abs)).replace(/\.(step|stp)$/i, "")
    } else return fail("写 name（新零件）或 file（已有的文件）")
    const taken = new Set(asm.tree.features.map((f) => f.id))
    let n = asm.tree.features.length + 1
    while (taken.has(`c${n}`)) n++
    // A second copy of the same part (or another file with the same name) gets 「名字-2」.
    const names = new Set(asm.tree.features.flatMap((f) => (f.op === "component" ? [componentName(f)] : [])))
    let name = label
    for (let k = 2; names.has(name); k++) name = `${label}-${k}`
    const res = await this.onDoc(asm, "component", { id: `c${n}`, name, file }, { ...ctx, part: asm.path })
    if (!res.ok) return res
    if (input.name !== undefined) return this.openPart({ path: besides(asm.path, file), context: asm.path }, ctx)
    await this.rescan()
    return res
  }

  /** The window's 「回到首页」: every open file closed (files untouched), no project. */
  private closeProject(): CommandResult {
    for (const p of [...this.docs.keys()]) this.closePart(p, false)
    this.project = null
    this.active = null
    this.sessions.clear()
    this.emitSnapshot()
    return { ok: true, text: "已关闭项目。" }
  }

  private closePart(path: string, emit = true): CommandResult {
    const doc = this.docs.get(path)
    if (!doc) return { ok: true, text: "没有打开这个零件。" }
    doc.unwatch()
    for (const stop of doc.assetWatch.values()) stop()
    this.docs.delete(path)
    this.built.delete(path)
    this.assetsKeys.delete(path)
    for (const [s, p] of this.sessions) if (p === path) this.sessions.delete(s)
    if (this.active === path) this.active = [...this.docs.keys()].pop() ?? null
    if (this.pending?.request.path === path) this.settlePick(null)
    if (!emit) return { ok: true, text: "已关闭。" }
    const next = this.active ? this.docs.get(this.active) : null
    if (next) this.emitDoc(next)
    else this.emitSnapshot()
    return { ok: true, text: "已关闭。" }
  }

  /** Open a part for the window (File → Open, the parts list): same as the agent's open_part, as the person. */
  openForUser(path: string, create = false) {
    return this.run("open_part", { path, create }, { actor: "user" })
  }

  /** One file, one part: the same file reached by different paths gets the same key. */
  private partKey(path: string, cwd?: string) {
    const p = normalizePartPath(path, cwd)
    return this.opts.files.canonical?.(p) ?? p
  }

  private async resolveDoc(ctx: CallContext): Promise<Doc | null> {
    if (ctx.part) {
      const path = this.partKey(ctx.part, ctx.cwd)
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
      assetWatch: new Map(),
      assetSeen: new Map(),
      shared: null,
      context: null,
      seq: 0,
      seen: { agent: { seq: 0, note: 0 }, assistant: { seq: 0, note: 0 } },
    }
    this.docs.set(path, doc)
    await this.refreshShared(doc)
    if (text === null) await this.save(doc, "agent")
    doc.unwatch = this.opts.files.watch(path, () => this.onDisk(() => this.fileChanged(doc)))
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
  private async adopt(doc: Doc, tree: Tree, actor: CallContext["actor"], opts: { report?: BuildReport; save?: boolean; summary?: string; undoable?: boolean; files?: FileEdit[] } = {}) {
    const summary = opts.summary ?? (describeTreeChange(doc.tree, tree) || "重新保存（内容没变）")
    if (opts.undoable !== false) {
      doc.undo = [...doc.undo, { tree: doc.tree, summary, ...(opts.files?.length ? { files: opts.files } : {}) }].slice(-MAX_UNDO)
      doc.redo = []
    }
    const prev = doc.tree
    const usesChanged = doc.tree.uses !== tree.uses
    doc.tree = tree
    doc.rev += 1
    doc.error = undefined
    if (usesChanged) await this.refreshShared(doc)
    if (opts.report && this.slot === doc.path && this.built.get(doc.path) === tree) doc.report = opts.report
    else if (!(await this.restyle(doc, prev))) await this.ensureKernel(doc, true)
    doc.changes = [{ rev: doc.rev, actor, at: Date.now(), summary, seq: ++doc.seq }, ...doc.changes].slice(0, MAX_CHANGES)
    if (opts.save !== false && !(await this.save(doc, actor))) {
      // Someone saved the file while this ran: theirs wins, ours stays one undo away.
      doc.conflict = true
      await this.fileChanged(doc)
      return
    }
    this.emitDoc(doc)
  }

  private async undoRedo(doc: Doc, which: "undo" | "redo", ctx: CallContext): Promise<CommandResult> {
    const from = which === "undo" ? doc.undo : doc.redo
    const entry = from[from.length - 1]
    if (!entry) return fail(which === "undo" ? "没有可以撤销的改动。" : "没有可以重做的改动。")
    const files = entry.files
    if (which === "undo") {
      doc.undo = doc.undo.slice(0, -1)
      doc.redo = [...doc.redo, { tree: doc.tree, summary: entry.summary, ...(files ? { files } : {}) }]
    } else {
      doc.redo = doc.redo.slice(0, -1)
      doc.undo = [...doc.undo, { tree: doc.tree, summary: entry.summary, ...(files ? { files } : {}) }]
    }
    // A colour given from the assembly went into a component's file: that file goes back (or forward) too,
    // unless someone changed it since (theirs stays, and the result says so).
    const kept: string[] = []
    for (const f of files ?? []) {
      const [from, to] = which === "undo" ? [f.after, f.before] : [f.before, f.after]
      let changed = false
      await this.rewrite(f.path, (text) => (text === from ? to : ((changed = text !== to), null)), ctx, `${which === "undo" ? "撤销" : "重做"}：${entry.summary}`, doc)
      if (changed) kept.push(partName(f.path))
    }
    await this.adopt(doc, entry.tree, ctx.actor, { summary: `${which === "undo" ? "撤销" : "重做"}：${entry.summary}`, undoable: false })
    const note = kept.length ? `\n⚠ ${kept.join("、")} 之后又被改过，没有${which === "undo" ? "改回去" : "重新写入"}。` : ""
    return { ok: true, text: `已${which === "undo" ? "撤销" : "重做"}：${entry.summary}${note}\n${treeText(doc.tree, doc.report!)}` }
  }

  /** Notes don't change the tree (no new version) but belong in the activity list: who wrote, handled or removed what. */
  private logNote(doc: Doc, actor: CallContext["actor"], summary: string, note: "added" | "changed" = "changed") {
    doc.changes = [{ rev: doc.rev, actor, at: Date.now(), summary, note, seq: ++doc.seq }, ...doc.changes].slice(0, MAX_CHANGES)
  }

  private allOk(doc: Doc) {
    return !!doc.report && !doc.report.paramError && doc.report.features.every((f) => f.state === "ok" || f.state === "suppressed")
  }

  /** Write the tree, unless the file changed since we last read or wrote it (returns false: don't overwrite). */
  private async save(doc: Doc, actor: CallContext["actor"]) {
    const disk = await this.opts.files.read(doc.path)
    if (disk !== null && doc.written !== null && disk !== doc.written) return false
    const text = `${JSON.stringify(doc.tree, null, 2)}\n`
    doc.written = text
    // An assembly watching this part file sees the change as made by `actor`, not by "the file".
    this.wrote.set(doc.path, { text, actor })
    await this.opts.files.write(doc.path, text)
    return true
  }

  private async saveNotes(doc: Doc) {
    await this.opts.files.write(notesPath(doc.path), `${JSON.stringify(doc.notes, null, 2)}\n`)
  }

  /** A framed or drawn area's picture (a PNG data URL), saved beside the notes as n<number>.png. */
  private async saveNoteImage(doc: Doc, n: number, url: string) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(url)
    if (!m) return undefined
    const name = `n${n}.png`
    await this.opts.files.write(`${notesDir(doc.path)}/${name}`, fromBase64(m[1]))
    return name
  }

  /**
   * Editing a part inside its assembly: the assembly's notes on this part (by the names its components
   * give it there), which the person may have written while looking at the whole.
   */
  private async contextNotes(doc: Doc, all: boolean) {
    const asm = doc.context
    if (!asm) return ""
    const parsed = parseTree((await this.opts.files.read(asm)) ?? "")
    if (!parsed.ok) return ""
    const names = parsed.tree.features.flatMap((f) => (f.op === "component" && f.file && this.partKey(besides(asm, f.file)) === doc.path ? [componentName(f)] : []))
    if (!names.length) return ""
    const mine = (n: string) => names.some((b) => n === b || n.startsWith(`${b}#`) || n.startsWith(`${b}/`))
    const file = this.docs.get(asm)?.notes ?? parseNotes(await this.opts.files.read(notesPath(asm)))
    const list = file.notes.filter((n) => (all || n.status === "open") && ((n.part && mine(n.part)) || n.parts?.some(mine)))
    if (!list.length) return ""
    return `装配「${partName(asm)}」里关于这个零件的 ${list.length} 条备注（记在装配上：处理完用 open_part 打开装配再 resolve_note；位置是装配里的坐标）：\n\n${notesText(list, true, "装配")}`
  }

  /** Where a note's picture is, as the agent can open it. */
  private noteImagePath(doc: Doc, name: string) {
    return `${notesDir(doc.path)}/${name}`
  }

  private async dataUrl(path: string) {
    const bytes = await this.opts.files.readBytes?.(path)
    return bytes ? `data:image/png;base64,${toBase64(bytes)}` : null
  }

  // ------------------------------------------------------------------ looks

  /**
   * Only colours or finishes changed since the kernel built `prev` (in the tree, or in a component's
   * file): hand it the new sources and tree, no rebuild. False when anything else changed: rebuild.
   */
  private async restyle(doc: Doc, prev: Tree): Promise<boolean> {
    const k = this.opts.kernel
    if (!k.restyle || !sameGeometry(prev, doc.tree)) return false
    await this.select(doc)
    if (this.built.get(doc.path) !== prev) return false
    // Handing over new sources stops the background checks of the last build: then only a rebuild restarts them.
    if ((await this.syncAssets(doc, doc.tree)) && doc.report?.checksPending) return false
    if (!(await k.restyle(this.effective(doc, doc.tree)))) return false
    this.built.set(doc.path, doc.tree)
    return true
  }

  /**
   * Rewrite a file besides the doc being changed: a component's part file given a colour from its
   * assembly, or put back by undo. `change` gets the text on disk and returns the new text (null: leave
   * it). Through its doc when that is open (its own undo list gets it too). The other open files that
   * read it (assemblies) restyle; `origin` is left to the caller, who adopts it. Returns the edit, or
   * null when nothing was written.
   */
  private async rewrite(path: string, change: (text: string) => string | null, ctx: CallContext, summary: string, origin?: Doc, opts: { undoable?: boolean } = {}): Promise<FileEdit | null> {
    const open = this.docs.get(path)
    if (open) await this.fileChanged(open)
    const before = await this.opts.files.read(path)
    if (before === null) throw new InputError(`读不到 ${path}`)
    const after = change(before)
    if (after === null || after === before) return null
    if (open) {
      const parsed = parseTree(after)
      if (!parsed.ok) throw new InputError(`${path} 不是合法的特征树：${parsed.error}`)
      await this.adopt(open, parsed.tree, ctx.actor, { summary, undoable: opts.undoable })
    } else {
      this.wrote.set(path, { text: after, actor: ctx.actor })
      await this.opts.files.write(path, after)
    }
    const written = open?.written ?? after
    for (const d of this.docs.values()) {
      if (!d.assetWatch.has(path)) continue
      // Its watcher would take this write for news: it is ours, followed right here.
      d.assetSeen.set(path, `text:${written}`)
      if (d === origin) continue
      d.rev += 1
      d.changes = [{ rev: d.rev, actor: ctx.actor, at: Date.now(), summary, seq: ++d.seq }, ...d.changes].slice(0, MAX_CHANGES)
      if (!(await this.restyle(d, d.tree))) await this.ensureKernel(d, true)
      // The window shows a new version only when told (a restyle doesn't go through the loading state).
      this.emitDoc(d)
    }
    return { path, before, after: written }
  }

  /**
   * set_appearance. In a part file: the whole part, or the parts named. In an assembly: a self-made
   * part's colour goes into its part file (every assembly using it follows); a standard part, a STEP
   * file, a sub-assembly, or `where: assembly` goes onto the component in this assembly.
   */
  private async setAppearance(doc: Doc, input: { parts?: string[]; color?: string | null; finish?: Finish | null; where?: "file" | "assembly" }, ctx: CallContext): Promise<CommandResult> {
    const change: LookChange = { color: input.color, finish: input.finish }
    if (change.color === undefined && change.finish === undefined) return fail("写 color 或 finish（写 null 是清除）。")
    const what = changeText(change)
    const parts = [...new Set((input.parts ?? []).map((p) => p.trim()).filter(Boolean))]
    if (!isAssembly(doc.path)) {
      await this.ensureKernel(doc)
      const names = doc.report?.parts?.map((p) => p.name) ?? []
      const unknown = parts.filter((p) => !names.includes(p))
      if (unknown.length) return fail(names.length ? `没有叫「${unknown.join("、")}」的零件：现在有 ${names.join("、")}` : "这个零件没有拆开：不写 parts，就是整个零件。")
      const tree = setPartLook(doc.tree, parts.length ? parts : undefined, change)
      if (tree === doc.tree) return { ok: true, text: `外观没变。\n${await this.looksText(doc)}` }
      await this.adopt(doc, tree, ctx.actor, { summary: `${parts.length ? `「${parts.join("」「")}」` : "整个零件"}：${what}` })
      const own = !parts.length ? Object.keys(doc.tree.appearance?.parts ?? {}) : []
      return { ok: true, text: `已设置（不改几何，不重建）。${own.length ? `\n${own.join("、")} 另有自己的外观，以它们自己的为准。` : ""}\n${await this.looksText(doc)}` }
    }

    if (!parts.length) return fail("装配里要写 parts：装配里的零件名（get_state 的「外观」一行列着）。")
    // The part names below come from the last build: catch up with component files saved since.
    await this.ensureKernel(doc)
    const comps = doc.tree.features.filter((f): f is Extract<Feature, { op: "component" }> => f.op === "component")
    // 「螺钉#3/垫圈」: the component with the longest name the part's name starts with, followed by # or /.
    const owner = (name: string) =>
      comps
        .map((f) => ({ f, base: componentName(f) }))
        .filter(({ base }) => name === base || name.startsWith(`${base}#`) || name.startsWith(`${base}/`))
        .sort((a, b) => b.base.length - a.base.length)[0]
    // A part's name inside its component (「外壳/上盖」→「上盖」); null: the component as a whole.
    const subOf = (name: string, base: string) => {
      const rest = name.slice(base.length).replace(/^#\d+/, "")
      return rest.startsWith("/") ? rest.slice(1) : null
    }
    const built = doc.report?.parts?.map((p) => p.name) ?? []
    // On this assembly, per component: the whole of it, and its parts by their names inside it.
    const onAssembly = new Map<string, { whole: boolean; subs: Set<string>; names: string[] }>()
    const inFiles = new Map<string, { file: string; parts: Set<string> | null; names: string[] }>()
    // Written into a part file, but what this assembly sets for the part still shows here.
    const shadowed: string[] = []
    for (const name of parts) {
      const hit = owner(name)
      if (!hit) return fail(`装配里没有叫「${name}」的零件：现在有 ${comps.map((f) => componentName(f)).join("、") || "（还没有零件）"}`)
      const sub = subOf(name, hit.base)
      if (sub && built.length && !built.includes(name)) return fail(`装配里没有叫「${name}」的零件：现在有 ${built.join("、")}`)
      const file = hit.f.file
      const own = !!file && !hit.f.standard && !/\.(step|stp)$/i.test(file) && !isAssembly(file)
      if (input.where === "assembly" || !own) {
        const e = onAssembly.get(hit.f.id) ?? { whole: false, subs: new Set<string>(), names: [] }
        if (sub) e.subs.add(sub)
        else e.whole = true
        e.names.push(name)
        onAssembly.set(hit.f.id, e)
        continue
      }
      const here = ownLook(hit.f.appearance, sub)
      if ((change.color !== undefined && here.color) || (change.finish !== undefined && here.finish)) shadowed.push(`「${name}」${lookText(here)}`)
      const abs = this.partKey(besides(doc.path, file!))
      const entry = inFiles.get(abs) ?? { file: file!, parts: new Set<string>(), names: [] }
      // The whole part (no sub) covers any of its parts named too.
      if (!sub) entry.parts = null
      else entry.parts?.add(sub)
      entry.names.push(name)
      inFiles.set(abs, entry)
    }
    if (input.where === "file" && onAssembly.size) {
      const names = [...onAssembly.values()].flatMap((e) => e.names)
      return fail(`「${names.join("、")}」没有自己的零件文件（标准件、STEP 外购件或子装配）：颜色只能写在装配里，去掉 where 或写 where: "assembly"。`)
    }

    const summary = `「${parts.join("」「")}」：${what}`
    const features = doc.tree.features.map((f) => {
      const e = f.op === "component" ? onAssembly.get(f.id) : undefined
      if (!e || f.op !== "component") return f
      let next = e.whole ? setPartLook(f, undefined, change) : f
      if (e.subs.size) {
        // Clearing, for some of its parts, what the whole component sets: the others keep it, written for each.
        const top = next.appearance
        const cleared: LookChange = {}
        if (change.color === null && top?.color) cleared.color = null
        if (change.finish === null && top?.finish) cleared.finish = null
        if (cleared.color === null || cleared.finish === null) {
          const keep = { ...(cleared.color === null ? { color: top!.color } : {}), ...(cleared.finish === null ? { finish: top!.finish } : {}) }
          const map = { ...top?.parts }
          for (const n of built) {
            const s = owner(n)?.f.id === f.id ? subOf(n, componentName(f)) : null
            if (s && !e.subs.has(s)) map[s] = mergeLook(map[s], keep)
          }
          next = setPartLook({ ...next, appearance: { ...top, ...(Object.keys(map).length ? { parts: map } : {}) } }, undefined, cleared)
        }
        next = setPartLook(next, [...e.subs], change)
      }
      return next
    })
    const tree: Tree = features.some((f, i) => f !== doc.tree.features[i]) ? { ...doc.tree, features } : doc.tree
    const files: FileEdit[] = []
    const lines: string[] = []
    for (const [abs, e] of inFiles) {
      const edit = await this.rewrite(
        abs,
        (text) => {
          const parsed = parseTree(text)
          if (!parsed.ok) throw new InputError(`${e.file} 不是合法的特征树：${parsed.error}`)
          const next = setPartLook(parsed.tree, e.parts ? [...e.parts] : undefined, change)
          return next === parsed.tree ? null : `${JSON.stringify(next, null, 2)}\n`
        },
        ctx,
        summary,
        doc,
      )
      if (edit) files.push(edit)
      lines.push(`「${e.names.join("」「")}」写进 ${e.file}${edit ? "" : "（本来就是这样）"}：用到这个零件的装配都跟着变。`)
    }
    for (const [id, e] of onAssembly) {
      const f = comps.find((x) => x.id === id)!
      const copies = e.names.some((n) => /^#\d+/.test(n.slice(componentName(f).length))) ? "；同一个 component 放的几个一起变" : ""
      lines.push(`「${e.names.join("」「")}」写在装配的 component「${componentName(f)}」上，只在这个装配里${copies}。`)
    }
    if (shadowed.length) lines.push(`这个装配里单独设过的仍然优先，这里看不到变化：${shadowed.join("、")}。要改回跟零件文件一致，parts 写它们、where 写 "assembly"，color 和 finish 写 null。`)
    if (tree === doc.tree && !files.length) return { ok: true, text: `外观没变。\n${await this.looksText(doc)}` }
    await this.adopt(doc, tree, ctx.actor, { summary, files })
    return { ok: true, text: `已设置（不改几何，不重建）。\n${lines.join("\n")}\n${await this.looksText(doc)}` }
  }

  /** 「外观：上盖 橙、底壳 未设置（白模）」 for get_state and set_appearance. */
  private async looksText(doc: Doc) {
    await this.ensureKernel(doc)
    const list = (await this.opts.kernel.looks?.()) ?? []
    if (!list.length) return "外观：还没有实体。"
    const one = (l: Look) => (isSet(l) ? lookText(l) : l.fileColor ? `未设置（按 STEP 自带的颜色，主要是${colorWord(l.fileColor)}）` : `未设置（${SOURCE_DEFAULT[l.source]}）`)
    if (list.length === 1 && !isAssembly(doc.path)) return `外观：${one(list[0].look)}`
    return `外观：${list.map((p) => `${p.name} ${one(p.look)}${p.here ? "（这个装配里单独设的）" : ""}`).join("、")}`
  }

  // ------------------------------------------------------------------ kernel

  /**
   * Point the kernel at this part. A host with one kernel per part keeps each part's last build, so
   * switching back is a lookup, not a rebuild; a plain host holds one tree, rebuilt on every switch.
   */
  private async select(doc: Doc) {
    if (this.slot === doc.path) return
    if (this.opts.kernel.use) {
      // That part's kernel came back empty (first use, or dropped to make room): hand everything over again.
      if (await this.opts.kernel.use(doc.path)) {
        this.built.delete(doc.path)
        this.assetsKeys.delete(doc.path)
      }
    } else {
      // One kernel for every part: it now holds another part's tree and files.
      this.built.clear()
      this.assetsKeys.clear()
    }
    this.slot = doc.path
  }

  /** Make the kernel hold this part's current tree (with its shared parameters). */
  private async ensureKernel(doc: Doc, force = false) {
    let sourcesChanged = false
    if (!force && this.slot === doc.path && this.built.get(doc.path) === doc.tree) {
      sourcesChanged = await this.syncAssets(doc, doc.tree)
      if (!sourcesChanged) return doc.report!
    }
    return this.withLoading(doc, async () => {
      await this.select(doc)
      sourcesChanged = (await this.syncAssets(doc, doc.tree)) || sourcesChanged
      if (force || sourcesChanged || this.built.get(doc.path) !== doc.tree) {
        const tree = doc.tree
        doc.report = await this.opts.kernel.rebuild(this.effective(doc, tree), { background: true })
        this.built.set(doc.path, tree)
      }
      return doc.report!
    })
  }

  private async withLoading<T>(doc: Doc, work: () => Promise<T>): Promise<T> {
    const previous = this.loading
    if (!previous || previous.path !== doc.path) this.loading = { path: doc.path, name: doc.name, startedAt: Date.now() }
    this.emitDoc(doc)
    try {
      const result = await work()
      if (doc.error?.startsWith("加载失败：")) doc.error = undefined
      return result
    } catch (e) {
      doc.error = `加载失败：${(e as Error)?.message ?? e}`
      throw e
    } finally {
      doc.preview = undefined
      this.loading = previous
      this.emitDoc(doc)
    }
  }

  /** The tree the kernel builds: the part's own, with its shared parameters (which win). */
  private effective(doc: Doc, tree: Tree) {
    return effectiveTree(tree, doc.shared)
  }

  /** The tree the window shows: shared parameters in the table, their notes saying where they come from. */
  private windowTree(doc: Doc): Tree {
    const sh = doc.shared
    if (!sh || sh.error) return doc.tree
    const eff = effectiveTree(doc.tree, sh)
    const notes = { ...(eff.paramNotes ?? {}) }
    for (const k of Object.keys(sh.params)) notes[k] = `${sh.notes[k] ? `${sh.notes[k]}` : ""}（共享：${sh.file}）`
    return { ...eff, paramNotes: notes }
  }

  /** (Re)load the part's shared parameter file, if it names one. */
  private async refreshShared(doc: Doc) {
    doc.shared = doc.tree.uses ? await loadShared(this.opts.files, doc.path, doc.tree.uses) : null
  }

  /**
   * What the part reads besides its own file, handed to the kernel when it changes: STEP imports, an
   * assembly's components (recursively, with their shared parameters), and the assembly around a part
   * edited in context. Unchanged files (by size and modification time) aren't read again. Returns
   * whether anything changed.
   */
  private async syncAssets(doc: Doc, tree: Tree) {
    const files = this.opts.files
    const probe = await gather(files, doc.path, tree, [], false)
    const ctx = doc.context ? await this.contextOf(doc, false) : null
    this.watchAssets(doc, [...probe.watch, ...(doc.shared ? [doc.shared.path] : []), ...(ctx?.watch ?? [])])
    const key = JSON.stringify([doc.path, probe.signature, ctx?.key ?? null])
    if (key === this.assetsKeys.get(doc.path)) return false
    const full = await gather(files, doc.path, tree, [], true)
    const context = doc.context ? ((await this.contextOf(doc, true))?.source ?? null) : null
    await this.opts.kernel.preparePreview?.(doc.path, this.effective(doc, tree), full.assets, full.components, context, this.project && inside(this.project.root, doc.path) ? this.project.root : null)
    await this.opts.kernel.setAssets?.(full.assets)
    await this.opts.kernel.setComponents?.(full.components)
    await this.opts.kernel.setContext?.(context)
    this.assetsKeys.set(doc.path, key)
    return true
  }

  /**
   * The assembly a part is edited in: this part's placement and every other component's, worked out
   * with the assembly's parameters. `read`: with the components' contents (else only what to watch).
   */
  private async contextOf(doc: Doc, read: boolean): Promise<{ source: ContextSource; watch: string[]; key: string; note?: string } | null> {
    const asm = doc.context!
    const files = this.opts.files
    const text = await files.read(asm)
    if (text === null) return null
    const parsed = parseTree(text)
    if (!parsed.ok) return null
    const shared = parsed.tree.uses ? await loadShared(files, asm, parsed.tree.uses) : null
    const tree = effectiveTree(parsed.tree, shared)
    try {
      resolveParams(tree.params)
    } catch {
      return null
    }
    const g = await gather(files, asm, tree, [], read)
    const comps = tree.features.filter((f): f is Extract<Feature, { op: "component" }> => f.op === "component" && !f.hidden && !!f.file)
    const canon = (f: string) => files.canonical?.(besides(asm, f)) ?? besides(asm, f)
    const mine = comps.filter((c) => canon(c.file!) === doc.path)
    if (!mine.length) return null
    // The kernel builds the assembly to place everything (mates need the parts' shapes).
    const source: ContextSource = { assembly: partName(asm), tree, components: g.components, self: mine[0].file! }
    const watch = [asm, ...g.watch, ...(shared ? [shared.path] : [])]
    const note = mine.length > 1 ? `这个零件在装配里用了 ${mine.length} 次，按第一个（${mine[0].name ?? mine[0].id}）的位置显示其他零件` : undefined
    return { source, watch, key: JSON.stringify([text, g.signature, shared?.text ?? null]), note }
  }

  /** A STEP file the part imports changed on disk: rebuild, as a change by 「文件」. */
  private watchAssets(doc: Doc, paths: string[]) {
    for (const [p, stop] of doc.assetWatch) {
      if (paths.includes(p)) continue
      stop()
      doc.assetWatch.delete(p)
      doc.assetSeen.delete(p)
    }
    for (const p of paths) {
      if (doc.assetWatch.has(p)) continue
      void this.assetState(p).then((st) => doc.assetSeen.set(p, st))
      doc.assetWatch.set(
        p,
        this.opts.files.watch(p, () =>
          this.onDisk(async () => {
            if (this.docs.get(doc.path) !== doc) return
            // Saved again with the same content (an editor, another engine's check): nothing to rebuild.
            const st = await this.assetState(p)
            if (st === doc.assetSeen.get(p)) return
            doc.assetSeen.set(p, st)
            const ours = this.wrote.get(p)
            const mine = ours !== undefined && st === `text:${ours.text}`
            if (doc.shared?.path === p) {
              await this.refreshShared(doc)
              // writeShared already rebuilt every part using it and logged who changed what.
              if (mine) return
            }
            this.assetsKeys.delete(doc.path)
            doc.rev += 1
            // Only its colours changed: no rebuild (the shapes are cached by geometry).
            const restyled = await this.restyle(doc, doc.tree)
            doc.changes = [{ rev: doc.rev, actor: mine ? ours.actor : ("file" as const), at: Date.now(), summary: `${p.split(/[\\/]/).pop()} 更新了${restyled ? "（只改了外观）" : "，已重建"}`, seq: ++doc.seq }, ...doc.changes].slice(0, MAX_CHANGES)
            if (!restyled) await this.ensureKernel(doc, true)
            this.emitDoc(doc)
          }),
        ),
      )
    }
  }

  /** A watched file's content as a string to compare: the text of a part or parameter file, size and time of a STEP file. */
  private async assetState(p: string): Promise<string> {
    if (/\.json$/i.test(p)) return `text:${(await this.opts.files.read(p)) ?? ""}`
    const st = (await this.opts.files.stat?.(p)) ?? null
    return st ? `stat:${st.size}:${st.mtimeMs}` : "missing"
  }

  private port(doc: Doc, background = true): KernelPort {
    return {
      rebuild: async (t) => this.withLoading(doc, async () => {
        await this.select(doc)
        this.built.delete(doc.path)
        if (t.uses !== doc.shared?.file) doc.shared = t.uses ? await loadShared(this.opts.files, doc.path, t.uses) : null
        await this.syncAssets(doc, t)
        const r = await this.opts.kernel.rebuild(this.effective(doc, t), { background })
        this.built.set(doc.path, t)
        return r
      }),
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
          return k.locate(call.kind, call.selector, call.before)
        case "selectorFor":
          return k.selectorFor(call.kind, call.hashes, call.before)
        case "faceEdges":
          return k.faceEdges(call.hash, call.before)
        case "measure":
          return k.measure(call.targets)
        case "dims":
          return k.dimensions()
        case "drawing":
          return k.drawing(call.iso)
        case "export":
          return k.exportBody(call.format, call.index)
      }
    })
  }

  private async one(t: Target): Promise<MeasureSpec> {
    if (t.feature) return { kind: "feature", id: t.feature }
    if (t.part) return { kind: "part", name: t.part }
    const kind = t.face ? "face" : "edge"
    const selector = t.face ?? t.edge
    if (!selector) throw new InputError("要写 face、edge、feature 或 part 之一")
    const hashes = await this.opts.kernel.locate(kind, selector)
    if (!hashes?.length) throw new InputError(`选择器什么都没选中：${JSON.stringify(selector)}`)
    if (hashes.length > 1) throw new InputError(`选择器选中了 ${hashes.length} 个，要正好一个（加 near 或更多条件）：${JSON.stringify(selector)}`)
    return { kind, hash: hashes[0], point: [0, 0, 0] }
  }

  // ----------------------------------------------------------- observation

  private async stateText(doc: Doc, reader: Reader | null = null) {
    const report = await this.ensureKernel(doc)
    const open = doc.notes.notes.filter((n) => n.status === "open")
    const lines = [`${isAssembly(doc.path) ? "装配" : "零件"}：${doc.path}（第 ${doc.rev} 版）`]
    if (doc.error) lines.push(`⚠ ${doc.error}`)
    if (doc.tree.uses) lines.push(doc.shared?.error ? `⚠ ${doc.shared.error}` : `共享参数文件：${doc.tree.uses}（${Object.keys(doc.shared?.params ?? {}).join("、") || "空"}）`)
    const shadow = shadowed(doc.tree, doc.shared)
    if (shadow.length) lines.push(`⚠ 参数 ${shadow.join("、")} 在共享参数文件里也有，以共享的为准`)
    if (doc.context) lines.push(`在装配「${partName(doc.context)}」里编辑：其他零件 ${(report.refs ?? []).map((r) => r.name).join("、") || "（没有）"} 半透明显示，只读`)
    if (report.parts?.length) lines.push(`零件：${report.parts.map((p) => `${p.name}（${p.size.map((x) => Math.round(x * 10) / 10).join("×")}）`).join("、")}`)
    if (report.body) lines.push(await this.looksText(doc))
    lines.push(treeText(this.effective(doc, doc.tree), report))
    lines.push(open.length ? `未处理的备注 ${open.length} 条：${open.map((n) => `${n.id}「${clip(n.text)}」`).join("、")}（get_notes 看详情）` : "没有未处理的备注。")
    if (doc.changes.length) {
      const who = (a: Actor) => (a === reader ? "你" : WHO[a].trim())
      lines.push(`最近的改动：\n${doc.changes.slice(0, 6).map((c) => `- 第 ${c.rev} 版 · ${who(c.actor)}：${c.summary}`).join("\n")}`)
    }
    return lines.join("\n")
  }

  private async look(doc: Doc, input: Record<string, unknown>): Promise<CommandResult> {
    const screen = this.opts.screen?.()
    if (!screen) return fail("看图要在 Turnery 窗口里渲染：先打开 Turnery App（命令行 turnery open <零件>），再调用 look。其余命令不需要窗口。")
    const report = await this.ensureKernel(doc)
    const at = input.at as string | undefined
    const index = at ? doc.tree.features.findIndex((f) => f.id === at) : -1
    if (at && index < 0) return fail(`找不到特征「${at}」`)
    const display = await this.opts.kernel.display(index >= 0 ? index : undefined)
    if (!display.mesh && !display.refs?.length) return fail("还没有实体可以看。")
    const size = (input.size as "normal" | "large" | undefined) ?? "normal"
    const H = LOOK_SIZE[size][1]
    const whole = modelBox(display) ?? refsBox(display)

    // A cut: which side goes, and the view that looks straight at the cut.
    const sec = input.section as { plane: "XY" | "XZ" | "YZ"; offset?: number | string } | undefined
    let section: LookSection | undefined
    if (sec) {
      const axis = ({ XY: "Z", XZ: "Y", YZ: "X" } as const)[sec.plane]
      const i = { X: 0, Y: 1, Z: 2 }[axis]
      const atValue = sec.offset !== undefined ? evalNum(sec.offset, report.params) : whole ? (whole[0][i] + whole[1][i]) / 2 : 0
      section = { axis, at: atValue }
    }
    const hide = (input.hide as string[] | undefined) ?? []
    const known = new Set([...(display.parts ?? []).map((p) => p.name), ...(display.refs ?? []).flatMap((r) => [r.name, r.id])])
    const unknown = hide.filter((n) => !known.has(n))
    if (unknown.length) return fail(`hide 里的「${unknown.join("、")}」不是零件或参考体的名字${known.size ? `：现在有 ${[...known].join("、")}` : "：现在只有一个没名字的实体"}`)

    // Framing: an explicit focus frames every view on it; otherwise a small last change gets a close-up of its own.
    const focusIn = input.focus as string | { part: string } | { faces: Record<string, unknown> } | undefined
    let focus: { box: Box; name: string; facing?: V3 } | null = null
    if (focusIn !== undefined) {
      const res = await this.focusBox(doc, display, focusIn)
      if ("error" in res) return fail(res.error)
      focus = res
    }
    const sectionView = section ? ({ Z: "top", Y: "front", X: "right" } as const)[section.axis] : null
    const views = (input.views as string[] | undefined)?.length
      ? (input.views as string[])
      : sectionView
        ? [sectionView, "iso"]
        : focus?.facing
          ? ["iso"]
          : focus
            ? ["iso", "front"]
            : ["iso", "front", "top", "right"]
    const shots: LookShot[] = views.map((v) =>
      focus
        ? { label: `特写：${focus.name} · ${VIEW_LABEL[v] ?? v}`, dir: VIEW_DIR[v] ?? VIEW_DIR.iso, box: focus.box, padding: FOCUS_PADDING }
        : { label: VIEW_LABEL[v] ?? v, dir: VIEW_DIR[v] ?? VIEW_DIR.iso },
    )
    // Faces that all face one way: one more picture straight at them (a front view would show a side wall edge-on).
    if (focus?.facing && !(input.views as string[] | undefined)?.length) {
      const f = focus.facing
      // Never exactly along Z: the snapshotter's up vector is +Z.
      const dir: V3 = Math.abs(f[2]) > 0.9999 ? [0, -1e-4 * Math.sign(f[2] || 1), f[2]] : f
      shots.push({ label: `特写：${focus.name} · 正对着看`, dir, box: focus.box, padding: FOCUS_PADDING })
    }
    const dir = input.dir as number[] | undefined
    if (dir) {
      const l = Math.hypot(...dir)
      if (!l) return fail("dir 不能是 [0, 0, 0]")
      shots.push({ label: `从 (${dir.join(", ")}) 方向看${focus ? `（特写：${focus.name}）` : ""}`, dir: [dir[0] / l, dir[1] / l, dir[2] / l], box: focus?.box, padding: focus ? FOCUS_PADDING : undefined })
    }
    let auto: Box | null = null
    if (!focus) {
      auto = autoFocus(display)
      const f = doc.tree.features[display.index]
      if (auto) shots.push({ label: `特写：${f ? displayName(doc.tree, f) : "最后一步"}（自动）`, dir: VIEW_DIR.iso, box: auto, padding: FOCUS_PADDING })
    }

    const pins = input.notes === false ? [] : doc.notes.notes.filter((n) => n.status === "open" && pinned(n)).map((n) => ({ n: n.n, point: n.point }))
    const plain = input.plain === true
    const images = await screen.look({ display, views, highlight: input.highlight as string | undefined, pins, shots, section, hide: hide.length ? hide : undefined, size, plain })
    const step = at ? `（回滚到「${displayName(doc.tree, doc.tree.features[index])}」这一步）` : ""
    const colours = plain ? "" : lookLegend(display, hide)
    const legend = input.highlight ? `蓝色 = 高亮的特征，${colours ? "其余按零件的颜色" : "灰色 = 其余"}` : colours ? `按零件的颜色画（${colours}）` : plain ? "白模" : "蓝色 = 这一步新生成的面，橙色 = 被它修改的面"
    const lines = [`视图：${shots.map((s) => s.label).join("、")}${step}。${legend}${pins.length ? "；圆圈数字 = 备注编号" : ""}。`]
    if (section) lines.push(`剖视：在 ${section.axis} = ${round2(section.at)} 处剖开，去掉了${{ Z: "上面（+Z）", Y: "前面（-Y）", X: "右面（+X）" }[section.axis]}那一侧。`)
    if (whole) {
      const scales = [...new Set(shots.map((s) => s.box ?? null))].map((b) => `${b ? `特写（${sizeText(b)} mm）` : "整件"} 1 px ≈ ${scaleText(mmPerPixel(b ?? whole, H, b ? FOCUS_PADDING : LOOK_PADDING))} mm`)
      lines.push(`整件 ${sizeText(whole)} mm；${scales.join("；")}。小于 3 px 的细节看不清：用 focus（特征 id、{ part } 或 { faces }）放大，用 section 剖开看里面。`)
    }
    if (auto) lines.push("最后一步的改动只占整件的一小块，已自动加了一张特写。")
    return { ok: true, text: lines.join("\n"), images }
  }

  /** The box `look` frames for a feature id, a part (or reference body) by name, or a face selector. */
  private async focusBox(doc: Doc, d: DisplayData, focus: string | { part: string } | { faces: Record<string, unknown> }): Promise<{ box: Box; name: string; facing?: V3 } | { error: string }> {
    if (typeof focus === "string") {
      const f = doc.tree.features.find((x) => x.id === focus)
      if (!f) return { error: `找不到特征「${focus}」` }
      const box = boxOfGroups(d, (g) => g.origin === focus)
      return box ? { box, name: displayName(doc.tree, f) } : { error: `「${displayName(doc.tree, f)}」生成的面现在都不在了（被后面的特征盖掉或切掉了），框不出来：换一个特征，或者用 at 回滚到它那一步看` }
    }
    if ("part" in focus) {
      const k = d.parts?.findIndex((p) => p.name === focus.part) ?? -1
      if (k >= 0) return { box: boxOfGroups(d, (g) => g.part === k)!, name: focus.part }
      const ref = d.refs?.find((r) => r.name === focus.part || r.id === focus.part)
      if (ref) return { box: meshBox(ref.mesh.vertices), name: ref.name }
      const names = [...(d.parts ?? []).map((p) => p.name), ...(d.refs ?? []).map((r) => r.name)]
      return { error: `没有叫「${focus.part}」的零件或参考体${names.length ? `：现在有 ${names.join("、")}` : ""}` }
    }
    const hashes = await this.opts.kernel.locate("face", focus.faces)
    if (!hashes?.length) return { error: `选择器什么都没选中：${JSON.stringify(focus.faces)}` }
    const set = new Set(hashes)
    const box = boxOfGroups(d, (g) => set.has(g.hash))
    // A flat face is framed with some of what is around it, and looked at straight on.
    const facing = facingOf(d, (g) => set.has(g.hash)) ?? undefined
    return box ? { box: padFlat(box), name: `${hashes.length} 个面`, facing } : { error: "选中的面不在显示的这一步里（用了 at 时，focus.faces 按最新一步选）" }
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

  private async exportPart(doc: Doc, input: { path: string; format?: "step" | "stl" | "3mf" | "py" | "json" | "bom" }, ctx: CallContext): Promise<CommandResult> {
    let path = input.path.trim()
    if (!/^([A-Za-z]:)?[\\/]/.test(path) && ctx.cwd) path = `${ctx.cwd.replace(/[\\/]+$/, "")}/${path}`
    const ext = path.split(".").pop()?.toLowerCase()
    const format = input.format ?? (ext === "stp" ? "step" : ext === "md" ? "bom" : ext)
    if (format !== "step" && format !== "stl" && format !== "3mf" && format !== "py" && format !== "json" && format !== "bom")
      return fail("不知道导出成什么：扩展名用 .step / .stl / .3mf / .py / .json / .md（零件清单），或者写 format。")
    let data: string | Uint8Array | null
    if (format === "py") {
      if (isAssembly(doc.path)) return fail("装配不能导出成 build123d 代码：请分别打开每个零件导出")
      data = toBuild123d(this.effective(doc, doc.tree), { title: doc.name })
    } else if (format === "json") data = `${JSON.stringify(doc.tree, null, 2)}\n`
    else if (format === "bom") {
      const report = await this.ensureKernel(doc)
      data = bomText(doc, report, new Map(((await this.opts.kernel.looks?.()) ?? []).map((l) => [l.name, l.look])))
    } else {
      const report = await this.ensureKernel(doc)
      data = await this.opts.kernel.exportBody(format)
      // Several parts: one STL each, zipped.
      if (format === "stl" && (report.parts?.length ?? 0) > 1 && !/\.zip$/i.test(path)) path = path.replace(/\.stl$/i, "") + ".zip"
    }
    if (!data) return fail("还没有实体可以导出。")
    await this.opts.files.write(path, data)
    const bytes = typeof data === "string" ? new TextEncoder().encode(data).length : data.byteLength
    const failed = format === "step" || format === "stl" || format === "3mf" ? doc.report?.features.filter((f) => f.state === "error").length : 0
    return { ok: true, text: `已导出 ${format.toUpperCase()} 到 ${path}（${(bytes / 1024).toFixed(1)} KB）${failed ? `。注意：有 ${failed} 个特征失败，导出的是最后一个成功的步骤` : ""}` }
  }

  // ------------------------------------------------------------------ picks

  private async requestPick(input: Record<string, unknown>, ctx: CallContext): Promise<CommandResult> {
    if (!this.opts.screen?.()) return fail("要请用户在 Turnery 窗口里点选：先打开 Turnery App。")
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
  private noticeFor(doc: Doc, reader: Reader, skipNewNotes = false) {
    const seen = doc.seen[reader]
    const theirs = doc.changes.filter((c) => c.actor !== reader && (c.seq ?? 0) > seen.seq).reverse()
    const tree = theirs.filter((c) => !c.note)
    // New notes get their own line below; what happened to existing ones (handled, removed) goes here.
    const notes = theirs.filter((c) => c.note === "changed")
    const fresh = skipNewNotes ? [] : doc.notes.notes.filter((n) => n.status === "open" && n.n > seen.note)
    const lines: string[] = []
    if (tree.length) {
      lines.push(`⚠ 自你上次调用以来，模型被改过（以现在的状态为准，不要改回去）：`)
      for (const c of tree.slice(-8)) lines.push(`- ${BY[c.actor]}：${c.summary}`)
      lines.push(`现在是第 ${doc.rev} 版。`)
    }
    if (notes.length) lines.push(`备注有变化：${notes.slice(-6).map((c) => `${c.actor === "user" ? "用户" : WHO[c.actor]}${c.summary}`).join("；")}。`)
    if (fresh.length) lines.push(`◆ 用户在窗口里留了 ${fresh.length} 条新备注：${fresh.map((n) => `${n.id}「${clip(n.text)}」`).join("、")}。用 get_notes 读详情。`)
    return lines.join("\n")
  }

  /** The agent has seen the part as it is now. */
  private markSeen(doc: Doc, reader: Reader) {
    doc.seen[reader] = { seq: doc.seq, note: Math.max(doc.seen[reader].note, ...doc.notes.notes.map((n) => n.n)) }
  }

  dispose() {
    this.disposed = true
    for (const d of this.docs.values()) {
      d.unwatch()
      for (const stop of d.assetWatch.values()) stop()
    }
    this.settlePick(null)
  }
}

function pickResult(answer: PickAnswer): CommandResult {
  const lines = ["用户在窗口里点了：", ...pickLines({ ...answer.info, point: answer.info.point as V3 })]
  if (answer.text?.trim()) lines.push(`- 用户补充：${answer.text.trim()}`)
  return { ok: true, text: lines.join("\n") }
}

/** The parts list: one row per part file (a component used twice counts 2), with volume and size. */
function bomText(doc: Doc, report: BuildReport, looks: Map<string, Look> = new Map()) {
  const asm = isAssembly(doc.path)
  // What each component (by the name its parts carry) is: a file, or a standard part by its designation.
  const what = new Map<string, { file: string; std?: string }>()
  for (const f of doc.tree.features) {
    if (f.op !== "component") continue
    let std: string | undefined
    if (f.standard) {
      try {
        const len = f.standard.length
        std = designation({ ...f.standard, length: len === undefined ? undefined : evalNum(len, report.params) }).name
      } catch {
        std = undefined
      }
    }
    what.set(componentName(f), { file: f.file ?? "标准件", std })
  }
  const parts = report.parts ?? (report.body ? [{ name: doc.name, volume: report.body.volume, size: report.body.size }] : [])
  // An unsplit body is listed under the file's name: its one look is the only entry.
  const lookOf = (name: string) => looks.get(name) ?? (looks.size === 1 ? [...looks.values()][0] : undefined)
  const colour = (l: Look | undefined) => (l && isSet(l) ? lookText(l) : l?.fileColor ? `${colorName(l.fileColor)}（STEP 自带）` : "—")
  const rows = new Map<string, { name: string; file: string; count: number; volume: number; size: number[]; look: string }>()
  for (const p of parts) {
    // 「螺钉#3/垫圈」: component 螺钉, its third copy, the part 垫圈 of it.
    const comp = p.name.split("/")[0]
    const base = comp.replace(/#\d+$/, "")
    const sub = p.name.slice(comp.length)
    const w = asm ? what.get(base) : undefined
    const file = asm ? (w?.file ?? "") : doc.path.split(/[\\/]/).pop()!
    const look = colour(lookOf(p.name))
    // The same part in two colours is two rows: they are bought or printed apart.
    const key = `${!asm ? p.name : w?.std ? `std|${w.std}` : `${file}|${sub}`}|${look}`
    const name = w?.std ?? (asm ? `${base}${sub}` : p.name)
    const row = rows.get(key)
    if (row) row.count += 1
    else rows.set(key, { name, file, count: 1, volume: p.volume, size: p.size, look })
  }
  const r1 = (x: number) => Math.round(x * 10) / 10
  const lines = [
    `# 零件清单：${doc.name}`,
    "",
    "| 序号 | 名称 | 文件 | 数量 | 颜色 | 单件体积 (cm³) | 外形 (mm) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...[...rows.values()].map((r, i) => `| ${i + 1} | ${r.name} | ${r.file} | ${r.count} | ${r.look} | ${Math.round(r.volume / 10) / 100} | ${r.size.map(r1).join(" × ")} |`),
    "",
    `共 ${[...rows.values()].reduce((n, r) => n + r.count, 0)} 件。`,
    "",
  ]
  return lines.join("\n")
}

/** 「橙：上盖；黑 · 金属：螺钉#1、螺钉#2」: which colour is which part in the pictures (empty: all plain). */
function lookLegend(d: DisplayData, hide: string[]) {
  const entries = d.parts ? d.parts.filter((p) => !p.hidden && !hide.includes(p.name)).map((p) => ({ name: p.name, look: p.look })) : [{ name: "", look: d.look }]
  if (entries.every((e) => !e.look || (!isSet(e.look) && e.look.source === "part" && !e.look.fileColor))) return ""
  const groups = new Map<string, string[]>()
  for (const e of entries) {
    const key =
      e.look && isSet(e.look)
        ? lookText(e.look)
        : e.look?.fileColor
          ? `STEP 文件自带的颜色（主要是${colorWord(e.look.fileColor)}）`
          : e.look?.source === "standard"
            ? "金属灰（标准件，没设颜色）"
            : e.look?.source === "step"
              ? "深灰（外购件，没设颜色）"
              : "白模（没设颜色）"
    groups.set(key, [...(groups.get(key) ?? []), e.name])
  }
  const names = (list: string[]) => (list.length > 4 ? `${list.slice(0, 4).join("、")} 等 ${list.length} 个` : list.join("、"))
  return [...groups].map(([k, list]) => (list.some(Boolean) ? `${k}：${names(list)}` : k)).join("；")
}

export function measureText(res: MeasureResult) {
  const KIND = { face: "面", edge: "边", feature: "特征", part: "零件" } as const
  const items = res.items.map((i, k) => `${res.items.length > 1 ? (k ? "B" : "A") + "：" : ""}${KIND[i.kind]} · ${i.what} · ${i.facts.join("，")}`)
  const between = res.between.map((b) => `${b.name}：${b.value}`)
  return [...items, ...between].join("\n")
}

const round2 = (x: number) => Math.round(x * 100) / 100

/** Bounding box of a flat vertex array. */
function meshBox(v: Float32Array): Box {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity]
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < v.length; i += 3)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], v[i + a])
      hi[a] = Math.max(hi[a], v[i + a])
    }
  return [lo, hi]
}

/** All reference bodies together (when there is no solid yet). */
function refsBox(d: DisplayData): Box | null {
  if (!d.refs?.length) return null
  const boxes = d.refs.map((r) => meshBox(r.mesh.vertices))
  return [[0, 1, 2].map((a) => Math.min(...boxes.map((b) => b[0][a]))), [0, 1, 2].map((a) => Math.max(...boxes.map((b) => b[1][a])))] as Box
}

/** A file an `import` names, relative to the part's folder (or absolute). */
export function assetPath(dir: string, file: string) {
  const f = file.trim().replace(/\\/g, "/")
  return /^([A-Za-z]:)?\//.test(f) ? f : `${dir.replace(/[\\/]+$/, "")}/${f.replace(/^\.\//, "")}`
}
