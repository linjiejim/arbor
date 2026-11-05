# 浏览器内 B-rep 内核技术验证：replicad + OpenCascade.wasm

> 2026-11-04 · 代码：`spikes/replicad-kernel/`（`npm install && npm run dev`，见其 README）
> 数据标注：**实测** = 本次在本机跑出来的；**计算** = 由实测体积按带宽换算；**推测** = 没有实测，按经验或文档判断。

## 0. 结论速览

1. **能用，桌面端够快。** 马克杯 7 个特征（草图 → 旋转 → 底边圆角 → 抽壳 → 扫掠把手 → 合并 → 连接处圆角）在 Chrome 的 Web Worker 里实测：
   - 改一次参数、只出最终模型：约 **0.15 s**（中位数，10 次）
   - 7 步全部重建、每步出网格并标出新面：约 **0.43 s**
   - 建模运算本身只要约 **70 ms**，大头是三角化（网格）
2. **代价主要在首次加载。** wasm 原始 22 MB，brotli 后 **4.6 MiB**。Chrome 模拟 Fast 4G 实测下载 **5.0 s**，Slow 4G **27.5 s**。下载完后初始化约 0.15–0.2 s，首次重建因 JIT 冷启动约 0.7 s。
3. **"哪些面是这一步新建的"可以做得很可靠。** 改用 OCCT 自带的历史接口（Modified/Generated/IsDeleted）判定；随机 40 组参数、1694 个面里，和纯几何判定只有 1 处分歧。replicad 的 faceId 判"未变"0 处分歧。
4. **三个必须正视的风险：**
   - **内存。** 连接处圆角每做一次，wasm 内存就涨一截。几次之后停在约 **1.07 GB**，而且永不回落。手机端是否会被系统杀掉没有实测。
   - **失败形态。** 错误信息几乎没用：都是 `StdFail_NotDone: BRep_API: command not done`。另有几类"静默错误"：不报错，BRepCheck 也说有效，但几何是错的。
   - **参数耦合。** 底边圆角 ≤ 壁厚时抽壳必失败。在滑块全范围随机取参，**30% 的组合会失败**。
5. **建议：预烘焙为主、内核按需加载的混合方案（第 10 节）。**
   - 拆解页默认展示离线生成的 GLB（含每步的面标签），秒开，手机也稳。
   - "动手改参数"作为增强功能，在桌面端按需加载内核。
   - 草图约束用 planegcs（brotli 后 137 KB，自由度判断可用）。

---

## 1. 环境与版本

| 项 | 版本 / 说明 |
|---|---|
| replicad | 1.2.0（npm latest，2026-10-23 发布） |
| replicad-opencascadejs | 1.1.0（2026-09-04；由 taucad/opencascade.js `canary-ebd263f1` 构建）。包内未标 OCCT 版本；d.ts 注释用 `occ::handle`，推测是较新的 OCCT 开发线 |
| three | 0.187.0 |
| vite | 8.3.5（rolldown） |
| @salusoft89/planegcs | 1.3.0 |
| replicad-threejs-helper | 1.2.0（看过源码，最终没用：自己写了 typed array 版） |
| 机器 | MacBook Pro M1 Pro（8 核），macOS 26.2 |
| 运行环境 | Node 22.23.2（V8 12.4）；Chrome 156（chrome-devtools 控制的独立实例，页面可见）；JavaScriptCore（macOS 26.2 自带 `jsc`，即 Safari 的 JS/wasm 引擎）；另试了 Claude 桌面端内置浏览器（Chromium 152） |
| 测量条件 | **本机同时有其他负载**：另一个代理在用 brotli 压 wasm，还有 iOS 模拟器、Codex 等。load average 7–13，所以同一项多次测量有 10–30% 波动。下文给范围，或给出各次值 |

**网络：** 本机经 127.0.0.1:7890 代理访问 registry.npmjs.org 极慢（约 1 MB/分钟）。replicad-opencascadejs 解压后 49 MB，装了 15 分钟还没装完。改走 npmmirror 并绕过代理后 **10 秒**装完。国内用户下载 5 MB 级 wasm 时同理：**CDN 必须选国内节点并自托管**，不要依赖 jsDelivr/unpkg。

---

## 2. Spike 做了什么

