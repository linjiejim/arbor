# 拆开特征树，教会中文学习者工业建模

这个站最该做成**中文、概念优先、不绑定软件的 3D 学习站，核心交互是"逐特征拆解 + 分步重建 + 改参测试"**——本次调研的 37 个产品与站点中没有一个同时做到这几点，厂商课程、B站视频和新出现的 AI 助手讲的仍是"在某个软件里点哪里"。课程主干不必另起炉灶，Autodesk、SOLIDWORKS、Onshape、PTC 的官方课程与认证几乎都按"导航与基准 → 草图约束 → 特征 → 特征树与修复 → 参数与配置 → 装配 → 工程图"排课，中文站要补的是四块：把设计意图和特征树提前到第一课，按国标第一角投影教读图，给每个概念附上各软件的官方中文译名，并把 DFM 与曲面造型做成与机械主干并行的两条轨。学习科学指向的教法是一步对应一个特征、从完整示例逆向渐隐到独立重建、默认给关键视角而不是放任自由旋转、易错步骤先预测再揭示，并用"改参后模型是否按意图更新"来考设计意图，单是能转动 3D 模型并不带来学习。技术上，浏览器内跑 OpenCascade 已经够快——本机 spike 中马克杯 7 个特征改参后全量重建约 **0.43 秒**、只出最终模型约 **0.15 秒**——但 wasm 压缩后仍有 **4.6 MiB**（Slow 4G 下载 27.5 秒），一种圆角会把 wasm 内存推到 **1.07 GB** 且不回落，滑块全范围随机取参有 **30%** 的组合失败([本机 spike 实测](../../spikes/replicad-kernel/README.md))。因此架构上应**默认用离线预烘焙的每步 GLB 与面标签，内核只在桌面端按需加载、用作改参沙盒**，HTML 原型先做"操作模拟"和"模型拆解"两个可复用播放器，起手模型选马克杯和电子外壳。

## 各家官方课程排出同一条主干，中文站要补四块

### 主干一致：回滚与修复属于入门能力，设计意图应提前到第一课

