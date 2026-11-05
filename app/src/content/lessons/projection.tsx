import { Layers, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { ProjectionScene, viewName, type Angle, type ProjState } from "./projection.scene"
import type { LessonDef } from "./types"

/** 0.2.1 · 0.2.2 「正投影」: glass box, hidden lines, unfolding, first vs third angle. */

const ANGLE_OPTIONS: { value: Angle; label: string }[] = [
  { value: "first", label: "第一角 · GB" },
  { value: "third", label: "第三角 · ASME" },
]

/**
 * The projection symbol: a truncated cone (small end on the left) and its
 * end view seen from the small end. First angle puts the circles on the
 * right of the cone, third angle on the left.
 */
function ProjectionSymbol({ angle }: { angle: Angle }) {
  const cone = (x: number) => `${x},9 ${x + 20},4 ${x + 20},24 ${x},19`
  const coneX = angle === "first" ? 4 : 34
  const cx = angle === "first" ? 46 : 14
  return (
    <svg viewBox="0 0 60 28" className="h-10 w-20 text-foreground" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <polygon points={cone(coneX)} strokeLinejoin="round" />
      <circle cx={cx} cy="14" r="10" />
      <circle cx={cx} cy="14" r="5" />
      <g strokeWidth="0.6" strokeDasharray="5 1.5 1 1.5">
        <line x1="1" y1="14" x2="59" y2="14" />
        <line x1={cx} y1="1" x2={cx} y2="27" />
      </g>
    </svg>
  )
}

function Symbols({ angle }: { angle: Angle }) {
  const items: { a: Angle; title: string; text: string }[] = [
    { a: "first", title: "第一角画法", text: "圆在右，圆台小头背着圆。GB 国标优先。" },
    { a: "third", title: "第三角画法", text: "圆在左，圆台小头朝着圆。ASME、多数英文教程。" },
  ]
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {items.map((it) => (
        <div key={it.a} className={cn("rounded-lg border p-2.5 transition-colors duration-(--duration-fast)", angle === it.a && "border-primary bg-selected")}>
          <ProjectionSymbol angle={it.a} />
          <div className="mt-1.5 text-small font-medium">{it.title}</div>
          <div className="text-caption text-muted-foreground">{it.text}</div>
        </div>
      ))}
    </div>
  )
}

