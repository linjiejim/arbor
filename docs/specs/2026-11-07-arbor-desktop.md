# Arbor：让本地 coding agent 建模的桌面工作台

- 状态：v0.1.0 已实现（分支 `feat/arbor-desktop`），待合并。
- 日期：2026-11-07
- 范围：一个 Electron 桌面应用。本机的 coding agent（Claude Code、Codex 等）通过 MCP 或命令行调用建模和观测工具；人在窗口里看、拖参数、改特征、在面或边上留备注。模型和 agent 的能力都来自本地 agent，Arbor 不调用任何模型。
- 不在范围：签名和自动更新、Windows / Linux 安装包、导入外部 STEP、代码特征、装配。
- 相关：`desktop/README.md`（怎么跑、怎么接、开发说明）、`docs/specs/2026-11-05-ai-modeling.md`（特征树和内核的总体方案）、`docs/dev/studio.md`

## 为什么

网页工作台的 AI 是一个公共额度的小模型，只能调 18 个工具，几何在浏览器里算。本机的 coding agent 强得多：能读写文件、跑命令、用 git、长时间自己循环。把同一套建模能力交给它，人只负责看和定向修改，正好是路线图里「AI 来建、人看懂改准」的分工。

## 已定的决定

| 问题 | 决定 | 理由 |
| --- | --- | --- |
| 外壳 | Electron（不用 Tauri） | 引擎是 Node（复用 `app/src/studio` 的同构内核），窗口在 Chromium 里跑和网站的 e2e 一致；Tauri 要再带一个 Node sidecar，还要适配 WKWebView |
| 名字 | Arbor | 既是「树」（特征树），也是机加工的「刀杆 / 心轴」；命令行 `arbor`，本机没有重名 |
| 代码放哪 | 同一个仓库：`app/src/desktop/`（引擎核心和窗口）、`desktop/`（Electron、MCP、CLI、打包） | 和网页工作台共用特征树、内核、视口组件，工作台的改进两边都得到；不改动网站的构建和部署 |
| 唯一的真相 | 零件文件 `*.arbor.json`（就是特征树 JSON），备注在旁边的 `*.notes.json` | agent 最擅长读写文件和 git；网页导出的特征树能直接打开 |
| 内核放哪 | Electron 主进程的 worker 线程 | 窗口关了 agent 也能用；一份内核一份状态；wasm 堆超过 1.4 GB 换线程，引擎无感 |
| agent 怎么连 | `arbor mcp`（stdio）→ 本机 HTTP（127.0.0.1 + 随机 token）→ App 的引擎；App 没开就自动启动；起不来退回无窗口引擎 | stdio 是所有 agent 都支持的方式；每一步都经过 App，人才看得见 |
| MCP 和 CLI | 同一张命令表（`app/src/desktop/core/catalog.ts`），各包一层 | 只维护一份；JSON Schema 由 zod 生成 |
| 工具 | 网页工作台的 17 个建模工具原样保留，加上零件、整体改、测量、核对、导出、备注、点选、高亮，共 33 个 | 建模部分和网页同一套描述和校验；新增的都是本地 agent 才用得上的 |
| 人和 agent 同时改 | 引擎按顺序执行所有修改；agent 下一次调用时，结果开头写出别人改了什么；`set_tree` 可带 `base_rev`，窗口里的整体修改都带 | 不让 agent 按旧状态覆盖人的改动 |
| 看图 | `look` 由窗口渲染（复用网页的 `renderViews`），窗口关着就开一个不抢焦点的 | Node 里没有 WebGL；备注编号画在图上 |
| 「核对」 | 一次性的 `check` 工具，不存进特征树 | 网页的「需求核对表」（`2026-11-07-studio-checklist.md`）会在特征树上加 `checks`，那时两边一起用它，现在不抢先定格式 |
| 网页组件的改动 | 只给 `StudioViewport` 加了一个可选的 `copy` 参数（提示语、按钮文字、下一个编号），缺省值就是网页原来的文字 | 尽量不碰正在并行开发的工作台代码 |

## 实现中发现并处理的

