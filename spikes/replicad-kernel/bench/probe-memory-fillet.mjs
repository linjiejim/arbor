// node --expose-gc bench/probe-memory-fillet.mjs : repeated junction fillet on one fused shape
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
import { buildMugSteps } from "../src/kernel/mug.js";
import { junctionFinder } from "../src/kernel/mug.js";
const oc = await opencascade();
R.setOC(oc);
const mb = () => (oc.wasmMemory.buffer.byteLength / 1048576).toFixed(0);
const b = buildMugSteps({ junctionFillet: 0 });
const fused = b.steps.at(-1).shape;
console.log("fused faces", fused.faces.length, "memory", mb());
const radius = Number(process.argv[2] ?? 2);
for (let i = 1; i <= 12; i++) {
  const t = performance.now();
  const s = fused.fillet(radius, junctionFinder(41));
  const ms = performance.now() - t;
  s.delete();
  global.gc?.();
  await new Promise((r) => setTimeout(r, 0));
  console.log(`fillet #${i} r=${radius}: ${ms.toFixed(1)} ms, wasm memory ${mb()} MB`);
}
