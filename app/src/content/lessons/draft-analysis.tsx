import { ArrowDown, Box, Columns2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { DraftScene, MIN_SMOOTH, MIN_TEXTURE, PART, type DraftState } from "./draft-analysis.scene"
import type { LessonDef } from "./types"

/** 4.4.1 · 4.4.2 · 4.4.3 「注塑：拔模与分型线」. */

function Legend({ window }: { window?: boolean }) {
  const rows = [
    { cls: "bg-axis-y", text: "正拔模：随型腔向上脱出" },
    { cls: "bg-primary", text: "负拔模：随型芯向下脱出" },
    { cls: "bg-scene-modified", text: "拔模不足：低于最小角度" },
    { cls: "bg-axis-x", text: window ? "倒扣：两半模具都脱不出" : "倒扣：反着开模方向倾斜" },
  ]
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      {rows.map((r) => (
        <div key={r.cls} className="contents">
          <span className={`size-3 rounded-xs ${r.cls}`} />
          <span>{r.text}</span>
        </div>
      ))}
    </div>
  )
}

function MouldButton({ s, c }: { s: DraftState; c: DraftScene }) {
  return (
    <Button size="sm" variant="secondary" onClick={() => c.toggleMould()}>
      <Columns2 />
      {s.open > 0.5 ? "合上模具" : "打开模具"}
    </Button>
  )
}

function DraftSlider({ s, c }: { s: DraftState; c: DraftScene }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label="拔模角"
      unit="°"
      value={s.draft}
      min={0}
      max={5}
      step={0.25}
      onChange={(v) => c.setDraft(v)}
      hint="侧壁、凸台、筋、孔一起按这个角度拔模。"
    />
  )
}

