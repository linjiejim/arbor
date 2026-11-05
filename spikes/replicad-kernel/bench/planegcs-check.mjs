// Does @salusoft89/planegcs (FreeCAD's 2D constraint solver, wasm) solve a dimensioned
// rectangle and report degrees of freedom / fully-defined / redundant / conflicting?
// Usage: node bench/planegcs-check.mjs
import { make_gcs_wrapper, SolveStatus, DebugMode } from "@salusoft89/planegcs";

const statusName = Object.fromEntries(Object.entries(SolveStatus).map(([k, v]) => [v, k]));
const t0 = performance.now();
const gcs = await make_gcs_wrapper();
const initMs = performance.now() - t0;
gcs.debug_mode = DebugMode.NoDebug; // default is Minimal, which prints solver chatter to stdout

// A rough, hand-drawn quadrilateral (what a learner would sketch), ids must reference lower ids.
const geometry = [
  { id: "1", type: "point", x: 1, y: -2, fixed: false },
  { id: "2", type: "point", x: 57, y: 3, fixed: false },
  { id: "3", type: "point", x: 63, y: 44, fixed: false },
  { id: "4", type: "point", x: -3, y: 37, fixed: false },
  { id: "5", type: "line", p1_id: "1", p2_id: "2" },
  { id: "6", type: "line", p1_id: "2", p2_id: "3" },
  { id: "7", type: "line", p1_id: "3", p2_id: "4" },
  { id: "8", type: "line", p1_id: "4", p2_id: "1" },
];
const stages = [
  ["no constraints", []],
  ["+ horizontal/vertical (4 constraints)", [
    { id: "10", type: "horizontal_l", l_id: "5" },
    { id: "11", type: "vertical_l", l_id: "6" },
    { id: "12", type: "horizontal_l", l_id: "7" },
    { id: "13", type: "vertical_l", l_id: "8" },
  ]],
  ["+ width 60 / height 40 dimensions", [
    { id: "14", type: "p2p_distance", p1_id: "1", p2_id: "2", distance: 60 },
    { id: "15", type: "p2p_distance", p1_id: "2", p2_id: "3", distance: 40 },
  ]],
  ["+ anchor corner at origin (coordinate_x / coordinate_y)", [
    { id: "16", type: "coordinate_x", p_id: "1", x: 0 },
    { id: "17", type: "coordinate_y", p_id: "1", y: 0 },
  ]],
  ["+ redundant top width 60 (same value)", [
    { id: "18", type: "p2p_distance", p1_id: "3", p2_id: "4", distance: 60 },
  ]],
];

let accumulated = [...geometry];
for (const [label, cons] of stages) {
  accumulated = [...accumulated, ...cons];
  gcs.clear_data();
  gcs.push_primitives_and_params(accumulated);
  const s0 = performance.now();
  const status = gcs.solve();
  const solveMs = performance.now() - s0;
  gcs.apply_solution();
  const dof = gcs.gcs.dof();
  const pts = gcs.sketch_index.get_primitives().filter((p) => p.type === "point").map((p) => `(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(" ");
  console.log(
    `${label.padEnd(58)} status=${statusName[status]} dof=${dof} fullyDefined=${dof === 0 && !gcs.has_gcs_conflicting_constraints() && !gcs.has_gcs_redundant_constraints()}` +
      ` redundant=[${gcs.get_gcs_redundant_constraints()}] conflicting=[${gcs.get_gcs_conflicting_constraints()}] solve ${solveMs.toFixed(2)} ms\n    points: ${pts}`,
  );
}

// Conflicting: replace the redundant width by a different value
accumulated = accumulated.filter((p) => p.id !== "18");
accumulated.push({ id: "19", type: "p2p_distance", p1_id: "3", p2_id: "4", distance: 70 });
gcs.clear_data();
gcs.push_primitives_and_params(accumulated);
const st = gcs.solve();
console.log(`${"conflicting top width 70 vs bottom 60".padEnd(58)} status=${statusName[st]} dof=${gcs.gcs.dof()} redundant=[${gcs.get_gcs_redundant_constraints()}] conflicting=[${gcs.get_gcs_conflicting_constraints()}]`);

// Changing a dimension = what a slider would do: re-solve with width 80
const w = accumulated.find((p) => p.id === "14");
w.distance = 80;
accumulated = accumulated.filter((p) => p.id !== "19");
gcs.clear_data();
gcs.push_primitives_and_params(accumulated);
const r0 = performance.now();
gcs.solve();
const resolveMs = performance.now() - r0;
gcs.apply_solution();
console.log(`width -> 80 re-solve ${resolveMs.toFixed(2)} ms, points: ${gcs.sketch_index.get_primitives().filter((p) => p.type === "point").map((p) => `(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(" ")}`);
console.log(`init (load + instantiate wasm) ${initMs.toFixed(1)} ms`);
gcs.destroy_gcs_module();
