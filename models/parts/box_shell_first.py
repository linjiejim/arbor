"""小盒子 B（先抽壳后圆角）: sketch → extrude → shell → fillet.

Twin of ``box_fillet_first``: the same box and the same feature ids, with the
shell and the fillet swapped. The shell runs on a sharp block, so the inner
corners stay sharp; the fillet afterwards only rounds the outside, and the
wall gets thinner at every corner. A large fillet on a thin wall eats through
the corner: the kernel either refuses, or hands back a self-intersecting
solid that only a self-intersection check catches.
"""

from build123d import Axis, Plane, Rectangle, SortBy, extrude, fillet, offset
from OCP.BRepAlgoAPI import BRepAlgoAPI_Check

from ftbake import Dim, Feature, Param, PartModel

L, W, H = 60.0, 40.0, 30.0


def self_intersecting(shape) -> bool:
    """OCCT's boolean argument check: catches faces that pass through each other."""
    return not BRepAlgoAPI_Check(shape.wrapped, True, True).IsValid()


MODEL = PartModel(
    id="box_shell_first",
    title="小盒子 B：先抽壳后圆角",
    subtitle="圆角先后对比 · 同一个盒子的两种做法",
    level="入门",
    teaches=["特征顺序决定结果", "后倒圆角只圆外面", "转角处壁厚变薄"],
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
            "shell1", "shell", "抽壳1", "掏空盒体",
            why="做法 B 先抽壳。这时盒子的边都是尖的，所以内腔的角也是尖的。对比做法 A：A 先倒了圆角，抽壳后内角是同心的圆角。",
            summary="壁厚 {t} · 移除顶面",
            view=(0.8, -1, 1.6),
        ),
        Feature(
            "fil1", "fillet", "圆角1", "外圆角",
            why="再给外面的四条竖边和底面四条边倒圆角。内角还是尖的，转角处的壁比平面处薄：竖边处只剩「r − 1.41 × (r − t)」，底部三边交汇的角只剩「r − 1.73 × (r − t)」。A 没有这个问题，它的壁厚处处相同。",
            summary="R{r} · 外侧竖边 + 底边，共 8 条",
            pitfall="圆角越大、壁越薄，转角越容易被吃穿。注塑件转角变薄还会缩水、开裂，所以外圆角通常放在抽壳之前。",
            view=(1, -1.1, -0.6),
        ),
    ],
    failures={
        "fil1": "外圆角把转角处的壁吃穿了。壁很薄时内核直接拒绝；差一点点吃穿时，内核会给出一个看起来正常、其实内外表面互相穿过的实体，只有自相交检查能发现。减小圆角，加厚壁，或者改用做法 A：先圆角再抽壳。",
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

    # @step shell1
    top = box.faces().sort_by(Axis.Z)[-1]
    solid_volume = box.volume  # hide
    box = offset(box, amount=-p["t"], openings=top)
    r.check("shell1", box.volume < 0.6 * solid_volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", box)

    # @step fil1
    bottom = box.edges().group_by(Axis.Z)[0]  # 外底面的四条边
    corners = box.edges().filter_by(Axis.Z).group_by(SortBy.DISTANCE)[-1]  # 最外侧的四条竖边
    box = fillet(bottom + corners, radius=p["r"])
    r.check("fil1", not self_intersecting(box), "转角处的壁被圆角吃穿：内核给出了自相交的实体")
    r.solid("fil1", box)
    return box
