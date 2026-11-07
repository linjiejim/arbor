import { beforeAll, describe, expect, it } from "vitest"
import { initNodeKernel } from "@/studio/kernel/node"
import { agentCommands, COMMANDS, inputJsonSchema } from "@/desktop/core/catalog"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine, normalizePartPath, notesPath, partName, type Files, type Screen } from "@/desktop/core/engine"
import type { CallContext, EngineEvent, PickInfo } from "@/desktop/core/protocol"
import { describeTreeChange } from "@/desktop/core/tree-diff"

/** An in-memory disk; `touch` plays someone else saving the file. */
function memFiles() {
  const disk = new Map<string, string | Uint8Array>()
  const watchers = new Map<string, () => void>()
  const files: Files = {
    read: async (p) => {
      const v = disk.get(p)
      return v === undefined ? null : typeof v === "string" ? v : new TextDecoder().decode(v)
    },
    write: async (p, d) => void disk.set(p, d),
    watch: (p, cb) => {
      watchers.set(p, cb)
      return () => watchers.delete(p)
    },
    // No symlinks in memory: `..` resolves by name, as the real file system would here.
    canonical: (p) => {
      const out: string[] = []
      for (const seg of p.split("/")) {
        if (seg === "..") out.pop()
        else out.push(seg)
      }
      return out.join("/")
    },
  }
  const touch = async (p: string, text: string) => {
    disk.set(p, text)
    watchers.get(p)?.()
  }
  return { disk, files, touch }
}

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }
const USER: CallContext = { actor: "user" }
const PART = "/work/box.arbor.json"

async function boxEngine(screen?: Screen) {
  const mem = memFiles()
  const events: EngineEvent[] = []
  const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, screen: screen ? () => screen : undefined })
  engine.on((e) => events.push(e))
  const run = (name: string, input: unknown, ctx = AGENT) => engine.run(name, input, ctx)
  expect((await run("open_part", { path: "box", create: true })).ok).toBe(true)
  await run("set_params", { set: { L: 80, W: 50, H: 30, d: 8 } })
  await run("sketch", { id: "sk1", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] })
  await run("extrude", { id: "ex1", sketch: "sk1", distance: "H" })
  const hole = await run("hole", { id: "h1", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[0, 0]], d: "d" })
  expect(hole.ok, hole.text).toBe(true)
  return { engine, run, events, ...mem }
}

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

describe("arbor: paths and catalog", () => {
  it("normalizes part paths and derives names", () => {
    expect(normalizePartPath("parts/box", "/work")).toBe("/work/parts/box.arbor.json")
    expect(normalizePartPath("/abs/x.json")).toBe("/abs/x.json")
    // `..` is left to the file system: after a symlinked folder it means the target's parent.
    expect(normalizePartPath("./parts/../box", "/work/")).toBe("/work/parts/../box.arbor.json")
    expect(normalizePartPath("/work//a/./b.json")).toBe("/work/a/b.json")
    expect(partName("/a/b/lid.arbor.json")).toBe("lid")
    expect(notesPath("/a/lid.arbor.json")).toBe("/a/lid.notes.json")
  })

  it("turns every command's input into a JSON schema, and keeps window-only commands from agents", () => {
    for (const c of COMMANDS) expect(inputJsonSchema(c).type).toBe("object")
    const names = agentCommands().map((c) => c.name)
    expect(names).toContain("extrude")
    expect(names).toContain("request_pick")
    expect(names).not.toContain("add_note")
    expect(names).not.toContain("look-in-browser")
  })

  it("says how a tree changed in one line", () => {
    const a = { params: { W: 40 }, features: [{ id: "f1", op: "fillet" as const, name: "圆角", edges: {}, r: 2 }] }
    const b = { params: { W: 45, t: 2 }, features: [{ ...a.features[0], r: 3 }] }
    expect(describeTreeChange(a, b)).toBe("参数 W 40 → 45、+t = 2；改了 「圆角」（f1） 的 r")
  })
})

