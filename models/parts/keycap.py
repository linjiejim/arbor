"""机械键盘键帽 (1u): two sketches → loft → spherical dish → shell (open
bottom) → cross stem sketch → bounded extrude up into the top → top fillets.

The teaching points are DFM ones: the lofted sides already slope like a
draft, the shell keeps the top as thick as the skirt, and the stem is a
boss that grows from below until it fuses with the underside of the top.
"""

from math import sqrt

from build123d import (
    Axis,
    Circle,
    GeomType,
    Plane,
    Pos,
    Rectangle,
    Rot,
    Sphere,
    extrude,
    fillet,
    loft,
    offset,
)

from turnerybake import Dim, Feature, Param, PartModel

DISH = 11.0  # 碟面在顶面上的直径，固定不变
STEM_Z0 = 1.0  # 轴座底面离裙边底面的高度
OVERLAP = 0.3  # 轴座多伸进顶板的量，保证和顶板长成一体

MODEL = PartModel(
    id="keycap",
    title="机械键盘键帽",
    subtitle="放样 · 球面切除 · 抽壳 · 十字轴座",
    level="进阶",
    teaches=["放样出斜面，顺带拔模", "球面碟的深度由半径决定", "抽壳让顶板和裙边一样厚", "轴座拉伸到顶板下表面"],
    params=[
        Param("B", "底面边长", "mm", 18, feature="sk1"),
        Param("TX", "顶面长", "mm", 12.5, feature="sk2"),
        Param("TY", "顶面宽", "mm", 14, feature="sk2"),
        Param("H", "高度", "mm", 8, feature="sk2"),
        Param("R", "碟面球半径", "mm", 35, [25, 35, 50], feature="cut1"),
        Param("t", "壁厚", "mm", 1.5, [1.0, 1.5], feature="shell1"),
        Param("ds", "轴座外径", "mm", 5.5, feature="sk3"),
        Param("rf", "顶边圆角", "mm", 0.6, feature="fil1"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "底面轮廓",
            why="键帽的底面是一个 18 × 18 的正方形，这是 1u 键位 19.05 的节距减去两侧的缝。",
            summary="上视基准面 · {B} × {B}",
            view=(0, 0, 1),
        ),
        Feature(
            "sk2", "sketch", "草图2", "顶面轮廓",
            why="顶面画在离底面 8 mm 的基准面上，比底面小一圈。两张草图一大一小，下一步放样把它们连起来。",
            summary="基准面1（高 {H}）· {TX} × {TY}",
            view=(0.6, -1, 0.6),
        ),
        Feature(
            "loft1", "loft", "放样1", "键帽外形",
            why="放样把底面和顶面连成四个斜面。斜面本身就是很大的拔模角：键帽从模具里顶出来时，侧面不会和模具摩擦。",
            summary="草图1 → 草图2 · 直纹",
            pitfall="两张草图的顶点数要一样多，否则放样会扭成麻花。",
        ),
        Feature(
            "cut1", "cut", "切除1", "球面碟",
            why="用一个大球从顶面切出浅浅的碟，手指按下去刚好落在中间。碟口的直径固定为 11，球半径越大，碟越浅：R25 深 0.6，R50 只有 0.3。",
            summary="球面 R{R} · 碟口 Ø11",
            pitfall="球的极点不能落在碟的正中心。极点处曲面退化，后面的抽壳会失败，所以先把球转 90°，让极点躺到侧面去。",
            view=(0.5, -1, 1.6),
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空键帽",
            why="从底面打开抽壳，顶板跟着球面一起向下偏移，碟面下面的顶板也是均匀的一个壁厚。注塑件最怕厚薄不均，厚的地方冷却慢，表面会缩出凹坑。",
            summary="壁厚 {t} · 移除底面",
            view=(0.6, -0.8, -1.4),
        ),
        Feature(
            "sk3", "sketch", "草图3", "十字轴截面",
            why="轴座截面是一个 Ø5.5 的圆减掉十字孔。十字孔 4 × 1.17 对应 MX 轴的十字头，过盈一点点就能卡紧。",
            summary="离底面 1 · Ø{ds} 圆 − 十字 4 × 1.17",
            view=(0, 0, -1),
        ),
        Feature(
            "ext1", "extrude", "拉伸1", "十字轴座",
            why="轴座从下往上长，直到顶板的下表面。CAD 里一般选「成形到下一面」；这里算出顶板下表面最低点的高度，再多伸 0.3 吃进顶板，效果一样，而且尺寸写得明明白白。",
            summary="到顶板下表面 + 0.3",
            pitfall="只拉到下表面最低点会留一圈缝：顶板下表面是球面，离中心越远越高。",
            view=(0.6, -0.8, -1.4),
        ),
        Feature(
            "fil1", "fillet", "圆角1", "顶面四边",
            why="最后给顶面四条边倒小圆角，摸上去不割手。放在最后，前面改碟面或壁厚都不会碰到它。",
            summary="R{rf}",
            pitfall="圆角不能大于碟口到边的距离，否则会和碟面撞在一起。",
            view=(1, -1.1, 1.2),
        ),
    ],
    failures={
        "shell1": "抽壳失败：顶板向下偏移后和侧壁撞在一起，或者碟面太深。",
        "ext1": "轴座没能和顶板连成一体。",
        "fil1": "顶边圆角放不下：圆角伸进了碟面。",
    },
)


