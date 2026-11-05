// Kernel benchmark in Node (same kernel code as the Web Worker).
// Usage: node bench/node-bench.mjs [--quick]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
const { setOC } = R;
import { runMug, DEFAULT_PARAMS, PARAM_RANGES } from "../src/kernel/index.js";
import { buildMugSteps, disposeBuild, handleGeometry, junctionFinder } from "../src/kernel/mug.js";
import { meshShape } from "../src/kernel/mesh.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const quick = process.argv.includes("--quick");
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const f1 = (x) => (x === undefined || x === null ? "-" : x.toFixed(1));

console.log(`# replicad kernel bench — node ${process.version}, ${os.cpus()[0].model}, ${os.cpus().length} cores, ${os.platform()} ${os.arch()}`);

// ---------------------------------------------------------------- 1. cold init (separate processes)
{
  const N = quick ? 2 : 5;
  const script = path.join(here, "init-once.mjs");
  const times = [];
  for (let i = 0; i < N; i++) {
    const r = spawnSync(process.execPath, [script], { encoding: "utf8" });
    const m = r.stdout.match(/INIT_MS (\S+) COMPILE_MS (\S+) READ_MS (\S+)/);
    if (m) times.push({ init: +m[1], compile: +m[2], read: +m[3] });
    else console.log("init-once failed:", r.stdout, r.stderr);
  }
  console.log(`\n## 1. cold init in fresh Node processes (n=${times.length})`);
  console.log(`  opencascade() full init (read file + compile + instantiate + embind setup): median ${f1(median(times.map((t) => t.init)))} ms, values ${times.map((t) => t.init.toFixed(0)).join(", ")}`);
  console.log(`  WebAssembly.compile() alone on the 23 MB module: median ${f1(median(times.map((t) => t.compile)))} ms`);
  console.log(`  fs.readFileSync of the wasm: median ${f1(median(times.map((t) => t.read)))} ms`);
}

// ---------------------------------------------------------------- init in this process
const t0 = performance.now();
const oc = await opencascade();
setOC(oc);
console.log(`\n(in-process init ${f1(performance.now() - t0)} ms, exceptionsEnabled=${oc.OCJS.exceptionsEnabled()})`);
const heapMB = () => (oc.wasmMemory.buffer.byteLength / 1048576).toFixed(1);

