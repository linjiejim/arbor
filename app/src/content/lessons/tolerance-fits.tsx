import { ArrowDownToLine, Dices, Hammer } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  EXAG,
  FIT_NAME,
  fitOf,
  HOLES,
  IT,
  IT7_BY_SIZE,
  mm,
  NOMINAL,
  SHAFTS,
  size,
  ToleranceFitsScene,
  type FitState,
  type HoleId,
  type Pair,
  type ShaftId,
  type System,
} from "./tolerance-fits.scene"
import type { LessonDef } from "./types"

/** 3.2.1 「尺寸公差与配合」: tolerance bands, fundamental deviations, the three kinds of fit, hole basis vs shaft basis. */

const opts = <T extends string>(ids: readonly T[]) => ids.map((value) => ({ value, label: value }))
const GRADES = opts(["H6", "H7", "H8", "H9"] as const)
const LETTERS = opts(["f7", "g6", "h6", "k6", "n6", "p6", "s6"] as const)
const BASIS_SHAFT = opts(["g6", "h6", "k6", "n6", "p6"] as const)
const BASIS_HOLE = opts(["G7", "H7", "K7", "N7", "P7"] as const)
const PAIRS: { value: Pair; label: string }[] = [
  { value: "loose", label: "最松的一对" },
  { value: "tight", label: "最紧的一对" },
]
const SYSTEMS: { value: System; label: string }[] = [
  { value: "hole", label: "基孔制 · 孔 H7" },
  { value: "shaft", label: "基轴制 · 轴 h6" },
]

const W = 252
const TOP = 14
const BOTTOM = 196
const LO = -50
const HI = 60
const y = (um: number) => TOP + ((HI - um) / (HI - LO)) * (BOTTOM - TOP)

/** 公差带图: the zero line is the nominal size; each band spans from its lower to its upper deviation (µm). */
function BandDiagram({ s }: { s: FitState }) {
  const [ES, EI] = HOLES[s.hole]
  const [es, ei] = SHAFTS[s.shaft]
  const showShaft = s.step > 0
  const actual = s.pair !== "mid"
  const band = (x: number, hi: number, lo: number, name: string, tone: "hole" | "shaft", mark: number | null) => (
    <g>
      <rect
        x={x}
        y={y(hi)}
        width={52}
        height={Math.max(1, y(lo) - y(hi))}
        className={tone === "hole" ? "text-primary" : "text-foreground"}
        fill="currentColor"
        fillOpacity={tone === "hole" ? 0.16 : 0.1}
        stroke="currentColor"
        strokeWidth={1.2}
      />
      <text x={tone === "hole" ? x - 4 : x + 56} y={y(hi) + 4} textAnchor={tone === "hole" ? "end" : "start"} fill="currentColor" className="text-caption tabular">
        {hi > 0 ? `+${hi}` : hi}
      </text>
      <text x={tone === "hole" ? x - 4 : x + 56} y={y(lo) + 4} textAnchor={tone === "hole" ? "end" : "start"} fill="currentColor" className="text-caption tabular">
        {lo > 0 ? `+${lo}` : lo}
      </text>
      {mark !== null && <line x1={x - 3} x2={x + 55} y1={y(mark)} y2={y(mark)} stroke="currentColor" strokeWidth={2} />}
      <text x={x + 26} y={BOTTOM + 16} textAnchor="middle" fill="currentColor" className="text-caption font-medium">
        {name}
      </text>
    </g>
  )
  return (
    <svg width={W} height={BOTTOM + 22} viewBox={`0 0 ${W} ${BOTTOM + 22}`} className="block text-foreground" aria-label="公差带图">
      {[-40, -20, 20, 40].map((t) => (
        <g key={t} className="text-faint-foreground">
          <line x1={30} x2={34} y1={y(t)} y2={y(t)} stroke="currentColor" />
          <text x={27} y={y(t) + 4} textAnchor="end" fill="currentColor" className="text-caption tabular">
            {t > 0 ? `+${t}` : t}
          </text>
        </g>
      ))}
      <line x1={34} x2={34} y1={TOP} y2={BOTTOM} stroke="currentColor" strokeOpacity={0.25} />
      <line x1={34} x2={W - 4} y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth={1.2} />
      <text x={27} y={y(0) + 4} textAnchor="end" fill="currentColor" className="text-caption">
        0
      </text>
      <text x={38} y={y(0) + 15} fill="currentColor" className="text-caption text-muted-foreground">
        零线
      </text>
      {band(76, ES, EI, `孔 ${s.hole}`, "hole", actual ? s.dHole : null)}
      {showShaft && band(160, es, ei, `轴 ${s.shaft}`, "shaft", actual && s.step > 0 ? s.dShaft : null)}
    </svg>
  )
}

