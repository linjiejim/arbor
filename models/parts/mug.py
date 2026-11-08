"""马克杯: revolve → fillet → shell → fillet → sweep handle → junction fillet.

The teaching point is feature order: the outer bottom fillet comes before the
shell, so the shell offsets it into a concentric inner fillet. When the fillet
is not larger than the wall, the shell has nothing valid to offset into, and
the kernel fails: the sandbox shows exactly that.
"""

from build123d import (
    Axis,
    Bezier,
    BuildSketch,
    Ellipse,
    GeomType,
    Plane,
    Polygon,
    Vector,
    fillet,
    offset,
    revolve,
    sweep,
)

from arborbake import Dim, Feature, Param, PartModel

ISO = (1.0, -1.1, 0.85)

MODEL = PartModel(
    id="mug",
    title="马克杯",
    subtitle="旋转 · 圆角 · 抽壳 · 扫掠",
    level="入门",
    teaches=["旋转体只画半截面", "先圆角再抽壳", "扫掠的路径与截面", "圆角放在最后"],
    params=[
        Param("H", "杯高", "mm", 96, feature="sk1"),
        Param("D", "杯口直径", "mm", 84, feature="sk1"),
        Param("d", "杯底直径", "mm", 72, feature="sk1"),
        Param("rb", "杯底圆角", "mm", 9, [2, 5, 9, 13], feature="fil1"),
        Param("t", "壁厚", "mm", 3.5, [2.5, 3.5, 5, 7], feature="shell1"),
        Param("rl", "杯口圆角", "mm", 1.2, feature="fil2"),
        Param("reach", "把手外伸", "mm", 30, feature="sk2"),
        Param("span", "把手跨度", "mm", 54, feature="sk2"),
        Param("ha", "把手截面厚", "mm", 5.5, feature="sk3"),
        Param("hb", "把手截面宽", "mm", 9, feature="sk3"),
        Param("rj", "把手根部圆角", "mm", 2, feature="fil3"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "杯身半截面",
            why="旋转体只画一半截面，另一半由旋转生成。截面画在杯背后一侧，旋转的接缝就落在杯背后，不会碰到把手。",
            summary="前视基准面 · H{H} · Ø{D} / Ø{d}",
            pitfall="轮廓一旦越过中心线，旋转会自交失败。",
            view=(0, -1, 0),
        ),
        Feature(
            "rev1", "revolve", "旋转1", "杯身",
            why="先得到一个实心的「毛坯」。后面的特征都在它上面做加减，就像车床上的一根料。",
            summary="360° · 绕中心线",
        ),
        Feature(
            "fil1", "fillet", "圆角1", "杯底外圆角",
            why="在抽壳之前给外底边加圆角：抽壳会把它向内偏移出一个同心的内圆角，转角处的壁厚和别处一样。",
            summary="R{rb}",
            pitfall="圆角半径正好等于壁厚时，后面的抽壳会失败；比壁厚小时，内侧会变成尖角。在参数里把两者调到一样大试试。",
            view=(1, -1.1, -0.5),
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空杯身",
            why="抽壳把实心件变成等壁厚的薄壁件：选中的顶面被打开，其余所有面向内偏移一个壁厚。注意杯口那圈面在内核看来是「被修改的顶面」，不是新面。",
            summary="壁厚 {t} · 移除顶面",
            view=(0.8, -1, 1.6),
        ),
        Feature(
            "fil2", "fillet", "圆角2", "杯口圆角",
            why="嘴唇接触的边必须圆滑。它只依赖杯口，放在把手之前，以后改把手不会碰到它。",
            summary="R{rl} · 内外两条边",
            pitfall="半径超过壁厚的一半就放不下：内外两个圆角会撞在一起。",
            view=(0.7, -1, 0.9),
            focus=lambda p: ((-p["D"] / 2, -p["D"] / 2, p["H"] - 18), (p["D"] / 2, p["D"] / 2, p["H"] + 2)),
        ),
        Feature(
            "sk2", "sketch", "草图2", "把手路径",
            why="路径画在杯身的对称面上，把手天然左右对称。两端伸进杯壁里，扫掠出来才能和杯身合成一体。",
            summary="前视基准面 · 外伸 {reach} · 跨度 {span}",
            view=(0, -1, 0),
        ),
        Feature(
            "sk3", "sketch", "草图3", "把手截面",
            why="截面画在路径起点的法平面上。椭圆比圆更好握：窄的一面贴手指，宽的一面承力。",
            summary="椭圆 {ha}×{hb}（半轴）",
            view=(1.4, -0.9, 0.5),
        ),
        Feature(
            "sweep1", "sweep", "扫掠1", "把手",
            why="截面沿路径走一遍得到把手，同时与杯身合并成一个实体。合并会在杯壁上开出把手的入口，所以杯壁显示为「被修改」。",
            summary="沿草图2 · 合并到杯身",
        ),
        Feature(
            "fil3", "fillet", "圆角3", "把手根部圆角",
            why="最后才倒把手根部的圆角：它引用的是合并后才出现的交线，放在前面就没有可选的边。圆角放最后，前面改什么都不容易让它断。",
            summary="R{rj}",
            pitfall="根部圆角太大，会吃掉把手截面，或者伸进杯子里面。",
            view=(1.3, -0.6, 0.4),
        ),
    ],
    failures={
        "shell1": "杯底圆角正好等于壁厚：抽壳要把外圆角向内偏移出一个半径为「圆角 − 壁厚」的内圆角，半径恰好为零时这个面退化，内核算不出来。圆角比壁厚小时，内核会退一步给出尖的内角；比壁厚大时，内角是同心圆角。实际建模时让圆角明显大于壁厚。",
        "fil2": "杯口圆角放不下：两侧圆角加起来超过了壁厚。",
        "fil3": "把手根部圆角失败：交线附近的几何太窄，圆角滚不过去。减小圆角半径或加粗把手。",
        "sweep1": "把手扫掠失败：路径弯得太急，截面在拐角处自交。",
    },
)


