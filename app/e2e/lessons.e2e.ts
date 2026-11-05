import { LESSONS } from "../src/content/lessons/index"
import { expect, expectRendered, test } from "./fixtures"

/**
 * Every registered lesson (src/content/lessons/index.ts): open it, walk every
 * step with the footer button, answer the quiz, finish. A new lesson is covered
 * as soon as it is registered.
 */
test.describe("互动课", () => {
  LESSONS.forEach((lesson, i) => {
    const next = LESSONS[i + 1]
    const url = `/lesson/${lesson.id}`
    test(`${url} ${lesson.title}`, async ({ page }) => {
      await page.goto(url)
      const canvas = page.locator("canvas").first()
      const steps = page.getByRole("tablist", { name: "课程步骤" }).getByRole("tab")
      await expect(steps.first()).toBeVisible()
      const total = await steps.count()
      expect(total, "at least one step plus the quiz").toBeGreaterThan(1)

      for (let s = 1; s < total; s++) {
        await expect(page.getByText(`${s} / ${total}`, { exact: true })).toBeVisible()
        await expectRendered(canvas, `${url} step ${s}`)
        await page.getByRole("button", { name: /^(下一步|先跳过)$/ }).click()
      }

      await expect(page.getByText(`${total} / ${total}`, { exact: true })).toBeVisible()
      await expect(page.getByRole("heading", { name: "小测" })).toBeVisible()
      // Pick the first option of each question; answered questions disable their options.
      const open = page.getByTestId("quiz").locator("button:enabled")
      for (let guard = 0; (await open.count()) > 0; guard++) {
        expect(guard, "quiz keeps offering options").toBeLessThan(20)
        await open.first().click()
      }
      await expect(page.getByText(/答对 \d+ \/ \d+/)).toBeVisible()
      await expect(page.getByText("本课要点")).toBeVisible()
      await expectRendered(canvas, `${url} quiz`)

      const finish = page.getByRole("button", { name: next ? "完成，下一课" : "完成本课" })
      await expect(finish).toBeEnabled()
      await finish.click()
      // The next lesson has its own test; don't pay for loading it twice.
      await expect(page).toHaveURL(next ? `/lesson/${next.id}` : "/learn")
    })
  })
})
