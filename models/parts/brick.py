"""积木砖: sketch → extrude → shell (open bottom) → one stud → grid pattern →
bottom tubes → stud fillets.

The teaching point is that the stud count drives every size: the outline is
``8 × count − 0.2``, the studs sit on an 8 mm grid, and the tubes underneath
sit between the studs. Change the count and the whole brick follows.
"""

from build123d import (
    Align,
    Axis,
    Cylinder,
    GeomType,
    GridLocations,
    Plane,
    Pos,
    Rectangle,
    extrude,
    fillet,
    offset,
)

from turnerybake import Dim, Feature, Param, PartModel

PITCH = 8.0  # 凸点节距
GAP = 0.2  # 相邻两块砖之间的间隙
UP = (Align.CENTER, Align.CENTER, Align.MIN)  # 圆柱从底面往上长

MODEL = PartModel(
    id="brick",
    title="积木砖",
    subtitle="计数驱动 · 抽壳 · 矩形阵列",
    level="入门",
    teaches=["用数量驱动尺寸", "先抽壳再加凸点", "矩形阵列", "底管卡住凸点"],
    params=[
        Param("nx", "长向凸点数", "个", 4, [1, 2, 3, 4], feature="sk1"),
        Param("ny", "宽向凸点数", "个", 2, [1, 2], feature="sk1"),
        Param("H", "砖高", "mm", 9.6, feature="ext1"),
        Param("t", "壁厚", "mm", 1.2, feature="shell1"),
        Param("ds", "凸点直径", "mm", 4.8, feature="boss1"),
        Param("hs", "凸点高", "mm", 1.8, feature="boss1"),
        Param("dt", "底管外径", "mm", 6.51, feature="tube1"),
        Param("rf", "凸点圆角", "mm", 0.3, feature="fil1"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "底面矩形",
            why="外形不直接写死，而是由凸点数算出来：边长 = 8 × 个数 − 0.2。0.2 是两块砖并排时留的缝，每边各让 0.1。以后改个数，尺寸自己跟着变。",
            summary="上视基准面 · {nx}×{ny} 个凸点 · 节距 8",
            pitfall="直接按 8 的整数倍画，两块砖并排会挤在一起，插不进去。",
            view=(0, 0, 1),
        ),
        Feature(
            "ext1", "extrude", "拉伸1", "砖体",
            why="把矩形拉成实心的砖体。高度 9.6 是标准砖的高度，三块薄板摞起来正好等于一块砖。",
            summary="高 {H}",
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空砖体",
            why="选中底面作为开口，其余面向内偏移一个壁厚。抽壳放在加凸点之前：这时砖还是一个简单的盒子，抽壳最稳；凸点后加，也不会被掏空。",
            summary="壁厚 {t} · 移除底面",
            pitfall="先加凸点再抽壳，凸点也会被掏成空心的小杯子。",
            view=(0.8, -1, -1.2),
        ),
        Feature(
            "boss1", "extrude", "拉伸2", "第一个凸点",
            why="先只做一个凸点，放在阵列的第一个位置。阵列复制的是这个「种子」特征，以后改凸点直径只需要改这一处。",
            summary="Ø{ds} × {hs}",
            view=(1, -1.1, 1.2),
        ),
        Feature(
            "pat1", "pattern", "阵列1", "凸点阵列",
            why="矩形阵列按节距 8 把凸点铺满顶面，两个方向的个数就是参数里的凸点数。阵列以砖的中心对称展开，所以凸点永远居中。",
            summary="{nx}×{ny} · 间距 8",
            view=(1, -1.1, 1.2),
        ),
        Feature(
            "tube1", "extrude", "拉伸3", "底管",
            why="底管站在四个凸点的正中间，外径 6.51 正好同时顶住四周的凸点，砖就是靠它夹紧的。只有一排凸点的砖放不下空心管，改成凸点之间的细实心柱；1×1 的砖什么都不用加。",
            summary="Ø{dt} · 从底面到顶板",
            pitfall="底管长到顶板下表面就要停：短了接不上顶板，成了悬空的零件。",
            view=(0.8, -1, -1.2),
        ),
        Feature(
            "fil1", "fillet", "圆角1", "凸点顶边",
            why="凸点顶边倒一个小圆角，插拔时不刮手，也更好对准。圆角最后做，前面改阵列个数不会让它丢边。",
            summary="R{rf}",
            view=(1, -1.1, 1.2),
        ),
    ],
    failures={
        "shell1": "抽壳失败：壁厚太厚，内腔放不下。",
        "fil1": "凸点圆角放不下：圆角半径超过了凸点的高度或半径。",
    },
)


def build(p, r):
    nx, ny, H, t = int(p["nx"]), int(p["ny"]), p["H"], p["t"]

    # @step sk1
    L, W = PITCH * nx - GAP, PITCH * ny - GAP
    outline = Rectangle(L, W)
    r.sketch(
        "sk1", outline, Plane.XY, size=max(L, W) * 1.8, plane_name="上视基准面",
        dims=[
            Dim((-L / 2, -W / 2, 0), (L / 2, -W / 2, 0), (0, -1, 0), 6, f"{L:g}"),
            Dim((L / 2, -W / 2, 0), (L / 2, W / 2, 0), (1, 0, 0), 6, f"{W:g}"),
        ],
    )

    # @step ext1
    brick = extrude(outline, amount=H)
    r.solid("ext1", brick)

    # @step shell1
    bottom = brick.faces().sort_by(Axis.Z)[0]
    solid_volume = brick.volume  # hide
    brick = offset(brick, amount=-t, openings=bottom)
    r.check("shell1", brick.volume < 0.8 * solid_volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", brick)

    # @step boss1
    stud = Pos(0, 0, H) * Cylinder(p["ds"] / 2, p["hs"], align=UP)
    first = Pos(-PITCH * (nx - 1) / 2, -PITCH * (ny - 1) / 2) * stud
    brick += first
    r.solid("boss1", brick)

    # @step pat1
    brick += GridLocations(PITCH, PITCH, nx, ny) * stud
    r.check("pat1", len(brick.solids()) == 1, "凸点没有和砖体连成一个实体")
    r.solid("pat1", brick)

    # @step tube1
    h = H - t  # 从底面一直长到顶板下表面
    if nx > 1 and ny > 1:  # 空心管：卡在四个凸点中间
        post = Cylinder(p["dt"] / 2, h, align=UP) - Cylinder(p["ds"] / 2, h, align=UP)
    else:  # 只有一排：凸点之间的细实心柱
        post = Cylinder(1.6, h, align=UP)
    if nx > 1 or ny > 1:
        brick += GridLocations(PITCH, PITCH, max(nx - 1, 1), max(ny - 1, 1)) * post
    r.check("tube1", len(brick.solids()) == 1, "底管没有接到顶板上")
    r.solid("tube1", brick)

    # @step fil1
    stud_tops = brick.edges().filter_by(GeomType.CIRCLE).group_by(Axis.Z)[-1]
    brick = fillet(stud_tops, radius=p["rf"])
    r.solid("fil1", brick)
    return brick
