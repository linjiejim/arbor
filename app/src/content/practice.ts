/**
 * Practice data that is not derivable from the baked manifests.
 *
 * Feature-order rules: `hard` means the later feature cannot exist without
 * the earlier one (a rebuild error); otherwise it is design intent (it would
 * build, but worse). The feature-order exercise checks a learner's order
 * against these and explains every violation.
 */
export type OrderRule = { before: string; after: string; hard: boolean; why: string }

export const ORDER_RULES: Record<string, OrderRule[]> = {
  mug: [
    { before: "sk1", after: "rev1", hard: true, why: "旋转需要一个截面草图。" },
    { before: "rev1", after: "fil1", hard: true, why: "圆角要倒在已有的边上，先得有杯身。" },
    { before: "rev1", after: "shell1", hard: true, why: "抽壳需要一个实体。" },
    { before: "fil1", after: "shell1", hard: false, why: "先圆角再抽壳：抽壳会把外圆角偏移成同心的内圆角，转角处的壁厚和别处一样。反过来，内侧会是尖角。" },
    { before: "shell1", after: "fil2", hard: true, why: "杯口内外两条边是抽壳打开顶面之后才出现的。" },
    { before: "sk2", after: "sk3", hard: true, why: "截面画在路径起点的法平面上，先要有路径。" },
    { before: "sk2", after: "sweep1", hard: true, why: "扫掠需要路径。" },
    { before: "sk3", after: "sweep1", hard: true, why: "扫掠需要截面。" },
    { before: "shell1", after: "sweep1", hard: false, why: "先抽壳再加把手：如果把手先合并进来，抽壳会把把手也掏空。" },
    { before: "fil2", after: "sweep1", hard: false, why: "杯口圆角只依赖杯身，放在把手前面，以后改把手不会碰到它。" },
    { before: "sweep1", after: "fil3", hard: true, why: "根部圆角倒在把手和杯身的交线上，这条线在合并之后才有。" },
  ],
  box_fillet_first: [
    { before: "sk1", after: "ext1", hard: true, why: "拉伸需要草图轮廓。" },
    { before: "ext1", after: "fil1", hard: true, why: "圆角要倒在已有的边上。" },
    { before: "ext1", after: "shell1", hard: true, why: "抽壳需要实体。" },
    { before: "fil1", after: "shell1", hard: false, why: "先圆角再抽壳，内角跟着变圆，壁厚处处一样。" },
  ],
  brick: [
    { before: "sk1", after: "ext1", hard: true, why: "拉伸需要草图轮廓。" },
    { before: "ext1", after: "shell1", hard: true, why: "抽壳需要实体。" },
    { before: "ext1", after: "boss1", hard: true, why: "凸点长在砖体顶面上，先得有顶面。" },
    { before: "boss1", after: "pat1", hard: true, why: "阵列复制的是第一个凸点，先要有它。" },
    { before: "shell1", after: "tube1", hard: true, why: "底管长在抽壳后的空腔里，顶在内顶面上。" },
    { before: "shell1", after: "boss1", hard: false, why: "先抽壳再加凸点：如果先加凸点，抽壳会把凸点也一起掏空。" },
    { before: "pat1", after: "fil1", hard: false, why: "圆角放最后：先给一个凸点倒圆角再阵列也行，但改凸点数量时圆角最好不依赖阵列前的边。" },
  ],
  enclosure_bottom: [
    { before: "sk1", after: "ext1", hard: true, why: "拉伸需要草图轮廓。" },
    { before: "ext1", after: "dft1", hard: true, why: "拔模作用在已有的侧壁上。" },
    { before: "dft1", after: "shell1", hard: false, why: "先拔模再抽壳：抽壳会把带斜度的外壁偏移成同样斜度的内壁，壁厚保持均匀。" },
    { before: "ext1", after: "shell1", hard: true, why: "抽壳需要实体。" },
    { before: "shell1", after: "boss1", hard: true, why: "螺丝柱从抽壳后的底板上长起来。" },
    { before: "boss1", after: "rib1", hard: true, why: "加强筋把螺丝柱连到侧壁，先得有螺丝柱。" },
    { before: "boss1", after: "hole1", hard: true, why: "过孔打在螺丝柱的位置上，穿过柱子和底板。" },
    { before: "rib1", after: "fil1", hard: false, why: "柱根圆角最后倒：它引用螺丝柱、筋和底板相交的边。" },
  ],
  gear: [
    { before: "sk1", after: "ext1", hard: true, why: "拉伸需要齿根圆草图。" },
    { before: "ext1", after: "sk2", hard: false, why: "齿形草图画在齿根圆柱的顶面上，引用它的位置。" },
    { before: "sk2", after: "ext2", hard: true, why: "拉伸需要齿形草图。" },
    { before: "ext2", after: "pat1", hard: true, why: "圆周阵列复制的是第一个齿。" },
    { before: "ext1", after: "hole1", hard: true, why: "轴孔打在齿轮本体上。" },
    { before: "pat1", after: "cha1", hard: false, why: "倒角放最后：它要倒在每个齿的齿顶边上，阵列之后才齐全。" },
  ],
  keycap: [
    { before: "sk1", after: "loft1", hard: true, why: "放样需要底面轮廓。" },
    { before: "sk2", after: "loft1", hard: true, why: "放样需要顶面轮廓。" },
    { before: "loft1", after: "cut1", hard: true, why: "碟面是从键帽顶面切下去的。" },
    { before: "cut1", after: "shell1", hard: false, why: "先切碟面再抽壳：抽壳会让碟面下方的顶板也保持均匀厚度。" },
    { before: "shell1", after: "ext1", hard: true, why: "十字轴座长在抽壳后的内腔里，顶到内顶面为止。" },
    { before: "sk3", after: "ext1", hard: true, why: "轴座需要截面草图。" },
    { before: "ext1", after: "fil1", hard: false, why: "圆角放最后，前面改什么都不容易让它断。" },
  ],
}
