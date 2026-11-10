# 改名：Arbor → Turnery

- 状态：代码已改，未合并；仓库、域名、服务器还没动（2026-11-10）
- 日期：2026-11-10
- 范围：产品名、标志、命令行、MCP 服务名、文件后缀、主目录、环境变量、包名、发布流程里的名字，全部从 Arbor 改成 Turnery；旧文件和旧数据照常能用。
- 不在范围：网站域名和服务器上的目录（仍是 `arbor.linjiejim.com`、`/srv/arbor`、`/root/arbor`、pm2 `arbor-api`）；GitHub 仓库改名（要在合并时由 Jim 做）；旧 spec 的正文和文件名（历史记录，不改）；已提交的 GLB。
- 相关：`2026-11-08-arbor-rename-surfaces.md`（上一次改名，做法照它）

## 为什么

Arbor 在「给 coding agent 用的工具」里撞名严重（2026-11-10 查）：

| 项目 | 规模 | 撞在哪 |
| --- | --- | --- |
| penso/arbor | 845 star | 也是面向 coding agent 的 macOS 桌面应用，`Arbor.app`，自带 `arbor-mcp` |
| RUC-NLPIR/Arbor | 1146 star | 接入命令 `claude mcp add arbor -- arbor mcp`，和我们的一字不差 |
| Anandb71/arbor | 162 star | 命令行和 MCP 服务名都叫 `arbor` |

npm、PyPI、crates 上的 `arbor` 都被占，短域名都没了；「Arbor CAD」又撞上现成的商业产品 ArborCAD。现在 0 star，改名成本最低。

Turnery：车削工坊；turn 也是 agent 的一轮。查的时候 GitHub 上没有同名的知名项目，npm 的 `turnery`、`turnery-mcp` 是空的。**商标库没有查到原始记录**，认真推广前要查一次（USPTO、EUIPO、中国商标网，第 9 和 42 类）。

## 改了什么

| 位置 | 旧 | 新 |
| --- | --- | --- |
| 产品名、窗口标题、菜单、文案、提示词 | Arbor | Turnery |
| 标志 | 拉出厚度的小写 a | 拉出厚度的小写 t，顶上斜切一刀（像车刀留下的），同一套画法（`desktop/resources/logo/make-logo.py`）；备选见 `docs/brand/turnery-logo-options.png` |
| 命令行、MCP 服务名、插件名 | `arbor` | `turnery` |
| bundle id | `com.linjiejim.arbor` | `com.linjiejim.turnery` |
| 零件、装配文件 | `*.arbor.json`、`*.arbor-asm.json` | `*.turnery.json`、`*.turnery-asm.json` |
| 主目录 | `~/.arbor` | `~/.turnery` |
| 环境变量 | `ARBOR_*` | `TURNERY_*` |
| 包名 | `arbor-app`、`arbor`、`arborbake`、`arbor-mcp` | `turnery-app`、`turnery`、`turnerybake`、`turnery-mcp` |
| 发布 | tag `arbor-v*`、`arbor-update.json`、工作流 `arbor-release.yml` | `turnery-v*`、`turnery-update.json`、`turnery-release.yml` |
| 仓库地址（代码里写的） | `linjiejim/arbor` | `linjiejim/turnery` |
| 示例上刻的字、README 的图、介绍动画 | ARBOR | TURNERY，全部重新渲染 |

## 旧的东西怎么办

| # | 决定 | 理由 |
| --- | --- | --- |
| D1 | 旧后缀的文件照常打开、列出、原地保存；不自动改名。新建的文件用新后缀 | 已有的项目（包括装配里按文件名引用零件的地方）不用动。`partExtOf` / `asmExtOf` 两个函数认新旧两种 |
| D2 | 第一次启动 Turnery 时把 `~/.arbor` 整个改名为 `~/.turnery`，把里面「最近的项目」记的路径改过来，并在旧位置留一个指向新目录的链接（别处的零件可能按旧路径引用里面的文件） | 最近项目、设置、放在里面的项目都跟过来。旧的 Arbor 还在运行（`engine.json` 里的进程活着）或设了 `TURNERY_HOME` 时不动 |
| D3 | 网站存学习进度的键不改，仍是 `arbor:progress`、`arbor:practice` | 域名这次不动，改键只会让人丢进度 |
| D4 | 不认旧的环境变量 `ARBOR_*` | 只有开发和 CI 在用，一次改完 |
| D5 | 发布工作流读 `TURNERY_UPDATE_KEY`，没有就读 `ARBOR_UPDATE_KEY` | 签名的钥匙不换，只是 secret 的名字；漏改也不会让发布失败 |
| D6 | 已装的 Arbor 0.5.x 不会自动更新到 Turnery | 更新时要核对 bundle id，名字变了就对不上。目前只有作者自己装了，手动装一次 |

已知的小缺口：`open_part path=box`（不写后缀）在旧项目里会去找 `box.turnery.json`，找不到旧的 `box.arbor.json`。写全文件名没有问题。

## 验证

- 356 个单元测试、类型检查、lint 通过；新增一项：旧后缀的项目（装配加零件）能打开，改参数后写回原来的文件。
- `adoptLegacyHome` 在两个假的主目录上跑过：接管成功并改好路径；第二次调用不再动；旧应用的进程还活着时不接管。
- 源码构建的 Turnery 在全新主目录下启动：窗口标题和图标是新的，示例被拷到 `~/.turnery` 对应的目录并打开，核对通过；`turnery mcp` 握手拿到 40 个工具；README 里的两张窗口截图就是这次截的。
- `claude plugin validate` 对插件和市场清单都通过。

没验证：打包后的 `.app`；发布工作流；真实的 `~/.arbor` 接管（只在假目录上试过）。

## 合并时和合并后要做的（Jim）

1. **仓库改名**，和合并放在一起：`gh repo rename turnery --repo linjiejim/arbor`。代码里的地址已经是 `linjiejim/turnery`；GitHub 会把旧地址转过来，反过来不会。
2. 仓库 secret 加一个 `TURNERY_UPDATE_KEY`（值和 `ARBOR_UPDATE_KEY` 一样），之后可以删掉旧的。
3. 发 `turnery-v0.6.0`，手动装一次；第一次启动会接管 `~/.arbor`。先退出旧的 Arbor。
4. 重新接入 agent：`claude mcp remove arbor`，再按窗口里「接入 Agent」给的命令加 `turnery`。
5. 本机文件夹 `~/Code/arbor` 要不要改名自己定；改了之后 Claude 的项目记忆按路径对不上，要一起挪。
6. 域名和服务器：想换成 `turnery.linjiejim.com` 的话另开一轮，做法照上一次（加解析、迁目录、旧域名转过去并带上进度）。
7. 查商标。
