// The window's only door to the engine: a small typed API on `window.arbor`.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import type { ArborBridge, EngineEvent, LookRequest, MenuAction, Notice, UpdateStatus } from "../../../app/src/desktop/core/protocol"

function listen<T extends unknown[]>(channel: string, cb: (...args: T) => void) {
  const fn = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T))
  ipcRenderer.on(channel, fn)
  return () => void ipcRenderer.removeListener(channel, fn)
}

const bridge: ArborBridge = {
  state: () => ipcRenderer.invoke("arbor:state"),
  subscribe: (cb) => listen<[EngineEvent]>("arbor:event", cb),
  call: (command, input, part) => ipcRenderer.invoke("arbor:call", command, input, part),
  kernel: (path, call) => ipcRenderer.invoke("arbor:kernel", path, call),
  onLook: (render) => {
    const off = listen<[number, LookRequest]>("arbor:look", async (id, req) => {
      try {
        ipcRenderer.send("arbor:look-done", id, { images: await render(req) })
      } catch (e) {
        ipcRenderer.send("arbor:look-done", id, { error: String((e as Error)?.message ?? e) })
      }
    })
    ipcRenderer.send("arbor:renderer-ready")
    return off
  },
  answerPick: (id, answer) => ipcRenderer.invoke("arbor:answer-pick", id, answer),
  openPart: () => ipcRenderer.invoke("arbor:open-part"),
  newPart: () => ipcRenderer.invoke("arbor:new-part"),
  newProject: () => ipcRenderer.invoke("arbor:new-project"),
  openProject: () => ipcRenderer.invoke("arbor:open-project"),
  pickFile: (kind) => ipcRenderer.invoke("arbor:pick-file", kind),
  reveal: (path) => ipcRenderer.invoke("arbor:reveal", path),
  exportPart: (format) => ipcRenderer.invoke("arbor:export", format),
  agentSetup: () => ipcRenderer.invoke("arbor:agent-setup"),
  copy: (text) => ipcRenderer.invoke("arbor:copy", text),
  onMenu: (cb) => listen<[MenuAction]>("arbor:menu", cb),
  update: () => ipcRenderer.invoke("arbor:update"),
  onUpdate: (cb) => listen<[UpdateStatus]>("arbor:update", cb),
  onNotice: (cb) => listen<[Notice]>("arbor:notice", cb),
  restartToUpdate: () => ipcRenderer.invoke("arbor:restart-to-update"),
  platform: process.platform,
}

contextBridge.exposeInMainWorld("arbor", bridge)
