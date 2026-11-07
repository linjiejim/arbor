// Projects (docs/specs/2026-11-08-arbor-rename-surfaces.md §4): a folder is a
// project; which folder, what a scan finds, open_project's skeleton, adding
// parts to an assembly from the window, and list_parts. Also the walkthrough
// order of the ⓘ hints and the move of the learning-progress key.
import { beforeAll, describe, expect, it, vi } from "vitest"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import { canBeRoot, partFileName, relativePath, rootFor, scanProject, type ScanCache } from "@/desktop/core/project"
import type { CallContext } from "@/desktop/core/protocol"
import type { Check, Tree } from "@/studio/dsl"
import { initNodeKernel } from "@/studio/kernel/node"
import { withPinned } from "@/studio/pinned"
import { markTourSeen, nextStep, tourPosition, tourSeen } from "@/lib/tour"
import { MOVE_PREFIX, mergeProgress, takeMoved } from "@/lib/moved"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/home/jim/work" }
const USER: CallContext = { actor: "user" }
const HOME = "/home/jim"
const tree = (features = 0) => JSON.stringify({ params: {}, features: Array.from({ length: features }, (_, i) => ({ id: `s${i}`, op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: 10 }] })) })

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

describe("which folder is the project", () => {
  it("keeps the current project for a file inside it; an assembly's folder; the nearest folder up with an assembly; else the file's folder", async () => {
    const { files, disk } = memFiles()
    disk.set("/home/jim/pen/pen.arbor-asm.json", tree())
    disk.set("/home/jim/pen/parts/barrel.arbor.json", tree(2))
    disk.set("/home/jim/loose/thing.arbor.json", tree(1))
    expect(await rootFor(files, "/home/jim/pen/parts/barrel.arbor.json", null, HOME)).toBe("/home/jim/pen")
    expect(await rootFor(files, "/home/jim/pen/parts/barrel.arbor.json", "/home/jim", HOME)).toBe("/home/jim/pen")
    expect(await rootFor(files, "/home/jim/pen/pen.arbor-asm.json", null, HOME)).toBe("/home/jim/pen")
    expect(await rootFor(files, "/home/jim/loose/thing.arbor.json", "/home/jim/pen", HOME)).toBe("/home/jim/loose")
    expect(await rootFor(files, "/home/jim/pen/parts/barrel.arbor.json", "/home/jim/pen", HOME)).toBe("/home/jim/pen")
    // A file right in the home folder belongs to no project.
    disk.set("/home/jim/top.arbor.json", tree())
    expect(await rootFor(files, "/home/jim/top.arbor.json", null, HOME)).toBeNull()
  })

  it("never takes the home folder, anything above it, or the file system root", () => {
    expect(canBeRoot("/home/jim", HOME)).toBe(false)
    expect(canBeRoot("/home", HOME)).toBe(false)
    expect(canBeRoot("/", HOME)).toBe(false)
    expect(canBeRoot("/home/jim/pen", HOME)).toBe(true)
    expect(canBeRoot("/tmp/pen", HOME)).toBe(true)
  })

  it("writes relative paths and part file names", () => {
    expect(relativePath("/a/pen", "/a/pen/parts/x.arbor.json")).toBe("parts/x.arbor.json")
    expect(relativePath("/a/pen/parts", "/a/pen/pen.params.json")).toBe("../pen.params.json")
    expect(partFileName(" 笔杆 ")).toBe("笔杆.arbor.json")
    expect(partFileName("a/b:c")).toBe("a-b-c.arbor.json")
    expect(partFileName("  ")).toBeNull()
  })
})

