// API-coverage checks beyond the mug: loft (square -> circle) and draft angle.
import { sketchRectangle, sketchCircle, draw, makeBox, measureVolume, measureArea, getOC, cast } from "replicad";
import { describeError } from "./errors.js";

const now = () => performance.now();

function isValid(shape) {
  const oc = getOC();
  const a = new oc.BRepCheck_Analyzer(shape.wrapped, true, false);
  const ok = a.IsValid();
  a.delete();
  return ok;
}

function attempt(name, fn) {
  const t0 = now();
  try {
    const shape = fn();
    const info = {
      name,
      ok: true,
      ms: now() - t0,
      faces: shape.faces.length,
      faceTypes: shape.faces.map((f) => f.geomType),
      volume: measureVolume(shape),
      valid: isValid(shape),
    };
    return { info, shape };
  } catch (err) {
    return { info: { name, ok: false, ms: now() - t0, error: describeError(err) }, shape: null };
  }
}

export function runExtras() {
  const results = [];

  // 1) Loft: 40x40 square at z=0 -> circle r=20 at z=50 (replicad default: ruled = true)
  results.push(
    attempt("loft square->circle (ruled, replicad default)", () =>
      sketchRectangle(40, 40).loftWith(sketchCircle(20, { plane: "XY", origin: [0, 0, 50] })),
    ),
  );
  results.push(
    attempt("loft square->circle (smooth, ruled:false)", () =>
      sketchRectangle(40, 40).loftWith(sketchCircle(20, { plane: "XY", origin: [0, 0, 50] }), { ruled: false }),
    ),
  );

  // 2) Draft: 40x40x30 box, the 4 vertical faces get a 5 deg draft, neutral plane XY (z=0)
  results.push(
    attempt("draft 5deg on 4 side faces of a box", () =>
      makeBox([-20, -20, 0], [20, 20, 30]).draft(5, (f) => f.ofSurfaceType("PLANE").atAngleWith("Z", 90)),
    ),
  );
  // 3) Draft on a cylindrical face (turns a cylinder into a cone): the mug body without the handle
  results.push(
    attempt("draft 3deg on the cylindrical side of a revolved body", () =>
      draw([0, 0]).hLine(41).vLine(95).hLine(-41).close().sketchOnPlane("XZ").revolve()
        .draft(3, (f) => f.ofSurfaceType("CYLINDRE")),
    ),
  );

  // 4) Same cylinder draft through OCCT directly with Flag = true (OCCT's default).
  //    replicad 1.2.0's draft() hard-codes Flag = false and never checks IsDone(), so on a
  //    cylindrical face it surfaces as an empty "Standard_NoSuchObject" from ModifiedShape().
  results.push(
    attempt("draft 3deg on the cylindrical side via OCCT (Flag=true)", () => {
      const oc = getOC();
      const body = draw([0, 0]).hLine(41).vLine(95).hLine(-41).close().sketchOnPlane("XZ").revolve();
      const side = body.findFace((f) => f.ofSurfaceType("CYLINDRE"));
      const builder = new oc.BRepOffsetAPI_DraftAngle(body.wrapped);
      const origin = new oc.gp_Pnt(0, 0, 0);
      const dir = new oc.gp_Dir(0, 0, 1);
      const plane = new oc.gp_Pln(origin, dir);
      try {
        builder.Add(side.wrapped, dir, (3 * Math.PI) / 180, plane, true);
        builder.Build();
        if (!builder.IsDone()) throw new Error("BRepOffsetAPI_DraftAngle not done");
        return cast(builder.ModifiedShape(body.wrapped));
      } finally {
        builder.delete();
        plane.delete();
        dir.delete();
        origin.delete();
      }
    }),
  );

  // Extra facts for the report: top vs bottom face areas of the drafted box
  const box = results[2].shape;
  if (box) {
    const planes = box.faces.filter((f) => f.geomType === "PLANE");
    const horizontal = planes
      .map((f) => ({ f, n: f.normalAt() }))
      .filter(({ n }) => Math.abs(Math.abs(n.z) - 1) < 1e-6)
      .map(({ f, n }) => ({ z: f.center.z, area: measureArea(f), nz: n.z }));
    results[2].info.horizontalFaces = horizontal;
  }
  return results;
}