- `src/kernel/mug.js`：参数化马克杯，每个特征一个 step。参数有高度、外径、壁厚、底边圆角、把手大小、把手粗细、连接处圆角。
- `src/kernel/ops.js`：带历史的 revolve / fillet / shell / fuse。replicad 自带的实现会在 `.Shape()` 后丢掉 OCCT builder，历史就没了，所以照着 replicad 的 OCCT 调用重写了一遍，保留 builder 来查历史。
- `src/kernel/mesh.js`：网格提取（直接从 wasm 堆拷 typed array，可 transfer 给主线程）、几何签名、按签名判新面。
- `src/worker.js` + `src/main.js`：Worker 里跑内核，主线程用 three.js 渲染。
  - 着色加边线，新建 / 修改 / 未变分三色
  - 时间线滑块，7 个参数滑块
  - 拖动时"最新的赢"：忙时只保留最后一次参数
  - 某步失败时，时间线停在该步并显示错误，前面的步骤照常显示
- 端口：dev server **5199**；验证生产构建时用过 vite preview **5198** 和 brotli 静态服务 **5197**。**三个服务都已停止。**
- 生产构建（`vite build`）也验证过能跑（Chrome，vite preview）。

---

## 3. 实测数据

### 3.1 体积（实测，Node zlib）

| 文件 | 原始 | gzip -9 | brotli q11 |
|---|---|---|---|
| `replicad_single.wasm` | 22,980,267 B（21.9 MiB） | 7,250,252 B（6.9 MiB） | **4,837,826 B（4.6 MiB）** |
| ↳ 补充 | | gzip -6：6.93 MiB | brotli q5：5.71 MiB |
| `replicad_multi.wasm`（多线程版） | 22,481,415 B | ≈6.9 MiB | ≈4.6 MiB |
| 胶水 JS `replicad_single.js` | 58 KB | 21 KB | 19 KB |
| Worker 包（replicad + 内核代码，压缩后） | 345 KB | 101 KB | 84 KB |
| 主线程包（three.js + UI） | 551 KB | 136 KB | 112 KB |
| `planegcs.wasm` | 484,003 B | 174,322 B | 136,626 B |

补充：
- wasm 内部：code 段 19.3 MB，data 段 2.5 MB。
- 线性内存初始 100 MB，上限 4 GB。
- npm 包本身含单线程和多线程两份 wasm，外加两份各 1.6 MB 的 d.ts。

### 3.2 下载 + 冷启动

**下载（实测）。** 本地静态服务器按 brotli 发 wasm，Chrome 156 用 DevTools 网络预设模拟：

| 网络预设 | wasm 下载（Worker 内 fetch） | 到内核可用 |
|---|---|---|
| Fast 4G | **5.03 s** | 5.51 s |
| Slow 4G | **27.5 s** | 29.1 s |
| localhost（dev server，未压缩 23 MB） | 40–200 ms | — |

**下载（计算）。** 按 brotli 4.84 MB / gzip 7.25 MB 换算：

| 带宽 | brotli | gzip |
|---|---|---|
| 10 Mbps | 3.9 s | 5.8 s |
| 20 Mbps | 1.9 s | 2.9 s |
| 50 Mbps | 0.8 s | 1.2 s |
| 100 Mbps | 0.4 s | 0.6 s |

**初始化（实测，不含网络）**：

| 环境 | 编译 + 实例化 + embind 注册 |
|---|---|
| Chrome 156，全新隔离上下文（新进程） | 中位 **189 ms**（144 / 189 / 200；更早两次 119 / 317）。compile 21–50 ms，instantiate 51–71 ms |
| Node 22，全新进程 ×5 | 中位 99–139 ms（三轮测量） |
| JavaScriptCore（Safari 引擎） | 143–221 ms（compile 61–107，instantiate 78–109） |
| Claude 内置浏览器（Chromium 152，窗格隐藏） | 1,171–1,331 ms（instantiate 871–989）。窗格隐藏时疑似被系统降到后台优先级，**不作基准**，只说明不利条件下会慢 5–10 倍 |

**首次重建（实测）。** 初始化后第一次跑 7 步，JIT 还是冷的：

| 环境 | 7 步全量（建模 + 每步网格 + 判新面） | 其中建模运算 |
|---|---|---|
| Chrome 156，新进程 ×3 | 780 / 686 / 736 ms | 270–296 ms |
| Node | 720–822 ms | 231–279 ms |
| JSC | 627–956 ms | 221–389 ms |

同一 Chrome 进程第二次打开页面时，首次重建只要约 430 ms，因为 V8 在进程内缓存了已编译的模块。

