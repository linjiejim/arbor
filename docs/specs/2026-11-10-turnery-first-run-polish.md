# Turnery：上手这一段的打磨（工具定义、说明、示例、插件）

- 状态：已实现，未合并、未发版（2026-11-10，在分支 `claude/project-open-source-evaluation-674667` 上；实现时项目叫 Arbor，随后改名，文中一律写新名字）
- 日期：2026-11-10
- 范围：四件互不依赖的小事，都是为了让第一次接触 Turnery 的人和 agent 少花力气：工具定义再瘦一轮；界面说明改成悬浮显示、去掉分步导览；首次启动带一个示例；Claude Code 插件和登记到 MCP 目录用的启动包。
- 不在范围：英文界面、签名公证、内置 agent（`2026-11-10-turnery-assistant.md`）、可打印性核对、STEP 选面。
- 相关：`desktop/README.md`、`2026-11-08-turnery-agent-tools-round2.md`（上一轮瘦身）

## 1. 工具定义瘦身（第三轮）

**问题**：MCP `tools/list` 在 0.5.1 是 87 312 字符（40 个工具）。其中约一半是选面、选边的定义：MCP 要求每个工具的 schema 自成一体，`$defs` 不能跨工具共用，所以 `FaceSelector` 在 16 个工具里各写了一遍。

**做法**（都在 `app/src/desktop/core/catalog.ts` 的 `inputJsonSchema` 里，不动 zod 定义，网页工作台不受影响）：

| # | 改动 | 说明 |
| --- | --- | --- |
| D1 | 选择器的 `not` 不再把字段重列一遍，只写「字段和上面一样（不含 not、expect）」 | `not` 的字段和选择器本身完全相同，重列一遍占每个选择器的四成多。引擎仍按完整的 zod schema 校验。这是唯一一处减少了信息的改动 |
| D2 | 同一个工具里出现两次以上的子结构自动提到 `$defs`（`hoistRepeats`） | 例如草图里路径和折线的点、`measure` 和 `check` 里「量哪里」的两端、选择器里的 `at`。纯粹的 JSON Schema 等价变换，不丢信息；按能省的字符数从大到小提，省不到 100 字符的不提 |

没有做的：把选择器改成紧凑的字符串写法（如 `"+Z top"`）。能再省约 1.5 万字符，但要改 DSL、选择器解析和所有提示词，等内置 agent 的评测跑起来、能量出对成功率的影响再说。

**结果**：87 312 → 67 721 字符（−22%），用同一个握手脚本对装好的 0.5.1 和源码构建各量了一次。`check` 10.7k → 8.4k，`sketch` 7.8k → 6.2k，`fillet` 4.5k → 2.8k，`measure` 4.7k → 2.7k。

**验证**：`desktop.test.ts`「keeps the tool list small」的上限从 9 万收到 6.4 万，并断言 `Points` 被提出、字段说明还在、`not` 里不再有 `properties`、每个 `$ref` 都能解析。全部 352 个单元测试通过。

**没验证的**：真实 agent 在新 schema 下写 `not` 的出错率。D1 之后模型要靠「字段和上面一样」这句话来写，写错了引擎会报。发版前用 Claude Code 和 Codex 各跑一遍带 `not` 的例子（「除了最上面一圈的边都倒圆角」）。

## 2. 说明改成悬浮显示，去掉分步导览

**问题**：灰色 ⓘ 要点开，里面一条一条翻（上一条 / 下一条 / 知道了）；第一次打开还会按顺序把四个 ⓘ 走一遍。用起来比它要解释的东西还复杂。

**做法**：

- `app/src/components/hint.tsx` 重写：鼠标指向 ⓘ 就把这一处的说明**全部**列出来，移开收起（进出各有约 0.1–0.2 秒的延迟，鼠标能移进卡片里）。单击、回车或触摸也能打开，这样打开的会保持，直到点别处或按 Esc。卡片里没有任何按钮。
- 删掉 `Tour`、`app/src/lib/tour.ts`、各处的 `step` 属性和对应的单元测试；`localStorage` 里的 `turnery:tour:*` 不再读写（留着无害）。
- 仍然用 Popover（保留 dialog 角色和键盘操作），没有引入 HoverCard。