def build(p, r):
    H, R0, R1, t = p["H"], p["d"] / 2, p["D"] / 2, p["t"]

    # @step sk1
    with BuildSketch(Plane.XZ) as body:
        Polygon((0, 0), (-R0, 0), (-R1, H), (0, H), align=None)
    r.sketch(
        "sk1", body.sketch, Plane.XZ, size=max(H, p["D"]) * 1.6, plane_name="前视基准面",
        center=(-R1 / 2, 0, H / 2),
        construction=[Bezier((0, 0, -12), (0, 0, H + 12))],
        dims=[
            Dim((-R1, -1, 0), (-R1, -1, H), (-1, 0, 0), 14, f"{H:g}"),
            Dim((0, 0, H), (-R1, 0, H), (0, 0, 1), 10, f"Ø{p['D']:g}"),
            Dim((0, 0, 0), (-R0, 0, 0), (0, 0, 1), -10, f"Ø{p['d']:g}"),
        ],
    )

    # @step rev1
    cup = revolve(body.sketch, Axis.Z)
    r.solid("rev1", cup)

    # @step fil1
    bottom_edge = cup.edges().filter_by(GeomType.CIRCLE).sort_by(Axis.Z)[0]
    cup = fillet(bottom_edge, radius=p["rb"])
    r.solid("fil1", cup)

    # @step shell1
    top_face = cup.faces().sort_by(Axis.Z)[-1]
    solid_volume = cup.volume  # hide
    cup = offset(cup, amount=-t, openings=top_face)
    r.check("shell1", cup.volume < 0.6 * solid_volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", cup)

    # @step fil2
    rim_edges = cup.edges().filter_by(GeomType.CIRCLE).group_by(Axis.Z)[-1]
    cup = fillet(rim_edges, radius=p["rl"])
    r.solid("fil2", cup)

    # @step sk2
    def wall_x(z):  # the outer wall's radius at height z
        return R0 + (R1 - R0) * z / H

    z1, z2 = H * 0.54 + p["span"] / 2, H * 0.54 - p["span"] / 2
    c = p["reach"] * 4 / 3
    path = Bezier(
        (wall_x(z1) - t / 2, 0, z1),
        (wall_x(z1) + c, 0, z1 + p["reach"] * 0.12),
        (wall_x(z2) + c, 0, z2 - p["reach"] * 0.12),
        (wall_x(z2) - t / 2, 0, z2),
    )
    x_max = max((path @ (i / 40)).X for i in range(41))  # hide
    r.sketch(
        "sk2", path, Plane.XZ, size=max(H, p["D"] + p["reach"] * 2) * 1.4, plane_name="前视基准面",
        center=(R1 / 2, 0, H / 2),
        dims=[
            Dim((wall_x(H * 0.54), 0, H * 0.54), (x_max, 0, H * 0.54), (0, 0, 1), z1 - H * 0.54 + 10, f"{p['reach']:g}"),
            Dim((x_max, 0, z1), (x_max, 0, z2), (1, 0, 0), 12, f"{p['span']:g}"),
        ],
    )

    # @step sk3
    start, tangent = path @ 0, path % 0
    in_plane = Vector(0, 1, 0).cross(tangent).normalized()
    section_plane = Plane(origin=start, x_dir=in_plane, z_dir=tangent)
    with BuildSketch(section_plane) as section:
        Ellipse(p["ha"], p["hb"])
    r.sketch("sk3", section.sketch, section_plane, size=max(p["ha"], p["hb"]) * 4, center=tuple(start))

    # @step sweep1
    handle = sweep(section.sketch, path=path)
    mug = cup + handle
    r.solid("sweep1", mug)

    # @step fil3
    junction = mug.edges() - cup.edges() - handle.edges()
    mug = fillet(junction, radius=p["rj"])
    r.solid("fil3", mug)
    return mug