### 3.3 改参数后的重建（实测，各 10 次取中位数，0.05 mm / 0.2 rad 网格）

| 环境 | A. 7 步全量（拆解页需要） | 其中建模 | 网格(7 步) | 判新面(签名法) | B. 只出最终模型（拖滑块） | 主线程往返（含传输 + three.js 建对象） |
|---|---|---|---|---|---|---|
| Chrome 156 单线程 | **429 ms**（另一轮 397） | 74 | 270 | 86 | **151 ms**（138） | 418 ms（另一轮 393） |
| Chrome 156 多线程版 | **251 ms**（另一轮 334） | 67 | 102 | 82 | **87 ms**（110） | — |
| Node 22 | 528 ms（530 / 609） | 70 | 308 | 148 | 166 ms（163 / 214） | — |
| JSC（Safari 引擎） | 433 ms（另一轮 544） | 70 | 271 | 93 | 151 ms（190） | — |

- A 列包含"几何签名法"判新面的开销。只用 OCCT 历史法判新面的话，可省掉这 80–150 ms。
- 同样 6 个运算直接用 replicad 原生 API（不记历史）：72–76 ms。记历史的开销在噪声范围内。
- three.js 建 7 个几何体：≈1 ms。

### 3.4 逐特征耗时（实测）

| 特征 | 首次（Chrome 新进程） | 预热后建模 Chrome / Node | 网格（Node） | 判新面·签名法（Node） | 面数 | 三角形 |
|---|---|---|---|---|---|---|
| 草图 sketch | 17–20 ms | 0.5 / 0.5 ms | 0.3 | 0.4 | 1 | 2 |
| 旋转 revolve | 8–11 | 0.65 / 0.6 | 3.0 | 2.9 | 3 | 356 |
| 底边圆角 fillet | 25–31 | 1.0 / 0.9 | 20.8 | 4.0 | 4 | 4,484 |
| 抽壳 shell | 26–30 | 1.7 / 3.0 | 41.9 | 7.5 | 7 | 8,780 |
| 扫掠把手 sweep | 20–22 | 2.1 / 1.8 | 69.6 | 12.8 | 14 | 13,312（杯身 + 把手） |
| 合并 fuse | 127–132 | **45 / 43.5** | 71.2 | 20.4 | 12 | 13,412 |
| 连接处圆角 fillet | 43–52 | **21 / 19.0** | 100.9 | 100.5 | 14 | 15,992 |

**结论：** 布尔合并和连接处圆角占了建模时间的 90%。真正的瓶颈是三角化（BRepMesh）：同一个形状再网格化一次照样要 93 ms，**没有缓存**。

### 3.5 三角形数量 vs 精度（实测，最终马克杯，Node）

| 线性 / 角度容差 | 三角形 | 顶点 | 数组体积 | 网格耗时 |
|---|---|---|---|---|
| 0.001 mm / 0.1 rad（**replicad 默认值**） | 332,408 | 172,111 | 7.9 MB | **4.2 s** |
| 0.01 / 0.1 | 68,976 | 37,080 | 1.7 MB | 525 ms |
| **0.05 / 0.2（spike 使用）** | 15,992 | 9,228 | 404 KB | 101 ms |
| 0.1 / 0.3 | 8,182 | 4,947 | 212 KB | 51 ms |
| 0.2 / 0.5 | 3,280 | 2,208 | 90 KB | 18 ms |

- **必须显式传 tolerance**：replicad 默认 0.001 mm 对网页完全不可用。
- 拖动时用 0.2 mm、松手再用 0.05 mm，可把拖动时的网格成本降到约 18 ms。
- replicad 自带的 `shape.mesh()` 用 `Array.from` 拷数据，比直接拷 typed array 只慢约 2%（100 vs 98 ms）。主要好处是能零拷贝 transfer 给主线程。

### 3.6 内存（实测）——最大风险

