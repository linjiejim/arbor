# replicad kernel spike（浏览器内 B-rep 内核验证）

马克杯按特征重建：草图 → 旋转 → 底边圆角 → 抽壳 → 扫掠把手 → 合并 → 连接处圆角。
OpenCascade（replicad-opencascadejs 1.1.0，wasm）跑在 Web Worker 里，three.js 渲染，
时间线可拖动，每一步"新建 / 修改 / 未变"的面分三色显示，滑块改参数实时重建。

调研结论见 `../../research_notes/3D 工业建模交互学习网站调研/kernel_spike.md`。

## 运行

```bash
npm install          # 国内网络慢时见下方"安装"
npm run dev          # http://localhost:5199
```

- `?build=multi`：改用多线程 wasm（需要 COOP/COEP，dev server 已配置）
- `?tol=0.1&ang=0.3`：改网格精度（默认 0.05 mm / 0.2 rad）
- `?autobench`：加载后自动跑 10 次再生成并打到 console
- 控制台里 `[kernel] init / build / bench / extras` 开头的行是计时数据

## Node 端测量（不开浏览器）

```bash
node bench/node-bench.mjs        # 冷启动、再生成中位数、逐特征耗时、三角形数、失败用例、新面判定可靠性、内存
node bench/sizes.mjs             # wasm 原始 / gzip / brotli 体积（约 100 秒）
node bench/run-once.mjs          # 打印每一步每个面的判定结果（OCCT 历史 / 几何签名 / faceId）
node bench/extras.mjs            # 放样（方→圆）与拔模
node bench/planegcs-check.mjs    # planegcs 矩形约束求解、自由度
node bench/random-failures.mjs   # 随机参数下哪些组合失败、为什么（加参数 `40 front` 对比接缝在把手一侧）
node bench/probe-multi.mjs multi # 多线程 wasm 在 Node 里的速度
node bench/wasm-features.mjs     # wasm 段大小、内存上限
```

探查脚本（调查过程留下的，可单独跑）：`probe.mjs`（纯 replicad API 版马克杯）、
`probe-errors.mjs`（异常形态）、`probe-draft.mjs`（拔模 Flag 问题）、
`probe-memory-*.mjs`（连接处圆角导致的 wasm 内存增长，`node --expose-gc` 运行）。

真实下载耗时（brotli 压缩的 wasm + Chrome 网速模拟）：

```bash
npx vite build && node bench/serve-dist-br.mjs 5197   # 首次会花约 90 秒把两个 wasm 压成 .br
```

Safari 内核（JavaScriptCore）测量：

```bash
npx vite build --config bench/jsc/vite.jsc.config.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m bench/jsc/dist/harness.mjs
```

## 目录

- `src/kernel/mug.js` 参数化马克杯（每个特征一个 step）
- `src/kernel/ops.js` 保留 OCCT builder 历史的 revolve / fillet / shell / fuse（replicad 自带的会丢掉历史）
- `src/kernel/mesh.js` 网格提取（typed array）、几何签名、按签名判定新面
- `src/kernel/errors.js` 把 `WebAssembly.Exception` 解码成 OCCT 异常类型和信息
- `src/kernel/extras.js` 放样、拔模
- `src/worker.js` / `src/main.js` Worker 与 three.js 界面

## 安装

本机走 127.0.0.1:7890 代理访问 registry.npmjs.org 极慢（约 1 MB/分钟，wasm 包 49 MB 解压后）。
改用 npmmirror 且绕过代理，10 秒装完：

```bash
NO_PROXY="registry.npmmirror.com,cdn.npmmirror.com,.npmmirror.com,localhost,127.0.0.1" \
no_proxy="registry.npmmirror.com,cdn.npmmirror.com,.npmmirror.com,localhost,127.0.0.1" \
npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
```

`package-lock.json` 里的 resolved 地址因此是 npmmirror。