// ---------------------------------------------------------------- 2. regeneration timings
{
  const RUNS = quick ? 4 : 12;
  const vary = (i) => ({ height: 95 + (i % 2), diameter: 82 - (i % 3) });
  // first run ever (cold JIT inside the kernel)
  const first = runMug(vary(0));
  console.log(`\n## 2. regeneration (tolerance 0.05 mm / 0.2 rad)`);
  console.log(`  first run after init (cold code paths): total ${f1(first.timings.totalMs)} ms (ops ${f1(first.timings.buildMs)}, mesh ${f1(first.timings.meshMs)}, classify ${f1(first.timings.classifyMs)})`);
  for (let i = 0; i < 3; i++) runMug(vary(i + 1));

  const full = [];
  const perStep = {};
  for (let i = 0; i < RUNS; i++) {
    const r = runMug(vary(i));
    if (r.failed) console.log("unexpected failure", r.failed);
    full.push(r.timings);
    for (const s of r.steps) {
      (perStep[s.key] ??= { op: [], mesh: [], classify: [], tris: s.triangleCount, faces: s.faceCount }).op.push(s.opMs);
      perStep[s.key].mesh.push(s.meshMs);
      perStep[s.key].classify.push(s.classifyMs);
    }
  }
  const col = (k) => full.map((t) => t[k]);
  console.log(`  A) all 7 steps: ops + mesh every step + face classification (what the teardown page needs), n=${RUNS}:`);
  console.log(`     total median ${f1(median(col("totalMs")))} ms, p90 ${f1(pct(col("totalMs"), 90))} ms | ops ${f1(median(col("buildMs")))} | mesh ${f1(median(col("meshMs")))} | classify ${f1(median(col("classifyMs")))}`);

  // B) only the final model: ops + mesh of the last step, no classification
  const finalOnly = [];
  const opsOnly = [];
  for (let i = 0; i < RUNS; i++) {
    const a = performance.now();
    const b = buildMugSteps(vary(i));
    const ops = performance.now() - a;
    const last = b.steps[b.steps.length - 1];
    meshShape(last.shape, { tolerance: 0.05, angularTolerance: 0.2 });
    finalOnly.push(performance.now() - a);
    opsOnly.push(ops);
    disposeBuild(b);
  }
  console.log(`  B) slider drag case: ops + mesh final model only, n=${RUNS}: median ${f1(median(finalOnly))} ms, p90 ${f1(pct(finalOnly, 90))} ms (ops alone median ${f1(median(opsOnly))} ms)`);

  // C) the same 6 operations with the plain replicad API (no history bookkeeping), for comparison
  const plain = [];
  for (let i = 0; i < RUNS; i++) {
    const p = { ...DEFAULT_PARAMS, ...vary(i) };
    const { R: Rr, reach, span, hp, zc, x0, rc } = handleGeometry(p);
    const a = performance.now();
    const body0 = R.draw([0, 0]).hLine(Rr).vLine(p.height).hLine(-Rr).close().sketchOnPlane("XZ").revolve();
    const body1 = body0.fillet(p.bottomFillet, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s)));
    const body2 = body1.shell(p.wall, (f) => f.inPlane("XY", p.height));
    const handle = R.draw([x0, zc + span / 2]).hLine(Rr + reach - x0).customCorner(rc).vLine(-span).customCorner(rc).hLine(-(Rr + reach - x0)).done()
      .sketchOnPlane("XZ").sweepSketch((plane, origin) => R.sketchCircle(hp, { plane, origin }));
    const fused = body2.fuse(handle);
    const fin = fused.fillet(p.junctionFillet, junctionFinder(Rr));
    plain.push(performance.now() - a);
    [body0, body1, body2, handle, fused, fin].forEach((s) => s.delete());
  }
  console.log(`  C) same 6 operations via plain replicad API (no history tracking), n=${RUNS}: median ${f1(median(plain))} ms`);

  console.log(`  per feature (median over ${RUNS} runs):`);
  console.log(`     step            op ms   mesh ms  classify ms  faces  triangles`);
  for (const [k, v] of Object.entries(perStep)) {
    console.log(`     ${k.padEnd(15)} ${f1(median(v.op)).padStart(6)} ${f1(median(v.mesh)).padStart(9)} ${f1(median(v.classify)).padStart(12)} ${String(v.faces).padStart(6)} ${String(v.tris).padStart(10)}`);
  }
}

// ---------------------------------------------------------------- 3. triangle counts vs tolerance
{
  console.log(`\n## 3. final mug mesh vs tolerance (default params)`);
  const b = buildMugSteps({});
  const final = b.steps[b.steps.length - 1].shape;
  const settings = [
    [0.001, 0.1, "replicad default"],
    [0.01, 0.1, ""],
    [0.05, 0.2, "used in the app"],
    [0.1, 0.3, ""],
    [0.2, 0.5, "coarse"],
  ];
  for (const [tol, ang, note] of settings) {
    const times = [];
    let m;
    for (let i = 0; i < 3; i++) {
      // each mesh() call re-triangulates only if the cached triangulation is coarser; use a fresh copy
      const c = final.clone();
      const a = performance.now();
      m = meshShape(c, { tolerance: tol, angularTolerance: ang });
      times.push(performance.now() - a);
      c.delete();
    }
    const bytes = m.vertices.byteLength + m.normals.byteLength + m.triangles.byteLength;
    console.log(`  tol ${tol} mm / ${ang} rad: ${m.triangles.length / 3} triangles, ${m.vertices.length / 3} vertices, ${(bytes / 1024).toFixed(0)} KB typed arrays, mesh ${f1(median(times))} ms ${note}`);
  }
  // replicad's own mesh() (plain arrays) vs typed extraction
  const c1 = final.clone();
  let a = performance.now();
  c1.mesh({ tolerance: 0.05, angularTolerance: 0.2 });
  const tRep = performance.now() - a;
  const c2 = final.clone();
  a = performance.now();
  meshShape(c2, { tolerance: 0.05, angularTolerance: 0.2 });
  const tTyped = performance.now() - a;
  console.log(`  replicad shape.mesh() (Array.from copies) ${f1(tRep)} ms vs typed-array extraction ${f1(tTyped)} ms (same triangulation)`);
  disposeBuild(b);
}

