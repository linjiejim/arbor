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
    await expect(page.getByRole("tooltip").getByText("单击编辑这一步"), "hovering a feature shows its details").toBeVisible()
    await expect(page.getByRole("status"), "the turn's status line is gone once it's done").toHaveCount(0)
    await page.getByRole("tab", { name: "代码" }).first().click()
    await expect(page.getByText(/extrude\(sk_sk1, amount=H\)/).first()).toBeVisible()
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

  test("/studio 不用 AI：编辑特征、参数说明、测量、剖视", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio tools")

    // Click a feature: its fields as a form; apply rebuilds.
    await tree.getByRole("button", { name: /螺栓孔/ }).click()
    const editor = page.getByRole("dialog", { name: /编辑「螺栓孔」/ })
    await editor.getByLabel("直径", { exact: true }).fill("10")
    await editor.getByRole("button", { name: "应用" }).click()
    await expect(editor.getByRole("button", { name: "应用" }), "applied: nothing left to apply").toBeDisabled()
    await editor.getByRole("button", { name: "关闭" }).click()
    await tree.getByRole("button", { name: /螺栓孔/ }).hover()
    await expect(page.getByRole("tooltip").getByText(/孔 ⌀10 × 1/), "the edit rebuilt the hole").toBeVisible()

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
})
