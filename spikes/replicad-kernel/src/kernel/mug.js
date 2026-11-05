// Parametric coffee mug, rebuilt feature by feature:
// sketch -> revolve -> fillet(bottom) -> shell(top open) -> sweep(handle) -> fuse -> fillet(junction)
import { draw, sketchCircle, bottomMost, makeCompound, makeFace } from "replicad";
import { trackedRevolve, trackedFillet, trackedShell, trackedFuse } from "./ops.js";
import { describeError } from "./errors.js";
import { DEFAULT_PARAMS, STEP_LABELS } from "./params.js";

export { DEFAULT_PARAMS, PARAM_RANGES, STEP_LABELS } from "./params.js";

const now = () => performance.now();

export function handleGeometry(p) {
  const R = p.diameter / 2;
  const s = p.handleSize;
  const reach = 26 * s; // outermost centreline distance from the body surface
  const span = 48 * s; // vertical distance between the two attachment centrelines
  const hp = p.handleThickness / 2;
  const zc = p.height * 0.52;
  const x0 = R - p.wall / 2; // start/end inside the wall so the tube end caps are swallowed by the fuse
  const rc = Math.min(12 * s, span / 2 - 0.5, reach + R - x0 - 0.5);
  return { R, reach, span, hp, zc, x0, rc };
}

/** Edges where the handle tube meets the body's outer cylinder (pure replicad EdgeFinder). */
export const junctionFinder = (R) => (e) =>
  e.when(({ element }) => {
    const g = element.geomType;
    if (g === "CIRCLE" || g === "LINE") return false;
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const pt = element.pointAt(u);
      const r = Math.hypot(pt.x, pt.y);
      pt.delete();
      if (Math.abs(r - R) > 1e-3) return false;
    }
    return true;
  });

/**
 * Build all steps. Each step: { key, label, shape (what to display), history?, ms, error? }
 * Stops at the first failing step (later steps cannot exist), like a CAD feature tree.
 */
export function buildMugSteps(params = {}, { seamAtBack = true } = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const { R, reach, span, hp, zc, x0, rc } = handleGeometry(p);
  const H = p.height;
  const steps = [];
  let failed = null;

  const step = (key, fn) => {
    if (failed) return null;
    const t0 = now();
    try {
      const out = fn();
      steps.push({ key, label: STEP_LABELS[key], ms: now() - t0, ...out });
      return out;
    } catch (err) {
      failed = { key, label: STEP_LABELS[key], ms: now() - t0, error: describeError(err) };
      return null;
    }
  };

  // The revolve seam lies where the profile is drawn. Drawing it on -X puts the seam
  // at the back of the mug, away from the handle (+X); see the report for why it matters.
  const sx = seamAtBack ? -1 : 1;
  const profile = () => draw([0, 0]).hLine(sx * R).vLine(H).hLine(-sx * R).close();

  step("sketch", () => {
    const sk = profile().sketchOnPlane("XZ");
    const face = makeFace(sk.wire);
    sk.delete();
    return { shape: face };
  });

  const revolved = step("revolve", () => trackedRevolve(profile()));

  const fillet1 = step("filletBottom", () =>
    trackedFillet(revolved.shape, p.bottomFillet, (e, s) => e.ofCurveType("CIRCLE").when(bottomMost(s))),
  );

  const shelled = step("shell", () => {
    const out = trackedShell(fillet1.shape, p.wall, (f) => f.inPlane("XY", H));
    return out;
  });

  const swept = step("sweep", () => {
    const path = draw([x0, zc + span / 2])
      .hLine(R + reach - x0)
      .customCorner(rc)
      .vLine(-span)
      .customCorner(rc)
      .hLine(-(R + reach - x0))
      .done();
    const handle = path.sketchOnPlane("XZ").sweepSketch((plane, origin) => sketchCircle(hp, { plane, origin }));
    // Display body + loose handle together; body faces are untouched by this step.
    const shape = makeCompound([shelled.shape.clone(), handle.clone()]);
    const nBody = shelled.shape.faces.length;
    const nHandle = handle.faces.length;
    const history = {
      status: [...Array(nBody).fill("kept"), ...Array(nHandle).fill("new")],
      from: [...Array(nBody).fill(["body"]), ...Array(nHandle).fill(["gen<-profile circle"])],
      deleted: [],
    };
    return { shape, handle, history };
  });

  const fused = step("fuse", () => trackedFuse(shelled.shape, swept.handle));

  if (p.junctionFillet > 0) {
    step("filletJunction", () => {
      const out = trackedFillet(fused.shape, p.junctionFillet, junctionFinder(R));
      return out;
    });
  }

  return { params: p, steps, failed };
}

/** Free the wasm memory held by a build result. */
export function disposeBuild(build) {
  for (const s of build.steps) {
    s.shape?.delete?.();
    s.handle?.delete?.();
    s.sectionEdges?.forEach((e) => e.delete?.());
  }
}
