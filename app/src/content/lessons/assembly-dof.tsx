import { Link2, Trash2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { AssemblyScene, derive, DOFS, type AsmState } from "./assembly-dof.scene"
import type { LessonDef, StepDef } from "./types"

/** 2.1.2 · 2.1.3 · 2.1.4 「零件的 6 个自由度与配合」. */

const STEPS: StepDef<AsmState, AssemblyScene>[] = [
  {
    title: "自由的零件有 6 个自由度",
    body: (
      <>
        <p>装配里的零件，在没有任何配合之前，可以沿 X、Y、Z 三个方向移动，也可以绕这三根轴转动。一共 6 个自由度。</p>
        <p>底座是固定的：装配里总要有一个零件钉在原地，作为其他零件的参照。摆臂还是自由的，每个箭头代表它的一个自由度，可以直接拖。</p>
      </>
    ),
    task: { label: "拖动两个不同的箭头：一个移动，一个转动", done: (s) => s.used.some((d) => d[0] === "t") && s.used.some((d) => d[0] === "r") },
    note: "SOLIDWORKS 里第一个放进装配体的零件默认「固定」，树里名字前有 (f)；Fusion 叫「固定」（Ground）；Onshape 也叫「固定」（Fix）。",
    noteTitle: "各软件",
  },
  {
    title: "同心：轴对轴",
    body: (
      <>
        <p>配合描述两个零件之间的几何关系。「同心」让摆臂销的轴线和底座孔的轴线重合。</p>
        <p>先猜一猜它会去掉几个自由度。</p>
      </>
    ),
    task: { label: "加上同心配合，再沿 Z 方向拖一下摆臂", done: (s) => s.concentric && s.slid },
    extra: ({ s, c }) => (
      <>
        <Predict
          question="只加一个同心配合，摆臂还剩几个自由度？"
          options={["0 个，已经装好了", "1 个，只能转", "2 个，能沿轴滑，也能绕轴转", "4 个"]}
          answer={2}
          explain="两条轴线重合，就不能横向移动、也不能歪斜，去掉了 4 个；但沿着轴滑动和绕着轴转动都还在。"
          onReveal={() => c.addConcentric()}
        />
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.concentric} onClick={() => c.addConcentric()}>
          <Link2 />
          添加同心配合
        </Button>
        {s.concentric && <Hint>剩下的两个箭头就是剩下的自由度。拖蓝色直箭头，摆臂只会沿轴上下滑。</Hint>}
      </>
    ),
  },
  {
    title: "重合：面贴面",
    body: (
      <>
        <p>再加一个「重合」：摆臂底面贴到底座顶面上。面贴面本来能去掉 3 个自由度（1 个移动、2 个转动），其中两个转动已经被同心去掉了，这次只新去掉沿 Z 的滑动。</p>
        <p>剩下 1 个：绕销转动。这就是铰链。</p>
      </>
    ),
    task: { label: "加上重合配合，再拖转动箭头，让摆臂转过 45° 以上", done: (s) => s.coincident && s.turned >= 45 },
    extra: ({ s, c }) => (
      <>
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.coincident} onClick={() => c.addCoincident()}>
          <Link2 />
          添加重合配合
        </Button>
        {s.coincident && <Hint>怎么拖它都只会绕销转：剩下的运动必须满足所有配合。转过 {Math.round(s.turned)}°。</Hint>}
      </>
    ),
    note: "Fusion 用「联接」一次给出运动类型：旋转联接（Revolute）就等于这里的同心加重合。Onshape 的配合也按运动类型分，比如 Revolute。SOLIDWORKS 是一个个加基本配合，也有现成的「铰链」配合。",
    noteTitle: "各软件",
  },
  {
    title: "锁住最后一个自由度",
    body: (
      <>
        <p>想让摆臂停在某个角度，就再加一个「角度」配合：摆臂侧面和底座前面成 40°。自由度变成 0，零件「完全定义」，箭头都没了。</p>
        <p>角度配合的数值可以改，摆臂会被它带着转。机构仿真里，驱动就是这样改出来的。</p>
      </>
    ),
    task: { label: "加上角度配合，再改一次角度", done: (s) => s.angleMate && s.angle !== 40 },
    extra: ({ s, c }) => (
      <>
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.angleMate} onClick={() => c.addAngle()}>
          <Link2 />
          添加角度配合
        </Button>
        {s.angleMate && <ParamSlider className="mt-3 px-0" label="角度1" unit="°" value={s.angle} min={0} max={180} step={5} onChange={(v) => c.setAngle(v)} />}
      </>
    ),
    note: "只想把零件整个钉死、不关心关系时，可以用 SOLIDWORKS 的「锁定」配合或 Fusion 的「刚性」联接，一次去掉全部 6 个。但这样就没有设计意图了：改了底座，它不会跟着走。",
    noteTitle: "锁定",
  },
  {
    title: "多一个配合，反而出错",
    body: (
      <>
        <p>零件已经完全定义，再加配合只会和已有的配合「抢」同一个自由度。比如加一个「平行：摆臂侧面 ∥ 底座前面」，它和角度配合管的都是绕销转动。</p>
        <p>两个配合说法不一样时就冲突，叫过定义；说法碰巧一样时叫冗余，现在不报错，改个尺寸就会出事。</p>
      </>
    ),
    task: { label: "加一个平行配合，再把多余的那个删掉", done: (s) => s.triedParallel && !s.parallel },
    extra: ({ s, c }) => {
      const d = derive(s)
      return (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={s.parallel} onClick={() => c.setParallel(true)}>
              <Link2 />
              添加平行配合
            </Button>
            {s.parallel && (
              <Button size="sm" variant="secondary" onClick={() => c.setParallel(false)}>
                <Trash2 />
                删除平行配合
              </Button>
            )}
            {d.conflict && (
              <Button size="sm" variant="secondary" onClick={() => c.setAngle(0)}>
                角度改成 0°
              </Button>
            )}
          </div>
          {d.conflict && <Hint tone="warning">过定义：角度1 要 {s.angle}°，平行1 要 0°，两者不可能同时满足。虚影是平行配合想要的位置。SOLIDWORKS 会把冲突的配合标红并提示过定义。</Hint>}
          {d.redundant && <Hint tone="warning">现在两个配合碰巧一致，看起来没事，但它们是冗余的：有的软件直接报过定义，有的能解但留下隐患，下次把角度改成 30°，马上冲突。</Hint>}
          {s.triedParallel && !s.parallel && <Hint>删掉多余的配合，问题就没了。完全定义只是状态，正确定义才是目标（SOLIDWORKS 官方博客）。</Hint>}
        </>
      )
    },
    note: "所以不要因为零件「还能动」就继续堆配合。先想清楚它应该怎么动，用最少的配合表达这个运动。",
    noteTitle: "习惯",
  },
]

