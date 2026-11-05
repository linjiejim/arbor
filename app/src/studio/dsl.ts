import { z } from "zod"

/**
 * The studio's model: a parameter table plus an ordered feature tree, as plain
 * JSON. The AI edits it only through tools whose inputs are these schemas; the
 * kernel rebuilds it deterministically.
 *
 * Conventions (also in the system prompt): Z up, millimetres, degrees, origin
 * at the centre of the part's base.
 */

/** A number (mm or degrees) or a parameter expression such as "L/2+3" (rule stated once in the system prompt). */
export const Num = z.union([z.number(), z.string()])
// Plain fixed-length arrays rather than tuples: simpler JSON Schema for every provider.
export const Vec2 = z.array(Num).length(2).describe("[x, y]")
export const Vec3 = z.array(Num).length(3).describe("[x, y, z]")
export const Axis = z.enum(["X", "Y", "Z"])
export const Dir = z.enum(["+X", "-X", "+Y", "-Y", "+Z", "-Z"])
export const SurfaceKind = z.enum(["plane", "cylinder", "cone", "sphere", "torus", "freeform"])
export const CurveKind = z.enum(["line", "circle", "freeform"])
export const PlaneName = z.enum(["XY", "XZ", "YZ"])

const AtCoord = z
  .object({ axis: Axis, value: Num })
  .describe('中心落在这个坐标上，例如 { "axis": "Z", "value": "H" }')

const faceFields = {
  of: z.string().optional().describe("只选这个特征生成、且现在仍存在的面（特征 id）"),
  normal: Dir.optional().describe("平面的外法向"),
  kind: SurfaceKind.optional(),
  extreme: Dir.optional().describe('沿这个方向最靠外的面，例如 "+Z" = 最上面的面'),
  at: AtCoord.optional(),
  radius: Num.optional().describe("圆柱面、圆锥面或球面的半径"),
  near: Vec3.optional().describe("只保留离这个点最近的一个"),
}
const FaceBase = z.object(faceFields)

export const FaceSelector = z
  .object({
    ...faceFields,
    not: FaceBase.optional().describe("从结果里去掉满足这些条件的面"),
    expect: z.number().int().positive().optional().describe("预期选中几个；数量不符时报错并列出候选"),
  })
  .describe("按语义选面：所有条件同时满足。每次重建都重新解析，不依赖编号")

const edgeFields = {
  of: z.string().optional().describe("只选这个特征生成的面上的边（特征 id）"),
  faces: FaceSelector.optional().describe("只选这些面的边界边"),
  parallel: Axis.optional().describe("平行于这个轴的直线边"),
  kind: CurveKind.optional(),
  extreme: Dir.optional().describe('沿这个方向最靠外的边，例如 "+Z" = 最上面一圈边'),
  at: AtCoord.optional(),
  radius: Num.optional().describe("圆弧边的半径"),
  near: Vec3.optional().describe("只保留离这个点最近的一条"),
}
const EdgeBase = z.object(edgeFields)

export const EdgeSelector = z
  .object({
    ...edgeFields,
    not: EdgeBase.optional().describe('从结果里去掉满足这些条件的边，例如 { "extreme": "+Z" } = 除了最上面一圈'),
    expect: z.number().int().positive().optional().describe("预期选中几条；数量不符时报错并列出候选"),
  })
  .describe("按语义选边：所有条件同时满足。每次重建都重新解析，不依赖编号")

export const PlaneRef = z
  .object({
    plane: PlaneName.describe(
      "XY = 上视基准面（草图 x→X, y→Y，法向 +Z）；XZ = 前视基准面（x→X, y→Z，法向 -Y）；YZ = 右视基准面（x→Y, y→Z，法向 +X）",
    ),
    offset: Num.optional().describe("沿该基准面的坐标轴平移：XY 为 Z 值、XZ 为 Y 值、YZ 为 X 值"),
    face: FaceSelector.optional().describe("贴在这个平面上（必须与 plane 平行），offset 从该面再算"),
  })
  .describe("草图平面")

