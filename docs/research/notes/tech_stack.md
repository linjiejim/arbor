# 3D 工业建模交互学习网站：浏览器技术栈与架构选型调研（截至 2026-11-04）

> 口径说明：【实测】指本次（2026-11-04）从 npm 下载 tarball 到临时目录后测得的数据：原始字节用 `stat`，压缩体积用 `gzip -9` 和 `brotli -q 11`；API 事实来自直接读取包内的 `.d.ts` 或源码。全程未执行任何下载来的代码。【声称】指项目方、作者或文档给出的数字。【第三方】指他人在博客或 issue 里的报告。npm 和 GitHub 元数据于 2026-11-04 通过 `npm view` 与 GitHub API 查询。部分包经 npmmirror 镜像下载，镜像 tarball 与 npmjs 上同版本的 tarball 一致，下文仍给出 npmjs 链接。CDN 实际使用的压缩级别通常低于 `-q 11`，真实传输体积会略大于表中的 brotli 数字。

## 1. three.js：当前版本与发版节奏、WebGPU 渲染器成熟度、CAD 风格渲染技巧、多视图方案、R3F/drei 现状

### Takeaway
three.js 当前版本是 r187（three@0.187.0，2026-10-30 发布）。2026 年发版节奏放缓到约 6–10 周一版。WebGPURenderer 已可以用于新项目，浏览器不支持时会自动回退到 WebGL 2。但 CAD 渲染依赖的生态大多仍以 WebGL 为主，包括 N8AO、pmndrs/postprocessing、three-cad-viewer，以及 drei 里会改写 shader 的组件。R3F v10（WebGPU 优先）还处在 alpha 阶段。对 2026 年底启动的课程站，建议把 WebGLRenderer + R3F v9 作为基线，用单一 canvas 加 scissor（drei `<View>`）承载页面上的多张小图，把 WebGPU 留作 2027 年的升级路径。