- wasm 线性内存从初始 100 MB 起步，第一次全量重建后到 178 MB。
- **连接处圆角**（对布尔求交得到的 B 样条边做 `BRepFilletAPI_MakeFillet`）每次调用让内存再长约 60–270 MB。做 5–9 次后停在 **1,073 MB**，之后再重建 60 次以上都不再增长：是高水位，不是无限泄漏。
- wasm 内存只增不减，这 1 GB 一直占着。
- 进程实际常驻内存：Node RSS 约 400 MB（只循环圆角）到 726–825 MB（跑完整基准）。
- 其他环境：Chrome 同样到 1,073 MB（多线程版 1,179 MB），JSC 同样到 1,073 MB。
- 排查过的因素：
  - 底边圆角（圆形边）和布尔合并都不涨。
  - 换 `ChFi3d_Rational / Polynomial / QuasiAngular` 三种圆角模式，结果一样。
  - 强制 GC 无效。
  - 内存上限是 4 GB，不是撞上限。
  - 根因没查到（OCCT 圆角算法的大块临时分配，或分配器碎片）。
- **手机影响（推测，未实测）**：
  - iOS Safari 单页可用内存大约在 1–2 GB 量级，旧机型更低。1 GB 的 wasm 内存加上页面本身，有被系统杀掉页面的风险。
  - 必须在真机上验证（iPhone 12/13 档、中端安卓各一台）。
  - 兜底办法：内存超过阈值就重启 Worker，代价是一次初始化加一次冷 JIT，约 0.5–1 s。

### 3.7 多线程版（实测）

- 需要页面 crossOriginIsolated，即 `COOP: same-origin` + `COEP: require-corp`。Chrome 里 `threads=true`，可用。
- 效果：
  - 网格提速 1.7–3 倍（Chrome 两轮 244 → 142、270 → 102 ms；Node 最终网格 93 → 30 ms）。
  - 布尔、圆角不提速：Chrome 一轮慢约 35–40%（66 → 92 ms），另一轮持平；Node 持平。
  - "只出最终模型"从 138–151 ms 降到 87–110 ms。
- 代价：COEP 会拦截没有 CORP 头的第三方资源，比如外站图片、B 站/优酷 iframe。`credentialless` 模式能缓解，但 Safari 是否支持需另查（未验证）。
- 建议：先用单线程版，多线程留作桌面端可选优化。

### 3.8 浏览器兼容（部分实测）

- 这份 wasm 用的是**旧版 wasm 异常处理**指令（opcode 0x06 `try`）。实测方法：Node 关掉 `--experimental-wasm-legacy-eh` 后无法编译。
  - 主流浏览器支持旧版 EH 的版本（**引用兼容表，未逐一实测**）：Chrome 95+、Firefox 100+、Safari 15.2+。
- 在 JavaScriptCore（macOS 26.2）里整套内核跑通（实测），速度与 V8 同量级。
- 没测真机 Safari 和安卓；也没测 CPU 降频：Chrome DevTools 的 CPU throttling **对 Worker 不生效**（实测：开 4 倍降频后 Worker 耗时不变）。
- 手机端性能（推测）：中端安卓单核大约是 M1 的 1/3–1/5，"只出最终模型"可能要 0.5–0.8 s，7 步全量 1.5–2 s；近两代 iPhone 与 M1 同量级。

---

## 4. "这一步新建了哪些面"：三种做法与可靠性

### 4.1 三种做法

1. **OCCT 历史（推荐）**
   - 做法：运算后保留 builder，对输入形状的每个面问 `Modified(face)`、`Generated(face)`、`IsDeleted(face)`，再对被圆角的边问 `Generated(edge)`。结果面中：与输入面 `IsSame` 的算"未变"，出现在 Modified 列表里的算"修改"，其余算"新建"。
   - 条件：replicad 的 `fillet/shell/fuse` 会丢掉 builder，所以要在 `ops.js` 里重写，每个 20–40 行。用的是同一组 OCCT 调用，这个 wasm 构建里都有绑定。
   - 开销：在测量噪声内（有历史 70–87 ms，原生 replicad 72–76 ms）。
2. **几何签名**
   - 做法：面类型 + 面积 + 质心与上一步一致，算"未变"。否则从本面三角网里取最大三角形的重心，投影回本面曲面得到采样点；若它落在上一步某个同类型面的**底层曲面**上（`GeomAPI_ProjectPointOnSurf` 距离 < 1e-4），算"修改"。其余算"新建"。
   - 优点：不依赖 builder，对预烘焙流程也适用。
   - 开销：一次 7 步重建要 80–150 ms，主要花在 B 样条面的投影上。
3. **replicad faceId**
   - 网格 `faceGroups[i].faceId` 就是 `face.hashCode`（OCCT TShape 的哈希）。用它把网格分组对应回 `shape.faces`，所有测试中 **0 次失配**。
   - 上一步出现过的 faceId 就是同一个面对象，可以零成本判"未变"。
   - 缺点：分不清"修改"和"新建"，两者都会换新 id。