const Center = Vec2.optional().describe("中心，草图坐标，缺省 [0, 0]")
const Cut = z.boolean().optional().describe("从本草图前面的图形里挖掉（做出内孔）")

export const SketchShape = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    w: Num.describe("宽（草图 x 方向）"),
    h: Num.describe("高（草图 y 方向）"),
    center: Center,
    r: Num.optional().describe("四角圆角半径"),
    cut: Cut,
  }),
  z.object({ type: z.literal("circle"), d: Num.describe("直径"), center: Center, cut: Cut }),
  z.object({
    type: z.literal("polygon"),
    sides: Num.describe("边数（≥3 的整数，可以写参数）"),
    d: Num.describe("外接圆直径"),
    center: Center,
    rotate: Num.optional(),
    cut: Cut,
  }),
  z.object({
    type: z.literal("slot"),
    length: Num.describe("总长（两端圆弧外缘之间）"),
    width: Num.describe("宽 = 两端圆弧直径"),
    center: Center,
    angle: Num.optional().describe("相对草图 x 轴的角度"),
    cut: Cut,
  }),
  z.object({
    type: z.literal("polyline"),
    points: z
      .array(z.union([Vec2, z.object({ to: Vec2, via: Vec2.describe("圆弧经过的中间点") })]))
      .min(2)
      .describe("依次连接并自动闭合；{to, via} 表示三点圆弧"),
    cut: Cut,
  }),
])

const Base = {
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).describe('特征 id，英文，例如 "base", "pocket1"'),
  name: z.string().optional().describe('中文显示名，例如 "底座拉伸"'),
  intent: z.string().optional().describe("一句话设计意图：为什么这样做"),
}
const Mode = z.enum(["add", "cut"]).optional().describe("add = 加料（默认），cut = 切除")

