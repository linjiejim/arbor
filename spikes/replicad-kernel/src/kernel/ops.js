// History-aware versions of the replicad operations used by the mug.
//
// replicad's own fillet/shell/fuse build an OCCT builder, call .Shape() and
// throw the builder away, so the OCCT history (Modified / Generated /
// IsDeleted) is lost. These wrappers make the same OCCT calls as replicad
// 1.2.0 (see node_modules/replicad/dist/casting-*.js) but keep the builder long
// enough to ask it which result faces came from which input faces/edges.
import { getOC, cast, EdgeFinder, FaceFinder, makeAx1, makeFace } from "replicad";

const DEG2RAD = Math.PI / 180;

function listToArray(list) {
  const oc = getOC();
  const copy = new oc.NCollection_List_TopoDS_Shape(list);
  const out = [];
  while (!copy.IsEmpty()) {
    out.push(copy.First());
    copy.RemoveFirst();
  }
  copy.delete();
  return out;
}

/**
 * Classify the faces of `result` using an OCCT builder's history.
 * inputs: [{ shape (replicad), tag }]; extraSources: [{ shapes: TopoDS_Shape[], tag }] whose
 * Generated() images should be attributed (e.g. filleted edges, profile edges).
 * Returns per-result-face status: "kept" | "modified" | "new", plus provenance strings.
 */
export function historyOf(builder, inputs, result, extraSources = []) {
  const resFaces = result.faces;
  const status = resFaces.map(() => "new");
  const from = resFaces.map(() => []);
  const deleted = [];
  const indexOf = (shape) => resFaces.findIndex((rf) => rf.wrapped.IsSame(shape));

  for (const { shape, tag } of inputs) {
    shape.faces.forEach((f, i) => {
      const keptIdx = indexOf(f.wrapped);
      if (keptIdx >= 0) {
        status[keptIdx] = "kept";
        from[keptIdx].push(`${tag}.f${i}`);
      }
      for (const m of listToArray(builder.Modified(f.wrapped))) {
        const j = indexOf(m);
        if (j >= 0 && status[j] !== "kept") {
          status[j] = "modified";
          from[j].push(`${tag}.f${i}`);
        }
        m.delete();
      }
      for (const g of listToArray(builder.Generated(f.wrapped))) {
        const j = indexOf(g);
        if (j >= 0) from[j].push(`gen<-${tag}.f${i}`);
        g.delete();
      }
      if (builder.IsDeleted(f.wrapped)) deleted.push(`${tag}.f${i}`);
      f.delete();
    });
  }
  for (const { shapes, tag } of extraSources) {
    shapes.forEach((s, i) => {
      for (const g of listToArray(builder.Generated(s))) {
        const j = indexOf(g);
        if (j >= 0) from[j].push(`gen<-${tag}${i}`);
        g.delete();
      }
    });
  }
  resFaces.forEach((f) => f.delete());
  return { status, from, deleted };
}

/** Revolve a closed drawing on the XZ plane around Z (same as Sketch.revolve()). */
export function trackedRevolve(drawing, angle = 360) {
  const oc = getOC();
  const sketch = drawing.sketchOnPlane("XZ");
  const face = makeFace(sketch.wire);
  const profileEdges = face.edges;
  const ax = makeAx1([0, 0, 0], [0, 0, 1]);
  const builder = new oc.BRepPrimAPI_MakeRevol(face.wrapped, ax, angle * DEG2RAD, false);
  try {
    const shape = cast(builder.Shape());
    const history = historyOf(builder, [], shape, [{ shapes: profileEdges.map((e) => e.wrapped), tag: "profile.e" }]);
    return { shape, history };
  } finally {
    builder.delete();
    ax.delete();
    profileEdges.forEach((e) => e.delete());
    face.delete();
    sketch.delete();
  }
}

/** Fillet edges chosen by a replicad EdgeFinder function. */
export function trackedFillet(shape, radius, finderFn, tag = "in") {
  const oc = getOC();
  const finder = finderFn(new EdgeFinder(), shape);
  const edges = finder.find(shape);
  finder.delete();
  if (!edges.length) throw new Error("Could not fillet, no edge was selected");
  const builder = new oc.BRepFilletAPI_MakeFillet(shape.wrapped, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  try {
    for (const e of edges) builder.Add(radius, e.wrapped);
    const result = cast(builder.Shape()); // throws StdFail_NotDone on failure
    const history = historyOf(builder, [{ shape, tag }], result, [{ shapes: edges.map((e) => e.wrapped), tag: "edge" }]);
    return { shape: result, history, selectedEdges: edges.length };
  } finally {
    builder.delete();
    edges.forEach((e) => e.delete());
  }
}

/** Shell (hollow) a solid, removing the faces chosen by a FaceFinder function. */
export function trackedShell(shape, thickness, finderFn, tolerance = 1e-3, tag = "in") {
  const oc = getOC();
  const finder = finderFn(new FaceFinder(), shape);
  const faces = finder.find(shape);
  finder.delete();
  if (!faces.length) throw new Error("Could not shell, no face to remove was selected");
  const toRemove = new oc.NCollection_List_TopoDS_Shape();
  faces.forEach((f) => toRemove.Append(f.wrapped));
  const builder = new oc.BRepOffsetAPI_MakeThickSolid();
  try {
    builder.MakeThickSolidByJoin(
      shape.wrapped, toRemove, -thickness, tolerance,
      oc.BRepOffset_Mode.BRepOffset_Skin, false, false, oc.GeomAbs_JoinType.GeomAbs_Arc, false,
    );
    const result = cast(builder.Shape());
    const history = historyOf(builder, [{ shape, tag }], result);
    return { shape: result, history };
  } finally {
    builder.delete();
    toRemove.delete();
    faces.forEach((f) => f.delete());
  }
}

/** Boolean union with replicad's default topology cleanup (SimplifyResult). */
export function trackedFuse(a, b, { simplify = true } = {}) {
  const oc = getOC();
  const builder = new oc.BRepAlgoAPI_Fuse(a.wrapped, b.wrapped);
  try {
    builder.Build();
    if (builder.HasErrors()) throw new Error("Boolean fuse reported errors (BRepAlgoAPI_Fuse.HasErrors)");
    if (simplify) builder.SimplifyResult(true, true, 1e-3);
    const result = cast(builder.Shape());
    const history = historyOf(builder, [{ shape: a, tag: "body" }, { shape: b, tag: "handle" }], result);
    const sectionEdges = listToArray(builder.SectionEdges());
    return { shape: result, history, sectionEdges };
  } finally {
    builder.delete();
  }
}