### 4.2 可靠性（实测）

在滑块范围内随机取 40 组参数，共 1,694 个面：

- 历史法 vs 签名法：**1 处分歧**。某组参数下杯口环面被 OCCT 报为 Modified，但几何完全没变，签名法判"未变"。对 UI 来说签名法这次更合理。
- faceId 判"未变" vs 历史法判"未变"：**0 处分歧**。
- 网格分组映射回面：0 次失配。

推荐做法是三者结合：
1. faceId 判"未变"，零成本；
2. 历史法区分"新建"和"修改"；
3. 历史说"修改"但签名完全相同时，降级为"未变"。

### 4.3 默认参数下每步的判定结果（实测，与 OCCT 历史一致）

| 步骤 | 新建 | 修改 | 未变 | 删除 |
|---|---|---|---|---|
| 草图 | 1 平面 | | | |
| 旋转 | 3（底面、圆柱、顶面） | | | |
| 底边圆角 | 1 环面 TORUS | 2（底面、圆柱被裁短） | 1（顶面） | |
| 抽壳 | 3（内圆柱、内环面、内底面） | 1（**顶面 → 杯口环形面**） | 3 | |
| 扫掠把手 | 7（把手：3 圆柱 + 2 环面 + 2 端盖） | | 7（杯身） | |
| 合并 | **0** | 3（杯身外圆柱开孔、把手两端圆柱被截） | 9 | 2（把手端盖，埋进杯壁） |
| 连接处圆角 | 2（B 样条圆角面） | 3 | 9 | |

教学上要注意两点：
- **抽壳后的杯口面，OCCT 认为是"顶面被修改"，不是新建。** 签名法结论相同。如果课程想把它讲成"新出现的面"，需要人工标注。
- **合并不产生新面**，只有修改和删除。时间线这一步应该高亮"被修改 / 被删除"，而不是"新建"。

另：扫掠这一步的历史是手工给的（杯身全"未变"、把手全"新建"），没有走 `MakePipeShell` 的历史接口。

### 4.4 一个建模细节：旋转接缝的位置会影响后面的稳定性

旋转体的圆柱面有一条接缝，位置就是轮廓草图所在的半平面。

- **接缝在把手一侧（+X）时**：两条连接线都被接缝切成两段，圆角面从 2 个变成 4 个；随机 40 组参数里有 2 组连接处圆角失败，找不到几何上的原因。
- **把轮廓画在 −X、接缝挪到杯背后后**：这 2 组都成功了，圆角面回到 2 个。

经验：课程模型要把接缝、分割线放在远离后续特征的位置。

---

## 5. 失败用例与错误怎么暴露（实测）

**错误形态：**
- OCCT 的 C++ 异常在 JS 里是原生 `WebAssembly.Exception` 对象。
- 用 `oc.getExceptionMessage(err)` 可解出 `["StdFail_NotDone", "BRep_API: command not done"]`。之后要调 `oc.decrementExceptionRefcount(err)` 释放。
- 信息只说明"没做成"，**不说原因**。
- 失败很快：7–40 ms。连接处圆角失败要约 280 ms。
- Worker 返回 `{ key, label, error: { type, message } }`，UI 停在失败步并显示错误，前面的步骤照常显示（已验证）。

| 用例 | 结果 |
|---|---|
| 底边圆角 45 > 半径 41 | 圆角步失败：StdFail_NotDone（7–10 ms） |
| 底边圆角 20 | 成功，BRepCheck 有效 |
| **底边圆角 3 < 壁厚 3.5；或两者都等于 3.5** | **抽壳步失败**：内侧环面向内偏移后半径 ≤ 0，`MakeThickSolid` 做不了。商用 CAD 一般能处理这种情况 |
| 壁厚 30、45 | 抽壳失败（圆角 6 < 壁厚） |
| 连接处圆角 4、6（6 大于把手管半径 5） | 成功，有效 |
| 把手过高（高度 60 + 把手 1.4 倍，把手顶出杯口） | 连接处圆角失败（≈280 ms） |
| 滑块范围内随机 40 组 | **12 组失败**：11 组是抽壳，且全部是"底边圆角 ≤ 壁厚"；1 组是把手超出杯身 |
| 没选中任何边就圆角 | replicad 抛 JS Error："Could not fillet, no edge was selected" |

