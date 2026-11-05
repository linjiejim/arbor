import * as React from "react"
import { Crosshair, PenLine, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict } from "@/components/lesson-ui"
import { DatumPlanesScene, PLANE_NAMES, type DatumState, type PlaneId } from "./datum-planes.scene"
import type { LessonDef } from "./types"

/** 0.1.3 「基准面」: default planes, offset, angle, mid-plane, and a sketch that follows its datum. */

const PLANE_TEXT: Record<PlaneId, string> = {
  XY: "水平的那块。零件的底面轮廓、俯视形状常画在这里。",
  XZ: "竖直，正对前方。零件的正面轮廓、回转体的半截面常画在这里。",
  YZ: "竖直，朝向右侧。零件的侧面轮廓画在这里。",
}

type Row = { icon: React.ReactNode; name: string; value?: string; depth?: number; current?: boolean }

function DatumTree({ s }: { s: DatumState }) {
  const rows: Row[] = [
    { icon: <Crosshair />, name: "原点" },
    { icon: <Square />, name: "上视基准面", current: s.step === 0 && s.lastClicked === "XY" },
    { icon: <Square />, name: "前视基准面", current: s.step === 0 && s.lastClicked === "XZ" },
    { icon: <Square />, name: "右视基准面", current: s.step === 0 && s.lastClicked === "YZ" },
  ]
  if (s.step >= 1) rows.push({ icon: <Square />, name: "基准面1", value: `${s.offset}`, current: s.step === 1 })
  if (s.step >= 2) rows.push({ icon: <PenLine />, name: "草图1", depth: 1, current: s.step === 2 })
  if (s.step >= 3) rows.push({ icon: <Square />, name: "基准面2", value: `${s.angle}°`, current: s.step === 3 })
  if (s.step >= 4 && s.picked.length === 2) rows.push({ icon: <Square />, name: "基准面3", value: "中面", current: true })
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-48 rounded-lg border bg-popover p-1.5 shadow-popover">
      <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">特征树</div>
      {rows.map((r) => (
        <div
          key={r.name}
          className={cn("flex h-7 items-center gap-2 rounded-sm px-2 text-small [&_svg]:size-3.5 [&_svg]:text-muted-foreground", r.current && "bg-selected")}
          style={{ paddingLeft: 8 + (r.depth ?? 0) * 14 }}
        >
          {r.icon}
          {r.name}
          {r.value && <span className="ml-auto font-mono text-caption tabular text-faint-foreground">{r.value}</span>}
        </div>
      ))}
    </div>
  )
}