const lesson: LessonDef<DraftState, DraftScene> = {
  id: "draft-analysis",
  codes: ["4.4.1", "4.4.2", "4.4.3"],
  title: "注塑：拔模与分型线",
  create: (v, emit) => new DraftScene(v, emit),
  steps: [
    {
      title: "两半模具，一个方向",
      body: (
        <>
          <p>注塑件在两半钢模之间成形。型腔（定模）成形外表面，型芯（动模）成形内表面。塑料冷却后，两半沿同一条直线分开，这个方向叫开模方向。</p>
          <p>这个小盖子开口朝下：型腔向上拔，型芯向下退，零件再被顶出。</p>
        </>
      ),
      task: { label: "打开模具，看两半怎么分开", done: (s) => s.opened },
      extra: ({ s, c }) => (
        <div className="mt-3">
          <MouldButton s={s} c={c} />
        </div>
      ),
    },
    {
      title: "拔模分析",
      body: (
        <>
          <p>现在所有侧壁都是竖直的（拔模角 0°）。开模时竖直面全程贴着钢面摩擦：表面拉伤，零件还可能卡在模具里顶不出来。</p>
          <p>拔模分析按每个面的法向和开模方向的夹角上色。注意负拔模不是错：型芯一侧的面本来就朝下，跟着型芯走。橙色才是要改的。</p>
        </>
      ),
      task: { label: "从下面看看盒子里面：凸台、筋和内壁", done: (s) => s.sawInside },
      extra: ({ c }) => (
        <>
          <Legend />
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.lookBelow()}>
            <ArrowDown />
            从下面看
          </Button>
        </>
      ),
      terms: ["draft"],
    },
    {
      title: "加上拔模角",
      body: (
        <>
          <p>给侧壁一个小斜度，开模的一瞬间零件就和钢面脱开了。</p>
          <p>
            Protolabs 的建议：竖直面最少 0.5°，多数情况 2°；经验上每 25 mm 深约 1°。这个盒子深 {PART.h} mm，分析阈值取 {MIN_SMOOTH}°。各家数值不同，以供应商的 DFM 报告为准。
          </p>
        </>
      ),
      task: { label: "把拔模角加到没有橙色的面", done: (s) => s.draft > 0 && !s.hasLow },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="型腔要向上拔出，盒子外侧壁应该怎么斜？"
            options={["上窄下宽", "上宽下窄", "竖直就行，脱模剂会解决"]}
            answer={0}
            explain="外壁跟着型腔向上走，所以越往上越窄；内腔跟着型芯向下走，所以越往开口越宽。凸台和筋则是根部厚、端部薄。"
            onReveal={() => c.setDraft(2)}
          />
          <DraftSlider s={s} c={c} />
          <Legend />
        </>
      ),
      terms: ["draft"],
    },
    {
      title: "纹理要更大的拔模",
      body: (
        <>
          <p>外观面常做咬花纹理。纹理的凹凸在开模时会刮过钢面，所以带纹理的面要更大的拔模：Protolabs 对轻纹理（PM-T1、PM-T2）要求至少 3°，纹理越深要求越大。</p>
          <p>只有外观面（型腔侧）带纹理，内部结构还按光面算。</p>
        </>
      ),
      task: { label: `换成轻纹理，再把拔模加到 ${MIN_TEXTURE}° 以上`, done: (s) => s.texture && !s.hasLow },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">外观面</span>
            <Segmented
              size="sm"
              aria-label="外观面"
              value={s.texture ? "tex" : "smooth"}
              onValueChange={(v) => c.setTexture(v === "tex")}
              options={[
                { value: "smooth", label: `光面 · ${MIN_SMOOTH}°` },
                { value: "tex", label: `轻纹理 · ${MIN_TEXTURE}°` },
              ]}
            />
          </div>
          <DraftSlider s={s} c={c} />
          {s.texture && s.hasLow && <Hint tone="warning">外壁变成了橙色：{s.draft}° 对光面够了，对纹理不够。</Hint>}
        </>
      ),
    },
    {
      title: "分型线",
      body: (
        <>
          <p>两半模具在零件上的交界线叫分型线。拔模分析里，正拔模区和负拔模区的分界，就是分型线可以走的地方。</p>
          <p>这里它落在盒口外沿：外壁全在型腔里，内腔全在型芯里，盒口底面是两半钢模贴合的封胶面。分型线会在零件上留下一圈细痕，所以通常放在不显眼的边上。</p>
        </>
      ),
      task: { label: "打开模具，看分型线两边各归哪一半", done: (s) => s.openedParting },
      extra: ({ s, c }) => (
        <div className="mt-3">
          <MouldButton s={s} c={c} />
        </div>
      ),
    },
    {
      title: "倒扣：侧面的窗口",
      body: (
        <>
          <p>在侧壁上开一个窗口。填满窗口的那块钢，向上拔会被窗口上沿勾住，向下退又被下沿挡住：两半都脱不出，这就是倒扣。</p>
          <p>解决办法：开模前让一块滑块（侧抽）沿 +X 先退出来。滑块让模具更贵、周期更长；能改设计就先改，比如把窗口改成从顶面通下来的缺口。</p>
        </>
      ),
      task: { label: "试着开模，再加滑块重新开模", done: (s) => s.openedSlider },
      extra: ({ s, c }) => (
        <>
          <Legend window />
          <div className="mt-3 flex flex-wrap gap-2">
            <MouldButton s={s} c={c} />
            <Button size="sm" variant={s.slider ? "secondary" : "primary"} disabled={s.slider} onClick={() => c.setSlider(true)}>
              <Box />
              加滑块
            </Button>
          </div>
          {s.stuck && <Hint tone="warning">型腔拔不动：窗口里的钢被零件勾住了。</Hint>}
        </>
      ),
      note: "侧抽只能在垂直于开模方向的平面里运动，还要能从外侧分型线够到。轻微倒扣有时可以强脱（零件变形后弹回），能不能用看材料和供应商。",
      noteTitle: "工艺说明",
    },
    {
      title: "壁厚要均匀",
      body: (
        <>
          <p>剖开看：外壁 {PART.t} mm；筋根部 1.5 mm，凸台壁 1.5 mm，都是主壁的 60%，不超过 40–60% 的上限。</p>
          <p>塑料从表面开始冷却，厚的地方最后凝固、收缩最多，会把表面拉出凹坑（缩痕），还会翘曲。所以凸台做成空心柱，加强靠筋，不靠把壁加厚。</p>
        </>
      ),
      task: { label: "比较空心柱和实心粗柱", done: (s) => s.triedSolid && s.triedHollow },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">凸台</span>
            <Segmented
              size="sm"
              aria-label="凸台"
              value={s.solidBoss ? "solid" : "hollow"}
              onValueChange={(v) => c.setSolidBoss(v === "solid")}
              options={[
                { value: "hollow", label: "空心柱 + 筋" },
                { value: "solid", label: "实心粗柱" },
              ]}
            />
          </div>
          <div className="mt-3">
            <Readout label="主壁" value={PART.t} unit="mm" />
            <Readout label={s.solidBoss ? "凸台实心直径" : "凸台壁"} value={s.solidBoss ? "13" : "1.5"} unit="mm" tone={s.solidBoss ? "warning" : "success"} />
          </div>
          <Hint>常用塑料的推荐壁厚大致在 1–3.5 mm（Protolabs：ABS 1.14–3.56 mm），具体取决于材料和零件大小。</Hint>
        </>
      ),
      terms: ["shell", "rib"],
    },
  ],
  quiz: [
    {
      q: "拔模分析里，一个盒子的内壁显示为「负拔模」，说明什么？",
      options: ["这些面有问题，必须改", "它们朝开模方向的反向倾斜，随型芯一侧脱模，通常没问题", "零件放反了"],
      answer: 1,
      explain: "分析只给一个开模方向。型芯一侧的面本来就朝下，显示为负拔模；要改的是低于最小角度的面，以及两边都脱不出的倒扣。",
    },
    {
      q: "外观面从光面改成轻纹理，拔模角一般要怎样？",
      options: ["可以减小，纹理会帮助脱模", "不用变", "要加大，轻纹理通常至少 3°"],
      answer: 2,
      explain: "纹理的凹凸在开模时会刮伤或卡住，需要更大的拔模。Protolabs 对轻纹理要求至少 3°，纹理越深要求越大。",
    },
    {
      q: "螺丝柱附近外表面出现凹坑，最合理的改法是？",
      options: ["把凸台做成实心，让它更结实", "凸台改成空心、壁厚取主壁的 40–60%，用筋加强", "把整个外壁加厚"],
      answer: 1,
      explain: "凹坑是缩痕：厚处最后冷却、收缩最多。让壁厚均匀才能根治；加厚只会让缩痕更重。",
    },
  ],
  takeaways: [
    "先定开模方向：型腔成形外表面，型芯成形内表面，所有面都要朝自己那一半拔模",
    "光面至少 0.5°、通常 2°，轻纹理至少 3°；具体数值以供应商的 DFM 报告为准",
    "分型线在正负拔模的分界上；侧孔这类倒扣要靠滑块，能改设计先改设计；壁厚保持均匀",
  ],
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>开模方向 +Z</SceneChip>
      {s.step >= 1 && s.step <= 5 && (
        <SceneChip tone="primary">
          拔模 {s.draft}° · {s.texture ? "轻纹理" : "光面"}
        </SceneChip>
      )}
      {s.section && <SceneChip>剖面 · 前视</SceneChip>}
    </div>
  ),
}

export default lesson
