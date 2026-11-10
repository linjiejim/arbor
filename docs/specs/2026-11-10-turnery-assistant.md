# Turnery：内置助手（侧边栏里直接对话建模）

- 状态：四步里前三步已实现（2026-11-10，待确认项按建议方案，Jim 授权）；对话保存、用量显示、浮动窗口见 `2026-11-10-assistant-window.md`；整轮撤销、参考图、测试连接没做
- 日期：2026-11-10
- 范围：桌面版窗口右侧加一个「对话」栏。主进程里用 AI SDK 跑工具循环，工具就是引擎的命令表。配好模型和 key 之后，不接 Claude Code、Codex 也能在 Turnery 里建模和改模型。
- 不在范围：ACP（把外部 agent 拉进侧边栏，另议）；文件和 shell 工具；云端账号、公共额度；网页工作台的改动。
- 相关：`2026-11-07-turnery-desktop.md`（当时定的是「Turnery 不调用任何模型」，这份 spec 改掉这一条）、`2026-11-05-ai-modeling.md`、`app/scripts/studio-eval.ts`（已有的「服务端执行工具 + 多步循环」）

## 待确认

每条先写建议。

1. **内核用什么？** 建议 AI SDK（仓库里已经是 `ai` 7，主进程的包里也已经有它）。不用 pi：它的长处是文件和 shell 工具，这里用不上，反而多一层要防的面；多家模型用各家的 provider 包加「OpenAI 兼容端点」就能覆盖。
2. **key 存哪？** 建议 `~/.turnery/providers.json`（权限 600），key 用 Electron 的 `safeStorage` 加密后存进去；见下面「key 的存放」。环境变量优先于文件。**不**放进项目文件夹（会进 git）。
3. **内置助手算谁？** 建议在 `Actor` 里加一种 `"assistant"`，和外部 `"agent"` 分开记「自你上次调用以来」。否则两者同时在用时会互相吞掉提醒，标题栏也分不清是谁在动。
4. **对话栏放哪？** 建议作为右侧面板的第一个页签「对话」，和备注、动态、参数、代码并列，面板可以拖宽。不另开第三栏：1440 宽的窗口放不下三栏加视口。
5. **对话存哪、按什么分？** 建议按项目存在 `~/.turnery/chats/<项目路径的哈希>.json`，最多 80 条，图片不存。不放进项目文件夹。
6. **要不要同时出一个命令行入口 `turnery ask "<一句话>"`？** 建议要。它和侧边栏用同一个循环，不需要窗口，是最便宜的测试手段，放进 CI 也有用。

## 为什么

现在要用 Turnery 必须先有一个 coding agent 并把 MCP 接上。对已经在用 Claude Code 的人这是一行命令；对做硬件、玩打印、想学建模的人，这是第一道也是最高的一道门槛。国内用户手里多半是 DeepSeek、Kimi、通义的 key，而不是 Claude 订阅。网页工作台已经证明便宜的模型够用：`deepseek-flash` 在 10 题评测上 10/10，一轮约 $0.002。

内置助手只有 Turnery 的命令可调，碰不到文件系统的其他地方，也不能跑命令。这一点本身可以写进介绍里。

## 设计

### 分层

| 层 | 位置 | 内容 |
| --- | --- | --- |
| 循环 | `app/src/desktop/core/assistant.ts` | 把 `agentCommands()` 变成 AI SDK 的工具（`jsonSchema(inputJsonSchema(spec))`，`execute` 调 `engine.run`），`streamText` 多步循环，裁剪历史，把当前状态挂到最后一条用户消息上。不 import electron，单元测试里直接跑 |
| 模型 | `app/src/desktop/core/providers.ts` | 预设表和「配置 → LanguageModel」。`app/server/models.ts` 里的 DeepSeek、OpenRouter 路由挪过来共用 |
| 主进程 | `desktop/src/main/assistant.ts` | IPC、读写配置和 key、把 Electron 的 `net.fetch` 传给 provider（跟随系统代理）、每个窗口一个会话 |
| 窗口 | `app/src/desktop/ui/assistant-panel.tsx`、`use-assistant.ts`、`ui/model-settings.tsx` | `useChat` 加一个走 IPC 的 transport；消息、工具卡片、思考过程复用 `studio/ui/chat-panel.tsx` 里的组件（先把它们从 `ChatPanel` 里拆出来导出）；模型设置对话框 |

