// Turnery's main process: one workspace per window (an engine with its own kernel
// thread, so projects in different windows never wait on each other), the local
// endpoint the MCP server and CLI talk to, and the windows that show it all.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, net, protocol, shell, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions, type OpenDialogOptions, type SaveDialogOptions } from "electron"
import { copyFileSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { normalizePartPath, type Screen } from "../../../app/src/desktop/core/engine"
import { inside } from "../../../app/src/desktop/core/project"
import { PART_EXT, PRODUCT, type CallContext, type ExportFormat, type KernelCall, type LookRequest, type MenuAction, type PickInfo, type RecentProject, type Snapshot } from "../../../app/src/desktop/core/protocol"
import { addRecentProject, adoptLegacyHome, clearEngineInfo, HOME, PROJECTS_DIR, projectStamp, readRecent, readRecentProjects, readSettings, writeAppInfo, writeEngineInfo, writeSettings } from "../engine/home"
import { startEngine } from "../engine/host"
import { serveEngine } from "../engine/rpc"
import { agentSetup } from "./setup"
import { wireAssistant } from "./assistant"
import { createUpdater } from "./updater"

declare const __TURNERY_VERSION__: string

const distDir = new URL("./", import.meta.url)
const DIST = fileURLToPath(distDir)
const RENDERER_DIR = path.join(DIST, "renderer")
/** Dev: the Vite server for the window (`npm run dev`). */
const RENDERER_URL = process.env.TURNERY_RENDERER_URL
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'"

app.setName(PRODUCT)
// A separate TURNERY_HOME (tests, a second copy from source) is a separate app: its own single-instance lock and window state.
if (process.env.TURNERY_HOME) app.setPath("userData", path.join(HOME, "electron"))
protocol.registerSchemesAsPrivileged([{ scheme: "turnery", privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }])

/** Files passed as `--open <path>` (the CLI, a second launch). */
function filesIn(argv: string[]) {
  const out: string[] = []
  argv.forEach((a, i) => {
    if (argv[i - 1] === "--open") out.push(a)
  })
  return out
}

/**
 * `--headless`: no window shows and there is no Dock icon; agents' `look` still renders in a hidden
 * window. The person running Turnery (or `turnery open`), or an agent's request_pick, brings the windows up.
 */
let headless = process.argv.includes("--headless")
if (headless) app.dock?.hide()
/** A headless app nobody calls quits after this long. */
const HEADLESS_IDLE_MS = 30 * 60_000
/** A window closed while an agent works in it keeps its engine this long after the agent's last call. */
const AGENT_GRACE_MS = 10 * 60_000
const MIN_ZOOM = -3
const MAX_ZOOM = 4

const pendingOpen: string[] = [...filesIn(process.argv)]
// Finder: double-clicking an .turnery.json, or dropping it on the dock icon. Can come before `ready`.
app.on("open-file", (e, file) => {
  e.preventDefault()
  if (engineReady) void openForUser(focused(), file)
  else pendingOpen.push(file)
})

let engineReady = false
let lastAgentCall = Date.now()

// ---------------------------------------------------------------- workspaces

type Look = { resolve: (images: string[]) => void; reject: (e: Error) => void }
type Started = ReturnType<typeof startEngine>

/** A window and the engine behind it: one project, its open files, its own kernel thread. */
type Workspace = {
  id: number
  engine: Started["engine"]
  kernel: Started["kernel"]
  win: BrowserWindow | null
  ready: Promise<void>
  markReady: () => void
  looks: Map<number, Look>
  focusedAt: number
  agentAt: number
  dispose: () => void
}

const workspaces: Workspace[] = []
/** Which workspace each agent (MCP session) works in. */
const sessions = new Map<string, Workspace>()
let wsSeq = 0
let lookSeq = 0

function newWorkspace(): Workspace {
  const ws = { id: ++wsSeq, win: null, ready: Promise.resolve(), markReady: () => {}, looks: new Map(), focusedAt: Date.now(), agentAt: 0 } as unknown as Workspace
  const screen: Screen = { look: (req) => lookIn(ws, req) }
  const { engine, kernel } = startEngine({ distDir, screen: () => screen })
  ws.engine = engine
  ws.kernel = kernel
  let lastRoot: string | null = null
  const off = engine.on((e) => {
    ws.win?.webContents.send("turnery:event", e)
    // The agent waits for a click: bring the window up and ask for attention.
    if (e.type === "pick" && e.request) {
      leaveHeadless()
      void ensureWindow(ws).then((w) => {
        w.show()
        if (process.platform === "darwin") app.dock?.bounce("informational")
      })
    }
    if (e.type === "snapshot") {
      const root = e.snapshot.project?.root ?? null
      if (root && root !== lastRoot) addRecentProject(root)
      if (root !== lastRoot) refreshMenu()
      lastRoot = root
      titleWindow(ws, e.snapshot)
    }
  })
  ws.dispose = () => {
    off()
    const i = workspaces.indexOf(ws)
    if (i >= 0) workspaces.splice(i, 1)
    for (const [s, w] of sessions) if (w === ws) sessions.delete(s)
    engine.dispose()
    void kernel.dispose()
  }
  workspaces.push(ws)
  void kernel.start().catch(() => {})
  return ws
}

/** The window's title (Window menu, Mission Control): the project, else the open file. */
function titleWindow(ws: Workspace, snap: Snapshot) {
  if (!ws.win) return
  const doc = snap.parts.find((p) => p.path === snap.active)
  ws.win.setTitle(snap.project?.name ?? doc?.name ?? PRODUCT)
  if (process.platform === "darwin") ws.win.setRepresentedFilename(snap.project?.root ?? snap.active ?? "")
}

/** The workspace whose window has keyboard focus, else the one used last. */
function focused(): Workspace | null {
  const w = BrowserWindow.getFocusedWindow()
  return workspaces.find((ws) => ws.win && ws.win === w) ?? lastUsed()
}

function lastUsed(): Workspace | null {
  return workspaces.reduce<Workspace | null>((a, b) => (!a || b.focusedAt > a.focusedAt ? b : a), null)
}

/** A workspace with nothing open, to take a project: the focused one first. */
function emptyWorkspace(): Workspace | null {
  const f = focused()
  if (f?.engine.empty) return f
  return workspaces.find((w) => w.engine.empty && w.win) ?? workspaces.find((w) => w.engine.empty) ?? null
}

const canonical = (p: string) => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

/** The workspace with this project folder open (or the project it lies in). */
function projectOwner(root: string) {
  return workspaces.find((w) => {
    const r = w.engine.projectRoot
    return r !== null && (r === root || inside(r, root))
  })
}

function wsOf(e: IpcMainInvokeEvent | IpcMainEvent): Workspace {
  const ws = workspaces.find((w) => w.win && !w.win.isDestroyed() && w.win.webContents === e.sender)
  if (!ws) throw new Error("这个窗口已经关掉了")
  return ws
}

/** A window closed: its workspace goes, unless it's the last one or an agent is still working in it. */
function retire(ws: Workspace) {
  if (ws.win || !workspaces.includes(ws) || workspaces.length <= 1) return
  if (ws.engine.snapshot().agent.busy || Date.now() - ws.agentAt < AGENT_GRACE_MS) return
  ws.dispose()
}

// -------------------------------------------------------------------- windows

const looksDone = (ws: Workspace, why: string) => {
  for (const [id, l] of ws.looks) {
    ws.looks.delete(id)
    l.reject(new Error(why))
  }
}

async function lookIn(ws: Workspace, req: LookRequest) {
  const w = await ensureWindow(ws)
  const id = ++lookSeq
  return new Promise<string[]>((resolve, reject) => {
    ws.looks.set(id, { resolve, reject })
    w.webContents.send("turnery:look", id, req)
    setTimeout(() => {
      if (ws.looks.delete(id)) reject(new Error("窗口没有在 30 秒内画出视图"))
    }, 30_000)
  })
}

function createWindow(ws: Workspace, mode: "focus" | "inactive") {
  // A second window opens a little down and to the right of the one in front.
  const front = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const at = front && !front.isFullScreen() ? front.getBounds() : null
  const w = new BrowserWindow({
    width: at?.width ?? 1440,
    height: at?.height ?? 900,
    ...(at ? { x: at.x + 28, y: at.y + 28 } : {}),
    minWidth: 980,
    minHeight: 620,
    title: PRODUCT,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#191919" : "#ffffff",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    // backgroundThrottling off: the agent changes the model while the window sits behind a terminal (or
    // never shows, headless); keep it current and able to render `look`.
    webPreferences: { preload: path.join(DIST, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
  })
  ws.win = w
  ws.ready = new Promise((r) => (ws.markReady = r))
  w.once("ready-to-show", () => {
    if (headless) return
    if (mode === "inactive") w.showInactive()
    else w.show()
  })
  // The title says which project this window is (the page's own <title> would make every window 「Turnery」).
  w.on("page-title-updated", (e) => e.preventDefault())
  w.webContents.on("did-finish-load", () => {
    const zoom = readSettings().zoom
    if (zoom) w.webContents.setZoomLevel(zoom)
  })
  // Back from the editor or the terminal: files may have been added to the project.
  w.on("focus", () => {
    ws.focusedAt = Date.now()
    void ws.engine.run("scan_project", {}, userCtx())
  })
  w.on("closed", () => {
    if (ws.win === w) ws.win = null
    looksDone(ws, "窗口关掉了")
    retire(ws)
  })
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: "deny" }
  })
  w.webContents.on("will-navigate", (e, url) => {
    const own = RENDERER_URL ? url.startsWith(new URL(RENDERER_URL).origin) : url.startsWith("turnery://app/")
    if (own) return
    e.preventDefault()
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })
  void w.loadURL(RENDERER_URL ?? "turnery://app/desktop.html")
  titleWindow(ws, ws.engine.snapshot())
  return w
}