**静默错误**：不抛异常、`BRepCheck_Analyzer` 也报有效，但几何是错的。

- **未倒圆的杯身抽壳 45 mm**（大于半径 41）：返回实体体积 499,183 mm³，几乎等于实心体积，根本没抽空。
- **replicad `shell()` 没选中要删的面**：不报错，只返回内侧偏移实体，体积 403,745 mm³。`ops.js` 里已加了保护。
- **把手管半径 8 > 弯角半径 7.2**：照样"成功"，BRepCheck 有效。按几何推断管子内侧已自相交，BRepCheck 默认不查自交。
- 对策：
  - 每步做体积、包围盒合理性检查；
  - 把参数耦合写进滑块范围，比如底边圆角 ≥ 壁厚 + 0.5；
  - 离线把参数空间扫一遍（`bench/random-failures.mjs` 就是这个思路），把失败区域写成课程里的"为什么失败"讲解，别把 OCCT 原文丢给学习者。

---

## 6. API 覆盖：放样、拔模（实测）

- **放样（正方形 → 圆）**
  - 代码：`sketchRectangle(40,40).loftWith(sketchCircle(20,{plane:"XY",origin:[0,0,50]}))`
  - 结果：成功，首次 37 ms、之后 4 ms；5 个 B 样条侧面 + 2 个平面，BRepCheck 有效。
  - replicad 的 loft 默认 `ruled: true`。两个截面时 ruled 与否结果相同。
- **拔模（平面）**
  - 代码：`makeBox([-20,-20,0],[20,20,30]).draft(5, f => f.ofSurfaceType("PLANE").atAngleWith("Z", 90))`
  - 结果：成功。顶面从 1600 缩到 1207.6 mm²，与理论 (40−2·30·tan5°)² 一致。
- **拔模（圆柱面）**
  - 用 replicad 的 `draft()`：失败，抛 `Standard_NoSuchObject`，消息为空。原因是 replicad 1.2.0 把 `BRepOffsetAPI_DraftAngle.Add(...)` 的 Flag 写死为 `false`，又不检查 `IsDone()`，于是在 `ModifiedShape()` 处报错。
  - 直接调 OCCT、Flag 传 `true`：成功，圆柱变成圆锥，体积 443,240 mm³，与圆台公式一致。
  - 另外 `DraftAngle.Status()` 调不了：`Draft_ErrorStatus` 这个类型在绑定里缺失。
- 结论：常用造型 API 都在；replicad 封装有少量粗糙处，必要时可以直接调 OCCT（`getOC()`）。

---

## 7. planegcs（FreeCAD 二维约束求解器，实测，Node）

- 安装：npm 正常。wasm 484 KB，gzip 174 KB，brotli **137 KB**。初始化 7–11 ms。
- 测试：手画一个歪四边形（4 点 4 线），逐步加约束：

| 阶段 | 求解状态 | 自由度 dof | 完全约束 |
|---|---|---|---|
| 无约束 | Success | 8 | 否 |
| + 两横两竖 | Success | 4 | 否 |
| + 宽 60、高 40 | Success | 2 | 否 |
| + 左下角定在原点（coordinate_x/y） | Success | **0** | **是**（求解 0.05 ms，四点精确到 (0,0)(60,0)(60,40)(0,40)） |
| + 重复的宽 60 | Converged | 0 | 否：报**冗余** `[18]` |
| 上边 70 与下边 60 冲突 | **Failed** | −1 | 否：报**冲突** `[10,11,12,13,14,19]` |
| 改宽度为 80 再解 | Success | | 0.04 ms |

- 能报告自由度、完全约束、冗余和冲突，足够做"草图是否完全定义"的教学提示。
- 注意事项：
  - `debug_mode` 默认为 Minimal，会往 stdout 打求解日志，要设成 `DebugMode.NoDebug`。
  - README 说部分约束设为 non-driving 时不正常。
  - 许可证 LGPL-2.0+。wasm 作为独立文件加载，合规成本低；replicad-opencascadejs 是 LGPL-2.1，同理。
  - 在 Vite 里要显式给 `locateFile` 指向 `?url` 导入的 wasm。只在 Node 里验证了，没在浏览器里跑。

---

## 8. 踩过的坑（汇总）

