// node --expose-gc bench/probe-memory-gc.mjs : is the heap growth a real leak or lazy finalization?
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { runMug } from "../src/kernel/index.js";
const oc = await opencascade();
setOC(oc);
const mb = () => (oc.wasmMemory.buffer.byteLength / 1048576).toFixed(0);
const used = () => {
  // Rough "in use" probe: try malloc of a big block and see where it lands is not reliable; use mallinfo-like export if present
  return oc._malloc_usable_size ? "" : "";
};
const settle = async () => { global.gc(); await new Promise((r) => setTimeout(r, 0)); global.gc(); await new Promise((r) => setTimeout(r, 0)); };
console.log("after init", mb(), "MB");
for (let i = 1; i <= 40; i++) {
  runMug({ height: 90 + (i % 10) });
  await settle();
  if (i % 5 === 0) console.log(`after ${i} runs + forced GC: wasm memory ${mb()} MB`);
}
