// ~/.turnery/chats: the built-in assistant's conversations, one file each, plus an index so the list
// opens without reading every conversation. Never in a project folder (it would go into git).
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { CHAT_ID, MAX_CHATS, summaryOf, type ChatRecord, type ChatSummary } from "../../../app/src/desktop/core/chats"
import { HOME } from "./home"

const DIR = () => path.join(HOME, "chats")
const fileOf = (id: string) => path.join(DIR(), `${id}.json`)
const INDEX = () => path.join(DIR(), "index.json")

function writeAtomic(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text, { mode: 0o600 })
  renameSync(tmp, file)
}

function readIndex(): ChatSummary[] {
  try {
    const list = JSON.parse(readFileSync(INDEX(), "utf8")) as unknown
    return Array.isArray(list) ? (list as ChatSummary[]).filter((c) => c && typeof c.id === "string" && CHAT_ID.test(c.id)) : []
  } catch {
    return []
  }
}

/** Newest first. `project`: only the ones held in that folder (null: loose parts); omitted: all. */
export function listChats(project?: string | null): ChatSummary[] {
  const all = readIndex().sort((a, b) => b.updatedAt - a.updatedAt)
  return project === undefined ? all : all.filter((c) => (c.project ?? null) === project)
}

export function readChat(id: string): ChatRecord | null {
  if (!CHAT_ID.test(id)) return null
  try {
    return JSON.parse(readFileSync(fileOf(id), "utf8")) as ChatRecord
  } catch {
    return null
  }
}

/** Save (or replace) one conversation; past MAX_CHATS the oldest go. */
export function saveChat(record: ChatRecord): ChatSummary[] {
  if (!CHAT_ID.test(record.id)) throw new Error("对话的编号不对")
  writeAtomic(fileOf(record.id), JSON.stringify(record))
  const index = [summaryOf(record), ...readIndex().filter((c) => c.id !== record.id)].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const old of index.splice(MAX_CHATS)) rmSync(fileOf(old.id), { force: true })
  writeAtomic(INDEX(), JSON.stringify(index))
  return index
}

export function renameChat(id: string, title: string) {
  const record = readChat(id)
  const t = title.replace(/\s+/g, " ").trim().slice(0, 80)
  if (!record || !t) return
  saveChat({ ...record, title: t })
}

export function deleteChat(id: string) {
  if (!CHAT_ID.test(id)) return
  rmSync(fileOf(id), { force: true })
  writeAtomic(INDEX(), JSON.stringify(readIndex().filter((c) => c.id !== id)))
}
