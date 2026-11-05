// One cold init in a fresh process (spawned by node-bench.mjs).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const t0 = performance.now();
const { default: opencascade } = await import("replicad-opencascadejs");
const oc = await opencascade();
const init = performance.now() - t0;
const require = createRequire(import.meta.url);
const wasmPath = require.resolve("replicad-opencascadejs/wasm");
const r0 = performance.now();
const bytes = readFileSync(wasmPath);
const read = performance.now() - r0;
const c0 = performance.now();
await WebAssembly.compile(bytes);
const compile = performance.now() - c0;
console.log(`INIT_MS ${init.toFixed(1)} COMPILE_MS ${compile.toFixed(1)} READ_MS ${read.toFixed(1)}`, typeof oc.BRepAlgoAPI_Fuse);
