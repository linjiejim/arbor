import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { cn } from "@/lib/utils"
import { FilletShellOrderScene, type OrderState } from "./fillet-shell-order.scene"
import type { LessonDef, StepCtx } from "./types"

const R_VALUES = [2, 4, 6, 8]
const T_VALUES = [1.5, 2.5, 4]

function TreeStepper({ s, c, which }: StepCtx<OrderState, FilletShellOrderScene> & { which: 0 | 1 }) {
  const names = which === 0 ? ["拉伸1", "圆角1", "抽壳1"] : ["拉伸1", "抽壳1", "圆角1"]
  const at = which === 0 ? s.ua : s.ub
  return (
    <div className="mt-3 flex gap-1.5">
      {names.map((n, i) => (
        <Button key={n} size="sm" variant={at === i + 1 ? "primary" : "secondary"} onClick={() => c.stepTo(which, i + 1)}>
          {i + 1}. {n}
        </Button>
      ))}
    </div>
  )
}

function ValuePicker({ label, values, value, onPick, unit = "mm" }: { label: string; values: number[]; value: number; onPick: (v: number) => void; unit?: string }) {
  return (
    <div className="mt-3">
      <div className="text-small font-medium">{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className={cn(
              "h-7 min-w-12 rounded-sm border px-2 font-mono text-caption tabular transition-colors duration-(--duration-fast) hover:bg-accent",
              value === v && "border-primary bg-selected",
            )}
          >
            {v}
            <span className="text-faint-foreground">{unit}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 1.3.4 · 1.2.7 「先圆角还是先抽壳」: feature order changes the part. */
const lesson: LessonDef<OrderState, FilletShellOrderScene> = {
  id: "fillet-shell-order",
  codes: ["1.2.7", "1.3.4"],
  title: "先圆角，还是先抽壳",
  create: (v, emit) => new FilletShellOrderScene(v, emit),
  steps: [
    {
      title: "同一个盒子，两种顺序",
      body: (
        <>
          <p>左右两个盒子尺寸完全一样：外形 60 × 40 × 30，外圆角 R4，壁厚 2.5，顶面开口。唯一的区别是特征顺序。</p>
          <p>A 先倒外圆角再抽壳；B 先抽壳再倒外圆角。从外面看，几乎看不出差别。</p>
        </>
      ),
      extra: ({ s }) => (s.error ? <Hint tone="warning">模型没加载出来：{s.error}</Hint> : !s.ready ? <Hint>正在加载两个模型……</Hint> : null),
      terms: ["fillet", "shell"],
    },
    {
      title: "A：先圆角",
      body: <p>在 A 的特征树里一步步往下走。抽壳的时候，外圆角已经在了：抽壳把所有面向内偏移一个壁厚，外圆角也一起偏移成一个同心的内圆角。</p>,
      task: { label: "走完 A 的三步，看抽壳生成了哪些面", done: (s) => s.steppedA && s.ua === 3 },
      extra: (ctx) => <TreeStepper {...ctx} which={0} />,
    },
    {
      title: "B：先抽壳",
      body: <p>B 抽壳的时候还是尖角，内壁也是尖角。之后再倒外圆角，只削外面，里面的尖角不会跟着变。</p>,
      task: { label: "走完 B 的三步", done: (s) => s.steppedB && s.ub === 3 },
      extra: (ctx) => <TreeStepper {...ctx} which={1} />,
    },
    {
      title: "剖开看转角",
      body: <p>在半高处水平剖开，从上往下看转角处的壁。A 的壁处处一样厚；B 的外圆角把转角削薄了，内侧还是尖角，注塑时这里容易应力集中、缩痕不均。</p>,
      task: { label: "打开剖切，对比两个转角", done: (s) => s.cutSeen },
      extra: ({ s, c }) => {
        const w = FilletShellOrderScene.cornerWall(s.r, s.t)
        return (
          <>
            <label className="mt-3 flex items-center gap-2 text-small">
              <Switch checked={s.section} onCheckedChange={(v) => c.setSection(v)} />
              剖切
            </label>
            <div className="mt-3 rounded-lg border p-3">
              <div className="text-small text-muted-foreground">转角处的最薄壁厚（R{s.r}，壁厚 {s.t}）</div>
              <div className="mt-1">
                <Readout label="A" value={w.a.toFixed(2)} unit="mm" tone="success" />
                <Readout label="B" value={w.b.toFixed(2)} unit="mm" tone={w.b < s.t * 0.7 ? "warning" : undefined} />
              </div>
              <p className="mt-2 text-caption text-faint-foreground">B 的转角壁厚 = R − (R − 壁厚) × √2，外圆角越大越薄。</p>
            </div>
          </>
        )
      },
    },
    {
      title: "参数一变，谁先坏",
      body: <p>换几组圆角和壁厚。这些组合都在 OpenCascade 内核里实际算过，失败的结果没有隐藏。</p>,
      task: { label: "找到一组会失败的参数", done: (s) => s.triedFail },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="把外圆角加大到 R8、壁厚减到 1.5，哪个盒子会建不出来？"
            options={["A 先圆角", "B 先抽壳", "都没问题"]}
            answer={1}
            explain="B 的外圆角从外面削进转角，壁太薄时直接把壁吃穿，内核拒绝。A 的内圆角半径是 8 − 1.5 = 6.5，照样成立。"
            onReveal={() => c.setParams(8, 1.5)}
          />
          <ValuePicker label="外圆角 R" values={R_VALUES} value={s.r} onPick={(r) => c.setParams(r, s.t)} />
          <ValuePicker label="壁厚" values={T_VALUES} value={s.t} onPick={(t) => c.setParams(s.r, t)} />
          {s.failA && <Hint tone="warning">A 失败：{c.failureText(0)}</Hint>}
          {s.failB && <Hint tone="warning">B 失败：{c.failureText(1)}</Hint>}
        </>
      ),
      note: "SOLIDWORKS 帮助建议先圆角再抽壳；build123d 的茶杯示例却是先抽壳后圆角。两种都对，关键是知道各自会得到什么。",
      noteTitle: "各家做法",
    },
  ],
  quiz: [
    {
      q: "想让抽壳后的内转角也是圆角、壁厚处处一样，应该怎么排？",
      options: ["先抽壳，再倒外圆角", "先倒外圆角，再抽壳", "顺序无所谓"],
      answer: 1,
      explain: "抽壳会把已有的外圆角向内偏移成同心内圆角；之后再倒的外圆角不会影响内侧。",
    },
    {
      q: "先抽壳再倒很大的外圆角，最可能出现什么问题？",
      options: ["圆角把转角处的壁削薄，甚至吃穿", "内角变圆", "盒子变重"],
      answer: 0,
      explain: "外圆角从外面切进转角，内侧仍是尖角，转角处的壁厚 = R − (R − t)√2。",
    },
    {
      q: "先圆角后抽壳时，什么情况下抽壳会失败？",
      options: ["圆角比壁厚大很多", "圆角恰好等于壁厚，内圆角半径为零", "壁厚很小"],
      answer: 1,
      explain: "内圆角半径 = 外圆角 − 壁厚；等于零时偏移面退化，内核算不出来。",
    },
  ],
  takeaways: ["特征顺序会改变零件的形状和强度，不只是建模的先后", "先圆角再抽壳：内外同心，壁厚均匀", "失败的参数组合背后，是特征之间的几何约束"],
  next: { to: "/teardown/box_fillet_first", label: "小盒子拆解", text: "在拆解页里换更多参数组合，看每一步生成和修改了哪些面。" },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        R{s.r} · 壁厚 {s.t}
      </SceneChip>
      {s.section && <SceneChip tone="primary">剖切中</SceneChip>}
    </div>
  ),
}

export default lesson
