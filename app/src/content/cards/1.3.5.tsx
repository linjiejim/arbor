import type { ReactNode } from "react"
import { Arrow, Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 1.3.5 诊断与修复重建错误. */

type Mark = "ok" | "error" | "warning"
const ROWS: { name: string; note: string; mark: Mark }[] = [
  { name: "拉伸1", note: "", mark: "ok" },
  { name: "草图2", note: "它所在的基准面被删了", mark: "error" },
  { name: "切除1", note: "用的轮廓是草图2", mark: "error" },
  { name: "圆角1", note: "要的边由切除1 生成", mark: "error" },
  { name: "倒角1", note: "生成了，参考有变化", mark: "warning" },
]

const glyph = (mark: Mark, y: number): ReactNode =>
  mark === "ok" ? (
    <circle cx={22} cy={y} r={6} className="text-faint-foreground" />
  ) : mark === "error" ? (
    <g className="text-destructive" strokeWidth={1.75}>
      <path d={`M 17 ${y - 5} L 27 ${y + 5} M 27 ${y - 5} L 17 ${y + 5}`} />
    </g>
  ) : (
    <g className="text-warning" strokeWidth={1.5}>
      <path d={`M 22 ${y - 7} L 29 ${y + 6} H 15 Z`} />
      <path d={`M 22 ${y - 2} V ${y + 2}`} />
    </g>
  )

const card: CardDef = {
  code: "1.3.5",
  title: "重建报错：不重画也能修好",
  minutes: 5,
  sections: [
    {
      heading: "先分清错误和警告",
      body: (
        <>
          <p>改了上游，特征树里就可能亮起标记。错误表示这个特征没能生成；警告表示生成了，但有地方需要注意，比如几何关系悬空了。</p>
          <ul>
            <li>SOLIDWORKS：错误是红色叉，警告是黄色叹号；右键特征选「什么错」看原因。</li>
            <li>Fusion：时间轴上的特征变黄是警告、变红是错误；右键选「审阅警告」或「审阅错误」。</li>
            <li>Onshape：出问题的特征名变成橙色，鼠标悬停显示摘要；特征对话框里丢失的参考显示为红色。</li>
          </ul>
        </>
      ),
    },
    {
      heading: "从最上面那个修起",
      body: (
        <>
          <p>一个特征坏了，引用它的下游特征往往跟着坏，列表里一片红。真正的原因通常在最上面那个。Onshape 的帮助也建议从顶部开始，逐个往下修。</p>
          <ol>
            <li>把回滚条拖到第一个出错的特征下面，只看它。</li>
            <li>读报错：丢了参考？草图不闭合？半径太大？</li>
            <li>修好它，再往下走一个。很多下游错误会自己消失。</li>
          </ol>
          <p>平时也别攒一堆改动再重建：改一处，重建一次（SOLIDWORKS 和 Fusion 都是 Ctrl+B），出了错马上知道是哪一步引起的。</p>
        </>
      ),
    },
    {
      heading: "三类常见原因",
      body: (
        <ul>
          <li>
            <strong>丢了参考。</strong>被引用的面、边或基准面没了，常见于拓扑命名问题。编辑特征，重新选参考。草图的平面丢了不用重画：SOLIDWORKS 用「编辑草图基准面」，Fusion 用「重新定义草图平面」，Onshape 在「修复」里用「替换参考」。
          </li>
          <li>
            <strong>草图本身有问题。</strong>重叠的线、细小的缺口、悬空的几何关系。SOLIDWORKS 的「检查草图合法性」和「修复草图」能找出来，「显示/删除几何关系」里可以筛出悬空的关系。
          </li>
          <li>
            <strong>几何做不出来。</strong>圆角半径超过相邻面、抽壳厚度大于曲率半径。改参数或调整特征顺序；SOLIDWORKS 的 FeatureXpert 能从「什么错」对话框启动，自动尝试修复失败的等半径圆角和拔模。
          </li>
        </ul>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={172} label="特征树里的连锁错误：最上面的草图2 是根源，下游跟着报错">
        {ROWS.map((r, i) => {
          const y = 22 + i * 30
          return (
            <g key={r.name}>
              {glyph(r.mark, y)}
              <T x={40} y={y + 5} className={r.mark === "error" ? "text-destructive" : undefined}>
                {r.name}
              </T>
              <T x={92} y={y + 5} tone="muted">
                {r.note}
              </T>
            </g>
          )
        })}
        <rect x={6} y={38} width={308} height={28} rx={6} className="text-primary" />
        <Arrow x1={250} y1={160} x2={250} y2={70} className="text-primary" />
        <T x={244} y={166} anchor="end" tone="primary">
          先修这一个
        </T>
      </Svg>
    ),
    caption: "草图2 的基准面被删，它下游的切除和圆角跟着出错。修好草图2（换一个基准面），后面的错误多半自己消失。",
    after: 1,
  },
  table: {
    caption: "各软件里的对应工具",
    head: ["要做的事", "SOLIDWORKS", "Fusion", "Onshape"],
    rows: [
      ["看出错原因", "什么错", "审阅错误 / 审阅警告", "悬停橙色特征"],
      ["换草图平面", "编辑草图基准面", "重新定义草图平面", "替换参考"],
      ["重新计算", "重建 Ctrl+B，强制重建 Ctrl+Q", "全部计算 Ctrl+B", "自动重算"],
      ["集中修复", "FeatureXpert（圆角、拔模）", "—", "修复面板（编辑健康时刻）"],
    ],
    after: 2,
  },
  terms: { ops: ["fillet", "shell"], concepts: ["tnp", "parent-child", "rollback", "feature-tree"] },
  quiz: [
    {
      q: "特征树里有 4 个特征报错，最上面的是「草图3」。先修哪个？",
      options: ["最下面那个，它离最终结果最近", "最上面的草图3，下游的错误常常是它引起的", "随便哪个都行"],
      answer: 1,
      explain: "特征按顺序重算，下游引用上游。上游坏了，下游拿不到参考也跟着坏。先修最上面的，很多下游错误会自己消失。",
    },
    {
      q: "草图所在的基准面被删了，草图报错。不重画草图，怎么修？",
      options: ["把草图换到另一个面上：编辑草图基准面 / 重新定义草图平面 / 替换参考", "删掉草图和它后面的所有特征", "关掉错误提示"],
      answer: 0,
      explain: "草图的线和尺寸都还在，缺的只是它挂的那个面。换一个面挂上去，下游特征通常就恢复了。",
    },
    {
      q: "错误和警告有什么区别？",
      options: ["错误是特征没生成；警告是生成了，但有地方需要注意", "没有区别，只是颜色不同", "警告比错误更严重"],
      answer: 0,
      explain: "错误意味着这一步的几何没有出来，下游会受影响；警告时几何已经生成，但参考或关系可能不对，值得检查，否则以后会变成错误。",
    },
  ],
  takeaways: [
    "错误是特征没生成，警告是生成了但有隐患",
    "从最上面的错误修起，回滚到它下面单独看；很多下游错误会自己消失",
    "丢参考就重选，丢平面就换平面，几何做不出来就改参数或改顺序",
  ],
  sources: [
    { title: "什么错", publisher: "SOLIDWORKS 2021 帮助", url: "https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/hidd_new_whats_wrong.htm" },
    { title: "重建工具", publisher: "SOLIDWORKS 2018 帮助", url: "https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/c_fundamentals_rebuid_tools_help.htm" },
    { title: "检查草图合法性", publisher: "SOLIDWORKS 2019 帮助", url: "https://help.solidworks.com/2019/chinese-simplified/SolidWorks/sldworks/hidd_sketch_diagnostics.htm" },
    { title: "FeatureXpert", publisher: "SOLIDWORKS 2018 帮助", url: "https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/c_FeatureXpert.htm" },
    { title: "全部计算", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-COMPUTE-ALL.htm" },
    { title: "重新定义草图平面", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/GUID-3E407E01-65AE-4DCC-A3A7-1439D9B5182F.htm" },
    { title: "错误指示符", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Home/error_indicators.htm" },
    { title: "修复", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Document/repairing.htm" },
  ],
  related: { lessons: ["feature-tree", "fillet-shell-order"], cards: ["1.3.6"] },
}

export default card
