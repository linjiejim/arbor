import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  bFirst,
  flatError,
  FRAME_CELLS,
  FRAME_NAME,
  GdtScene,
  HOLE,
  MAG,
  perpError,
  posError,
  SETUP,
  setupError,
  SIZE_TOL,
  SYMBOL_PATHS,
  TOL,
  type FrameKind,
  type GdtState,
  type Standard,
} from "./gdt-basics.scene"
import type { LessonDef } from "./types"

/** 3.2.2 「GD&T 入门：基准与公差带」: frames, flatness, perpendicularity, position, the datum frame, GB vs ASME. */

/** A feature control frame, the same as in the 3D view. */
function Fcf({ kind, className }: { kind: FrameKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-stretch border border-foreground bg-popover font-mono text-small tabular", className)}>
      <span className="flex items-center px-1.5 py-0.5">
        <svg viewBox="0 0 24 16" width={24} height={16} fill="none" stroke="currentColor" strokeWidth={1.4} aria-label={FRAME_NAME[kind]}>
          <path d={SYMBOL_PATHS[kind]} />
        </svg>
      </span>
      {FRAME_CELLS[kind].map((c) => (
        <span key={c} className="flex items-center border-l border-foreground px-1.5 py-0.5">
          {c}
        </span>
      ))}
    </span>
  )
}

const FRAME_TEXT: Record<FrameKind, string> = {
  flat: "平面度 0.05：顶面必须整个夹在相距 0.05 的两个平行平面之间。属于形状公差，不用基准。",
  perp: "垂直度 0.05，基准 A：B 面必须夹在相距 0.05、并且垂直于基准 A 的两个平行平面之间。属于方向公差。",
  pos: "位置度 Ø0.1，基准 A、B、C：孔的轴线必须落在直径 0.1 的圆柱里，圆柱的轴线在理论正确位置上。属于位置公差。",
}

const STANDARDS: { value: Standard; label: string }[] = [
  { value: "iso", label: "国标 · 独立原则" },
  { value: "asme", label: "ASME · Rule #1" },
]

const DOF = [0, 3, 5, 6]

const verdict = (ok: boolean) => (ok ? "合格" : "超差")

function Status({ s }: { s: GdtState }) {
  const chip = (text: string, ok: boolean) => <SceneChip className={ok ? "text-success" : "text-destructive"}>{text}</SceneChip>
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>几何误差放大 {MAG} 倍</SceneChip>
      {s.step === 1 && chip(`平面度误差 ${flatError(s).toFixed(3)} · ${verdict(flatError(s) <= TOL.flat)}`, flatError(s) <= TOL.flat)}
      {s.step === 2 && chip(`垂直度误差 ${perpError(s).toFixed(3)} · ${verdict(perpError(s) <= TOL.perp)}`, perpError(s) <= TOL.perp)}
      {s.step === 3 && chip(`位置度误差 Ø${posError(s).toFixed(3)} · ${verdict(posError(s) <= TOL.pos + 1e-9)}`, posError(s) <= TOL.pos + 1e-9)}
      {s.step === 4 && (
        <SceneChip tone="primary">
          已限制自由度 {DOF[s.order.length]} / 6{s.order.length > 0 && ` · ${s.order.join(" → ")}`}
        </SceneChip>
      )}
      {s.step === 5 && chip(`弯曲 ${s.bow.toFixed(2)} · ${s.standard === "iso" ? "国标" : "ASME"}判${s.standard === "iso" || s.bow <= SIZE_TOL ? "合格" : "超差"}`, s.standard === "iso" || s.bow <= SIZE_TOL)}
    </div>
  )
}

