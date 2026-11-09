<p><img src="resources/icon-64.png" width="64" alt="Arbor"></p>

# Arbor

让本机的 coding agent（Claude Code、Codex……）通过 MCP 或命令行建参数化零件；你在 Arbor 窗口里实时看它每一步建了什么，拖参数、改特征，在面或边上留备注，agent 下一次调用就会知道。

名字：arbor 既是「树」（特征树），也是机加工里夹着刀具转的「刀杆 / 心轴」。标志是一个拉出厚度的小写 a：草图拉伸成实体。标志和图标由 `resources/logo/make-logo.py`（build123d 精确生成几何）和 `scripts/make-icons.py` 生成。

- 建模能力和网页版 Arbor 工作台是同一套：特征树 JSON、语义选择器、OpenCascade 内核（`app/src/studio`）。
- AI 来自你自己的 agent：Arbor 不调用任何模型，也不需要 key。
- 零件就是一个 `.arbor.json` 文件（特征树 JSON），可以放进 git、可以直接编辑；备注在旁边的 `.notes.json`。
- 一个文件夹就是一个项目：左栏列出里面的装配和零件。「文件 → 新建项目」建一个文件夹，里面放同名的空装配和共享参数文件；装配的特征树底部「+ 零件」新建零件（放在 `parts/` 下，共用项目参数）、放进已有零件或 STEP。
- 新建项目缺省放在 `~/.arbor/projects/` 下，不改名就用时间命名（`YYYYMMDDhhmmss`）。打开项目时优先打开和文件夹同名的装配。
- 一个窗口一个项目，几个项目可以同时开、互不干扰：每个窗口有自己的引擎和内核线程。当前窗口已经有项目时，「新建项目」「打开项目」会开一个新窗口；同一个项目只在一个窗口里打开。「文件 → 新建窗口」（⌥⌘N）开一个空窗口。
- 标题栏的首页按钮（⇧⌘H）关掉这个窗口的项目，回到首页；首页列出最近的项目。
- ⌘= / ⌘- / ⌘0 缩放整个窗口，下次启动还是这个比例。装配里选中零件后按 H 隐藏，⇧H 显示全部隐藏的零件（选中零件的工具栏里也有这两个按钮）。

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
- `npm run dist`：打包成 `release/mac-arm64/Arbor.app`，再由 `scripts/release.mjs` 签上临时签名（ad hoc），在 `release/upload/` 里做出 dmg 和更新用的 zip。本机打的包不生成更新清单，也不会推送给已安装的 App。

## 下载安装和更新

