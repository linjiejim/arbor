import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { areaOf, FULL, LAYER, loadAcrossOf, presetOf, PrintScene, type PresetId, type PrintState } from "./print-overhang.scene"
import type { LessonDef, StepDef } from "./types"

/** 4.1.1 · 4.1.2 「3D 打印：悬垂与摆放方向」. */

function strengthOf(s: PrintState) {
  const k = loadAcrossOf(s)
  if (k > 0.7) return { text: "拉力跨过层线：最弱", tone: "warning" as const }
  if (k < 0.3) return { text: "拉力沿着层线：最强", tone: "success" as const }
  return { text: "斜着跨层：居中", tone: undefined }
}

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-scene-modified" />
      <span>超过阈值：需要支撑</span>
      <span className="size-3 rounded-xs bg-scene-modified/40" />
      <span>接近阈值：还能打，表面会差一些</span>
      <span className="h-px w-3 bg-muted-foreground" />
      <span>竖线：支撑会长在这里（示意）</span>
    </div>
  )
}

function AreaReadout({ s }: { s: PrintState }) {
  const a = areaOf(s)
  return (
    <div className="mt-3">
      <Readout label="需要支撑的面积" value={a} unit="mm²" tone={a === 0 ? "success" : "warning"} />
    </div>
  )
}

const PRESET_OPTIONS: { value: PresetId; label: string }[] = [
  { value: "upright", label: "立放" },
  { value: "flipped", label: "倒放" },
  { value: "side", label: "侧放" },
]

const STEPS: StepDef<PrintState, PrintScene>[] = [
  {
    title: "一层一层堆上去",
    body: (
      <>
        <p>FDM 打印机把熔化的塑料一层层挤在上一层上面。每一层都得落在点什么上：平台、上一层，或者支撑。</p>
        <p>这是一个 T 形支架。拖动打印进度，看到左边横梁那一层时，它下面是什么？</p>
      </>
    ),
    task: { label: "把打印进度拖过左边横梁的底面", done: (s) => s.reachedLedge },
    extra: ({ s, c }) => (
      <>
        <ParamSlider
          className="mt-3 px-0"
          label="打印进度"
          value={Math.min(s.progress, FULL)}
          min={0}
          max={FULL}
          onChange={(v) => c.setProgress(v)}
          hint={`为了看得清，层线按 ${LAYER} mm 画；实际层高常在 0.1–0.3 mm。`}
        />
        {s.reachedLedge && <Hint>左边横梁的第一层直接挤在空气里，会塌下去。右边有一道斜面托着，每一层只比下一层多伸出一点。</Hint>}
      </>
    ),
  },
  {
    title: "悬垂角和 45° 规则",
    body: (
      <>
        <p>悬垂角按打印方向量：竖直的墙是 0°，朝下的水平面是 90°。角度越大，新的一层伸出去越多，底下托着的越少。</p>
        <p>FDM 常用的经验值是 45°：层高 0.2 mm、线宽 0.4 mm 时，每层伸出 0.2 mm，新线还有一半压在下面那层上。超过它就要加支撑。</p>
      </>
    ),
    task: { label: "先猜，再拖一下阈值看颜色怎么变", done: (s) => s.showOverhang && s.triedThreshold },
    extra: ({ s, c }) => (
      <>
        <Predict
          question="左边横梁平的底面，和右边 45° 的斜面，哪个需要支撑？"
          options={["两个都要：悬空的地方都要撑", "只有左边平的底面", "只有右边的斜面", "都不要"]}
          answer={1}
          explain="水平朝下的面悬垂角是 90°，远超 45°。右边斜面刚好 45°，在 FDM 的经验极限内，可以不加支撑。"
          onReveal={() => c.reveal()}
        />
        {s.showOverhang && (
          <>
            <ParamSlider
              className="mt-3 px-0"
              label="悬垂阈值"
              unit="°"
              value={s.threshold}
              min={20}
              max={70}
              onChange={(v) => c.setThreshold(v)}
              hint="FDM 常用 45°。树脂打印（SLA）按设备和材料的指南来。"
            />
            <AreaReadout s={s} />
            <Legend />
          </>
        )}
      </>
    ),
    note: "两端都有支点的短距离水平跨可以「桥接」，不一定要支撑，但能跨多远取决于材料和机器，要试打。",
    noteTitle: "例外",
  },
  {
    title: "换个方向摆",
    body: (
      <>
        <p>同一个零件，摆的方向不同，朝下的面就不同。切片软件里第一件事，往往就是把零件转到合适的方向。</p>
        <p>转动零件，找一个完全不需要支撑的方向。</p>
      </>
    ),
    task: { label: "找到一个需要支撑的面积为 0 的方向（阈值 45°）", done: (s) => areaOf(s) === 0 && s.threshold <= 45 && (s.rotX !== 0 || s.rotY !== 0) },
    extra: ({ s, c }) => (
      <>
        <ParamSlider className="mt-3 px-0" label="绕 Y 轴转" unit="°" value={s.rotY} min={-180} max={180} step={15} onChange={(v) => c.setRotation({ rotY: v })} />
        <ParamSlider className="px-0" label="绕 X 轴转" unit="°" value={s.rotX} min={-180} max={180} step={15} onChange={(v) => c.setRotation({ rotX: v })} />
        <AreaReadout s={s} />
        {s.threshold > 45 && <Hint tone="warning">阈值被调高了，回到 45° 再找。</Hint>}
        {areaOf(s) === 0 && s.threshold <= 45 && (s.rotX !== 0 || s.rotY !== 0) && <Hint>找到了。倒过来放和侧着放都不需要支撑。下一步看看它们哪个更结实。</Hint>}
      </>
    ),
  },
  {
    title: "层与层之间最弱",
    body: (
      <>
        <p>打印件不是各个方向一样结实。同一层里的塑料是连续挤出来的，层与层之间只靠熔合粘在一起，所以沿 Z 方向拉，最容易从层缝裂开。常见测试里，Z 向的抗拉强度只有层内方向的一半左右，有时更低，取决于材料和参数。</p>
        <p>这个支架用的时候竖杆受拉（蓝色箭头）。比一比三种摆法。</p>
      </>
    ),
    task: { label: "找一个不用支撑、拉力又沿着层线的摆法", done: (s) => areaOf(s) === 0 && loadAcrossOf(s) < 0.3 },
    extra: ({ s, c }) => {
      const st = strengthOf(s)
      return (
        <>
          <Predict
            question="倒放不用支撑。竖杆受拉时，最可能怎么坏？"
            options={["沿着两层之间裂开", "竖杆被均匀拉细", "不会坏：打印件各方向一样结实"]}
            answer={0}
            explain="倒放时层线横着穿过竖杆，拉力正好把层与层拉开。不用支撑的方向，不一定是结实的方向。"
          />
          <div className="mt-4 space-y-2">
            <Segmented size="sm" value={presetOf(s) ?? "upright"} onValueChange={(id) => c.preset(id)} options={PRESET_OPTIONS} aria-label="摆放方向" />
            <div>
              <Readout label="需要支撑" value={areaOf(s)} unit="mm²" tone={areaOf(s) === 0 ? "success" : "warning"} />
              <Readout label="竖杆" value={st.text} tone={st.tone} />
            </div>
          </div>
          {areaOf(s) === 0 && loadAcrossOf(s) < 0.3 && <Hint>侧放两全：层线顺着竖杆，又没有朝下的面。没有两全的方向时，通常先保证受力，宁可多加支撑。</Hint>}
        </>
      )
    },
    note: "侧放要求零件这一面足够平、足够稳。真实零件常常还要兼顾表面质量（贴平台的面最平）和打印时间。",
    noteTitle: "取舍",
  },
  {
    title: "在设计里就避开支撑",
    body: (
      <>
        <p>比起每次靠摆方向，更好的办法是在建模时就让零件「自己撑得住」：把平的悬空面改成 45° 斜面或倒角。</p>
        <p>右边的横梁就是这样做的。给左边也加一道 45° 斜面试试。</p>
      </>
    ),
    task: { label: "给左边横梁加上 45° 斜面，让立放也不需要支撑", done: (s) => s.chamferLeft && areaOf(s) === 0 },
    extra: ({ s, c }) => (
      <>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.setChamferLeft(!s.chamferLeft)}>
          {s.chamferLeft ? "改回平的底面" : "左边加 45° 斜面"}
        </Button>
        <AreaReadout s={s} />
      </>
    ),
    note: "同样的思路：横着的圆孔顶部改成尖角（泪滴形孔），大的悬空平面加斜撑。这类做法叫面向增材制造的设计（DfAM）。",
    noteTitle: "常见做法",
  },
]

