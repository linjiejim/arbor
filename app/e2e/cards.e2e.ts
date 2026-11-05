import { CARDS } from "../src/content/cards/index"
import { expect, test } from "./fixtures"

/** Every registered 图文卡: opens, shows its sections and sources, the quiz unlocks 完成. */
test.describe("图文卡", () => {
  for (const c of CARDS) {
    test(`/card/${c.code}`, async ({ page }) => {
      await page.goto(`/card/${c.code}`)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(page.getByRole("heading", { name: "参考来源" })).toBeVisible()
      const quiz = page.getByTestId("quiz")
      await expect(quiz).toBeVisible()
      // Answer every question with its first option until none is left open.
      for (let i = 0; i < 6; i++) {
        const open = quiz.getByRole("button").and(page.locator(":not([disabled])"))
        if (!(await open.count())) break
        await open.first().click()
      }
      await expect(page.getByRole("button", { name: /^完成(，下一张|本卡)$/ })).toBeEnabled()
    })
  }
})