/** The workspace's window, made (without taking focus) when an agent needs one and the person closed it. */
async function ensureWindow(ws: Workspace) {
  if (!ws.win) createWindow(ws, "inactive")
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Turnery 窗口没有在 20 秒内准备好")), 20_000)
  })
  try {
    await Promise.race([ws.ready, late])
  } finally {
    clearTimeout(timer)
  }
  if (!ws.win) throw new Error("Turnery 窗口刚被关掉了")
  return ws.win
}

/** Bring a workspace's window to the front (made if needed). */
function present(ws: Workspace) {
  if (!ws.win) createWindow(ws, "focus")
  else if (!headless) {
    if (ws.win.isMinimized()) ws.win.restore()
    ws.win.show()
    ws.win.focus()
  }
  ws.focusedAt = Date.now()
}

/** The person is here: show the Dock icon and every window. */
function leaveHeadless() {
  if (!headless) return
  headless = false
  void app.dock?.show()
  const shown = workspaces.filter((w) => w.win)
  for (const ws of shown) ws.win!.show()
  if (!shown.length) present(lastUsed() ?? newWorkspace())
}

/** The person's menu and window actions. */
const userCtx = (part?: string): CallContext => ({ actor: "user", part })

// -------------------------------------------------------- where calls go

/**
 * An agent's call goes to the window of the project it's about: the one that has the file or folder
 * open, else the agent's own window (open_project of another project: an empty window or a new one),
 * else an empty one, else a new one. An agent stays with its window.
 */
