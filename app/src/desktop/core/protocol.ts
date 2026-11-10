// Turnery: the desktop workbench. Types shared by the engine (Electron main
// process, or in-process in the CLI), the preload bridge, the renderer and the
// MCP / CLI front ends. No runtime code beyond constants.
import type { ChatRecord, ChatSummary } from "./chats"
import type { PickInfo } from "../../studio/annotations"
import type { Tree } from "../../studio/dsl"
import type { BuildReport, BuildProgress, DisplayData } from "../../studio/kernel/build"
import type { MeasureTarget } from "../../studio/kernel/measure"
import type { LookSection, LookShot } from "../../studio/look-plan"

export type V3 = [number, number, number]

/** Who changed the model: the coding agent (MCP / CLI), the person in the window, or someone editing the file. */
/** `agent` is an outside agent over MCP or the CLI; `assistant` is the one built into the window. */
export type Actor = "agent" | "assistant" | "user" | "file"

/** One line of the activity list. `note`: about a note, not the tree (no new version). */
export type Change = { rev: number; actor: Actor; at: number; summary: string; note?: "added" | "changed"; seq?: number }

/** A note the person pinned on a face or edge, for the agent to pick up. */
export type PartNote = {
  part?: string
  /** Stable id the agent uses: "n3". */
  id: string
  /** The number on the pin: 3. Never reused within a part. */
  n: number
  /** part: about the part or a feature, not a spot on it (no pin, no selector). */
  kind: "face" | "edge" | "part"
  text: string
  what: string
  where: string
  facts: string
  origins: string[]
  point: V3
  /** Verified to pick exactly that face / edge when the note was written. */
  selector: Record<string, unknown> | null
  sketch: PickInfo["sketch"]
  smooth?: boolean
  status: "open" | "resolved"
  /** What the agent said when it handled the note. */
  reply?: string
  createdAt: number
  resolvedAt?: number
}

export type KernelPhase = { phase: "loading" } | { phase: "ready" } | { phase: "error"; message: string }

export type PartSummary = { path: string; name: string; features: number; openNotes: number; error?: string; kind?: "part" | "assembly" }

/** One open part as the window sees it. */
export type DocState = {
  path: string
  name: string
  /** With the shared parameters merged in (their notes say so). */
  tree: Tree
  kind: "part" | "assembly"
  /** The shared parameter file the part uses: its name and the parameters it holds. */
  shared?: { file: string; names: string[]; error?: string }
  /** Editing inside an assembly: the assembly file and its name. */
  context?: { assembly: string; name: string }
  rev: number
  report: BuildReport | null
  /** Geometry is ready to orbit while the worker finishes exact checks. */
  preview?: DisplayData
  canUndo: boolean
  canRedo: boolean
  /** Latest first. */
  changes: Change[]
  notes: PartNote[]
  /** Number the next note's pin will get. */
  nextNote: number
  /** The file on disk no longer parses; the last good tree stays. */
  error?: string
}

export type AgentActivity = { busy: boolean; tool: string | null; at: number | null; who?: "agent" | "assistant" }

/** A file of the project folder, for the sidebar: open ones carry their notes. */
export type ProjectFile = {
  path: string
  name: string
  /** Folder relative to the project ("" at the top). */
  folder: string
  kind: "part" | "assembly"
  features: number | null
  open: boolean
  openNotes: number
}

/** The folder the open files belong to (see core/project.ts). */
export type ProjectSummary = { root: string; name: string; files: ProjectFile[]; truncated: boolean }

export type LoadState = { path: string; name: string; startedAt: number; progress?: BuildProgress | null }
export type Snapshot = { parts: PartSummary[]; active: string | null; kernel: KernelPhase; agent: AgentActivity; project: ProjectSummary | null; loading?: LoadState | null }

/** The agent asks the person to click a face or an edge. */
export type PickRequest = { id: string; path: string; prompt: string; kind: "face" | "edge" | "any" }

/** The agent asks the window to point something out. */
export type ShowRequest = { path: string; feature?: string; kind?: "face" | "edge"; hashes?: number[]; label?: string; clear?: boolean }

export type Pin = { n: number; point: V3 }

/** `shots` (planned by the engine, look-plan.ts) replace `views` when present. */
export type LookRequest = {
  display: DisplayData
  views: string[]
  highlight?: string
  pins: Pin[]
  shots?: LookShot[]
  section?: LookSection
  /** Parts and reference bodies (by name) left out of the pictures. */
  hide?: string[]
  size?: "normal" | "large"
  /** Without the parts' colours and finishes (a white model). */
  plain?: boolean
}

export type EngineEvent =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "doc"; doc: DocState }
  | { type: "pick"; request: PickRequest | null }
  | { type: "show"; request: ShowRequest }

export type CommandResult = { ok: boolean; text: string; images?: string[] }

/** Context of a command: who runs it and on which part. */
export type CallContext = { actor: Actor; part?: string; session?: string; cwd?: string }

/** Direct kernel calls the window makes to draw, pick and measure. */
export type KernelCall =
  | { op: "display"; index?: number }
  | { op: "pick"; kind: "face" | "edge"; hash: number; point: V3 }
  | { op: "locate"; kind: "face" | "edge"; selector: unknown; before?: number }
  | { op: "selectorFor"; kind: "face" | "edge"; hashes: number[]; before: number }
  | { op: "faceEdges"; hash: number; before: number }
  | { op: "measure"; targets: MeasureTarget[] }
  | { op: "dims" }
  | { op: "drawing"; iso: boolean }
  | { op: "export"; format: "step" | "stl" | "3mf"; index?: number }

