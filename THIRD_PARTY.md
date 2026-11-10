# 第三方组件与许可

Turnery 自己的代码用 MIT（[`LICENSE`](LICENSE)），课程文字和文档用 CC BY 4.0（[`LICENSE-content`](LICENSE-content)）。下面是用到的第三方组件。许可证一栏取自 `app/node_modules` 里各包的 `package.json` 和 LICENSE 文件，以及 Python 环境里各包的 PyPI 元数据；版本是 `app/package-lock.json` 和 `models/requirements.txt` 锁定的版本。

按是否随网站发布分成三类：

1. **随网站发布**：打进 `app/dist` 的 JS、CSS、字体和 wasm，访问者的浏览器会下载。
2. **只在构建时用**：生成 `app/dist` 的工具，不进产物。
3. **只在离线烘焙时用**：在开发者电脑上把 `models/` 算成 GLB，网站不包含它们。

## 1. 随网站发布

| 组件 | 版本 | 许可证 | 用途 | 链接 |
| --- | --- | --- | --- | --- |
| three.js（含 addons：OrbitControls、GLTFLoader、CSS2DRenderer、Line2 系列、RoundedBoxGeometry、RoomEnvironment） | 0.187.0 | MIT | 3D 视口 | <https://github.com/mrdoob/three.js> |
| React、React DOM、scheduler | 19.3.1 | MIT | 界面 | <https://github.com/facebook/react> |
| React Router | 8.5.1 | MIT | 路由 | <https://github.com/remix-run/react-router> |
| Radix UI（`radix-ui` 及其 `@radix-ui/*` 子包） | 1.8.1 | MIT | 弹层、菜单、标签页等无样式组件 | <https://github.com/radix-ui/primitives> |
| Floating UI（`@floating-ui/core`、`dom`、`react-dom`、`utils`，Radix 依赖） | 1.8 / 2.1 | MIT | 弹层定位 | <https://github.com/floating-ui/floating-ui> |
| aria-hidden、react-remove-scroll、react-remove-scroll-bar、react-style-singleton、use-callback-ref、use-sidecar（Radix 依赖） | — | MIT | 弹层的焦点与滚动锁定 | <https://github.com/theKashey> |
| get-nonce（Radix 依赖） | 1.0.1 | MIT | — | <https://github.com/theKashey/get-nonce> |
| tslib（Radix 依赖） | 2.8 / 2.9 | 0BSD | TypeScript 运行时辅助函数 | <https://github.com/microsoft/tslib> |
| Tailwind CSS（生成的 CSS 里含它的 preflight 样式） | 4.3.4 | MIT | 样式 | <https://github.com/tailwindlabs/tailwindcss> |
| Lucide（`lucide-react`） | 1.68.0 | ISC；其中源自 Feather 的图标为 MIT | 图标 | <https://github.com/lucide-icons/lucide> |
| class-variance-authority | 0.7.1 | Apache-2.0 | 组件变体 | <https://github.com/joe-bell/cva> |
| clsx | 2.1.1 | MIT | 拼 class | <https://github.com/lukeed/clsx> |
| tailwind-merge | 3.7.0 | MIT | 合并 class | <https://github.com/dcastil/tailwind-merge> |
| Sonner | 2.0.8 | MIT | 轻提示 | <https://github.com/emilkowalski/sonner> |
| TanStack Table（`@tanstack/react-table`、`table-core`） | 8.21.3 | MIT | 表格 | <https://github.com/TanStack/table> |
| Inter（经 `@fontsource-variable/inter` 打包） | 5.3.0 | SIL OFL 1.1 | 界面字体 | <https://github.com/rsms/inter> |
| JetBrains Mono（经 `@fontsource-variable/jetbrains-mono` 打包） | 5.3.0 | SIL OFL 1.1 | 等宽字体 | <https://github.com/JetBrains/JetBrainsMono> |
| **planegcs**（`@salusoft89/planegcs`） | 1.3.0 | **LGPL-2.1**，见下 | 「几何约束与自由度」课的草图求解器 | <https://github.com/Salusoft89/planegcs> |
| replicad | 1.2.0 | MIT | AI 建模工作台的建模 API（浏览器里的 Web Worker） | <https://github.com/sgenoud/replicad> |
| opentype.js（replicad 依赖） | 2.0.0 | MIT | 读取字体轮廓，做草图文字 | <https://github.com/opentypejs/opentype.js> |
| 思源黑体 SC（Noto Sans SC Regular 的子集：`app/src/studio/fonts/text-*.ttf`，取自 `@expo-google-fonts/noto-sans-sc` 0.4.4） | 2.004 | SIL OFL 1.1，许可全文在 `app/src/studio/fonts/OFL.txt` | 工作台草图文字（刻字、凸字）的字形 | <https://github.com/notofonts/noto-cjk> |
| **replicad-opencascadejs** | 1.1.0 | **LGPL-2.1-only**，见下 | 工作台的几何内核：OpenCascade 编译成的 WebAssembly | <https://github.com/sgenoud/replicad> |
| AI SDK（`ai`、`@ai-sdk/react`） | 7.0 / 4.0 | Apache-2.0 | 工作台的对话与工具调用 | <https://github.com/vercel/ai> |
| Zod | 4.6.7 | MIT | 工作台特征树和工具参数的 schema | <https://github.com/colinhacks/zod> |
| react-markdown、remark-gfm | 10.1.0 / 4.0.1 | MIT | 工作台对话里的 Markdown 渲染 | <https://github.com/remarkjs/react-markdown> |