async function agentRun(command: string, input: unknown, ctx: CallContext) {
  lastAgentCall = Date.now()
  const ws = await routeAgent(command, input, ctx)
  ws.agentAt = Date.now()
  if (ctx.session) sessions.set(ctx.session, ws)
  return ws.engine.run(command, input, ctx)
}

async function routeAgent(command: string, input: unknown, ctx: CallContext): Promise<Workspace> {
  const bound = ctx.session ? sessions.get(ctx.session) : undefined
  const mine = bound && workspaces.includes(bound) ? bound : undefined
  const named = (input as { path?: unknown } | null)?.path
  const project = command === "open_project" && typeof named === "string" && named.trim() ? canonical(path.resolve(ctx.cwd ?? os.homedir(), named.trim())) : null
  const file = command === "open_part" && typeof named === "string" && named.trim() ? named : command !== "open_project" ? ctx.part : undefined
  if (project) {
    const owner = projectOwner(project)
    if (owner) return owner
    if (mine?.engine.empty) return mine
    return fresh()
  }
  if (file) {
    const p = normalizePartPath(file, ctx.cwd)
    const owner = workspaces.find((w) => w.engine.owns(p))
    if (owner) return owner
    // A file outside every open project: the agent's own window follows it (only open_project opens another window).
    if (mine) return mine
    const ws = fresh()
    // Its window was closed and its engine let go: open the file again so the new window shows it.
    if (command !== "open_part") await ws.engine.run("open_part", { path: p }, { ...ctx, part: undefined })
    return ws
  }
  return mine ?? lastUsed() ?? fresh()
}