describe("scanning a project", () => {
  it("lists assemblies and parts breadth first, skips hidden folders and node_modules, counts features, caches by mtime", async () => {
    const { files, disk, touch } = memFiles()
    disk.set("/p/p.arbor-asm.json", tree(2))
    disk.set("/p/parts/a.arbor.json", tree(3))
    disk.set("/p/parts/deep/b.arbor.json", tree(1))
    disk.set("/p/.git/x.arbor.json", tree())
    disk.set("/p/node_modules/y.arbor.json", tree())
    disk.set("/p/p.params.json", "{}")
    disk.set("/p/notes.txt", "")
    disk.set("/p/parts/broken.arbor.json", "{")
    const cache: ScanCache = new Map()
    const scan = await scanProject(files, "/p", cache)
    expect(scan.entries.map((e) => [e.name, e.kind, e.folder, e.features])).toEqual([
      ["p", "assembly", "", 2],
      ["a", "part", "parts", 3],
      ["broken", "part", "parts", null],
      ["b", "part", "parts/deep", 1],
    ])
    await touch("/p/parts/a.arbor.json", tree(5))
    const again = await scanProject(files, "/p", cache)
    expect(again.entries.find((e) => e.name === "a")?.features).toBe(5)
  })
})

describe("projects in the engine", () => {
  it("open_project create writes an assembly using a parameter file, opens it, and lists the project", async () => {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, home: HOME })
    const r = await engine.run("open_project", { path: "pen", create: true }, AGENT)
    expect(r.ok, r.text).toBe(true)
    expect(JSON.parse(mem.disk.get("/home/jim/work/pen/pen.arbor-asm.json") as string)).toEqual({ uses: "pen.params.json", params: {}, features: [] })
    expect(JSON.parse(mem.disk.get("/home/jim/work/pen/pen.params.json") as string)).toEqual({ params: {} })
    const snap = engine.snapshot()
    expect(snap.active).toBe("/home/jim/work/pen/pen.arbor-asm.json")
    expect(snap.project?.name).toBe("pen")
    expect(snap.project?.files.map((f) => [f.name, f.kind, f.open])).toEqual([["pen", "assembly", true]])
    // Creating again doesn't overwrite.
    mem.disk.set("/home/jim/work/pen/pen.params.json", JSON.stringify({ params: { L: 140 } }))
    expect((await engine.run("open_project", { path: "pen", create: true }, AGENT)).ok).toBe(true)
    expect(JSON.parse(mem.disk.get("/home/jim/work/pen/pen.params.json") as string).params.L).toBe(140)
  })

  it("create keeps a parameter file that is already there", async () => {
    const mem = memFiles()
    mem.disk.set("/home/jim/work/p/p.params.json", JSON.stringify({ params: { L: 140 } }))
    mem.disk.set("/home/jim/work/p/parts/a.arbor.json", tree(1))
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, home: HOME })
    const r = await engine.run("open_project", { path: "p", create: true }, AGENT)
    expect(r.text).toMatch(/用已有的参数文件 p\.params\.json/)
    expect(JSON.parse(mem.disk.get("/home/jim/work/p/p.params.json") as string).params.L).toBe(140)
    expect(mem.disk.has("/home/jim/work/p/p.arbor-asm.json")).toBe(true)
  })

  it("the same part added twice gets a second name, not a failed component", async () => {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, home: HOME })
    await engine.run("open_project", { path: "/home/jim/work/kit", create: true }, USER)
    mem.disk.set("/home/jim/work/kit/parts/bolt.arbor.json", JSON.stringify({ params: {}, features: [{ id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: 6 }] }, { id: "e", op: "extrude", sketch: "s", distance: 20 }] }))
    expect((await engine.run("add_part", { file: "/home/jim/work/kit/parts/bolt.arbor.json" }, USER)).ok).toBe(true)
    const second = await engine.run("add_part", { file: "/home/jim/work/kit/parts/bolt.arbor.json" }, USER)
    expect(second.ok, second.text).toBe(true)
    const asm = JSON.parse(mem.disk.get("/home/jim/work/kit/kit.arbor-asm.json") as string)
    expect(asm.features.map((f: { name: string }) => f.name)).toEqual(["bolt", "bolt-2"])
  })

  it("refuses the home folder and a missing folder without create", async () => {
    const engine = new Engine({ kernel: new DirectKernel(), files: memFiles().files, home: HOME })
    expect((await engine.run("open_project", { path: HOME }, AGENT)).text).toMatch(/不能做项目/)
    expect((await engine.run("open_project", { path: "nope" }, AGENT)).text).toMatch(/没有这个文件夹/)
  })

  it("the window adds a new part to the assembly: parts/<name>, sharing the parameters, edited in place", async () => {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, home: HOME })
    await engine.run("open_project", { path: "/home/jim/work/pen", create: true }, USER)
    const r = await engine.run("add_part", { name: "笔杆" }, USER)
    expect(r.ok, r.text).toBe(true)
    const part = JSON.parse(mem.disk.get("/home/jim/work/pen/parts/笔杆.arbor.json") as string)
    expect(part.uses).toBe("../pen.params.json")
    const asm = JSON.parse(mem.disk.get("/home/jim/work/pen/pen.arbor-asm.json") as string)
    expect(asm.features.map((f: { op: string; file: string; name: string }) => [f.op, f.file, f.name])).toEqual([["component", "parts/笔杆.arbor.json", "笔杆"]])
    const doc = engine.docState()
    expect(doc?.path).toBe("/home/jim/work/pen/parts/笔杆.arbor.json")
    expect(doc?.context?.assembly).toBe("/home/jim/work/pen/pen.arbor-asm.json")
    expect(engine.snapshot().project?.files.map((f) => f.name)).toEqual(["pen", "笔杆"])
    // The same name again is refused; an existing file goes in by its path.
    await engine.run("open_part", { path: "/home/jim/work/pen/pen.arbor-asm.json" }, USER)
    expect((await engine.run("add_part", { name: "笔杆" }, USER)).text).toMatch(/已经有这个零件/)
    mem.disk.set("/home/jim/work/vendor/cap.arbor.json", tree())
    expect((await engine.run("add_part", { file: "/home/jim/work/vendor/cap.arbor.json" }, USER)).ok).toBe(true)
    const after = JSON.parse(mem.disk.get("/home/jim/work/pen/pen.arbor-asm.json") as string)
    expect(after.features.at(-1)).toMatchObject({ op: "component", file: "../vendor/cap.arbor.json", name: "cap" })
  })

  it("add_part is the window's: the agent builds parts with open_part and component", async () => {
    const engine = new Engine({ kernel: new DirectKernel(), files: memFiles().files, home: HOME })
    await engine.run("open_project", { path: "pen", create: true }, AGENT)
    expect((await engine.run("add_part", { name: "x" }, AGENT)).text).toMatch(/没有这个命令/)
  })

  it("list_parts lists the whole project, open or not; without a project, the open parts", async () => {
    const mem = memFiles()
    mem.disk.set("/home/jim/work/pen/pen.arbor-asm.json", tree(1))
    mem.disk.set("/home/jim/work/pen/parts/barrel.arbor.json", tree(2))
    mem.disk.set("/home/jim/work/pen/parts/cap.arbor.json", tree(4))
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files, home: HOME })
    await engine.run("open_part", { path: "pen/parts/barrel.arbor.json" }, AGENT)
    const text = (await engine.run("list_parts", {}, AGENT)).text
    expect(text).toContain("项目 pen")
    expect(text).toContain("▸ parts/barrel.arbor.json（零件）：2 个特征，打开着")
    expect(text).toContain("- parts/cap.arbor.json（零件）：4 个特征")
    expect(text).toContain("- pen.arbor-asm.json（装配）：1 个零件")

    const bare = new Engine({ kernel: new DirectKernel(), files: { ...memFiles().files, list: undefined }, home: HOME })
    await bare.run("open_part", { path: "/x/a.arbor.json", create: true }, AGENT)
    expect((await bare.run("list_parts", {}, AGENT)).text).toMatch(/打开的零件/)
    expect(bare.snapshot().project).toBeNull()
  })
})