放在 `app/src` 下而不是 `desktop/src` 下，是因为主进程的打包从 `desktop/src` 裸 import 会解析到另一份依赖（`2026-11-07-turnery-desktop.md` 里 replicad 被打包两份的教训）。

### 循环

```ts
streamText({
  model,
  system: AGENT_GUIDE,                       // 就是 MCP 的 instructions
  messages: withState(convertToModelMessages(trim(messages)), stateText(doc)),
  tools,                                      // agentCommands() 去掉 guide
  stopWhen: stepCountIs(30),
  abortSignal,
})
```

- 工具一个接一个执行。SDK 会并发执行同一步里的多个调用，评测脚本就踩过互相覆盖特征树的坑，所以 `execute` 自己排队。
- 当前状态（参数、特征树、每步结果、未处理的备注）挂在最后一条用户消息后面，不放进 system：system 和工具定义不变，各家的前缀缓存才能命中。
- `look` 的图片按 `tools.ts` 里现成的 `toModelOutput` 转成图片内容。模型不支持看图时（预设里标 `vision: false`，自定义端点让用户勾选），`look` 只回文字，并在 system 末尾加一句「看不了图：用 inspect 和 measure 确认」。
- 历史裁剪沿用 `trim.ts`：只留最近 8 轮、只留最近一次看图。
- `request_pick` 照常可用：助手请你点一个面，对话里显示「等你在模型上点一下」。
- 到 30 步停下，对话里提示「说『继续』」。

### 身份（待确认 3）

- `Actor = "agent" | "assistant" | "user" | "file"`。`assistant` 能调的命令和 `agent` 一样。
- `Doc.agentSeq` 改成按读者记：`seen: { agent: number; assistant: number }`。`noticeFor` 报告「不是我自己」的改动，所以外部 agent 会被告知助手改了什么，反过来也一样。
- 「动态」里多一种来源「助手」；标题栏的状态分开显示「Agent 正在…」和「助手正在…」。

### 窗口和主进程之间

没有流式的先例，这是这份 spec 里最需要先试的一块。

| 通道 | 方向 | 内容 |
| --- | --- | --- |
| `turnery:assistant-send` | 窗口 → 主进程（invoke） | `{ chat, messages }`，返回一个流的 id |
| `turnery:assistant` | 主进程 → 窗口（send） | `(id, chunk)`：`toUIMessageStream()` 的每一块；结束和出错各有一块 |
| `turnery:assistant-stop` | 窗口 → 主进程 | 中止（`AbortController`） |
| `turnery:models` / `turnery:models-save` / `turnery:models-test` | invoke | 读配置（不带 key，只带「有没有 key」）、保存、试连一次 |

窗口这边写一个 `ChatTransport`，`sendMessages` 返回 `ReadableStream<UIMessageChunk>`，从 `turnery:assistant` 里按 id 取块。窗口关掉或刷新时主进程中止这一轮。CSP 是 `connect-src 'self'`，所以模型请求只能从主进程发，这也正好让 key 不进渲染进程。

### 模型设置

预设（`id`、显示名、默认模型、默认地址、能不能看图）：DeepSeek、OpenRouter、Anthropic、OpenAI、Google Gemini、Moonshot（Kimi）、智谱、通义（DashScope）、SiliconFlow、Ollama（本机，不要 key）、自定义（OpenAI 兼容：地址 + 模型名）。

- 每个配置：`{ id, provider, model, baseURL?, vision, thinking? }`，可以存多个，选一个当前用的。
- 「试一下」发一个最小的请求，把服务端的报错原样显示出来（key 不对、模型名不对、地址不通）。
- 没配置时，对话栏里是一句话加一个「配置模型」按钮，以及「或者接入你自己的 agent」。
- 要新装的依赖（都装在 `app/`）：`@ai-sdk/openai-compatible`、`@ai-sdk/anthropic`、`@ai-sdk/openai`、`@ai-sdk/google`。国内几家都走 OpenAI 兼容。

