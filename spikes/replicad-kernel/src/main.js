// Main thread: three.js view + sliders + feature timeline. All CAD work happens in the worker.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DEFAULT_PARAMS, PARAM_RANGES } from "./kernel/params.js";

const qs = new URLSearchParams(location.search);
const BUILD = qs.get("build") === "multi" ? "multi" : "single";
const MESH = { tolerance: Number(qs.get("tol") ?? 0.05), angularTolerance: Number(qs.get("ang") ?? 0.2) };
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ worker RPC
const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
let nextId = 0;
const pending = new Map();
worker.onmessage = (ev) => {
  const p = pending.get(ev.data.id);
  pending.delete(ev.data.id);
  if (ev.data.ok) p.resolve(ev.data);
  else p.reject(new Error(ev.data.error));
};
worker.onerror = (e) => { $("error").textContent = "worker error: " + e.message; };
const call = (type, payload) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });

// ------------------------------------------------------------------ three.js scene (Z up, like CAD)
const view = $("view");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f5f7);
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
camera.up.set(0, 0, 1);
camera.position.set(260, -300, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(10, 0, 45);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(200, -150, 300);
scene.add(sun);
const grid = new THREE.GridHelper(400, 20, 0xcccccc, 0xe3e3e3);
grid.rotation.x = Math.PI / 2;
scene.add(grid);
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

const STATUS_INDEX = { kept: 0, modified: 1, new: 2 };
const materials = [
  new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  new THREE.MeshStandardMaterial({ color: 0xf2b14a, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  new THREE.MeshStandardMaterial({ color: 0x2f7bf6, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
];
const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });

function makeObject(mesh, edges, groupStatus) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));
  if (mesh.normals.length) g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  else g.computeVertexNormals();
  g.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
  mesh.faceGroups.forEach((grp, gi) => g.addGroup(grp.start, grp.count, groupStatus ? groupStatus(gi) : 0));
  const obj = new THREE.Group();
  obj.add(new THREE.Mesh(g, materials));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(edges.lines, 3));
  obj.add(new THREE.LineSegments(lg, lineMat));
  return obj;
}
function disposeObject(obj) {
  obj?.traverse((o) => o.geometry?.dispose());
  if (obj) scene.remove(obj);
}

// ------------------------------------------------------------------ UI state
const params = { ...DEFAULT_PARAMS };
const LABELS = {
  height: "高度 height (mm)",
  diameter: "外径 diameter (mm)",
  wall: "壁厚 wall (mm)",
  bottomFillet: "底边圆角 fillet radius (mm)",
  handleSize: "把手大小 handle size (×)",
  handleThickness: "把手粗细 handle thickness (mm)",
  junctionFillet: "连接处圆角 junction fillet (mm)",
};
for (const [key, [min, max, step]] of Object.entries(PARAM_RANGES)) {
  const label = document.createElement("label");
  label.innerHTML = `<div class="row"><span>${LABELS[key]}</span><b id="v_${key}">${params[key]}</b></div>`;
  const input = Object.assign(document.createElement("input"), { type: "range", min, max, step, value: params[key], id: `s_${key}` });
  input.addEventListener("input", () => {
    params[key] = Number(input.value);
    $(`v_${key}`).textContent = input.value;
    requestBuild();
  });
  label.appendChild(input);
  $("sliders").appendChild(label);
}

let last = null; // last build result
let stepObjects = [];
let shown = null;
let initInfo = null;

function statusOf(step, gi) {
  const fi = step.faceIndexOfGroup[gi];
  const mode = $("statusMode").value;
  return STATUS_INDEX[fi >= 0 ? step.faces[fi][mode] : "kept"] ?? 0;
}

function rebuildObjects() {
  stepObjects.forEach(disposeObject);
  stepObjects = last.steps.map((s) => makeObject(s.mesh, s.edges, (gi) => statusOf(s, gi)));
  showStep();
}

function showStep() {
  if (!last) return;
  const tl = $("timeline");
  tl.max = String(last.steps.length - 1 + (last.failed ? 1 : 0));
  let i = Math.min(Number(tl.value), last.steps.length - 1 + (last.failed ? 1 : 0));
  if (shown) scene.remove(shown);
  const failedSlot = last.failed && i === last.steps.length;
  const s = last.steps[Math.min(i, last.steps.length - 1)];
  shown = stepObjects[Math.min(i, last.steps.length - 1)];
  if (shown) scene.add(shown);
  $("stepLabel").textContent = failedSlot ? `${i + 1}. ${last.failed.label} ✗ 失败` : `${i + 1}. ${s.label}`;
  $("stepMs").textContent = failedSlot ? `${last.failed.ms.toFixed(1)} ms` : `op ${s.opMs.toFixed(1)} ms · ${s.triangleCount} tris`;
  const mode = $("statusMode").value;
  $("faces").innerHTML =
    "<tr><td>#</td><td>type</td><td>area</td><td>历史</td><td>签名</td><td>from</td></tr>" +
    s.faces
      .map((f, k) => `<tr style="${f[mode] === "new" ? "color:#2f7bf6;font-weight:600" : f[mode] === "modified" ? "color:#b7791f" : ""}"><td>${k}</td><td>${f.type}</td><td>${f.area.toFixed(0)}</td><td>${f.statusHistory}</td><td>${f.statusSignature}</td><td>${f.from.join(" ")}</td></tr>`)
      .join("");
}
$("timeline").addEventListener("input", showStep);
$("statusMode").addEventListener("change", () => last && rebuildObjects());

