import { EyeOff, RotateCcw, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { OpIcon } from "@/components/op-icon"
import { Hint, Predict, Readout } from "@/components/lesson-ui"
import { C, HOLE, R } from "./feature-tree.model"
import { DEFAULT_DEPTH, derive, FEATURES, FeatureTreeScene, type FtState } from "./feature-tree.scene"
import type { LessonDef, StepDef } from "./types"

/** 1.3.1 · 1.3.2 · 1.3.3 「特征树、父子关系与拓扑命名」. */

function Legend({ modified = true }: { modified?: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-primary" />
      <span>这个特征生成的面</span>
      {modified && (
        <>
          <span className="size-3 rounded-xs bg-scene-modified" />
          <span>这个特征改动过的面（被切、被裁短）</span>
        </>
      )}
    </div>
  )
}

const STEPS: StepDef<FtState, FeatureTreeScene>[] = [
  {
    title: "模型是一串特征",
    body: (
      <>
        <p>参数化模型不是一块「形状」，而是一串按顺序执行的操作：先拉伸出方块，再打孔，再倒圆角，最后倒角。左上角的特征树就是这串操作。</p>
        <p>每次改参数，软件都从上往下把这串操作重算一遍。所以特征树更像一段程序，模型是它的运行结果。</p>
      </>
    ),
    task: { label: "点特征树里的两个特征（或直接点模型上的面），看它们各自生成了哪些面", done: (s) => s.seen.length >= 2 },
    extra: () => <Legend />,
    terms: ["extrude", "hole", "fillet", "chamfer"],
  },
  {
    title: "回滚：倒回去看",
    body: (
      <>
        <p>回滚条把特征树「停」在某一行：它下面的特征暂时不算，模型回到当时的样子。特征没有被删除，拖回去就又回来了。</p>
        <p>回滚之后再加的新特征，会插在回滚条的位置，而不是树的最后。</p>
      </>
    ),
    task: { label: "把回滚条退到「孔1」，再拉回最后", done: (s) => s.triedRollback && s.upTo === 4 },
    extra: ({ s, c }) => (
      <>
        <div className="mt-4 space-y-2">
          <div className="text-small font-medium">回滚条停在</div>
          <Segmented
            size="sm"
            value={String(s.upTo)}
            onValueChange={(v) => c.rollTo(Number(v))}
            options={FEATURES.map((f, i) => ({ value: String(i + 1), label: f.name }))}
            aria-label="回滚条位置"
          />
        </div>
        <Hint>高亮的是回滚条上方最后一个特征：蓝色是它新生成的面，橙色是它改动过的面。也可以直接点特征树里的行。</Hint>
      </>
    ),
    note: "SOLIDWORKS 叫「退回控制棒」，在 FeatureManager 设计树底部；Fusion 拖动时间轴末端的标记；Onshape 拖动特征列表里的回滚条。",
  },
  {
    title: "父子关系：谁引用了谁",
    body: (
      <>
        <p>特征树右边的箭头是引用关系：孔1 画在拉伸1 的顶面上，圆角1 选了拉伸1 的一条边，倒角1 选的是圆角1 和右端面相交的那条圆弧边。被引用的是父，引用别人的是子。</p>
        <p>改动或删掉父特征，子特征就要重新找参考。找不到，就是重建错误。</p>
      </>
    ),
    task: { label: "压缩圆角1，看哪个特征出错", done: (s) => s.triedSuppress },
    extra: ({ s, c }) => (
      <>
        <Predict
          question="把圆角1 压缩掉（暂时不算），哪个特征会出错？"
          options={["孔1，它在圆角1 前面", "倒角1，它用的边是圆角1 生成的", "都不会，软件会自动处理"]}
          answer={1}
          explain="出错的只有引用了圆角1 的子特征。孔1 在圆角1 之前，只引用拉伸1，完全不受影响。"
          onReveal={() => c.suppressFillet(true)}
        />
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => c.suppressFillet(!s.filletSuppressed)}>
            {s.filletSuppressed ? <RotateCcw /> : <EyeOff />}
            {s.filletSuppressed ? "恢复圆角1" : "压缩圆角1"}
          </Button>
        </div>
        {s.filletSuppressed && (
          <Hint tone="warning">倒角1 要的那条圆弧边不存在了，它没法生成，在特征树里变红。SOLIDWORKS 会标出重建错误，Fusion 时间轴上的图标变红，Onshape 特征列表里的名字变红。</Hint>
        )}
      </>
    ),
    note: "压缩（Suppress）是暂时跳过一个特征，随时能恢复；删除才是真的去掉。想知道删一个特征会牵连谁，先压缩试试。",
    noteTitle: "压缩和删除",
  },
  {
    title: "拓扑命名：边换了名字",
    body: (
      <>
        <p>软件记住「倒角1 用的是哪条边」，靠的是给面和边起的内部名字，比如 Edge7。上游一变，模型重算，面和边可能被重新编号。</p>
        <p>这里孔1 是 {HOLE.depth} mm 深的盲孔。拉伸变薄到 {HOLE.depth} mm 以下，孔就打穿了底面，多出一圈新的边，后面的编号跟着变了。</p>
      </>
    ),
    task: { label: `把拉伸1 的深度改到 ${HOLE.depth} mm 以下`, done: (s) => s.depth <= HOLE.depth },
    extra: ({ s, c }) => (
      <>
        <Predict
          question="改了拉伸深度，倒角还在原来的边上吗？"
          options={["在，倒角跟着那条边走", "不一定：边被重新编号，倒角可能跳到别的边上", "倒角会被自动删掉"]}
          answer={1}
          explain="倒角记住的是编号 Edge7。重算之后 Edge7 指向了左端的边，倒角就做在了那里，而且不报错。这就是拓扑命名问题（TNP）。"
          onReveal={() => c.setDepth(16)}
        />
        <ParamSlider className="mt-3 px-0" label="拉伸1 · 深度" value={s.depth} min={12} max={40} onChange={(v) => c.setDepth(v)} hint={`孔1 深 ${HOLE.depth} mm，从顶面往下量。`} />
        {derive(s).wrongEdge && <Hint tone="warning">比报错更糟：倒角悄悄换了位置，模型看起来没问题。虚线是本来想倒的边。</Hint>}
      </>
    ),
    note: "这里用最朴素的方式演示：只按编号记边。FreeCAD 1.0 以前经常这样出错，1.0 加入了缓解算法但没有根治。SOLIDWORKS、Fusion、Onshape 的内部命名更稳，多数改动能跟住，但边被分割、合并或消失时，照样会丢参考或选错。",
    noteTitle: "各软件",
  },
  {
    title: "选更稳的参考",
    body: (
      <>
        <p>办法不是记住更多编号，而是让参考表达设计意图：「右端面和圆角面的交线」比「第 7 条边」稳得多，深度怎么改都指向同一条边。</p>
        <p>建模时的三条习惯：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>草图画在基准面上，少画在模型表面上。</li>
          <li>尺寸和位置参考原点、基准面和草图几何，少参考特征生成的边。</li>
          <li>圆角、倒角这类细节放在特征树最后，别让其他特征引用它们的边。</li>
        </ul>
      </>
    ),
    task: { label: "把倒角1 的参考换成「右端面 ∩ 圆角面」", done: (s) => s.refMode === "intent" && s.depth <= HOLE.depth },
    extra: ({ s, c }) => (
      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <div className="text-small font-medium">倒角1 的参考</div>
          <Segmented
            size="sm"
            value={s.refMode}
            onValueChange={(m) => c.setRefMode(m)}
            options={[
              { value: "index", label: "按编号 Edge7" },
              { value: "intent", label: "右端面 ∩ 圆角面" },
            ]}
            aria-label="倒角1 的参考"
          />
        </div>
        <ParamSlider className="px-0" label="拉伸1 · 深度" value={s.depth} min={12} max={40} onChange={(v) => c.setDepth(v)} />
        {s.refMode === "intent" && <Hint>换了参考，深度随便改，倒角都留在右端。但它仍然依赖圆角1：压缩圆角，它照样会断。这就是「细节放最后」的理由。</Hint>}
      </div>
    ),
    note: "Onshape 按「哪个特征、哪条草图线生成了这个面」来记参考；Fusion 教程建议把圆角放到时间线最后；FreeCAD 建议参考基准面而不是生成的边。说法不同，原则一样。",
    noteTitle: "各软件",
  },
]

