import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // The studio API (app/server) runs separately: `npm run dev:api`.
  server: { port: 5287, strictPort: true, proxy: { "/api": "http://127.0.0.1:18914" } },
  preview: { proxy: { "/api": "http://127.0.0.1:18914" } },
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