1. **npm 下载走代理极慢**（见第 1 节）：改用 npmmirror 且绕过代理。
2. **replicad 网格默认精度 0.001 mm**：一个杯子出 33 万三角形、算 4 秒。必须显式设精度。
3. **replicad 不暴露 OCCT 历史**：要自己包一层运算（`ops.js`），或者给上游提 PR。
4. **错误信息无原因**，另有静默错误（第 5 节）。
5. **replicad `draft()` 对圆柱面失败**（第 6 节）。
6. **旋转接缝位置影响圆角稳定性**（第 4.4 节）。
7. **连接处圆角把内存推到约 1 GB**（第 3.6 节）。
8. **Chrome DevTools CPU 降频对 Worker 无效**，无法用它模拟慢手机。Safari 内核改用 `jsc` 测。
9. **Claude 桌面端内置浏览器窗格隐藏时，计时慢 5–10 倍**。基准改用 chrome-devtools 控制的独立 Chrome。
10. **Vite 配置**：
    - Emscripten 胶水靠 `import.meta.url` 找 wasm，要把 `replicad-opencascadejs` 加进 `optimizeDeps.exclude`；
    - wasm 用 `import wasmUrl from "replicad-opencascadejs/wasm?url"` 拿地址；
    - 多线程版要配 COOP/COEP 头。
11. **生产部署要点**：wasm 要预压 brotli，`Content-Type: application/wasm`（才能走 `instantiateStreaming`），加长缓存，并自托管在国内 CDN。

---

## 9. 跑通的 API 片段

```js
// Worker 内加载（Vite）
import opencascade from "replicad-opencascadejs";            // dist/replicad_single.js
import wasmUrl from "replicad-opencascadejs/wasm?url";
import { setOC } from "replicad";
const oc = await opencascade({ locateFile: () => wasmUrl });
setOC(oc);
// Node：const oc = await opencascade(); setOC(oc);
```

```js
// 马克杯（replicad 原生 API 版；spike 里同样的运算换成了带历史的 ops.js）
import { draw, sketchCircle, bottomMost } from "replicad";
const body = draw([0, 0]).hLine(-R).vLine(H).hLine(R).close()   // 画在 -X：接缝在杯背后
  .sketchOnPlane("XZ").revolve()                                  // 绕 Z 轴
  .fillet(rb, (e, s) => e.ofCurveType("CIRCLE").when(bottomMost(s)))
  .shell(t, (f) => f.inPlane("XY", H));                           // 去掉顶面、向内抽壳
const handle = draw([R - t / 2, zc + span / 2])                    // 起点埋在杯壁里，合并时端盖被吞掉
  .hLine(dx).customCorner(rc).vLine(-span).customCorner(rc).hLine(-dx).done()
  .sketchOnPlane("XZ")
  .sweepSketch((plane, origin) => sketchCircle(hp, { plane, origin }));
const mug = body.fuse(handle).fillet(rj, (e) =>
  e.when(({ element }) => /* 不是直线/圆，且采样点都在杯身外圆柱 r=R 上 */ onBodyCylinder(element)));
const mesh = mug.mesh({ tolerance: 0.05, angularTolerance: 0.2 }); // faceGroups[i].faceId === face.hashCode
```

```js
// 保留 OCCT 历史的圆角（ops.js 的核心）
const b = new oc.BRepFilletAPI_MakeFillet(shape.wrapped, oc.ChFi3d_FilletShape.ChFi3d_Rational);
edges.forEach((e) => b.Add(radius, e.wrapped));
const result = cast(b.Shape());                       // 失败时抛 StdFail_NotDone
for (const f of shape.faces) {
  const mods = b.Modified(f.wrapped);                 // NCollection_List_TopoDS_Shape
  const deleted = b.IsDeleted(f.wrapped);
}
for (const e of edges) b.Generated(e.wrapped);        // 圆角面从这里来
// 遍历列表：先复制 new oc.NCollection_List_TopoDS_Shape(list)，再循环 First() / RemoveFirst()
// fuse 用 BRepAlgoAPI_Fuse：Build() 后可 SimplifyResult()，历史仍然有效；SectionEdges() 直接给出交线
```

```js
// 解码 OCCT 异常
try { /* ... */ } catch (err) {
  if (err instanceof WebAssembly.Exception) {
    const [type, message] = oc.getExceptionMessage(err); // ["StdFail_NotDone","BRep_API: command not done"]
    oc.decrementExceptionRefcount(err);
  }
}
```