const lesson: LessonDef<GdtState, GdtScene> = {
  id: "gdt-basics",
  codes: ["3.2.2"],
  title: "GD&T 入门：基准与公差带",
  create: (v, emit) => new GdtScene(v, emit),
  steps: [
    {
      title: "框格：一行写清一个要求",
      body: (
        <>
          <p>尺寸公差只管大小。面平不平、歪不歪、孔偏没偏，要靠几何公差。老教材叫形位公差，英文常说 GD&amp;T。</p>
          <p>每个要求写在一个公差框格里，从左到右：特征符号、公差值、基准字母。基准字母写在方框里，用一个三角形连到作为基准的面上，叫基准符号。这块板的底面是 A，左面是 B，前面是 C。</p>
        </>
      ),
      task: { label: "点 3D 里的三个框格，看各管哪个面", done: (s) => s.seen.length >= 3 },
      extra: ({ s }) =>
        s.frame ? (
          <div className="mt-4 rounded-lg border p-3">
            <Fcf kind={s.frame} />
            <p className="mt-2 text-body">{FRAME_TEXT[s.frame]}</p>
          </div>
        ) : (
          <Hint>框格亮起的那个面，就是它管的被测要素。</Hint>
        ),
      note: "GB/T 1182—2018（对应 ISO 1101:2017）把几何公差分成形状、方向、位置、跳动四类。形状公差只看要素自己，方向和位置公差都要相对基准。",
      noteTitle: "国标",
    },
    {
      title: "平面度：两个平行平面",
      body: (
        <>
          <p>平面度的公差带是两个平行平面，间距等于公差值 0.05。实际表面整个落在两个平面之间，就合格。</p>
          <p>平面度是形状公差，没有基准：两个平面可以跟着表面一起倾斜、上下移动，只要找得到一个位置把表面夹住就行。</p>
        </>
      ),
      task: { label: "拖顶面中间的蓝点，让起伏超差；再调回 0.05 以内，把整个面倾斜看看", done: (s) => s.sawFlatFail && s.triedTilt },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="顶面本身很平（起伏 0.02），但整个面斜了 0.1。平面度 0.05 合格吗？"
            options={["不合格，斜了 0.1", "合格：公差带跟着面一起斜", "要先看基准"]}
            answer={1}
            explain="平面度只管面自己平不平，不管它朝哪。两个平行平面跟着斜过去，0.02 的起伏照样夹得住。要管倾斜，得用相对基准的方向公差。"
            onReveal={() => {
              c.setBulge(0.02)
              c.setTilt(0.1)
            }}
          />
          <ParamSlider className="mt-4 px-0" label="起伏" value={s.bulge} min={0} max={0.1} step={0.005} onChange={(v) => c.setBulge(v)} />
          <ParamSlider className="mt-1 px-0" label="整个面倾斜" value={s.tilt} min={-0.12} max={0.12} step={0.01} onChange={(v) => c.setTilt(v)} hint="面的一端比另一端高出多少。" />
        </>
      ),
    },
    {
      title: "垂直度：相对基准 A",
      body: (
        <>
          <p>垂直度的公差带也是两个平行平面，相距 0.05，但必须垂直于基准 A（底面）。B 面可以整体平移，却不能歪：顶边相对底边偏出 0.05 以上就超差。</p>
          <p>同样是倾斜，平面度不在乎，垂直度在乎。区别就在基准：方向公差的公差带要对着基准摆正。</p>
        </>
      ),
      task: { label: "拖 B 面顶边的蓝点让它倾斜：先超差，再拖回合格", done: (s) => s.sawPerpFail && s.sawPerpPass },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="B 面很平，只是向外斜了 0.08。平面度 0.05 和垂直度 0.05 分别合格吗？"
            options={["都合格", "平面度合格，垂直度超差", "都超差"]}
            answer={1}
            explain="面是平的，平面度的公差带跟着斜就能夹住；垂直度的公差带必须垂直于 A，0.05 宽的两个竖直平面夹不住斜出 0.08 的面。"
            onReveal={() => c.setLean(0.08)}
          />
          <div className="mt-4">
            <Readout label="垂直度误差" value={perpError(s).toFixed(3)} unit="mm" tone={perpError(s) <= TOL.perp ? "success" : "warning"} />
          </div>
        </>
      ),
      note: "方向公差顺带管住形状：B 面的平面度误差不可能超过它的垂直度公差。所以已经标了垂直度，就不必再标同样大小的平面度。",
      noteTitle: "顺带",
    },
    {
      title: "位置度：圆柱形公差带",
      body: (
        <>
          <p>孔的位置用方框里的 30 和 25 给出，叫理论正确尺寸。它们不带公差，只定出孔该在的「真实位置」；偏多少由框格管。</p>
          <p>框格里的 Ø0.1 表示公差带是直径 0.1 的圆柱，孔的轴线整个落在圆柱里才合格。</p>
          <p>对比 ±0.05 的坐标公差（虚线方框）：往斜角偏 0.07 的孔也算合格，往正右偏 0.06 却不合格。螺钉穿不穿得过去只看偏了多远，不看往哪偏，所以圆柱公差带更合理。</p>
        </>
      ),
      task: { label: "拖孔的中心：拖出公差带，再拖回来", done: (s) => s.sawPosOut && s.posBack },
      extra: ({ s }) => (
        <div className="mt-4">
          <Readout label="偏 X" value={s.dx.toFixed(3)} unit="mm" />
          <Readout label="偏 Y" value={s.dy.toFixed(3)} unit="mm" />
          <Readout label="位置度" value={`Ø${posError(s).toFixed(3)}`} tone={posError(s) <= TOL.pos + 1e-9 ? "success" : "warning"} />
        </div>
      ),
      note: "ASME Y14.5 把理论正确尺寸叫基本尺寸（basic dimension），同样画方框。孔的位置度常在公差值后加 Ⓜ（最大实体要求）：孔做得越大，允许的位置偏差也越大，国标和 ASME 都有这个规则。",
      noteTitle: "GB 与 ASME",
    },
    {
      title: "基准 A、B、C：按顺序装夹",
      body: (
        <>
          <p>框格里基准字母的顺序，就是检验时把零件靠上去的顺序。第一基准 A：底面贴平平台，3 点接触，限制 3 个自由度；第二基准 B：推靠山，2 点接触，再限制 2 个；第三基准 C：顶到挡块，1 点，限制最后 1 个。这叫 3-2-1 定位。</p>
          <p>这块板的 B 面向外斜了 0.04（垂直度合格），孔中心离 B 面底边 29.94。</p>
        </>
      ),
      task: { label: "点基准符号，按 A、B、C 装好；再重新装夹，先靠 B", done: (s) => s.doneABC && s.triedBFirst },
      extra: ({ s, c }) => {
        const done = s.order.length === 3
        return (
          <>
            <div className="mt-4 flex items-center gap-2">
              <Fcf kind="pos" />
              <Button size="sm" variant="secondary" disabled={s.order.length === 0} onClick={() => c.resetSetup()}>
                <RotateCcw />
                重新装夹
              </Button>
            </div>
            {done && !bFirst(s.order) && s.order[0] === "A" && (
              <Hint>
                A 面先贴平，孔的轴线和平台垂直。B 面斜，只有顶边碰到靠山，孔中心离靠山 {(HOLE.x + SETUP.ex + SETUP.lean).toFixed(2)}，位置度 Ø{setupError(s.order).toFixed(2)}。
              </Hint>
            )}
            {done && bFirst(s.order) && (
              <Hint tone="warning">
                先靠 B，零件被斜的 B 面带着转了一个角，底面只剩一条边挨着平台，孔的轴线也跟着斜了。同一个零件，位置度从 Ø{setupError(["A", "B", "C"]).toFixed(2)} 变成 Ø{setupError(s.order).toFixed(2)}。A 是装配时贴合的安装面，所以图纸让它当第一基准。
              </Hint>
            )}
          </>
        )
      },
      note: "ASME Y14.5 和 GB/T 1182 都用框格里的字母顺序表示第一、第二、第三基准，建立方式也一样；ASME 把平台、靠山这些叫 datum feature simulator（基准要素模拟体）。",
      noteTitle: "GB 与 ASME",
    },
    {
      title: "国标与 ASME：尺寸公差管不管形状",
      body: (
        <>
          <p>板厚 20 ± 0.1，被压弯了，可每一处量出来都是 20.00。合格吗？两套标准的默认规则不同：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>国标 GB/T 4249（对应 ISO 8015）默认独立原则：尺寸公差只管局部尺寸，两点一量都在 19.9 到 20.1 之间就合格，弯不弯不管。要管形状，另标平面度、直线度，或在尺寸后加 Ⓔ（包容要求）。</li>
            <li>ASME Y14.5 默认 Rule #1（包容原则）：尺寸在最大实体 20.1 时形状必须完美，整块板要能放进相距 20.1 的两个平行平面之间。</li>
          </ul>
        </>
      ),
      task: { label: "拖板中间的蓝点把板压弯 0.1 以上，用两种标准各判一次", done: (s) => s.judged.length >= 2 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4">
            <Segmented size="sm" aria-label="按哪个标准判" value={s.standard} onValueChange={(v) => c.setStandard(v)} options={STANDARDS} />
          </div>
          <ParamSlider className="mt-3 px-0" label="弯曲" value={s.bow} min={0} max={0.2} step={0.01} onChange={(v) => c.setBow(v)} />
          {s.bow > SIZE_TOL && (
            <Hint tone={s.standard === "asme" ? "warning" : undefined}>
              {s.standard === "asme"
                ? `弯了 ${s.bow.toFixed(2)}，加上 20.00 的厚度，放不进 20.1 的包容边界：按 ASME 超差。`
                : `每处厚度都是 20.00，在 19.9 到 20.1 之间：按国标合格。要限制弯曲，图上得另外标出来。`}
            </Hint>
          )}
        </>
      ),
      note: "ASME 图纸上想取消包容原则，在尺寸后加 Ⓘ（独立原则）；国标图纸上没标几何公差的要素，形状按 GB/T 1184 的未注公差检验。",
      noteTitle: "读图时",
    },
  ],
  quiz: [
    {
      q: "B 面本身很平，只是相对底面 A 向外斜了 0.08。平面度 0.05 和垂直度 0.05 | A 各自合格吗？",
      options: ["都合格", "平面度合格，垂直度超差", "都超差"],
      answer: 1,
      explain: "平面度是形状公差，公差带可以跟着面倾斜；垂直度的公差带必须垂直于基准 A，宽 0.05 的带夹不住斜出 0.08 的面。",
    },
    {
      q: "框格 ⌖ | Ø0.1 | A | B | C 里，A、B、C 的先后说明什么？",
      options: ["只是字母顺序，可以随意换", "装夹顺序：先让 A 面 3 点贴平，再靠 B 面 2 点，最后 C 面 1 点", "A 的精度要求最高"],
      answer: 1,
      explain: "第一基准限制 3 个自由度，第二基准 2 个，第三基准 1 个。顺序换了，基准面不完美时零件会摆成另一个姿态，测出的位置度也会变。",
    },
    {
      q: "板厚 20 ± 0.1，弯了 0.3，但处处厚 20.00。按国标的默认规则，厚度这个尺寸合格吗？",
      options: ["合格：国标默认独立原则，尺寸公差只管局部尺寸", "不合格：放不进 20.1 的包容边界", "要看材料"],
      answer: 0,
      explain: "放不进包容边界就不合格，是 ASME Rule #1 的判法。国标默认独立原则，要限制弯曲，得另标平面度或直线度，或者在尺寸后加 Ⓔ。",
    },
  ],
  takeaways: [
    "框格从左到右：特征符号、公差值（带 Ø 是圆柱形公差带）、基准字母（按第一、第二、第三的顺序）",
    "平面度：两平行平面，可随意倾斜；垂直度：两平行平面，必须垂直于基准；位置度：以理论正确尺寸定出的真实位置为轴线的圆柱",
    "基准按 A、B、C 的顺序 3-2-1 建立；国标默认独立原则，ASME 默认包容原则（Rule #1）",
  ],
  overlay: ({ s }) => <Status s={s} />,
}

export default lesson
