// Web Worker that owns the OpenCascade (wasm) kernel.
import singleWasmUrl from "replicad-opencascadejs/wasm?url";
import multiWasmUrl from "replicad-opencascadejs/multi/wasm?url";
import { setOC } from "replicad";
import { runMug, transferablesOf } from "./kernel/index.js";
import { runExtras } from "./kernel/extras.js";
import { meshShape, meshEdgesOf } from "./kernel/mesh.js";
import { buildMugSteps, disposeBuild } from "./kernel/mug.js";

let oc = null;
const now = () => performance.now();
const heapMB = () => (oc ? oc.wasmMemory.buffer.byteLength / 1048576 : 0);

async function init({ build = "single" }) {
  const t0 = now();
  const glue = build === "multi" ? await import("replicad-opencascadejs/multi") : await import("replicad-opencascadejs");
  const wasmUrl = build === "multi" ? multiWasmUrl : singleWasmUrl;
  const tGlue = now();
  // Split the cold start into download / compile / instantiate+runtime-init.
  // cache: "no-store" forces a real download of the 23 MB file every time.
  const resp = await fetch(wasmUrl, { cache: "no-store" });
  const buf = await resp.arrayBuffer();
  const tFetch = now();
  const module = await WebAssembly.compile(buf);
  const tCompile = now();
  oc = await glue.default({
    locateFile: (p, prefix) => (p.endsWith(".wasm") ? wasmUrl : prefix + p),
    instantiateWasm(imports, receive) {
      WebAssembly.instantiate(module, imports).then((instance) => receive(instance, module));
      return {};
    },
  });
  setOC(oc);
  const tReady = now();
  return {
    build,
    wasmBytes: buf.byteLength,
    contentEncoding: resp.headers.get("content-encoding"),
    glueMs: tGlue - t0,
    fetchMs: tFetch - tGlue,
    compileMs: tCompile - tFetch,
    instantiateMs: tReady - tCompile,
    totalMs: tReady - t0,
    crossOriginIsolated: self.crossOriginIsolated,
    threads: typeof SharedArrayBuffer !== "undefined" && oc.wasmMemory.buffer instanceof SharedArrayBuffer,
    heapMB: heapMB(),
    hardwareConcurrency: self.navigator?.hardwareConcurrency,
  };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function bench({ runs = 10, tolerance = 0.05, angularTolerance = 0.2 }) {
  const first = runMug({ height: 94 }, { tolerance, angularTolerance }).timings;
  const totals = [], ops = [], mesh = [], classify = [];
  const perStep = {};
  for (let i = 0; i < runs; i++) {
    const r = runMug({ height: 95 + (i % 2), diameter: 82 - (i % 3) }, { tolerance, angularTolerance });
    totals.push(r.timings.totalMs);
    ops.push(r.timings.buildMs);
    mesh.push(r.timings.meshMs);
    classify.push(r.timings.classifyMs);
    for (const s of r.steps) (perStep[s.key] ??= []).push(s.opMs);
  }
  // Slider-drag case: rebuild all features but mesh only the final model, no face classification.
  const finalOnly = [];
  for (let i = 0; i < runs; i++) {
    const t0 = now();
    const b = buildMugSteps({ height: 95 + (i % 2), diameter: 82 - (i % 3) });
    meshShape(b.steps[b.steps.length - 1].shape, { tolerance, angularTolerance });
    finalOnly.push(now() - t0);
    disposeBuild(b);
  }
  return {
    runs,
    firstRunMs: first.totalMs,
    medianTotalMs: median(totals),
    medianOpsMs: median(ops),
    medianMeshMs: median(mesh),
    medianClassifyMs: median(classify),
    medianFinalOnlyMs: median(finalOnly),
    perStepOpMs: Object.fromEntries(Object.entries(perStep).map(([k, v]) => [k, median(v)])),
    heapMB: heapMB(),
  };
}

self.onmessage = async (ev) => {
  const { id, type, payload = {} } = ev.data;
  try {
    if (type === "init") {
      const info = await init(payload);
      self.postMessage({ id, type, ok: true, info });
    } else if (type === "build") {
      const t0 = now();
      const result = runMug(payload.params, payload.mesh);
      result.timings.workerMs = now() - t0;
      result.heapMB = heapMB();
      self.postMessage({ id, type, ok: true, result }, transferablesOf(result));
    } else if (type === "bench") {
      self.postMessage({ id, type, ok: true, result: bench(payload) });
    } else if (type === "extras") {
      const results = runExtras().map(({ info, shape }) => {
        if (!shape) return { info };
        const mesh = meshShape(shape, { tolerance: 0.05, angularTolerance: 0.2 });
        const edges = meshEdgesOf(shape, { tolerance: 0.05, angularTolerance: 0.2 });
        shape.delete();
        return { info, mesh, edges };
      });
      self.postMessage({ id, type, ok: true, results });
    }
  } catch (err) {
    self.postMessage({ id, type, ok: false, error: String(err?.stack ?? err) });
  }
};
