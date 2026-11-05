import { Check, Eye, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, SceneChip } from "@/components/lesson-ui"
import { ZebraScene, type Blend, type ZebraState } from "./zebra-stripes.scene"
import type { LessonDef } from "./types"

/** 5.3.1 · 5.3.3 「斑马纹：用反光看曲面质量」. */

const BLEND_LABEL: Record<Blend, string> = { G0: "G0 尖边", G1: "G1 圆角", G2: "G2 混接" }

function BlendSwitch({ s, c, only }: { s: ZebraState; c: ZebraScene; only?: Blend[] }) {
  const all: Blend[] = only ?? ["G0", "G1", "G2"]
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">接法</span>
      <Segmented size="sm" aria-label="接法" value={s.blend} onValueChange={(b: Blend) => c.setBlend(b)} options={all.map((b) => ({ value: b, label: BLEND_LABEL[b] }))} />
    </div>
  )
}

function ZebraToggle({ s, c }: { s: ZebraState; c: ZebraScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">显示</span>
      <Segmented
        size="sm"
        aria-label="显示"
        value={s.zebra ? "zebra" : "shaded"}
        onValueChange={(v) => c.setZebra(v === "zebra")}
        options={[
          { value: "shaded", label: "着色" },
          { value: "zebra", label: "斑马纹" },
        ]}
      />
    </div>
  )
}

function BlindTest({ s, c }: { s: ZebraState; c: ZebraScene }) {
  const picked = s.guess !== null ? s.order[s.guess] : null
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-small font-medium">样件</span>
        <Segmented
          size="sm"
          aria-label="样件"
          value={String(s.sample)}
          onValueChange={(v) => c.setSample(Number(v))}
          options={[0, 1, 2].map((i) => ({ value: String(i), label: `样件 ${i + 1}` }))}
        />
      </div>
      <Button size="sm" variant="primary" className="mt-3" onClick={() => c.guess()}>
        <Check />
        这个是 G2
      </Button>
      {picked === "G2" && <Hint>答对了。条纹从一个面流到另一个面，宽度渐变，没有折点：这是 G2。</Hint>}
      {picked === "G1" && <Hint tone="warning">这是 G1 圆角：条纹接上了，但在圆角的两条边界上拐了个折。再看看另外两个。</Hint>}
      {picked === "G0" && <Hint tone="warning">这是 G0 尖边：条纹在边上错开、断了。再看看另外两个。</Hint>}
    </>
  )
}

