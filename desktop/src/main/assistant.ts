// The built-in assistant, on the main-process side: a turn runs here (the key and the model request
// never reach the window), its stream goes to the window chunk by chunk, and the model settings are
// read and written here.
import { safeStorage, net, type IpcMain, type IpcMainInvokeEvent, type WebContents } from "electron"
import { assistantStream } from "../../../app/src/desktop/core/assistant"
import type { Engine } from "../../../app/src/desktop/core/engine"
import { languageModel, presetOf, PRESETS } from "../../../app/src/desktop/core/providers"
import type { ModelSettings } from "../../../app/src/desktop/core/protocol"
import { currentModel, listModels, setKey, useModel, type SecretBox } from "../engine/models"

/**
 * Keys are encrypted with the system's store only where that works without nagging: an app that is
 * not signed with a stable identity is asked for the keychain again after every update on macOS.
 * Until Turnery is signed, keys stay in ~/.turnery/providers.json as they are (file mode 600).
 */
declare const __TURNERY_SIGNED__: boolean | undefined
function secretBox(): SecretBox {
  const signed = typeof __TURNERY_SIGNED__ !== "undefined" && __TURNERY_SIGNED__
  if ((process.platform === "darwin" && !signed) || !safeStorage.isEncryptionAvailable()) return null
  return {
    encrypt: (text) => safeStorage.encryptString(text).toString("base64"),
    decrypt: (data) => safeStorage.decryptString(Buffer.from(data, "base64")),
  }
}

const KEY_NOTE: Record<string, string> = { env: "来自环境变量", encrypted: "已加密保存", plain: "已保存（明文，文件权限 600）", none: "", "not-needed": "" }

function settings(): ModelSettings {
  const box = secretBox()
  const { current, models } = listModels(box)
  return {
    current,
    presets: PRESETS.map((p) => {
      const m = models.find((x) => x.preset === p.id)
      const key = m?.key ?? (p.keyless ? "not-needed" : "none")
      return { id: p.id, name: p.name, defaultModel: p.model, defaultBaseURL: p.baseURL ?? "", defaultVision: p.vision, keyless: Boolean(p.keyless), model: m?.model ?? "", baseURL: m?.baseURL ?? "", vision: m?.vision ?? null, hasKey: key !== "none", keyNote: KEY_NOTE[key] }
    }),
    keysEncrypted: box !== null,
  }
}

const friendly = (error: unknown) => {
  const msg = (error as Error)?.message ?? String(error)
  if (/401|403|unauthor|invalid.*key|api key/i.test(msg)) return `模型的 key 无效或没有权限。（${msg.slice(0, 160)}）`
  if (/429|rate limit/i.test(msg)) return "模型服务繁忙或额度用完了，稍后再试。"
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|network/i.test(msg)) return `连不上模型服务：检查地址和网络。（${msg.slice(0, 160)}）`
  return `模型服务出错了：${msg.slice(0, 240)}`
}

/** Wire the assistant's channels. `engineOf` gives the engine of the window that asks. */
export function wireAssistant(ipcMain: IpcMain, engineOf: (e: IpcMainInvokeEvent) => Engine) {
  const running = new Map<string, AbortController>()
  const fetchVia: typeof fetch = (input, init) => net.fetch(input as never, init as never) as never

  ipcMain.handle("turnery:models", () => settings())
  ipcMain.handle("turnery:models-save", (_e, input: { preset: string; model?: string; baseURL?: string; vision?: boolean | null; key?: string | null }) => {
    if (!presetOf(input.preset)) return settings()
    useModel({ preset: input.preset, model: input.model ?? "", baseURL: input.baseURL ?? "", vision: input.vision ?? undefined })
    // `key` undefined: leave the stored one alone; a string (even empty) replaces it.
    if (typeof input.key === "string") setKey(input.preset, input.key, secretBox())
    return settings()
  })

  ipcMain.handle("turnery:assistant-stop", (_e, id: string) => running.get(id)?.abort())

  ipcMain.handle("turnery:assistant-send", async (e, id: string, messages: unknown[]) => {
    const wc: WebContents = e.sender
    const send = (chunk: unknown) => !wc.isDestroyed() && wc.send("turnery:assistant", id, chunk)
    const fail = (errorText: string) => {
      send({ type: "error", errorText })
      send(null)
    }
    const chosen = currentModel(secretBox())
    if (!chosen) return fail("还没有选模型：点对话栏上方的模型名来配置。")
    const resolved = languageModel(chosen.config, chosen.key, fetchVia)
    if ("error" in resolved) return fail(resolved.error)
    const engine = engineOf(e)
    const part = engine.snapshot().active ?? undefined
    const ctx = { actor: "assistant" as const, session: `assistant-${wc.id}`, part }
    const stop = new AbortController()
    running.set(id, stop)
    wc.once("destroyed", () => stop.abort())
    try {
      const stream = await assistantStream({ engine, model: resolved.model, messages: messages as never, ctx, vision: resolved.vision, abortSignal: stop.signal, providerOptions: resolved.providerOptions as never, onError: friendly })
      const reader = stream.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        send(value)
      }
      send(null)
    } catch (error) {
      if (stop.signal.aborted) send(null)
      else fail(friendly(error))
    } finally {
      running.delete(id)
    }
  })
}
