import { Box, CircleAlert, CircleDot, RotateCcw, SquareRoundCorner, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { EDGE_NAMES } from "./fillet-chamfer.geom"
import { FilletScene, holeY, type FilletState } from "./fillet-chamfer.scene"
import type { LessonDef } from "./types"

/** 1.2.6 「圆角与倒角」: pick edges, radius limits, chamfer, G1 vs G0, fillets go last. */

function Selection({ s, c }: { s: FilletState; c: FilletScene }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Readout label="已选" value={s.sel.length} unit="条边" tone={s.sel.length ? "primary" : undefined} />
      {s.sel.length > 0 && (
        <>
          <span className="text-small text-muted-foreground">{s.sel.map((e) => EDGE_NAMES[e]).join("、")}</span>
          <Button size="sm" variant="ghost" onClick={() => c.clearSel()}>
            <RotateCcw />
            清空选择
          </Button>
        </>
      )}
    </div>
  )
}

function Failed({ s, fix }: { s: FilletState; fix: string }) {
  return s.fail ? (
    <Hint tone="warning">
      {s.fail}
      {fix}
    </Hint>
  ) : null
}

const chamferAngle = (s: FilletState) => Math.round((Math.atan2(s.c2, s.c1) * 180) / Math.PI)

const lesson: LessonDef<FilletState, FilletScene> = {
  id: "fillet-chamfer",
  codes: ["1.2.6"],
  title: "圆角与倒角",
  create: (v, emit) => new FilletScene(v, emit),
  steps: [
    {
      title: "圆角作用在边上",
      body: (
        <>
          <p>圆角把两个面之间的尖棱换成一段圆弧面。外观件要手感，受力件要减小应力集中，注塑件要让料流得顺，都离不开它。</p>
          <p>做圆角先选边，再给半径。一次可以选好几条边，共用一个半径，算一个特征。</p>
        </>
      ),
      task: { label: "在模型上点选两条以上的边，再点一次可以取消", done: (s) => s.picked && s.sel.length >= 2 },
      extra: ({ s, c }) => (
        <>
          <Selection s={s} c={c} />
          <ParamSlider className="mt-3 px-0" label="半径 R" value={s.r} min={1} max={25} onChange={(v) => c.setRadius(v)} />
          <Failed s={s} fix="把半径调小，或者少选一条边。" />
        </>
      ),
      note: "选中的边上画着粗线，新长出来的圆角面高亮。竖边和上边一起选，交汇处会生成一块过渡面。",
      noteTitle: "看图",
      terms: ["fillet"],
    },
    {
      title: "半径有上限",
      body: (
        <>
          <p>圆角在两个相邻面上各占掉一条带子，带子宽度就是半径。面不够宽，圆角放不下，特征就失败。</p>
          <p>这块料长 60、宽 30、高 20 mm。顶面只有 30 mm 宽。</p>
        </>
      ),
      task: { label: "把半径推到失败，再调回能做出来", done: (s) => s.triedFail && !s.fail },
      extra: ({ s, c }) => (
        <>
          <Predict
            question="前后两条长边一起倒 R16，会怎样？"
            options={["顶面变成一个半圆拱", "失败：两个圆角要占 32 mm，顶面只有 30 mm", "软件自动把半径缩小到放得下"]}
            answer={1}
            explain="每个圆角在顶面上占 16 mm，两个加起来 32 mm，超过了面宽。普通圆角不会自己缩小半径，只会报错。想要一个半圆的顶，用「完整圆角」这类专门的选项，或者直接在草图里画圆弧。"
            onReveal={() => c.selectLongTop(16)}
          />
          <Selection s={s} c={c} />
          <ParamSlider className="mt-3 px-0" label="半径 R" value={s.r} min={1} max={25} onChange={(v) => c.setRadius(v)} />
          <Failed s={s} fix="把半径调小，或者少选一条边。" />
        </>
      ),
      note: "单独一条边的上限，看它两侧较窄的那个面：前上边单独倒圆角，前侧面只有 20 mm 高，超过 R20 就放不下。两条边夹着同一个面时，两个半径加起来不能超过这个面。",
      noteTitle: "规律",
      terms: ["fillet"],
    },
    {
      title: "倒角：距离 × 距离",
      body: (
        <>
          <p>倒角把棱边切成一个斜面。最常用的定义是「距离 × 距离」：在两个相邻面上各退多少。两个距离相等，斜面就是 45°。</p>
          <p>机加工件常用倒角去毛刺、给装配导向；外观件和注塑件更常用圆角。</p>
        </>
      ),
      task: { label: "把两个距离调成不一样", done: (s) => s.triedUnequal },
      extra: ({ s, c }) => (
        <>
          <Selection s={s} c={c} />
          <ParamSlider className="mt-3 px-0" label="距离 1" value={s.c1} min={1} max={25} onChange={(v) => c.setChamfer(v, s.c2)} />
          <ParamSlider className="px-0" label="距离 2" value={s.c2} min={1} max={25} onChange={(v) => c.setChamfer(s.c1, v)} />
          <div className="mt-2">
            <Readout label="上边的斜面与顶面夹角" value={chamferAngle(s)} unit="°" tone={s.c1 === s.c2 ? "success" : undefined} />
          </div>
          <p className="mt-2 text-caption text-muted-foreground">上边：距离 1 量在顶面上，距离 2 量在侧面上。竖边：距离 1 在长侧面，距离 2 在短侧面。</p>
          <Failed s={s} fix="倒角也一样：面不够宽就放不下。" />
        </>
      ),
      note: "倒角还可以用「距离 × 角度」定义。不等距倒角要分清哪个距离在哪个面上，SOLIDWORKS 和 Fusion 都有一个「反转方向」按钮来交换两边。",
      terms: ["chamfer"],
    },
    {
      title: "相切还是折角",
      body: (
        <>
          <p>这一步只给前上边做圆角。看它在左端面上的截面，伸出来的短线是表面的法向。</p>
          <p>圆角处，法向从侧面一路平滑地转到顶面：圆角和相邻面相切，叫 G1 连续。倒角处，法向在两条棱上突然转向：面和面只是连在一起，叫 G0 连续。</p>
          <p>所以圆角和平面之间那条线画得很淡，它是「切线边」；倒角两侧是真正的尖棱。</p>
        </>
      ),
      task: { label: "在圆角和倒角之间切换，对比法向", done: (s) => s.seenFillet && s.seenChamfer },
      extra: ({ s, c }) => (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-small font-medium">类型</span>
          <Segmented
            size="sm"
            value={s.mode}
            onValueChange={(m) => c.setMode(m)}
            options={[
              { value: "fillet", label: "圆角" },
              { value: "chamfer", label: "倒角" },
            ]}
          />
        </div>
      ),
      note: "G1 只保证切线方向连续，曲率仍然会突变：光亮的外观件上，等半径圆角的边上能看到高光「断」一下。曲率连续（G2）的做法放在 T5 曲面部分讲。",
      noteTitle: "再往前一步",
      terms: ["fillet", "chamfer"],
    },
    {
      title: "圆角放最后",
      body: (
        <>
          <p>后面的特征如果拿圆角的边当参照，圆角一改，它就跟着跑；圆角一删，它就找不到参照。</p>
          <p>这个孔标着离前边 12 mm。切换两种顺序，改一改圆角半径，或者把圆角删掉，看孔1 怎样。</p>
        </>
      ),
      task: { label: "两种顺序下，各改一次半径或删一次圆角", done: (s) => s.triedFirst && s.triedLast },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-small font-medium">顺序</span>
            <Segmented
              size="sm"
              value={s.order}
              onValueChange={(o) => c.setOrder(o)}
              options={[
                { value: "first", label: "先圆角，后打孔" },
                { value: "last", label: "先打孔，后圆角" },
              ]}
            />
          </div>
          <ParamSlider className="mt-3 px-0" label="圆角1 · 半径" value={s.r4} min={2} max={7} onChange={(v) => c.setR4(v)} />
          <Button size="sm" variant="secondary" className="mt-1" onClick={() => c.setFilletOn(!s.filletOn)}>
            {s.filletOn ? <Trash2 /> : <RotateCcw />}
            {s.filletOn ? "删除圆角" : "恢复圆角"}
          </Button>
          {s.order === "first" && !s.filletOn && (
            <Hint tone="warning">孔1 的尺寸标在圆角的切线边上。圆角删掉，这条边就不存在了，孔1 重建失败。</Hint>
          )}
          {s.order === "first" && s.filletOn && (
            <Hint>孔中心离零件前面是 R + 12 mm：圆角一改，孔就跟着挪。可你的本意是「离前面 12 mm」。</Hint>
          )}
          {s.order === "last" && <Hint>孔1 标在拉伸1 的原始棱边上。圆角改多大、删不删，孔都不动。</Hint>}
        </>
      ),
      note: "常见的顺序：主体和功能特征（拉伸、孔、筋）→ 拔模 → 圆角 → 抽壳。抽壳通常放在外圆角之后，内壁才会跟着变圆、壁厚均匀。有些软件会尝试把丢失的参照接到新边上，但不可靠，别指望它。",
      noteTitle: "建模顺序",
      terms: ["fillet", "hole"],
    },
  ],
  quiz: [
    {
      q: "顶面宽 30 mm，前后两条长边一起倒等半径圆角。半径最大能到多少？",
      options: ["15 mm 左右", "30 mm", "没有上限，软件会自动处理"],
      answer: 0,
      explain: "每个圆角在顶面上占一个半径宽，两个加起来不能超过 30 mm，所以上限约 R15。正好等于时顶面被吃完，很多软件也会失败。",
    },
    {
      q: "为什么圆角通常放在特征树的后面？",
      options: ["圆角算得最快，放后面省时间", "后面的特征若引用圆角的边，改圆角或删掉它时引用会断", "软件规定圆角只能最后做"],
      answer: 1,
      explain: "圆角会吃掉原来的尖棱，换成新的面和切线边。功能特征先做、参照原始几何，圆角放最后，改起来就不会牵连别人。",
    },
    {
      q: "圆角和倒角跟相邻面的连接有什么不同？",
      options: ["两者都和相邻面相切", "圆角相切（G1），倒角在两条棱上有折角（G0）", "倒角比圆角更光顺"],
      answer: 1,
      explain: "圆角面在边界处和相邻面共用切线方向，法向连续；倒角是一个平面，和相邻面成一个角度，法向在棱上突变。",
    },
  ],
  takeaways: [
    "圆角和倒角作用在边上：先选边，再给半径或距离",
    "圆角在每个相邻面上占一个半径宽，面不够宽就失败",
    "圆角与相邻面相切（G1），倒角只是连上（G0）",
    "圆角放最后，别让功能特征引用圆角的边",
  ],
  next: { to: "/teardown/mug", label: "马克杯拆解", text: "看圆角在一个真实零件的特征树里排在哪里。" },
  overlay: ({ s }) => <Badges s={s} />,
}

