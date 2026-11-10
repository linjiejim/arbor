# 写一个拆解模型

案例拆解页上的几何不是手画的，而是 `models/` 里的 build123d 代码在 OpenCascade 内核里算出来的。烘焙器（`models/turnerybake`）把每个特征之后的零件状态导出成 GLB，并标出每个面是这一步**新生成**、**修改**还是**没变**。

## 环境

```bash
python3 -m venv .venv
.venv/bin/pip install -r models/requirements.txt    # build123d 0.13（含 OCP）
cd app && npm run bake                              # 全部模型
cd models && ../.venv/bin/python -m turnerybake mug      # 只烘焙一个
```

输出在 `app/public/models/<id>/`：`manifest.json`、每组参数一个 `<variant>.glb`，以及总表 `app/public/models/index.json`。

## 零件模型

文件放在 `models/parts/<id>.py`，参考 `parts/mug.py`。一个模块定义两样东西：

```python
MODEL = PartModel(
    id="mug", title="马克杯", subtitle="旋转 · 圆角 · 抽壳 · 扫掠", level="入门",
    teaches=["…"],
    params=[
        Param("H", "杯高", "mm", 96, feature="sk1"),                    # 固定值，面板上只读
        Param("t", "壁厚", "mm", 3.5, [2.5, 3.5, 5, 7], feature="shell1"),  # 参数沙盒：每个值都会烘焙
    ],
    features=[Feature("sk1", "sketch", "草图1", "杯身半截面", why="…", summary="H{H}", view=(0, -1, 0)), …],
    failures={"shell1": "这一步失败时给学习者看的解释"},
)

def build(p, r):
    # @step sk1
    with BuildSketch(Plane.XZ) as body:
        ...
    r.sketch("sk1", body.sketch, Plane.XZ, size=150, plane_name="前视基准面", dims=[Dim(...)])

    # @step rev1
    cup = revolve(body.sketch, Axis.Z)
    r.solid("rev1", cup)
    ...
```

规则：

- **每个特征前写 `# @step <id>`**。两个标记之间的代码（去掉 `r.` 开头的记录调用和以 `# hide` 结尾的行）就是网站上这一步的「代码」页，所以要短、能独立读懂。
- **每个特征后调用一次** `r.solid(id, shape)`（实体特征）或 `r.sketch(id, ...)`（草图，几何不变，只画草图、基准面和尺寸）。顺序和 `features` 一致。
- `r.check(id, ok, message)` 用来拦住内核「没报错但结果是错的」的情况，比如抽壳后体积几乎没变、扫掠自交。
- `Param.values` 的所有组合都会烘焙。参数沙盒建议只开放 1–2 个参数、每个 3–4 档。
- **失败是内容**：有些组合会在某个特征失败，这是故意保留的。给那个特征写好 `failures` 解释；失败组合的 GLB 里保留失败前的步骤。
- `Feature.summary` 可以是模板（`"R{rb}"`），也可以是函数（`lambda p: f"分度圆 {p['m'] * p['z']:g}"`），用于派生尺寸。
- `Feature.view` 是这一步的关键视角（从目标指向相机的方向，Z 轴朝上），`focus` 可以把相机对准局部。

坐标约定：Z 轴朝上、毫米、原点在底面中心；上视基准面 `Plane.XY`、前视基准面 `Plane.XZ`、右视基准面 `Plane.YZ`。

## 装配模型

文件放在 `models/assemblies/<id>.py`，参考 `assemblies/enclosure.py` 和 `hinge_box.py`。`MODEL = AssemblyModel(...)` 列出零件（名称、数量、材料、工艺、显示材质、爆炸偏移、装配顺序、说明），`build()` 返回 `{零件 id: 已就位的 shape}`。

- 爆炸偏移沿真实的拆卸方向，装配顺序是拆卸的逆序。
- 零件可以用 `model="<零件模型 id>"` 链接到自己的特征树拆解。
- 保留了自由度的零件写 `motion`（目前支持绕轴转动），页面上会出现对应的滑杆。

## 面状态怎么判定

`turnerybake/classify.py` 用几何方法判定：把这一步每个面上的采样点投影到上一步各个面的底层曲面上。

- 落在同一张曲面上、面积和中心也不变：没变。
- 落在同一张曲面上，但被裁剪或延伸了：修改。
- 都不是：新生成。

在内核 spike 里，这和 OCCT 自己的操作历史在 1,694 个面上只有 1 处不一致。注意 OCCT 的语义：抽壳后杯口那圈面算「被修改的顶面」，合并不产生新面。
