// `turnery`: the command line. `turnery mcp` is the MCP server; the rest call the
// same engine commands from a shell or a script. Talks to the running app
// when there is one (the person sees the change), otherwise runs in-process.
import { spawn } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { runAssistant } from "../../../app/src/desktop/core/assistant"
import { keyEnvOf, languageModel, presetOf, PRESETS } from "../../../app/src/desktop/core/providers"
import { currentModel, listModels, setKey, useModel } from "../engine/models"
import { COMMANDS, agentCommands, inputJsonSchema } from "../../../app/src/desktop/core/catalog"
import { normalizePartPath, partName } from "../../../app/src/desktop/core/engine"
import type { CommandResult } from "../../../app/src/desktop/core/protocol"
import { Link, runningApp } from "../engine/backend"
import { readAppInfo } from "../engine/home"
import { agentSetup } from "../main/setup"
import { runMcp } from "../mcp/server"

declare const __TURNERY_VERSION__: string

const distDir = new URL("./", import.meta.url)

const HELP = `turnery ${__TURNERY_VERSION__}：让 coding agent 在 Turnery 里建参数化零件

用法：
  turnery mcp                         MCP 服务（stdio），给 Claude Code、Codex 等 agent 用
  turnery setup                       打印接入各个 agent 的命令
  turnery open [零件]                 打开 Turnery App（并打开这个零件）
  turnery status                      App 是否在运行、打开了哪些零件
  turnery tools [--json]              列出所有命令和它们的参数
  turnery call <命令> [参数]          调一个命令。参数写 JSON，或 key=value（值按 JSON 解析）
  turnery check <零件> [JSON]         重建并核对需求（不需要窗口）
  turnery export <零件> <输出文件>    导出 .step / .stl / .py / .json
  turnery look <零件> [-o 目录]       渲染视图 PNG（需要 App，会自动启动）
  turnery ask "<一句话>"              让内置助手来做（用 turnery model 选好的模型）；核对有 ✗ 时退出码为 1
  turnery model                       现在用哪个模型、key 从哪来、有哪些预设
  turnery model use <预设> [模型名]   选模型（--base-url <地址>、--vision / --no-vision）
  turnery model key <预设>            从标准输入读 key 存起来（空行 = 删掉）；也可以设环境变量 TURNERY_API_KEY_<预设>

选项：
  --part <零件>   命令作用在哪个零件（缺省是 App 里当前的零件）
  --headless      App 没在运行时在后台启动它，不显示窗口（look 照常出图）；
                  turnery mcp --headless 让 agent 这样用
  --no-app        不连 App，在这个进程里起一个没有窗口的引擎（适合 CI；没有 look）
  --json          输出 JSON
  --max-steps <n> ask：最多调多少次命令（缺省 30）

例子：
  turnery call open_part path=box create=true
  turnery call set_params '{"set":{"L":80,"W":50}}'
  turnery check box '{"size":[80,50,30]}'
`

type Flags = { part?: string; headless: boolean; noApp: boolean; json: boolean; out?: string; baseUrl?: string; vision?: boolean; maxSteps?: number }

function parseArgs(argv: string[]) {
  const flags: Flags = { headless: false, noApp: false, json: false }
  const rest: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--part") flags.part = argv[++i]
    else if (a === "--headless") flags.headless = true
    else if (a === "--no-app") flags.noApp = true
    else if (a === "--json") flags.json = true
    else if (a === "-o" || a === "--out") flags.out = argv[++i]
    else if (a === "--base-url") flags.baseUrl = argv[++i]
    else if (a === "--vision") flags.vision = true
    else if (a === "--no-vision") flags.vision = false
    else if (a === "--max-steps") flags.maxSteps = Number(argv[++i])
    else rest.push(a)
  }
  return { flags, rest }
}

/** `{"a":1}`, `-` (stdin), or `key=value key2.sub=[1,2]`. */
function parseInput(args: string[]): Record<string, unknown> {
  if (!args.length) return {}
  if (args.length === 1 && args[0] === "-") return JSON.parse(readFileSync(0, "utf8"))
  if (args.length === 1 && args[0].trim().startsWith("{")) return JSON.parse(args[0])
  const out: Record<string, unknown> = {}
  for (const a of args) {
    const eq = a.indexOf("=")
    if (eq < 1) throw new Error(`参数要写成 key=value：${a}`)
    const keys = a.slice(0, eq).split(".")
    const raw = a.slice(eq + 1)
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      value = raw
    }
    let o = out
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {}) as Record<string, unknown>
    o[keys[keys.length - 1]] = value
  }
  return out
}