/** An empty workspace (its window shown without taking focus), or a new one. */
function fresh() {
  const ws = emptyWorkspace() ?? newWorkspace()
  if (!ws.win) createWindow(ws, "inactive")
  return ws
}

/** Where a project the person opens goes: the window that has it, this one when it's empty, else a new window. */
function projectWindow(from: Workspace | null, root: string) {
  const owner = projectOwner(canonical(root))
  if (owner && owner.engine.projectRoot === canonical(root)) return owner
  if (from?.engine.empty) return from
  return emptyWorkspace() ?? newWorkspace()
}

async function openProjectAt(from: Workspace | null, root: string, create = false) {
  const ws = projectWindow(from, root)
  present(ws)
  if (ws.engine.projectRoot === canonical(root) && !create) return true
  const out = await ws.engine.run("open_project", { path: root, create }, userCtx())
  if (!out.ok) void dialog.showMessageBox({ type: "warning", message: create ? "没能新建项目" : "没能打开项目", detail: out.text.replace(/^✗ /, "") })
  return out.ok
}

async function openForUser(from: Workspace | null, file: string, create = false) {
  const p = normalizePartPath(path.resolve(file))
  const ws =
    workspaces.find((w) => w.engine.owns(p)) ??
    (from && (from.engine.empty || !from.engine.projectRoot || inside(from.engine.projectRoot, canonical(path.dirname(p)))) ? from : (emptyWorkspace() ?? newWorkspace()))
  present(ws)
  const res = await ws.engine.openForUser(p, create)
  if (!res.ok) void dialog.showMessageBox({ type: "warning", message: "打不开这个零件", detail: res.text.replace(/^✗ /, "") })
  refreshMenu()
  return res.ok
}

/**
 * The example that ships with the app (dist/examples): copied into ~/.turnery/projects the first time,
 * so what the person changes in it is theirs and the app bundle stays as it was signed.
 */
const EXAMPLE = { dir: "sensor-enclosure", part: "enclosure.turnery.json" }
async function openExample(from: Workspace | null) {
  const dest = path.join(PROJECTS_DIR, EXAMPLE.dir)
  const file = path.join(dest, EXAMPLE.part)
  try {
    if (!existsSync(file)) {
      mkdirSync(dest, { recursive: true })
      copyFileSync(path.join(DIST, "examples", EXAMPLE.dir, EXAMPLE.part), file)
    }
  } catch (err) {
    void dialog.showMessageBox({ type: "warning", message: "没能打开示例", detail: err instanceof Error ? err.message : String(err) })
    return false
  }
  return (await openProjectAt(from, dest)) && (await openForUser(workspaces.find((w) => w.engine.projectRoot === canonical(dest)) ?? from, file))
}

// -------------------------------------------------------------------- dialogs

const saveDialog = (ws: Workspace | null, o: SaveDialogOptions) => (ws?.win ? dialog.showSaveDialog(ws.win, o) : dialog.showSaveDialog(o))
const openDialog = (ws: Workspace | null, o: OpenDialogOptions) => (ws?.win ? dialog.showOpenDialog(ws.win, o) : dialog.showOpenDialog(o))