// ------------------------------------------------------------------ builds ("latest wins" while dragging)
let building = false;
let dirty = false;
async function requestBuild() {
  if (building) { dirty = true; return; }
  building = true;
  dirty = false;
  const t0 = performance.now();
  try {
    const { result } = await call("build", { params: { ...params }, mesh: MESH });
    const tMsg = performance.now();
    last = result;
    rebuildObjects();
    const tRender = performance.now();
    const t = result.timings;
    const roundTrip = tMsg - t0;
    $("error").textContent = result.failed
      ? `第 ${result.steps.length + 1} 步「${result.failed.label}」失败：${result.failed.error.type}: ${result.failed.error.message}`
      : "";
    $("stats").textContent =
      `内核(${initInfo?.build}) 冷启动 ${initInfo?.totalMs.toFixed(0)} ms (下载 ${initInfo?.fetchMs.toFixed(0)} / 编译 ${initInfo?.compileMs.toFixed(0)} / 实例化 ${initInfo?.instantiateMs.toFixed(0)})\n` +
      `再生成(worker) ${t.workerMs.toFixed(0)} ms = 建模 ${t.buildMs.toFixed(0)} + 网格 ${t.meshMs.toFixed(0)} + 判新面 ${t.classifyMs.toFixed(0)}\n` +
      `往返(含传输) ${roundTrip.toFixed(0)} ms, three.js 建对象 ${(tRender - tMsg).toFixed(0)} ms\n` +
      `wasm 内存 ${result.heapMB.toFixed(0)} MB, 最终三角形 ${result.steps.at(-1).triangleCount}`;
    console.log("[kernel] build", JSON.stringify({ params: result.params, failed: result.failed, timings: t, roundTripMs: roundTrip, threeMs: tRender - tMsg, heapMB: result.heapMB, triangles: result.steps.map((s) => s.triangleCount), opMs: Object.fromEntries(result.steps.map((s) => [s.key, +s.opMs.toFixed(2)])) }));
  } catch (err) {
    $("error").textContent = String(err);
    console.error("[kernel] build failed", err);
  } finally {
    building = false;
    if (dirty) requestBuild();
  }
}

$("benchBtn").addEventListener("click", async () => {
  $("benchOut").textContent = "running…";
  const { result } = await call("bench", { runs: 10, ...MESH });
  $("benchOut").textContent = JSON.stringify(result, (k, v) => (typeof v === "number" ? +v.toFixed(1) : v), 1);
  console.log("[kernel] bench", JSON.stringify(result));
});

let extrasGroup = null;
$("extrasBtn").addEventListener("click", async () => {
  const { results } = await call("extras");
  if (shown) scene.remove(shown);
  disposeObject(extrasGroup);
  extrasGroup = new THREE.Group();
  results.forEach((r, i) => {
    if (!r.mesh) return;
    const o = makeObject(r.mesh, r.edges, () => 2);
    o.position.x = (i - 1.5) * 110;
    extrasGroup.add(o);
  });
  scene.add(extrasGroup);
  $("benchOut").textContent = results.map((r) => `${r.info.ok ? "OK " : "ERR"} ${r.info.name} ${r.info.ok ? `faces=${r.info.faces} valid=${r.info.valid}` : JSON.stringify(r.info.error)}`).join("\n");
  console.log("[kernel] extras", JSON.stringify(results.map((r) => r.info)));
});
$("mugBtn").addEventListener("click", () => {
  disposeObject(extrasGroup);
  extrasGroup = null;
  showStep();
});

// ------------------------------------------------------------------ boot
(async () => {
  const t0 = performance.now();
  const { info } = await call("init", { build: BUILD });
  initInfo = info;
  info.mainThreadWaitMs = performance.now() - t0;
  $("initInfo").textContent = `OCCT ${info.build} build: ${(info.wasmBytes / 1048576).toFixed(1)} MB wasm, 冷启动 ${info.totalMs.toFixed(0)} ms, crossOriginIsolated=${info.crossOriginIsolated}, threads=${info.threads}`;
  console.log("[kernel] init", JSON.stringify(info));
  await requestBuild();
  if (qs.has("autobench")) $("benchBtn").click();
})();

window.__spike = { call, params, get last() { return last; }, get initInfo() { return initInfo; }, requestBuild };
