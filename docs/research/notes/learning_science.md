# 3D 工业建模交互学习网站调研：学习科学证据与设计原则

> 记号：d / g 是标准化均值差（g 是小样本校正版），r 是相关系数。Mayer 的"中位 d"是他汇总多项实验得到的中位数，不能直接和元分析的加权均值相比；同一原则在后续版本里数值普遍变小。推论里的【强】【中】【弱】是我对推论所依赖证据的主观评级。【外推】表示没有直接证据，是从相邻领域推出来的。课程内容、术语、竞品和技术栈由其他调研负责，本文不涉及。

## 1. 空间可视化能力（Sorby、PSVT:R、心理旋转、截面与正投影训练）：研究结论与交互 3D 的作用

### Takeaway
空间能力可以训练，效果持久，也能迁移（Uttal 等元分析 g = 0.47）。给工程新生开的空间训练课（Sorby）能改善起点低的学生后续的 STEM 成绩和留存，女生收益尤其明显。交互 3D 可以用来训练，比如 Cohen & Hegarty 的截面训练。但真正起作用的是"学习者看到任务关键的视角或截面，并得到反馈"，不是"可以自由旋转"本身；对低空间能力者，不加约束的多视角反而有害。

### Cited Findings
- **Uttal et al. 2013**（*The malleability of spatial skills: A meta-analysis of training studies*，Psychological Bulletin 139(2):352–402）汇总了 217 项训练研究。剔除离群值后，训练相对对照组的平均 Hedges' g = 0.47（SE = 0.04）。训练到后测的间隔拉长，效果也不衰减（durable），而且能迁移到没训练过的空间任务 — [Uttal et al. 2013 全文](https://groups.psych.northwestern.edu/uttal/vittae/documents/ContentServer.pdf)
- 这项元分析的局限：对照组自己也提高了约 0.45（多半是重测效应），所以各研究选用哪种对照组，会大幅影响报告出来的训练效应 — [Uttal et al. 2013 全文](https://groups.psych.northwestern.edu/uttal/vittae/documents/ContentServer.pdf)
- **Sorby 2009**（*Educational Research in Developing 3-D Spatial Skills for Engineering Students*，Int. J. Science Education 31(3):459–480）总结了 Michigan Tech 十几年的研究：
  - 新生入学时测 PSVT:R，没通过的（≤60%，即 30 题对 18 题及以下）去上空间技能课。
  - 课后 PSVT:R 和 MCT 都显著提高。
  - 起点低的学生在后续理科、数学和工程课上的表现变好了。
  - 文中强调徒手草图（sketching）对发展 3D 空间能力很重要。
  - 来源：[ResearchGate 摘要](https://www.researchgate.net/publication/248974874_Educational_Research_in_Developing_3-D_Spatial_Skills_for_Engineering_Students)；[全文 PDF](https://wiki.epfl.ch/edicpublic/documents/Candidacy%20exam/cuendet%20seb908742201.pdf)
- Sorby 2009 按性别的留存/毕业率：女生"没通过、上了课"为 89%，"没通过、没上课"为 68%，"通过、没上课"为 87%。男生对应为 75%、69%、72% — [EngageEngineering 摘要](https://www.engageengineering.org/spatial/whyitworks/learnmore)；[MDPI 2026 综述转载的表格](https://www.mdpi.com/2227-7102/16/6/847)
- 局限：早期研究里上不上课由学生自己选，存在自选偏差；Michigan Tech 从 2009 年起改为没通过者必修。另外，PSVT:R 用在工程学生身上有天花板效应 — [MDPI 2026 综述](https://www.mdpi.com/2227-7102/16/6/847)
- **Sorby, Veurink & Streiner 2018**（*Does spatial skills instruction improve STEM outcomes? The answer is 'yes'*，Learning and Individual Differences 67:209–222）用回归断点等方法分析了多门入门 STEM 课程的成绩。结论是空间技能教学能改善 STEM 课程表现，也可以作为提升 STEM 性别多样性的关键手段 — [Rowan University 仓储](https://www.researchwithrowan.com/en/publications/does-spatial-skills-instruction-improve-stem-outcomes-the-answer-/)；[MDPI 2026 综述](https://www.mdpi.com/2227-7102/16/6/847)
- 边界条件：一项针对计算机专业中期课程的研究发现，空间训练对学生的空间能力和 CS 能力都没有可测的影响，连本该最受益的低空间能力学生也一样 — [ACM, *The Effect (or Lack Thereof) of Spatial Skills Training in a Mid-Major Computing Course*](https://dl.acm.org/doi/10.1145/3699538.3699566)
- **Martín-Dorta, Saorín & Contero 2008**（*Development of a fast remedial course to improve the spatial abilities of engineering students*，J. Engineering Education 97(4):505–513）开了一门基于 Google SketchUp 3D 建模的 12 小时速成补救课，参与者是 40 名土木工程新生志愿者。据 Academia.edu 的自动摘要（未核原文），提升幅度和传统方法相当，男女收益接近 — [Academia.edu](https://www.academia.edu/17335262/Development_of_a_Fast_Remedial_Course_to_Improve_the_Spatial_Abilities_of_Engineering_Students)
- **Cohen & Hegarty 2014**（*Visualizing cross sections: Training spatial thinking using interactive animations and virtual objects*，LID 33:63–71）做了两项实验，对象是空间思维有困难的本科生。
  - 干预很短：交互动画展示 5 种基本几何体的正交截面和斜截面，可以随时暂停、步进；学生画出截面，再得到反馈。
  - 用 Santa Barbara Solids Test 做筛选和前后测。
  - 作者报告成绩有提升，也有迁移，认为交互动画和虚拟实体是训练空间思维的好工具。
  - 来源：[ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1041608014000739)；[SBST 介绍](https://hegarty-lab.psych.ucsb.edu/node/231)
- 后来的研究评价这类截面训练：大多基于简单几何体，交互不完整，只练"给定物体和截平面，选出 2D 截面"这一种任务 — [Sanandaji et al. 2023, Human Factors](https://journals.sagepub.com/doi/full/10.1177/00187208211018110)
- **Keehner et al. 2008**（*Spatial reasoning with external visualizations: What matters is what you see, not whether you interact*，Cognitive Science 32:1099–1132）：用交互可视化能获得多少信息，取决于"怎么交互"，而且因人而异。旋转无论是用户自己转的还是被动看的，决定表现的都是有没有看到任务关键信息，而不是有没有主动控制 — [Wiley](https://onlinelibrary.wiley.com/doi/10.1080/03640210801898177)
- **Levinson et al. 2007**（Medical Education）是一项脑表面解剖 e-learning 随机试验，设计为 2×2：学习者控制或程序控制 × 多视角或关键视角。低空间能力学生在多视角条件下的估计得分低 20%。作者认为多视角可能阻碍学习（对低空间能力者尤其如此），学习者控制程度太高也可能降低学习效果 — [Wiley](https://asmepublications.onlinelibrary.wiley.com/doi/10.1111/j.1365-2929.2006.02694.x)
- **Garg et al. 2002**（*Is There Any Real Virtue of Virtual Reality?*，146 名医学生，随机单盲）比较了"关键视角加约 ±10° 小幅晃动（wiggle）"和"多视角"。控制空间能力后，两组学习效果没有差异 — [ResearchGate](https://www.researchgate.net/publication/11081945_Is_There_Any_Real_Virtue_of_Virtual_Reality_The_Minor_Role_of_Multiple_Orientations_in_Learning_Anatomy_from_Computers)
- 相反的证据：Jang 等的论文（Computers & Education，2016 年在线）题为 *Direct manipulation is better than passive viewing for learning anatomy in a three-dimensional virtual reality environment*。据检索摘要（未核原文），亲手操纵对低空间能力学生的帮助比对高空间能力学生更大 — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0360131516302512)
- **Höffler 2010**（*Spatial Ability: Its Influence on Learning with Visualizations—a Meta-Analytic Review*，EPR 22(3):245–269，19 项研究、27 个实验）：用可视化学习时，空间能力和学习成绩的总体相关为 r = 0.34（95% CI 0.28–0.39），也就是高空间能力者有中等优势 — [Springer](https://link.springer.com/article/10.1007/s10648-010-9126-7)
- **Höffler & Leutner 2011**（Computers in Human Behavior 27(1):209–216）：看静态图时要在脑中构建"心理动画"，这需要空间能力；看动画材料则不需要（ability-as-compensator 假说）。静态图和动画总体上没有差异 — [ACM DL](https://dl.acm.org/doi/10.1016/j.chb.2010.07.042)

### Inferences
- 【中】站点可以说"系统的空间训练能提升空间能力"，但不能说"在网页上转转 3D 模型就能提升空间能力"。Keehner 和 Levinson 的结果说明，交互本身不是起作用的因素。
- 【中】设一条可选的"空间基础"轨道，给入门诊断得分低的人（Sorby 用 ≤60% 作分流线）。
  - 题型覆盖工程上最相关的三种能力：
    - 心理旋转：PSVT:R 式，"按同样的旋转转动另一个物体"。
    - 截面：SBST 式，"给定切平面，选出截面形状"。
    - 正投影：3D 模型和三视图互相辨认。
  - 每题走一个循环：作答 → 用 3D 揭示答案（旋转、切开或展开投影）→ 一句话解释。这是在模仿 Cohen & Hegarty 的"交互动画 + 绘制 + 反馈"。
- 【中】不要省掉草图/绘制。Sorby 强调徒手草图，Cohen & Hegarty 也让学生"画出截面"。网页上可以做低成本版本：在网格上点画截面轮廓，或者补全三视图里缺的线，自动比对后叠加正确答案。
- 【中】相机策略：
  - 每一步默认切到这一步的"关键视角"。比如画草图时正对草图平面，特征生成后切到等轴测。
  - 加大约 ±10° 的自动小幅晃动，帮助看出深度。
  - 自由旋转可以开放，但要提供"回到推荐视角"按钮。
  - 诊断出低空间能力的学习者，默认用更强的约束（关键视角加晃动）；高空间能力的学习者可以默认自由旋转。
- 【弱】Jang 等的相反结果提示：把"操纵"设计成有目的的任务。比如"转到能看见隐藏孔的角度"，或者"拖动截平面，直到截面出现两个圆"，而不是漫无目的地自由旋转。这样既能拿到主动操纵的好处，又不会让学习者错过关键视角【外推】。
- 【弱】空间训练做成 5–10 分钟的微练习，每组 6–10 题，穿插在建模课之间，而不是一次上完的长课【外推，Sorby 的课程是按学期开的】。

### Gaps
- Cohen & Hegarty 2014 的具体效应量和迁移幅度没拿到，摘要只说"有提升、有迁移"。
- 没找到"网页 3D CAD 学习产品"直接提升 PSVT:R 等测验成绩的随机对照研究。Martín-Dorta 2008 的结果来自自动摘要。
- Sorby 课程的具体剂量（学时、周数），以及在线版（如 EngageEngineering 相关软件）的效果数据，这次都没核实。
- 如果要直接用 PSVT:R 或 SBST 的原题，授权条件这次没查。
- 本站的目标人群可能是在职或自学的成人，他们能否像工程新生一样受益，缺少证据。
- Khooshabeh et al. 2008 *Benefits of constrained interactivity in using a three-dimensional diagram* 只在 [Hegarty 实验室论文列表](https://hegarty-lab.psych.ucsb.edu/publications) 里看到题录，没读到结果。

## 2. 认知负荷理论与多媒体学习原则对"分步 3D 建模课"的含义

### Takeaway
分步 3D 建模课的骨架应当这样搭：
- 按特征分段（segmenting）：Mayer 的中位 d 为 0.70–0.79，元分析给出小到中等效应。
- 开课前预训练术语和部件（pre-training）：d 为 0.46–0.75。
- 去掉装饰性视觉（coherence）：d 0.86。
- 说明紧贴并同步于对应的几何（spatial / temporal contiguity）：d 1.10 / 1.22。
- 高亮（signaling）只是辅助：d 0.41。

学习路径从完整的 worked example 开始，逆向逐步淡出（backward fading），直到学习者独立完成，并配上"为什么"的自我解释提示（g = 0.55）。对已经会的人，要能用"第一步诊断"快速跳过，否则会触发 expertise reversal。

### Cited Findings
- **Mayer & Pilegard**（Cambridge Handbook of Multimedia Learning 第 2 版，第 13 章）：
  - segmenting 在 10/10 次实验中得到支持，中位 d = 0.79。
  - pre-training 13/16，d = 0.75。
  - modality 53/61，d = 0.76。
  - 来源：[Cambridge](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pretraining-and-modality-principles/DD24C2F48B9B1277CE59F78276110258)
- 同书第 12 章：
  - coherence 23/23，d = 0.86。
  - signaling 24/28，d = 0.41。
  - redundancy 16/16，d = 0.86。
  - temporal contiguity 9/9，d = 1.22。
  - 另有一项 22/22、d = 1.10，很可能是 spatial contiguity（摘要片段里没标名称）。
  - 来源：[Cambridge](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E)
- **Mayer 2017**（*Using multimedia for e-learning*，JCAL）给出：segmenting d = 0.70，pre-training d = 0.46，modality d = 0.72，multimedia 原则 d = 1.67（5 次比较）。同一原则的数值比第 2 版手册低 — [Wiley](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12197)
- **Rey et al. 2019**（*A Meta-analysis of the Segmenting Effect*，EPR 31(2):389–419）：
  - 纳入 56 项研究、88 个两两比较。
  - 分段对保持和迁移都有小到中等的显著效应。
  - 分段降低了总体认知负荷，但也拉长了学习时间。
  - 调节变量包括先验知识，以及分段由系统控制还是由用户控制。
  - 来源：[Springer](https://link.springer.com/article/10.1007/s10648-018-9456-4)；[全文 PDF](https://maria-wirzberger.de/wp-content/uploads/2019/01/Rey2019_Article_AMeta-analysisOfTheSegmentingE.pdf)；[Learning Design Wiki](http://wiki.learningdesignalliance.org/claims/segmenting-effects-confirmed-system-paced/)
- 后续文献转引 Rey 2019：由学习者控制节奏的分段，对迁移的效应为 d = 0.45 — [Frontiers in Education 2023](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2023.1161460/pdf)
- 反面证据：Garrett 2020 指出，以往很多分段研究比的是"系统自动暂停"和"几乎不能由用户控制的视频"。当对照组视频本身可以由用户控制时，他发现分段既没降低主观努力，也没提高成绩 — [BERA blog](https://www.bera.ac.uk/blog/does-breaking-up-a-video-into-parts-improve-learning)
- **Noetel et al. 2022**（RER 的 meta-meta-analysis）：以下原则有稳健证据：modality、animation、coherence（去除诱惑性细节）、segmentation、personalization、verbal redundancy 等 — [SAGE](https://journals.sagepub.com/doi/abs/10.3102/00346543211052329)
- **渐隐（fading）**：Renkl, Atkinson & Maier 2000 的田野实验发现，在例题解答里逐步留空，比"例题-练习题成对"更有效。backward 方式是先空最后一步，再空最后两步，依此类推 — [CogSci 2000 PDF](https://scispace.com/pdf/from-studying-examples-to-solving-problem-fading-worked-out-3wusn6rcff.pdf)
- **Renkl & Atkinson 2003**（Educational Psychologist）：练习中的错误数中介了渐隐对近迁移的作用；backward fading 优于 forward fading — [ResearchGate](https://www.researchgate.net/publication/253450162_Structuring_the_Transition_From_Example_Study_to_Problem_Solving_in_Cognitive_Skill_Acquisition_A_Cognitive_Load_Perspective)
- **Atkinson, Renkl & Merrill 2003**（J. Educational Psychology）：渐隐能稳定促进近迁移，对远迁移则不稳定。加入提示、让学习者找出每一步背后的原理（自我解释）之后，可以弥补远迁移的不足 — [ResearchGate](https://www.researchgate.net/publication/200772684_Transitioning_From_Studying_Examples_to_Solving_Problems_Effects_of_Self-Explanation_Prompts_and_Fading_Worked-Out_Steps)
- **Bisra et al. 2018**（*Inducing Self-Explanation: a Meta-Analysis*，EPR 30(3):703–725）纳入 69 个效应量、5,917 人：
  - 总体 g = 0.55（95% CI 0.45–0.65）。
  - 对比"不加解释"的对照组，g = 0.67。
  - 对比"直接给出教学解释"，g = 0.35。
  - 来源：[Springer](https://link.springer.com/article/10.1007/s10648-018-9434-x)
- **Expertise reversal**：对低先验者有效的呈现方式，对高先验者可能没用甚至有害，反之亦然 — [Kalyuga 2007, EPR](https://link.springer.com/article/10.1007/s10648-007-9054-3)
- **Kalyuga & Sweller 2005** 的 rapid dynamic assessment（ETR&D 53:83–93）：
  - 让学习者给出"解题第一步"，用这个快速诊断实时分配指导等级。
  - 在代数和几何材料上验证过，自适应组优于非自适应的 yoked 对照组。
  - Academia 自动摘要称快速测验和传统测验的相关最高 0.92（未核原文）。
  - 来源：[Academia.edu](https://www.academia.edu/1405551/Rapid_dynamic_assessment_of_expertise_to_improve_the_efficiency_of_adaptive_e_learning)；[Salden et al. 对该研究的描述](http://www.cee.uma.pt/ron/Salden%20et%20al.%20-%20The%20Expertise%20Reversal%20Effect%20and%20Worked%20Examples.pdf)
- **CAD 领域**：Barnes & Wiebe 2011（ASEE）把 4C/ID 模型用到 CAD 教学，用教程视频形式的 worked example 作脚手架。讨论部分认为，初学者在学软件的同时可能认知超载，并建议例子要展示完整的建模策略 — [ASEE PEER](https://peer.asee.org/the-effects-of-worked-examples-on-cad-performance-an-application-of-the-four-component-instructional-design-model-to-cad-instruction)；[Barnes 博士论文](https://repository.lib.ncsu.edu/server/api/core/bitstreams/e93b3c79-7bf9-4687-a1de-6d8477e47928/content)
- **ICAP**（Chi & Wylie 2014, Educational Psychologist 49(4):219–243）假设学习效果 Interactive > Constructive > Active > Passive。
  - Active 指操作部分材料，比如照抄解题步骤、从菜单里选理由。
  - Constructive 指产出材料之外的东西，比如比较、提问、解释。
  - 来源：[ERIC 全文](https://files.eric.ed.gov/fulltext/EJ1044018.pdf)
- 2023 年有文章质疑 ICAP 的层级假设：在高教技术增强环境中的检验没有支持"constructive / interactive 一定优于 passive / active" — [npj Science of Learning 2023](https://www.nature.com/articles/s41539-023-00197-4)

### Inferences
- 【中】分段单位定为一个特征（feature）。特征内部的子动作（选平面 → 画草图 → 加约束 → 拉伸）可以连续播放，但到特征边界自动停住，等学习者点"继续"（learner-paced segment）。这和 CAD 特征树的天然粒度一致，学习者也容易形成"一步 = 特征树里一行"的心智模型。
- 【中】预训练：每个模块开头放 30–90 秒的交互"部件 / 术语卡"，内容是草图平面、轮廓、方向、终止条件、参考几何。在 3D 里点哪个词，哪个就高亮，先把"零件名词"装进脑子，再看操作流程。
- 【中-强】Coherence：教学视口用平光、中性材质，不加环境贴图、景深或花哨转场。和当前步骤无关的面板、工具栏一律隐藏。
- 【中】Signaling 和 contiguity：
  - 被引用的面或边、当前草图、特征树里对应的条目、说明文字里的术语，用同一种颜色联动高亮。
  - 当前特征以外的几何淡化显示。
  - 说明以 3D 注释的形式贴在相关几何旁边，和动作同步出现，不要放在远离视口的侧栏。
- 【中】Modality 和 redundancy：
  - 有旁白时，就用"旁白 + 动画"，不要同时铺满和旁白一字不差的字幕。
  - 网页学习者常常静音，所以字幕要短，只写关键词，最好在动作暂停点出现。
  - Berney & Bétrancourt 发现，不伴随文字时动画优势最大，见 Q3。
- 【中】同一零件族按三段递进：
  1. 完整 worked example：每一步都演示，并附"为什么"注释。
  2. Backward fading：最后 1–2 个特征由学习者自己选类型、选参考、设参数。
  3. 独立重建：只给工程图或目标模型。

  每次只多空一步，学习者在某一步错得多就别再加空（Renkl & Atkinson：错误数是中介）。
- 【中】自我解释：每 2–3 步插一个"为什么"提示，大多数做成一键选择题（Active 级），关键处偶尔做成短输入或"二选一并说理由"（Constructive 级）。内容瞄准设计意图，比如"为什么以中面为草图平面""为什么圆角放到最后"。这是把 fading 的近迁移收益扩展到远迁移的主要手段。
- 【中】专家快速通道：首屏用"第一步诊断"。展示目标零件，问"你会先建哪个特征 / 在哪个平面画第一个草图？"，答对的人直接从渐隐或独立阶段开始。这同时也是一道检索练习。
- 【弱】CAD 学习者同时在学"软件界面"和"建模思路"，负荷容易超载（Barnes & Wiebe 的讨论）。网页上应把软件界面抽象掉，只呈现建模思路，界面操作另作"软件对照"附注（见 Q5）。

#### 综合推论：一节课 / 一个模块的证据化模板（汇总 Q1–Q6，供产品规格参考）

| 维度 | 建议 | 主要依据 | 强度 |
|---|---|---|---|
| 一节课时长 | 有效互动 5–10 分钟；任何连续"只看"的片段（视频或动画）不超过约 3 分钟 | Guo et al. 2014（视频中位观看时长 ≤6 分钟，0–3 分钟参与度最高）；segmenting | 中（参与度证据，不是学习证据） |
| 步骤粒度 | 1 步 = 1 个特征（或 1 个草图加它的约束）；反馈和判分以特征为单位，不按单次点击 | VanLehn 2011：step-based d = 0.76，substep 相对 step 只多 0.16；segmenting | 中 |
| 每节课步数 | 4–8 个特征步骤 | 由分段和时长外推 | 弱 |
| 开场 | 1 题"第一步诊断" + 30–90 秒术语预训练 | Kalyuga & Sweller 2005；Mayer pre-training | 中 |
| 每步循环 | 预测或选择 → 观看/拖动操作（关键视角，可暂停、步进、拖动）→（可选）拖一个参数看变化 → 每 2–3 步一个"为什么"提示 | Hegarty et al. 2003；Höffler & Leutner 2007；Keehner 2008；PhET；Bisra 2018 | 中 |
| 课尾 | 设计意图规则小结 + 3–5 题检索小测（含 1 题特征排序、1 题改参预测），给解释性反馈 | Barbero 2017；Yang 2021；Van der Kleij 2015 | 中-强 |
| 模块递进 | 完整 worked example → 逆向淡出 → 独立重建 + 改参测试（flex test） | Renkl & Atkinson；Atkinson et al. 2003；Johnson & Diwakaran 2011 | 中 |
| 复习 | 约 1 天、1 周、3 周后各复习一次，混入相近的特征类型 | Cepeda 2008；Brunmair & Richter 2019 | 中（材料是外推的） |
| 掌握 | 模块检查点设较高标准，没达标就推送针对性复习；允许测试后跳过 | Kulik 1990；expertise reversal | 中 |

### Gaps
- Mayer 的原则主要来自短时的实验室研究：被试多是大学生，即时测验，材料多是科学原理讲解，没有在 3D CAD 课上直接检验过。不同版本里效应量逐渐变小，说明早期估计偏高。
- Rey 2019 的合并效应量具体数值没拿到。
- CAD 领域的 worked example / fading 对照研究极少。Barnes & Wiebe 2011 只拿到片段，比如"某组在新任务上表现更好"，但摘要被截断，无法确认是哪一组。也没找到 expertise reversal 在 CAD 教学中的直接检验。
- 关于 ICAP 层级假设的争议还没定论。

## 3. 动画 vs 静态、学习者控制（暂停/拖动/步进）与交互仿真（PhET）

### Takeaway
- **动画用在哪里**：当"变化本身就是学习内容"时，动画最有用（总体 g ≈ 0.23–0.37，程序性-动作知识 d = 1.06）。拉伸、旋转、扫掠、圆角、抽壳、阵列、爆炸/装配这些建模操作正是这种情况。但理解结构不一定需要动画：Hegarty 等发现动画不比静态图好，而且"先预测"能取得相当的收益。
- **学习者控制**：暂停、拖动、步进这类控制，在程序性任务里能提高学习效率（Schwan & Riempp）。但作为一般设计手段，它的平均收益接近零（Karich 等）。所以要把控制嵌入分段和任务里，不能指望学习者自己用好。
- **参数探索**：PhET 的 implicit scaffolding 通过 affordance、约束、提示和即时反馈来引导探索，适合做成参数滑块式的"特征参数实验台"。

### Cited Findings
- **Höffler & Leutner 2007**（*Instructional animation versus static pictures: A meta-analysis*，Learning and Instruction 17(6):722–738，26 项研究、76 个比较，覆盖 1973–2003 年）：
  - 动画总体优于静态图，d = 0.37（95% CI 0.25–0.49）。
  - 表征性动画 d = 0.40。
  - 高度写实的动画（如视频）d = 0.76。
  - 学习程序性-动作知识时 d = 1.06（0.72–1.40）。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ780451)
- **Berney & Bétrancourt 2016**（*Does animation enhance learning? A meta-analysis*，Computers & Education 101:150–167，61 个实验、140 个比较）：
  - 总体 g = 0.226（95% CI 0.12–0.33）。
  - 系统控速时 g = 0.309。
  - 配有听觉解说时 g = 0.336。
  - 不伴随任何文字时 g = 0.883。
  - 对 iconic 可视化的优势更大。
  - 来源：[ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0360131516301336)；[UNIGE 开放存档](https://archive-ouverte.unige.ch/unige:92234)
- **Ploetzner, Berney & Bétrancourt 2020** 再分析了上述数据：当动画展示的变化正是要学的内容时，动画比静态图更成功 — [OUCI](https://ouci.dntb.gov.ua/en/works/4NmjKpv7/)
- **Hegarty, Kriz & Cate 2003**（*The roles of mental animations and external animations in understanding mechanical systems*，Cognition and Instruction 21）以抽水马桶水箱机构为材料，做了 3 个实验。
  - 动画没有比静态图带来更好的动态过程理解。
  - 让学生看着静态图预测运动，会调动心理动画（含空间可视化），还能让他们发现自己哪里不懂。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ761566)
- Bétrancourt 在 Cambridge Handbook 的动画与交互章节中总结了相关研究：动画的收益和"让学习者做预测"的收益相当，而且两者不叠加 — [Cambridge Handbook, *The Animation and Interactivity Principles in Multimedia Learning*](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/animation-and-interactivity-principles-in-multimedia-learning/A2BF18381C32F4E852B7CDB0A8B6581B)
- **Schwan & Riempp 2004**（*The cognitive benefits of interactive videos: Learning to tie nautical knots*，Learning and Instruction 14(3):293–305）：学习打航海绳结时，交互视频组（可暂停、变速、重看）达到掌握所需的时间更少。结越难，学习者用控制越多 — [ResearchGate](https://www.researchgate.net/publication/222436104_The_cognitive_benefits_of_interactive_videos_Learning_to_tie_nautical_knots)
- **Hasler, Kersten & Sweller 2007**（*Learner control, cognitive load and instructional animation*，Applied Cognitive Psychology 21(6):713–729）用讲解昼夜成因的动画，设了四组：系统连续播放、学习者控制的分段、学习者控制的暂停/播放、只有旁白。引用文献普遍说，提供暂停能提高迁移成绩，而学习者其实很少用这些控制 — [Semantic Scholar](https://www.semanticscholar.org/paper/Learner-Control-,-Cognitive-Load-and-Instructional-Hasler-Kersten/8719367653bbffac187f8ecb5d5df58ff13bbd2f)
  - 2009 年 Instructional Science 的一篇文章认为，用"减负"来解释学习者控制的好处，数据支持不足 — [Springer, *Learner control in animated multimedia instructions*](https://link.springer.com/article/10.1007/s11251-009-9119-4)
- **Karich, Burns & Maki 2014**（*Updated meta-analysis of learner control within educational technology*，RER 84(3):392–410，18 项研究、29 个效应）：教育技术中学习者控制的总体效应接近零。节奏、时间、顺序、练习、复习这几个成分的效应也都接近零；K-12 略好于大学 — [ERIC](https://eric.ed.gov/?id=EJ1034262)
- **PhET**：
  - Adams et al. 2008 Part I（JILR 19(3):397–419，基于学生访谈）认为，恰当结合交互、动画和情境的仿真能提供很强的学习体验 — [PhET PDF](https://phet.colorado.edu/publications/PhET_Interviews_I.pdf)
  - Part II（JILR 19(4):551–577）讲界面设计。团队遵循据此总结的 "PhET Look and Feel" 规范之后，新仿真很少再出可用性问题 — [Part II PDF](https://search.issuelab.org/resources/1369/1369.pdf)
- **Wieman, Adams & Perkins 2008**（*PhET: Simulations That Enhance Learning*，Science 322:682–683）：据 Semantic Scholar 摘要，有效仿真的一个要素是，学生会像科学家看待实验那样看待仿真 — [Science](https://www.science.org/doi/10.1126/science.1161948)；[Semantic Scholar](https://www.semanticscholar.org/paper/PhET:-Simulations-That-Enhance-Learning-Wieman-Adams/be364fb540067293010bd457631921985dcb490a)
- **Podolefsky, Moore & Perkins**（*Implicit scaffolding in interactive simulations*，arXiv 1306.6544）：
  - implicit scaffolding 用 affordances、constraints、cueing 和 feedback，在没有显式指导的情况下框定并支持学生的探索。
  - 它同时服务情感、过程、内容三类目标，来自 PhET 十年研发和学生访谈。
  - 来源：[arXiv](https://arxiv.org/abs/1306.6544)
  - 相关会议论文题为 "Guiding without feeling guided" — [PhET research](https://phet.colorado.edu/en/research)
- **Brod 2021**（*Predicting as a learning strategy*，Psychonomic Bulletin & Review 28:1839–1847）主张"预测"是一种独立的学习策略。预测出错带来的惊讶，是它区别于其他提取练习的关键机制。但该文只讨论简单的陈述性学习 — [Springer](https://link.springer.com/article/10.3758/s13423-021-01904-1)

### Inferences
- 【中-强】动画只用在"变化就是学习对象"的地方：
  - 草图轮廓扫出实体。
  - 旋转体生成。
  - 圆角沿边"滚"出来。
  - 抽壳把实体掏空。
  - 阵列逐个复制。
  - 布尔切除。
  - 装配体爆炸与归位。

  理解"最终零件长什么样"这类结构内容，用静态多视图加可旋转模型就够了（Hegarty：动画不一定比静态图好）。
- 【中】每个特征动画的时长控制在一个可以一口气看完的长度（大约 10–20 秒，【外推】，没有直接证据），到特征边界自动暂停。控件提供：
  - 播放 / 暂停。
  - 逐子步步进（选平面 → 草图 → 约束 → 生成）。
  - 拖动时间轴，对应 CAD 里的 rollback bar。
  - 0.5× / 1× / 2× 变速。
  - "重放本步"。
- 【中】不要指望控件本身带来学习（Karich ≈ 0），要把控件嵌入任务。比如"拖动时间轴，找到这个孔是在哪一步出现的"，或者"回退到抽壳之前，观察圆角为什么会失败"。
- 【中】预测-揭示：在关键或容易出错的特征播放前，先让学习者预测。形式可以是"结果是 A/B/C 中的哪一个"（缩略图三选一），或者"这个拉伸切除会穿过哪几个面"，然后再播放。因为 Bétrancourt 说预测和动画的收益"不叠加"，所以不必每一步都预测，每节课挑 1–3 个最有信息量的步骤就行。
- 【中】PhET 式参数实验台：
  - 每个特征只开放 1–2 个和学习目标相关的参数滑块，比如拉伸深度、拔模角、圆角半径、阵列数量和间距。
  - 拖动后即时重建（feedback）。
  - 锁住无关参数（constraint），可拖的手柄用发光或箭头提示（cueing）。
  - 让学习者在"玩"的过程中自己发现参数之间的关系，比如圆角半径大于壁厚时会失败。这就是"guiding without feeling guided"。
- 【中】动画播放时，屏幕上的文字只留标签级别，解释放到暂停点或旁白里（Berney & Bétrancourt：不伴随文字时动画优势最大）。
- 【弱】动画信息是瞬时的，看完就没了。所以要始终保留已完成步骤的缩略图或特征树，并提供"上一状态半透明叠加"，方便对比前后差别【外推，基于认知负荷理论中的 transient information 问题】。

### Gaps
- 没找到专门比较"CAD 操作动画 vs 静态步骤图"的对照研究。Höffler & Leutner 中程序性-动作知识的大效应来自哪些具体任务，这次没核实（推测以动作类任务为主）。CAD 操作更偏认知程序，能否同等外推还要验证。
- 学习者控制的研究大多是短时实验，没有直接检验网页 3D 场景里的时间轴拖动和步进控件。
- PhET 的证据大多来自访谈和设计研究，不是大样本 RCT。
- Hegarty et al. 2003 的页码在各来源里不一致（209–249 vs 325–360），引用前需核对。

## 4. 练习与评估：检索、间隔、交错、预测-揭示、即时反馈、排序与找错；CAD 教育中的评估证据

### Takeaway
练习设计里收益最高的组合：
- 短小的检索测验：g ≈ 0.50，测完给纠正性反馈效果更好。
- 间隔复习：最佳间隔约为目标保持期的 5–40%，保持期越长，比例越小。
- 相似特征的交错练习：g ≈ 0.42，类别越相似越有用。
- 解释性反馈：elaborated feedback 0.49，只告诉对错只有 0.05。
- 以特征为单位的步骤级反馈：step-based tutoring d ≈ 0.76。

CAD 评估应该超越"形状对不对"，要检查设计意图和可修改性，也就是改了参数之后模型是否按意图更新。Company/Contero/Otey 的六维质量 rubric，以及 Johnson & Diwakaran 关于"修改时间"的研究，提供了可用的框架。Parsons 式排序（对应特征树排序）和找错练习只有类比证据；找错要等学习者有了一定基础再用。

### Cited Findings
- **Dunlosky et al. 2013**（*Improving Students' Learning With Effective Learning Techniques*，Psychological Science in the Public Interest 14(1):4–58）评估了 10 种学习技术：
  - 高效用（high utility）：practice testing、distributed practice。
  - 中等效用：elaborative interrogation、self-explanation、interleaved practice。
  - 低效用：summarization、highlighting、rereading 等。
  - 文中讨论的研究显示，交错练习在练习阶段表现较差，但在延迟测验上更好。
  - 来源：[PDF](https://www.whz.de/fileadmin/lehre/hochschuldidaktik/docs/dunloskiimprovingstudentlearning.pdf)
- **Donoghue & Hattie 2021**（Frontiers in Education，242 项研究、1,619 个效应、169,179 人）给出：distributed practice d = 0.85，practice testing d = 0.74，interleaved practice d = 0.47 — [Frontiers](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full)
- **Yang et al. 2021**（*Testing (quizzing) boosts classroom learning*，Psychological Bulletin 147(4):399–435，222 项研究、48,478 名学生、573 个效应）：
  - 课堂测验提升成绩 g = 0.499。
  - 测验干预持续时间越长，收益越大。
  - 测后给纠正性反馈，效果更好。
  - 各种题型（匹配、填空等）都有效。
  - 机制包括额外接触、迁移适当加工、动机。
  - 来源：[PubMed](https://pubmed.ncbi.nlm.nih.gov/33683913/)
- **Cepeda et al. 2008**（*Spacing effects in learning: A temporal ridgeline of optimal retention*，Psychological Science 19:1095–1102，1,354 人，26 种"间隔 × 保持期"组合，材料是事实性知识）：
  - 最佳间隔随保持期变长而变长，但占保持期的比例从约 20–40%（保持 1 周）降到约 5–10%（保持 1 年）。
  - 实测的最佳间隔：保持期 7 / 35 / 70 / 350 天，对应间隔 1 / 11 / 21 / 21 天。
  - 和 0 天间隔相比，最佳间隔让最终回忆提高 64%。
  - 来源：[SAGE](https://journals.sagepub.com/doi/10.1111/j.1467-9280.2008.02209.x)；[ERIC 全文](https://files.eric.ed.gov/fulltext/ED505660.pdf)
- **Brunmair & Richter 2019**（*Similarity matters: A meta-analysis of interleaved learning and its moderators*，Psychological Bulletin 145(11):1029–1052）：
  - 交错学习总体 g = 0.42（据 Visible Learning：59 项研究、8,466 人、238 个效应）。
  - 数学任务只有小效应，词语材料是中等的负效应，人工物体图片是小到中等的正效应。
  - 类别之间越相似，交错越有益。
  - 来源：[Semantic Scholar](https://www.semanticscholar.org/paper/Similarity-matters:-A-meta-analysis-of-interleaved-Brunmair-Richter/bb5392e8eaf53a38cc0d147f301cce74cecb4436)；[Visible Learning](https://www.visiblelearningmetax.com/influences/view/interleaved_practice)；[Kang 的解读](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-interleaved-training-and-category-learning-kang.pdf)
- **Van der Kleij, Feskens & Eggen 2015**（*Effects of feedback in a computer-based learning environment on students' learning outcomes*，RER 85(4):475–511）研究计算机环境中的题目级反馈：
  - 解释性反馈（elaborated feedback，EF）g = 0.49。
  - 给出正确答案（KCR）g = 0.32。
  - 只告诉对错（KR）g = 0.05。
  - EF 对高阶学习结果尤其有效。
  - 延迟反馈和较小的效应量相关；但"即时反馈利于低阶、延迟反馈利于高阶"这个交互作用不显著。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ1081708)
- **VanLehn 2011**（*The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems*，Educational Psychologist 46(4):197–221）：
  - step-based 辅导系统相对无辅导 d = 0.76（28 次比较）。
  - 人类辅导 d = 0.79。
  - substep-based 相对 step-based 只多 0.16（11 次比较）。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ946764)；[VanLehn 讲稿](https://educationgroup.mit.edu/HHMIEducationGroup/wp-content/uploads/2011/02/VanLehnPresentationSlides.pdf)
  - 一项较新的 K-12 ITS 元分析转述：answer-based 系统约 g = 0.31；该研究自己估计的总体效应更小（g = 0.271） — [arXiv 2025](https://arxiv.org/pdf/2511.04997)
- **Parsons problems**（把打乱的代码行拖成正确顺序）：
  - Ericson, Margulieux & Rick 2017（Koli Calling '17）比较了解 Parsons 题、改错和写代码三种练习。后续文献概括为：Parsons 题通常更快做完，学习收益相当 — [ITiCSE 工作组报告 *Parsons Problems and Beyond*](https://dl.acm.org/doi/abs/10.1145/3571785.3574127)
  - 积木式编程研究中，Parsons 题的用时约为等价编程题的一半，而且它的效果不只是"帮学生避开语法错误" — [Zhi et al. 2019](https://dl.acm.org/doi/10.1145/3291279.3339419)
- **找错 / 错误例（erroneous examples）**：Große & Renkl 2007（*Finding and fixing errors in worked examples*，Learning and Instruction 17:612–634）发现：
  - 正确解和错误解混合呈现，只对先验知识较好的学习者促进远迁移。
  - 先验知识差的学习者只看正确解更好。
  - 实验 2 复现了这个交互效应。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ780439)
- **CAD 模型质量**：Company, Contero, Otey & Plumed 2015（*Approach for developing coordinated rubrics to convey quality criteria in MCAD training*，Computer-Aided Design 63:101–117）主张在 MCAD 培训全过程用"相互协调的 rubrics"传达质量标准，并尽早让学员接触模型质量。质量维度通常列为 validity、completeness、consistency、conciseness、simplicity（也有写作 clarity）和 design intent 的传达 — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0010448514002309)；[ResearchGate](https://www.researchgate.net/publication/272398846_Approach_for_developing_coordinated_rubrics_to_convey_quality_criteria_in_MCAD_training)
- **设计意图的定义**：Otey、Company、Contero、Camba 把设计意图描述为模型在被修改时的预期行为，并指出它只是模型质量的一个维度。后续文献还引用 STEP Part 108 的定义 — [ASEE PEER, *A Review of the Design Intent Concept in the Context of CAD Model Quality Metrics*](https://peer.asee.org/a-review-of-the-design-intent-concept-in-the-context-of-cad-model-quality-metrics)；[Otey et al. 2018, CAD&A](https://www.researchgate.net/publication/318807581_Revisiting_the_design_intent_concept_in_the_context_of_mechanical_CAD_education)
- **可调 rubric 与自评**：
  - Company et al. 2017（*Web-based system for adaptable rubrics: Case study on CAD assessment*，ET&S 20(3):24–41） — [ResearchGate](https://www.researchgate.net/publication/317169762_Web-Based_System_for_Adaptable_Rubrics_Case_Study_on_CAD_Assessment)
  - Agost et al. 2022（IJTDE 32:1393–1411）：用基于计算机的可调资源做形成性自评 — [Springer](https://link.springer.com/article/10.1007/s10798-020-09651-5)
- **Johnson & Diwakaran 2011**（*An educational exercise examining the role of model attributes on the creation and alteration of CAD models*，Computers & Education 57(2):1749–1761）是一项用 SolidWorks 和 Pro/ENGINEER 做的课堂练习：
  - 学生对模型质量和直观性的感知，与特征复用量正相关。
  - 正确传达设计意图，与设计保留正相关，与修改时间负相关。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ925816)
- 现有 CAD 质量检测工具基本不支持"设计意图"这类高阶语义质量 — [*A Survey on 3D CAD model quality assurance and testing tools*](https://arxiv.org/pdf/1611.01765)
- 一项 MCAD 自动评估工具研究指出，大多数 CAD 教学实践培养的是陈述性知识和特定的程序性命令知识（"这个工具怎么用"），而不是策略性知识；该研究给出了能同时评估两类知识的工具 — [PMC, *Auto-assessment tools for mechanical computer aided design education*](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6820095/)

### Inferences
- 【中】题型库及各自的证据映射：

| 题型 | 学习者做什么 | 依据 | 何时开放 |
|---|---|---|---|
| 识别 | 看几何，选特征类型或关键参数 | 检索练习（Yang 2021） | 第一课起 |
| 预测-揭示 | 给出特征树和参数，选结果缩略图，再播放验证 | Hegarty 2003；Brod 2021 | 第一课起 |
| 特征树排序（Parsons 式） | 把打乱的特征拖成能重建的顺序，含 1–2 个干扰项（如放在抽壳之前会失败的圆角）；系统真按学习者给的顺序重建，显示成功或失败的位置 | Parsons 类比（Ericson 2017；Zhi 2019） | 学完该零件族的 worked example 后 |
| 改参测试（flex test） | 预测"把 40 改成 60 后，哪种建模方式会按意图更新"，再实际改参看结果 | 设计意图定义（Otey）；Johnson & Diwakaran 2011 | 渐隐阶段起 |
| 找错 / 诊断 | 指出改参后崩溃的模型里哪个参考选错了 | Große & Renkl 2007（仅适合有基础者） | 模块后半；初学者版本先高亮出错位置 |
| 空间题 | 截面、三视图、旋转 | Sorby；Cohen & Hegarty | 空间轨道与复习中 |

- 【中-强】反馈：
  - 以特征为单位，即时给出。
  - 给解释（EF），不要只说对错。解释要可视化：在 3D 里高亮出问题的参考面或边，并配一句原因，比如"这个草图参考了圆角生成的边，圆角一改，参考就丢了"。
  - 给出正确答案后，让学习者再做一次同类题，把 KCR 变成再次检索。
- 【中】排序题和改参题的最大优势：系统可以"真的重建一遍"给学习者看，反馈天然就是解释性的，而且是学习者自己行动的后果。这应该是本站相对视频课的核心差异化练习。
- 【中】间隔复习：如果目标是让学习者在 1–3 个月后还记得，复习可以排在学完约 1 天、约 1 周、约 3 周（Cepeda 的 35–70 天保持期对应 11–21 天的最佳间隔），复习题从全站题库里抽。
- 【中】交错：新特征第一次学时用 blocked 方式（同一特征连做几题）。复习时把容易混淆的特征混在一起出题，例如：
  - extrude / revolve / sweep / loft
  - fillet / chamfer
  - cut / hole
  - linear / circular pattern / mirror
  - shell / offset

  题干要求学习者先判断"该用哪种特征"再作答（Brunmair & Richter：类别相似时交错最有益）。
- 【中】自动评分维度借用 Company 六维中能自动化的部分：
  - 有效性：重建不报错。
  - 完整性：与目标几何的偏差在阈值内。
  - 简洁性：特征数和冗余特征。
  - 设计意图：一组预设改参后，模型的期望行为是否成立。

  后两项是相对"只比对最终形状"的关键升级。
- 【弱】掌握检查点用"多题型组合"，比如 1 道识别、1 道排序、1 道改参，比单一选择题更能防止"形状对了但思路错了"【外推】。

### Gaps
- 没找到"Parsons 式特征树排序"在 CAD 教育中的直接实证，目前的支持完全来自编程教育的类比。
- Cepeda 等的间隔研究用的是事实性材料，对程序性 CAD 技能的最佳间隔不清楚。
- Company、Contero、Otey 等的 rubric 研究以教学设计加课堂案例为主，这次没拿到量化效应。Johnson & Diwakaran 是相关研究，不能推出因果。
- 检索摘要提到 Durkin & Rittle-Johnson 2012（小数）报告低先验学习者也能从对比错误例中受益，和 Große & Renkl 2007 相左，但这次没核实原文。
- 线索（只看到题录）：*Parametric Feature-Based Solid Model Deficiency Identification to Support Learning Outcomes Assessment in CAD Education*（ASEE，[ResearchGate](https://www.researchgate.net/publication/343116194_Parametric_Feature-Based_Solid_Model_Deficiency_Identification_to_Support_Learning_Outcomes_Assessment_in_CAD_Education_Full_Paper)），可能对"模型缺陷自动识别"有直接参考价值。
- 关于"即时 vs 延迟反馈"，Van der Kleij 的交互不显著，有一篇较新的反馈时机元分析可以补查（[Springer, EPR 2026](https://link.springer.com/article/10.1007/s10648-026-10117-8)），这次没读。

## 5. CAD 的策略性知识 vs 命令（按钮）知识，以及跨软件迁移

### Takeaway
各项证据一致指向一个结论：CAD 用户即使有多年经验，也常用低效的策略，原因是缺策略性知识，而不是缺命令知识。策略性知识要显式地教，而且能在有限时间内教会，还不损害命令知识（Bhavnani 等）。CAD 教学文献（Chester、Hamade、Barbero、Garikano）把专长拆成陈述性、程序性（这两类合称"命令"知识）和策略性三类，其中"建模计划"的认知成分更大。显式讲解"设计意图规则小结"能显著提升建模质量。跨软件迁移方面，没找到直接测量的同行评审研究，只有"策略具有通用性"的论证和业界的个人经验。

### Cited Findings
- **Bhavnani, John & Flemming 1999**（*The strategic use of CAD: an empirically inspired, theory-based course*，CHI '99）：高效使用 CAD 所需的策略性知识既没被定义，也没人显式地教；它应该显式化，并在培训早期就提供。一项对照实验（和传统的按命令教学相比）显示，有些策略确实要显式训练才学得会 — [Semantic Scholar](https://www.semanticscholar.org/paper/The-strategic-use-of-CAD:-an-empirically-inspired,-Bhavnani-John/fa22c0133f273d5e77cae77cd8a4c652b921717c)
- Bhavnani 等对真实 CAD 使用的研究发现，即使有多年经验，用户做复杂 CAD 任务时仍倾向用次优策略。另外，光靠好的界面设计无法带来高效使用 — [Bhavnani & John 书章](https://skbhavnani.com/papers/Bhavnani_and_John-Ch-5.pdf)；[Semantic Scholar](https://www.semanticscholar.org/paper/The-strategic-use-of-CAD:-an-empirically-inspired,-Bhavnani-John/fa22c0133f273d5e77cae77cd8a4c652b921717c)
- **Bhavnani, Reif & John 2001**（*Beyond command knowledge: identifying and teaching strategic knowledge for using complex computer applications*，CHI '01, pp. 229–236）：高效且通用（general）的策略可以在有限时间内教给背景各异的学生，而且不损害他们的命令知识。经验丰富的用户之所以低效，是因为缺乏光靠会用命令难以获得的策略性知识 — [ACM DL](https://dl.acm.org/doi/10.1145/365024.365107)
- **Chester 2007**（*Teaching for CAD expertise*，IJTDE 17:23–35）讨论命令知识和策略知识的区别如何关系到 CAD 专长的形成，并报告了一项教学实验。他的专长模型包括陈述性、程序性（两者同属"命令"域）和策略性知识 — [Springer](https://link.springer.com/article/10.1007/s10798-006-9015-z)
  - 2022 年的一项访谈研究转述 Chester 的观察：很多学生卡在学软件命令上，而不是去寻找解决问题的不同方案 — [IJTDE 2022, *Teach to use CAD or through using CAD*](https://link.springer.com/article/10.1007/s10798-022-09770-1)
- **Hamade, Artail & Jaber 2005**（*Learning Theory as Applied to Mechanical CAD Training of Novices*，IJHCI 19(3):305–322）：Pro/ENGINEER 新手培训的学习曲线符合经典学习曲线理论，可以分解为陈述性和程序性两个分量，两者都是高度认知性的 — [Taylor & Francis](https://www.tandfonline.com/doi/abs/10.1207/s15327590ijhc1903_2)
- **Hamade, Jaber & Sikström**（*Analyzing CAD competence with univariate and multivariate learning curve models*，Computers & Industrial Engineering，16 周追踪）：
  - 陈述性知识是"点哪个图标、定义哪些参数"。
  - 程序性知识是"怎样制定建模计划或策略"。
  - 程序性技能的认知成分比陈述性知识更大。
  - 随着知识积累，学员用的特征更少但更复杂，绩效随之提高。
  - 来源：[ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0360835208002362)；[Academia.edu](https://www.academia.edu/49850254/Analyzing_CAD_competence_with_univariate_and_multivariate_learning_curve_models)
- **Barbero, Pedrosa & Samperio 2017**（*Learning CAD at university through summaries of the rules of design intent*，IJTDE 27:481–498）的研究对象是 Burgos 大学机械工程学生。
  - 研究者把多位作者提出的设计意图规则融入建模练习。
  - 只有实验组在实践课上额外讲解了"每个练习的设计规则小结"。
  - 实验组的 3D 建模成绩和设计意图变量都显著更好。设计意图变量含 skeleton、structures、alterations、constraints 四部分。
  - 来源：[Springer](https://link.springer.com/article/10.1007/s10798-016-9358-z)；[ERIC](https://eric.ed.gov/?id=EJ1152230)
- **Garikano, Garmendia, Manso & Solaberrieta**（*Strategic knowledge-based approach for CAD modelling learning*，IJTDE）：在参数化特征建模中，策略性知识是能否传达设计意图的区分因素，但培训里很少涉及。他们提出情境化的主动学习活动，按一套"建模程序"引导学员思考建模理由、考虑替代策略。结果（定性）支持这种方法有利于发展策略性知识 — [Springer](https://link.springer.com/article/10.1007/s10798-018-9472-1)
- **适应性专长**（Yalvaç, Öztürk, Johnson, McGary，ASEE，NSF 资助项目）：适应性专长高的学生用了更多参考几何、更多镜像和阵列，原点设置更正确，也更可能选对特征顺序。情境化练习对提升适应性专长和 CAD 技能有正向作用 — [ASEE PEER PDF](https://peer.asee.org/analysis-of-contextual-computer-aided-design-cad-exercises.pdf)
- 一篇项目式学习论文总结四年的经验：讲授简单的理论概念能改善学生对参数化 CAD/CAE 工具的理解，并让命令知识和策略知识更平衡 — [Springer 2020](https://link.springer.com/article/10.1007/s12008-020-00687-4)
- **跨软件迁移**：检索只找到厂商的迁移培训（如 Creo ↔ SolidWorks）和用户论坛里的个人经验，比如有人说过渡很容易，有人说完全是硬着头皮自学，没有同行评审的测量研究 — [Design Engine](https://design-engine.com/creo-to-solidworks-or-solidworks-to-creo/)；[Siemens NX 社区帖](https://community.sw.siemens.com/s/question/0D54O0000790CLkSAM/what-helped-you-learn-how-to-use-nx-move-from-another-cad-system-we-want-to-hear-from-you-user-survey)
- 一篇 2025 年 CAD&A 论文在比较 CAD 教学中的陈述性知识和策略性知识时说，这个领域正转向对"超越软件边界的设计原则"的整体理解（这次只看到检索片段，全文抓取超时） — [CAD&A 22(2), 2025](https://cad-journal.net/files/vol_22/CAD_22%282%29_2025_150-179.pdf)

### Inferences
- 【中-强】课程目标的优先级：概念（特征语义、参数化与约束）> 策略（建模顺序、参考选择、设计意图）> 软件命令（只作附注）。每个操作先以软件中立的概念呈现，再在侧栏给出"在 SolidWorks / Fusion / Onshape / FreeCAD 里叫什么、在哪"的对照。
- 【中】每节课显式教 1–2 条策略规则，并在课尾用"设计意图规则小结"收束（Barbero 2017 的做法）。规则示例（具体条目由内容调研确定）：
  - 先做基体、后做细节，圆角和倒角放到最后。
  - 尽量参考基准面和原点，而不是容易变化的生成边。
  - 对称件以中面为基准，用镜像。
  - 重复特征用阵列。
- 【中】在拆解（teardown）里加入"策略对比"：
  1. 同一个零件给出两棵不同的特征树。
  2. 让学习者先预测，再做改参测试。
  3. 看哪一棵能按意图更新，哪一棵会断。

  这把 Bhavnani 说的"必须显式教"的策略，变成了可以观察的后果（设计意图 = 修改时的预期行为）。
- 【中】衡量学习者进步不要只看"做出来了没有"。可以加两类指标：特征数是否更精简、选得是否恰当（Hamade：专长增长时，用的特征更少但更复杂），以及改参鲁棒性。
- 【弱】在营销和课程描述里，不要承诺"学完就能在任何软件上上手"，因为跨软件迁移缺乏证据。可以说的是"教的是各软件通用的建模思路"，这一点有 Bhavnani 关于"通用策略"的论证支持。

### Gaps
- 跨 CAD 软件迁移是一个重要缺口：没找到直接研究。Johnson & Diwakaran 2011 同时用了 SolidWorks 和 Pro/E，但这次没拿到分软件的比较结果。可以去查编程语言迁移研究作类比，这次没检索。
- Chester 2007 实验的样本和效应量没拿到。Bhavnani 2001 的量化结果也没拿到：PDF 抓到的是无法解析的二进制。
- Barbero 2017 只拿到"显著提升"的结论，样本量和效应量没拿到。
- 策略教学对网页上的自学者是否有效，没有直接证据，现有研究都是课堂场景。
- 线索（只看到题录）：*From Learning to CAD to CADing to Learn: Teaching the Command, Strategic, and Epistemic Dimensions of CAD Software*（[ResearchGate](https://www.researchgate.net/publication/344817936_From_Learning_to_CAD_to_CADing_to_Learn_Teaching_the_Command_Strategic_and_Epistemic_Dimensions_of_CAD_Software)）。

## 6. 自定进度在线学习的参与度与动机：进度可视化、掌握学习、微课与游戏化的注意事项

### Takeaway
在自定进度的在线学习里，最可靠的"留住学习者"手段和最有效的学习手段大体重合：
- 短小的分段：视频数据显示中位观看时长 ≤6 分钟。
- 掌握学习：ES ≈ 0.52，掌握标准越高越好。
- 频繁的低风险小测：g ≈ 0.50。
- 清晰的进展反馈。

需要注意的几点：
- 游戏化平均有小到中等的正效应（认知 g = 0.49），但结果差异很大；以排行榜和徽章作奖励的设计可能降低内在动机和成绩。
- 进度条如果"先慢后快"，中途退出会增加。
- 学习者控制本身没有平均收益，适合"推荐路径 + 测试后跳过"。

### Cited Findings
- **Guo, Kim & Rubin 2014**（*How video production affects student engagement: An empirical study of MOOC videos*，L@S '14）分析了 edX 上 4 门课、690 万次观看：
  - 视频长度是参与度最显著的指标。
  - 不管视频多长，中位观看时长最多约 6 分钟。
  - 0–3 分钟的视频参与度最高，超过 9 分钟的很少有人看完。
  - 作者建议在制作前就把内容切成 6 分钟以内的块。
  - 局限：衡量的是观看时长和是否尝试课后题，不是学习结果。
  - 来源：[ACM DL](https://dl.acm.org/doi/10.1145/2556325.2566239)；[PDF](https://summeracademy.academic.wlu.edu/files/2020/07/Guo-et-al-2014-videos-and-student-engagement.pdf)
- **Kulik, Kulik & Bangert-Drowns 1990**（*Effectiveness of Mastery Learning Programs: A Meta-Analysis*，RER 60(2):265–299）汇总 108 项对照评估：
  - 其中 103 项考试成绩的平均 ES = 0.52，约等于从第 50 百分位升到第 70 百分位。
  - 掌握标准高的项目更有效。
  - 低能力学生收益更大。
  - 效果是持久的。
  - 来源：[PDF](https://www.uky.edu/~gmswan3/575/kulik_kulik_Bangert-Drowns_1990.pdf)
  - Kulik & Fletcher 转述：在自编测验上效应为 0.57，在标准化测验上只有 0.29 — [ResearchGate](https://www.researchgate.net/publication/277636218_Effectiveness_of_Intelligent_Tutoring_Systems_A_Meta-Analytic_Review)
- **Sailer & Homner 2020**（*The Gamification of Learning: a Meta-Analysis*，EPR 32:77–112）：
  - 游戏化对认知结果 g = 0.49（k = 19，N = 1,686），对动机 g = 0.36（k = 16，N = 2,246），对行为 g = 0.25。
  - 认知效应在方法严谨的研究子集中依然稳定；动机和行为效应则不稳定。
  - 对行为结果，游戏叙事（game fiction）和社交互动是显著的调节变量，"竞争 + 合作"组合尤其有效。
  - 来源：[ERIC](https://eric.ed.gov/?id=EJ1245270)
- **Hanus & Fox 2015**（*Assessing the effects of gamification in the classroom*，Computers & Education 80:152–161）在一个 16 周学期里对比了两门课，每门课测了 4 次。用排行榜加徽章的游戏化课程，学生的内在动机、满意度和期末成绩都更低；内在动机中介了课程类型对期末成绩的影响 — [ResearchGate](https://www.researchgate.net/publication/265644737_Assessing_the_effects_of_gamification_in_the_classroom_A_longitudinal_study_on_intrinsic_motivation_social_comparison_satisfaction_effort_and_academic_performance)；[澳大利亚教育部摘要](https://www.education.gov.au/australian-curriculum/national-stem-education-resources-toolkit/i-want-know-about-stem-education/different-kinds-stem-education-initiatives/gamification)
- **Villar, Callegaro & Yang 2013**（*Where Am I? A Meta-Analysis of Experiments on the Effects of Progress Indicators for Web Surveys*，Social Science Computer Review 31(6):744–762）汇总了 32 个随机实验：
  - 匀速的进度指示器不能显著降低中途退出。
  - "先快后慢"的指示器降低退出，"先慢后快"的增加退出。
  - 局限：场景是网络问卷，不是学习。
  - 来源：[City Research Online](https://openaccess.city.ac.uk/id/eprint/14427/)
- 教育技术中学习者控制的平均效应接近零（Karich et al. 2014，见 Q3） — [ERIC](https://eric.ed.gov/?id=EJ1034262)
- 动机是课堂测验效应的机制之一（Yang et al. 2021，见 Q4） — [PubMed](https://pubmed.ncbi.nlm.nih.gov/33683913/)

### Inferences
- 【中】微课：每节有效互动 5–10 分钟，任何连续"只看"的片段不超过约 3 分钟。交互 3D 课的学习者一直在动手，可以比纯视频稍长，但没有直接数据，上线后要用自己的完成率曲线来校准【外推】。
- 【中】进度可视化：
  - 用"技能 / 特征掌握地图"代替单一百分比，比如拉伸已掌握、旋转 70%、扫掠未开始，让进度反映掌握程度而不只是"看过了"。
  - 全站或模块级进度条要保证前期推进快：先排短课，避免冗长的引言和注册流程（Villar：先慢后快会增加退出）。
- 【中】掌握学习：
  - 模块检查点用较高标准（如 80–90%，具体阈值要经验校准）来判定"已掌握"。
  - 没达标时，推送针对性复习，同时允许继续往前走，兼顾自定进度的自主感【外推】。
  - Kulik 发现低能力学生收益更大，这正是"复习推送"要服务的人群。
- 【中】游戏化：
  - 可以用积分、完成徽章作为信息性反馈（告诉学习者"你掌握了什么"）。
  - 避免以公开排行榜和"拿徽章换奖励"作主要驱动（Hanus & Fox）。
  - 需要社交时，优先用协作或"竞争 + 合作"的形式，比如社区里共同完成一个拆解的改参挑战（Sailer & Homner 的调节变量）。
- 【中】默认给推荐路径，再配"测试后跳过"（第一步诊断或模块前测）。这样既减少专家的无聊（expertise reversal），又不把顺序完全交给学习者（Karich：学习者控制约等于 0）。
- 【弱】提醒和复习通知的节奏与 Q4 的间隔复习对齐（1 天 / 1 周 / 3 周），让"回访"本身就是一次检索练习，而不只是营销推送【外推】。

### Gaps
- 连续打卡（streak）、推送提醒等常见 App 机制对学习效果的同行评审证据，这次没检索到。
- 微课（microlearning）本身的元分析没检索；目前的依据来自分段原则和视频参与度数据。
- 交互 3D 课的最佳时长没有直接数据，Guo 的数据来自被动观看视频。
- 掌握学习的大部分证据来自 1970–80 年代的课堂研究，和今天自定进度网页产品的情境差别很大。
