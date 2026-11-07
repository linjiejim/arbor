# Arbor：让本地 coding agent 建模的桌面工作台

- 状态：v0.1.0 已上线（导入 STEP 一起，见 PR 22）；v0.2.0 加上自动更新，在 GitHub Releases 发布。
- 日期：2026-11-07
- 范围：一个 Electron 桌面应用。本机的 coding agent（Claude Code、Codex 等）通过 MCP 或命令行调用建模和观测工具；人在窗口里看、拖参数、改特征、在面或边上留备注。模型和 agent 的能力都来自本地 agent，Arbor 不调用任何模型。
- 不在范围：Apple 签名和公证、Windows / Linux 安装包、代码特征、装配约束。
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
| 工具 | 网页工作台的建模工具原样保留，加上零件、导入、整体改、测量、导出、备注、点选、高亮，共 36 个 | 建模部分和网页同一套描述和校验；新增的都是本地 agent 才用得上的 |
| 人和 agent 同时改 | 引擎按顺序执行所有修改；agent 下一次调用时，结果开头写出别人改了什么；`set_tree` 可带 `base_rev`，窗口里的整体修改都带 | 不让 agent 按旧状态覆盖人的改动 |
| 看图 | `look` 由窗口渲染（复用网页的 `renderViews`），窗口关着就开一个不抢焦点的 | Node 里没有 WebGL；备注编号画在图上 |
| 「核对」 | 用网页工作台的需求核对表（`check`，存进特征树的 `checks`，每次重建自动重算，窗口参数页里显示）；v0.1 自己那个一次性的 `check` 在 rebase 时去掉了 | 网页的核对表（`2026-11-07-studio-checklist.md`）已上线，两边一套格式 |
| 「让助教改」 | 网页的特征卡片、核对表里的这个按钮，在桌面版打开「给 agent 留一条备注」：关于整个零件的备注（不点在面或边上） | 桌面版没有对话框，备注就是给 agent 的话 |
| 网页组件的改动 | 只给 `StudioViewport` 加了一个可选的 `copy` 参数（提示语、按钮文字、下一个编号），缺省值就是网页原来的文字 | 尽量不碰正在并行开发的工作台代码 |

## 导入 STEP

开发板、元件的官方模型拉进来，围着它建外壳，用内核核对配合。

| 问题 | 决定 | 理由 |
| --- | --- | --- |
| 怎么表示 | 特征树里的一种特征 `import`：`file`（相对零件文件所在的文件夹）、`mode`、`rotate`、`at` | 和其他特征一样能回滚、改参数、撤销；零件文件和 STEP 一起放进 git 就能复现 |
| 缺省模式 | `reference`：参考体，半透明显示，不并入零件、不导出、选择器选不到；另有 `add`（并入）和 `cut`（减去，挖让位槽） | 围着板子做外壳时，板子不是零件的一部分 |
| 谁读文件 | 引擎按零件文件所在的文件夹解析路径，按大小和修改时间判断有没有变，把字节交给内核线程；内核按内容哈希缓存解析结果，内容一变就从这一步重建；文件被替换会自动重建（「动态」里记一笔「文件」的改动） | 内核线程不碰文件系统；切换零件不重复解析 |
| 网页 | `import` 不开放给网页助教（`DESKTOP_OPS`）；网页内核遇到它报「只能在桌面版 Arbor 里用」 | 网页读不到本机文件 |
| 核对配合 | 网页核对表加两项：`clearance`（和参考体的最小间隙）、`interference`（不相交） | 和其他要求一样存进零件、自动重算；先量最短距离，大于 0 就不做布尔，板子元件多时也快 |
| 看参考体 | `inspect body` 列出参考体的包围盒；`inspect faces / edges` 加 `of: "<import 的 id>"` 列出它自己的面和边；只有参考体时也能 `look` | 真实 agent 第一次用时看不到板子，只能临时把它并入实体再查面（见下） |

## 自动更新（v0.2.0）

做法参照 Excalidesk（Tauri 的 updater 插件）：从 GitHub Releases 更新，更新包用我们自己的钥匙签名，App 内置公钥。

