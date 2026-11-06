// The section view: a plane along X, Y or Z that cuts the model open.
import * as THREE from "three"

type V3 = [number, number, number]

/** A section through the model: the plane is at `at` along `axis`; `flip` keeps the other side. */
export type Section = { axis: "X" | "Y" | "Z"; at: number; flip: boolean }

export const AXIS_INDEX = { X: 0, Y: 1, Z: 2 } as const
/** Which side stays by default: you look at the cut from the right (+X), the front (-Y) and the top (+Z). */
const KEEP_BELOW = { X: true, Y: false, Z: true }

/** Points with normal·p + constant ≥ 0 stay. */
export function sectionPlane(s: Section): THREE.Plane {
  const n = new THREE.Vector3()
  n.setComponent(AXIS_INDEX[s.axis], 1)
  const keepBelow = KEEP_BELOW[s.axis] !== s.flip
  if (keepBelow) n.negate()
  return new THREE.Plane(n, keepBelow ? s.at : -s.at)
}

export function newSection(bbox: [V3, V3] | null, axis: Section["axis"] = "Z"): Section {
  const i = AXIS_INDEX[axis]
  return { axis, at: bbox ? round((bbox[0][i] + bbox[1][i]) / 2) : 0, flip: false }
}

export const round = (x: number) => Math.round(x * 10) / 10
