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
    measure.ts     测量：一个面或边的尺寸，两个之间的距离、角度
    features2.ts   第二批特征：成形到（下一面 / 某个面）、薄壁（封闭轮廓 / 开放的线）、拉伸拔模、筋
    check.ts       需求核对：外形、壁厚、孔、距离、节圆、角度、体积，由内核量出来
    dims.ts        尺寸：每个建成的特征有哪些数、来自哪里、画在模型的哪里
    topo.ts        列出面、边、实体（按哈希去重，替代 replicad 的 O(n²) 列举）和面的面积、中心
    errors.ts      OCCT 异常 → 中文解释 + 修法建议
    fonts.ts       草图文字：按需加载字体，按字体的填充规则把字形变成轮廓
    node.ts        Node 下初始化内核（评测、单元测试），两套字体一起加载
  fonts/           文字用的字体子集（思源黑体 SC，scripts/build-fonts.py 生成）
  worker.ts        浏览器里的内核 Worker（加载 23 MB 的 OpenCascade wasm）
  client.ts        Worker 的 Promise 封装；wasm 堆过大时自动重启并重建
  boot.ts          一进 /studio 路由就启动内核，和页面代码并行下载 wasm
  tools.ts         给模型的 19 个工具（服务端和浏览器共用定义）
  apply.ts         执行一次工具调用：改树 → 重建 → 纯文本结果
  prompt.ts        系统提示词（每次请求都一样）和模型状态（附在学习者的消息上）
  trim.ts          发给模型前裁剪历史：只留最近的图和本轮的思考
  look.ts          离屏渲染四视图（look 工具），可以画上编号图钉
  annotations.ts   标注：类型、校验、发给模型的文字（浏览器、服务端、评测共用）
  use-annotations.ts  标注的状态：待发、已发、卡片、高亮
  use-studio.ts    页面状态：特征树、撤销、回滚、参数
  use-studio-chat.ts  useChat：客户端执行工具、自动续发、每轮最多 30 次调用
  md-blocks.ts     流式 Markdown：按段切开，只重渲最后一段，补上没写完的 ** 和 `
  ui/              对话面板、视口（点选与图钉）、叠在视口左侧的特征树和特征卡片、
                   视口工具（测量、剖视）、参数和代码面板
  param-uses.ts    参数用在哪里、影响哪些特征（参数面板用）
  dim-source.ts    尺寸的数来自哪里：参数、参数的倍数、字面值，或由公式算出（不标在模型上）
  dimension-layer.ts  把尺寸画到模型上：尺寸线、箭头、引线、节圆和可点的标签，重叠的标签自动错开
  holes.ts         标准孔：公制螺钉的过孔、攻丝底孔、沉孔、埋头孔
  section.ts       剖视的平面
  evals.ts         17 道评测题和自动检查
app/server/        对话 API（Hono + AI SDK 7），只转发对话，不碰几何
  models.ts        走哪条路调模型（OpenRouter / DeepSeek 直连）以及每次花了多少钱
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

真模型（和线上一样走 OpenRouter，或者直连 DeepSeek）：

```bash
node --env-file=$HOME/.config/featuretree/openrouter.env node_modules/.bin/tsx server/index.ts
DEEPSEEK_API_KEY=sk-… npm run dev:api
```

或者不配服务端 key，在页面右上角的钥匙图标里填自己的 key（只存浏览器本地）。

脚本模型（`server/mock.ts`）每次请求发一个工具调用，按顺序建一个带圆角、抽壳、底孔的盒子，再调一次 `look`。它用来测整条链路，不代表真实模型的表现。

## 在模型上标注

方案见 `docs/specs/2026-11-06-studio-annotations.md`。

1. **点选**：单击视口（按下到抬起的位移小于 5px）。`studio-viewport.tsx` 用射线找光标下的面，再在屏幕空间找 8px 内、没被挡住的边（触屏 14px）。
2. **描述**：内核的 `pick` 用网格里每个面、每条边的 hash 找回那个面或那条边，返回这些信息：
   - 它是什么、来自哪个特征；
   - 一个验证过、只选中它的选择器（`uniqueFaceSelector` / `uniqueEdgeSelector`）；
   - 平面的草图坐标。
3. **相切线**：圆角和相邻面之间的线画出来像边，其实两侧光滑过渡，不能单独倒圆角。内核会标出这种线（`smooth`），视口这时改选光标下的面。
4. **随消息发出**：
   - 浏览器把标注存进用户消息的 `metadata.annotations`，附上一张带编号的当前视角截图；
   - 服务端用 `annotationText` 把标注拼成文字，追加在那条消息后面（只追加，缓存照样命中）。
5. **回看**：消息里的标签和回复里的 ①②，都会用 `locate` 在当前模型上重新解析选择器并高亮；解析不到就提示。

评测里带 `start` 和 `notes` 的题会先建好起始模型，在 Node 内核里按同样的方式点选，再把标注文字发给模型。

- **斜面**：点在斜面上时，`pick` 给出这个斜面自己的草图坐标（原点在面中心，x 水平，y 沿坡往上），和 `on.face` 贴斜面的规则是同一个函数 `faceFrame`；发给模型的文字写成「在这个斜面上画草图 … 点击处的斜面草图坐标 (u, v)」，并附三维方向。

## 界面

- **特征树**叠在 3D 视图左侧（`ui/tree-overlay.tsx`），平时只显示灰色的图标和名字。
  - 悬停的那一行会微微放大，并高亮这个特征生成的面；右侧浮出详情：类型、摘要、基于哪个草图、设计意图、新面和改动面数、用时、失败原因。
  - 单击打开编辑卡片（`ui/feature-editor.tsx`），不用 AI 直接改：
    - 表单按这种特征的 zod schema 自动生成：数值可以写表达式，枚举用下拉，特征引用列出它前面的特征，选择器只显示已有的条件、可以增删。
    - 「应用」整体替换这个特征（`replaceFeature`），去掉的字段就真的去掉，可以撤销。
    - 底部是在这一步查看（回滚）、上移、下移（`moveFeature` 不让它越过自己用到或用到它的特征）、删除（可撤销）、压缩。
  - 压缩：特征带 `suppressed`；用到被压缩特征的特征一起压缩，其余照常重建。
- **参数面板**：每个参数写着说明（`paramNotes`，模型用 `set_params` 的 `notes` 写），下面一行灰字是它用在哪里（`param-uses.ts` 从特征树算出）。指向参数时，模型上高亮它影响的特征，阵列、镜像出来的也算。
- **尺寸标在模型上**（`kernel/dims.ts`、`dimension-layer.ts`）：每次重建后，内核按建模时记下的几何算出各特征的尺寸。
  - 指向参数面板的一行：模型上画出这个参数的尺寸，从这一行到标签连一条线（`ui/connector-overlay.tsx`）；
  - 指向特征树的一行：画出这一步的尺寸；
  - 视图工具栏「显示尺寸」：按优先级（参数 > 参数的倍数 > 字面值）最多标 12 个。
  - 只标设计尺寸。由公式算出的（如 `R-rb`）不标；种子孔加圆周阵列合成一个节圆「⌀90（pcd）」。
  - 单击标签就地修改（`ui/dim-editor.tsx`）：绑定参数的改参数，字面值改那个字段，也可以「设为参数」；每次是一步撤销。指向离开后尺寸还留 1.2 秒，鼠标停在标签上就一直留着，方便从参数行移过去点。
- **特征卡片**（`ui/feature-card.tsx`，单击特征树的一行）：讲「这一步」，不是表单。
  - 摘要和设计意图；这一步的尺寸（指向时模型上标出，单击就地改，规则同模型上的标签，见 `dim-edit.ts`）；由公式算出的尺寸折叠成只读；
  - 两个直接可改的选项：刻字的文字内容、标准孔的规格和用途；
  - 选中的面或边用白话写（`selector-words.ts`），「在模型上重选」（`use-reselect.ts`）：视图退回这一步之前的实体，点选切换，内核把一组点选合成语义条件（`select.ts` 的 `groupEdgeSelector` / `groupFaceSelector`，`expect` = 个数）；合成不出来时「让助教来选」，把每条边的描述预填进对话；
  - 底栏：在这一步查看、压缩、「⋯」（上移、下移、删除），主按钮「让助教改这一步」（报错时是「让助教修这一步」），预填对话框（`annotations.startMessage`）。结构性的改动都交给助教。
- **需求核对**（`kernel/check.ts`、`check` 工具）：助教把学习者的每个数值要求列成一项，写进特征树的 `checks`（期望值只能是数字）。每次重建都在最新的实体上量一遍，结果在重建报告的 `checks` 里。
  - 对话里的「核对要求 · 4/5」卡片记的是那一刻；参数页顶部的「要求核对」是实时的，有不满足的会自动展开，指向一行时模型上高亮量的面和边。
  - 助教最后一步时满足、之后被学习者自己改参数改到不满足的，标黄色「已偏离」，不算错（`use-studio.ts` 的 `checkBaseline`）；其余不满足的是红色，可以「让助教修正」。
  - 评测输出里多了一列：助教列了几项核对、最后是否都满足、有没有先 ✗ 再修好（caught）。
- **测量**（视图右侧工具栏）：点一个面或边看它的尺寸，再点一个看两者之间，第三下重新开始，再点同一个就取消。
  - 由内核的 `measure` 算：BRepExtrema 求最短距离和两端点（画成一条线），平面、直线、圆或圆柱之间再算夹角、平行面间距、圆心距、轴线间距。
  - Esc 退出。
- **剖视**：沿 X / Y / Z 切开，滑块调位置，可以保留另一侧。
  - 用 `MaterialKit.setSection`：切掉一侧，切口的背面涂成实心灰色。
  - 剖开时，点选只认留下那一侧的正面。
  - 手机上只显示图标。
- **右侧面板**是「对话 | 参数 | 代码」三个标签，宽度可以拖动。
- **对话进行中**：底部固定一行状态，写着正在做什么（思考中、正在回复、正在做「拉伸 · 底座」、正在看模型）和已用的秒数。
  - 同一轮的几步之间，状态会短暂回到 ready，所以 `busy` 会多保持 400 ms，状态行和「停止」按钮不会闪。
- **防抖**：
  - 对话只在停在底部时才跟随滚动，往上翻着看时不会被拽下去。跟随靠 ResizeObserver，所以流式文字、工具卡片、`look` 的图片撑高内容时都会跟上。
  - 文字流入时最多每 40 ms 更新一次。Markdown 按段切开，写完的段不再重渲；最后一段里没写完的 `**`、`` ` `` 和代码块先补上。
