import * as React from "react"
import { Box, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict } from "@/components/lesson-ui"
import { PLANE_NAMES, SketchToSolid, type LessonState } from "./sketch-to-solid.scene"
import type { LessonDef, StepDef } from "./types"

/**
 * 1.1.3 · 1.2.1 「从草图到实体」: plane → sketch → constraints → dimensions →
 * extrude → options → change a parameter. The parametric loop in one lesson.
 */
const STEPS: StepDef<LessonState, SketchToSolid>[] = [
  {
    title: "先选一个平面",
    body: (
      <>
        <p>建模从「画在哪儿」开始。每个零件都自带一个原点和三个互相垂直的基准面，后面所有的几何都以它们为参照。</p>
        <p>这里用 Z 轴朝上的约定（Onshape、Rhino、NX 都这样），所以水平的那块是上视基准面 XY。</p>
      </>
    ),
    task: { label: "在视图里点选「上视基准面 XY」", done: (s) => s.plane === "XY" },
    extra: ({ s }) =>
      s.wrongPlane ? (
        <Hint tone="warning">
          这是{PLANE_NAMES[s.wrongPlane]} {s.wrongPlane}。我们要在水平的那块上画。
        </Hint>
      ) : null,
    note: "SOLIDWORKS 默认 Y 轴朝上，它的「上视基准面」其实是 XZ。换软件时，先看清哪根轴朝上。",
    terms: ["plane"],
  },
  {
    title: "正对草图平面",
    body: (
      <>
        <p>在平面上开始草图后，视图会转过来正对它（SOLIDWORKS 叫「正视于」，Fusion 叫 Look At）。草图里画的都是 2D 线条。</p>
        <p>看 3D 的时候可以随便转，但回到草图时，最好正对着画。</p>
      </>
    ),
    task: {
      label: "拖动画面转开一点，再点右上角视图方块的「上」回到正对",
      done: (s) => s.backToTop,
    },
    extra: ({ s }) => (s.orbited && !s.backToTop ? <Hint>好，现在点视图方块上的「上」。</Hint> : null),
    terms: ["sketch"],
  },
  {
    title: "画一个矩形",
    body: (
      <>
        <p>矩形由 4 条线组成。软件会自动给它加上「水平」「竖直」约束，所以它始终是个矩形。</p>
        <p>但它的位置和大小还没定：还剩 4 个自由度，横向位置、纵向位置、宽、高。蓝色就表示「还能动」。</p>
      </>
    ),
    task: { label: "拖动右上角的蓝点", done: (s) => s.dragged },
    terms: ["sketch"],
  },
  {
    title: "用约束固定位置",
    body: (
      <>
        <p>约束描述的是几何之间的关系，不是具体数值。给矩形加一条「关于原点对称」，它的中心就钉在原点上了。</p>
        <p>自由度从 4 降到 2，只剩宽和高。</p>
      </>
    ),
    task: { label: "给矩形添加「关于原点对称」", done: (s) => s.symmetric },
    extra: ({ s, c }) => (
      <div className="mt-3 flex flex-col items-start gap-2">
        <Button variant="secondary" disabled={s.symmetric} onClick={() => c.addSymmetric()}>
          添加对称约束
        </Button>
        {s.symmetric && <Hint>再拖一下角点：现在它只能绕着原点对称地缩放。</Hint>}
      </div>
    ),
  },
  {
    title: "用尺寸确定大小",
    body: (
      <>
        <p>尺寸把剩下的自由度一个个钉死。加上宽和高，自由度变成 0，线条变黑：草图「完全定义」。</p>
        <p>尺寸数字可以直接点开改，形状会跟着变。</p>
      </>
    ),
    task: { label: "加上宽度和高度两个尺寸", done: (s) => s.dimW && s.dimH },
    extra: ({ s, c }) => (
      <>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={s.dimW} onClick={() => c.addDim("w")}>
            添加宽度尺寸
          </Button>
          <Button variant="secondary" disabled={s.dimH} onClick={() => c.addDim("h")}>
            添加高度尺寸
          </Button>
        </div>
        {s.locked && <Hint>完全定义的草图拖不动：形状只由尺寸决定。想改大小，就改尺寸。</Hint>}
        <Legend />
      </>
    ),
  },
  {
    title: "拉伸成实体",
    body: (
      <>
        <p>退出草图，用「拉伸」把轮廓沿着平面的法向推出厚度。</p>
        <p>拖动蓝色箭头，或者直接输入深度。高亮的面，就是这一步新长出来的。</p>
      </>
    ),
    task: { label: "把深度拉到 20 mm", done: (s) => s.extruded && s.depth === 20 },
    extra: ({ s, c }) => (
      <ParamSlider className="mt-3 px-0" label="深度" value={s.depth} min={0} max={80} onChange={(v) => c.setDepth(v)} />
    ),
    terms: ["extrude"],
  },
  {
    title: "拉伸的选项",
    body: <p>同一个轮廓，换个选项，长出来的实体就不一样。先猜，再看。</p>,
    task: { label: "试一下「两侧对称」和拔模角", done: (s) => s.triedSymmetric && s.triedDraft },
    extra: ({ s, c }) => (
      <>
        <Predict
          question="方向改成「两侧对称」、深度还是 20，实体会怎样？"
          options={["向上、向下各长 20，总高 40", "上下各长 10，总高还是 20", "只向下长 20"]}
          answer={1}
          explain="对称拉伸以草图平面为中面，总深度不变，两边各占一半。对称零件这样建，中面正好落在基准面上，后面镜像、装配都更省事。"
          onReveal={() => c.setMode("symmetric")}
        />
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-small font-medium">方向</span>
            <Segmented
              size="sm"
              value={s.mode}
              onValueChange={(m) => c.setMode(m)}
              options={[
                { value: "one", label: "单向" },
                { value: "symmetric", label: "两侧对称" },
              ]}
            />
          </div>
          <ParamSlider className="px-0" label="拔模角" unit="°" value={s.draft} min={0} max={15} step={0.5} onChange={(v) => c.setDraft(v)} hint="侧壁带一点斜度，注塑件才能从模具里脱出来。" />
        </div>
      </>
    ),
    terms: ["extrude", "draft"],
  },
  {
    title: "改一个尺寸，下游跟着变",
    body: (
      <>
        <p>左上角的特征树里，拉伸1 挂在草图1 下面：拉伸用的是草图的轮廓。这叫父子关系。</p>
      </>
    ),
    task: { label: "改一次草图1 的宽度", done: (s) => s.widthChanged },
    extra: ({ s, c }) => (
      <>
        <WidthPredict width={Math.round(s.rect.x1 - s.rect.x0)} onReveal={(w) => c.setSize("w", w)} />
        <ParamSlider
          className="mt-4 px-0"
          label="草图1 · 宽度"
          value={Math.round(s.rect.x1 - s.rect.x0)}
          min={20}
          max={110}
          onChange={(v) => c.setSize("w", v)}
        />
      </>
    ),
  },
  {
    title: "小测",
    body: <p>三道题，答完就完成本课。</p>,
  },
]

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="h-0.5 w-5 rounded-full bg-primary" />
      <span>蓝色：欠定义，还能动</span>
      <span className="h-0.5 w-5 rounded-full bg-foreground" />
      <span>黑色：完全定义，自由度为 0</span>
      <span className="h-0.5 w-5 rounded-full bg-destructive" />
      <span>红色：过定义，约束互相冲突（SOLIDWORKS 的配色）</span>
    </div>
  )
}

