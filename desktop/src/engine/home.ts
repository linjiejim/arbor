// ~/.arbor: how the MCP server and the CLI find the running app (engine.json),
// how they can start it (app.json), and the recently opened parts.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export const HOME = process.env.ARBOR_HOME || path.join(os.homedir(), ".arbor")

/** Where the app's engine listens. Written by the app at launch, removed when it quits. */
export type EngineInfo = { port: number; token: string; pid: number; version: string; startedAt: number }
/** How to start the app: the executable and its arguments. */
export type AppInfo = { exec: string; args: string[] }

const file = (name: string) => path.join(HOME, name)

function readJson<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(file(name), "utf8")) as T
  } catch {
    return null
  }
}

function writeJson(name: string, value: unknown, mode = 0o600) {
  mkdirSync(HOME, { recursive: true })
  writeFileSync(file(name), `${JSON.stringify(value, null, 2)}\n`, { mode })
}

export const readEngineInfo = () => readJson<EngineInfo>("engine.json")
export const writeEngineInfo = (info: EngineInfo) => writeJson("engine.json", info)
export function clearEngineInfo(pid: number) {
  if (readEngineInfo()?.pid === pid) rmSync(file("engine.json"), { force: true })
}

export const readAppInfo = () => readJson<AppInfo>("app.json")
export const writeAppInfo = (info: AppInfo) => writeJson("app.json", info, 0o644)

export const readRecent = () => readJson<string[]>("recent.json") ?? []
export const writeRecent = (paths: string[]) => writeJson("recent.json", paths.slice(0, 20), 0o644)
