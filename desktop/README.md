<p><img src="resources/icon-64.png" width="64" alt="Arbor"></p>

# Arbor

让本机的 coding agent（Claude Code、Codex……）通过 MCP 或命令行建参数化零件；你在 Arbor 窗口里实时看它每一步建了什么，拖参数、改特征，在面或边上留备注，agent 下一次调用就会知道。

名字：arbor 既是「树」（特征树），也是机加工里夹着刀具转的「刀杆 / 心轴」。图标是一根车削出来的阶梯轴，台阶叠起来像一棵松树。

- 建模能力和网页版 FeatureTree 工作台是同一套：特征树 JSON、语义选择器、OpenCascade 内核（`app/src/studio`）。
- AI 来自你自己的 agent：Arbor 不调用任何模型，也不需要 key。
- 零件就是一个 `.arbor.json` 文件（特征树 JSON），可以放进 git、可以直接编辑；备注在旁边的 `.notes.json`。

## 装好、跑起来

```bash
cd app && npm install --registry=https://registry.npmmirror.com      # 共用的代码和依赖
cd ../desktop
ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ NODE_USE_ENV_PROXY=1 \
  npm install --registry=https://registry.npmmirror.com
npm run build      # 构建到 dist/
npm start          # 打开 Arbor
```

- Electron 的二进制从 GitHub 下载，本机直连慢时用上面的镜像；`NODE_USE_ENV_PROXY=1` 让 Node 的 fetch 走 `https_proxy`。
- `npm run dev`：窗口走 Vite 开发服务器（热更新），主进程和引擎改了要重新运行。
- `npm run dist`：打包成 `release/mac-arm64/Arbor.app` 和 `release/Arbor-<版本>-arm64.dmg`。没有签名，第一次打开要右键 → 打开。

## 接入 agent

窗口右上角「接入 Agent」会给出这台机器上的完整命令。形式是：

```bash
claude mcp add --scope user arbor -- /Applications/Arbor.app/Contents/Resources/bin/arbor mcp
```

```bash
codex mcp add arbor -- /Applications/Arbor.app/Contents/Resources/bin/arbor mcp
```

从源码跑时，把路径换成 `desktop/bin/arbor`。其他支持 MCP 的 agent 写进它们的 `mcpServers` 配置（`command` + `args: ["mcp"]`）。

然后对 agent 说，例如：「用 arbor 建一个 80×50×30 的盒子，壁厚 2，外圆角 R4，四角 M3 螺纹孔，建完核对尺寸再看一眼。」

## 怎么工作

```
Claude Code / Codex ──MCP (stdio)──► arbor mcp ──HTTP 127.0.0.1──► Arbor 主进程：引擎 ◄──IPC──► 窗口
                     arbor CLI ───────────────────┘                  │ OpenCascade 在 worker 线程里
                                                                      ▼
                                              你的项目目录：part.arbor.json、part.notes.json
```

- **引擎**（`app/src/desktop/core/engine.ts`）管打开的零件、撤销、备注和全部命令；和平台无关，Electron 主进程和命令行用的是同一份。
- **内核**在 Node 的 worker 线程里跑（`desktop/src/engine/kernel-thread.ts`），wasm 堆超过 1.4 GB 就换一个线程重建，引擎感觉不到。
- **`arbor mcp`** 每次调用都转给正在运行的 App，所以窗口里能看到每一步；App 没开时会自动启动它（不抢焦点）；启动不了就在自己进程里起一个无窗口的引擎（这时 `look` 和 `request_pick` 不可用）。
- **谁改的都算**：agent、窗口里的你、直接改文件（编辑器、git），每次改动都记在「动态」里、都能撤销。agent 下一次调用时，结果开头会写「自你上次调用以来，用户改了：W 40 → 45」，避免它把你的改动改回去。
- **发现**：App 启动时把端口和随机 token 写进 `~/.arbor/engine.json`（权限 600），把怎么启动自己写进 `~/.arbor/app.json`；只监听 127.0.0.1，并检查 Host 头。

## 给 agent 的工具（36 个）

