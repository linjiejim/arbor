// Does the multi-threaded build (pthreads) run, and is it faster? node bench/probe-multi.mjs [single|multi]
const which = process.argv[2] ?? "multi";
const t0 = performance.now();
const { default: opencascade } = await import(which === "multi" ? "replicad-opencascadejs/multi" : "replicad-opencascadejs");
const { setOC } = await import("replicad");
const oc = await opencascade();
setOC(oc);
const init = performance.now() - t0;
const { buildMugSteps, disposeBuild } = await import("../src/kernel/mug.js");
const { meshShape } = await import("../src/kernel/mesh.js");
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
for (let i = 0; i < 3; i++) disposeBuild(buildMugSteps({ height: 90 + i }));
const ops = [], mesh = [], fuse = [];
for (let i = 0; i < 9; i++) {
  const a = performance.now();
  const b = buildMugSteps({ height: 95 + (i % 2) });
  ops.push(performance.now() - a);
  fuse.push(b.steps.find((s) => s.key === "fuse").ms);
  const m0 = performance.now();
  meshShape(b.steps.at(-1).shape, { tolerance: 0.05, angularTolerance: 0.2 });
  mesh.push(performance.now() - m0);
  disposeBuild(b);
}
console.log(`${which}: init ${init.toFixed(0)} ms, ops median ${med(ops).toFixed(1)} ms (fuse ${med(fuse).toFixed(1)}), final mesh median ${med(mesh).toFixed(1)} ms, threads? ${typeof SharedArrayBuffer !== "undefined" && oc.wasmMemory.buffer instanceof SharedArrayBuffer}`);
process.exit(0);
