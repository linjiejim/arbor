# 工业建模术语跨软件对照 + 经典教学模型拆解目录

> 研究日期：2026-11-04。本笔记供交互式学习网站的 UI 标签（附各软件 tooltip）和“模型拆解（teardown）”目录使用。
> 核实方式：Fusion、Onshape、Creo、Rhino、FreeCAD、build123d、CadQuery 是用脚本直接抓取官方中文帮助页或官方仓库翻译文件逐条核对的；SOLIDWORKS 帮助站拒绝脚本访问（HTTP 403），只能通过搜索引擎返回的官方页面标题和摘要核对；NX 官方中文帮助（docs.sw.siemens.com）靠 JS 渲染，抓不到正文，只能用第三方中文教程、教材和少量 Siemens 官方中文资料佐证。

## 问题 1：核心建模操作在各软件中的官方简体中文 UI 名称是什么？（含 build123d / CadQuery API 名）

### Takeaway
各软件的中文译名对基础操作（拉伸、旋转、圆角、倒角、抽壳、拔模）基本一致，分歧集中在 12 个左右的概念上：
- 扫描 / 扫掠
- 放样 / 混合 / 通过曲线组
- 筋 / 加强筋 / 肋材 / 轮廓筋
- 圆周阵列 / 环形阵列，线性阵列 / 矩形阵列
- 镜向 / 镜像
- 配合 / 联接
- 爆炸视图 / 分解视图
- 材料明细表 / BOM 表 / 物料清单
- 剖面视图 / 剖视图 / 横截面
- 等距曲面 / 偏移曲面 / 偏置曲面

有两处与委托方给出的示例不一致，需要更正：
- Fusion 当前官方中文帮助里 Rib 叫“加强筋”，整套帮助目录中“肋”字出现 0 次。
- Onshape 的 Rib 叫“肋材”。

NX 的中文名本次无法用官方帮助核实，需要单独截图确认。

### Cited Findings

