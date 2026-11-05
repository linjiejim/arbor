import type { LessonMeta } from "./types"

/**
 * Every interactive lesson, in curriculum order. Lessons load on demand so
 * each one's scene code stays out of the main bundle.
 */
export const LESSONS: LessonMeta[] = [
  // ---------------------------------------------------------------- T0 公共地基
  {
    id: "coordinates",
    codes: ["0.1.1", "0.1.2"],
    title: "坐标系与视图",
    track: "T0",
    minutes: 7,
    gist: "X/Y/Z 与右手定则，旋转、平移、缩放，用视图方块找面，以及 Z 朝上和 Y 朝上的区别。",
    load: () => import("./coordinates"),
  },
  {
    id: "datum-planes",
    codes: ["0.1.3"],
    title: "基准面：一切几何的参照",
    track: "T0",
    minutes: 7,
    gist: "三个默认基准面，偏移、角度、中面三种建法，草图为什么要挂在基准面上。",
    load: () => import("./datum-planes"),
  },
  {
    id: "projection",
    codes: ["0.2.1", "0.2.2"],
    title: "正投影：三视图与第一角、第三角",
    track: "T0",
    minutes: 8,
    gist: "玻璃盒里投影、虚线、展开成三视图，长对正高平齐宽相等，第一角与第三角及投影符号。",
    load: () => import("./projection"),
  },
  {
    id: "section-views",
    codes: ["0.2.3"],
    title: "剖视：把零件切开看",
    track: "T0",
    minutes: 6,
    gist: "拖动剖切平面切开零件，剖面形状、剖在中心线上、45° 剖面线，以及剖在哪就表达哪。",
    load: () => import("./section-views"),
  },
  // ---------------------------------------------------------------- T1 参数化零件
  {
    id: "sketch-to-solid",
    codes: ["1.1.1", "1.1.3", "1.2.1"],
    title: "从草图到实体",
    track: "T1",
    minutes: 8,
    gist: "基准面、草图、约束与自由度、拉伸，以及改上游时下游怎样跟着变。",
    load: () => import("./sketch-to-solid"),
  },
  {
    id: "constraints-dof",
    codes: ["1.1.2", "1.1.3"],
    title: "几何约束与自由度",
    track: "T1",
    minutes: 8,
    gist: "用 FreeCAD 求解器实时数自由度：几何约束、尺寸、完全定义与过定义（冗余 / 冲突），同一形状的三种约束方案。",
    load: () => import("./constraints-dof"),
  },
  {
    id: "revolve",
    codes: ["1.2.2"],
    title: "旋转：半截面绕轴转一圈",
    track: "T1",
    minutes: 6,
    gist: "回转体只画半截面；角度、轴的位置，以及轮廓越过轴为什么会失败。",
    load: () => import("./revolve"),
  },
  {
    id: "pattern-mirror",
    codes: ["1.2.5"],
    title: "阵列与镜像",
    track: "T1",
    minutes: 7,
    gist: "种子特征按规则复制：线性阵列的间距驱动与总长驱动、圆周阵列的等分规则、只建一半再镜像。",
    load: () => import("./pattern-mirror"),
  },
  {
    id: "fillet-chamfer",
    codes: ["1.2.6"],
    title: "圆角与倒角",
    track: "T1",
    minutes: 8,
    gist: "选边做圆角和倒角；半径为什么有上限；圆角相切（G1）与倒角折角（G0）；圆角为什么放最后。",
    load: () => import("./fillet-chamfer"),
  },
  {
    id: "fillet-shell-order",
    codes: ["1.2.7", "1.3.4"],
    title: "先圆角，还是先抽壳",
    track: "T1",
    minutes: 7,
    gist: "同一个盒子两种特征顺序：剖开看转角壁厚，换参数看谁先失败。几何来自真实内核。",
    load: () => import("./fillet-shell-order"),
  },
  {
    id: "sweep-loft",
    codes: ["1.2.8"],
    title: "扫掠与放样",
    track: "T1",
    minutes: 8,
    gist: "截面沿路径扫掠、弯太急为什么自交；截面之间放样、起点不对齐为什么会扭、引导线怎么管住中间。",
    load: () => import("./sweep-loft"),
  },
  {
    id: "feature-tree",
    codes: ["1.3.1", "1.3.2", "1.3.3"],
    title: "特征树、父子关系与拓扑命名",
    track: "T1",
    minutes: 8,
    gist: "特征树是按顺序重算的程序：回滚、父子引用、删圆角后倒角报错，以及边被重新编号的拓扑命名问题。",
    load: () => import("./feature-tree"),
  },
  // ---------------------------------------------------------------- T2 装配与机构
  {
    id: "assembly-dof",
    codes: ["2.1.2", "2.1.3", "2.1.4"],
    title: "零件的 6 个自由度与配合",
    track: "T2",
    minutes: 7,
    gist: "刚体的 6 个自由度，同心、重合、角度配合各去掉哪些，以及冗余配合为什么会变成过定义。",
    load: () => import("./assembly-dof"),
  },
  // ---------------------------------------------------------------- T4 DFM
  {
    id: "print-overhang",
    codes: ["4.1.1", "4.1.2"],
    title: "3D 打印：悬垂与摆放方向",
    track: "T4",
    minutes: 7,
    gist: "悬垂角与 45° 规则、转动摆放方向省掉支撑、层间强度最弱，以及在设计里用斜面代替悬空面。",
    load: () => import("./print-overhang"),
  },
  {
    id: "sheet-metal-bend",
    codes: ["4.3.1", "4.3.2", "4.3.3"],
    title: "钣金：折弯、K 因子与展开",
    track: "T4",
    minutes: 8,
    gist: "中性层与 K 因子，折弯余量 BA 和展开长，展开图上的折弯线，释放槽与最小法兰。",
    load: () => import("./sheet-metal-bend"),
  },
  {
    id: "draft-analysis",
    codes: ["4.4.1", "4.4.2", "4.4.3"],
    title: "注塑：拔模与分型线",
    track: "T4",
    minutes: 9,
    gist: "开模方向、拔模分析着色、纹理要更大的拔模、分型线、侧孔倒扣与滑块，以及均匀壁厚。",
    load: () => import("./draft-analysis"),
  },
  // ---------------------------------------------------------------- T5 曲线曲面
  {
    id: "curvature-continuity",
    codes: ["5.1.3", "5.1.4", "5.1.5"],
    title: "曲率梳与 G0 / G1 / G2 连续",
    track: "T5",
    minutes: 8,
    gist: "读曲率梳，拖控制点做出 G0、G1、G2，再看圆角矩形的圆弧为什么只有 G1。",
    load: () => import("./curvature-continuity"),
  },
  {
    id: "zebra-stripes",
    codes: ["5.3.1", "5.3.3"],
    title: "斑马纹：用反光看曲面质量",
    track: "T5",
    minutes: 6,
    gist: "斑马纹断开、拐折、顺滑分别对应 G0、G1、G2；盲测找出 G2，理解圆角和混接的高光差别。",
    load: () => import("./zebra-stripes"),
  },
]

export const lessonMeta = (id: string | undefined) => LESSONS.find((l) => l.id === id)

/** Curriculum id → lesson that teaches it. */
export const lessonForCode = (code: string) => LESSONS.find((l) => l.codes.includes(code))
