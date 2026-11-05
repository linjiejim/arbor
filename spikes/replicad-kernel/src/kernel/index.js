// Kernel entry shared by the Web Worker and the Node benchmark.
import { buildMugSteps, disposeBuild } from "./mug.js";
import { meshShape, meshEdgesOf, faceSignatures, classifyBySignature } from "./mesh.js";

export { DEFAULT_PARAMS, PARAM_RANGES, STEP_LABELS } from "./params.js";

const now = () => performance.now();

/**
 * Build every feature step, mesh it, and classify each face of each step as
 * new / modified / kept relative to the previous step, twice:
 *   - statusHistory:   from the OCCT builder history (Modified/Generated/IsDeleted)
 *   - statusSignature: from geometry only (surface type + area + centroid + point-on-surface)
 * Returns plain data + typed arrays (transferable).
 */
export function runMug(params, { tolerance = 0.05, angularTolerance = 0.2, classify = true } = {}) {
  const t0 = now();
  const build = buildMugSteps(params);
  const tBuild = now() - t0;

  const out = [];
  let prevShape = null;
  let prevSigs = null;
  let prevHashes = null;
  let tMesh = 0;
  let tClassify = 0;
  for (const s of build.steps) {
    const tm0 = now();
    const mesh = meshShape(s.shape, { tolerance, angularTolerance });
    const edges = meshEdgesOf(s.shape, { tolerance, angularTolerance });
    const meshMs = now() - tm0;
    tMesh += meshMs;

    let statusHistory = null;
    let statusSignature = null;
    let sigs = null;
    let unmatchedGroups = 0;
    let groupOfFace = null;
    let hashes = null;
    let statusFaceId = null;
    let classifyMs = 0;
    if (classify) {
      const tc0 = now();
      ({ sigs, groupOfFace, unmatchedGroups, hashes } = faceSignatures(s.shape, mesh));
      statusSignature = classifyBySignature(prevShape, prevSigs, sigs);
      // replicad face id (= OCCT hash of the TopoDS_Face) seen in the previous step -> same face object
      statusFaceId = hashes.map((h) => (prevHashes?.has(h) ? "kept" : "changed"));
      statusHistory = s.history ? s.history.status : sigs.map(() => "new");
      classifyMs = now() - tc0;
      tClassify += classifyMs;
    }

    // Per mesh group status (what the renderer needs)
    const faceIndexOfGroup = new Array(mesh.faceGroups.length).fill(-1);
    if (groupOfFace) groupOfFace.forEach((gi, fi) => { if (gi !== null) faceIndexOfGroup[gi] = fi; });

    out.push({
      key: s.key,
      label: s.label,
      opMs: s.ms,
      meshMs,
      classifyMs,
      faceCount: sigs ? sigs.length : mesh.faceGroups.length,
      triangleCount: mesh.triangles.length / 3,
      mesh,
      edges,
      faceIndexOfGroup,
      faces: sigs
        ? sigs.map((sg, i) => ({
            type: sg.type,
            area: sg.area,
            statusHistory: statusHistory[i],
            statusSignature: statusSignature[i],
            statusFaceId: statusFaceId[i],
            from: s.history?.from?.[i] ?? [],
          }))
        : [],
      deleted: s.history?.deleted ?? [],
      unmatchedGroups,
    });
    prevShape = s.shape;
    prevSigs = sigs;
    prevHashes = hashes ? new Set(hashes) : null;
  }
  const total = now() - t0;
  disposeBuild(build);
  return {
    params: build.params,
    steps: out,
    failed: build.failed,
    timings: { buildMs: tBuild, meshMs: tMesh, classifyMs: tClassify, totalMs: total },
  };
}

/** Collect the transferable buffers of a runMug() result (for postMessage). */
export function transferablesOf(result) {
  const list = [];
  for (const s of result.steps) {
    list.push(s.mesh.vertices.buffer, s.mesh.normals.buffer, s.mesh.triangles.buffer, s.edges.lines.buffer);
  }
  return list;
}