`package.json` 里还有 cmdk 和 vaul（都是 MIT），目前没有页面用到，构建时被摇树去掉了，不在产物里。

### planegcs（LGPL）

- **是什么**：FreeCAD 草图求解器 planegcs 的 C++ 代码编译成的 WebAssembly，外加一层 TypeScript 封装。
- **许可证**：包里附带的 LICENSE 是 GNU LGPL 2.1 全文；`package.json` 声明为 `LGPL-2.0-or-later`，和 FreeCAD 源文件头一致。按 LGPL-2.1 遵守即可。
- **wasm 里还编译进了两个库**：
  - Eigen：MPL-2.0。
  - Boost 头文件库：BSL-1.0。
- **怎么分发**：
  - 求解器没有和本站代码合并。它的 JS 胶水代码在单独的按需分块里（`assets/planegcs-*.js`），wasm 是单独的文件（`assets/planegcs-*.wasm`）。
  - 只有打开那节课才会下载。
  - 换成自己编译的版本，只要替换这两个文件，或改 `app/package.json` 里的版本后重新构建。
- **源码**：
  - npm 包：<https://github.com/Salusoft89/planegcs>，1.3.0 对应标签 [`1.3`](https://github.com/Salusoft89/planegcs/tree/1.3)。
  - 上游 C++：<https://github.com/FreeCAD/FreeCAD/tree/main/src/Mod/Sketcher/App/planegcs>。
  - 我们没有修改它。
- **许可证全文**：<https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html>，安装依赖后也在 `app/node_modules/@salusoft89/planegcs/LICENSE`。

### replicad-opencascadejs（LGPL）

- **是什么**：replicad 作者为它定制编译的 OpenCascade（OCCT）WebAssembly 版本。OCCT 本身是 LGPL-2.1 加 OCCT 例外条款。
- **怎么分发**：
  - 只在 AI 建模工作台（`/studio`）里由 Web Worker 加载，胶水代码在工作台的 Worker 分块里，wasm 是单独的文件（`assets/replicad_single-*.wasm`，构建时另存一份 `.br` / `.gz` 压缩版）。
  - 换成自己编译的版本，替换这个 wasm 文件（需与胶水代码版本匹配），或改 `app/package.json` 里的版本后重新构建。
- **源码**：npm 包 `replicad-opencascadejs` 1.1.0 由 <https://github.com/sgenoud/replicad>（`packages/replicad-opencascadejs`）构建；上游 OCCT 在 <https://github.com/Open-Cascade-SAS/OCCT>。我们没有修改它。
- **许可证全文**：安装依赖后在 `app/node_modules/replicad-opencascadejs/LICENSE`。

### 工作台的服务端（不随网站下载）

`app/server/` 是一个只转发对话的小服务，部署在服务器上，不发给浏览器：

| 组件 | 版本 | 许可证 | 链接 |
| --- | --- | --- | --- |
| Hono、`@hono/node-server` | 4.13 / 2.1 | MIT | <https://github.com/honojs/hono> |
| `@ai-sdk/deepseek` | 3.0.80 | Apache-2.0 | <https://github.com/vercel/ai> |
| `@openrouter/ai-sdk-provider` | 3.1.0 | Apache-2.0 | <https://github.com/OpenRouterTeam/ai-sdk-provider> |
| AI SDK（`ai`）、Zod | 同上 | Apache-2.0 / MIT | 同上 |

