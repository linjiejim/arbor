// Quick probe: plain replicad API, no history. node bench/probe.mjs
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";

const t0 = performance.now();
const oc = await opencascade();
R.setOC(oc);
console.log("init ms", (performance.now() - t0).toFixed(0), "exceptionsEnabled:", oc.OCJS?.exceptionsEnabled?.());

const H = 95, Rr = 41, t = 3.5, rb = 6, hp = 5;
const faceInfo = (s) => s.faces.map((f) => `${f.geomType}:${R.measureArea(f).toFixed(1)}`).join(", ");
const tm = (label, fn) => { const a = performance.now(); const r = fn(); console.log(label, (performance.now() - a).toFixed(1), "ms"); return r; };

const prof = R.draw([0, 0]).hLine(Rr).vLine(H).hLine(-Rr).close();
const body0 = tm("revolve", () => prof.sketchOnPlane("XZ").revolve());
console.log("revolve faces", body0.faces.length, faceInfo(body0));
const body1 = tm("fillet", () => body0.fillet(rb, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s))));
console.log("fillet faces", body1.faces.length, faceInfo(body1));
const body2 = tm("shell", () => body1.shell(t, (f) => f.inPlane("XY", H)));
console.log("shell faces", body2.faces.length, faceInfo(body2), "vol", R.measureVolume(body2).toFixed(0));

const x0 = Rr - t / 2, reach = 28, hh = 50, zc = H * 0.52, rc = 12;
const path = R.draw([x0, zc + hh / 2]).hLine(Rr + reach - x0).customCorner(rc).vLine(-hh).customCorner(rc).hLine(-(Rr + reach - x0)).done();
const handle = tm("sweep", () => path.sketchOnPlane("XZ").sweepSketch((plane, origin) => R.sketchCircle(hp, { plane, origin })));
console.log("handle faces", handle.faces.length, faceInfo(handle), "vol", R.measureVolume(handle).toFixed(0));
const fused = tm("fuse", () => body2.fuse(handle));
console.log("fused faces", fused.faces.length, faceInfo(fused));
const junction = (e) => e.when(({ element }) => {
  const g = element.geomType;
  if (g === "CIRCLE" || g === "LINE") return false;
  for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    const p = element.pointAt(u);
    const r = Math.hypot(p.x, p.y);
    p.delete();
    if (Math.abs(r - Rr) > 1e-3) return false;
  }
  return true;
});
const jEdges = fused.findEdges(junction);
console.log("junction edges", jEdges.length, jEdges.map((e) => e.geomType));
const final = tm("junction fillet", () => fused.fillet(2, junction));
console.log("final faces", final.faces.length, faceInfo(final), "vol", R.measureVolume(final).toFixed(0));
const m = tm("mesh 0.05/0.2", () => final.mesh({ tolerance: 0.05, angularTolerance: 0.2 }));
console.log("tris", m.triangles.length / 3, "verts", m.vertices.length / 3, "groups", m.faceGroups.length, m.faceGroups.slice(0, 5));