### key 的存放（待确认 2）

问题里的三个选项，逐个说：

| 做法 | 结论 | 理由 |
| --- | --- | --- |
| 自己「哈希加密」后存进 `~/.turnery` | 不行 | 哈希是单向的，存进去就取不出原文，没法再拿去调 API。自己写的可逆加密，密钥也只能放在本机同一个地方，等于换了一种编码，防不住能读这个文件的程序 |
| Electron `safeStorage` 加密，密文存进 `~/.turnery/providers.json` | **建议** | 它用操作系统保管的密钥加密一段文本，密文由我们自己存。macOS 走钥匙串，Windows 走 DPAPI（跟着登录用户，没有弹窗，对 Windows 友好），Linux 走 libsecret 或 kwallet。文件仍然在 `.turnery` 下，和你设想的位置一样，只是密钥不在文件里 |
| 明文，文件权限 600 | 退路 | Codex、很多命令行工具就是这么做的。能读你主目录的程序本来也能做别的事。Linux 上没有密钥环时 `safeStorage` 自己也会退到等同明文 |

一个要先实测的点：**macOS 上没有 Apple 签名时**，钥匙串按应用签名记住授权；Turnery 现在每次构建的临时签名都不一样，更新后很可能每次都弹「Turnery 想使用钥匙串里的机密信息」。所以规则是：

1. 环境变量 `TURNERY_API_KEY_<PROVIDER>`（如 `TURNERY_API_KEY_DEEPSEEK`）有值就用它，不读文件。命令行和 CI 用。
2. `safeStorage.isEncryptionAvailable()` 为真，并且不是「macOS 且未签名」→ 加密后存。
3. 否则明文存，文件 600，设置对话框里写明「key 以明文存在 ~/.turnery/providers.json」。
4. 签名公证做完之后，第 2 条的例外去掉；启动时把明文的 key 迁成密文。

key 只在主进程里；窗口拿到的配置里只有「已填 / 未填」。日志和报错里不出现 key。

### 命令行（待确认 6）

```bash
turnery ask "把壁厚改成 3，再核对一遍" --part box.turnery.json          # 连着 App：窗口里看得到每一步
turnery ask "建一个 80×50×30 的盒子，壁厚 2" --part box --no-app      # 不要窗口，没有 look
```

同一个循环，输出每一步的工具名和结果摘要，最后一段是模型的话。退出码：核对表有 ✗ 时为 1（方便脚本判断）。

## 验收

- [ ] 单元测试：脚本模型（`MockLanguageModelV4`）驱动循环，在真内核上从空零件建出带孔的盒子，`check` 全过；工具按顺序执行；30 步上限；中止后引擎状态一致。
- [ ] 单元测试：助手改了参数之后，外部 agent 的下一次调用开头有「自你上次调用以来」；反过来也成立。
- [ ] 单元测试：配置读写；窗口拿到的配置里没有 key；环境变量优先；`safeStorage` 不可用时退到明文并标记。
- [ ] 真模型，至少两家（DeepSeek 和一家支持看图的）：`turnery ask` 跑完 `studio-eval` 的 10 题，成功率不低于网页工作台现在的结果；记下每题的调用次数和 token。
- [ ] 窗口里：配好模型 → 说「做一个 80×50×30 的盒子，壁厚 2，四角 M3」→ 看到每一步的卡片和模型的话 → 核对表全绿；点「停止」能停；在面上留一条备注后说「看一下备注」，助手读到并改好。
- [ ] 同一个工具定义（带 `$defs` / `$ref`）在 DeepSeek、OpenAI 兼容端点、Anthropic、Gemini 上都被接受；不接受的那家用「展开 `$ref`」的版本，并记下多花的 token。
- [ ] 打包：`main.mjs` 里 `ai` 和 `zod` 各只有一份（esbuild metafile）。
- [ ] 无窗口模式和 MCP 不受影响：`smoke-mcp.mjs` 照常通过。

## 分步

