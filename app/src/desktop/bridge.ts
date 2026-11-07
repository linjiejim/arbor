// `window.arbor`, set up by the Electron preload script. Opened anywhere else
// (a plain browser), every call fails and the page says where to open it.
import type { ArborBridge } from "./core/protocol"

declare global {
  interface Window {
    arbor?: ArborBridge
  }
}

export const inApp = typeof window !== "undefined" && Boolean(window.arbor)

const missing = () => Promise.reject(new Error("只能在 Arbor App 里使用"))

export const arbor: ArborBridge =
  window.arbor ??
  ({
    state: missing,
    subscribe: () => () => {},
    call: missing,
    kernel: missing,
    onLook: () => () => {},
    answerPick: missing,
    openPart: missing,
    newPart: missing,
    reveal: missing,
    exportPart: missing,
    agentSetup: missing,
    copy: missing,
    onMenu: () => () => {},
    platform: "web",
  } satisfies ArborBridge)
