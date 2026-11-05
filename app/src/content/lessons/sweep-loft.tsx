import { Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { isTight, SweepLoftScene, type SweepLoftState } from "./sweep-loft.scene"
import type { LessonDef } from "./types"

/** 1.2.8 「扫掠与放样」: profile + path; sections + start-point alignment + guide curves. */
const fmt = (n: number) => (n >= 100 ? "∞" : n.toFixed(n < 10 ? 1 : 0))

const lesson: LessonDef<SweepLoftState, SweepLoftScene> = {
  id: "sweep-loft",
  codes: ["1.2.8"],
  title: "扫掠与放样",
  create: (v, emit) => new SweepLoftScene(v, emit),
  steps: [
    {
      title: "扫掠：截面沿路径走",
      body: (
        <>
          <p>扫掠要两样东西：一个闭合的截面，一条路径。截面沿路径走一遍，扫过的空间就是实体。把手、管子、线缆、弹簧都这样建。</p>
          <p>默认情况下，截面走到哪里都保持和路径垂直。</p>
        </>
      ),
      task: { label: "把扫掠过程拖到 100%", done: (s) => s.sweep >= 100 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label="扫掠过程" unit="%" value={s.sweep} min={0} max={100} onChange={(v) => c.setSweep(v)} />
          <Button size="sm" variant="secondary" onClick={() => c.playSweep()}>
            <Play />
            播放扫掠
          </Button>
        </div>
      ),
      terms: ["sweep"],
    },
    {
      title: "改路径，实体跟着走",
      body: (
        <>
          <p>路径就是一张普通草图，这里画在前视基准面上。路径一改，扫掠重新计算。</p>
          <p>截面画在路径起点，所在的平面和路径垂直。</p>
        </>
      ),
      task: { label: "拖动路径上的蓝点，改出一个新形状", done: (s) => s.dragged },
      note: "截面要放在路径起点、并且垂直于路径。没放对，有的软件会报错，有的会扫出一个歪斜的结果。",
    },
    {
      title: "弯太急会自交",
      body: (
        <>
          <p>截面靠弯曲内侧的那部分，走过的路比路径本身短。弯得越急，内侧越挤。</p>
          <p>一旦路径的弯曲半径小于截面半径，内侧就会折到自己身上：自交，内核拒绝生成。</p>
        </>
      ),
      task: { label: "让路径的最小弯曲半径小于截面半径", done: (s) => s.triedTight },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="截面半径 7 mm，把路径的弯拉急到弯曲半径只有 4 mm 左右，会怎样？"
            options={["照样扫出来，只是弯处更扁一点", "弯的内侧截面互相穿插，自交失败", "软件自动把弯改大，正常生成"]}
            answer={1}
            explain="内侧离弯曲中心只有 4 mm，可截面要往里伸 7 mm，伸过了中心，相邻的截面就互相穿插。CAD 内核不接受自交的实体，这一步会失败。"
            onReveal={() => c.tighten()}
          />
          <div className="mt-4">
            <Readout label="最小弯曲半径" value={`R${fmt(s.minBend)}`} tone={isTight(s) ? "warning" : undefined} />
            <Readout label="截面半径" value={`R${fmt(s.radius)}`} />
          </div>
          <ParamSlider className="mt-2 px-0" label="截面半径" value={s.radius} min={3} max={14} step={0.5} onChange={(v) => c.setRadius(v)} />
          {isTight(s) && (
            <>
              <Hint tone="warning">
                最小弯曲半径小于截面半径。半透明的是会被拒绝的结果：内侧折叠。SOLIDWORKS、Fusion 在这里都会报自相交。修法：把弯改缓（拖开路径点，或给路径的拐角加大圆角），或者把截面改小。
              </Hint>
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.resetPath()}>
                <RotateCcw />
                恢复路径
              </Button>
            </>
          )}
        </>
      ),
      note: "虚线圆是最急那一处的「密切圆」，它的半径就是弯曲半径。经验上，路径弯曲半径至少取截面半径的 1.5 倍，留出余量。",
      noteTitle: "怎么看",
    },
    {
      title: "放样：截面之间过渡",
      body: (
        <>
          <p>放样不需要路径，只要两个或更多截面，软件在它们之间生成过渡面。</p>
          <p>这是一个方变圆：底部 40 × 40 的正方形，顶部直径 40 的圆，相距 60 mm。</p>
        </>
      ),
      task: { label: "把放样过程拖到 100%", done: (s) => s.loft >= 100 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label="放样过程" unit="%" value={s.loft} min={0} max={100} onChange={(v) => c.setLoft(v)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.playLoft()}>
              <Play />
              播放放样
            </Button>
            <Segmented
              size="sm"
              value={String(s.sections) as "2" | "3"}
              onValueChange={(v) => c.setSections(v === "3" ? 3 : 2)}
              options={[
                { value: "2", label: "两个截面" },
                { value: "3", label: "加中间截面" },
              ]}
              aria-label="截面数量"
            />
          </div>
          {s.sections === 3 && <Hint>中间加了一个直径 24 的圆：放样光顺地穿过每一个截面，收出一个腰。截面越多，形状越可控。</Hint>}
        </div>
      ),
      note: "只有两个截面、不加起止约束时，侧面基本是直的。想让它鼓起来或收进去，就加中间截面、设起止相切，或者用下一步的引导线。",
      noteTitle: "说明",
      terms: ["loft"],
    },
    {
      title: "起点要对齐",
      body: (
        <>
          <p>放样把每个截面上的点一一对应连起来，从各自的「起点」开始数。蓝点是起点，虚线是起点之间的连线。</p>
          <p>起点对齐，侧面是顺的；起点错开，连线就斜着绕上去。</p>
        </>
      ),
      task: { label: "把顶部的起点转开 30° 以上", done: (s) => s.triedTwist },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="把顶部圆的起点转 90°，其他都不变，放样会怎样？"
            options={["没变化：圆怎么转都还是那个圆", "侧面扭起来，像拧过的毛巾", "放样失败，直接报错"]}
            answer={1}
            explain="圆的形状没变，但对应关系变了：底部角点要连到转开 90° 的那个点上，每条连线都斜着走，侧面就扭了。软件不会报错，它照做，只是做出来的不是你要的。"
            onReveal={() => c.setTwist(90, true)}
          />
          <ParamSlider className="mt-3 px-0" label="顶部起点转角" unit="°" value={s.twist} min={0} max={180} step={5} onChange={(v) => c.setTwist(v)} />
          {s.twist >= 150 && <Hint tone="warning">转到接近 180°，每条连线都穿过中轴，中间收成一个点：几何退化，实际软件会生成自交的面或直接失败。</Hint>}
          {s.twist > 0 && s.twist < 150 && <Hint>把转角拉回 0，起点重新对齐，侧面就顺了。放样扭了，先检查起点。</Hint>}
        </>
      ),
      note: "SOLIDWORKS 用绿色的「接头」标出对应点，可以直接拖；其他软件也能指定对应点或起点。原理一样：放样前先看清每个截面的起点在哪。",
    },
    {
      title: "引导线：管住中间",
      body: (
        <>
          <p>截面只管两头，中间怎么走由软件插值。引导线是一条穿过各个截面的曲线，放样的侧面必须沿着它走。</p>
          <p>拖动滑杆，让引导线外凸或内收。这里四个角各有一条相同的引导线，图上只画出一条。</p>
        </>
      ),
      task: { label: "改一次引导线的形状", done: (s) => s.triedBulge },
      extra: ({ s, c }) => (
        <ParamSlider className="mt-3 px-0" label="引导线外凸" value={s.bulge} min={-10} max={15} onChange={(v) => c.setBulge(v)} hint="负值是内收。截面不变，变的是中间。" />
      ),
      note: "引导线必须和每个截面相交，通常交在截面的顶点上，否则放样失败。扫掠也能加引导线，让截面边走边变大小。",
    },
  ],
  quiz: [
    {
      q: "扫掠一根半径 6 mm 的管子，路径上有一处弯曲半径只有 4 mm，会怎样？",
      options: ["正常生成，只是弯处会变扁", "内侧自交，扫掠失败；要把弯改缓或把管子改细", "软件会自动把弯改成 6 mm"],
      answer: 1,
      explain: "弯曲半径小于截面半径，内侧截面伸过了弯曲中心，互相穿插。内核不接受自交实体，也不会替你改路径。",
    },
    {
      q: "方变圆的放样扭成了麻花，最可能的原因是？",
      options: ["截面数量太少", "两个截面的起点（对应点）没对齐", "两个截面不在平行的平面上"],
      answer: 1,
      explain: "放样按起点一一对应连线，起点错开，侧面就扭。截面少只会让形状不好控制；截面也不必互相平行。",
    },
    {
      q: "下面哪个零件更适合用放样，而不是扫掠？",
      options: ["一根粗细不变、弯来弯去的线缆", "一个从方口过渡到圆口的通风接头", "一根直的圆轴"],
      answer: 1,
      explain: "截面形状在变、而且没有明确路径，就用放样。粗细不变沿曲线走是扫掠；直的圆轴拉伸或旋转就够了。",
    },
  ],
  takeaways: [
    "扫掠 = 截面 + 路径：截面放在路径起点并垂直于路径，路径的弯曲半径要大于截面半径",
    "放样 = 两个以上截面之间过渡：各截面的起点（对应点）不对齐就会扭",
    "截面只管两头，中间的走向用更多截面或引导线来控制",
  ],
  next: { to: "/teardown/mug", label: "马克杯拆解", text: "杯把就是一次扫掠：看截面和路径在真实零件里怎么放。" },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      {s.step <= 2 ? (
        <>
          <SceneChip>草图1 路径 · 前视基准面 XZ</SceneChip>
          <SceneChip tone={isTight(s) ? undefined : "primary"} className={isTight(s) ? "text-destructive" : undefined}>
            {isTight(s) ? "扫掠失败：自交" : `扫掠 ${s.sweep}%`}
          </SceneChip>
        </>
      ) : (
        <>
          <SceneChip>{s.sections} 个截面</SceneChip>
          <SceneChip tone="primary">放样 {s.loft}%</SceneChip>
          {s.step >= 4 && s.twist !== 0 && <SceneChip className="text-warning">起点错开 {s.twist}°</SceneChip>}
        </>
      )}
    </div>
  ),
}

export default lesson
