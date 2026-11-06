import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { buildCode, toBuild123d } from "@/studio/codegen"
import type { Tree } from "@/studio/dsl"
import { evaluate } from "@/studio/expr"
import { parseTreeJson } from "@/studio/import"
import { Kernel } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { checkTree, LIMITS, MAX_COUNT } from "@/studio/limits"
import { chatLines, checkSnapshot, payloadProblem, sharePayload } from "@/studio/share"
import { STARTERS } from "@/studio/starters"
import { RateLimiter } from "../../../server/limits"
import { MAX_BODY, parseShareBody, ShareStore, shareRoutes } from "../../../server/shares"

const flange = STARTERS.find((s) => s.id === "flange")!.tree
const sketch = { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 10, h: 10 }] } as const

describe("share snapshot (browser side)", () => {
  it("keeps only the whitelisted fields: no key, no images, no reasoning, no tool calls", () => {
    const store = new Map([["ft-studio-deepseek-key", "sk-learner-secret-key-0123456789abcdef"]])
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null } as Storage
    const messages = [
      {
        id: "u1",
        role: "user",
        metadata: { tree: flange, summary: "状态" },
        parts: [
          { type: "file", mediaType: "image/png", filename: "参考图.png", url: "data:image/png;base64,AAAA" },
          { type: "text", text: "做一个法兰盘" },
        ],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "先想想节圆直径" },
          { type: "text", text: "先画外圆。" },
          { type: "tool-sketch", toolCallId: "c1", state: "output-available", input: { id: "sk", secretInput: "工具原始输入" }, output: { text: "工具原始输出" } },
          { type: "text", text: "再拉伸。" },
        ],
      },
      { id: "d1", role: "assistant", metadata: { divider: true }, parts: [{ type: "text", text: "换成了分享的模型「盒子」" }] },
    ] as unknown as UIMessage[]
    const tree = { ...flange, secret: "不该带上", features: flange.features.map((f) => ({ ...f, extra: 1 })) } as unknown as Tree
    const p = sharePayload({ title: " 法兰盘 ", note: "第三课作业", tree, messages })
    const json = JSON.stringify(p)
    expect(p.title).toBe("法兰盘")
    expect(p.chat).toEqual([
      { role: "user", text: "做一个法兰盘" },
      { role: "assistant", text: "先画外圆。\n\n再拉伸。" },
    ])
    for (const leak of ["sk-learner", "image/png", "base64", "先想想", "工具原始", "secretInput", "不该带上", '"extra"', "换成了", "metadata"]) expect(json).not.toContain(leak)
    expect(Object.keys(p).sort()).toEqual(["app", "chat", "note", "title", "tree"])
    expect(payloadProblem(p)).toBeNull()
    // Without the box ticked there's no chat at all.
    expect(sharePayload({ title: "x", tree: flange }).chat).toBeUndefined()
  })

  it("checks a snapshot that comes back like the server does", () => {
    const ok = checkSnapshot({ id: "a8Kq2ZtR0x", title: "法兰盘", tree: flange, chat: [{ role: "user", text: "hi" }, { role: "system", text: "x" }, { role: "assistant", text: 3 }], deleteHash: "sha256:x" })
    expect(ok.kind).toBe("ok")
    if (ok.kind === "ok") {
      expect(ok.snap.chat).toEqual([{ role: "user", text: "hi" }])
      expect(JSON.stringify(ok.snap)).not.toContain("deleteHash")
    }
    expect(checkSnapshot({ tree: { params: {}, features: [{ id: "x", op: "warp" }] } }).kind).toBe("broken")
  })
})

