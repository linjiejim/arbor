import { Crosshair, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { cutsThrough, holeWidths, SectionViewsScene, type Region, type SectionState } from "./section-views.scene"
import type { LessonDef } from "./types"

/** 0.2.3 「剖视」: a draggable section plane, the cut shape, hatching, and where to cut. */

const REGION_TEXT: Record<Region, string> = {
  solid: "这里是实体，要画剖面线。",
  hole: "这是孔，空的，不画剖面线。",
  cavity: "这是空腔，空的，不画剖面线。",
}

function cutText(d: number) {
  const c = cutsThrough(d)
  if (!c.part) return "没切到零件"
  const parts = [c.hole ? "通孔" : c.counterbore ? "沉孔" : null, c.cavity ? "空腔" : null].filter(Boolean)
  return parts.length ? `剖到：${parts.join("、")}` : "只剖到实体"
}

function CutSlider({ s, c }: { s: SectionState; c: SectionViewsScene }) {
  return <ParamSlider className="mt-4 px-0" label="剖切平面位置 y" value={s.cut} min={-32} max={32} onChange={(v) => c.setCut(v)} hint="零件前后方向从 −25 到 25，孔和空腔的中心在 y = 0。" />
}

const lesson: LessonDef<SectionState, SectionViewsScene> = {
  id: "section-views",
  codes: ["0.2.3"],
  title: "剖视：把零件切开看",
  create: (v, emit) => new SectionViewsScene(v, emit),
  steps: [
    {
      title: "外面看不出里面",
      body: (
        <>
          <p>这个零件里藏着两处空的地方：左边一个沉孔，右边一个从底面挖进去的空腔。</p>
          <p>从上面、前面都看不到空腔。在普通视图里，它只能画成一堆虚线，和外轮廓叠在一起，很难读。</p>
        </>
      ),
      task: { label: "转到下面看一眼，找到那个空腔", done: (s) => s.sawBelow },
      extra: ({ s, c }) => (
        <>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.view("bottom")}>
            <Eye />
            从下面看
          </Button>
          {s.sawBelow && <Hint>空腔从底面开口，深 18 mm。换个办法：把零件切开看。</Hint>}
        </>
      ),
    },
    {
      title: "用平面切开",
      body: (
        <>
          <p>剖视的做法：假想用一个平面把零件切开，拿走挡在前面的那部分，再看剩下的。平面切到实体的地方，就是剖面。</p>
          <p>拖动剖切平面右上角的蓝点，把它推进零件。</p>
        </>
      ),
      task: { label: "把剖切平面推到切过孔的位置", done: (s) => Math.abs(s.cut) < 5 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="剖切平面切过孔的时候，剖面是什么形状？"
            options={["一个完整的矩形", "在孔的位置断成左右两块，缺口是台阶形", "一个圆环"]}
            answer={1}
            explain="孔是通的，剖面在孔的位置断成两块；上段沉孔更宽，所以缺口是台阶形。右边那块底下还缺了一块，那是空腔。"
            onReveal={() => c.cutAt(0)}
          />
          <CutSlider s={s} c={c} />
        </>
      ),
    },
    {
      title: "剖在中心线上",
      body: (
        <>
          <p>剖切平面偏离孔的中心，剖面切到的只是孔的一条弦，看起来就比实际窄，量出来不是真实直径。</p>
          <p>所以剖切平面一般放在孔的中心线上，或者零件的对称面上。</p>
        </>
      ),
      task: { label: "把剖切平面对准孔的中心线", done: (s) => s.cut === 0 },
      extra: ({ s, c }) => {
        const w = holeWidths(s.cut)
        return (
          <>
            <div className="mt-3">
              <Readout label="剖面上的孔宽" value={w.hole ? w.hole.toFixed(1) : "—"} unit="mm" tone={s.cut === 0 ? "success" : "warning"} />
              <Readout label="沉孔宽" value={w.counterbore ? w.counterbore.toFixed(1) : "—"} unit="mm" tone={s.cut === 0 ? "success" : "warning"} />
            </div>
            <p className="mt-1 text-small text-muted-foreground">实际：通孔 Ø10，沉孔 Ø18 × 8 深。</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.cutAt(0)}>
              <Crosshair />
              对准孔中心
            </Button>
            <CutSlider s={s} c={c} />
          </>
        )
      },
      terms: ["hole"],
    },
    {
      title: "剖面线",
      body: (
        <>
          <p>工程图里，剖到的实体要画剖面线。金属零件用与水平成 45° 的细实线，间隔均匀；同一个零件在所有剖视图里，剖面线的方向和间隔都一样。</p>
          <p>孔和空腔是空的，剖面线不能画进去。读图的人一眼就知道哪里是实心的。</p>
        </>
      ),
      task: { label: "在剖面上分别点一下孔和空腔", done: (s) => s.foundHole && s.foundCavity },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-small font-medium">剖面线</span>
            <Segmented
              size="sm"
              aria-label="剖面线"
              value={s.hatch ? "on" : "off"}
              onValueChange={(v) => c.setHatch(v === "on")}
              options={[
                { value: "on", label: "显示" },
                { value: "off", label: "隐藏" },
              ]}
            />
          </div>
          {s.region && <Hint tone={s.region === "solid" ? "warning" : undefined}>{REGION_TEXT[s.region]}</Hint>}
          {s.foundHole && s.foundCavity && <Hint>两处空的地方都找到了。剖面线只画在实体上。</Hint>}
        </>
      ),
      note: "两个零件剖在一起时，相邻零件的剖面线方向相反或间隔不同，用来区分零件。非金属材料另有剖面符号。",
      noteTitle: "国标约定",
    },
    {
      title: "剖在哪，就表达哪",
      body: (
        <>
          <p>同一个零件，剖切平面放在哪，剖视图就表达什么。想表达空腔的深度，又不想被沉孔打断，就把平面放在只穿过空腔的位置。</p>
          <p>图纸上用剖切符号（两端的粗短画和箭头）加字母标出剖切位置，剖视图上方写「A–A」。剖切平面过零件的对称面、视图又按投影关系摆放时，这些标注可以省略。</p>
        </>
      ),
      task: { label: "移动剖切平面，只切到空腔，不切到孔", done: (s) => Math.abs(s.cut) >= 9 && Math.abs(s.cut) < 13 },
      extra: ({ s, c }) => (
        <>
          <CutSlider s={s} c={c} />
          <Hint>{cutText(s.cut)}</Hint>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: "剖视图里，哪些区域画剖面线？",
      options: ["所有看得见的面", "被剖切平面切到的实体部分", "孔和空腔"],
      answer: 1,
      explain: "剖面线只画在平面切到实体的地方。孔和空腔是空的；剖切平面后面看得见的轮廓画粗实线，不画剖面线。",
    },
    {
      q: "剖切平面偏离 Ø10 孔的中心线 3 mm，剖面上量到的孔宽是多少？",
      options: ["小于 10 mm", "正好 10 mm", "大于 10 mm"],
      answer: 0,
      explain: "偏离中心时，平面切到的是孔的一条弦，弦比直径短，这里只有 8 mm。所以剖切平面通常过孔的中心线。",
    },
    {
      q: "金属零件的剖面线，国标规定画成？",
      options: ["45° 的细实线，间隔均匀", "竖直的粗实线", "45° 的细虚线"],
      answer: 0,
      explain: "通用剖面线是 45° 细实线。粗实线留给可见轮廓，细虚线留给不可见轮廓，不能混用。",
    },
  ],
  takeaways: ["剖视：假想切开零件，拿走前面那部分，看剩下的", "剖到的实体画 45° 细实线剖面线，孔和空腔不画", "剖切平面一般过孔的中心线或对称面：剖在哪，就表达哪"],
  overlay: ({ s }) =>
    s.step >= 1 ? (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip tone="primary">剖切平面 y = {s.cut}</SceneChip>
        <SceneChip>{cutText(s.cut)}</SceneChip>
      </div>
    ) : null,
}

export default lesson