const lesson: LessonDef<ProjState, ProjectionScene> = {
  id: "projection",
  codes: ["0.2.1", "0.2.2"],
  title: "正投影：三视图与第一角、第三角",
  create: (v, emit) => new ProjectionScene(v, emit),
  steps: [
    {
      title: "玻璃盒里的零件",
      body: (
        <>
          <p>工程图用正投影：一束互相平行的投射线垂直打在投影面上，把零件「压扁」成一张平面图。每个视图只能反映三个方向里的两个。</p>
          <p>把零件放进一个盒子，盒子的面就是投影面。国标用第一角画法：零件在你和投影面之间，轮廓投到它后面、下面和右侧的三块面上。</p>
        </>
      ),
      task: { label: "点「投影」，看棱线怎么压到三个面上", done: (s) => s.projected },
      extra: ({ s, c }) => (
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.projected} onClick={() => c.project()}>
          <Layers />
          投影
        </Button>
      ),
    },
    {
      title: "看不见的线画虚线",
      body: (
        <>
          <p>投影时，被挡住的轮廓也要画出来，只是改用细虚线；看得见的轮廓用粗实线。这样一张图就能交代零件背后和内部的形状。</p>
          <p>底板上有一个竖直的通孔，从前面看，它被底板挡住了。</p>
        </>
      ),
      task: { label: "先猜，再看主视图里的孔", done: (s) => s.xray },
      extra: ({ c }) => (
        <Predict
          question="底板上的通孔，在主视图里画成什么样？"
          options={["一个圆", "两条竖直的虚线", "不画，因为看不见"]}
          answer={1}
          explain="从前面看，孔被底板挡住。孔壁最左和最右的两条轮廓线投到主视图上，是两条竖直的细虚线；只有俯视图正对着孔，画成圆。"
          onReveal={() => c.xray()}
        />
      ),
    },
    {
      title: "把盒子摊平",
      body: (
        <>
          <p>三块投影面不在同一个平面上，没法画在一张纸上。于是把它们摊平：正对你的主视图不动，另外两块绕着和它相交的那条棱翻转 90°。</p>
        </>
      ),
      task: { label: "把盒子完全展开", done: (s) => s.unfold >= 1 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="按国标的第一角画法展开，俯视图会落在主视图的哪一边？"
            options={["上方", "下方", "右边"]}
            answer={1}
            explain="第一角画法里，俯视图投在零件下方的那块面上。这块面向下翻平，俯视图就落在主视图正下方；右边那块面上是左视图。"
            onReveal={() => c.unfoldTo(1)}
          />
          <ParamSlider className="mt-4 px-0" label="展开" unit="%" value={Math.round(s.unfold * 100)} min={0} max={100} onChange={(v) => c.setUnfold(v / 100)} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.unfoldTo(1)}>
            <Play />
            播放展开
          </Button>
        </>
      ),
    },
    {
      title: "长对正、高平齐、宽相等",
      body: (
        <>
          <p>展开后，三个视图之间有固定的对应关系：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>主视图和俯视图长对正：左右对齐。</li>
            <li>主视图和左视图高平齐：上下对齐。</li>
            <li>俯视图和左视图宽相等：前后方向的尺寸一样，借 45° 线转过去。</li>
          </ul>
          <p>画图、读图都靠这九个字。</p>
        </>
      ),
      task: { label: "拖动孔的位置，看哪几个视图跟着变", done: (s) => s.holeMoved },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="把孔往右移，三个视图里哪一个不变？"
            options={["主视图", "俯视图", "左视图"]}
            answer={2}
            explain="孔左右移动只改变它的 X 坐标。左视图顺着 X 方向看，看不出左右位置；主视图和俯视图都反映长度，所以一起变，这就是长对正。"
            onReveal={() => c.setHoleX(22)}
          />
          <ParamSlider className="mt-4 px-0" label="孔的 X 位置" value={s.holeX} min={-10} max={22} onChange={(v) => c.setHoleX(v)} />
        </>
      ),
    },
    {
      title: "第一角与第三角",
      body: (
        <>
          <p>国标 GB/T 4458.1 规定优先用第一角画法。美国的 ASME 标准用第三角画法：投影面在你和零件之间，像隔着玻璃往里看，俯视图画在主视图上方，右视图画在右边。很多英文教程默认第三角。</p>
          <p>两种画法里每个视图本身一样，只是摆放位置不同。所以图纸上要画一个投影符号，告诉读图的人用的是哪种。</p>
        </>
      ),
      task: { label: "切换到第三角，看视图怎么换位置", done: (s) => s.triedThird },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3">
            <Segmented size="sm" aria-label="投影画法" value={s.angle} onValueChange={(a) => c.setAngle(a)} options={ANGLE_OPTIONS} />
          </div>
          <Symbols angle={s.angle} />
        </>
      ),
      note: "SOLIDWORKS 在图纸属性里设置投影类型（第一视角或第三视角），国内企业的工程图模板一般设为第一视角。拿到外企图纸，先看投影符号。",
    },
    {
      title: "认出俯视图",
      body: (
        <>
          <p>拿到一张图，先看投影符号，再判断每个视图是从哪边看的。视图名字先藏起来了。</p>
        </>
      ),
      task: { label: "在展开的视图里点出俯视图", done: (s) => s.foundTop },
      extra: ({ s }) => (
        <>
          {s.clicked && !s.foundTop && (
            <Hint tone="warning">
              这是{viewName(s.angle, s.clicked)}。{s.angle === "first" ? "第一角画法里，俯视图在主视图下方。" : "第三角画法里，俯视图在主视图上方。"}
            </Hint>
          )}
          {s.foundTop && <Hint>对。它和主视图左右对齐（长对正），反映零件的长和宽，孔在这里画成圆。</Hint>}
          <div className="mt-3 flex items-center gap-3 text-small text-muted-foreground">
            <ProjectionSymbol angle={s.angle} />
            这张图的投影符号
          </div>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: "按国标（第一角画法）布置三视图，左视图放在主视图的哪一边？",
      options: ["左边", "右边", "下方"],
      answer: 1,
      explain: "从左往右看到的图，投在零件右侧那块面上，展开后在主视图右边。别和第三角混淆：第三角是右视图放在右边。",
    },
    {
      q: "图纸角上的投影符号是：两个同心圆在左，圆台在右。这张图用的是？",
      options: ["第一角画法", "第三角画法", "看不出来"],
      answer: 1,
      explain: "第三角符号里圆在左、圆台在右，圆台小头朝着圆；第一角的符号正好左右对调。",
    },
    {
      q: "主视图和俯视图之间应该满足哪个关系？",
      options: ["高平齐", "长对正", "宽相等"],
      answer: 1,
      explain: "主视图和俯视图都反映零件的长度，所以左右对齐，叫长对正。高平齐说的是主视图和左视图，宽相等说的是俯视图和左视图。",
    },
  ],
  takeaways: [
    "正投影沿平行的投射线把零件压扁：看得见的轮廓画粗实线，看不见的画细虚线",
    "三视图之间：长对正、高平齐、宽相等",
    "国标用第一角（俯视图在下、左视图在右），ASME 用第三角（俯视图在上、右视图在右），靠投影符号分辨",
  ],
  next: { to: "/lesson/section-views", label: "剖视", text: "孔和空腔在视图里只是虚线，切开来看才清楚。" },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip tone="primary">{s.angle === "first" ? "第一角画法 · GB" : "第三角画法 · ASME"}</SceneChip>
      {s.step >= 2 && <SceneChip>展开 {Math.round(s.unfold * 100)}%</SceneChip>}
    </div>
  ),
}

export default lesson