describe("tree limits", () => {
  it("accepts a normal tree and refuses ones over the limits, saying why", () => {
    expect(checkTree(flange).ok).toBe(true)
    const many = { params: {}, features: Array.from({ length: LIMITS.features + 1 }, (_, i) => ({ ...sketch, id: `s${i}` })) }
    expect(checkTree(many)).toMatchObject({ ok: false, tooBig: true, message: expect.stringMatching(/特征太多/) })
    const params = { params: Object.fromEntries(Array.from({ length: LIMITS.params + 1 }, (_, i) => [`p${i}`, i])), features: [] }
    expect(checkTree(params)).toMatchObject({ ok: false, tooBig: true, message: expect.stringMatching(/参数太多/) })
    const long = { params: {}, features: [{ ...sketch, intent: "长".repeat(LIMITS.string + 1) }] }
    expect(checkTree(long)).toMatchObject({ ok: false, tooBig: true, message: expect.stringMatching(/太长/) })
    const holes = { params: {}, features: [{ id: "h", op: "hole", on: { plane: "XY" }, d: 1, at: Array.from({ length: MAX_COUNT + 1 }, () => [0, 0]) }] }
    expect(checkTree(holes)).toMatchObject({ ok: false, tooBig: true })
  })

  it("names the feature and the field when the format is wrong", () => {
    const missing = { params: {}, features: [sketch, sketch, { id: "e1", op: "extrude", name: "拉伸1", distance: 3 }] }
    expect(checkTree(missing)).toMatchObject({ ok: false, tooBig: false, message: "第 3 个特征（拉伸1）缺少 sketch 字段" })
    expect(checkTree({ params: {}, features: [{ id: "w", op: "warp" }] })).toMatchObject({ message: "第 1 个特征（w）的类型「warp」不认识" })
    expect(checkTree({ params: {}, features: [{ ...sketch, on: { plane: "QQ" } }] })).toMatchObject({ message: expect.stringMatching(/on\.plane 只能是 "XY" \/ "XZ" \/ "YZ"/) })
    expect(checkTree({ features: [] })).toMatchObject({ message: "缺少 params 字段" })
    expect(checkTree([1, 2])).toMatchObject({ message: expect.stringMatching(/不是特征树/) })
  })
})

describe("import", () => {
  it("takes an exported tree or a shared snapshot, and explains a bad one", () => {
    expect(parseTreeJson(flange, "法兰盘")).toMatchObject({ ok: true, name: "法兰盘" })
    expect(parseTreeJson({ title: "盒子", tree: flange, chat: [] }, "file")).toMatchObject({ ok: true, name: "盒子" })
    expect(parseTreeJson({ params: {}, features: [] }, "x")).toMatchObject({ ok: false, message: expect.stringMatching(/空的/) })
    expect(parseTreeJson({ params: {}, features: [{ id: "e", op: "extrude", distance: 1 }] }, "x")).toMatchObject({ ok: false, message: "第 1 个特征（e）缺少 sketch 字段" })
  })
})

