import type { Tree } from "./dsl"

/**
 * Ready-made feature trees: a way into the studio without the model (rollback,
 * parameters, code all work), and the bridge from a teardown to "now change it
 * yourself". `teardown` links a starter to the baked model it mirrors.
 */
export const STARTERS: { id: string; title: string; note: string; teardown?: string; tree: Tree }[] = [
  {
    id: "box-fillet-first",
    title: "小盒子：先圆角后抽壳",
    note: "和案例拆解里的小盒子 A 同一个做法。把 r 改到比 t 小，看内角怎么变。",
    teardown: "box_fillet_first",
    tree: {
      params: { L: 60, W: 40, H: 30, r: 4, t: 2.5 },
      features: [
        { id: "sk1", op: "sketch", name: "草图1", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "盒子外轮廓画在上视基准面上" },
        { id: "ext1", op: "extrude", name: "拉伸1", sketch: "sk1", distance: "H", intent: "先得到实心的盒体" },
        { id: "fil1", op: "fillet", name: "外圆角", edges: { not: { extreme: "+Z" } }, r: "r", intent: "除了顶面一圈，竖边和底边都倒圆角；放在抽壳之前，内侧会得到同心的圆角" },
        { id: "shell1", op: "shell", name: "抽壳", open: { normal: "+Z", extreme: "+Z" }, t: "t", intent: "去掉顶面，所有面向内偏移一个壁厚" },
      ],
    },
  },
  {
    id: "flange",
    title: "法兰盘",
    note: "孔先做一个，再用圆周阵列复制；改 n 和 pcd 看阵列怎么跟着变。",
    tree: {
      params: { D: 120, T: 10, d0: 40, pcd: 90, bolt: 8 },
      features: [
        { id: "sk", op: "sketch", name: "盘面草图", on: { plane: "XY" }, shapes: [{ type: "circle", d: "D" }, { type: "circle", d: "d0", cut: true }], intent: "外圆和中心孔一起画，拉伸一次就有通孔" },
        { id: "disc", op: "extrude", name: "盘体", sketch: "sk", distance: "T" },
        { id: "h1", op: "hole", name: "螺栓孔", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [["pcd/2", 0]], d: "bolt", intent: "只做一个孔作为阵列的种子" },
        { id: "ring", op: "circular_pattern", name: "孔阵列", features: ["h1"], axis: "Z", count: 6, intent: "绕中心等分 6 个，改种子孔径所有孔一起变" },
        { id: "ch", op: "chamfer", name: "外缘倒角", edges: { kind: "circle", radius: "D/2" }, d: 1, intent: "去掉外缘锐边" },
      ],
    },
  },
  {
    id: "mug",
    title: "带把手的杯子",
    note: "旋转出杯身，抽壳，再沿 C 形路径扫掠出把手。",
    tree: {
      params: { R: 40, H: 100, t: 3, rb: 5 },
      features: [
        { id: "s", op: "sketch", name: "杯身半截面", on: { plane: "XZ" }, shapes: [{ type: "rect", w: "R", h: "H", center: ["R/2", "H/2"] }], intent: "回转体只画轴一侧的半截面" },
        { id: "body", op: "revolve", name: "杯身", sketch: "s", axis: "Z" },
        { id: "fb", op: "fillet", name: "杯底圆角", edges: { kind: "circle", extreme: "-Z" }, r: "rb", intent: "抽壳前做，内侧会跟着变圆" },
        { id: "sh", op: "shell", name: "抽壳", open: { normal: "+Z", extreme: "+Z" }, t: "t" },
        { id: "handle", op: "sweep", name: "把手", path: { on: { plane: "XZ" }, points: [["R-1.5", 75], ["R+28", 75], ["R+28", 30], ["R-1.5", 30]], corner: 12 }, profile: { type: "rect", w: 9, h: 6 }, intent: "路径两端伸进杯壁里，合并后没有缝" },
      ],
    },
  },
  {
    id: "shaft",
    title: "阶梯轴",
    note: "一个半截面旋转出三段直径；轴肩处可以再加倒角。",
    tree: {
      params: {},
      features: [
        { id: "s", op: "sketch", name: "半截面", on: { plane: "XZ" }, shapes: [{ type: "polyline", points: [[0, 0], [10, 0], [10, 30], [7, 30], [7, 55], [5, 55], [5, 70], [0, 70]] }] },
        { id: "r", op: "revolve", name: "旋转", sketch: "s", axis: "Z" },
        { id: "c", op: "chamfer", name: "端部倒角", edges: { kind: "circle", radius: 10, extreme: "-Z" }, d: 1 },
      ],
    },
  },
]

export const starterFor = (teardownId: string) => STARTERS.find((s) => s.teardown === teardownId)