```js
// 圆柱面拔模：绕开 replicad 的 Flag=false
const b = new oc.BRepOffsetAPI_DraftAngle(body.wrapped);
b.Add(cylFace.wrapped, new oc.gp_Dir(0, 0, 1), 3 * Math.PI / 180,
      new oc.gp_Pln(new oc.gp_Pnt(0, 0, 0), new oc.gp_Dir(0, 0, 1)), true);
b.Build(); if (!b.IsDone()) throw new Error("draft failed");
const cone = cast(b.ModifiedShape(body.wrapped));
```

```js
// planegcs
import { make_gcs_wrapper, DebugMode } from "@salusoft89/planegcs";
const gcs = await make_gcs_wrapper();                 // Vite: init_planegcs_module({ locateFile: () => url })
gcs.debug_mode = DebugMode.NoDebug;
gcs.push_primitives_and_params([
  { id: "1", type: "point", x: 1, y: -2, fixed: false }, /* … */
  { id: "5", type: "line", p1_id: "1", p2_id: "2" },     /* … */
  { id: "10", type: "horizontal_l", l_id: "5" },
  { id: "14", type: "p2p_distance", p1_id: "1", p2_id: "2", distance: 60 },
  { id: "16", type: "coordinate_x", p_id: "1", x: 0 },
]);
const status = gcs.solve(); gcs.apply_solution();
gcs.gcs.dof(); gcs.get_gcs_redundant_constraints(); gcs.get_gcs_conflicting_constraints();
```

---

## 10. 建议

**结论：预烘焙为主、内核按需加载。** 不建议只靠浏览器内核。

### 1. 拆解页默认走预烘焙

- 离线跑同一份模型代码，每个特征导出一份 GLB，加上每个面的新建 / 修改 / 未变标签（JSON 或 glTF extras），标签由 OCCT 历史生成。
- 体积：16k 三角形一步约 400 KB 原始数组（实测）。量化或 meshopt 后约 70–100 KB 一步、7 步 1 MB 以内（推测，按常见压缩比估算），远小于内核的 4.9 MB。打开即看，所有手机可用，没有 1 GB 内存风险。
- 参数可以做 2–5 个预设档位的离线组合。连续拖动做不到预烘焙：7 个滑块的组合空间是指数级的。

### 2. "动手改参数"作为增强功能，桌面端按需加载内核

- 加载时机：用户点"试试改参数"时加载，或桌面端空闲时后台预取；显示下载进度。
- 运行方式：Worker 里跑，拖动时"最新的赢"，粗网格（0.2 mm，约 18 ms）、松手再出细网格。
- 少算：只重算被改特征之后的步骤；网格只出当前步和最终步，其余步骤用到时再算。这样桌面端拖滑块能做到 0.1–0.15 s 一帧。
- 内存超过阈值（如 700 MB）就重启 Worker。
- 多线程版留作桌面可选：网格快 2 倍左右，但要 COOP/COEP。

### 3. 用同一份 JS 模型代码兼顾两条路

replicad 在 Node 里照样能跑（本次所有基准都在 Node 里跑过），所以离线烘焙也可以直接用 replicad，模型只写一份。若内容团队更习惯 Python 的 build123d，代价是需要实时调参的模型要写两份。build123d 底层同样是 OCCT，可以用 OCP 调 `Modified/Generated` 导出同样的面标签。

### 4. 每个课程模型都要做参数可行域

- 把耦合写进滑块，比如底边圆角 > 壁厚、把手不超出杯身。
- 离线随机扫描参数空间，在 CI 里跑。
- 把失败做成讲解（"为什么抽壳失败"）；体积和包围盒检查拦住静默错误。

### 5. 草图环节用 planegcs

137 KB，求解不到 3 ms，能给出自由度、完全约束、冗余和冲突，适合做"草图完全定义"的交互教学。

### 6. 立项前要补的验证

1. 真机测试：iPhone 一台、中端安卓一台。测 1 GB 内存高水位会不会导致页面崩溃，以及首次和预热后的耗时。
2. 查连接处圆角的内存来源：试新版 replicad-opencascadejs，或换圆角参数、换分配器，必要时给上游提 issue。
3. 实测预烘焙 GLB（量化后）的实际体积，以及面标签的数据格式。
4. 评估服务端内核（Python + OCP，参数变化时返回 GLB）作为第三种方案。客户端零下载，代价是服务器成本和网络往返。
