import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { CurvatureScene, type Continuity, type CurvatureState } from "./curvature-continuity.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.1.3 · 5.1.4 · 5.1.5 「曲率梳与 G0 / G1 / G2 连续」. */
type Ctx = StepCtx<CurvatureState, CurvatureScene>

const fmtK = (k: number) => (Math.abs(k) < 5e-5 ? "0" : k.toFixed(4))
const fmtR = (k: number) => (Math.abs(k) < 5e-5 ? "∞" : Math.abs(1 / k).toFixed(0))

function ModeSwitch({ s, c }: Ctx) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">接点</span>
      <Segmented
        size="sm"
        aria-label="连续性"
        value={s.mode}
        onValueChange={(m: Continuity) => c.setMode(m)}
        options={[
          { value: "G0", label: "G0 位置" },
          { value: "G1", label: "G1 相切" },
          { value: "G2", label: "G2 曲率" },
        ]}
      />
    </div>
  )
}

function JointReadout({ s }: { s: CurvatureState }) {
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2">
      <Readout label="切线夹角" value={s.angleDiff.toFixed(1)} unit="°" tone={s.angleDiff > 0.5 ? "warning" : "success"} />
      <div className="mt-1">
        <Readout label="κ A 末端" value={fmtK(s.kA)} unit={`/mm · R ${fmtR(s.kA)}`} />
      </div>
      <div className="mt-1">
        <Readout label="κ B 起点" value={fmtK(s.kB)} unit={`/mm · R ${fmtR(s.kB)}`} tone={Math.abs(s.kA - s.kB) < 2e-4 ? "success" : undefined} />
      </div>
    </div>
  )
}

function ResetButton({ c }: { c: CurvatureScene }) {
  return (
    <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.reset()}>
      <RotateCcw />
      恢复曲线
    </Button>
  )
}