- **工具卡片**：改模型的步骤有浅蓝底色，`inspect` / `look` 没有底色，失败的是浅红底。

## 文字（刻字、凸字）

文字是草图里的一种图形：`{ "type": "text", "text": "FT-01", "size": 6, "center": [0, 0], "angle": 0 }`。拉伸切除就是刻字，拉伸加料就是凸字。

- **字号**：`size` 是 em 字号，单位 mm。一个汉字大约这么高，大写字母约 0.73 倍。`center` 是文字外框的中心，`\n` 换行（每行居中）。
- **字体**：思源黑体 SC（Noto Sans SC Regular，SIL OFL 1.1）切出来的两个子集，用 `scripts/build-fonts.py` 生成：
  - `text-latin.ttf`（35 KB）：ASCII、Latin-1 和常用符号；
  - `text-sc.ttf`（2.1 MB）：再加上 GB2312 的 6763 个汉字和中文标点。只有文字里有汉字时才下载。
  - 两个文件出自同一个字体，同一个字符的轮廓完全一样。
  - 字体里没有的字会报错并列出来。⌀ 字体里没有，按 Ø 刻。
- **重叠笔画和自交轮廓**：思源黑体的汉字保留了重叠的笔画，有的轮廓还和自己相交（「4」的横穿过竖，「&」的圈，「量」）。replicad 自带的文字把「在另一条轮廓里面的轮廓」都当成孔，结果会出现体积为负的实体、被填上的字腔。`fonts.ts` 按字体自己的非零环绕规则处理：
  - 和自己相交的轮廓在交点处拆成几个简单的环。环绕数逐环相加，方向和外轮廓相反的环就是孔。
  - 每个孔只从完全包住它的那条轮廓里挖掉。
  - 重叠的笔画在二维里保持分开：replicad 的二维合并对很多汉字会报错，有的不报错却悄悄丢掉笔画。拉伸成实体后，`build.ts` 的 `mergeOverlaps` 用一次 OpenCascade 三维布尔把它们合并起来（第一个实体作参数，其余都作工具），比两两合并快约 5 倍。
  - 所有轮廓都画成折线，离曲线 5 µm 以内，看不出来。在这个 wasm 版本里，和样条侧壁做布尔（合并笔画、凸字并到实体上）每个字会让堆涨几十 MB，而且不会回落；侧壁是平面就好得多，切和网格化也更快。
  - 折线在曲线内侧，「.」「:」这种小圆点的面积少约 1%；其余字符都在 0.3% 以内。
  - 校验：`src/tests/unit/glyph-area.ts` 按非零规则在细网格上算出真实面积，单元测试拿刻出来的体积逐字对比。一次性扫过 ASCII 和 GB2312 一级字的结果写在 `docs/specs/2026-11-06-studio-tools.md`。
