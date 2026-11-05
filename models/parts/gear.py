"""直齿轮: root-circle sketch → extrude → one involute tooth sketch → extrude
→ circular pattern → bore → chamfers.

The teaching point is derived dimensions: only the module ``m`` and the tooth
count ``z`` are inputs; the pitch, base, tip and root circles, the tooth
shape and even the bore all follow from them. The tooth is drawn once and
copied round the axis by a circular pattern.
"""

from math import acos, cos, pi, radians, sin, tan

from build123d import (
    Align,
    Axis,
    Circle,
    Cylinder,
    GeomType,
    Plane,
    PolarLocations,
    Polyline,
    Spline,
    ThreePointArc,
    chamfer,
    extrude,
    make_face,
)

from ftbake import Dim, Feature, Param, PartModel

ALPHA = radians(20)  # 压力角
UP = (Align.CENTER, Align.CENTER, Align.MIN)


def inv(a: float) -> float:
    """渐开线函数 inv(α) = tan α − α."""
    return tan(a) - a


MODEL = PartModel(
    id="gear",
    title="直齿轮",
    subtitle="渐开线 · 模数与齿数驱动 · 圆周阵列",
    level="进阶",
    teaches=["派生尺寸：分度圆 = m × z", "只画一个齿", "圆周阵列", "孔径跟着齿轮走"],
    params=[
        Param("m", "模数", "mm", 1.5, [1, 1.5, 2], feature="sk1"),
        Param("z", "齿数", "个", 18, [12, 18, 24, 36], feature="pat1"),
        Param("alpha", "压力角", "°", 20, feature="sk2"),
        Param("B", "齿宽", "mm", 8, feature="ext1"),
        Param("c", "孔口倒角", "mm", 0.5, feature="cha1"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "齿根圆",
            why="齿轮所有的圆都由模数和齿数算出来：分度圆 d = m × z，齿顶圆大一个 m，齿根圆小 1.25 m。草图里只画齿根圆，其余几个圆画成构造线，给后面画齿当参照。",
            summary=lambda p: f"分度圆 d = m × z = {p['m']:g} × {p['z']:g} = {p['m'] * p['z']:g}",
            pitfall="不要把分度圆直径直接写成数字：以后改齿数，它就对不上了。",
            view=(0, 0, 1),
        ),
        Feature(
            "ext1", "extrude", "拉伸1", "齿根圆柱",
            why="先拉出齿根圆柱，相当于轮坯。齿是后面一个一个长上去的。",
            summary="齿宽 {B}",
        ),
        Feature(
            "sk2", "sketch", "草图2", "一个齿",
            why="草图画在齿根圆柱的顶面上。齿面是渐开线：一根绳子绕在基圆上，拉直时绳端走过的轨迹。两齿啮合时，这条曲线让传动比始终不变。这里在基圆和齿顶圆之间取 8 个点画样条，另一侧镜像得到。",
            summary="压力角 {alpha}° · 渐开线齿廓",
            pitfall="齿数少于 17 时，真实加工会根切掉齿根的一部分。这里画的是理论齿形。",
            view=(0, 0, 1),
            focus=lambda p: ((p["m"] * p["z"] / 2 - 2 * p["m"], -2 * p["m"], 0), (p["m"] * p["z"] / 2 + 2 * p["m"], 2 * p["m"], p["B"])),
        ),
        Feature(
            "ext2", "extrude", "拉伸2", "第一个齿",
            why="把齿廓从顶面向下拉伸一个齿宽，同时和轮坯合并。齿脚特意伸进齿根圆里一点，两个实体有重叠，合并才可靠。",
            summary="齿宽 {B} · 合并",
            focus=lambda p: ((p["m"] * p["z"] / 2 - 2 * p["m"], -2 * p["m"], 0), (p["m"] * p["z"] / 2 + 2 * p["m"], 2 * p["m"], p["B"])),
        ),
        Feature(
            "pat1", "pattern", "阵列1", "圆周阵列",
            why="绕中心轴把第一个齿复制成 z 个，等角度分布。改齿数只需要改阵列的个数，齿廓和各个圆会跟着重算。",
            summary="{z} 个 · 360° 等分",
        ),
        Feature(
            "hole1", "hole", "孔1", "轴孔",
            why="轴孔直径取分度圆的 0.4 倍再取整，也是派生尺寸：齿轮变大，孔跟着变大，轮缘始终留得出足够的厚度。",
            summary=lambda p: f"Ø{round(0.4 * p['m'] * p['z']):g} ≈ 0.4 × 分度圆 · 贯穿",
            pitfall="孔太大会让齿根下面的轮缘太薄，受力时从齿根裂开。",
            view=(0.8, -0.9, 1.4),
        ),
        Feature(
            "cha1", "chamfer", "倒角1", "孔口与齿顶倒角",
            why="孔口倒角方便把齿轮压到轴上；齿顶两端倒角去掉锐边，装配时不会刮伤，也不容易崩齿。倒角放在最后，它只修饰，不改变任何尺寸关系。",
            summary=lambda p: f"孔口 C{p.get('c', 0.5):g} · 齿顶 C{0.25 * p['m']:g}",
            view=(0.8, -0.9, 1.4),
        ),
    ],
    failures={
        "ext2": "齿没有和轮坯合并成一个实体。",
        "pat1": "阵列后的齿没有和轮坯合并成一个实体。",
        "cha1": "倒角失败：齿顶太窄，放不下这么大的倒角。",
    },
)


