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

  test("未知地址显示 404，旧的 /practice 跳到学习路径", async ({ page }) => {
    await page.goto("/no-such-page")
    await expect(page.getByText("没有这个页面")).toBeVisible()
    await page.getByRole("link", { name: "回到首页" }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto("/practice")
    await expect(page).toHaveURL(/\/learn$/)
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

  test("/desktop 桌面版介绍", async ({ page }) => {
    await page.goto("/desktop")
    await expect(page.getByRole("heading", { name: "Arbor 桌面版" })).toBeVisible()
    await expect(page.getByRole("link", { name: "下载 macOS 版" })).toHaveAttribute("href", "https://github.com/linjiejim/arbor/releases/latest")
    await expect(page.getByText("claude mcp add --scope user arbor")).toBeVisible()
    await expect(page).toHaveTitle(/桌面版 · Arbor/)
  })
})
