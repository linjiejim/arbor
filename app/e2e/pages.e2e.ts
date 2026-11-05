import { LESSONS } from "../src/content/lessons/index"
import { TERMS } from "../src/content/terms"
import { expect, expectRendered, MODELS, test } from "./fixtures"

/** The site's other pages: each opens without errors and its one main interaction works. */
test.describe("页面", () => {
  test("/ 首页", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("看懂每一个特征")
    await expectRendered(page.locator("canvas").first(), "/ hero")
  })

  test("/learn 学习路径", async ({ page }) => {
    await page.goto("/learn")
    await expect(page.getByRole("heading", { name: "学习路径" })).toBeVisible()
    // Every registered lesson is reachable from the outline.
    for (const l of LESSONS) await expect(page.locator(`a[href="/lesson/${l.id}"]`).first(), `/learn links ${l.id}`).toBeAttached()
  })

  test("/teardown 案例列表", async ({ page }) => {
    await page.goto("/teardown")
    for (const m of MODELS) await expect(page.locator(`a[href="/teardown/${m.id}"]`), `/teardown links ${m.id}`).toBeVisible()
    // Thumbnails are rendered in the browser from the baked GLBs.
    await expect(page.locator(`a[href="/teardown/${MODELS[0].id}"] img`)).toBeVisible()
  })

  test("/practice 练习", async ({ page }) => {
    await page.goto("/practice")
    await expect(page.getByRole("heading", { name: "练习" })).toBeVisible()
    await page.getByRole("button", { name: "下移" }).first().click()
    await page.getByRole("button", { name: "检查顺序" }).click()
    await expect(page.getByText(/^(顺序正确|按这个顺序会重建失败|能建出来，但设计意图有问题)$/).first()).toBeVisible()

    await page.getByRole("tab", { name: "改参预测" }).click()
    await expect(page.getByText(/^第 1 题，共 \d+ 题$/)).toBeVisible()
    const canvas = page.locator("canvas").first()
    await expectRendered(canvas, "/practice predict")
    await page.getByRole("tabpanel").getByRole("button", { name: /正常重建|在「.+」失败/ }).first().click()
    await expect(page.getByRole("button", { name: "下一题" })).toBeVisible()
    await expectRendered(canvas, "/practice predict revealed")
  })

  test("/atlas 工具图鉴", async ({ page }) => {
    await page.goto("/atlas")
    await expect(page.getByRole("heading", { name: "工具图鉴" })).toBeVisible()
    const card = page.getByRole("main").getByRole("button").filter({ has: page.locator("canvas") }).first()
    await expectRendered(card.locator("canvas"), "/atlas card")
    await card.click()
    const drawer = page.getByRole("dialog")
    await expect(drawer).toBeVisible()
    await expect(page).toHaveURL(/[?&]op=/)
    await expectRendered(drawer.locator("canvas").first(), "/atlas drawer demo")
    await drawer.getByRole("button", { name: "重放生成过程" }).click()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
  })

  test("/glossary 术语表", async ({ page }) => {
    await page.goto("/glossary")
    await expect(page.getByRole("heading", { name: "术语表" })).toBeVisible()
    await expect(page.getByRole("tab", { name: /^命令/ })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("tabpanel").getByText("SOLIDWORKS").first()).toBeVisible()
    await page.getByRole("tab", { name: /^概念/ }).click()
    await expect(page).toHaveURL(/[?&]tab=concepts/)
    await expect(page.getByRole("tabpanel").getByText(TERMS[0].name, { exact: true })).toBeVisible()
  })
})