- **OpenCascade 往 stdout 打印**（写 STEP 时的统计）。`arbor mcp` 的 stdout 是协议通道，所以内核线程用单独的输出流，转到 stderr。
- **replicad 被打包了两份**。`desktop/src` 里的裸 import 走 esbuild 的 `nodePaths`，解析到了 CommonJS 的 `main`，和 ESM 版各有一份 `OC`。改为只在 `app/src` 里 import replicad，并让 esbuild 优先用 `module` 字段。
- **窗口被挡住时动画暂停**，agent 改模型后视角要等窗口到前台才更新：关掉了窗口的 background throttling。
- **备注状态的变化没有留痕**：现在「动态」里记下谁记了、处理了、重开了、删除了哪条备注，agent 也会被告知。
- **agent 先写英文量名**（`distance`）：`check` 和 `measure` 认英文别名（distance、diameter、area、gap、angle……）。
- **核对不了坐标**：真实使用里 agent 想核对「开口中心 X = 0」，只能绕道量到侧壁的距离，多花了 3 次调用。下一步让 `measure` 给出圆心和面中心的坐标，`check` 加位置项（要改共用的 `kernel/measure.ts`，等网页的核对表一起做）。
- **Codex 审查第一轮**（5 条，都已修）：
  - 编辑器在命令执行期间保存文件，会被引擎覆盖：现在命令开始前先跟上文件，写之前再确认，改过就以文件为准，这次的改动留在撤销里；
  - 从无窗口引擎切到 App 后，agent 的命令会落到窗口当前的零件：`arbor mcp` 记住 agent 打开的零件，每个命令都带上；
  - `parts/../box` 和 `box`、`/tmp` 和 `/private/tmp` 被当成两个零件：路径规范化并解开符号链接；
  - 换零件后，备注草稿和点选请求会落到别的零件上；
  - agent 取消高亮后，面和边还亮着。
- **Codex 审查第二轮**（只审修复的提交，2 条）：
  - 先按名字折叠 `..` 再解符号链接，`link/../box` 会指向别的文件：已修，`..` 留给系统的 `realpath`（native 版，按物理路径解析）；
  - 「agent 记住的零件被关掉后，下一个命令会把它重新载入」：不改。`close_part` 只给窗口用，agent 关不了零件；人在窗口里关掉一个 agent 还在改的零件，它的下一条命令接着改这个文件是有意的（文件是唯一的真相，agent 的会话还指着它）。
- `claude -p` 能连上 `arbor mcp`（33 个工具都加载了），但这台机器上 Claude Code 命令行的登录已过期，真实 agent 的建模循环用 Codex 跑完；Claude Code 这一侧要重新登录后再跑一遍。

## 验收

- [x] 引擎单元测试（真内核）：建模、核对、改动提醒、文件被外部修改、坏文件、撤销重做、`base_rev` 冲突、备注、导出、看图、点选、窗口专用命令对 agent 不可见（`app/src/tests/unit/desktop.test.ts`）
- [x] 用官方 MCP 客户端驱动 `arbor mcp`：无窗口 18 步、连 App 19 步（含 `look` 出图和 `show` 高亮）（`desktop/scripts/smoke-mcp.mjs`）
- [x] 在窗口里点面记备注，agent 用 `get_notes` 读到带选择器和草图坐标的备注
- [x] `request_pick`：横幅、点选卡片「就是这里」、超时后再次请求拿到晚到的回答
- [x] 打包：`Arbor.app` 和 `.dmg`；App 里自带的 `arbor` 命令可用
- [x] 真实 agent（Codex，经 MCP）从一句话建出零件：80×50×30 外壳、壁厚 2、R4、四角 M3 螺纹孔；14 次调用，`check` 16/16，看图，导出 STEP
- [x] 人和 agent 配合（Codex）：在窗口里点前壁写「开一个 9×3.5 的 USB-C 口，下沿离底 6」→ agent `get_notes`，用备注里的选择器在前壁上画草图、切穿壁厚，`check` 8/8，`resolve_note` 回复；窗口里备注变成已处理并显示回复
- [ ] Claude Code（`claude -p`）完整跑一遍：MCP 已连上（33 个工具），等命令行重新登录后再跑建模
- [x] 网站不受影响：本地 `npm run check`（165 个单元测试、oxlint 零警告）和工作台 e2e 4 项通过（含用到改过的标注卡片的「在模型上标注」）
- [ ] 完整 e2e 在 CI 上通过

## 下一步

1. **导入 STEP**（`import` 特征）：把开发板的官方模型拉进来做配合和干涉检查，`hardware-enclosure` 这类任务就能交给 Arbor。
2. **核对表落进特征树**：网页的需求核对表上线后，`check` 改为读写 `checks`，窗口里常驻显示。
3. **代码特征**：特征树表达不了的形状，用一段脚本产出实体，作为树里的一个节点。
4. Claude Code 的 UserPromptSubmit hook：每次发消息时自动带上未读备注。
5. 签名、自动更新，Windows / Linux 包。