| 问题 | 决定 | 理由 |
| --- | --- | --- |
| 用不用 electron-updater | 不用，自己写（`desktop/src/update/`、`desktop/src/main/updater.ts`） | macOS 上 electron-updater 走 Squirrel.Mac，要求新旧两个版本由同一个 Apple 开发者证书签名。Arbor 没有证书，临时签名每次构建都不一样，Squirrel 会拒绝 |
| 怎么证明更新包可信 | ed25519 签名，签的内容是「版本、平台、SHA-256、大小」；公钥内置在 App 里，私钥是仓库 secret | 和 Tauri 的 minisign 一样，版本号也在签名里：旧版本的更新包不能被冒充成新版本 |
| 清单放哪 | 每个 release 带一个 `arbor-update.json`，App 读 `releases/latest/download/arbor-update.json` | 不调用 GitHub API，也就没有每小时 60 次的限流；代价是这个仓库的 latest release 只能给 Arbor 用（网站不发 release） |
| 什么时候换 | 下载、校验、解压都在 App 旁边的 `.arbor-update/` 里做，退出时用两次 rename 把新旧 App 对换；「重启以更新」就是退出后重新启动 | 运行中的 App 还会从自己的包里加载东西（renderer 进程、内核线程、wasm），中途换掉可能出现新旧文件混用。放在同一个文件夹里，保证 rename 不跨卷 |
| 换失败了怎么办 | 第二次 rename 失败就把旧 App 放回原处，照样重新启动（启动的还是旧版本） | 用户至少还有一个能用的 App |
| 下载 | Electron 的 `net.fetch`（Chromium 网络栈）；边下载边算哈希，超过清单里的大小就停；60 秒没有新数据就放弃 | 跟随系统代理（国内网络环境需要）；不会被异常大的响应塞满磁盘 |
| 不能更新的情况 | 开发模式、从 dmg 里运行、App Translocation、所在文件夹不可写：手动检查时说明原因，自动检查时只写日志 | Tauri 和 Sparkle 也是这样 |
| 签名 | 没有 Apple 证书；打包后整个 App 签临时签名（`codesign --deep -s -`） | 浏览器下载的 App 不签名会被 macOS 报「已损坏」，签了临时签名就只是「无法验证开发者」，可以在系统设置里放行。App 自己下载的更新包没有隔离属性，不会被拦 |
| 发布 | 推 `arbor-v*` tag → 工作流核对版本号，构建 arm64 和 x64，生成清单并用内置公钥验一遍，建草稿 release → 人工发布并设为 latest | 和 Excalidesk 一样，发布草稿才算推送更新 |

验证：`desktop/src/update/update.test.ts`（13 项：版本比较；签名换版本、换平台、换钥匙都会被拒；下载时大小和哈希校验；解压后核对 bundle id 和版本；对换失败时回滚）。端到端用一个 0.1.9 的包测过：它从本机服务器读到 0.2.0 的清单，下载、校验、解压，标题栏出现「重启以更新到 0.2.0」，点击后重新启动，跑的是 0.2.0，`.arbor-update/` 也清理掉了。

## 实现中发现并处理的

- **OpenCascade 往 stdout 打印**（写 STEP 时的统计）。`arbor mcp` 的 stdout 是协议通道，所以内核线程用单独的输出流，转到 stderr。
- **replicad 被打包了两份**。`desktop/src` 里的裸 import 走 esbuild 的 `nodePaths`，解析到了 CommonJS 的 `main`，和 ESM 版各有一份 `OC`。改为只在 `app/src` 里 import replicad，并让 esbuild 优先用 `module` 字段。
- **窗口被挡住时动画暂停**，agent 改模型后视角要等窗口到前台才更新：关掉了窗口的 background throttling。
- **备注状态的变化没有留痕**：现在「动态」里记下谁记了、处理了、重开了、删除了哪条备注，agent 也会被告知。
- **agent 先写英文量名**（`distance`）：v0.1 的 `check` 加过英文别名；rebase 后改用网页的核对表（字段是 `kind`，报错会列出可选值），这一条随之去掉。
- **只有参考体时 agent 看不到它**（导入 STEP 的第一次真实使用）：`look` 说「还没有实体」，`inspect body` 也只说「还没有实体」。Codex 的做法是临时把导入改成 `add`，用 `inspect faces` 查到 USB-C 座的位置再改回参考体。已修：见上表「看参考体」。
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
- **Codex 审查第三轮**（rebase 之后的提交：适配 main、导入 STEP；2 条，都已修）：
  - 拆件之后再用 `import` 并入或减去，各零件没有跟着更新，导出的和显示的不一样（Codex 用真内核复现：报 4000 mm³，导出 8000 mm³）：现在和其他特征一样逐个零件处理，并入的要正好接上一个零件或写 `part`；加了同样场景的回归测试；
  - 「给 agent 留一条备注」保存失败（比如超过 600 字）时对话框照样关掉、草稿丢失：现在只在保存成功后关闭，输入框也限 600 字。
