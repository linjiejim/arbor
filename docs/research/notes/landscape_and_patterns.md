# 3D / CAD / 工业建模交互学习：产品版图、可借鉴的交互模式与市场缺口

> 调研截至 2026-11-04。标记约定：⚠️ = 已停运、下线、转型或状态有变；（推断）= 研究者根据引用材料做的判断，不是来源原话。本文按用户要求只看产品与 UX，不讨论渲染技术栈；课程体系、术语、学习科学由其他研究员负责。共覆盖 37 个产品或站点：问题一 15 个，问题二 8 个，问题三 7 类，问题四 8 个，问题五补充 AI 类。

## 问题一：哪些产品在交互式地教 CAD / 3D 建模？怎么教？

### Takeaway
主流 CAD 厂商的学习体系（Onshape Learning Center、Autodesk Learn、MySolidWorks、Shapr3D、SketchUp Campus）基本都是"短视频 + 在真实软件里跟着做 + 测验/证书"，而且都绑定自家工具。真正在浏览器里一步一步带着操作的，只有 Tinkercad Lessons 这类面向初学者的简化工具。练习类产品（Too Tall Toby、Model Mania）的做法是"看图纸建模，再提交质量"，用这个自动判对错。2025–2026 年各家新增的主要是 AI 问答助手，不是讲概念的内容。

### Cited Findings

