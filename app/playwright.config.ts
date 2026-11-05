import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end smoke tests (e2e/*.e2e.ts) against a production build served by
 * `vite preview`. CI already ran `npm run build`, so there the server only
 * serves dist/; locally the server builds first so the tests never see a stale dist/.
 *
 * WebGL runs on SwiftShader (software) so three.js renders headless on any machine.
 * E2E_CHANNEL=chrome uses the installed Google Chrome instead of Playwright's
 * Chromium (when `npx playwright install chromium` can't download).
 */
const port = Number(process.env.E2E_PORT ?? 4391)
const ci = !!process.env.CI

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // Two workers on CI: SwiftShader renders on the CPU, and three parallel viewers starved each other.
  workers: ci ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: ci ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Failure screenshots are taken by the fixture in e2e/fixtures.ts, named after the route.
    screenshot: "off",
    trace: "on-first-retry",
    locale: "zh-CN",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        channel: process.env.E2E_CHANNEL || undefined,
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
        },
      },
    },
  ],
  webServer: {
    command: `${ci ? "" : "npx vite build && "}npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