| 步 | 内容 | 产出 |
| --- | --- | --- |
| 1 | 循环和身份：`assistant.ts`、`Actor` 加 `assistant`、按读者记已读；脚本模型的单元测试 | 能在测试里建出盒子 |
| 2 | 模型配置和 key：`providers.ts`、`providers.json`、环境变量；`turnery ask` | 命令行里用真模型建模；跑评测，定下哪些 provider 要展开 `$ref` |
| 3 | 流式 IPC 和对话栏：transport、消息和工具卡片、停止、设置对话框 | 窗口里可用 |
| 4 | 打磨：整轮撤销（助手一轮的改动合成一步）、看不了图时的降级、token 用量显示、参考图 | 可以发版 |

第 1、2 步不碰界面，可以先做先验证；第 3 步开始前需要这份 spec 里「待确认 4、5」的答案。

## 风险

- **工具定义的体积**：约 6.8 万字符，加上说明约 1 万字符，便宜的模型每一步都要带着。靠各家的前缀缓存；缓存不命中的 provider 成本会高一个量级，评测里要量出来。必要时给助手一个精简的工具子集（去掉装配、螺纹、导入）。
- **`$ref` 的兼容性**没有验证过，见验收第 6 条。
- **流式 IPC 加 `useChat`** 没有先例：中止、窗口关闭、重连都要自己处理。
- **便宜的模型在 40 个工具下的成功率**未知。网页的 10/10 是 18 个工具的结果。

## 落地记录

### 第 1 步：循环和身份（2026-11-10，已实现，未合并）

做这一步用的是「待确认 1、3」的建议方案；这两条如果要改，改动集中在下面几个文件。

- `app/src/desktop/core/assistant.ts`：`assistantTools`（引擎的命令变成 AI SDK 工具，自己排队）、`assistantState`（`get_state` 的文本挂到用户消息上）、`runAssistant`（`streamText`，缺省 30 步）。`guide` 不作为工具给它：说明已经是 system。
- 身份：`Actor` 加了 `"assistant"`；`Doc.agentSeq / agentNoteN` 换成 `seen: { agent, assistant }`，各记各的；`noticeFor` 报告「不是我自己」的改动，写明是「用户在窗口里」「文件被直接修改」「另一个 agent（通过 MCP）」还是「窗口里的内置助手」；`get_state` 里「最近的改动」对读的一方写「你」。「动态」里多了「助手」，标题栏按 `who` 显示「助手正在…」。
- 和设计不一样的地方：历史裁剪（`trim.ts`）还没接，它裁的是界面消息，等第 3 步有了界面消息再接。

验证：`app/src/tests/unit/assistant.test.ts` 4 项，都在真内核上跑：

1. 脚本模型从空文件夹建出 80×50×30 的盒子，5 个命令按顺序执行、全部成功，`check` 全过，改动都记在「助手」名下，状态挂在用户消息上。
2. 助手改完后，外部 agent 的 `get_state` 开头有「自你上次调用以来……窗口里的内置助手」，第二次就没有了；用户改了 `H`、外部 agent 又调了一次之后，助手下一轮的状态里仍然有「用户在窗口里」。
3. 步数上限设成 2：只执行了前两个命令。
4. 工具里没有 `guide`，其余 39 个都在；能看图的模型拿到图片，看不了图的只拿到文字。

全部 356 个单元测试、类型检查、lint 通过；`smoke-mcp.mjs`（无窗口）通过。

没做：真模型一次都没跑过；带 `$defs` 的工具定义各家收不收没有验证；第 2–4 步。

### 第 2 步：模型配置和命令行（2026-11-10，已实现）

待确认项按建议方案走（Jim 2026-11-10 授权）。

