import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { fmt, linearLayout, MARGIN, PatternMirrorScene, polarStep, type PatternMirrorState } from "./pattern-mirror.scene"
import type { LessonDef } from "./types"

/** 1.2.5 「阵列与镜像」: copy a seed feature by a rule — linear, circular, mirror. */

function outHint(s: PatternMirrorState) {
  const lay = linearLayout(s)
  return (
    <>
      {lay.outCount > 0 && (
        <Hint tone="warning">
          有 {lay.outCount} 个孔超出了板边。真实软件里，部分在外的孔会在板边切出缺口，完全在外的什么也切不到，有的软件会直接报错。
        </Hint>
      )}
      {lay.outCount === 0 && lay.overlap && (
        <Hint tone="warning">间距小于孔径，相邻的孔连成了一条槽。总长驱动守住了边界，但板短孔多时会挤在一起：这时该减数量，或者给间距设下限。</Hint>
      )}
    </>
  )
}

const lesson: LessonDef<PatternMirrorState, PatternMirrorScene> = {
  id: "pattern-mirror",
  codes: ["1.2.5"],
  title: "阵列与镜像",
  create: (v, emit) => new PatternMirrorScene(v, emit),
  steps: [
    {
      title: "先有一个种子",
      body: (
        <>
          <p>一排孔、一圈螺栓孔、左右对称的两只耳朵，在 CAD 里都不是一个个画出来的。先做一个，再让软件按规则复制。</p>
          <p>被复制的那个特征叫「种子」，也叫源特征。后面所有的实例都引用它。</p>
        </>
      ),
      task: { label: "在视图里点选板上的孔", done: (s) => s.seedPicked },
      terms: ["pattern"],
    },
    {
      title: "线性阵列：数量和间距",
      body: (
        <>
          <p>线性阵列要三样东西：方向、数量、间距。这里方向是 X 轴，间距是相邻两个孔中心之间的距离。</p>
          <p>数量包含种子本身。5 个孔只有 4 个间隔，首尾中心距是 4 × 间距。</p>
        </>
      ),
      task: { label: "把数量调到 5 个", done: (s) => s.count >= 5 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 space-y-2">
            <ParamSlider className="px-0" label="数量" unit="个" value={s.count} min={2} max={8} onChange={(v) => c.setCount(v)} />
            <ParamSlider className="px-0" label="间距" value={s.spacing} min={10} max={30} onChange={(v) => c.setSpacing(v)} />
          </div>
          {outHint(s)}
        </>
      ),
      note: "SOLIDWORKS、Fusion、Onshape 的数量都含种子。有的软件还能改成输入首尾之间的总距离，下一步就讲它。",
      terms: ["pattern"],
    },
    {
      title: "间距驱动还是总长驱动",
      body: (
        <>
          <p>同样 5 个孔，有两种说法。「间距驱动」：孔距固定。「总长驱动」：首尾两个孔之间的距离固定，间距 = 总长 ÷ (数量 − 1)。</p>
          <p>这里把总长关联到板长：总长 = 板长 − 2 × {MARGIN} mm 边距。板变了，哪种说法还成立？</p>
        </>
      ),
      task: { label: "两种方式下都把板长缩到 100 mm 以下", done: (s) => s.shrunkSpacing && s.shrunkLength },
      extra: ({ s, c }) => {
        const lay = linearLayout(s)
        return (
          <>
            <Predict
              question="间距 22 mm 的 5 个孔，板长从 120 缩到 80，会怎样？"
              options={["5 个孔自动挤进 80 mm 的板里", "孔距不变，最后两个孔跑到板边外", "阵列自动减到放得下的数量"]}
              answer={1}
              explain="间距驱动只守住孔距。板变短，阵列不会自己收缩，也不会自己删实例。想让孔跟着板走，就用总长驱动，或者把间距写成板长的方程。"
              onReveal={() => c.revealShrink()}
            />
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-small font-medium">驱动方式</span>
                <Segmented
                  size="sm"
                  value={s.mode}
                  onValueChange={(m) => c.setMode(m)}
                  options={[
                    { value: "spacing", label: "间距驱动" },
                    { value: "length", label: "总长驱动" },
                  ]}
                />
              </div>
              <ParamSlider className="px-0" label="板长" value={s.plateLen} min={70} max={160} onChange={(v) => c.setPlateLen(v)} />
              <div>
                <Readout label="间距" value={fmt(lay.spacing)} unit="mm" tone={s.mode === "length" ? "primary" : undefined} />
                <Readout label="首尾中心距" value={fmt(lay.spacing * (s.count - 1))} unit="mm" />
              </div>
            </div>
            {outHint(s)}
          </>
        )
      },
      terms: ["pattern"],
    },
    {
      title: "改种子，实例全跟着变",
      body: (
        <>
          <p>阵列出来的实例不是独立的孔，它们引用种子。改种子的直径，所有实例一起变；单独改其中一个实例是改不了的。</p>
          <p>某个位置不想要孔，用阵列的「跳过实例」，而不是删掉重画。</p>
        </>
      ),
      task: { label: "改一次种子孔的直径", done: (s) => s.diamChanged },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label="种子 · 孔径" value={s.diameter} min={4} max={16} onChange={(v) => c.setDiameter(v)} hint="橙色的是跟着种子重算的实例。" />
          {outHint(s)}
        </>
      ),
    },
    {
      title: "圆周阵列：绕轴均布",
      body: (
        <>
          <p>法兰上的螺栓孔绕中心轴均布。圆周阵列要一根轴、数量和角度。</p>
          <p>转满 360° 时，间隔 = 360° ÷ 数量：最后一个孔和第一个相邻，不重叠。不满一圈时，首尾两个孔分别落在起点和终点，间隔 = 总角度 ÷ (数量 − 1)。</p>
        </>
      ),
      task: { label: "数量设为 6，再试一个小于 360° 的总角度", done: (s) => s.polarSix && s.triedPartial },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 space-y-2">
            <ParamSlider className="px-0" label="数量" unit="个" value={s.polarCount} min={3} max={12} onChange={(v) => c.setPolarCount(v)} />
            <ParamSlider className="px-0" label="总角度" unit="°" value={s.polarAngle} min={30} max={360} step={15} onChange={(v) => c.setPolarAngle(v)} />
          </div>
          <div className="mt-2">
            <Readout label="间隔" value={fmt(polarStep(s.polarCount, s.polarAngle))} unit="°" tone="primary" />
            <Readout label="算法" value={s.polarAngle >= 360 ? `360 ÷ ${s.polarCount}` : `${s.polarAngle} ÷ ${s.polarCount - 1}`} />
          </div>
        </>
      ),
      note: "多数软件的「等间距」都按这个规则算。如果整圈也用 ÷ (数量 − 1)，最后一个孔会和第一个重合。",
      terms: ["pattern"],
    },
    {
      title: "镜像：只建一半",
      body: (
        <>
          <p>左右对称的零件只建一半，再关于中间的平面镜像。镜像出来的那一半跟着种子走：改这一半，另一半自动对称地变。</p>
          <p>拖动凸台顶上的蓝点挪一挪，或者改它的高度。</p>
        </>
      ),
      task: { label: "移动这一侧的凸台，或改它的高度", done: (s) => s.mirrorEdited },
      extra: ({ s, c }) => (
        <ParamSlider className="mt-3 px-0" label="凸台高度" value={s.bossH} min={8} max={30} onChange={(v) => c.setBossH(v)} />
      ),
      noteTitle: "镜像特征和镜像实体",
      note: "镜像特征只复制选中的几个特征，比如这个凸台；镜像实体把整个实体翻过去，再和原来的合并。两种都要改种子那一侧：镜像出来的一侧不能单独编辑。",
      terms: ["mirror"],
    },
  ],
  quiz: [
    {
      q: "线性阵列数量 4、间距 20 mm，第一个和最后一个孔的中心距是多少？",
      options: ["80 mm", "60 mm", "20 mm"],
      answer: 1,
      explain: "数量包含种子，4 个实例只有 3 个间隔：3 × 20 = 60 mm。按 4 × 20 算，是把数量当成了间隔数。",
    },
    {
      q: "法兰上要 6 个螺栓孔均布一整圈，相邻两孔之间是多少度？",
      options: ["60°", "72°，即 360° ÷ 5", "取决于孔径"],
      answer: 0,
      explain: "整圈时首尾相邻，6 个孔把 360° 分成 6 份。÷ (数量 − 1) 只用于不满一圈、首尾都落在端点上的情况。",
    },
    {
      q: "左右对称的支架已经做完，现在要把右边的凸台挪一下。哪种建法改起来最省事？",
      options: ["左右各建一遍，两边分别改", "只建左边一半再镜像，改左边那一半", "直接拖动镜像出来的右半边"],
      answer: 1,
      explain: "镜像出来的一侧是跟随的结果，不能单独编辑；改种子那一侧，两边一起变。各建一遍迟早会出现只改了一边的情况。",
    },
  ],
  takeaways: [
    "阵列和镜像复制的是规则：改种子，所有实例跟着变",
    "间距驱动守住孔距，总长驱动守住边界；先想清楚哪个要跟着零件走",
    "圆周阵列整圈用 360° ÷ 数量，不满一圈用 总角度 ÷ (数量 − 1)；对称件只建一半再镜像",
  ],
  overlay: ({ s }) => {
    const lay = linearLayout(s)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        {s.step === 0 && <SceneChip>孔1 · Ø{s.diameter}</SceneChip>}
        {s.step >= 1 && s.step <= 3 && (
          <>
            <SceneChip>孔1 · Ø{s.diameter}</SceneChip>
            <SceneChip tone="primary">
              线性阵列 · {s.count} × {fmt(lay.spacing)} mm{s.step === 2 ? (s.mode === "spacing" ? " · 间距驱动" : " · 总长驱动") : ""}
            </SceneChip>
          </>
        )}
        {s.step === 4 && <SceneChip tone="primary">圆周阵列 · {s.polarCount} × {fmt(polarStep(s.polarCount, s.polarAngle))}°</SceneChip>}
        {s.step === 5 && <SceneChip tone="primary">镜像 · 右视基准面 YZ</SceneChip>}
      </div>
    )
  },
}

export default lesson
