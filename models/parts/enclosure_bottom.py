"""温湿度计底壳: rounded-rect sketch → extrude → 1° draft → shell (open top)
→ four screw bosses → ribs to the walls → through holes → boss root fillets.

The teaching points are the injection-moulding rules: one wall thickness
everywhere, draft on the walls so the part leaves the mould, screw bosses
tied to the walls by ribs, and ribs thinner than the wall (about 60 %) so
the outside shows no sink marks.
"""

from math import copysign

from build123d import (
    Align,
    Axis,
    Box,
    Cylinder,
    GeomType,
    Locations,
    Plane,
    Pos,
    RectangleRounded,
    draft,
    extrude,
    fillet,
    offset,
)

from ftbake import Dim, Feature, Param, PartModel

W, L, R, H = 68.0, 52.0, 10.0, 11.0  # 外形、角半径、高度（分型面在 z = 11）
BOSSES = [(26, 18), (-26, 18), (-26, -18), (26, -18)]
BOSS_TOP = 10.8  # 螺丝柱顶面：主板就压在这里
UP = (Align.CENTER, Align.CENTER, Align.MIN)

MODEL = PartModel(
    id="enclosure_bottom",
    title="温湿度计底壳",
    subtitle="拔模 · 抽壳 · 螺丝柱 · 加强筋",
    level="进阶",
    teaches=["壁厚处处一致", "拔模让零件脱得出模", "螺丝柱用筋连到侧壁", "筋厚约为壁厚的 60%"],
    params=[
        Param("W", "长", "mm", W, feature="sk1"),
        Param("L", "宽", "mm", L, feature="sk1"),
        Param("R", "角半径", "mm", R, feature="sk1"),
        Param("H", "高度", "mm", H, feature="ext1"),
        Param("a", "拔模角", "°", 1, feature="dft1"),
        Param("t", "壁厚", "mm", 1.8, [1.5, 1.8, 2.5], feature="shell1"),
        Param("D", "螺丝柱外径", "mm", 6, [5, 6, 7], feature="boss1"),
        Param("dh", "螺丝孔径", "mm", 2.4, feature="hole1"),
        Param("rf", "柱根圆角", "mm", 0.4, feature="fil1"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "外形轮廓",
            why="外形直接画成圆角矩形，四个竖直的大圆角在草图里就有了，不用再单独倒。草图圆角比实体圆角稳：后面的拔模、抽壳都是在一个干净的外形上做。",
            summary="上视基准面 · {W} × {L} · R{R}",
            view=(0, 0, 1),
        ),
        Feature(
            "ext1", "extrude", "拉伸1", "实心壳体",
            why="拉到 11 mm，顶面就是上下壳的分型面。上盖也从这个面开始往上长，两个零件在这里对齐。",
            summary="高 {H}",
        ),
        Feature(
            "dft1", "draft", "拔模1", "外壁拔模",
            why="外壁向下收 1°。中性面放在分型面 z = 11 上，这里的外形保持 68 × 52 不变，和上盖严丝合缝；越往底部越小，模具一打开，零件就能从型腔里脱出来。四个圆角是圆锥面，也一起拔模了。",
            summary="{a}° · 中性面 z = {H} · 向下收",
            pitfall="中性面放在底面，变的就是分型面处的外形，和上盖对不齐了。",
            view=(1, -0.3, 0.15),
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空壳体",
            why="移除顶面抽壳，底板和侧壁一样厚。拔模放在抽壳之前，内壁是从外壁偏移出来的，也带着同样的 1°，型芯同样拔得出来。",
            summary="壁厚 {t} · 移除顶面",
            pitfall="先抽壳再拔模，要分别选内外两圈面，很容易漏选，壁厚也会变得不均匀。",
            view=(0.8, -1, 1.6),
        ),
        Feature(
            "boss1", "extrude", "拉伸2", "螺丝柱",
            why="四个螺丝柱从底板长到 z = 10.8，主板就压在柱顶上。柱子留在离侧壁 3 mm 左右的地方，螺丝刀和电池座都有地方放。",
            summary="Ø{D} × 4 · 底板到 z = 10.8",
            pitfall="螺丝柱直接贴在侧壁上，那一处的壁会变得很厚，外面缩出凹坑。",
            view=(0.8, -1, 1.6),
        ),
        Feature(
            "rib1", "rib", "筋1", "加强筋",
            why="每个螺丝柱向最近的两面侧壁各拉一条筋，拧螺丝时柱子不会被拧歪。筋厚取壁厚的 60%，筋和侧壁相交处不会因为太厚而缩水。筋比柱子矮一截，上面留出放主板元件的空间。",
            summary="筋厚 0.6 × {t} · 高 5.2",
            pitfall="筋和壁一样厚，背面会出现一道缩痕。",
            # 从壳体里面看左后角的螺丝柱：两条筋分在柱子两侧，连到两面侧壁。
            view=(1, -1, 1.25),
            focus=lambda p: ((-p["W"] / 2, p["L"] / 2 - 21, 0), (-p["W"] / 2 + 21, p["L"] / 2, p["H"])),
        ),
        Feature(
            "hole1", "hole", "孔1", "螺丝过孔",
            why="孔从底面一直打穿螺丝柱。自攻螺丝从底部穿进来，穿过主板，拧进上盖的螺丝柱；底壳这一侧只是过孔，比 M2 螺丝大一点。",
            summary="Ø{dh} × 4 · 贯穿",
            view=(0.6, -0.8, -1.4),
        ),
        Feature(
            "fil1", "fillet", "圆角1", "柱根圆角",
            why="螺丝柱和底板的交线倒一个小圆角，应力不会集中在尖角上，塑料流动也更顺。圆角放在最后：筋和孔都已经确定，它只修饰交线。",
            summary="R{rf}",
            pitfall="柱根圆角太大，等于在根部堆了一圈料，又会变厚缩水。",
            view=(0.8, -1, 1.6),
            focus=lambda p: ((16, 8, 0), (p["W"] / 2, p["L"] / 2, p["H"])),
        ),
    ],
    failures={
        "dft1": "拔模失败：内核没能把圆角处的圆柱面转成圆锥面。",
        "shell1": "抽壳失败：壁厚太厚，内腔放不下。",
        "rib1": "加强筋没有和螺丝柱、侧壁连成一个实体。",
        "fil1": "柱根圆角放不下：圆角和筋的根部撞在一起。",
    },
)


