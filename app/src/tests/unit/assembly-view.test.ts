import * as THREE from "three"
import { expect, it } from "vitest"
import { modelObject, repaint, groupAt, faceTarget, NO_PARTS_VIEW } from "@/studio/scene"
import type { DisplayData } from "@/studio/kernel/build"
import type { MaterialKit } from "@/three/materials"
import { newNote, parseNotes } from "@/desktop/core/notes"
import { matchesPart, selectParts } from "@/studio/part-selection"

const data: DisplayData = {
  index: 1, mesh: { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]), normals: new Float32Array(18), triangles: new Uint32Array([0, 1, 2, 3, 4, 5]) },
  groups: [{ hash: 11, origin: "repeat", status: "kept", start: 0, count: 3, part: 0 }, { hash: 12, origin: "repeat", status: "new", start: 3, count: 3, part: 1 }], edges: null, edgeGroups: [], sketch: null, threads: [], bbox: [[0, 0, 0], [3, 1, 0]],
  parts: [{ name: "first", center: [0, 0, 0], explode: [100, 0, 0] }, { name: "second", center: [2, 0, 0], explode: [0, 100, 0] }],
}
const solid = new THREE.MeshBasicMaterial(), ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.14 })
const kit = { model: solid, modelDark: solid, highlight: solid, modified: solid, ghost } as MaterialKit

it("isolates one instance, ghosts the others, and restores the complete assembly without changing source geometry", () => {
  const before = structuredClone(data)
  const isolated = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, focus: { parts: ["second"], mode: "isolate" } })
  expect(isolated.children).toHaveLength(1)
  expect(isolated.children[0].userData.part).toBe(1)
  const context = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, focus: { parts: ["second"], mode: "ghost" } })
  expect((context.children[0] as THREE.Mesh).material).toBe(ghost)
  expect(context.children[1].userData.contextGhost).toBe(false)
  repaint(context, { status: false, highlight: "repeat" })
  expect((context.children[0] as THREE.Mesh).material).toBe(ghost)
  const restored = modelObject(data, kit, { status: false }, NO_PARTS_VIEW)
  expect((restored.children[0] as THREE.Mesh).geometry.index!.count).toBe(6)
  expect(data).toEqual(before)
})

it("raycasts an exploded internal instance precisely and stores annotations in native coordinates", () => {
  const model = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, explode: 1 })
  model.updateMatrixWorld(true)
  const ray = new THREE.Raycaster(new THREE.Vector3(2.2, 100.2, 5), new THREE.Vector3(0, 0, -1))
  const hit = ray.intersectObjects(model.children, false)[0]
  expect(groupAt(hit)).toMatchObject({ hash: 12, origin: "repeat", part: 1 })
  const target = faceTarget(hit)!
  expect(target.point[0]).toBeCloseTo(2.2)
  expect(target.point[1]).toBeCloseTo(0.2)
  expect(target.point[2]).toBe(0)
  const note = newNote({ notes: [], next: 1 }, { ...target, part: "second", kind: "face", what: "面", where: "内部件", facts: "", origins: ["repeat"], selector: null, sketch: null }, "调整这里")
  const restored = parseNotes(JSON.stringify({ next: 2, notes: [note] })).notes[0]
  expect(restored.part).toBe("second")
  expect(restored.point).toEqual(target.point)
})

it("keeps multiple isolated instances at their exploded positions and respects manual hiding", () => {
  const view = { ...NO_PARTS_VIEW, explode: 1, focus: { parts: ["first", "second"], mode: "isolate" as const } }
  const model = modelObject(data, kit, { status: false }, view)
  expect(model.children.map((c) => c.userData.part)).toEqual([0, 1])
  expect(model.children.map((c) => c.position.toArray())).toEqual([[100, 0, 0], [0, 100, 0]])
  const hidden = modelObject(data, kit, { status: false }, { ...view, hidden: new Set([0]) })
  expect(hidden.children.map((c) => c.userData.part)).toEqual([1])
  const restored = modelObject(data, kit, { status: false }, { ...view, focus: undefined })
  expect(restored.children.map((c) => c.position.toArray())).toEqual([[100, 0, 0], [0, 100, 0]])
})

it("searches names, source files and step IDs without changing a multi-selection", () => {
  const selected = selectParts(selectParts([], "外壳", true), "内部件", true)
  expect(selected).toEqual(["外壳", "内部件"])
  expect(selectParts(selected, "外壳", true)).toEqual(["内部件"])
  expect(selectParts(selected, "右侧件", false)).toEqual(["右侧件"])
  expect(selectParts(["右侧件"], "右侧件", false)).toEqual([])
  expect(matchesPart(" 内部 INNER ", "内部件", "parts/inner.turnery.json", "motor_core")).toBe(true)
  expect(matchesPart("ＭＯＴＯＲ", "内部件", "parts/inner.turnery.json", "motor_core")).toBe(true)
  expect(matchesPart("outer", "内部件", "parts/inner.turnery.json", "motor_core")).toBe(false)
  expect(matchesPart("   ", "内部件")).toBe(true)
  expect(selected).toEqual(["外壳", "内部件"])
})

it("separates hover, selection and opt-in change colors in assembled and exploded views", () => {
  for (const explode of [0, 1]) {
    const model = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, explode })
    const indices = () => model.children.flatMap((o) => (o as THREE.Mesh).geometry.groups.map((g) => g.materialIndex))
    expect(indices()).toEqual([0, 0])
    repaint(model, { status: false, selected: [0], hovered: [12] })
    expect(indices()).toEqual([1, 5])
    repaint(model, { status: true })
    expect(indices()).toEqual([0, 6])
  }
})
