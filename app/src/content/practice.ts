import type { Check, Feature, Tree } from "@/studio/dsl"

/**
 * 练习：课程讲完一个概念，到工作台上自己做一个零件。`checks` 是判分用的要求，
 * 放进特征树的 `checks`，每次重建由内核重新量；`solution` 只给测试用（practice.test.ts
 * 用真内核建出来，要求全部通过），界面上不显示。
 */
export type Practice = {
  id: string
  /** 课程 id（lessons/index.ts） */
  lesson: string
  title: string
  /** 一两句话的任务，每个尺寸都写出来 */
  task: string
  /** 起始特征树；不写就是空的 */
  start?: Tree
  /** 判分用的要求：id 以 "p-" 开头，said 是任务里的原话，期望值写数字 */
  checks: Check[]
  /** 提示，按学员需要的先后排 */
  tips: string[]
  /** 参考答案 */
  solution: Tree
}

const TOP = { normal: "+Z", extreme: "+Z" } as const

/** 一块 60×30×20 的料（圆角与倒角的起点）。 */
const blockTree: Tree = {
  params: { L: 60, W: 30, H: 20 },
  paramNotes: { L: "长，沿 X", W: "宽，沿 Y", H: "高，沿 Z" },
  features: [
    { id: "sk", op: "sketch", name: "轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称" },
    { id: "base", op: "extrude", name: "料块", sketch: "sk", distance: "H", intent: "先得到实心的料，再加工边" },
  ],
}

