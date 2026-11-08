// Run after `npm run build`. Uses a disposable project/profile; never edits the
// person's model. Optionally pass an assembly with a saved portable preview to
// also measure first paint in a brand-new profile with an empty native cache.
import { createRequire } from "node:module"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
const require = createRequire(new URL("../../app/package.json", import.meta.url))
const { _electron } = require("playwright")
const { expect } = require("@playwright/test")
const root = fileURLToPath(new URL("../..", import.meta.url))
await mkdir(path.join(root, ".tmp"), { recursive: true })
const out = await mkdtemp(path.join(root, ".tmp/assembly-ui-"))
const project = path.join(out, "project")
await mkdir(project)
const cube = (size) => ({ params: {}, features: [{ id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: size, h: size }] }, { id: "body", op: "extrude", sketch: "sk", distance: size }] })
await writeFile(path.join(project, "outer.arbor.json"), JSON.stringify(cube(20)))
await writeFile(path.join(project, "inner.arbor.json"), JSON.stringify(cube(4)))
const assembly = path.join(project, "selection.arbor-asm.json")
await writeFile(assembly, JSON.stringify({ params: {}, features: [
  { id: "outer", op: "component", file: "outer.arbor.json", name: "外壳", at: [-18, 0, 0] },
  { id: "inner", op: "component", file: "inner.arbor.json", name: "内部件", at: [-18, 0, 8] },
  { id: "right", op: "component", file: "outer.arbor.json", name: "右侧件", at: [18, 0, 0] },
] }))
const errors = [], checks = []
const started = performance.now()
const app = await _electron.launch({ executablePath: path.join(root, "desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"), args: [path.join(root, "desktop"), `--user-data-dir=${path.join(out, "profile")}`, "--open", process.argv[2] ? path.resolve(process.argv[2]) : assembly], env: { ...process.env, ARBOR_HOME: path.join(out, "home") }, timeout: 30_000 })
let page
try {
  page = await app.firstWindow()
  page.on("pageerror", (e) => errors.push(e.message))
  await app.context().tracing.start({ screenshots: true, snapshots: true })
  await page.getByTestId("model-viewport").waitFor({ timeout: 30_000 })
  const viewport = page.getByTestId("model-viewport")
  if (process.argv[2]) {
    await expect(viewport).toHaveAttribute("data-presented", "true", { timeout: 3000 })
    const paintMs = performance.now() - started
    if (paintMs > 3000) throw new Error(`First rendered preview exceeded 3 seconds: ${paintMs.toFixed(0)} ms`)
    const state = await viewport.getAttribute("data-geometry-state")
    if (state !== "preview") throw new Error(`Expected portable preview before native geometry, got ${state}`)
    checks.push({ check: "empty-cache first rendered preview", ms: paintMs, state })
    await page.screenshot({ path: path.join(out, "first-preview.png") })
    await expect(viewport).toHaveAttribute("data-geometry-state", "ready", { timeout: 60_000 })
    await page.evaluate((file) => window.arbor.call("open_part", { path: file }), assembly)
  }
  await expect(viewport).toHaveAttribute("data-document", assembly)
  await expect(viewport).toHaveAttribute("data-geometry-state", "ready", { timeout: 30_000 })
  await expect(page.getByTestId("model-loading")).toHaveCount(0)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960))
  // Switching from the large sample to this fixture animates fit for 800 ms.
  await page.waitForTimeout(900)
  const canvas = viewport.locator("canvas").first()
  const tool = (name) => page.getByRole("button", { name, exact: true })
  // Locate real rendered geometry by the same hover information a person sees.
  // A grid scan avoids coupling this test to a private camera/three.js object.
  async function findPart(label) {
    const box = await canvas.boundingBox()
    for (let y = 0.24; y <= 0.78; y += 0.045) for (let x = 0.2; x <= 0.8; x += 0.045) {
      const point = { x: box.x + box.width * x, y: box.y + box.height * y }
      await page.mouse.move(point.x, point.y)
      if (await page.getByRole("tooltip").getByRole("heading", { name: label, exact: true }).isVisible()) return point
      await page.waitForTimeout(20)
      if (await page.getByRole("tooltip").getByRole("heading", { name: label, exact: true }).isVisible()) return point
    }
    throw new Error(`Could not hover ${label}`)
  }
  await expect(tool("查看与选择")).toHaveAttribute("aria-pressed", "true")
  const right = await findPart("右侧件")
  checks.push({ check: "hover updates right-side information", part: "右侧件" })
  await page.mouse.click(right.x, right.y)
  await expect(page.getByRole("toolbar", { name: "选中零件" })).toContainText("右侧件")
  await expect(page.getByRole("textbox", { name: "标注备注" })).toHaveCount(0)
  await tool("隔离零件").click()
  await expect(tool("隔离零件")).toHaveAttribute("aria-pressed", "true")
  await page.screenshot({ path: path.join(out, "isolated.png") })
  await tool("其余透明").click()
  await expect(tool("其余透明")).toHaveAttribute("aria-pressed", "true")
  await expect(tool("隔离零件")).toHaveAttribute("aria-pressed", "false")
  await page.screenshot({ path: path.join(out, "transparent-context.png") })
  const step = page.locator('[data-step="right"]')
  await step.hover()
  await expect(step.locator("span.w-full")).toHaveCSS("visibility", "hidden")
  await expect(step.locator("..").locator("div.absolute")).toHaveCSS("opacity", "1")
  await tool("查看与选择").click()
  await expect(step.locator("span.w-full")).toHaveCSS("visibility", "visible")
  checks.push({ check: "timeline actions replace text on hover and restore on leave" })
  await tool("定位步骤").click()
  await expect(page.locator('[data-step="right"]')).toBeFocused()
  await expect(tool("回到最新")).toHaveCount(0)
  await tool("恢复显示").click()
  checks.push({ check: "isolate, transparent context, locate step without rollback, restore" })
  await tool("标注").click()
  await expect(tool("标注")).toHaveAttribute("aria-pressed", "true")
  await page.mouse.click(right.x, right.y)
  await expect(page.getByRole("textbox", { name: "标注备注" })).toBeVisible()
  await tool("查看与选择").click()
  await expect(page.getByRole("textbox", { name: "标注备注" })).toHaveCount(0)
  await expect(tool("标注")).toHaveAttribute("aria-pressed", "false")
  await tool("标注").click()
  await page.mouse.click(right.x, right.y)
  await tool("查看与选择").click()
  await page.waitForTimeout(500)
  await expect(page.getByRole("textbox", { name: "标注备注" })).toHaveCount(0)
  await tool("测量").click()
  await expect(tool("测量")).toHaveAttribute("aria-pressed", "true")
  await tool("标注").click()
  await expect(tool("测量")).toHaveAttribute("aria-pressed", "false")
  await tool("查看与选择").click()
  await page.keyboard.press("Escape")
  checks.push({ check: "annotation toggle, cancellation, tool exclusivity" })
  await tool("爆炸").click()
  const slider = page.getByRole("slider", { name: "零件分开的程度" })
  await slider.focus()
  await slider.press("End")
  await page.mouse.move(10, 10)
  const inner = await findPart("内部件")
  await page.mouse.click(inner.x, inner.y)
  await expect(page.getByRole("toolbar", { name: "选中零件" })).toContainText("内部件")
  await tool("标注").click()
  await page.mouse.click(inner.x, inner.y)
  await expect(page.getByRole("textbox", { name: "标注备注" })).toBeVisible()
  await page.getByRole("textbox", { name: "标注备注" }).fill("爆炸状态的内部件验收")
  await tool("记下备注").click()
  const state = await page.evaluate(() => window.arbor.state())
  const note = state.doc.notes.find((n) => n.text === "爆炸状态的内部件验收")
  if (!note || note.part !== "内部件" || note.point[2] < 8 || note.point[2] > 12 || Math.abs(note.point[0] + 18) > 2.01) throw new Error(`Exploded note has wrong native coordinates: ${JSON.stringify(note)}`)
  await page.screenshot({ path: path.join(out, "exploded-internal-note.png") })
  checks.push({ check: "exploded internal instance selection and annotation", note })
  if (errors.length) throw new Error(errors.join("\n"))
  await app.context().tracing.stop({ path: path.join(out, "trace.zip") })
  await writeFile(path.join(out, "result.json"), JSON.stringify({ ok: true, checks, errors }, null, 2))
  console.log(JSON.stringify({ ok: true, out, checks }, null, 2))
} catch (error) {
  await page?.screenshot({ path: path.join(out, "failure.png") }).catch(() => {})
  await app.context().tracing.stop({ path: path.join(out, "trace.zip") }).catch(() => {})
  await writeFile(path.join(out, "result.json"), JSON.stringify({ ok: false, checks, errors, error: String(error) }, null, 2))
  console.error(out)
  throw error
} finally { await app.close() }