const QUIZ = [
  {
    q: "一个销和一个孔加了同心配合，销还剩哪些自由度？",
    options: ["什么都不剩", "沿轴滑动和绕轴转动", "只剩绕轴转动", "沿 X、Y、Z 移动"],
    answer: 1,
    explain: "同心去掉了横向移动和两种歪斜，共 4 个；沿轴滑和绕轴转还在。再加一个面重合，才只剩转动。",
  },
  {
    q: "零件已经完全定义，又加了一个和已有配合一致的配合，会怎样？",
    options: ["更稳固，配合越多越好", "形成冗余：现在可能不报错，但一改尺寸就容易过定义", "软件会自动删掉它"],
    answer: 1,
    explain: "冗余配合和已有配合抢同一个自由度。数值碰巧一致时能解，一旦尺寸或角度变化就互相冲突。",
  },
  {
    q: "想让摆臂能绕销转动，最合适的配合组合是？",
    options: ["同心 + 重合", "同心 + 重合 + 平行", "锁定"],
    answer: 0,
    explain: "同心加重合正好留下绕轴转动这 1 个自由度，也就是铰链；Fusion 里一个旋转联接就够了。再加平行会把转动也锁住，锁定则全部锁死。",
  },
]

function DofPanel({ s }: { s: AsmState }) {
  const d = derive(s)
  const mates = [
    s.concentric && { name: "同心1", what: "销轴 ↔ 孔轴" },
    s.coincident && { name: "重合1", what: "摆臂底面 ↔ 底座顶面" },
    s.angleMate && { name: "角度1", what: `${s.angle}°`, bad: d.conflict },
    s.parallel && { name: "平行1", what: "摆臂侧面 ∥ 底座前面", bad: d.conflict, warn: d.redundant },
  ].filter(Boolean) as { name: string; what: string; bad?: boolean; warn?: boolean }[]
  const status = d.conflict ? "过定义" : d.free.length === 0 ? "完全定义" : `自由度 ${d.free.length}`
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-60 space-y-2">
      <SceneChip tone={d.free.length > 0 && !d.conflict ? "primary" : undefined} className={cn("w-fit", d.conflict && "text-destructive")}>
        {d.conflict && <TriangleAlert />}
        摆臂 · {status}
      </SceneChip>
      <div className="rounded-lg border bg-popover p-1.5 shadow-popover">
        <div className="grid grid-cols-3 gap-1">
          {DOFS.map((x) => {
            const free = d.free.includes(x.id)
            return (
              <span
                key={x.id}
                className={cn("rounded-sm px-1.5 py-0.5 text-center text-caption", free ? "bg-selected text-foreground" : "text-faint-foreground line-through")}
              >
                {x.name}
              </span>
            )
          })}
        </div>
        <div className="mt-1.5 border-t px-1 pt-1.5 text-caption text-faint-foreground">配合</div>
        {mates.length === 0 && <div className="px-1 pb-0.5 text-small text-muted-foreground">还没有</div>}
        {mates.map((m) => (
          <div key={m.name} className={cn("flex items-baseline gap-2 px-1 py-0.5 text-small", m.bad && "text-destructive", m.warn && "text-warning")}>
            <span className="shrink-0 font-medium">{m.name}</span>
            <span className={cn("truncate text-caption", !m.bad && !m.warn && "text-muted-foreground")}>{m.what}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const lesson: LessonDef<AsmState, AssemblyScene> = {
  id: "assembly-dof",
  codes: ["2.1.2", "2.1.3", "2.1.4"],
  title: "零件的 6 个自由度与配合",
  create: (v, emit) => new AssemblyScene(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: [
    "自由的刚体有 6 个自由度：3 个移动、3 个转动；装配里要有一个零件固定",
    "每个配合去掉一些自由度：同心去掉 4 个，面重合去掉 3 个，重叠的部分不重复计算",
    "先想好零件该怎么动，用最少的配合表达它；冗余配合迟早变成过定义",
  ],
  overlay: ({ s }) => <DofPanel s={s} />,
}

export default lesson