async function newPartDialog(ws: Workspace | null) {
  const project = ws?.engine.snapshot().project
  const dir = project ? path.join(project.root, "parts") : PROJECTS_DIR
  mkdirSync(PROJECTS_DIR, { recursive: true })
  const res = await saveDialog(ws, {
    title: "新建零件",
    defaultPath: path.join(dir, `零件${PART_EXT}`),
    filters: [{ name: "Turnery 零件", extensions: ["json"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  })
  if (res.canceled || !res.filePath) return null
  const file = res.filePath.endsWith(".json") ? res.filePath : `${res.filePath}${PART_EXT}`
  return (await openForUser(ws, file, true)) ? file : null
}

/** A new project folder: in ~/.turnery/projects, named by the time unless the person types a name. */
async function newProjectDialog(ws: Workspace | null) {
  mkdirSync(PROJECTS_DIR, { recursive: true })
  const res = await saveDialog(ws, {
    title: "新建项目",
    message: "项目是一个文件夹：里面放装配、零件和共用的参数",
    nameFieldLabel: "项目名",
    defaultPath: path.join(PROJECTS_DIR, projectStamp()),
    properties: ["createDirectory", "showOverwriteConfirmation"],
  })
  if (res.canceled || !res.filePath) return null
  return (await openProjectAt(ws, res.filePath, true)) ? res.filePath : null
}

async function openProjectDialog(ws: Workspace | null) {
  const res = await openDialog(ws, { title: "打开项目文件夹", defaultPath: existsSync(PROJECTS_DIR) ? PROJECTS_DIR : undefined, properties: ["openDirectory", "createDirectory"] })
  if (res.canceled || !res.filePaths[0]) return null
  return (await openProjectAt(ws, res.filePaths[0])) ? res.filePaths[0] : null
}

/** Something to put in the open assembly: a part or assembly file, or a STEP. */
async function pickFileDialog(ws: Workspace, kind: "part" | "step") {
  const doc = ws.engine.docState()
  const res = await openDialog(ws, {
    title: kind === "step" ? "选一个 STEP 文件" : "选一个零件或装配",
    defaultPath: doc ? path.dirname(doc.path) : undefined,
    filters: kind === "step" ? [{ name: "STEP", extensions: ["step", "stp"] }] : [{ name: "Turnery 零件和装配", extensions: ["json"] }],
    properties: ["openFile"],
  })
  return res.canceled ? null : (res.filePaths[0] ?? null)
}

/** A part, an assembly, or a project folder. */
async function openPartDialog(ws: Workspace | null) {
  const res = await openDialog(ws, {
    title: "打开零件、装配或项目文件夹",
    filters: [{ name: "Turnery 零件和装配", extensions: ["json"] }],
    properties: ["openFile", "openDirectory"],
  })
  const picked = res.canceled ? null : res.filePaths[0]
  if (!picked) return null
  if (statSync(picked, { throwIfNoEntry: false })?.isDirectory()) return (await openProjectAt(ws, picked)) ? picked : null
  return (await openForUser(ws, picked)) ? picked : null
}

const EXPORT_NAMES: Record<ExportFormat, string> = { step: "STEP", stl: "STL", "3mf": "3MF", py: "build123d 代码", json: "特征树 JSON" }

async function exportDialog(ws: Workspace | null, format: ExportFormat) {
  const doc = ws?.engine.docState()
  if (!ws || !doc) return
  const res = await saveDialog(ws, {
    title: `导出 ${EXPORT_NAMES[format]}`,
    defaultPath: path.join(path.dirname(doc.path), `${doc.name}${format === "json" ? "-export" : ""}.${format}`),
  })
  if (res.canceled || !res.filePath) return
  const out = await ws.engine.run("export", { path: res.filePath, format }, userCtx(doc.path))
  if (!out.ok) void dialog.showMessageBox({ type: "warning", message: "导出失败", detail: out.text })
  else shell.showItemInFolder(res.filePath)
}

/** The start page's list: project folders opened lately that are still there. */
function recentProjects(): RecentProject[] {
  // Scratch folders (tests, an agent's throwaway work) aren't worth listing.
  const tmp = canonical(os.tmpdir())
  return readRecentProjects()
    .filter((p) => existsSync(p) && !inside(tmp, p) && !inside("/private/var/folders", p))
    .slice(0, 8)
    .map((root) => ({ root, name: path.basename(root) }))
}

/** Back to the start page: this window's project and files close (the files stay as they are). */
async function goHome(ws: Workspace | null) {
  if (ws) await ws.engine.run("close_project", {}, userCtx())
}

// ---------------------------------------------------------------- the menu

const updater = createUpdater({
  status: (s) => {
    for (const ws of workspaces) ws.win?.webContents.send("turnery:update", s)
  },
  // The answer to 检查更新…: in the window in front when there is one, otherwise a dialog.
  notice: (n) => {
    const ws = focused()
    if (ws?.win) ws.win.webContents.send("turnery:notice", n)
    else void dialog.showMessageBox({ type: n.tone === "error" ? "warning" : "info", message: n.text })
  },
})

function send(action: MenuAction) {
  focused()?.win?.webContents.send("turnery:menu", action)
}

/** ⌘= / ⌘- / ⌘0: the whole window, every window (they share one origin), kept for the next launch. */
function zoom(step: -1 | 0 | 1) {
  const front = focused()?.win ?? BrowserWindow.getAllWindows()[0]
  const level = step === 0 ? 0 : Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (front?.webContents.getZoomLevel() ?? 0) + step * 0.5))
  for (const ws of workspaces) ws.win?.webContents.setZoomLevel(level)
  writeSettings({ ...readSettings(), zoom: level })
}

/** The `turnery` executable: inside the app bundle when packaged, the repo's bin/ in development. */
function turneryBin() {
  return app.isPackaged ? path.join(process.resourcesPath, "bin", "turnery") : path.join(app.getAppPath(), "bin", "turnery")
}

let menuKey: string | null = null

/** The app menu; rebuilt only when the recent lists change (the engines send snapshots on every agent call). */
function refreshMenu() {
  const mac = process.platform === "darwin"
  const projects = recentProjects()
  const paths = readRecent()
    .filter((p) => existsSync(p) && !projects.some((r) => inside(r.root, p)))
    .slice(0, 10)
  const key = [...projects.map((p) => p.root), "", ...paths].join("\n")
  if (key === menuKey) return
  menuKey = key
  const tilde = (p: string) => p.replace(os.homedir(), "~")
  const recent: MenuItemConstructorOptions[] = [
    ...projects.map((p) => ({ label: tilde(p.root), click: () => void openProjectAt(focused(), p.root) })),
    ...(projects.length && paths.length ? [{ type: "separator" as const }] : []),
    ...paths.map((p) => ({ label: tilde(p), click: () => void openForUser(focused(), p) })),
  ]
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: PRODUCT,
            submenu: [
              { role: "about" as const },
              { label: "检查更新…", click: () => void updater.check(true) },
              {
                label: "自动检查更新",
                type: "checkbox" as const,
                checked: updater.supported && updater.autoUpdate,
                enabled: updater.supported,
                click: (item: Electron.MenuItem) => updater.setAutoUpdate(item.checked),
              },
              { type: "separator" as const },
              { label: "接入 Agent…", click: () => send("agent-setup") },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        { label: "新建项目…", accelerator: "CmdOrCtrl+Shift+N", click: () => void newProjectDialog(focused()) },
        { label: "打开项目…", accelerator: "CmdOrCtrl+Shift+O", click: () => void openProjectDialog(focused()) },
        { label: "新建窗口", accelerator: "CmdOrCtrl+Alt+N", click: () => present(newWorkspace()) },
        { type: "separator" },
        { label: "新建零件…", accelerator: "CmdOrCtrl+N", click: () => void newPartDialog(focused()) },
        { label: "打开…", accelerator: "CmdOrCtrl+O", click: () => void openPartDialog(focused()) },
        { label: "打开最近", enabled: recent.length > 0, submenu: recent },
        { type: "separator" },
        { label: "回到首页", accelerator: "CmdOrCtrl+Shift+H", click: () => void goHome(focused()) },
        { type: "separator" },
        { label: "导出 STEP…", accelerator: "CmdOrCtrl+E", click: () => void exportDialog(focused(), "step") },
        { label: "导出 STL…", accelerator: "CmdOrCtrl+Shift+E", click: () => void exportDialog(focused(), "stl") },
        { label: "导出 3MF…", click: () => void exportDialog(focused(), "3mf") },
        { type: "separator" },
        mac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        // The window decides: undo typing in a field, or undo the last change to the model.
        { label: "撤销", accelerator: "CmdOrCtrl+Z", click: () => send("undo") },
        { label: "重做", accelerator: "Shift+CmdOrCtrl+Z", click: () => send("redo") },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "视图",
      submenu: [
        ...(app.isPackaged ? [] : [{ role: "reload" as const }, { role: "toggleDevTools" as const }, { type: "separator" as const }]),
        { label: "实际大小", accelerator: "CmdOrCtrl+0", click: () => zoom(0) },
        { label: "放大", accelerator: "CmdOrCtrl+=", click: () => zoom(1) },
        // ⌘+ (with Shift on most keyboards) and the keypad do the same, without more rows in the menu.
        { label: "放大", accelerator: "CmdOrCtrl+Plus", visible: false, acceleratorWorksWhenHidden: true, click: () => zoom(1) },
        { label: "放大", accelerator: "CmdOrCtrl+numadd", visible: false, acceleratorWorksWhenHidden: true, click: () => zoom(1) },
        { label: "缩小", accelerator: "CmdOrCtrl+-", click: () => zoom(-1) },
        { label: "缩小", accelerator: "CmdOrCtrl+numsub", visible: false, acceleratorWorksWhenHidden: true, click: () => zoom(-1) },
        { type: "separator" },
        // The 3D view's one-letter keys (V C R P M X D E A F H I, ? for all) live in the window, not here:
        // a menu shortcut without ⌘ would eat the letter when typing in a field.
        { label: "左栏", accelerator: "CmdOrCtrl+B", click: () => send("toggle-left") },
        { label: "右栏", accelerator: "Alt+CmdOrCtrl+B", click: () => send("toggle-right") },
        { type: "separator" },
        { label: "后退", accelerator: "CmdOrCtrl+[", click: () => send("back") },
        { label: "前进", accelerator: "CmdOrCtrl+]", click: () => send("forward") },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    { role: "help", submenu: [{ label: "接入 Agent…", click: () => send("agent-setup") }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ------------------------------------------------------------------------ IPC

function wireIpc() {
  ipcMain.handle("turnery:state", (e) => {
    const { engine } = wsOf(e)
    return { snapshot: engine.snapshot(), doc: engine.docState(), pick: engine.pickRequest() }
  })
  ipcMain.handle("turnery:call", (e, command: string, input: Record<string, unknown>, part?: string) => wsOf(e).engine.run(command, input, userCtx(part)))
  ipcMain.handle("turnery:kernel", (e, p: string, call: KernelCall) => wsOf(e).engine.kernelCall(p, call))
  ipcMain.handle("turnery:answer-pick", (e, id: string, answer: { info: PickInfo; text?: string } | null) => wsOf(e).engine.answerPick(id, answer))
  ipcMain.handle("turnery:open-part", (e) => openPartDialog(wsOf(e)))
  ipcMain.handle("turnery:new-part", (e) => newPartDialog(wsOf(e)))
  ipcMain.handle("turnery:new-project", (e) => newProjectDialog(wsOf(e)))
  ipcMain.handle("turnery:open-project", (e) => openProjectDialog(wsOf(e)))
  ipcMain.handle("turnery:open-project-at", (e, root: string) => openProjectAt(wsOf(e), String(root)))
  ipcMain.handle("turnery:recent-projects", () => recentProjects())
  ipcMain.handle("turnery:open-example", (e) => openExample(wsOf(e)))
  wireAssistant(ipcMain, (e) => wsOf(e).engine)
  ipcMain.handle("turnery:pick-file", (e, kind: "part" | "step") => pickFileDialog(wsOf(e), kind === "step" ? "step" : "part"))
  ipcMain.handle("turnery:reveal", (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.handle("turnery:export", (e, format: ExportFormat) => exportDialog(wsOf(e), format))
  ipcMain.handle("turnery:agent-setup", () => agentSetup(turneryBin()))
  ipcMain.handle("turnery:copy", (_e, text: string) => clipboard.writeText(String(text)))
  ipcMain.handle("turnery:update", () => updater.status())
  ipcMain.handle("turnery:restart-to-update", () => updater.restart())
  ipcMain.on("turnery:renderer-ready", (e) => workspaces.find((w) => w.win?.webContents === e.sender)?.markReady())
  ipcMain.on("turnery:look-done", (e, id: number, res: { images?: string[]; error?: string }) => {
    const ws = workspaces.find((w) => w.win?.webContents === e.sender)
    const l = ws?.looks.get(id)
    if (!ws || !l) return
    ws.looks.delete(id)
    if (res.images) l.resolve(res.images)
    else l.reject(new Error(res.error ?? "窗口没有画出视图"))
  })
}

// ---------------------------------------------------------------------- start

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  adoptLegacyHome()
  app.on("second-instance", (_e, argv) => {
    // Another agent starting the app: it's already here, nothing to show.
    if (argv.includes("--from-agent")) return
    leaveHeadless()
    const files = filesIn(argv)
    if (files.length) for (const f of files) void openForUser(focused(), f)
    else present(focused() ?? newWorkspace())
  })

  void app.whenReady().then(async () => {
    protocol.handle("turnery", async (req) => {
      const url = new URL(req.url)
      const file = path.normalize(path.join(RENDERER_DIR, decodeURIComponent(url.pathname)))
      if (!file.startsWith(RENDERER_DIR + path.sep)) return new Response("not found", { status: 404 })
      const res = await net.fetch(pathToFileURL(file).toString())
      const headers = new Headers(res.headers)
      headers.set("Content-Security-Policy", CSP)
      return new Response(res.body, { status: res.status, headers })
    })
    wireIpc()
    const fromAgent = process.argv.includes("--from-agent") || headless
    const first = newWorkspace()
    refreshMenu()
    const rpc = await serveEngine(agentRun, __TURNERY_VERSION__)
    writeEngineInfo({ port: rpc.port, token: rpc.token, pid: process.pid, version: __TURNERY_VERSION__, startedAt: Date.now() })
    writeAppInfo({ exec: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] })
    engineReady = true
    createWindow(first, fromAgent ? "inactive" : "focus")
    for (const f of pendingOpen.splice(0)) await openForUser(first, f)
    // The person starts Turnery: back where they were. An agent's start leaves the window empty for the agent.
    if (!fromAgent && first.engine.empty) {
      const last = recentProjects()[0]?.root
      const part = readRecent().find((p) => existsSync(p))
      if (last) await first.engine.run("open_project", { path: last }, userCtx())
      else if (part) await first.engine.openForUser(part)
      // The very first start: something to look at and change, once. After that the welcome page offers it.
      else if (!readSettings().exampleShown) {
        writeSettings({ ...readSettings(), exampleShown: true })
        await openExample(first)
      }
    }

    app.on("activate", () => {
      if (headless) return
      const shown = workspaces.filter((w) => w.win)
      if (!shown.length) present(lastUsed() ?? newWorkspace())
    })
    // Windows closed while an agent worked in them; a headless app nobody uses.
    setInterval(() => {
      for (const ws of [...workspaces]) retire(ws)
      if (headless && Date.now() - lastAgentCall > HEADLESS_IDLE_MS && !workspaces.some((w) => w.engine.snapshot().agent.busy)) app.quit()
    }, 60_000).unref()
    updater.start()
    app.on("will-quit", () => {
      updater.installOnQuit()
      clearEngineInfo(process.pid)
      void rpc.close()
      for (const ws of [...workspaces]) ws.dispose()
    })
  })

  // The engines keep serving agents with every window closed (macOS convention); `look` opens a new one.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}
