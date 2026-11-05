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
    await page.getByRole("tab", { name: "特征树" }).click()
    await expect(page.getByText("5 个特征").first()).toBeVisible()
    await page.getByRole("tab", { name: "代码" }).first().click()
    await expect(page.getByText(/extrude\(sk_sk1, amount=H\)/).first()).toBeVisible()
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
    await page.getByRole("tab", { name: "特征树" }).first().click()
    await expect(page.getByLabel("失败").first(), "the failing feature is marked").toBeVisible()
    // …and putting it back rebuilds cleanly.
    await page.getByRole("tab", { name: "参数" }).first().click()
    await page.getByLabel("d0", { exact: true }).fill("40")
    await page.getByLabel("d0", { exact: true }).press("Enter")
    await page.getByRole("tab", { name: "特征树" }).first().click()
    await expect(page.getByLabel("失败")).toHaveCount(0)
  })
})
