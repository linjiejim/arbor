"""小盒子 A（先圆角后抽壳）: sketch → extrude → fillet → shell.

Twin of ``box_shell_first``: the same 60 × 40 × 30 open box with the same
feature ids, only the order of the fillet and the shell is swapped. Here the
shell offsets the outer fillets inwards, so the inner corners come out
rounded with radius ``r − t`` and the wall is the same everywhere. When the
fillet equals the wall the inner radius is zero and the kernel fails.
"""

from build123d import Axis, Plane, Rectangle, extrude, fillet, offset

from turnerybake import Dim, Feature, Param, PartModel

L, W, H = 60.0, 40.0, 30.0

MODEL = PartModel(
    id="box_fillet_first",
    title="小盒子 A：先圆角后抽壳",
    subtitle="圆角先后对比 · 同一个盒子的两种做法",
    level="入门",
    teaches=["特征顺序决定结果", "抽壳会偏移圆角", "内外圆角同心，壁厚均匀"],
    params=[
        Param("L", "长", "mm", L, feature="sk1"),
        Param("W", "宽", "mm", W, feature="sk1"),
        Param("H", "高", "mm", H, feature="ext1"),
        Param("r", "外圆角", "mm", 4, [2, 4, 6, 8], feature="fil1"),
        Param("t", "壁厚", "mm", 2.5, [1.5, 2.5, 4], feature="shell1"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "底面矩形",
            why="两种做法从同一张草图开始：一个 60 × 40 的矩形，画在上视基准面上，中心在原点。",
            summary="上视基准面 · {L} × {W}",
            view=(0, 0, 1),
        ),
        Feature(
            "ext1", "extrude", "拉伸1", "实心盒体",
            why="拉伸成一块实心的料。到这里 A 和 B 完全一样，分歧从下一步开始。",
            summary="高 {H}",
        ),
        Feature(
            "fil1", "fillet", "圆角1", "外圆角",
            why="做法 A 先在实心块上倒圆角：四条竖边和底面四条边，顶面那圈留着做开口。实心块上倒圆角最简单，不用担心壁厚。",
            summary="R{r} · 竖边 + 底边，共 8 条",
            pitfall="这一步的半径决定了下一步抽壳能不能成功：它必须比壁厚大。",
            view=(1, -1.1, -0.6),
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空盒体",
            why="抽壳把每个面向内偏移一个壁厚，外圆角也被偏移成一个同心的内圆角，半径是「r − t」。所以 A 的内角是圆的，转角处的壁厚和平面处一样。对比做法 B：B 的内角是尖的，转角处的壁更薄。",
            summary="壁厚 {t} · 移除顶面",
            pitfall="圆角正好等于壁厚时，内圆角半径为零，抽壳失败。圆角比壁厚小时，内角又变回尖角。",
            view=(0.8, -1, 1.6),
        ),
    ],
    failures={
        "shell1": "外圆角等于壁厚：抽壳要把 R 圆角向内偏移出一个半径为「圆角 − 壁厚」的内圆角，半径正好为零时内核算不出来。让圆角明显大于壁厚，内角是同心圆角；明显小于壁厚，内角是尖角。",
    },
)


def build(p, r):
    # @step sk1
    outline = Rectangle(p["L"], p["W"])
    r.sketch(
        "sk1", outline, Plane.XY, size=p["L"] * 1.6, plane_name="上视基准面",
        dims=[
            Dim((-p["L"] / 2, -p["W"] / 2, 0), (p["L"] / 2, -p["W"] / 2, 0), (0, -1, 0), 8, f"{p['L']:g}"),
            Dim((p["L"] / 2, -p["W"] / 2, 0), (p["L"] / 2, p["W"] / 2, 0), (1, 0, 0), 8, f"{p['W']:g}"),
        ],
    )

    # @step ext1
    box = extrude(outline, amount=p["H"])
    r.solid("ext1", box)

    # @step fil1
    top_rim = box.edges().group_by(Axis.Z)[-1]
    box = fillet(box.edges() - top_rim, radius=p["r"])  # 竖边 + 底边
    r.solid("fil1", box)

    # @step shell1
    top = box.faces().sort_by(Axis.Z)[-1]
    solid_volume = box.volume  # hide
    box = offset(box, amount=-p["t"], openings=top)
    r.check("shell1", box.volume < 0.6 * solid_volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", box)
    return box
