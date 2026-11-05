// Does the fillet shape mode change the wasm memory high-water mark? node bench/probe-memory-fillet-mode.mjs <Rational|Polynomial|QuasiAngular>
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
import { buildMugSteps, junctionFinder } from "../src/kernel/mug.js";
const oc = await opencascade();
R.setOC(oc);
const mode = process.argv[2] ?? "Polynomial";
const mb = () => (oc.wasmMemory.buffer.byteLength / 1048576).toFixed(0);
const fused = buildMugSteps({ junctionFillet: 0 }).steps.at(-1).shape;
const edges = junctionFinder(41)(new R.EdgeFinder(), fused).find(fused);
const out = [];
for (let i = 1; i <= 10; i++) {
  const b = new oc.BRepFilletAPI_MakeFillet(fused.wrapped, oc.ChFi3d_FilletShape["ChFi3d_" + mode]);
  edges.forEach((e) => b.Add(2, e.wrapped));
  const t = performance.now();
  const s = b.Shape();
  out.push(`${(performance.now() - t).toFixed(0)}ms/${mb()}MB`);
  s.delete(); b.delete();
}
console.log(mode, "edges", edges.length, out.join(" "));