const lesson: LessonDef<ZebraState, ZebraScene> = {
  id: "zebra-stripes",
  codes: ["5.3.1", "5.3.3"],
  title: "斑马纹：用反光看曲面质量",
  create: (v, emit) => new ZebraScene(v, emit),
  steps: [
    {
      title: "反光比形状更挑剔",
      body: (
        <>
          <p>这是一个外壳的肩部：顶面和侧面，中间用圆角过渡。着色看上去很顺。</p>
          <p>斑马纹假装零件放在一排平行的灯管下面，把灯管的倒影画成黑白条纹。反光对曲率的变化极其敏感，着色里看不出的问题，条纹一眼就暴露。</p>
        </>
      ),
      task: { label: "打开斑马纹", done: (s) => s.zebra },
      extra: ({ s, c }) => <ZebraToggle s={s} c={c} />,
      note: "Rhino 用 Zebra，SOLIDWORKS 叫「斑马条纹」，Fusion 用 Zebra Analysis，Alias 还有 Light Tunnel 和 Iso-Angle。",
      noteTitle: "各软件叫法",
    },
    {
      title: "三种接法，三种条纹",
      body: (
        <>
          <p>G0：两个面只是在边上碰到，法向在边上突变，条纹在边上错开、断开。</p>
          <p>G1：法向连续，条纹接上了；但曲率在圆角边界上从 0 跳到 1/R，条纹在那里拐出一个折。</p>
          <p>G2：曲率也连续，条纹从一个面顺滑地流到另一个面，宽度渐变。</p>
        </>
      ),
      task: { label: "三种接法都看一遍", done: (s) => s.seenG0 && s.seenG1 && s.seenG2 },
      extra: ({ s, c }) => <BlendSwitch s={s} c={c} />,
    },
    {
      title: "盲测：哪个是 G2",
      body: <p>三个样件，顺序打乱了，也不告诉你是哪种接法。只看条纹，挑出 G2。</p>,
      task: { label: "找出 G2 的样件", done: (s) => s.guessedRight },
      extra: ({ s, c }) => <BlindTest s={s} c={c} />,
    },
    {
      title: "圆角为什么不够",
      body: (
        <>
          <p>普通的等半径圆角（滚球圆角）截面是一段圆弧，只有 G1。半径改大改小，折点都还在，只是位置变了。</p>
          <p>G2 混接要占更长的过渡距离（这里约 1.5 倍），换来的是没有断点的高光。SOLIDWORKS 圆角有「曲率连续」选项，Plasticity 的圆角有 G2 剖面，Rhino 用 BlendSrf。</p>
        </>
      ),
      task: { label: "改一改圆角大小，比较 G1 和 G2", done: (s) => s.radiusChanged && s.seenG1 && s.seenG2 },
      extra: ({ s, c }) => (
        <>
          <BlendSwitch s={s} c={c} only={["G1", "G2"]} />
          <ParamSlider className="mt-3 px-0" label="圆角大小" value={s.radius} min={6} max={26} onChange={(v) => c.setRadius(v)} />
        </>
      ),
      terms: ["fillet"],
    },
    {
      title: "汽车和家电上的高光",
      body: (
        <>
          <p>车身、手机、家电外壳在展厅灯光下，人看到的就是这些高光线。高光一折，看上去就是「面没做好」。</p>
          <p>一般产品以 G2 为光顺的基本要求。汽车外观的 Class-A 曲面追求近乎完美的高光，接缝处常做到 G3。</p>
          <p>条纹会随视角移动：检查时要多转几个角度，让条纹扫过每一条接缝。</p>
        </>
      ),
      task: { label: "转动视图，看条纹怎么流动", done: (s) => s.orbited },
      extra: ({ s, c }) => (
        <>
          <BlendSwitch s={s} c={c} />
          <ParamSlider className="mt-3 px-0" label="条纹密度" unit="" value={s.freq} min={4} max={20} onChange={(v) => c.setFreq(v)} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.resetView()}>
            <LocateFixed />
            回到原视角
          </Button>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: "斑马纹在两个面的交界处错开、断开，说明交界是几阶连续？",
      options: ["G0", "G1", "G2"],
      answer: 0,
      explain: "条纹断开说明法向突变：只有位置连续（G0），交界处有折边。",
    },
    {
      q: "条纹在交界处接上了，但拐出一个尖角，这是？",
      options: ["G0", "G1", "G2"],
      answer: 1,
      explain: "接上说明法向连续（G1）；拐折说明曲率跳变，到不了 G2。等半径圆角的典型样子。",
    },
    {
      q: "把 G1 圆角的半径加大一倍，条纹的拐折会怎样？",
      options: ["消失，大半径就是 G2", "还在，只是换了位置；要去掉得改用曲率连续的混接", "变成断开"],
      answer: 1,
      explain: "圆弧截面的圆角无论多大都只有 G1：曲率在边界上从 0 跳到 1/R。要光顺得换 G2 混接。",
    },
  ],
  takeaways: [
    "斑马纹是平行灯管的反光：断开 = G0，拐折 = G1，顺滑流过 = G2",
    "等半径圆角只有 G1，改半径去不掉高光折点；要光顺用曲率连续的混接",
    "一般产品以 G2 为光顺底线，汽车 Class-A 常做到 G3；检查时多转几个角度",
  ],
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Eye />
        {s.zebra ? "斑马纹" : "着色"}
      </SceneChip>
      {s.step !== 2 && s.step !== 0 && <SceneChip tone="primary">{BLEND_LABEL[s.blend]}</SceneChip>}
      {s.step === 2 && <SceneChip tone="primary">样件 {s.sample + 1}</SceneChip>}
    </div>
  ),
}

export default lesson
