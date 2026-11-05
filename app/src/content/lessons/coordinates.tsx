import * as React from "react"
import { CircleCheck, CircleDashed, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { CoordinatesScene, type CoordState, type Up } from "./coordinates.scene"
import type { LessonDef } from "./types"

/** 0.1.1 · 0.1.2 「坐标系与视图」: axes, the right-hand rule, navigation, standard views, Z-up vs Y-up. */

function Checklist({ items }: { items: [string, boolean][] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-body">
      {items.map(([text, done]) => (
        <li key={text} className={cn("flex items-center gap-2", done ? "text-foreground" : "text-muted-foreground")}>
          {done ? <CircleCheck className="size-4 text-success" /> : <CircleDashed className="size-4 text-faint-foreground" />}
          {text}
        </li>
      ))}
    </ul>
  )
}

const AXES = [
  { name: "X", line: "stroke-axis-x", text: "fill-axis-x" },
  { name: "Y", line: "stroke-axis-y", text: "fill-axis-y" },
  { name: "Z", line: "stroke-axis-z", text: "fill-axis-z" },
]

/**
 * The lesson's own axis triad, replacing the viewer's (which always shows
 * the site's Z-up world). It follows the model frame, so in Y-up mode the
 * corner indicator agrees with the big arrows.
 */
function ModelTriad({ c }: { c: CoordinatesScene }) {
  const lines = React.useRef<(SVGLineElement | null)[]>([])
  const labels = React.useRef<(SVGTextElement | null)[]>([])
  React.useEffect(
    () =>
      c.onCamera(() => {
        c.screenAxes().forEach((p, i) => {
          lines.current[i]?.setAttribute("x2", String(28 + p.x * 18))
          lines.current[i]?.setAttribute("y2", String(28 + p.y * 18))
          labels.current[i]?.setAttribute("x", String(28 + p.x * 25))
          labels.current[i]?.setAttribute("y", String(28 + p.y * 25 + 4))
        })
      }),
    [c],
  )
  return (
    <svg viewBox="0 0 56 56" className="pointer-events-none absolute bottom-3 left-3 size-14 rounded-md bg-scene" aria-hidden>
      {AXES.map((a, i) => (
        <g key={a.name}>
          <line
            ref={(el) => {
              lines.current[i] = el
            }}
            x1="28"
            y1="28"
            x2="28"
            y2="28"
            className={a.line}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            ref={(el) => {
              labels.current[i] = el
            }}
            textAnchor="middle"
            className={cn("text-caption font-semibold", a.text)}
          >
            {a.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

const UP_OPTIONS: { value: Up; label: string }[] = [
  { value: "z", label: "Z 朝上" },
  { value: "y", label: "Y 朝上" },
]

const lesson: LessonDef<CoordState, CoordinatesScene> = {
  id: "coordinates",
  codes: ["0.1.1", "0.1.2"],
  title: "坐标系与视图",
  create: (v, emit) => new CoordinatesScene(v, emit),
  steps: [
    {
      title: "三根轴与右手定则",
      body: (
        <>
          <p>每个零件都有自己的坐标系：一个原点，三根互相垂直的轴。几乎所有 CAD 软件都用同一套颜色：X 红、Y 绿、Z 蓝。</p>
          <p>三根轴的方向不是随便定的，遵守右手定则：右手拇指指向 X，食指指向 Y，中指自然伸出的方向就是 Z。</p>
        </>
      ),
      task: { label: "比一下右手，点出 Z 轴的正方向", done: (s) => s.zFound },
      extra: ({ s }) =>
        s.wrongZ && !s.zFound ? <Hint tone="warning">这边是 −Z。拇指朝红色的 X，食指朝绿色的 Y，中指朝哪边？</Hint> : s.zFound ? <Hint>对。Z = X × Y，这三根轴构成一个右手坐标系。</Hint> : null,
    },
    {
      title: "转、移、缩放",
      body: (
        <>
          <p>看 3D 模型只有三个动作：旋转（绕着看的中心转）、平移（把中心挪开）、缩放（拉近拉远）。</p>
          <p>在这里：左键拖动旋转，右键拖动平移，滚轮缩放。转乱了，点视图方块下面的小房子回到等轴测。</p>
        </>
      ),
      task: { label: "转一下、平移一下、缩放一下，再点小房子回到等轴测", done: (s) => s.orbited && s.panned && s.zoomed && s.backToIso },
      extra: ({ s }) => (
        <Checklist
          items={[
            ["旋转", s.orbited],
            ["平移", s.panned],
            ["缩放", s.zoomed],
            ["回到等轴测", s.backToIso],
          ]}
        />
      ),
      note: "每个软件的鼠标习惯不同：SOLIDWORKS 中键拖动旋转、Ctrl + 中键平移；Fusion 中键平移、Shift + 中键旋转；Onshape 右键拖动旋转、中键平移。滚轮都是缩放。",
    },
    {
      title: "标准视图",
      body: (
        <>
          <p>转来转去容易迷路。右上角的视图方块把常用方向固定下来：前、后、左、右、上、下六个正视图，加上等轴测。点方块的一个面，相机就转到正对那一面的方向。</p>
          <p>视图的名字说的是「站在哪边看」：右视图，就是站在 +X 那一侧往回看。</p>
        </>
      ),
      task: { label: "用视图方块转到右视图", done: (s) => s.atRight },
      extra: ({ c }) => (
        <Predict
          question="相机放在 +X 方向、朝原点看过去，看到的是哪个视图？"
          options={["前视图", "右视图", "左视图"]}
          answer={1}
          explain="从 +X 往 −X 看就是右视图。看到的是所有朝 +X 的面：底板的右端面，和立板朝里的那一面。"
          onReveal={() => c.view("right")}
        />
      ),
    },
    {
      title: "用视图找面",
      body: (
        <>
          <p>零件上有一个盲孔，开在某一个面上，从等轴测看不到。</p>
          <p>每个正视图都正对一组朝向相同的面：前视图正对朝 −Y 的面，右视图正对朝 +X 的面。换几个视图，把孔找出来。</p>
          <p>视图方块只露出朝着你的几面。想点「左」或「后」，先把画面转过去一点。</p>
        </>
      ),
      task: { label: "找到带孔的那个面，在视图里点它", done: (s) => s.foundHole },
      extra: ({ s, c }) => (
        <>
          {s.wrongFace && !s.foundHole && <Hint tone="warning">这个面朝 {s.wrongFace}，上面没有孔。换个方向看看。</Hint>}
          {s.foundHole && <Hint>找到了。这个面朝 −X，只有左视图能正对它。在前视图和上视图里，这个孔被挡住，工程图上要画成虚线。</Hint>}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.view("iso")}>
            回到等轴测
          </Button>
        </>
      ),
    },
    {
      title: "Z 朝上，还是 Y 朝上",
      body: (
        <>
          <p>零件放在桌上，「上」是哪根轴，各家软件的约定不同。Onshape、Fusion、Rhino、NX、build123d 默认 Z 朝上；SOLIDWORKS 默认 Y 朝上。</p>
          <p>切换看看：零件没动，坐标轴转了 90°。水平的那块「上视基准面」从 XY 变成了 XZ。</p>
        </>
      ),
      task: { label: "切到 Y 朝上，再用视图方块看一次「上」", done: (s) => s.triedY && s.topInY },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented size="sm" aria-label="向上轴" value={s.up} onValueChange={(u) => c.setUp(u)} options={UP_OPTIONS} />
            <Button size="sm" variant="secondary" onClick={() => c.view("top")}>
              <Eye />
              看上视
            </Button>
          </div>
          {s.topInY && <Hint>Y 朝上时，从上往下看到的是 XZ 平面。教程说「在上视基准面上画草图」，换一个软件，可能是另一对轴。</Hint>}
        </>
      ),
      note: "Fusion 新建设计默认 Z 朝上，可以在首选项「常规 › 默认建模方向」里改成 Y 朝上，只影响之后新建的设计。早期的 Fusion 默认 Y 朝上，跟老教程做时先对一下。导入别的软件的模型时，零件如果「躺倒」了，多半是两边的向上轴不一样。",
    },
  ],
  quiz: [
    {
      q: "X 轴朝右、Z 轴朝上，按右手定则，Y 轴朝哪？",
      options: ["朝屏幕外，指向你", "朝屏幕里，远离你", "朝下"],
      answer: 1,
      explain: "拇指朝右（X）、中指朝上（Z），食指就指向屏幕里面。这正是 Z 朝上软件的前视图：Y 轴指向远处。",
    },
    {
      q: "在 SOLIDWORKS 里新建零件，水平的「上视基准面」是哪个平面？",
      options: ["XY 平面", "XZ 平面", "YZ 平面"],
      answer: 1,
      explain: "SOLIDWORKS 默认 Y 轴朝上，水平面是 XZ，前视基准面才是 XY。在 Onshape 这类 Z 朝上的软件里，上视基准面是 XY。",
    },
    {
      q: "一个在 Onshape 里立着的零件，导进 SOLIDWORKS 后看起来「躺倒」了。最可能的原因是？",
      options: ["文件转换时损坏了", "两边的向上轴不同：原来朝上的 +Z，在 Y 朝上的软件里指向前方", "单位从毫米变成了英寸"],
      answer: 1,
      explain: "坐标值没变，变的是对「上」的约定。原来的 +Z 在 Y 朝上的软件里指向屏幕外，零件就像仰面躺下了。导入时选好向上轴，或者转 90° 摆正即可。",
    },
  ],
  takeaways: [
    "X 红、Y 绿、Z 蓝，三根轴的方向由右手定则决定",
    "视图名说的是从哪一侧看：右视图从 +X 往回看，正对朝 +X 的面",
    "Z 朝上还是 Y 朝上因软件而异，「上视基准面」可能是 XY，也可能是 XZ",
  ],
  next: { to: "/lesson/datum-planes", label: "基准面", text: "有了坐标系，再看建模的第一块参照。" },
  triad: false,
  overlay: ({ s, c }) => (
    <>
      {s.step === 4 && (
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          <SceneChip tone="primary">{s.up === "z" ? "Z 朝上 · Onshape、Fusion、NX" : "Y 朝上 · SOLIDWORKS 默认"}</SceneChip>
        </div>
      )}
      <ModelTriad c={c} />
    </>
  ),
}

export default lesson