describe("the ⓘ walkthrough", () => {
  it("goes through the steps that can be shown, in order", () => {
    const shown = new Set([1, 2, 4])
    const visible = (s: number) => shown.has(s)
    expect(nextStep([4, 1, 3, 2], null, visible)).toBe(1)
    expect(nextStep([4, 1, 3, 2], 2, visible)).toBe(4)
    expect(nextStep([4, 1, 3, 2], 4, visible)).toBeNull()
    expect(tourPosition([1, 2, 3, 4], 4, visible)).toEqual({ at: 3, of: 3 })
  })

  it("remembers per page that it was seen", () => {
    const store = new Map<string, string>()
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(tourSeen("studio", s)).toBe(false)
    markTourSeen("studio", s)
    expect(tourSeen("studio", s)).toBe(true)
    expect(tourSeen("desktop", s)).toBe(false)
  })
})

describe("a practice's checks stay pinned", () => {
  const pinned = [{ id: "p-size", kind: "size", said: "60×40×20", expect: [60, 40, 20] }] as unknown as Check[]
  it("adds them back when deleted, restores them when edited, keeps the others, and returns the same tree when nothing changed", () => {
    const t: Tree = { params: {}, features: [] }
    const a = withPinned(t, pinned)
    expect(a.checks).toEqual(pinned)
    expect(withPinned(a, pinned)).toBe(a)
    const edited = { ...a, checks: [{ ...pinned[0], expect: [1, 2, 3] }, { id: "own", kind: "solids", said: "一个实体", expect: 1 }] } as unknown as Tree
    const fixed = withPinned(edited, pinned)
    expect(fixed.checks?.map((c) => c.id)).toEqual(["p-size", "own"])
    expect(fixed.checks?.[0]).toEqual(pinned[0])
    expect(withPinned(t, null)).toBe(t)
  })
})