const lesson: LessonDef<CurvatureState, CurvatureScene> = {
  id: "curvature-continuity",
  codes: ["5.1.3", "5.1.4", "5.1.5"],
  title: "曲率梳与 G0 / G1 / G2 连续",
  create: (v, emit) => new CurvatureScene(v, emit),
  steps: [
    {
      title: "曲率梳怎么读",
      body: (
        <>
          <p>曲率是半径的倒数：弯得越急，曲率越大；直线的曲率是 0。</p>
          <p>曲率梳在曲线上每隔一段立一根齿：齿垂直于曲线，长度和这一点的曲率成正比。连起齿尖的那条线叫包络线，它比曲线本身更能暴露起伏。</p>
          <p>梳齿从曲线一侧换到另一侧的地方，就是拐点：曲率在那里过零、换号。</p>
        </>
      ),
      task: { label: "拖动控制点，做出一个拐点（梳齿换边）", done: (s) => s.inflection },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label="梳齿长度倍数" unit="" value={s.combScale} min={100} max={1500} step={50} onChange={(v) => c.setCombScale(v)} hint="只改显示比例，不改曲线。" />
          <ResetButton c={c} />
        </>
      ),
      note: "Rhino 用 CurvatureGraph，SOLIDWORKS 在曲线上右键「显示曲率梳形图」，Fusion 用 Curvature Comb Analysis。",
    },
    {
      title: "G0：只是接上",
      body: (
        <>
          <p>两条曲线在接点重合，叫 G0（位置连续）。软件能把它们接成一条，但接点处可以有折角。</p>
          <p>看接点两侧的梳齿：方向不一致，说明切线在这里突然转了一下。</p>
        </>
      ),
      task: { label: "拖动曲线 B 的控制点，看切线夹角怎么变", done: (s) => s.draggedB },
      extra: (ctx) => (
        <>
          <JointReadout s={ctx.s} />
          <ResetButton c={ctx.c} />
        </>
      ),
    },
    {
      title: "G1：切线连续",
      body: (
        <>
          <p>G1（相切连续）要求两侧的切线方向相同。对贝塞尔曲线，切线由端部的两个控制点决定：接点和它两侧的第一个控制点共线，就是 G1。</p>
          <p>切换后，B 的第一个控制点变成方块：它被约束在切线上，只能前后滑。</p>
        </>
      ),
      task: { label: "切换到 G1，让切线夹角变成 0°", done: (s) => s.mode !== "G0" && s.angleDiff < 0.5 },
      extra: (ctx) => (
        <>
          <Predict
            question="切换到 G1 后，接点两侧的梳齿会怎样？"
            options={["完全对齐，看不出接缝", "方向一致了，但长度可能跳变", "梳齿会消失"]}
            answer={1}
            explain="G1 只管切线方向，不管弯曲程度。两侧曲率不同，梳齿在接点处一长一短，包络线出现台阶。反光面上，这一跳就是一道高光折痕。"
            onReveal={() => ctx.c.setMode("G1")}
          />
          <ModeSwitch {...ctx} />
          <JointReadout s={ctx.s} />
        </>
      ),
    },
    {
      title: "G2：曲率也相等",
      body: (
        <>
          <p>G2（曲率连续）在 G1 之上，还要求两侧的曲率相等：梳齿在接点处一样长，包络线接上了。这要用到端部的第三个控制点。</p>
          <p>切到 G2，再拖曲线 A 的点：B 的前三个控制点跟着调整，始终保持 G2。</p>
          <p>
            再往上是 G3：曲率的变化率也连续，包络线在接点处连折角都没有。汽车外观的 Class-A 曲面追求近乎完美的高光，常用到 G3；一般产品以 G2 为基本要求。
          </p>
        </>
      ),
      task: { label: "切到 G2，然后拖动曲线 A 的控制点", done: (s) => s.mode === "G2" && s.draggedInG2 },
      extra: (ctx) => (
        <>
          <ModeSwitch {...ctx} />
          <JointReadout s={ctx.s} />
          <Hint>
            常听到的口诀「接点两侧各一个共线点约等于 G1，各两个约等于 G2」是简化说法。严格的 G2 只要求两侧曲率相等；三个点都共线，只是接点曲率为 0 的特例。
          </Hint>
        </>
      ),
      note: "Rhino 用 MatchCrv 匹配、BlendCrv 混接；SOLIDWORKS 草图里有「相等曲率」几何关系，Fusion 有曲率（Curvature）约束。",
    },
    {
      title: "圆角矩形：圆弧只有 G1",
      body: (
        <>
          <p>最常见的反例：Rhino 默认的圆角矩形由 4 条直线和 4 段 1/4 圆弧组成。直线曲率为 0，圆弧曲率是 1/R，在切点处一下子跳上去，只有 G1。</p>
          <p>换成 G2 混接：曲率从 0 慢慢升起再落回 0，梳子没有台阶。产品外壳上，这就是高光是否「一刀切断」的区别。</p>
          <p>注意 G2 混接的包络线和直线相交成一个角：它是 G2，但不是 G3。</p>
        </>
      ),
      task: { label: "两种圆角都看一遍", done: (s) => s.triedArc && s.triedBlend },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">圆角</span>
            <Segmented
              size="sm"
              aria-label="圆角类型"
              value={s.corner}
              onValueChange={(k) => c.setCorner(k)}
              options={[
                { value: "arc", label: "圆弧（G1）" },
                { value: "blend", label: "G2 混接" },
              ]}
            />
          </div>
          <ParamSlider className="mt-3 px-0" label="梳齿长度倍数" unit="" value={s.combScale} min={100} max={1500} step={50} onChange={(v) => c.setCombScale(v)} />
        </>
      ),
      terms: ["fillet"],
    },
  ],
  quiz: [
    {
      q: "曲率梳在接点处方向一致，但齿长一长一短，这是什么连续？",
      options: ["G0", "G1", "G2"],
      answer: 1,
      explain: "方向一致说明切线连续（G1）；齿长跳变说明曲率不连续，到不了 G2。",
    },
    {
      q: "一个由直线和 1/4 圆弧组成的圆角矩形，在切点处是几阶连续？",
      options: ["G0，有折角", "G1，曲率从 0 跳到 1/R", "G2，因为圆弧和直线相切"],
      answer: 1,
      explain: "相切只保证 G1。直线曲率为 0，圆弧曲率为 1/R，曲率梳在切点处出现台阶。",
    },
    {
      q: "两条三次贝塞尔曲线已经 G1 相接，要做到 G2，还需要调整什么？",
      options: ["只需把接点两侧的第一个控制点拉得一样长", "调整端部第三个控制点到切线的距离，让两侧曲率相等", "把所有控制点放到一条直线上"],
      answer: 1,
      explain: "端点曲率由第三个控制点离切线的距离和第一段臂长共同决定。全部共线只会让曲率为 0，那是特例，不是一般做法。",
    },
  ],
  takeaways: [
    "曲率梳：齿长 ∝ 曲率，换边是拐点，台阶是曲率跳变",
    "G0 位置、G1 切线、G2 曲率；G1 看端部 2 个控制点，G2 还要第 3 个",
    "圆弧圆角只有 G1，要光顺的高光用 G2 混接；G3 和 Class-A 再往上一级",
  ],
  next: { to: "/lesson/zebra-stripes", label: "斑马纹", text: "同样的连续性，换到曲面上用反光来看。" },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>上视基准面 XY</SceneChip>
      {s.step >= 1 && s.step <= 3 && (
        <SceneChip tone="primary">
          {s.mode} · 夹角 {s.angleDiff.toFixed(1)}°
        </SceneChip>
      )}
      {s.step === 4 && <SceneChip tone="primary">{s.corner === "arc" ? "圆弧圆角 · G1" : "G2 混接"}</SceneChip>}
    </div>
  ),
}

export default lesson
