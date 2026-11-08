import { PRACTICE } from "../src/content/practice"
import { expect, expectRendered, test } from "./fixtures"

/**
 * The AI studio against the scripted model (STUDIO_MOCK=1): the whole loop —
 * stream, tool calls executed in the browser kernel, feature tree, look — plus
 * a ready-made tree that needs no model at all.
 */
test.describe("工作台", () => {
  test.setTimeout(120_000)

  test("/studio 对话建模（脚本模型）", async ({ page }) => {
    await page.goto("/studio")
    const example = page.getByRole("button", { name: /80×50×30/ })
    await expect(example, "kernel loads and enables the examples").toBeEnabled({ timeout: 90_000 })
    await example.click()
    await expect(page.getByText(/^做好了/), "the scripted turn finishes").toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole("img", { name: "助教看到的视图" }).first(), "look renders views for the model").toBeVisible()
    await expectRendered(page.locator("canvas").first(), "/studio model")
    // The feature tree sits over the 3D view; hovering a row opens its details.
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible()
    await tree.getByRole("button").nth(2).hover()
    await expect(page.getByRole("tooltip").getByText("单击看尺寸和选择"), "hovering a feature shows its details").toBeVisible()
    await expect(page.getByRole("status"), "the turn's status line is gone once it's done").toHaveCount(0)
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "代码" }).click()
    await expect(page.getByRole("dialog", { name: "代码" }).getByText(/extrude\(sk_sk1, amount=H\)/).first()).toBeVisible()
    await page.keyboard.press("Escape")

    // The requirements, measured by the kernel: a card in the chat, a live list on the parameters tab.
    await page.getByRole("tab", { name: "对话" }).click()
    await expect(page.getByRole("button", { name: "核对要求 · 3/3" })).toBeVisible()
    await page.getByRole("tab", { name: "参数" }).click()
    const list = page.getByRole("region", { name: "要求核对" })
    await expect(list.getByText("3/3")).toBeVisible()
    // The learner's own edit moves a requirement: 「已偏离」, not a red failure.
    await page.getByLabel("t", { exact: true }).fill("3")
    await page.getByLabel("t", { exact: true }).press("Enter")
    await expect(list.getByText(/已偏离：要求 2 mm，现在 3 mm/)).toBeVisible()
  })

  test("/studio 在模型上标注（脚本模型）", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByText("5 个特征").first()).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio annotate")
    // Click around the disc until a face card opens.
    const box = (await page.locator("canvas").first().boundingBox())!
    const card = page.getByRole("dialog")
    for (const [fx, fy] of [[0.62, 0.42], [0.66, 0.5], [0.4, 0.42], [0.55, 0.35], [0.7, 0.45], [0.35, 0.5]]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
      if (await card.getByText(/^① 面 ·/).isVisible().catch(() => false)) break
    }
    await expect(card.getByText(/^① 面 ·/), "a click on the model opens the note card").toBeVisible()
    await card.getByLabel("标注备注").fill("在这里加一个 ⌀6 的通孔")
    await card.getByRole("button", { name: "加到消息" }).click()
    const pins = page.locator(".scene-labels .bg-primary")
    await expect(pins, "the annotation stays on the model as pin 1").toHaveCount(1)
    await page.getByRole("tab", { name: "对话" }).click()
    await expect(page.getByLabel("要随消息发出的标注").getByText("在这里加一个 ⌀6 的通孔")).toBeVisible()
    await page.getByRole("button", { name: "发送" }).click()
    await expect(page.getByText(/^做好了/), "the scripted turn finishes").toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole("img", { name: "标注截图" }), "the annotated view went with the message").toBeVisible()
    await expect(page.getByRole("button", { name: /① 在这里加一个 ⌀6 的通孔/ }), "the sent message keeps its chip").toBeVisible()
    await expect(pins, "pins clear once the reply is done").toHaveCount(0)
  })

  test("/studio 不用 AI：特征卡片、参数说明、测量、剖视", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio tools")

    // Click a feature: what it did and its dimensions in words; a dimension edits in place.
    await tree.getByRole("button", { name: /螺栓孔/ }).click()
    const card = page.getByRole("dialog", { name: "「螺栓孔」" })
    await expect(card.getByText(/第 3 步 · 孔/)).toBeVisible()
    await card.getByRole("button", { name: /螺栓孔直径/ }).click()
    await card.getByRole("textbox", { name: "螺栓孔直径" }).fill("10")
    await card.getByRole("textbox", { name: "螺栓孔直径" }).press("Enter")
    await expect(card.getByRole("button", { name: /⌀10（bolt）/ }), "the edit rebuilt the hole").toBeVisible()
    // 「让助教改这一步」 starts a message about this step.
    await card.getByRole("button", { name: /让助教改这一步/ }).click()
    await expect(page.getByLabel("给建模助教的消息")).toHaveValue("改「螺栓孔」（h1）：")
    await card.getByRole("button", { name: "关闭" }).click()

    // Re-pick on the model: the view goes back to what a fillet-like step starts from.
    await page.goto("/studio?start=box-fillet-first")
    await expect(tree.getByText("4 个特征")).toBeVisible({ timeout: 90_000 })
    await tree.getByRole("button", { name: /外圆角/ }).click()
    const fillet = page.getByRole("dialog", { name: "「外圆角」" })
    await expect(fillet.getByText("除了最上面一圈以外的边")).toBeVisible()
    await fillet.getByRole("button", { name: "在模型上重选" }).click()
    await expect(page.getByRole("status").filter({ hasText: "之前的样子" })).toBeVisible()
    await expect(fillet.getByText("直线边，除了最上面一圈 · 8 条")).toBeVisible()
    await fillet.getByRole("button", { name: "取消" }).click()
    await expect(page.getByRole("status").filter({ hasText: "之前的样子" })).toHaveCount(0)
    await page.goto("/studio?start=flange")
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })

    // Parameters say what they are and where they're used.
    await page.getByRole("tab", { name: "参数" }).click()
    await expect(page.getByText("螺栓孔所在圆的直径（节圆）")).toBeVisible()
    await expect(page.getByText("用在：螺栓孔 · 位置")).toBeVisible()

    // Measure: a click on the model shows what it is.
    await page.getByRole("button", { name: "测量" }).click()
    const box = (await page.locator("canvas").first().boundingBox())!
    const panel = page.getByRole("region", { name: "测量结果" })
    for (const [fx, fy] of [[0.62, 0.42], [0.66, 0.5], [0.4, 0.42], [0.55, 0.35], [0.7, 0.45], [0.35, 0.5]]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
      // Picking is async, and a second click on the same face would deselect it: wait for the answer.
      if (await panel.getByText(/^① /).waitFor({ timeout: 3000 }).then(() => true, () => false)) break
    }
    await expect(panel.getByText(/^① /), "the measure panel describes the click").toBeVisible()
    await page.keyboard.press("Escape")
    await expect(panel).toHaveCount(0)

    // Section: a plane through the middle, with its own controls.
    await page.getByRole("button", { name: "剖视" }).click()
    await expect(page.getByRole("group", { name: "剖视" }).getByLabel(/剖切位置/)).toBeVisible()
    await expectRendered(page.locator("canvas").first(), "/studio section")
  })

  test("/studio 尺寸标在模型上：指向参数连线，单击就改", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await page.getByRole("tab", { name: "参数" }).click()

    // Pointing at pcd: the pitch circle on the model, joined to the row by a line.
    await page.getByText("螺栓孔所在圆的直径（节圆）").hover()
    const label = page.getByRole("button", { name: /螺栓孔所在圆的直径（节圆）：⌀90（pcd）/ })
    await expect(label).toBeVisible()
    await expect(page.locator("svg path.stroke-primary"), "a connector from the row to the label").toHaveCount(1)

    // Click it, type a new value: the parameter changes; undo brings it back.
    await label.click()
    const editor = page.getByRole("dialog", { name: /修改 螺栓孔所在圆的直径/ })
    await editor.getByRole("textbox").fill("100")
    await editor.getByRole("button", { name: "应用" }).click()
    await expect(editor).toHaveCount(0)
    await expect(page.getByLabel("pcd", { exact: true })).toHaveValue("100")
    await page.getByRole("button", { name: "撤销" }).click()
    await expect(page.getByLabel("pcd", { exact: true })).toHaveValue("90")

    // 「显示尺寸」: the main dimensions without pointing at anything.
    await page.mouse.move(5, 5)
    await page.getByRole("button", { name: "显示尺寸" }).click()
    await expect(page.locator("[data-dim-id]").first()).toBeVisible()
    expect(await page.locator("[data-dim-id]").count()).toBeLessThanOrEqual(12)
  })

  test("/studio 拆件：零件行、隐藏、爆炸、分件导出", async ({ page }) => {
    const tree = {
      params: { L: 80, W: 50, H: 30, t: 2, Hs: 20 },
      features: [
        { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
        { id: "box", op: "extrude", sketch: "sk", distance: "H" },
        { id: "sk2", op: "sketch", on: { plane: "XY", offset: "t" }, shapes: [{ type: "rect", w: "L-2*t", h: "W-2*t" }] },
        { id: "cav", op: "extrude", sketch: "sk2", distance: "H-2*t", mode: "cut" },
        { id: "sp", op: "split", by: { plane: "XY", offset: "Hs" }, parts: ["底壳", "上盖"] },
        { id: "btn", op: "hole", part: "上盖", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[0, 0]], d: 10 },
      ],
    }
    await page.addInitScript((t) => localStorage.setItem("ft-studio-v1", JSON.stringify({ tree: t, history: [] })), tree)
    await page.goto("/studio")
    const parts = page.getByRole("list", { name: "零件" })
    await expect(parts.getByText("上盖")).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio parts")
    // Hide the lid, show it again.
    await parts.getByRole("button", { name: "隐藏「上盖」" }).click()
    await expect(parts.getByRole("button", { name: "显示「上盖」" })).toBeVisible()
    await parts.getByRole("button", { name: "显示「上盖」" }).click()
    // Explode: the slider appears and moves the parts apart.
    await page.getByRole("button", { name: "爆炸" }).click()
    const slider = page.getByRole("group", { name: "爆炸" }).getByLabel("零件分开的程度")
    await slider.fill("1")
    await expect(page.getByRole("group", { name: "爆炸" }).getByText("100%")).toBeVisible()
    await expectRendered(page.locator("canvas").first(), "/studio exploded")
    // Export offers one STEP with both parts, and a zip of STLs.
    await page.getByRole("button", { name: "导出" }).click()
    await expect(page.getByRole("menuitem", { name: "导出 STEP（2 个零件）" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "导出 STL（zip，每个零件一个文件）" })).toBeVisible()
  })

  test("/studio 分享链接：另一个浏览器打开、试参数、复制到工作台、撤销", async ({ page, browser }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByText("5 个特征").first()).toBeVisible({ timeout: 90_000 })
    await page.getByRole("button", { name: "分享", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "分享模型" })
    await dialog.getByLabel("标题").fill("法兰盘")
    await dialog.getByLabel("说明").fill("第三课作业")
    await dialog.getByRole("button", { name: "生成链接" }).click()
    const link = dialog.getByLabel("分享链接")
    await expect(link).toHaveValue(/\/studio\/s\/[0-9A-Za-z]{10}$/)
    const url = await link.inputValue()

    // Someone else: a fresh context shares nothing with the sharer's browser.
    const other = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 900 } })
    const viewer = await other.newPage()
    const problems: string[] = []
    viewer.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
    viewer.on("console", (m) => m.type() === "error" && problems.push(`console.error: ${m.text()}`))
    await viewer.goto(url)
    await expect(viewer.getByRole("heading", { name: "法兰盘" })).toBeVisible()
    await expect(viewer.getByText("第三课作业")).toBeVisible()
    await expect(viewer.locator('meta[name="robots"]'), "kept out of search results").toHaveAttribute("content", "noindex")
    const tree = viewer.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await expectRendered(viewer.locator("canvas").first(), "/studio/s shared model")

    // Parameters keep their notes; trying one rebuilds the model, a reload puts it back.
    await viewer.getByRole("tab", { name: "参数" }).click()
    await expect(viewer.getByText("螺栓孔所在圆的直径（节圆）")).toBeVisible()
    await viewer.getByLabel("n", { exact: true }).fill("4")
    await viewer.getByLabel("n", { exact: true }).press("Enter")
    await tree.getByRole("button", { name: /孔阵列/ }).hover()
    await expect(viewer.getByRole("tooltip").getByText(/^×4/), "the tried parameter rebuilt the pattern").toBeVisible()
    await viewer.reload()
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await tree.getByRole("button", { name: /孔阵列/ }).hover()
    await expect(viewer.getByRole("tooltip").getByText(/^×6/), "nothing was saved").toBeVisible()

    // Copy: replaces this browser's (empty) model, undoably.
    await viewer.getByRole("button", { name: "复制到我的工作台" }).first().click()
    await expect(viewer).toHaveURL(/\/studio$/)
    await expect(viewer.getByText("已替换当前模型")).toBeVisible({ timeout: 90_000 })
    await expect(tree.getByText("5 个特征")).toBeVisible()
    await viewer.getByRole("button", { name: "撤销上一步" }).click()
    await expect(tree, "undo brings back the empty model").toHaveCount(0)
    expect(problems, "viewer page errors / console.error").toEqual([])
    await other.close()

    // The sharer can take the link back.
    await dialog.getByRole("button", { name: "删除这个链接" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "删除链接" }).click()
    await expect(page.getByText("已删除链接")).toBeVisible()
    const id = url.split("/").pop()
    expect((await page.request.get(`/api/studio/share/${id}`)).status()).toBe(404)
  })

  test("/studio 导入特征树 JSON：好的替换可撤销，坏的在原处说明", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    const pad = {
      params: { L: 30 },
      features: [
        { id: "sk", op: "sketch", name: "草图1", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: 20 }] },
        { id: "e1", op: "extrude", name: "拉伸1", sketch: "sk", distance: 5 },
      ],
    }

    // From the menu.
    const chooser = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "导入特征树（JSON）…" }).click()
    await (await chooser).setFiles({ name: "垫块.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(pad)) })
    await expect(page.getByText("已导入「垫块」")).toBeVisible()
    await expect(tree.getByText("2 个特征")).toBeVisible()

    // Dropped on the view: a broken file is explained where it was dropped, and changes nothing.
    const { sketch: _sketch, ...noSketch } = pad.features[1]
    const bad = JSON.stringify({ ...pad, features: [pad.features[0], noSketch] })
    const files = await page.evaluateHandle((text) => {
      const dt = new DataTransfer()
      dt.items.add(new File([text], "坏的.json", { type: "application/json" }))
      return dt
    }, bad)
    await page.locator("main").dispatchEvent("dragover", { dataTransfer: files })
    await page.locator("main").dispatchEvent("drop", { dataTransfer: files })
    const alert = page.getByRole("alert").filter({ hasText: "没能导入「坏的.json」" })
    await expect(alert).toContainText("第 2 个特征（拉伸1）缺少 sketch 字段")
    await expect(tree.getByText("2 个特征"), "the model is unchanged").toBeVisible()

    await page.getByRole("button", { name: "撤销上一步" }).click()
    await expect(tree.getByText("5 个特征"), "undo brings the flange back").toBeVisible()
  })

  test("/studio 工程图：三视图、尺寸、标题栏，导出 SVG", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "工程图" }).click()
    const sheet = page.getByRole("img", { name: /工程图/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText("⌀90")).toBeVisible()
    await expect(sheet.getByText("第一角投影").first()).toBeVisible()
    await expect(page.getByText(/A4 横版 · 比例 1:2/)).toBeVisible()
    // Parameter names on: the pitch circle says which parameter it is.
    await page.getByRole("switch", { name: "显示参数名" }).click()
    await expect(sheet.getByText("⌀90（pcd）")).toBeVisible()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "导出 SVG" }).click()
    expect((await download).suggestedFilename()).toMatch(/工程图\.svg$/)
    // Back to 3D.
    await page.getByRole("button", { name: "回到 3D" }).click()
    await expect(sheet).toHaveCount(0)
  })

  test("/studio?start=flange 现成特征树与改参数", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByText("5 个特征").first()).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio flange")
    await page.getByRole("tab", { name: "参数" }).first().click()
    // A centre hole wider than the disc: the sketch has nothing left, the tree shows the failure…
    const d0 = page.getByLabel("d0", { exact: true })
    await d0.fill("130")
    await d0.press("Enter")
    await expect(page.getByLabel("失败").first(), "the failing feature is marked").toBeVisible()
    // …and putting it back rebuilds cleanly.
    await page.getByRole("tab", { name: "参数" }).first().click()
    await page.getByLabel("d0", { exact: true }).fill("40")
    await page.getByLabel("d0", { exact: true }).press("Enter")
    await expect(page.getByLabel("失败")).toHaveCount(0)
  })

  test("/studio 第一次进来：ⓘ 按顺序导览，跳过后不再弹出", async ({ page }) => {
    // First load only: init scripts run again on reload, and the reload must see what the tour wrote.
    await page.addInitScript(() => {
      if (sessionStorage.getItem("tour-reset")) return
      sessionStorage.setItem("tour-reset", "1")
      localStorage.removeItem("arbor:tour:studio")
    })
    await page.goto("/studio?start=flange")
    await expect(page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    const pop = page.getByRole("dialog").filter({ hasText: "导览" })
    await expect(pop.getByText("导览 1/3")).toBeVisible()
    await expect(pop).toContainText("说出零件的形状和尺寸")
    // Through the first hint's tips, then on to the feature tree's.
    for (let i = 0; i < 6 && (await pop.getByText("导览 1/3").isVisible()); i++) await pop.getByRole("button", { name: "下一条" }).click()
    await expect(pop.getByText("导览 2/3")).toBeVisible()
    await expect(pop).toContainText("点一步：模型回到这一步")
    await pop.getByRole("button", { name: "跳过导览" }).click()
    await expect(pop).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await page.waitForTimeout(1200)
    await expect(page.getByText(/^导览 \d\/\d$/), "seen: it doesn't start again").toHaveCount(0)
    // Any ⓘ still opens on its own.
    await page.getByRole("button", { name: "特征树怎么用" }).click()
    await expect(page.getByRole("dialog")).toContainText("点一步：模型回到这一步")
  })

  test("/studio?practice= 练习：要求实时打勾，做到了就完成", async ({ page }) => {
    const p = PRACTICE.find((x) => x.id === "sketch-to-solid-1")!
    await page.goto(`/studio?practice=${p.id}`)
    const card = page.getByRole("region", { name: "练习" })
    await expect(card.getByText(p.title)).toBeVisible()
    await expect(card.getByText(`0/${p.checks.length}`)).toBeVisible({ timeout: 90_000 })
    await expect(page).toHaveURL(/\/studio$/)
    // Import the reference answer: every requirement ticks, the practice is done.
    const chooser = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "导入特征树（JSON）…" }).click()
    await (await chooser).setFiles({ name: "答案.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(p.solution)) })
    await expect(card.getByText(`${p.checks.length}/${p.checks.length}`)).toBeVisible()
    await expect(card.getByText("练习完成")).toBeVisible()
    // The requirements stayed pinned in the imported tree; the lesson shows it done.
    await page.reload()
    await expect(page.getByRole("region", { name: "练习" }).getByText(`${p.checks.length}/${p.checks.length}`)).toBeVisible({ timeout: 90_000 })
    await page.getByRole("button", { name: "退出练习" }).click()
    await expect(page.getByRole("region", { name: "练习" })).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("arbor:progress") ?? "{}").done)).toContain(`practice:${p.id}`)
  })
})
