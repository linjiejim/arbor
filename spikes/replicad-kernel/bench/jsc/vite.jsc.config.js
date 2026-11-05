import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  logLevel: "warn",
  build: {
    target: "es2022",
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    minify: false,
    lib: { entry: fileURLToPath(new URL("./harness.js", import.meta.url)), formats: ["es"], fileName: () => "harness.mjs" },
    rollupOptions: { external: [/^node:/] },
  },
});