| 类 | 工具 |
| --- | --- |
| 零件 | `guide`、`open_part`、`list_parts`、`get_state` |
| 建模（和网页工作台同一套） | `set_params`、`sketch`、`extrude`、`revolve`、`fillet`、`chamfer`、`shell`、`hole`、`linear_pattern`、`circular_pattern`、`mirror`、`sweep`、`loft`、`draft`、`split`、`rib`、`edit_feature`、`delete_feature` |
| 导入（只有桌面版） | `import`：读一个 STEP 文件（开发板、元件的官方模型）。缺省作参考体：半透明显示，用来对齐和核对，不并入零件也不导出；`mode: "cut"` 从实体里减去（挖让位槽），`mode: "add"` 并入 |
| 整体改 | `set_tree`（可带 `base_rev` 防止覆盖）、`move_feature`、`undo`、`redo` |
| 观测 | `inspect`、`look`（窗口渲染的视图图片）、`measure` |
| 核对与交付 | `check`（和网页工作台同一张需求核对表：存进零件，每次重建自动重算；桌面版多两项：和参考体之间的 `clearance` 间隙、`interference` 不干涉）、`export`（step / stl / py / json） |
| 和人协作 | `get_notes`、`resolve_note`、`request_pick`（请你在窗口里点一个面或边，等你点完）、`show`（在窗口里高亮给你看） |

完整的说明在 MCP 的 instructions 里（`guide` 也能读到），坐标约定和选择器写法和网页工作台的提示词是同一份。

## 命令行

```bash
arbor help
arbor call open_part path=box create=true
arbor call set_params '{"set":{"L":80,"W":50}}'
arbor check box '{"size":[80,50,30],"solids":1}'     # 不需要窗口
arbor export box out/box.step
arbor look box -o shots/                             # 需要窗口，会自动打开 App
arbor setup                                          # 打印接入各个 agent 的命令
```

`--headless` 不连 App，在自己的进程里算（适合 CI 和脚本，这时要用 `--part` 指定零件）。

## 开发

```bash
cd app && npx vitest run src/tests/unit/desktop.test.ts   # 引擎的单元测试（真内核）
cd desktop && npm run check                               # 主进程、引擎、MCP、CLI 的类型检查
node scripts/smoke-mcp.mjs                                 # 用官方 MCP 客户端走一遍（无窗口）
node scripts/smoke-mcp.mjs --app                           # 连正在运行的 App，含 look 和 show
npm start -- --remote-debugging-port=9223                  # 然后：
node scripts/cdp.mjs shot out.png                          #   给窗口截图
node scripts/cdp.mjs click 520 470                         #   在窗口里点（CSS 像素）
python3 -I scripts/make-icons.py                           # 从 resources/logo/ 重新生成图标
```

代码在哪：

| 位置 | 内容 |
| --- | --- |
| `app/src/desktop/core/` | 引擎、命令表（MCP 和 CLI 从这里生成）、核对、备注、改动摘要、协议类型 |
| `app/src/desktop/` | 窗口：复用网页工作台的视口、特征树、参数、测量和剖视组件 |
| `app/vite.desktop.config.ts`、`app/desktop.html` | 窗口的构建入口 |
| `desktop/src/main/` | Electron 主进程、preload、接入命令 |
| `desktop/src/engine/` | 内核线程、文件、`~/.arbor`、本机 HTTP、连接 App 或无窗口引擎 |
| `desktop/src/mcp/`、`desktop/src/cli/` | `arbor mcp` 和 `arbor` 命令行 |

## 已知局限

- 只打了 macOS（arm64）包，没有签名和自动更新。
- 没有「代码特征」：特征树表达不了的形状还做不了（规划见 `docs/specs/2026-11-07-arbor-desktop.md`）。
- 导入的 STEP 是一个整体：选择器选不到它的面，核对只能对整个参考体量间隙和干涉；`mode: "cut"` 减去的是元件本身的外形，要留间隙得先在别处把它放大。
- 工作台里的「让助教改」按钮在桌面版会打开「给 agent 留一条备注」，但按钮上的字还是「助教」（共用组件里的文字）。
- 一个内核同一时间只装一个零件：agent 和窗口在不同零件之间来回切换时，每次切换要重建一次。
- `request_pick` 一次最多等 280 秒；没等到就返回，agent 用同一句 prompt 再调用会接着等，期间你点的也不会丢。
