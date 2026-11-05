// Meshing + per-face bookkeeping for one feature step.
import { getOC, measureArea } from "replicad";

/**
 * Triangulate a shape. Same C++ entry point as replicad's shape.mesh(), but the
 * buffers are copied out of the wasm heap as typed arrays (replicad copies them
 * into plain JS arrays with Array.from, which is slower and not transferable).
 */
export function meshShape(shape, { tolerance = 0.05, angularTolerance = 0.2 } = {}) {
  const oc = getOC();
  const raw = oc.ReplicadMeshExtractor.extract(shape.wrapped, tolerance, angularTolerance, false);
  const buf = oc.wasmMemory.buffer;
  const f32 = (ptr, n) => new Float32Array(buf, ptr >>> 0, n).slice();
  const u32 = (ptr, n) => new Uint32Array(buf, ptr >>> 0, n).slice();
  const i32 = (ptr, n) => new Int32Array(buf, ptr >>> 0, n).slice();
  const vertices = f32(raw.getVerticesPtr(), raw.getVerticesSize());
  const normals = f32(raw.getNormalsPtr(), raw.getNormalsSize());
  const triangles = u32(raw.getTrianglesPtr(), raw.getTrianglesSize());
  const groupsRaw = i32(raw.getFaceGroupsPtr(), raw.getFaceGroupsSize());
  raw.delete();
  const faceGroups = [];
  for (let i = 0; i < groupsRaw.length; i += 3) {
    faceGroups.push({ start: groupsRaw[i], count: groupsRaw[i + 1], faceId: groupsRaw[i + 2] });
  }
  return { vertices, normals, triangles, faceGroups };
}

export function meshEdgesOf(shape, { tolerance = 0.05, angularTolerance = 0.2 } = {}) {
  const oc = getOC();
  const raw = oc.ReplicadEdgeMeshExtractor.extract(shape.wrapped, tolerance, angularTolerance);
  const buf = oc.wasmMemory.buffer;
  const lines = new Float32Array(buf, raw.getLinesPtr() >>> 0, raw.getLinesSize()).slice();
  const groupsRaw = new Int32Array(buf, raw.getEdgeGroupsPtr() >>> 0, raw.getEdgeGroupsSize()).slice();
  raw.delete();
  const edgeGroups = [];
  for (let i = 0; i < groupsRaw.length; i += 3) {
    edgeGroups.push({ start: groupsRaw[i], count: groupsRaw[i + 1], edgeId: groupsRaw[i + 2] });
  }
  return { lines, edgeGroups };
}

/**
 * Geometric signature of every face (type, area, centroid) plus one interior
 * sample point taken from the face's own triangulation (centroid of its biggest
 * triangle, snapped back onto the exact surface).
 */
export function faceSignatures(shape, mesh) {
  const oc = getOC();
  const faces = shape.faces;
  const hashes = faces.map((f) => f.hashCode);
  const byHash = new Map(hashes.map((h, i) => [h, i]));
  const groupOfFace = new Array(faces.length).fill(null);
  let unmatchedGroups = 0;
  mesh.faceGroups.forEach((g, gi) => {
    const idx = byHash.get(g.faceId);
    if (idx === undefined) unmatchedGroups++;
    else groupOfFace[idx] = gi;
  });

  const sigs = faces.map((f, i) => {
    const center = f.center;
    const sig = {
      index: i,
      type: f.geomType,
      area: measureArea(f),
      center: [center.x, center.y, center.z],
      sample: null,
    };
    center.delete();
    const gi = groupOfFace[i];
    if (gi !== null) {
      const { start, count } = mesh.faceGroups[gi];
      let best = -1;
      let bestArea = -1;
      for (let k = start; k < start + count; k += 3) {
        const a = mesh.triangles[k] * 3, b = mesh.triangles[k + 1] * 3, c = mesh.triangles[k + 2] * 3;
        const v = mesh.vertices;
        const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
        const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
        const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
        const area2 = cx * cx + cy * cy + cz * cz;
        if (area2 > bestArea) { bestArea = area2; best = k; }
      }
      if (best >= 0) {
        const v = mesh.vertices;
        const ids = [mesh.triangles[best], mesh.triangles[best + 1], mesh.triangles[best + 2]];
        const p = [0, 1, 2].map((d) => (v[ids[0] * 3 + d] + v[ids[1] * 3 + d] + v[ids[2] * 3 + d]) / 3);
        // snap onto the exact surface (removes chord error of the triangle)
        const surf = oc.BRep_Tool.Surface(f.wrapped);
        const pnt = new oc.gp_Pnt(p[0], p[1], p[2]);
        const proj = new oc.GeomAPI_ProjectPointOnSurf(pnt, surf);
        if (proj.NbPoints() > 0) {
          const q = proj.NearestPoint();
          sig.sample = [q.X(), q.Y(), q.Z()];
          q.delete();
        } else sig.sample = p;
        proj.delete();
        pnt.delete();
        surf.delete?.();
      }
    }
    return sig;
  });
  faces.forEach((f) => f.delete());
  return { sigs, groupOfFace, unmatchedGroups, hashes };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Signature-only classification against the previous step (no OCCT history):
 *  kept     = some previous face has same surface type, same area, same centroid
 *  modified = some previous face of the same type has an underlying surface that
 *             passes through this face's interior sample point (trimmed / split / extended)
 *  new      = otherwise
 */
export function classifyBySignature(prevShape, prevSigs, curSigs, { tol = 1e-4 } = {}) {
  const oc = getOC();
  const prevFaces = prevShape ? prevShape.faces : [];
  const surfaces = prevFaces.map((f) => oc.BRep_Tool.Surface(f.wrapped));
  const status = curSigs.map((s) => {
    if (!prevSigs) return "new";
    const kept = prevSigs.some(
      (p) => p.type === s.type && Math.abs(p.area - s.area) <= 1e-6 * Math.max(1, s.area) + 1e-6 && dist(p.center, s.center) <= tol * 10,
    );
    if (kept) return "kept";
    if (!s.sample) return "new";
    for (const p of prevSigs) {
      if (p.type !== s.type) continue;
      const pnt = new oc.gp_Pnt(s.sample[0], s.sample[1], s.sample[2]);
      const proj = new oc.GeomAPI_ProjectPointOnSurf(pnt, surfaces[p.index]);
      const d = proj.NbPoints() > 0 ? proj.LowerDistance() : Infinity;
      proj.delete();
      pnt.delete();
      if (d <= tol) return "modified";
    }
    return "new";
  });
  surfaces.forEach((s) => s.delete?.());
  prevFaces.forEach((f) => f.delete());
  return status;
}