def build(p, r):
    H, R, t = p["H"], p["R"], p["t"]

    # @step sk1
    base = Rectangle(p["B"], p["B"])
    r.sketch(
        "sk1", base, Plane.XY, size=p["B"] * 2, plane_name="上视基准面",
        dims=[Dim((-p["B"] / 2, -p["B"] / 2, 0), (p["B"] / 2, -p["B"] / 2, 0), (0, -1, 0), 4, f"{p['B']:g}")],
    )

    # @step sk2
    top_plane = Plane.XY.offset(H)
    top = top_plane * Rectangle(p["TX"], p["TY"])
    r.sketch(
        "sk2", [base, top], top_plane, size=p["B"] * 2, plane_name="基准面1",
        dims=[
            Dim((-p["TX"] / 2, -p["TY"] / 2, H), (p["TX"] / 2, -p["TY"] / 2, H), (0, -1, 0), 4, f"{p['TX']:g}"),
            Dim((p["TX"] / 2, -p["TY"] / 2, H), (p["TX"] / 2, p["TY"] / 2, H), (1, 0, 0), 4, f"{p['TY']:g}"),
            Dim((p["B"] / 2, -p["B"] / 2, 0), (p["B"] / 2, -p["B"] / 2, H), (1, 0, 0), 4, f"{H:g}"),
        ],
    )

    # @step loft1
    cap = loft([base, top], ruled=True)
    r.solid("loft1", cap)

    # @step cut1
    depth = R - sqrt(R**2 - (DISH / 2) ** 2)  # 碟口直径固定，半径越大碟越浅
    ball = Pos(0, 0, H - depth + R) * Rot(90, 0, 0) * Sphere(R)  # 极点转到侧面
    cap -= ball
    r.solid("cut1", cap)

    # @step shell1
    bottom = cap.faces().sort_by(Axis.Z)[0]
    solid_volume = cap.volume  # hide
    cap = offset(cap, amount=-t, openings=bottom)
    r.check("shell1", cap.volume < 0.7 * solid_volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", cap)

    # @step sk3
    stem_plane = Plane.XY.offset(STEM_Z0)
    cross = Rectangle(4.0, 1.17) + Rectangle(1.17, 4.0)
    stem_profile = stem_plane * (Circle(p["ds"] / 2) - cross)
    r.sketch(
        "sk3", stem_profile, stem_plane, size=p["B"] * 1.2, plane_name="基准面2",
        dims=[Dim((-p["ds"] / 2, 0, STEM_Z0), (p["ds"] / 2, 0, STEM_Z0), (0, -1, 0), 4, f"Ø{p['ds']:g}")],
    )

    # @step ext1
    underside = H - depth - t  # 顶板下表面的最低点
    cap += extrude(stem_profile, amount=underside - STEM_Z0 + OVERLAP)
    r.check("ext1", len(cap.solids()) == 1, "轴座没有和顶板连成一体")
    r.solid("ext1", cap)

    # @step fil1
    top_edges = cap.edges().group_by(Axis.Z)[-1].filter_by(GeomType.LINE)
    cap = fillet(top_edges, radius=p["rf"])
    r.solid("fil1", cap)
    return cap
