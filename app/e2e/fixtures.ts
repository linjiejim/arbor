import fs from "node:fs"
import path from "node:path"
import { expect, test as base, type Locator, type Page } from "@playwright/test"
import type { Manifest, ModelIndexEntry } from "../src/three/baked"

/**
 * Shared smoke-test setup:
 *  - every test fails on an uncaught page error or a console.error;
 *  - a failing test leaves a screenshot named after the route it was on
 *    (test-results/<test>/<route>.png, also attached to the HTML report).
 */
export const test = base.extend<{ watch: void }>({
  watch: [
    async ({ page }, use, testInfo) => {
      const problems: string[] = []
      const where = () => route(page)
      page.on("pageerror", (e) => problems.push(`[${where()}] pageerror: ${e.stack ?? e.message}`))
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`[${where()}] console.error: ${m.text()} ${m.location().url ?? ""}`.trim())
      })
      await use()
      if ((testInfo.status !== testInfo.expectedStatus || problems.length) && !page.isClosed()) {
        const file = testInfo.outputPath(`${slug(route(page))}.png`)
        const shot = await page.screenshot({ path: file }).catch(() => null)
        if (shot) await testInfo.attach(`screenshot ${route(page)}`, { path: file, contentType: "image/png" })
      }
      expect(problems, "page errors / console.error").toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

const route = (page: Page) => {
  const u = new URL(page.url(), "http://x")
  return u.pathname + u.search
}
const slug = (r: string) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/[^\w-]+/g, "_"))

// ------------------------------------------------------------------ content on disk

const publicDir = path.resolve(import.meta.dirname, "../public")
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(publicDir, p), "utf8"))

/** Every teardown model, straight from public/models/index.json, with its manifest. */
export const MODELS = Object.values(readJson<Record<string, ModelIndexEntry>>("models/index.json")).map((entry) => ({
  ...entry,
  manifest: readJson<Manifest>(`models/${entry.id}/manifest.json`),
}))

// ------------------------------------------------------------------ canvas

/**
 * Overlays drawn on top of a viewport (labels, view cube, toolbars) are hidden
 * while measuring the canvas itself. Descendants too: the view cube sets
 * `visibility: visible` inline on its faces.
 */
const HIDE_OVERLAYS = ["canvas ~ *", "canvas ~ * *", "div:has(> canvas) ~ *", "div:has(> canvas) ~ * *"].join(", ") + " { visibility: hidden !important; }"

/**
 * Share of the canvas covered by something other than its background colour,
 * read from a screenshot (WebGL canvases don't keep their drawing buffer, so
 * reading pixels back from the page would see an empty buffer).
 */
export async function inkShare(canvas: Locator) {
  const png = await canvas.screenshot({ style: HIDE_OVERLAYS, animations: "allow", scale: "css" })
  return canvas.page().evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
    const g = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!
    g.drawImage(bmp, 0, 0)
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data
    // Background = the most common colour, quantised to 5 bits per channel.
    const counts = new Map<number, number>()
    for (let i = 0; i < d.length; i += 4) {
      const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const top = Math.max(...counts.values())
    return 1 - top / (d.length / 4)
  }, png.toString("base64"))
}

/**
 * Lowest ink share that still counts as "drew something". A bare background
 * (WebGL failed, nothing rendered) is 0; the ground grid alone is about 0.08
 * at 1440×900, every lesson step measured at least 0.05. So this catches a
 * blank or dead canvas, not a missing model (a missing GLB is a console error).
 */
export const MIN_INK = 0.01

/**
 * The canvas shows more than its background colour (retried while models load
 * and cameras fly). Software WebGL on CI runners can take many seconds per
 * frame for the heavier scenes, hence the long window.
 */
export async function expectRendered(canvas: Locator, what: string) {
  await expect(canvas, `${what}: canvas visible`).toBeVisible()
  await expect
    .poll(() => inkShare(canvas), { message: `${what}: canvas is blank (share of non-background pixels)`, timeout: 40_000, intervals: [500, 1000, 2000] })
    .toBeGreaterThan(MIN_INK)
}
