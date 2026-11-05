# 写一节互动课

FeatureTree 的每节互动课由两个文件组成，放在 `app/src/content/lessons/`：

| 文件 | 内容 |
| --- | --- |
| `<id>.scene.ts` | 场景控制器：继承 `LessonScene<S>`（`scene.ts`），拥有 3D 场景和课程状态 |
| `<id>.tsx` | 课程定义 `LessonDef<S, C>`（`types.ts`）：步骤、文字、任务判定、控件、小测、要点 |

参考实现：`revolve.scene.ts` + `revolve.tsx`（最标准），`sketch-to-solid.scene.ts` + `sketch-to-solid.tsx`（交互最多）。

写好后在开发服务器里打开 `/lesson/<id>` 就能试（开发模式下未注册的课按文件名打开）。上线要在 `lessons/index.ts` 里注册。

## 控制器

- `constructor(v, emit)`：调用 `super(v, emit, initialState)`；把自己的对象加到 `this.root`（销毁时自动清理）。网格用 `v.setGrid(半宽, 间距)`。
- `enter(step)`：把场景带到这一步的**起点**。学习者可能直接跳到第 5 步，所以前面几步的结果要补齐（参考 `sketch-to-solid.scene.ts` 的 `enter`）。同时设置这一步的**关键视角**：`v.setView("front")`、`v.flyTo(pos, target)` 或 `v.fit(box, { dir })`。
- 动作方法（由面板按钮、滑杆调用）：改状态用 `this.set(patch)`，它会发出状态并调用 `render()`。
- `render()`：根据状态重建几何。用 `this.clear(group)` 清掉旧的。
- 拖拽：参考 `revolve.scene.ts` 的 `handle()`：CSS2D 圆点，`pointerdown` 时禁用轨道控制，`v.rayOnPlane(ev, plane)` 求落点。
- 动画：`v.tweens.run(ms, k => ..., { tag })`，减少动态效果时自动跳到结果。讲解性动画 0.7–1.4 s。
- 需要逐帧更新时用 `this.own(v.onFrame(...))`，返回 true 表示还在动。

可用的几何与绘制工具（不要改它们，需要新工具就写在自己的文件里）：

- `three/geom.ts`：`lathe`、`sweepEllipse`、`loft`、`extrude`、`draftedPrism`、`roundedRect`、`filletCorner`、`arc`、`flipFaces`、`capLoop`…
- `three/build.ts`：`face`（带 feature/role 标签的面 + 边线）、`edges`、`edgeLine`、`line`（粗线，草图用）、`label`、`tag`、`datumPlane`、`linearDim`、`paint`。
- `three/materials.ts`：`v.kit` 上的材质。`model` 静止的面、`highlight` 这一步新生成的面（强调色）、`modified` 被修改的面（橙）、`ghost` 后续特征预示；线：`edge`、`edgeSoft`、`sketch`（欠定义，蓝）、`sketchDefined`（完全定义，黑/白）、`construction`（虚线）、`dimension`、`path`。
- 颜色一律来自主题 token，不要在代码里写颜色值。

## 课程定义

```tsx
const lesson: LessonDef<MyState, MyScene> = {
  id: "my-lesson",           // 和文件名一致
  codes: ["1.2.6"],          // 覆盖的课程编号（见 curriculum.json）
  title: "圆角与倒角",
  create: (v, emit) => new MyScene(v, emit),
  steps: [ { title, body, task?, extra?, note?, terms? }, ... ],   // 4–7 步
  quiz: [ { q, options, answer, explain }, ... ],                  // 3 题
  takeaways: ["…", "…", "…"],
  next: { to, label, text },  // 可选：下一步去哪
  overlay: ({ s }) => <SceneChip>…</SceneChip>,  // 视口左上角的浮层
}
export default lesson
```

- `task.done(state)` 决定这一步算不算完成；没完成时按钮显示「先跳过」，不强制。
- `extra` 放这一步的控件：`ParamSlider`、`Segmented`、`Button`、`Predict`（先猜再看）、`Hint`。
- `terms` 用 `content/ops.ts` 里的命令 id，显示各软件叫法。

## 教学原则（来自调研，见 docs/research/report.md）

1. 一步一个概念，一节课 4–7 步加小测，有效互动 5–10 分钟。
2. 每一步自动转到看得清的关键视角；不依赖学习者自己转。
3. 任务在 3D 里完成：拖、点、拉，而不是读完点下一步。
4. 结果值得预测的地方先用 `Predict` 问，再在 3D 里揭示（`onReveal` 里执行那个操作）。
5. 动画只用在「变化本身就是知识」的地方；播放时文字少。
6. 小测每题都有解释；错误选项要是真实的误解，不是凑数。
7. 明确讲策略和设计意图（为什么这样做、什么时候会失败），不只讲点哪里。
8. 不承诺「学会就会用任何软件」；用术语卡对照各软件叫法。

## 文案

