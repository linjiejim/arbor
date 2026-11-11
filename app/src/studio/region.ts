// A note on an area of the view rather than one face or edge: a box dragged over the model (R) or
// strokes drawn on it (P). What the view gathers when it is drawn, for the note card, the pin and
// the agent.
export type V3 = [number, number, number]

/** Where the camera was when the area was marked: the note goes back there when located. */
export type RegionCamera = { position: V3; target: V3; up: V3 }

export type RegionPick = {
  shape: "box" | "pen"
  camera: RegionCamera
  /** The box, as fractions of the view (left, top, right, bottom). */
  rect?: [number, number, number, number]
  /** Each stroke's points on the model, in the assembled position (not pulled apart). */
  strokes?: V3[][]
  /** Where the pin goes: on the model, near the middle of what was marked. */
  point: V3
  /** The part the pin is on, if any. */
  part?: string
  /** Parts and steps (feature ids) whose faces show in the box or under the strokes. */
  parts: string[]
  origins: string[]
  /** How many faces that is. */
  faces: number
  /** The box round what was marked, in model coordinates. */
  bbox: [V3, V3] | null
  /** The view as it was, with the box or the strokes on it: a PNG data URL. */
  image?: string
}

/** How the host keeps such a note; false when it wasn't kept (the card stays open). */
export type SketchHost = { save: (pick: RegionPick, text: string) => Promise<boolean> }
