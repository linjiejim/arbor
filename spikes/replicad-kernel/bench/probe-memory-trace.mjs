import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { buildMugSteps, disposeBuild } from "../src/kernel/mug.js";
import { meshShape, meshEdgesOf, faceSignatures, classifyBySignature } from "../src/kernel/mesh.js";
const oc = await opencascade();
setOC(oc);
let last = oc.wasmMemory.buffer.byteLength;
const mark = (label) => { const now = oc.wasmMemory.buffer.byteLength; if (now !== last) console.log(`  ${label}: ${(last / 1048576).toFixed(0)} -> ${(now / 1048576).toFixed(0)} MB`); last = now; };
for (let run = 1; run <= 6; run++) {
  console.log("run", run);
  const b = buildMugSteps({ height: 90 + run });
  mark("build");
  let prev = null, prevSigs = null;
  for (const s of b.steps) {
    const m = meshShape(s.shape);
    mark(`${s.key} mesh`);
    meshEdgesOf(s.shape);
    mark(`${s.key} edges`);
    const { sigs } = faceSignatures(s.shape, m);
    mark(`${s.key} signatures`);
    classifyBySignature(prev, prevSigs, sigs);
    mark(`${s.key} classify`);
    prev = s.shape; prevSigs = sigs;
  }
  disposeBuild(b);
  mark("dispose");
}