describe("build123d export from someone else's tree", () => {
  it("keeps a comment on one line whatever the intent says", () => {
    const tree: Tree = { params: {}, features: [{ ...sketch, name: "草图\n名字", intent: "第一行\nimport os\r\nos.system('rm -rf ~')  " }] }
    const code = toBuild123d(tree)
    const comment = code.split("\n").filter((l) => l.includes("第一行"))
    expect(comment).toHaveLength(1)
    expect(comment[0].startsWith("# ")).toBe(true)
    expect(code.split("\n").some((l) => l.startsWith("import os"))).toBe(false)
  })

  it("never copies an expression it can't parse, and says which field", () => {
    const evil = "1) or __import__('os').system('echo pwned') or (1"
    const tree: Tree = {
      params: { L: 10, "x = 1\nimport os\ny": 2, lambda: 3 },
      paramNotes: { L: "长\n__import__('os')" },
      features: [sketch, { id: "e1", op: "extrude", name: "拉伸1", sketch: "sk", distance: evil }],
    }
    const { code, problems } = buildCode(tree)
    expect(code).not.toContain("__import__('os').system")
    expect(code).not.toContain("echo pwned")
    expect(code.split("\n").some((l) => l.startsWith("import os"))).toBe(false)
    expect(problems.some((p) => p.startsWith("特征「拉伸1」（e1）的 distance：") && p.includes("解析不了"))).toBe(true)
    expect(problems.some((p) => p.includes("参数「lambda」"))).toBe(true)
    expect(code).toContain("amount=None")
    // The problems are listed at the top, as comments.
    expect(code.split("\n").filter((l) => l.includes("没能导出"))[0]).toMatch(/^# /)
    expect(code).toContain("L = 10  # 长 __import__('os')")
  })

  it("only lets expressions name parameters that exist (no builtins)", () => {
    const tree: Tree = { params: { L: 10 }, features: [sketch, { id: "e", op: "extrude", sketch: "sk", distance: "L + __import__" }] }
    const { code, problems } = buildCode(tree)
    expect(problems).toEqual([expect.stringContaining("没有名为「__import__」的参数")])
    expect(code).not.toContain("__import__ ")
  })

  it("prints parsed expressions back with the same meaning in Python", () => {
    const tree: Tree = {
      params: { a: 2, b: 3, c: 4, p1: "-2^2", p2: "2^3^2", p3: "a/(b*c)", p4: "a-(b+c)", p5: "-(a*b)", p6: "(2^3)^2", p7: "sqrt(a)*cos(60)", p8: "'L'" },
      features: [],
    }
    const { code } = buildCode({ ...tree, params: { ...tree.params, L: 1 } }, { body: true })
    expect(code).toContain("p1 = ((-2)**2)")
    expect(code).toContain("p2 = (2**3**2)")
    expect(code).toContain("p3 = (a/(b*c))")
    expect(code).toContain("p4 = (a - (b + c))")
    expect(code).toContain("p5 = (-(a*b))")
    expect(code).toContain("p6 = ((2**3)**2)")
    expect(code).toContain("p7 = (sqrt(a)*cos(60))")
    expect(code).toContain("p8 = L")
    expect(evaluate("-2^2", {})).toBe(4)
  })

  it("rejects bad feature ids, escapes text and the title", () => {
    const tree = {
      params: {},
      features: [
        { ...sketch, shapes: [{ type: "text", text: 'A"\n)\nimport os', size: 5 }] },
        { id: "e", op: "extrude", sketch: "sk\nimport os", distance: 1 },
      ],
    } as Tree
    const { code, problems } = buildCode(tree, { title: '标题"""\nimport os' })
    expect(code).toContain('Text("A\\"\\n)\\nimport os", 5')
    expect(code.split("\n").some((l) => l.startsWith("import os"))).toBe(false)
    expect(problems.some((p) => p.includes("引用的特征 id"))).toBe(true)
    // The title can't close the docstring early.
    expect(code.startsWith('"""标题\\"\\"\\" import os\n')).toBe(true)
  })
})

describe("kernel count cap", () => {
  let k: Kernel
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)

  it("fails the step, not the tab, when a pattern asks for too many copies", () => {
    const rep = k.rebuild({ ...flange, params: { ...flange.params, n: "10^6" } })
    const ring = rep.features.find((f) => f.id === "ring")!
    expect(ring.state).toBe("error")
    expect(ring.message).toMatch(/最多 500/)
    const grid = k.rebuild({
      params: {},
      features: [
        { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 400, h: 400 }] },
        { id: "b", op: "extrude", sketch: "s", distance: 2 },
        { id: "h", op: "hole", on: { plane: "XY" }, at: [[-190, -190]], d: 1 },
        { id: "g", op: "linear_pattern", features: ["h"], dir: "+X", count: 30, spacing: 2, dir2: "+Y", count2: 30, spacing2: 2 },
      ],
    })
    expect(grid.features.find((f) => f.id === "g")).toMatchObject({ state: "error", message: expect.stringMatching(/一共最多 500/) })
  })

  it("counts what a pattern of a pattern would make", () => {
    // The ring holds 5 copies of the seed hole; 200 more of each is 995 bodies, though both counts are under 500.
    const rep = k.rebuild({ ...flange, features: [...flange.features, { id: "again", op: "circular_pattern", features: ["ring"], axis: "X", count: 200 }] })
    expect(rep.features.find((f) => f.id === "again")).toMatchObject({ state: "error", message: expect.stringMatching(/复制出 995 个实体，最多 500/) })
  })
})

