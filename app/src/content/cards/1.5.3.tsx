import { Arrow, Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 1.5.3 质量属性、测量与截面分析. Figure: 1.2 px = 1 mm. */

const axes = (x: number, y: number) => (
  <g className="text-muted-foreground">
    <Arrow x1={x} y1={y} x2={x + 24} y2={y} />
    <Arrow x1={x} y1={y} x2={x} y2={y - 24} />
  </g>
)
const centroid = (x: number, y: number) => (
  <g className="text-primary">
    <circle cx={x} cy={y} r={4.5} className="fill-current" stroke="none" />
    <path d={`M ${x - 9} ${y} H ${x + 9} M ${x} ${y - 9} V ${y + 9}`} strokeWidth={1} />
  </g>
)

const card: CardDef = {
  code: "1.5.3",
  title: "用质量、测量和剖面给模型自查",
  minutes: 4,
  sections: [
    {
      heading: "质量属性：一组数检查整个模型",
      body: (
        <>
          <p>质量属性给出体积、表面积、质量、质心和惯性矩。它们像整个模型的指纹：少一个孔、厚度错一点，体积就会变。按图建模的考试正是靠它判分。</p>
          <p>自查时先心算一个大概。100 × 50 × 20 mm 的块是 100 cm³，挖掉几个孔，结果应该略小于这个数。差得多，就去找漏掉或建反的特征。体积只看几何，质量还要看材料（见「单位、精度与材料」那张卡）。</p>
          <p>入口：SOLIDWORKS「工具 &gt; 评估 &gt; 质量属性」；Fusion 在浏览器里右键零部件选「特性」；Onshape 用右下角的「质量属性工具」。</p>
        </>
      ),
    },
    {
      heading: "质心坐标取决于原点",
      body: (
        <>
          <p>质心是相对某个坐标系报出来的。SOLIDWORKS 默认相对模型的坐标系，可以选别的坐标系；Fusion 的「质心」给的是全局坐标；Onshape 的惯性矩默认相对质心计算，选一个嵌合连接器可以换参考。</p>
          <p>同一块板，原点放在角上和放在中心，质心坐标完全不同。和答案或同事对数之前，先确认原点在哪里。对称零件的质心应该落在对称面上，这本身就是一个好检查。</p>
        </>
      ),
    },
    {
      heading: "测量和剖面：看局部",
      body: (
        <>
          <p>「测量」量两点、两个面之间的距离和角度，用来核对关键尺寸和装配间隙。想看里面，就剖开：抽壳后的壁厚、孔有没有打穿、筋有没有连到底，切一刀就清楚。</p>
        </>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={150} label="同一块板的质心：原点在角上时是 (50, 20)，原点在中心时是 (0, 0)">
        <rect x={20} y={36} width={120} height={48} className="fill-muted" strokeWidth={1.5} />
        {axes(20, 84)}
        {centroid(80, 60)}
        <T x={80} y={110} anchor="middle" tone="primary">
          质心 (50, 20)
        </T>
        <T x={80} y={132} anchor="middle" tone="muted">
          原点在左下角
        </T>
        <rect x={180} y={36} width={120} height={48} className="fill-muted" strokeWidth={1.5} />
        {axes(240, 60)}
        {centroid(240, 60)}
        <T x={240} y={110} anchor="middle" tone="primary">
          质心 (0, 0)
        </T>
        <T x={240} y={132} anchor="middle" tone="muted">
          原点在中心
        </T>
        <T x={160} y={20} anchor="middle" tone="muted">
          100 × 40 mm 的板
        </T>
      </Svg>
    ),
    caption: "同一块板，质心的位置没变，报出来的坐标却不同：差别全在原点放在哪里。",
    after: 1,
  },
  table: {
    caption: "三类检查在各软件里的入口",
    head: ["检查", "SOLIDWORKS", "Fusion", "Onshape"],
    rows: [
      ["质量、体积、质心", "质量属性", "特性；检验 > 质心", "质量属性工具"],
      ["距离、角度", "测量", "检验 > 测量", "测量工具"],
      ["剖开看", "剖面视图", "检验 > 截面分析", "剖视图"],
    ],
    after: 2,
  },
  terms: { ops: ["shell"], concepts: ["section", "design-intent"] },
  quiz: [
    {
      q: "按图建了一个零件，体积比答案大了约 3%。最可能是什么原因？",
      options: ["软件的计算误差", "漏了一个孔或切除，或者某个尺寸输错了", "材料设错了"],
      answer: 1,
      explain: "体积只和几何有关，和材料无关。差几个百分点，通常是少了特征或某个尺寸不对；材料错了影响的是质量，不是体积。",
    },
    {
      q: "你和同事建了同一个零件，质量一样，质心坐标却不一样。最可能是？",
      options: ["其中一个人建错了", "两个人的原点放在了不同位置", "两个人的材料不同"],
      answer: 1,
      explain: "质量一样说明几何和材料都对上了。质心是相对原点报的坐标，原点不同，数字就不同。",
    },
    {
      q: "抽壳后想确认最薄处的壁厚，最直接的办法是？",
      options: ["看质量属性里的体积", "剖开（截面分析 / 剖视图）再测量", "看外观颜色"],
      answer: 1,
      explain: "体积只能告诉你总量对不对，看不出哪里薄。剖开后量壁厚，局部问题一目了然。",
    },
  ],
  takeaways: [
    "体积是几何的指纹：先心算一个大概，再和质量属性对照",
    "质心坐标取决于原点；对称零件的质心应落在对称面上",
    "关键尺寸用测量核对，内部结构剖开看",
  ],
  sources: [
    { title: "质量属性", publisher: "SOLIDWORKS 2021 帮助", url: "https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_MASSPROPERTY_TEXT_DLG.htm" },
    { title: "重心（质心）", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-EB8C9FD9-2CA6-4937-887D-0014E538BF2C.htm" },
    { title: "测量", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MEASURE.htm" },
    { title: "创建三维剖视图（截面分析）", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SECTION-ANALYSIS.htm" },
    { title: "质量属性工具", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/View/mass_properties_tool.htm" },
    { title: "测量工具", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/View/measure_tool.htm" },
    { title: "剖视图", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/View/section_view.htm" },
    { title: "CSWA Sample Exam", publisher: "SOLIDWORKS", url: "https://www.solidworks.com/sites/default/files/2018-07/CSWASampleExam.pdf" },
  ],
  related: { lessons: ["section-views", "fillet-shell-order"], cards: ["0.3.3", "0.2.4"] },
}

export default card
