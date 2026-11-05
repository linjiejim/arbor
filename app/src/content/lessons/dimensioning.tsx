import { CircleCheck, CircleDashed, Play, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { analyse, candText, complete, DimensioningScene, has, MAG, stackUp, TOL, type DimState, type Issue, type Scheme } from "./dimensioning.scene"
import type { LessonDef } from "./types"

/** 3.1.3 「尺寸标注原则」: complete, no duplicates, no closed chains, chain vs baseline, the right view. */

const SCHEME_OPTIONS: { value: Scheme; label: string }[] = [
  { value: "chain", label: "链式标注" },
  { value: "base", label: "基准标注" },
]

/** What the checker found, one line per problem. */
function Issues({ s, c, kinds }: { s: DimState; c: DimensioningScene; kinds?: Issue["kind"][] }) {
  const an = analyse(s.dims, s.refs)
  const list = an.issues.filter((i) => !kinds || kinds.includes(i.kind))
  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-small font-medium">
        {an.clean ? <CircleCheck className="size-4 text-success" /> : <CircleDashed className="size-4 text-faint-foreground" />}
        <span className={cn(an.clean && "text-success")}>{an.clean ? "尺寸完整、清晰、不重复" : an.complete ? "尺寸齐了，但还有问题" : `还缺 ${an.missing} 个尺寸`}</span>
        <span className="ml-auto text-caption tabular text-muted-foreground">已标 {an.count} 个</span>
      </div>
      {list.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {list.map((i) => (
            <li key={i.kind + i.text} className={cn("flex gap-2 text-small", i.kind === "dup" || i.kind === "loop" ? "text-destructive" : i.kind === "bad" ? "text-warning" : "text-muted-foreground")}>
              {i.kind === "missing" ? <CircleDashed className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1">{i.text}</span>
              {i.kind === "loop" && (
                <Button size="sm" variant="ghost" className="-my-1 h-6 shrink-0 px-1.5 text-caption" onClick={() => c.makeRef(i.ids[i.ids.length - 1])}>
                  设为参考
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {s.note && <p className="mt-2 text-small text-muted-foreground">{s.note}</p>}
    </div>
  )
}

const lesson: LessonDef<DimState, DimensioningScene> = {
  id: "dimensioning",
  codes: ["3.1.3"],
  title: "尺寸标注原则",
  create: (v, emit) => new DimensioningScene(v, emit),
  triad: false,
  steps: [
    {
      title: "标全：每个特征都要定形、定位",
      body: (
        <>
          <p>图纸是给车间加工、给质检测量的。每个特征都要有两类尺寸：定形尺寸说它多大，定位尺寸说它在哪。少一个，零件就做不出来。</p>
          <p>定位要有起点，叫尺寸基准。这个零件长度方向以左端面为基准，高度方向以底面为基准，宽度方向以前后对称面为基准。</p>
          <p>点视图里的边、圆或中心线，就在那个视图里加一个尺寸；再点一次删掉。</p>
        </>
      ),
      task: { label: "把缺的尺寸补齐，直到显示「完整」", done: (s) => complete(s, "dup", "loop") },
      extra: ({ s, c }) => (
        <>
          <Issues s={s} c={c} />
          <Hint>孔要两个尺寸：在俯视图里点圆周标孔径，点圆心标位置。两个孔一样大，标一次「2×Ø10」就够。</Hint>
        </>
      ),
      note: "GB/T 4458.4—2003 第 3 章：尺寸以 mm 为单位时不注单位；所注尺寸是零件最后完工的尺寸；每个尺寸一般只标一次，标在反映该结构最清晰的图形上。",
      noteTitle: "国标",
    },
    {
      title: "不重复：一个尺寸只标一次",
      body: (
        <>
          <p>总长 80 在主视图标了，俯视图里又标了一遍；总高 30 在主视图和左视图各一个。数值一样，看起来没毛病。</p>
          <p>可图纸会改。设计改成 85 时，只要漏改一处，两处就对不上，车间不知道该信哪个。国标要求每个尺寸一般只标一次。</p>
        </>
      ),
      task: { label: "找出重复的尺寸，各删掉一个", done: (s) => complete(s, "dup") },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="同一个尺寸在两个视图里都标出来，最大的风险是？"
            options={["看图的人会嫌啰嗦", "改图时只改了一处，两处数值就矛盾了", "违反了长对正"]}
            answer={1}
            explain="重复尺寸本身数值没错，错在以后。两处要一起维护，漏改一处，图纸就自相矛盾。删掉哪一个？留在最能看清这个结构的视图里。"
          />
          <Issues s={s} c={c} kinds={["dup", "missing"]} />
        </>
      ),
    },
    {
      title: "封闭尺寸链",
      body: (
        <>
          <p>台阶长 30、右段长 50、总长 80，三个尺寸在长度方向首尾相接，围成一圈。这叫封闭尺寸链。</p>
          <p>每个尺寸都有公差。30 和 50 各做到 +0.1，总长就是 80.2，超出了 80 ± 0.1 的要求。三个尺寸不可能同时保证。</p>
          <p>正确做法是空出一环：删掉最不重要的那个，让它的误差随别的尺寸走；要给车间看，就把它写成带括号的参考尺寸，参考尺寸不带公差、不检验。</p>
        </>
      ),
      task: { label: "断开封闭链：删掉一环，或把它设为参考尺寸", done: (s) => complete(s, "loop") },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="30 ± 0.1 和 50 ± 0.1 都合格时，总长可能是多少？"
            options={["79.9 到 80.1", "79.8 到 80.2", "正好 80"]}
            answer={1}
            explain="两段的误差会叠加：都做到上限是 80.2，都做到下限是 79.8。总长再要求 ±0.1，就和这两个尺寸冲突了。"
          />
          <Issues s={s} c={c} kinds={["loop", "missing"]} />
        </>
      ),
    },
    {
      title: "链式与基准：误差会不会累积",
      body: (
        <>
          <p>孔的位置有两种标法。链式标注：一个接一个，台阶 30、到孔 1 是 15、孔距 20、到右端 15。基准标注：每个尺寸都从左端面量起。</p>
          <p>每个尺寸都是 ±{TOL}。下面的条带把每个特征相对左端面的最大误差放大 {MAG} 倍画出来。</p>
        </>
      ),
      task: { label: "两种标注各播放一次，对比误差条", done: (s) => s.playedChain && s.playedBase },
      extra: ({ s, c }) => {
        const e = stackUp(s.scheme)
        return (
          <>
            <Predict
              question="链式标注下，右端面相对左端面最多差多少？"
              options={["±0.1", "±0.2", "±0.4"]}
              answer={2}
              explain="从左端面走到右端面要经过 4 个尺寸，每个 ±0.1，最坏情况全都偏向一边，累积到 ±0.4。"
              onReveal={() => c.playStack()}
            />
            <div className="mt-4 flex items-center gap-2">
              <Segmented size="sm" aria-label="标注方式" value={s.scheme} onValueChange={(v) => c.setScheme(v)} options={SCHEME_OPTIONS} />
              <Button size="sm" variant="secondary" onClick={() => c.playStack()}>
                <Play />
                播放累积
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-small">
              <div className="rounded-md bg-sunken px-3 py-2">
                <div className="text-muted-foreground">右端面的误差</div>
                <div className="font-mono text-body font-medium tabular">±{e.x1.toFixed(1)}</div>
              </div>
              <div className="rounded-md bg-sunken px-3 py-2">
                <div className="text-muted-foreground">两孔孔距的误差</div>
                <div className="font-mono text-body font-medium tabular">±{s.scheme === "chain" ? TOL.toFixed(1) : (2 * TOL).toFixed(1)}</div>
              </div>
            </div>
            {s.playedChain && s.playedBase && (
              <Hint>
                基准标注误差不累积，但两孔的孔距由 45 和 65 相减得到，误差反而是 ±0.2；链式标注直接给出孔距 20，孔距只差 ±0.1。哪个尺寸关系到装配，就直接标哪个：孔要对上另一个零件的两根销，就直接标孔距。
              </Hint>
            )}
          </>
        )
      },
    },
    {
      title: "标在最能看清的视图上",
      body: (
        <>
          <p>这张图尺寸是齐的，可好几个标错了地方：孔径和孔的位置标在主视图的虚线上，底板厚度标在左视图的虚线上。</p>
          <p>按国标，尺寸标在反映该结构最清晰的图形上：孔径标在投影为圆的视图上，台阶高度标在能看见台阶的主视图上。虚线只表示看不见的轮廓，尽量不在上面标尺寸。</p>
        </>
      ),
      task: { label: "把标错视图的尺寸挪到正确的视图（先删掉，再到对的视图里点）", done: (s) => analyse(s.dims, s.refs).clean },
      extra: ({ s, c }) => <Issues s={s} c={c} />,
      note: "同一方向的几个尺寸，小的靠里、大的靠外，尺寸线和尺寸界线就不会交叉；同一个特征的尺寸尽量集中在一个视图里，读图时不用来回找。",
      noteTitle: "制图惯例",
    },
  ],
  quiz: [
    {
      q: "总长 80 在主视图和俯视图里各标了一次，数值也一样。问题在哪？",
      options: ["没有问题，看图更方便", "重复标注：以后改图容易只改一处，两处数值对不上", "违反了长对正"],
      answer: 1,
      explain: "GB/T 4458.4 规定每个尺寸一般只标一次。重复的尺寸现在一样，改图时却要同时维护两处，漏一处图纸就自相矛盾。",
    },
    {
      q: "台阶长 30、右段长 50、总长 80 都标上，并且都要求 ±0.1。会怎样？",
      options: ["更完整，加工更有依据", "形成封闭尺寸链，三个公差互相矛盾，必须空出一环或标成参考尺寸", "只是多余，不影响加工和检验"],
      answer: 1,
      explain: "30 和 50 都合格时总长在 79.8 到 80.2 之间，和 80 ± 0.1 冲突。空出最不重要的一环，或者写成参考尺寸 (80)，不带公差也不检验。",
    },
    {
      q: "两个孔要和另一个零件上的两根定位销配合，孔距最关键。孔的位置怎么标最好？",
      options: ["两个孔都从左端面标（基准标注）", "标一个孔到左端面的距离，再直接标出孔距", "尺寸齐全就行，怎么标都一样"],
      answer: 1,
      explain: "从左端面分别标两个孔，孔距是两个尺寸相减，误差 ±0.2；直接标孔距只有 ±0.1。功能上要紧的尺寸应直接标出，不要让它由别的尺寸间接算出来。",
    },
  ],
  takeaways: [
    "每个特征都要定形、定位，尺寸齐全才能加工；每个尺寸只标一次，标在最能看清该结构的视图上，尽量不标在虚线上",
    "同一方向的尺寸不能首尾相接围成封闭链：空出一环，或把它标成带括号的参考尺寸",
    "基准标注误差不累积，链式标注误差逐环累加；关系到装配的功能尺寸要直接标出",
  ],
  next: { to: "/lesson/tolerance-fits", label: "尺寸公差与配合", text: "±0.1 只是最简单的写法，孔和轴配在一起时公差怎么定。" },
  overlay: ({ s }) => {
    const an = analyse(s.dims, s.refs)
    const status = !an.complete ? `缺 ${an.missing} 个` : has(an, "dup") ? "有重复" : has(an, "loop") ? "封闭尺寸链" : has(an, "bad") ? "有尺寸标错视图" : "完整"
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip>第一角画法 · 单位 mm</SceneChip>
        <SceneChip tone={an.clean ? undefined : "primary"} className={cn((has(an, "dup") || has(an, "loop")) && "text-destructive", an.clean && "text-success")}>
          尺寸 {an.count} 个 · {status}
        </SceneChip>
        {s.refs.length > 0 && <SceneChip>参考尺寸 {s.refs.map((r) => `(${candText(r)})`).join(" ")}</SceneChip>}
      </div>
    )
  },
}

export default lesson