function print(res: CommandResult, flags: Flags) {
  if (flags.json) process.stdout.write(`${JSON.stringify(res)}\n`)
  else process.stdout.write(`${res.text}\n`)
  if (!res.ok) process.exitCode = 1
}

async function withLink<T>(flags: Flags, launch: boolean, fn: (link: Link) => Promise<T>) {
  const link = new Link({ noApp: flags.noApp, hidden: flags.headless, launch: !flags.noApp && (launch || flags.headless), fallback: true, distDir, log: (m) => process.stderr.write(`${m}\n`) })
  try {
    return await fn(link)
  } finally {
    await link.close()
  }
}

const ctxOf = (flags: Flags) => ({ cwd: process.cwd(), part: flags.part })

async function main() {
  const { flags, rest } = parseArgs(process.argv.slice(2))
  const [cmd, ...args] = rest
  if (flags.headless) process.env.TURNERY_HEADLESS = "1"
  if (flags.noApp) process.env.TURNERY_NO_APP = "1"

  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP)
      return
    case "--version":
    case "version":
      process.stdout.write(`${__TURNERY_VERSION__}\n`)
      return
    case "mcp":
      return runMcp(distDir)
    case "setup": {
      const s = agentSetup(process.env.TURNERY_BIN || process.argv[1])
      process.stdout.write(`Claude Code：\n  ${s.claude}\n\nCodex：\n  ${s.codex}\n\n其他 agent（mcpServers JSON）：\n${s.json}\n`)
      return
    }
    case "open": {
      const target = args[0] ? normalizePartPath(args[0], process.cwd()) : null
      const app = readAppInfo()
      if (!app) throw new Error("还没有启动过 Turnery App：先手动打开一次，之后 turnery open 就能找到它。")
      const env = { ...process.env }
      delete env.ELECTRON_RUN_AS_NODE
      // A second instance hands its arguments to the running one and quits.
      const child = spawn(app.exec, [...app.args, ...(target ? ["--open", target] : [])], { detached: true, stdio: "ignore", env })
      child.on("error", () => {})
      child.unref()
      process.stdout.write(target ? `已在 Turnery 里打开 ${target}\n` : "已打开 Turnery\n")
      return
    }
    case "status": {
      const app = await runningApp()
      if (!app) {
        process.stdout.write("Turnery App 没在运行。\n")
        return
      }
      process.stdout.write(`Turnery App 正在运行（${app.version}，pid ${app.pid}）。\n`)
      await withLink(flags, false, async (link) => print(await link.call("list_parts", {}, ctxOf(flags)), flags))
      return
    }
    case "tools": {
      const list = agentCommands()
      if (flags.json) process.stdout.write(`${JSON.stringify(list.map((c) => ({ name: c.name, description: c.description, inputSchema: inputJsonSchema(c) })), null, 2)}\n`)
      else for (const c of list) process.stdout.write(`${c.name.padEnd(18)}${c.description.split("。")[0]}\n`)
      return
    }
    case "call": {
      const [name, ...params] = args
      if (!name) throw new Error("要写命令名：turnery call <命令> [参数]（turnery tools 看有哪些）")
      if (!COMMANDS.some((c) => c.name === name)) throw new Error(`没有这个命令：${name}（turnery tools 看有哪些）`)
      const input = parseInput(params)
      await withLink(flags, name === "look" || name === "request_pick", async (link) => print(await link.call(name, input, ctxOf(flags)), flags))
      return
    }
    case "check": {
      const [part, json] = args
      if (!part) throw new Error("要写零件：turnery check <零件> [JSON]")
      const input = json ? JSON.parse(json) : {}
      await withLink(flags, false, async (link) => print(await link.call("check", input, { cwd: process.cwd(), part }), flags))
      return
    }
    case "export": {
      const [part, out] = args
      if (!part || !out) throw new Error("用法：turnery export <零件> <输出文件>")
      await withLink(flags, false, async (link) => print(await link.call("export", { path: out }, { cwd: process.cwd(), part }), flags))
      return
    }
    case "look": {
      const [part] = args
      if (!part) throw new Error("用法：turnery look <零件> [-o 目录]")
      await withLink(flags, true, async (link) => {
        const res = await link.call("look", {}, { cwd: process.cwd(), part })
        if (res.images?.length) {
          const dir = path.resolve(flags.out ?? ".")
          mkdirSync(dir, { recursive: true })
          const name = partName(normalizePartPath(part, process.cwd()))
          const views = ["iso", "front", "top", "right"]
          const files = res.images.map((img, i) => {
            const file = path.join(dir, `${name}-${views[i] ?? i}.png`)
            writeFileSync(file, Buffer.from(img.replace(/^data:image\/png;base64,/, ""), "base64"))
            return file
          })
          res.text += `\n${files.join("\n")}`
          delete res.images
        }
        print(res, flags)
      })
      return
    }
    case "model": {
      const [sub, preset, name] = args
      if (sub === "use") {
        if (!preset || !presetOf(preset)) throw new Error(`要写预设：turnery model use <预设> [模型名]。可选：${PRESETS.map((p) => p.id).join("、")}`)
        useModel({ preset, model: name, baseURL: flags.baseUrl, vision: flags.vision })
      } else if (sub === "key") {
        if (!preset || !presetOf(preset)) throw new Error(`要写预设：turnery model key <预设>，key 从标准输入读`)
        setKey(preset, readFileSync(0, "utf8").split("\n")[0] ?? "")
        process.stdout.write(`已保存到 ~/.turnery/providers.json（明文，文件权限 600）。\n`)
        return
      } else if (sub) throw new Error("用法：turnery model [use <预设> [模型名] | key <预设>]")
      const { current, models } = listModels()
      const KEY: Record<string, string> = { env: "环境变量", encrypted: "已加密保存", plain: "明文保存（权限 600）", none: "还没有 key", "not-needed": "不需要 key" }
      const chosen = models.find((m) => m.current)
      if (chosen) {
        const p = presetOf(chosen.preset)!
        process.stdout.write(`现在用：${p.name} · ${chosen.model || p.model || "（还没填模型名）"}${chosen.baseURL ? ` · ${chosen.baseURL}` : ""} · key：${KEY[chosen.key]}\n\n`)
      } else process.stdout.write(`还没有选模型${current ? `（${current} 不在预设里）` : ""}。\n\n`)
      process.stdout.write(`预设（turnery model use <预设> [模型名]）：\n${PRESETS.map((p) => `  ${p.id.padEnd(12)}${p.name}${p.model ? `，缺省 ${p.model}` : "，要自己填模型名"}${p.keyless ? "，不需要 key" : `，key：${keyEnvOf(p.id)}`}`).join("\n")}\n`)
      return
    }
    case "ask": {
      const text = args.join(" ").trim()
      if (!text) throw new Error('要写想让它做什么：turnery ask "把壁厚改成 3，再核对一遍"')
      const chosen = currentModel()
      if (!chosen) throw new Error("还没有选模型：turnery model use deepseek（或别的预设，turnery model 看有哪些）")
      const resolved = languageModel(chosen.config, chosen.key)
      if ("error" in resolved) throw new Error(resolved.error)
      await withLink(flags, !flags.noApp, async (link) => {
        const cwd = process.cwd()
        const part = flags.part ? normalizePartPath(flags.part, cwd) : undefined
        const engine = { run: (name: string, input: unknown, ctx: { part?: string }) => link.call(name, input, { cwd, part: ctx.part, actor: "assistant" }) }
        let failing = false
        process.stderr.write(`${resolved.label}\n`)
        const res = await runAssistant({
          engine,
          model: resolved.model,
          messages: [{ role: "user", content: text }],
          ctx: { actor: "assistant", cwd, part },
          // Views come from the window: without the app there is nothing to show the model.
          vision: resolved.vision && (await link.kind) !== "local",
          maxSteps: flags.maxSteps,
          providerOptions: resolved.providerOptions,
          onCall: ({ name, result }) => {
            if (name === "check") failing = /^✗/m.test(result.text)
            process.stderr.write(`  ${result.ok ? "✓" : "✗"} ${name}  ${result.text.split("\n")[0].slice(0, 100)}\n`)
          },
        })
        for await (const delta of res.textStream) process.stdout.write(delta)
        process.stdout.write("\n")
        const usage = await res.totalUsage
        process.stderr.write(`用量：输入 ${usage.inputTokens ?? "?"}（其中缓存 ${usage.inputTokenDetails?.cacheReadTokens ?? 0}），输出 ${usage.outputTokens ?? "?"} token\n`)
        if (failing) process.exitCode = 1
      })
      return
    }
    default:
      throw new Error(`没有这个子命令：${cmd}（turnery help 看用法）`)
  }
}

main().catch((e) => {
  process.stderr.write(`turnery: ${(e as Error).message}\n`)
  process.exitCode = 1
})
