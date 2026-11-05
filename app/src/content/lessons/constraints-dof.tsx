import { PenLine, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { CONS_NAMES, ConstraintsDofScene, GEO, HEIGHT, WIDTH, type ConsId, type DofState, type Scheme } from "./constraints-dof.scene"
import type { LessonDef, StepCtx } from "./types"

/**
 * 1.1.2 · 1.1.3 「几何约束与自由度」: DOF counting, geometric vs dimensional
 * constraints, fully / over-defined, and design intent. The DOF, the
 * redundant and the conflicting constraints all come from FreeCAD's solver.
 */
type Ctx = StepCtx<DofState, ConstraintsDofScene>

const BUTTONS: Record<ConsId, string> = {
  h: "下边水平",
  v: "左边竖直",
  par: "上下平行",
  perp: "右边垂直",
  org: "重合原点",
  w: `宽 ${WIDTH}`,
  ht: `高 ${HEIGHT}`,
  eq: "左边 = 下边",
  topSame: `上边 ${WIDTH}`,
  topOther: `上边 ${WIDTH + 10}`,
}

function AddButtons({ s, c, ids, disabled }: Ctx & { ids: ConsId[]; disabled?: (id: ConsId) => boolean }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ids.map((id) => (
        <Button key={id} size="sm" variant="secondary" disabled={s.solver !== "ready" || s.cons.includes(id) || disabled?.(id)} onClick={() => c.add(id)}>
          {BUTTONS[id]}
        </Button>
      ))}
    </div>
  )
}

function SolverState({ s }: { s: DofState }) {
  if (s.solver === "loading") return <Hint>正在载入求解器…</Hint>
  if (s.solver === "failed") return <Hint tone="warning">求解器没有载入，刷新页面再试一次。</Hint>
  return null
}

function ConstraintList({ s, c }: Ctx) {
  return (
    <div className="mt-4 rounded-lg border p-1.5">
      <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">草图1 的约束</div>
      {s.cons.map((id) => {
        const bad = s.flagged.includes(id)
        return (
          <div key={id} className={cn("flex h-8 items-center gap-2 rounded-sm pl-2 text-small", bad && (s.status === "conflict" ? "bg-destructive-subtle text-destructive" : "bg-warning-subtle text-warning"))}>
            <span className="min-w-0 flex-1 truncate">{CONS_NAMES[id]}</span>
            <IconButton label="删除约束" size="icon-sm" onClick={() => c.remove(id)}>
              <X />
            </IconButton>
          </div>
        )
      })}
    </div>
  )
}

function OverHint({ s }: { s: DofState }) {
  if (s.status === "conflict")
    return (
      <Hint tone="warning">
        求解失败：标红的约束互相矛盾，草图没有解。删掉其中任意一条都能解开，但该删的通常是最后加的那条。SOLIDWORKS 把这种状态叫「过定义」，FreeCAD 叫「冲突约束」。
      </Hint>
    )
  if (s.status === "redundant")
    return (
      <Hint tone="warning">
        「上边 {WIDTH}」和已有约束说的是同一件事：形状没变，自由度还是 0，但这条是多余的（FreeCAD 叫「冗余约束」，SOLIDWORKS 同样报过定义）。以后改宽度，它就会变成冲突。删掉它。
      </Hint>
    )
  if (s.triedConflict && s.cons.includes("topOther") && s.dof === 0)
    return <Hint>草图又能解了，但形状变了：「上边 {WIDTH + 10}」留了下来，被删掉的那条不再起作用。删哪一条，决定留下哪个设计意图。</Hint>
  if (s.triedConflict && s.dof === 0) return <Hint>恢复完全定义：自由度 0，没有多余约束。</Hint>
  return null
}

const SCHEMES: { value: Scheme; label: string }[] = [
  { value: "corner", label: "角点定位" },
  { value: "sym", label: "关于原点对称" },
  { value: "ratio", label: "高随宽变" },
]

const SCHEME_TEXT: Record<Scheme, string> = {
  corner: "左下角用两个尺寸定在原点左下方 30、20 处，再标宽和高。改宽度，矩形只往右长，左边不动。适合左边要贴着别的零件的情况。",
  sym: "对角两点关于原点对称，再标宽和高。改宽度，左右各长一半，中心一直在原点。对称零件这样画，后面镜像、装配都以原点为基准。",
  ratio: "角点和宽度同第一种，但高不标数值，用方程绑在宽上：高 = 宽 × 2/3。改宽度，往右、往上一起长，比例不变。软件里叫「方程式」或「用户参数」。",
}

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="h-0.5 w-5 rounded-full bg-primary" />
      <span>蓝色：欠定义，还能动</span>
      <span className="h-0.5 w-5 rounded-full bg-foreground" />
      <span>黑色：完全定义，自由度为 0</span>
      <span className="h-2 w-5 rounded-xs bg-destructive" />
      <span>红色标签：互相冲突的约束</span>
    </div>
  )
}

