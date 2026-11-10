import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { activity } from "@/desktop/assistant-activity"
import { clampLayout, defaultLayout, dockRoom } from "@/desktop/assistant-layout"
import { chatTitle, forStorage, newChatId, type ChatRecord } from "@/desktop/core/chats"
import { usageOf } from "@/desktop/core/assistant"

const user = (text: string, id = "u"): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] })
const answer = (parts: unknown[], id = "a"): UIMessage => ({ id, role: "assistant", parts: parts as UIMessage["parts"] })

describe("saved conversations", () => {
  it("are named by the first thing said, on one line", () => {
    expect(chatTitle([])).toBe("新对话")
    expect(chatTitle([answer([]), user("  做一个\n杯子  ")])).toBe("做一个 杯子")
    expect(chatTitle([user("长".repeat(60))])).toHaveLength(41)
  })

  it("leave out pictures and unfinished tool calls", () => {
    const m = answer([
      { type: "text", text: "好" },
      { type: "tool-look", toolCallId: "1", state: "output-available", input: {}, output: { ok: true, text: "看了", images: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"] } },
      { type: "tool-extrude", toolCallId: "2", state: "input-available", input: {} },
      { type: "tool-check", toolCallId: "3", state: "output-available", input: {}, output: { ok: true, text: "✓" } },
    ])
    const [kept] = forStorage([m])
    expect(kept.parts.map((p) => p.type)).toEqual(["text", "tool-look", "tool-check"])
    expect((kept.parts[1] as { output: unknown }).output).toEqual({ ok: true, text: "看了", images: undefined, imagesDropped: 2 })
    expect(JSON.stringify(kept)).not.toContain("base64")
  })

  it("get ids the store accepts", () => {
    expect(newChatId()).toMatch(/^c-[a-z0-9]{6,32}$/)
  })
})

describe("the chat store (~/.turnery/chats)", () => {
  let home = ""
  let store: typeof import("../../../../desktop/src/engine/chats")
  beforeAll(async () => {
    home = mkdtempSync(path.join(os.tmpdir(), "turnery-chats-"))
    process.env.TURNERY_HOME = home
    store = await import("../../../../desktop/src/engine/chats")
  })
  afterAll(() => {
    delete process.env.TURNERY_HOME
    rmSync(home, { recursive: true, force: true })
  })
  const record = (id: string, project: string | null, updatedAt: number): ChatRecord => ({ id, title: id, project, part: null, createdAt: 1, updatedAt, messages: [user("hi")] })

  it("saves, lists by project newest first, reads back, renames and deletes", () => {
    store.saveChat(record("c-aaaaaa", "/p/one", 10))
    store.saveChat(record("c-bbbbbb", "/p/two", 20))
    store.saveChat(record("c-cccccc", "/p/one", 30))
    expect(store.listChats("/p/one").map((c) => c.id)).toEqual(["c-cccccc", "c-aaaaaa"])
    expect(store.listChats().map((c) => c.id)).toEqual(["c-cccccc", "c-bbbbbb", "c-aaaaaa"])
    expect(store.listChats(null)).toEqual([])
    expect(store.listChats("/p/one")[0]).toMatchObject({ count: 1, project: "/p/one" })
    expect(store.readChat("c-aaaaaa")?.messages).toEqual([user("hi")])

    store.renameChat("c-aaaaaa", "  杯子  ")
    expect(store.readChat("c-aaaaaa")?.title).toBe("杯子")
    store.deleteChat("c-bbbbbb")
    expect(store.readChat("c-bbbbbb")).toBeNull()
    expect(store.listChats().map((c) => c.id)).not.toContain("c-bbbbbb")
  })

  it("keeps turns another window saved meanwhile: the stale save becomes a copy", () => {
    const two = { ...record("c-dddddd", "/p/one", 40), messages: [user("a", "1"), answer([], "2")] }
    expect(store.saveChat(two, 0)).toBe("c-dddddd")
    // Window B opened it with 2 messages; window A went on to 4; B now saves its 3.
    expect(store.saveChat({ ...two, messages: [...two.messages, user("b", "3"), answer([], "4")] }, 2)).toBe("c-dddddd")
    const copy = store.saveChat({ ...two, messages: [...two.messages, user("c", "5")] }, 2)
    expect(copy).not.toBe("c-dddddd")
    expect(store.readChat("c-dddddd")?.messages).toHaveLength(4)
    expect(store.readChat(copy)).toMatchObject({ title: "c-dddddd（副本）" })
    expect(store.readChat(copy)?.messages).toHaveLength(3)
  })

  it("never reads or writes outside its folder", () => {
    expect(store.readChat("../providers")).toBeNull()
    expect(() => store.saveChat(record("../../evil", null, 1))).toThrow()
    store.deleteChat("../index")
    expect(JSON.parse(readFileSync(path.join(home, "chats", "index.json"), "utf8")).length).toBeGreaterThan(0)
  })
})

describe("the floating panel's place", () => {
  it("stays inside the window, below the title bar, at least its minimum size", () => {
    const l = clampLayout({ ...defaultLayout(1440, 900), x: 5000, y: -20, w: 100, h: 5000 }, 1440, 900)
    expect(l.w).toBe(320)
    expect(l.x + l.w).toBeLessThanOrEqual(1440 - 8)
    expect(l.y).toBeGreaterThanOrEqual(48)
    expect(l.y + l.h).toBeLessThanOrEqual(900 - 8)
  })
})

describe("the docked column", () => {
  it("leaves the model at least 360 px, and goes back to floating when the window is too narrow", () => {
    expect(dockRoom(1440)).toBe(1440 - 224 - 380 - 360)
    const wide = clampLayout({ ...defaultLayout(1440, 900), mode: "dock", dockW: 900 }, 1440, 900)
    expect(wide).toMatchObject({ mode: "dock", dockW: 476 })
    expect(clampLayout({ ...defaultLayout(1100, 800), mode: "dock" }, 1100, 800).mode).toBe("float")
  })
})

describe("what the turn is doing", () => {
  it("says the stage in words", () => {
    expect(activity({ messages: [user("x")], status: "submitted" })).toBe("等模型回应")
    expect(activity({ messages: [user("x"), answer([{ type: "reasoning", text: "嗯", state: "streaming" }])], status: "streaming" })).toBe("思考中")
    expect(activity({ messages: [user("x"), answer([{ type: "tool-extrude", toolCallId: "1", state: "input-streaming" }])], status: "streaming" })).toBe("正在写「做拉伸」的参数")
    expect(activity({ messages: [user("x"), answer([{ type: "tool-check", toolCallId: "1", state: "input-available", input: {} }])], status: "streaming" })).toBe("正在核对需求")
    expect(activity({ messages: [user("x"), answer([{ type: "tool-check", toolCallId: "1", state: "output-available", input: {}, output: {} }])], status: "streaming" })).toBe("看结果，想下一步")
  })

  it("counts tokens from either shape the SDK reports", () => {
    expect(usageOf({ inputTokens: 1000, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 900 } })).toEqual({ input: 1000, output: 50, cached: 900, reasoning: 0 })
    expect(usageOf(undefined)).toEqual({ input: 0, output: 0, cached: 0, reasoning: 0 })
  })
})