从 [GitHub Releases](https://github.com/linjiejim/arbor/releases/latest) 下载 `Arbor-<版本>-arm64.dmg`（Intel Mac 选 `x64`），把 Arbor 拖进「应用程序」。Arbor 没有 Apple 签名，第一次打开时 macOS 会拦一下：到「系统设置 → 隐私与安全性」点「仍要打开」。也可以在终端运行 `xattr -dr com.apple.quarantine /Applications/Arbor.app`。

装好以后 Arbor 会自己更新：启动 15 秒后检查一次，之后每 6 小时检查一次。它读取最新 release 里的 `arbor-update.json`，在后台下载这台机器对应的 zip，校验大小、SHA-256 和签名（公钥内置在 App 里，`desktop/src/update/public-key.ts`），解压到 App 旁边的隐藏文件夹 `.arbor-update/`。下载好以后，标题栏出现「重启以更新到 x.y.z」；不点也没关系，下次退出 Arbor 时会换上新版本。

- 菜单 Arbor → 检查更新…：立即检查，结果会提示出来（已是最新、正在下载、失败原因）。
- 菜单 Arbor → 自动检查更新：取消勾选后就不再自动检查，设置存在 `~/.arbor/settings.json`。
- 只有放在可写位置的 Arbor.app 能自动更新：直接从 dmg 里运行不行，被 macOS 隔离运行（App Translocation）时也不行，检查更新会说明原因。
- 下载走 Chromium 的网络栈，跟随系统代理。
- 测试时可以用环境变量 `ARBOR_UPDATE_URL` 指向另一份清单；签名照样要校验。

### 发布

1. 改 `desktop/package.json` 的 `version`（同时改 `package-lock.json` 顶部的版本），合并进 main。
2. 推送 `arbor-v<版本>` tag。工作流 `.github/workflows/arbor-release.yml` 会核对 tag 和版本号是否一致，然后在 macOS 上构建 arm64 和 x64 两个包，签名并打包，建一个草稿 release，上传 dmg、zip 和 `arbor-update.json`。
3. 检查草稿，然后发布，并设为 latest：`gh release edit arbor-v<版本> --draft=false --latest`。已安装的 App 只读最新一个已发布的 release，发布这一步才算推送了更新。这个仓库的 latest release 只留给 Arbor 用。

仓库原名 `featuretree`，2026-11-08 改名为 `arbor`。0.2.0 及更早的 App 读的是旧仓库地址，靠 GitHub 对改名仓库的转发找到新版本：以后不要再建名叫 `featuretree` 的仓库，否则转发会断。

更新包的签名用一把 ed25519 私钥，存在仓库 secret `ARBOR_UPDATE_KEY`（PEM 格式）；维护者本机备份在 `~/.arbor-release/update-key.pem`。已安装的 App 只认这把钥匙签的更新：换钥匙就要同时换掉 `public-key.ts`，并且所有人都得手动重新下载一次。`release.mjs` 写清单前会先用内置公钥验一遍签名，钥匙不对就在发布时报错，不会等到用户那边才失败。

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
- **内核**在 Node 的 worker 线程里跑（`desktop/src/engine/kernel-thread.ts`），每个零件一个内核（最近用的 4 个），切回一个零件时直接用上次的结果，不重建；wasm 堆超过 1.4 GB 就换一个线程，只重放当前零件，其余零件下次用到时再建。
- **`arbor mcp`** 每次调用都转给正在运行的 App，所以窗口里能看到每一步；App 没开时会自动启动它（不抢焦点）；启动不了就在自己进程里起一个无窗口的引擎（这时 `look` 和 `request_pick` 不可用）。
- **多个窗口时调用发到哪**：发到这个项目所在的窗口（零件或文件夹在哪个窗口的项目里）；`open_project` 打开一个还没打开的项目时，用空窗口或新开一个窗口；其余情况留在这个 agent 上次用的窗口。所以两个 agent 各做各的项目，各在各的窗口里。窗口关掉后，agent 10 分钟内还在用的引擎会留着（`look` 会再开窗口），否则释放。
- **无窗口模式**：`arbor mcp --headless`（或环境变量 `ARBOR_HEADLESS=1`）在 App 没运行时把它在后台启动，不显示窗口也不占 Dock，`look` 在隐藏的窗口里照常出图。运行 Arbor 或 `arbor open` 会把窗口叫出来；agent 调 `request_pick` 时也会弹出窗口。没人调用 30 分钟后自动退出。已经在运行的 App 不管是不是无窗口，都直接用它。
- **谁改的都算**：agent、窗口里的你、直接改文件（编辑器、git），每次改动都记在「动态」里、都能撤销。agent 下一次调用时，结果开头会写「自你上次调用以来，用户改了：W 40 → 45」，避免它把你的改动改回去。
- **发现**：App 启动时把端口和随机 token 写进 `~/.arbor/engine.json`（权限 600），把怎么启动自己写进 `~/.arbor/app.json`；只监听 127.0.0.1，并检查 Host 头。

## 给 agent 的工具（40 个）

| 类 | 工具 |
| --- | --- |
| 零件和装配 | `guide`、`open_project`（一个文件夹作为项目，`create` 建出空装配和参数文件）、`open_part`（零件 `.arbor.json` 或装配 `.arbor-asm.json`；带 `context` 就是在装配里改这个零件，其他零件半透明显示在旁边）、`list_parts`（项目里的全部装配和零件）、`get_state`、`share_params`（几个零件共用一个参数文件 `*.params.json`） |
| 建模（和网页工作台同一套） | `set_params`、`sketch`、`extrude`、`revolve`、`fillet`、`chamfer`、`shell`、`hole`、`linear_pattern`、`circular_pattern`、`mirror`、`sweep`、`loft`、`draft`、`split`、`rib`、`edit_feature`、`delete_feature` |
| 只有桌面版的建模 | `import`：读一个 STEP 文件（开发板、元件的官方模型），缺省作参考体；`component`：装配里放一个零件文件、子装配、STEP 或标准件（`standard`：ISO 螺钉、螺母、垫圈、热熔螺母），用 `rotate` / `at` 或 `mates` 贴合摆放（面贴面、平齐、同轴；选中几个孔就放几个）；`thread`：真实螺纹几何（外螺纹、内螺纹，M2–M12 粗牙或自定螺距，可加打印间隙）。建模工具还多几个写法：加料时 `part` 写新名字就新建零件、`mode: "intersect"` 求交、`revolve.start` / `symmetric`、草图点的 `spline` 和拐角圆角 `r`、`extrude.onto` 沿平面或圆柱面等深刻字、`hole` 的 `fit: "insert"` 热熔螺母孔、选边的 `outer`（只要面的外轮廓） |
| 整体改 | `set_tree`（可带 `base_rev` 防止覆盖）、`move_feature`、`undo`、`redo` |
| 观测 | `inspect`、`look`（窗口渲染的视图图片；`focus` 特写、`section` 剖视、`dir` 任意方向、`hide` 藏零件，最后一步改动很小时自动加一张特写，结果写比例尺）、`measure`（面、边、特征、零件之间；给出坐标） |
| 核对与交付 | `check`（和网页工作台同一张需求核对表：存进零件，每次重建自动重算；桌面版多几项：`position` 坐标、`gap` 两处之间的距离（`max: 0` = 必须贴上）、`clearance` 间隙、`interference` 不干涉，后两项可以对参考体或零件）、`export`（step / stl（多零件打包成 zip）/ py / json / bom 零件清单，标准件按规格合并计数） |
| 和人协作 | `get_notes`、`resolve_note`、`request_pick`（请你在窗口里点一个面或边，等你点完）、`show`（在窗口里高亮给你看） |

每一步的结果会提示几种常见问题：新加的料没接上（写出距离）、只碰到边或点、极小的碎面、窄缝（对面的两个面不到 1 mm、中间是空的）、薄壁（不到 0.8 mm）、新零件和别的零件重叠。不写 `after` 加的特征会自动排在末尾的文字特征前面。

工具列表（MCP `tools/list`）里，选面、选边、基准面的写法每个工具只写一次（`$defs` + `$ref`），`set_tree` 只说明写法、由引擎校验：整个列表约 8 万字符（原来约 24 万）。

装配的写法和规则见 `docs/specs/2026-11-07-arbor-agent-modeling.md`。

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

- `--headless`：App 没运行时在后台启动它，不显示窗口（见上面的无窗口模式）。
- `--no-app`：不连 App，在自己的进程里算（适合 CI 和脚本，这时要用 `--part` 指定零件；没有 `look`）。MCP 用环境变量 `ARBOR_NO_APP=1`。以前的 `--headless` 就是这个意思，0.5.0 起改名。

## 开发

```bash
cd app && npx vitest run src/tests/unit/desktop.test.ts   # 引擎的单元测试（真内核）
cd desktop && npm run check                               # 主进程、引擎、MCP、CLI 的类型检查
node scripts/smoke-mcp.mjs                                 # 用官方 MCP 客户端走一遍（无窗口）
node scripts/smoke-mcp.mjs --app                           # 连正在运行的 App，含 look 和 show
ARBOR_HOME=/tmp/arbor-dev npm start                         # 和装好的 Arbor 互不影响（单实例锁、~/.arbor 都换成这个目录）
npm start -- --remote-debugging-port=9223                  # 然后：
node scripts/cdp.mjs shot out.png                          #   给窗口截图（多个窗口：ARBOR_CDP_WINDOW=<序号>，cdp.mjs windows 列出）
node scripts/cdp.mjs click 520 470                         #   在窗口里点（CSS 像素）
../.venv/bin/python -I resources/logo/make-logo.py         # 重新生成标志（SVG、网页用的路径、favicon）
python3 -I scripts/make-icons.py                           # 从标志生成 App 图标
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

- 只有 macOS 包（arm64 和 x64），没有 Apple 签名和公证，第一次打开要在系统设置里放行。
- 没有「代码特征」：特征树表达不了的形状还做不了（规划见 `docs/specs/2026-11-07-arbor-desktop.md`）。
- 贴合只用来摆放（按顺序算一次），不是约束求解，也没有运动；标准件只有公制粗牙 M2–M12，螺钉上的螺纹画成光杆。
- 真实螺纹一个要几秒，面也多，放在最后；build123d 导出里省略螺纹（build123d 本身没有螺纹命令）。
- 导入的 STEP 是一个整体：选择器选不到它的面，核对只能对整个参考体量间隙和干涉；`mode: "cut"` 减去的是元件本身的外形，要留间隙得先在别处把它放大。
- `request_pick` 一次最多等 280 秒；没等到就返回，agent 用同一句 prompt 再调用会接着等，期间你点的也不会丢。