#### 1.1 版本口径与数据源
- **Fusion**：抓取了官方 CHS 帮助目录 toctree.json，共 5,862 个条目，再逐页提取“在工具栏上，单击…”里的菜单路径。命令页 URL 格式为 `help.autodesk.com/cloudhelp/CHS/<书名>/files/<GUID>.htm` — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- **Onshape**：中文帮助页标题即命令名，URL 格式为 `cad.onshape.com/help/zh_CN/Content/<区>/<名>.htm` — [Onshape 中文帮助：拉伸](https://cad.onshape.com/help/zh_CN/Content/PartStudio/extrude.htm)
- **Creo**：Creo Parametric 12 的简体中文帮助，URL 中写作 `r12/chinese_cn`，不是 `chinese_simple` — [Creo 12 零件建模索引](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/part_modeling.html)
- **SOLIDWORKS**：简体中文帮助 URL 格式为 `help.solidworks.com/<年份>/chinese-simplified/SolidWorks/sldworks/<页>.htm`。本次核对的页面年份在 2015–2026 之间 — [拉伸 PropertyManager 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/r_extrude_propertymanager.htm)
- **Rhino 8**：zh-cn 帮助页的“功能表”（菜单）一栏给出中文菜单名；命令行里输入的仍是英文指令名（如 Sweep1）— [Rhino 8 Sweep1](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/sweep1.htm)
- **FreeCAD**：用的是官方仓库 main 分支的 Crowdin 翻译文件 `*_zh-CN.ts`，属于 1.1 开发线，与 1.0 正式版可能有出入 — [PartDesign_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/PartDesign/Gui/Resources/translations/PartDesign_zh-CN.ts)
- **build123d**：文档 latest 版本号为 0.13.1.dev306+g1901d71ec — [build123d Operations](https://build123d.readthedocs.io/en/latest/operations.html)
- **CadQuery**：文档 latest 版本 — [CadQuery API Reference](https://cadquery.readthedocs.io/en/latest/apireference.html)

#### 1.2 表 A：商业 CAD 对照（SOLIDWORKS / Fusion / Onshape / Creo 12 / NX）

图例：
- **无标记**：本次已在官方中文来源核实（帮助页标题、正文菜单路径或官方翻译文件）。
- **〔三〕**：只有第三方中文教程、教材或博客佐证。
- **〔?〕**：未核实，按常见用法填写，需要截图确认。
- **〔导航〕**：只在官方帮助的导航树里出现过，没有找到独立页面。
- **—**：没有直接对应的命令。

每格的来源见 1.5 节，按列和行号对应。

| # | 概念（EN） | SOLIDWORKS | Fusion | Onshape | Creo 12 | NX（官方中文帮助未能访问） |
|---|---|---|---|---|---|---|
| 1 | Datum plane 基准面 | 基准面；菜单“参考几何体”〔?〕 | 构造 > 偏移平面（另有：以一定角度创建平面、中间平面、相切平面等） | 平面 | 基准平面 | 基准平面〔?〕 |
| 2 | Datum axis 基准轴 | 基准轴〔?〕 | 构造 > 通过两点创建轴（另有：沿边、贯穿圆柱体等） | —（用草图直线或嵌合连接器）〔?〕 | 基准轴 | 基准轴〔?〕 |
| 3 | Datum point 基准点 | 点〔?〕 | 构造 > 位于顶点处的点（另有：沿路径等） | —〔?〕 | 基准点 | 点〔?〕 |
| 4 | Sketch 草图 | 草图（草图绘制） | 创建草图 | 草图（草图工具） | 草绘 / 草绘器 | 草图〔?〕 |
| 5 | Construction geometry 构造几何 | 构造几何线（勾选“作为构造线”） | 构造几何图元 | 构造 | 构造点、中心线、坐标系 | 参考曲线〔?〕 |
| 6 | Dimension 尺寸 | 智能尺寸 | 草图尺寸 | 尺寸 | 尺寸（强/弱尺寸〔?〕） | 快速尺寸〔?〕 |
| 7 | Fully / under / over defined | 完全定义 / 欠定义 / 过定义 | 完全约束（浏览器中显示红锁，几何由蓝变黑）；欠约束/过约束〔?〕 | 完全定义〔?〕 | 完全约束 / 冲突〔?〕 | 完全约束 / 欠约束 / 过约束〔?〕 |
| 8 | Extrude（增料 Boss） | 拉伸凸台/基体（属性面板名“拉伸 PropertyManager”） | 拉伸 | 拉伸 | 拉伸 | 拉伸〔三〕 |
| 9 | Extrude cut 拉伸切除 | 拉伸切除〔?〕（与凸台共用“拉伸 PropertyManager”） | 拉伸，操作选“剪切”〔?〕 | 拉伸，选“移除”〔?〕 | 拉伸切口 | 拉伸，布尔选“减去”〔?〕 |
| 10 | Revolve 旋转 | 旋转凸台/基体；旋转切除；旋转曲面 | 旋转 | 旋转 | 旋转；旋转切口 | 旋转〔三〕 |
| 11 | Sweep | 扫描（扫描凸台/基体、扫描切除、曲面扫描） | 扫掠 | 扫掠 | 扫描；螺旋扫描；扫描混合 | 扫掠〔三〕；沿引导线扫掠〔?〕 |
| 12 | Loft | 放样凸台/基体；放样切除；放样曲面 | 放样 | 放样 | 混合（平行混合）；旋转混合；扫描混合 | 通过曲线组（见 NX 2312 官方中文“新增功能”页，另有〔三〕佐证） |
| 13 | Boundary surface 边界曲面 | 边界曲面；另有“边界 PropertyManager”（与边界曲面是否同一面板〔?〕） | 无同名命令：封闭边界补面用“面片”；“边界实体”（Boundary Fill）是另一种功能，不能混用 | 边界曲面 | 边界混合 | 通过曲线网格〔?〕 |
| 14 | Fillet（等/变半径） | 圆角（“手工”与 FilletXpert 两种模式；变半径子类型名〔?〕） | 圆角 | 圆角 | 倒圆角；可变倒圆角；自动倒圆角 | 边倒圆（恒定/可变半径）〔三〕；面倒圆（见 NX 10 官方中文新功能资料） |
| 15 | Chamfer 倒角 | 倒角（含对称、非对称等类型） | 倒角 | 倒角 | 倒角；拐角倒角 | 倒斜角〔三〕 |
| 16 | Shell 抽壳 | 抽壳 | 抽壳 | 抽壳 | 壳 | 抽壳〔三〕 |
| 17 | Draft 拔模 | 拔模（中性面 / 分型线 / 阶梯拔模） | 拔模 | 拔模 | 拔模；可变拖拉方向拔模 | 拔模〔三〕 |
| 18 | Rib 筋 | 筋（类型：线性 / 自然） | 加强筋；网状加强筋（Web） | 肋材 | 轮廓筋；轨迹筋 | 筋板〔?〕 |
| 19 | Hole（沉头/埋头/螺纹孔） | 异型孔向导（子类型名〔?〕） | 孔（子类型名〔?〕） | 孔（子类型名〔?〕） | 孔 | 孔〔?〕 |
| 20 | Helix / Thread 螺旋/螺纹 | 螺旋线/涡状线；螺纹（Thread 特征）；装饰螺纹线〔?〕 | 螺纹；螺旋（实体弹簧，英文 Coil） | 螺旋（无原生螺纹特征〔?〕） | 螺旋扫描；修饰螺纹 | 螺旋 / 螺纹〔?〕 |
| 21 | Linear pattern | 线性阵列（插入 > 阵列/镜向 > 线性阵列） | 矩形阵列（创建 > 阵列 > 矩形阵列） | 线性阵列 | 阵列（类型名〔?〕） | 阵列特征，线性布局〔三〕 |
| 22 | Circular pattern | 圆周阵列 | 环形阵列 | 环形阵列 | 阵列，轴阵列〔?〕 | 阵列特征，圆形布局〔三〕 |
| 23 | Mirror 镜像 | 镜向（页名“镜向特征 PropertyManager”；较新版本的正文和导航也写“镜像”，两种写法并存） | 镜像 | 镜像 | 镜像 | 镜像特征〔三〕；镜像几何体〔?〕 |
| 24 | Boolean 并/差/交 | 组合（添加 / 删减 / 共同）〔?〕 | 合并（修改 > 合并；操作名〔?〕） | 布尔运算（子类型名〔?〕） | 合并主体；相交主体；修剪主体中的几何 | 合并〔三〕；减去 / 相交〔?〕 |
| 25 | Split 分割 | 分割〔?〕；另有分割线（曲线工具） | 分割实体；将一个面分割为多个面 | 分割 | 修剪（Trim 特征） | 拆分体〔三〕 |
| 26 | Thicken 加厚 | 加厚〔导航〕 | 加厚 | 加厚 | 加厚 | 加厚〔?〕 |
| 27 | Offset surface 偏移曲面 | 等距曲面〔导航〕 | 偏移（曲面 > 创建 > 偏移） | 偏移曲面 | 偏移 | 偏置曲面〔?〕 |
| 28 | Trim / Extend（曲面） | 剪裁曲面（类型：标准 / 相互）；延伸曲面〔?〕 | 修剪；延伸（曲面 > 修改） | 〔?〕（常用分割、移动面代替） | 修剪；延伸 | 修剪片体 / 延伸片体 / 修剪体〔?〕 |
| 29 | Knit / Sew 缝合 | 缝合曲面 | 缝合 | 封闭（Enclose，把曲面封成实体）；布尔运算〔?〕 | 合并（面组） | 缝合（NX 2312 官方中文“新增功能”页提到“缝合增强功能”） |
| 30 | Feature tree / history | FeatureManager 设计树 | 时间轴（另有浏览器） | 特征列表 | 模型树 | 部件导航器〔?〕 |
| 31 | Rollback 回滚 | 退回控制棒（中文“入门”PDF 写作“退回控制条”） | 拖动时间轴标记〔?〕 | 回滚条 | 插入模式〔?〕 | 设为当前特征〔?〕 |
| 32 | Parameters / equations / configurations | 方程式；配置（ConfigurationManager）；系列零件设计表 | 更改参数（修改 > 更改参数，含用户参数）；配置（配置表） | 变量；配置 | 参数；关系；族表 | 表达式〔?〕 |
| 33 | Assembly mates / joints | 配合。标准配合：重合、平行、垂直、相切、同心、锁定、距离、角度 | 联接；快速联接（As-built）；联接原点；约束零部件（部件约束） | 配合：紧固、旋转、滑块、圆柱、销槽、平面、平行、球、相切、宽度；另有嵌合连接器 | 放置约束（重合、距离等）；预定义约束集（连接） | 装配约束：接触对齐、角度、中心、胶合、适合、对齐/锁定、同心、距离、固定、平行、垂直〔三〕 |
| 34 | Exploded view 爆炸视图 | 爆炸视图（每个配置可有多个） | 在动画工作空间：自动分解（所有级别 / 一个级别）、手动分解 | 分解视图 | 分解视图（含偏距线） | 爆炸图〔三〕 |
| 35 | BOM | 材料明细表 | BOM 表（工程图教程中称“明细表”） | 物料清单表格（工程图） | 物料清单 (BOM) | 明细表〔?〕 |
| 36 | Section view 剖切 | 剖面视图（工程图）；装配体剖切视图 | 截面分析（检验，三维剖视）；剖视图（工程图） | 剖视图 | 横截面 | 剖视图〔?〕 |
| 37 | Interference detection | 干涉检查（官方词汇表把碰撞检测也译成同一个词） | 干涉（检验 > 干涉） | 〔?〕 | 全局干涉 | 简单干涉 / 间隙分析〔?〕 |
| 38 | Drawing views 工程图视图 | 工程图视图（投影、局部等视图名〔?〕） | 基础视图；投影视图；局部视图；局部剖视图 | 视图；投影视图 | 绘图视图 | 基本视图 / 投影视图〔?〕 |
| 39 | Sheet metal base flange | 基体法兰/薄片 | 凸缘（分基础 / 边 / 轮廓凸缘） | 钣金模型 | 平面壁；平整壁 | 突出块〔三〕 |
| 40 | Edge flange 边线法兰 | 边线法兰 | 凸缘（边） | 法兰 | 法兰壁 | 弯边〔三〕 |
| 41 | Bend 折弯 | 绘制的折弯〔?〕 | 通过折弯连接；折叠 | 折弯 | 折弯；边折弯 | 折弯〔三〕 |
| 42 | Unfold / flat pattern 展开 | 展开 / 折叠；平展 / 取消平展 | 展开；创建展开模式 | 钣金表格和展开视图 | 展平；折回 | 伸直 / 重新折弯 / 展平实体 / 展平图样〔三〕 |
| 43 | Continuity G0/G1/G2 | 放样的起止约束：方向向量 / 垂直于轮廓 / 与面相切 / 与面的曲率；边界曲面可在两个方向上相切或曲率连续 | 斑纹分析（检验）；“分析曲面连续性”；草图“曲率”约束 | 草图“曲率”约束；放样和边界的条件名〔?〕 | 显示曲面曲率等曲率分析；边界混合的条件名〔?〕 | G0/G1/G2〔?〕 |

#### 1.3 表 B：Rhino 8 / FreeCAD / build123d / CadQuery

行号与表 A 对应。Rhino 栏格式为“中文菜单名（英文指令名）”。

| # | 概念 | Rhino 8 | FreeCAD（main 分支翻译） | build123d | CadQuery |
|---|---|---|---|---|---|
| 1 | 基准面 | 工作平面 CPlane〔?〕 | 基准面 | `Plane`（`Plane.XY`、`Plane.XZ`、`.offset()`） | `Workplane` / `workplane(offset=…)` |
| 2 | 基准轴 | — | 基准线 | `Axis`（如 `Axis.Z`） | —（用点或向量给定轴）〔?〕 |
| 3 | 基准点 | 点〔?〕 | 基准点 | `Vector` / `Location` / `Locations` | `Vector` 等〔?〕 |
| 4 | 草图 | —（曲线直接画在工作平面上）〔?〕 | 草图（Sketcher） | `BuildSketch` | `Sketch` / `Workplane` 的 2D 方法 |
| 5 | 构造几何 | — | 构造几何 / 辅助几何图形（命令译名不统一：“切换构造几何”和“切换辅助线”并存） | `Mode.PRIVATE`〔?〕 | `forConstruction=True` |
| 6 | 尺寸 | 尺寸标注（Dim，只标注不驱动） | 尺寸；距离、半径、直径、角度约束 | —（参数即 Python 变量） | Sketch 约束 `Length` / `Distance` / `Radius` |
| 7 | 完全/欠/过定义 | — | 完全约束的草图 / 约束不足 / 过度约束 | — | — |
| 8 | 拉伸 | 挤出（ExtrudeCrv：实体 > 挤出平面曲线 > 直线） | 凸台（Pad）；Part 工作台：拉伸 | `extrude()`（支持 `taper=`） | `extrude()` |
| 9 | 拉伸切除 | 差集（BooleanDifference） | 凹槽（Pocket） | `extrude(…, mode=Mode.SUBTRACT)` | `cutBlind()` / `cutThruAll()` |
| 10 | 旋转 | 旋转成形（Revolve）；沿着路径旋转（RailRevolve） | 旋转（新英文名 Revolve，旧名 Revolution）；挖槽（Groove） | `revolve()` | `revolve()` |
| 11 | 扫掠 | 单轨扫掠（Sweep1）；双轨扫掠（Sweep2） | 添加式管道 / 减料管道；Part 工作台：扫掠 | `sweep()` | `sweep()` |
| 12 | 放样 | 放样（Loft） | 添加式放样 / 减料放样；Part 工作台：放样 | `loft()` | `loft()` |
| 13 | 边界曲面 | 网线（NetworkSrf）；边缘曲线（EdgeSrf） | Surface 工作台〔?〕 | Gordon 曲面教程（Spitfire Wing） | `interpPlate`〔?〕 |
| 14 | 圆角 | 边缘圆角（FilletEdge，支持不等半径）；不等距曲面圆角（VariableFilletSrf） | 圆角 | `fillet()` | `fillet()` |
| 15 | 倒角 | 不等距边缘斜角（ChamferEdge） | 倒角 | `chamfer()` | `chamfer()` |
| 16 | 抽壳 | 薄壳（Shell） | 抽壳（Thickness；另有字符串译作“厚度”） | `offset(amount=-t, openings=…)` | `shell()` |
| 17 | 拔模 | —（只有“拔模角度分析”） | 拔模 | `draft()`；`extrude(taper=)` | `extrude(taper=)`〔?〕 |
| 18 | 筋 | — | —（无专用命令）〔?〕 | —（薄草图 + `extrude(until=Until.NEXT)`，见 Key Cap 示例） | — |
| 19 | 孔 | — | 孔（沉孔 / 埋头孔 / 带螺纹的） | `Hole` / `CounterBoreHole` / `CounterSinkHole` | `hole()` / `cboreHole()` / `cskHole()` |
| 20 | 螺旋/螺纹 | 弹簧线（Helix） | 添加式螺旋 / 减料螺旋；Part 工作台：螺旋体 | `Helix`；螺纹见 bd_warehouse 的 `IsoThread` 等 | `parametricCurve()`〔?〕 |
| 21 | 线性阵列 | 阵列（Array）〔菜单名?〕 | 线性阵列 | `GridLocations` / `Locations` | `rarray()` |
| 22 | 环形阵列 | 环形阵列（ArrayPolar）〔?〕 | 环形阵列 | `PolarLocations` | `polarArray()` |
| 23 | 镜像 | 镜像（Mirror，变动 > 镜像） | 镜像 | `mirror()` | `mirror()` / `mirrorX()` / `mirrorY()` |
| 24 | 布尔 | 联集 / 差集 / 交集（实体菜单）；布尔运算分割 | PartDesign：布尔运算；Part：并集 / 剪切 / 交集 | `Mode.ADD` / `Mode.SUBTRACT`；`Mode.INTERSECT`〔?〕 | `union()` / `cut()` / `intersect()` |
| 25 | 分割 | 分割（Split，编辑 > 分割） | 分割形状；布尔碎片；分离切片 | `split(bisect_by=…, keep=…)` | `split()` |
| 26 | 加厚 | 偏移曲面（OffsetSrf，可选生成实体） | 3D 偏移〔?〕 | `thicken()` | 〔?〕 |
| 27 | 偏移曲面 | 偏移曲面（OffsetSrf） | 3D 偏移；2D 偏移 | `offset()` | `offset2D()`（仅 2D） |
| 28 | 修剪/延伸 | 修剪（Trim，编辑 > 修剪）；延伸曲面（ExtendSrf） | 〔?〕 | 〔?〕 | — |
| 29 | 缝合 | 组合（Join，编辑 > 组合） | 形状构建器〔?〕 | 〔?〕 | — |
| 30 | 特征树/历史 | 记录建构历史（History）；没有特征树 | 模型树（Body + Tip）〔?〕 | 代码即历史（`BuildPart` 上下文） | 方法链（Workplane 栈） |
| 31 | 回滚 | — | 设置 Tip | — | — |
| 32 | 参数/配置 | —（参数化靠 Grasshopper）〔?〕 | 电子表格 / 表达式〔?〕 | Python 变量 | Python 变量 |
| 33 | 装配联接 | —（只有“块”）〔?〕 | Assembly 工作台：固定、旋转体（Revolute）、柱面、滑块、球窝、距离、平行、垂直、角度、齿轮、皮带、螺丝 | `RigidJoint` / `RevoluteJoint` / `LinearJoint` / `CylindricalJoint` / `BallJoint` | `Assembly.constrain`：`Point` / `Axis` / `Plane` / `PointInPlane` / `PointOnLine` / `FixedPoint` / `FixedRotation` / `FixedAxis` |
| 34 | 爆炸视图 | — | 爆炸视图 | — | — |
| 35 | BOM | — | 材料清单 | — | — |
| 36 | 剖切 | 截平面（ClippingPlane）；剖面（ClippingSections，Rhino 8 新功能） | 截面视图（TechDraw）；剖面 / 横截面（Part） | `section()` | 〔?〕 |
| 37 | 干涉 | 碰撞（Clash） | 〔?〕 | —（可求交） | `intersect()`（求交体） |
| 38 | 工程图视图 | 建立 2D 图面（Make2D） | 投影组 / 截面视图 / 局部视图（TechDraw） | 有 Technical Drawing Tutorial | `exportSvg()` / `toSvg()` |
| 39–42 | 钣金 | — | SheetMetal 插件〔中文名?〕 | `flange()` / `bend()` / `hem()` / `jog()` / `miter()` / `bend_relief()` / `corner_relief()` / `unfold()` / `sheet_shells()`（latest 文档） | — |
| 43 | 连续性 | 几何连续性（GCon）；斑马纹（Zebra）；曲率图形；匹配（MatchSrf）；混接曲面（BlendSrf）；不等距边缘混接（BlendEdge，曲率连续） | 〔?〕 | `Spline(tangents=…)` 控制端点切向 | 〔?〕 |

#### 1.4 表 C：草图约束对照

Creo 只核实到“草绘器约束”这个概念，各约束名〔?〕。NX 全部〔?〕。Rhino 没有参数化草图约束，靠物件锁点〔?〕。

SOLIDWORKS 一栏的说明：配合 PropertyManager 页核实了“重合、平行、垂直、相切、同心”这五个名字，但那是装配配合名；草图几何关系页的中文正文没能直接抓到，所以 SOLIDWORKS 列整体标〔?〕。

| 约束 | SOLIDWORKS | Fusion（“添加××约束”） | Onshape | FreeCAD | CadQuery `Sketch.constrain` |
|---|---|---|---|---|---|
| Coincident | 重合〔?〕 | 重合 | 重合 | 重合 | `Coincident` |
| Horizontal | 水平〔?〕 | 水平/竖直（同一命令） | 水平 | 水平 | `Orientation` |
| Vertical | 竖直〔?〕 | 同上 | 竖直 | 竖直（部分字符串误译为“垂直”） | `Orientation` |
| Parallel | 平行〔?〕 | 平行 | 平行 | 平行 | — |
| Perpendicular | 垂直〔?〕 | 垂直 | 垂直 | 垂直 | `Angle` |
| Tangent | 相切〔?〕 | 相切 | 相切 | 相切 | `Angle`（约束两条切线的夹角） |
| Equal | 相等〔?〕 | 等长 | 等长 | 相等 | — |
| Symmetric | 对称〔?〕 | 对称 | 对称 | 对称 | — |
| Concentric | 同心〔?〕 | 同心 | 同心 | 〔?〕 | — |
| Fix | 固定〔?〕 | 固定/取消固定 | 固定 | 锁定；固定约束（Block） | `FixedPoint` |
| Midpoint | 中点〔?〕 | 中点 | 中点 | — | — |
| Collinear | 共线〔?〕 | 共线 | 〔?〕 | — | — |
| Curvature (G2) | 〔?〕 | 曲率 | 曲率 | — | — |
| Normal / Pierce | 穿透〔?〕 | — | 法向；穿透 | — | — |

#### 1.5 来源清单（按列）

**SOLIDWORKS**（官方简体中文帮助，页面标题或正文经搜索结果核实）
- 行 8、9：拉伸工具在特征工具栏叫“拉伸凸台/基体”，菜单为插入 > 凸台/基体 > 拉伸；凸台、切除、曲面拉伸共用一个“拉伸 PropertyManager” — [拉伸 PropertyManager 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/r_extrude_propertymanager.htm)
- 行 10 — [旋转 PropertyManager 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_DVE_FEAT_REV.htm)
- 行 11 — [扫描凸台/基体 PropertyManager 2022](https://help.solidworks.com/2022/chinese-simplified/solidworks/sldworks/r_swept_boss_base_property_manager.htm)；[扫描切除 PropertyManager 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/r_swept_cut_property_manager.htm)；[曲面扫描 PropertyManager 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/r_surface_sweep_property_manager.htm)
- 行 12、43：放样有三个命令（放样凸台/基体、放样切除、放样曲面）；起止约束为方向向量、垂直于轮廓、与面相切、与面的曲率 — [放样 PropertyManager 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_FEAT_LOFT.htm)
- 行 13、43：边界曲面可在两个方向上相切或曲率连续，通常比放样质量好 — [边界曲面 2019](https://help.solidworks.com/2019/chinese-simplified/SolidWorks/sldworks/c_boundary_surface.htm)；[边界 PropertyManager 2024](https://help.solidworks.com/2024/Chinese-simplified/SolidWorks/sldworks/r_boundary_pm.htm)
- 行 14：有“手工”和 FilletXpert 两种模式 — [圆角 PropertyManager 2018](https://help.solidworks.com/2018/Chinese-simplified/SolidWorks/sldworks/HIDD_DVE_FILLET_DLG2.htm)
- 行 15 — [倒角 PropertyManager 2025](https://help.solidworks.com/2025/chinese-simplified/SolidWorks/sldworks/r_chamfer_pm.htm)
- 行 16 — [抽壳 2022](https://help.solidworks.com/2022/Chinese-simplified/SolidWorks/Sldworks/c_Shells_Folder.htm)
- 行 17：类型为中性面、分型线、阶梯拔模 — [拔模 PropertyManager 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_DRAFT.htm)
- 行 18：筋分线性、自然两种类型；入口为插入 > 特征 > 筋 — [筋 PropertyManager 2018](https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/HIDD_FEAT_RIB.htm)
- 行 19 — [异型孔向导概述 2025](https://help.solidworks.com/2025/chinese-simplified/SolidWorks/sldworks/c_Hole_Wizard_Overview.htm)
- 行 20 — [螺旋线和涡状线 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/Sldworks/c_Helix_and_Spiral.htm)；[螺纹 PropertyManager 2024](https://help.solidworks.com/2024/Chinese-simplified/SolidWorks/sldworks/r_thread_propertymanager.htm)
- 行 21：线性阵列的入口为“插入 > 阵列/镜向 > 线性阵列” — [线性阵列 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/t_Linear_Patterns_Overview.htm)；2021 版页面有“到参考”选项 — [线性阵列 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/t_Linear_Patterns_Overview.htm)
- 行 22：菜单为插入 > 阵列/镜向 > 圆周阵列；“等间距”选项把角度设为 360° — [圆周阵列 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/hidd_cpattern.htm)
- 行 1、23：页名为“镜向特征 PropertyManager”；正文中另有“镜像”和“插入 > 阵列/镜像”的写法；镜像基准选择框名为“镜向面/基准面” — [镜向特征 PropertyManager 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_DVE_FEAT_MIRROR.htm)
- 行 28：剪裁曲面有“标准”和“相互”两种类型 — [剪裁曲面 2018](https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/HIDD_FEAT_TRIM_REF_SURFACE.htm)
- 行 29 — [缝合曲面 2022](https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_KNIT_SURFACE.htm)
- 行 26、27：“等距曲面”“加厚”只在曲面特征相关页面的帮助导航中出现，没有找到独立页面
- 行 5 — [构造几何线 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_Construction_Geometry.htm)
- 行 7 — [完全定义草图 2020](https://help.solidworks.com/2020/Chinese-simplified/SolidWorks/sldworks/c_Fully_Defined_Sketches.htm)；[草图几何关系常见问题 2024](https://help.solidworks.com/2024/chinese-simplified/SWConnected/swdotworks/c_FAQ_Sketch_Relations.htm)；[词汇表 2011](https://help.solidworks.com/2011/Chinese-simplified/SolidWorks/sldworks/AllContent/SolidWorks/Core/Overview/glossary_solidworks_main.htm?id=513fa8dc103c42e1b072c1c408a729af)
- 行 6、31：中文“入门”PDF 里写作“智能尺寸”和“退回控制条” — [SOLIDWORKS 入门 PDF](https://my.solidworks.com/solidworks/guide/SOLIDWORKS_Introduction_CN.pdf)
- 行 30、31：帮助正文写作“退回控制棒”；拖动特征重排会改变重建顺序 — [FeatureManager 设计树概述 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_featuremanager_design_tree_overview.htm)
- 行 32：系列零件设计表可控制尺寸、压缩状态、方程式等 — [系列零件设计表配置 2025](https://help.solidworks.com/2025/Chinese-simplified/SolidWorks/sldworks/c_Design_Table_Configurations.htm)
- 行 33：标准配合的名称 — [配合 PropertyManager 2020](https://help.solidworks.com/2020/chinese-simplified/SolidWorks/sldworks/HIDD_NEW_ADD_MATE.htm)
- 行 34：每个配置都可以有多个爆炸视图 — [生成爆炸视图 2018](https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/t_Creating_Exploded_Views.htm)；[爆炸视图 2022](https://help.solidworks.com/2022/chinese-simplified/SolidWorks/acadhelp/c_Exploded_Views.htm)
- 行 35、36、37：材料明细表、剖面视图、干涉检查三个词条 — [词汇表 2017](https://help.solidworks.com/2017/chinese-simplified/solidworks/sldworks/g_glossary.htm)；[装配体剖切视图 2025](https://help.solidworks.com/2025/chinese-simplified/SolidWorks/sldworks/t_Assembly_Cutaway_Views.htm)
- 行 39、42：基体法兰是新钣金零件的第一个特征；该主题列表里有“展开/折叠” — [基体法兰/薄片 2023](https://help.solidworks.com/2023/chinese-simplified/SolidWorks/sldworks/c_base_flange_tab.htm)
- 行 40、42：边线法兰页里使用了“平展/取消平展” — [边线法兰 2022](https://help.solidworks.com/2022/chinese-simplified/solidworks/sldworks/c_edge_flanges.htm)

**Fusion**（官方 CHS 帮助命令页里的菜单路径）
- 行 1–3 — [偏移平面](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CONSTRUCT-OFFSET-PLANE.htm)；[通过两点创建轴](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CONSTRUCT-AXIS-THROUGH-TWO-POINTS.htm)；[位于顶点处的点](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CONSTRUCT-POINT-AT-VERTEX.htm)
- 行 5 “创建构造几何图元”、表 C 全部约束名（“添加水平/竖直约束”“添加等长约束”等）、行 35 “BOM 表”、行 32 “配置表”：均为目录条目 — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- 行 6 — [草图尺寸](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-CREATE-DIMENSIONS.htm)
- 行 7：草图完全约束时浏览器图标显示红锁，几何由蓝变黑 — [完全定义和约束草图](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-FULLY-DEFINE-CONSTRAIN-SKETCH.htm)
- 行 8、10、11、12：菜单为“实体 > 创建 > 拉伸/旋转/扫掠/放样” — [拉伸实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-EXTRUDE-SOLID.htm)；[旋转实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-REVOLVE-SOLID.htm)；[扫掠实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SWEEP-SOLID.htm)；[对实体放样](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-LOFT-SOLID.htm)
- 行 13 — [边界实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CREATE-BOUNDING-SOLID.htm)；[面片（曲面 > 创建 > 面片）](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/SFC-PATCH.htm)
- 行 14–17：菜单为“设计 > 实体 > 修改 > 圆角/倒角/抽壳/拔模” — [创建圆角](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-FILLET-SOLID.htm)；[创建倒角](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CHAMFER-SOLID.htm)；[抽壳实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-83A14252-0009-42AA-AE7E-435F595DE41B.htm)；[创建拔模](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-83C650C2-E602-4BBC-AC9A-AB9A96F07B72.htm)
- 行 18：“加强筋”从开放草图轮廓沿平行于草图平面的方向生成薄特征，延伸到最近的实体面；“网状加强筋”方向垂直于草图平面 — [创建加强筋](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-RIB.htm)；[创建网状加强筋](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-WEB.htm)
- 行 19、20 — [孔](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-0DFCBD4F-5130-4CC9-B1A7-23C88147752A.htm)；[螺纹](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-7BD8CD24-27C1-4427-8499-29CC6827B902.htm)；[螺旋](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-COIL-SOLID.htm)
- 行 21–23 — [矩形阵列](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-9622573F-06FA-462F-AFA7-97CD0C7AA0C9.htm)；[环形阵列](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-195A1C75-1C94-47AE-A10F-DBCC17C2A212.htm)；[镜像（页标题误译为“镜像整个平面”，菜单为“创建 > 镜像”）](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-77CE43FF-47C6-429A-B872-BA80B348CCC3.htm)
- 行 24–26 — [合并](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-COMBINE.htm)；[分割实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SPLIT-BODY-SOLID.htm)；[加厚](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-471827A2-EDAE-411B-A1F5-C87B54615D53.htm)
- 行 27–29 — [偏移曲面](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/SFC-OFFSET.htm)；[修剪](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/SFC-TRIM.htm)；[延伸](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/SFC-EXTEND.htm)；[缝合](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/SFC-STITCH.htm)
- 行 30 — [使用时间轴](https://help.autodesk.com/cloudhelp/CHS/Fusion-Designs/files/ASM-USE-TIMELINE.htm)
- 行 32 — [更改参数](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MODIFY-CHANGE-PARAMETERS.htm)
- 行 33：菜单为“设计 > 实体 > 装配 > 联接/快速联接” — [创建联接](https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-CREATE-JOINT.htm)；[创建快速联接](https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-CREATE-AS-BUILT-JOINT.htm)
- 行 34：菜单为“变换 > 手动分解”和“变换 > 自动分解：所有级别” — [手动分解模型](https://help.autodesk.com/cloudhelp/CHS/Fusion-Animate/files/ANI-EXPLODE-MANUAL.htm)；[分解模型的所有级别](https://help.autodesk.com/cloudhelp/CHS/Fusion-Animate/files/ANI-EXPLODE-ALL-LEVELS.htm)
- 行 36、37、43：菜单为“检验 > 截面分析 / 干涉 / 斑纹分析” — [截面分析](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SECTION-ANALYSIS.htm)；[干涉](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-INTERFERENCE.htm)；[斑纹分析](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-3F8BA6D3-5DF2-49FA-BE7D-8CCEF718C795.htm)
- 行 38：菜单为“创建 > 基础视图” — [创建基础视图](https://help.autodesk.com/cloudhelp/CHS/Fusion-Drawing/files/GUID-CB93FAA6-F363-4F61-A292-F06510F16ADC.htm)
- 行 39–42：钣金选项卡下的“创建 > 凸缘 / 折叠 / 创建展开模式”和“修改 > 展开” — [凸缘](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sheet-Metal/files/SM-CREATE-BASE-EDGE-CONTOUR-FLANGE.htm)；[折叠](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sheet-Metal/files/GUID-D11BA900-A40A-4EC2-85E1-01CBF6BF642C.htm)；[展开](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sheet-Metal/files/GUID-5125C823-D9CC-4086-93E0-8A2D6EB5E55B.htm)；[展开模式](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sheet-Metal/files/GUID-7EBD9424-C264-4B0B-9655-811454A922E9.htm)

**Onshape**（中文帮助页标题）
- 实体与曲面特征：
  - [拉伸](https://cad.onshape.com/help/zh_CN/Content/PartStudio/extrude.htm)、[旋转](https://cad.onshape.com/help/zh_CN/Content/PartStudio/revolve.htm)、[扫掠](https://cad.onshape.com/help/zh_CN/Content/PartStudio/sweep.htm)、[放样](https://cad.onshape.com/help/zh_CN/Content/PartStudio/loft.htm)、[边界曲面](https://cad.onshape.com/help/zh_CN/Content/PartStudio/boundary_surface.htm)
  - [圆角](https://cad.onshape.com/help/zh_CN/Content/PartStudio/fillet.htm)、[倒角](https://cad.onshape.com/help/zh_CN/Content/PartStudio/chamfer.htm)、[抽壳](https://cad.onshape.com/help/zh_CN/Content/PartStudio/shell.htm)、[拔模](https://cad.onshape.com/help/zh_CN/Content/PartStudio/draft.htm)、[肋材](https://cad.onshape.com/help/zh_CN/Content/PartStudio/rib.htm)、[孔](https://cad.onshape.com/help/zh_CN/Content/PartStudio/hole.htm)、[螺旋](https://cad.onshape.com/help/zh_CN/Content/PartStudio/helix.htm)
  - [线性阵列](https://cad.onshape.com/help/zh_CN/Content/PartStudio/linear_pattern.htm)、[环形阵列](https://cad.onshape.com/help/zh_CN/Content/PartStudio/circular_pattern.htm)、[镜像](https://cad.onshape.com/help/zh_CN/Content/PartStudio/mirror.htm)、[布尔运算](https://cad.onshape.com/help/zh_CN/Content/PartStudio/boolean.htm)、[分割](https://cad.onshape.com/help/zh_CN/Content/PartStudio/split.htm)
  - [加厚](https://cad.onshape.com/help/zh_CN/Content/PartStudio/thicken.htm)、[偏移曲面](https://cad.onshape.com/help/zh_CN/Content/PartStudio/offset_surface.htm)、[封闭](https://cad.onshape.com/help/zh_CN/Content/PartStudio/enclose.htm)、[填充](https://cad.onshape.com/help/zh_CN/Content/PartStudio/fill.htm)、[移动面](https://cad.onshape.com/help/zh_CN/Content/PartStudio/move_face.htm)
  - [平面](https://cad.onshape.com/help/zh_CN/Content/PartStudio/plane.htm)、[变量](https://cad.onshape.com/help/zh_CN/Content/PartStudio/variable.htm)、[配置](https://cad.onshape.com/help/zh_CN/Content/PartStudio/configurations.htm)
- 行 30、31：特征列表位于窗格左侧，粗栏为“回滚条” — [Part Studio](https://cad.onshape.com/help/zh_CN/Content/PartStudio/part_studios.htm)
- 草图：
  - [草图工具](https://cad.onshape.com/help/zh_CN/Content/Sketch/sketch_tools.htm)、[构造](https://cad.onshape.com/help/zh_CN/Content/Sketch/construction.htm)、[尺寸](https://cad.onshape.com/help/zh_CN/Content/Sketch/dimension.htm)
  - 约束：[重合](https://cad.onshape.com/help/zh_CN/Content/Sketch/coincident.htm)、[等长](https://cad.onshape.com/help/zh_CN/Content/Sketch/equal.htm)、[穿透](https://cad.onshape.com/help/zh_CN/Content/Sketch/pierce.htm)、[曲率](https://cad.onshape.com/help/zh_CN/Content/Sketch/curvature.htm)
  - 水平、竖直、平行、垂直、相切、对称、同心、固定、中点、法向同样核实过，URL 规则相同：`Sketch/<英文名>.htm`
- 装配：
  - [配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/mates.htm)；该页内链文字“嵌合连接器”和“配合连接器”两种写法并存
  - [紧固配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/fastened_mate.htm)、[旋转配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/revolute_mate.htm)、[销槽配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/pin_slot_mate.htm)、[宽度配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/width_mate.htm)
  - [嵌合连接器](https://cad.onshape.com/help/zh_CN/Content/PartStudio/mate_connector.htm)、[分解视图](https://cad.onshape.com/help/zh_CN/Content/Assembly/exploded_views.htm)
- 工程图与视图：[物料清单表格](https://cad.onshape.com/help/zh_CN/Content/Drawing/bom_table.htm)、[视图](https://cad.onshape.com/help/zh_CN/Content/Drawing/views.htm)、[投影视图](https://cad.onshape.com/help/zh_CN/Content/Drawing/projected_view.htm)、[剖视图](https://cad.onshape.com/help/zh_CN/Content/View/section_view.htm)
- 行 39–42：钣金模型页列出了法兰、折弯、折弯止裂槽、拐角、卷边、转折、薄片、成型、结束钣金模型、钣金表格和展开视图，以及“默认折弯 K 系数” — [钣金模型](https://cad.onshape.com/help/zh_CN/Content/PartStudio/sheet_metal_model.htm)

**Creo 12**（简体中文帮助索引页里的条目名）
- 零件建模：拉伸、拉伸切口、旋转、旋转切口、扫描、螺旋扫描、混合、平行混合、旋转混合、扫描混合、孔、倒圆角、自动倒圆角、倒角、拐角倒角、拔模、可变拖拉方向拔模、壳、轮廓筋、轨迹筋、环形折弯、骨架折弯、修饰螺纹、阵列、镜像、修剪、合并、延伸、偏移、相交、加厚、实体化、唇、耳、草绘器约束、基准平面、基准轴、基准点、合并主体、相交主体 — [part_modeling](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/part_modeling.html)
- 装配：元件放置、放置约束、重合约束、预定义约束集、骨架模型、分解视图（含偏距线）、装配横截面、装配物料清单 (BOM) — [assembly](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/assembly.html)
- 钣金：平面壁、平整壁、法兰壁、边折弯、折弯、展平、折回、折弯止裂槽、拐角止裂槽、折弯表 — [sheetmetal](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/sheetmetal.html)
- 曲面：边界混合、造型（Style） — [surfacing](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/surfacing.html)
- 基础：模型树、关系、用户参数、族表、横截面、全局干涉、曲率显示 — [fundamentals](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/fundamentals.html)
- 绘图：绘图视图 — [detail](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/detail.html)

**NX**（大多为第三方来源；官方来源单独注明）
- 菜单路径“插入 > 网格曲面 > 通过曲线组”“插入 > 细节特征 > 边倒圆”；镜像特征在“插入 > 关联复制”下；还提到“扫掠”（NX 2406） — [CSDN NX 2406 扫掠](https://blog.csdn.net/weixin_43911798/article/details/145258593)
- 菜单路径“插入 > 关联复制 > 阵列特征”，以及“拔模”“拉伸”的用法 — [QQ阅读《UG NX 1904 从入门到精通》](https://m.inf.qq.com/read/1040778437/23)
- 倒斜角、边倒圆、拔模都属于“细节特征” — [某高校“UG/NX 建模知识测试”](https://znzzgcxy.jxue.edu.cn/2026/0424/c324a45944/page.htm)
- “边倒圆”命令概述（看起来是转述的官方帮助） — [格发：边倒圆详解](https://www.gofarlic.com/techArticleDetail?noticeId=358500)
- 有一个工具条包含“圆角、合并、拉伸、拆分体、删除体、抽壳” — [博客园：我的 NX 环境设置](https://www.cnblogs.com/dapenson/p/15915684.html)
- NX 12 的 11 种装配约束：接触对齐、角度、中心、胶合、等尺寸配对（适合）、对齐/锁定、同心、距离、固定、平行、垂直 — [清华大学出版社 NX 12.0 教材样章](http://www.tup.tsinghua.edu.cn/upload/books/yz/082155-01.pdf)
- 钣金课程大纲：突出块、弯边、轮廓弯边、放样弯边、法向除料、折弯、二次折弯、伸直、重新折弯、展平实体 — [博客园 NX 教程大纲](https://www.cnblogs.com/ermudongmu/p/7439326.html)
- “展平实体”的操作步骤 — [百度经验](https://jingyan.baidu.com/article/22fe7ced393b0e7102617fa3.html)
- NX12 新增“突出块”功能，展平图样功能有增强 — [格发：NX12 钣金](https://www.gofarlic.com/techArticleDetail?noticeId=217429&s=%E5%85%A8%E9%83%A8)
- **官方中文资料**：NX 2312 新增功能页提到“通过曲线组和桥接曲面增强功能”和“缝合增强功能” — [NX 2312 新增功能（docs.sw.siemens.com zh-CN）](https://docs.sw.siemens.com/zh-CN/doc/209349590/PL20230425446868577.whatsnew/xid1851820)
- **官方中文资料**：NX 10 新功能资料提到边倒圆、面倒圆等工具，并支持 G2 连续 — [Siemens NX 10 新功能 PDF](https://www.plm.automation.siemens.com/zh_cn/Images/Siemens-PLM-Whats-New-in-NX-10-fs-ZH-Y17-HR_tcm78-228755.pdf)

**Rhino 8**（zh-cn 帮助“功能表”一栏）
- [ExtrudeCrv](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/extrudecrv.htm)、[Revolve](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/revolve.htm)、[RailRevolve](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/railrevolve.htm)、[Sweep1](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/sweep1.htm)、[Sweep2](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/sweep2.htm)、[Loft](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/loft.htm)
- [NetworkSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/networksrf.htm)、[EdgeSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/edgesrf.htm)、[BlendSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/blendsrf.htm)、[MatchSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/matchsrf.htm)、[ExtendSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/extendsrf.htm)
- [OffsetSrf（页内含 Shell = 薄壳）](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/offsetsrf.htm)、[FilletEdge](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/filletedge.htm)、[ChamferEdge](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/chamferedge.htm)、[BlendEdge](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/blendedge.htm)、[VariableFilletSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/variablefilletsrf.htm)
- [BooleanUnion（页内含差集、交集、布尔运算分割）](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/booleanunion.htm)、[Split](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/split.htm)、[Trim](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/trim.htm)、[Join](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/join.htm)、[Cap](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/cap.htm)
- [Mirror](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/mirror.htm)、[Array](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/array.htm)、[Helix](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/helix.htm)
- [GCon](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/gcon.htm)、[Zebra](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/zebra.htm)、[Curvature（含曲率图形）](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/curvature.htm)、[DraftAngleAnalysis](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/draftangleanalysis.htm)、[Clash](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/clash.htm)
- [ClippingPlane（含 Rhino 8 的剖面功能）](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/clippingplane.htm)、[Make2D](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/make2d.htm)、[History](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/history.htm)

**FreeCAD**（官方仓库翻译文件）
- [PartDesign_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/PartDesign/Gui/Resources/translations/PartDesign_zh-CN.ts)：凸台、凹槽、旋转、挖槽、添加式放样/管道/螺旋、减料放样/管道/螺旋、孔（沉孔、埋头孔、带螺纹的）、圆角、倒角、拔模、抽壳、镜像、线性阵列、环形阵列、多重变换、布尔运算、基准面/基准线/基准点、设置 Tip、渐开线齿轮、链轮
- [Sketcher_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Sketcher/Gui/Resources/translations/Sketcher_zh-CN.ts)：表 C 中的约束名，以及完全约束的草图、约束不足、过度约束、切换构造几何、修剪边、外部几何图形
- [Part_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Part/Gui/Resources/translations/Part_zh-CN.ts)：拉伸、旋转、放样、扫掠、并集、剪切、交集、分割、布尔碎片、分离切片、厚度、3D 偏移、2D 偏移、剖面、横截面、螺旋体、直纹曲面、形状构建器、检查几何
- [Assembly_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Assembly/Gui/Resources/translations/Assembly_zh-CN.ts)：表 B 行 33 的联接名，以及爆炸视图、材料清单、插入零件、解算装配体
- [TechDraw_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/TechDraw/Gui/Resources/translations/TechDraw_zh-CN.ts)：投影组、截面视图、局部视图

**build123d**
- 操作表：bend、bend_relief、chamfer、corner_relief、draft、extrude、fillet、flange、full_round、hem、jog、miter、loft、make_face、make_hull、mirror、offset、project_to_plane、revolve、scale、section、sheet_shells、split、sweep、thicken、trace、unfold — [Operations](https://build123d.readthedocs.io/en/latest/operations.html)
- Hole、CounterBoreHole、CounterSinkHole、Helix、PolarLocations、GridLocations、HexLocations — [Cheat Sheet](https://build123d.readthedocs.io/en/latest/cheat_sheet.html)
- Rigid、Revolute、Linear、Cylindrical、Ball 五种 Joint — [Joints](https://build123d.readthedocs.io/en/latest/joints.html)
- 教程列表含 Drawing with Constraints、Technical Drawing Tutorial、Surface Modeling、Spitfire Wing with Gordon Surface — [Tutorials](https://build123d.readthedocs.io/en/latest/tutorials.html)

**CadQuery**
- Workplane 方法，例如 extrude、cutBlind、cutThruAll、revolve、sweep、loft、twistExtrude、fillet、chamfer、shell、hole、cboreHole、cskHole、rarray、polarArray、mirror、mirrorX、mirrorY、union、cut、intersect、split、offset2D、parametricCurve、placeSketch、exportSvg — [API Reference](https://cadquery.readthedocs.io/en/latest/apireference.html)
- 草图约束 FixedPoint、Coincident、Angle、Length、Distance、Radius、Orientation、ArcAngle，文档标注为实验性 — [Sketch](https://cadquery.readthedocs.io/en/latest/sketch.html)
- 装配约束 Point、Axis、Plane、PointInPlane、PointOnLine、FixedPoint、FixedRotation、FixedAxis — [Assemblies](https://cadquery.readthedocs.io/en/latest/assy.html)

#### 1.6 官方译名里的坑与不一致（直接影响 UI 标签）
- **Fusion 的 Rib 叫“加强筋”。** 当前 CHS 帮助全目录 5,862 条里“肋”字出现 0 次，加强筋页和网状加强筋页也都没有“肋”。委托方示例中的“肋”应改为“加强筋” — [创建加强筋](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-RIB.htm)
- **Fusion 的“边界实体”不是边界曲面。** 它的菜单是“实体 > 创建 > 边界实体”，不要和 SOLIDWORKS 的“边界曲面”或 Creo 的“边界混合”对应起来 — [创建边界实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CREATE-BOUNDING-SOLID.htm)
- **Fusion 的斑马分析叫“斑纹分析”**，而 Rhino 叫“斑马纹” — [斑纹分析](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-3F8BA6D3-5DF2-49FA-BE7D-8CCEF718C795.htm)；[Rhino Zebra](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/zebra.htm)
- **Fusion 的 BOM 在两处叫法不同。** 设计里叫“BOM 表”；官方工程图教程标题里叫“明细表”（教程名：创建具有多个视图、尺寸标注、明细表和引出序号的工程图） — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- **SOLIDWORKS 的“镜向”和“镜像”并存。** 同一帮助体系里既有“镜向特征 PropertyManager”和“插入 > 阵列/镜向”，也有正文中的“镜像”和“插入 > 阵列/镜像” — [镜向特征 PropertyManager 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_DVE_FEAT_MIRROR.htm)；[圆周阵列 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/hidd_cpattern.htm)
- **SOLIDWORKS 的同心配合有两种写法。** 界面标签为“同心”，正文中也出现“同轴心” — [配合 PropertyManager 2020](https://help.solidworks.com/2020/chinese-simplified/SolidWorks/sldworks/HIDD_NEW_ADD_MATE.htm)
- **SOLIDWORKS 的回滚工具名称不一。** 帮助正文作“退回控制棒”，入门 PDF 作“退回控制条”，繁体版作“回溯控制棒” — [FeatureManager 设计树概述 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_featuremanager_design_tree_overview.htm)；[SOLIDWORKS 入门 PDF](https://my.solidworks.com/solidworks/guide/SOLIDWORKS_Introduction_CN.pdf)
- **SOLIDWORKS 官方写“异型孔向导”**，第三方教程常写成“异形孔向导” — [异型孔向导概述 2025](https://help.solidworks.com/2025/chinese-simplified/SolidWorks/sldworks/c_Hole_Wizard_Overview.htm)；[溪风博客](https://xifengboke.com/post/588.html)
- **SOLIDWORKS 繁体版术语差异较大。** 例如“伸長”对应拉伸，“填料/基材”对应凸台/基体，抓资料时要避开 /Chinese/ 路径 — [伸長 PropertyManager 2012（繁体）](https://help.solidworks.com/2012/Chinese/SolidWorks/sldworks/Extrude_PropertyManager.htm)
- **SOLIDWORKS 的“干涉检查”指代两件事。** 官方词汇表把 Collision Detection 和 interference detection 都译成“干涉检查”，入门 PDF 则把 Collision Detection 译成“碰撞检查” — [词汇表 2011](https://help.solidworks.com/2011/Chinese-simplified/SolidWorks/sldworks/AllContent/SolidWorks/Core/Overview/glossary_solidworks_main.htm?id=513fa8dc103c42e1b072c1c408a729af)
- **Onshape 的 Rib 叫“肋材”；Mate connector 有“嵌合连接器”和“配合连接器”两种写法** — [肋材](https://cad.onshape.com/help/zh_CN/Content/PartStudio/rib.htm)；[配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/mates.htm)
- **FreeCAD 翻译内部不一致，例子如下** — [Sketcher_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Sketcher/Gui/Resources/translations/Sketcher_zh-CN.ts)；[PartDesign_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/PartDesign/Gui/Resources/translations/PartDesign_zh-CN.ts)；[Assembly_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Assembly/Gui/Resources/translations/Assembly_zh-CN.ts)
  - Vertical 有时译“垂直”、有时译“竖直约束”。
  - Thickness 有时译“抽壳”、有时译“厚度”。
  - Additive 有时译“添加式”、有时译“增料”。
  - Revolute 联接译成了“旋转体”。
  - Body 没有翻译。
  - Revolution 已改名为 Revolve（中文“旋转”）。
- **Creo 的“混合”（Blend）属于放样类**，Rhino 的“混接曲面”（BlendSrf）是过渡曲面，两者是不同概念 — [Creo part_modeling](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/part_modeling.html)；[Rhino BlendSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/blendsrf.htm)

### Inferences
- **站内主标签建议**：采用多数派的中性名，tooltip 再列出各软件的官方名。
  - 拉伸 / 拉伸切除 / 旋转
  - 扫掠（SOLIDWORKS、Creo 叫“扫描”；“扫描”容易被误读为 scan，所以不选它做主标签）
  - 放样（Creo 叫混合，NX 叫通过曲线组）
  - 边界曲面（Creo 叫边界混合，Rhino 叫网线）
  - 圆角（Creo 叫倒圆角，NX 叫边倒圆）
  - 倒角（NX 叫倒斜角）
  - 抽壳（Creo 叫壳，Rhino 叫薄壳）
  - 拔模
  - 筋（Fusion 叫加强筋，Onshape 叫肋材，Creo 叫轮廓筋/轨迹筋）
  - 孔（SOLIDWORKS 叫异型孔向导）
  - 线性阵列（Fusion 叫矩形阵列）
  - 环形阵列（SOLIDWORKS 叫圆周阵列）
  - 镜像（SOLIDWORKS 叫镜向）
  - 布尔：合并 / 减去 / 相交（Rhino 叫联集/差集/交集，FreeCAD 叫并集/剪切/交集）
  - 分割、加厚
  - 偏移曲面（SOLIDWORKS 叫等距曲面，NX 叫偏置曲面）
  - 修剪 / 延伸
  - 缝合（Rhino 叫组合）
  - 特征树、回滚
  - 参数 / 方程式 / 配置
  - 配合 / 联接
  - 爆炸视图（Onshape、Creo 叫分解视图）
  - 物料清单（BOM）
  - 剖视图、干涉检查
  - 基体法兰 / 边线法兰 / 折弯 / 展开
  - 连续性：G0 位置连续、G1 相切连续、G2 曲率连续。G0/G1/G2 的中文说法各家帮助都没有统一 UI 名，这里是根据 Rhino“几何连续性”和 SOLIDWORKS“相切/曲率”的写法推断的。
- **tooltip 建议结构**：中文主标签 + 一句话定义 + 各软件官方名（附菜单路径）+ 代码 API 名。Rhino 要同时给中文菜单名和英文指令名，因为 Rhino 用户常在命令行直接输入英文指令。FreeCAD 建议保留英文原名，因为中文译名不稳定。
- **NX 列在 UI 上应标“据常见中文教程”**，等拿到官方中文界面截图后再去掉标记；NX 是国内制造业的主力软件，这一列值得专门补一次截图核实。
- **术语表要带版本和日期。** 本次已经看到版本漂移的例子：FreeCAD 把 Revolution 改名为 Revolve；SOLIDWORKS 同一帮助中镜向/镜像并存。按 `软件 × 版本 × 术语` 存储，便于以后更新。
- **SOLIDWORKS 帮助站拒绝脚本抓取（403）。** 如果要给 SOLIDWORKS 做“查看官方帮助”链接，可以直接链到 `help.solidworks.com/<年>/chinese-simplified/...` 页面供用户浏览器打开，但没法自动同步内容。

### Gaps
- **NX**：docs.sw.siemens.com 的中文帮助是 JS 渲染，脚本抓不到正文，搜索也没有命中官方命令页。以下名称都没能对照官方 zh-CN 核实：基准平面、草图约束名、筋板、孔、螺纹、减去、相交、修剪体、加厚、偏置曲面、通过曲线网格、部件导航器、表达式、明细表、剖视图、干涉、G0/G1/G2。
- **Creo**：没有核实到草绘器里各约束的中文名、阵列子类型名、“插入模式”名称、边界混合的相切/曲率条件名。
- **SOLIDWORKS**：
  - 草图几何关系的逐项中文名没有核实（只核实了配合名）。
  - 异型孔向导的子类型（柱形沉头孔、锥形沉头孔、直螺纹孔等）、变半径圆角的名称、“组合”“分割”“延伸曲面”“平板型式”“绘制的折弯”都没有找到官方页面。
  - 2024/2025 版界面里到底显示“镜向”还是“镜像”，需要截图确认。
- **Onshape**：曲面修剪/延伸、干涉检测、孔子类型、放样/边界的连续性条件名没有找到。
- **Fusion**：拉伸“操作”下拉项（合并/剪切/相交/新建实体）、孔类型、圆角类型的中文名没有逐页核实。
- **FreeCAD**：SheetMetal 是外部插件，翻译不在主仓库；Surface 工作台的名称没有抓取。
- **Rhino**：Array / ArrayPolar 的中文菜单路径和 CPlane 的中文名没有提取出来。

## 问题 2：经典教学对象的标准建模序列、可做滑块的参数与范围

### Takeaway
可直接复用、带公开参数的“标准拆解”来源有三类：
- 开源代码示例：OCCT MakeBottle、build123d 的 Tea Cup / Key Cap / Lego / Joint 教程、CadQuery 的 Bottle / Lego / Pillow Block / Parametric Enclosure、bd_warehouse 的齿轮、紧固件、轴承、法兰、螺纹。
- 厂商官方教程：SOLIDWORKS 的 Tutor1 / 烛台 / 凿子，Fusion 中文帮助里的铁铲曲面、钣金、夹具装配教程。
- 练习题库：TTT、CSWA。

这些来源的参数天然就是滑块候选，而且多数有默认值可做滑块中点。手电筒、按动笔、台灯、凳子没有找到权威教程，只能自行设计（见 Inferences）。

### Cited Findings

**① 瓶子：OCCT MakeBottle**
来源：[OCCT Tutorial](https://dev.opencascade.org/doc/overview/html/occt__tutorial.html)
- 规格：瓶高 myHeight = 70 mm，瓶宽 myWidth = 50 mm，瓶厚 myThickness = 30 mm；轮廓以原点为中心。
- 建模分四大步：轮廓 → 瓶身 → 瓶颈螺纹 → 结果复合体。
- 序列：
  1. 在 XOY 平面定义支撑点，先建几何，再建拓扑，补全轮廓。
  2. 用 BRepPrimAPI_MakePrism 把轮廓面拉成棱柱，即拉伸。
  3. 对所有边倒圆角，半径 = 厚度/12（BRepFilletAPI_MakeFillet）。
  4. 加圆柱瓶颈，半径 = 厚度/4，高 = 瓶高/10（BRepPrimAPI_MakeCylinder）。
  5. 用 BRepAlgoAPI_Fuse 把瓶颈和瓶身融合。
  6. 去掉顶面做开口，抽壳偏移 −厚度/50（BRepOffsetAPI_MakeThickSolid）。
  7. 做螺纹：在圆柱面上定义 2D 椭圆曲线（长半轴 2π，短半轴 = 瓶颈高/10，另一条为其 1/4），生成边和线框后用 BRepOffsetAPI_ThruSections 放样。
  8. 组成复合体。

**② 瓶子简化版：CadQuery Classic OCC Bottle**
来源：[CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- 参数：(L, w, t) = (20, 6, 3)。
- 序列：用 vLine → threePointArc → vLine 画半轮廓 → mirrorX 补全 → 拉伸 30 → 在顶面质心处画半径 3 的圆，拉伸 2 作瓶颈 → 顶面 shell(0.3)。

**③ 茶杯 / 马克杯：build123d Tea Cup**
来源：[build123d Examples](https://build123d.readthedocs.io/en/latest/examples_1.html)
- 参数：壁厚 wall_thickness = 3 mm；圆角半径 fillet_radius = 0.49 × 壁厚。
- 序列：
  1. 在 XZ 平面画半剖面：一条样条（从 (30, 10) mm 到 (69, 105) mm，端点给切向）加折线，再 make_face。
  2. 绕 Z 轴 revolve。
  3. 用 offset(−壁厚, openings=所有平面面) 抽壳，上下都开口。
  4. 在底部加一个圆柱作杯底，厚度等于壁厚。
  5. 对全部边 fillet。
  6. 用水平射线求交，找到杯壁在 35 mm 和 80 mm 高度处的点。
  7. 在 XZ 平面画样条作把手路径。
  8. 在路径起点放圆角矩形截面（壁厚 × 8 mm），sweep 出把手。
- Fusion 入门的马克杯做法（第三方）：先建 Ø60 × 40 mm 圆柱，再放样、抽壳 2 mm，把手用样条加圆截面放样 — [Instructables](https://www.instructables.com/Creating-a-Coffee-Mug-Using-Fusion-360-One-of-the-/)。另有视频用“旋转 + 扫掠”做马克杯 — [YouTube](https://www.youtube.com/watch?v=AZp_dEwF4D8)

**④ 积木：build123d Lego Tutorial**
来源：[Lego Tutorial](https://build123d.readthedocs.io/en/latest/tutorial_lego.html)
- 参数默认值：

| 参数 | 默认值 |
|---|---|
| pip_count（凸点数） | 6 |
| lego_unit_size（单元尺寸） | 8 |
| pip_height（凸点高） | 1.8 |
| pip_diameter（凸点直径） | 4.8 |
| block_width（宽） | 16 |
| base_height（底座高） | 9.6 |
| 支撑管外径 / 内径 | 6.5 / 4.8 |
| ridge_width / ridge_depth（脊条宽 / 深） | 0.6 / 0.3 |
| wall_thickness（壁厚） | 1.2 |

- 长度由计数驱动：block_length = 单元尺寸 × 凸点数。
- 共 11 步：
  1. Setup
  2. BuildPart
  3. BuildSketch
  4. 画外框矩形
  5. 用 offset 向内偏移出壁厚
  6. 用 GridLocations 画纵横内部筋条
  7. 减去内矩形，在壁上留下脊条
  8. 中线上排一列空心圆管
  9. 拉伸到墙高（底座高 − 壁厚）
  10. 顶部加 Box
  11. 加凸点阵列

**⑤ 积木：CadQuery Lego Brick**
来源：[CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- 参数：lbumps = 6，wbumps = 2；thin 开关决定高度为 3.2（薄板）或 9.6（标准高）；pitch 8；clearance 0.1；凸点直径 4.8、高 1.8；底柱直径推算约 6.5。
- 序列：
  1. 建 box。
  2. 从底面向内 shell(−t)。
  3. 在顶面用 rarray 布凸点并拉伸。
  4. 在底面按 lbumps、wbumps 分情况：都大于 1 时生成空心管；只有一个方向大于 1 时生成实心柱；1×1 时不生成。

**⑥ 键盘键帽：build123d Key Cap**
来源：[build123d Examples](https://build123d.readthedocs.io/en/latest/examples_1.html)
- 序列：
  1. 18 × 18 mm 矩形，拉伸 10 mm，taper 15°。
  2. 在 (0, −3, 47) 处用 R40 球体减出碟形顶面。
  3. 除底边外所有边 fillet 1 mm。
  4. 用缩放 (0.925, 0.925, 0.85) 后的自身做减法，掏空内部。
  5. 在 Z = 4 mm 处取截面，量出内腔尺寸。
  6. 画 0.5 mm 宽的十字筋和 Ø5.5 圆，extrude(until=NEXT) 连到内顶面。
  7. 在筋的底面画带十字槽（4.1 × 1.17 mm）的 Ø5.5 轴座，拉伸 3.5 mm。

**⑦ 轴承座：CadQuery Parametric Bearing Pillow Block**
来源：[CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- 参数：(长, 高, 轴承孔径, 厚, 边距) = (30, 40, 22, 10, 8)。
- 序列：
  1. 建 box。
  2. 在顶面开 Ø22 孔。
  3. 在顶面画构造矩形（长 − 边距，高 − 边距），forConstruction=True。
  4. 在构造矩形的四个顶点处做 cboreHole(2.4, 4.4, 2.1)。

**⑧ 电子外壳：CadQuery A Parametric Enclosure**
来源：[CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- 参数默认值：

| 参数 | 默认值 |
|---|---|
| 外形 宽 × 长 × 高 | 100 × 150 × 50 |
| 壁厚 | 3 |
| 侧边圆角 | 10 |
| 上下边圆角 | 2 |
| 螺柱内缩 | 12 |
| 螺柱内径 / 外径 | 4 / 10 |
| 沉孔直径 / 深 | 8 / 1 |
| 埋头孔直径 / 角度 | 0 / 90° |
| 盖翻转 | True |
| 止口高 | 1 |

- 序列：
  1. 外壳：画矩形，拉伸高度 + 止口高。
  2. 按半径大小决定先后：先倒较大的竖边圆角，再倒上下边圆角。代码注释原话：“weird geometry happens if we make the fillets in the wrong order”。
  3. 从底面偏移一个壁厚建内腔，拉伸后对竖边倒圆（半径 = 侧边圆角 − 壁厚）。
  4. 外壳减去内腔。
  5. 做螺柱等后续特征。

**⑨ 电子外壳的 DFM 特征：Fusion 塑料工具**
- 设计工作空间有“塑料”选项卡，包含：创建凸柱（塑料 > 创建 > 凸柱）、卡扣式连接、止口和槽、支撑台 — [创建凸柱](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-BOSS.htm)；[创建卡扣式连接](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SNAP-FIT.htm)；[止口和槽](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-LIP.htm)
- 检验类主题里有“确定适当的拔模斜度”和“拔模分析参考” — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- Creo 有专门的“唇”“耳”特征 — [Creo part_modeling](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/part_modeling.html)

**⑩ 直齿轮**
- FreeCAD PartDesign InvoluteGear：生成全参数化的 2D 渐开线轮廓，再用 Pad（凸台）或 AdditiveHelix 生成实体。属性包括：
  - 齿数
  - 模数（Modules = 分度圆直径 / 齿数）
  - 压力角
  - 齿顶高系数（默认 1.0）、齿根高系数（默认 1.25）
  - 根部圆角系数
  - 外齿 / 内齿、高精度
  
  — [FreeCAD Wiki: PartDesign InvoluteGear](https://wiki.freecad.org/PartDesign_InvoluteGear)
- bd_warehouse SpurGear 的参数：module、tooth_count、pressure_angle（常用 14.5 或 20）、root_fillet、thickness，addendum / dedendum 可选（不填则自动计算）。同一模块还有斜齿轮、齿条、蜗杆/蜗轮、锥齿轮、等速锥齿轮 — [bd_warehouse gear](https://bd-warehouse.readthedocs.io/en/latest/gear.html)
- FreeCAD 的中文 UI 名为“渐开线齿轮”；Assembly 工作台有“齿轮”联接 — [PartDesign_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/PartDesign/Gui/Resources/translations/PartDesign_zh-CN.ts)；[Assembly_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Assembly/Gui/Resources/translations/Assembly_zh-CN.ts)

**⑪ 六角螺栓 + 螺母**
- bd_warehouse 的 HexHeadScrew 覆盖三种标准：DIN 931（部分螺纹）、ISO 4014（部分螺纹）、ISO 4017（全螺纹）。同包还有 HexNut、PlainWasher，以及 ClearanceHole / TapHole / ThreadedHole / InsertHole 等孔对象 — [bd_warehouse fastener](https://bd-warehouse.readthedocs.io/en/latest/fastener.html)
- bd_warehouse 的螺纹类型：ISO 60°、Whitworth 55°、BSPP、Acme 29°、公制梯形、塑料瓶口螺纹 — [bd_warehouse thread](https://bd-warehouse.readthedocs.io/en/latest/thread.html)

**⑫ 法兰 / 带法兰轮毂**
- bd_warehouse 提供标准化参数法兰，类型有 WeldNeck、SlipOn、Blind、Lapped、SocketWeld；参数为 nps（公称管径）、flange_class（等级）、face_type（默认 Raised） — [bd_warehouse flange](https://bd-warehouse.readthedocs.io/en/latest/flange.html)
- TTT Party Pack 01-07 Flanged Hub 有 build123d 解法 — [build123d TTT](https://build123d.readthedocs.io/en/latest/tttt.html)

**⑬ 深沟球轴承**
- bd_warehouse 提供 SingleRowDeepGrooveBallBearing，另有带盖、角接触、圆柱滚子三种轴承，以及 PressFitHole（压装孔）。文档说明深沟球轴承结构简单、不可分离、适合高速 — [bd_warehouse bearing](https://bd-warehouse.readthedocs.io/en/latest/bearing.html)
- build123d 的 Cast Bearing Unit 示例用到了 draft() — [build123d Operations](https://build123d.readthedocs.io/en/latest/operations.html)

**⑭ 手机支架（第三方入门项目）**
- 3D Printer Academy 的 2025 入门指南以可打印手机支架为例：基本体 → 草图与约束 → 先用盒子模拟手机 → 导出 STL — [3D Printer Academy](https://3dprinteracademy.com/blogs/basics/autodesk-fusion-complete-beginners-guide-2025)
- Skillshare 课程内容：精确草图、曲面加实体建模、圆角、为 3D 打印做优化 — [Skillshare](https://www.skillshare.com/en/classes/autodesk-fusion-for-complete-beginners/1822344171)
- Product Design Online 的“30 天”课程第 13 天（Bodies vs. Components）附带手机支架和马克杯的演示文件 — [Product Design Online](https://productdesignonline.com/learn-autodesk-fusion-360-in-30-days-official-course/)

**⑮ SOLIDWORKS 官方入门三件套**
- **烛台（Candlestick）**：Basic Techniques 中的 Revolve and Sweep 教程，依次做旋转特征 → 扫描特征（把手）→ 带拔模角的拉伸切除 — [SOLIDWORKS Help 2024 教程](https://help.solidworks.com/2024/english/swconntutorial/c_tut_revolve_start.htm?id=4.1)
- **凿子（Chisel）与烛台的课时**：2011 版教师指南第 9 课用旋转和扫描做烛台，第 10 课用放样做凿子（截面分别画在不同基准面上） — [Instructor's Guide 2011](https://www.solidworks.com/sw/docs/instructor_wb_2011_eng.pdf)
- **Tutor1**：Lesson 1 – Parts 的零件文件名是 Tutor1.sldprt — [Student's Guide 2011](https://www.solidworks.com/sw/docs/student_wb_2011_eng.pdf)
- **小盒子**：教师指南第 2 课的盒子按“基体 → 圆角 → 抽壳 → 切除”的顺序建模 — [Scribd 上传的 SolidWorks Lessons](https://www.scribd.com/doc/3709999/SolidWorks-Lessons)

**⑯ 鼠标（曲面）**
- GrabCAD 中级教程，共 19 步 — [GrabCAD](https://grabcad.com/tutorials/surface-modelling-a-mouse-in-solidworks)
  1. 用两条互相垂直的样条做边界曲面。
  2. 曲面故意做大，之后再修剪。
  3. 侧面做成凸 → 凹 → 凸，方便握持。
  4. 用“相互修剪”去掉多余部分。
  5. 用“加厚成实体”检验曲面是否水密。
  6. 下一步把实体分割成按键、电池盖等多个实体。
- 2014 年的博客教程（以 Wacom 鼠标为原型）：放样凸台 → 抽壳 → 建基准面作修剪曲面 → 分割实体 → 组成 4 个零件的装配 — [博客](https://nisheeth-inventortalks.blogspot.com/2014/12/computer-mouse-video-tutorial.html)
- Onshape 版：用控制点曲线和边界填充建鼠标 — [YouTube](https://www.youtube.com/watch?v=n6UzW4SB80E)
- Apple Magic Mouse 版：用填充曲面、分割线、放样曲面、缝合 — [LearnSolidWorks](https://learnsolidworks.com/solidworks_tutorials/apple-mouse-tutorial)

**⑰ 铁铲：Fusion 官方中文曲面教程**
- 教程名“使用曲面实体创建一个实体”，分为：活动 2 创建铁铲曲面 → 活动 3 修剪掉多余的曲面 → 活动 4 使用曲面创建实体 — [活动 2：创建铁铲曲面](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/GUID-6DF364B8-C94F-4AFC-B27B-A7BC2F86F8E3.htm)

**⑱ 带螺纹的瓶盖**
- SOLIDWORKS“螺旋线和涡状线”帮助页列举的用途包括瓶口螺纹、螺旋弹簧，以及用变螺距螺旋线加切除扫描做蜗杆 — [螺旋线和涡状线 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/Sldworks/c_Helix_and_Spiral.htm)
- bd_warehouse 的 PlasticBottleThread 默认采用 ASTM D2911，可选 PCO1881；其中 L 型为梯形牙、30° 肩角 — [bd_warehouse thread](https://bd-warehouse.readthedocs.io/en/latest/thread.html)

**⑲ 钣金支架**
- Fusion 官方中文教程“创建钣金实体”：活动 1 基于草图轮廓创建钣金凸缘 → 活动 2 创建并应用新规则 → 活动 3 创建展开模式和供制造使用的工程图 — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- Onshape 钣金的关键参数：折弯半径、默认折弯 K 系数、折弯止裂槽类型和比例、拐角止裂槽 — [钣金模型](https://cad.onshape.com/help/zh_CN/Content/PartStudio/sheet_metal_model.htm)
- TTT 23-02-02 SM Hanger 有 build123d 解法 — [build123d TTT](https://build123d.readthedocs.io/en/latest/tttt.html)

**⑳ 带铰链盒子：build123d Joint Tutorial**
来源：[Joint Tutorial](https://build123d.readthedocs.io/en/latest/tutorial_joints.html)
- 序列：
  1. 建铰链。
  2. 给铰链叶片加 Joint：叶片联接、铰链轴联接、紧固件联接。
  3. 建盒体。
  4. 建盒盖。
  5. 导入螺钉并绑定 Joint。
  6. 按顺序连接：铰链 → 盒体，铰链 → 铰链，盒盖 → 铰链，螺钉 → 铰链。

**㉑ 装配教程（官方）**
- Fusion 官方中文：“活动：装配夹具并添加联接”和“活动：应用刚性组，添加旋转联接，以及创建接触集合” — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- CadQuery 装配教程：用 20 × 20 V 槽型材装配柜门，参数 H = 400、W = 200、D = 350 — [CadQuery Assemblies](https://cadquery.readthedocs.io/en/latest/assy.html)

**㉒ 题库**
- TTT Party Pack 01 第 01–10 题：Bearing Bracket、Post Cap、C Clamp Base、Angle Bracket、Paste Sleeve、Bearing Jig、Flanged Hub、Tie Plate、Corner Tie、Light Cap；另有 23-T-24 Curved Support、24-SPO-06 Buffer Stand（用到 full_round） — [build123d TTT](https://build123d.readthedocs.io/en/latest/tttt.html)
- TooTallToby 平台：按 2D 图纸建 3D 模型，按复杂度分 Tier，比赛中用质量判对错 — [Engineering.com](https://www.engineering.com/the-fastest-3d-cad-modelers-in-the-world/)
- CSWA 练习题：〔三〕
  - 题型：2 道基础零件题（拉伸、旋转、切除）和 2 道中级题（加倒角、圆角、孔、阵列）。
  - 答案形式：质量或体积。
  - 有参数变更题，例如 A = 50、B = 15、C = B + 20，并指定材料密度。
  
  来源：[SolidWize CSWA 练习](https://www.scribd.com/document/374047135/SolidWize-CSWA-Practice-Exam)；[阿尔伯塔大学 PDF](https://sites.ualberta.ca/~dnobes/Teaching_Section/CSWA/CSWA_Material/CSWA_Exam_Practice_Questions.pdf)；[examcert](https://www.examcert.app/blog/cswa-practice-questions-2026/)
- build123d 示例库还有：Spring、Vase、Handle、Peg Board Hook、Circuit Board With Holes、Toy Truck、Heat Exchanger、Clock Face、Stud Wall 等 — [build123d Examples](https://build123d.readthedocs.io/en/latest/examples_1.html)

### Inferences

**教学模型目录（25 项）**
- 难度：1 = 入门，5 = 高级。
- 滑块范围是按工程常识给的建议值，未经实测。

| # | 对象 | 基线来源 | 单件/装配 | 难度 | 推荐滑块（建议范围） | 主教概念 |
|---|---|---|---|---|---|---|
| 1 | 瓶子 MakeBottle | ①② | 单件 | 3 | 宽 30–80、高 40–150、厚 10–40（需厚<宽）；瓶颈尺寸、圆角、壁厚按比例派生 | 镜像、拉伸、先全边圆角后抽壳、布尔融合、在曲面上做螺纹 |
| 2 | 茶杯 / 马克杯 | ③ | 单件 | 2 | 壁厚 1.5–5（圆角自动取 0.49×壁厚）、杯高 80–130、口径 60–90、把手附着高度 | 旋转、带开口抽壳、全边圆角、沿样条扫掠、求交定位 |
| 3 | 积木 | ④⑤ | 单件 | 2 | 长向凸点 1–8、宽向 1–4、薄/标准高度开关（pitch 固定 8） | 网格阵列、偏移壁厚、计数驱动尺寸、条件特征 |
| 4 | 键帽 | ⑥ | 单件 | 3 | 键宽 1–2.25u（约 18 mm/u）、高 7–12、锥度 5–20°、碟面球半径 30–80、圆角 0.5–2 | 锥度拉伸/拔模、布尔做碟面、缩放掏空与抽壳的对比、筋和十字轴座、拉伸到下一面 |
| 5 | 直齿轮（可成对啮合） | ⑩ | 单件或二件装配 | 3 | 模数 0.5–4、齿数 8–80、压力角 14.5/20/25（离散）、齿宽 3–30、孔径 | 派生尺寸（分度圆 = 模数×齿数）、圆周阵列、齿轮联接 |
| 6 | 六角螺栓 + 螺母 + 垫圈 | ⑪ | 装配 | 3 | 规格 M3–M20（离散）、长度 8–100、全/半螺纹 | 配置或系列零件设计表、螺旋与螺纹（装饰 vs 实体）、倒角、同轴配合、沿轴向爆炸 |
| 7 | 法兰 / 带法兰轮毂 | ⑫ | 单件（加螺栓可成装配） | 2 | 螺栓孔数 4–16、PCD、外径、厚度、孔径 | 旋转、圆周阵列、以 PCD 体现设计意图 |
| 8 | 轴承座 | ⑦ | 单件 | 1 | 长 30–80、高 40–100、厚 8–20、轴承孔 10–40、边距 6–15 | 用构造几何定位孔、沉头孔 |
| 9 | 深沟球轴承 | ⑬ | 装配 | 3 | 按型号选内径/外径/宽度、球数 6–14、球径 | 带沟槽的旋转、圆周阵列、同心配合、径向爆炸、干涉检查 |
| 10 | 电子外壳（凸柱/筋/卡扣） | ⑧⑨ | 装配（底壳 + 盖 + PCB + 螺钉） | 4 | 宽 40–200 / 长 40–250 / 高 15–80、壁厚 1.5–4、侧圆角 0–15、上下圆角 0–5、凸柱内外径、止口高 0.5–2、拔模 0.5–3° | 抽壳、圆角顺序、拔模、筋、凸柱、卡扣、止口、分割成盖和底、装配与爆炸 |
| 11 | 手机支架 | ⑭ | 单件 | 1 | 倾角 50–80°、槽宽 8–15、宽 60–100、底深 60–100 | 草图约束与尺寸、对称拉伸、圆角、面向 3D 打印的 DFM |
| 12 | 烛台 | ⑮ | 单件 | 2 | 高度、底径、把手路径控制点、孔拔模角 0–10° | 旋转、扫描（轮廓 + 路径）、带拔模的切除 |
| 13 | Tutor1 / 小盒子 | ⑮ | 单件 | 1 | 长宽高、壁厚、圆角半径（演示圆角与抽壳的先后） | 拉伸、切除、圆角、抽壳、特征顺序 |
| 14 | 凿子 | ⑮ | 单件 | 2 | 柄长、刃宽、截面间距 | 多基准面、放样 |
| 15 | 鼠标 | ⑯ | 多实体 → 装配 | 5 | 长 100–130、宽 55–75、高 30–45、侧面凹陷深度、按键分割线位置 | 边界曲面、G1/G2 连续、修剪/缝合/加厚、斑马纹检查、分割多实体 |
| 16 | 铁铲 | ⑰ | 单件 | 4 | 铲面宽度、曲率、柄的角度 | 建曲面、修剪、曲面转实体 |
| 17 | 带螺纹的瓶盖（可配瓶口） | ⑱ | 单件或二件装配 | 3 | 口径 28/38（离散）、螺距、圈数 1–2.5、壁厚 1–2、防滑纹数 30–120 | 螺旋 + 扫描或螺纹特征、圆周阵列、抽壳、螺旋配合 |
| 18 | 钣金支架 | ⑲ | 单件 | 2 | 板厚 0.8–3、折弯半径 0.5–3×板厚、K 系数 0.3–0.5、法兰长 10–60、折弯角 45–135° | 基体法兰、边线法兰、止裂槽、展开图、钣金规则 |
| 19 | 带铰链盒子 | ⑳ | 装配 | 3 | 盒体尺寸、盖厚、铰链位置、开合角 0–110°（直接驱动联接） | 联接/配合、自由度、装配顺序、爆炸视图 |
| 20 | 弹簧 | ㉒（仅确认 build123d 有 Spring 示例） | 单件 | 1 | 节距、圈数 3–20、线径 0.5–3、中径 5–30 | 螺旋线 + 扫掠 |
| 21 | TTT / CSWA 练习件 | ㉒ | 单件 | 2–4 | 题目变量（如 A、B、C = B + 20）、材料密度 | 读图建模、用质量自检、参数变更 |
| 22 | 手电筒 | 无权威来源（推断） | 装配 | 3 | 筒长、外径、滚花数、头部扩口角 | 旋转、阵列、螺纹连接、装配爆炸 |
| 23 | 按动圆珠笔 | 无权威来源（推断） | 装配 | 5 | 笔杆长、弹簧长、按压行程 | 多零件配合与公差、凸轮/锯齿机构 |
| 24 | 台灯 | 无权威来源（可借 Fusion 旋转联接/接触集合教程） | 装配 | 4 | 各臂长、关节角度（在限位内） | 旋转联接、运动限制、刚性组 |
| 25 | 凳子 | 无权威来源（推断） | 装配或多实体 | 2 | 座面直径、腿数 3–4、腿外撇角、高度 | 圆周阵列、带角度的基准面、镜像 |

**无权威来源对象的建议序列（自行设计，需在 CAD 中验证）**
- **手电筒**
  1. 筒身半剖面旋转。
  2. 外表面滚花：沿轴线切槽，再做圆周阵列。
  3. 尾盖：旋转 + 内螺纹。
  4. 头部：旋转出反光杯。
  5. 透镜、开关单独建零件。
  6. 装配用同心 + 螺旋配合，沿轴向爆炸。
- **按动笔**：笔杆 / 笔尖套 / 笔芯 / 弹簧 / 按钮 / 凸轮分零件建模，凸轮可用扫描切除或阵列；适合作“高级装配 + 运动”示例。
- **台灯**
  1. 底座：旋转 + 配重腔。
  2. 臂：拉伸 + 孔。
  3. 关节：销 + 旋转联接，并设角度限制。
  4. 灯罩：旋转后抽壳。
- **凳子**
  1. 座面：旋转或拉伸，加圆角。
  2. 一条腿在倾斜基准面上做扫掠或拉伸。
  3. 腿做圆周阵列。
  4. 加横撑（扫描），可选做成焊件或多实体。

**其他建议**
- **派生关系做成“锁链”**：例如茶杯的圆角半径取 0.49 × 壁厚，刚好小于壁厚的一半，能防止圆角失败；OCCT 瓶子的所有次要尺寸也都由三个主参数按比例派生。这类关系适合在页面上显示成“锁链”图标，让学习者看见设计意图。
- **质量做实时“答案校验”**：TTT 和 CSWA 都用质量判对错，网站可以显示实时质量或体积，给练习题做答案校验。

### Gaps
- **按难度列的大众入门项目**：没有找到 Onshape Learning Center 或 Autodesk 官方的入门项目清单。马克杯、手机支架的来源都是第三方。
- **中文版 SOLIDWORKS 教程名**：没有核实烛台、凿子在中文版里的名称，也没有核实 Tutor2 是否用于 Lesson 2 装配。
- **四个对象缺权威教程**：手电筒、按动笔、台灯、凳子都没有找到可引用的标准教程。
- **旧版资料**：SOLIDWORKS 教师指南用的是 2011 版 PDF，新版课时编号可能已经变了。
- **示例源码未读全**：没有逐行读 build123d 的 Spring、Vase、Cast Bearing Unit 源码，序列只确认了示例存在和用到的操作。
- **滑块范围**：所有建议范围都未经几何稳定性测试（如抽壳或圆角在极端值下是否失败），上线前需要用参数扫描验证。

## 问题 3：哪些对象最能演示设计意图、特征顺序依赖、参数驱动阵列、DFM、曲面连续性、装配与爆炸视图？

### Takeaway
推荐的对应关系：

| 要演示的主题 | 推荐对象 | 理由 |
|---|---|---|
| 特征顺序依赖 | 电子外壳、Tutor1 盒子、OCCT 瓶子 vs 茶杯 | 都有官方或代码层面的顺序说明 |
| 参数驱动阵列 | 积木、法兰、轴承 | 计数直接驱动几何 |
| DFM | 外壳、键帽 | 拔模、筋、凸柱、卡扣、止口一应俱全 |
| 曲面连续性 | 鼠标、铁铲 | 边界曲面 + 斑马纹 |
| 装配与爆炸 | 带铰链盒子、螺栓组、轴承、外壳 | 有明确的装配顺序 |

### Cited Findings

**特征顺序依赖**
- SOLIDWORKS 抽壳帮助建议：先对零件加圆角，再生成抽壳 — [抽壳 2022](https://help.solidworks.com/2022/Chinese-simplified/SolidWorks/Sldworks/c_Shells_Folder.htm)
- NWTC 的 SolidWorks 教材把抽壳放在所有圆角之后，好让圆角半径在壳内侧也被偏移出来；练习要求用回滚条退回到抽壳之前 — [LibreTexts 5.02 Shell](https://workforce.libretexts.org/Courses/Northeast_Wisconsin_Technical_College/Introduction_to_SolidWorks_(NWTC)/05%3A_Revolve_and_Other_DFM_Tools/5.02%3A_Shell)
- 教师指南第 2 课的盒子按“基体 → 圆角 → 抽壳 → 切除”建模 — [Scribd SolidWorks Lessons](https://www.scribd.com/doc/3709999/SolidWorks-Lessons)
- 另一家来源建议反过来，先抽壳，再给内部边加圆角 — [cadin360](https://cadin360.com/blog/solidworks/how-to-avoid-sharp-edges-in-model-in-solidworks-2/)
- CadQuery 外壳示例的代码注释警告：圆角顺序错了会产生怪异几何，所以代码按半径大小决定先倒哪组边 — [CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- 第三方转述的 NX 边倒圆建议有两条 — [格发：边倒圆详解](https://www.gofarlic.com/techArticleDetail?noticeId=358500)
  - 除非后续特征需要用到圆角生成的面或边，否则把圆角放在最后做。
  - 编辑一串圆角时按时间戳顺序进行，因为后面的圆角常常会改动前面圆角生成的边。
- 圆角课件里的经验：先做大圆角再做小圆角，先拔模再圆角 — [SlideShare 圆角课件](https://www.slideshare.net/slideshow/fillet-feature-in-solid-works/133002698)
- 两种顺序的代码实例：
  - OCCT 瓶子先全边圆角，再抽壳（MakeThickSolid） — [OCCT Tutorial](https://dev.opencascade.org/doc/overview/html/occt__tutorial.html)
  - build123d 茶杯先抽壳（offset），再对全部边圆角 — [build123d Examples](https://build123d.readthedocs.io/en/latest/examples_1.html)
- 一个开源 CAD 的问题报告：壳内角是否变圆取决于壁厚与外圆角的相对大小。壁厚 5 mm 时内角是尖的，改成 2 mm 后内角变圆 — [GitHub issue #775](https://github.com/tangency-labs/solidcraft/issues/775)
- SOLIDWORKS 中拖动特征树可以重排特征，从而改变重建顺序 — [FeatureManager 设计树概述 2021](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_featuremanager_design_tree_overview.htm)

**设计意图与参数驱动**
- Lego 示例中块长 = 单元尺寸 × 凸点数，并用 GridLocations 按计数布筋和管 — [Lego Tutorial](https://build123d.readthedocs.io/en/latest/tutorial_lego.html)
- CadQuery 版 Lego 按凸点数分支生成空心管、实心柱或不生成 — [CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- 轴承座用 forConstruction 的矩形顶点定位沉头孔，孔会随外形和边距一起移动 — [CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html)
- SOLIDWORKS 线性阵列的“到参考”选项按参考几何自动确定实例数和间距 — [线性阵列 2021](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/t_Linear_Patterns_Overview.htm)
- SOLIDWORKS 圆周阵列的“等间距”选项把角度设为 360° — [圆周阵列 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/hidd_cpattern.htm)
- SOLIDWORKS 系列零件设计表可以驱动尺寸、压缩状态、方程式、材料等，在装配中还能驱动距离和角度配合 — [系列零件设计表配置 2025](https://help.solidworks.com/2025/Chinese-simplified/SolidWorks/sldworks/c_Design_Table_Configurations.htm)
- Creo 用“关系”“族表”，Fusion 用“更改参数”和“配置表”，Onshape 用“变量”和“配置”承担同样的功能 — [Creo fundamentals](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/fundamentals.html)；[Fusion 更改参数](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MODIFY-CHANGE-PARAMETERS.htm)；[Onshape 变量](https://cad.onshape.com/help/zh_CN/Content/PartStudio/variable.htm)

**DFM（可制造性设计）**
- Fusion 的塑料工具有凸柱、卡扣式连接、止口和槽、支撑台，实体创建里还有加强筋、网状加强筋 — [凸柱](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-BOSS.htm)；[卡扣式连接](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SNAP-FIT.htm)；[加强筋](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-RIB.htm)
- Fusion 还有“确定适当的拔模斜度”主题 — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- Rhino 帮助说明拔模角度用于让注塑件容易脱模，并提供拔模角度分析 — [Rhino DraftAngleAnalysis](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/draftangleanalysis.htm)
- SOLIDWORKS 拔模有三种类型：中性面、分型线、阶梯拔模 — [拔模 PropertyManager 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_DRAFT.htm)
- 键帽示例集中体现了几种 DFM 特征：锥度拉伸、十字筋加轴座、用缩放掏空 — [build123d Examples](https://build123d.readthedocs.io/en/latest/examples_1.html)
- Cast Bearing Unit 示例用了 draft()；Buffer Stand 用了 full_round() — [build123d Operations](https://build123d.readthedocs.io/en/latest/operations.html)
- 钣金的制造参数：K 系数、折弯止裂槽、拐角止裂槽 — [Onshape 钣金模型](https://cad.onshape.com/help/zh_CN/Content/PartStudio/sheet_metal_model.htm)
- Fusion 钣金有“规则”（创建、编辑、替代）和“将展开模式导出为 DXF” — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)

**曲面连续性**
- SOLIDWORKS 边界曲面可在两个方向上相切或曲率连续，通常比放样质量高 — [边界曲面 2019](https://help.solidworks.com/2019/chinese-simplified/SolidWorks/sldworks/c_boundary_surface.htm)
- SOLIDWORKS 放样的起止约束有“与面相切”“与面的曲率” — [放样 PropertyManager 2024](https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_FEAT_LOFT.htm)
- Rhino 的相关工具 — [GCon](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/gcon.htm)；[Zebra](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/zebra.htm)；[BlendEdge](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/blendedge.htm)
  - GCon：判断两条曲线端点之间的连续性。
  - Zebra：用条纹贴图分析曲面的平滑度和连续性。
  - BlendEdge：在组合边缘建立曲率连续的不等距混接。
- Fusion“检验”下有斑纹分析、曲率梳分析、曲率映射分析 — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- NX 10 的官方中文新功能资料提到边倒圆、面倒圆和 G2 连续 — [Siemens NX 10 新功能 PDF](https://www.plm.automation.siemens.com/zh_cn/Images/Siemens-PLM-Whats-New-in-NX-10-fs-ZH-Y17-HR_tcm78-228755.pdf)
- 鼠标教程的典型流程：边界曲面 → 故意做大 → 相互修剪 → 加厚检验水密 → 分割成多个实体 — [GrabCAD](https://grabcad.com/tutorials/surface-modelling-a-mouse-in-solidworks)

**装配、爆炸视图与装配顺序**
- **SOLIDWORKS**：每个配置可以有多个爆炸视图；在工程视图中可以指定显示爆炸配置 — [生成爆炸视图 2018](https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/t_Creating_Exploded_Views.htm)；[爆炸视图 2022](https://help.solidworks.com/2022/chinese-simplified/SolidWorks/acadhelp/c_Exploded_Views.htm)
- **Creo**：分解视图带分解工具和偏距线 — [Creo assembly](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/assembly.html)
- **Fusion**：动画工作空间提供自动分解（所有级别 / 一个级别）和手动分解；官方教程“制作设计动画”里有“活动 2：分解部件” — [手动分解](https://help.autodesk.com/cloudhelp/CHS/Fusion-Animate/files/ANI-EXPLODE-MANUAL.htm)；[Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- **Fusion 联接**：可设运动限制，有刚性组和接触集合 — [Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json)
- **Onshape**：配合的“动画”功能可以预览单个配合的运动 — [配合](https://cad.onshape.com/help/zh_CN/Content/Assembly/mates.htm)
- **build123d Joint Tutorial**：按 7a–7d 的顺序连接铰链、盒体、盒盖、螺钉，本身就是一条装配顺序 — [Joint Tutorial](https://build123d.readthedocs.io/en/latest/tutorial_joints.html)
- **FreeCAD**：Assembly 工作台带“爆炸视图”和“材料清单” — [Assembly_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Assembly/Gui/Resources/translations/Assembly_zh-CN.ts)

**用质量或体积校验模型**
- TTT 比赛以模型质量判定胜负 — [Engineering.com](https://www.engineering.com/the-fastest-3d-cad-modelers-in-the-world/)
- CSWA 练习题的答案为质量或体积，并有参数变更后重新计算的题型〔三〕 — [阿尔伯塔大学 PDF](https://sites.ualberta.ca/~dnobes/Teaching_Section/CSWA/CSWA_Material/CSWA_Exam_Practice_Questions.pdf)；[SolidWize](https://www.scribd.com/document/374047135/SolidWize-CSWA-Practice-Exam)

### Inferences

**概念 → 最佳演示对象**

| 教学点 | 首选对象 | 互动设计建议 |
|---|---|---|
| 设计意图 | 轴承座（构造矩形定孔位）、积木（计数驱动长度）、茶杯（圆角 = 0.49×壁厚）、齿轮（分度圆 = 模数×齿数） | 拖动主参数，高亮被派生的尺寸；故意“打断”关系（把孔位改成绝对坐标），让学习者看到改尺寸后孔跑偏 |
| 特征顺序依赖 | 小盒子 / 外壳：圆角→抽壳 vs 抽壳→圆角 | 并排两个时间轴，同一套参数；壁厚滑块越过外圆角半径时，内角在尖角和圆角之间切换（依据 GitHub #775 描述的现象） |
| 参数驱动阵列 | 积木（网格）、法兰（孔数）、轴承（球数）、瓶盖防滑纹 | 计数滑块；示范“等间距 360°”和固定角距的区别 |
| DFM | 外壳（拔模、筋、凸柱、卡扣、止口、均匀壁厚）、键帽、钣金支架 | 拔模角度分析着色；把壁厚设为非均匀，提示缩痕风险。缩痕结论是通用工程知识，本次未引用 |
| 曲面连续性 | 鼠标、铁铲、茶杯把手 | G0/G1/G2 三档切换，配斑马纹实时渲染 |
| 装配与爆炸 | 带铰链盒子（联接顺序）、螺栓组（轴向爆炸）、轴承（径向爆炸）、外壳（多零件 + BOM） | 爆炸滑块从 0 到 100%；按步骤显示装配顺序，联动 BOM 高亮 |
| 读图建模与自检 | TTT / CSWA 风格题 | 显示实时质量，让学习者用“质量是否吻合”自检 |

**其他判断**
- 起手模型建议选茶杯和外壳，因为一个对象能覆盖最多概念。
  - 茶杯：旋转、抽壳、圆角、扫掠、样条连续性。
  - 外壳：拉伸、抽壳、圆角顺序、拔模、筋、凸柱、孔、阵列、分割、装配、爆炸、BOM。

### Gaps
- **特征顺序缺对照截图**：没有找到 SOLIDWORKS、Fusion、Onshape 官方对“圆角-抽壳顺序”的图示对照。SOLIDWORKS 只有“先圆角再抽壳”的文字提示。
- **DFM 数值缺权威来源**：没有找到权威的定量数值，例如筋厚与壁厚之比、凸柱尺寸比例、最小拔模角，需要另查注塑设计手册。
- **装配顺序缺官方教程**：没有找到官方的“装配顺序动画”教程（SOLIDWORKS 爆炸步骤序列、Onshape 分解视图步骤），只有功能页。
