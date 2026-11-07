"""带铰链盒子: a box body, a lid and a hinge pin.

The knuckles sit along the back edge, alternating between body (three) and
lid (two) on one common axis that lies exactly on the parting plane. The pin
is a press fit in the body knuckles and a clearance fit in the lid knuckles,
so the lid keeps exactly one rotational degree of freedom.
"""

from build123d import (
    Align,
    Axis,
    Box,
    Cylinder,
    Pos,
    Rectangle,
    Rot,
    chamfer,
    extrude,
    fillet,
    offset,
)

from arborbake import AssemblyModel, Part

W, L = 60.0, 40.0  # 外形
H_BODY, H_LID, T = 25.0, 8.0, 2.0  # 盒身高、盖高、壁厚
AXIS_Y, AXIS_Z = L / 2 + 3, H_BODY  # 铰链轴线：后壁外侧 3 mm，正好在分界面上
KNUCKLE_R, SPAN, GAP = 3.0, 48.0, 0.4  # 关节半径、关节总长、相邻关节的轴向间隙
PIN_D, LID_HOLE = 2.0, 2.2  # 销钉直径；盖子关节孔留 0.2 的间隙
UP = (Align.CENTER, Align.CENTER, Align.MIN)

MODEL = AssemblyModel(
    id="hinge_box",
    title="带铰链盒子",
    subtitle="关节 · 销钉 · 配合与自由度",
    level="进阶",
    teaches=["关节交错排在同一根轴线上", "过盈配合与间隙配合", "约束只留一个转动自由度"],
    parts=[
        Part(
            "body", "盒身", 1, "PP", "注塑", "model", (0, 0, 0), 1,
            "后壁外侧长出三个关节，和盒身一次注塑成型。关节孔按销钉的名义尺寸 Ø2 画，公差取过盈，销钉压进去就不会再动。",
        ),
        Part(
            "lid", "盒盖", 1, "PP", "注塑", "modelDark", (0, 16, 20), 2,
            "两个关节插在盒身三个关节的空当里。关节孔 Ø2.2，比销钉大 0.2，盖子可以绕销钉转。",
            motion={"type": "revolute", "origin": [0, AXIS_Y, AXIS_Z], "axis": [-1, 0, 0], "min": 0, "max": 110, "label": "开合角"},
        ),
        Part(
            "pin", "铰链销 Ø2×48", 1, "不锈钢", "标准件", "metal", (54, 0, 0), 3,
            "最后从侧面穿进五个关节。拆的时候沿轴线把它推出来，盖子就能取下。",
        ),
    ],
    notes=[
        "盖子在空间里本来有 6 个自由度：3 个移动、3 个转动。铰链销把其中 5 个锁住，只留绕销钉轴线的转动。",
        "同一根销钉两种配合：和盒身关节过盈，销钉不会滑出来；和盒盖关节间隙，盖子转得动。",
        "相邻关节之间留 0.4 mm 轴向间隙，转动时端面不摩擦；间隙太大，盖子会沿轴线晃动，多出一个不想要的自由度。",
        "铰链轴线放在后壁外侧、正好在盒身和盒盖的分界面上，盖子打开时后边缘绕着轴线转，不会撞到盒身。",
    ],
)


def shell_block(h: float, z0: float, open_side: int):
    """A rounded box of height h from z0, shelled with the top (1) or bottom (0) face open."""
    block = Pos(0, 0, z0) * extrude(Rectangle(W, L), amount=h)
    block = fillet(block.edges().filter_by(Axis.Z), radius=4)
    face = block.faces().sort_by(Axis.Z)[-1 if open_side else 0]
    return offset(block, amount=-T, openings=face)


def knuckle(i: int, below: bool, hole_d: float):
    """Knuckle i of 5 along the axis, with a web down (body) or up (lid) into the back wall."""
    seg = (SPAN - 4 * GAP) / 5
    x = -SPAN / 2 + seg / 2 + i * (seg + GAP)
    barrel = Pos(x, AXIS_Y, AXIS_Z) * Rot(0, 90, 0) * Cylinder(KNUCKLE_R, seg)
    web_z = AXIS_Z - KNUCKLE_R if below else AXIS_Z
    web = Pos(x, (L / 2 - T / 2 + AXIS_Y) / 2, web_z) * Box(seg, AXIS_Y - (L / 2 - T / 2), KNUCKLE_R, align=UP)
    hole = Pos(x, AXIS_Y, AXIS_Z) * Rot(0, 90, 0) * Cylinder(hole_d / 2, seg + 1)
    return barrel + web - hole


def body():
    part = shell_block(H_BODY, 0, open_side=1)
    return part + [knuckle(i, below=True, hole_d=PIN_D) for i in (0, 2, 4)]


def lid():
    part = shell_block(H_LID, H_BODY, open_side=0)
    part = fillet(part.edges().group_by(Axis.Z)[-1], radius=1.5)
    return part + [knuckle(i, below=False, hole_d=LID_HOLE) for i in (1, 3)]


def pin():
    rod = Pos(0, AXIS_Y, AXIS_Z) * Rot(0, 90, 0) * Cylinder(PIN_D / 2, SPAN)
    return chamfer(rod.edges(), length=0.2)


def build():
    return {"body": body(), "lid": lid(), "pin": pin()}
