// Measures raw / gzip / brotli sizes of the wasm + JS glue files.
// Usage: node bench/sizes.mjs
import { readFileSync, existsSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => path.join(root, "node_modules", p);

const files = [
  "replicad-opencascadejs/dist/replicad_single.wasm",
  "replicad-opencascadejs/dist/replicad_single.js",
  "replicad-opencascadejs/dist/replicad_multi.wasm",
  "replicad/dist/replicad.js",
  "@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm",
  "@salusoft89/planegcs/dist/planegcs_dist/planegcs.js",
  "three/build/three.module.js",
];

const fmt = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
console.log("file | raw | gzip -6 | gzip -9 | brotli q5 | brotli q11");
for (const f of files) {
  const p = nm(f);
  if (!existsSync(p)) { console.log(f, "MISSING"); continue; }
  const buf = readFileSync(p);
  const g6 = gzipSync(buf, { level: 6 }).length;
  const g9 = gzipSync(buf, { level: 9 }).length;
  const b5 = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length;
  const b11 = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length;
  console.log(`${f} | ${fmt(buf.length)} (${buf.length}) | ${fmt(g6)} | ${fmt(g9)} | ${fmt(b5)} | ${fmt(b11)}`);
}