function WidthPredict({ width, onReveal }: { width: number; onReveal: (w: number) => void }) {
  const [[from, to]] = React.useState(() => [width, width >= 90 ? 60 : 90] as const)
  return (
    <Predict
      question={`把草图1 的宽度从 ${from} 改成 ${to}，拉伸1 会怎样？`}
      options={["不变，需要重新拉伸一次", "自动变宽，深度和选项保持不变", "报错，因为拉伸已经做完了"]}
      answer={1}
      explain="改父特征，子特征按原来的规则重新计算：轮廓跟着变，深度、方向、拔模角照旧。这就是「参数化」。"
      onReveal={() => onReveal(to)}
    />
  )
}

const QUIZ = [
  {
    q: "一个没有任何约束的圆，有几个自由度？",
    options: ["2 个", "3 个", "4 个"],
    answer: 1,
    explain: "圆心的横向、纵向位置，加上半径，一共 3 个。",
  },
  {
    q: "草图线条从蓝色变成黑色，说明什么？",
    options: ["它被选中了", "它完全定义了", "它出错了"],
    answer: 1,
    explain: "黑色表示自由度为 0：形状完全由约束和尺寸决定，拖不动。",
  },
  {
    q: "下面哪个顺序是对的？",
    options: ["画草图 → 选基准面 → 拉伸 → 加尺寸", "选基准面 → 画草图 → 加约束和尺寸 → 拉伸", "拉伸 → 画草图 → 加尺寸 → 选基准面"],
    answer: 1,
    explain: "先有参照，再有轮廓；轮廓定义清楚了，再长成实体。",
  },
]

function SceneBadges({ s }: { s: LessonState }) {
  if (s.step >= 1 && s.step <= 4) {
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <div className="flex h-7 items-center gap-1.5 rounded-md border bg-popover px-2 text-small shadow-popover">
          <PenLine className="size-3.5 text-primary" />
          草图1 · {PLANE_NAMES.XY} XY
        </div>
        {s.drawn && s.step >= 2 && (
          <div
            className={cn(
              "flex h-7 items-center gap-1 rounded-md border bg-popover px-2 text-small tabular shadow-popover",
              s.dof === 0 ? "text-foreground" : "text-primary",
            )}
          >
            {s.dof === 0 ? "完全定义" : `自由度 ${s.dof}`}
          </div>
        )}
      </div>
    )
  }
  if (s.step >= 5) {
    const rows = [
      { icon: <PenLine />, name: "草图1", current: false },
      { icon: <Box />, name: "拉伸1", current: s.step === 5 || s.step === 6 },
    ]
    return (
      <div className="pointer-events-none absolute left-3 top-3 w-44 rounded-lg border bg-popover p-1.5 shadow-popover">
        <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">特征树</div>
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn("flex h-7 items-center gap-2 rounded-sm px-2 text-small [&_svg]:size-3.5 [&_svg]:text-muted-foreground", r.current && "bg-selected")}
            style={{ paddingLeft: 8 + i * 12 }}
          >
            {r.icon}
            {r.name}
            {i === 1 && <span className="ml-auto font-mono text-caption tabular text-faint-foreground">{s.depth}</span>}
          </div>
        ))}
      </div>
    )
  }
  return null
}

const lesson: LessonDef<LessonState, SketchToSolid> = {
  id: "sketch-to-solid",
  codes: ["1.1.1", "1.1.3", "1.2.1"],
  title: "从草图到实体",
  create: (v, emit) => new SketchToSolid(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: ["基准面是参照，草图画在平面上", "约束管关系，尺寸管大小，自由度为 0 才算完全定义", "特征引用草图：改上游，下游自动重算"],
  next: { to: "/teardown/mug", label: "马克杯拆解", text: "同样的思路，换成旋转、抽壳和扫掠。" },
  overlay: ({ s }) => <SceneBadges s={s} />,
}

export default lesson
