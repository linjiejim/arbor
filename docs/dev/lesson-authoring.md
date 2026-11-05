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
```