- **镜像**：草图贴在背面、底面、左面这类朝向与基准面法向相反的面上时，从外面看草图的 x 是反的，内核会自动镜像文字，让它从外面看是正的。基准面平移到实体最外侧、与这类面重合时也一样。
- **加载**：浏览器的 Worker 在重建前按需下载字体，下载失败时只有文字那一步报错。Node 里 `initNodeKernel` 会把两套字体都先加载好。
- **耗时**（整次重建，Node 里量的）：一行英文凸字约 0.4 秒；刻五个笔画多的汉字约 0.95 秒，大头是实体和字之间的布尔。文字特征要放在最后。
- **内存**：每次重建，凸一行英文 wasm 堆涨约 18 MB，刻五个汉字约 45 MB；普通模型不涨。超过 1400 MB 时，`client.ts` 会重启 Worker 并重建，刻字模型大约每改三十次重启一次。
- **导出代码**：build123d 用 `Text(..., font="Noto Sans SC")`，需要本机装有这个字体。镜像不会带到导出代码里。

## 特征树格式

- 参数：`{ "L": 80, "inner": "L - 2*t" }`，任何数值字段都可以写参数名或表达式。
- 特征：`sketch`、`extrude`、`revolve`、`fillet`、`chamfer`、`shell`、`hole`、`linear_pattern`、`circular_pattern`、`mirror`、`sweep`、`loft`、`draft`、`rib`。
- 拉伸的几种写法（`kernel/features2.ts`）：
  - `distance`、`through`、`until` 三者正好写一个。`until: "next"`：拉得很长，加料时减去实体、切除时与实体求交，只留贴着草图平面的那几块，所以挡住它的面是斜的、弯的都行；`until: { face }`：平行的面就是算好的距离，斜面用 replicad 的 `extrudeUntil`。
  - `thin`：封闭轮廓用 `Drawing.offset` 偏出一圈（向外偏时凸角会变圆）；开放的线（草图图形 `path`，圆弧按 5 µm 离散）按折线偏移、端头平齐，`inside` 是线拐弯的那一侧。
  - `draft`：先直拉，再把不平行于草图平面的面拔模；拔模失败（例如圆柱面）就改为原轮廓和内缩轮廓之间的直纹放样。
