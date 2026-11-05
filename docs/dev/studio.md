# AI 建模工作台（/studio）

方案见 `docs/specs/2026-11-05-ai-modeling.md`。这里讲代码怎么组织、怎么在本地跑、怎么评测和部署。

## 结构

```
app/src/studio/
  dsl.ts           特征树的 JSON 格式（zod schema）：参数表 + 有序特征 + 语义选择器
  expr.ts          参数表达式求值（自己写的解析器，不用 eval）
  kernel/          解释器，浏览器和 Node 通用
    build.ts       Kernel：逐特征重建、按树前缀缓存、面的来源与新/改/未变状态
    select.ts      语义选择器 → 面 / 边
    mesh.ts        网格化与几何分类（移植自 spikes/replicad-kernel）
    errors.ts      OCCT 异常 → 中文解释 + 修法建议
    node.ts        Node 下初始化内核（评测、单元测试）
  worker.ts        浏览器里的内核 Worker（加载 23 MB 的 OpenCascade wasm）
  client.ts        Worker 的 Promise 封装；wasm 堆过大时自动重启并重建
  tools.ts         给模型的 18 个工具（服务端和浏览器共用定义）
  apply.ts         执行一次工具调用：改树 → 重建 → 纯文本结果
  prompt.ts        系统提示词（每次请求都一样）和模型状态（附在学习者的消息上）
  trim.ts          发给模型前裁剪历史：只留最近的图和本轮的思考
  look.ts          离屏渲染四视图（look 工具）
  use-studio.ts    页面状态：特征树、撤销、回滚、参数
  use-studio-chat.ts  useChat：客户端执行工具、自动续发、每轮最多 30 次调用
  ui/              对话面板、特征树、参数面板
  evals.ts         10 道评测题和自动检查
app/server/        对话 API（Hono + AI SDK 7），只转发对话，不碰几何
app/routes/studio.tsx
```

## 一次对话怎么走

1. 学习者发消息时，浏览器把当时的特征树和重建摘要存进这条消息的 `metadata`，然后把整段对话发到 `POST /api/studio/chat`。
2. 服务端把这份快照拼成「模型状态」附在最后一条学习者消息后面，系统提示词保持不变，然后调用 DeepSeek 流式返回。工具没有 `execute`，模型发出工具调用后流就结束了。
3. 浏览器在 `onToolCall` 里执行工具：`applyEdit` 改树 → Worker 重建 → 生成结果文本，然后 `addToolOutput`。
4. 这一步所有工具都有结果后，`sendAutomaticallyWhen` 自动发下一轮请求，直到模型不再调用工具。

几何从不上服务器；服务器的负担只有转发文本，所以小机器也扛得住。

### 为什么状态不放在系统提示词里

DeepSeek 按前缀缓存输入，命中的部分价格约是未命中的 1/50。请求的前缀依次是系统提示词、工具定义（约 1.2 万 token）、对话历史。如果状态写在系统提示词里，模型每改一次树，后面的工具定义和历史就都不能复用缓存。

现在状态挂在学习者的消息上，一轮对话里这条消息不会变；模型在这一轮里做的改动，工具结果里都写着。实测缓存命中率从约 6% 升到 99%，每轮花费约为原来的 1/10。

改提示词时守住一条：每次请求都会变的内容，不要放进系统提示词和工具说明。

## 本地开发

```bash
cd app
npm run dev                       # 网站，http://localhost:5287（/api 代理到 18914）
STUDIO_MOCK=1 npm run dev:api     # 对话 API，用脚本模型，不需要 key
```

真模型：

```bash
DEEPSEEK_API_KEY=sk-… npm run dev:api
```

或者不配服务端 key，在页面右上角的钥匙图标里填自己的 key（只存浏览器本地）。

脚本模型（`server/mock.ts`）每次请求发一个工具调用，按顺序建一个带圆角、抽壳、底孔的盒子，再调一次 `look`。它用来测整条链路，不代表真实模型的表现。

## 特征树格式