def build(p, r):
    m, z, B = p["m"], int(p["z"]), p["B"]

    # @step sk1
    d = m * z  # 分度圆
    rb, ra, rf = d / 2 * cos(ALPHA), d / 2 + m, d / 2 - 1.25 * m  # 基圆、齿顶圆、齿根圆
    root = Circle(rf)
    r.sketch(
        "sk1", root, Plane.XY, size=ra * 3, plane_name="上视基准面",
        construction=[Circle(d / 2), Circle(rb), Circle(ra)],
        dims=[
            Dim((-d / 2, 0, 0), (d / 2, 0, 0), (0, -1, 0), ra + 3 * m, f"分度圆 Ø{d:g}"),
            Dim((-ra, 0, 0), (ra, 0, 0), (0, 1, 0), ra + 3 * m, f"齿顶圆 Ø{2 * ra:g}"),
        ],
    )

    # @step ext1
    gear = extrude(root, amount=B)
    r.solid("ext1", gear)

    # @step sk2
    half = pi / (2 * z) + inv(ALPHA)  # 半个齿在基圆上张开的角度

    r0 = max(rb, rf)  # 渐开线从基圆开始，到齿顶圆结束
    radii = [r0 + (ra - r0) * i / 7 for i in range(8)]
    theta = [half - inv(acos(rb / q)) for q in radii]  # 渐开线上各点的极角
    upper = Spline(*[(q * cos(a), q * sin(a)) for q, a in zip(radii, theta)])
    lower = upper.mirror(Plane.XZ)
    foot = (rf - 0.5 * m) / r0  # 齿脚伸进齿根圆
    top = Plane.XY.offset(B)  # 画在齿根圆柱的顶面上
    tooth = top * make_face([
        lower,
        ThreePointArc(lower @ 1, (ra, 0), upper @ 1),  # 齿顶
        upper,
        Polyline(upper @ 0, (upper @ 0) * foot, (lower @ 0) * foot, lower @ 0),  # 齿根
    ])
    r.sketch(
        "sk2", tooth, top, size=ra * 3, plane_name="齿根圆柱顶面",
        construction=[top * c for c in (Circle(d / 2), Circle(rb), Circle(ra), Circle(rf))],
        center=(d / 2, 0, B),
    )

    # @step ext2
    tooth = extrude(tooth, amount=B, dir=(0, 0, -1))  # 向下拉到底面
    gear += tooth
    r.check("ext2", len(gear.solids()) == 1, "齿没有和轮坯合并")
    r.solid("ext2", gear)

    # @step pat1
    gear += PolarLocations(0, z) * tooth
    r.check("pat1", len(gear.solids()) == 1, "阵列的齿没有和轮坯合并")
    r.solid("pat1", gear)

    # @step hole1
    bore = round(0.4 * d)  # 孔径 ≈ 0.4 倍分度圆，取整
    gear -= Cylinder(bore / 2, B, align=UP)
    r.solid("hole1", gear)

    # @step cha1
    circles = gear.edges().filter_by(GeomType.CIRCLE)
    gear = chamfer(circles.filter_by(lambda e: abs(e.radius - bore / 2) < 1e-3), length=p["c"])
    tips = gear.edges().filter_by(GeomType.CIRCLE).filter_by(lambda e: abs(e.radius - ra) < 1e-3)
    gear = chamfer(tips, length=0.25 * m)
    r.solid("cha1", gear)
    return gear