- 筋 `rib`：一条 `path` 两端延长很远，在线的一侧围成一大块，厚 `t` 横跨草图平面；和实体包围盒求交、减去实体，只留不碰包围盒外框的块（被实体围住的空腔）。两侧都有时取靠近实体中心的一侧，`flip` 换另一侧。字段见 `dsl.ts`，每个字段都有中文 `describe`，同时也是给模型看的说明。
- 阵列个数、多边形边数也可以写参数或表达式，结果必须是整数。
- `paramNotes`：每个参数一句说明，只给人看，不参与计算。
- 草图平面 `on`：
  - `face` 选中的平面与 `plane` 平行时，坐标沿用基准面；
  - 不平行（斜面）时，草图贴在这个面上：原点在面的中心，x 沿面内的水平方向，y 沿面往上，法向朝外；
  - `tilt: { axis, angle }` 把基准面绕过原点的坐标轴转一个角度。
- 标准孔：`hole.standard = { size: "M3", fit: "clearance" | "close" | "tap", head: "cbore" | "csink" }`，数值见 `holes.ts`（参考值）。螺纹孔只钻攻丝底孔，显示时在孔口和孔底画虚线圈（`DisplayData.threads`），阵列和镜像出来的也画。
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
4. `ui/tree-overlay.tsx` 和 `ui/chat-panel.tsx`：加图标。
5. 评测题和单元测试。

