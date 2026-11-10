# 理念动画「每个数字都有着落」

27 秒，1920×1080。不还原界面，讲三件事：你在需求里说的每个数字，先落到零件上变成尺寸，再落进核对表由内核量一遍；说不清改哪里时，点那个面留一条备注；改掉一个数，它会告诉你。

成片在 [`docs/media/`](../media)：`turnery-intro-en.mp4`、`turnery-intro-zh.mp4`，以及 README 用的 `turnery-intro-en.gif`、`turnery-intro-zh.gif`。

## 分镜

| 秒 | 画面 | 承接到下一段的东西 |
| --- | --- | --- |
| 0–3.4 | 一句需求被打出来，里面的数字是蓝色的；手点发送 | 需求卡片 |
| 3.4–4.4 | 卡片升到顶部变成一条 | 卡片和上面的数字 |
| 4.5–8.6 | 左边特征树一行行长出来，中间零件一步步成形：草图、拉伸、挖内腔、螺丝柱、上盖、孔、散热槽 | 零件 |
| 8.7–11.1 | 80、50、28 从句子里飞到零件上，各自画出尺寸线；再飞进右边核对表，第一项打勾 | 这三个数字 |
| 11.2–14.5 | 上盖掀开，壁的上沿变蓝；2 和 4 × M3 落到壁和孔上，再进核对表，3/3 | 这两个数字 |
| 14.6–15.3 | 停住 | — |
| 15.3–19.2 | 手点前壁，落下一枚图钉，旁边写下「这里开个 USB-C 口」；备注飞进特征树，多出一行 `cut · USB-C 口`，壁上开出口，图钉变成绿色的勾 | 手 |
| 19.4–23.0 | 手把壁厚从 2.00 拖到 3.00：壁变厚、变红，核对表那一项变成 ✗「实测 3.00」；拖回去，变绿 | 手和滑块 |
| 23.6–27 | 上盖合上，两侧收起，零件留在画面左边，右边落下 Turnery 和一句话 | 零件 |

零件是 three.js 里按参数实时生成的几何（壁厚真的在变），不是贴图；数字、特征树和核对表是 DOM；尺寸线画在 canvas 上。所有量都是时间的纯函数，任意一帧可以单独求。

## 文件

| 文件 | 内容 |
| --- | --- |
| `comp.html`、`comp.js` | 合成。中英文是同一份，`comp.js` 开头的 `STR` 是全部文案 |
| `look.json` | 配色和字体：取自产品的亮色主题，强调色是工程蓝 |
| `sfx_score.py` | 音效：木、玻璃、气流、低频几种材质，放在同一个混响里 |

## 重新渲染

合成依赖 [onetake](https://github.com/feitangyuan) 的动效库和渲染脚本。onetake 是 PolyForm Noncommercial 许可，不能随本仓库分发，所以这里没有 `motion.js`，要自己装好再拷进来：

```bash
cd docs/film
cp <onetake>/lib/motion.js .
<repo>/desktop/node_modules/.bin/esbuild <repo>/app/node_modules/three/build/three.module.js \
  --bundle --format=iife --global-name=THREE --minify --outfile=three.iife.js
python3 <onetake>/scripts/look.py apply look.json comp.html --text-from comp.js --cjk <repo>/app/src/studio/fonts/text-sc.ttf
python3 sfx_score.py
python3 <onetake>/scripts/render.py comp.html --out turnery-intro-en.mp4 --sfx sfx.wav
```

中文版：把 `comp.html` 拷成 `comp.zh.html`，在加载 `comp.js` 之前加一行 `<script>window.LANG='zh'</script>`，再渲染一次。预览：浏览器打开 `comp.html?play`，或 `comp.html?t=17.4` 看某一帧。

`motion.js`、`three.iife.js`、`look.js`、`sfx.wav` 和渲染产物都在这个文件夹的 `.gitignore` 里。