function FitPanel({ s }: { s: FitState }) {
  const f = fitOf(s.hole, s.shaft)
  const [ES, EI] = HOLES[s.hole]
  const out = s.dHole > ES || s.dHole < EI
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>Ø{NOMINAL} · 尺寸段 18–30 mm</SceneChip>
        <SceneChip>3D 里直径偏差放大 {EXAG} 倍</SceneChip>
      </div>
      <div className="w-72 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="mb-1 flex items-baseline justify-between text-small">
          <span className="font-medium">公差带图</span>
          <span className="text-caption text-muted-foreground">单位 µm</span>
        </div>
        <BandDiagram s={s} />
        {s.step === 0 ? (
          <div className={cn("mt-1 text-small", out ? "text-destructive" : "text-success")}>
            实际孔径 Ø{size(s.dHole)} · {out ? "超差，不合格" : "在公差带内，合格"}
          </div>
        ) : s.step === 1 ? (
          <div className="mt-1 text-small text-muted-foreground">
            轴 {s.shaft}：Ø{size(SHAFTS[s.shaft][1])} ~ Ø{size(SHAFTS[s.shaft][0])}
          </div>
        ) : (
          <div className="mt-1 space-y-0.5 text-small">
            <div className={cn("font-medium", f.kind === "clearance" ? "text-success" : f.kind === "interference" ? "text-destructive" : "text-warning")}>
              {s.hole}/{s.shaft} · {FIT_NAME[f.kind]}
            </div>
            <div className="font-mono text-caption tabular text-muted-foreground">
              {f.kind === "interference" ? `Ymin ${mm(f.maxClear)}  Ymax ${mm(f.minClear)}` : f.kind === "clearance" ? `Xmax ${mm(f.maxClear)}  Xmin ${mm(f.minClear)}` : `Xmax ${mm(f.maxClear)}  Ymax ${mm(f.minClear)}`}
            </div>
            {s.pair !== "mid" && (
              <div className="text-caption text-muted-foreground">
                这一对：{s.dHole - s.dShaft > 0 ? `间隙 ${mm(s.dHole - s.dShaft)}` : s.dHole === s.dShaft ? "间隙为 0，刚好贴合" : `过盈 ${mm(s.dHole - s.dShaft)}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Push / press buttons and what happened. */
function Assemble({ s, c }: { s: FitState; c: ToleranceFitsScene }) {
  const free = s.dHole - s.dShaft >= 0
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={s.insert >= 1} onClick={() => c.pushIn()}>
          <ArrowDownToLine />
          用手推进去
        </Button>
        {!free && (
          <Button size="sm" variant="secondary" disabled={s.pressed} onClick={() => c.press()}>
            <Hammer />
            压入
          </Button>
        )}
      </div>
      {s.insert >= 1 && free && <Hint>{s.dHole > s.dShaft ? "有间隙，轴一推就进去，还能在孔里晃。间隙越大晃得越厉害。" : "间隙为 0：推得进去，但不会晃，这是 H7/h6 这类定位配合最紧的情况。"}</Hint>}
      {s.blocked && !free && !s.pressed && <Hint tone="warning">轴比孔大，手推不进去。要用压力机压入，或者把孔加热胀大再装（热装）。</Hint>}
      {s.pressed && s.insert >= 1 && <Hint>压进去以后，轴和孔靠弹性变形互相抱紧，不加键也能传递一定的扭矩，拆下来就难了。</Hint>}
    </>
  )
}

const lesson: LessonDef<FitState, ToleranceFitsScene> = {
  id: "tolerance-fits",
  codes: ["3.2.1"],
  title: "尺寸公差与配合",
  create: (v, emit) => new ToleranceFitsScene(v, emit),
  steps: [
    {
      title: "公差：允许的变动范围",
      body: (
        <>
          <p>没有哪台机床能把孔正好做成 20 mm。图纸上写 Ø20H7，意思是孔径可以在 20.000 到 20.021 mm 之间，量出来落在这个范围里就合格。</p>
          <p>20 叫公称尺寸。实际尺寸允许偏离它的上限叫上极限偏差（孔记作 ES），下限叫下极限偏差（EI）。两者之差就是公差。左上角的公差带图以公称尺寸为零线，把这个范围画成一条带。</p>
          <p>H7 里的数字 7 是标准公差等级 IT7。数字越大，公差越大，越好加工，也越不精确。</p>
        </>
      ),
      task: { label: "把实际孔径拖到公差带外，再换一个公差等级", done: (s) => s.sawOut && s.grades.length >= 2 },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label="这个孔实际做到" unit="µm" value={s.dHole} min={-10} max={60} onChange={(v) => c.setActualHole(v)} hint={`偏差 ${s.dHole} µm，即 Ø${size(s.dHole)}`} />
          <div className="mt-3">
            <Segmented size="sm" aria-label="孔的公差等级" value={s.hole} onValueChange={(v) => c.setHole(v as HoleId)} options={GRADES} />
          </div>
          <div className="mt-3 rounded-md bg-sunken px-3 py-2 text-small">
            <div className="text-muted-foreground">18–30 mm 的标准公差</div>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-caption tabular">
              {[5, 6, 7, 8, 9].map((g) => (
                <span key={g}>
                  IT{g} {IT[g]}
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-muted-foreground">同是 IT7，零件越大公差越大：</div>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-caption tabular">
              {IT7_BY_SIZE.map(([r, v]) => (
                <span key={r} className={cn(r === "18–30" && "text-primary")}>
                  {r} mm: {v}
                </span>
              ))}
            </div>
          </div>
        </>
      ),
      note: "数值取自 GB/T 1800.1—2020 和 GB/T 1800.2—2020（对应 ISO 286-1、286-2：2010），单位 µm。旧国标把公称尺寸叫「基本尺寸」。",
      noteTitle: "出处",
    },
    {
      title: "基本偏差：字母管位置",
      body: (
        <>
          <p>公差等级只管带有多宽，带放在零线的哪里由字母决定，叫基本偏差。小写字母是轴，大写是孔。</p>
          <p>轴的 a 到 g 整条带在零线下面，轴比公称尺寸小；h 的上偏差为 0，正好贴着零线；js 跨在零线两边；k 到 zc 在零线上面，轴比公称尺寸大。孔的字母正好反过来，H 的下偏差为 0。</p>
        </>
      ),
      task: { label: "试 4 个不同的轴，看公差带怎么移动", done: (s) => s.letters.length >= 4 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="轴 p6 和公称尺寸 Ø20 比，是大还是小？"
            options={["比 Ø20 小", "比 Ø20 大", "正好跨着 Ø20"]}
            answer={1}
            explain="p 在 k 之后，公差带整个在零线上方：p6 的轴是 Ø20.022 到 Ø20.035，比 Ø20 大。配上 H7 的孔，它就比孔还粗。"
            onReveal={() => c.setShaft("p6")}
          />
          <div className="mt-4">
            <Segmented size="sm" aria-label="轴的公差带" value={s.shaft} onValueChange={(v) => c.setShaft(v as ShaftId)} options={LETTERS} />
          </div>
          <div className="mt-2 text-small text-muted-foreground">
            已试 <span className="tabular">{s.letters.length}</span> 个：{s.letters.join("、") || "还没有"}
          </div>
        </>
      ),
    },
    {
      title: "间隙、过渡、过盈",
      body: (
        <>
          <p>孔和轴的公差带一对比，配合就定了：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>间隙配合：孔带整个在轴带上方，任取一对都有间隙。</li>
            <li>过盈配合：孔带整个在轴带下方，轴总比孔大，要压进去。</li>
            <li>过渡配合：两条带有重叠，可能有间隙，也可能有过盈。</li>
          </ul>
          <p>最大间隙 Xmax 是最大的孔配最小的轴；另一头是最小的孔配最大的轴，得到最小间隙 Xmin，或者最大过盈 Ymax（负值）。</p>
        </>
      ),
      task: { label: "三种配合各装一次：拖轴顶上的蓝点往下推，推不动就压入", done: (s) => s.fits.length >= 3 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 space-y-2">
            <Segmented size="sm" aria-label="轴的公差带" value={s.shaft} onValueChange={(v) => c.setShaft(v as ShaftId)} options={LETTERS} />
            <div>
              <Segmented size="sm" aria-label="取哪一对零件" value={s.pair === "loose" ? "loose" : "tight"} onValueChange={(v) => c.setPair(v)} options={PAIRS} />
            </div>
          </div>
          <Assemble s={s} c={c} />
          <div className="mt-3 flex flex-wrap gap-1.5 text-caption">
            {(["clearance", "transition", "interference"] as const).map((k) => (
              <span key={k} className={cn("rounded-sm px-1.5 py-0.5", s.fits.includes(k) ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground")}>
                {FIT_NAME[k]}
              </span>
            ))}
          </div>
        </>
      ),
      note: "常用的基孔制配合和典型用途：H8/f7 精密转动；H7/g6 滑动，能转能移、定位准；H7/h6 定位间隙，装拆方便；H7/k6、H7/n6 过渡，精确定位；H7/p6 过盈定位，要压入；H7/s6 中等压入，传递扭矩。",
      noteTitle: "怎么选",
    },
    {
      title: "过渡配合：抽到哪对算哪对",
      body: (
        <>
          <p>H7/k6 的两条带有重叠。同一批零件里随手拿一对，可能松，也可能紧。</p>
          <p>所以过渡配合用在要求定位准、又要能拆的地方，比如齿轮、带轮装在轴上：装的时候用木槌轻敲，靠键传扭矩。</p>
        </>
      ),
      task: { label: "多抽几对，直到既抽到有间隙的，也抽到有过盈的", done: (s) => s.samples.some((x) => x > 0) && s.samples.some((x) => x < 0) },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="从合格的 H7 孔和 k6 轴里各随手拿一个，装起来会怎样？"
            options={["一定有间隙", "一定有过盈", "可能有间隙，也可能有过盈"]}
            answer={2}
            explain="孔在 20.000–20.021 之间，轴在 20.002–20.015 之间。大孔配小轴有间隙，最多 0.019；小孔配大轴有过盈，最多 0.015。"
            onReveal={() => c.sample()}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.sample()}>
              <Dices />
              随机取一对
            </Button>
          </div>
          {s.pair === "sample" && <Assemble s={s} c={c} />}
          <SampleStrip samples={s.samples} />
        </>
      ),
    },
    {
      title: "基孔制与基轴制",
      body: (
        <>
          <p>配合有两种组织法。基孔制：孔一律用 H，靠换轴的公差带得到松紧不同的配合。基轴制：轴一律用 h，靠换孔。</p>
          <p>国标优先用基孔制。孔要靠钻头、铰刀、拉刀这些定尺寸刀具加工，用塞规检验；孔都用 H，一个尺寸只备一套刀具和量规。轴车一刀磨一刀，什么尺寸都好做。</p>
          <p>基轴制用在轴不便加工的时候：直接用冷拉光轴，或者一根轴上要装好几个松紧不同的零件。滚动轴承外圈和座孔的配合也按基轴制。</p>
        </>
      ),
      task: { label: "找出和 H7/g6 松紧完全一样的基轴制配合", done: (s) => s.pairs.includes("H7/g6") && s.pairs.includes("G7/h6") },
      extra: ({ s, c }) => {
        const f = fitOf(s.hole, s.shaft)
        return (
          <>
            <div className="mt-4 space-y-2">
              <Segmented size="sm" aria-label="配合制" value={s.system} onValueChange={(v) => c.setSystem(v)} options={SYSTEMS} />
              <div>
                {s.system === "hole" ? (
                  <Segmented size="sm" aria-label="轴的公差带" value={s.shaft} onValueChange={(v) => c.setShaft(v as ShaftId)} options={BASIS_SHAFT} />
                ) : (
                  <Segmented size="sm" aria-label="孔的公差带" value={s.hole} onValueChange={(v) => c.setHole(v as HoleId)} options={BASIS_HOLE} />
                )}
              </div>
            </div>
            <div className="mt-3">
              <Readout label={f.kind === "interference" ? "Ymin" : "Xmax"} value={mm(f.maxClear)} unit="mm" />
              <Readout label={f.kind === "clearance" ? "Xmin" : "Ymax"} value={mm(f.minClear)} unit="mm" />
            </div>
            {s.pairs.includes("H7/g6") && s.pairs.includes("G7/h6") && (
              <Hint>H7/g6 和 G7/h6 的间隙都是 0.007–0.041：标准里专门让同名的两种配合松紧相同。K7/h6 对 H7/k6、P7/h6 对 H7/p6 也一样，可以切过去看看。</Hint>
            )}
          </>
        )
      },
      note: "装配图上把配合写成分数：Ø20H7/g6，分子是孔，分母是轴。零件图上只写各自的一半：孔 Ø20H7，轴 Ø20g6；也可以直接写极限偏差，比如孔的上偏差 +0.021、下偏差 0。",
      noteTitle: "图上怎么标",
    },
  ],
  quiz: [
    {
      q: "孔 Ø25H7 和 Ø25H8，哪个更难加工？",
      options: ["H7：公差 0.021，比 H8 的 0.033 窄", "H8：数字大，精度高", "一样，字母都是 H"],
      answer: 0,
      explain: "数字是标准公差等级，越大公差越宽。18–30 mm 段里 IT7 = 21 µm，IT8 = 33 µm。H 只说明下偏差为 0，两者的带都从 Ø25.000 开始。",
    },
    {
      q: "H7/k6 是什么配合？",
      options: ["间隙配合，一定能推进去", "过渡配合，随手拿的一对可能有间隙也可能有过盈", "过盈配合，一定要压入"],
      answer: 1,
      explain: "k6 的轴带（+2 到 +15 µm）和 H7 的孔带（0 到 +21 µm）重叠。最大间隙 0.019，最大过盈 0.015，装配时一般轻敲装入。",
    },
    {
      q: "为什么国标优先用基孔制？",
      options: ["孔比轴重要", "孔用定尺寸的刀具和塞规加工检验，孔都用 H 可以少备刀具量规", "基孔制的配合更紧"],
      answer: 1,
      explain: "钻头、铰刀、拉刀和塞规的尺寸是固定的，孔的公差带种类越少越省事；轴车削、磨削什么尺寸都好做。松紧同名的基孔制和基轴制配合，间隙或过盈相同，紧不紧和制度无关。",
    },
  ],
  takeaways: [
    "公差 = 上极限偏差 − 下极限偏差；公差等级（IT 后的数字）管带宽，字母（基本偏差）管带的位置",
    "孔带在轴带上方是间隙配合，在下方是过盈配合，重叠是过渡配合；看最大、最小间隙或过盈来判断",
    "优先用基孔制：孔一律 H，换轴的字母得到不同松紧；H7/g6 滑动、H7/h6 定位、H7/k6 过渡、H7/p6 压入",
  ],
  next: { to: "/lesson/gdt-basics", label: "GD&T 入门", text: "尺寸公差只管大小，形状、方向、位置要靠几何公差。" },
  overlay: ({ s }) => <FitPanel s={s} />,
}

/** Each random pair as a dot: right of zero has clearance, left has interference. */
function SampleStrip({ samples }: { samples: number[] }) {
  if (!samples.length) return null
  const x = (um: number) => 8 + ((um + 20) / 40) * 224
  return (
    <div className="mt-4">
      <div className="text-small text-muted-foreground">抽到的 {samples.length} 对</div>
      <svg width={240} height={44} viewBox="0 0 240 44" className="mt-1 block text-foreground" aria-label="抽样结果">
        <line x1={8} x2={232} y1={22} y2={22} stroke="currentColor" strokeOpacity={0.25} />
        <line x1={x(0)} x2={x(0)} y1={8} y2={30} stroke="currentColor" />
        {samples.map((v, i) => (
          <circle key={i} cx={x(v)} cy={22} r={4} className={v > 0 ? "text-success" : "text-destructive"} fill="currentColor" fillOpacity={0.75} />
        ))}
        <text x={x(-10)} y={42} textAnchor="middle" fill="currentColor" className="text-caption text-muted-foreground">
          过盈
        </text>
        <text x={x(10)} y={42} textAnchor="middle" fill="currentColor" className="text-caption text-muted-foreground">
          间隙
        </text>
      </svg>
    </div>
  )
}

export default lesson