describe("learning progress after the rename", () => {
  it("moves featuretree:progress to arbor:progress once", async () => {
    const store = new Map<string, string>([["featuretree:progress", JSON.stringify({ done: ["1.1.1"] })]])
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.resetModules()
    const { markDone } = await import("@/lib/progress")
    markDone("1.1.2")
    expect(store.has("featuretree:progress")).toBe(false)
    expect(JSON.parse(store.get("arbor:progress")!).done).toEqual(["1.1.1", "1.1.2"])
    vi.unstubAllGlobals()
  })
})

describe("moving from the old host", () => {
  const store = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init))
    return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
  }
  const hand = (data: Record<string, string>) => MOVE_PREFIX + encodeURIComponent(JSON.stringify(data))

  it("merges progress from both hosts and takes the rest only where this host has nothing", () => {
    const { m, s } = store({ "arbor:progress": JSON.stringify({ done: ["1.1.2"], quiz: { a: [{ score: 1 }] } }), "ft-studio-mode": "build" })
    const old = { "featuretree:progress": JSON.stringify({ done: ["1.1.1", "1.1.2"], last: "1.1.1", quiz: { a: [{ score: 0 }], b: [{ score: 3 }] } }), "ft-studio-mode": "teach", "ft-studio-v1": '{"tree":{"params":{},"features":[]},"history":[]}' }
    expect(takeMoved(hand(old), s)).toBe(true)
    const p = JSON.parse(m.get("arbor:progress")!)
    expect(p.done.sort()).toEqual(["1.1.1", "1.1.2"])
    expect(p.quiz.a).toHaveLength(2)
    expect(p.quiz.b).toHaveLength(1)
    expect(m.get("ft-studio-mode"), "this host's own setting wins").toBe("build")
    expect(m.get("ft-studio-v1")).toContain('"features":[]')
  })

  it("ignores other fragments and survives a broken hand-over", () => {
    const { m, s } = store()
    expect(takeMoved("#term-datum", s)).toBe(false)
    expect(takeMoved(MOVE_PREFIX + "%7Bbroken", s)).toBe(true)
    expect(m.size).toBe(0)
    expect(mergeProgress(null, null)).toBeNull()
  })
})
