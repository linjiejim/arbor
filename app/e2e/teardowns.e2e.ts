import type { AssemblyManifest, PartManifest } from "../src/three/baked"
import { expect, expectRendered, MODELS, test } from "./fixtures"
import type { Page } from "@playwright/test"

/**
 * Every teardown in public/models/index.json: parts are stepped through their
 * feature timeline and get one sandbox parameter changed (plus one failing
 * combination when there is one); assemblies explode, play their assembly
 * order and move their joints. A newly baked model is covered automatically.
 */
test.describe("案例拆解", () => {
  for (const model of MODELS) {
    const url = `/teardown/${model.id}`
    test(`${url} ${model.title}`, async ({ page }) => {
      await page.goto(url)
      if (model.manifest.kind === "part") await part(page, url, model.manifest)
      else await assembly(page, url, model.manifest)
    })
  }
})

async function part(page: Page, url: string, m: PartManifest) {
  const n = m.features.length
  const canvas = page.locator("canvas").first()
  await expect(page.getByText(`第 ${n} 步，共 ${n} 步`)).toBeVisible()
  await expect(page.getByText("正在加载这组参数的模型")).toBeHidden()
  await expectRendered(canvas, `${url} loaded`)

  // Timeline: jump to the first feature, then step forward to the last.
  const first = m.features[0]
  await page.getByTitle(`${first.name} · ${first.title}`, { exact: true }).click()
  await expect(page.getByText(`第 1 步，共 ${n} 步`)).toBeVisible()
  const next = page.getByRole("button", { name: "下一步", exact: true })
  for (let i = 2; i <= n; i++) {
    await next.click()
    await expect(page.getByText(`第 ${i} 步，共 ${n} 步`)).toBeVisible()
  }
  await expect(next).toBeDisabled()
  await expectRendered(canvas, `${url} last feature`)

  await page.getByRole("tab", { name: "代码" }).click()
  await expect(page.getByText("完整源码")).toBeVisible()

  await page.getByRole("switch", { name: "剖切" }).click()
  await expectRendered(canvas, `${url} section`)
  await page.getByRole("switch", { name: "剖切" }).click()

  // Sandbox: a combination that fails in the kernel (if one is a single click away), then a working one.
  const grid = m.params.filter((p) => p.values.length)
  if (!grid.length) return
  await page.getByRole("tab", { name: "参数" }).click()
  const values: Record<string, number> = Object.fromEntries(m.params.map((p) => [p.id, p.default]))
  const loaded = new Set([m.variants[m.defaultVariant]?.file])
  // One click away from the current values, and a GLB the page hasn't fetched yet.
  const oneClick = (ok: boolean) =>
    grid
      .flatMap((p) => p.values.filter((v) => v !== values[p.id]).map((v) => ({ param: p, value: v, variant: m.variants[variantKey(grid, { ...values, [p.id]: v })] })))
      .find((x) => x.variant && x.variant.ok === ok && !loaded.has(x.variant.file))
  for (const ok of [false, true]) {
    const pick = oneClick(ok)
    if (!pick) continue
    const file = pick.variant.file
    const glb = file ? page.waitForResponse((r) => r.url().endsWith(`/models/${m.id}/${file}`), { timeout: 15_000 }) : null
    await page
      .getByTestId(`param-${pick.param.id}`)
      .getByRole("button", { name: `${pick.value}${pick.param.unit ?? ""}`, exact: true })
      .click()
    if (glb) expect((await glb).ok(), `${file} served`).toBe(true)
    values[pick.param.id] = pick.value
    loaded.add(file)
    await expect(page.getByText("正在加载这组参数的模型")).toBeHidden()
    if (!pick.variant.ok) await expect(page.getByText(/这组参数在「.+」失败/)).toBeVisible()
    await expectRendered(canvas, `${url} ${pick.param.id}=${pick.value}`)
  }
}

async function assembly(page: Page, url: string, m: AssemblyManifest) {
  const canvas = page.locator("canvas").first()
  await expect(page.getByRole("button", { name: "按装配顺序播放" })).toBeVisible()
  await expect(page.getByText("正在加载装配")).toBeHidden()
  await expectRendered(canvas, `${url} loaded`)

  // Explode fully, then back together. Keyboard End/Home drive the native range input.
  const explode = page.getByRole("slider", { name: /^爆炸/ })
  await explode.press("End")
  await expect(page.getByText("100%", { exact: true })).toBeVisible()
  await expectRendered(canvas, `${url} exploded`)
  await explode.press("Home")
  await expect(page.getByText("0%", { exact: true })).toBeVisible()

  for (const p of m.parts.filter((x) => x.motion)) {
    const joint = page.getByRole("slider", { name: new RegExp(`^${escapeRegExp(p.motion!.label)}`) })
    await joint.press("End")
    await expect(page.getByText(`${p.motion!.max}°`, { exact: true })).toBeVisible()
  }

  await page.getByRole("switch", { name: "剖切" }).click()
  await page.getByRole("slider", { name: /^剖切位置/ }).press("PageUp")
  await expectRendered(canvas, `${url} section`)
  await page.getByRole("switch", { name: "剖切" }).click()

  await page.getByRole("button", { name: "按装配顺序播放" }).click()
  await expect(page.getByRole("button", { name: "停止播放" })).toBeVisible()
  await expect(page.getByRole("button", { name: "按装配顺序播放" })).toBeVisible({ timeout: 30_000 })
  await expectRendered(canvas, `${url} after playback`)
}

/** Same key as the app's variantKey (src/three/baked.ts), kept here so the test doesn't load three.js. */
function variantKey(grid: PartManifest["params"], values: Record<string, number>) {
  return (
    grid
      .map((p) => p.id)
      .sort()
      .map((id) => `${id}-${Number(values[id].toPrecision(6))}`)
      .join("_") || "default"
  )
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