const QUIZ = [
  {
    q: "把回滚条拖到「圆角1」上方，模型会怎样？",
    options: ["圆角1 和它后面的特征暂时不算，模型回到倒圆角之前", "圆角1 被删除了", "只有圆角1 不显示，倒角1 照常显示"],
    answer: 0,
    explain: "回滚条下面的所有特征都暂停计算，什么也没删。倒角1 在圆角1 之后，也一起暂停。",
  },
  {
    q: "删掉圆角1 后，倒角1 报错。最可能的原因是？",
    options: ["倒角和圆角不能出现在同一个零件上", "倒角1 引用了圆角1 生成的边，那条边不存在了", "删除任何特征都会让后面的特征全部失效"],
    answer: 1,
    explain: "只有引用了被删特征的子特征会出错。孔1 不引用圆角1，删掉圆角它照常。看依赖关系，就能预测谁会断。",
  },
  {
    q: "哪种做法最不容易遇到拓扑命名问题？",
    options: ["草图画在基准面上，圆角倒角放在最后", "草图画在最新生成的模型面上，方便对齐", "每次改完尺寸，把出错的下游特征删掉重画"],
    answer: 0,
    explain: "基准面不会因为模型重算而改名；细节特征放在最后，就没有别的特征引用它们的边。删掉重画能救急，但下次改尺寸还会再断。",
  },
]