### 桌面版 Turnery（`desktop/`，随安装包分发）

Turnery 的窗口和网站共用上面「随网站发布」的前端组件（React、three.js、Radix、Lucide、字体……），另外带上：

| 组件 | 版本 | 许可证 | 用途 | 链接 |
| --- | --- | --- | --- | --- |
| Electron（含 Chromium、Node.js） | 45.2.3 | MIT；Chromium 各组件的许可见安装包里的 `LICENSES.chromium.html` | 桌面应用外壳 | <https://github.com/electron/electron> |
| `@modelcontextprotocol/sdk` | 1.32.2 | MIT | `turnery mcp` 的 MCP 服务 | <https://github.com/modelcontextprotocol/typescript-sdk> |
| replicad-opencascadejs | 1.1.0 | LGPL-2.1-only | 几何内核，见上一节 | 同上 |

- **OpenCascade 的 wasm 怎么分发**：和网站一样是单独的文件，在 `Turnery.app/Contents/Resources/app/dist/vendor/opencascade/`（`replicad_single.js` + `replicad_single.wasm`，旁边附 `LICENSE`）。安装包不打 asar，替换这两个文件就能换成自己编译的版本。
- 只在构建时用、不进安装包：electron-builder（MIT）、esbuild（MIT）。

### jim-uiux 组件

`app/src/components/ui/` 下的组件、`app/src/lib/utils.ts`、`app/src/lib/strings.ts` 和设计令牌，来自作者自己的设计系统 [jim-uiux](https://design.linjiejim.com)（通过 shadcn 注册表安装）。

- 除 import 路径外和上游一致。
- 它们基于 [shadcn/ui](https://github.com/shadcn-ui/ui)（MIT），用到的 Radix、cva 等见上表。
- jim-uiux 以 MIT 许可证开源：[linjiejim/jim-uiux](https://github.com/linjiejim/jim-uiux)（[LICENSE](https://github.com/linjiejim/jim-uiux/blob/main/LICENSE)）。

## 2. 只在构建时用（不进产物）

| 组件 | 许可证 | 链接 |
| --- | --- | --- |
| Vite（含 Rolldown） | MIT | <https://github.com/vitejs/vite> |
| @vitejs/plugin-react | MIT | <https://github.com/vitejs/vite-plugin-react> |
| Tailwind CSS 编译器（`tailwindcss`、`@tailwindcss/vite`、`@tailwindcss/oxide`） | MIT | <https://github.com/tailwindlabs/tailwindcss> |
| Lightning CSS（Tailwind 依赖） | MPL-2.0 | <https://github.com/parcel-bundler/lightningcss> |
| TypeScript | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| Oxlint | MIT | <https://github.com/oxc-project/oxc> |
| Vitest | MIT | <https://github.com/vitest-dev/vitest> |
| culori（对比度测试） | MIT | <https://github.com/Evercoder/culori> |

## 3. 只在离线烘焙时用（不随网站发布）

`models/` 里的模型代码在开发者电脑上运行，把几何算成 GLB，提交在 `app/public/models/`。

- 网站只包含算出来的 GLB 和清单。
- 不包含下面任何一个库，也不在浏览器里调用它们。

| 组件 | 版本 | 许可证 | 链接 |
| --- | --- | --- | --- |
| build123d | 0.13.0 | Apache-2.0 | <https://github.com/gumyr/build123d> |
| OCP（`cadquery-ocp-novtk`，OpenCascade 的 Python 绑定） | 8.0.1.1.0 | Apache-2.0 | <https://github.com/CadQuery/OCP> |
| **Open CASCADE Technology**（随 OCP 的 wheel 一起安装） | 8.0.1 | **LGPL-2.1**，附 Open CASCADE Exception 1.0 | <https://github.com/Open-Cascade-SAS/OCCT> |
| pygltflib | 1.16.5 | MIT | <https://gitlab.com/dodgyville/pygltflib> |
| NumPy | 2.5.4 | BSD-3-Clause 等 | <https://github.com/numpy/numpy> |

build123d 还会装上 anytree、ezdxf、lib3mf、ocpsvg、ocp_gordon、scipy 等依赖，都是宽松许可（Apache-2.0、MIT、BSD），同样只在本机用。

`spikes/replicad-kernel/` 是浏览器内核的实测代码，不属于网站。它的依赖没有提交进仓库，需要自己 `npm install`：

- replicad：MIT。
- replicad-opencascadejs：LGPL-2.1。