- 参数：`{ "L": 80, "inner": "L - 2*t" }`，任何数值字段都可以写参数名或表达式。
- 特征：`sketch`、`extrude`、`revolve`、`fillet`、`chamfer`、`shell`、`hole`、`linear_pattern`、`circular_pattern`、`mirror`、`sweep`、`loft`、`draft`。字段见 `dsl.ts`，每个字段都有中文 `describe`，同时也是给模型看的说明。
- 阵列个数、多边形边数也可以写参数或表达式，结果必须是整数。
- 选择器：所有条件同时满足，每次重建重新解析。

  ```json
  { "of": "base", "parallel": "Z", "expect": 4 }
  { "normal": "+Z", "extreme": "+Z" }
  { "faces": { "normal": "+Z", "extreme": "+Z" } }
  ```

  这正是拓扑命名问题的解法：引用「是什么」，而不是「第几个」。
- 圆柱面上的接缝线不算边，选择器不会选中它。第一个实体也会合并同一曲面上的面和边，所以拉伸一个圆得到的上下两圈各是一条整圆边（和 build123d 默认的 `clean` 一样）。

加一种特征时，要改这几处：

1. `dsl.ts`：加 schema，并写进 `OP_NAMES`。
2. `kernel/build.ts`：在 `apply` 里加一个分支。
3. `tools.ts`：在 `OP_DOCS` 里写说明。
4. `ui/side-panels.tsx` 和 `ui/chat-panel.tsx`：加图标。
5. 评测题和单元测试。

## 评测

```bash
cd app
node --env-file=$HOME/.config/featuretree/deepseek.env node_modules/.bin/tsx scripts/studio-eval.ts            # 全部 10 题
node --env-file=… node_modules/.bin/tsx scripts/studio-eval.ts flange mug --thinking=disabled
```

- 评测里工具直接调内核执行，没有浏览器，所以没有 `look`（模型调用它会得到「不能渲染」，这不算失败）。
- 同一步里的多个工具调用按顺序一个个执行，和浏览器一致（AI SDK 默认并发执行，会互相覆盖特征树）。
- 每题检查这几项：
  - 重建全部成功；
  - 尺寸误差 ±2%，`upright` 题还检查方向；
  - 体积误差 ±2%（能算出体积的题）；
  - 只有一个实体；
  - 至少有 2 个参数；
  - 必需的特征类型都用到了。
- 报告写在 `app/.tmp/evals/`，里面有每次工具调用的输入和结果。
- 改系统提示词、工具说明或 DSL 时都要跑一遍，通过率不能下降。评测要花钱，所以不放进 CI。

最近一次结果（2026-11-05，`deepseek-flash`，思考模式 low）：10/10 通过，每题 6–10 次工具调用，缓存命中 99%，10 题共 $0.019，中位 15 秒一题。

## 部署

和静态站在同一个工作流里（`.github/workflows/deploy.yml`）：`npm run build:api` 用 esbuild 打成单文件 `dist-server/index.mjs`，上传到 `/root/featuretree/api/releases/<sha7>/`，切换 `current`，`pm2 startOrReload`。

- 进程：PM2 `featuretree-api`，`127.0.0.1:18914`，配置在 `app/server/ecosystem.config.cjs`。
- 密钥和限额：`/root/featuretree/shared/.env`（权限 600，不进仓库）。

  ```
  DEEPSEEK_API_KEY=…        # 留空 = 只能自带 key
  STUDIO_MODEL=deepseek-flash
  DAILY_BUDGET_USD=3        # 公共额度每天的上限（按北京时间换日）
  TURNS_PER_HOUR=30         # 每个 IP 每小时能发的消息数（自带 key 不限）
  ```

  改完执行 `pm2 restart featuretree-api --update-env`。
- 花费：服务端日志每次请求记一行用量和估算成本（不记内容），`/root/featuretree/api/data/budget.json` 是当天累计。
- Caddy：`/api/*` 反代到 18914，其余是静态文件。事件流（text/event-stream）不在压缩列表里，避免缓冲。wasm 等大文件构建时预压缩成 `.br` / `.gz`，由 `file_server { precompressed br gzip }` 直接发。