- `app/src/desktop/core/providers.ts`：11 个预设和 `languageModel()`。DeepSeek 用自己的 provider 并打开思考（低强度），Anthropic 用自己的，其余都走 OpenAI 兼容。只有 DeepSeek、OpenRouter、Anthropic 填了缺省模型名；其余要用户自己填，不替人猜。
- `desktop/src/engine/models.ts`：`~/.turnery/providers.json`（600）。key 的来源依次是环境变量 `TURNERY_API_KEY_<预设>`、文件里的密文（要调用方给解密器）、文件里的明文。命令行没有系统钥匙串可用，只写明文；应用签名之后再接 `safeStorage`。
- 命令行：`turnery model`、`turnery model use <预设> [模型名]`、`turnery model key <预设>`（从标准输入读）、`turnery ask "<一句话>"`。连着 App 时每一步在窗口里看得到；`--no-app` 时没有看图。核对有 ✗ 时退出码为 1。
- 引擎的 RPC 多带一个 `actor`，只能是 `agent` 或 `assistant`。

codex 审查（一轮，3 条，都已修并加了测试）：
- 助手 `open_part` 之后的命令仍然落在这一轮开始时的零件上：现在跟着 `open_part` 走。
- 停止之后，同一步里排在后面的命令还会执行：现在执行前先看是否已停止。
- 接管 `~/.arbor` 之后，别处按旧路径引用里面文件的零件会找不到：旧名字留一个指向新目录的链接。

真模型验证（DeepSeek `deepseek-flash`，无窗口）：「建一个 80×50×30 的盒子，壁厚 2，四角 M3 螺纹孔，建完核对尺寸」，43 秒做完，核对全过，自己导出了 STEP 和 STL。带 `$defs` 的工具定义被接受。输入 51 万 token，其中 93% 命中缓存。

没做：10 题评测没有跑；其他 provider 一家都没试；`safeStorage` 没接。

### 第 3 步：对话栏（2026-11-10，已实现）

- 主进程 `desktop/src/main/assistant.ts`：`turnery:assistant-send`（开始一轮）、`turnery:assistant`（把 UI 消息流一块块发给窗口，`null` 结束）、`turnery:assistant-stop`、`turnery:models`、`turnery:models-save`。模型请求走 Electron 的 `net.fetch`。key 不出主进程。
- 流的构造放在 `app/src/desktop/core/assistant.ts` 的 `assistantStream()`：主进程的代码不直接 import `ai`（从 `desktop/src` 裸 import 解析不到，也避免打包两份）。
- 窗口：`use-assistant.ts`（`useChat` 加走 IPC 的 transport）、`ui/assistant-panel.tsx`（对话、每个命令一行、看图的缩略图、停止）、`ui/model-settings.tsx`（服务商、模型名、地址、key、能不能看图）。右侧面板多一个「对话」页签，保持挂载，切到别的页签时这一轮照常进行。
- key：macOS 未签名时明文存（文件 600），对话框里写明；签名后（构建时定义 `__TURNERY_SIGNED__`）或在 Windows、Linux 上有系统密钥库时用 `safeStorage` 加密。

和设计不一样的地方：

- 没有「试一下」按钮，配错了在第一次对话时报出来（报错会带上服务端的原话）。
- 对话只留在窗口里，关窗口就没了；没有按项目存到 `~/.turnery/chats/`。
- 面板没有接可拖宽；消息和工具卡片是新写的精简版，没有复用网页工作台的那一套。

验证：源码构建、全新主目录、DeepSeek `deepseek-flash`（key 走环境变量）。在示例外壳上说「把 USB-C 开口加宽到 12，再核对一遍，告诉我哪些要求还满足」：对话栏里依次出现 12 个命令的卡片，参数 `usb_w` 变成 12，模型更新，助手用表格报告 5 项核对仍然满足，并说明开口宽度没法用现成的核对项直接量；标题栏显示「助手 刚刚看模型」。截图在 `docs/media/window-assistant.png`。

设置对话框另用一个假 key 走了一遍：保存后 `providers.json` 权限是 600、对话栏显示选中的模型，发消息时显示「模型的 key 无效或没有权限」并带上服务端的原话。

没验证：停止按钮；DeepSeek 以外的任何一家；Windows 和 Linux。

### 还没做（第 4 步和遗留）

- 对话按项目保存；整轮撤销；token 用量显示；参考图；「试一下」。
- 10 题评测；其他 provider 的兼容性（尤其是带 `$defs` 的工具定义）。
- 签名后切到 `safeStorage` 并迁移明文 key。
