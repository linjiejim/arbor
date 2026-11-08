import type { OpId } from "@/content/ops"
import type { Feature } from "./dsl"

/** The icon each kind of step shows (timeline, step panel). */
const OP_ICON: Record<Feature["op"], OpId> = {
  sketch: "sketch",
  extrude: "extrude",
  revolve: "revolve",
  fillet: "fillet",
  chamfer: "chamfer",
  shell: "shell",
  hole: "hole",
  linear_pattern: "pattern",
  circular_pattern: "pattern",
  mirror: "mirror",
  sweep: "sweep",
  loft: "loft",
  draft: "draft",
  rib: "rib",
  split: "cut",
  import: "boolean",
  component: "boolean",
  thread: "thread",
}

/** A step's icon: a cut extrude reads as a cut. */
export function iconOf(f: Feature): OpId {
  return f.op === "extrude" && f.mode === "cut" ? "cut" : OP_ICON[f.op]
}