/** 先抽壳、后倒外圆角的盒子：内转角是尖的。 */
const boxSketch: Feature = { id: "sk", op: "sketch", name: "盒子轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "外轮廓画在上视基准面上" }
const boxBase: Feature = { id: "base", op: "extrude", name: "实心盒体", sketch: "sk", distance: "H", intent: "先得到实心的盒体" }
const boxFillet: Feature = {
  id: "fil",
  op: "fillet",
  name: "外圆角",
  edges: { of: "base", parallel: "Z", expect: 4 },
  r: "r",
  intent: "盒体外侧的四条竖边倒圆角",
}
const boxShell: Feature = { id: "sh", op: "shell", name: "抽壳", open: TOP, t: "t", intent: "去掉顶面，所有面向内偏移一个壁厚" }
const boxParams = {
  params: { L: 80, W: 50, H: 30, r: 6, t: 2 },
  paramNotes: { L: "外形长，沿 X", W: "外形宽，沿 Y", H: "总高，沿 Z", r: "外圆角半径", t: "壁厚（抽壳向内）" },
}

/** 立柱加一根横梁，横梁的底面是平的悬空面。 */
const bracketParams = {
  params: { a: 20, H: 60, arm: 30, t: 10 },
  paramNotes: { a: "立柱截面边长，也是横梁的宽", H: "立柱高", arm: "横梁伸出立柱的长度", t: "横梁厚" },
}
const bracketFeatures: Feature[] = [
  { id: "post_s", op: "sketch", name: "立柱截面", on: { plane: "XY" }, shapes: [{ type: "rect", w: "a", h: "a" }], intent: "立柱放在原点上" },
  { id: "post", op: "extrude", name: "立柱", sketch: "post_s", distance: "H", intent: "立着打印，Z 向上" },
  {
    id: "arm_s",
    op: "sketch",
    name: "横梁截面",
    on: { plane: "XY", offset: "H-t" },
    shapes: [{ type: "rect", w: "arm", h: "a", center: ["a/2+arm/2", 0] }],
    intent: "画在偏移 H-t 的基准面上，紧贴立柱右侧",
  },
  { id: "arm", op: "extrude", name: "横梁", sketch: "arm_s", distance: "t", intent: "往上长到和立柱顶面齐平" },
]

export const PRACTICE: Practice[] = [
  {
    id: "sketch-to-solid-1",
    lesson: "sketch-to-solid",
    title: "带孔的垫块",
    task: "在上视基准面上画一个 60×40 的矩形，拉伸 20 做成垫块；再在正中间打一个 ⌀16 的通孔，孔心离左端 30、离前边 20。",
    checks: [
      { id: "p-size", said: "60×40 的矩形，拉伸 20", kind: "size", expect: [60, 40, 20] },
      { id: "p-hole", said: "⌀16 的通孔", kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 16 },
      { id: "p-hole-x", said: "孔心离左端 30", kind: "distance", a: { face: { kind: "cylinder" } }, b: { face: { normal: "-X" } }, expect: 30 },
      { id: "p-hole-y", said: "离前边 20", kind: "distance", a: { face: { kind: "cylinder" } }, b: { face: { normal: "-Y" } }, expect: 20 },
    ],
    tips: ["矩形的中心放在原点：宽 60 沿 X，高 40 沿 Y", "拉伸 20，沿上视基准面的法向往上长", "孔可以在同一张草图里画一个挖掉的圆，也可以用孔特征"],
    solution: {
      params: { L: 60, W: 40, H: 20, d: 16 },
      paramNotes: { L: "长，沿 X", W: "宽，沿 Y", H: "厚，沿 Z", d: "中间通孔直径" },
      features: [
        { id: "sk", op: "sketch", name: "垫块轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称，长和宽都是参数" },
        { id: "base", op: "extrude", name: "垫块", sketch: "sk", distance: "H", intent: "沿上视基准面的法向往上长出厚度" },
        { id: "h1", op: "hole", name: "中间通孔", on: { plane: "XY", face: TOP }, at: [[0, 0]], d: "d", intent: "孔心在原点正上方，也就是垫块正中间；不写深度就是贯穿" },
      ],
    },
  },
  {
    id: "revolve-1",
    lesson: "revolve",
    title: "车一根阶梯轴",
    task: "在前视基准面上画半截面，旋转出一根总长 90 的阶梯轴：从下往上依次是 ⌀30 长 40、⌀20 长 30、⌀12 长 20，轴心有一个 ⌀6 的通孔。",
    checks: [
      { id: "p-d30", said: "⌀30 长 40", kind: "distance", a: { edge: { kind: "circle", radius: 15, extreme: "-Z" } }, b: { edge: { kind: "circle", radius: 15, extreme: "+Z" } }, expect: 40 },
      { id: "p-d20", said: "⌀20 长 30", kind: "distance", a: { edge: { kind: "circle", radius: 10, extreme: "-Z" } }, b: { edge: { kind: "circle", radius: 10, extreme: "+Z" } }, expect: 30 },
      { id: "p-d12", said: "⌀12 长 20", kind: "distance", a: { edge: { kind: "circle", radius: 6, extreme: "-Z" } }, b: { edge: { kind: "circle", radius: 6, extreme: "+Z" } }, expect: 20 },
      { id: "p-bore", said: "⌀6 的通孔", kind: "holes", faces: { kind: "cylinder", radius: 3 }, count: 1, d: 6 },
    ],
    tips: ["回转体只画一半：在前视基准面上，从中心线往外画台阶", "轮廓离开中心线 3，转出来中间就是 ⌀6 的孔", "绕 Z 轴转一整圈"],
    solution: {
      params: { D1: 30, L1: 40, D2: 20, L2: 30, D3: 12, L3: 20, bore: 6 },
      paramNotes: { D1: "下段直径", L1: "下段长", D2: "中段直径", L2: "中段长", D3: "上段直径", L3: "上段长", bore: "轴心通孔直径" },
      features: [
        {
          id: "s",
          op: "sketch",
          name: "半截面",
          on: { plane: "XZ" },
          shapes: [
            {
              type: "polyline",
              points: [
                ["bore/2", 0],
                ["D1/2", 0],
                ["D1/2", "L1"],
                ["D2/2", "L1"],
                ["D2/2", "L1+L2"],
                ["D3/2", "L1+L2"],
                ["D3/2", "L1+L2+L3"],
                ["bore/2", "L1+L2+L3"],
              ],
            },
          ],
          intent: "只画中心线右边的一半；内侧离轴 bore/2，转出来就带着轴心孔",
        },
        { id: "r", op: "revolve", name: "阶梯轴", sketch: "s", axis: "Z", intent: "绕 Z 轴转一整圈，三段台阶一次成形" },
      ],
    },
  },
  {
    id: "pattern-mirror-1",
    lesson: "pattern-mirror",
    title: "四角安装孔",
    task: "做一块 80×50×6 的安装板，四角各打一个 ⌀5 的通孔，孔心离左右两端 8、离前后两边 8。先打一个孔，再用阵列或镜像得到另外三个。",
    checks: [
      { id: "p-size", said: "80×50×6 的安装板", kind: "size", expect: [80, 50, 6] },
      { id: "p-holes", said: "四角各打一个 ⌀5 的通孔", kind: "holes", faces: { kind: "cylinder" }, count: 4, d: 5 },
      {
        id: "p-edge-x",
        said: "孔心离左右两端 8",
        kind: "distance",
        a: { face: { kind: "cylinder", extreme: "+X", not: { kind: "cylinder", extreme: "-Y" } } },
        b: { face: { normal: "+X" } },
        expect: 8,
      },
      {
        id: "p-edge-y",
        said: "离前后两边 8",
        kind: "distance",
        a: { face: { kind: "cylinder", extreme: "-X", not: { kind: "cylinder", extreme: "+Y" } } },
        b: { face: { normal: "-Y" } },
        expect: 8,
      },
    ],
    tips: ["先在左前角打一个 ⌀5 孔，它是阵列的种子", "线性阵列可以两个方向一起排：X 向 2 个，Y 向 2 个", "间距 = 板长 − 2×8，X 向 64，Y 向 34"],
    solution: {
      params: { L: 80, W: 50, T: 6, d: 5, e: 8 },
      paramNotes: { L: "板长，沿 X", W: "板宽，沿 Y", T: "板厚", d: "安装孔直径", e: "孔心到板边的距离" },
      features: [
        { id: "sk", op: "sketch", name: "板轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称" },
        { id: "plate", op: "extrude", name: "安装板", sketch: "sk", distance: "T", intent: "往上长出板厚" },
        { id: "h1", op: "hole", name: "种子孔", on: { plane: "XY", face: TOP }, at: [["-L/2+e", "-W/2+e"]], d: "d", intent: "只打左前角一个，作为阵列的种子" },
        {
          id: "pat",
          op: "linear_pattern",
          name: "孔阵列",
          features: ["h1"],
          dir: "+X",
          count: 2,
          spacing: "L-2*e",
          dir2: "+Y",
          count2: 2,
          spacing2: "W-2*e",
          intent: "两个方向各 2 个；间距跟着板长和边距算，改板长孔还在四角",
        },
      ],
    },
  },
  {
    id: "fillet-chamfer-1",
    lesson: "fillet-chamfer",
    title: "竖边圆角，顶边倒角",
    task: "这块料是 60×30×20。四条竖边倒 R5 的圆角，再把顶面一圈倒 1 的倒角。",
    start: blockTree,
    checks: [
      { id: "p-size", said: "60×30×20", kind: "size", expect: [60, 30, 20] },
      { id: "p-fillet", said: "四条竖边倒 R5 的圆角", kind: "holes", faces: { kind: "cylinder" }, count: 4, d: 10 },
      {
        id: "p-chamfer",
        said: "顶面一圈倒 1 的倒角",
        kind: "distance",
        a: { face: TOP },
        b: { edge: { parallel: "X", extreme: "+Y", not: { extreme: "-Z" } } },
        expect: 1,
      },
    ],
    tips: ["四条竖边一次选中，做成一个圆角特征", "先圆角，后倒角：倒角沿着圆角后的那一整圈走", "倒角选顶面的整圈边，圆角那四段弧也要带上"],
    solution: {
      params: { ...blockTree.params, r: 5, c: 1 },
      paramNotes: { ...blockTree.paramNotes, r: "竖边圆角半径", c: "顶面倒角距离" },
      features: [
        ...blockTree.features,
        { id: "fil", op: "fillet", name: "竖边圆角", edges: { of: "base", parallel: "Z", expect: 4 }, r: "r", intent: "四条竖边一次选中，共用一个半径" },
        { id: "cha", op: "chamfer", name: "顶边倒角", edges: { faces: TOP }, d: "c", intent: "顶面一整圈，连同圆角的弧一起倒成等距斜面" },
      ],
    },
  },
  {
    id: "fillet-shell-order-1",
    lesson: "fillet-shell-order",
    title: "把盒子的特征顺序改对",
    task: "这个盒子先抽壳、后倒外圆角，内转角是尖的，转角的壁也被削薄了。调整特征顺序：外圆角 R6、壁厚 2 不变，内转角变成 R4 的圆角。",
    start: { ...boxParams, features: [boxSketch, boxBase, boxShell, boxFillet] },
    checks: [
      { id: "p-outer", said: "外圆角 R6", kind: "holes", faces: { kind: "cylinder", radius: 6 }, count: 4, d: 12 },
      { id: "p-wall", said: "壁厚 2", kind: "thickness", faces: { normal: "+X", extreme: "+X" }, expect: 2 },
      { id: "p-inner", said: "内转角变成 R4 的圆角", kind: "holes", faces: { kind: "cylinder", radius: 4 }, count: 4, d: 8 },
    ],
    tips: ["抽壳会把已有的外圆角一起向内偏移，变成内圆角", "在特征树里把外圆角「上移一步」，放到抽壳前面", "内圆角半径 = 外圆角 R6 − 壁厚 2 = R4"],
    solution: {
      ...boxParams,
      features: [
        boxSketch,
        boxBase,
        { ...boxFillet, intent: "放在抽壳之前：抽壳时外圆角向内偏移成同心的内圆角" },
        boxShell,
      ],
    },
  },
  {
    id: "sweep-loft-1",
    lesson: "sweep-loft",
    title: "方变圆过渡块",
    task: "做一个方变圆的过渡块：底面是 50×50 的正方形，往上 40 是 ⌀30 的圆，用放样连起来；再从顶面往下打一个 ⌀16 的通孔。",
    checks: [
      { id: "p-size", said: "底面是 50×50 的正方形", kind: "size", expect: [50, 50, 40] },
      { id: "p-top", said: "往上 40 是 ⌀30 的圆", kind: "distance", a: { face: { normal: "-Z" } }, b: { edge: { kind: "circle", radius: 15, near: [0, 0, 100] } }, expect: 40 },
      { id: "p-hole", said: "⌀16 的通孔", kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 16 },
    ],
    tips: ["两个截面各画一张草图：正方形在上视基准面，圆在偏移 40 的基准面", "放样按从下到上的顺序选这两张草图", "孔从顶面往下钻，不写深度就是贯穿"],
    solution: {
      params: { a: 50, h: 40, D: 30, d: 16 },
      paramNotes: { a: "底面正方形边长", h: "两个截面之间的高度", D: "顶面圆的直径", d: "中间通孔直径" },
      features: [
        { id: "s1", op: "sketch", name: "底面截面", on: { plane: "XY" }, shapes: [{ type: "rect", w: "a", h: "a" }], intent: "正方形关于原点对称" },
        { id: "s2", op: "sketch", name: "顶面截面", on: { plane: "XY", offset: "h" }, shapes: [{ type: "circle", d: "D" }], intent: "画在偏移 h 的基准面上，改 h 截面跟着走" },
        { id: "lf", op: "loft", name: "方变圆", sketches: ["s1", "s2"], intent: "两个截面之间光滑过渡" },
        { id: "h1", op: "hole", name: "中间通孔", on: { plane: "XY", face: TOP }, at: [[0, 0]], d: "d", intent: "从顶面圆心往下钻穿" },
      ],
    },
  },
  {
    id: "datum-planes-1",
    lesson: "datum-planes",
    title: "打一个斜孔",
    task: "在 60×40×20 的块上打一个 ⌀8 的斜通孔：孔穿过块的正中心，轴线和底面成 60°。",
    checks: [
      { id: "p-size", said: "60×40×20 的块", kind: "size", expect: [60, 40, 20] },
      { id: "p-hole", said: "⌀8 的斜通孔", kind: "holes", faces: { kind: "cylinder" }, count: 1, d: 8 },
      { id: "p-angle", said: "轴线和底面成 60°", kind: "angle", a: { normal: "-Z" }, b: { kind: "cylinder" }, expect: 60 },
    ],
    tips: ["斜孔要一个斜的基准面：上视基准面绕 X 轴转 30°", "孔沿基准面的法向钻，孔口要放在块外面", "先把基准面往上偏移一段再转，孔口就在块外"],
    solution: {
      params: { L: 60, W: 40, H: 20, d: 8, a: 30, lift: 40 },
      paramNotes: {
        L: "长，沿 X",
        W: "宽，沿 Y",
        H: "高，沿 Z",
        d: "斜孔直径",
        a: "斜基准面绕 X 轴转的角度，也是孔轴线偏离竖直的角度",
        lift: "斜基准面沿法向抬起的距离，让孔口落在块外面",
      },
      features: [
        { id: "sk", op: "sketch", name: "块轮廓", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }], intent: "矩形关于原点对称" },
        { id: "base", op: "extrude", name: "块", sketch: "sk", distance: "H", intent: "往上长出块高" },
        {
          id: "h1",
          op: "hole",
          name: "斜孔",
          on: { plane: "XY", offset: "lift", tilt: { axis: "X", angle: "a" } },
          at: [[0, "H/2*sin(a)"]],
          d: "d",
          intent: "孔口在绕 X 轴转 a 的斜基准面上，孔沿它的法向钻穿；孔心偏 H/2·sin(a)，轴线正好过块的中心",
        },
      ],
    },
  },
  {
    id: "print-overhang-1",
    lesson: "print-overhang",
    title: "去掉悬空的平底面",
    task: "这个 50×20×60 的支架立着打印时，横梁的平底面悬空，要加支撑。在横梁下面加一道 45° 的斜撑，外形不变，除了底面不再有朝下的平面。",
    start: { ...bracketParams, features: bracketFeatures },
    checks: [
      { id: "p-size", said: "外形不变", kind: "size", expect: [50, 20, 60] },
      {
        id: "p-down",
        said: "除了底面不再有朝下的平面",
        kind: "distance",
        a: { face: { normal: "-Z", extreme: "+Z" } },
        b: { face: { normal: "-Z", extreme: "-Z" } },
        expect: 0,
      },
      { id: "p-slope", said: "45° 的斜撑", kind: "angle", a: TOP, b: { kind: "plane", near: [35, 0, 25] }, expect: 45 },
    ],
    tips: ["朝下的水平面悬垂角是 90°，超过 45° 就要支撑", "在前视基准面上画一个直角三角形，两条直角边都是 30", "两侧对称拉伸 20，和立柱一样宽"],
    solution: {
      ...bracketParams,
      features: [
        ...bracketFeatures,
        {
          id: "gus_s",
          op: "sketch",
          name: "斜撑截面",
          on: { plane: "XZ" },
          shapes: [{ type: "polyline", points: [["a/2", "H-t"], ["a/2+arm", "H-t"], ["a/2", "H-t-arm"]] }],
          intent: "直角边都等于横梁伸出的长度，斜边正好 45°，盖住整个横梁底面",
        },
        { id: "gus", op: "extrude", name: "斜撑", sketch: "gus_s", distance: "a", direction: "both", intent: "两侧对称，和立柱一样宽" },
      ],
    },
  },
]

export const practiceFor = (lesson: string) => PRACTICE.filter((p) => p.lesson === lesson)
export const practiceById = (id: string) => PRACTICE.find((p) => p.id === id)
