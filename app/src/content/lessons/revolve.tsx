import { Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { RevolveScene, type RevolveState } from "./revolve.scene"
import type { LessonDef } from "./types"

/** 1.2.2 「旋转」: half profile + axis → solid of revolution. */
const lesson: LessonDef<RevolveState, RevolveScene> = {
  id: "revolve",
  codes: ["1.2.2"],
  title: "旋转：半截面绕轴转一圈",
  create: (v, emit) => new RevolveScene(v, emit),
  steps: [
    {
      title: "只画一半",
      body: (
        <>
          <p>杯子、瓶子、轴、灯罩，这些回转体在 CAD 里都只画一半截面：从中心线到外轮廓。另一半由「旋转」生成。</p>
          <p>截面贴着中心线的那条边，就是旋转轴所在的位置。</p>
        </>
      ),
      task: { label: "拖动轮廓上的蓝点，改出一个你喜欢的瓶形", done: (s) => s.dragged },
      terms: ["sketch", "revolve"],
    },
    {
      title: "绕轴转一圈",
      body: <p>截面绕轴转过的每一个角度都会留下一条轮廓，360° 之后合成一个实体。拖动下面的角度，看实体怎么一点点长出来。</p>,
      task: { label: "把角度拖到 360°", done: (s) => s.angle >= 360 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label="旋转角度" unit="°" value={s.angle} min={0} max={360} step={5} onChange={(v) => c.setAngle(v)} />
          <Button size="sm" variant="secondary" onClick={() => c.play()}>
            <Play />
            播放旋转过程
          </Button>
        </div>
      ),
      terms: ["revolve"],
    },
    {
      title: "不一定转满一圈",
      body: <p>旋转的角度可以小于 360°。门把手的半圆、扇形的风道，都是转一部分得到的。</p>,
      task: { label: "试一个 180° 左右的角度", done: (s) => s.triedHalf },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="把角度改成 180°，会得到什么？"
            options={["一个完整的实体，只是更薄", "半个实体，两端各有一个平的截面", "什么也得不到，旋转必须是 360°"]}
            answer={1}
            explain="转到哪里，实体就长到哪里；起点和终点各留下一个和草图一样的平面截面。"
            onReveal={() => c.setAngle(180)}
          />
          <ParamSlider className="mt-3 px-0" label="旋转角度" unit="°" value={s.angle} min={0} max={360} step={5} onChange={(v) => c.setAngle(v)} />
        </>
      ),
    },
    {
      title: "轮廓不能越过轴",
      body: (
        <>
          <p>如果截面有一部分跑到了轴的另一侧，旋转时它会和自己转出来的部分撞在一起，软件会报自交错误。</p>
          <p>把一个蓝点拖过中心线试试。</p>
        </>
      ),
      task: { label: "把一个点拖到旋转轴左边", done: (s) => s.triedCross },
      extra: ({ s, c }) =>
        s.crossed ? (
          <>
            <Hint tone="warning">截面越过了旋转轴，实体生成不出来。所有软件在这里都会失败：SOLIDWORKS 提示轮廓与中心线相交，Fusion 提示自相交。</Hint>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.reset()}>
              <RotateCcw />
              把轮廓恢复原样
            </Button>
          </>
        ) : null,
    },
    {
      title: "轴不一定贴着轮廓",
      body: <p>旋转轴也可以离开轮廓一段距离。这时中间是空的：转出来的是一个环，比如垫圈、轮胎、管道的弯头。</p>,
      task: { label: "把轴向外移开 10 mm 以上", done: (s) => s.triedOffset },
      extra: ({ s, c }) => (
        <ParamSlider className="mt-3 px-0" label="轮廓到轴的距离" value={s.axisOffset} min={0} max={30} onChange={(v) => c.setAxisOffset(v)} hint="0 表示轮廓贴着轴，转出来是实心的。" />
      ),
    },
  ],
  quiz: [
    {
      q: "画一个旋转体的草图，应该画什么？",
      options: ["完整的截面", "从中心线到外轮廓的一半截面", "物体的俯视轮廓"],
      answer: 1,
      explain: "只画一半，另一半由旋转生成。画完整截面再旋转，会得到重叠的实体。",
    },
    {
      q: "把 360° 的旋转改成 90°，会得到什么？",
      options: ["四分之一个实体，两端各有平截面", "完整实体", "报错"],
      answer: 0,
      explain: "旋转角度决定实体占多大的扇形，两端是和草图一样的截面。",
    },
    {
      q: "为什么轮廓不能越过旋转轴？",
      options: ["软件规定的", "越过的部分旋转后会和自身重叠，形成自交", "会变得太重"],
      answer: 1,
      explain: "轴两侧的轮廓转起来会扫过同一片空间，几何自交，内核无法生成有效实体。",
    },
  ],
  takeaways: ["回转体只画半截面，截面一侧贴着旋转轴", "角度小于 360° 时两端是平的截面", "轮廓越过轴线会自交失败；轴离开轮廓则得到环"],
  next: { to: "/teardown/mug", label: "马克杯拆解", text: "看旋转、圆角、抽壳在一个真实零件里怎么配合。" },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>草图1 · 前视基准面</SceneChip>
      {s.step >= 1 && <SceneChip tone="primary">旋转 {s.angle}°</SceneChip>}
    </div>
  ),
}

export default lesson