**验证**：e2e「/studio 的说明：指向 ⓘ 就全部显示，不用点」通过；在源码构建的桌面窗口里用 CDP 悬停「特征树怎么用」，卡片里 3 条说明、0 个按钮，移开后关闭；首次打开不再弹出导览。

## 3. 首次启动带一个示例

- 示例就是 `examples/sensor-enclosure/enclosure.turnery.json`（两件式外壳，17 个特征、5 项核对）。`desktop/scripts/build.mjs` 把它拷进 `dist/examples/`，随 App 发布。
- 主进程 `openExample()`：第一次用时拷到 `~/.turnery/projects/sensor-enclosure/`，再作为项目打开并打开这个零件。不直接打开 App 包里那份：引擎会往文件夹里写备注和重建结果，包是签过名的，`/Applications` 下也可能不可写。
- 首页多一个入口「先看一个示例：传感器外壳」，下面一行小字说打开后改哪个参数、会看到什么。
- **第一次启动**（没有最近项目、`settings.json` 里没有 `exampleShown`）自动打开它一次。之后不再自动打开。
- 新增 IPC `turnery:open-example`，`TurneryBridge.openExample()`。

**验证**：用全新的 `TURNERY_HOME` 启动源码构建：示例被拷到项目目录并打开，`settings.json` 写入 `exampleShown: true`；在这个窗口里把 `t` 改成 3，核对表显示 4/5、「壁厚 2」标红（截图在 `docs/media/window-check.png`）。

**没验证的**：打包后的 `.app`（路径用的是和字体、内核同一个 `DIST`，但没有实际打包跑过）；首页的示例按钮（代码路径和首次启动相同，没有单独点过）。

## 4. Claude Code 插件和 MCP 目录

| 东西 | 位置 | 作用 |
| --- | --- | --- |
| 插件市场清单 | `.claude-plugin/marketplace.json` | 让这个仓库本身就是一个 marketplace |
| 插件 | `plugin/`（`.claude-plugin/plugin.json`、`.mcp.json`、`scripts/turnery-mcp.sh`、`skills/build-part/SKILL.md`） | MCP 服务加一个 skill。skill 只讲什么时候用、先读 `guide`、七步工作方式，细节仍以 MCP 的说明为准，避免两处不一致 |
| npm 启动包 | `packages/turnery-mcp/`（含 `server.json`） | MCP Registry 没有「本机已装的应用」这种类型，只收 npm 等公共包。这个包只做一件事：找到已安装的 Turnery，把 stdio 交给 `turnery mcp` |

用户安装：

```
/plugin marketplace add linjiejim/turnery
/plugin install turnery@turnery
```

启动脚本按 `$TURNERY_BIN`、`/Applications`、`~/Applications`、PATH 上的 `turnery` 的顺序找；找不到时在 stderr 说明去哪下载（stdout 是协议通道，不能写）。

**验证**：`claude plugin validate ./plugin` 和 `claude plugin validate .` 都通过；用一个最小的 MCP 客户端分别通过插件脚本和 npm 启动包完成握手并拿到 40 个工具；把 App 路径改成不存在时脚本以 1 退出并打印提示。

**没做、要你来做的**（都要用你的账号，对外可见）：

1. 合并后在 Claude Code 里真装一次，确认 skill 会在「做个外壳」这类话下触发、找不到 App 时的提示看得见。
2. `npm publish`（`packages/turnery-mcp`），再 `mcp-publisher login github && mcp-publisher publish`。包名 `turnery-mcp` 目前在 npm 上是空的。
3. 提交到 Anthropic 的社区插件目录（表单）和 Smithery、Glama 等。
4. 发版时 `plugin.json`、`package.json`、`server.json` 里的版本号要和 App 一起改（可以并进 `release.mjs` 的检查）。

**名字**：这份 spec 写的时候项目还叫 Arbor，`arbor`、`arbor-mcp`、`Arbor.app` 和几个同类工具撞名，所以当时没有发布。同一天改名为 Turnery（`2026-11-10-turnery-rename.md`），上面的路径和包名都已经是新名字；发布仍然等你来做。
