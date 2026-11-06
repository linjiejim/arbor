// Builds Arbor into desktop/dist:
//   main.mjs, preload.cjs      Electron main process and the window's bridge
//   cli.mjs                    `arbor` (MCP server included)
//   kernel/kernel-thread.mjs   the OpenCascade worker thread
//   fonts/, vendor/opencascade/   what the kernel loads at runtime
//   renderer/                  the window (Vite, from app/desktop.html)
// The shared code lives in app/src; its packages resolve from app/node_modules.
//
//   node scripts/build.mjs          build once
//   node scripts/build.mjs --dev    build, start Vite with hot reload, launch Electron
import { spawn } from "node:child_process"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const appDir = path.resolve(root, "../app")
const dist = path.join(root, "dist")
const dev = process.argv.includes("--dev")
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"))

/** `@/x` in app/src → app/src/x, as in the web app's Vite config. */
const appAlias = {
  name: "app-alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (args) => b.resolve(`./${args.path.slice(2)}`, { kind: args.kind, resolveDir: path.join(appDir, "src") }))
  },
}

const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  sourcemap: true,
  logLevel: "warning",
  nodePaths: [path.join(appDir, "node_modules")],
  // Packages found through nodePaths would otherwise resolve to their CommonJS "main": a second copy next to the ESM one.
  mainFields: ["module", "main"],
  plugins: [appAlias],
  external: ["electron"],
  define: { __ARBOR_VERSION__: JSON.stringify(pkg.version) },
}

/**
 * The OpenCascade glue finds its .wasm next to itself, so it isn't bundled: the kernel
 * thread loads it from dist/vendor/opencascade/ (copied below), relative to kernel/.
 */
const vendorOpenCascade = {
  name: "vendor-opencascade",
  setup(b) {
    b.onResolve({ filter: /^replicad-opencascadejs$/ }, () => ({ path: "../vendor/opencascade/replicad_single.js", external: true }))
  },
}
const esm = { ...common, format: "esm", banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } }

await rm(dist, { recursive: true, force: true })
await Promise.all([
  build({ ...esm, entryPoints: [path.join(root, "src/main/main.ts")], outfile: path.join(dist, "main.mjs") }),
  build({ ...common, format: "cjs", entryPoints: [path.join(root, "src/main/preload.ts")], outfile: path.join(dist, "preload.cjs") }),
  build({ ...esm, entryPoints: [path.join(root, "src/cli/cli.ts")], outfile: path.join(dist, "cli.mjs") }),
  build({
    ...esm,
    plugins: [...common.plugins, vendorOpenCascade],
    entryPoints: [path.join(root, "src/engine/kernel-thread.ts")],
    outfile: path.join(dist, "kernel/kernel-thread.mjs"),
  }),
])

// kernel/fonts.ts loads `new URL("../fonts/…", import.meta.url)`: next to kernel/.
await mkdir(path.join(dist, "fonts"), { recursive: true })
for (const f of ["text-latin.ttf", "text-sc.ttf", "OFL.txt"]) await cp(path.join(appDir, "src/studio/fonts", f), path.join(dist, "fonts", f))
// OpenCascade (LGPL-2.1): its wasm stays a separate, replaceable file, as on the site.
const oc = path.join(appDir, "node_modules/replicad-opencascadejs")
const ocOut = path.join(dist, "vendor/opencascade")
await mkdir(ocOut, { recursive: true })
await cp(path.join(oc, "LICENSE"), path.join(ocOut, "LICENSE"))
for (const f of ["replicad_single.js", "replicad_single.wasm"]) await cp(path.join(oc, "dist", f), path.join(ocOut, f))
await writeFile(path.join(ocOut, "package.json"), `${JSON.stringify({ type: "module" })}\n`)

const vite = path.join(appDir, "node_modules/.bin/vite")
const run = (args, env = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(vite, args, { cwd: appDir, stdio: "inherit", env: { ...process.env, ...env } })
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`vite ${args[0] ?? ""} exited with ${code}`))))
  })

if (!dev) {
  await run(["build", "--config", "vite.desktop.config.ts"])
  console.log(`built Arbor ${pkg.version} → ${path.relative(process.cwd(), dist) || "."}`)
} else {
  const port = Number(process.env.ARBOR_DEV_PORT ?? 5288)
  const server = spawn(vite, ["--config", "vite.desktop.config.ts", "--port", String(port), "--strictPort"], { cwd: appDir, stdio: "inherit" })
  await new Promise((r) => setTimeout(r, 1500))
  const electron = path.join(root, "node_modules/.bin/electron")
  const app = spawn(electron, ["."], { cwd: root, stdio: "inherit", env: { ...process.env, ARBOR_RENDERER_URL: `http://localhost:${port}/desktop.html` } })
  app.on("exit", () => server.kill())
}