function Badges({ s }: { s: FilletState }) {
  if (s.step < 4) {
    const name = s.mode === "fillet" ? "圆角1" : "倒角1"
    const value = s.mode === "fillet" ? `R${s.r}` : `${s.c1} × ${s.c2}`
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip tone={s.fail ? undefined : "primary"} className={cn(s.fail && "text-destructive")}>
          {s.fail ? <CircleAlert /> : <SquareRoundCorner />}
          {name} · {value} · {s.sel.length} 条边
          {s.fail ? " · 失败" : ""}
        </SceneChip>
      </div>
    )
  }
  const holeBroken = holeY(s) === null
  const fillet = { icon: <SquareRoundCorner />, name: "圆角1", bad: false, hidden: !s.filletOn }
  const hole = { icon: holeBroken ? <CircleAlert /> : <CircleDot />, name: "孔1", bad: holeBroken, hidden: false }
  const rows = [{ icon: <Box />, name: "拉伸1", bad: false, hidden: false }, ...(s.order === "first" ? [fillet, hole] : [hole, fillet])].filter((r) => !r.hidden)
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-40 rounded-lg border bg-popover p-1.5 shadow-popover">
      <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">特征树</div>
      {rows.map((r) => (
        <div
          key={r.name}
          className={cn("flex h-7 items-center gap-2 rounded-sm px-2 text-small [&_svg]:size-3.5 [&_svg]:text-muted-foreground", r.bad && "text-destructive [&_svg]:text-destructive")}
        >
          {r.icon}
          {r.name}
        </div>
      ))}
    </div>
  )
}

export default lesson
