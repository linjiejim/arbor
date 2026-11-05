"""桌面温湿度计: a small consumer-electronics assembly.

Two injection-moulded shells clamp the PCB between their screw bosses; four
self-tapping screws from below go through the bottom shell and the PCB into
the top cover's bosses, and the silicone feet hide the screw heads. Explode
offsets follow the real removal direction; the assembly order is the reverse
of disassembly. The bottom shell is the ``enclosure_bottom`` part model with
its default parameters, so the drill-down on the site shows its feature tree.
"""

from build123d import (
    Align,
    Axis,
    Box,
    Compound,
    Cylinder,
    Locations,
    Plane,
    Pos,
    RectangleRounded,
    draft,
    extrude,
    fillet,
    offset,
)

from ftbake import AssemblyModel, Part, Recorder
from parts import enclosure_bottom

W, L, R, T = 68.0, 52.0, 10.0, 1.8  # 外形、角半径、壁厚
SEAM, TOP = 11.0, 18.0  # 上下壳分型面、上盖顶面
BOSSES = enclosure_bottom.BOSSES
UP = (Align.CENTER, Align.CENTER, Align.MIN)

MODEL = AssemblyModel(
    id="enclosure",
    title="桌面温湿度计",
    subtitle="上下壳 · 螺丝柱 · 爆炸图",
    level="进阶",
    teaches=["上下壳在分型面对齐", "螺丝柱夹住主板", "外购件只建包络", "爆炸方向就是拆卸方向"],
    parts=[
        Part(
            "bottom", "底壳", 1, "ABS", "注塑", "model", (0, 0, 0), 1,
            "壁厚 1.8 处处一致。螺丝柱外径约为孔径的 2.5 倍，两侧加筋连到侧壁，筋厚取壁厚的 60%，背面不会缩痕。",
            model="enclosure_bottom",
        ),
        Part(
            "battery", "纽扣电池 CR2032", 1, "—", "外购", "metal", (0, 0, 12), 2,
            "装在主板背面的电池座里。尺寸是标准件，直接引用厂商的 STEP，不自己画。",
        ),
        Part(
            "pcb", "主板 PCBA", 1, "FR-4", "SMT 贴片", "modelDark", (0, 0, 24), 3,
            "板子被上下两组螺丝柱夹住，四个孔和螺丝柱同心。外形比壳体内腔每边小 1.2，留出装配间隙。",
        ),
        Part(
            "display", "屏幕模组", 1, "—", "外购", "metal", (0, 0, 36), 4,
            "外购件按规格书建一个包络体即可：外形、厚度、FPC 出线位置是结构设计真正关心的。",
        ),
        Part(
            "lens", "镜片", 1, "PMMA", "注塑 / 激光切割", "glass", (0, 0, 50), 5,
            "从上盖内侧贴上，比视窗每边大 2 mm，压边用来点胶。外观面朝外，不能有顶针印。",
        ),
        Part(
            "top", "上盖", 1, "ABS", "注塑", "model", (0, 0, 64), 6,
            "分型线放在上下壳的接缝处（z = 11），外观面没有分模痕。螺丝柱从顶板向下长，自攻螺丝从底部拧进来。",
        ),
        Part(
            "screws", "自攻螺丝 M2×15", 4, "不锈钢", "标准件", "metal", (0, 0, -22), 7,
            "从底部穿过底壳和主板，拧进上盖的螺丝柱。上盖柱里只有 Ø1.8 的底孔，比螺丝细，拧进去时自己攻出螺纹，啮合长度约 3 mm。",
        ),
        Part(
            "feet", "硅胶脚垫", 4, "硅胶", "模压", "modelDark", (0, 0, -38), 8,
            "脚垫正好盖住螺丝头：一个零件同时解决防滑和遮挡两件事。脚垫上面留一个浅坑，让开螺丝头。",
        ),
    ],
    notes=[
        "上下壳在分型面 z = 11 对齐，两边的拔模都从这个面开始：底壳往下收，上盖往上收，接缝处的外形完全一样。",
        "螺丝从底部拧入，再被脚垫盖住，外观面上看不到螺丝。",
        "主板不靠卡扣，而是被上下两组螺丝柱夹住：底壳柱顶托住，上盖柱底压住，一颗螺丝同时锁住三个零件。",
        "外购件（电池、屏幕）只建包络体，关心外形、厚度和出线位置就够了。",
    ],
)


