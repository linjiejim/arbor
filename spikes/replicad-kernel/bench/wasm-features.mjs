// Lists custom sections (target_features, producers) and imports/exports summary of a wasm file.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const file = process.argv[2] ?? require.resolve("replicad-opencascadejs/wasm");
const b = readFileSync(file);
let p = 8;
const leb = () => { let r = 0, s = 0, x; do { x = b[p++]; r |= (x & 0x7f) << s; s += 7; } while (x & 0x80); return r >>> 0; };
const str = () => { const n = leb(); const s = b.subarray(p, p + n).toString("utf8"); p += n; return s; };
const sections = {};
let opcodeHints = { legacyTry: 0, tryTable: 0 };
while (p < b.length) {
  const id = b[p++];
  const size = leb();
  const start = p;
  if (id === 0) {
    const name = str();
    if (name === "target_features") {
      const n = leb(); const feats = [];
      for (let i = 0; i < n; i++) { const prefix = String.fromCharCode(b[p++]); feats.push(prefix + str()); }
      console.log("target_features:", feats.join(" "));
    } else if (name === "producers") {
      const n = leb(); const out = [];
      for (let i = 0; i < n; i++) { const field = str(); const m = leb(); const vals = []; for (let j = 0; j < m; j++) vals.push(str() + " " + str()); out.push(`${field}: ${vals.join(", ")}`); }
      console.log("producers:", out.join(" | "));
    } else sections["custom:" + name] = size;
  } else {
    sections[id] = size;
  }
  p = start + size;
}
const names = { 1: "type", 2: "import", 3: "function", 4: "table", 5: "memory", 6: "global", 7: "export", 8: "start", 9: "element", 10: "code", 11: "data", 12: "datacount", 13: "tag" };
for (const [k, v] of Object.entries(sections)) console.log(`section ${names[k] ?? k}: ${(v / 1048576).toFixed(2)} MB`);
const mod = new WebAssembly.Module(b);
const imp = WebAssembly.Module.imports(mod);
const exp = WebAssembly.Module.exports(mod);
console.log("imports:", imp.length, "exports:", exp.length, "memory import/export:", [...imp, ...exp].filter((x) => x.kind === "memory").map((x) => x.name).join(","), "tags:", [...imp, ...exp].filter((x) => x.kind === "tag").length);
