// ~/.turnery/providers.json: which model the built-in assistant uses, and the keys.
//
// A key comes from, in order: the environment (TURNERY_API_KEY_<PRESET>), the encrypted copy in the
// file (when the caller can decrypt: the app, once it is signed), the plain copy in the file (mode
// 600). Keys never go into a project folder and never leave the process that makes the request.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { keyEnvOf, presetOf, type ModelConfig } from "../../../app/src/desktop/core/providers"
import { HOME } from "./home"

/** Encrypts with a key the operating system keeps (Electron's safeStorage). Null: store keys as they are. */
export type SecretBox = { encrypt(text: string): string; decrypt(data: string): string } | null

type Entry = { model?: string; baseURL?: string; vision?: boolean; key?: string; keyEnc?: string }
type Stored = { current?: string; models: Record<string, Entry> }

const FILE = () => path.join(HOME, "providers.json")

function read(): Stored {
  try {
    const s = JSON.parse(readFileSync(FILE(), "utf8")) as Partial<Stored>
    return { current: typeof s.current === "string" ? s.current : undefined, models: s.models && typeof s.models === "object" ? s.models : {} }
  } catch {
    return { models: {} }
  }
}

function write(s: Stored) {
  mkdirSync(HOME, { recursive: true })
  writeFileSync(FILE(), `${JSON.stringify(s, null, 2)}\n`, { mode: 0o600 })
  chmodSync(FILE(), 0o600) // `mode` only applies when the file is created
}

/** Where a preset's key would come from right now. */
export type KeySource = "env" | "encrypted" | "plain" | "none" | "not-needed"

export type ModelSummary = ModelConfig & { current: boolean; key: KeySource }

function keySource(preset: string, e: Entry | undefined, box: SecretBox): KeySource {
  if (presetOf(preset)?.keyless) return "not-needed"
  if (process.env[keyEnvOf(preset)]) return "env"
  if (e?.keyEnc && box) return "encrypted"
  if (e?.key) return "plain"
  return "none"
}

/** Everything configured, without the keys: what a window or a terminal may show. */
export function listModels(box: SecretBox = null): { current: string | null; models: ModelSummary[] } {
  const s = read()
  return {
    current: s.current ?? null,
    models: Object.entries(s.models).map(([preset, e]) => ({ preset, model: e.model, baseURL: e.baseURL, vision: e.vision, current: preset === s.current, key: keySource(preset, e, box) })),
  }
}

/** The chosen model's config and its key, for the process that will call it. */
export function currentModel(box: SecretBox = null): { config: ModelConfig; key: string | null; source: KeySource } | null {
  const s = read()
  if (!s.current) return null
  const e = s.models[s.current] ?? {}
  const source = keySource(s.current, e, box)
  let key: string | null = null
  if (source === "env") key = process.env[keyEnvOf(s.current)]!
  else if (source === "encrypted") {
    try {
      key = box!.decrypt(e.keyEnc!)
    } catch {
      key = e.key ?? null
    }
  } else if (source === "plain") key = e.key!
  return { config: { preset: s.current, model: e.model, baseURL: e.baseURL, vision: e.vision }, key, source }
}

/** Choose a preset (and what to use from it). Fields left out keep what was stored. */
export function useModel(config: ModelConfig) {
  const s = read()
  const e = { ...s.models[config.preset] }
  if (config.model !== undefined) e.model = config.model || undefined
  if (config.baseURL !== undefined) e.baseURL = config.baseURL || undefined
  if (config.vision !== undefined) e.vision = config.vision
  s.models[config.preset] = e
  s.current = config.preset
  write(s)
}

/** Store a preset's key (empty: forget it). Encrypted when a box is given, plain (file mode 600) otherwise. */
export function setKey(preset: string, key: string, box: SecretBox = null) {
  const s = read()
  const e = { ...s.models[preset] }
  delete e.key
  delete e.keyEnc
  const k = key.trim()
  if (k) {
    if (box) e.keyEnc = box.encrypt(k)
    else e.key = k
  }
  s.models[preset] = e
  write(s)
}