#### 厂商学习中心
- **Onshape Learning Center**：课程免费、自定进度，形式是短视频后接练习。Learning Pathways 把 3–5 门课排成序列，完成后发 Certificate of Completion。路径包括 CAD Basics、Onshape Fundamentals、Simulation、FeatureScript，另有认证考试的模拟卷 — [Onshape Student Resources](https://www.onshape.com/en/education/student-resources)
- Onshape 自学课的练习可以核对答案；课程里提问会自动发邮件给讲师团队。这条来自约 4 年前的博客，现状可能已变 — [Onshape Blog: 5 Reasons to Visit the Learning Center](https://www.onshape.com/en/blog/5-reasons-to-to-visit-the-onshape-learning-center)
- "Introduction to Onshape Assemblies" 分 3 个模块，每个模块都有动手练习，其中一个是搭建气缸（pneumatic cylinder） — [Onshape Blog](https://www.onshape.com/en/blog/learning-center-course-introduction-onshape-assemblies)
- 有 HN 用户建议浏览 Onshape 的公开文档，看别人怎么建模，"像读源码学编程一样"；同帖还推荐 MIT 的 YouTube 系列 "How to CAD Almost Anything"，以及下载模型发动机的 2D 图纸照着建 — [HN: Ask HN best way to learn 3D modeling](https://news.ycombinator.com/item?id=44576765)
- **Autodesk Fusion / Autodesk Learn**：帮助站有按 workspace 分的分步教程，部分配样例模型 — [Fusion Tutorials](https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-TUTORIALS.htm)。"Self-paced learning for Fusion" 的路径由视频、分步教程和可下载模型组成，例如有 13 个教程的 Introduction to Fusion — [Autodesk Learn](https://www.autodesk.com/learn/ondemand/collection/self-paced-learning-for-fusion)
- "Learn Fusion for CAD in 90 minutes" 以设计一个自行车脚踏为项目，带测验、练习和挑战作业，最近按 intent-driven design 重新做过 — [Autodesk Learn](https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes)
- Fusion 内置 Autodesk Assistant，入口在应用栏右侧。面板有聊天框、已存提示、历史、starter prompts 和一个 quick tips 播放列表；官方列出的用途之一是学习 Fusion 的工具和工作流 — [Autodesk Blog: A Guide to Autodesk Assistant in Fusion（2026-07-15）](https://www.autodesk.com/products/fusion-360/blog/a-guide-to-autodesk-assistant-in-fusion/)；[Autodesk 支持文章](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-access-AI-Assistant-for-design-and-Manufacturing-in-Fusion.html)
- **SOLIDWORKS 内置教程**：路径是 Help → SOLIDWORKS Tutorials → Getting Started → Lesson 1: Parts，依次做 base feature、boss、cut、fillet、shell — [GoEngineer](https://www.goengineer.com/videos/getting-started-lesson-1-parts-solidworks-built-in-tutorials)。官方《Introducing SOLIDWORKS》说 Help 里有大量分步教程，并在入门课后引导去做 Lesson 1–3 — [Introducing SOLIDWORKS（PDF）](https://my.solidworks.com/solidworks/guide/SOLIDWORKS_Introduction_EN.pdf)
- **MySolidWorks**：2026-08-26 官方博客宣布，自 2026 年 7 月起 MySolidWorks 全部 400+ 课程和 learning paths 免费，需要 3DEXPERIENCE ID。内容覆盖 CSWA/CSWP 备考，以及设计、仿真、钣金、焊件、工程图等。学生版 SOLIDWORKS Design Standard 也从 2026-07-01 起免费 — [SOLIDWORKS Blog](https://blogs.solidworks.com/products/solidworks/advance-your-skills-anytime-anywhere-mysolidworks-training-resources-are-now-free/)
- ⚠️ MySolidWorks Professional 已停止购买和续费，2027-03-01 起无法访问，eCourses 随之退役 — [GoEngineer](https://www.goengineer.com/blog/mysolidworks-professional-activation)。eCourses 是把讲师培训手册改编成的自学课程，当年 Professional 约 $360/年/人（旧的经销商页面） — [Javelin](https://www.javelin-tech.com/3d/people/mysolidworks/)
- **Shapr3D**：首次登录时要求选设备，并完成约 6 分钟的入门教程 — [Shapr3D Help](https://support.shapr3d.com/hc/en-us/articles/7873721622428-Create-a-Shapr3D-account)。约 2022 年初，员工在论坛解释教程为什么不能跳过：A/B 测试显示，它能明显提高新用户的采用率，改成可跳过后采用率明显下降；但有经验的用户对此不满 — [Shapr3D Community](https://discourse.shapr3d.com/t/skipping-intro-tutorial/17130?page=2)
- 据用户描述，Shapr3D 多数工具内嵌了短视频教程 — [Shapr3D Community](https://discourse.shapr3d.com/t/new-to-it-all-tutorials/38042)。"Shapr3D Basics" 系列由机械工程师 Matt Lombard 主讲，用摩托车零件做练习，内容覆盖草图、建模、可视化、出图和 Design History — [Shapr3D Help](https://support.shapr3d.com/hc/en-us/articles/13079041629852-Introducing-Shapr3D-Basics)
- Shapr3D 的 History-Based Parametric Modeling 于 2024-04 随 5.590 正式发布 — [Shapr3D Release Notes](https://discourse.shapr3d.com/t/5-590-history-based-parametric-modeling-is-here/31108)；2026-10 又推出 Parameter Cards — [Shapr3D Community](https://discourse.shapr3d.com/t/parameter-cards-why-we-built-them-how-we-re-rolling-them-out-and-what-s-next/42292)
- **Plasticity**：官方手册 doc.plasticity.xyz 自称每天更新，主体是全部命令和快捷键（含 2026.1 的 PDF）、Essentials 和 Blender 集成 — [Plasticity Manual](https://doc.plasticity.xyz/)。第三方评价：学习曲线比 Fusion、SOLIDWORKS 平缓，但没有参数化历史，改不了五步之前的尺寸，也没有仿真和 CAM — [Jawstec](https://www.jawstec.com/plasticity-cad-is-it-worth-learning/)。学习资源主要靠社区视频和付费课 — [awesome-plasticity](https://github.com/ThunderCatXp/awesome-plasticity)；[Blender Bros](https://www.blenderbros.com/plasticity)
- **SketchUp Campus**：官网称它是免费自定进度培训课程的起点 — [SketchUp](https://sketchup.trimble.com/en)。形式是自定进度的视频模块，难度从 Beginner 到 Intermediate；约 3.6 年前的课程表包括 Fundamentals（Desktop/Web/Modeling Practice）、LayOut、Scan Essentials、Landscape、V-Ray for Interiors 等 — [educandi](https://educandi.co.uk/News_Training_Support/news/sketchup_campus_free_training)
- SketchUp 认证：早期 Campus 只发完成证书，没有考核（约 2.7 年前的论坛帖） — [SketchUp Forum](https://forums.sketchup.com/t/official-sketchup-certification/261037)。现在 Trimble Certification Platform 分 Participation、Basic、Intermediate、Advanced 四级 — [SketchUp Help](https://help.sketchup.com/en/sketchup-education/available-certification-levels)。帮助中心把课程列在 Trimble Learn 名下，但是否已迁移或更名没有得到证实 — [SketchUp Help Center](https://help.sketchup.com/en)

#### 浏览器 / 轻量建模工具
- **Tinkercad Lessons**："Learn the Moves" 是编辑器内的引导式分步教程，共 10 节：Place It、View It、Move It、Rotate It、Size It、Group It、Copy It、Duplicate It、Hide It、Align It，需要登录才能开始 — [Tinkercad](https://www.tinkercad.com/learn/overview/OPC41AJJKIKDWDV)
- Tinkercad 课程的交互形态：说明写在左侧面板，学生在主编辑区照着做 — [Westchester Libraries 讲义（2018）](https://it.westchesterlibraries.org/wp-content/uploads/2018/04/Getting-Started-with-Tinkercad1.pdf)；[MiTechKids 教案](https://remc.org/mitechkids/4th-grade/tinkercad/)。Circuits 课程同样用左侧边栏给任务说明 — [Tinkercad Official Guide to Circuits](https://www.tinkercad.com/blog/official-guide-to-tinkercad-circuits)
- **Womp**：浏览器端工具，面向从没用过 3D 的设计师，用"数字黏土"的方式塑形，而不是编辑多边形。有免费档和 $12/月的 Pro，没有桌面版和离线模式；能力比多边形建模弱 — [Hack Design](https://www.hackdesign.org/toolkit/womp/)。教程主要是 YouTube 和第三方，例如 School of Motion 带工程文件的饭团角色项目 — [School of Motion](https://schoolofmotion.com/blog/3d-womp-tutorial)。一位零基础作者说它比 Blender 容易得多 — [Creative Bloq](https://www.creativebloq.com/3d/i-never-thought-i-could-learn-to-3d-model-in-a-week-but-i-was-wrong)
- ⚠️ Womp 转型：约 2025-11 上线 AI 平台，可从文本或图片生成 3D 并直接下单打印 — [3D Printing Industry](https://3dprintingindustry.com/news/womp-launches-ai-platform-for-accessible-3d-model-creation-and-printing-245898/)；2026 年这套 AI 工具改名 "Spark" — [Womp Blog](https://womp.com/blog-1/?undefined=2)
- **Spline**：Spline Academy 提供免费视频教程和课程，其中 Spline 101 共 16 课、约 4 小时；近期教程转向 AI（ChatGPT 插件、MCP） — [Spline Academy](https://academy.spline.design/)；[Spline Tutorials](https://spline.design/academy/tutorials)。启动页会展示示例库和社区作品，可以打开来学 — [Envato Tuts+](https://photography.tutsplus.com/spline-tutorial-for-beginners--ytc-80c)。社区作品可以 remix，被推荐为拆解学习的方法 — [Substack 学习路线](https://splinetime3d.substack.com/p/how-to-learn-3d-using-spline-tool)
- **Zoo Design Studio**（⚠️ 原 KittyCAD Modeling App）：KittyCAD 已更名 Zoo。GitHub 仓库 KittyCAD/modeling-app 现在标注为 Zoo Design Studio app（MIT 许可），text-to-cad-ui 仓库已归档 — [GitHub KittyCAD](https://github.com/kittycad)
- Zoo v1 的应用层开源，引擎闭源。模型全程保持 B-rep，所以可以点选边做倒圆、在代码里改尺寸，或者对同一个模型重新给提示。免费档每月 20 个 Text-to-CAD credits — [Zoo Blog: Design Studio v1](https://zoo.dev/blog/zoo-design-studio-v1)。无论是 GUI、Text-to-CAD 还是 Zookeeper 代理，所有操作最终都写成 KCL 代码 — [cadalts](https://cadalts.com/tools/zoo/)。第三方评测说它做单个零件比做复杂装配好；免费额度的说法也不一致（40 分钟 vs 20 credits） — [3druck](https://3druck.com/en/programs/free-ki-cad-tool-zoo-design-studio-combines-parametric-modeling-with-text-prompts-10148496/)

#### 练习、竞赛与社区
- **Too Tall Toby**：有 250+ 道 CAD 挑战，给 2D 图纸，用任意 CAD 建成 3D。挑战页有 Toby 用 FreeCAD、Onshape、Fusion、SOLIDWORKS 录的讲解视频，以及速度排行榜（名次、国家、CAD 系统、用时） — [TTT 示例页](https://www.tootalltoby.com/practice/sample/)
- TTT 的判题方式：提交的质量落在图纸标注的容差内就算正确。因为只验质量，存在把特征放错位置、质量却对的 "Ivan Exploit" — [TTT 赛事规则](https://tootalltoby.com/tournaments/2025/world_championship/tournament_rules/)；[TTT Challenge Rules](https://www.tootalltoby.com/challenge/rules/90bf512b-d7df-43de-84c9-8f4f2bcc5066)。付费的 PDF Party Pack 带答案，按 TIER 1/2/3 分难度 — [TTT Thinkific](https://tootalltoby.thinkific.com/)。build123d 的文档把 TTT 的题目改写成代码 CAD 教程，脚本最后打印质量 — [build123d](https://build123d.readthedocs.io/en/stable/tttt.html)
- **SOLIDWORKS Model Mania**：2026 年赛制是先给 2 分钟预览、规划思路，然后 Phase 1 建模、赋材料、提交质量；Phase 2 给出变更，再修改并提交新质量。2026-01-21 的直播在约 20 分钟内收到约 175 份提交 — [SOLIDWORKS Blog: Model Mania 2026](https://blogs.solidworks.com/products/solidworks/model-mania-2026-overview-solution-and-winners/)。变更用红色修订云标出，其余尺寸不变 — [Model Mania 2024 图纸 PDF](https://blog-assets.solidworks.com/uploads/2025/02/model-mania-2024.pdf)。经销商建议进入 Phase 2 前先花几秒看图规划改法，因为这通常是最难的部分 — [TriMech](https://trimech.com/model-mania-modeling-contest-for-engineers/)
- **GrabCAD Tutorials**：用户自己写的分步教程，可按类别、软件、难度筛选，每篇拆成编号步骤 — [GrabCAD Help](https://help.grabcad.com/article/128-where-can-you-find-tutorials?locale=en)；[GrabCAD Tutorials](https://grabcad.com/tutorials)。很多篇只是一个 YouTube 外链，有的把读者引到 Gumroad 付费内容 — [GrabCAD 示例](https://grabcad.com/tutorials/beginner-s-guide-to-solidworks-learn-3d-cad-modeling-step-by-step)

#### 通用交互学习
- **Brilliant**：没有视频，课程由交互谜题、可视化模拟和引导式解题组成，每次约 15 分钟，有即时的定制反馈。AI 导师 Koji 能看到学习者当前所在的课和题 — [Brilliant FAQ](https://brilliant.org/faq/)；[Headway 评测](https://makeheadway.com/blog/brilliant-review/)。官方宣传的 "6x more effective" 找不到出处 — [同上](https://makeheadway.com/blog/brilliant-review/)。一篇 2026 年第三方评测称，学习设计师负责定目标和题型，AI 负责生成谜题素材和变式 — [Vantaige](https://vantaige.io/ai-tool/brilliant)

### Inferences

**问题一产品评估表**（"做得好 / 做得差"是根据上面引用材料做的判断）

| # | 产品 | 类型 | 做得好 | 做得差 / 局限 | 状态 |
|---|---|---|---|---|---|
| 1 | Onshape Learning Center | 厂商学习中心 | 免费；短视频后接练习，可核对答案；路径加证书；AI Advisor 能把人引到资源 | 绑定 Onshape；交互发生在 CAD 里，课程页本身以视频为主；AI 看不到模型 | 活跃 |
| 2 | Autodesk Learn / Fusion | 厂商 | 项目制（90 分钟做脚踏），带测验和挑战；提供样例模型 | 绑定 Fusion；没找到软件内的引导式教程面板 | 活跃 |
| 3 | SOLIDWORKS Tutorials + MySolidWorks | 厂商 | 软件内经典的 Lesson 1–3；2026-07 起 400+ 课全部免费 | 需要 3DEXPERIENCE ID；以操作为主 | ⚠️ Professional 和 eCourses 于 2027-03-01 下线 |
| 4 | Tinkercad Lessons | 浏览器入门 | 编辑器内"左栏说明 + 主区实操"，真正做到边学边做 | 只教放置、移动、对齐这类基本操作，离参数化工业建模很远 | 活跃 |
| 5 | Shapr3D | 厂商 | 强制入门实操（A/B 测试证明有效）；工具内嵌短视频 | 有经验的用户反感强制；资料散在帮助中心和 YouTube | 活跃 |
| 6 | Plasticity | 厂商 | 手册每天更新，快捷键全表 | 没有引导式路径；没有参数化历史，学不到设计意图 | 活跃 |
| 7 | SketchUp Campus | 厂商 | 免费自学视频；新的分级认证 | 早期证书不考核；平台归属不清楚 | 活跃（归属待核实） |
| 8 | Womp | 浏览器建模 | 门槛极低的"数字黏土" | 不是工程精度；教程靠 YouTube | ⚠️ 转向 AI 生成加打印 |
| 9 | Spline | 浏览器 3D 设计 | Academy 课程结构化；示例和社区可 remix | 面向网页交互设计，不是工业建模（推断） | 活跃 |
| 10 | Zoo Design Studio | 代码 + GUI 的 CAD | 每个操作都落成可读、可改的 KCL；AI 生成的是可编辑特征树 | 不是教学产品；复杂装配表现弱 | ⚠️ 由 KittyCAD 更名 |
| 11 | Too Tall Toby | 练习 / 竞赛 | 不限工具；质量自动校验；排行榜和直播带来游戏化 | 只验质量（Ivan Exploit）；讲解靠视频；英文 | 活跃 |
| 12 | Model Mania | 竞赛 | Phase 2 变更单考的是设计意图和改模能力 | 只能用 SOLIDWORKS / xDesign；一年一次 | 活跃 |
| 13 | GrabCAD Tutorials | UGC 教程 | 量大，可按软件和难度筛选 | 质量参差；大量外链和付费导流 | 活跃 |
| 14 | Brilliant | 通用交互课 | 没有视频、课短、即时反馈、AI 导师了解上下文 | 没查到 CAD 课程（未核实） | 活跃 |
| 15 | Adam（详见问题五） | AI CAD | 每个尺寸一个滑块，改了立刻看到 | 已转向专业 copilot | ⚠️ 转型 |

- （推断）这个赛道最拥挤的区域是"工具操作 + 视频 + 绑定单一软件"。厂商课程教的是"在 X 软件里点哪里"，用户换一个软件就要从头学。Too Tall Toby 用四种 CAD 各录一遍讲解视频，侧面说明学习者对"工具无关"有需求。
- （推断）Shapr3D 的 A/B 结果说明，让人在头几分钟真正动手，对留存有效。概念站点应该在第一屏就给一个能拖动的 3D 操作，而不是先放一段视频。
- （推断）"提交质量"是成本最低的自动判题方式，但只能验结果，验不了思路（Ivan Exploit 就是例子）。Model Mania 的 Phase 2 变更单正好补上"模型好不好改"这个维度，可以借来设计"改一个上游尺寸，看模型崩不崩"的练习。
- （推断）Brilliant 的结构（没有视频、短课、每屏都要动手、即时反馈、AI 导师了解上下文）是"概念优先交互课"最接近的现成模板。Zoo 的"GUI ↔ 代码"双表示说明，"一个操作 = 一段可读的参数化描述"可以作为教学对象直接展示给学习者。

### Gaps
- 没找到 Fusion 软件内引导式交互教程（类似 Tinkercad 左栏）的证据，搜到的都是网页版教程。
- Tinkercad 课程是否会自动判定步骤完成，现有来源没有说明。
- 没确认 Onshape Learning Center 练习"核对答案"的具体机制（例如是否按质量或体积判定），来源是较早的博客。
- 没核实 Brilliant 是否有 CAD 或工程制图课程。
- SketchUp Campus 的当前课程表、是否已并入 Trimble Learn，都没有拿到一手页面。

## 问题二：哪些 explorable explanations 树立了交互式 3D / 机械教学的标杆？它们为什么有效？

### Takeaway
标杆作品都有几个共同点：一张图只讲一个概念、一次只改一个变量；颜色语义全文固定；控件（滑块、可拖的点、播放/暂停）就嵌在图里；复杂度从单个部件开始逐步叠加。Bartosz Ciechanowski 是机械和曲面方向的最高标杆，但他的作品是一个人手写的，产出很慢，而且读屏软件读不了。Distill 因编辑团队倦怠停刊，说明这类内容的生产成本才是最大风险。

### Cited Findings
- **Bartosz Ciechanowski**：网站定位是科学与工程主题的交互文章，靠 Patreon 资助 — [ciechanow.ski](https://ciechanow.ski/)
- 以 Gears 一文为例（直接抓取了原文）：
  - 控件以滑块为主，分别控制转速、半径比、压力角、径节等；每个动画图左下角有播放/暂停，正文里还有全局暂停和恢复的链接 — [Gears](https://ciechanow.ski/gears/)
  - 每个新概念单独配一张图，通常只改一个变量。图用"下方演示中你可以控制……"一类的句子引出，用"注意……"提示看哪里，还借扳手、门铰链、风扇这些日常经验做参照 — [Gears](https://ciechanow.ski/gears/)
  - 颜色语义全文一致：主动件黄、从动件绿、惰轮蓝，红色表示力的切向分量或接触点，黑色表示节点，灰色表示外力；箭头表示速度，轨迹线表示点的路径，虚线是法线、实线是切线 — [Gears](https://ciechanow.ski/gears/)
  - 递进顺序：转动 → 圆盘上的线速度 → 摩擦轮传动 → 扭矩 → 齿轮 → 切线、法线与啮合定律 → 用绳子展开渐开线 → 多级齿轮与卡死 — [Gears](https://ciechanow.ski/gears/)
- **Curves and Surfaces**（据搜索摘要，原文没能抓取）：从"怎样控制形状"讲起，依次讲控制点、4×4 控制点的曲面片、更大的控制网格、移动节点让曲面延伸到控制网格边缘。用两个滑块（球的位置、两曲面曲率的匹配程度）在反光表面上展示光顺性。最后推出 NURBS，并指出它的局限，例如很难开孔 — [Curves and Surfaces](https://ciechanow.ski/curves-and-surfaces/)。做 NURBS 软件的 CAESES 公开称赞文中的交互示例 — [LinkedIn: FRIENDSHIP SYSTEMS](https://www.linkedin.com/posts/friendship-systems-ag_curves-and-surfaces-bartosz-ciechanowski-activity-6955165356235579392-jRTP)
- **Moon**：开篇就是一个沙盒，可以拖动行星改变位置，拖速度箭头的末端改初速度 — [daily.dev](https://daily.dev/posts/moon-bartosz-ciechanowski-fuppibs82)
- **Mechanical Watch**：零件用 Shapr3D 建模，动画在 JS 里手工编写，齿轮程序生成；全程用裸 WebGL，不用框架 — [Unpolished Watches](https://www.unpolishedwatches.com/p/this-is-the-coolest-explainer-on)；[HN: Mechanical Watch](https://news.ycombinator.com/item?id=31261533)。Internal Combustion Engine 一文同样以高度交互著称 — [CSS-Tricks](https://css-tricks.com/bartosz-ciechanowskis-interactive-blog-posts/)
- HN 上的评价：Bartosz 真正的贡献在写代码之前，即知道该把什么可视化，以及怎样让交互 "teach something rather than just look impressive" — [HN](https://news.ycombinator.com/item?id=49427375)。有读者形容他的节奏是每隔几段加一个新部件，看着整个系统逐步搭起来 — [HN](https://news.ycombinator.com/item?id=27018860)
- 对 Bartosz 的批评：他的可视化读屏软件读不了；也有人担心大量快速生成的 AI 解释页会挤占优秀作品的注意力 — [HN: Sound (2022) 2026 年重发帖](https://news.ycombinator.com/item?id=50045147)
- **Pomax《A Primer on Bézier Curves》**：几乎所有图都可以交互，拖动控制点就能看到曲线变化。曲线拟合一节可以自己放点，放到 3 个以上开始计算拟合；B-spline 一节点一下就能加点 — [A Primer on Bézier Curves](https://pomax.github.io/bezierinfo/)
- Pomax 自研了 `<graphics-element>`：作者只要声明哪些点可拖，不必写鼠标和触摸代码；同一份源码在 Node 端渲染出首帧作为占位图，没有 JS 也能看 — [The graphics-element](https://pomax.github.io/custom-graphics-element/)；[2020 重写说明](https://pomax.github.io/bezierinfo/news/2020-09-18.html)
- **Animagraffs**（Jacob O'Neal 一人工作室）：每个主题先深度研究专利、工程论坛和技术手册，一个 3D 模型往往要做一个月以上；用 Blender 建模，Adobe 排版并导出 GIF 和视频 — [Technical Illustrators 访谈](https://technicalillustrators.org/2019/08/animagraffs-by-jacob-oneal/)。2013 年的汽车发动机作品爆红，到 2019 年仍是 "How a car engine works" 的搜索第一；它的交互 3D 版是用 Blend4Web 导出到浏览器的 — [jacoboneal.com](https://jacoboneal.com/car-engine-animagraffs)；[Technical Illustrators](https://technicalillustrators.org/2019/08/animagraffs-by-jacob-oneal/)
- **Red Blob Games**（Amit Patel）：定位是"用交互图解释算法"。他 2004 年开始试验，到 2007 年才找到现在的风格；站内有 making-of 页面，讲怎样做交互教程、多图联动和拖放 — [Red Blob Games](https://www.redblobgames.com/index.bxml)。Patel 说自己学得最好的方式是把语言（阅读、公式）和视觉（插图、交互）结合起来，而且要上手"玩" — [Amit Patel 主页](http://www-cs-students.stanford.edu/~amitp/)。第三方描述：几乎每页都有可以拖动起点和终点、让算法重新运行的图 — [altftool](https://www.altftool.com/rabbithole/site/red-blob-games)
- **Bret Victor**：2011 年提出 Explorable Explanations。核心主张是读者应该成为主动读者，这需要 reactive documents，即在文字和图里嵌入可以操作的小把手，让读者改动作者的假设、看到后果；explorable example 则把抽象变具体、帮读者建立直觉 — [UTS 博客](https://educationexpress.uts.edu.au/blog/2018/09/12/all-about-explorable-explanations/)；[Maarten Lambrechts](https://www.maartenlambrechts.com/2015/03/04/the-rise-of-explorable-explanations.html)。同年发布 Tangle JS 库，正文里的数字可以用鼠标拖动，相关数值跟着更新 — [Bret Victor 推文](https://x.com/worrydream/status/80736229234188288)；[bjoernkw](https://bjoernkw.com/2016/09/25/explorable-explanations-and-a-reactive-document-ide/)
- **Nicky Case**：主张不要什么都做成交互。文字适合抽象概念，图表适合一眼看清关系，动画适合随时间变化的东西，交互适合过程、系统和模型 — [Nicky Case: Explorable Explanations (2014)](https://blog.ncase.me/explorable-explanations/)。他总结的设计模式包括 "Puzzle It Out"（证明理解了才能往下走，把教和测合在一起）和 "Place Your Bets!" — [4 More Design Patterns](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/)。"How I Make Explorable Explanations" 的要点（来自二手总结）：用一个引起好奇的问题做钩子；选一个能承载后面所有内容的核心体验；先不给解释（cognitive gate）；结尾留一个问题 — [Patreon](https://www.patreon.com/ncase/posts/how-i-make-14469469)；[Stefy Bolaños 总结](https://stefy.substack.com/p/explorable-explanations)
- **The Pudding**：很多作品靠滚动到某个位置时触发视觉变化，最适合"一张图随滚动变化"的情况；小选题改用更简单的分步格式 — [The Pudding: Making Internet Things, part 3](https://pudding.cool/process/how-to-make-dope-shit-part-3/)。常见结构是先用 scrollytelling 一步步讲主要发现，再把全部数据交给读者自己探索 — [Online Journalism Awards](https://awards.journalists.org/entries/the-pudding/)。右侧视觉面板固定不动，文字从旁边滚过，最后一节展开完整的交互工具 — [scrollytell.ing 案例](https://scrollytell.ing/the-pudding-series-the-naked-truth/)
- ⚠️ **Distill**：2021-07-02 起无限期停刊。原因包括志愿编辑团队倦怠，以及编辑自己写文章和期刊身份之间的矛盾 — [Distill Hiatus](https://distill.pub/2021/distill-hiatus/)。2025 年 Topos Institute 的博文说至今没有继任者 — [Topos Institute](https://topos.institute/blog/2025-04-04-scalable-distillations-for-research/)

### Inferences

**问题二评估表**

| # | 作品 / 站点 | 做得好 | 做得差 / 局限 |
|---|---|---|---|
| 16 | Bartosz Ciechanowski（Gears、Watch、Engine、Curves & Surfaces、Moon 等） | 一图一概念、一次一个变量；颜色语义固定；每张图自带控件；从单个部件逐步搭起来 | 一个人手写 WebGL，产出慢；读屏软件读不了；英文；不讲 CAD 建模操作 |
| 17 | Pomax Bézier Primer | 几乎每张图可拖；声明式的可拖点；没有 JS 也能看首帧 | 2D 数学为主；视觉朴素 |
| 18 | Animagraffs | 研究扎实；剖切 3D 动画加长页标注 | 主体是 GIF 和视频，可交互的少；一个模型要一个月以上 |
| 19 | Red Blob Games | 交互图驱动；先直觉后符号；公开 making-of | 领域是游戏算法，以 2D 为主 |
| 20 | Bret Victor / Tangle | reactive documents 理念；正文里的数字可拖 | 偏理念和原型，不是持续运营的产品 |
| 21 | Nicky Case / explorabl.es | "只在合适的地方交互"；Puzzle 和 Bets 两种检验模式 | 主题偏社会系统 |
| 22 | The Pudding | 固定图加滚动分步，最后放开自由探索 | 数据新闻，不涉及 3D |
| 23 | Distill | 交互式论文的范式；模板开源 | ⚠️ 2021 年起停刊 |

- 用户点名的六个机制分别对应以下证据（推断）：
  - **One concept per figure 和 progressive disclosure**：Gears 每个新概念配一张图，按"转动 → 传动 → 扭矩 → 齿轮 → 渐开线 → 轮系"逐层叠加，HN 读者也描述了"每隔几段加一个部件"的节奏。这是证据最强的两条。
  - **Consistent visual language**：Gears 全文颜色固定（主动件黄、从动件绿、惰轮蓝等）。iFixit 也要求文字要点的颜色和图上标注的颜色一致（见问题三）。颜色固定以后，读者的注意力会放在变化的东西上。
  - **Inline sliders / 直接操作**：Bartosz 的滑块、Pomax 的可拖控制点、Tangle 的可拖数字是一个谱系，都是把参数放在离结果最近的地方。
  - **Scroll-linked state**：主要出现在 The Pudding 和 Apple 产品页。从抓取到的 Gears 文本看，Bartosz 用的是图内控件和播放键，没有滚动驱动。这说明有两种范式：滚动驱动叙事线性、门槛低；图内控件更适合探索。工业建模站可以把两者分层用：主线用滚动推进步骤，每一步内部用控件探索。
  - **Small multiples**：在这些作品里没有找到直接例证，见下方 Gaps。
- （推断）对工业建模站来说，Bartosz 已经覆盖了"机构是怎么工作的"（齿轮、手表、发动机）和"曲面是怎么数学定义的"（Curves and Surfaces），但没有覆盖"建模操作"本身（拉伸、旋转、扫掠、放样、抽壳、圆角、拔模、布尔），也没有覆盖"特征树和设计意图"。这正是可以接着做的空位。
- （推断）生产成本是这类内容最大的风险：Bartosz 单人手写，Animagraffs 一个模型要一个多月，Distill 停刊。一个中文站要持续更新，必须像 Pomax 的 graphics-element 那样，先建一套可复用的"操作模拟组件"，让作者只声明参数和步骤，而不是每篇都从零写交互。
- （推断）可访问性和降级可以做成差异点：Pomax 有无 JS 的首帧，Bartosz 被批评读屏读不了。中文站可以给每个交互图配静态关键帧和文字描述。

### Gaps
- ciechanow.ski 除 Gears 外的页面（Internal Combustion Engine、Mechanical Watch、Bicycle、Curves and Surfaces）抓取工具访问不到。这些文章的 3D 视图能否拖动旋转、是否用剖切或半透明展示内部、是否有滚动驱动，都没能逐一核实；Bicycle 一文没有任何资料。
- worrydream.com 和 redblobgames.com 的原文也抓不到，Bret Victor 和 Amit Patel 的原则来自二手来源。Nicky Case 的 "How I Make" 原文没有读到。
- 没找到 "small multiples" 在这些作品里的具体例证。
- Animagraffs 当前的交互 3D 程度（2013 年的 Blend4Web 版之后）没有核实。

## 问题三：Web 与 CAD 中有哪些爆炸视图与分步重建模式？交互机制细节如何？

### Takeaway
CAD 软件里早就有一整套"分步重建"的基本手段：回滚条、时间轴回放、单步前后混合预览、Final 下游预览、分步爆炸、BOM 交叉高亮。但它们都是给会用这款工具的人编辑模型用的，不是用来讲解的：不说明每一步为什么这样做，后续特征只是被抑制，不会半透明预示。LEGO Builder 和 BILT 已经把"分步 + 可旋转 3D + 本步零件高亮 + 进度 + 重播 + 语音"做得很成熟，是"逐特征重建"最直接的交互样板。Apple 式滚动驱动的爆炸图吸引力强，但不能交互、资源很重，还被批评劫持滚动。

### Cited Findings

#### CAD 内的历史 / 回滚机制
- **Onshape rollback bar**：Feature list 里那条粗横条就是回滚条，拖动后模型只显示到它所在的位置，下面的特征被临时抑制。也可以右键用 Roll to here / Roll to end；选中横条后按 ↑↓ 键逐步前进或后退；移动端先点 Reorder 再拖 — [Onshape Help: Feature and Part Lists](https://cad.onshape.com/help/Content/feature_list.htm)；[Tech Tip: Roll to Here](https://www.onshape.com/en/resource-center/tech-tips/tech-tip-roll-to-here-roll-to-end)。回滚是按特征顺序走的，按时间回溯是另外的 Versions and History 和 Undo History — [Onshape Tech Tip](https://www.onshape.com/en/resource-center/tech-tips/tech-tip-how-undo-history-makes-continuous-drag-to-trim-even-more-powerful-in-onshape)
- **Onshape Preview slider**：特征对话框底部有个滑块，0% 是加特征前，100% 是加特征后，默认停在 70%，把前后两种状态叠在一起显示 — [Onshape Help: Dialogs](https://cad.onshape.com/help/Content/Home/dialogs.htm)
- **Onshape Final 按钮**：编辑早期特征时，Onshape 默认把模型回滚到该特征创建时的样子；按 Final 会显示所有后续特征重算后的最终结果。编辑的是最后一个特征时没有这个按钮 — [Onshape Help: Dialogs](https://cad.onshape.com/help/Content/Home/dialogs.htm)；[Tech Tip: Final Button](https://www.onshape.com/en/resource-center/tech-tips/tech-tip-how-to-use-onshapes-final-button)
- **Onshape 布尔类型与颜色**：Extrude 要显式选择结果类型 New、Add、Remove 或 Intersect — [Onshape Help: Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm)。中度红色（#bd3039）表示出错的几何和干涉，鲜黄色（#ffc107）表示选中；新建的零件按预设调色板轮流着色 — [Onshape Help: Colors](https://cad.onshape.com/help/Content/Home/colors.htm)
- **SOLIDWORKS rollback bar**：FeatureManager 设计树底部的蓝色横线。拖到要回滚的特征上方后，被回滚的特征图标变灰；回滚状态下仍可新增和编辑特征，也可以停在任意位置保存；右键有 Roll Forward、Roll to Previous、Roll to End — [SOLIDWORKS Help 2023](https://help.solidworks.com/2023/english/SolidWorks/sldworks/c_rollback_bar.htm)；[Using the Rollback Bar](https://help.solidworks.com/2017/english/solidworks/sldworks/t_reverting_a_part_to_an_earlier_state.htm)；[Hawk Ridge](https://hawkridgesys.com/blog/solidworks-rollback-bar-just-price-cutter)
- **Fusion Timeline**：时间轴左侧有 Play（自动逐个特征往前走）、Move to Beginning/End 和 Previous/Next Step；拖动 history marker 就是回滚，右键可选 Roll History Marker Here — [Fusion Help: Timeline](https://help.autodesk.com/view/fusion360/ENU/?guid=ASM-USE-TIMELINE)；[Product Design Online](https://productdesignonline.com/tips-and-tricks/8-fusion-360-timeline-tips-you-must-know/)。已知问题：时间轴比屏幕宽时，marker 常常"消失" — [Autodesk 论坛](https://forums.autodesk.com/t5/fusion-support-forum/design-history-timeline-marker-is-toast/td-p/8724785)

#### CAD 内的爆炸与装配动画
- **Onshape Exploded Views**：在装配右侧面板点 Add exploded view，选中零件后沿三轴操纵器拖到爆炸位置。每个爆炸视图由多步组成，步骤可以重排，可以改平移距离或旋转角度，也可以增删零件；拖动爆炸树里的回滚条就能分阶段查看 — [Onshape Help: Exploded Views](https://cad.onshape.com/help/Content/Assembly/exploded_views.htm)；[Tech Tip: How to Make Exploded Views](https://www.onshape.com/en/resource-center/tech-tips/creating-exploded-views-cloud-native-cad)
- ⚠️ 2018 年 Onshape 论坛的回复说，爆炸视图不能做成动画，最接近的办法是拖回滚条，这个说法可能已过时 — [Onshape Forum](https://forum.onshape.com/discussion/8892/regarding-animation-video-and-exploded-view)
- **Fusion Animation workspace**：先新建 Storyboard（选 Clean 类型会把零件复位）。Transform 菜单里有 Auto Explode: One Level 和 All Levels；Manual Explode 会弹出迷你工具栏和操纵器；另有 Transform Components、Restore Home、Show/Hide。移动时可以打开 Trail Line 显示路径，空格键播放/暂停 — [Autodesk Help: Explode the assembly](https://help.autodesk.com/cloudhelp/ENU/Fusion-Animate/files/GUID-CCBE4164-214A-4931-B7FB-DA4DC1F3B40B.htm)；[Fusion Blog](https://www.autodesk.com/products/fusion-360/blog/animate-design-fusion-360-tutorial/)。Auto Explode 默认所有零件同时炸开，能力有限，建议先自动炸开再手动细调 — [All3DP](https://all3dp.com/2/fusion-360-animation-simply-explained/)

#### 装配说明类应用
- **LEGO Builder**（原名 LEGO Building Instructions）：3D Building Mode 可以缩放、旋转模型，并一步步指导搭建。扫说明书上的二维码或搜索套装即可打开；Build Together 把步骤分给多台设备；会记住搭到哪一步 — [LEGO Help](https://www.lego.com/en-us/service/help-topics/article/lego-builder-app-3d-building-instructions)；[LEGO Builder app](https://www.lego.com/en-us/builder-app)。第三方描述说它有步骤进度滑条，还会高亮本步需要的积木，标出数量和位置 — [mwm.ai](https://mwm.ai/apps/lego-builder-3d-instructions/1486159728)。并不是所有套装都有 3D 指引 — [affordablebricks](https://affordablebricks.us/blogs/blog-posts/lego-instructions-guide)
- **BILT**：每一步是一段交互 3D 动画，可以捏合缩放、滑动旋转，点零件看详情；可选语音旁白和文字；随时跳过、返回或重播，也能下载后离线用 — [App Store](https://apps.apple.com/us/app/bilt/id879452214)。每个项目开始前先给一个概览：所需时间、工具、零件、步数和人数。品牌方愿意提供 3D 说明，是因为用户满意度更高、退货更少；BILT 还做技工和医疗培训 — [APKMirror 版本说明](https://www.apkmirror.com/apk/bilt-inc/bilt-intelligent-instructions/bilt-intelligent-instructions-5-8-1-release/)

#### 网页上的爆炸视图、拆解与产品页
- **Apple 产品页**：把预渲染的图片序列画到 canvas 上，帧号和滚动位置绑定，往下滚正放，往上滚倒放 — [CSS-Tricks](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/)。有人观察到，文案出现时序列会停住 — [GSAP 论坛](https://gsap.com/community/forums/topic/25188-airpods-image-sequence-animation-using-scrolltrigger/)。代价是资源很重：AirPods Pro 韩国页有 1,500 多张图，超过 60MiB — [CodePen](https://codepen.io/charliezstong-pro/pen/YzPrdXV)。John Gruber 批评它是 scrolljacking，CPU 占用高、动画卡顿 — [Daring Fireball](https://daringfireball.net/linked/2019/10/28/airpods-pro-scrolljacking-hell)。另一种常见版式是 sticky-scroll：右侧视觉固定，左侧几段文案滚过 — [Substack](https://tensorboyofficial.substack.com/p/agencies-charge-5000-for-this-animation)
- **iFixit teardown**：先有一段视频概览，然后是编号步骤，每步若干张图加要点。指南要求文字要点的颜色和图上标注的颜色一一对应；teardown 不是拆机指南，可以跳步，只标有意思或棘手的地方。结尾给出 0–10 的可修复性评分和优缺点 — [iPhone 7 Teardown](https://www.ifixit.com/Teardown/iPhone+7+Teardown/67382)；[iFixit Teardown 指南](https://www.ifixit.com/Info/Teardown)；[iFixit 评分说明](https://www.ifixit.com/News/75533/how-ifixit-scores-repairability)。iFixit 现在用 Lumafield 的 CT 自己扫描，并分享可以交互查看的扫描模型 — [Lumafield 案例](https://www.lumafield.com/case-studies/customer-story-ifixit)
- **three.js / WebGL 爆炸视图示例**：
  - exploded-lens：镜头随滚动依次分成 9 个带标签的零件，往回滚就复原。URL 参数可以加载任意 glTF，每个顶层子节点算一个零件，每个零件的偏移、顺序、自转和标签都能配置 — [GitHub exploded-lens](https://github.com/wonjyou/exploded-lens)
  - xeokit exploder：每个网格沿"模型中心 → 网格中心"的向量按系数移动，自带 HTML 滑块，默认范围 [0, 2]、步长 0.05 — [xeokit](https://xeokit.github.io/sdk/docs/api/modules/presentations.exploder.html)
  - React Three Fiber 的电钻爆炸：用爆炸中心向量加爆炸系数，再用 GSAP scrub 绑到滚动上 — [anaili.fr](https://blog.anaili.fr/articles/exploded)
  - 3D 打印冰淇淋机：滑块驱动，零件沿预先定义的曲线路径移动，剖切线用自定义 shader 画 — [pycheung.com](https://www.pycheung.com/weblog/post/1703)
  - glTF Exploder（README 是中文）：有径向、轴向、加权等多种模式，可处理上千个零件 — [GitHub](https://github.com/Observe-secretly/glft-exploder)
- **爆炸图原则**（中文资料）：按装配的逆序分解，每个零件沿真实的拆卸路径移动，例如螺栓只能沿自身轴线退出 — [浩辰云](https://yun.gstarcad.com/news/724/)
- **Sketchfab**：支持骨骼动画和刚体动画，观众可以播放、暂停、跳到指定帧、环绕查看 — [TechCrunch](https://techcrunch.com/?p=1194332)。Viewer API 可以用脚本控制相机移动和注释（来源是竞品 VNTANA） — [VNTANA](https://www.vntana.com/roundup/best-sketchfab-alternatives/)
  - ⚠️ 状态：2024-10-22 Sketchfab Store 关闭，交易迁到 Fab — [Sketchfab Blog](https://sketchfab.com/blogs/community/fab-publishing-portal-open-for-sketchfab-migration/)；[Fabbaloo](https://www.fabbaloo.com/news/epic-games-phases-out-sketchfab-in-2025-launches-unified-fab-marketplace)。MorphoSource 指出 Fab 缺少注释等功能 — [MorphoSource](https://github.com/MorphoSource/Community/discussions/128)。2026-08-10 KitBash 从 Epic 收购了 Sketchfab 和 ArtStation，称暂时不做改动 — [ArtStation Magazine](https://magazine.artstation.com/2026/08/kitbash-acquires-artstation-and-sketchfab/)；[80.lv](https://80.lv/articles/artstation-and-sketchfab-have-been-acquired-by-kitbash)

#### 导航、定位与联动
- **Autodesk ViewCube**：有 26 个可点区域。6 个面对应正交视图，12 条棱对应两面之间的半视图，8 个角对应三面的 3/4 视图。在面视图下点旁边的三角可以切到相邻面；滚转箭头每次转 90°；按住拖动可以环绕；悬停时光标会变，并出现提示 — [Revit Help: Reorient the Current View](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-6FFA0299-8E1F-4B69-992B-D36441D20A57.htm)；[Autodesk Docs: ViewCube](https://help.autodesk.com/view/DOCS/ENU/?guid=Viewcube_Files)
- **Onshape BOM 交叉高亮**：鼠标悬停在 BOM 某行，图形区就高亮对应零件；点行号会在实例列表和图形区同时高亮。反过来，在实例列表里点零件，BOM 对应行会高亮并滚到视野内；选中一行还能批量隐藏这个零件的所有实例 — [Onshape Help: BOM](https://cad.onshape.com/help/Content/bill_of_material.htm)；[Tech Tip: Simultaneous BOMs](https://www.onshape.com/en/resource-center/tech-tips/how-to-use-simultaneous-boms)
- **剖切面**：GrabCAD Print 的 Section View 教程流程是：激活剖切 → 调整剖切面 → 查看内部结构 — [GrabCAD Tutorial](https://grabcad.com/tutorials/using-the-section-view-in-grabcad-print)
- **知乎上的自发用法**：拖动设计树底部的蓝线，逐个查看别人每一步用了什么特征，再自己一步步重做 — [知乎](https://www.zhihu.com/question/345964735)

#### 交互模式目录（跨问题汇总）

| # | 模式 | 在哪里见到 | 机制 | 来源 |
|---|---|---|---|---|
| 1 | 回滚条拖拽 | Onshape、SOLIDWORKS | 拖动列表里的横条，模型只重建到这里；后面的特征被抑制（Onshape）或图标变灰（SW）；↑↓ 键单步；右键 Roll to here / Roll to end | [Onshape](https://cad.onshape.com/help/Content/feature_list.htm)；[SW](https://help.solidworks.com/2023/english/SolidWorks/sldworks/c_rollback_bar.htm) |
| 2 | 历史自动回放 | Fusion Timeline | Play 自动逐特征往前走；Prev/Next Step；Move to Beginning/End | [Fusion Help](https://help.autodesk.com/view/fusion360/ENU/?guid=ASM-USE-TIMELINE) |
| 3 | 单步前后混合预览 | Onshape 特征对话框 | 0%（特征前）到 100%（特征后）的滑块，默认 70% 叠加显示 | [Onshape Dialogs](https://cad.onshape.com/help/Content/Home/dialogs.htm) |
| 4 | 下游影响预览 | Onshape Final 按钮 | 编辑早期特征时，一键查看所有后续特征重算后的结果 | [Tech Tip](https://www.onshape.com/en/resource-center/tech-tips/tech-tip-how-to-use-onshapes-final-button) |
| 5 | 布尔类型显式化，错误显示为红 | Onshape Extrude | 选 New/Add/Remove/Intersect；出错几何显示为红，选中显示为黄 | [Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm)；[Colors](https://cad.onshape.com/help/Content/Home/colors.htm) |
| 6 | 尺寸滑块直接驱动模型 | Adam（早期 text-to-CAD） | 生成 OpenSCAD 后，每个数值尺寸各给一个滑块，实时预览 | [评测](https://pasqualepillitteri.it/en/news/3372/adamcad-text-to-cad-ai-review-2026) |
| 7 | GUI ↔ 代码双表示 | Zoo Design Studio | 点选、提示词、代理的操作都写成 KCL，两边都能编辑 | [cadalts](https://cadalts.com/tools/zoo/) |
| 8 | 分步爆炸，按阶段回滚 | Onshape Exploded Views | 沿三轴拖动零件，每次拖动成为一步；步骤可重排；拖爆炸树回滚条分阶段看 | [Onshape](https://cad.onshape.com/help/Content/Assembly/exploded_views.htm) |
| 9 | 自动爆炸 + 故事板 | Fusion Animation | Auto Explode One/All Levels 后用 Manual Explode 细调；Trail Line 显示路径；Restore Home 复位；空格播放 | [Autodesk Help](https://help.autodesk.com/cloudhelp/ENU/Fusion-Animate/files/GUID-CCBE4164-214A-4931-B7FB-DA4DC1F3B40B.htm) |
| 10 | 径向爆炸系数滑块 | xeokit、three.js 示例 | 零件沿"中心 → 零件中心"的向量乘系数位移，滑块范围 0–2 | [xeokit](https://xeokit.github.io/sdk/docs/api/modules/presentations.exploder.html) |
| 11 | 滚动驱动逐件分解 + 标签 | exploded-lens、R3F 电钻 | 按滚动进度依次分离零件并出标签，回滚复原 | [exploded-lens](https://github.com/wonjyou/exploded-lens)；[anaili](https://blog.anaili.fr/articles/exploded) |
| 12 | 沿曲线路径爆炸 | 冰淇淋机示例 | 零件沿预定义曲线移动，由滑块驱动 | [pycheung](https://www.pycheung.com/weblog/post/1703) |
| 13 | 逆装配序 + 真实拆卸方向 | 中文爆炸图原理 | 按装配逆序分解；螺栓只沿自身轴线退出 | [浩辰云](https://yun.gstarcad.com/news/724/) |
| 14 | 每步一段 3D 动画，可重播、跳步、配语音 | BILT | 可旋转缩放；点零件看详情；跳过、返回、重播 | [App Store](https://apps.apple.com/us/app/bilt/id879452214) |
| 15 | 项目总览卡 | BILT | 开始前列出时间、工具、零件、步数、人数 | [APKMirror](https://www.apkmirror.com/apk/bilt-inc/bilt-intelligent-instructions/bilt-intelligent-instructions-5-8-1-release/) |
| 16 | 本步所需零件高亮 + 进度滑条 | LEGO Builder（第三方描述） | 高亮本步积木及其数量和位置；用滑条跳步 | [mwm.ai](https://mwm.ai/apps/lego-builder-3d-instructions/1486159728) |
| 17 | 多人分工 | LEGO Build Together | 多台设备各分到不同的步骤 | [LEGO Help](https://www.lego.com/en-us/service/help-topics/article/lego-builder-app-3d-building-instructions) |
| 18 | 一图一概念、一次一变量 | Bartosz | 每个新概念一张图，通常只改一个参数 | [Gears](https://ciechanow.ski/gears/) |
| 19 | 固定颜色语义 / 颜色对应 | Bartosz、iFixit | 主动件黄、从动件绿等全文固定；iFixit 文字要点颜色等于图上标注颜色 | [Gears](https://ciechanow.ski/gears/)；[iFixit](https://www.ifixit.com/Info/Teardown) |
| 20 | 每图播放/暂停 + 全局暂停 | Bartosz | 每个动画图左下角一个按钮，正文有全局暂停和恢复 | [Gears](https://ciechanow.ski/gears/) |
| 21 | 观察引导语 + 日常物体参照 | Bartosz | 先说"下方可以控制……"，再说"注意……"；用扳手、铰链做参照 | [Gears](https://ciechanow.ski/gears/) |
| 22 | 正文里可拖动的数字 | Bret Victor Tangle | 正文中的数值可以拖，相关量随之更新 | [Tangle](https://x.com/worrydream/status/80736229234188288) |
| 23 | 可拖拽控制点 / 节点 | Pomax、Bartosz Curves & Surfaces | 直接拖控制点看曲线或曲面变化，可以新增点 | [Pomax](https://pomax.github.io/bezierinfo/)；[Curves and Surfaces](https://ciechanow.ski/curves-and-surfaces/) |
| 24 | 开场沙盒 | Bartosz Moon | 先给一个能拖动的模拟玩，再开始讲 | [daily.dev](https://daily.dev/posts/moon-bartosz-ciechanowski-fuppibs82) |
| 25 | 固定图 + 滚动步骤，最后自由探索 | The Pudding、Apple sticky-scroll | 视觉面板固定，文字段落滚过时触发状态变化，末尾放开完整交互 | [Pudding](https://pudding.cool/process/how-to-make-dope-shit-part-3/)；[scrollytell.ing](https://scrollytell.ing/the-pudding-series-the-naked-truth/) |
| 26 | 滚动驱动的帧序列 | Apple AirPods Pro | 帧号等于滚动进度；文案出现时停帧 | [CSS-Tricks](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/) |
| 27 | 谜题门槛 / 先下注 | Nicky Case | 证明理解才能往下走；先预测再揭晓 | [ncase](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/) |
| 28 | 无 JS 也能看的首帧 | Pomax | 服务端用同一份源码渲染静态首帧 | [graphics-element](https://pomax.github.io/custom-graphics-element/) |
| 29 | 强制入门实操 | Shapr3D | 首次登录有约 6 分钟、不可跳过的教程（A/B 测试证明有效） | [Shapr3D Community](https://discourse.shapr3d.com/t/skipping-intro-tutorial/17130?page=2) |
| 30 | 左栏说明 + 主区实操 | Tinkercad Lessons | 左侧逐步说明，在主编辑区照做 | [讲义](https://it.westchesterlibraries.org/wp-content/uploads/2018/04/Getting-Started-with-Tinkercad1.pdf) |
| 31 | ViewCube 方向导航 | Autodesk 全系 | 26 个可点区域（6 面、12 棱、8 角）；滚转箭头；拖动环绕 | [Revit Help](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-6FFA0299-8E1F-4B69-992B-D36441D20A57.htm) |
| 32 | 列表 ↔ 3D 交叉高亮 | Onshape BOM | 悬停一行高亮零件，点选后三处同步，反向操作也同步；可批量隐藏 | [Onshape BOM](https://cad.onshape.com/help/Content/bill_of_material.htm) |
| 33 | 拖动剖切面 | GrabCAD Print | 激活剖切，拖动剖切面看内部 | [GrabCAD](https://grabcad.com/tutorials/using-the-section-view-in-grabcad-print) |
| 34 | 可交互的 CT / X 光 | iFixit × Lumafield | 扫描后分享可交互的模型 | [Lumafield](https://www.lumafield.com/case-studies/customer-story-ifixit) |
| 35 | 图纸 → 模型 → 质量校验 | Too Tall Toby、Model Mania | 提交质量，在容差内即判对；漏洞是 Ivan Exploit | [TTT 规则](https://tootalltoby.com/tournaments/2025/world_championship/tournament_rules/) |
| 36 | 两阶段变更单 | Model Mania | Phase 2 用红色修订云给出变更，考改模的速度和稳健性 | [Model Mania 2026](https://blogs.solidworks.com/products/solidworks/model-mania-2026-overview-solution-and-winners/) |
| 37 | 跨 CAD 排行榜 | Too Tall Toby | 按 CAD 系统、国家、用时排名 | [TTT](https://www.tootalltoby.com/practice/sample/) |
| 38 | 在线自动评分 | 中望三维模型评分、三视图在线考核 | 批量评分并排名；在线绘图后自动判分 | [中望教育云](https://www.cadexam.com/soft/) |
| 39 | 软件内引导课程 | 中望3D "边学边用" | 在软件里显示引导步骤，可以自建课程并跟踪进度 | [中望](https://www.zwsoft.cn/support/87-5765.html) |
| 40 | 了解上下文的 AI 导师 | Brilliant Koji | AI 能看到当前的课和题 | [Brilliant FAQ](https://brilliant.org/faq/) |

### Inferences

**问题三评估表**

| # | 产品 / 类别 | 做得好 | 做得差 / 局限 |
|---|---|---|---|
| 24 | LEGO Builder | 每一步都能旋转查看；本步零件高亮；有进度；能多人分工 | 不是所有套装都有 3D；只讲怎么装，不讲为什么 |
| 25 | BILT | 每步一段 3D 动画、点零件看详情、语音、重播、开工前概览 | 品牌付费制作；不解释设计 |
| 26 | Sketchfab | 注释、动画时间轴、Viewer API | 没找到原生爆炸功能；⚠️ 迁移 Fab、被 KitBash 收购后前景不明 |
| 27 | Apple 产品页 | 滚动驱动的爆炸叙事，制作精良 | 图片序列不能交互，资源重，被批 scrolljacking |
| 28 | iFixit | 编号步骤；文字和标注颜色对应；评分；CT 可交互 | 以照片为主，3D 交互有限 |
| 29 | three.js 爆炸示例 | 滑块或滚动驱动，带标签和曲线路径 | 只是演示，没有教学叙事 |
| 30 | CAD 内机制（Onshape / SW / Fusion） | 回滚、回放、前后混合预览、Final、分步爆炸、BOM 联动 | 要装软件、要拿到原文件；没有讲解；后续几何不做半透明预示 |

- （推断）网站的两项核心功能可以这样借现成模式：
  - **"建模操作分步 3D 模拟"**：以 #3 前后混合滑块为主控件，把一个操作做成 0→100% 的进度；用 #5 把 New、Add、Remove、Intersect 的视觉语义固定下来；配合 #18–#21（一次一变量、颜色固定、每图可暂停、观察引导语）和 #31 ViewCube。
  - **"参数化模型拆解 + 逐特征重建"**：以 #1、#2 回滚和回放为骨架，加上 #4 Final（改上游参数看下游变化）；用 #14–#16 把每个特征当成"一步积木"（本步新增的几何高亮、进度条、重播、旁白）；用 #32 做"特征列表 ↔ 3D 面"的双向高亮；爆炸视图用 #8–#13，并把展示用的径向爆炸（#10）和符合工程实际的拆卸爆炸（#13）分开讲。
- （推断）知乎用户把"拖设计树回滚条、看别人怎么建"当成最快的提高方法，说明"拆解学习"的需求真实存在，只是现在要靠装软件、拿原文件、自己琢磨才能实现。把这个过程搬到网页上并配上解说，是最直接的价值点。
- （推断）滚动驱动适合主线叙事，但应该用实时 3D 而不是图片序列，并且让用户随时可以接管视角（exploded-lens、R3F 的示例说明这在技术上可行）。不要劫持滚动，以免招来 Apple 页面那样的批评。

### Gaps
- 在现有 CAD 帮助文档和学习站里，都没找到以下四种交互的先例。它们可能是空白点，也可能只是检索没覆盖到：在逐特征回放中高亮本步新生成的面；用半透明方式预示后续几何；在基准面上播放草图绘制的动画；在 3D 里随步骤出现的尺寸标注。
- Onshape 和 Fusion 的特征预览中，加料和减料分别用什么颜色，没查到官方说明。
- LEGO Builder 的进度滑条和本步零件高亮只有第三方描述，没有 LEGO 官方确认。
- Onshape 现在是否支持爆炸动画（有第三方博客提到 Animate 标签）没有官方证实。
- 没找到 Sketchfab 原生的 explode 功能；KitBash 收购后的路线不明。
- 没找到 "how it's made" 类网站中可交互 3D 的典型案例（Animagraffs 以视频和 GIF 为主）。

## 问题四：中国市场现状——除视频课外有没有交互式 CAD / 工业建模学习产品？学习者依赖什么、抱怨什么？

### Takeaway
中国学习者现在主要靠 B站的长视频合集（量大、免费，但营销号、虚标集数、盗版混杂）、垂直站的付费视频课（学犀牛、溜溜自学网）、高校 MOOC，以及国产 CAD 厂商的教育云（中望、CrownCAD）。腾讯课堂已在 2024 年停运。交互式 3D 学习在国内只以"院校采购的虚拟仿真或实训软件"形式存在（ilab-x 实验空间、中望实训和评分软件），没找到面向个人、讲概念、不限工具的开放交互网站。学习者最常见的抱怨是"只教命令、不讲流程和建模思路"，以及"跟着教程会做，自己做就走样"。

### Cited Findings

#### 渠道变化
- ⚠️ **腾讯课堂**：2024-08-01 停止课程访问，2024-10-01 全面停运。它 2014 年上线，到 2021 年累计服务 4 亿用户、35 万门课；腾讯教育随后转向 B 端 — [北京日报](https://xinwen.bjd.com.cn/content/s66852bd1e4b07e497a9776cf.html)；[每日经济新闻](https://www.nbd.com.cn/articles/2024-07-02/3450315.html)；[21经济网](https://www.21jingji.com/article/20240702/herald/0cce0c47687434aa76471caaa309d1dc.html)

#### B站
- SolidWorks 教程数量巨大。抓取时的侧栏数据显示，头部频道"阿奇设计分享"的 SOLIDWORKS 教程系列约 1456.5 万播放，"年溯机械说"的三天速成约 227.8 万。这是快照数据，会变 — [B站视频](https://www.bilibili.com/video/BV1mHy6BiEQi/)；[B站视频](https://www.bilibili.com/video/BV1kYuS6KEPe/)
- 乱象之一是标题里的集数虚标。例如标着"全399集"的合集实际只有 34 条视频，标着"150集"的实际 25 条 — [B站 BV1nPwcz4EeY](https://www.bilibili.com/video/BV1nPwcz4EeY/)；[B站 BV1y1e26oEjD](https://www.bilibili.com/video/BV1y1e26oEjD/)。另有频道把人引到私信要安装包 — [B站合集](https://www.bilibili.com/zh-Hans/list/3546657140509426/?oid=117445209623025&bvid=BV1TBJ26aEXs)
- 一篇 CSDN 推荐帖的建议：先跟"阿奇设计分享"把基础操作的原理学透，再跟"SolidWorks零基础教程"实际上手建模 — [CSDN](https://blog.csdn.net/2301_80132351/article/details/142579301)

#### 垂直站 / 机构
- **学犀牛中文网**：自称国内最大的工业设计交流平台，网校教 Rhino、Grasshopper、T-Splines、KeyShot。免费的 Rhino 课有 31 章、445 课时（约 2 年前的快照）。⚠️ 下载区列有破解版 Rhino — [xuexiniu.com](https://www.xuexiniu.com/)
- **3D溜溜网 → 溜溜自学网**：Rhino 基础课 26 课时，2 节可以试看；系统实战课 ¥699，会员价 ¥599 — [溜溜自学网](https://zixue.3d66.com/course/640.html)
- **Rhino3D 犀牛中文网（rhino3d.asia）**：论坛加课程，有 McNeel Asia 组织的面授课 — [rhino3d.asia](https://www.rhino3d.asia/thread-1487-1-1.html)

#### 高校 / MOOC
- 中国大学MOOC 上有大量 SolidWorks 和工程制图课程。西北工业大学《Solidworks三维产品设计与建模》是国家精品在线开放课程，选课人数 10 万+ — [中国大学MOOC](https://www.icourse163.org/course/NWPU-1207040802)；[国家高等教育智慧教育平台](https://higher.smartedu.cn/course/65038e54374ed23bd75602e7)
- 某《SolidWorks三维建模设计》课的考核构成：平时 20%、小组汇报 40%、课后拓展 10%、在线考试 30% — [中国大学MOOC](https://www.icourse163.org/course/detail.htm?cid=1206308810)
- 北京信息职业技术学院的《机电产品三维设计》包含爆炸图和实物组装项目；北方工业大学的《工程制图实践》包含装配体爆炸视图 — [中国大学MOOC BITC](https://www.icourse163.org/course/BITC-1464036182)；[中国大学MOOC NCUT](https://www.icourse163.org/course/NCUT-1471262164)

#### 视频以外的交互 / 仿真类
- **中望**：中望教育云（cadexam.com）面向院校提供教学、实训、考核和 1+X 证书。"三维模型评分软件"能在线批量评分、出排名；"三视图在线考核系统"支持在线绘图、查看 3D 模型、自动判分 — [中望教育云软件页](https://www.cadexam.com/soft/)。中望3D 内置"边学边用"，在软件里显示引导步骤，可以自建课程并跟踪进度 — [中望官网](https://www.zwsoft.cn/support/87-5765.html)。新平台"3Di EDU"宣传用职教 AI 大模型引导学生自主学习 — [中望教育云](https://www.cadexam.com/)
- **CrownCAD（华天软件）**：浏览器端和移动端的三维云 CAD，几何内核 DGM 和约束求解器 DCS 都是自主研发，官网称有 400 多所高校用户 — [CrownCAD 官网](https://www.crowncad.com/zh/)。2025 年的宣传稿称注册用户超过 41 万，并全程支持"智能CAD生成与参数化建模"挑战赛 — [搜狐](https://www.sohu.com/a/887515278_594125)。用户体验文章说它有引导式教程，操作习惯接近 SolidWorks — [博客园](https://www.cnblogs.com/qsbye/p/16925137.html)
- **实验空间 ilab-x（国家虚拟仿真实验教学课程共享平台）**：由高等教育电子音像出版社建设维护 — [ilab-x 关于](https://www.ilab-x.com/about)。规范要求课程在网页端打开、无需下载（B/S 架构），技术路线是实时云渲染 — [CSDN](https://blog.csdn.net/mlj890211/article/details/109717789)。北方工业大学的一门课用"3D 交互拆解"把抽象原理具象化 — [北方工业大学](https://www.ncut.edu.cn/xq/info/1017/1079.htm)。西华大学采购"减速器虚拟拆装"软件时，要求它能智能判断用户在 3D 场景里的操作并实时反馈 — [西华大学采购参数 PDF](https://sma.xhu.edu.cn/_upload/article/files/42/c2/fa5d5fe24ada912a9ec8e15f7208/054e54e6-6e87-4eb1-8188-9620aedb25b9.pdf)
- **B 端爆炸动画工具**：图扑 HT 用来演示设备原理和维修流程 — [图扑 知乎](https://zhuanlan.zhihu.com/p/1908487552912044876)；THCAD 可以一键生成爆炸图和拆解动画 — [THCAD 知乎](https://zhuanlan.zhihu.com/p/677307788)

#### 学习者依赖什么、抱怨什么
- 知乎高赞建议：不要只刷视频，边看边做才记得住。先做软件自带的零件和装配教程，再打开现成装配体，逐个重建里面的零件，卡住时把模型回滚到那一步，看草图怎么画、用了哪些命令 — [知乎：零基础 SolidWorks 速成](https://www.zhihu.com/question/381050077)
- 一位有约 8 年经验的用户说，最快的提高方法之一是把设计树底部的蓝线往上拖，看别人每个特征怎么做，再一步步重做；他还建议先学机械制图 — [知乎：solidworks到底咋入门](https://www.zhihu.com/question/345964735)
- 关于建模思路：新手追求步骤最少，后来改模型时就会报错，于是转向"易于修改、同时足够快"的建模方式 — [知乎专栏：SolidWorks进阶教程3 建模思路](https://zhuanlan.zhihu.com/p/704598669)。东一点西一点地学会造成知识断层、建模思路混乱，建议系统地学 — [知乎专栏](https://zhuanlan.zhihu.com/p/5500571879)
- 3D 建模新手最常见的问题是跟着教程能做，自己做就走样，根源是空间感不足；建议建模时频繁切换各个视图 — [知乎回答](https://www.zhihu.com/question/475147050/answer/1952369230939920081)
- 一篇讲自学误区的文章列出：只看不练（例子是看了 3 个月教程仍放不正一个立方体）、囤积教程；还抱怨教程到处都是，讲完整流程的却很少 — [知乎专栏](https://zhuanlan.zhihu.com/p/1977026859062544289)
- 抖音上的短练习视频（例如只用拉伸和切除做二十面体、链条、果篮）被整理成练习素材 — [知乎专栏](https://zhuanlan.zhihu.com/p/508471143)

### Inferences

**问题四评估表**

| # | 平台 | 做得好 | 做得差 / 局限 | 状态 |
|---|---|---|---|---|
| 31 | B站 | 免费、量大，头部播放量千万级 | 营销号、集数虚标、导流和盗版；以只看不练为主 | 活跃 |
| 32 | 学犀牛中文网 | Rhino 体系课程；有社区 | 下载区有破解版；以视频为主 | 活跃 |
| 33 | 溜溜自学网（3D溜溜） | 按课付费，可试看 | 以视频为主；单价 ¥599–699 | 活跃 |
| 34 | 中国大学MOOC | 高校课程体系化、免费、有国家精品 | 绑定 SolidWorks；跟着学期走 | 活跃 |
| 35 | 中望教育云、3Di EDU、边学边用 | 在线评分、三视图自动判分、软件内引导 | 面向院校，绑定中望；B 端 | 活跃 |
| 36 | CrownCAD | 浏览器打开就能用、可协同、教育用户多 | 绑定自家 CAD；用户数是厂商口径 | 活跃 |
| 37 | ilab-x 实验空间 | 网页端 3D 交互拆解、国家级课程 | 以课程为单位、由院校主导，不面向自学者 | 活跃 |
| — | 腾讯课堂 | — | — | ⚠️ 2024-10-01 停运 |

- （推断）痛点和产品机会能一一对上：
  1. "只教命令、不讲流程和思路" → 讲概念优先、讲设计意图的内容；
  2. "看会了、做不出" → 每屏都能动手，并且有即时反馈；
  3. "空间感不足" → 可以旋转、多视图联动的 3D；
  4. "信息噪声大"（营销号、虚标、盗版）→ 一个干净、结构化、不用安装的中文站本身就有差异。
- （推断）国内的交互 3D 学习集中在院校采购的"课程级虚拟仿真"上，偏向"实验操作步骤考核"，面向个人的概念型开放网站目前空缺。国产 CAD 厂商（中望、CrownCAD、华天）在教育上投入大，但都绑定自家软件。一个不限工具的站点可以做"中立的概念层"，并在每个概念下给出各软件的命令对照，甚至可以和这些厂商合作。
- （推断）腾讯课堂关停说明综合课程平台在收缩，B站仍是主要阵地。分发上很可能需要与 B站、知乎、抖音配合，例如用短视频预告引流到交互页。

### Gaps
- 没找到面向个人的中文交互式 CAD 概念学习网站或 App。用"机械拆装 小程序"等词也没搜到教学类结果，不排除存在小型微信小程序。
- 网易云课堂的当前状态、3D溜溜课程的总体规模、B站 CAD 相关内容的整体数据都没查。
- 用户抱怨主要来自知乎和 CSDN，样本少，部分文章是培训广告；没有系统检索 B站评论和弹幕、贴吧、小红书。
- 没直接找到 ilab-x 上机械类（减速器、齿轮）虚拟仿真课程的具体页面；中望 3Di EDU 的具体交互形态未核实。

## 问题五：缺口在哪？2024–2026 年 AI 辅助 CAD 学习和 text-to-CAD 怎样改变学习方式？

### Takeaway
"中文 + 概念优先 + 不限工具 + 可交互 3D + 讲建模操作和特征树"这个组合，目前没有找到任何现成产品。2024–2026 年的 AI 浪潮有两类：一类是厂商内置的 AI 助手，基本是文档问答和执行命令；另一类是 text-to-CAD 和 CAD copilot，直接生成或编辑特征树。两类都没有补上"概念理解"这一层。反而因为模型越来越多由 AI 生成，"读懂、检查、修改一棵特征树"变得更重要，而这正是"拆解 + 重建"能占住的位置（推断）。

### Cited Findings

#### 厂商内置 AI 助手
- **Onshape AI Advisor**：2025-04 先上线 Learning Center，用 Onshape 的培训资料训练，回答会附学习资源和视频链接 — [PTC 新闻稿](https://www.ptc.com/en/news/2025/ptc-announces-onshape-ai-advisor-and-onshape-government)。release 1.205（约 2025-10）进入软件内，但不读取用户数据 — [Onshape What's New 1.205](https://www.onshape.com/en/resource-center/what-is-new/ai-advisor-configurable-variable-studios-simulation)。后来增加了自动调整变量驱动设计的能力 — [DEVELOP3D](https://develop3d.com/cad/built-differently-onshapes-ai-advisor/)。第三方博客认为它看不到模型是根本限制 — [texocad](https://blog.texocad.ai/posts/onshape-ai-advisor)
- **Autodesk Assistant**：能用自然语言执行命令、定制工作区、写代码，官方列出的用途包括学习工具和工作流 — [Autodesk Blog](https://www.autodesk.com/products/fusion-360/blog/a-guide-to-autodesk-assistant-in-fusion/)。据 AU 2026 的报道，Autodesk 宣布了更多工作流和 MCP（本地的 Fusion MCP、云端的 Fusion Compute MCP），并称自 3 月以来对话已超过 200 万次 — [DEVELOP3D](https://develop3d.com/cad/autodesk-announces-updates-to-ai-expansion/)。自 10 月 6 日起改用 Flex tokens 计量 — [Autodesk Blog](https://www.autodesk.com/products/fusion-360/blog/changes-to-autodesk-assistant-in-autodesk-fusion-beginning-october-6th/)。路线图包括 neural CAD（文本生成可编辑几何）和 Text-to-Command — [Fusion Roadmap 2026](https://www.autodesk.com/products/fusion-360/blog/fusion-roadmap-2026/)
- **SOLIDWORKS AURA**：SOLIDWORKS 2026 引入，运行在 3DSwym 里，基于官方文档和培训手册，能给出分步操作说明 — [SOLIDWORKS Blog: What's New 2026](https://blogs.solidworks.com/solidworksblog/2025/10/whats-new-in-solidworks-2026-collaboration-and-data-management.html)。按 token 计量；从 3DEXPERIENCE 2026 FD03 起，商业客户可以用 AURA 和 LEO — [Visiativ](https://visiativ.co.uk/news-resources/get-started-ai-virtual-companions-solidworks/)。竞品 Leo AI 批评它只是个 documentation chatbot（立场可能有偏） — [Leo AI](https://www.getleo.ai/blog/solidworks-aura-review-2026)

#### Text-to-CAD、代码 CAD 与 copilot
- **Zoo**：Zookeeper 把自然语言写成 KCL，生成带可编辑特征树的参数化实体 — [cadalts](https://cadalts.com/tools/zoo/)；[Zoo Blog](https://zoo.dev/blog/zoo-design-studio-v1)
- **Adam**（YC W25）：起初在浏览器里把文本生成 OpenSCAD，每个数值尺寸各给一个滑块。2025-10-31 获得 410 万美元种子轮。2026 年转成 copilot，在 Onshape 和 Fusion 里读取并代理式地编辑特征树 — [评测](https://pasqualepillitteri.it/en/news/3372/adamcad-text-to-cad-ai-review-2026)；[Product Hunt](https://www.producthunt.com/products/adam-cad-copilot)；[YC Launch](https://www.ycombinator.com/launches/MfX-adam-ai-co-pilot-for-cad)。开源的 CADAM 把 OpenSCAD 编译成 WASM，截至 2026-07-15 约有 4,802 个 GitHub stars — [Developers Digest](https://www.developersdigest.tech/blog/adam-ai-cad-yc-w25-open-source-text-to-cad)
- **学术研究**：Text2CAD 指出 text-to-3D 的输出既不是参数化的、也不能手工编辑，所以需要 text-to-parametric CAD — [arXiv Text2CAD](https://arxiv.org/abs/2409.17106v1)。CAD-Coder 把 text-to-CAD 重新定义为生成 CadQuery 脚本 — [arXiv CAD-Coder](https://arxiv.org/html/2505.08686v1)
- **中文**：CrownCAD 全程支持"智能CAD生成与参数化建模"挑战赛（2025） — [搜狐](https://www.sohu.com/a/887515278_594125)

#### 其他 AI 学习形态
- Brilliant 的 AI 导师 Koji 能看到学习者当前的课和题 — [Brilliant FAQ](https://brilliant.org/faq/)；[Headway](https://makeheadway.com/blog/brilliant-review/)。Womp 转向 AI 生成加打印（Spark） — [Womp Blog](https://womp.com/blog-1/?undefined=2)。Spline Academy 的新教程主要讲 AI 和 MCP 工作流 — [Spline Tutorials](https://spline.design/academy/tutorials)
- HN 上有人说 AI 让这类交互页做起来更便宜了，但"知道该把什么可视化"仍然稀缺 — [HN](https://news.ycombinator.com/item?id=49427375)

#### 支撑"概念优先"定位的材料
- 威斯康星大学 Design Hub 把 design intent 定义为模型里内置的、控制它在修改时如何表现的"智能"，并说参数化建模器通过关系、参数和模型行为来记录设计意图 — [UW–Madison Design Hub](https://making.engr.wisc.edu/cad-support/)。西班牙布尔戈斯大学把设计意图规则写进了机械工程学生的 3D CAD 练习 — [Springer](https://link.springer.com/10.1007/s10798-016-9358-z)
- 现有方案的已知局限：Plasticity 没有参数化历史 — [Jawstec](https://www.jawstec.com/plasticity-cad-is-it-worth-learning/)；TTT 只验质量 — [TTT 规则](https://tootalltoby.com/tournaments/2025/world_championship/tournament_rules/)；中文教程讲完整流程的很少 — [知乎专栏](https://zhuanlan.zhihu.com/p/1977026859062544289)

### Inferences

**1. 版图定位（推断）**

| 象限 | 代表 | 拥挤度 |
|---|---|---|
| 工具操作 + 视频 + 绑定单一工具 | Onshape LC、Autodesk Learn、MySolidWorks、Shapr3D、SketchUp Campus、B站、学犀牛、溜溜 | 非常拥挤 |
| 工具操作 + 软件内交互 + 绑定 | Tinkercad Lessons、中望"边学边用"、Shapr3D 强制入门 | 中等 |
| 结果校验练习（不限工具） | Too Tall Toby、GrabCAD；Model Mania（仅 SW） | 中等，英文为主 |
| 概念优先 + 交互 + 不限工具（英文） | Bartosz（机构、曲面）、Pomax（曲线）、Animagraffs（结构，交互少） | 稀少，而且不讲建模操作 |
| 课程级 3D 虚拟仿真（中文、院校） | ilab-x、中望实训 | B 端，不对个人开放 |
| AI 问答、生成、copilot | Onshape AI Advisor、Autodesk Assistant、AURA、Zoo、Adam | 快速增长，不讲概念 |
| **中文 + 概念优先 + 不限工具 + 交互 3D + 建模操作和特征树** | **没找到** | **空白** |

**2. 可以占住的具体空位（推断）**
- **建模操作的 explorable**：拉伸、旋转、扫掠、放样、抽壳、圆角、倒角、拔模、布尔、阵列、镜像，每个操作一个可拖动参数的 3D 模拟，没有现成的。组合方式可以是：Onshape 式的 0–100% 前后混合进度、Bartosz 式的一次一变量和固定颜色、New/Add/Remove/Intersect 的固定配色。现在 CAD 帮助文档只讲"去哪儿点"，Bartosz 只讲机构和曲面数学。
- **参数化模型拆解**：把知乎用户"拖回滚条看别人怎么建"的野路子做成产品，不用装 CAD，也不用原文件。每一步配上设计意图的解说，高亮本步新生成的面，半透明预示后续几何，提供"改上游参数看下游变化"（借 Final 按钮的思路），再加上 LEGO/BILT 式的进度、重播、本步零件高亮，以及"特征列表 ↔ 3D"的双向高亮（借 Onshape BOM 的思路）。从检索结果看，这几种机制没有任何一个产品同时做到。
- **设计意图和可修改性练习**：借 Model Mania 的变更单（"改这个尺寸，你的模型还成立吗？"）；借 TTT 的质量校验，但要配合几何或拓扑比对，避免 Ivan Exploit；借 Nicky Case 的 Puzzle It Out 和 Place Your Bets（先预测这一步会生成什么，再揭晓）。
- **工具映射层**：每个概念页附上它在 SOLIDWORKS、Fusion、Onshape、中望3D、CrownCAD 里对应的命令名，并做中英术语对照。概念不限工具，但给出各软件的入口；TTT 用四种 CAD 录视频就是这类需求的先例。
- **AI 时代的定位**：厂商 AI 回答"怎么点"，text-to-CAD 直接产出特征树。学习重点会从"会点命令"转向"读懂、检查、修改一棵特征树，判断建模思路稳不稳"。拆解加重建恰好训练这种读模型的能力，也可以直接设计一个"检查 AI 生成模型"的练习单元（Zoo 的 GUI ↔ KCL 和 Adam 的尺寸滑块说明，可编辑参数就是 AI 生成物的接口）。

**3. 风险与反证（推断）**
- **生产成本**：Bartosz 和 Animagraffs 都是一人长周期制作，Distill 因倦怠停刊。必须先做可复用的"操作模拟和拆解播放器"组件，让新课程主要靠写配置和文案来生产。
- **性能和可访问性**：Apple 式的图片序列太重，还被批评劫持滚动；Bartosz 被批评读屏读不了。需要静态降级方案和文字替代。
- **厂商可能补位**：Onshape 和 Autodesk 已经把 AI 放进软件，如果再在学习中心嵌入可交互 3D 回放，会压缩空间。不过它们仍会绑定自家工具，不限工具和中文是护城河。
- **AI 降低了做交互页的门槛**：同类内容可能变多，壁垒更多在"选对要可视化的东西"和一套完整的中文概念体系上。

### Gaps
- 没找到关于 AI 或 text-to-CAD 如何影响学习者行为的数据或社区讨论（没检索到相关的 Reddit 讨论，只有学术论文）。
- 除了 CrownCAD 的挑战赛和中望 3Di EDU 的"AI 大模型"宣传，没找到中文的 AI CAD 学习产品。
- 没找到英文的"不限工具 + 概念优先 + 交互 3D 讲建模操作"直接竞品，可能存在小型独立站点没被检索到。
- Autodesk Assistant "200 万次对话"这个数字只见于 AU 2026 的相关报道，没拿到 Autodesk 一手原文。