def bottom_shell():
    """The enclosure_bottom part model, default parameters."""
    m = enclosure_bottom.MODEL
    return enclosure_bottom.build({p.id: p.default for p in m.params}, Recorder(m))


def top_cover():
    outline = RectangleRounded(W, L, R)
    cover = Pos(0, 0, SEAM) * extrude(outline, amount=TOP - SEAM)
    sides = cover.faces() - cover.faces().filter_by(Axis.Z)
    cover = draft(sides, Plane.XY.offset(SEAM), angle=1)  # 中性面同样在分型面上，往上收
    cover = fillet(cover.edges().group_by(Axis.Z)[-1], radius=0.6)
    cover = offset(cover, amount=-T, openings=cover.faces().sort_by(Axis.Z)[0])
    cover -= Pos(0, 0, TOP - 3) * extrude(RectangleRounded(40, 28, 2), amount=4)  # 视窗
    inner_top = TOP - T
    bosses = Locations(*BOSSES) * (
        Pos(0, 0, 12) * Cylinder(3, inner_top - 12 + 0.2, align=UP) - Pos(0, 0, 11.9) * Cylinder(0.9, inner_top - 11.8, align=UP)
    )
    return cover + bosses


def pcb():
    board = extrude(RectangleRounded(62, 46, 8), amount=1.2)
    board -= Locations(*BOSSES) * Cylinder(1.2, 2, align=UP)
    parts = [
        Pos(0, 0, 10.8) * board,
        Pos(-8, -18.5, 12) * Box(7, 7, 1, align=UP),  # 主控，让开屏幕
        Pos(28.5, 4, 12) * Box(3, 3, 1, align=UP),  # 温湿度传感器，靠边，离发热元件远一点
        Pos(-25.5, 0, 12) * Box(10, 3.2, 1.3, align=UP),  # 屏幕 FPC 连接器
        Pos(10, 17.5, 12) * Box(2, 1.2, 0.6, align=UP),
        Pos(14, 17.5, 12) * Box(2, 1.2, 0.6, align=UP),
        Pos(22, -6, 12) * Box(1.2, 2, 0.6, align=UP),
    ]
    return Compound(parts)


def battery():
    cell = Pos(0, 0, 7.4) * Cylinder(10, 3.2, align=UP)
    return fillet(cell.edges().group_by(Axis.Z)[-1], radius=0.4)


def display():
    frame = Pos(0, 0, 12) * Box(40, 28, 2.2, align=UP)
    glass = Pos(0, 0, 14.2) * Box(38, 26, 0.8, align=UP)
    return frame + glass


def lens():
    return Pos(0, 0, 15.4) * extrude(RectangleRounded(44, 32, 3), amount=0.8)


def screws():
    head = Pos(0, 0, -1.4) * Cylinder(1.9, 1.4, align=UP)
    head = fillet(head.edges().group_by(Axis.Z)[0], radius=0.5)
    shank = Cylinder(1.0, 15, align=UP)
    screw = head + shank
    return Compound(Locations(*BOSSES) * screw)


def feet():
    foot = Pos(0, 0, -1.8) * Cylinder(4, 1.8, align=UP)
    foot = fillet(foot.edges().group_by(Axis.Z)[0], radius=0.5)
    foot -= Pos(0, 0, -1.5) * Cylinder(2.1, 1.6, align=UP)  # 让开螺丝头的浅坑
    return Compound(Locations(*BOSSES) * foot)


def build():
    return {
        "bottom": bottom_shell(),
        "battery": battery(),
        "pcb": pcb(),
        "display": display(),
        "lens": lens(),
        "top": top_cover(),
        "screws": screws(),
        "feet": feet(),
    }