describe("arbor: the engine", () => {
  it("builds through tools, writes the file, and reports state", async () => {
    const { run, disk } = await boxEngine()
    const text = disk.get(PART) as string
    expect(JSON.parse(text).features.map((f: { id: string }) => f.id)).toEqual(["sk1", "ex1", "h1"])
    const state = await run("get_state", {})
    expect(state.text).toContain("80 × 50 × 30")
    expect(state.text).toContain("第 4 版")
  }, 30_000)

  it("keeps requirements on the part (the site's checklist), measured by the kernel on every rebuild", async () => {
    const { engine, run, disk } = await boxEngine()
    await run("check", {
      items: [
        { id: "size", said: "80×50×30", kind: "size", expect: [80, 50, 30] },
        { id: "hole", said: "⌀8 通孔", kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 8 },
      ],
    })
    expect(JSON.parse(disk.get(PART) as string).checks).toHaveLength(2)
    expect(engine.docState(PART)!.report!.checks!.every((c) => c.pass)).toBe(true)
    // The person makes the box taller: the requirement is re-measured and no longer holds.
    await engine.run("set_params", { set: { H: 31 } }, USER)
    const size = engine.docState(PART)!.report!.checks!.find((c) => c.id === "size")!
    expect(size).toMatchObject({ pass: false, actual: "80 × 50 × 31" })
    const m = await run("measure", { a: { face: { normal: "+Z", extreme: "+Z" } }, b: { face: { normal: "-Z" } } })
    expect(m.text).toContain("平行面间距：31 mm")
  }, 30_000)

  it("tells the agent what the person and the file changed since its last call", async () => {
    const { engine, run, touch, disk } = await boxEngine()
    await engine.run("set_params", { set: { H: 40 } }, USER)
    const r1 = await run("inspect", { what: "body" })
    expect(r1.text).toMatch(/用户在窗口里：参数 H 30 → 40/)
    const again = await run("inspect", { what: "body" })
    expect(again.text).not.toContain("自你上次调用以来")

    const tree = JSON.parse(disk.get(PART) as string)
    tree.params.L = 100
    await touch(PART, JSON.stringify(tree))
    const r2 = await run("inspect", { what: "body" })
    expect(r2.text).toMatch(/文件被直接修改：参数 L 80 → 100/)
    expect(r2.text).toContain("100 × 50 × 40")
    // The engine doesn't write a file someone else just saved.
    expect(disk.get(PART)).toBe(JSON.stringify(tree))

    await touch(PART, "{ not json")
    await run("get_state", {})
    const s = engine.docState(PART)!
    expect(s.error).toMatch(/JSON/)
    expect(s.tree.params.L).toBe(100)
  }, 30_000)

  it("catches up with a save the watcher hasn't reported yet before running a command", async () => {
    const { run, disk } = await boxEngine()
    // Saved a moment ago, before the (debounced) watcher fired: the next command builds on it.
    const tree = JSON.parse(disk.get(PART) as string)
    tree.params.W = 60
    disk.set(PART, JSON.stringify(tree))
    const r = await run("set_params", { set: { H: 40 } })
    expect(r.text).toMatch(/文件被直接修改：参数 W 50 → 60/)
    expect(JSON.parse(disk.get(PART) as string).params).toMatchObject({ W: 60, H: 40 })
  }, 30_000)

  it("yields to a save made while a command runs: the file wins, the command's change is one undo away", async () => {
    const mem = memFiles()
    const direct = new DirectKernel()
    let during: (() => void) | null = null
    // The editor's save lands while the kernel rebuilds: after the command read the file, before it writes.
    const kernel = Object.assign(Object.create(direct) as DirectKernel, {
      rebuild: async (t: Parameters<DirectKernel["rebuild"]>[0]) => {
        during?.()
        during = null
        return direct.rebuild(t)
      },
    })
    const engine = new Engine({ kernel, files: mem.files })
    const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
    await run("open_part", { path: "box", create: true })
    await run("set_params", { set: { L: 80, t: 2 } })
    const theirs = { params: { L: 120, t: 2 }, features: [] }
    during = () => mem.disk.set(PART, JSON.stringify(theirs))
    const c = await run("set_params", { set: { t: 3 } })
    expect(c.ok).toBe(false)
    expect(c.text).toMatch(/文件被别人保存过/)
    expect(JSON.parse(mem.disk.get(PART) as string)).toEqual(theirs)
    expect(engine.docState(PART)!.tree.params).toEqual(theirs.params)
    await run("undo", {})
    expect(engine.docState(PART)!.tree.params).toEqual({ L: 80, t: 3 })
  }, 30_000)

  it("treats one file reached by different paths as one part", async () => {
    const { engine, run } = await boxEngine()
    await run("open_part", { path: "parts/../box.arbor.json" })
    expect(engine.snapshot().parts).toHaveLength(1)
  }, 30_000)

  it("undoes and redoes whoever made the change, and refuses a stale whole-tree write", async () => {
    const { engine, run } = await boxEngine()
    await engine.run("delete_feature", { id: "h1" }, USER)
    expect(engine.docState()!.tree.features).toHaveLength(2)
    const u = await run("undo", {})
    expect(u.text).toMatch(/已撤销：删了 「.+」（h1）/)
    expect(engine.docState()!.tree.features).toHaveLength(3)
    await run("redo", {})
    expect(engine.docState()!.tree.features).toHaveLength(2)
    const rev = engine.docState()!.rev
    const stale = await run("set_tree", { tree: { params: {}, features: [] }, base_rev: rev - 1 })
    expect(stale.ok).toBe(false)
    expect((await run("set_tree", { tree: { params: {}, features: [] }, base_rev: rev })).ok).toBe(true)
  }, 30_000)

  it("keeps notes the person pins, hands them to the agent with a verified selector", async () => {
    const { engine, run, disk } = await boxEngine()
    const [hash] = (await engine.kernelCall(PART, { op: "locate", kind: "face", selector: { normal: "+Z", extreme: "+Z" } })) as number[]
    const pick = (await engine.kernelCall(PART, { op: "pick", kind: "face", hash, point: [20, 10, 30] })) as PickInfo
    expect(pick.selector).toBeTruthy()
    await engine.run("add_note", { pick, text: "这里开一个 ⌀5 的孔" }, USER)
    expect(JSON.parse(disk.get("/work/box.notes.json") as string).notes).toHaveLength(1)

    const r = await run("inspect", { what: "body" })
    expect(r.text).toContain("◆ 用户在窗口里留了 1 条新备注：n1「这里开一个 ⌀5 的孔」")
    const notes = await run("get_notes", {})
    expect(notes.text).toContain("[备注 n1]")
    expect(notes.text).toContain("已验证只选中它的选择器")
    expect(notes.text).toContain("点击处的草图坐标 (20, 10)")
    await run("resolve_note", { id: "n1", reply: "已加 ⌀5 通孔" })
    expect(engine.docState()!.notes[0]).toMatchObject({ status: "resolved", reply: "已加 ⌀5 通孔" })
    expect((await run("get_notes", {})).text).toBe("没有未处理的备注。")

    // What the person does with notes shows in the activity list, and the agent hears about it.
    await engine.run("update_note", { id: "n1", status: "open" }, USER)
    const changes = engine.docState()!.changes.map((c) => `${c.actor}:${c.summary}`)
    expect(changes.slice(0, 3)).toEqual(["user:把备注 n1 标为未处理", "agent:处理完备注 n1：已加 ⌀5 通孔", "user:记下备注 n1「这里开一个 ⌀5 的孔」"])
    const told = await run("get_state", {})
    expect(told.text).toContain("备注有变化：用户把备注 n1 标为未处理")
    expect(told.text).not.toContain("模型被改过")
  }, 30_000)

  it("exports files, renders through the window, and waits for a pick", async () => {
    let asked: EngineEvent | undefined
    const screen: Screen = { look: async (req) => req.views.map((v) => `data:image/png;base64,${v}`) }
    const { engine, run, disk, events } = await boxEngine(screen)
    expect((await run("export", { path: "out/box.step" })).text).toMatch(/已导出 STEP/)
    expect((disk.get("/work/out/box.step") as Uint8Array).byteLength).toBeGreaterThan(1000)
    expect(disk.get("/work/out/box.py")).toBeUndefined()
    await run("export", { path: "box.py" })
    expect(disk.get("/work/box.py") as string).toContain("from build123d import")

    const look = await run("look", { views: ["iso", "top"] })
    expect(look.images).toHaveLength(2)

    const waiting = run("request_pick", { prompt: "点一下要开孔的面", kind: "face", timeout_sec: 5 })
    await new Promise((r) => setTimeout(r, 20))
    asked = events.findLast((e) => e.type === "pick")
    expect(asked && asked.type === "pick" && asked.request?.prompt).toBe("点一下要开孔的面")
    const [hash] = (await engine.kernelCall(PART, { op: "locate", kind: "face", selector: { normal: "-Y" } })) as number[]
    const info = (await engine.kernelCall(PART, { op: "pick", kind: "face", hash, point: [0, -25, 15] })) as PickInfo
    engine.answerPick((asked as Extract<EngineEvent, { type: "pick" }>).request!.id, { info, text: "前面这块" })
    const res = await waiting
    expect(res.ok).toBe(true)
    expect(res.text).toContain("朝前（-Y）")
    expect(res.text).toContain("用户补充：前面这块")
  }, 30_000)

  it("refuses look without a window, and window-only commands from the agent", async () => {
    const { run } = await boxEngine()
    expect((await run("look", {})).text).toMatch(/先打开 Arbor App/)
    expect((await run("add_note", { pick: {}, text: "x" })).text).toMatch(/没有这个命令/)
  }, 30_000)
})