### Cited Findings
**版本与节奏**
- npm 上 three 的最新版是 0.187.0（r187），2026-10-30 发布。GitHub 上的 r187 release 同日发布，内容包括移除 r177 中已弃用的代码，以及 `EdgesGeometry` 改用 Map 做边查找（#34805）。来源：[npm three](https://www.npmjs.com/package/three)；[r187 release](https://github.com/mrdoob/three.js/releases/tag/r187)
- 根据 npm 的 time 元数据，2026 年各版发布日期如下：r183 2026-02-18，r184 2026-04-16，r185 2026-06-25（0.185.1 于 07-01），r186 2026-09-08（0.186.1 于 09-24），r187 2026-10-30。作为对比，2025 年从 r173（01-31）到 r180（09-03）基本每月一版，r181 为 2025-10-31，r182 为 2025-12-10。来源：[npm registry: three](https://registry.npmjs.org/three)
- 仓库健康度：117,555 stars，394 个 open issues，2026-11-04 仍有推送。2026-08-04 以来默认分支提交至少 100 次（100 是 API 单页上限）。来源：[GitHub mrdoob/three.js](https://github.com/mrdoob/three.js)（GitHub API）
- 【实测】r187 的 `build/` 目录已不再提供 `*.min.js`，只有 `three.core.js`、`three.module.js`、`three.webgpu.js`、`three.tsl.js` 等文件，其中 `three.module.js` 与 `three.webgpu.js` 都从 `three.core.js` 导入。以下是未压缩、未经 tree-shake 的体积。来源：[three-0.187.0.tgz](https://registry.npmjs.org/three/-/three-0.187.0.tgz)

  | 文件 | 原始字节 | gzip | brotli |
  |---|---|---|---|
  | three.core.js | 1,474,799 B | 290 KB | 211 KB |
  | three.module.js | 658,900 B | 129 KB | 103 KB |
  | three.webgpu.js | 1,350,894 B | 265 KB | 193 KB |

**WebGPU 渲染器成熟度**
- 【第三方】Utsubo 梳理的各版本与 WebGPU 相关的变化如下。来源：[Utsubo: three.js 2026 what changed](https://www.utsubo.com/blog/threejs-2026-what-changed)
  - r171（2024-11-29）引入 `three/webgpu` 与 `three/tsl` 入口。
  - r183 加入 reversed depth buffer，`WebGLCubeRenderTarget` 不再能用于 WebGPURenderer。
  - r184 起 `compileAsync()` 不再阻塞渲染。
  - r185 为 WebGPURenderer 加入 WebXR 和 clustered（Forward+）光照。
  - r186 加入 `compileComputeAsync()` 和带级联阴影的 `SunLight`。
  - 文章建议新项目直接用 WebGPURenderer。老项目每次迁移不要超过 10 个版本。如果只是为了提速，迁移前应先 profile，论坛上有 WebGPU 比 WebGL 更慢的场景报告。
- 【第三方】同一篇文章给出的浏览器支持情况如下，不支持的浏览器会自动回退到 WebGL 2。来源：[Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
  - Chrome/Edge：113 起支持 Windows、macOS、ChromeOS。Linux 自 144 起支持 Intel，自 147 起支持 NVIDIA Wayland。
  - Chrome Android：121 起支持 Android 12 及以上。
  - Firefox：Windows 自 141 起，macOS 26 Apple Silicon 自 145 起。Linux 与 Android 仍需开 flag。
  - Safari：26（2025-09）起支持 macOS、iOS、iPadOS、visionOS。
  - 另一篇文章称 WebGPU 已于 2026 年 1 月进入 "Baseline"（[vr.org](https://vr.org/articles/webgpu-baseline-2026-three-js-webxr-default)）。这与 Utsubo 所说 Firefox 在 Linux/Android 上仍需 flag 有出入。
- 【第三方】迁移要点。来源：[Utsubo 迁移清单](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
  - 需要从 `three/webgpu` 引入，GLSL 需改写为 TSL，后处理改用节点式管线，并且要先 `await renderer.init()`。
  - drei 中会改 shader 的组件（如 `Text`）和 `@react-three/postprocessing` 不能用于 WebGPURenderer。
  - `three` 与 `three/webgpu` 是两套构建，类不互通。混用时灯光会静默失效。
- 搜索摘要转述说，官方手册称 WebGLRenderer 今后不会再加重大新特性，重心已转向 WebGPURenderer。但本次直接抓取 threejs.org 手册页返回 404，原文未能核对。来源：[threejs.org manual: WebGPURenderer](https://threejs.org/manual/#en/webgpurenderer)
- 【实测】r187 包内已经有 WebGPU 和 WebGL 两套 CAD 渲染相关模块，GLTFLoader 支持 `KHR_draco_mesh_compression`、`KHR_mesh_quantization`、`EXT_meshopt_compression`。来源：[three-0.187.0.tgz](https://registry.npmjs.org/three/-/three-0.187.0.tgz)
  - WebGPU 侧：`examples/jsm/lines/webgpu/{Line2,LineSegments2,Wireframe}.js`，`materials/LDrawConditionalLineNodeMaterial.js`，`tsl/display/{GTAONode,SSAONode,SSGINode,OutlineNode,SobelOperatorNode,SMAANode,TRAANode,DenoiseNode}.js`，以及 `src/objects/ClippingGroup.js`。
  - WebGL 侧：`lines/LineSegments2.js`，`materials/LDrawConditionalLineMaterial.js`，`postprocessing/{GTAOPass,SAOPass,SSAOPass,OutlinePass,SMAAPass}.js`，`helpers/ViewHelper.js`，`geometries/EdgesGeometry.js`。

**CAD 风格渲染技巧**
- 条件边（conditional lines）是指只在处于轮廓位置时才绘制的曲面轮廓线。gkjohnson 的 sandbox 提供了通用的条件线 shader 和几何生成器，沿用 LDrawLoader 的思路，包含 `OutsideEdgesGeometry`。它的 README 说明尚未支持 Line2 粗线。来源：[threejs-sandbox/conditional-lines](https://github.com/gkjohnson/threejs-sandbox/tree/master/conditional-lines)；原始讨论见 [three.js forum: LDraw-like edges](https://discourse.threejs.org/t/ldraw-like-edges/17100)。three.js 现在以 addon 形式提供 `LDrawConditionalLineMaterial`，2026-10-26 仍有针对它的修复 PR（#35219，见 [PR #35219](https://github.com/mrdoob/three.js/pull/35219)）。
- three-edge-projection（gkjohnson，MIT，358 stars，v0.0.11 于 2026-10-29 发布）基于 three-mesh-bvh，把可见边投影并压平成 2D 线段。主要接口有 `ProjectionGenerator` 的 `generate()`/`generateAsync()` 和 `MeshVisibilityCuller`，另有基于 clipper2-js 的 silhouette 生成，并附 WebGPU 示例。README 让用户从 GitHub 安装。来源：[GitHub](https://github.com/gkjohnson/three-edge-projection)。【实测】npm 上的 `three-edge-projection` 包已于 2025-10-28 被 unpublish，`npm view` 返回 E404 并给出该日期。
- 剖切与封口：
  - 官方示例 `webgl_clipping_stencil` 用模板缓冲（stencil）绘制封口。r163 之后必须用 `new WebGLRenderer({ stencil: true })` 创建渲染器，否则封口失效。多平面 `clipIntersection` 的场景不能直接套用这个示例。来源：[three.js forum](https://discourse.threejs.org/t/clipping-plane-stencil-capping/74018)；[forum: 3 planes + clipIntersection](https://discourse.threejs.org/t/clipping-with-3-planes-stencils-and-clipintersection-true/62329)
  - PR #31744 增加了 WebGPU 版的剪切示例。来源：[PR #31744](https://github.com/mrdoob/three.js/pull/31744)
  - xeokit 走的是"几何封口"路线：先求出截面轮廓，再用 Earcut 三角化。来源：[xeokit SectionCaps](https://xeokit.github.io/xeokit-sdk/docs/class/src/viewer/scene/sectionCaps/SectionCaps.js~SectionCaps.html)
- 环境光遮蔽（SSAO）用 N8AO。来源：[GitHub N8python/n8ao](https://github.com/N8python/n8ao)；[npm n8ao](https://www.npmjs.com/package/n8ao)
  - npm 最新版 2.0.1（2026-08-10）。GitHub 标注许可为 CC0-1.0，npm 元数据写的是 ISC，两者不一致。
  - 对 three 自带的 EffectComposer 用 `N8AOPass`，对 pmndrs postprocessing 用 `N8AOPostPass`。
  - 【声称】半分辨率模式提速 2–4 倍，深度感知上采样的固定开销约 1 ms。
  - 需要 WebGL 2，README 明确说尚不兼容 WebGPU。
- pmndrs 的 `postprocessing` 版本为 6.39.6（Zlib，2026-11-01），`@react-three/postprocessing` 为 3.2.2。来源：[npm postprocessing](https://www.npmjs.com/package/postprocessing)
- 视角立方体（view cube）与相机控制：
  - `three-viewport-gizmo` 2.2.0，MIT，最后发布于 2025-03-14，最后推送于 2025-07-29。来源：[npm](https://www.npmjs.com/package/three-viewport-gizmo)
  - drei 的 `GizmoHelper` 提供 `GizmoViewport` 和 `GizmoViewcube`。但放进多个 `<View>` 时它会抢占渲染循环和相机，相关 issue #1913 以 "not planned" 关闭。来源：[drei #1913](https://github.com/pmndrs/drei/issues/1913)
  - `camera-controls` 3.1.2，MIT。来源：[npm](https://www.npmjs.com/package/camera-controls)

**多个小画布 vs 共享渲染器**
- three.js 手册指出，浏览器会限制 WebGL context 的数量（手册写"通常约 8 个"），且不同 context 之间无法共享资源。手册推荐用一个铺满视口的 canvas，再对每个"虚拟画布"调用 `setScissorTest`/`setScissor`/`setViewport` 绘制。来源：[three.js manual: Multiple Canvases Multiple Scenes（镜像）](https://mc.dean.lsa.umich.edu/threejs/manual/en/multiple-scenes.html)；官方示例 [webgl_multiple_elements](https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html)
- 论坛补充：每个 `WebGLRenderer` 占一个 context，上限因设备而异，常见约 16 个。纹理和几何在每个 context 里各占一份显存。来源：[three.js forum](https://discourse.threejs.org/t/how-many-renderers-is-too-many/58774)
- drei `<View>` 的做法：
  - 用 `gl.scissor` 把一个 canvas 切成多个视口，每个 View 绑定一个用于跟踪位置的 DOM 元素，可以有各自的相机、环境和控制器。
  - `frames` 属性可减少 `getBoundingClientRect` 的开销。`track` 属性已弃用，改为内联 View。
  - `react-three-scissor` 已弃用，并指向 drei View。
  - 来源：[drei docs: View](https://drei.docs.pmnd.rs/portals/view)；[pmndrs/react-three-scissor](https://github.com/pmndrs/react-three-scissor)

**R3F / drei 现状**
- `@react-three/fiber` 的 latest 是 9.8.2（npm 2026-10-14，GitHub release 2026-10-15）。仓库 33,480 stars，2026-08-04 以来 44 次提交。dist-tags 里另有 `alpha: 10.0.0-alpha.6`。来源：[npm](https://www.npmjs.com/package/@react-three/fiber)；[GitHub](https://github.com/pmndrs/react-three-fiber)
- R3F v10.0.0-alpha.6（"Going WebGPU First"）的主要变化。来源：[v10.0.0-alpha.6 release](https://github.com/pmndrs/react-three-fiber/releases/tag/v10.0.0-alpha.6)；[alpha.1 discussion](https://github.com/pmndrs/react-three-fiber/discussions/3665)；[issue #4026](https://github.com/pmndrs/react-three-fiber/issues/4026)
  - 默认导入改为 WebGPU 渲染。要用 WebGL，需改从 `@react-three/fiber/legacy` 导入。
  - TSL 相关 hooks 移到 `@react-three/tsl`。
  - 要求 three ≥0.185，React ≥19.0 且 <19.4。
  - 从 alpha.4 起，多个 WebGPU canvas 可以共享同一个 renderer 和 GPU context。
  - alpha.1（2026-01-17）与 drei 11 alpha 一同发布。
- `@react-three/drei` 的 latest 是 10.7.9（npm 最后修改 2026-09-25），另有 `alpha: 11.0.0-alpha.7`。GitHub 有 151 个 open issues，2026-08-04 以来仅 11 次提交。来源：[npm](https://www.npmjs.com/package/@react-three/drei)；[GitHub](https://github.com/pmndrs/drei)

### Inferences
- 版本策略：锁定 three r187 + R3F 9.8.x + drei 10.7.x。R3F v10 进入 beta 之前不要用于生产。
- 迁移到 WebGPU 的成本不低，需要做以下替换，而且 `@react-three/postprocessing` 不可用：
  - N8AO 换成 `GTAONode`。
  - `LineSegments2` 换成 `lines/webgpu/LineSegments2`。
  - stencil 封口换成 `ClippingGroup` 加节点材质。
  - 对以线条、剖切、AO 为主的 CAD 场景，目前没有证据表明 WebGPU 有性能收益，暂不值得迁移。
- "CAD 观感"配方（WebGL）：
  - 面材质用 `MeshStandardMaterial`（低金属度、中等粗糙度），配 `RoomEnvironment` 或 HDR 环境光，并开 `polygonOffset` 防止 z-fighting。
  - 特征边优先用 B-rep 内核给出的真实边（replicad `meshEdges()` 或预烘焙的边数据），画成 `LineSegments2` 粗线。不要依赖 `EdgesGeometry` 的角度阈值：它在细分曲面上会漏掉相切过渡边，还会产生噪声边。
  - 轮廓线用条件边，或用屏幕空间的法线/深度边检测（`OutlinePass`、Sobel）。
  - AO 用 N8AO，剖切用 stencil 封口，视角立方体用 `three-viewport-gizmo` 或 `ViewHelper`。
- 课程页面常常一页有多张 3D 小图。每张图一个 `<Canvas>` 很容易触到 8–16 个 context 的上限，还会重复占用显存。可选方案：
  - 用一个全屏 canvas 加 drei `<View>`。
  - 或者只挂载当前可见的 1–2 个实时视图，其余用截图或视频占位，滚动到时再激活。
  - 可以开启 R3F 的按需渲染模式以节省耗电。

### Gaps
- 没有找到 WebGPU 与 WebGL 在"大量线段 + 少量网格"这类 CAD 场景下的对比基准。官方手册关于 WebGPURenderer 定位的原文未能直接核对（抓取返回 404）。
- R3F v9 能否通过异步 `gl` 工厂稳定配合 `WebGPURenderer`，本次未核实，建议由动手 spike 验证。

## 2. replicad：最新版本、维护活跃度、API 覆盖、面/边查找器、网格与面 ID、Web Worker、wasm 体积、初始化与重建性能、已知故障模式

### Takeaway
replicad 1.2.0（2026-10-23，MIT）已在 2026-08 迁移到 OCCT 8.0.1。API 覆盖了教学所需的绝大多数特征：草图、拉伸、旋转、放样、扫掠、圆角、倒角、抽壳、拔模、布尔和螺旋线。`mesh()` 返回带 `faceGroups{start,count,faceId}` 的网格，配套 helper 可以按面高亮。主要问题有三个：
- wasm 本体【实测】约 23.0 MB 原始、7.2 MB gzip、4.8 MB brotli。
- `faceId` 只是单次构建内的有界哈希，无法跨重建稳定地标识"某个特征生成的面"。
- 升级 OCCT 8 后出现了圆角失败、内存泄漏等回归，必须用 Worker 隔离并准备好重启策略。

### Cited Findings
**版本与维护**
- replicad 1.2.0（npm 2026-10-23，MIT），replicad-opencascadejs 1.1.0（2026-09-04，LGPL-2.1-only），replicad-threejs-helper 1.2.0（MIT）。来源：[npm replicad](https://www.npmjs.com/package/replicad)；[npm replicad-opencascadejs](https://www.npmjs.com/package/replicad-opencascadejs)
- 发版时间线：0.20.4/0.20.5（2025-11/12）→ 0.21.0（2026-03-06）→ 0.22.0（03-24）→ 0.23.0（04-03）→ 0.23.1（05-01）→ 1.0.0（08-14）→ 1.0.1（08-21）→ 1.1.0（09-04）→ 1.2.0（10-23）。来源：[npm registry: replicad](https://registry.npmjs.org/replicad)
- GitHub：713 stars，44 个 open issues，2026-08-04 以来 51 次提交，最后推送 2026-10-23。项目不使用 GitHub Releases（API 返回 404）。来源：[sgenoud/replicad](https://github.com/sgenoud/replicad)
- PR #263 于 2026-08-14 合并，把 replicad 迁移到 OCCT 8.0.1 和新一代 OpenCascade.js 绑定。来源：[PR #263](https://github.com/sgenoud/replicad/pull/263)
  - 默认提供单线程入口，另有基于 pthread 的 `./multi` 入口。
  - 使用原生 WebAssembly 异常，OCCT 异常可以解码成可读信息。
  - 用 replicad 自有的 C++ 提取器取代 JS 逐面、逐边遍历。
- 【实测】replicad-opencascadejs 1.1.0 的 `package.json` 构建脚本使用 Docker 镜像 `ghcr.io/taucad/opencascade.js:canary-…`，即 taucad 维护的 opencascade.js 分支（见第 3 节）。来源：[replicad-opencascadejs-1.1.0.tgz](https://registry.npmjs.org/replicad-opencascadejs/-/replicad-opencascadejs-1.1.0.tgz)

**API 覆盖（【实测】读取 replicad 1.2.0 的 `dist/replicad.d.ts`）**
- 3D 修改：`fillet(radiusConfig, edgeFinder)`、`chamfer(...)`、`shell(thickness, faceFinder)` 或 `shell({filter, thickness})`、`draft(angle, faceFinder, neutralPlane)`、`split(plane)`、`mirror`。
- 布尔：`fuse`/`cut`/`intersect`，参数 `BooleanOperationOptions` 中含 `simplify`。
- 由草图生成实体：`extrude(distance, {extrusionDirection, extrusionProfile, twistAngle, origin})`、`revolve(axis, {origin, angle})`、`loftWith(...)`、`genericSweep`、`complexExtrude`、`twistExtrude`。
- 螺旋：`makeHelix(pitch, height, radius, ...)` 与 `sketchHelix`，螺纹可以由螺旋扫掠构造。
- 2D：`Drawing` 上的 `fillet/chamfer/offset/cut/fuse/intersect`，`drawCircle/drawEllipse/drawRoundedRectangle/drawPolysides/drawText/drawProjection`，以及 `Sketcher`/`FaceSketcher`。
- 查询与 IO：`findFaces(FaceFinder)`，`FaceFinder`/`EdgeFinder`（README 示例 `new FaceFinder().inPlane("XY", ...)`），`measureVolume`，`importSTEP`、`importSTL`、`exportSTEP`、`blobSTEP`、`blobSTL`。
- 没有找到阵列（linear/polar pattern）专用 API（grep 无结果）。需要在 JS 里循环调用 `translate`/`rotate` 再 `fuse`。
- 1.2.0 新增 Manifold 集成：`MeshShape`（包装 manifold-3d，支持 `fuse/cut/intersect/refine/refineToLength/hull/simplify`）、`shape.meshShape()`、`importSTLAsMesh`、`setManifold`/`getManifold`。来源：[replicad-1.2.0.tgz](https://registry.npmjs.org/replicad/-/replicad-1.2.0.tgz)

**网格与面/边 ID**
- 【实测】`mesh(options?: {tolerance, angularTolerance}): ShapeMesh` 返回 `{triangles, vertices, normals, faceGroups: {start, count, faceId}[]}`。`meshEdges()` 返回 `{lines, edgeGroups: {start, count, edgeId}[]}`。形状对象有 `hashCode` 和 `isSame()`。来源：[replicad-1.2.0.tgz](https://registry.npmjs.org/replicad/-/replicad-1.2.0.tgz)
- PR #263 说明，新的原生提取器保留有上界的面哈希、三角形绕序和法向。PR 中的基准脚本以 `HASH_CODE_MAX = 2_147_483_647` 作为哈希上界。PR 还给出【声称】的基准数据（Node 环境，3 次预热后测 100 次，取中位数），见下表。来源：[PR #263](https://github.com/sgenoud/replicad/pull/263)

  | 模型 | 规模 | 面网格（旧 JS → 新 C++） | 边网格（旧 JS → 新 C++） |
  |---|---|---|---|
  | Birdhouse | 62 面 / 1,552 三角形；162 边 | 22.8 ms → 12.0 ms | 14.9 ms → 2.6 ms |
  | Vase | 11 面 / 36,436 三角形 | 378 ms → 249 ms | 未摘录 |

- 【实测】replicad-threejs-helper 1.2.0 导出 `syncGeometries`、`syncFaces(faces, mesh, highlight?)`、`syncLines(lines, edges, highlight?)`、`toggleHighlight(groupIndex, geometry)`、`clearHighlights`、`highlightInGeometry`、`getFaceId(triangleIndex, geometry)`、`getEdgeId(lineIndex, geometry)`。来源：[replicad-threejs-helper-1.2.0.tgz](https://registry.npmjs.org/replicad-threejs-helper/-/replicad-threejs-helper-1.2.0.tgz)
- 【实测】replicad 高层 API 的 `fillet`、`shell`、`fuse` 等只返回新形状，不返回历史对象。不过随包附带的 OCCT 绑定（`replicad_single.d.ts`，33,882 行）暴露了以下底层接口，绑定对象支持 `[Symbol.dispose]`。来源：[replicad-opencascadejs-1.1.0.tgz](https://registry.npmjs.org/replicad-opencascadejs/-/replicad-opencascadejs-1.1.0.tgz)
  - `BRepBuilderAPI_MakeShape` 的 `Generated()`/`Modified()`/`IsDeleted()`。
  - `BRepAlgoAPI_BuilderAlgo` 的 `History()`。
  - `BRepFilletAPI_MakeFillet`、`BRepOffsetAPI_MakeThickSolid`、`BRepOffsetAPI_DraftAngle`、`ShapeUpgrade_UnifySameDomain`。

**体积（【实测】）**
- 以下数据来源：[replicad-opencascadejs-1.1.0.tgz](https://registry.npmjs.org/replicad-opencascadejs/-/replicad-opencascadejs-1.1.0.tgz)（整个 tarball 15,058,089 B）与 [replicad-1.2.0.tgz](https://registry.npmjs.org/replicad/-/replicad-1.2.0.tgz)。

  | 文件 | 原始字节 | gzip -9 | brotli -q 11 |
  |---|---|---|---|
  | `replicad_single.wasm` | 22,980,267 B | 7,193,811 B | 4,837,826 B |
  | `replicad_multi.wasm` | 22,481,415 B | 7,186,900 B | 4,831,797 B |
  | JS glue `replicad_single.js` | 60,124 B | 22,501 B | 未测 |
  | `replicad.js`（未压缩 ESM） | 708,324 B | 147,775 B | 121,231 B |

- `./multi` 变体的 glue 引用了 `SharedArrayBuffer` 和 `new Worker`（pthread），在浏览器中需要 COOP/COEP 跨源隔离。来源：同上 tarball；[taucad/opencascade.js](https://github.com/taucad/opencascade.js)

**Worker 与初始化**
- replicad 文档强烈建议在 Web Worker 中初始化 OpenCascade 并计算模型。官方示例 worker 加载 `replicad_single.wasm`，并用 comlink 暴露函数。来源：[replicad docs（Algolia 索引）](https://docsearch.algolia.com/mcp/docs/repo/sgenoud/replicad)；[示例 worker（镜像）](https://gitverse.ru/mastercond/RepliCAD/content/main/packages/replicad-app-example/src/worker.js)
- 初始化时间：没有找到 replicad 1.x 的实测数据，只有两条历史参考。
  - 2021 年 opencascade.js 完整构建初始化约需 20 s，维护者称这在预期之内，并因此在 2.0 中拆分成更小的模块。来源：[opencascade.js Discussion #16](https://github.com/donalffons/opencascade.js/discussions/16)
  - replicad 作者在 HN 上表示，示例首次加载慢主要是下载造成的，之后各处都很流畅。来源：[HN: Show HN Replicad](https://news.ycombinator.com/item?id=34867641)

**重建性能（参考数据）**
- 【声称，非 replicad 本身】brepjs 的基准测试（2026-06-23，Node.js/Linux x86_64，每项 5 次）。表中 `[occt]` 指 brepjs 自己的 OCCT 内核；occt-wasm 的结果与之同级，相差在 ±20% 以内。来源：[brepjs benchmarks/results/latest.md](https://github.com/andymai/brepjs/blob/main/benchmarks/results/latest.md)

  | 操作 | 中位耗时 |
  |---|---|
  | box + fillet | 5.6 ms |
  | box + chamfer | 4.9 ms |
  | fuse(box, box) | 43.2 ms |
  | cut(box, cyl) | 69.8 ms |
  | intersect(box, sphere) | 61.8 ms |
  | 多布尔模型 | 32.0 ms |
  | 球面网格（tol 0.01） | 48.0 ms |

- 【第三方】Abundance 项目报告，一个耗时很长的布尔 intersect 在 headless Chromium 中约 57 s，在 Firefox 中超过 90 s，被 watchdog 杀掉。他们因此请求绑定 `Message_ProgressIndicator` 以便报告进度（据搜索摘要）。来源：[Abundance #1958](https://github.com/BarbourSmith/Abundance/issues/1958)

**已知故障模式**
- OCCT 8 回归：replicad 的 `fuseShapes` 在每次布尔后都会调用 `SimplifyResult(true, true, 1e-3)`。OCCT 8 的 `UnifySameDomain` 合并面之后，原本在 replicad 0.22/OCCT 7 上可行的圆角，在 replicad 1.1.0 上会抛出 `StdFail_NotDone` 或生成无效实体。跳过面合并时，同一模型可以正常圆角。来源：[Abundance #1934](https://github.com/BarbourSmith/Abundance/issues/1934)；相关 [Abundance #1910](https://github.com/BarbourSmith/Abundance/issues/1910)
- 内存问题（据搜索摘要）：
  - 大项目冷构建会耗尽 wasm 内存，之后的操作报 "index out of bounds" 或 "indirect call to null"。报告称 replicad 1.2.0 从未对布尔 builder 调用 `Clear()`。修复方案是显式清理，并在 worker 崩溃后重启、重放调用。来源：[Abundance PR #1967](https://github.com/BarbourSmith/Abundance/pull/1967)
  - 另一项目指出，replicad 的 `Plane` 每次放置都会泄漏一个 `gp_Trsf` 和两个 `gp_Ax3`。来源：[wireedm-gcode-parser PR #108](https://github.com/Insignifi4nt/wireedm-gcode-parser/pull/108)
- OCCT 8 合并了部分重载。参数全是数字时，可能静默选错重载，例如 `GCPnts_TangentialDeflection` 得到 7921 个点而不是 165 个（据搜索摘要）。来源：[MadCAD PR #123](https://github.com/kamil5646/MadCAD/pull/123)
- 社区手册指出（据搜索摘要）：OCCT 圆角经常失败，建议尽量最后再加圆角，失败时减小半径；圆角如果完全吃掉相邻面，OCCT 无法处理；依赖旧面/边"名字"的模型在重建时会失败。来源：[ReplicadManual](https://github.com/raydeleu/ReplicadManual)

### Inferences
- 关于"逐特征回放并高亮该特征生成的面"：`faceGroups.faceId` 可以用来做"拾取 → 面"的映射，但哈希在每次重建时都会变，不能作为跨步骤的身份标识。如果坚持在浏览器内实时计算，有两条路：
  - 绕过 replicad 高层 API，直接通过 `getOC()` 使用 `BRepFilletAPI_MakeFillet` 等类，调用 `Generated()`/`Modified()` 自建历史。
  - 在相邻步骤之间做几何匹配（面类型 + 面积 + 质心 + 法向）。
  - 这两件事 occt-wasm 的 `*WithHistory`（第 3 节）和离线 build123d 的 `Select.LAST/NEW`（第 7 节）都已经做好了。
- 课程中"拖动参数实时重建"可行的前提：模型简单（少于 100 个面），并且只开放经过离线扫参验证的参数范围。
  - 按 Node 环境的声称值，简单特征的单次操作在 5–70 ms 量级，网格提取在 10–250 ms 量级，因此单步重建 0.1–0.5 s 是合理预期。
  - 长尾情况（布尔或圆角失败、几十秒级的运算）必须有超时、回退和 worker 重启机制。
- 首屏代价：4.8 MB（brotli）的纯下载时间在 20 Mbps 下约 2 s，在 5 Mbps 下约 8 s，之后还要编译和实例化。应只在用户进入"可编辑沙盒"时按需加载，并用带版本号的文件名配合 HTTP 缓存或 Service Worker 长期缓存。
- 1.x 仍在快速变化（3 个月发了 4 个版本，且出现了回归）。应锁定精确版本，并为圆角和抽壳建立回归测试集。

### Gaps
- 缺少 replicad 1.x 在典型设备上的冷启动数据（wasm 下载 + 编译 + 首次出网格），也缺少圆角和抽壳在教学级零件上的重建时间。没有找到可靠的公开数据，需由正在进行的 spike 实测。
- `faceId` 哈希的具体计算方式与碰撞概率未查证。

## 3. 其他 B-rep 内核与工具：opencascade.js、CascadeStudio、chili3d、bitbybit、occt-import-js、Zoo/KittyCAD、truck/Fornjot 等的可行性与许可（含 LGPL-2.1 + OCCT 例外对公开网站的含义）

### Takeaway
浏览器内真 B-rep 的选择在 2026 年明显变多。除 replicad 外，以下几条线都在活跃维护：
- taucad 接手的 opencascade.js 新线，npm 包名 `libcascade`（3.1.0，OCCT 8.0.1）。
- andymai 的 occt-wasm 5.15.0（带面演化历史 API），及其上层库 brepjs。
- bitbybit 1.6.0。

其他选项的情况：
- CascadeStudio 是 MIT 许可的脚本式 IDE，适合作为参考实现。
- chili3d 功能最全，但应用本身是 AGPL。
- Zoo 的内核闭源并按秒计费。
- truck 缺少圆角等教学关键特征。
- Fornjot 已归档。

所有基于 OCCT 的方案都会把 LGPL-2.1 义务带到前端：需要单独分发 wasm、提供对应源码和许可声明。AGPL 和 GPL 组件应避免。

### Cited Findings
**OCCT 本体**
- OCCT 版本时间线。来源：[OCCT Discussion #1275](https://github.com/Open-Cascade-SAS/OCCT/discussions/1275)；[OCCT 8.0.0.p1](https://github.com/Open-Cascade-SAS/OCCT/discussions/1316)；[Wikipedia](https://en.wikipedia.org/wiki/Open_Cascade_Technology)
  - 8.0.0 于 2026-05-07 正式发布，此前经历了 5 个 RC 和 3 个 Beta，相对 7.9.0 有 500 多项改动，要求 C++17。
  - 8.0.0p1 于 2026-06-17 发布。
  - Wikipedia 列出的稳定版为 8.0.1（2026-07-30）。
- OCCT 的许可是 LGPL-2.1 附加 "Open CASCADE exception 1.0"。这条例外允许把引入了 OCCT 头文件内容（包括模板和内联代码）的目标代码按你自己选择的条款分发，条件是在配套文档中显著声明使用了 OCCT。来源：[OCCT_LGPL_EXCEPTION.txt](https://github.com/Open-Cascade-SAS/OCCT/blob/master/OCCT_LGPL_EXCEPTION.txt)

**opencascade.js（原版）与 taucad 分支 libcascade**
- donalffons/opencascade.js：npm latest 为 1.1.1（元数据最后修改于 2023-03-23），beta 为 2.0.0-beta.b5ff984（2023-07-30）。仓库最后推送于 2023-08-15，943 stars。来源：[npm](https://www.npmjs.com/package/opencascade.js)；[GitHub](https://github.com/donalffons/opencascade.js)
- 【实测】opencascade.js 1.1.1 完整构建的 `opencascade.wasm.wasm` 为 65,864,037 B（gzip 13,726,854；brotli 9,150,579）。来源：[opencascade.js-1.1.1.tgz](https://registry.npmjs.org/opencascade.js/-/opencascade.js-1.1.1.tgz)
- taucad/opencascade.js：2026-02-21 建立的分支，LGPL-2.1。来源：[GitHub taucad/opencascade.js](https://github.com/taucad/opencascade.js)；[npm libcascade](https://www.npmjs.com/package/libcascade)
  - npm 包名为 `libcascade`，当前 3.1.0（2026-10-13），许可写作 `LGPL-2.1-only WITH Open-CASCADE-Exception-1.0`。
  - GitHub releases 从 v3.0.0（2026-08-13）到 v3.1.0（2026-10-13）。
  - 基于 OCCT 8.0.1 和 Emscripten 6.0.5，提供单线程和多线程两套产物，多线程版需要 COOP/COEP。
  - 【声称】布尔运算快 22–31%。
  - 使用 `-fwasm-exceptions` 原生异常。
  - 自定义构建通过 `libcascade.config.ts` 配置，Docker 镜像为 `ghcr.io/taucad/opencascade.js`。
- 【实测】libcascade 3.1.0 是完整绑定。`opencascade_single.wasm` 为 42,751,732 B（gzip 12,161,132；brotli 8,233,958），`opencascade_multi.wasm` 为 42,731,431 B（12,195,726；8,210,193）。tarball 共 30.1 MB，其中包含 20.8 MB 的 `api-reference.json`。来源：[libcascade-3.1.0.tgz](https://registry.npmjs.org/libcascade/-/libcascade-3.1.0.tgz)

**occt-wasm 与 brepjs**
- occt-wasm（andymai）。来源：[GitHub andymai/occt-wasm](https://github.com/andymai/occt-wasm)
  - npm 5.15.0（2026-11-03）。包装层许可为 `MIT OR Apache-2.0`，编译出的 wasm 继承 OCCT 的 LGPL-2.1-only。
  - 基于 OCCT V8.0.1。
  - 内存采用 arena 模型：用 u32 句柄，不需要手动 `.delete()`，支持 `Symbol.dispose`。
  - 错误是结构化的（`OcctErrorCode`），圆角失败时会返回出问题的边 `faultyEdges`。
  - 提供 `OcctWorker`（基于 Comlink，每个 worker 一个实例）。
  - README 声称 wasm 约 4–4.7 MB（brotli）。README 说明的 LGPL 合规方式是让用户可以通过 `OcctKernel.init({ wasm })` 覆盖 wasm 的 URL。
  - 最低浏览器：Chrome/Edge 114、Safari 17.2、Firefox 121。仓库 70 stars。
- 【实测】occt-wasm 5.15.0 的 `occt-wasm.wasm` 为 21,245,094 B（gzip 6,756,257；brotli 4,569,871）。类型定义中与历史和网格相关的接口如下。来源：[occt-wasm-5.15.0.tgz](https://registry.npmjs.org/occt-wasm/-/occt-wasm-5.15.0.tgz)
  - `EvolutionData {modified, generated, deleted, edgeModified, edgeGenerated, edgeDeleted}`。
  - `fuseWithHistory`、`cutWithHistory`、`intersectWithHistory`、`filletWithHistory`、`mirrorWithHistory`、`scaleWithHistory`、`translateWithHistory`，以及返回 `EvolutionData` 的 `booleanOp(...)`。
  - 网格类型含 `faceGroups?: Int32Array`。
  - 另有 `shell`、`shellWithJoin`、`draft`、`draftFaces`。
- brepjs 20.18.0：TypeScript 写的精确 B-rep 库。来源：[GitHub andymai/brepjs](https://github.com/andymai/brepjs)；[npm brepjs](https://www.npmjs.com/package/brepjs)
  - Apache-2.0，2026-02-01 建库，139 stars，2,604 commits。
  - 默认内核是 occt-wasm，可切换到 Rust 内核 brepkit，作者称 brepkit 尚未可用于生产。
  - 作者自称因为在 replicad 上遇到性能和 API 问题而另起炉灶，并提供了从 replicad 迁移的指南。
  - brepkit-wasm 自 3.0.0 起改为 AGPL-3.0-only 或商业授权，2.129.x 及以前为 MIT/Apache。
- 【实测】brepkit-wasm 4.6.26（AGPL-3.0-only）的 `brepkit_wasm_bg.wasm` 为 8,000,788 B（gzip 2,906,010；brotli 2,094,171）。来源：[brepkit-wasm-4.6.26.tgz](https://registry.npmjs.org/brepkit-wasm/-/brepkit-wasm-4.6.26.tgz)

**bitbybit**
- `@bitbybit-dev/occt` 1.6.0（2026-10-28），许可为 `MIT AND Apache-2.0 AND LGPL-2.1-only WITH OCCT-exception-1.0`；`@bitbybit-dev/occt-worker` 1.6.0 为 MIT。GitHub release v1.6.0 于 2026-10-29 发布，208 stars，2026-08-04 以来至少 100 次提交。可以配合 ThreeJS、BabylonJS、PlayCanvas 使用。来源：[npm](https://www.npmjs.com/package/@bitbybit-dev/occt)；[GitHub bitbybit-dev/bitbybit](https://github.com/bitbybit-dev/bitbybit)
- 【实测】1.6.0 包含三套 OCCT wasm，tarball 共 30.4 MB。来源：[occt-1.6.0.tgz](https://registry.npmjs.org/@bitbybit-dev/occt/-/occt-1.6.0.tgz)

  | 文件 | 原始字节 | gzip | brotli |
  |---|---|---|---|
  | `bitbybit-dev-occt` | 31,618,479 B | 9,617,188 B | 6,394,458 B |
  | `-64-bit` | 33,087,225 B | 9,892,847 B | 6,628,190 B |
  | `-64-bit-mt` | 31,938,064 B | 9,709,685 B | 6,499,025 B |

**CascadeStudio / chili3d / occt-import-js**
- CascadeStudio：MIT，1,499 stars。来源：[GitHub zalo/CascadeStudio](https://github.com/zalo/CascadeStudio)
  - 现在是一个 monorepo，分为 `cascade-core`（无 GUI 的引擎）和 `cascade-studio`（浏览器 IDE）。
  - 基于 OCCT 8.0，致谢中写的是 OCCT 8.0.0 RC4 via Embind。
  - 支持 JS 和 OpenSCAD 脚本、Tweakpane 参数控件、Sketch/selector API、建模历史时间线、STEP/STL/OBJ 导出、PWA 离线使用，以静态站部署。
  - GitHub API 显示默认分支自 2026-08-04 以来 0 次提交，但 2026-10-19 有推送。
- chili3d：4,963 stars，2026-08-04 以来至少 100 次提交。来源：[GitHub xiangechen/chili3d](https://github.com/xiangechen/chili3d)
  - 浏览器端的参数化加直接建模 CAD。
  - 技术栈：TypeScript + OCCT 8.0.1（Emscripten）+ three.js 0.184 + Rspack 2。草图约束用内置的 "garlic" 求解器（wasm）。
  - 特征包括 extrude、revolve、loft、sweep、helix、hole、fillet、chamfer、boolean、shell、thicken、draft。
  - 应用本身是 AGPL-3.0，C++ wasm 模块是 LGPL-3.0，另有商业授权和 "Chili3D Pro"。
- occt-import-js：最新版 0.0.23（2024-12-03），LGPL-2.1，此后再无提交。它在浏览器内读取 STEP/IGES/BREP，输出 JSON 网格，其中 `meshes[].brep_faces[{first, last, color}]` 给出每个 B-rep 面对应的三角形区间和颜色。来源：[GitHub kovacsv/occt-import-js](https://github.com/kovacsv/occt-import-js)
- 【实测】`occt-import-js.wasm` 为 7,604,031 B（gzip 3,083,977；brotli 2,324,594）。来源：[occt-import-js-0.0.23.tgz](https://registry.npmjs.org/occt-import-js/-/occt-import-js-0.0.23.tgz)

**Zoo（KittyCAD）、truck、Fornjot**
- Zoo：
  - Design Studio（KittyCAD/modeling-app）以 MIT 开源，v1.5.3 于 2026-10-28 发布，有 1,443 个 open issues。
  - 但官方说明其几何引擎不开源。Design API 新用户有 20 分钟免费额度（相当于 $10），之后按 $0.0083/秒（约 $0.50/分钟）计费。来源：[Zoo Design API](https://zoo.dev/design-api)
  - 按秒计费，调用失败不计费；`/ws/modeling/commands` 等 WebSocket 建模端点计费。来源：[Zoo FAQ](https://zoo.dev/docs/faq)
  - Zookeeper 订阅分为 Free、Plus（$20）、Pro（$99），为 2026-02-05 发布时的价格。来源：[Zoo blog](https://zoo.dev/blog/announcing-zookeeper)
  - `@kittycad/lib` 4.5.24，MIT。来源：[npm](https://www.npmjs.com/package/@kittycad/lib)
- truck：Apache-2.0，1,679 stars，2026-08-04 以来 27 次提交，没有 GitHub Releases。来源：[GitHub ricosjp/truck](https://github.com/ricosjp/truck)
  - Rust 写的 B-rep 内核。crates 包括 truck-modeling、truck-shapeops（实体布尔）、truck-meshalgo、truck-js（JS 包装），以及基于 wgpu 的 truck-platform/truck-rendimpl。
  - 教程针对 v0.6.x，README 没有列出圆角功能。
  - 【实测】npm 上没有 `truck-js` 包（查询返回 404）。
- Fornjot：仓库已归档，描述为早期 B-rep 内核且已不再开发，最后一个 release 是 v0.49.0（2024-03-21）。来源：[GitHub hannobraun/fornjot](https://github.com/hannobraun/fornjot)

### Inferences
- 可行性排序（面向需要圆角和抽壳的教学站）：
  1. replicad：API 最适合教学叙述，生态最成熟。
  2. occt-wasm/brepjs：与 replicad 大致并列。体积略小，自带面演化历史；但更新极快、用户少、单人维护，有维护风险。
  3. bitbybit：6.4 MB（brotli）偏大，定位偏可视化编程平台。
  4. 直接使用 libcascade：8.2 MB（brotli），API 是底层接口。
  5. CascadeStudio：适合作为参考实现或嵌入式 IDE，不适合作为库。
- 不建议作为主内核：chili3d（AGPL）、brepkit-wasm 3.0 及以后（AGPL）、Zoo（闭源、按量计费、必须联网）、truck（没有圆角）、Fornjot（已归档）。
- LGPL-2.1（+OCCT 例外）对公开网站意味着什么（非法律意见）：向浏览器下发 OCCT wasm，就构成"分发库的目标代码"，需要做到以下几点：
  - 随站点提供 LGPL-2.1 文本和 OCCT 使用声明。
  - 提供与所发 wasm 对应的完整源码，包括 OCCT 版本、绑定和构建配置以及任何修改；也可以提供书面的源码提供承诺。
  - 让用户能够替换该库。实务上就是保持 wasm 为独立文件，不内联进业务 bundle，也不加禁止为调试修改而逆向的条款。occt-wasm 用"可覆盖 wasm URL"的方式说明了这一思路。
  - 自研的课程代码（JS/TS、MDX）可以保持任意许可。OCCT 例外主要解决的是"头文件里的模板/内联代码进入你自己的目标代码"这个问题。
  - 相比之下，B 方案只在构建服务器上运行 OCCT，向用户下发的只有 GLB/JSON，不涉及分发 OCCT，因此 LGPL 义务不会触达前端。
- AGPL-3.0（chili3d、brepkit-wasm 3.0 及以后、`@theatre/studio`）带有网络使用条款：如果修改后通过网络对外提供服务，就必须向用户提供整个对应源码。除非整站开源，否则应避免。GPL-3.0（SolveSpace）如果与站点 JS 组成单一程序，同样会传染，最多以独立页面或外链方式使用。

### Gaps
- libcascade 和 occt-wasm 在浏览器中的初始化时间、圆角和抽壳耗时，都缺少独立实测。occt-wasm/brepjs 由单一作者高速迭代（npm 版本号已到 5.x 和 20.x），长期维护风险无法评估。
- CascadeStudio 的维护状态信号互相矛盾：默认分支近 3 个月没有提交，但 README 已更新到 OCCT 8。

## 4. Manifold（manifold-3d）能做什么、不能做什么，以及 three-bvh-csg、JSCAD 这两个更轻的替代

### Takeaway
manifold-3d 3.5.4（Apache-2.0）是一个"保证输出为流形"的网格布尔库。它的 wasm【实测】只有 541 KB 原始、159 KB brotli，约为 replicad OCCT wasm 的 1/30。能力上支持布尔、拉伸、旋转、Minkowski、凸包、细分平滑、按平面切分和水平集，还能通过 `runOriginalID/faceID` 追踪结果三角形来自哪个输入。但它没有真正的 B-rep 圆角、倒角、抽壳、拔模，`smoothOut` 只是网格平滑的近似。它适合做布尔/CSG 直觉类的小互动。three-bvh-csg 和 JSCAD 更轻，但在鲁棒性或能力上更弱。

### Cited Findings
- manifold-3d 3.5.4（2026-09-25，Apache-2.0）。仓库 2,390 stars，2026-08-04 以来 76 次提交。来源：[npm](https://www.npmjs.com/package/manifold-3d)；[GitHub elalish/manifold](https://github.com/elalish/manifold)
- 项目定位。来源：[GitHub elalish/manifold](https://github.com/elalish/manifold)
  - 首要目标是可靠性，保证输出为流形且没有例外情形；其次是性能。
  - WASM 版是串行的，比原生 C++ 略慢。
  - 使用者包括 OpenSCAD、Blender、Godot、trimesh、Babylon.js 等。
  - 可以通过 ID 追踪材质，以及"哪些表面来自哪个输入对象或面"。
- 【实测】`manifold.wasm` 为 541,470 B（gzip 204,624；brotli 158,724），`manifold.js` 为 82,371 B（gzip 19,105）。来源：[manifold-3d-3.5.4.tgz](https://registry.npmjs.org/manifold-3d/-/manifold-3d-3.5.4.tgz)
- 【实测】类型定义中的 API。来源：同上 tarball
  - 构造：`cube`、`cylinder`、`sphere`、`tetrahedron`、`extrude`、`revolve`、`smooth`、`levelSet`、`ofMesh`。
  - 布尔：`add`/`subtract`/`intersect`，`union`/`difference`/`intersection`（含批量版本）。
  - 切分与投影：`split`、`splitByPlane`、`trimByPlane`、`slice`、`project`。
  - 其他变换：`minkowskiSum`/`minkowskiDifference`、`hull`、`warp`。
  - 平滑：`smoothOut(minSharpAngle, minSmoothness)`，文档注释说 minSmoothness 大于 0 时会在尖边上形成小圆角；另有 `smoothByNormals`、`refine`、`refineToLength`、`refineToTolerance`。
  - 2D：`CrossSection.offset(delta, joinType, ...)`。
  - 来源追踪：`getMesh()` 返回的 MeshGL 含 `runIndex`、`runOriginalID`、`faceID`；另有 `asOriginal()`、`originalID()`、`reserveIDs()`。
  - 没有 fillet、chamfer、shell、draft。
- replicad 1.2.0 已经内置与 Manifold 的互操作（`MeshShape`、`meshShape()`），可以把 B-rep 结果转成 Manifold 做快速网格布尔。来源：[replicad-1.2.0.tgz](https://registry.npmjs.org/replicad/-/replicad-1.2.0.tgz)
- three-bvh-csg 0.0.18（2026-02-17，MIT，958 stars）。来源：[three-bvh-csg-0.0.18.tgz](https://registry.npmjs.org/three-bvh-csg/-/three-bvh-csg-0.0.18.tgz)；[GitHub](https://github.com/gkjohnson/three-bvh-csg)
  - README 自称"实验性、仍在开发中"。
  - 【声称】在复杂情况下比基于 BSP 的 three.js CSG 库快 100 倍以上。
  - 要求输入为两流形（watertight）网格，并承认由于数值精度，结果可能不完全是流形；README 推荐需要鲁棒性的 CAD 场景改用 Manifold。
  - `Evaluator.useGroups` 可以保留多材质分组。
- @jscad/modeling 2.13.0（2026-08-02，MIT）。仓库 3,265 stars，2026-08-04 以来 3 次提交。来源：[modeling-2.13.0.tgz](https://registry.npmjs.org/@jscad/modeling/-/modeling-2.13.0.tgz)；[GitHub jscad/OpenJSCAD.org](https://github.com/jscad/OpenJSCAD.org)
  - 【实测】模块包括 booleans、expansions（`expand`/`offset`）、extrusions（linear、rotate、rectangular、helical、fromSlices）、hulls、minkowski、modifiers，以及 `roundedCuboid`、`roundedCylinder`、`roundedRectangle` 等带圆角的基本体。
  - 【实测】`dist/jscad-modeling.min.js` 为 250,793 B（gzip 59,003）。

### Inferences
- 教学定位：
  - Manifold 适合"布尔运算/CSG 树"这类课。学生可以即时拖动刀具体，并用 `runOriginalID` 把结果面按来源着色，直观看到哪些面来自刀具体。它也适合讲 3D 打印相关的网格概念。
  - 它不适合讲圆角、抽壳、拔模的真实结果，否则会让学生误以为看到的是等半径圆角。
- three-bvh-csg 体积最小（纯 JS，依赖 three-mesh-bvh），适合"拖动即时预览"的轻量 demo，但不保证流形。
- JSCAD 的多边形 CSG 能力与 OpenSCAD 相当，可用于"代码建模入门"，同样没有特征级圆角。
- 在混合方案中，可以用 Manifold 做快速预览、用 OCCT 出精确结果，replicad 已经提供了两者之间的桥接。

### Gaps
- 没有找到 Manifold WASM 在典型教学模型上的耗时数据，项目只有定性描述，需要 spike 实测。

## 5. 浏览器内的 2D 草图约束求解：planegcs、SolveSpace web 版及其他 JS/wasm 求解器

### Takeaway
目前最成熟的选择是 @salusoft89/planegcs 1.3.0。它把 FreeCAD Sketcher 的 GCS 求解器编译成了 wasm，【实测】484 KB 原始、137 KB brotli。类型定义中暴露了 `dof()`、`has_conflicting()`/`has_redundant()` 以及冲突/冗余约束的列表，足以实现"欠约束 / 完全约束 / 过约束"的教学反馈。许可为 LGPL，但 npm 元数据与 LICENSE 文件的写法不一致。MIT 许可的替代是 Zoo 的 ezpz（Rust 写成，需要自行打包成 wasm）。SolveSpace 的 web 版是完整应用，且为 GPL-3.0。

### Cited Findings
- @salusoft89/planegcs 1.3.0（2026-10-05）。npm 元数据写的许可是 "LGPL-2.0-or-later"，而包内 LICENSE 文件是 LGPL 2.1 全文，GitHub 也识别为 LGPL-2.1。111 stars，4 个 open issues。来源：[npm](https://www.npmjs.com/package/@salusoft89/planegcs)；[GitHub Salusoft89/planegcs](https://github.com/Salusoft89/planegcs)
- 【实测】`planegcs.wasm` 为 484,003 B（gzip 172,295；brotli 136,626）。来源：[planegcs-1.3.0.tgz](https://registry.npmjs.org/@salusoft89/planegcs/-/planegcs-1.3.0.tgz)
- README 中的 API。来源：[GitHub](https://github.com/Salusoft89/planegcs)
  - 初始化：`init_planegcs_module()` → `new mod.GcsSystem()` → `new GcsWrapper(...)`。
  - 使用流程：`push_primitives_and_params(primitives)`、`solve()`、`apply_solution()`、`sketch_index.get_primitives()`。
  - 算法：DogLeg（默认）、LevenbergMarquardt、BFGS；含临时约束（拖拽）时改用 SQP。
  - 约束选项：`driving`（为 false 时只测量不驱动）、`temporary`、`scale`。
  - 支持的图元：点、线、圆、弧、椭圆、双曲线、抛物线、B 样条。
  - 在 Vite 下用 `?url` 引入 wasm；`destroy_gcs_module()` 释放内存。
  - README 列出若干约束在非驱动模式下不可靠，例如 CircleDiameter、ArcDiameter、C2CDistance。
- 【实测】类型定义中有以下诊断接口，README 没有记载。来源：[planegcs-1.3.0.tgz](https://registry.npmjs.org/@salusoft89/planegcs/-/planegcs-1.3.0.tgz)
  - `GcsSystem`：`dof()`、`has_conflicting()`、`has_redundant()`、`has_partially_redundant()`、`get_conflicting()`、`get_redundant()`、`get_partially_redundant()`。
  - `GcsWrapper`：`get_gcs_conflicting_constraints()`、`get_gcs_redundant_constraints()`、`get_gcs_partially_redundant_constraints()`，以及对应的 `has_gcs_*`。
- SolveSpace：GPL-3.0，4,231 stars。来源：[SolveSpace Web Version](https://solvespace.com/webver.pl)；[GitHub](https://github.com/solvespace/solvespace)
  - 官方提供用 Emscripten 构建的"实验性 Web 版"，自动跟随最新提交更新，加载后不依赖网络，可以自行静态托管。
  - 【第三方】整个 web 版约为 1 MB 的 wasm。来源：[OSTechNix](https://ostechnix.com/solvespace-open-source-cad/)
- ezpz：Zoo 为重做草图模式而开发的 2D 约束求解器。来源：[Zoo blog](https://zoo.dev/blog/announcing-solver)；[lib.rs ezpz](https://lib.rs/crates/ezpz)；[GitHub KittyCAD/ezpz](https://github.com/KittyCAD/ezpz)
  - MIT 许可，Rust 编写，约在 2026 年 5 月下旬发布，可在浏览器和原生环境运行。
  - crates 为 `ezpz` 0.2.26 和 `kcl-ezpz` 0.2.18，仓库中含 `ezpz-wasm`。
  - 结果接口有 `is_satisfied()`、`unsatisfied()` 等。
  - 仓库 56 stars，最后推送于 2026-08-05。
- chili3d 内置的约束求解器是 vendored 的 "garlic"，编译为 wasm。来源：[GitHub chili3d](https://github.com/xiangechen/chili3d)
- 【第三方】2026-10-22 的一份 RFC 在两个宽松许可选项之间做了比较：ezpz（MIT）和 SolidCraft 的 sketch crate（Apache-2.0/MIT）。来源：[nightfall #257](https://github.com/wckdboy/nightfall/issues/257)

### Inferences
- "完全约束"可以这样判定：`dof() === 0`，且 `has_conflicting()` 与 `has_redundant()` 都为 false。再用 `get_gcs_conflicting_constraints()` 返回的约束 ID 在 UI 中标红，就能直接复刻 FreeCAD 中"绿色表示完全约束"的教学体验。需要注意 FreeCAD 中 DOF 是在 diagnose/solve 之后才计算的，调用时序需要 spike 验证。
- 许可：planegcs 与 OCCT 同属 LGPL，按第 3 节的做法处理即可（独立 wasm 文件 + 提供源码 + 声明）。如果希望前端完全没有 copyleft 组件，ezpz（MIT）是唯一现成的方向，但需要自行用 wasm-bindgen 打包，还要补齐 DOF 诊断（文档中未见相关接口）。
- SolveSpace web 版适合作为"外链体验"，不适合嵌入课程页：它是 GPL，且自带完整应用 UI。

### Gaps
- 本次未核实 ezpz 是否已有发布到 npm 的 wasm 包，也未核实它是否提供 DOF/冗余诊断。
- 没有找到 planegcs 的求解耗时数据。
- 未核实 SolveSpace 求解库（libslvs）是否有单独的 web 构建。

## 6. three-cad-viewer（bernhard-42）与 text-to-cad 的 CAD Viewer：功能、数据格式、许可与可嵌入性

### Takeaway
three-cad-viewer 5.1.3（MIT，2026-10-12）是功能最完整的选项：零件树、爆炸、带模板封口的剖切、测量、动画、斑马纹、studio 材质，以及按顶点/边/面/实体拾取，还支持增量 `updatePart`。但它是自带 UI 的整体组件，只支持 WebGL，打包时内联了 three.js r184（【实测】min 包 437 KB gzip）。如果站点自己也用 three/R3F，两者并存会重复加载 three。text-to-cad（MIT，25k stars）的 CAD Viewer 源码公开、可以复用，但其 `@cad/core` 和 `@cad/ui` 包标记为 private，没有发布到 npm，只能 vendor 或 fork。

### Cited Findings
- three-cad-viewer 5.1.3（npm 2026-10-12，MIT），397 stars，4 个 open issues，2026-08-04 以来 48 次提交。它被 OCP CAD Viewer for VS Code（Apache-2.0，v4.2.0，2026-10-13）使用。来源：[npm](https://www.npmjs.com/package/three-cad-viewer)；[GitHub bernhard-42/three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer)；[GitHub vscode-ocp-cad-viewer](https://github.com/bernhard-42/vscode-ocp-cad-viewer)
- 功能（来自 README 和包内模块）。来源：[GitHub README](https://github.com/bernhard-42/three-cad-viewer)；[three-cad-viewer-5.1.3.tgz](https://registry.npmjs.org/three-cad-viewer/-/three-cad-viewer-5.1.3.tgz)
  - 树导航和爆炸（`explode`）。
  - 剪切面（`clip`），带模板封口，可用 `ensureStencilSize()` 预设封口区域大小。
  - 测量（`DistanceMeasurement` 等）和动画（play/stop）。
  - 斑马纹（zebra）、studio 模式（MaterialX 材质、环境、色调映射）和材质预设。
  - 用 a/v/e/f/s 键切换拾取过滤（全部/顶点/边/面/实体）。
  - 动态接口 `addPart`/`removePart`/`updatePart`；拓扑不变时 `updatePart` 直接改写 GPU 缓冲。另有 `updateBounds()` 和 `gpuTracker`。
- 数据格式。来源：同上
  - 输入为 shapes JSON，示例中 `version: 3`。
  - 每个 part 含 `vertices`、`triangles`、`normals`、`edges`，以及 `triangles_per_face`、`segments_per_edge`、`face_types`、`edge_types`、`obj_vertices`。
  - 可见性用状态元组表示：0 为隐藏，1 为显示，3 为不存在。
  - 类型定义中另有 `ShapeBinary` 与 instanced 格式。
- 嵌入方式：引入 `three-cad-viewer.css`，然后依次调用 `new Display(container, displayOptions)` → `new Viewer(display, viewerOptions, notifyCallback)` → `viewer.render(shapes, renderOptions, viewerOptions)`。来源：同上
- 【实测】体积与依赖。来源：同上 tarball
  - `three-cad-viewer.esm.min.js` 为 1,447,802 B（gzip 437,065；brotli 371,414），CSS 为 122,447 B（gzip 11,118）。
  - bundle 开头就是 three.js 的版权头和 `REVISION "184"`，说明内联了 three r184。
  - 依赖固定为 `three 0.184.0`、`n8ao 1.10.1`、`postprocessing 6.39.0`，渲染器使用 `WebGLRenderer`。
- text-to-cad（earthtojake）：MIT，25,356 stars，v0.10.3 于 2026-11-03 发布。它是面向 AI agent 的 build123d 建模技能集合：模型脚本构建为 `.xbf` 文档（包含零件、名称、颜色、材质、关节），并导出 STEP/GLB/STL/3MF；CAD Viewer 会跟随每次重建刷新。来源：[GitHub earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad)
- 【实测（GitHub API）】Viewer 代码的位置和状态。来源：[packages/README.md](https://github.com/earthtojake/text-to-cad/blob/main/packages/README.md)；[migrating-0.7-to-0.8.md](https://github.com/earthtojake/text-to-cad/blob/main/docs/migrations/migrating-0.7-to-0.8.md)；[earthtojake/cad-viewer](https://github.com/earthtojake/cad-viewer)
  - 代码位于两个包：`packages/core`（`@cad/core`，描述为可复用的 CAD 渲染/查看运行时，依赖 three 0.187.0、three-mesh-bvh、meshoptimizer）和 `packages/ui`（`@cad/ui`，完整的共享 FileViewer）。二者都标记为 `"private": true`。
  - 独立仓库 earthtojake/cad-viewer 已归档（105 stars）。
  - 0.7→0.8 的迁移文档写明移除了 `ensure_step_topology_artifact`，viewer 改为直接读取 STEP。
- CAD Viewer 技能文档：支持 .step/.stp/.glb/.stl/.gcode/.dxf/.urdf/.srdf/.sdf。早期的 GLB 可以带 `STEP_topology` 扩展，用于装配结构和面/边拾取（经搜索结果摘要）。来源：[skills/cad-viewer/SKILL.md](https://github.com/earthtojake/text-to-cad/blob/main/skills/cad-viewer/SKILL.md)

### Inferences
- three-cad-viewer 适合作为"自由探索装配体/零件"的独立窗口：爆炸、剖切、测量都是现成的，也可以直接读入 ocp_vscode/build123d 导出的数据。
- 但课程需要的"逐特征回放、旁白同步、按特征高亮"得自己写控制层。它的整体式 UI、只支持 WebGL、内联 three r184 这几点会与 R3F 主栈冲突：会重复加载约 200 KB 以上（gzip）的 three，还会多占一个 WebGL context。
- 更稳妥的做法是借鉴它的数据格式（`triangles_per_face`/`segments_per_edge`）和剖切、测量的实现，在自家的 R3F 场景中重新实现。
- text-to-cad 的 viewer 可以作为 MIT 代码参考（直读 STEP、meshopt GLB、three r187）。但它没有发布成包，且随主项目高速变化，不宜作为依赖。

### Gaps
- three-cad-viewer 爆炸和动画的数据接口（轨道格式）细节，以及是否支持角度测量，未逐项核实。
- 没有找到 `STEP_topology` 扩展格式的原文。

## 7. 离线管线：用 build123d / CadQuery 按特征导出步骤快照、按来源特征给面打标、导出带名称和颜色的 GLB、典型文件体积

### Takeaway
STEP 不保存建模历史，所以"逐特征回放"必须在建模脚本运行时逐步做快照。build123d 0.13 的 `Select.LAST`/`Select.NEW` 已改为读取每次操作附带的内核历史记录（algebra 模式下同样可用），可以直接得到"本特征新带入或新生成的面"。OCCT 的 `BRepTools_History`（Generated/Modified/Removed，加上 Merge）可以把多步历史串起来，必要时再用几何匹配兜底。每一步导出一个带面分组或自定义属性的 GLB，用 meshopt 或 Draco 压缩。实际 GLB 体积在几十 KB 到一两百 KB 量级。

### Cited Findings
- build123d v0.13.0（2026-09-21，Apache-2.0，3,619 stars，2026-08-04 以来至少 100 次提交）；CadQuery v2.8.0（2026-06-20）。来源：[GitHub gumyr/build123d](https://github.com/gumyr/build123d)；[GitHub CadQuery/cadquery](https://github.com/CadQuery/cadquery)
- build123d 文档对选择器的说明。来源：[build123d: Topology Selection](https://build123d.readthedocs.io/en/stable/topology_selection.html)；相关讨论 [build123d #1452](https://github.com/gumyr/build123d/issues/1452)
  - `Select.ALL` 是默认值。
  - `Select.LAST` 指上一次操作带入或创建的特征，不包括只是被重建的特征。
  - `Select.NEW` 指在任何输入中都不以任何形式存在的特征，例如两体交线、圆角面、合并后的实体。
  - 每个操作都会记录它对输入子形状做了什么，这份记录随结果形状一起传递；algebra 模式同样适用。没有记录的形状（例如新建的 `Rectangle`）调用这些选择器会抛错。
  - 示例：做完圆角后，`part.faces(Select.LAST)` 返回圆角面，`part.edges(Select.NEW)` 返回圆角的接缝和圆弧。
  - 旧的 `new_edges()` 是用几何比较实现的。`topo_parent`/`topo_owner`/`topo_path` 记录的是选择的来源。
- 【第三方/搜索摘要】旧版本中，`Select.LAST` 由前后形状比较得出，`Select.NEW` 只对边有效，被修剪过的面会被算作新面；新行为改为由内核历史给出。具体从哪个版本开始改变未能确认。来源：[build123d #1452](https://github.com/gumyr/build123d/issues/1452)
- OCCT 的 `BRepTools_History`。来源：[OCCT Reference: BRepTools_History](https://occt3d.com/dev/doc/refman/html/class_b_rep_tools___history.html)
  - 记录从输入到输出的三种关系：Generated、Modified、Removed。
  - 可以由任何提供 `IsDeleted()`/`Modified()`/`Generated()` 的算法构造。
  - `Merge` 可以把多步历史串成一份，规则如"先生成、后修改，仍视为生成"。
  - 只跟踪顶点、边、面和实体。
  - 文档举例说明：圆角操作中，边先生成面，然后被删除。
- build123d 的导出接口。来源：[build123d: Import/Export](https://build123d.readthedocs.io/en/stable/import_export.html)
  - `export_gltf(to_export, file_path, unit=Unit.MM, binary=False, linear_deflection=0.001, angular_deflection=0.1)`。
  - `export_step` 导出形状或装配，带颜色和标签属性；未设置颜色的节点继承最近祖先的颜色。
  - 文档没有说明 glTF 导出时标签是否会成为节点名。
- 【实测】three r187 的 GLTFLoader 处理非标准顶点属性的方式。来源：[three-0.187.0.tgz](https://registry.npmjs.org/three/-/three-0.187.0.tgz)
  - 非标准顶点属性按 `attributeName.toLowerCase()` 映射（源码第 2027 和 2035 行），所以自定义的 `_FEATURE_ID` 这类属性会以小写名进入 BufferGeometry。
  - 支持 `EXT_meshopt_compression`、`KHR_draco_mesh_compression`、`KHR_mesh_quantization`。
  - Draco 的 glTF 解码器 `draco_decoder.wasm` 为 192,420 B（gzip 63,183；brotli 48,729）；`meshopt_decoder.module.js` 为 29,256 B（gzip 7,733）。
- 【实测（GitHub API 文件大小）】text-to-cad 仓库中由其 build123d 管线导出的 GLB：文档首页的 `planetary.glb` 为 162,700 B，`arm.glb` 为 43,188 B，`cube.meshopt.glb` 为 1,900 B。来源：[text-to-cad repo](https://github.com/earthtojake/text-to-cad)
- 网格规模参照：replicad 基准中的 Birdhouse 有 62 面、1,552 个三角形，Vase 有 11 面、36,436 个三角形。来源：[replicad PR #263](https://github.com/sgenoud/replicad/pull/263)
- occt-import-js 可以在浏览器端从 STEP 得到 `brep_faces[{first,last,color}]`，即"面 → 三角形区间"的映射。这适合导入外部 STEP 作为课程素材，但仍然没有特征历史。来源：[GitHub kovacsv/occt-import-js](https://github.com/kovacsv/occt-import-js)

### Inferences
- 推荐的离线管线（Python）：
  1. 把每个课程模型写成 build123d 脚本，显式列出特征步骤，每步带名称、参数和讲解文本 ID。
  2. 每执行完一步，用 `faces(Select.LAST)`/`faces(Select.NEW)` 得到本步的新面，再用 OCP 的 `BRepTools_History`（或逐步调用 `Modified()`）把之前的面标签传递到新拓扑上：被修剪的面保留原特征标签，被删除的面记入 removed。
  3. 对每个面单独三角化，记录"面 → 三角形区间"和"边 → 线段区间"。
  4. 导出。每步一个 GLB，或整个模型一个 GLB 加每步的可见性/标签表。面分组可以拆成多个 primitive，也可以用 `_FEATURE_ID`/`_FACE_ID` 顶点属性表示。另附一个 JSON sidecar：`{step, featureName, createdFaces, modifiedFaces, removedFaces, edges, camera}`。
  5. 用 `gltfpack`/meshopt 压缩并量化。
- 面标识要跨步骤稳定。OCCT 的 TShape 指针和哈希在不同运行之间并不稳定，所以 ID 应由管线自己分配（例如"特征序号-面序号"），再依靠历史传播。历史缺失时，用面类型 + 面积 + 质心 + 法向做容差匹配兜底。
- 体积估算（推断）：
  - 未压缩的索引网格大约是每顶点 24 B（float32 位置 + 法向）加每三角形 12 B（uint32 索引）。一个 1,552 个三角形的零件约 40–70 KB，用 meshopt 压缩并量化后通常还能再缩小数倍。
  - 一节课 10–20 个步骤快照，合计约几百 KB 到 1–2 MB，而且可以按步懒加载。这仍然远小于 4.8 MB（brotli）的 OCCT wasm。
- CadQuery 同样基于 OCP，可以用 tags 和 OCP 的历史 API 实现同样的流程，但 build123d 的 `Select.LAST/NEW` 更加现成。

### Gaps
- build123d 的 `export_gltf` 是否会把 `label`/`color` 写成 glTF 的节点名和材质，文档中未确认，需要实际运行验证。
- 没有找到公开的"按特征打标 GLB"标准扩展（如 EXT_mesh_features）在 three.js 端的支持情况。

## 8. 课程型网站的内容与交互栈：MDX + Astro islands、Next.js 还是 Vite SPA；分步课程的状态机；动画库（GSAP、Motion、Theatre.js）

### Takeaway
内容密集、需要 SEO 的课程站最契合 Astro 7：2026-06-22 发布，当前版本 7.4.5，支持 MDX 加 React islands；Astro 已被 Cloudflare 收购，但仍为 MIT 许可。Next.js 16 也可行，但对于"几乎全是客户端 3D"的页面，RSC 带来的价值有限。Vite SPA 适合"工作台式"的沙盒页面。其余选型：
- 步骤逻辑用 XState v5 建模。
- 相机、爆炸、特征回放这类可拖动的时间线用 GSAP。它从 2025-04 起连同全部插件免费、可商用，但不得用于与 Webflow 竞争的可视化动画构建工具。
- UI 微交互用 Motion。
- Theatre.js 已经停滞，且其 studio 为 AGPL，不建议使用。

### Cited Findings
- Astro 7.0 于 2026-06-22 发布：`.astro` 编译器改用 Rust 实现，Markdown/MDX 走新的 Rust 管线，并升级到 Vite 8（Rolldown）。【声称】构建速度提升 15–61%。来源：[Astro 7.0 blog](https://astro.build/blog/astro-7/)
- npm 上 astro 最新为 7.4.5（2026-11-02），@astrojs/mdx 为 8.1.2，@astrojs/react 为 7.1.2。来源：[npm astro](https://www.npmjs.com/package/astro)
- 2026-01-16，Cloudflare 宣布收购 The Astro Technology Company。Astro 继续开源、保持 MIT 许可，并可部署在任意平台。来源：[Business Wire](https://www.businesswire.com/news/home/20260116386991/en/Cloudflare-Acquires-Astro-to-Accelerate-the-Future-of-High-Performance-Web-Development)
- Islands：交互按组件 opt-in 水合（客户端 islands），另有基于 `server:defer` 的服务端 islands。内容集合用 `src/content.config.ts` 加 `glob()` loader 校验 MD/MDX 的 frontmatter（据搜索摘要）。来源：[Astro docs: Islands](https://docs.astro.build/en/concepts/islands/)；[Astro docs: Content collections](https://docs.astro.build/en/guides/content-collections/)
- Next.js 16.4.5（npm 2026-11-03，MIT）；Vite 8.3.5（2026-10-21）。来源：[npm next](https://www.npmjs.com/package/next)；[npm vite](https://www.npmjs.com/package/vite)
- XState 5.33.3（2026-11-02，MIT，30,402 stars），@xstate/react 6.1.0。来源：[npm xstate](https://www.npmjs.com/package/xstate)；[GitHub statelyai/xstate](https://github.com/statelyai/xstate)
- GSAP 3.15.1（2026-11-04），npm 许可字段为 "Standard 'no charge' license"。来源：[GSAP Standard License](https://gsap.com/standard-license)；[npm gsap](https://www.npmjs.com/package/gsap)
  - 允许：在任何网站或应用（包括商业项目）中免费使用全部 GSAP，包括过去仅限会员的插件（如 SplitText、MorphSVG）。
  - 禁止：在与 Webflow 可视化动画构建能力竞争的无代码动画构建工具中使用（除非获得书面许可）；逆向工程以开发竞品。
  - 许可生效日为 2025-04-30。
- Motion 14.9.1（2026-11-04，MIT）。来源：[npm motion](https://www.npmjs.com/package/motion)
- Theatre.js 的状态。来源：[npm @theatre/core](https://www.npmjs.com/package/@theatre/core)；[GitHub theatre-js/theatre](https://github.com/theatre-js/theatre)；[Tracxn](https://tracxn.com/d/companies/theatrejs/__A3D8hIbBIofzMViuAKc0Ou2A7GmGNL-3NgV7kUF4jlg)
  - `@theatre/core` 0.7.2（Apache-2.0）和 `@theatre/studio` 0.7.2（AGPL-3.0-only）最后一次发布都在 2024-05-19。
  - 仓库最后推送于 2024-08-14，2026-08-04 以来 0 次提交。
  - 官方博客最新的文章仍是 2022 年的 v0.5 发布。
  - Tracxn 显示，截至 2026-06-30 公司仅有 2 名员工。

### Inferences
- 推荐选型：Astro 7 + MDX 写课程正文，React islands 承载 R3F 视图、草图求解器和步骤控制条。
  - islands 用 `client:visible` 懒水合。
  - 内核等大 wasm 只在需要它的 island 里通过 `import()` 加载，并放进 Worker。
  - 整站静态部署到 CDN 即可。
- Astro 方案的主要技术风险（需要在 spike 中验证）：Astro 的每个 island 都是独立的 React root，而 drei `<View>` 共享单一 canvas 要求所有 View 在同一棵 React 树里。解决思路是在页面级放一个"舞台" island，再用 portal/tunnel 把各处的 View 汇入；或者限制每页的实时 3D 数量。
- Next.js（App Router）可以做到同样的效果，但 3D 组件全都得是 `'use client'`，RSC/SSR 收益小，配置复杂度高。
- Vite SPA（+ React Router）最简单，适合"沙盒/工作台"子应用，可以作为子路径部署，与 Astro 内容站并存。
- 步骤状态机：每节课一台 XState machine，状态大致为 `idle → loading → step(n) ↔ playing/scrubbing → editing(param) → regenerating → error/fallback`。"内核失败时回退到预烘焙快照"应建模为一个显式状态。
- 动画分工：GSAP timeline 驱动相机和爆炸动画，可以绑定滚动或滑块；Motion 负责 DOM 层的过渡。

### Gaps
- 没有核实 R3F/drei 在 Astro 多 island 场景下共享单一 WebGL context 的成熟做法。
- 没有比较各框架在 MDX 中嵌入大型交互组件时的构建和水合性能数据。

## 9. 架构对比与推荐：A 在浏览器内运行真 B-rep 内核、B 用 build123d/OpenCascade 离线预烘焙并下发 GLB/JSON、C 两者混合

### Takeaway
从数字看，三种方案的差别如下：
- **A（浏览器内真内核）**：用户第一次交互前要额外下载约 4.6–8.2 MB（brotli）的 OCCT wasm。重建耗时从几毫秒到偶发的几十秒不等。它还把 LGPL 义务和 OCCT 8 的回归风险带到了前端。
- **B（离线预烘焙）**：每一步的快照只有几十 KB，加载即可用，结果确定，还可以离线验证；借助 build123d 的内核历史可以稳定地按特征高亮。缺点是用户不能任意改参数。

建议采用 **C（混合）**，分工如下：
- 默认走 B：逐特征回放、按特征高亮、爆炸图都使用预烘焙数据。
- A 只作为按需加载的"改参沙盒"：参数范围事先离线扫参验证，内核失败时回退到最近的预烘焙快照。
- 布尔直觉类的演示用 Manifold。
- 草图约束演示用 planegcs。

### Cited Findings
**体积汇总（【实测】2026-11-04；raw / gzip -9 / brotli -q 11）**

| 组件 | 版本 | raw | gzip | brotli | 许可 | 来源 |
|---|---|---|---|---|---|---|
| replicad OCCT（single） | replicad-opencascadejs 1.1.0 | 22.98 MB | 7.19 MB | 4.84 MB | LGPL-2.1-only | [tgz](https://registry.npmjs.org/replicad-opencascadejs/-/replicad-opencascadejs-1.1.0.tgz) |
| occt-wasm | 5.15.0 | 21.25 MB | 6.76 MB | 4.57 MB | 包装层 MIT/Apache；wasm 为 LGPL-2.1 | [tgz](https://registry.npmjs.org/occt-wasm/-/occt-wasm-5.15.0.tgz) |
| bitbybit OCCT（32-bit） | @bitbybit-dev/occt 1.6.0 | 31.62 MB | 9.62 MB | 6.39 MB | MIT + Apache + LGPL-2.1（附例外） | [tgz](https://registry.npmjs.org/@bitbybit-dev/occt/-/occt-1.6.0.tgz) |
| libcascade 完整绑定（single） | 3.1.0 | 42.75 MB | 12.16 MB | 8.23 MB | LGPL-2.1（附例外） | [tgz](https://registry.npmjs.org/libcascade/-/libcascade-3.1.0.tgz) |
| opencascade.js 完整构建 | 1.1.1（2023） | 65.86 MB | 13.73 MB | 9.15 MB | LGPL-2.1 | [tgz](https://registry.npmjs.org/opencascade.js/-/opencascade.js-1.1.1.tgz) |
| occt-import-js（仅导入） | 0.0.23 | 7.60 MB | 3.08 MB | 2.32 MB | LGPL-2.1 | [tgz](https://registry.npmjs.org/occt-import-js/-/occt-import-js-0.0.23.tgz) |
| brepkit-wasm（Rust） | 4.6.26 | 8.00 MB | 2.91 MB | 2.09 MB | AGPL-3.0-only | [tgz](https://registry.npmjs.org/brepkit-wasm/-/brepkit-wasm-4.6.26.tgz) |
| manifold-3d | 3.5.4 | 0.54 MB | 0.20 MB | 0.16 MB | Apache-2.0 | [tgz](https://registry.npmjs.org/manifold-3d/-/manifold-3d-3.5.4.tgz) |
| planegcs | 1.3.0 | 0.48 MB | 0.17 MB | 0.14 MB | LGPL | [tgz](https://registry.npmjs.org/@salusoft89/planegcs/-/planegcs-1.3.0.tgz) |
| three.core.js + three.module.js（未压缩、未 tree-shake） | 0.187.0 | 2.13 MB | 0.42 MB | 0.31 MB | MIT | [tgz](https://registry.npmjs.org/three/-/three-0.187.0.tgz) |
| three-cad-viewer min（内联 three r184） | 5.1.3 | 1.45 MB | 0.44 MB | 0.37 MB | MIT | [tgz](https://registry.npmjs.org/three-cad-viewer/-/three-cad-viewer-5.1.3.tgz) |
| 预烘焙 GLB 示例（planetary / arm） | text-to-cad 仓库 | 0.163 / 0.043 MB | 未测 | 未测 | MIT（仓库） | [repo](https://github.com/earthtojake/text-to-cad) |

- 由上表可推算出以下比例：replicad 的定制 OCCT 构建（4.84 MB brotli）比 libcascade 完整绑定（8.23 MB）小 41%，比 opencascade.js 1.1.1 完整构建（9.15 MB）小 47%。Manifold（0.16 MB）和 planegcs（0.14 MB）约为 replicad OCCT 的 1/30 和 1/35。

**性能与正确性参照**
- 网格提取（replicad 1.x 原生提取器，Node 环境，【声称】）：62 面零件约 12 ms，36k 三角形的曲面件约 249 ms。来源：[PR #263](https://github.com/sgenoud/replicad/pull/263)
- 单步 B-rep 操作（brepjs 基准，Node 环境，【声称】）：圆角 5.6 ms，倒角 4.9 ms，简单布尔 43–70 ms。来源：[brepjs benchmarks](https://github.com/andymai/brepjs/blob/main/benchmarks/results/latest.md)
- 长尾情况（【第三方】）：某个复杂布尔在 Chromium 中约 57 s，在 Firefox 中超过 90 s。来源：[Abundance #1958](https://github.com/BarbourSmith/Abundance/issues/1958)
- 正确性风险：OCCT 8 之后出现圆角失败或生成无效实体的回归。来源：[Abundance #1934](https://github.com/BarbourSmith/Abundance/issues/1934)
- 三种方案获取面标识/历史的方式不同：
  - replicad 的 `faceId` 是单次构建内的有界哈希。来源：[PR #263](https://github.com/sgenoud/replicad/pull/263)
  - occt-wasm 提供 `*WithHistory` 系列接口，返回面的演化记录。来源：[occt-wasm-5.15.0.tgz](https://registry.npmjs.org/occt-wasm/-/occt-wasm-5.15.0.tgz)
  - build123d 的 `Select.LAST/NEW` 基于操作历史。来源：[build123d docs](https://build123d.readthedocs.io/en/stable/topology_selection.html)

### Inferences
- **A（纯浏览器内核）**
  - 优点：可以任意改参数，也可以让学生自己写代码建模。
  - 代价一：首包额外 4.6–8.2 MB（brotli）。在 20 Mbps 下纯下载约 2–3.5 s，移动网络更长，之后还要编译。
  - 代价二：需要 Worker、超时和重启机制；OCCT 8 的回归和内存泄漏需要自建回归测试。
  - 代价三：按特征高亮需要自建历史，replicad 不提供；同时要承担前端的 LGPL 合规。
  - 适合作为单独的"代码建模沙盒"页面。
- **B（离线预烘焙）**
  - 优点：首屏只需要 three 加上每步几十 KB 的 GLB。结果确定，可以在 CI 中验证（BRepCheck、渲染快照）。面标签可以由 build123d 的历史稳定生成。前端不包含 OCCT，也就没有 LGPL 分发义务。
  - 缺点：用户不能任意改参数，内容生产需要一条 Python 管线。改参限制可以用离线参数网格缓解，例如每个滑块预烘焙 10–20 个离散值，或者只对 1–2 个参数做组合。
- **C（推荐）**
  - 默认走 B，覆盖约 90% 的交互：逐步回放、特征高亮、爆炸、剖切、测量。
  - A 以 island 的形式在"动手改参"环节按需加载。参数范围事先离线扫参验证。内核失败或超时时，回退到最近的预烘焙快照并提示用户。
  - 布尔直觉类的演示用 Manifold（0.16 MB），草图约束演示用 planegcs（0.14 MB）。
  - 渲染统一放在同一个 R3F 场景层中。数据格式统一为"面分组网格 + 边线段 + 特征标签表"，不论数据来自 GLB 还是实时内核。
- C 中 A 部分的内核选择：首选 replicad，它的 API 对教学友好，也与正在进行的 spike 一致。如果"实时按特征高亮"成为硬需求，再评估 occt-wasm/brepjs 的 `*WithHistory`。两者的 wasm 体积相近（brotli 4.84 MB 对 4.57 MB）。

### Gaps
- 关键数字仍缺实测：replicad 1.2 在中端笔记本和手机上的冷启动时间（下载 + 编译 + 首次出网格），以及典型教学零件上圆角和抽壳的重建时间。这些需要由并行的 spike 补齐。
- 离线参数网格的覆盖策略和存储成本，需要结合具体课程来估算。
