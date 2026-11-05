// Runs the mug kernel inside Apple's jsc shell (WebKit's wasm engine) — built by bench/jsc/build.sh
import "./polyfills.js";
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { runMug } from "../../src/kernel/index.js";
import { buildMugSteps, disposeBuild } from "../../src/kernel/mug.js";
import { meshShape } from "../../src/kernel/mesh.js";

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f1 = (x) => x.toFixed(1);
const WASM = "node_modules/replicad-opencascadejs/dist/replicad_single.wasm";

const r0 = performance.now();
const bytes = readFile(WASM, "binary");
const r1 = performance.now();
const module = await WebAssembly.compile(bytes);
const r2 = performance.now();
const oc = await opencascade({
  instantiateWasm(imports, receive) {
    WebAssembly.instantiate(module, imports).then((instance) => receive(instance, module));
    return {};
  },
});
setOC(oc);
const r3 = performance.now();
print(`jsc init: read ${f1(r1 - r0)} ms, compile ${f1(r2 - r1)} ms, instantiate ${f1(r3 - r2)} ms, total ${f1(r3 - r0)} ms`);

const first = runMug({ height: 94 });
print(`first full run: total ${f1(first.timings.totalMs)} ms (ops ${f1(first.timings.buildMs)}, mesh ${f1(first.timings.meshMs)}, classify ${f1(first.timings.classifyMs)}) failed=${JSON.stringify(first.failed)}`);
print("first-run op ms: " + first.steps.map((s) => `${s.key}=${f1(s.opMs)}`).join(" "));
for (let i = 0; i < 3; i++) runMug({ height: 90 + i });
const totals = [], ops = [], mesh = [], cls = [], per = {};
for (let i = 0; i < 10; i++) {
  const r = runMug({ height: 95 + (i % 2), diameter: 82 - (i % 3) });
  totals.push(r.timings.totalMs); ops.push(r.timings.buildMs); mesh.push(r.timings.meshMs); cls.push(r.timings.classifyMs);
  for (const s of r.steps) (per[s.key] ??= []).push(s.opMs);
}
print(`warm full pipeline (n=10): median ${f1(median(totals))} ms (ops ${f1(median(ops))}, mesh ${f1(median(mesh))}, classify ${f1(median(cls))})`);
print("warm op ms: " + Object.entries(per).map(([k, v]) => `${k}=${f1(median(v))}`).join(" "));
const fin = [];
for (let i = 0; i < 10; i++) {
  const t = performance.now();
  const b = buildMugSteps({ height: 95 + (i % 2) });
  meshShape(b.steps[b.steps.length - 1].shape, { tolerance: 0.05, angularTolerance: 0.2 });
  fin.push(performance.now() - t);
  disposeBuild(b);
}
print(`slider case ops + final mesh (n=10): median ${f1(median(fin))} ms`);
print(`wasm memory now ${(oc.wasmMemory.buffer.byteLength / 1048576).toFixed(0)} MB`);
const fail = runMug({ bottomFillet: 3, wall: 3.5 }, { classify: false });
print(`failure case surfaces as: ${JSON.stringify(fail.failed)}`);
