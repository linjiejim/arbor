// How do OCCT failures surface in JS? node bench/probe-errors.mjs
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
const oc = await opencascade();
R.setOC(oc);

const describe = (err) => {
  const out = { jsType: typeof err, ctor: err?.constructor?.name, isWasmException: err instanceof WebAssembly.Exception, message: String(err?.message ?? err).slice(0, 200) };
  if (typeof err === "number") {
    try { const f = oc.OCJS.getStandard_FailureData(err); out.occt = { type: f.DynamicType?.()?.Name?.() ?? f.ExceptionType?.() , msg: f.GetMessageString?.() }; } catch (e) { out.decodeErr = String(e); }
  }
  if (err instanceof WebAssembly.Exception) {
    try {
      const tag = oc.getCppExceptionTag?.() ?? oc.wasmExports?.__cpp_exception;
      out.hasTag = !!tag;
      const ptr = err.getArg(tag, 0);
      out.ptr = ptr;
      const f = oc.OCJS.getStandard_FailureData(ptr);
      out.occt = { msg: f.GetMessageString?.(), type: f.ExceptionType?.() };
    } catch (e) { out.decodeErr = String(e).slice(0, 200); }
    try { out.getExceptionMessage = oc.getExceptionMessage?.(err); } catch (e) { out.gemErr = String(e).slice(0, 200); }
  }
  return out;
};
const H = 95, Rr = 41;
const body = () => R.draw([0, 0]).hLine(Rr).vLine(H).hLine(-Rr).close().sketchOnPlane("XZ").revolve();
const cases = {
  "fillet radius 50 on R=41 bottom edge": () => body().fillet(50, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s))),
  "fillet radius 41 (== R)": () => body().fillet(41, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s))),
  "fillet with no edge selected": () => body().fillet(5, (e) => e.ofCurveType("ELLIPSE")),
  "shell thickness 3.5 with fillet 3 (inner fillet radius < 0)": () => body().fillet(3, (e, s) => e.ofCurveType("CIRCLE").when(R.bottomMost(s))).shell(3.5, (f) => f.inPlane("XY", H)),
  "shell thickness 45 > radius": () => body().shell(45, (f) => f.inPlane("XY", H)),
  "shell no face selected (closed hollow)": () => body().shell(3, (f) => f.inPlane("XY", 999)),
};
console.log("exceptionsEnabled", oc.OCJS.exceptionsEnabled(), "keys with Exception:", Object.keys(oc).filter((k) => /xcept/i.test(k)));
for (const [name, fn] of Object.entries(cases)) {
  const t0 = performance.now();
  try {
    const s = fn();
    let valid = null;
    try { const a = new oc.BRepCheck_Analyzer(s.wrapped, true, false); valid = a.IsValid(); a.delete(); } catch (e) { valid = "n/a: " + String(e).slice(0, 80); }
    console.log("OK?", name, "| faces", s.faces.length, "| volume", R.measureVolume(s).toFixed(1), "| BRepCheck valid:", valid, "|", (performance.now() - t0).toFixed(1), "ms");
  } catch (err) {
    console.log("ERR", name, "|", (performance.now() - t0).toFixed(1), "ms |", JSON.stringify(describe(err)));
  }
}
