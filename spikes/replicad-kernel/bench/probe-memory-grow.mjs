// Log every WebAssembly.Memory.grow() request while repeating fillets.
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
import { buildMugSteps, junctionFinder } from "../src/kernel/mug.js";
const origGrow = WebAssembly.Memory.prototype.grow;
const grows = [];
WebAssembly.Memory.prototype.grow = function (pages) {
  const before = this.buffer.byteLength;
  const r = origGrow.call(this, pages);
  grows.push({ beforeMB: before / 1048576, addMB: (pages * 65536) / 1048576 });
  return r;
};
const oc = await opencascade();
R.setOC(oc);
const mb = () => (oc.wasmMemory.buffer.byteLength / 1048576).toFixed(1);
const rss = () => (process.memoryUsage().rss / 1048576).toFixed(0);
console.log("initial wasm memory bytes", oc.wasmMemory.buffer.byteLength, "grows so far", grows.length);
const which = process.argv[2] ?? "junction";
const b = buildMugSteps({ junctionFillet: 0 });
const fused = b.steps.at(-1).shape;
const body = b.steps.find((s) => s.key === "revolve").shape;
for (let i = 1; i <= 7; i++) {
  grows.length = 0;
  let s;
  if (which === "junction") s = fused.fillet(2, junctionFinder(41));
  else if (which === "bottom") s = body.fillet(6, (e, sh) => e.ofCurveType("CIRCLE").when(R.bottomMost(sh)));
  else if (which === "fuse") s = b.steps.find((x) => x.key === "shell").shape.fuse(b.steps.find((x) => x.key === "sweep").handle);
  s.delete();
  console.log(`#${i} ${which}: wasm ${mb()} MB, RSS ${rss()} MB, grow calls: ${grows.map((g) => `+${g.addMB.toFixed(1)}MB@${g.beforeMB.toFixed(0)}`).join(" ") || "none"}`);
}
console.log("final bytes", oc.wasmMemory.buffer.byteLength);
