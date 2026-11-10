import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The window of Turnery, the desktop app (../desktop): another entry of this
// app, with the same React, design system and studio components. Built into
// ../desktop/dist/renderer by `npm run build` there.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // The site's public/ (baked teardown models, favicon) isn't part of the desktop window.
  publicDir: false,
  optimizeDeps: { exclude: ['replicad-opencascadejs'] },
  build: {
    outDir: path.resolve(import.meta.dirname, '../desktop/dist/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rolldownOptions: { input: path.resolve(import.meta.dirname, 'desktop.html') },
  },
})
