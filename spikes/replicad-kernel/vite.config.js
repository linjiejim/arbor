import { defineConfig } from "vite";

// COOP/COEP make the page cross-origin isolated, which the multi-threaded
// OpenCascade build (?build=multi) needs for SharedArrayBuffer. The default
// single-threaded build works without them.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  server: { port: 5199, strictPort: false, headers: isolation },
  preview: { port: 5199, headers: isolation },
  // The Emscripten glue locates its .wasm via import.meta.url; keep it out of dep pre-bundling.
  optimizeDeps: { exclude: ["replicad-opencascadejs", "@salusoft89/planegcs"] },
  worker: { format: "es" },
  build: { target: "es2022" },
});
