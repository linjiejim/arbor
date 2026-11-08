/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const api = `http://127.0.0.1:${process.env.STUDIO_API_PORT ?? 18914}`

/**
 * The site's /desktop page shares its name with desktop.html (the Arbor window, a separate build):
 * the dev server would serve that file for /desktop. Send the page to the site's index.html instead.
 */
const desktopPage: Plugin = {
  name: "arbor-desktop-page",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/desktop\/?(\?.*)?$/.test(req.url)) req.url = "/index.html"
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), desktopPage],
  // Kernel tests (OpenCascade in wasm) run side by side: a busy machine can take seconds per build.
  test: { testTimeout: 30_000 },
  // Recorded in shared links, so an old link can say which build made it.
  define: { __APP_VERSION__: JSON.stringify((process.env.GITHUB_SHA ?? "dev").slice(0, 7)) },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // The studio API (app/server) runs separately: `npm run dev:api`. STUDIO_API_PORT points elsewhere (a second checkout, the e2e run).
  server: { port: 5287, strictPort: true, proxy: { "/api": api } },
  preview: { proxy: { "/api": api } },
  // The OpenCascade glue locates its .wasm itself; keep it out of dependency pre-bundling.
  optimizeDeps: { exclude: ["replicad-opencascadejs"] },
  worker: { format: "es" },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // three.js changes rarely: its own long-cached chunk.
        advancedChunks: { groups: [{ name: "three", test: /node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
})