const lesson: LessonDef<DofState, ConstraintsDofScene> = {
  id: "constraints-dof",
  codes: ["1.1.2", "1.1.3"],
  title: "几何约束与自由度",
  create: (v, emit) => new ConstraintsDofScene(v, emit),
  steps: [
    {
      title: "自由度：草图还能怎么动",
      body: (
        <>
          <p>草图里的每个点，在平面上能横着动、竖着动：2 个自由度。这个四边形有 4 个角点，一共 8 个自由度。</p>
          <p>左上角的数字不是写死的，是 FreeCAD 的草图求解器 planegcs 实时算出来的。</p>
        </>
      ),
      task: { label: "拖动一个蓝色角点，把四边形改个样子", done: (s) => s.draggedOn.includes(0) },
      extra: ({ s }) => (
        <>
          <SolverState s={s} />
          {s.solver === "ready" && s.loadMs != null && (
            <div className="mt-3">
              <Readout label="求解器载入" value={s.loadMs} unit="ms" />
            </div>
          )}
          <Predict
            question="一条两端都没有约束的线段，有几个自由度？"
            options={["2 个：它只能平移", "3 个：位置加角度", "4 个：两个端点各 2 个"]}
            answer={2}
            explain="线段由两个端点决定，每个 2 个，共 4 个；换个说法是位置 2 个、角度 1 个、长度 1 个。4 条互不相连的线有 16 个自由度，首尾相连的 4 处「重合」各消掉 2 个，所以这里剩 8 个。"
          />
        </>
      ),
      terms: ["sketch"],
    },
    {
      title: "几何约束：先定关系",
      body: (
        <>
          <p>几何约束描述的是关系：水平、竖直、平行、垂直。它们不带任何数值。</p>
          <p>每加一条，求解器就把形状挪到满足它的位置，自由度减 1。</p>
        </>
      ),
      task: { label: "把下面 4 条约束都加上", done: (s) => GEO.every((id) => s.cons.includes(id)) },
      extra: (ctx) => (
        <>
          <SolverState s={ctx.s} />
          <AddButtons {...ctx} ids={GEO} />
          {GEO.every((id) => ctx.s.cons.includes(id)) && (
            <Hint>现在它一定是矩形，但还能整体移动、改宽改高：剩下的 4 个自由度是位置 2 个、大小 2 个。拖一下角点看看。</Hint>
          )}
        </>
      ),
      note: "画矩形时，软件通常会自动加上水平、竖直这类约束。这里一条条手动加，是为了看清每条各消掉 1 个自由度。",
    },
    {
      title: "定位：挂到原点",
      body: (
        <>
          <p>位置也要约束。把左下角「重合」到原点，横向、纵向 2 个自由度一起消掉。</p>
          <p>原点是固定的，草图从此有了锚点。</p>
        </>
      ),
      task: { label: "添加「重合到原点」，再拖一下右上角", done: (s) => s.cons.includes("org") && s.draggedOn.includes(2) },
      extra: (ctx) => (
        <>
          <AddButtons {...ctx} ids={["org"]} />
          {ctx.s.cons.includes("org") && <Hint>左下角拖不动了，它钉在原点上。其他角点还能动，但只能改宽和高。</Hint>}
        </>
      ),
      note: "没挂到原点或其他已有几何上的草图，永远是欠定义：在 SOLIDWORKS 里一直是蓝色，改模型时它可能被拖跑。",
    },
    {
      title: "尺寸：定大小",
      body: (
        <>
          <p>剩下 2 个自由度：宽和高。尺寸约束给出具体数值。</p>
          <p>最后一个不一定非用尺寸：「相等」也行，它让左边等于下边。自由度到 0，线条变黑，草图完全定义。</p>
        </>
      ),
      task: { label: "让自由度变成 0", done: (s) => s.dof === 0 && s.status === "ok" && s.cons.includes("w") },
      extra: (ctx) => {
        const { s } = ctx
        const defined = s.dof === 0 && s.status === "ok"
        return (
          <>
            <AddButtons {...ctx} ids={["w", "ht", "eq"]} disabled={(id) => (id === "ht" && s.cons.includes("eq")) || (id === "eq" && s.cons.includes("ht")) || (defined && !s.cons.includes(id))} />
            {defined && (
              <Hint>
                {s.cons.includes("eq") ? "用「相等」代替了高度尺寸，得到一个正方形。" : ""}
                {s.locked ? "完全定义的草图拖不动：形状只由约束和尺寸决定。想改大小，就改尺寸。" : "试着拖一下角点。"}
              </Hint>
            )}
            <Legend />
          </>
        )
      },
    },
    {
      title: "过定义：多一条就矛盾",
      body: (
        <>
          <p>草图已经完全定义，再加约束就是「过定义」。它分两种：</p>
          <p>多余的：和已有约束说的是同一件事。冲突的：和已有约束互相矛盾，无解。</p>
        </>
      ),
      task: { label: `先加「上边 ${WIDTH + 10}」看冲突，再删掉一条，让草图恢复完全定义`, done: (s) => s.triedConflict && s.status === "ok" && s.dof === 0 },
      extra: (ctx) => (
        <>
          <Predict
            question={`草图已经完全定义，再加一个「上边 = ${WIDTH + 10}」，会怎样？`}
            options={[`上边变成 ${WIDTH + 10}，下边也跟着变成 ${WIDTH + 10}`, "求解失败：软件报过定义，列出互相冲突的约束", `上边 ${WIDTH + 10}、下边 ${WIDTH}，变成梯形`]}
            answer={1}
            explain={`下边已经是 ${WIDTH}，上边又必须和它平行、两侧竖直垂直，上边只能是 ${WIDTH}。${WIDTH + 10} 和这些约束矛盾，求解器解不出来，就把卷进冲突的约束全部列出来。`}
            onReveal={() => ctx.c.add("topOther")}
          />
          <AddButtons {...ctx} ids={["topSame", "topOther"]} />
          <OverHint s={ctx.s} />
          <ConstraintList {...ctx} />
        </>
      ),
    },
    {
      title: "设计意图：一个形状，三种约束",
      body: (
        <>
          <p>下面三种方案画出来都是 60 × 40 的矩形，自由度都是 0。区别出在改尺寸的时候：形状往哪边长，取决于你约束了什么。</p>
        </>
      ),
      task: { label: "在三种方案下各改一次宽度", done: (s) => s.tried.length === 3 },
      extra: ({ s, c }) => (
        <>
          <Segmented className="mt-3" size="sm" value={s.scheme} onValueChange={(v) => c.setScheme(v)} options={SCHEMES} aria-label="约束方案" />
          <p className="mt-3 text-body">{SCHEME_TEXT[s.scheme]}</p>
          <ParamSlider className="mt-3 px-0" label="宽度" value={s.width} min={40} max={100} onChange={(v) => c.setWidth(v)} hint="虚线是改之前的矩形。" />
          <div className="mt-2 text-small text-muted-foreground">已试：{s.tried.length ? s.tried.map((t) => SCHEMES.find((x) => x.value === t)?.label).join("、") : "无"}</div>
        </>
      ),
      note: "三种都对，选哪种取决于这个尺寸改的时候你希望哪里不动。把这个想清楚再加约束，就是「设计意图」。",
    },
  ],
  quiz: [
    {
      q: "一个没有任何约束的圆，有几个自由度？",
      options: ["2 个：圆心的位置", "3 个：圆心横向、纵向，加半径", "4 个：和线段一样"],
      answer: 1,
      explain: "圆由圆心和半径决定：圆心 2 个，半径 1 个。只记圆心会漏掉大小；线段的 4 个来自两个端点，圆没有第二个点。",
    },
    {
      q: "草图自由度已经是 0，又加了一个和现有约束完全一致的尺寸，会怎样？",
      options: ["没有影响，多加更保险", "过定义：这条约束是冗余的，应该删掉", "自由度变成 −1，形状被拉坏"],
      answer: 1,
      explain: "冗余约束不改变形状，但软件会报过定义（FreeCAD 叫冗余约束）。以后改其中一个尺寸，它们就会互相冲突。完全定义的标准是自由度 0 且没有多余约束。",
    },
    {
      q: "一块对称的面板，宽度以后经常要改，而且希望它始终居中。草图怎么约束最好？",
      options: ["左下角重合到原点，标宽和高", "关于原点对称，标宽和高", "先不加约束，要改的时候拖一下"],
      answer: 1,
      explain: "对称约束让宽度变化平均分到两边，中心一直在原点。角点定位的方案改宽度时只往一边长；不加约束的草图拖完就没有确定的形状，下游特征也跟着不可靠。",
    },
  ],
  takeaways: [
    "自由度就是草图还能怎么动：点 2 个、线段 4 个、圆 3 个，每条约束消掉一部分",
    "几何约束管关系，尺寸约束管数值；自由度为 0 且没有多余约束，才算完全定义",
    "过定义分冗余和冲突；同一个形状有多种约束方案，按「改的时候哪里不动」来选",
  ],
  next: { to: "/lesson/sketch-to-solid", label: "从草图到实体", text: "把完全定义的草图拉伸成实体，再改一个尺寸看下游怎么跟着变。" },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      <SceneChip>
        <PenLine className="text-primary" />
        草图1 · 上视基准面 XY
      </SceneChip>
      <DofChip s={s} />
    </div>
  ),
}

function DofChip({ s }: { s: DofState }) {
  if (s.solver === "loading") return <SceneChip className="text-muted-foreground">求解器载入中</SceneChip>
  if (s.solver === "failed") return <SceneChip className="text-destructive">求解器没载入</SceneChip>
  if (s.status === "conflict") return <SceneChip className="text-destructive">过定义 · 冲突</SceneChip>
  if (s.status === "redundant") return <SceneChip className="text-warning">过定义 · 冗余</SceneChip>
  if (s.dof === 0) return <SceneChip>完全定义</SceneChip>
  return <SceneChip tone="primary">自由度 {s.dof}</SceneChip>
}

export default lesson
