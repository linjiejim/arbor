// Run the studio's evaluation prompts against the real model, headless.
//   node --env-file=~/.config/featuretree/deepseek.env node_modules/.bin/tsx scripts/studio-eval.ts [ids…] [--thinking=disabled] [--model=deepseek-flash]
// Tools execute directly against the kernel (no browser), so `look` is unavailable here.
import fs from "node:fs"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { generateText, isStepCount, tool, type ModelMessage, type ToolSet } from "ai"
import { executeTool, treeText, type KernelPort } from "../src/studio/apply"
import { EMPTY_TREE, type Tree } from "../src/studio/dsl"
import { EVALS, checkCase } from "../src/studio/evals"
import { Kernel } from "../src/studio/kernel/build"
import { initNodeKernel } from "../src/studio/kernel/node"
import { SYSTEM_PROMPT, statePrompt } from "../src/studio/prompt"
import { STUDIO_TOOLS } from "../src/studio/tools"
import { costUSD } from "../server/limits"

const args = process.argv.slice(2)
const flag = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1]
const ids = args.filter((a) => !a.startsWith("--"))
const MODEL = flag("model") ?? process.env.STUDIO_MODEL ?? "deepseek-flash"
const THINKING = (flag("thinking") ?? "enabled") as "enabled" | "disabled"
const key = process.env.DEEPSEEK_API_KEY
if (!key) throw new Error("DEEPSEEK_API_KEY is not set (use node --env-file=…)")

await initNodeKernel()
const deepseek = createDeepSeek({ apiKey: key })
const cases = EVALS.filter((c) => !ids.length || ids.includes(c.id))
const results = []

for (const c of cases) {
  const kernel = new Kernel()
  const port: KernelPort = {
    rebuild: async (t) => kernel.rebuild(t),
    inspect: async (what, sel) => kernel.inspect(what, undefined, sel),
  }
  let tree: Tree = EMPTY_TREE
  let summary = ""
  let calls = 0
  let failedCalls = 0
  const tools = Object.fromEntries(
    Object.entries(STUDIO_TOOLS).map(([name, def]) => [
      name,
      tool({
        ...(def as object),
        execute: async (input: Record<string, unknown>) => {
          calls++
          const run = await executeTool(port, tree, name, input)
          if (!run.output.ok) failedCalls++
          tree = run.tree
          if (run.report) summary = treeText(tree, run.report)
          return run.output
        },
      } as never),
    ]),
  ) as ToolSet
  const t0 = performance.now()
  const messages: ModelMessage[] = [{ role: "user", content: c.prompt }]
  let text = ""
  let usage = { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 }
  let error: string | undefined
  try {
    const res = await generateText({
      model: deepseek(MODEL),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: isStepCount(16),
      maxOutputTokens: 8000,
      providerOptions: { deepseek: { thinking: { type: THINKING }, ...(THINKING === "enabled" ? { reasoningEffort: "low" } : {}) } },
      prepareStep: () => ({ system: `${SYSTEM_PROMPT}\n\n${statePrompt(tree, summary)}` }),
    })
    text = res.text
    usage = {
      inputTokens: res.totalUsage.inputTokens ?? 0,
      cacheReadTokens: res.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0,
      outputTokens: res.totalUsage.outputTokens ?? 0,
    }
  } catch (e) {
    error = (e as Error).message
  }
  const report = kernel.rebuild(tree)
  const checks = checkCase(c, tree, report)
  const pass = !error && checks.every((x) => x.pass)
  const sec = (performance.now() - t0) / 1000
  const usd = costUSD(MODEL, usage)
  results.push({ id: c.id, pass, checks, calls, failedCalls, sec, usage, usd, error, tree, text })
  console.log(`${pass ? "PASS" : "FAIL"} ${c.id.padEnd(14)} ${calls} calls (${failedCalls} failed) ${sec.toFixed(1)}s $${usd.toFixed(4)}`)
  for (const x of checks.filter((k) => !k.pass)) console.log(`     ✗ ${x.name}: ${x.detail}`)
  if (error) console.log(`     error: ${error}`)
  kernel.dispose()
}

const passed = results.filter((r) => r.pass).length
const total = results.reduce((s, r) => s + r.usd, 0)
console.log(`\n${passed}/${results.length} passed · model ${MODEL} · thinking ${THINKING} · total $${total.toFixed(4)} · median ${median(results.map((r) => r.sec)).toFixed(1)}s/case`)
fs.mkdirSync(".tmp/evals", { recursive: true })
const file = `.tmp/evals/${new Date().toISOString().replace(/[:.]/g, "-")}-${MODEL}-${THINKING}.json`
fs.writeFileSync(file, JSON.stringify(results, null, 2))
console.log(`report: ${file}`)

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