- 简体中文，短句。中英文、中文与数字之间加空格；单位紧跟数字（`20 mm` 例外：mm 前加空格保持一致即可，全课统一）。
- 引号用「」。不用感叹号，不用「请」开头的长句。
- 按钮写动词加对象，≤ 6 个字。
- 坐标约定：Z 轴朝上；上视基准面 XY、前视基准面 XZ、右视基准面 YZ。提到 SOLIDWORKS 时说明它默认 Y 轴朝上。

## 检查

```bash
cd app
npx tsc -p tsconfig.app.json --noEmit
npx oxlint src/content/lessons
npx vitest run src/tests/design   # 设计守卫：不许写颜色值等
npx playwright test -g <id>       # 这节课的冒烟测试
```

注册到 `lessons/index.ts` 的课会自动进冒烟测试（`app/e2e/lessons.e2e.ts`），不通过就不能合并、不能部署。测试用页脚的「下一步 / 先跳过」走完每一步，每题选第一个选项交卷，再点「完成本课」。所以：

- 每一步不做任务也要能走下去：点「先跳过」后，下一步的 `enter(step)` 照常进入。
- 视口每一步都要画出东西（不能整块空白），整个过程不能有未捕获的异常或 `console.error`。
- 小测用标准的 `quiz` 字段，不要另做答题控件。

怎么跑见根目录 `README.md` 的「开发」一节。

# 写一张图文卡

交互必要性为 0–1 的课（见 `curriculum.json` 的 `interactive`）做成图文卡：几段短文、一张示意图或一张表、2–3 道小测。学习路径上显示「图文」标签，读完答完小测就算完成，小测按 1 天、1 周、3 周进入复习。

## 文件

一张卡一个文件：`app/src/content/cards/<课程编号>.tsx`，比如 `0.3.2.tsx`，默认导出一个 `CardDef`（`cards/types.ts`）。写好后在 `cards/index.ts` 里按课程顺序加一行注册，卡会单独打包、按需加载：

```ts
{ code: "0.3.2", load: () => import("./0.3.2") },
```

注册后 `/card/0.3.2` 就能打开。同一个编号如果已经有互动课或拆解，学习路径优先进互动课，其次拆解，最后才是图文卡。

参考实现：`0.3.2.tsx`（示意图加表格），`1.5.4.tsx`（代码示例）。

## CardDef

```tsx
const card: CardDef = {
  code: "0.3.2",                 // 和文件名一致，必须在 curriculum.json 里
  title: "文件格式：导出时带走了什么",
  minutes: 4,                    // 3–5 分钟读完
  sections: [ { heading, body }, ... ],          // 2–4 段，body 写 <p>、<ul>、<ol>、<code>
  figure: { Figure: () => <Svg …>…</Svg>, caption, after: 0 },   // 可选：画在第几段后面
  table: { caption, head, rows, after, nowrap, note },           // 可选
  terms: { ops: ["hole"], concepts: ["tnp"] },   // ops.ts 的命令 id、terms.ts 的概念 id
  quiz: [ { q, options, answer, explain }, ... ], // 2–3 题，每题都有解释
  takeaways: ["…", "…", "…"],
  sources: [ { title, publisher, url }, ... ],   // 至少一条，http(s) 链接
  related: { lessons: ["feature-tree"], teardowns: ["mug"], cards: ["1.3.6"] },
}
export default card
```

- 示意图用 `components/card-figure.tsx` 的 `Svg`、`T`（文字）、`Arrow`。画布宽不超过 320，文字用默认的 `text-small`：手机上 SVG 按约 1:1 显示，文字不会小于 12px。颜色只用主题类（`text-primary`、`fill-muted`、`text-muted-foreground`…），线条默认是 `currentColor`。
- `Figure` 写成对象里的箭头函数，辅助函数用小写名字，这样卡片文件不会触发 oxlint 的 fast-refresh 警告。
- 剖面线用 `<pattern>`，id 带上卡片编号（如 `card-124-hatch`），避免和别的 SVG 冲突。
- 表格在手机上横向滚动；标准号、零件号这类不能断行的列放进 `nowrap`。

## 内容

- 每个事实都要有出处，写进 `sources`：优先各软件官方帮助（中文版）、标准原文或国家标准平台的记录、厂商技术文档；其次是权威参考。不复制原文，用自己的话说，一张卡最多引一句短句。
- 命令名用各软件官方中文界面的叫法，和 `ops.ts`、`terms.ts` 已有的说法保持一致；各软件叫法不同时用一张对照表。
- 工程约定以国标为准，写明标准号；标准会修订，写之前确认是否现行。
- 小测的错误选项要是真实的误解；解释说清楚为什么对、为什么错。
- 不确定的说法宁可不写，或者写「以帮助为准」「因版本而异」。

## 检查

`npm run check` 里的 `src/tests/unit/cards.test.ts` 会检查：每张卡都已注册且按课程顺序、编号在大纲里、2–4 段、至少一条 http(s) 来源、2–3 道带解释的小测、引用的命令 / 概念 / 课 / 拆解 / 卡都存在。
