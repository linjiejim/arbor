import { initNodeKernel } from "../src/studio/kernel/node"
import { Kernel } from "../src/studio/kernel/build"
import type { Tree } from "../src/studio/dsl"

await initNodeKernel()
const k = new Kernel()
const tree: Tree = {
  params: { L: 80, W: 50, H: 30, t: 2, r: 5 },
  features: [
    { id: "sk1", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
    { id: "base", op: "extrude", sketch: "sk1", distance: "H" },
    { id: "f1", op: "fillet", edges: { parallel: "Z", of: "base" }, r: "r" },
    { id: "sh", op: "shell", open: { normal: "+Z", extreme: "+Z" }, t: "t" },
    { id: "h1", op: "hole", on: { plane: "XY", face: { normal: "-Z" } }, at: [[20, 0], [-20, 0]], d: 4, reverse: true },
    { id: "boss", op: "sketch", on: { plane: "XY", offset: "t" }, shapes: [{ type: "circle", d: 8, center: [0, 10] }, { type: "circle", d: 3, center: [0, 10], cut: true }] },
    { id: "bossEx", op: "extrude", sketch: "boss", distance: 10 },
    { id: "pat", op: "linear_pattern", features: ["bossEx"], dir: "-Y", count: 2, spacing: 20 },
    { id: "mir", op: "mirror", plane: "YZ", features: ["bossEx"], offset: 0 },
  ],
}
let t = performance.now()
const rep = k.rebuild(tree)
console.log("rebuild ms", (performance.now() - t).toFixed(0))
for (const f of rep.features) console.log(f.state.padEnd(7), f.id.padEnd(7), f.name, "|", f.summary ?? "", f.message ?? "", f.hint ?? "", f.warnings ?? "", f.faces ? JSON.stringify(f.faces) : "")
console.log(rep.body)
console.log(k.inspect("faces", undefined, { of: "h1" }))
// incremental: change last feature only
tree.features[8] = { ...tree.features[8], offset: 0 } as never
t = performance.now()
const rep2 = k.rebuild({ ...tree, features: [...tree.features.slice(0, 8), { id: "mir", op: "mirror", plane: "XZ" }] })
console.log("incremental ms", (performance.now() - t).toFixed(0), rep2.features.at(-1))
const d = k.display()
console.log("display groups", d.groups.length, d.groups.slice(0, 3), "tris", d.mesh?.triangles.length)
// failure: fillet too big
const rep3 = k.rebuild({ ...tree, params: { ...tree.params, r: 40 } })
console.log(rep3.features.map((f) => `${f.id}:${f.state}`).join(" "), "\n", rep3.features.find((f) => f.state === "error"))
// selector error
const rep4 = k.rebuild({ params: {}, features: [tree.features[0], { id: "base", op: "extrude", sketch: "sk1", distance: 10 }, { id: "f", op: "fillet", edges: { parallel: "Z", expect: 2 }, r: 1 }] } as Tree)
console.log(rep4.paramError, rep4.features.at(-1))
// revolve crossing
const rep5 = k.rebuild({ params: {}, features: [{ id: "s", op: "sketch", on: { plane: "XZ" }, shapes: [{ type: "rect", w: 20, h: 10, center: [0, 5] }] }, { id: "r", op: "revolve", sketch: "s", axis: "Z" }] } as Tree)
console.log(rep5.features.at(-1))
const rep6 = k.rebuild({ params: {}, features: [{ id: "s", op: "sketch", on: { plane: "XZ" }, shapes: [{ type: "polyline", points: [[0, 0], [30, 0], [30, 5], { to: [20, 40], via: [26, 20] }, [0, 40]] }] }, { id: "r", op: "revolve", sketch: "s", axis: "Z" }, { id: "c", op: "circular_pattern", features: ["r"], axis: "Z", count: 3 }] } as Tree)
console.log(rep6.features.map((f) => [f.id, f.state, f.summary, f.message, f.warnings]), rep6.body)
k.dispose()
