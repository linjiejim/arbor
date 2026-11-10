// `window.turnery`, set up by the Electron preload script. Opened anywhere else
// (a plain browser), every call fails and the page says where to open it.
import type { TurneryBridge } from "./core/protocol"

declare global {
  interface Window {
    turnery?: TurneryBridge
  }
}

export const inApp = typeof window !== "undefined" && Boolean(window.turnery)

const missing = () => Promise.reject(new Error("只能在 Turnery App 里使用"))

export const turnery: TurneryBridge =
  window.turnery ??
  ({
    state: missing,
    subscribe: () => () => {},
    call: missing,
    kernel: missing,
    onLook: () => () => {},
    answerPick: missing,
    openPart: missing,
    newPart: missing,
    newProject: missing,
    openProject: missing,
    openProjectAt: missing,
    recentProjects: () => Promise.resolve([]),
    openExample: missing,
    models: () => Promise.resolve({ current: null, presets: [], keysEncrypted: false }),
    saveModel: missing,
    assistantSend: missing,
    assistantStop: () => Promise.resolve(),
    onAssistant: () => () => {},
    chats: () => Promise.resolve([]),
    chatRead: () => Promise.resolve(null),
    chatSave: missing,
    chatRename: missing,
    chatDelete: missing,
    pickFile: missing,
    reveal: missing,
    exportPart: missing,
    agentSetup: missing,
    copy: missing,
    onMenu: () => () => {},
    update: () => Promise.resolve({ phase: "idle" }),
    onUpdate: () => () => {},
    onNotice: () => () => {},
    restartToUpdate: missing,
    platform: "web",
  } satisfies TurneryBridge)
