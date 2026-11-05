import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
import { trackedRevolve, trackedFillet, trackedShell, trackedFuse } from "../src/kernel/ops.js";
import { junctionFinder, handleGeometry, DEFAULT_PARAMS } from "../src/kernel/mug.js";
const oc = await opencascade();
R.setOC(oc);
let last = oc.wasmMemory.buffer.byteLength;
const mark = (label) => { const now = oc.wasmMemory.buffer.byteLength; console.log(`  ${label}: ${(now / 1048576).toFixed(0)} MB${now !== last ? `  (+${((now - last) / 1048576).toFixed(0)})` : ""}`); last = now; };
const mode = process.argv[2] ?? "tracked";
for (let run = 1; run <= 4; run++) {
  console.log("run", run, mode);
  const p = { ...DEFAULT_PARAMS, height: 90 + run };
  const { R: Rr, reach, span, hp, zc, x0, rc } = handleGeometry(p);
  const prof = R.draw([0, 0]).hLine(Rr).vLine(p.height).hLine(-Rr).close();
  let body;
  if (mode === "plain") {
    body = prof.sketchOnPlane("XZ").revolve(); mark("revolve");
    body = body.fillet(p.bottomFillet, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s))); mark("fillet");
    body = body.shell(p.wall, (f) => f.inPlane("XY", p.height)); mark("shell");
  } else {
    body = trackedRevolve(prof).shape; mark("revolve");
    body = trackedFillet(body, p.bottomFillet, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s))).shape; mark("fillet");
    body = trackedShell(body, p.wall, (f) => f.inPlane("XY", p.height)).shape; mark("shell");
  }
  const path = R.draw([x0, zc + span / 2]).hLine(Rr + reach - x0).customCorner(rc).vLine(-span).customCorner(rc).hLine(-(Rr + reach - x0)).done();
  const handle = path.sketchOnPlane("XZ").sweepSketch((plane, origin) => R.sketchCircle(hp, { plane, origin })); mark("sweep");
  const fused = mode === "plain" ? body.fuse(handle) : trackedFuse(body, handle).shape; mark("fuse");
  const fin = mode === "plain" ? fused.fillet(p.junctionFillet, junctionFinder(Rr)) : trackedFillet(fused, p.junctionFillet, junctionFinder(Rr)).shape; mark("junction fillet");
}