/** The feature tree drawn as a dependency graph: rows are features, arcs are references. */
function FeatureGraph({ s, c }: { s: FtState; c: FeatureTreeScene }) {
  const d = derive(s)
  const ROW = 40
  const rows = [
    { key: "plane", name: "上视基准面", op: "plane" as const, caption: "基准", fi: 0 },
    { key: "sketch1", name: "草图1", op: "sketch" as const, caption: "画在 上视基准面", fi: 0 },
    { key: "extrude1", name: "拉伸1", op: "extrude" as const, caption: `轮廓：草图1 · 深 ${s.depth}`, fi: 1 },
    { key: "hole1", name: "孔1", op: "hole" as const, caption: `拉伸1 的顶面 · Ø${HOLE.r * 2} 深 ${HOLE.depth}`, fi: 2 },
    { key: "fillet1", name: "圆角1", op: "fillet" as const, caption: s.filletSuppressed ? "已压缩" : `拉伸1 的一条边 · R${R}`, fi: 3 },
    {
      key: "chamfer1",
      name: "倒角1",
      op: "chamfer" as const,
      caption: d.chamferError ? "找不到 Edge7" : s.refMode === "intent" ? "右端面 ∩ 圆角面" : d.wrongEdge ? "Edge7 · 选错了边，没报错" : `圆角1 的边 Edge7 · ${C} mm`,
      fi: 4,
    },
  ]
  const at = (key: string) => rows.findIndex((r) => r.key === key)
  const arrows: { from: string; to: string; tone?: "error" | "warning" }[] =
    s.step >= 2
      ? [
          { from: "plane", to: "sketch1" },
          { from: "sketch1", to: "extrude1" },
          { from: "extrude1", to: "hole1" },
          { from: "extrude1", to: "fillet1" },
          { from: "fillet1", to: "chamfer1", tone: d.chamferError ? "error" : d.wrongEdge ? "warning" : undefined },
          ...(s.refMode === "intent" ? [{ from: "extrude1", to: "chamfer1" }] : []),
        ]
      : []
  const interactive = s.step === 0 || s.step === 1
  const x0 = 0
  return (
    <div className="absolute left-3 top-3 w-64 rounded-lg border bg-popover p-1.5 shadow-popover">
      <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-caption text-faint-foreground">
        <span>特征树</span>
        {s.step >= 2 && <span>箭头：父 → 子</span>}
      </div>
      <div className="relative">
        {rows.map((r) => {
          const active = r.fi === 0 || r.fi <= s.upTo
          const focus = (s.step === 0 && s.selected === r.key) || (s.step === 1 && r.fi === s.upTo)
          const error = r.key === "chamfer1" && d.chamferError
          const warn = r.key === "chamfer1" && d.wrongEdge
          const suppressed = r.key === "fillet1" && s.filletSuppressed
          const Row = interactive && r.fi > 0 ? "button" : "div"
          return (
            <div key={r.key}>
              <Row
                type={Row === "button" ? "button" : undefined}
                onClick={
                  Row === "button"
                    ? () => (s.step === 0 ? c.select(FEATURES[r.fi - 1].id) : c.rollTo(r.fi))
                    : undefined
                }
                className={cn(
                  "flex w-[calc(100%-56px)] items-center gap-2 rounded-sm px-2 text-left [&_svg]:size-3.5",
                  Row === "button" && "hover:bg-accent",
                  focus && "bg-selected",
                  !active && "opacity-40",
                )}
                style={{ height: ROW }}
              >
                {error ? <TriangleAlert className="shrink-0 text-destructive" /> : <OpIcon op={r.op} className={cn("shrink-0", warn ? "text-warning" : "text-muted-foreground")} />}
                <span className="min-w-0">
                  <span className={cn("block text-small", error && "text-destructive", suppressed && "text-faint-foreground line-through")}>{r.name}</span>
                  <span className={cn("block truncate text-caption", error ? "text-destructive" : warn ? "text-warning" : "text-faint-foreground")}>{r.caption}</span>
                </span>
              </Row>
              {s.step === 1 && r.fi === s.upTo && <div className="mx-2 my-0.5 h-0.5 w-[calc(100%-72px)] rounded-full bg-primary" aria-label="回滚条" />}
            </div>
          )
        })}
        {arrows.length > 0 && (
          <svg className="pointer-events-none absolute right-0 top-0 h-full w-14 overflow-visible" aria-hidden>
            {arrows.map((a) => {
              const i = at(a.from)
              const j = at(a.to)
              const y1 = i * ROW + ROW / 2
              const y2 = j * ROW + ROW / 2
              const k = 10 + (j - i) * 9 + (a.from === "extrude1" && a.to === "chamfer1" ? 8 : 0)
              const cls = a.tone === "error" ? "text-destructive" : a.tone === "warning" ? "text-warning" : "text-muted-foreground"
              return (
                <g key={`${a.from}-${a.to}`} className={cls} fill="none" stroke="currentColor" strokeWidth={1.25}>
                  <path d={`M ${x0 + 2} ${y1} C ${x0 + k} ${y1}, ${x0 + k} ${y2}, ${x0 + 2} ${y2}`} strokeDasharray={a.tone === "error" ? "3 3" : undefined} />
                  <path d={`M ${x0 + 7} ${y2 - 3.5} L ${x0 + 2} ${y2} L ${x0 + 7} ${y2 + 3.5}`} />
                </g>
              )
            })}
          </svg>
        )}
      </div>
      {s.step >= 3 && (
        <div className="border-t px-2 pt-1.5 text-caption text-muted-foreground">
          <Readout label="孔1" value={s.depth <= HOLE.depth ? "已打穿" : "盲孔"} tone={s.depth <= HOLE.depth ? "warning" : undefined} />
          {s.depth !== DEFAULT_DEPTH && <Readout label="深度" value={s.depth} unit="mm" />}
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<FtState, FeatureTreeScene> = {
  id: "feature-tree",
  codes: ["1.3.1", "1.3.2", "1.3.3"],
  title: "特征树、父子关系与拓扑命名",
  create: (v, emit) => new FeatureTreeScene(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: [
    "特征树是按顺序重算的程序，回滚条决定算到哪一步",
    "子特征引用父特征的面和边：父特征变了或没了，子特征就要重新找参考，找不到就报错",
    "拓扑命名问题：上游一改，面和边会重新编号，下游可能悄悄选错；参考基准面和草图，细节特征放最后",
  ],
  next: { to: "/teardown/mug", label: "马克杯拆解", text: "在一个真实零件上逐个特征回滚，看每一步生成了哪些面。" },
  overlay: ({ s, c }) => <FeatureGraph s={s} c={c} />,
}

export default lesson
