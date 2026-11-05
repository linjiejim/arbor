import type { GcsWrapper, SketchPrimitive } from "@salusoft89/planegcs"
import type { V2 } from "@/three/geom"

/**
 * FreeCAD's sketch solver (planegcs, compiled to wasm) behind a tiny API for
 * one four-line profile. The module and its 480 KB wasm load on demand, the
 * first time the lesson opens; Vite serves the wasm through a `?url` import.
 *
 * A solve pushes the whole sketch (points, lines, constraints) from scratch:
 * at this size that costs well under a millisecond, and it keeps the solver
 * stateless between calls.
 */
export type SolveResult = {
  pts: V2[]
  dof: number
  /** ok · redundant (over-defined but consistent) · conflict (no solution). */
  status: "ok" | "redundant" | "conflict"
  redundant: string[]
  conflicting: string[]
}

export type Param = { name: string; value: number; fixed: boolean }

export type Solver = {
  solve(pts: V2[], constraints: SketchPrimitive[], opts?: { params?: Param[]; drag?: { index: number; to: V2 } }): SolveResult
  destroy(): void
  /** Download + compile + instantiate, ms. */
  loadMs: number
}

/** Point ids p1…p4; lines l1 (bottom: p1→p2), l2 (right), l3 (top), l4 (left). "o" is the fixed origin. */
export const PT = ["p1", "p2", "p3", "p4"] as const
export const LN = ["l1", "l2", "l3", "l4"] as const

export async function loadSolver(): Promise<Solver> {
  const t0 = performance.now()
  const [{ make_gcs_wrapper, DebugMode, SolveStatus }, { default: wasmUrl }] = await Promise.all([
    import("@salusoft89/planegcs"),
    import("@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url"),
  ])
  const gcs: GcsWrapper = await make_gcs_wrapper(wasmUrl)
  gcs.debug_mode = DebugMode.NoDebug // the default prints solver chatter to the console
  const loadMs = performance.now() - t0

  const push = (pts: V2[], constraints: SketchPrimitive[], params: Param[], extra: SketchPrimitive[]) => {
    gcs.clear_data()
    for (const p of params) gcs.push_sketch_param(p.name, p.value, p.fixed)
    const geometry: SketchPrimitive[] = [
      { id: "o", type: "point", x: 0, y: 0, fixed: true },
      ...pts.map(([x, y], i) => ({ id: PT[i], type: "point" as const, x, y, fixed: false })),
      ...LN.map((id, i) => ({ id, type: "line" as const, p1_id: PT[i], p2_id: PT[(i + 1) % 4] })),
    ]
    gcs.push_primitives_and_params([...geometry, ...constraints, ...extra])
  }
  const read = (): V2[] =>
    PT.map((id) => {
      const p = gcs.sketch_index.get_sketch_point(id)
      return [p.x, p.y] as V2
    })

  return {
    loadMs,
    solve(pts, constraints, opts = {}) {
      const params = opts.params ?? []
      // Diagnose without the drag: temporary constraints don't count towards the DOF.
      push(pts, constraints, params, [])
      const st = gcs.solve()
      const conflicting = gcs.get_gcs_conflicting_constraints()
      const redundant = gcs.get_gcs_redundant_constraints()
      const dof = gcs.gcs.dof()
      const failed = st === SolveStatus.Failed || conflicting.length > 0
      let out = pts
      if (!failed) {
        gcs.apply_solution()
        out = read()
        if (opts.drag) {
          // FreeCAD's drag: the pointer pulls the point through temporary, lower-priority constraints,
          // so the real constraints always win (a fully defined sketch doesn't move).
          const { index, to } = opts.drag
          push(out, constraints, params, [
            { id: "drag_x", type: "coordinate_x", p_id: PT[index], x: to[0], temporary: true },
            { id: "drag_y", type: "coordinate_y", p_id: PT[index], y: to[1], temporary: true },
          ])
          if (gcs.solve() !== SolveStatus.Failed) {
            gcs.apply_solution()
            out = read()
          }
        }
      }
      return {
        pts: out,
        dof: failed ? 0 : dof,
        status: failed ? "conflict" : redundant.length ? "redundant" : "ok",
        redundant,
        conflicting,
      }
    },
    destroy() {
      gcs.destroy_gcs_module()
    },
  }
}