describe("share server", () => {
  let dir: string
  let store: ShareStore
  const logs: Record<string, unknown>[] = []
  const app = (limits?: Partial<Record<"create" | "open" | "remove", RateLimiter>>) =>
    shareRoutes(store, {
      limiters: { create: new RateLimiter(100, 3600_000), open: new RateLimiter(100, 3600_000), remove: new RateLimiter(100, 3600_000), ...limits },
      log: (l) => logs.push(l),
    })
  const post = (a: ReturnType<typeof app>, body: unknown, raw?: string) =>
    a.request("/api/studio/share", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" }, body: raw ?? JSON.stringify(body) })
  const good = { title: "法兰盘", note: "第三课作业", tree: flange, chat: [{ role: "user", text: "做一个法兰盘" }], app: "2576e89" }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ft-share-"))
    store = new ShareStore(dir)
    logs.length = 0
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it("creates, opens and deletes a link", async () => {
    const a = app()
    const r = await post(a, good)
    expect(r.status).toBe(200)
    const { id, url, deleteToken } = (await r.json()) as { id: string; url: string; deleteToken: string }
    expect(id).toMatch(/^[0-9A-Za-z]{10}$/)
    expect(url).toBe(`/studio/s/${id}`)
    expect(fs.existsSync(path.join(dir, "shares", id.slice(0, 2), `${id}.json`))).toBe(true)

    const g = await a.request(`/api/studio/share/${id}`)
    expect(g.status).toBe(200)
    expect(g.headers.get("x-robots-tag")).toBe("noindex")
    const snap = (await g.json()) as Record<string, unknown>
    expect(snap).toMatchObject({ v: 1, id, title: "法兰盘", note: "第三课作业", app: "2576e89", chat: good.chat })
    expect(snap.tree).toEqual(flange)
    expect(snap).not.toHaveProperty("deleteHash")

    const wrong = await a.request(`/api/studio/share/${id}`, { method: "DELETE", headers: { "x-share-token": "nope" } })
    expect(wrong.status).toBe(403)
    expect((await a.request(`/api/studio/share/${id}`)).status).toBe(200)

    const del = await a.request(`/api/studio/share/${id}`, { method: "DELETE", headers: { "x-share-token": deleteToken } })
    expect(del.status).toBe(200)
    expect((await a.request(`/api/studio/share/${id}`)).status).toBe(404)
    expect(store.totalBytes).toBe(0)

    // The log has ids, sizes and hashed IPs, never the content or the address.
    expect(logs.map((l) => l.share)).toEqual(["create", "open", "open", "delete"])
    const text = JSON.stringify(logs)
    expect(text).not.toContain("法兰盘")
    expect(text).not.toContain("203.0.113.7")
    expect(logs[0]).toMatchObject({ id, bytes: expect.any(Number), ip: expect.stringMatching(/^[0-9a-f]{12}$/) })
  })

  it("answers 400 for a malformed id and 404 for one that isn't there", async () => {
    const a = app()
    expect((await a.request("/api/studio/share/..%2F..%2Fx")).status).toBe(400)
    expect((await a.request("/api/studio/share/short")).status).toBe(400)
    expect((await a.request("/api/studio/share/abcdefghij")).status).toBe(404)
    expect((await a.request("/api/studio/share/abcdefghij", { method: "DELETE", headers: { "x-share-token": "x" } })).status).toBe(404)
  })

  it("refuses bad, oversized and key-bearing requests", async () => {
    const a = app()
    expect((await post(a, { ...good, tree: { params: {}, features: [{ id: "x", op: "warp" }] } })).status).toBe(400)
    expect((await post(a, { ...good, title: "" })).status).toBe(400)
    expect((await post(a, null, "not json")).status).toBe(400)
    expect((await post(a, { ...good, chat: [{ role: "system", text: "你是…" }] })).status).toBe(400)
    const many = { params: {}, features: Array.from({ length: LIMITS.features + 1 }, (_, i) => ({ ...sketch, id: `s${i}` })) }
    const big = await post(a, { ...good, tree: many })
    expect(big.status).toBe(413)
    expect(((await big.json()) as { message: string }).message).toMatch(/模型太大，不能分享/)
    const huge = await post(a, null, JSON.stringify({ ...good, note: "x".repeat(MAX_BODY) }))
    expect(huge.status).toBe(413)
    const key = await post(a, { ...good, chat: [{ role: "user", text: "我的 key 是 sk-0123456789abcdef0123456789" }] })
    expect(key.status).toBe(400)
    expect(((await key.json()) as { message: string }).message).toMatch(/密钥/)
    expect(fs.readdirSync(path.join(dir, "shares"))).toEqual([])
  })

  it("rate-limits per IP and says how long to wait", async () => {
    const a = app({ create: new RateLimiter(2, 3600_000), open: new RateLimiter(1, 3600_000) })
    expect((await post(a, good)).status).toBe(200)
    const { id } = (await (await post(a, good)).json()) as { id: string }
    const r = await post(a, good)
    expect(r.status).toBe(429)
    expect(((await r.json()) as { message: string }).message).toMatch(/\d+ 分钟后再试/)
    expect((await a.request(`/api/studio/share/${id}`)).status).toBe(200)
    expect((await a.request(`/api/studio/share/${id}`)).status).toBe(429)
  })

  it("stops taking links when the store is full", async () => {
    store = new ShareStore(dir, { maxTotalBytes: 1 })
    const a = app()
    expect((await post(a, good)).status).toBe(200)
    expect((await post(a, good)).status).toBe(503)
  })

  it("cleans up only what nobody opened for a year; opening counts", async () => {
    const a = app()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push(((await (await post(a, good)).json()) as { id: string }).id)
    const file = (id: string) => path.join(dir, "shares", id.slice(0, 2), `${id}.json`)
    const longAgo = new Date(Date.now() - 400 * 24 * 3600_000)
    fs.utimesSync(file(ids[0]), longAgo, longAgo)
    fs.utimesSync(file(ids[1]), longAgo, longAgo)
    // Someone opens the second one today: it stays.
    expect((await a.request(`/api/studio/share/${ids[1]}`)).status).toBe(200)
    const almost = new Date(Date.now() - 300 * 24 * 3600_000)
    fs.utimesSync(file(ids[2]), almost, almost)
    const { removed, totalBytes } = await store.cleanup()
    expect(removed).toBe(1)
    expect(fs.existsSync(file(ids[0]))).toBe(false)
    expect(fs.existsSync(file(ids[1]))).toBe(true)
    expect(fs.existsSync(file(ids[2]))).toBe(true)
    expect(totalBytes).toBe(fs.statSync(file(ids[1])).size + fs.statSync(file(ids[2])).size)
  })

  it("keeps the total right when links come and go during a cleanup", async () => {
    const a = app()
    const ids: string[] = []
    for (let i = 0; i < 20; i++) ids.push(((await (await post(a, good)).json()) as { id: string }).id)
    const sweep = store.cleanup()
    expect(store.cleanup(), "one cleanup at a time").toBe(sweep)
    const made = ((await (await post(a, good)).json()) as { id: string; deleteToken: string })
    const gone = await post(a, good).then((r) => r.json() as Promise<{ id: string; deleteToken: string }>)
    await a.request(`/api/studio/share/${gone.id}`, { method: "DELETE", headers: { "x-share-token": gone.deleteToken } })
    await a.request(`/api/studio/share/${ids[0]}`, { method: "DELETE", headers: { "x-share-token": "wrong" } })
    await sweep
    const onDisk = fs
      .readdirSync(path.join(dir, "shares"), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .reduce((n, e) => n + fs.statSync(path.join(e.parentPath, e.name)).size, 0)
    expect(made.id).toMatch(/^[0-9A-Za-z]{10}$/)
    expect(store.totalBytes).toBe(onDisk)
  })

  it("builds the stored fields one by one", () => {
    const r = parseShareBody({ ...good, extra: "x", deleteHash: "mine", id: "AAAAAAAAAA", app: "../../x" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Object.keys(r.fields).sort()).toEqual(["app", "chat", "note", "title", "tree"])
      expect(r.fields.app).toBe("unknown")
    }
    expect(chatLines([])).toEqual([])
  })
})