- **完整 e2e 在机器满载时有 4 项课程页超时**（同时在跑 Codex 审查和打包）；机器空下来后单独重跑都在 13 秒左右通过，62 项全过。
- `claude -p` 能连上 `arbor mcp`（33 个工具都加载了），但这台机器上 Claude Code 命令行的登录已过期，真实 agent 的建模循环用 Codex 跑完；Claude Code 这一侧要重新登录后再跑一遍。

## 验收

- [x] 引擎单元测试（真内核）：建模、核对、改动提醒、文件被外部修改、坏文件、撤销重做、`base_rev` 冲突、备注、导出、看图、点选、窗口专用命令对 agent 不可见（`app/src/tests/unit/desktop.test.ts`）
- [x] 用官方 MCP 客户端驱动 `arbor mcp`：无窗口 18 步、连 App 19 步（含 `look` 出图和 `show` 高亮）（`desktop/scripts/smoke-mcp.mjs`）
- [x] 在窗口里点面记备注，agent 用 `get_notes` 读到带选择器和草图坐标的备注
- [x] `request_pick`：横幅、点选卡片「就是这里」、超时后再次请求拿到晚到的回答
- [x] 打包：`Arbor.app` 和 `.dmg`；App 里自带的 `arbor` 命令可用
- [x] 真实 agent（Codex，经 MCP）从一句话建出零件：80×50×30 外壳、壁厚 2、R4、四角 M3 螺纹孔；14 次调用，`check` 16/16，看图，导出 STEP
- [x] 人和 agent 配合（Codex）：在窗口里点前壁写「开一个 9×3.5 的 USB-C 口，下沿离底 6」→ agent `get_notes`，用备注里的选择器在前壁上画草图、切穿壁厚，`check` 8/8，`resolve_note` 回复；窗口里备注变成已处理并显示回复
- [x] 导入 STEP（单元测试，真内核读真 STEP）：参考体、间隙正好 0.5、缩小内腔后干涉报「相交 x mm³」、`cut` 挖槽、STEP 文件换版本后自动重建、缺文件和网页端的报错、只有参考体时 `inspect` 能看到它和它的面
- [x] 真实 agent（Codex）围着导入的开发板建外壳：底壳、壁厚 2、四周 0.5、底下留 3、USB-C 让位口；`check` 里不干涉、最小间隙 0.5、壁厚、底厚、内腔高度全部通过；窗口里板子半透明显示在外壳里
- [ ] Claude Code（`claude -p`）完整跑一遍：MCP 已连上，等命令行重新登录后再跑建模
- [x] 网站不受影响：本地 `npm run check`（215 个单元测试、oxlint 零警告）；完整 e2e 62 项通过（4 项课程页在机器满载时超时，空闲后重跑通过）
- [ ] CI 上跑一遍

## 下一步

1. **核对坐标**：`measure` 给出圆心和面中心的坐标，`check` 加位置项（改共用的 `kernel/measure.ts`、`kernel/check.ts`）。
2. **量到参考体的面**：`measure` 和 `check` 的 `distance` 能选参考体上的面（例如「板子底面到外壳内底 3 mm」）。修好「看参考体」之后，Codex 第二遍只在这里绕了路：改成核对内腔总高。
3. **代码特征**：特征树表达不了的形状，用一段脚本产出实体，作为树里的一个节点。
4. Claude Code 的 UserPromptSubmit hook：每次发消息时自动带上未读备注。
5. 共用组件里「助教」的字样在桌面版换成「agent」。
6. Apple 签名和公证；Windows / Linux 包。
