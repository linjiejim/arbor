import { FoldHorizontal, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { SheetScene, bendAllowance, flatLength, type SheetState } from "./sheet-metal-bend.scene"
import type { LessonDef } from "./types"

/** 4.3.1 · 4.3.2 · 4.3.3 「钣金：折弯、K 因子与展开」. */

const mm = (n: number) => n.toFixed(2)

function Formula({ s }: { s: SheetState }) {
  const ba = bendAllowance(s)
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2 text-small">
      <div className="font-mono tabular">BA = π × (R + K × T) × θ / 180</div>
      <div className="mt-1 font-mono tabular text-muted-foreground">
        = π × ({s.R} + {s.K.toFixed(2)} × {s.T}) × {s.theta} / 180 = {mm(ba)} mm
      </div>
      <div className="mt-2">
        <Readout label="展开长 a + BA + b" value={mm(flatLength(s))} unit="mm" tone="primary" />
      </div>
    </div>
  )
}

function KSlider({ s, c }: { s: SheetState; c: SheetScene }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label="K 因子"
      unit=""
      value={s.K}
      min={0.25}
      max={0.5}
      step={0.01}
      onChange={(v) => c.setParam("K", v)}
      hint="中性层到内表面的距离 ÷ 料厚。"
    />
  )
}

