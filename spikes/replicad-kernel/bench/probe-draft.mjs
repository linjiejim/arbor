import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
import { describeError } from "../src/kernel/errors.js";
const oc = await opencascade();
R.setOC(oc);
const tryDraft = (name, shape, finder, angle = 3, plane = "XY") => {
  try {
    const out = shape.draft(angle, finder, plane);
    console.log("OK ", name, out.faces.map((f) => f.geomType).join(","), "vol", R.measureVolume(out).toFixed(0));
  } catch (e) { console.log("ERR", name, JSON.stringify(describeError(e))); }
};
const revolved = () => R.draw([0, 0]).hLine(41).vLine(95).hLine(-41).close().sketchOnPlane("XZ").revolve();
tryDraft("revolved body, cylinder face", revolved(), (f) => f.ofSurfaceType("CYLINDRE"));
tryDraft("makeCylinder, cylinder face", R.makeCylinder(41, 95), (f) => f.ofSurfaceType("CYLINDRE"));
tryDraft("extruded circle, cylinder face", R.sketchCircle(41).extrude(95), (f) => f.ofSurfaceType("CYLINDRE"));
tryDraft("extruded circle, negative angle", R.sketchCircle(41).extrude(95), (f) => f.ofSurfaceType("CYLINDRE"), -3);
// direct OCCT call to see IsDone / problematic shape
const shape = revolved();
const face = shape.faces.find((f) => f.geomType === "CYLINDRE");
const b = new oc.BRepOffsetAPI_DraftAngle(shape.wrapped);
const pln = new oc.gp_Pln(new oc.gp_Pnt(0, 0, 0), new oc.gp_Dir(0, 0, 1));
b.Add(face.wrapped, new oc.gp_Dir(0, 0, 1), 3 * Math.PI / 180, pln, false);
console.log("AddDone", b.AddDone?.());
b.Build();
console.log("IsDone", b.IsDone());
try { console.log("Status", b.Status?.()); } catch (e) { console.log("Status err", String(e)); }
// Try with Flag=true (Neutral plane inside the face)
const b2 = new oc.BRepOffsetAPI_DraftAngle(shape.wrapped);
b2.Add(face.wrapped, new oc.gp_Dir(0, 0, 1), 3 * Math.PI / 180, pln, true);
b2.Build();
console.log("Flag=true IsDone", b2.IsDone());
// neutral plane in the middle of the face
const pln2 = new oc.gp_Pln(new oc.gp_Pnt(0, 0, 40), new oc.gp_Dir(0, 0, 1));
const b3 = new oc.BRepOffsetAPI_DraftAngle(shape.wrapped);
b3.Add(face.wrapped, new oc.gp_Dir(0, 0, 1), 3 * Math.PI / 180, pln2, true);
b3.Build();
console.log("plane z=40 IsDone", b3.IsDone());
if (b3.IsDone()) { const s = R.cast(b3.ModifiedShape(shape.wrapped)); console.log(s.faces.map((f) => f.geomType).join(","), R.measureVolume(s)); }