## 评测

```bash
cd app
node --env-file=$HOME/.config/featuretree/deepseek.env node_modules/.bin/tsx scripts/studio-eval.ts            # 全部 10 题
node --env-file=… node_modules/.bin/tsx scripts/studio-eval.ts flange mug --thinking=disabled
```

- 评测走和线上一样的路：有 `OPENROUTER_API_KEY` 就走 OpenRouter，否则直连 DeepSeek。
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

现在共 17 道：
- 10 道从零建模；
- 2 道新工具：四角 M4 螺纹孔（检查底孔 ⌀3.3）、斜面中心立一个凸台；
- 3 道带标注：在点的位置开孔、只给点的那条棱倒圆角、把点的凸台加高；
- 2 道刻字：铭牌顶面刻英文；方块背面刻中文，检查字刻在背面里。

## 部署

和静态站在同一个工作流里（`.github/workflows/deploy.yml`）：`npm run build:api` 用 esbuild 打成单文件 `dist-server/index.mjs`，上传到 `/root/featuretree/api/releases/<sha7>/`，切换 `current`，`pm2 startOrReload`。

- 进程：PM2 `featuretree-api`，`127.0.0.1:18914`，配置在 `app/server/ecosystem.config.cjs`。
- 密钥和限额：`/root/featuretree/shared/.env`（权限 600，不进仓库）。

  ```
  OPENROUTER_API_KEY=…      # 公共额度走 OpenRouter（优先）
  OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash-1017
  OPENROUTER_ROUTING={"quantizations":["fp8","fp16","bf16"],"sort":"price"}   # 可选，OpenRouter 的 provider 路由
  DEEPSEEK_API_KEY=…        # 不用 OpenRouter 时直连 DeepSeek；两个都留空 = 只能自带 key
  STUDIO_MODEL=deepseek-flash
  DAILY_BUDGET_USD=0.14     # 公共额度每天的上限（按北京时间换日）
  TURNS_PER_HOUR=30         # 每个 IP 每小时能发的消息数（自带 key 不限）
  ```

  学习者自己填的 key 永远直连 DeepSeek。

  改完执行 `pm2 restart featuretree-api --update-env`。
- 花费：服务端日志每次请求记一行用量和成本（不记内容）。走 OpenRouter 时用它返回的实际花费，直连 DeepSeek 时按价目表估算。`/root/featuretree/api/data/budget.json` 是当天累计。

### OpenRouter 的路由

同一个模型在 OpenRouter 上有几十家服务商，有的跑 fp4 量化版。默认只用 fp8 及以上、按价格选，这样每一步大多落在同一家，缓存也能连着命中。哪些服务商能用，还要看账户的数据政策：现在的设置排除了「可能用数据训练」的服务商，DeepSeek 官方因此不在其中。

2026-11-06 实测（10 道评测）：

| | 通过 | 10 题花费 | 中位耗时 | 落到的服务商 |
| --- | --- | --- | --- | --- |
| fp8+，按价格（默认） | 10/10 | $0.013 | 30 秒 | Morph |
| fp8+，按吞吐（5 题） | 4/5 | $0.036 | 25 秒 | Parasail、Morph 混着，缓存常断 |
| 直连 DeepSeek（对照） | 10/10 | $0.019 | 15 秒 | DeepSeek |
- Caddy：`/api/*` 反代到 18914，其余是静态文件。事件流（text/event-stream）不在压缩列表里，避免缓冲。wasm 等大文件构建时预压缩成 `.br` / `.gz`，由 `file_server { precompressed br gzip }` 直接发。
