// Generate build123d code for a few trees, run it with the project's Python env and
// compare the volume with our kernel. Usage: tsx scripts/codegen-check.ts
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { toBuild123d } from "../src/studio/codegen"
import type { Tree } from "../src/studio/dsl"
import { Kernel } from "../src/studio/kernel/build"
import { initNodeKernel } from "../src/studio/kernel/node"

const PY = process.env.PYTHON ?? "../.venv/bin/python"
const trees: Record<string, Tree> = {
  box: {
    params: { L: 80, W: 50, H: 30, t: 2, r: 6 },
    features: [
      { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
      { id: "base", op: "extrude", sketch: "sk", distance: "H" },
      { id: "round", op: "fillet", edges: { of: "base", parallel: "Z" }, r: "r" },
      { id: "hollow", op: "shell", open: { normal: "+Z", extreme: "+Z" }, t: "t" },
      { id: "holes", op: "hole", on: { plane: "XY" }, reverse: true, at: [["L/4", 0], ["-L/4", 0]], d: 4 },
    ],
  },
  flange: {
    params: { D: 120, T: 10, bolt: 8, pcd: 90 },
    features: [
      { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "circle", d: "D" }, { type: "circle", d: 40, cut: true }] },
      { id: "disc", op: "extrude", sketch: "sk", distance: "T" },
      { id: "h", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [["pcd/2", 0]], d: "bolt" },
      { id: "ring", op: "circular_pattern", features: ["h"], axis: "Z", count: 6 },
      { id: "ch", op: "chamfer", edges: { kind: "circle", radius: "D/2" }, d: 1 },
    ],
  },
  shaft: {
    params: {},
    features: [
      { id: "s", op: "sketch", on: { plane: "XZ" }, shapes: [{ type: "polyline", points: [[0, 0], [10, 0], [10, 30], [7, 30], [7, 55], [5, 55], [5, 70], [0, 70]] }] },
      { id: "r", op: "revolve", sketch: "s", axis: "Z" },
    ],
  },
  ribs: {
    params: { t: 4 },
    features: [
      { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 120, h: 80 }] },
      { id: "plate", op: "extrude", sketch: "s", distance: "t" },
      { id: "rs", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "rect", w: 100, h: 3, center: [0, -25] }] },
      { id: "rib", op: "extrude", sketch: "rs", distance: 12 },
      { id: "pat", op: "linear_pattern", features: ["rib"], dir: "+Y", count: 3, spacing: 25 },
      { id: "m", op: "mirror", plane: "XZ", features: ["rib"], offset: 0 },
    ],
  },
}

await initNodeKernel()
fs.mkdirSync(".tmp/codegen", { recursive: true })
for (const [name, tree] of Object.entries(trees)) {
  const k = new Kernel()
  const rep = k.rebuild(tree)
  const ours = rep.body?.volume ?? NaN
  const file = `.tmp/codegen/${name}.py`
  fs.writeFileSync(file, toBuild123d(tree) + "\nprint(f'VOLUME {part.volume:.2f}')\n")
  let theirs = NaN
  try {
    const out = execFileSync(PY, [file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    theirs = Number(/VOLUME (\S+)/.exec(out)?.[1])
  } catch (e) {
    console.log(`${name}: python failed\n${String((e as { stderr?: string }).stderr ?? e).split("\n").slice(-6).join("\n")}`)
  }
  const ok = Math.abs(ours - theirs) <= 0.005 * ours
  console.log(`${ok ? "OK  " : "DIFF"} ${name.padEnd(8)} kernel ${ours.toFixed(1)}  build123d ${theirs.toFixed(1)}`)
  k.dispose()
}