// ---------------------------------------------------------------- 4. failure cases
{
  console.log(`\n## 4. failure cases`);
  const cases = [
    ["bottomFillet 45 > radius 41", { bottomFillet: 45 }],
    ["bottomFillet 20 (large but < radius)", { bottomFillet: 20 }],
    ["bottomFillet 3 < wall 3.5 (shell must offset a torus below zero)", { bottomFillet: 3, wall: 3.5 }],
    ["bottomFillet == wall (3.5 / 3.5)", { bottomFillet: 3.5, wall: 3.5 }],
    ["wall 30 (thicker than useful)", { wall: 30 }],
    ["wall 45 > radius", { wall: 45 }],
    ["junctionFillet 6 > handle tube radius 5", { junctionFillet: 6 }],
    ["junctionFillet 4", { junctionFillet: 4 }],
    ["handle tube (r 8) thicker than its bend radius (handleSize 0.6)", { handleThickness: 16, handleSize: 0.6 }],
    ["height 60 + handleSize 1.4 (handle above the rim)", { height: 60, handleSize: 1.4 }],
  ];
  for (const [name, params] of cases) {
    const a = performance.now();
    const r = runMug(params, { classify: false });
    const ms = performance.now() - a;
    if (r.failed) {
      console.log(`  FAIL  ${name}: at step "${r.failed.key}" -> ${r.failed.error.kind} ${r.failed.error.type}: "${r.failed.error.message}" (${f1(ms)} ms)`);
    } else {
      // "succeeded": is the result actually sane?
      const b = buildMugSteps(params);
      const last = b.steps[b.steps.length - 1].shape;
      const an = new oc.BRepCheck_Analyzer(last.wrapped, true, false);
      const valid = an.IsValid();
      an.delete();
      const vol = R.measureVolume(last);
      const solids = last.solids?.length;
      console.log(`  OK?   ${name}: built ${r.steps.length} steps, BRepCheck valid=${valid}, solids=${solids}, volume=${vol.toFixed(0)} mm3 (${f1(ms)} ms)`);
      disposeBuild(b);
    }
  }
}

// ---------------------------------------------------------------- 5. new-face detection reliability on random parameters
{
  const N = quick ? 10 : 40;
  let seed = 12345;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let builds = 0, failures = 0, faces = 0, disagreements = 0, unmatched = 0, idDisagree = 0;
  const idSamples = [];
  const failuresByStep = {};
  const disagreementSamples = [];
  for (let i = 0; i < N; i++) {
    const params = {};
    for (const [k, [lo, hi, st]] of Object.entries(PARAM_RANGES)) params[k] = Math.round((lo + rnd() * (hi - lo)) / st) * st;
    const r = runMug(params);
    builds++;
    if (r.failed) {
      failures++;
      failuresByStep[r.failed.key] = (failuresByStep[r.failed.key] ?? 0) + 1;
    }
    for (const s of r.steps) {
      unmatched += s.unmatchedGroups;
      s.faces.forEach((f, fi) => {
        faces++;
        if ((f.statusHistory === "kept") !== (f.statusFaceId === "kept")) {
          idDisagree++;
          if (idSamples.length < 5) idSamples.push(`${s.key} f${fi} ${f.type} history=${f.statusHistory} faceId=${f.statusFaceId}`);
        }
        if (f.statusHistory !== f.statusSignature) {
          disagreements++;
          if (disagreementSamples.length < 8) disagreementSamples.push(`${s.key} f${fi} ${f.type} history=${f.statusHistory} signature=${f.statusSignature} params=${JSON.stringify(params)}`);
        }
      });
    }
  }
  console.log(`\n## 5. random parameters inside the slider ranges (n=${N})`);
  console.log(`  builds that failed at some step: ${failures}/${builds} ${JSON.stringify(failuresByStep)}`);
  console.log(`  faces classified: ${faces}; history vs signature disagreements: ${disagreements}; mesh groups not mapped to a face by hashCode: ${unmatched}`);
  disagreementSamples.forEach((d) => console.log("   - " + d));
  console.log(`  replicad faceId (hashCode) "seen in previous step" vs history "kept": ${idDisagree} disagreements of ${faces}`);
  idSamples.forEach((d) => console.log("   - " + d));
}

// ---------------------------------------------------------------- 6. memory over many regenerations
{
  const N = quick ? 10 : 60;
  const before = heapMB();
  const t = performance.now();
  for (let i = 0; i < N; i++) {
    const r = runMug({ height: 90 + (i % 10), wall: 3 + (i % 3) * 0.5 });
    if (r.failed) console.log("failure during memory loop", r.failed);
  }
  const avg = (performance.now() - t) / N;
  console.log(`\n## 6. wasm heap: ${before} MB before, ${heapMB()} MB after ${N} more full regenerations (avg ${f1(avg)} ms each); Node RSS ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);
}
