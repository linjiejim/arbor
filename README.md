# FeatureTree · 工业建模互动课

看懂每一个特征是怎么长出来的。

FeatureTree 是一个中文、讲概念、不绑定软件的 3D 工业建模学习网站。每个建模概念配一个能亲手操作的 3D 场景；真实零件按特征树一步步重建，几何由 OpenCascade 内核算出，每个面都标明是哪一步生成或修改的。

## 有什么

| 板块 | 内容 |
| --- | --- |
| 互动课 `/lesson/:id` | 18 节，覆盖坐标与视图、基准面、三视图、剖视、草图约束、旋转、阵列、圆角、扫掠放样、特征树、装配自由度、3D 打印、钣金、注塑拔模、曲率连续和斑马纹。一步一个概念：视角自动转到该看的地方，任务在 3D 里完成（点平面、拖角点、拉箭头、拖剖切面），关键处先猜再看，最后是带解释的小测。 |
| 案例拆解 `/teardown/:id` | 7 个零件（马克杯、积木砖、两种做法的小盒子、键帽、直齿轮、温湿度计底壳）和 2 个装配（桌面温湿度计、带铰链盒子）。零件按特征树回滚、播放；新生成的面蓝色、被修改的面橙色；每一步的 build123d 代码；参数沙盒里每组参数都在内核里算过，失败的组合不隐藏，并解释为什么失败。装配可以爆炸、按装配顺序播放、剖切，保留自由度的零件可以拖动。 |
| 练习 `/practice` | 特征树排序（检查哪里会重建失败、哪里伤了设计意图）；改参预测（先猜，再看内核的结果）。 |
| 学习路径 `/learn` | 6 条轨、96 节课的大纲，按人群给入口，已有互动内容的课可以直接进入；到期复习（1 天 / 1 周 / 3 周）。 |
| 工具图鉴 `/atlas` | 18 个建模命令：悬停回放生成过程，抽屉里调参数，8 个软件的官方中文叫法。 |
| 术语表 `/glossary` | 命令对照表和 24 张概念卡。 |

当前进度、验证结果、已知局限和开源前清单见 [`docs/report.md`](docs/report.md)。

## 目录

```
app/                 网站：React 19 + Vite 8 + TypeScript + Tailwind v4 + three.js r187
  src/three/         轻量 CAD 视口引擎：按需渲染、主题配色、视图方块、剖切、烘焙模型加载
  src/content/       课程（lessons/）、命令与术语、课程大纲、练习规则
  public/models/     烘焙好的模型（manifest.json + 每组参数一个 GLB）
models/              build123d 模型源码和烘焙器 ftbake
docs/
  report.md          完成报告：做了什么、怎么验证、局限、下一步
  research/          调研报告和 6 份原始笔记
  proposal.md        原型方案
  DESIGN.md          设计规范（基于 jim-uiux）
  dev/               写课程、写模型的说明
  deploy.md          部署
spikes/              浏览器内 OCCT 内核（replicad）实测
```

## 开发

```bash
cd app
npm install --registry=https://registry.npmmirror.com   # 本机代理慢时 npmjs 会卡住
npm run dev        # http://localhost:5287
npm run check      # 类型检查 + lint + 设计守卫 + 单元测试
npm run build
```

改了 `models/` 才需要 Python：

```bash
python3 -m venv .venv && .venv/bin/pip install -r models/requirements.txt
cd app && npm run bake
```

- 写一节课：`docs/dev/lesson-authoring.md`
- 写一个拆解模型：`docs/dev/models.md`

## 技术取舍

- **几何离线烘焙，不在浏览器里跑内核。** 实测 replicad（OpenCascade 的 WebAssembly 版）压缩后 4.6 MB，内存会涨到约 1 GB，随机参数下约 30% 的组合会失败（`docs/research/notes/kernel_spike.md`）。所以模型用 build123d 写一份，离线把每个特征、每组沙盒参数都算好，网页只下载看到的那一份 GLB。
- **课程里的示意几何是程序化的。** 拉伸、旋转、圆角这些演示用 three.js 直接生成，参数一拖就变；草图约束课用 FreeCAD 的求解器 planegcs（WebAssembly）。
- **设计系统** 基于 [jim-uiux](https://design.linjiejim.com)，强调色「工程蓝」，亮暗两套。

## 许可

尚未确定（见 `docs/report.md` 的开源前清单）。

## 第三方

three.js（MIT）、React（MIT）、build123d（Apache-2.0）、OpenCascade / OCP（LGPL-2.1，仅离线使用）、@salusoft89/planegcs（LGPL，作为独立 wasm 文件加载）、Inter 与 JetBrains Mono（OFL）、Lucide（ISC）。
