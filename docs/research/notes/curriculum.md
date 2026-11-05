# 工业建模（Industrial Modeling）的知识体系与学习进阶：官方课程、先修概念、DFM、工业设计曲面、学习卡点与中文生态

> 检索日期 2026-11-04。凡来源较旧或只拿到检索摘要（没打开原页）的，条目内都有注明。范围：机械参数化 CAD（SOLIDWORKS / Fusion / Onshape / Creo / NX）、工业设计曲面（Rhino / Alias / Plasticity）、DFM。学习科学、术语表、竞品 UI 和技术栈由其他调研员负责，本文不涉及。

---

## 1. 官方结构化课程如何组织内容？

### Takeaway
机械参数化 CAD 的官方课程和认证，主干几乎一致：导航/基准 → 草图（约束 + 尺寸）→ 零件特征 → 装配 → 工程图。到中级再加"编辑修复 → 方程/配置 → 自顶向下/骨架 → 曲面"。认证普遍用"按图建模 + 核对质量/质心"判分。工业设计软件（Rhino / Alias）的主干是"曲线 → 曲面 → 连续性与分析 → 面片结构 → Class-A"。Rhino Level 1 先教工具与几何类型，连续性要到 Level 2 才系统讲。

### Cited Findings

#### Onshape（PTC）
- Learning Center 的课程免费、自定进度，由短视频加练习组成。Learning Pathways 把若干课程排成一条序列，每条 3–5 步，学完发 Certificate of Completion。新用户推荐 CAD Basics、Onshape Fundamentals、Bootcamp（12 小时直播课）或 Intro to CAD。—— [Onshape Student Resources](https://www.onshape.com/en/education/student-resources)；[Onshape blog: Learning Center](https://www.onshape.com/en/blog/learn-cad-onshape-learning-center)（onshape.com 无法直接抓取，内容来自检索摘要）
- 当前能看到的 Learning Pathways 有：CAD Basics、Onshape Fundamentals、Introduction to Onshape Simulation、FeatureScript Fundamentals、Advanced Part and Surfacing Design、Onshape Configurations、Certified Onshape Associate Exam、Practice Exam & Guide。—— [Onshape Learning Center catalog](https://learn.onshape.com/catalog?labels=%5B%22Learning+Pathways%22%5D&values=%5B%22All%22%5D)（页面是 JS 渲染，抓不到正文；名称来自检索摘要）
- Onshape Configurations 路径的必修课是 Advanced Part Configurations 和 Assembly Configurations，要求先会基础零件与装配建模。—— [Onshape Configurations learning path](https://learn.onshape.com/learn/learning-path/onshape-configurations)
- 第三方（约 2023 年）记录的课序：
  - CAD Basics：Introduction to Parametric Feature-Based CAD → Introduction to Part Design → Introduction to Assembly Design → Introduction to 2D Drawings
  - Onshape Fundamentals：Navigating Onshape → Sketching → Part Design Using Part Studios → Multi-Part Part Studios → Onshape Assemblies → Detailed Drawings
  
  —— [BroncBotz FRC docs](https://docs.broncbotz.org/cad-design-and-mechanical/cad-in-onshape/getting-started-with-onshape)
- 2020 年一位高中教师按 Learning Center 自学教程排的授课顺序：Intro to Parametric Feature-based CAD → Intro to Sketching → Intro to Part Design → Part Design Studios → Multi-part Studios → Intro to Assembly Design → Onshape Assemblies → Intro to 2D Drawings → Detail Drawings。—— [Onshape Forum (2020)](https://forum.onshape.com/discussion/13244/high-school-teacher-looking-for-guidance)
- Certified Onshape Associate（COA）：
  - 3 小时，考 part modeling、multi-part modeling、基础装配、drawing knowledge、sharing & collaboration。数据管理、高级建模和高级装配运动不考，留给 Certified Onshape Professional。
  - 题型是按工程图建模/改模型，加 CAD 概念题；装配题要求测量零件间距离。
  - 建议有 35–50 小时 Onshape 经验。
  
  —— [Onshape blog: COA](https://www.onshape.com/en/blog/onshape-certified-associate-cad-exam)；[SolidProfessor 教师指南（约 2021）](https://solidprofessor.com/blog/what-teachers-need-to-know-about-the-new-certified-onshape-associate-exam/)

#### Autodesk Fusion
- Autodesk Learn 的"Self-paced learning for Fusion"分三段：
  - Fusion fundamentals：UI 导航、偏好设置、导入、草图、3D 模型、configurations 等
  - manufacturing：铣、车、刀路、多轴、检测
  - 增材、generative design、仿真与 extensions
  
  可见的课程名有 Introduction to Fusion、Get started with modeling、Sketch basics、Part modeling with Fusion、Mesh modeling with Fusion、Fusion sketch fundamentals。—— [Autodesk Learn: Self-paced learning for Fusion](https://www.autodesk.com/learn/ondemand/collection/self-paced-learning-for-fusion)
- **ACU（Autodesk Certified User）Fusion 360 官方考纲（Certiport ©2022）**：目标人群约有 150 小时上手经验，并能读懂技术图纸、有基本制图标准概念。五个域按顺序如下。
  - **1 Workspace & Navigation**：Data panel 与云端版本；Orbit / Zoom / Pan / Look At / ViewCube；Browser；Timeline（访问和编辑过去的特征、前后回滚）；网格、单位、捕捉；选择过滤器；在原点平面或平面上建草图；建构造平面、轴、点，并要求理解为什么用工作平面很重要。
  - **2 Sketch**：选草图工具；投影已有实体几何；Move / Trim / Offset / Mirror / Fillet / 阵列；决定施加哪些约束，理解 auto-constraints；把草图做到完全约束；用设计参数做参数化模型。
  - **3 Model**：基本体；Extrude / Revolve / Sweep / Loft 及 Join / Cut / Intersect / New Body / New Component；孔（沉头、锪孔、螺纹）；阵列；Fillet / Chamfer / Shell / Draft / Split / Combine / Press Pull；Measure、Center of Mass、Section Analysis；Canvas、Decal；Form 的创建与编辑。
  - **4 Assemble**：激活组件；从实体建组件；Rigid / Revolute / Slider 关节；理解自由度与接地（grounding）；驱动关节；干涉检查。
  - **5 Document**：图纸幅面与标题栏；基础、剖、局部、断裂、投影视图；尺寸；注释；零件明细表。
  
  —— [ACU Fusion 360 Exam Objectives PDF（Certiport 2022，第三方托管）](https://www.arit.co.th/assets/objective/acu/ACU_OD_Fusion360_0922.pdf)
- 第三方描述 ACU 考试约 50 分钟，由 Certiport 监考，题型是选择、拖放和热区题。—— [open-exam-prep](https://open-exam-prep.com/practice/autodesk-acu-fusion)
- **ACA（Associate）CAD for Mechanical Design**：官网写约需 150 小时经验。主题：理解参数化 CAD 工作流、界面、带机械运动的参数化设计、基础 form 实体、直接建模工具、详细工程图。官方另有免费备考课。—— [Autodesk certification page](https://www.autodesk.com/certification/all-certifications/cad-mechanical-design-associate)（检索摘要）；[Autodesk Learn 备考课](https://www.autodesk.com/learn/ondemand/course/fusion360-cad-mechanical-design-cert-prep)
- 2020 年 5 月版 ACA 考试指南（Fusion 360 时期）：
  - 90 分钟，全部是选择类题，不用打开软件。指南称最适合在学术项目或制造业环境里积累了 1–2 年 CAD 技能的人。
  - 技能清单：Browser 与 Timeline；Extrude / Hole / Shell / Revolve；尺寸与约束；构造面与轴；截面分析与测量；圆角、倒角、阵列；用 Press/Pull 和删除做直接编辑；装配、从实体建组件、joints、rigid groups、干涉；运动研究；带标题栏的工程图；sweep / loft / combine / split；form 的创建、编辑与加厚。
  
  —— [Autodesk Exam Guide PDF (2020-05)](https://damassets.autodesk.net/content/dam/autodesk/www/training-and-certification/docs/exam-guide-autodesk-certification-CAD-fusion-360.pdf)
- 2024 年 1 月，Fusion 360 更名为 Autodesk Fusion，去掉了"360"。—— [Wikipedia: Autodesk Fusion](https://en.wikipedia.org/wiki/Autodesk_Fusion)（检索摘要）

#### SOLIDWORKS（Dassault）
- **内置教程**的 Getting Started 依次是 Introduction → Lesson 1 Parts → Lesson 2 Assemblies → Lesson 3 Drawings。Lesson 3 的步骤：从模板打开图纸 → 编辑并保存图纸格式 → 设置 Detailing 选项 → 由零件生成视图 → 移动视图 → 加尺寸。该教程用**第三角投影**。—— [SOLIDWORKS Design Help 2027（3DEXPERIENCE 版）](https://help.solidworks.com/2027/english/swtutorialonline/t_tut_lesson3_createdrawing.htm)
- 官方 SAE 项目文档把这三课列为先修，替代路线是 CAD Student Guide 的：Using the Interface → Basic Functionality → The 40-Minute Running Start → Assembly Basics → Drawing Basics。—— [SOLIDWORKS SAE Design and Analysis Project (2013)](https://www.solidworks.com/sw/docs/edu_sae_instructor_2013_eng.pdf)
- **官方授权培训 SOLIDWORKS Essentials**（4–5 天，TPM 标价 $2,000）共 14 课：
  1. Basics & UI
  2. Introduction to Sketching
  3. Basic Part Modeling
  4. Symmetry and Draft：首次讲 Design Intent，含带拔模的凸台、草图对称、在模型内画草图、使用模型边
  5. Patterns
  6. Revolved Features
  7. Shelling and Ribs：拔模分析、抽壳、筋、全圆角、薄壁特征，培训商描述为"聚焦制造相关特征"
  8. Editing: Repairs：草图问题、冻结特征、FilletXpert，用回滚诊断并修复，介绍 FeatureXpert
  9. Editing: Design Changes
  10. Configurations
  11. Global Variables and Equations
  12. Using Drawings
  13. Bottom-Up Assembly Modeling
  14. Using Assemblies
  
  旧版只有 13 课，没有第 11 课。—— [Solid Solutions agenda](https://www.solidsolutions.co.uk/solidworks-training/courses/3d-cad/essentials-agenda.aspx)；[TPM](https://www.tpm.com/services/training/solidworks-course-index-2/)；[FEA-TC（4 天）](https://www.fea-tc.com/training/solidworks-3d-cad-training/solidworks-essentials-training.html)
- **CSWA**（现名 SOLIDWORKS Design Associate）官方考点：
  - 草图实体：线、矩形、圆、弧、椭圆、中心线
  - 草图工具：offset、convert、trim；草图几何关系
  - boss/cut：extrude、revolve、sweep、loft
  - 圆角、倒角；线性、圆周、填充阵列
  - 尺寸；特征起止条件
  - 质量属性、材料、插入零部件
  
  —— [solidworks.com CSWA](https://www.solidworks.com/certifications/cswa-design-associate)（抓取超时，来自检索摘要）
- CSWA 格式：3 小时、14 题、共 240 分，165 分（约 69%）及格。领域：drafting competencies、基础/中级/高级零件创建与修改、装配创建与修改。—— [Solid Solutions CSWA 样卷（2025-12；访问返回 403，数据来自检索摘要）](https://www.solidsolutions.co.uk/wp-content/uploads/2025/12/SOLIDWORKS-Associate-CSWA-Sample-Exam.pdf)；[examcert.app](https://www.examcert.app/blog/cswa-practice-questions-2026/)
- CSWA 零件题看"总质量"或"相对零件原点的质心位置"判分，考生须自己设单位/精度、施加材料、识别 base sketch。装配题可能要求新建坐标系，或用测量工具量零件间距离/角度。—— [SOLIDWORKS blog: Lesson 6 CSWA](https://blogs.solidworks.com/products/solidworks/lesson-6-solidworks-academic-certification-cswa-exam-part-1/)
- **CSWP** 分三段，独立计分、可任意顺序：
  - Segment 1（70 分钟）：按图建零件、linked dimensions 与 equations、更新参数、质量属性，在不同阶段改尺寸并保持设计意图
  - Segment 2（50 分钟）：由已有配置派生配置、用 Design Table 建配置、修改/重排现有零件特征
  - Segment 3（80 分钟）：建装配、加零件、碰撞检测、干涉检测
  
  2016 年旧版的时长和分值不同。—— [SOLIDWORKS CSWP 官方样卷 PDF](https://www.solidworks.com/sites/default/files/cswpsampleexam.pdf)；[Engineering.com](https://www.engineering.com/the-guide-to-passing-the-solidworks-cswp/)
- **曲面认证**：没有找到叫"CSWA-Surfacing"的助理级考试。现行的是专业级 SOLIDWORKS Surfacing Professional（CSWP-SU，前称 CSWPA-SU）。
  - 考点：Spline、3D Curve、Boundary Surface、Loft/Blend、Filled、Swept、Planar、Knit、Trim/Untrim、Move Face、Extend、Fillet、Thicken、Offset、Ruled、Guide Curves、Split Solid Body。该页面约 5 年前。—— [solidworks.com CSWP-SU](https://www.solidworks.com/certifications/advanced-surfacing-cswpa-su)
  - GoEngineer 称它超出核心 Surfacing 课程，涉及逆向复杂曲面，以及连续性与光顺分析。—— [GoEngineer](https://www.goengineer.com/solidworks-certification/cswpa-surfacing)

#### PTC Creo / Siemens NX
- PTC University 2026 年课程目录：
  - 入门拆成 Fundamentals of Solid Modeling 1、2 → Fundamentals of Assembly → Fundamentals of 2D Drawing → Fundamentals of Analysis。
  - 自顶向下单独成课："Using Assembly Skeletons for Top-Down Design"，3 小时，先修 Solid Modeling 2 和 Assembly，基于 Creo 12.4。目标：top-down 流程、Creo Notebook 的参数与关系、skeleton model、copy/publish geometry。另有一门练习课，把自底向上装配改成自顶向下。
  
  —— [PTC University Creo curriculum (2026)](https://training-materials.ptcu.com/catalog/ptc-university-creo-curriculum-en.pdf)；[CRAS-ASTD abstract](https://training-materials.ptcu.com/abstract/creo/en/CRAS-ASTD-Abstract.pdf)
- PTC 对 top-down 的定义：先完成高层整体设计，不同时设计各个零件。—— [PTC: Get Started with Creo Parametric](https://www.ptc.com/en/success-paths/get-started-creo-parametric)
- 旧版 Creo Parametric 7.0 "Introduction to Solid Modeling" 是 5 天课程。—— [Rand 3D outline](https://resources.rand3d.com/course-outlines-creo/creo-parametric-7-0-introduction-to-solid-modeling)
- NX 没有拿到 Siemens 官方大纲。国内 MOOC《数字化设计基础》分五个模块：NX 基本操作 → 二维草图 → 实体建模 → 装配设计 → 工程制图，并与 Siemens NX CAD 工程师认证、1+X 证书对接。—— [无锡职业技术大学 MOOC](https://www.icourse163.org/course/WXIT-1207055808?tid=1488261531)

#### Rhino（McNeel）
- **Level 1 认证 Study Guide**（链接的是 Rhino 6 文档，页面 2025-06 修改）主题顺序：
  1. UI
  2. 视口与命令行
  3. 曲线：线、多段线、圆、弧、椭圆、多边形、自由曲线
  4. 选择
  5. 坐标输入：绝对、相对、极坐标
  6. 绘图辅助：Ortho、Grid、Snap、Planar；history 的利弊
  7. 视口与构造平面
  8. 物件锁点
  9. 分析：Length、Radius、Angle、Distance、ShowEdges、Check
  10. 存储与导入导出：NURBS 与 Mesh 格式之别
  11. 图层与群组
  12. 编辑：Fillet、Blend、Chamfer、Trim、Split、Offset、Array…
  13. **点编辑**：控制点、编辑点、degree、knots、kinks 及其对曲线的影响，Rebuild
  14. 曲面编辑：BlendSrf、OffsetSrf、Trim/Untrim、ShrinkTrimmedSrf
  15. 实体与布尔：含排查 Boolean 失败
  16. 建曲面：EdgeSrf、PlanarSrf、Patch、Revolve、Loft、Sweep1/2、FilletSrf、BlendSrf…
  17. 渲染
  18. 标注与 Make2D
  19. 打印与 Layout
  
  —— [McNeel Wiki: Level 1 study guide](https://wiki.mcneel.com/rhino/level1_study_guide)
- **Level 2**（Rhino 5 手册，2013）：NURBS 拓扑 → 曲线创建（曲线阶数、曲线与曲面连续性、curvature graph）→ 曲面连续性（分析、匹配、"会顾及连续性的建面命令"）→ 更多建面技巧。—— [Rhino 5 Level 2 manual (2013)](http://www.andreasmoos.de/downloads/Rhino_Level_2.pdf)
- Rhino 4 版（2009）的练习顺序：Curve Degree → Geometric Continuity → Tangent Continuity → Curvature Continuity → Surface Continuity。—— [Rhino 4 Level 2 manual (2009)](https://bekydesigns.wordpress.com/wp-content/uploads/2013/07/rhino-level-2-v4.pdf)
- McNeel Level 2 课程大纲：为建面而构建/编辑曲线（控制点编辑）→ 用 curvature graph 评估曲线 → 建面策略 → 重建曲面与曲线 → 控制曲面曲率连续。—— [McNeel Level 2 outline](http://files.mcneel.com/rhino/5.0/training/en-us/level2-training-outline.pdf)
- 第三方 Rhino 8 Level 1 课（15 小时）：Intro → NURBS 线与点 → NURBS 曲面 → Meshes → 模型组织。—— [Global eTraining](https://www.globaletraining.ca/course-library/rhino-8-level-1/)

#### Autodesk Alias / Class-A
- **Alias 2024 Help "Understanding Class A Modeling"**：
  - Class-A 的基线与所有行业的生产级曲面相同：在严格公差下做到 G0/G1/G2。美学上追求近乎完美的高光，常用跨面 G3。
  - 关键是两点：面片内部用 Bezier 曲面保证光顺，面片之间做到 G2/G3。
  - 配套工具：直接编辑 CV 时交互检查连续性、Blend Curves、Surface Continuity、Curve Curvature locator、Cross-Section Editor、Iso-Angle / Light Tunnel 诊断着色。
  - 文档称公差与连续级别没有绝对规则。
  
  —— [Alias 2024 Help](https://help.autodesk.com/view/ALIAS/2024/ENU/?guid=GUID-64611955-D2CC-44F2-98F0-D4F1FE931D8B)
- 第三方 Alias 初学课（Learn Surfacing）的顺序：2D 曲线 → 修改曲线 → 曲线特性与曲线质量 → NURBS / B-Spline / Bezier → 圆锥曲线、圆、弧 → 曲线匹配、trim/extend、offset、blend curves、对称 → 曲面质量 → 建/改曲面 → 曲率分析、整理 CV → 曲面结构、构建设置、修剪、block 面与 secondary 面。—— [Learn Surfacing (Thinkific)](https://learnsurfacing.thinkific.com/courses/Alias-Surfacing)
- Design Engine "Alias Auto: Class-A"：40 小时，要求至少 Alias Level 3。内容含 Class-A 定义、NURBS 与 Bezier 对比、用 Align 做次级面、Gauss/Zebra 分析、用图示和微积分讲 G0–G4、曲线曲面升阶。页面已有数年。—— [Design Engine Class-A](https://design-engine.com/alias-auto-class-a-automotive-surfacing/)
- Design Engine 的入门课讲 rounds & blends、强制相切、blend curve 与普通曲线的区别，以及"向工程师解释曲率连续"。—— [Design Engine Intro to Alias](https://design-engine.com/intro-to-alias/)
- Skill-Lync 汽车 Class-A 课：第 1 周曲线基础 → 对称曲线、曲线圆角、截面、偏移、面上曲线 → 曲面分片（patching）→ 技术曲面 → 第 10 周 Class-B，作为通往 Class-A 的台阶。—— [Skill-Lync](https://skill-lync.com/mechanical-engineering-courses/automotive-class-a-surfacing-using-alias)

#### Plasticity / Shapr3D（新一代直接建模）
- Plasticity 官方手册分 Plasticity Essentials、User Interface 和按类别列的命令（Sketch、Solid、All Commands）。每个命令页格式统一：快捷键、按钮位置、所属版本、Description、Basic Usage。
  - Fillet（快捷键 B）统一了 Fillet Curve / Vertex / Shell。
  - Fillet Shell 可选 conic、G2 continuous、constant width 三种剖面。
  
  —— [Plasticity Manual: Fillet Shell](https://doc.plasticity.xyz/solid/fillet-shell)；[Solid Commands](https://doc.plasticity.xyz/all-commands/solid-commands)
- 社区系列"Plasticity from Scratch"（v1.1，2024-11，基于 Plasticity 2024.2.4）的第 03 部分先讲连续性和共面（planarity），再讲 Bridge、Trim、Fillet 等 2D 工具。—— [Scott Benson, Behance](https://www.behance.net/gallery/211185481/Plasticity-from-Scratch-03-2D-Intermediate-Concepts)
- Shapr3D 官方：
  - 入门课"Introducing Shapr3D Basics"由 Claas Kuhnen 讲授，把 Extrude、Revolve、Loft 作为三个基本工具。
  - "Modeling essentials / Solid modeling"讲直接建模与设计历史的结合、草图、基础与高级工具，以及 DFM best practices。
  - 另有"Direct vs Parametric Modeling"视频。
  
  —— [Shapr3D Help Center: Video tutorials](https://support.shapr3d.com/hc/en-us/articles/12208897524380-Video-tutorials)
- 官方 Udemy 课"Sketching fundamentals"建议先学完 Shapr3D Fundamentals。—— [Udemy](https://www.udemy.com/course/shapr3d-sketching-fundamentals/)

#### FreeCAD
- FreeCAD 1.0（GitHub 发布于 2024-11-18）是第一个带新拓扑命名算法的稳定版。算法有时能自动修复；修不了时给出可能的修法；再不行至少清楚指出原因。PartDesign 中仍建议遵循 feature editing 最佳实践，例如把 datum plane 附着到 Body origin。—— [FreeCAD wiki: Topological naming problem](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Topological_naming_problem.md)；[FreeCAD-Bundle 1.0.0 release](https://github.com/FreeCAD/FreeCAD-Bundle/releases/tag/1.0.0)
- 第三方 PartDesign 入门指南的顺序：Body 容器 → Sketcher → Pad/Pocket → 导出 STEP/DXF/STL。注意该文写的 1.0 发布日期有误。—— [CADShift](https://cadshift.com/blog/freecad-beginner-guide-partdesign-export/)

### Inferences
- 机械 CAD 的"公共主干"高度一致。分歧主要有两处：
  - 工程图和装配谁先：SW Essentials 把 Using Drawings 放在装配前；内置教程、Onshape、Fusion ACU 都是装配在前。
  - 配置/方程放初级还是中级：SW Essentials 放在第 10–11 课；CSWP 当作专业级；Onshape 单开一条路径。
- 官方体系把"编辑与修复"单独成课（SW Essentials L8–L9），把 Timeline 回滚写进入门考纲（ACU 1.2.e）。这说明"模型可修改、出错能修"是入门能力，不是高级技巧。概念优先的网站应在第一个模块就引入。
- 认证普遍用"按图建模 → 读质量/质心/距离"做客观判分（CSWA、CSWP、COA 测量）。这套机制可以直接移植成网站的自动判题：学习者在任意软件里建模，回填体积、质心或包围盒即可判对错。
- 自顶向下/骨架在 PTC 体系里是有先修要求的中级课。Onshape 则在入门阶段就用 multi-part Part Studio 引入"在同一上下文里设计多个零件"的思路，可作为降低门槛的教学模式。
- ID 软件课程（Rhino L1 → L2、Alias）的顺序与机械 CAD 根本不同：先学几何类型与曲线编辑，再学连续性与分析，最后学面片结构。Class-A 课程要求先有大约 3 个级别的 Alias 基础（Design Engine 的 40 小时课）。

### Gaps
- learn.onshape.com、onshape.com 无法直接抓取（JS 渲染或域名受限）。课程名来自检索摘要和第三方转录，当前确切课序需要人工到站内核对。
- Fusion ACA 现行的完整子目标，以及 Autodesk Certified Professional（如 Design for Manufacturing）的考纲没拿到（页面连接重置）。
- Rhino 8 官方 Level 1/Level 2 Training Guide 的目录没有找到在线文本。本节引用的是 Rhino 4/5/6 时代材料，Rhino 7 以后加入 SubD，结构可能已有变化。
- 未找到 Autodesk 官方的 Alias 学习路径、Siemens 官方（Xcelerator Academy）NX 课程大纲；FreeCAD wiki 的 PartDesign 教程清单没有逐一核实。
- CSWA 官网抓取超时，Solid Solutions 样卷返回 403。格式数字来自检索摘要，但有两个独立来源一致。

---

## 2. 基础概念的先修关系与引入顺序

### Takeaway
各体系引入概念的顺序相当稳定：坐标系/视图/基准 → 草图约束与自由度 → 特征与终止条件 → 设计意图（对称、参考选择）→ 特征树/父子关系与修复 → 参数/方程 → 配置 → 装配配合与装配自由度 → 工程图与公差。自顶向下/骨架、拓扑命名、GD&T 都在中级。大学工程图学把正投影、剖视、尺寸与公差作为 CAD 的前置。中国国标默认第一角投影，而英文 CAD 教程常用第三角，这是中文学习者特有的先修点。

### Cited Findings
- ACU Fusion 第 1 域就要求掌握 Timeline 回滚，以及理解构造平面为什么重要，都排在草图之前。第 2 域的顺序是：决定施加哪些约束 → 做到完全约束 → 用设计参数做参数化模型，都在建模之前。"自由度与接地"放在装配域。—— [ACU objectives (2022)](https://www.arit.co.th/assets/objective/acu/ACU_OD_Fusion360_0922.pdf)
- SW Essentials 到第 4 课（Symmetry and Draft）才正式命名 Design Intent，此前已学完基础建模；第 8–9 课修复与设计变更；第 10–11 课配置与全局变量/方程；装配在第 13–14 课。—— [Solid Solutions agenda](https://www.solidsolutions.co.uk/solidworks-training/courses/3d-cad/essentials-agenda.aspx)
- CSWP 把 linked dimensions/equations（Seg 1）→ configurations/design tables（Seg 2）→ 装配、碰撞、干涉（Seg 3）定为专业级能力。—— [CSWP sample exam](https://www.solidworks.com/sites/default/files/cswpsampleexam.pdf)
- Onshape 入门第一课是"Introduction to Parametric Feature-Based CAD"，先讲参数化思想，再到 Sketching → Part Studios → Multi-Part Part Studios → Assemblies → Drawings。—— [BroncBotz](https://docs.broncbotz.org/cad-design-and-mechanical/cad-in-onshape/getting-started-with-onshape)
- **拓扑命名问题（TNP）**：做 pad、cut、union、chamfer、fillet 等操作后，形状的内部名称会改变。PartDesign 建模和 TechDraw 标注受影响最明显。—— [FreeCAD wiki](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Topological_naming_problem.md)
- 社区用户认为 FreeCAD 1.0 的方案是缓解而非根治，而且名称会随建模越来越长。—— [Hacker News](https://news.ycombinator.com/item?id=47097446)
- Fusion 中，若草图依附在圆角边上，删除圆角或改尺寸会改变边的拓扑，下游特征就会丢失参考。建议把圆角放在时间线最后。—— [Varsity Tutors: Avoiding Reference Changes](https://www.varsitytutors.com/practice/subjects/autodesk-fusion-360/lessons/avoiding-reference-changes)
- **装配自由度**：每个零件插入时有 6 个自由度，每个配合移除一个或多个。即使没有冲突，用两个距离配合约束同一个自由度也属于过定义。—— [SOLIDWORKS Help: Mates FAQ](https://help.solidworks.com/2022/english/SolidWorks/sldworks/c_faq_mates.htm)；[Engineers Rule](https://www.engineersrule.com/guide-to-successful-mates-in-your-assembly/)（检索摘要综合，未逐页核实各句出处）
- **直接建模与参数化并列**：Fusion ACA 把"使用直接建模工具"列为考点，ACU 列了 Press Pull，Shapr3D 把直接建模和设计历史放在一起教。—— [Autodesk ACA page](https://www.autodesk.com/certification/all-certifications/cad-mechanical-design-associate)；[Shapr3D Help](https://support.shapr3d.com/hc/en-us/articles/12208897524380-Video-tutorials)
- **大学工程图学是 CAD 的前置**：
  - Cañada College 以三角学为先修，先讲空间想象、正投影、辅助视图、剖视、尺寸与公差，再上 SolidWorks 零件、装配、工程图。—— [Cañada College syllabus](https://canadacollege.edu/nsf-iuse/Engineering%20Graphics.pdf)
  - Chabot ENGR 22 讲 aligned、offset、removed、half、partial、broken-out 等剖视，以及 GD&T 的 form、profile、orientation、runout、location。—— [Chabot course outline](https://chabot.curriqunet.com/DynamicReports/AllFieldsReportByEntity/6839?entityType=Course&reportId=347)
  - MSU Texas 2026 秋季 Engineering Graphics 1132 讲正投影、剖视、轴测、几何与尺寸公差、表面粗糙度，并有 SolidWorks 模块。—— [MSU Texas](https://directory.msutexas.edu/courses/7E1A2916-D2F3-46BB-A662-FC71CC01EE3C)
  - Planchard 的教材从第一角/第三角、ASME Y14.5-2009 尺寸规范、配合与公差讲到 SolidWorks 建模，最后一章是 CSWA。—— [Routledge: Engineering Graphics with SOLIDWORKS](https://www.routledge.com/Engineering-Graphics-with-SOLIDWORKS-2017-Including-unique-access-code/Planchard/p/book/9781630570606)
- **中国国标的投影法**：
  - 技术图样优先采用第一角画法；可用第三角，但必须画出识别符号或在标题栏注明。—— [百度经验引用国标](https://jingyan.baidu.com/article/a681b0de651dd97a184346e2.html)；[知乎: GB/T14692 第一角与第三角](https://zhuanlan.zhihu.com/p/368779736)
  - GB/T 4458.1-2002 规定的视图画法，除特别指明外均为第一角画法。—— [国家标准馆 GB/T 4458.1-2002](https://www.ndls.org.cn/standard/detail/b58216091ed065712f76b8da59789231)
  - 中、英、德、俄、法用第一角；美、日、澳、加用第三角。—— [搜狐](https://www.sohu.com/a/259502504_650045)（二手来源）
  - 对照：SOLIDWORKS 内置教程用第三角。—— [SW Help 2027](https://help.solidworks.com/2027/english/swtutorialonline/t_tut_lesson3_createdrawing.htm)
- 国内 MOOC《SolidWorks三维建模设计》的先修课包括"机械零部件构形与识图"。—— [icourse163](https://www.icourse163.org/course/detail.htm?cid=1206308810)

### Inferences
- 各体系里每个概念的引入位置（据上文来源整理）：

| 概念 | Fusion ACU 考纲 | SW Essentials | Onshape 路径 | 其他 |
|---|---|---|---|---|
| 导航 / 视图 / 基准面 | 域 1（1.1–1.3） | L1 | Navigating Onshape | Rhino L1 的视口与构造平面 |
| 草图约束与完全定义 | 2.2 | L2 | Sketching | CSWA 草图几何关系 |
| 设计意图 | 隐含在 2.2 | L4 首次命名 | Intro to Parametric Feature-Based CAD | CSWP Seg 1"保持设计意图" |
| 特征树与回滚 | 1.2.e（入门） | L8（修复） | — | Fusion Timeline 报错文档 |
| 拔模 / 抽壳 / 筋 | 3.2.a | L4、L7 | — | — |
| 参数 / 方程 | 2.2.c | L11 | — | CSWP Seg 1 |
| 配置 | （fundamentals 路径提到） | L10 | 独立 Configurations 路径 | CSWP Seg 2 |
| 多实体 / 多零件 | 3.1.b | — | Multi-Part Part Studios | — |
| 直接建模 | Press Pull | — | — | ACA；Shapr3D |
| 装配自由度 | 4.3.a | L13–14 | Onshape Assemblies | CSWP Seg 3 |
| 自顶向下 / 骨架 | — | — | 用 Multi-part 替代 | PTC 独立的中级课 |
| 工程图 | 域 5 | L12（在装配前） | Detailed Drawings（最后） | SW 内置 Lesson 3 |
| 曲面 / 自由形态 | Forms 3.3 | — | Advanced Part and Surfacing Design | CSWP-SU |
| 连续性 / 曲率分析 | — | — | — | Rhino L2；Alias |
| GD&T | — | — | — | 大学工程图学 |

- 建议的概念依赖链（第 7 节据此排课）：坐标系/视图 → 基准 → 草图自由度 → 特征终止条件 → 设计意图 → 特征树/父子关系 → TNP 与稳健参考 → 参数/方程 → 配置 → 装配自由度 → 运动与干涉 → 自顶向下 → 工程图/公差/GD&T。
- 官方课程到学会基础拉伸之后才命名"设计意图"（SW L4）。概念优先的网站可以提前，用"改一个尺寸，看模型怎么变"的互动在第一个草图课就埋下这个概念。
- 对中文学习者，正投影应默认用 GB 第一角，并明确对照英文教程的第三角，否则"按图建模"类练习会系统性出错。
- TNP 是各软件"改了前面，后面就断"的共同底层原因：FreeCAD 1.0 只是缓解，Fusion 建议"圆角放后"，FreeCAD 建议"引用基准面"，说的是同一条原则。它适合作为一个统一概念来讲。

### Gaps
- 配置/变量该在初级还是中级教，没有跨厂商的统一证据：Onshape 把它放在独立路径，Fusion fundamentals 路径又提到了它。
- 没有检索 Onshape 关于参考稳健性（如 persistent IDs）的官方说明。
- GB/T 14692 当前有效版本（2008 版之后是否更新）未核实。

---

## 3. 哪些 DFM 主题应进入课程（附权威数值）

### Takeaway
适合入门到中级的 DFM 可以概括为"四种工艺 × 少数硬规则"：
- **3D 打印**：悬垂约 45°、最小壁厚、配合间隙、打印方向
- **CNC**：刀具可达性、内角半径 > 1/3 腔深、腔深 ≤ 4 倍腔宽
- **钣金**：折弯半径、K 因子、法兰 ≥ 4 倍料厚、孔距折弯、释放槽、展开图
- **注塑**：均匀壁厚、拔模、筋和螺丝柱取 40–60% 壁厚、分型线、倒扣/侧抽、卡扣

各供应商的数值并不一致。课程应讲清规则背后的物理原因，并强调以实际供应商的规则为准。

### Cited Findings

#### 注塑（Injection molding）
- Protolabs 拔模建议：竖直面 0.5°，多数情况 2°，shut-off 至少 3°，轻纹理 PM-T1 和 PM-T2 至少 3°；表中另有一行 5°+，页面没标注对应情形。—— [Protolabs IM design guidelines](https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/)
- 同页按材料给出推荐壁厚：ABS 1.143–3.556 mm、PC 1.016–3.81 mm、PP 0.889–3.81 mm、Nylon 0.762–2.921 mm、Acetal 0.762–3.048 mm 等。模具加工公差通常 ±0.08 mm，另有与树脂相关的 ±0.002 mm/mm。侧抽芯上限：宽 < 213.84 mm、高 < 60.38 mm、抽拔行程 < 73.66 mm。—— [同上](https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/)
- 通用规则：
  - 壁厚一般 1–3.5 mm，全件保持一致；相邻壁不低于主壁的 40–60%。
  - 尼龙、PP 等结晶性树脂收缩比 ABS、PC 等非结晶性树脂大，更需要均匀壁厚。
  - 经验上每 25 mm 腔深约需 1° 拔模。
  
  —— [Protolabs Injection Molding Guide](https://www.protolabs.com/resources/guides-and-trend-reports/injection-molding-guide-process-design-tips-materials/)（检索摘要）
- 筋和螺丝柱：
  - 筋厚取相邻壁的 40–60%，不超过 60% 以免缩痕。
  - 螺丝柱壁厚取主壁的 40–60%，外径约为螺钉直径的 2 倍，内外壁都要拔模（0.5–3°）。
  - 柱子靠近侧壁时用筋连接，不要把中间填实。
  - 内圆角取 0.5–1 倍壁厚。
  
  —— [Protolabs: choosing the right boss](https://www.protolabs.com/en-gb/resources/design-tips/choosing-the-right-boss-for-your-part-design/)；[Designing for Mouldability Vol.1](https://www.protolabs.com/en-gb/resources/white-papers/designing-for-mouldability-volume-1/)（检索摘要；Protolabs 设计规范主页面没有列这些数值）
- 倒扣与侧抽：
  - side-action 只能在垂直于开模方向的 X/Y 平面内移动；内侧倒扣常用 pickout。
  - 卡扣最便宜的做法是 sliding shutoff，但需要在卡扣下方开孔；否则用 side-action，且必须能从外分型线到达。
  - 合理放置分型线可以直接消除倒扣；轻微倒扣可用 bumpoff 强脱（如 Tupperware 盒盖）。
  
  —— [Protolabs: undercuts with side actions](https://www.protolabs.com/resources/design-tips/conquering-undercut-design-issues-with-side-actions-inserts-and-shut-offs/)；[Protolabs: complex features](https://www.protolabs.com/resources/design-tips/5-ways-to-master-complex-features-in-injection-molded-parts/)
- 卡扣的竖壁同样需要拔模。—— [Hubs injection molding guide](https://www.hubs.com/guides/injection-molding/)（检索摘要）

#### 钣金（Sheet metal）
- Protolabs 规则：
  - 标准内折弯半径：0.762 / 1.524 / 2.286 / 3.048 mm（0.030 / 0.060 / 0.090 / 0.120 in）；所有折弯角公差 ±1°。
  - 法兰长度至少 4 倍料厚；距折弯 4 倍料厚以内的特征有变形风险。
  - 孔距板边：料厚 ≤ 0.914 mm 时 1.574 mm，料厚更大时至少 3.175 mm；孔径不小于料厚。
  - 卷边：内径等于料厚，回边长 6 倍料厚。
  - 可加工料厚 0.609–6.35 mm。
  
  —— [Protolabs sheet metal guidelines](https://www.protolabs.com/services/sheet-metal-fabrication/design-guidelines/)（无发布日期，图片文件名显示约 2025 年修订）
- K 因子：
  - 定义是中性层到折弯内表面的距离与料厚之比，属于经验常数。R < T 时，空气折弯约 0.33、底部折弯约 0.42；随半径增大趋近 0.5，但不超过 0.5。—— [Protolabs: bend radii basics](https://www.protolabs.com/resources/design-tips/the-basics-of-bend-radii-in-sheet-metal/)
  - Xometry 空气折弯经验表（软/中/硬材料）：R 在 0–1T 时 0.33/0.38/0.40；1–3T 时 0.40/0.43/0.45；大于 3T 时 0.50。—— [Xometry](https://www.xometry.com/resources/sheet/how-to-avoid-an-out-of-spec-angle-bend-in-sheet-metal/)
- 释放槽与孔距，各家说法冲突：
  - 释放槽：Protolabs 写宽度不超过 0.030 in、长度不超过 R+T；Fictiv 写宽度不小于 T 与 0.030 in 中较大者、深度至少 1.5T。一个给上限，一个给下限。
  - 孔到折弯线：Protolabs 4T；Fictiv 2.5T + R。
  
  —— [Protolabs](https://www.protolabs.com/resources/design-tips/the-basics-of-bend-radii-in-sheet-metal/)；[Fictiv sheet metal specs](https://www.fictiv.com/specifications/sheet-metal)
- 折弯余量公式 BA = π × (R + K×T) × (A/180)。来源是第三方，它把公式归到 ISO 2768，这个归因存疑。—— [Ekinsun](https://www.ekinsun.com/capabilities/sheet-metal-bend-radius-chart/)

#### CNC 加工
- Hubs（现 Protolabs Network）规则表：

| 项目 | 推荐 | 可行极限 |
|---|---|---|
| 竖直内角半径 | > 1/3 腔深 | — |
| 腔底角 | 尖角，或 R0.1 / R1 mm | — |
| 腔深 | 4 倍腔宽 | 10 倍刀径 |
| 最小壁厚 | 金属 0.8 mm，塑料 1.5 mm | 金属 0.5 mm，塑料 1.0 mm |
| 孔深 | 4 倍公称直径 | 6 倍 |
| 螺纹 | 长 3 倍直径，M6 以上 | M2 |
| 小特征 | 2.5 mm | 0.5 mm |
| 公差 | ±0.125 mm | ±0.025 mm |
| 倒扣 | 宽 3–40 mm，与周边净空 ≥ 4 倍深度 | 深度最多 2 倍宽度 |

  —— [Hubs CNC machining design guide](https://www.hubs.com/guides/cnc-machining/)
- 最小内角半径就是刀具半径。需要尖角时，加 T-bone 清角比减小圆角更好；EDM 可做到约 R0.02 mm。另一篇 Hubs 文章更保守，建议腔深只取 2–3 倍刀径。—— [Hubs: how to design for CNC](https://www.hubs.com/knowledge-base/how-design-parts-cnc-machining/)；[Hubs: sharp corners](https://www.hubs.com/knowledge-base/sharp-corners-in-cnc-machining/)

#### 3D 打印
- FDM 与 SLA 的自支撑角约 45°；FDM 打 45° 时，新一层有 50% 落在上一层上。
- FDM 桥接超过 5 mm 会下垂。壁厚大于 0.8 mm 所有打印机都能打。贴打印平台的边加 45° 倒角；关键竖孔打完再钻。

  —— [Hubs: key design considerations](https://www.hubs.com/knowledge-base/key-design-considerations-3d-printing/)；[Hubs: FDM design](https://www.hubs.com/knowledge-base/how-design-parts-fdm-3d-printing/)
- Formlabs Form 4（Grey Resin，50 μm）：
  - 支撑壁和无支撑壁在 0.2 mm 及以下都可能翘曲。
  - 水平悬垂超过 5 mm 会成形不完整；悬垂角最小 10°。
  - 运动件间隙小于 0.4 mm 可能粘连；Form 3 指南给的是 0.5 mm。
  - 更早的 Form 1+/2 指南更保守：无支撑壁 0.6 mm、最小角 19°。
  
  —— [Formlabs Form 4 design guide](https://formlabs.com/white-papers/form-4-design-guide/)；[Formlabs legacy design guide](https://archive-media.formlabs.com/upload/formlabs-design-guide.pdf)
- 配合间隙的其他取值：HLH 建议配合件之间至少 0.5 mm；Xometry Pro 建议滑动配合 0.2–0.3 mm。—— [HLH FDM guide](https://hlhrapid.com/knowledge/design-guide-fdm-3d-printing/)；[Xometry Pro](https://xometry.pro/en/articles/fdm-design-tips/)

#### DFM 在官方课程中的位置
- SW Essentials 在第 4 课就教拔模，第 7 课"Shelling and Ribs"被培训商描述为聚焦制造相关特征。—— [Solid Solutions](https://www.solidsolutions.co.uk/solidworks-training/courses/3d-cad/essentials-agenda.aspx)
- Shapr3D 的 Solid modeling 路径包含 DFM best practices。—— [Shapr3D](https://support.shapr3d.com/hc/en-us/articles/12208897524380-Video-tutorials)
- 中国大学MOOC 有《塑料成型工艺与三维模具设计》（UG NX MoldWizard，48 学时）。—— [盐城工学院 MOOC](https://www.icourse163.org/course/YCIT-1457958173)

### Inferences
- DFM 规则大多是几何检查：壁厚、角度、半径、比例距离。很适合在浏览器里实时着色或画热力图，这是 3D 交互网站相对视频课的核心优势。
- 数值冲突本身就是教学内容，例如钣金释放槽与孔距、SLA 间隙随机型变化。要教的是"规则因工艺、设备、供应商而异，最终以供应商的 DFM 报告为准"，而不是背一个数。
- 不同人群的 DFM 入口：
  - makers 和软件转硬件人群：先学 3D 打印 DFM，成本低、反馈快。
  - ID 人群：注塑（拔模、分型、均匀壁厚）是造型与工程冲突最多的地方，应和曲面课程打通。
  - 硬件工程师：钣金和 CNC 是日常主力。

### Gaps
- Protolabs 设计规范主页面没有筋、螺丝柱、圆角的数值。这些来自其设计技巧和白皮书页面的检索摘要，没有逐页打开核实。常见的"筋高 ≤ 3 倍壁厚"在本次来源里没有确认。
- 没拿到 Fictiv 的 CNC/注塑规范原文和 Xometry 的注塑指南原文。Hubs FDM 规则表里"连接/运动件 0.5 mm"未核实。
- DFA（面向装配的设计）、紧固件与嵌件、公差叠加等中级主题本次未检索。

---

## 4. 工业设计侧增加什么？与实体建模如何排序？

### Takeaway
在实体建模之上，ID 侧要再加：曲线质量 → 连续性（G0–G3）→ 分析（曲率梳、斑马纹、高光）→ 分面/布面 → 圆角与混接的区别 → Class-A。中国工业设计院校普遍以 Rhino 作为第一建模软件，课时 48–64，常配 KeyShot 或 V-Ray 渲染。课序一般是：Rhino 曲线、曲面、实体 → 分面 → 复杂曲面 → T-Splines/SubD → 渲染。参数化实体（Creo / SolidWorks）多为后置或选修。

### Cited Findings
- **连续性等级（Rhino L2 手册）**：
  - G0 是位置连续，可以 join，但会有折角；G1 相切；G2 曲率连续。更高阶 Rhino 也能建，但检测工具更少。
  - 曲面要用 OpenGL 伪彩显示来检查；内部只有 G1 的曲面，到后续步骤可能出现 G0 折角。
  
  —— [Rhino 5 Level 2 manual](http://www.andreasmoos.de/downloads/Rhino_Level_2.pdf)（检索摘要）
- **Alias**：生产级曲面的基线是严格公差下的 G0/G1/G2；Class-A 追求近乎完美的高光，常用 G3。诊断靠 Bezier 面片、Light Tunnel 和 Iso-Angle 着色。—— [Alias 2024 Help](https://help.autodesk.com/view/ALIAS/2024/ENU/?guid=GUID-64611955-D2CC-44F2-98F0-D4F1FE931D8B)
- **中文社区的标准与口诀**：
  - 工业设计里 G2 是光顺曲面的最低标准。G3 能消除曲率梳在接缝处的尖角，汽车一般需要 G3。—— [知乎: Rhino产品级曲面建模（合集）](https://zhuanlan.zhihu.com/p/132421509)
  - 同文指出：Rhino 默认的圆角矩形由 4 条直线和 4 段 1/4 圆弧组成，只有 G1，曲率梳在接点处断开、高光突兀。—— [同上](https://zhuanlan.zhihu.com/p/132421509)
  - 曲线用 _CurvatureGraph、曲面用 _Zebra 检查。流行口诀是"接点两侧各一个共线控制点约等于 G1，各两个约等于 G2"。—— [知乎: 一文看懂Rhino曲线曲率关系](https://zhuanlan.zhihu.com/p/152011059)
  - **本研究者按**：这条口诀是简化说法。严格的 G2 只要求两侧曲率相等；三点都共线只是"接点曲率为零"的特例。
  - 实际最常用的是 G0/G1/G2，G3/G4 一般只在超跑、航空等领域需要。—— [B站专栏 cv13555587](https://www.bilibili.com/read/cv13555587/)
- **各命令能做到的连续性**（Rhino 训练手册中文译本）：NetworkSrf G0–G2、Sweep2 G0–G2、Patch G0–G1、Loft G0–G1、BlendSrf G0–G4。—— [犀牛建筑网 教程（九）](https://www.rhino-3d.com/thread-8714-1-1.html)
- **控制点规则**：G1 由每条曲线端部 2 个控制点决定（曲面是 2 排），G2 需要 3 个（曲面 3 排）。—— [学犀牛 thread-5177](https://www.xuexiniu.com/thread-5177-1-1.html)
- **机械 CAD 侧**：Plasticity 的 Fillet 提供 G2 continuous 剖面，可替代普通圆角。—— [Plasticity Manual](https://doc.plasticity.xyz/solid/fillet-shell)。SOLIDWORKS CSWP-SU 的考点包括 Boundary Surface、Filled Surface、Knit、Thicken 等，GoEngineer 称其涉及连续性与光顺分析。—— [GoEngineer](https://www.goengineer.com/solidworks-certification/cswpa-surfacing)
- **国内院校课程**：
  - 东莞理工《计算机辅助工业设计(一)》：必修，48 学时，以 Rhino 6 为主。—— [DGUT 教学大纲 PDF](https://yt.dgut.edu.cn/__local/C/9E/6D/02D4D2F2139A85CF563FB18359D_07C0FB42_667A0.pdf?e=.pdf)
  - 郑州大学《计算机辅助设计2》：64 学时，其中 Rhino 48、V-Ray 16。—— [cucdc 文库](http://m.download.cucdc.com/wenku/a30ac3dec78d4216a268f578ee11229a.html)
  - 广东职业技术学院：Rhino 加 KeyShot；曲面项目重点是 Blend、Match、Rebuild、ShrinkTrimmedSrf。—— [GDPT](https://jxzy.gdpt.edu.cn/portal/res?key=11039062)
  - 国家智慧教育平台《计算机辅助设计—Rhino》：Rhino 6 加 KeyShot 9，章节含切面成形和轨道成形。—— [smartedu](https://higher.smartedu.cn/course/68eace285345b68214cf99cf)
  - 超星课程：项目一是 15 个造型练习（笔、车前盖、Alessi 榨汁机、仿生夹、美工刀、水龙头等），共 20 学时。—— [超星](https://mooc1-2.chaoxing.com/course/221220249.html)
- 北京理工大学 MOOC《计算机辅助A级曲面造型基础》用 Rhino 加 Autodesk Shape Modeling 插件讲曲线、曲面、实体，并称计算机辅助设计是工业设计与产品设计专业的必修课。—— [icourse163 BIT](https://www.icourse163.org/course/BIT-1449613165?tid=1475367471)（插件源自 Alias 技术这一点是本研究者的已知信息，来源中没有写）
- 教材《计算机辅助工业设计》（潘荣、叶丹、周晓江）的结构：Rhino 曲线、曲面、实体基础 → **曲面分面方法** → 复杂曲面技巧 → T-Splines 自由造型 → KeyShot 渲染。—— [微信读书](https://weread.qq.com/web/bookDetail/53e32610811e42751g0184ba)
- 学犀牛的免费课覆盖高级曲面、Rhino 7 SubD、Bezier 曲面与"分面思维"、VSR 工具，共 31 章 445 课。—— [xuexiniu.com](https://www.xuexiniu.com/24-1.html)（检索摘要）
- 一位工业设计硕士生把 Rhino 命令分为曲线、曲面、实体、辅助四类。—— [知乎 p/386253771](https://zhuanlan.zhihu.com/p/386253771)
- Fusion 的 ACU 和 ACA 都把 Form（T-Splines 类细分建模）列为考点：创建与编辑 form，ACA 还要求加厚 form。—— [ACU objectives](https://www.arit.co.th/assets/objective/acu/ACU_OD_Fusion360_0922.pdf)；[2020 ACA guide](https://damassets.autodesk.net/content/dam/autodesk/www/training-and-certification/docs/exam-guide-autodesk-certification-CAD-fusion-360.pdf)

### Inferences
- ID 侧的核心能力是视觉判断：读曲率梳、斑马纹、高光，看控制点分布。这些靠视频很难讲清，最适合交互 3D，例如拖动控制点时实时更新曲率梳和斑马纹。
- 建议顺序：先让 ID 人群理解 NURBS 曲线（阶数、控制点、节点），再学连续性。"圆角（rolling-ball，通常只有 G1）对比混接（G2/G3）"要放在学会看斑马纹之后，学习者才看得见差别。
- 中国 ID 教学是 Rhino-first、以渲染出图和项目练习驱动的。分面/布面有教材覆盖，但多在课程后段。本科层面的 Class-A 多停留在概念加 Rhino 插件，系统的 Alias 教学主要在培训机构和汽车方向。
- ID 学习者的常见短板是参数化实体与 DFM（拔模、壁厚、分型），应专门设计"造型 → 工程"的交接课。

### Gaps
- 没找到西方 ID 院校（ArtCenter、CMU、Pratt 等）数字造型课程的具体课序。
- 没找到中文 Alias 课程大纲。
- 比例、造型语言等与软件无关的 ID 内容本次没有检索。

---

## 5. 学习者最常见的卡点与误解

### Takeaway
卡点集中在五类：
1. **草图定义状态**：欠定义会漂移，过定义会冲突。
2. **参考与特征顺序导致的重建错误**：TNP、圆角边被下游引用、草图平面丢失。
3. **特征失败**：抽壳厚度大于最小曲率半径、圆角失败。
4. **装配配合**："零件还能动就继续加配合"，导致冗余和过定义；对"固定第一个零件"有相互矛盾的建议。
5. **连续性概念混淆**：以为 join 了就光顺，不知道默认圆角只有 G1。

中文自学者还有学习方式上的问题：只看不练，出错就重画。

### Cited Findings
- **欠定义**：
  - 蓝色线是欠定义，黑色线是完全定义。欠定义的几何在修改时会移动，导致尺寸莫名变化、重建失败、设计意图丢失。
  - 常见错误：没把草图锚定到原点；编辑后留下悬空关系；只标尺寸、不加几何约束；滥用 Fix。
  
  —— [sekkei-tech](https://sekkei-tech.com/2026/05/29/solidworks-sketch-constraints-guide/)
- **哪个更常见有争议**：cadin360 认为新手最常见的错误是过约束，而不是欠定义。—— [cadin360](https://cadin360.com/blog/solidworks/how-to-avoid-beginner-solid-modeling-mistakes-in-solidworks-2/)
- **认证场景（第三方）**：CSWA 限时修改时，欠定义草图会变成错误的质量值；最常见的错误是用了默认材料或单位错（mm 与 inch）。—— [open-exam-prep CSWA](https://open-exam-prep.com/practice/solidworks-cswa)
- **中文社区总结的草图误区**：
  - 以为把所有线段长度都标上就算完全定义，忽视几何关系；把构造线当固定基准；对称关系没配驱动尺寸；原点附近的点没锁定，整体漂移。—— [CSDN: 过定义与欠定义](https://blog.csdn.net/2301_81910333/article/details/135274829)；[PLC技术网: SolidWorks 建模常见错误](https://bbs.plcjs.com/thread-639871-1-1.html)（检索摘要，具体出处未逐篇核实）
  - 不确定该加什么关系时，拖动欠定义的实体看它怎么变。—— [知乎: 12 个草图绘制规则](https://zhuanlan.zhihu.com/p/1917629738903634735)
  - 草图不完全定义时，改一个尺寸其他几何不跟着变，容易报错。—— [知乎: SolidWorks 快速入门教程 2](https://zhuanlan.zhihu.com/p/681560758)
- **Fusion 时间线报错**：
  - 警告显示黄色，错误显示红色，下游特征会丢失参考；用 Compute All 可以一次显示全部问题。—— [Autodesk support: timeline warnings/errors](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Resolving-Timeline-Warning-or-Errors-in-Fusion-360.html)
  - "sketch plane is lost"的原因是草图所依附的面被删除、重新阵列或复制，解决办法是 Redefine Sketch Plane。—— [Autodesk support: sketch plane lost](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Fusion-360-Timeline-error-The-sketch-plane-is-lost-Cache-is-used-Please-redefine-the-sketch-to-select-other-plane.html)
- **论坛经验**：
  - 圆角报"edge reference is lost"时，回滚到圆角特征重新选边。
  - 警告不及时修，后期会变成很难调试的错误。
  - 被引用的辅助几何应改成构造线或隐藏，不要删除。
  
  —— [Autodesk Community: lost edge reference](https://forums.autodesk.com/t5/fusion-support-forum/lost-edge-reference-in-fillet/td-p/8102197)；[Autodesk Community: profile reference lost](https://forums.autodesk.com/t5/fusion-design-validate-document/the-profile-reference-is-lost/td-p/10917541)
- 爱丁堡大学 uCreate 列出的常见原因：参考几何被删改、草图平面不存在、父特征变化影响下游。—— [uCreate: Fusion common problems](https://www.ucreatestudio.is.ed.ac.uk/fusion_360_common_problems)
- **抽壳失败**：
  - 官方错误信息给出三种原因：某个面偏移后进入相邻面；有需要消除的小面；某个面的曲率半径小于壳厚。建议用 Check 查最小曲率半径；先试 Offset Surface，能偏移通常就能抽壳。—— [SOLIDWORKS Help: Shell Errors (2025)](https://help.solidworks.com/2025/English/SolidWorks/sldworks/hide_shell_model_fail.htm)
  - 壳厚哪怕只比最小半径大 0.01 mm 也会失败（例：3.45 mm 成功、3.46 mm 失败）；样条和椭圆圆角最敏感。—— [PLM Group](https://support.plmgroup.eu/hc/en-us/articles/360013960917-Use-of-Check-in-SOLIDWORKS)
  - 教材把抽壳放在所有圆角之后，好让圆角半径一起被偏移。—— [LibreTexts: Shell](https://workforce.libretexts.org/Bookshelves/Drafting_and_Design_Technology/Introduction_to_SolidWorks_%28Hortman%29/05%3A_Revolve_and_Other_DFM_Tools/5.02%3A_Shell)
- **装配配合**：
  - SOLIDWORKS 博客指出，很多问题源于"零件还能动，就继续加配合"。加配合前应先问：这个配合移除哪个自由度，这个自由度该不该移除？博客原话："Fully defined is a condition. Correctly defined is the goal." 建议一次只压缩一个可疑配合来排查。—— [SOLIDWORKS blog: Building Stable SOLIDWORKS Assemblies](https://blogs.solidworks.com/products/solidworks/building-stable-solidworks-assemblies/)
  - 官方排错步骤：看 Mates 文件夹里的红色错误 → 压缩该零件的其他配合 → 拖动零件看剩余自由度 → 压缩无关零件 → 重点检查距离/角度配合和固定零件。同时避免配合回路和冗余配合。MateXpert 可诊断出导致失败的配合子集。—— [SOLIDWORKS Help: Techniques for Fixing Mate Problems](https://help.solidworks.com/2014/English/SolidWorks/sldworks/t_techniques_fixing_mate_problems.htm)；[CATI: MateXpert](https://www.cati.com/blog/diagnosing-assembly-errors-with-matexpert-in-solidworks/)
- **"固定第一个零件"的建议互相矛盾**：
  - 英文经销商和教程文章：保持 SW 自动固定的第一个零件；先对齐三个基准面；配合优先引用基准面和轴，而不是模型边或圆角。—— [Engineers Rule](https://www.engineersrule.com/guide-to-successful-mates-in-your-assembly/)；[Innova Systems](https://www.innova-systems.co.uk/solidworks-mate-tool-tutorial-best-practice/)（检索摘要）
  - 中文帖子：不要只靠"固定"，第一个零件也要用三基准面配合到原点。—— [CSDN](https://blog.csdn.net/2301_81910333/article/details/135274829)（检索摘要）
  - 两种说法并存，说明"接地/固定"这个概念本身就让人困惑。
- **连续性误解**：
  - 默认圆角矩形只有 G1（见第 4 节）。—— [知乎](https://zhuanlan.zhihu.com/p/132421509)
  - 内部只有 G1 的曲面，后续可能出现 G0 折角。—— [Rhino 5 L2](http://www.andreasmoos.de/downloads/Rhino_Level_2.pdf)
  - "数共线控制点判断 G1/G2"的简化口诀流传很广。—— [知乎](https://zhuanlan.zhihu.com/p/152011059)
- Rhino L1 认证要求会排查 Boolean 失败，并会用 Check 和 Audit。—— [McNeel L1 study guide](https://wiki.mcneel.com/rhino/level1_study_guide)
- **中文自学者的学习习惯问题**：只看不练（视频看着简单，自己做时草图动不了、特征报错）；草图没练扎实就进装配；出错后关掉重画，而不是去编辑特征或几何关系。—— [CSDN: 零基础学 SolidWorks 2026](https://blog.csdn.net/weixin_42548874/article/details/164410896)
- 镜像零件时选了"断开链接"，原件修改后镜像件不会更新。—— [PLC技术网](https://bbs.plcjs.com/thread-639871-1-1.html)（检索摘要）

### Inferences
- 绝大多数卡点都可以归结为"不理解模型是一张依赖图"。草图自由度、特征父子关系、TNP、配合自由度用的是同一种思维。网站可以用统一的可视化语言（依赖图加自由度计数器）贯穿所有模块。
- "看得见的失败"是最好的教材。可以设计"故意制造失败 → 诊断 → 修复"的练习，例如：删掉圆角看下游变红；让壳厚超过最小曲率半径；加一个冗余配合。
- 中文学习者的问题更多出在学习方式（被动看视频、出错重画）。交互式即时反馈加"修复而不是重画"的练习正好对症。

### Gaps
- Reddit（r/SolidWorks、r/Fusion360、r/cad）和 Eng-Tips 的原帖没有直接检索到，搜索结果被厂商博客占满，缺少卡点出现频次的数据。
- B站评论区的卡点没有做系统分析。
- 没有任何关于各类卡点出现频率的统计。

---

## 6. 中文学习生态现状

### Takeaway
中文学习生态由四部分构成：
- **B站**：免费长视频合集，SolidWorks 为主，按软件模块组织，标题爱用"速成""全 N 集"，常导流到微信私域。
- **中国大学MOOC / 国家智慧教育平台**：院校课，按"草图 → 实体 → 装配 → 工程图（→ CAM）"或按零件项目组织，常对接 1+X 证书。
- **知乎、CSDN**：图文经验帖。
- **专门社区**：如学犀牛。

腾讯课堂已于 2024-10-01 停运，网易云课堂在式微。国产中望 3D 通过教育云、免费教育版和认证进入高校。整体偏"按钮/命令中心"，设计意图、自由度、连续性、DFM 等概念只散见于零散文章。

### Cited Findings
- **B站**：
  - 高播放的 SolidWorks 系列：《SolidWorks三天速成教程》约 235.6 万播放；钣金与焊件全集约 66.9 万；"拒绝废话"全套约 58.4 万；工程图速成约 39.9 万。数据来自检索时视频页的侧栏。—— [B站 BV1z396B1EFk 页面](https://www.bilibili.com/video/BV1z396B1EFk/)（检索摘要）
  - 标题集数注水："全600集"实际只有 42 个视频，"全700集"的播放列表只有 20 个。多个 UP 主留微信号"资料领取"，导流付费培训。三个不同账号的"2026"系列都是 42 集，且都以"为什么选择Solidworks"开篇，疑似同一套课多号分发。—— [B站 BV1Lspg6jEBH](https://www.bilibili.com/zh-Hans/video/BV1Lspg6jEBH/)；[B站 BV1u7dGBREqC](https://www.bilibili.com/video/BV1u7dGBREqC/)（检索摘要）
  - 典型课程结构：界面 → 草图 → 特征 → 装配 → 工程图 → 钣金焊件。—— [B站 BV1mysf6CE9Z](https://www.bilibili.com/video/BV1mysf6CE9Z/)
  - 常见营销话术："七天就能从小白到大神""少走99%的弯路""五月份学完即可就业"。—— [B站 BV1TBJ26aEXs](https://www.bilibili.com/video/BV1TBJ26aEXs/)；[B站 BV1u7dGBREqC](https://www.bilibili.com/video/BV1u7dGBREqC/)
- **中国大学MOOC（SolidWorks）**：
  - 《SolidWorks三维建模设计》：机械类核心课，内容含二维图、三维零件、曲面、钣金、装配；先修"机械零部件构形与识图"等。—— [icourse163](https://www.icourse163.org/course/detail.htm?cid=1206308810)
  - 西北工业大学《Solidworks三维产品设计与建模》：面向机类与非机类学生，选课 10 万以上，开课 2025-10-27 至 2026-06-30，共 36 周。—— [icourse163 NWPU](https://www.icourse163.org/course/NWPU-1207040802)；[国家智慧教育平台](https://chinaooc.com.cn/course/690130cc5345b6821442d619)
- **中国大学MOOC（UG NX）**：
  - 陕西国防工业职业技术学院《UG软件应用》（NX 10–12）分四个项目：零件造型及工程图 → 装配及装配工程图 → 平面加工编程 → 曲面三轴编程。—— [icourse163 GFXY](https://www.icourse163.org/course/GFXY-1003096001)
  - 《CAD/CAM》（NX 8.5 及以上）：草图 → 实体 → 虚拟装配 → 工程图 → CAM；项目零件为传动轴、端盖、拨叉、连杆、摇臂、泵缸、笔筒。—— [icourse163 CAD/CAM](https://www.icourse163.org/course/detail.htm?cid=1450037176)
  - 无锡职业技术大学《数字化设计基础》对接 Siemens NX CAD 工程师认证和 1+X 证书。—— [icourse163 WXIT](https://www.icourse163.org/course/WXIT-1207055808?tid=1488261531)
- **平台变化**：
  - 腾讯课堂 2023-10 暂停付费课；2024-06-29 发公告，8-01 停止课程访问，10-01 全面停运。—— [澎湃新闻](https://m.thepaper.cn/newsDetail_forward_27932413)；[CSDN](https://blog.csdn.net/ht123456666/article/details/140179758)；[ke.qq.com 公告](https://ke.qq.com/)
  - 网易云课堂近两年新课减少，讲师更看重私域流量。—— [羽度非凡博客](https://www.yudufeifan.cn/post/514.html)（个人博客，约 2024 年中）
- **知乎**：
  - 讨论焦点是"学哪个软件"（SW、UG、Creo）。高质量回答强调建模原理相通，真正要学的是参数化建模和表达设计意图，并主张从"搭积木"式建模转向"自顶向下"。—— [知乎: 哪个更容易上手](https://www.zhihu.com/question/29370211)；[知乎专栏: SW/Creo/UG 比较](https://zhuanlan.zhihu.com/p/661658534)；[知乎: 只学一个软件](https://www.zhihu.com/question/604855614)
  - 另有回答提到，自顶向下设计常从骨架文件中引用草图和基准。—— [知乎: AutoCAD/SW/UG/Creo 学哪个](https://www.zhihu.com/question/370504133)
- **中文图文经验**：强调完全定义、几何约束优先于尺寸、先形状后尺寸。参数化建模的推荐顺序是：规划主参数 → 全局变量 → 完全定义草图 → 合理安排特征顺序 → 用方程式关联。—— [CSDN: 参数化建模正确顺序](https://blog.csdn.net/weixin_66529346/article/details/160022852)；[什么值得买](https://post.smzdm.com/p/a4qxqmnk/)
- **学犀牛**（xuexiniu.com）是 Rhino 中文社区，提供 G0/G1/G2 讲解和长课程。—— [学犀牛](https://www.xuexiniu.com/thread-5177-1-1.html)
- **中望**（资料均来自中望自有门户，部分页面较旧）：
  - 教育云平台提供中望3D 教育版，覆盖曲面、实体、模具、装配、钣金、工程图、2–5 轴加工。
  - "国产工业软件进高校"项目向本科院校免费提供 300 天全功能教育版。
  - 认证有 1+X《机械产品三维模型设计》（初级/中级）、中望认证工程师等。
  
  —— [cadexam.com: 进高校](https://www.cadexam.com/soft/apply/index.html)；[cadexam.com: 机械三维设计认证](https://www.cadexam.com/cert/machinery/index.html)

### Inferences
- 中文主流课程按"软件模块 + 零件案例"组织，概念层（设计意图、自由度、参考稳健性、连续性、DFM）分散在文章里。这正是"概念优先、工具无关"网站的差异化空间。
- 生态中的可信度信号很弱（集数注水、私域导流）。以可验证练习（自动判分）为核心的产品更容易建立信任。
- 机械专业学生对"该学 SW、UG 还是 Creo"很焦虑。课程地图里明确"一个概念 → 各软件对应命令"的映射，能直接缓解这种焦虑。
- 1+X 证书、Siemens NX 认证、CSWA 是中文学习者看得见的外部目标，可以作为学习路径的终点映射。

### Gaps
- B站播放量是检索时点的侧栏数据，没有逐一核实。Rhino、Fusion、Onshape、UG、Creo 的头部 UP 主和播放量没有系统统计。B站评论区里的卡点没有分析。UG 高播放课程没有找到可靠数据，检索只见一套约 2.7 万播放的 UG12 教程，无法单独链接。
- 本次检索在中国大学MOOC 上没找到 Creo 课程；网易云课堂 2025–2026 年的建模课程现状未知。
- Fusion、Onshape、Plasticity、Shapr3D 在中国的使用情况和中文官方资源未检索。
- 没有中望 3D 在高校使用规模的独立数据。

---

## 7. 课程大纲提案（Tracks → Modules → Lessons）

### Takeaway
建议采用"1 条公共地基 + 5 条主轨 + 贯穿项目"的结构：
- T0 空间与读图（公共地基）
- T1 参数化零件
- T2 装配与机构
- T3 工程图与公差
- T4 DFM
- T5 曲线、曲面与造型

按四类人群提供不同的入口路径。最该做成 3D 交互仿真的内容：草图与装配的自由度/约束；特征树依赖与 TNP；正投影与剖视；曲率梳、连续性与斑马纹；拔模、壁厚、悬垂、刀具可达等 DFM 检查；钣金折弯展开与 K 因子。

### Cited Findings
以下为排课依据，均已在前文引用：
- 主干顺序对齐 ACU Fusion 五域、Onshape Fundamentals、SW 内置教程和 PTC Fundamentals 系列。—— [ACU objectives](https://www.arit.co.th/assets/objective/acu/ACU_OD_Fusion360_0922.pdf)；[BroncBotz/Onshape](https://docs.broncbotz.org/cad-design-and-mechanical/cad-in-onshape/getting-started-with-onshape)；[SW Help](https://help.solidworks.com/2027/english/swtutorialonline/t_tut_lesson3_createdrawing.htm)；[PTC catalog](https://training-materials.ptcu.com/catalog/ptc-university-creo-curriculum-en.pdf)
- 中级模块对齐 SW Essentials 第 8–11 课、CSWP 三段和 PTC 骨架课。—— [Solid Solutions](https://www.solidsolutions.co.uk/solidworks-training/courses/3d-cad/essentials-agenda.aspx)；[CSWP](https://www.solidworks.com/sites/default/files/cswpsampleexam.pdf)；[PTC abstract](https://training-materials.ptcu.com/abstract/creo/en/CRAS-ASTD-Abstract.pdf)
- 学时参照：
  - ACU 约 150 小时；ACA 约 150 小时（2020 版指南写的是 1–2 年）。—— [ACU](https://www.arit.co.th/assets/objective/acu/ACU_OD_Fusion360_0922.pdf)；[ACA](https://www.autodesk.com/certification/all-certifications/cad-mechanical-design-associate)
  - COA 35–50 小时。—— [Onshape](https://www.onshape.com/en/blog/onshape-certified-associate-cad-exam)
  - SW Essentials 4–5 天。—— [TPM](https://www.tpm.com/services/training/solidworks-course-index-2/)
  - 国内 Rhino 课 48–64 学时。—— [DGUT](https://yt.dgut.edu.cn/__local/C/9E/6D/02D4D2F2139A85CF563FB18359D_07C0FB42_667A0.pdf?e=.pdf)；[郑大](http://m.download.cucdc.com/wenku/a30ac3dec78d4216a268f578ee11229a.html)
  - Class-A 40 小时，要求先有 Alias L3。—— [Design Engine](https://design-engine.com/alias-auto-class-a-automotive-surfacing/)
- 判分机制参照 CSWA 的质量/质心判分。—— [SOLIDWORKS blog](https://blogs.solidworks.com/products/solidworks/lesson-6-solidworks-academic-certification-cswa-exam-part-1/)
- ID 轨的顺序参照 Rhino L1 → L2、Alias 初学课和潘荣教材。—— [McNeel L1](https://wiki.mcneel.com/rhino/level1_study_guide)；[Rhino L2](http://www.andreasmoos.de/downloads/Rhino_Level_2.pdf)；[Learn Surfacing](https://learnsurfacing.thinkific.com/courses/Alias-Surfacing)；[潘荣教材](https://weread.qq.com/web/bookDetail/53e32610811e42751g0184ba)
- DFM 数值参照 Protolabs、Hubs、Formlabs、Fictiv、Xometry（见第 3 节）。

### Inferences（以下大纲是基于上述证据的提案，尚未经用户验证）

**格式**：`编号 课名（English term）— 一句话学习目标｜先修｜3D 交互收益`

**3D 交互收益图例**：
- ★★ 最受益：空间推理，或因果关系不可见、必须实时操作才能理解
- ★ 受益：3D 演示有帮助
- — 以文字或 2D 为主

#### T0 公共地基：空间、视图与几何表示（所有人必修，约 6–8 小时）
- **M0.1 三维空间与导航**
  - 0.1.1 坐标系与右手定则（Coordinate system）— 在任意视角下指出 X/Y/Z 正向，并知道不同软件的"向上轴"约定可能不同｜无｜★★
  - 0.1.2 视图操作与标准视图（Orbit / Pan / Zoom、ViewCube、Look At）— 用标准视图快速定位模型的任意面｜0.1.1｜★★
  - 0.1.3 原点、基准面、基准轴（Origin、datum planes/axes）— 理解"每个几何都需要参照"，会建偏移、角度、中面基准｜0.1.1｜★★
  - 0.1.4 构造平面与坐标输入（CPlane；绝对/相对/极坐标）— 在自由曲面软件里精确放置点和线｜0.1.3｜★
- **M0.2 正投影与读图**
  - 0.2.1 正投影与三视图（展开"玻璃盒"）— 能从 3D 推出三视图，也能由三视图还原 3D｜0.1.2｜★★
  - 0.2.2 第一角与第三角（GB 优先第一角，英文教程多用第三角）— 识别图纸采用的投影法及其符号｜0.2.1｜★★
  - 0.2.3 剖视、局部、辅助、断裂视图（Section / Detail / Auxiliary）— 理解剖切平面与剖面线的表达｜0.2.1｜★★（可拖动的剖切平面）
  - 0.2.4 按图建模的读图法 — 从图纸找出基准、对称和建模顺序｜0.2.1–0.2.3｜★
- **M0.3 几何表示与文件**
  - 0.3.1 实体、曲面、网格（B-rep 与 Mesh；NURBS 与多边形）— 区分三者及其用途（CAD、打印、渲染）｜无｜★★
  - 0.3.2 文件格式与交换（STEP、IGES、STL、3MF、原生格式）— 知道导出什么格式会丢失参数与历史｜0.3.1｜—
  - 0.3.3 单位、精度与材料设置 — 避免"单位或材料设错，质量全错"（CSWA 高频错误）｜无｜—

#### T1 参数化零件建模（机械主干，约 25–35 小时）
- **M1.1 草图与约束**
  - 1.1.1 草图平面与锚定原点 — 让每个草图都挂在基准上并锚定原点｜0.1.3｜★
  - 1.1.2 几何约束（重合、水平/竖直、平行/垂直、相切、同心、对称、相等）— 用约束表达形状关系，而不是靠尺寸堆砌｜1.1.1｜★★
  - 1.1.3 尺寸约束与草图自由度（DOF；欠定义、完全定义、过定义）— 读懂自由度计数，把草图做到完全定义且没有冗余｜1.1.2｜★★（拖拽测试加 DOF 计数器）
  - 1.1.4 构造几何、投影/转换实体、偏移、修剪、镜像 — 复用已有几何，减少约束数量｜1.1.3｜★
  - 1.1.5 设计意图入门（Design intent）— 同一形状用三种约束方案，改尺寸后比较它们的行为｜1.1.3｜★★
  - 1.1.6 参数与方程（命名参数、用户参数）— 用参数驱动关键尺寸｜1.1.5｜★（滑杆实时驱动）
- **M1.2 基础特征**
  - 1.2.1 拉伸与终止条件（给定深度、对称、到下一面、到指定面）— 选能表达意图的终止条件｜1.1.3｜★★
  - 1.2.2 旋转（Revolve）— 回转体建模与旋转轴的选择｜1.1.3｜★
  - 1.2.3 布尔与多实体（Join / Cut / Intersect / New Body）— 理解"特征就是对实体做布尔运算"｜1.2.1｜★★
  - 1.2.4 孔与螺纹特征（沉头、锪平、螺纹）— 用孔特征而不是画圆再切，保留制造语义｜1.2.1｜★
  - 1.2.5 阵列与镜像（线性、圆周、沿路径、填充）— 用阵列表达重复的设计意图｜1.2.1｜★
  - 1.2.6 圆角与倒角（含变半径、面圆角）— 掌握圆角的顺序与失败原因｜1.2.1｜★★
  - 1.2.7 抽壳、筋、拔模（制造相关特征）— 做出可注塑薄壁件的雏形｜1.2.6｜★★
  - 1.2.8 扫掠与放样（Sweep / Loft、引导线）— 由截面和路径生成复杂形体｜1.2.1｜★★
- **M1.3 特征树与稳健建模**（官方课程把它当入门能力：ACU 1.2.e、SW L8–L9）
  - 1.3.1 特征树、时间线与回滚 — 把模型看成"按顺序执行的程序"｜1.2.x｜★★（时间线拖动）
  - 1.3.2 父子关系与参考选择（优先引用基准面，而不是模型边）— 预测删改一个特征会影响哪些下游特征｜1.3.1｜★★（依赖图可视化）
  - 1.3.3 拓扑命名问题（TNP）— 解释"为什么改了前面，后面会断"，并掌握规避策略｜1.3.2｜★★（演示边被重新命名）
  - 1.3.4 特征顺序策略（主体 → 切除 → 抽壳 → 细节圆角；圆角放在抽壳前还是后）— 选择不容易失败的顺序｜1.3.2、1.2.7｜★★
  - 1.3.5 诊断与修复重建错误（读报错、重选参考、重定义草图平面、FilletXpert 类工具）— 不重画也能把模型修好｜1.3.3｜★
  - 1.3.6 设计变更演练（Design changes）— 改关键尺寸后，模型仍按意图更新｜1.3.5｜★
- **M1.4 直接建模与多实体**
  - 1.4.1 直接建模（Press/Pull、Move Face、Delete Face）— 判断什么时候用直接编辑，什么时候用历史建模｜1.3.1｜★★
  - 1.4.2 编辑导入几何（没有历史的 STEP 文件）— 修改没有特征树的"哑实体"｜1.4.1、0.3.2｜★
  - 1.4.3 多零件同场设计（Multi-part Part Studio、多实体）— 在同一上下文里设计相互配合的零件｜1.3.2｜★
- **M1.5 参数化进阶**（中级）
  - 1.5.1 全局变量与方程 — 改一处，全局联动｜1.1.6｜★
  - 1.5.2 配置、变体与设计表（Configurations、design tables）— 用一个模型管理一个尺寸系列｜1.5.1｜★
  - 1.5.3 质量属性、测量与截面分析 — 用体积、质心、截面自检模型（认证式判题）｜1.2.x｜★
  - 1.5.4 可编程特征简介（FeatureScript、API 的概念；选修，面向软件转硬件人群）— 把建模逻辑当作代码来理解｜1.5.2｜—

#### T2 装配与机构（约 10–15 小时）
- **M2.1 装配基础**
  - 2.1.1 零件、组件、子装配与 BOM 结构 — 理解装配是"引用"零件，而不是复制｜T1 基础｜★
  - 2.1.2 刚体的 6 个自由度与接地/固定（Grounding）— 说出零件当前还剩哪些自由度｜2.1.1｜★★
  - 2.1.3 配合与关节类型（重合、同心、距离、角度；Rigid / Revolute / Slider）— 用最少的配合表达真实运动｜2.1.2｜★★
  - 2.1.4 过定义、冗余配合与配合回路 — 识别并修复冗余配合（"完全定义只是状态，正确定义才是目标"）｜2.1.3｜★★
  - 2.1.5 干涉与碰撞检查 — 发现并量化干涉｜2.1.3｜★★
- **M2.2 机构与运动**
  - 2.2.1 驱动关节与运动研究 — 让机构按自由度运动，并检查极限位置｜2.1.3｜★★
  - 2.2.2 典型机构（铰链、滑块、齿轮、连杆）— 用配合表达常见机械运动｜2.2.1｜★★
- **M2.3 自顶向下设计**（中级）
  - 2.3.1 装配上下文设计（in-context）与外部参考的风险 — 引用其他零件几何时控制好依赖｜2.1.x、1.3.2｜★
  - 2.3.2 骨架模型与主模型（Skeleton、master model、publish geometry）— 用布局驱动多个零件｜2.3.1｜★★
  - 2.3.3 标准件、紧固件与孔对齐 — 调用库零件，并与孔特征联动｜2.1.3｜—

#### T3 工程图与公差（约 8–12 小时；3.1 也可以紧接 T1 学，SW Essentials 就是这么排的）
- **M3.1 工程图**
  - 3.1.1 图纸、图框与标题栏（GB 图幅与比例）— 建立符合国标的图纸模板｜0.2.2｜—
  - 3.1.2 由模型生成视图（基本、投影、剖视、局部、断裂）— 选择合适的表达方案｜0.2.3｜★
  - 3.1.3 尺寸标注原则（功能尺寸、基准、避免封闭尺寸链）— 让图纸既能制造又能检验｜3.1.2｜★
  - 3.1.4 装配图、零件序号与明细表 — 输出装配文档｜2.1.x｜—
- **M3.2 公差**
  - 3.2.1 尺寸公差与配合（间隙、过渡、过盈）— 为孔轴选择配合｜3.1.3｜★★（配合动画）
  - 3.2.2 GD&T 入门：基准与公差带（形状、方向、位置、跳动、轮廓）— 读懂常见形位公差符号｜3.2.1｜★★（3D 公差带）
  - 3.2.3 标准对照：GB/T、ISO 与 ASME Y14.5 — 读懂中英文图纸的差异｜3.2.2｜—
  - 3.2.4 表面粗糙度与技术要求 — 写出基本的技术要求｜3.1.3｜—

#### T4 面向制造的设计 DFM（约 12–18 小时）
- **M4.0 工艺选择**
  - 4.0.1 增材、减材、钣金成形、注塑总览 — 按数量、材料、成本为零件选工艺｜T1 基础｜★
- **M4.1 3D 打印**
  - 4.1.1 悬垂与支撑（FDM 约 45°；SLA 按设备指南）— 设计无需支撑的结构｜1.2.x｜★★（悬垂着色）
  - 4.1.2 打印方向与各向异性强度 — 按受力方向选择打印方向｜4.1.1｜★★
  - 4.1.3 最小壁厚、细节与桥接 — 避免打不出来或容易断的特征｜4.1.1｜★
  - 4.1.4 配合间隙与一体打印活动件 — 为卡扣、铰链、螺纹选间隙（常见 0.2–0.5 mm）｜4.1.3｜★★
- **M4.2 CNC 加工**
  - 4.2.1 刀具可达性与装夹方向 — 判断一个特征能否被刀具加工到｜1.2.x｜★★（刀具扫掠演示）
  - 4.2.2 内角半径与狗骨/T 骨清角 — 内角半径大于 1/3 腔深｜4.2.1｜★★
  - 4.2.3 腔深、孔深、壁厚、螺纹长度的比例规则 — 用比例规则控制成本｜4.2.1｜★
  - 4.2.4 公差、表面与成本 — 只在必要处标紧公差｜3.2.1｜—
- **M4.3 钣金**
  - 4.3.1 钣金建模方式（基体法兰、边线法兰、折弯）— 用钣金特征，而不是拿实体去切｜1.2.x｜★★
  - 4.3.2 折弯半径、中性层与 K 因子 — 理解展开长度为什么取决于 K 因子｜4.3.1｜★★（折弯与展开动画）
  - 4.3.3 释放槽、最小法兰、孔到折弯的距离 — 避免撕裂和变形，并认识到各供应商数值不同｜4.3.2｜★★
  - 4.3.4 展开图与 DXF 输出 — 交付激光切割文件｜4.3.3｜★
- **M4.4 注塑**
  - 4.4.1 均匀壁厚、缩痕与翘曲 — 把实心件改成均匀壁厚｜1.2.7｜★★（壁厚热力图）
  - 4.4.2 开模方向与拔模（含纹理对拔模的影响）— 做拔模分析并修正｜4.4.1｜★★
  - 4.4.3 分型线 — 选择分型线的位置｜4.4.2｜★★
  - 4.4.4 倒扣、侧抽、拾件（pickout）与强脱（bumpoff）— 识别倒扣并选择解决方案｜4.4.3｜★★
  - 4.4.5 筋与螺丝柱（40–60% 规则）— 用筋加强，而不是加厚壁｜4.4.1｜★
  - 4.4.6 卡扣（cantilever snap fit）— 设计能脱模的卡扣｜4.4.4｜★★
  - 4.4.7 圆角与应力集中 — 理解内外圆角与壁厚的关系｜4.4.1｜★

#### T5 曲线、曲面与造型（工业设计轨，约 25–40 小时）
- **M5.1 曲线**
  - 5.1.1 NURBS 曲线：控制点、阶数、节点、编辑点 — 解释阶数与控制点数量的关系｜0.3.1｜★★
  - 5.1.2 曲线质量与重建（Rebuild、控制点分布）— 用最少的控制点得到光顺曲线｜5.1.1｜★★
  - 5.1.3 曲率梳与曲率图 — 读出拐点和曲率突变｜5.1.1｜★★
  - 5.1.4 曲线连续性 G0 / G1 / G2 / G3 — 判断并构造指定的连续性｜5.1.3｜★★
  - 5.1.5 混接与匹配曲线（Blend / Match）— 把圆角矩形从 G1 改造成 G2｜5.1.4｜★★
- **M5.2 曲面构建**
  - 5.2.1 由曲线生成曲面（拉伸、旋转、放样、单轨/双轨扫掠、网格面、Patch）— 为形状选择合适的建面方法｜5.1.2｜★★
  - 5.2.2 曲面连续性与匹配（MatchSrf / BlendSrf；各命令能达到的连续性）— 让相邻曲面达到 G1/G2｜5.2.1、5.1.4｜★★
  - 5.2.3 修剪、分割、缝合与封闭（Trim / Split / Join / Knit / Cap）— 把曲面做成水密实体｜5.2.1｜★
  - 5.2.4 偏移与加厚 — 从外观面得到有壁厚的零件｜5.2.3｜★
- **M5.3 曲面质量分析**
  - 5.3.1 斑马纹与环境反射（Zebra / Highlight / Light tunnel）— 用斑马纹判断 G0/G1/G2｜5.2.2｜★★
  - 5.3.2 曲率分析（高斯曲率、平均曲率）与拔模分析 — 找出局部凹陷和无法脱模的区域｜5.3.1｜★★
  - 5.3.3 圆角（rolling-ball，G1）与曲率连续圆角或混接（G2）— 看见高光差异并做出选择｜5.3.1｜★★
- **M5.4 布面与 Class-A 入门**
  - 5.4.1 分面/布面（patch layout）：主面、过渡面、圆角面的层级 — 为产品规划面片结构｜5.2.x｜★★
  - 5.4.2 四边面、奇点与收敛点的处理 — 避免三角面和退化点｜5.4.1｜★★
  - 5.4.3 Bezier 与 NURBS、单跨度面与升阶 — 理解 Class-A 为什么偏好 Bezier｜5.1.1｜★
  - 5.4.4 Class-A 的概念与质量标准（G2/G3、公差、高光）— 知道 Class-A 的要求和适用行业｜5.4.1–5.4.3｜★
- **M5.5 自由形态**
  - 5.5.1 SubD、T-Splines、Fusion Form 推拉造型 — 快速做出有机形体｜0.3.1｜★★
  - 5.5.2 SubD 转 NURBS，回到工程流程 — 把自由形态交给工程｜5.5.1、5.2.3｜★
- **M5.6 从造型到工程**
  - 5.6.1 外观件拆件与结构化（分模线、装配关系）— 把一体的外观拆成可制造的零件｜5.2.4、M4.4｜★★
  - 5.6.2 造型件的 DFM 回检（拔模、壁厚、圆角）— 在不破坏造型的前提下满足注塑要求｜5.6.1｜★★

#### P 贯穿项目（Capstones）
- **P1** 3D 打印收纳盒或手机支架（makers 入门）｜T0、M1.1–1.3、M4.1｜★
- **P2** 钣金机箱或支架（硬件工程师）｜T1、M4.3、T3｜★★
- **P3** 手持小家电外壳：造型 → 抽壳 → 卡扣与螺丝柱 → 拔模检查（ID 与工程结合）｜T5、M4.4｜★★
- **P4** 简单机构：铰链盒、齿轮或连杆｜T2｜★★
- **P5** 参数化系列件（多尺寸配置）｜M1.5｜★
- **P6** 按图建模挑战：认证式判分，回填体积或质心｜M0.2、T1｜★

#### 人群入口路径
- **产品/工业设计师**：T0 → M5.1–5.3 → M1.1–1.3（精简版）→ M5.4–5.6 → M4.4 → P3
- **Makers**：T0 → M1.1–1.3 → M4.1 → M2.1 → P1 / P4
- **硬件工程师**：T0 → T1 全部 → T2 → T3 → M4.2–4.4 → P2 / P4
- **软件转硬件**：T0 → T1（重点是 1.3 依赖图与 TNP、1.5 参数化与可编程特征）→ M4.1 → T2 → T3 基础 → P1 / P5。可以拿编程概念做类比：特征树像程序，TNP 像不稳定的 ID，配置像参数化构建。这个类比是本研究者的推断，未经验证。

#### 3D 交互仿真最受益的课（★★ 汇总）与理由
- **自由度与约束**（1.1.2、1.1.3、2.1.2–2.1.4）：自由度看不见，只有能拖动、能计数，才会形成直觉。各家官方都把"完全定义"和"自由度/接地"写进入门考纲。
- **特征依赖与 TNP**（1.3.1–1.3.4）：因果链看不见；"删一个圆角，下游变红"可以安全地重放无数次。
- **正投影与剖视**（0.2.1–0.2.3）：纯空间推理，中国学习者还要处理第一角与第三角的切换。
- **曲率梳、连续性、斑马纹、高光**（M5.1、M5.3）：本质是视觉判断，必须实时操作控制点才能建立对应关系。
- **DFM 几何检查**（4.1.1、4.2.1、4.2.2、4.3.2、4.4.1–4.4.4、4.4.6）：规则都可以算出来并着色显示（壁厚、拔模角、悬垂、刀具可达），交互反馈远胜看视频。
- **钣金折弯与展开、机构运动**（4.3.x、2.2.x）：动态过程，动画加参数滑杆是最直接的表达。

### Gaps
- 本大纲是根据官方课程、认证和 DFM 资料推断出的提案，没有经过真实学习者验证。各轨学时只是参照认证学时的粗估。
- 概念与各软件命令的对照表、经典练习模型由其他调研员负责，本节没有展开。
- CAM、仿真（CAE）、渲染只作为可选外延，没有纳入主干：Fusion 和 Onshape 的官方路径把它们放在 fundamentals 之后的独立路径里。
- 手绘、比例、造型语言等非软件的 ID 基础，以及 Grasshopper 等参数化造型，没有纳入主干，是否需要由产品定位决定。
