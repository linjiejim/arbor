// Arbor: the desktop workbench. Types shared by the engine (Electron main
// process, or in-process in the CLI), the preload bridge, the renderer and the
// MCP / CLI front ends. No runtime code beyond constants.
import type { PickInfo } from "../../studio/annotations"
import type { Tree } from "../../studio/dsl"
import type { BuildReport, DisplayData } from "../../studio/kernel/build"
import type { MeasureTarget } from "../../studio/kernel/measure"

export type V3 = [number, number, number]

/** Who changed the model: the coding agent (MCP / CLI), the person in the window, or someone editing the file. */
export type Actor = "agent" | "user" | "file"

/** One line of the activity list. `note`: about a note, not the tree (no new version). */
export type Change = { rev: number; actor: Actor; at: number; summary: string; note?: "added" | "changed"; seq?: number }

/** A note the person pinned on a face or edge, for the agent to pick up. */
export type PartNote = {
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

export type PartSummary = { path: string; name: string; features: number; openNotes: number; error?: string }

/** One open part as the window sees it. */
export type DocState = {
  path: string
  name: string
  tree: Tree
  rev: number
  report: BuildReport | null
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

export type AgentActivity = { busy: boolean; tool: string | null; at: number | null }

export type Snapshot = { parts: PartSummary[]; active: string | null; kernel: KernelPhase; agent: AgentActivity }

/** The agent asks the person to click a face or an edge. */
export type PickRequest = { id: string; path: string; prompt: string; kind: "face" | "edge" | "any" }

/** The agent asks the window to point something out. */
export type ShowRequest = { path: string; feature?: string; kind?: "face" | "edge"; hashes?: number[]; label?: string; clear?: boolean }

export type Pin = { n: number; point: V3 }

export type LookRequest = { display: DisplayData; views: string[]; highlight?: string; pins: Pin[] }

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
  | { op: "export"; format: "step" | "stl"; index?: number }

export type AgentSetup = {
  /** The `arbor` command on this machine. */
  bin: string
  claude: string
  codex: string
  /** For agents configured with a JSON file (Cursor, Claude Desktop, …). */
  json: string
}

/** What the preload script exposes to the window as `window.arbor`. */
export interface ArborBridge {
  state(): Promise<{ snapshot: Snapshot; doc: DocState | null; pick: PickRequest | null }>
  subscribe(cb: (e: EngineEvent) => void): () => void
  call(command: string, input: Record<string, unknown>, part?: string): Promise<CommandResult>
  kernel(path: string, call: KernelCall): Promise<unknown>
  /** The engine asks the window to render views for `look`. */
  onLook(render: (req: LookRequest) => Promise<string[]>): () => void
  answerPick(id: string, answer: { info: PickInfo; text?: string } | null): Promise<void>
  openPart(): Promise<string | null>
  newPart(): Promise<string | null>
  reveal(path: string): Promise<void>
  /** Save dialog, then export the current part. */
  exportPart(format: ExportFormat): Promise<void>
  agentSetup(): Promise<AgentSetup>
  copy(text: string): Promise<void>
  /** A menu item or the dock asked for something. */
  onMenu(cb: (action: MenuAction) => void): () => void
  platform: string
}

export type MenuAction = "undo" | "redo" | "agent-setup"

export type ExportFormat = "step" | "stl" | "py" | "json"

export type { BuildReport, DisplayData, PickInfo, Tree }

export const PRODUCT = "Arbor"
/** File name endings Arbor owns. */
export const PART_EXT = ".arbor.json"
export const NOTES_EXT = ".notes.json"
