// node bench/run-once.mjs [jsonParams]  -> prints per-step face classification
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { runMug } from "../src/kernel/index.js";

const oc = await opencascade();
setOC(oc);
const params = process.argv[2] ? JSON.parse(process.argv[2]) : {};
const res = runMug(params);
for (const s of res.steps) {
  console.log(`\n## ${s.key} (${s.label}) op ${s.opMs.toFixed(1)}ms mesh ${s.meshMs.toFixed(1)}ms classify ${s.classifyMs.toFixed(1)}ms faces ${s.faceCount} tris ${s.triangleCount} unmatchedGroups ${s.unmatchedGroups}`);
  s.faces.forEach((f, i) => {
    const flag = f.statusHistory === f.statusSignature ? "  " : "!!";
    console.log(`${flag} f${i} ${f.type.padEnd(16)} area ${f.area.toFixed(1).padStart(9)}  history=${f.statusHistory.padEnd(8)} signature=${f.statusSignature.padEnd(8)} faceId=${f.statusFaceId.padEnd(7)} from=${f.from.join(",")}`);
  });
  if (s.deleted.length) console.log("   deleted:", s.deleted.join(","));
}
console.log("\nfailed:", res.failed, "\ntimings:", res.timings);
