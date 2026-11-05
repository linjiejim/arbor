# 参与贡献

> FeatureTree is a Chinese-language, concept-first course on parametric CAD. Contributions are welcome in Chinese or English; this guide covers running the site, checks, lessons, models, design rules, commit style and how to cite sources for content fixes.
> Code is MIT and lesson text is CC BY 4.0; by contributing you agree to license your contribution the same way.

欢迎改错字、纠正说法、报 bug、提新课，也欢迎直接写一节课或一个拆解模型。这份说明讲怎么跑起来、提交前查什么，以及内容纠错为什么一定要给出处。

## 跑起来

需要：

- Node.js 22。CI 用的是这个版本，20 以上一般也行。
- 改 `models/` 时还要 Python 3.11 以上。

```bash
git clone https://github.com/linjiejim/featuretree.git
cd featuretree/app
npm ci              # 国内网络慢时加 --registry=https://registry.npmmirror.com
npm run dev         # http://localhost:5287
```

只改前端不需要 Python：烘焙好的模型已经提交在 `app/public/models/`。

## 提交前检查

```bash
cd app
npm run check       # 类型检查 + oxlint + 设计守卫 + 单元测试
npm run build       # 生产构建
```

`npm run check` 和 `npm run build` 都要通过；CI 部署前也跑这两步。

- oxlint 要零警告。
- 设计守卫（`src/tests/design`）会拦住：
  - 裸色值
  - 12px 以下的字号
  - 手写的弹层

## 写一节课

完整说明见 [`docs/dev/lesson-authoring.md`](docs/dev/lesson-authoring.md)。要点：

- 一节课由两个文件组成，放在 `app/src/content/lessons/`：
  - `<id>.scene.ts`：场景控制器。
  - `<id>.tsx`：步骤、文字、任务、小测。
- 参考 `revolve`（最标准）和 `sketch-to-solid`（交互最多）。
- 4–7 步，一步一个概念：
  - 每步自动转到关键视角。
  - 任务在 3D 里完成。
  - 易错处先猜再看。
- 最后 3 道小测，每题都有解释。
- 开发模式下打开 `/lesson/<文件名>` 就能试；上线前在 `lessons/index.ts` 里注册。

## 写一个拆解模型

完整说明见 [`docs/dev/models.md`](docs/dev/models.md)。

模型用 [build123d](https://github.com/gumyr/build123d) 写在 `models/parts/<id>.py` 或 `models/assemblies/<id>.py`，由烘焙器 `ftbake` 离线算成 GLB。

```bash
python3 -m venv .venv
.venv/bin/pip install -r models/requirements.txt
cd models && ../.venv/bin/python -m ftbake <id>    # 只烘焙一个模型
```

规则：

- 每个特征前写 `# @step <id>`，每个特征后调用一次 `r.solid` 或 `r.sketch`。
- 失败的参数组合是教学内容，给它写好 `failures` 解释。
- 改了模型就重新烘焙，把 `app/public/models/<id>/` 的变化一起提交。

## 设计规则

界面基于 jim-uiux，项目自己的约定见 [`docs/DESIGN.md`](docs/DESIGN.md)。最常碰到的几条：

- **颜色**：只用语义 token（`bg-primary`、`text-muted-foreground`、`--scene-*`），不写颜色值。3D 场景的颜色也从主题 token 读取。
- **字号**：只用字号阶梯（`text-caption` 及以上），不小于 12px。
- **字重**：只用 400 / 500 / 600。
- **弹层**：用 `components/ui/` 里的对话框、抽屉、浮层，不手写。
- **ui 组件**：`components/ui/` 下的组件和 jim-uiux 上游保持一致，要改请先提 Issue 说明。
- **文案**：
  - 简体中文，短句。
  - 引号用「」。
  - 中英文、中文与数字之间加空格。
  - 按钮写「动词 + 对象」，不超过 6 个字。
- **坐标**：Z 轴朝上；提到 SOLIDWORKS 时说明它默认 Y 轴朝上。

## 提交规范

用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)，主题用中文，一个提交只做一件事：

```
fix(app): 3D 打印课第一步把零件拉近
feat(content): 新增「尺寸公差与配合」互动课
docs: 添加许可证与第三方声明
```

- 类型：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`。
- 范围：
  - `app`：网站代码。
  - `content`：课程文字、术语、大纲。
  - `models`：模型和烘焙器。
  - `ci`：工作流。
- 正文写为什么这样改；内容纠错在正文里写出处。

## 内容纠错：必须给出处

课程里的工程说法会被当成「标准答案」学，所以每一处纠错都要能查到依据。

1. **先开 Issue**，用「内容纠错」模板。写清：
   - 哪节课、哪一步
   - 原文怎么写
   - 应该怎么写
   - 出处
2. **出处按可信度从高到低**：
   - **标准原文**：GB/T、ISO、ASME 等，写明标准号、年份和条款，例如「GB/T 4457.5-2013 第 4.1 条」。
   - **软件官方帮助**：写明软件、版本和界面语言，并附链接，例如「SOLIDWORKS 2022 帮助（简体中文）· 图纸属性」。
   - **正式出版的教材、手册**：写明书名、版次和页码。
   - **论坛帖子和个人博客**：只能作旁证，不能单独作依据。
3. **软件叫法因版本、语言而异时**，写清是哪个版本，或者改成「因版本而异」，不要以偏概全。
4. **改动合并后**，出处写进提交正文。需要时也写进课程里的注释，例如「见 GB/T 14692」。

没有出处的修改建议也欢迎提，我们会去核对；但在找到依据之前不会改课程文字。

## 许可

提交的代码按 MIT（[`LICENSE`](LICENSE)），课程文字和文档按 CC BY 4.0（[`LICENSE-content`](LICENSE-content)）发布。引入新的第三方依赖或素材时，在 [`THIRD_PARTY.md`](THIRD_PARTY.md) 里补上许可证和链接。不接受许可证和 MIT 不兼容的依赖，例如 GPL 的库直接打进网站产物。