const QUIZ = [
  {
    q: "FDM 打印里，悬垂角怎么量？",
    options: ["面和打印平台的夹角", "面偏离竖直方向的角度：竖墙 0°，朝下的平面 90°", "零件绕 Z 轴转过的角度"],
    answer: 1,
    explain: "悬垂角看的是面朝下倾斜了多少。竖墙每层都落在下一层正上方，朝下的平面整层都悬空。",
  },
  {
    q: "一个零件立放时没有任何悬垂，但用的时候沿 Z 方向受拉。最该担心什么？",
    options: ["表面不够光滑", "层与层之间被拉开", "支撑太难拆"],
    answer: 1,
    explain: "层间只靠熔合粘接，是打印件最弱的方向。受力方向最好沿着层线，而不是跨过层线。",
  },
  {
    q: "设计时想让一块平的悬空面不用支撑，最直接的改法是？",
    options: ["把阈值调到 90°", "把它改成 45° 左右的斜面或倒角", "把零件做得更厚"],
    answer: 1,
    explain: "改阈值只是骗过了检查，打出来还是会塌。改成斜面，每层只伸出一点点，下面一直有东西托着。",
  },
]

const lesson: LessonDef<PrintState, PrintScene> = {
  id: "print-overhang",
  codes: ["4.1.1", "4.1.2"],
  title: "3D 打印：悬垂与摆放方向",
  create: (v, emit) => new PrintScene(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: [
    "每一层都要落在东西上：悬垂角超过约 45°（FDM）的朝下面需要支撑",
    "摆放方向决定哪些面朝下，转一转常能省掉支撑",
    "层与层之间最弱：让主要受力沿着层线；最好在设计时就用斜面代替平的悬空面",
  ],
  overlay: ({ s }) => {
    const area = areaOf(s)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <SceneChip>打印方向 Z 向上</SceneChip>
        {s.showOverhang && (
          <>
            <SceneChip className={cn(area === 0 ? "text-success" : "text-warning")}>需要支撑 {area} mm²</SceneChip>
            <SceneChip>阈值 {s.threshold}°</SceneChip>
          </>
        )}
        {s.step === 3 && <SceneChip>{strengthOf(s).text}</SceneChip>}
      </div>
    )
  },
}

export default lesson