export type AgentSetup = {
  /** The `turnery` command on this machine. */
  bin: string
  claude: string
  codex: string
  /** For agents configured with a JSON file (Cursor, Claude Desktop, …). */
  json: string
}

/** What the preload script exposes to the window as `window.turnery`. */
export type RecentProject = { root: string; name: string }

export interface TurneryBridge {
  state(): Promise<{ snapshot: Snapshot; doc: DocState | null; pick: PickRequest | null }>
  subscribe(cb: (e: EngineEvent) => void): () => void
  call(command: string, input: Record<string, unknown>, part?: string): Promise<CommandResult>
  kernel(path: string, call: KernelCall): Promise<unknown>
  /** The engine asks the window to render views for `look`. */
  onLook(render: (req: LookRequest) => Promise<string[]>): () => void
  answerPick(id: string, answer: { info: PickInfo; text?: string } | null): Promise<void>
  openPart(): Promise<string | null>
  newPart(): Promise<string | null>
  /** Save-style dialog for a new project folder, then open_project create. */
  newProject(): Promise<string | null>
  /** Folder dialog, then open_project. */
  openProject(): Promise<string | null>
  /** A project folder from the start page's list (in this window, or the one that has it open). */
  openProjectAt(root: string): Promise<boolean>
  /** Project folders opened lately that still exist, newest first. */
  recentProjects(): Promise<RecentProject[]>
  /** Open the example that ships with the app (a copy under ~/.turnery/projects). */
  openExample(): Promise<boolean>
  /** The built-in assistant's model settings (never the keys themselves). */
  models(): Promise<ModelSettings>
  /** Choose a preset and what to use from it. `key`: left out = keep the stored one; a string replaces it ("" forgets it). */
  saveModel(input: { preset: string; model?: string; baseURL?: string; vision?: boolean | null; key?: string }): Promise<ModelSettings>
  /** Start a turn of the built-in assistant; its stream arrives through onAssistant under the same id. */
  assistantSend(id: string, messages: unknown[]): Promise<void>
  assistantStop(id: string): Promise<void>
  /** Chunks of a turn's UI message stream; `null` ends it. */
  onAssistant(listener: (id: string, chunk: unknown | null) => void): () => void
  /** Saved conversations, newest first: `here` = held in this window's project (or among loose parts). */
  chats(scope: "here" | "all"): Promise<ChatSummary[]>
  chatRead(id: string): Promise<ChatRecord | null>
  /** `base`: messages the window started from; when the saved one has more (another window went on), it is kept and this becomes a copy. Resolves to the id saved under. */
  chatSave(record: ChatRecord, base: number): Promise<string | null>
  chatRename(id: string, title: string): Promise<void>
  chatDelete(id: string): Promise<void>
  /** File dialog for something to put in an assembly: a part or assembly file, or a STEP. */
  pickFile(kind: "part" | "step"): Promise<string | null>
  reveal(path: string): Promise<void>
  /** Save dialog, then export the current part. */
  exportPart(format: ExportFormat): Promise<void>
  agentSetup(): Promise<AgentSetup>
  copy(text: string): Promise<void>
  /** A menu item or the dock asked for something. */
  onMenu(cb: (action: MenuAction) => void): () => void
  /** The self-update: where it is now, and every change after. */
  update(): Promise<UpdateStatus>
  onUpdate(cb: (status: UpdateStatus) => void): () => void
  /** A message for the person (the result of 检查更新…). */
  onNotice(cb: (notice: Notice) => void): () => void
  /** Quit, put the downloaded version in place, start again. */
  restartToUpdate(): Promise<void>
  platform: string
}

/**
 * The self-update. `downloading` is shown only when the person asked (检查更新…);
 * a background download stays quiet until it is `ready`.
 */
export type UpdateStatus =
  | { phase: "idle" }
  | { phase: "downloading"; version: string; percent: number | null; asked: boolean }
  | { phase: "ready"; version: string }

export type Notice = { tone: "info" | "success" | "error"; text: string }

export type MenuAction = "undo" | "redo" | "agent-setup" | "focus"

export type ExportFormat = "step" | "stl" | "3mf" | "py" | "json"

export type { BuildReport, DisplayData, PickInfo, Tree }

/** What the model settings dialog shows for one provider preset. */
export type ModelPreset = { id: string; name: string; defaultModel: string; defaultBaseURL: string; defaultVision: boolean; keyless: boolean; model: string; baseURL: string; vision: boolean | null; hasKey: boolean; keyNote: string }
export type ModelSettings = { current: string | null; presets: ModelPreset[]; keysEncrypted: boolean }

export const PRODUCT = "Turnery"
/** File name endings Turnery owns. */
export const PART_EXT = ".turnery.json"
/** Parts written before the rename from Arbor: still opened, listed and saved under their old name. */
export const LEGACY_PART_EXT = ".arbor.json"
/** The part ending a path carries, new or old (null: neither). */
export const partExtOf = (path: string) => [PART_EXT, LEGACY_PART_EXT].find((e) => path.endsWith(e)) ?? null
export const NOTES_EXT = ".notes.json"
