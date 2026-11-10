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
    await expect(page.getByRole("heading", { name: "Turnery 桌面版" })).toBeVisible()
    await expect(page.getByRole("link", { name: "下载 macOS 版" })).toHaveAttribute("href", "https://github.com/linjiejim/turnery/releases/latest")
    await expect(page.getByText("claude mcp add --scope user turnery")).toBeVisible()
    await expect(page).toHaveTitle(/桌面版 · Turnery/)
  })

  test("旧域名交接页：带上进度去新域名，到了合并进来", async ({ page }) => {
    // The old host: progress in its storage (set from a plain file, so no app code moves it first);
    // moved.html opens the new host with it in the fragment.
    await page.goto("/favicon.svg")
    await page.evaluate(() => {
      localStorage.setItem("featuretree:progress", JSON.stringify({ done: ["1.1.1"], last: "1.1.1" }))
      localStorage.setItem("ft-studio-v1", JSON.stringify({ tree: { params: { L: 9 }, features: [] }, history: [{ params: {}, features: [] }] }))
    })
    await page.route("https://arbor.linjiejim.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>new host</p>" }))
    await page.goto("/moved.html")
    await expect(page.getByText("new host")).toBeVisible()
    const url = new URL(page.url())
    expect(url.origin).toBe("https://arbor.linjiejim.com")
    expect(url.pathname, "/moved.html itself goes to the home page").toBe("/")
    const handed = JSON.parse(decodeURIComponent(url.hash.slice("#arbor-move=".length))).d
    expect(Object.keys(handed).sort()).toEqual(["featuretree:progress", "ft-studio-v1"])
    expect(JSON.parse(handed["featuretree:progress"]).done).toEqual(["1.1.1"])
    expect(JSON.parse(handed["ft-studio-v1"]).history, "the undo history stays behind").toEqual([])
    await page.unroute("https://arbor.linjiejim.com/**")

    // The new host (here: the same preview server, fresh storage): merged once, the fragment gone.
    await page.goto("/")
    await page.evaluate(() => localStorage.clear())
    await page.goto(`/learn${url.hash}`)
    await expect(page).toHaveURL(/\/learn$/)
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem("arbor:progress") ?? "{}"))
    expect(progress.done).toContain("1.1.1")
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ft-studio-v1") ?? "{}").tree.params.L)).toBe(9)
  })
})