const lesson: LessonDef<DatumState, DatumPlanesScene> = {
  id: "datum-planes",
  codes: ["0.1.3"],
  title: "基准面：一切几何的参照",
  create: (v, emit) => new DatumPlanesScene(v, emit),
  steps: [
    {
      title: "三个默认基准面",
      body: (
        <>
          <p>新建一个零件，软件先给你一个原点和三个互相垂直的基准面。它们其实是无限大的平面，只是画成了方块。</p>
          <p>后面所有的草图和特征，追根溯源都挂在它们上面。它们删不掉，也不会因为改模型而移动，是最稳的参照。</p>
        </>
      ),
      task: { label: "在视图里把三个基准面各点一下", done: (s) => s.clicked.length === 3 },
      extra: ({ s }) =>
        s.lastClicked ? (
          <Hint>
            <span className="font-medium">
              {PLANE_NAMES[s.lastClicked]} {s.lastClicked}：
            </span>
            {PLANE_TEXT[s.lastClicked]}
          </Hint>
        ) : null,
      note: "SOLIDWORKS 默认 Y 轴朝上，它的上视基准面是 XZ、前视基准面是 XY。名字相同，对应的轴不同。",
      terms: ["plane"],
    },
    {
      title: "偏移：平行挪一段距离",
      body: (
        <>
          <p>最常用的新基准面是偏移基准面：和参考面平行，隔开一段距离。比如要在离底面 30 mm 高的地方画一个截面。</p>
          <p>拖动左下角的蓝点，把基准面1 从上视基准面往上推。尺寸随时显示它离参考面多远。</p>
        </>
      ),
      task: { label: "把基准面1 推到离上视基准面 30 mm", done: (s) => s.offsetDragged && s.offset === 30 },
      extra: ({ s, c }) => <ParamSlider className="mt-3 px-0" label="偏移距离" value={s.offset} min={5} max={80} onChange={(v) => c.setOffset(v)} />,
      terms: ["plane"],
    },
    {
      title: "草图跟着基准面走",
      body: (
        <>
          <p>在基准面1 上画了一个圆，叫草图1。草图记住的是「我画在基准面1 上」，不是「我在某个高度」。</p>
        </>
      ),
      task: { label: "改一次基准面1 的偏移距离", done: (s) => s.sketchMoved },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="把基准面1 再往上移 20 mm，草图1 会怎样？"
            options={["留在原来的高度", "跟着基准面1 一起上移 20 mm", "报错，需要重画草图"]}
            answer={1}
            explain="草图引用的是基准面1。参照动了，草图跟着动，用这个草图做的特征也会跟着重算。"
            onReveal={() => c.moveOffsetBy(20)}
          />
          <ParamSlider className="mt-4 px-0" label="基准面1 · 偏移" value={s.offset} min={5} max={80} onChange={(v) => c.setOffset(v)} />
        </>
      ),
      noteTitle: "设计意图",
      note: "草图也能直接画在模型表面上。但表面可能在后面的修改里被切掉、分成两块，草图就丢了参照，软件会报「参照丢失」。关键的草图挂在基准面上，模型怎么改都找得到。",
      terms: ["plane", "sketch"],
    },
    {
      title: "角度：绕一根轴转",
      body: (
        <>
          <p>斜面上的孔、倾斜的筋，需要一个斜着的基准面。做法是选一根轴（或一条直边），再给出和参考面的夹角。</p>
          <p>这里的基准面2 过 X 轴，和上视基准面成一个角度。拖动蓝点，或者直接输入角度。</p>
        </>
      ),
      task: { label: "把基准面2 调到 30°", done: (s) => s.angleTouched && s.angle === 30 },
      extra: ({ s, c }) => <ParamSlider className="mt-3 px-0" label="与上视基准面的夹角" unit="°" value={s.angle} min={0} max={90} onChange={(v) => c.setAngle(v)} />,
      terms: ["plane"],
    },
    {
      title: "中面：两个面的正中间",
      body: (
        <>
          <p>左右对称的零件，最好有一个永远在正中间的平面，镜像和对称约束都以它为参照。</p>
          <p>选两个平行的面，软件就在它们正中间建一个中面。之后零件变宽变窄，中面始终居中。</p>
        </>
      ),
      task: { label: "点选方块左右两个端面生成中面，再改一次宽度", done: (s) => s.picked.length === 2 && s.widthChanged },
      extra: ({ s, c }) =>
        s.picked.length < 2 ? (
          <Hint>{s.picked.length === 0 ? "先点方块的一个端面（朝 −X 或 +X 的那面）。" : "视图转过来了，再点另一个端面。"}</Hint>
        ) : (
          <>
            <ParamSlider className="mt-3 px-0" label="方块宽度" value={s.width} min={30} max={90} onChange={(v) => c.setWidth(v)} />
            {s.widthChanged && <Hint>宽度变了，中面两侧仍然各占一半。用固定距离偏移出来的平面做不到这一点。</Hint>}
          </>
        ),
      terms: ["plane", "mirror"],
    },
  ],
  quiz: [
    {
      q: "为什么关键的草图最好画在基准面上，而不是模型表面上？",
      options: ["基准面上画得更快", "模型表面可能在后面的修改中消失或被分开，草图会丢参照；基准面更稳定", "模型表面上不能画草图"],
      answer: 1,
      explain: "表面是特征算出来的结果，上游一改就可能变。基准面只依赖原点和你给的尺寸，改模型时最不容易出问题。",
    },
    {
      q: "基准面1 偏移上视基准面 30 mm，草图1 画在它上面。把偏移改成 50 mm，草图1 在哪？",
      options: ["还在 30 mm 处", "在 50 mm 处", "被删除了"],
      answer: 1,
      explain: "草图引用基准面，基准面移到 50 mm，草图跟着到 50 mm。",
    },
    {
      q: "一个左右对称的零件，宽度以后还会改。镜像特征最好以什么为镜像面？",
      options: ["零件的左端面", "两个端面之间的中面", "从右视基准面偏移 30 mm 的平面"],
      answer: 1,
      explain: "中面始终在正中间，宽度怎么改都对称。固定偏移的平面在宽度改变后就不居中了；以端面为镜像面，会把特征镜像到零件外面去。",
    },
  ],
  takeaways: ["原点和三个默认基准面是最稳的参照", "新基准面的三种常见建法：偏移、过轴成角度、两面中间", "草图挂在基准面上：基准面一动，草图和后续特征跟着动"],
  next: { to: "/lesson/projection", label: "正投影与三视图", text: "三维的零件怎么画成二维的图纸。" },
  overlay: ({ s }) => <DatumTree s={s} />,
}

export default lesson