机械参数化 CAD 的官方课程几乎排成同一条线。Autodesk 的 ACU Fusion 考纲按工作区与导航、草图、建模、装配、出图五个域排序，目标人群约有 **150 小时**上手经验；它把"用时间轴回滚、编辑过去的特征"和"理解为什么要用构造平面"放进第一个域、排在画草图之前，草图域则要求把草图做到完全约束并用设计参数驱动模型([ACU Fusion 360 考纲，Certiport 2022](https://www.arit.co.th/assets/objective/acu/ACU_OD_Fusion360_0922.pdf))。Onshape Fundamentals 依次是导航 → 草图 → Part Studio → 多零件 Part Studio → 装配 → 详图([BroncBotz 转录的 Onshape 课序](https://docs.broncbotz.org/cad-design-and-mechanical/cad-in-onshape/getting-started-with-onshape))；PTC 把入门拆成实体建模 1、2 → 装配 → 2D 图纸，骨架式自顶向下设计单独成一门 3 小时、要求先修的中级课([PTC University Creo 2026 课程目录](https://training-materials.ptcu.com/catalog/ptc-university-creo-curriculum-en.pdf))。SOLIDWORKS 官方授权的 Essentials 共 14 课、4–5 天，第 4 课才正式提出"设计意图"，第 8–9 课专讲修复与设计变更，第 10–11 课讲配置和全局变量/方程，工程图（第 12 课）排在装配（第 13–14 课）之前([Solid Solutions 课纲](https://www.solidsolutions.co.uk/solidworks-training/courses/3d-cad/essentials-agenda.aspx))。认证普遍用"按图建模、再报质量或质心"来客观判分。CSWA 考 3 小时、14 题，240 分拿到 165 分及格([examcert](https://www.examcert.app/blog/cswa-practice-questions-2026/))；零件题看总质量，或相对原点的质心([SOLIDWORKS 博客](https://blogs.solidworks.com/products/solidworks/lesson-6-solidworks-academic-certification-cswa-exam-part-1/))。CSWP 第一段要求在不同阶段改尺寸后仍保持设计意图，第二段才考配置与设计表([CSWP 官方样卷](https://www.solidworks.com/sites/default/files/cswpsampleexam.pdf))。

这条主干只有两处分歧：工程图与装配谁先教，配置与方程算初级还是中级。对网站更有用的信号是：**官方体系把"模型能改、出错能修"当作入门能力**。ACU 把时间轴回滚放在第一个域，SOLIDWORKS 单开两课讲修复。所以概念优先的网站，应在第一个模块就引入特征树和回滚；第一节草图课就用"改一个尺寸、看模型怎么变"埋下设计意图，不必等到第 4 课。

各软件"改了前面、后面就断"的毛病，根源都是拓扑命名问题（TNP）：拉伸、切除、圆角之后，形状的内部名称会变。FreeCAD 1.0 的新算法也只能缓解，不能根治([FreeCAD wiki](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Topological_naming_problem.md))。Fusion 教程建议把圆角放到时间线最后([Varsity Tutors](https://www.varsitytutors.com/practice/subjects/autodesk-fusion-360/lessons/avoiding-reference-changes))，FreeCAD 建议参考基准面而不是生成边。两条建议是同一个原则，适合作为跨软件的统一概念来讲。

中文学习者还多一个先修点：投影法。GB/T 4458.1-2002 规定，除特别指明外，视图一律采用**第一角画法**([国家标准馆](https://www.ndls.org.cn/standard/detail/b58216091ed065712f76b8da59789231))；SOLIDWORKS 内置教程用的却是第三角画法([SOLIDWORKS Help 2027](https://help.solidworks.com/2027/english/swtutorialonline/t_tut_lesson3_createdrawing.htm))。如果不显式对照，"按图建模"类练习就会系统性地出错。

中文主流课程按软件模块组织，顺序是界面 → 草图 → 特征 → 装配 → 工程图 → 钣金焊件([B站典型课程](https://www.bilibili.com/video/BV1mysf6CE9Z/))。知乎上讨论最多的是"该学 SW、UG 还是 Creo"，高质量回答反复强调：各软件的建模原理相通，真正要学的是参数化与设计意图([知乎](https://www.zhihu.com/question/29370211))。可是设计意图、自由度、参考稳健性、连续性、DFM 这些概念，只散见于零散的图文帖。"概念优先、工具中立"的空位就在这里。一张"一个概念 → 各软件命令"的映射表，还能直接回应"学哪个软件"的焦虑。

### 工业设计轨先学看曲率，DFM 轨讲清规则背后的物理

工业设计软件的课序与机械 CAD 完全不同。Rhino Level 1 先教工具、几何类型、坐标输入和控制点编辑([McNeel Level 1 study guide](https://wiki.mcneel.com/rhino/level1_study_guide))；连续性到 Level 2 才系统讲，顺序是曲线阶数 → G0/G1/G2 → 曲率图 → 曲面连续性与匹配([Rhino 5 Level 2 手册](http://www.andreasmoos.de/downloads/Rhino_Level_2.pdf))。Alias 对 Class-A 曲面的要求是：面片内部用 Bezier 曲面保证光顺，面片之间做到 G2/G3([Alias 2024 Help](https://help.autodesk.com/view/ALIAS/2024/ENU/?guid=GUID-64611955-D2CC-44F2-98F0-D4F1FE931D8B))；对应的 40 小时课程，要求学员先达到 Alias Level 3([Design Engine](https://design-engine.com/alias-auto-class-a-automotive-surfacing/))。

国内工业设计院校普遍以 Rhino 作为第一建模软件。东莞理工开 48 学时([DGUT 大纲](https://yt.dgut.edu.cn/__local/C/9E/6D/02D4D2F2139A85CF563FB18359D_07C0FB42_667A0.pdf?e=.pdf))；郑州大学开 64 学时，其中 V-Ray 占 16 学时([cucdc](http://m.download.cucdc.com/wenku/a30ac3dec78d4216a268f578ee11229a.html))。教材的顺序是曲线、曲面、实体 → 分面 → 复杂曲面 → T-Splines → KeyShot 渲染([潘荣等《计算机辅助工业设计》](https://weread.qq.com/web/bookDetail/53e32610811e42751g0184ba))。

中文社区把 G2 视为光顺曲面的最低标准，汽车一般要求 G3；还有文章指出，Rhino 默认的圆角矩形只有 G1，曲率梳在接点处是断开的([知乎：Rhino 产品级曲面建模](https://zhuanlan.zhihu.com/p/132421509))。有一条流行口诀，按接点两侧共线控制点的个数判断连续性：各一个约等于 G1，各两个约等于 G2([知乎](https://zhuanlan.zhihu.com/p/152011059))。这是简化说法——严格的 G2 只要求两侧曲率相等，三点共线只是接点曲率为零的特例，课程文案不能把口诀当定义。这条轨的核心能力是读曲率梳、斑马纹和高光，靠视频讲不清，正是交互 3D 最该发力的地方；滚球圆角通常只有 G1，混接可以做到 G2/G3，对比两者的那一课要排在学会看斑马纹之后，学习者才看得出差别。

DFM 可以概括为"四种工艺 × 少数硬规则"，下表列出最常用的数值。

| 工艺 | 关键规则 | 来源 |
|---|---|---|
| 3D 打印 | 自支撑角约 **45°**；FDM 桥接超过 5 mm 会下垂 | [Hubs](https://www.hubs.com/knowledge-base/key-design-considerations-3d-printing/) |
| CNC | 竖直内角半径大于腔深的 **1/3**；腔深约为腔宽的 4 倍 | [Hubs CNC 设计指南](https://www.hubs.com/guides/cnc-machining/) |
| 钣金 | 法兰至少 **4 倍料厚**；K 因子在 R<T 的空气折弯中约 0.33，随半径增大趋近但不超过 0.5 | [Protolabs 钣金规范](https://www.protolabs.com/services/sheet-metal-fabrication/design-guidelines/)；[Protolabs](https://www.protolabs.com/resources/design-tips/the-basics-of-bend-radii-in-sheet-metal/) |
| 注塑 | 拔模角：竖直面 0.5°，多数情况 2°，碰穿面和轻纹理至少 3°；筋厚取相邻壁厚的 40–60% | [Protolabs 注塑规范](https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/)；[Protolabs](https://www.protolabs.com/en-gb/resources/design-tips/choosing-the-right-boss-for-your-part-design/) |

各家给的数值并不一致。钣金止裂槽宽度，Protolabs 给的是上限，Fictiv 给的是下限；孔到折弯线的距离，Protolabs 写 4T，Fictiv 写 2.5T+R([Fictiv](https://www.fictiv.com/specifications/sheet-metal))。所以课程要讲清规则背后的物理原因，并明确"以你的供应商 DFM 报告为准"，而不是让人背数字。这些规则几乎都是可计算的几何检查（壁厚、角度、半径、比例），在浏览器里实时着色显示，效果远胜看视频。

### 卡点几乎都源于"看不见依赖图"

学习者的卡点集中在五类。欠定义的草图会漂移、过定义的会冲突([sekkei-tech](https://sekkei-tech.com/2026/05/29/solidworks-sketch-constraints-guide/))；草图依附的面被删改后会报 "sketch plane is lost"([Autodesk 支持](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Fusion-360-Timeline-error-The-sketch-plane-is-lost-Cache-is-used-Please-redefine-the-sketch-to-select-other-plane.html))；壳厚只要大于最小曲率半径，抽壳就会失败，哪怕只大 0.01 mm（3.45 mm 成功、3.46 mm 失败）([PLM Group](https://support.plmgroup.eu/hc/en-us/articles/360013960917-Use-of-Check-in-SOLIDWORKS))；装配时零件还能动就继续加配合，结果造成冗余与过定义，SOLIDWORKS 博客把这一点总结为 "Fully defined is a condition. Correctly defined is the goal."([SOLIDWORKS 博客](https://blogs.solidworks.com/products/solidworks/building-stable-solidworks-assemblies/))；还有人误以为曲面 join 起来就是光顺的。中文自学者另有学习方式上的问题：只看不练，出错后关掉重画而不是编辑特征([CSDN](https://blog.csdn.net/weixin_42548874/article/details/164410896))。这些卡点几乎都可以归结为一点：**不理解模型是一张依赖图**。草图自由度、特征父子关系、TNP 和配合自由度，背后是同一种思维。所以网站应该用统一的可视化语言（依赖图 + 自由度计数器）贯穿所有模块，并设计"故意制造失败 → 诊断 → 修复"的练习，例如删掉圆角看下游特征变红、让壳厚超过曲率半径、加一个冗余配合。

### 课程结构提案：一条地基、五条主轨、四类入口

| 轨道 | 模块顺序 | 学时粗估 | 最该做成 3D 交互的课 |
|---|---|---|---|
| T0 空间与读图（所有人必修） | 坐标系与右手定则 → 视图操作与 ViewCube → 原点、基准面、基准轴 → 正投影与三视图 → 第一角 vs 第三角 → 剖视、局部、辅助视图 → 实体 / 曲面 / 网格 → 单位与材料 | 6–8 h | 三视图与 3D 互推、可拖动剖切面、基准面 |
| T1 参数化零件（机械主干） | 草图约束与自由度 → 设计意图入门（同一形状三种约束方案）→ 拉伸与终止条件 → 旋转、布尔、孔、阵列、圆角、抽壳 / 筋 / 拔模、扫掠 / 放样 → 特征树、父子关系、TNP、特征顺序、诊断修复 → 直接建模与多实体 → 方程、配置、质量属性 | 25–35 h | 自由度计数器、终止条件对比、依赖图、"删圆角下游变红" |
| T2 装配与机构 | 刚体 6 自由度与接地 → 配合与联接 → 冗余与过定义 → 干涉 → 驱动与典型机构 → 自顶向下与骨架 | 10–15 h | 剩余自由度可视化、冗余配合诊断、机构运动 |
| T3 工程图与公差 | GB 图框与标题栏 → 视图表达 → 尺寸原则 → 装配图与明细表 → 尺寸公差与配合 → GD&T 入门 → GB / ISO / ASME 对照 | 8–12 h | 孔轴配合动画、3D 公差带 |
| T4 DFM | 工艺选择 → 3D 打印 → CNC → 钣金 → 注塑 | 12–18 h | 悬垂着色、刀具可达扫掠、折弯与展开、壁厚热力图、拔模分析 |
| T5 曲线、曲面与造型（ID 轨） | NURBS 控制点与阶数 → 曲率梳 → G0–G3 → 由曲线建面 → 曲面匹配 → 斑马纹与高光 → 圆角 vs 混接 → 布面与 Class-A → SubD → 造型到工程（拆件、DFM 回检） | 25–40 h | 拖控制点实时更新曲率梳与斑马纹、把 G1 圆角矩形改成 G2 |

学时参照认证与院校课程粗估（ACU 约 150 小时，Onshape 认证助理考试建议有 35–50 小时经验([Onshape](https://www.onshape.com/en/blog/onshape-certified-associate-cad-exam))，国内 Rhino 课 48–64 学时），整套提案尚未经真实学习者验证。四类人群各走一条入口（见下表），给软件转硬件的人讲课时可以借编程类比：特征树像程序，TNP 像不稳定的 ID，配置像参数化构建。贯穿项目里应设一类"按图建模挑战"，学习者在任意软件里建模、回填体积、质心或包围盒就能自动判分——这正是 CSWA 的判分方式，但要补上几何比对，堵住后文提到的"质量对了、特征放错"的漏洞；认证、1+X 证书和 Siemens NX 认证([无锡职业技术大学 MOOC](https://www.icourse163.org/course/WXIT-1207055808?tid=1488261531))可以作为路径终点的外部目标。

| 人群 | 入口路径 | 收尾项目 |
|---|---|---|
| 工业设计师 | T0 → T5 曲线与曲面分析 → T1 精简版 → 布面与"造型到工程" → 注塑 DFM | 手持小家电外壳 |
| Makers | T0 → T1 前三个模块 → 3D 打印 DFM → 装配基础 | 收纳盒或铰链盒 |
| 硬件工程师 | T0 → T1 → T2 → T3 → CNC、钣金、注塑 | 钣金机箱或简单机构 |
| 软件转硬件 | T0 → T1（重点是依赖图、TNP、参数化）→ 3D 打印 → T2 → T3 基础 | 参数化系列件 |

### 译名对照：基础词一致，分歧集中在二十来个概念

本次逐条核对了各软件的官方中文名，但各家的核对方式和可信度不同。Fusion 抓取了官方中文帮助目录的全部 5,862 个条目([Fusion CHS 帮助目录](https://help.autodesk.com/view/fusion360/CHS/data/toctree.json))，Onshape 核对中文帮助的页面标题([Onshape 中文帮助](https://cad.onshape.com/help/zh_CN/Content/PartStudio/extrude.htm))，Creo 12 核对简体中文帮助索引([Creo 12 零件建模](https://support.ptc.com/help/creo/creo_pma/r12/chinese_cn/part_modeling.html))，Rhino 8 核对中文帮助的"功能表"一栏([Rhino 8 Sweep1](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/sweep1.htm))，FreeCAD 核对官方翻译文件([PartDesign_zh-CN.ts](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/PartDesign/Gui/Resources/translations/PartDesign_zh-CN.ts))；SOLIDWORKS 帮助站拒绝脚本访问，只能通过搜索引擎核对官方页面标题([拉伸 PropertyManager](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/r_extrude_propertymanager.htm))，NX 中文帮助靠 JS 渲染、抓不到正文，只能用第三方教程佐证([CSDN NX 2406](https://blog.csdn.net/weixin_43911798/article/details/145258593)；[清华大学出版社 NX 12 样章](http://www.tup.tsinghua.edu.cn/upload/books/yz/082155-01.pdf))。

拉伸、旋转、圆角、倒角、抽壳、拔模这些基础词各家基本一致，分歧集中在下表的二十来处，其中几处需要特别更正或提防。**Fusion 的 Rib 叫"加强筋"，整套中文帮助里"肋"字出现 0 次**([创建加强筋](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-RIB.htm))，Onshape 则叫"肋材"([肋材](https://cad.onshape.com/help/zh_CN/Content/PartStudio/rib.htm))。Creo 的"混合"属于放样类，Rhino 的"混接曲面"（BlendSrf）却是过渡曲面([Rhino BlendSrf](https://docs.mcneel.com/rhino/8/help/zh-cn/commands/blendsrf.htm))，两者不能对应；Fusion 的"边界实体"也不是边界曲面([创建边界实体](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-CREATE-BOUNDING-SOLID.htm))，它还把斑马纹分析叫"斑纹分析"([斑纹分析](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-3F8BA6D3-5DF2-49FA-BE7D-8CCEF718C795.htm))。SOLIDWORKS 同一套帮助里"镜向"和"镜像"两种写法并存([镜向特征 PropertyManager](https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_DVE_FEAT_MIRROR.htm))，回滚工具在帮助正文里叫"退回控制棒"([FeatureManager 设计树概述](https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_featuremanager_design_tree_overview.htm))，繁体版的术语差异更大（"伸長"即拉伸），抓资料时要避开繁体路径。表中〔三〕表示只有第三方中文教程佐证，〔?〕表示未核实、按常见用法填写，— 表示没有直接对应的命令。

| 站内主标签 | SOLIDWORKS | Fusion | Onshape | Creo 12 | NX（据教程） | Rhino 8（指令名） |
|---|---|---|---|---|---|---|
| 拉伸 | 拉伸凸台/基体 | 拉伸 | 拉伸 | 拉伸 | 拉伸〔三〕 | 挤出（ExtrudeCrv） |
| 拉伸切除 | 拉伸切除〔?〕 | 拉伸，操作选"剪切"〔?〕 | 拉伸，选"移除"〔?〕 | 拉伸切口 | 拉伸 + 减去〔?〕 | 差集（BooleanDifference） |
| 旋转 | 旋转凸台/基体 | 旋转 | 旋转 | 旋转 | 旋转〔三〕 | 旋转成形（Revolve） |
| 扫掠 | 扫描 | 扫掠 | 扫掠 | 扫描 | 扫掠〔三〕 | 单轨 / 双轨扫掠（Sweep1/2） |
| 放样 | 放样凸台/基体 | 放样 | 放样 | 混合 | 通过曲线组 | 放样（Loft） |
| 边界曲面 | 边界曲面 | 无同名命令（"边界实体"另有所指） | 边界曲面 | 边界混合 | 通过曲线网格〔?〕 | 网线（NetworkSrf） |
| 圆角 | 圆角 | 圆角 | 圆角 | 倒圆角 | 边倒圆〔三〕 | 边缘圆角（FilletEdge） |
| 倒角 | 倒角 | 倒角 | 倒角 | 倒角 | 倒斜角〔三〕 | 不等距边缘斜角（ChamferEdge） |
| 抽壳 | 抽壳 | 抽壳 | 抽壳 | 壳 | 抽壳〔三〕 | 薄壳（Shell） |
| 筋 | 筋 | 加强筋 / 网状加强筋 | 肋材 | 轮廓筋 / 轨迹筋 | 筋板〔?〕 | — |
| 孔 | 异型孔向导 | 孔 | 孔 | 孔 | 孔〔?〕 | — |
| 线性阵列 | 线性阵列 | 矩形阵列 | 线性阵列 | 阵列 | 阵列特征（线性）〔三〕 | 阵列（Array） |
| 环形阵列 | 圆周阵列 | 环形阵列 | 环形阵列 | 阵列（轴）〔?〕 | 阵列特征（圆形）〔三〕 | 环形阵列（ArrayPolar）〔?〕 |
| 镜像 | 镜向 / 镜像并存 | 镜像 | 镜像 | 镜像 | 镜像特征〔三〕 | 镜像（Mirror） |
| 偏移曲面 | 等距曲面 | 偏移 | 偏移曲面 | 偏移 | 偏置曲面〔?〕 | 偏移曲面（OffsetSrf） |
| 缝合 | 缝合曲面 | 缝合 | 封闭（封成实体） | 合并（面组） | 缝合 | 组合（Join） |
| 特征树 / 回滚 | FeatureManager 设计树 / 退回控制棒 | 时间轴 / 拖动时间轴标记〔?〕 | 特征列表 / 回滚条 | 模型树 / 插入模式〔?〕 | 部件导航器〔?〕 | 无特征树（记录建构历史） |
| 参数 / 配置 | 方程式 / 配置 / 系列零件设计表 | 更改参数 / 配置表 | 变量 / 配置 | 参数、关系 / 族表 | 表达式〔?〕 | 依赖 Grasshopper〔?〕 |
| 配合 | 配合 | 联接 | 配合 | 放置约束 | 装配约束〔三〕 | — |
| 爆炸视图 | 爆炸视图 | 自动 / 手动分解（动画工作空间） | 分解视图 | 分解视图 | 爆炸图〔三〕 | — |
| 物料清单 | 材料明细表 | BOM 表（工程图教程称"明细表"） | 物料清单表格 | 物料清单（BOM） | 明细表〔?〕 | — |
| 钣金基体 / 展开 | 基体法兰 / 展开、平展 | 凸缘 / 展开、创建展开模式 | 钣金模型 / 展开视图 | 平面壁 / 展平 | 突出块 / 展平实体〔三〕 | — |

站内主标签取多数派的中性名，各软件的官方名放进 tooltip：用"扫掠"不用"扫描"（后者容易被读成 scan），用"筋"不用"肋"，用"环形阵列"不用"圆周阵列"，用"爆炸视图"不用"分解视图"。tooltip 由中文主标签、一句话定义、各软件官方名与菜单路径、代码 API 名四部分组成，API 名可以写 build123d 的 `extrude()`、`revolve()`、`sweep()`、`loft()`、`fillet()`，抽壳用 `offset(openings=…)`、环形阵列用 `PolarLocations`([build123d Operations](https://build123d.readthedocs.io/en/latest/operations.html))，以及 CadQuery 的 `cutBlind()`、`shell()`、`polarArray()`([CadQuery API](https://cadquery.readthedocs.io/en/latest/apireference.html))。Rhino 要同时给中文菜单名和英文指令名，因为用户常在命令行直接输入英文指令；FreeCAD 的中文翻译内部不一致（Vertical 时而译"垂直"、时而译"竖直"，Revolute 联接被译成了"旋转体"），建议保留英文原名。术语表按"软件 × 版本 × 术语"存储并标注核对日期；NX 是国内制造业的主力软件，在拿到官方中文界面截图之前，整列都应标注"据常见教程"。

### 经典练习件：开源示例给出现成的特征序列和滑块参数

能直接复用、参数公开的标准拆解来自三类来源：开源代码示例（OCCT MakeBottle、build123d、CadQuery 和 bd_warehouse 标准件库），厂商官方教程（SOLIDWORKS 入门三件套，Fusion 中文帮助里的曲面与钣金教程），以及练习题库（Too Tall Toby、CSWA）。这些示例的参数天然就是滑块候选，默认值可以作为滑块中点。手电筒、按动笔、台灯、凳子这几个常见对象没有找到权威教程，需要自行设计，并在 CAD 里验证。

| 对象 | 基线来源 | 难度 | 主教概念 | 可做滑块的参数（建议值，未经扫参验证） |
|---|---|---|---|---|
| 小盒子 / Tutor1 | [SOLIDWORKS 学生指南](https://www.solidworks.com/sw/docs/student_wb_2011_eng.pdf) | 1 | 拉伸、圆角、抽壳、切除与特征顺序 | 长宽高、壁厚、圆角半径 |
| 轴承座 | [CadQuery Pillow Block](https://cadquery.readthedocs.io/en/latest/examples.html) | 1 | 用构造矩形定孔位、沉头孔 | 长 30–80、高 40–100、轴承孔 10–40、边距 6–15 |
| 马克杯 / 茶杯 | [build123d Tea Cup](https://build123d.readthedocs.io/en/latest/examples_1.html) | 2 | 旋转、带开口抽壳、全边圆角、沿样条扫掠 | 壁厚 1.5–5（圆角自动取 0.49×壁厚）、杯高、口径 |
| 积木 | [build123d Lego](https://build123d.readthedocs.io/en/latest/tutorial_lego.html) | 2 | 计数驱动尺寸、网格阵列、偏移出壁厚 | 凸点 1–8 × 1–4、薄 / 标准高度 |
| 法兰 | [bd_warehouse flange](https://bd-warehouse.readthedocs.io/en/latest/flange.html) | 2 | 旋转、圆周阵列、以螺栓孔节圆表达意图 | 螺栓孔数 4–16、节圆直径、厚度 |
| 烛台 / 凿子 | [SOLIDWORKS 教师指南](https://www.solidworks.com/sw/docs/instructor_wb_2011_eng.pdf) | 2 | 旋转 + 扫描 + 带拔模的切除；多基准面放样 | 高度、把手路径、拔模角 0–10° |
| 钣金支架 | [Onshape 钣金模型](https://cad.onshape.com/help/zh_CN/Content/PartStudio/sheet_metal_model.htm) | 2 | 法兰、止裂槽、K 系数、展开图 | 板厚 0.8–3、折弯半径、K 0.3–0.5、折弯角 45–135° |
| 瓶子 MakeBottle | [OCCT 教程](https://dev.opencascade.org/doc/overview/html/occt__tutorial.html) | 3 | 镜像轮廓、拉伸、先全边圆角后抽壳、布尔融合瓶颈、曲面上做螺纹 | 宽、高、厚三个主参数，其余按比例派生 |
| 键帽 | [build123d Key Cap](https://build123d.readthedocs.io/en/latest/examples_1.html) | 3 | 锥度拉伸、布尔做碟面、十字筋与轴座、拉伸到下一面 | 锥度 5–20°、碟面球半径、圆角 0.5–2 |
| 直齿轮 | [FreeCAD 渐开线齿轮](https://wiki.freecad.org/PartDesign_InvoluteGear) | 3 | 派生尺寸（分度圆 = 模数 × 齿数）、圆周阵列、齿轮联接 | 模数 0.5–4、齿数 8–80、压力角 14.5 / 20 / 25 |
| 螺栓 + 螺母 | [bd_warehouse fastener](https://bd-warehouse.readthedocs.io/en/latest/fastener.html) | 3 | 系列零件 / 配置、螺纹、同轴配合、轴向爆炸 | 规格 M3–M20、长度、全 / 半螺纹 |
| 带铰链盒子 | [build123d Joint Tutorial](https://build123d.readthedocs.io/en/latest/tutorial_joints.html) | 3 | 联接、自由度、装配顺序、爆炸 | 开合角 0–110°、盒体尺寸 |
| 电子外壳 | [CadQuery Parametric Enclosure](https://cadquery.readthedocs.io/en/latest/examples.html)、[Fusion 卡扣式连接](https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SNAP-FIT.htm) | 4 | 抽壳、圆角顺序、拔模、筋、凸柱、卡扣、止口、分模、BOM | 壁厚 1.5–4、侧圆角 0–15、拔模 0.5–3° |
| 铁铲 | [Fusion 中文曲面教程](https://help.autodesk.com/cloudhelp/CHS/Fusion-Patch/files/GUID-6DF364B8-C94F-4AFC-B27B-A7BC2F86F8E3.htm) | 4 | 建曲面、修剪、曲面转实体 | 铲面宽、曲率、柄角 |
| 鼠标 | [GrabCAD 19 步教程](https://grabcad.com/tutorials/surface-modelling-a-mouse-in-solidworks) | 5 | 边界曲面、G1/G2、相互修剪、加厚验证水密、分割成多实体 | 长宽高、侧面凹陷深度、按键分割线位置 |
| 按图建模题 | [build123d 版 TTT 题解](https://build123d.readthedocs.io/en/latest/tttt.html) | 2–4 | 读图建模、用质量自检、参数变更 | 题目变量（如 C = B + 20）、材料密度 |

**特征顺序依赖**最有信息量的演示，是把"先圆角再抽壳"和"先抽壳再圆角"并排对照，因为各方的做法本身就不一致：SOLIDWORKS 帮助建议先圆角、再抽壳([抽壳](https://help.solidworks.com/2022/Chinese-simplified/SolidWorks/Sldworks/c_Shells_Folder.htm))，OCCT 瓶子示例也是这个顺序，build123d 茶杯却是先抽壳、后圆角；CadQuery 外壳示例在代码注释里警告圆角顺序错了会出现怪异几何，因此按半径大小决定先倒哪组边([CadQuery Examples](https://cadquery.readthedocs.io/en/latest/examples.html))；一个开源 CAD 的 issue 还记录了壳的内角是尖是圆，取决于壁厚与外圆角半径的相对大小([solidcraft #775](https://github.com/tangency-labs/solidcraft/issues/775))。**设计意图**最适合用派生关系来演示——轴承座的孔位跟着构造矩形移动，积木长度等于单元尺寸乘凸点数，茶杯圆角取 0.49 倍壁厚（刚好小于壁厚一半，可以防止圆角失败），齿轮分度圆直径等于模数乘齿数——页面上可以把这些关系画成"锁链"，再故意把孔位改成绝对坐标，让学习者看到改尺寸后孔会跑偏。曲面连续性用鼠标和铁铲演示，装配与爆炸则用铰链盒、螺栓组（轴向爆炸）和深沟球轴承（径向爆炸，[bd_warehouse bearing](https://bd-warehouse.readthedocs.io/en/latest/bearing.html)）。

起手模型选马克杯和电子外壳：马克杯覆盖旋转、抽壳、圆角、扫掠和样条，电子外壳覆盖拉伸、圆角顺序、拔模、筋、凸柱、孔、阵列、分割、装配、爆炸和 BOM。要注意，上表的滑块范围只是按工程常识给的建议值；后文的内核 spike 表明，即便马克杯这样简单的零件，滑块全范围随机取参也有 30% 的组合失败，每个课程模型上线前都要离线把参数可行域扫一遍。

## 证据支持"一步一特征、逆向渐隐、关键视角"，不支持"转得越多学得越好"

### 空间能力能练，但"能转动 3D"本身不是关键

**空间能力可以训练，效果持久，还能迁移。** Uttal 等汇总 217 项训练研究，训练组相对对照组的效应量 g = **0.47**([Uttal et al. 2013](https://groups.psych.northwestern.edu/uttal/vittae/documents/ContentServer.pdf))。不过对照组自身因重测也提高了约 0.45，研究设计会大幅影响报告值。Michigan Tech 让 PSVT:R 空间测验得分 ≤60% 的工程新生上空间技能课，这些起点低的学生后续理科与工程课表现更好；没通过测验但上了课的女生，留存率为 89%，没通过也没上课的只有 68%([EngageEngineering](https://www.engageengineering.org/spatial/whyitworks/learnmore))。

但**"网页上能转 3D 模型"本身并不起作用**。Keehner 等发现，决定表现的是学习者有没有看到任务关键的视角，而不是有没有亲手控制旋转([Keehner et al. 2008](https://onlinelibrary.wiley.com/doi/10.1080/03640210801898177))。一项随机试验中，低空间能力学生在多视角条件下的估计得分低 **20%**([Levinson et al. 2007](https://asmepublications.onlinelibrary.wiley.com/doi/10.1111/j.1365-2929.2006.02694.x))；而"关键视角 + 约 ±10° 小幅晃动"与多视角学得一样好([Garg et al. 2002](https://www.researchgate.net/publication/11081945_Is_There_Any_Real_Virtue_of_Virtual_Reality_The_Minor_Role_of_Multiple_Orientations_in_Learning_Anatomy_from_Computers))。

相反的结果也存在：亲手操纵对低空间能力者帮助更大([Jang et al.](https://www.sciencedirect.com/science/article/abs/pii/S0360131516302512))。调和的办法是把操纵设计成有目的的任务，例如"拖动剖切平面，直到截面出现两个圆"。Cohen 与 Hegarty 训练截面思维时，用的正是"交互动画 + 让学生画出截面 + 给反馈"([Cohen & Hegarty 2014](https://www.sciencedirect.com/science/article/abs/pii/S1041608014000739))。

### 多媒体学习原则给分步建模课定了骨架

Mayer 手册汇总的中位效应量如下：说明与画面时间同步 d = 1.22，去除装饰 0.86，分段 0.79，预训练 0.75，高亮提示只有 0.41([第 13 章](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pretraining-and-modality-principles/DD24C2F48B9B1277CE59F78276110258)；[第 12 章](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E))。这些数字要打折看：后续版本里普遍缩水，分段降到 0.70，预训练降到 0.46([Mayer 2017](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12197))；分段的元分析只得到小到中等效应([Rey et al. 2019](https://link.springer.com/article/10.1007/s10648-018-9456-4))；当对照组视频本身也能由用户控制时，分段的优势就消失了([Garrett 2020](https://www.bera.ac.uk/blog/does-breaking-up-a-video-into-parts-improve-learning))。分段粒度有个好参照：按步骤给反馈的辅导系统相对无辅导的效应量 d = 0.76，再细到子步骤只多 0.16([VanLehn 2011](https://eric.ed.gov/?id=EJ946764))——对应到 CAD，"一步 = 特征树里的一行"恰好是合适的粒度。

从示例过渡到独立解题，逆向渐隐（先空出最后一步让学习者做，再空出最后两步）优于正向渐隐([Renkl & Atkinson 2003](https://www.researchgate.net/publication/253450162_Structuring_the_Transition_From_Example_Study_to_Problem_Solving_in_Cognitive_Skill_Acquisition_A_Cognitive_Load_Perspective))；渐隐只能稳定促进近迁移，加上"找出每一步背后原理"的自我解释提示才能补上远迁移([Atkinson et al. 2003](https://www.researchgate.net/publication/200772684_Transitioning_From_Studying_Examples_to_Solving_Problems_Effects_of_Self-Explanation_Prompts_and_Fading_Worked-Out_Steps))，自我解释的元分析效应为 g = 0.55([Bisra et al. 2018](https://link.springer.com/article/10.1007/s10648-018-9434-x))。对已经会的人，同样的脚手架会变成负担，这叫专长逆转效应([Kalyuga 2007](https://link.springer.com/article/10.1007/s10648-007-9054-3))，可以先问一句"你会先建哪个特征"，用这个第一步诊断快速分流([Kalyuga & Sweller 2005](https://www.academia.edu/1405551/Rapid_dynamic_assessment_of_expertise_to_improve_the_efficiency_of_adaptive_e_learning))。CAD 领域的直接对照研究很少，Barnes 与 Wiebe 只在讨论中提出初学者同时学软件界面和建模思路容易认知超载([ASEE](https://peer.asee.org/the-effects-of-worked-examples-on-cad-performance-an-application-of-the-four-component-instructional-design-model-to-cad-instruction))，这恰好支持网页把软件界面抽象掉、只呈现建模思路。

### 动画只用在"变化本身就是学习内容"的地方

动画相对静态图，总体效应 d = 0.37；学程序性-动作知识时，达到 1.06([Höffler & Leutner 2007](https://eric.ed.gov/?id=EJ780451))。较新的元分析总体只有 g = 0.226，但动画不伴随文字时升到 0.883([Berney & Bétrancourt 2016](https://www.sciencedirect.com/science/article/abs/pii/S0360131516301336))。理解结构则不一定需要动画：Hegarty 等发现看动画并不比看静态图更懂机构，让学生看着静态图预测运动，收益与看动画相当([Hegarty, Kriz & Cate 2003](https://eric.ed.gov/?id=EJ761566))。

暂停、拖动、步进这类控件，在学打航海绳结这样的程序性任务里能缩短掌握时间([Schwan & Riempp 2004](https://www.researchgate.net/publication/222436104_The_cognitive_benefits_of_interactive_videos_Learning_to_tie_nautical_knots))，但"学习者控制"作为一般设计手段的平均效应接近零([Karich et al. 2014](https://eric.ed.gov/?id=EJ1034262))，所以控件要嵌进任务里，例如"拖动时间轴，找到这个孔是在哪一步出现的"。PhET 的"隐性脚手架"用可供性、约束、提示和即时反馈来引导探索，又不让学生觉得被引导([Podolefsky et al.](https://arxiv.org/abs/1306.6544))；落到本站，就是每个特征只开放 1–2 个与学习目标相关的参数滑块，锁住无关参数，拖动后立即重建。

### 练习、评估与动机

练习方式的证据很清楚，见下表。

| 练习方式 | 效应 | 来源 |
|---|---|---|
| 课堂测验 | g = 0.499；测后给纠正反馈效果更好 | [Yang et al. 2021](https://pubmed.ncbi.nlm.nih.gov/33683913/) |
| 解释性反馈 vs 只告诉对错 | g = 0.49 vs 0.05 | [Van der Kleij et al. 2015](https://eric.ed.gov/?id=EJ1081708) |
| 交错练习 | g = 0.42；类别越相似收益越大 | [Brunmair & Richter 2019](https://www.semanticscholar.org/paper/Similarity-matters:-A-meta-analysis-of-interleaved-Brunmair-Richter/bb5392e8eaf53a38cc0d147f301cce74cecb4436) |
| 间隔复习 | 最佳间隔约为目标保持期的 5–40% | [Cepeda et al. 2008](https://journals.sagepub.com/doi/10.1111/j.1467-9280.2008.02209.x) |

编程教育里有一种 Parsons 题：把打乱的代码行拖回正确顺序。它的用时约为等价编程题的一半，收益相当([Zhi et al. 2019](https://dl.acm.org/doi/10.1145/3291279.3339419))。这为"特征树排序题"提供了类比证据，但 CAD 领域还没有直接检验。找错练习只对先验知识较好的学习者有益([Große & Renkl 2007](https://eric.ed.gov/?id=EJ780439))，应放在模块后半段。

CAD 评估还要超越"形状对不对"。Otey 等把设计意图定义为"模型被修改时的预期行为"([Otey et al. 2018](https://www.researchgate.net/publication/318807581_Revisiting_the_design_intent_concept_in_the_context_of_mechanical_CAD_education))；Company 等主张从培训一开始就用一套协调的模型质量评分标准(rubric)([Company et al. 2015](https://www.sciencedirect.com/science/article/abs/pii/S0010448514002309))；正确传达设计意图，还与更短的修改时间相关([Johnson & Diwakaran 2011](https://eric.ed.gov/?id=EJ925816))。因此**"改参测试"应成为核心题型**。

策略性知识要显式地教。Bhavnani 等发现，有多年经验的用户仍在用低效策略；而高效、通用的策略，能在有限时间内教会，也不损害命令知识([Bhavnani et al. 2001](https://dl.acm.org/doi/10.1145/365024.365107))。在实践课上额外讲解"本练习的设计意图规则小结"，能显著提升建模成绩([Barbero et al. 2017](https://link.springer.com/article/10.1007/s10798-016-9358-z))。跨软件迁移没有找到同行评审的测量研究，网站可以说"教的是各软件通用的建模思路"，不能承诺"学完换任何软件都会"。

动机方面，游戏化对认知结果的平均效应 g = 0.49([Sailer & Homner 2020](https://eric.ed.gov/?id=EJ1245270))；但以排行榜和徽章为主的课程，学生的内在动机和期末成绩都更低([Hanus & Fox 2015](https://www.researchgate.net/publication/265644737_Assessing_the_effects_of_gamification_in_the_classroom_A_longitudinal_study_on_intrinsic_motivation_social_comparison_satisfaction_effort_and_academic_performance))。进度条如果"先慢后快"，还会增加中途退出([Villar et al. 2013](https://openaccess.city.ac.uk/id/eprint/14427/))。

### 一节课的模板

把以上证据压成一节课的模板，就是下表。

| 环节 | 规则 | 主要依据 |
|---|---|---|
| 开场 | 1 道"第一步诊断"，答对者直接进渐隐或独立阶段；再给 30–90 秒术语与部件卡 | 专长逆转效应、预训练原则 |
| 步骤粒度 | 1 步 = 1 个特征；特征边界自动暂停；按特征给反馈，而不是按单次点击 | 分段原则、VanLehn 2011 |
| 每步循环 | 关键视角 → 播放或拖动 → 1–2 个参数滑块；每 2–3 步插一个"为什么" | Keehner 2008、PhET、自我解释 |
| 预测 | 每节挑 1–3 个最易错的步骤，先预测再播放 | Hegarty 2003 |
| 课尾 | 设计意图规则小结 + 3–5 题检索小测（含 1 题特征排序、1 题改参预测），给解释性反馈 | Barbero 2017、Yang 2021、Van der Kleij 2015 |
| 模块递进 | 完整示例 → 逆向渐隐 → 独立重建 + 改参测试 | Renkl & Atkinson、Otey 2018 |
| 复习与掌握 | 约 1 天、1 周、3 周后复习，混入易混特征；检查点 80–90%，未达标就推送复习，但不锁路 | Cepeda 2008、Brunmair & Richter 2019、[Kulik 1990（掌握学习 ES = 0.52）](https://www.uky.edu/~gmswan3/575/kulik_kulik_Bangert-Drowns_1990.pdf) |
| 时长 | 每节有效互动 5–10 分钟，连续"只看"的部分不超过约 3 分钟 | [Guo et al. 2014（视频中位观看时长 ≤6 分钟；测的是参与度，不是学习效果）](https://dl.acm.org/doi/10.1145/2556325.2566239) |

## 在被调研的 37 个产品里，没有一个用中文和可交互 3D 讲特征树

### 厂商课程、练习平台与 AI 助手都不讲概念层

厂商学习中心几乎都是"短视频 + 在真实软件里跟着做 + 测验或证书"的形式，而且绑定自家工具：Onshape Learning Center 用 3–5 门课组成学习路径，学完发证书([Onshape](https://www.onshape.com/en/education/student-resources))；Autodesk 有一门以设计自行车脚踏为项目的 90 分钟入门课([Autodesk Learn](https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes))；MySolidWorks 自 2026 年 7 月起把 400 多门课全部免费开放([SOLIDWORKS 博客](https://blogs.solidworks.com/products/solidworks/advance-your-skills-anytime-anywhere-mysolidworks-training-resources-are-now-free/))，付费的 Professional 档则在 2027-03-01 下线([GoEngineer](https://www.goengineer.com/blog/mysolidworks-professional-activation))。软件内的引导式教程只有零星几家。真正在浏览器编辑器里一步步带着操作的，只有 Tinkercad Lessons，它的 10 节课只教放置、移动、对齐这类基本操作([Tinkercad](https://www.tinkercad.com/learn/overview/OPC41AJJKIKDWDV))。Shapr3D 首次登录强制完成约 6 分钟的实操教程；员工透露，A/B 测试显示它明显提高了新用户采用率，改成可跳过后采用率随之下降([Shapr3D 社区](https://discourse.shapr3d.com/t/skipping-intro-tutorial/17130?page=2))。

练习类产品用"看图建模、再提交质量"来自动判题。Too Tall Toby 有 250 多道不限软件的挑战([TTT](https://www.tootalltoby.com/practice/sample/))，但只校验质量，因此存在"Ivan Exploit"：特征放错了位置，质量却对得上([TTT 赛事规则](https://tootalltoby.com/tournaments/2025/world_championship/tournament_rules/))。SOLIDWORKS Model Mania 的第二阶段会给出变更单，要求改模后再提交质量，考的正是设计意图([Model Mania 2026](https://blogs.solidworks.com/products/solidworks/model-mania-2026-overview-solution-and-winners/))。Brilliant 的形态是无视频、每课约 15 分钟、每屏都要动手、即时反馈([Brilliant FAQ](https://brilliant.org/faq/))，这是概念优先交互课最接近的现成模板。

2025–2026 年各家新增的主要是 AI 助手：Onshape AI Advisor 基于培训资料回答问题、不读取用户模型([Onshape 1.205](https://www.onshape.com/en/resource-center/what-is-new/ai-advisor-configurable-variable-studios-simulation))，SOLIDWORKS AURA 基于文档和培训手册给出分步操作说明([SOLIDWORKS 2026](https://blogs.solidworks.com/solidworksblog/2025/10/whats-new-in-solidworks-2026-collaboration-and-data-management.html))，Zoo 和 Adam 则直接生成可编辑的特征树或参数化代码([Zoo Design Studio v1](https://zoo.dev/blog/zoo-design-studio-v1)；[Adam](https://www.ycombinator.com/launches/MfX-adam-ai-co-pilot-for-cad))。这些 AI 产品要么回答"怎么点"，要么替人建模，都没有补上概念理解这一层。

### 英文交互图解树立了标杆，却没碰建模操作

英文的交互式图解文章（explorable explanations）树立了标杆。Bartosz Ciechanowski 的 Gears 每个新概念配一张图、通常一次只改一个变量，颜色语义全文固定（主动件黄、从动件绿、惰轮蓝），每张动画图自带播放和暂停([Gears](https://ciechanow.ski/gears/))，他的 Curves and Surfaces 则从控制点一路讲到 NURBS([Curves and Surfaces](https://ciechanow.ski/curves-and-surfaces/))；Pomax 的 Bézier 曲线入门几乎每张图都能拖动控制点，并用同一份源码在服务端渲染首帧，没有 JS 也能看([graphics-element](https://pomax.github.io/custom-graphics-element/))；Nicky Case 主张只在过程和系统上用交互，并总结了"证明理解了才能往下走"和"先下注、再揭晓"两种检验模式([Nicky Case](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/))。这些作品讲了"机构怎么工作"和"曲面怎么定义"，却没有一篇讲拉伸、抽壳、圆角、布尔这些建模操作，也没讲特征树和设计意图。

它们同时暴露了这类内容的最大风险：生产成本。Bartosz 一个人手写 WebGL，还被批评读屏软件读不了([HN](https://news.ycombinator.com/item?id=50045147))；Animagraffs 一个模型常要做一个多月([Technical Illustrators](https://technicalillustrators.org/2019/08/animagraffs-by-jacob-oneal/))；Distill 因志愿编辑团队倦怠，于 2021 年无限期停刊([Distill Hiatus](https://distill.pub/2021/distill-hiatus/))。中文站要持续更新，就必须先建一套可复用的"操作模拟 + 拆解播放器"组件，让新课主要靠写配置和文案来生产。

### 国内的交互式产品只在 B 端，个人学习者靠视频

中国市场缺的是面向个人的交互式产品。腾讯课堂已于 2024-10-01 全面停运([北京日报](https://xinwen.bjd.com.cn/content/s66852bd1e4b07e497a9776cf.html))，B站成了主阵地。头部 SolidWorks 系列播放量达千万级([B站](https://www.bilibili.com/video/BV1mHy6BiEQi/))，但集数虚标普遍，标着"全399集"的合集实际只有 34 个视频([B站](https://www.bilibili.com/video/BV1nPwcz4EeY/))。垂直站以付费视频为主：溜溜自学网的 Rhino 实战课售价 ¥699([溜溜自学网](https://zixue.3d66.com/course/640.html))，学犀牛的下载区还列着破解版 Rhino([学犀牛](https://www.xuexiniu.com/))。

交互式 3D 学习只以 B 端形式存在：中望教育云提供三维模型批量评分和三视图在线自动判分([中望教育云](https://www.cadexam.com/soft/))，中望 3D 软件内置"边学边用"引导课([中望](https://www.zwsoft.cn/support/87-5765.html))，CrownCAD 称有 400 多所高校用户([CrownCAD](https://www.crowncad.com/zh/))，国家虚拟仿真实验平台 ilab-x 要求课程在网页端打开、无需下载([CSDN](https://blog.csdn.net/mlj890211/article/details/109717789))——但它们都由院校采购、绑定自家软件或以院校课程为单位，个人学习者用不上。

学习者的抱怨高度集中：跟着教程能做，自己做就走样([知乎](https://www.zhihu.com/question/475147050/answer/1952369230939920081))；只看不练；讲完整建模流程的教程太少([知乎专栏](https://zhuanlan.zhihu.com/p/1977026859062544289))。有经验的用户给出的提速秘诀，是把设计树底部的蓝色回滚条往上拖，看别人每个特征怎么做，再一步步重做([知乎](https://www.zhihu.com/question/345964735))。可见"拆解学习"的需求真实存在，只是现在要装软件、拿原文件、自己琢磨。本次检索没有覆盖微信小程序和小型独立站，下表中"空白"的结论只限于检索得到的产品。

| 区块 | 代表 | 拥挤度 |
|---|---|---|
| 工具操作 + 视频 + 绑定单一软件 | Onshape Learning Center、Autodesk Learn、MySolidWorks、Shapr3D、SketchUp Campus、B站、学犀牛、溜溜自学网 | 极拥挤 |
| 工具操作 + 软件内引导 | Tinkercad Lessons、中望"边学边用"、Shapr3D 强制入门 | 中等 |
| 结果校验练习 | Too Tall Toby、GrabCAD；Model Mania（仅 SOLIDWORKS） | 中等，英文为主 |
| 概念优先的交互图解 | Bartosz Ciechanowski、Pomax、Animagraffs | 稀少，且不讲建模操作 |
| 课程级 3D 虚拟仿真 | ilab-x、中望实训与评分 | B 端，不对个人开放 |
| AI 问答、生成与 copilot | Onshape AI Advisor、Autodesk Assistant、SOLIDWORKS AURA、Zoo、Adam | 快速增长，不讲概念 |
| 中文 + 概念优先 + 不限工具 + 交互 3D + 特征树 | 未发现 | 空白 |

### CAD 里现成的重建手段可以借，有四件事没人做过

CAD 软件里早有一整套分步重建的基本手段，只是都为编辑而设计、不为讲解。Onshape 的回滚条拖到哪里，模型就只重建到哪里，↑↓ 键可以单步([Onshape Help](https://cad.onshape.com/help/Content/feature_list.htm))；特征对话框底部的预览滑块从 0%（加特征前）到 100%（加特征后），默认停在 70%、两种状态叠加显示([Onshape Dialogs](https://cad.onshape.com/help/Content/Home/dialogs.htm))；编辑早期特征时按 Final，可以看到所有后续特征重算后的结果([Onshape Tech Tip](https://www.onshape.com/en/resource-center/tech-tips/tech-tip-how-to-use-onshapes-final-button))；鼠标悬停在 BOM 某一行就会高亮对应零件，反之亦然([Onshape BOM](https://cad.onshape.com/help/Content/bill_of_material.htm))；Fusion 时间轴的 Play 按钮则会自动逐个特征回放([Fusion Timeline](https://help.autodesk.com/view/fusion360/ENU/?guid=ASM-USE-TIMELINE))。消费级产品里，LEGO Builder 和 BILT 已把"分步 + 可旋转 3D + 本步零件高亮 + 重播 + 语音 + 开工前概览卡"做成成熟体验([LEGO Builder](https://www.lego.com/en-us/service/help-topics/article/lego-builder-app-3d-building-instructions)；[BILT](https://apps.apple.com/us/app/bilt/id879452214))。Apple 式滚动驱动的爆炸动画吸引力强，但 AirPods Pro 一个页面就用了 1,500 多张图、超过 60 MiB([CodePen](https://codepen.io/charliezstong-pro/pen/YzPrdXV))，还被批评劫持滚动([Daring Fireball](https://daringfireball.net/linked/2019/10/28/airpods-pro-scrolljacking-hell))。

检索中没有找到任何产品做到这四件事：逐特征回放时高亮本步新生成的面，用半透明方式预示后续几何，在基准面上播放草图的绘制过程，随步骤推进在 3D 里出现尺寸标注——这就是本站可以独占的交互。下表列出值得直接借用的模式。

| 借来的模式 | 出处 | 在本站的用法 |
|---|---|---|
| 回滚条 + 自动回放 + 单步 | Onshape 回滚条、Fusion Play | 拆解页的骨架 |
| 0–100% 前后混合滑块 | Onshape 特征对话框 | 操作模拟课的主控件 |
| Final（改上游参数，看下游结果） | Onshape | 改参测试与"终态"开关 |
| 结果类型显式化；出错红 #bd3039，选中黄 #ffc107 | [Onshape 配色](https://cad.onshape.com/help/Content/Home/colors.htm) | 新建 / 加料 / 减料 / 相交的固定配色 |
| 列表 ↔ 3D 交叉高亮 | Onshape BOM | 特征列表 ↔ 面；BOM ↔ 零件 |
| 每步一段可重播 3D、本步零件高亮、开工前概览卡 | BILT、LEGO Builder | 拆解开场卡与逐步高亮 |
| 一图一概念、固定颜色、文字要点颜色等于图上标注颜色 | Bartosz、[iFixit 拆解指南](https://www.ifixit.com/Info/Teardown) | 全站的视觉语法 |
| 可拖动的控制点 | Pomax、Curves and Surfaces | 曲线与连续性课 |
| 先下注再揭晓；证明理解才能往下 | Nicky Case | 预测-揭示与检查点 |
| 两阶段变更单 | Model Mania | 改参测试 |
| 质量校验（需补几何比对，防 Ivan Exploit） | Too Tall Toby | 按图建模题自动判分 |
| 径向爆炸系数滑块（0–2） | [xeokit exploder](https://xeokit.github.io/sdk/docs/api/modules/presentations.exploder.html) | 展示用爆炸 |
| 按装配逆序、沿真实拆卸方向分解（螺栓沿自身轴线退出） | [中文爆炸图原则](https://yun.gstarcad.com/news/724/) | 工程用爆炸 |
| 无 JS 也能看的静态首帧 | Pomax | 可访问性与降级 |

## 内核实测：改参 0.15 秒够快，但 4.6 MiB 下载和 1 GB 内存决定了要用混合架构

### 渲染层以 WebGL 为基线，一页只用一块画布

渲染层的选择相对明确。three.js 当前版本是 r187（2026-10-30）([r187 release](https://github.com/mrdoob/three.js/releases/tag/r187))，新的 WebGPU 渲染器已经可用、浏览器不支持时能回退到 WebGL 2，但 CAD 渲染依赖的生态还停在 WebGL：N8AO 环境光遮蔽库明确不兼容 WebGPU([N8AO](https://github.com/N8python/n8ao))，`@react-three/postprocessing` 和 drei 中改写 shader 的组件都不能用于 WebGPU 渲染器([Utsubo 迁移清单](https://www.utsubo.com/blog/webgpu-threejs-migration-guide))，React Three Fiber 以 WebGPU 为先的 v10 仍是 alpha 版([R3F v10.0.0-alpha.6](https://github.com/pmndrs/react-three-fiber/releases/tag/v10.0.0-alpha.6))。所以 2026 年底启动的项目应以 WebGL 渲染器为基线。课程页常有多张小 3D 图，而浏览器通常只允许约 8–16 个 WebGL 上下文，不同上下文之间也不能共享几何与纹理([three.js 手册](https://mc.dean.lsa.umich.edu/threejs/manual/en/multiple-scenes.html)；[three.js 论坛](https://discourse.threejs.org/t/how-many-renderers-is-too-many/58774))。解决办法有两种：用单一画布加 scissor 切出多个视口（drei 的 `<View>` 就是这么做的([drei View](https://drei.docs.pmnd.rs/portals/view))）；或者只挂载当前可见的 1–2 个实时视图，其余用静帧占位。

"CAD 观感"的配方有两点。第一，特征边用 B-rep 内核给出的真实边，画成粗线，不依赖 `EdgesGeometry`：它只按相邻三角面的夹角阈值取边，相切过渡处夹角接近 0，会被漏掉。第二，剖切封口用模板缓冲（stencil），r163 之后必须在创建渲染器时显式写 `stencil: true`([three.js 论坛](https://discourse.threejs.org/t/clipping-plane-stencil-capping/74018))。现成查看器里功能最全的是 three-cad-viewer，爆炸、带封口的剖切、测量、斑马纹俱全。但它内联了 three r184，压缩包 437 KB（gzip），而且只支持 WebGL([three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer))。和自家的 three.js 并存会重复加载，更适合借鉴它的数据格式，而不是直接嵌入。

### 内核选型：体积和许可是第一道筛子

浏览器内的真 B-rep 内核在 2026 年明显变多，体积和许可是第一道筛子（下表为 npm 安装包实测）。replicad 1.2.0（MIT，2026-10-23）已迁移到 OCCT 8.0.1([replicad PR #263](https://github.com/sgenoud/replicad/pull/263))，API 覆盖草图、拉伸、旋转、放样、扫掠、圆角、倒角、抽壳、拔模、布尔和螺旋，但没有阵列 API，也不暴露 OCCT 的建模历史；occt-wasm 自带 `filletWithHistory` 等面演化接口，圆角失败时还会返回出问题的边([occt-wasm](https://github.com/andymai/occt-wasm))，但由单人高速迭代，有维护风险。chili3d 的应用本体是 AGPL([chili3d](https://github.com/xiangechen/chili3d))，Zoo 的几何引擎闭源、按秒计费([Zoo Design API](https://zoo.dev/design-api))，truck 没有圆角，Fornjot 已归档，这几家都不适合做主内核。所有基于 OCCT 的方案都会把 LGPL-2.1（附 OCCT 例外）的义务带到前端，wasm 要保持为独立、可替换的文件，并随站提供对应源码和使用声明([OCCT LGPL 例外](https://github.com/Open-Cascade-SAS/OCCT/blob/master/OCCT_LGPL_EXCEPTION.txt))；这是研究判断而非法律意见，只下发离线烘焙 GLB 的方案则完全不触发这项义务。另有两个轻量组件值得单独用。Manifold 是保证输出流形的网格布尔库，可以按来源给结果面着色，但没有真正的圆角、抽壳和拔模([manifold](https://github.com/elalish/manifold))。planegcs 把 FreeCAD 的草图求解器编译成了 wasm，类型定义里暴露了自由度、冗余约束和冲突约束的诊断接口([planegcs](https://github.com/Salusoft89/planegcs))。

| 组件 | 版本 | 原始体积 | brotli 压缩后 | 许可 |
|---|---|---|---|---|
| [replicad 的 OCCT](https://registry.npmjs.org/replicad-opencascadejs/-/replicad-opencascadejs-1.1.0.tgz) | 1.1.0 | 22.98 MB | 4.84 MB | LGPL-2.1 |
| [occt-wasm](https://registry.npmjs.org/occt-wasm/-/occt-wasm-5.15.0.tgz) | 5.15.0 | 21.25 MB | 4.57 MB | 包装层 MIT/Apache，wasm 为 LGPL-2.1 |
| [bitbybit OCCT](https://registry.npmjs.org/@bitbybit-dev/occt/-/occt-1.6.0.tgz) | 1.6.0 | 31.62 MB | 6.39 MB | 混合许可，含 LGPL-2.1 |
| [libcascade 完整绑定](https://registry.npmjs.org/libcascade/-/libcascade-3.1.0.tgz) | 3.1.0 | 42.75 MB | 8.23 MB | LGPL-2.1 + 例外 |
| [manifold-3d](https://registry.npmjs.org/manifold-3d/-/manifold-3d-3.5.4.tgz) | 3.5.4 | 0.54 MB | 0.16 MB | Apache-2.0 |
| [planegcs](https://registry.npmjs.org/@salusoft89/planegcs/-/planegcs-1.3.0.tgz) | 1.3.0 | 0.48 MB | 0.14 MB | LGPL |
| [three.core + three.module](https://registry.npmjs.org/three/-/three-0.187.0.tgz)（未 tree-shake） | r187 | 2.13 MB | 0.31 MB | MIT |

### Spike 实测：建模很便宜，贵的是下载、内存和失败

为了拿到决策需要的真实数字，本次在本机做了一个 replicad spike([spike 代码与基准脚本](../../spikes/replicad-kernel/README.md))。模型是一个参数化马克杯，按"草图 → 旋转 → 底边圆角 → 抽壳 → 扫掠把手 → 合并 → 连接处圆角"7 个特征建模。内核跑在 Web Worker 里，主线程用 three.js 渲染；时间线可以拖动，每一步的面按"新建 / 修改 / 未变"三色显示，7 个滑块实时改参。测试环境是 MacBook Pro M1 Pro 上的 Chrome 156，另测了 Safari 的 JavaScriptCore 引擎和 Node 22。测量时本机还有其他负载，同一项多次测量有 10–30% 的波动([spike 记录](notes/kernel_spike.md))。

| 指标 | 实测结果 |
|---|---|
| wasm 体积 | 原始 21.9 MiB → brotli **4.6 MiB** |
| 下载（Chrome 网络模拟） | Fast 4G **5.0 s**；Slow 4G **27.5 s** |
| 编译 + 实例化 | 中位 189 ms（Safari 引擎 143–221 ms） |
| 冷启动后首次 7 步重建 | 686–780 ms（同进程再次打开约 430 ms） |
| 改参后 7 步全量重建（拆解页需要） | **429 ms** = 建模 74 + 网格 270 + 判新面 86；Safari 引擎 433 ms |
| 只出最终模型（拖滑块需要） | **151 ms**；多线程版 87 ms |
| 最贵的两个特征 | 合并 45 ms、连接处圆角 21 ms，占建模时间约 90% |
| 网格精度 | replicad 默认 0.001 mm：33 万三角形、4.2 s；0.05 mm：1.6 万、101 ms；0.2 mm：3,280、18 ms |
| wasm 内存 | 连接处圆角反复执行后停在 **1,073 MB**，不再回落 |
| 随机 40 组参数 | **12 组失败（30%）**，其中 11 组是"底边圆角 ≤ 壁厚"导致抽壳失败 |
| 新面判定可靠性 | OCCT 历史法与几何签名法在 1,694 个面上仅 1 处分歧 |
| planegcs 草图求解 | 137 KB brotli；给矩形逐步加约束，自由度 8 → 4 → 2 → 0；能报冗余与冲突；求解 0.05 ms |

这些数字改变了问题的性质。建模运算本身很便宜，约 70 ms；真正的耗时在三角化，而且同一个形状再网格化一次照样要 93 ms，没有缓存。replicad 默认 0.001 mm 的网格精度对网页完全不可用，必须显式传容差，拖动时用 0.2 mm、松手后再出 0.05 mm。桌面端"拖滑块看结果"已经流畅，瓶颈变成了三件事。首次加载上，4.6 MiB 在 Slow 4G 下要半分钟；本机经代理从 npmjs 安装 wasm 包极慢、换 npmmirror 后 10 秒装完，说明面向国内用户的 wasm 应自托管在国内 CDN，不能依赖 jsDelivr 或 unpkg。内存上，1 GB 的高水位在桌面无碍，但手机会不会因此被系统杀掉页面，还没在真机上测过。失败形态上，OCCT 的报错几乎只有一句 "StdFail_NotDone: BRep_API: command not done"，不说原因；还有不报错、BRepCheck 也判有效、几何却是错的"静默错误"——没倒圆角的杯身抽壳 45 mm 时，返回的体积几乎等于实心体，把手管半径大于弯角半径时，管子已经自相交却照样"成功"。

spike 还摸到几个只有亲手建过才知道、又会直接影响课程内容的细节。合并这一步不产生新面，只有被修改和被删除的面，时间线上应高亮"被修改 / 被删除"而不是"新建"；抽壳后的杯口面在 OCCT 看来是"顶面被修改"，课程如果想讲成"新出现的面"，需要人工标注；旋转体的接缝落在把手一侧时连接处圆角会随机失败，把轮廓画到另一侧、让接缝挪到杯背后就恢复正常；replicad 的 `draft()` 对圆柱面会失败（内部把一个参数写死成了 false），直接调用 OCCT 则能成功。多线程版能把网格化提速 1.7–3 倍，但需要 COOP/COEP 跨源隔离，会拦截没有 CORP 头的第三方资源，例如 B站或优酷的嵌入播放器。

### 架构：默认预烘焙，桌面端按需加载内核

| 方案 | 首次交互前的下载 | 能做什么 | 主要代价 |
|---|---|---|---|
| A 浏览器内真内核 | three 约 0.3 MB + OCCT wasm 4.6 MiB | 任意改参、自由建模 | Slow 4G 半分钟；1 GB 内存；30% 参数组合失败与静默错误；前端 LGPL 合规；面的历史要自建 |
| B 离线预烘焙每步 GLB + 面标签 | three 约 0.3 MB + 每步几十到上百 KB | 逐特征回放、按特征高亮、爆炸、剖切、测量 | 不能任意改参；需要一条烘焙管线 |
| C 混合（推荐） | 默认同 B；桌面端按需加载 A | B 的全部 + 少量课节的改参沙盒 | 两条数据路径要统一成同一格式 |

推荐方案 C，并落实四个决定。**第一，拆解页和操作模拟默认走预烘焙**：离线跑同一份模型代码，每个特征导出一份 GLB，附上每个面的"新建 / 修改 / 未变 / 删除"标签（由 OCCT 历史生成），three.js 的 GLTFLoader 原生支持 meshopt 与 Draco 压缩([three r187 安装包](https://registry.npmjs.org/three/-/three-0.187.0.tgz))；spike 中一步约 1.6 万三角形、原始数组约 404 KB，量化压缩后估计 70–100 KB（尚未实测），作为参照，text-to-cad 仓库里 build123d 管线导出的 GLB 为 43–163 KB([text-to-cad](https://github.com/earthtojake/text-to-cad))，两者都远小于内核本身。**第二，改参沙盒只在桌面端按需加载**：用户点"试试改参数"或桌面端空闲时才加载内核，拖动时只处理最新一次参数并用粗网格，只重算被改特征之后的步骤，wasm 内存超过约 700 MB 就重启 Worker（代价约 0.5–1 秒）。**第三，模型只写一份**：replicad 在 Node 里照样能跑，离线烘焙和在线沙盒可以共用同一份 JS 模型代码；build123d 的 `Select.LAST/NEW` 能直接从内核历史拿到"本特征新生成的面"([build123d 拓扑选择](https://build123d.readthedocs.io/en/stable/topology_selection.html))，它的示例库也适合作为特征序列的参照，但如果用它烘焙，需要实时改参的模型就要写两份。**第四，每个课程模型都在 CI 里离线扫描参数可行域**：把参数耦合写进滑块范围（例如底边圆角 > 壁厚 + 0.5），用体积和包围盒检查拦住静默错误，并把扫出的失败区域改写成"为什么失败"的讲解，而不是把 OCCT 原文丢给学习者。草图课用 planegcs，布尔直觉课用 Manifold，两者合计不到 0.3 MB。

框架上，内容密集、需要 SEO 的正式站适合 Astro 7 + MDX + React islands([Astro 7](https://astro.build/blog/astro-7/))，沙盒类工作台用 Vite SPA；Astro 的每个 island 是独立的 React 根节点，与"单画布多视口"冲突，需要一个页面级的"舞台" island 来承载所有视口，这一做法尚未验证。步骤逻辑用 XState 状态机建模，并把"内核失败时回退到预烘焙快照"做成一个显式状态([XState](https://www.npmjs.com/package/xstate))；相机与爆炸时间线用 GSAP，它自 2025-04-30 起全部插件免费商用，但不得用于与 Webflow 竞争的可视化动画构建工具([GSAP 许可](https://gsap.com/standard-license))；已停滞、且 studio 部分为 AGPL 的 Theatre.js 不要用([Theatre.js](https://github.com/theatre-js/theatre))。立项前还要补四项验证：iPhone 与中端安卓真机上的内存和耗时；连接处圆角导致内存增长的根因；量化压缩后 GLB 的真实体积；以及"服务端内核"方案，它让客户端零下载，代价是服务器成本和网络往返。

## 原型落点：两个播放器、一个改参沙盒、一套术语卡

把以上证据落到 HTML 原型上，页面应围绕四类对象组织：开场、操作模拟课、模型拆解、练习与术语。首屏不先放视频，而是给一个能拖动的 3D 操作，例如拖滑块让草图轮廓旋转成杯身。Shapr3D 的 A/B 结果说明，头几分钟真正动手对留存有效；Bartosz 的 Moon 一文也用一个可拖动的沙盒开篇([daily.dev](https://daily.dev/posts/moon-bartosz-ciechanowski-fuppibs82))。全站和模块的进度条，要保证前段推进得快。各页面的必备交互如下。

| 页面 | 必备交互与 UI | 依据 |
|---|---|---|
| 操作模拟课（拉伸、旋转、扫掠、放样、圆角、倒角、抽壳、拔模、布尔、阵列、镜像各一课） | 0–100% 前后混合滑块作主控件；每步自动切到关键视角，带约 ±10° 晃动，允许自由旋转但常驻"回到推荐视角"；只开放 1–2 个参数滑块，派生尺寸显示为锁链；说明以 3D 注释贴在几何旁、与动作同步；播放时屏幕只留标签级文字；平光、中性材质 | Onshape 预览滑块；Keehner、Garg；PhET；Mayer 的邻近与去装饰原则；Berney & Bétrancourt |
| 草图课 | planegcs 实时显示自由度计数；几何按 CAD 惯例显示蓝（欠定义）/ 黑（完全定义），冲突约束标红；设计"拖一下欠定义的线，看它怎么动"的任务 | spike 的 planegcs 实测；[Fusion 帮助：完全约束后几何由蓝变黑](https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-FULLY-DEFINE-CONSTRAIN-SKETCH.htm)；[知乎：草图绘制规则](https://zhuanlan.zhihu.com/p/1917629738903634735) |
| 模型拆解 | 开场概览卡（步数、特征、所教概念、预计时长）；特征列表 ↔ 3D 面双向高亮；回滚条 + 播放 + 键盘单步；本步新建 / 修改 / 删除三色；后续几何半透明预示；"终态"开关（改上游参数看下游）；两棵特征树并排对照；展示用径向爆炸与工程用逆装配序爆炸分开，爆炸步骤联动 BOM 高亮 | Onshape 回滚条、Final、BOM；Fusion Play；BILT、LEGO；spike 面分类；中文爆炸图原则 |
| 练习 | 题型：识别、预测-揭示、特征树排序（系统真按学习者的顺序重建，并指出在哪一步失败）、改参测试、找错（模块后半段才开放）、空间题（截面、三视图、旋转，可在网格上点画截面）；判分用体积 + 包围盒 + 几何比对 | Yang 2021；Parsons 类比；Otey 2018；Große & Renkl 2007；Cohen & Hegarty 2014；TTT 的 Ivan Exploit |
| 术语卡与图鉴 | 中性主标签 + 一句话定义 + 各软件官方名与菜单路径 + 代码 API 名；按软件 × 版本存储；NX 标"据教程" | 本报告的术语核对结果 |
| 进度与复习 | 用技能掌握地图代替单一百分比；检查点 80–90%，未达标推送复习但不锁路；约 1 天 / 1 周 / 3 周复习并混入易混特征；徽章只作信息反馈，不设公开排行榜 | Kulik 1990；Cepeda 2008；Brunmair & Richter 2019；Hanus & Fox 2015 |

全站要先定一套颜色语法并贯穿所有页面：本步新建的面用强调色、本步修改的面用第二色、未变的面用中性灰，出错与干涉用红色、当前选中用黄色（与 Onshape 一致），草图状态单独遵循 CAD 惯例（蓝色表示欠定义、黑色表示完全定义），说明文字里的术语、3D 中对应的面和特征列表里的条目则用同一种颜色联动高亮。每张交互图都配一张静态关键帧和一段文字描述，开启"减少动态效果"时直接跳到结果，这既回应了 Bartosz 被批评的可访问性问题，也给低端设备留了降级路径。

第一个可验证的纵切片应该小而完整：T0 三节（坐标与视图、基准面、正投影与第一角），一节草图约束（planegcs），五节操作模拟（拉伸、旋转、扫掠、圆角、抽壳），两个拆解（马克杯 7 步，spike 已跑通带 OCCT 历史的面标签；电子外壳，覆盖圆角顺序、拔模、筋、凸柱、卡扣、分模、BOM 与爆炸），一个 DFM 交互（拔模角分析着色）和一个 ID 交互（把 G1 圆角矩形改成 G2、实时看曲率梳），再加约 20 条术语卡。原型阶段不必接内核：拆解与操作模拟用预烘焙快照或 three.js 程序化几何就能验证交互，改参沙盒只在马克杯这一节接入 spike 现成的 Worker，用来验证"改参 + 失败讲解"的体验；自由建模编辑器、AI 导师、排行榜，以及 T2 机构和 T3 公差的完整内容，暂时都不做。

## 结论

这次调研最重要的认识转变是：**失败空间本身就是课程**。官方课程把修复当作入门能力，学习者的卡点几乎都是重建失败，而 spike 显示即便一个马克杯也有 30% 的参数组合会失败、其中一部分还是静默失败——所以同一次离线参数扫描能起两个作用，既保护改参沙盒不崩，又批量产出"为什么抽壳失败""为什么合并不产生新面"这类最有信息量的讲解和预测题。第二个转变来自 AI：厂商助手回答"怎么点"，text-to-CAD 直接产出特征树，稀缺能力正从"会点命令"转向"读懂、检查、修改一棵特征树并判断它稳不稳"，拆解加改参测试恰好训练这种读模型的能力，站点可以专门设计一个"检查 AI 生成模型"的单元。

真正的护城河是生产系统，而不是某一页做得多漂亮。HN 上有人指出，AI 让交互页做起来更便宜了，但知道该把什么可视化仍然稀缺([HN](https://news.ycombinator.com/item?id=49427375))；Distill 的停刊和 Bartosz 的产出节奏也说明，靠手写交互支撑的内容站难以持续。值得投入的是一套声明式的课程格式——每步一个特征，带参数可行域、关键视角、注释、预测题和面标签——再用同一份模型代码同时驱动离线烘焙和在线沙盒。仍未解决的问题要在立项时正面列出：手机真机上的 1 GB 内存风险、NX 的官方中文译名、学习科学结论在 CAD 场景里的直接效应，以及这套课程体系在中文学习者身上的实际效果，这些都要等原型上线后用完成率和改参测试数据来校准。