def build(p, r):
    t, D = p["t"], p["D"]

    # @step sk1
    outline = RectangleRounded(p["W"], p["L"], p["R"])
    r.sketch(
        "sk1", outline, Plane.XY, size=p["W"] * 1.5, plane_name="上视基准面",
        dims=[
            Dim((-p["W"] / 2, -p["L"] / 2, 0), (p["W"] / 2, -p["L"] / 2, 0), (0, -1, 0), 8, f"{p['W']:g}"),
            Dim((p["W"] / 2, -p["L"] / 2, 0), (p["W"] / 2, p["L"] / 2, 0), (1, 0, 0), 8, f"{p['L']:g}"),
        ],
    )

    # @step ext1
    body = extrude(outline, amount=p["H"])
    r.solid("ext1", body)

    # @step dft1
    sides = body.faces() - body.faces().filter_by(Axis.Z)  # 四面平壁 + 四个圆角
    parting = Plane(origin=(0, 0, p["H"]), z_dir=(0, 0, -1))  # 中性面在分型面上，型腔向下脱开
    body = draft(sides, parting, angle=p["a"])
    r.solid("dft1", body)

    # @step shell1
    top = body.faces().sort_by(Axis.Z)[-1]
    solid_volume = body.volume  # hide
    body = offset(body, amount=-t, openings=top)
    r.check("shell1", body.volume < 0.6 * solid_volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", body)

    # @step boss1
    body += Pos(0, 0, t) * Locations(*BOSSES) * Cylinder(D / 2, BOSS_TOP - t, align=UP)
    r.solid("boss1", body)

    # @step rib1
    rib_t, rib_h = 0.6 * t, 5.2  # 筋厚取壁厚的 60%
    ribs = []
    for x, y in BOSSES:
        wx = copysign(p["W"] / 2 - t / 2, x)  # 筋一直伸到侧壁的壁厚中间
        wy = copysign(p["L"] / 2 - t / 2, y)
        ribs += [
            Pos((x + wx) / 2, y, t) * Box(abs(wx - x), rib_t, rib_h, align=UP),
            Pos(x, (y + wy) / 2, t) * Box(rib_t, abs(wy - y), rib_h, align=UP),
        ]
    body += ribs
    r.check("rib1", len(body.solids()) == 1, "加强筋没有连成一个实体")
    r.solid("rib1", body)

    # @step hole1
    body -= Locations(*BOSSES) * Cylinder(p["dh"] / 2, p["H"], align=UP)
    r.solid("hole1", body)

    # @step fil1
    boss_walls = body.faces().filter_by(GeomType.CYLINDER).filter_by(lambda f: abs(f.radius - D / 2) < 1e-3)
    roots = boss_walls.edges().filter_by(lambda e: abs(e.center().Z - t) < 1e-3)  # 柱子和底板的交线
    body = fillet(roots, radius=p["rf"])
    r.solid("fil1", body)
    return body