export const Feature = z.discriminatedUnion("op", [
  z.object({ ...Base, op: z.literal("sketch"), on: PlaneRef, shapes: z.array(SketchShape).min(1) }),
  z.object({
    ...Base,
    op: z.literal("extrude"),
    sketch: z.string().describe("草图特征 id"),
    distance: Num,
    mode: Mode,
    direction: z.enum(["normal", "reverse", "both"]).optional().describe("normal = 沿草图法向（默认），reverse = 反向，both = 两侧对称"),
    through: z.boolean().optional().describe("切除时贯穿全部（忽略 distance）"),
  }),
  z.object({
    ...Base,
    op: z.literal("revolve"),
    sketch: z.string(),
    axis: Axis.describe("绕过原点的这根坐标轴旋转"),
    angle: Num.optional().describe("角度，缺省 360"),
    mode: Mode,
  }),
  z.object({ ...Base, op: z.literal("fillet"), edges: EdgeSelector, r: Num.describe("圆角半径") }),
  z.object({ ...Base, op: z.literal("chamfer"), edges: EdgeSelector, d: Num.describe("倒角距离") }),
  z.object({
    ...Base,
    op: z.literal("shell"),
    open: FaceSelector.describe("要去掉（开口）的面"),
    t: Num.describe("壁厚，向内"),
  }),
  z.object({
    ...Base,
    op: z.literal("hole"),
    on: PlaneRef.describe("孔口所在平面，孔沿法向的反方向钻进去"),
    at: z.array(Vec2).min(1).describe("孔中心，草图坐标"),
    d: Num.describe("孔径"),
    depth: Num.optional().describe("孔深，缺省贯穿"),
    cbore: z.object({ d: Num, depth: Num }).optional().describe("沉头孔（柱形沉孔）"),
    csink: z.object({ d: Num, angle: Num.optional() }).optional().describe("埋头孔（锥形，缺省 90°）"),
    reverse: z.boolean().optional().describe("沿法向钻（反过来）"),
  }),
  z.object({
    ...Base,
    op: z.literal("linear_pattern"),
    features: z.array(z.string()).min(1).describe("要复制的加料/切除/孔特征 id"),
    dir: Dir,
    count: Num.describe("总个数（含原来那个），≥2 的整数，可以写参数"),
    spacing: Num,
    dir2: Dir.optional(),
    count2: Num.optional().describe("第二方向的个数"),
    spacing2: Num.optional(),
  }),
  z.object({
    ...Base,
    op: z.literal("circular_pattern"),
    features: z.array(z.string()).min(1),
    axis: Axis.describe("绕过原点的这根轴"),
    count: Num.describe("总个数（含原来那个），≥2 的整数，可以写参数"),
    angle: Num.optional().describe("总角度，缺省 360（等分整圈）"),
  }),
  z.object({
    ...Base,
    op: z.literal("sweep"),
    path: z
      .object({
        on: PlaneRef.describe("路径所在的平面"),
        points: z.array(z.union([Vec2, z.object({ to: Vec2, via: Vec2 })])).min(2).describe("路径点（不闭合）；{to, via} 是三点圆弧"),
        corner: Num.optional().describe("直线拐角处自动倒的圆角半径（路径不能有尖角，否则截面会自交）"),
      })
      .describe("扫掠路径"),
    profile: z
      .discriminatedUnion("type", [
        z.object({ type: z.literal("circle"), d: Num }),
        z.object({ type: z.literal("rect"), w: Num.describe("在路径平面内的宽"), h: Num.describe("垂直于路径平面的高") }),
      ])
      .describe("截面：放在路径起点、垂直于路径"),
    mode: Mode,
  }),
  z.object({
    ...Base,
    op: z.literal("loft"),
    sketches: z.array(z.string()).min(2).describe("按顺序连接的草图（每个只能有一个闭合轮廓，通常画在一组平行的偏移平面上）"),
    ruled: z.boolean().optional().describe("true = 截面之间用直纹面（棱角分明），缺省光滑过渡"),
    mode: Mode,
  }),
  z.object({
    ...Base,
    op: z.literal("draft"),
    faces: FaceSelector.describe("要加拔模角的面（通常是侧壁）"),
    angle: Num.describe("拔模角，度；正值让侧壁朝开模方向向内收"),
    neutral: z.object({ plane: PlaneName, offset: Num.optional() }).describe("中性面：这里的尺寸保持不变，通常是分型面或底面"),
  }),
  z.object({
    ...Base,
    op: z.literal("mirror"),
    plane: PlaneName,
    offset: Num.optional(),
    features: z.array(z.string()).optional().describe("要镜像的加料/切除/孔特征；缺省镜像整个实体"),
  }),
])

export type Feature = z.infer<typeof Feature>
export type FeatureOp = Feature["op"]
export type FaceSelector = z.infer<typeof FaceSelector>
export type EdgeSelector = z.infer<typeof EdgeSelector>
export type PlaneRef = z.infer<typeof PlaneRef>
export type SketchShape = z.infer<typeof SketchShape>

export const Tree = z.object({
  params: z.record(z.string(), Num),
  features: z.array(Feature),
})
export type Tree = z.infer<typeof Tree>

export const EMPTY_TREE: Tree = { params: {}, features: [] }

/** Chinese op names as used across the site (ops.ts). */
export const OP_NAMES: Record<FeatureOp, string> = {
  sketch: "草图",
  extrude: "拉伸",
  revolve: "旋转",
  fillet: "圆角",
  chamfer: "倒角",
  shell: "抽壳",
  hole: "孔",
  linear_pattern: "线性阵列",
  circular_pattern: "圆周阵列",
  mirror: "镜像",
  sweep: "扫掠",
  loft: "放样",
  draft: "拔模",
}

/** Display name: the model's own name, else 「拉伸2」 style numbering. */
export function displayName(tree: Tree, f: Feature) {
  if (f.name) return f.name
  const same = tree.features.filter((x) => x.op === f.op)
  return `${OP_NAMES[f.op]}${same.indexOf(f) + 1}`
}

/** Features that add or remove material through a tool body (patternable). */
export const TOOL_OPS: FeatureOp[] = ["extrude", "revolve", "hole", "sweep", "loft"]