const lesson: LessonDef<SheetState, SheetScene> = {
  id: "sheet-metal-bend",
  codes: ["4.3.1", "4.3.2", "4.3.3"],
  title: "钣金：折弯、K 因子与展开",
  create: (v, emit) => new SheetScene(v, emit),
  steps: [
    {
      title: "一张板折出来",
      body: (
        <>
          <p>钣金件是一整张等厚的板，先激光切出展开形状，再在折弯机上折成形。</p>
          <p>所以在 CAD 里要用钣金特征来建（基体法兰、边线法兰、折弯），而不是拿一块实体去切：软件得知道每个折弯的半径、料厚和 K 因子，才能把它展开回平板。</p>
        </>
      ),
      task: { label: "把板折到 90°", done: (s) => s.fold >= 0.999 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label="折弯角度" unit="°" value={Math.round(s.fold * s.theta)} min={0} max={s.theta} onChange={(v) => c.setFold(v / s.theta)} />
          <Button size="sm" variant="secondary" onClick={() => c.playFold()}>
            <Play />
            播放折弯
          </Button>
        </div>
      ),
    },
    {
      title: "中性层",
      body: (
        <>
          <p>折弯时内侧被压短，外侧被拉长。中间有一层长度不变，叫中性层（虚线）。展开长度就按它来算。</p>
          <p>中性层不在正中间，而是偏向内侧：它到内表面的距离是 K·T，K 叫 K 因子，不超过 0.5。</p>
        </>
      ),
      task: { label: "拖动 K，看虚线在板厚里移动", done: (s) => s.triedK },
      extra: ({ s, c }) => (
        <>
          <KSlider s={s} c={c} />
          <Hint>
            K 是经验值，和材料、R/T、折弯方式有关。Protolabs：R 小于 T 时，空气折弯约 0.33，压底折弯约 0.42，R 越大越接近 0.5。Xometry 的空气折弯表：R 在 1–3T 时软材料约 0.40。
          </Hint>
        </>
      ),
    },
    {
      title: "折弯余量",
      body: (
        <>
          <p>折弯区里中性层的弧长，叫折弯余量 BA。中性层半径是 R + K·T，转过 θ 度，弧长就是下面这个式子。</p>
          <p>这里 a、b 量的是两段直边（到折弯切线为止），展开长 = a + BA + b。</p>
        </>
      ),
      task: { label: "把 K 调到 0.5，看展开长怎么变", done: (s) => s.kHigh },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="其他不变，K 从 0.33 增大到 0.5，展开长度会怎样？"
            options={["变长", "变短", "不变，K 只影响折弯力"]}
            answer={0}
            explain="K 越大，中性层离内侧越远，半径 R + K·T 越大，弧长 BA 越长，展开长度跟着变长。差值不大，但钣金的公差也很紧。"
            onReveal={() => c.raiseK()}
          />
          <Formula s={s} />
          <KSlider s={s} c={c} />
          <ParamSlider className="px-0" label="料厚 T" value={s.T} min={0.6} max={3} step={0.1} onChange={(v) => c.setParam("T", v)} />
          <ParamSlider className="px-0" label="内折弯半径 R" value={s.R} min={0.5} max={6} step={0.25} onChange={(v) => c.setParam("R", v)} hint="Protolabs 的标准内半径：0.76、1.52、2.29、3.05 mm。" />
        </>
      ),
    },
    {
      title: "展开",
      body: (
        <>
          <p>钣金件最终交付的是展开图（平板图形，常导出 DXF 给激光切割）。展开时中性层长度不变，折弯区摊平成宽 BA 的一条带。</p>
          <p>展开图上画着折弯线：折弯机按它对位下刀。</p>
        </>
      ),
      task: { label: "展开成平板", done: (s) => s.unfolded },
      extra: ({ s, c }) => (
        <>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.toggleFlat()}>
            <FoldHorizontal />
            {s.fold > 0.5 ? "展开" : "折回"}
          </Button>
          <Formula s={s} />
        </>
      ),
    },
    {
      title: "释放槽",
      body: (
        <>
          <p>现在法兰只占这条边的中间一段。折弯区的两端连着不折弯的板，金属在那里被强行撕开或挤出鼓包。</p>
          <p>办法是在折弯两端切出释放槽，让折弯区和旁边的板分开。</p>
        </>
      ),
      task: { label: "加上释放槽", done: (s) => s.relief },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">折弯两端</span>
            <Segmented
              size="sm"
              aria-label="释放槽"
              value={s.relief ? "on" : "off"}
              onValueChange={(v) => c.setRelief(v === "on")}
              options={[
                { value: "off", label: "不处理" },
                { value: "on", label: "释放槽" },
              ]}
            />
          </div>
          <Hint>
            释放槽的尺寸各家说法相反：Protolabs 给的是上限（宽不超过 0.76 mm），Fictiv 给的是下限（宽至少取 T 和 0.76 mm 中的较大者，深至少 1.5T）。这里画的是宽 T、越过折弯区 1.5T。以供应商的 DFM 报告为准。
          </Hint>
        </>
      ),
    },
    {
      title: "最小法兰长度",
      body: (
        <>
          <p>法兰太短，折弯时搭不住下模的 V 槽，折不准甚至折不了。Protolabs 的规则：法兰长度至少 4 倍料厚。</p>
          <p>同理，孔和其他特征离折弯太近会被拉变形：Protolabs 要求 4T 以外，Fictiv 给的是 2.5T + R。</p>
        </>
      ),
      task: { label: "把法兰拉到 4T 以下看警告，再改回来", done: (s) => s.triedShort && s.b >= 4 * s.T },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label="法兰直段 b" value={s.b} min={2} max={30} onChange={(v) => c.setParam("b", v)} hint={`4T = ${(4 * s.T).toFixed(1)} mm。这里按直段算，比按外形尺寸算更保守。`} />
          {s.b < 4 * s.T && <Hint tone="warning">法兰 {s.b} mm 小于 4T。</Hint>}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: "K 因子描述的是什么？",
      options: ["折弯回弹的角度", "中性层到折弯内表面的距离与料厚之比", "折弯半径与料厚之比"],
      answer: 1,
      explain: "K = 中性层到内表面的距离 ÷ T，通常在 0.3–0.5 之间，不超过 0.5。",
    },
    {
      q: "T = 2、R = 2、K = 0.4，折 90°，折弯余量 BA 约是多少？",
      options: ["约 3.1 mm", "约 4.4 mm", "约 6.3 mm"],
      answer: 1,
      explain: "BA = π × (2 + 0.4 × 2) × 90 / 180 = π × 2.8 / 2 ≈ 4.40 mm。3.1 是只按内半径 R 算的弧长，6.3 是按外半径 R + T 算的。",
    },
    {
      q: "法兰只占一条边的一部分时，为什么要在折弯两端加释放槽？",
      options: ["为了减重", "折弯区两端连着不折弯的板，会撕裂或鼓包", "为了让展开长度更准确"],
      answer: 1,
      explain: "释放槽把折弯区和旁边的平板分开，金属可以自由变形。尺寸各家不同，以供应商为准。",
    },
  ],
  takeaways: [
    "钣金用钣金特征建：板厚不变，每个折弯带着 R、T、K，才能展开",
    "展开长 = 直段 + BA，BA = π(R + K·T)θ/180；K 越大展开越长",
    "法兰至少 4T，局部法兰两端加释放槽；数值以供应商的 DFM 报告为准",
  ],
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        T {s.T} · R {s.R} · K {s.K.toFixed(2)}
      </SceneChip>
      <SceneChip tone="primary">
        {Math.round(s.fold * s.theta)}° · 展开长 {mm(flatLength(s))}
      </SceneChip>
    </div>
  ),
}

export default lesson
