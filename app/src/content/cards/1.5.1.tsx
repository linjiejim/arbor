import { Arrow, Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 1.5.1 全局变量与方程. */

const card: CardDef = {
  code: "1.5.1",
  title: "全局变量：改一处，全局联动",
  minutes: 4,
  sections: [
    {
      heading: "从一个零件的参数，到一组零件的参数",
      body: (
        <>
          <p>「参数与方程」讲的是零件内部：宽度、壁厚、孔距。真实产品里，同一个数会出现在好几个零件上：电路板的宽度决定外壳的内宽，电路板的孔位决定外壳里螺丝柱的位置，也决定盖子上开孔的位置。</p>
          <p>把这些共用的数放在一个地方，各零件只引用它，这就是全局变量。改它一次，所有引用它的零件一起更新，不会出现「外壳改了、盖子忘了改」。</p>
        </>
      ),
    },
    {
      heading: "各软件怎么共享",
      body: (
        <ul>
          <li>SOLIDWORKS：全局变量写在「方程式」对话框里。要跨文件共享，把方程式导出成文本文件并「链接到外部文件」：改这个文本文件，所有链接它的零件和装配体都会更新。</li>
          <li>Fusion：用户参数属于单个设计。要跨设计共享，把一个只放公共参数的设计「衍生」到其他设计里，帮助里把这种用法叫「公用参数」。</li>
          <li>Onshape：Variable Studio 里的变量可以给同一文档里的所有 Part Studio 和装配体用，也能插入别的文档（源文档要先建版本）。</li>
          <li>FreeCAD：没有全局变量。用一张电子表格存参数，给单元格设别名，任何表达式都能读；跨文档引用也可以，但主文档要先保存，而且不能改名。</li>
        </ul>
      ),
    },
    {
      heading: "管好一张参数表",
      body: (
        <ul>
          <li>只放真正共用的数：总体尺寸、配合间隙、标准件规格。零件内部的细节留在零件里。</li>
          <li>
            名字说清楚意思：<code>pcb_width</code>、<code>gap</code>，不要 <code>a1</code>。
          </li>
          <li>
            派生值写公式，不要复制数字：<code>case_inner = pcb_width + 2 * gap</code>。
          </li>
          <li>不要循环：A 由 B 算、B 又由 A 算，就说明还没想清楚谁决定谁。SOLIDWORKS 会把循环的方程式标出来并警告，Onshape 的「派生」不接受循环参考。</li>
        </ul>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={158} label="一张参数表，三个零件引用它">
        <rect x={80} y={8} width={160} height={66} rx={6} className="fill-info-subtle text-primary" strokeWidth={1.5} />
        <T x={160} y={28} anchor="middle" tone="primary" className="font-medium">
          参数表
        </T>
        <T x={160} y={47} anchor="middle" className="font-mono">
          pcb_width = 50
        </T>
        <T x={160} y={65} anchor="middle" className="font-mono">
          gap = 0.5
        </T>
        <g className="text-primary">
          <Arrow x1={130} y1={76} x2={55} y2={116} />
          <Arrow x1={160} y1={76} x2={160} y2={116} />
          <Arrow x1={190} y1={76} x2={265} y2={116} />
        </g>
        {[
          { x: 10, label: "外壳" },
          { x: 115, label: "盖子" },
          { x: 220, label: "电路板支架" },
        ].map((p) => (
          <g key={p.label}>
            <rect x={p.x} y={118} width={90} height={32} rx={6} className="fill-muted" />
            <T x={p.x + 45} y={139} anchor="middle">
              {p.label}
            </T>
          </g>
        ))}
      </Svg>
    ),
    caption: "共用的数只存一份，零件只引用它。改 pcb_width，三个零件一起更新。",
    after: 0,
  },
  table: {
    caption: "放在哪里，怎么跨文件",
    head: ["软件", "放在哪里", "跨文件共享"],
    rows: [
      ["SOLIDWORKS", "方程式：全局变量", "链接到外部文件（文本文件）"],
      ["Fusion", "更改参数：用户参数", "衍生（公用参数）"],
      ["Onshape", "Variable Studio", "插入 Variable Studio（源文档先建版本）"],
      ["FreeCAD", "电子表格 + 别名", "跨文档表达式（主文档保存且不改名）"],
    ],
    after: 1,
  },
  terms: { concepts: ["parameter", "design-intent", "external-reference"] },
  quiz: [
    {
      q: "外壳、盖子和支架都要用到电路板宽度 50。最稳妥的做法是？",
      options: ["每个零件里各输入一次 50", "放进一个共享的参数表，三个零件都引用它", "只在外壳里输入，其他零件照着对齐"],
      answer: 1,
      explain: "同一个数只存一份，改的时候就不会漏。各输入一次，迟早有一个忘了改；照着对齐建立的是隐含的依赖，没人看得见。",
    },
    {
      q: "SOLIDWORKS 里，两个零件要共用同一组方程式，可以怎么做？",
      options: ["把方程式导出成文本文件，并链接到外部文件", "在两个零件里复制粘贴同样的尺寸", "把两个零件合并成一个文件"],
      answer: 0,
      explain: "链接之后，这些方程式只能在外部文件里改，改完所有链接它的零件和装配体都会更新。复制粘贴只是一次性的，之后两边各改各的。",
    },
    {
      q: "参数 A = B + 2，同时 B = A − 2。会怎样？",
      options: ["软件自动解出唯一的值", "这是循环引用，软件会警告或拒绝，参数算不出来", "A 和 B 都变成 0"],
      answer: 1,
      explain: "参数要能从上游一路算下来。出现循环，说明还没想清楚谁决定谁：挑一个做输入，另一个由它派生。",
    },
  ],
  takeaways: [
    "多个零件共用的数只存一份，放在全局变量或参数表里，各处引用",
    "SOLIDWORKS 链接外部文件，Fusion 衍生公用参数，Onshape 用 Variable Studio，FreeCAD 用电子表格",
    "表里只放真正共用的数，名字说清楚，派生值写公式，不要循环",
  ],
  sources: [
    { title: "在模型中共享方程式", publisher: "SOLIDWORKS 2022 帮助", url: "https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/c_sharing_equations_among_models.htm" },
    { title: "导出并链接方程式到外部文件", publisher: "SOLIDWORKS 2024 帮助", url: "https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/t_exporting_and_linking_equations.htm" },
    { title: "循环引用警告", publisher: "SOLIDWORKS 2020 帮助", url: "https://help.solidworks.com/2020/chinese-simplified/SolidWorks/sldworks/c_circular_reference_warnings.htm" },
    { title: "衍生设计功能", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-DERIVED-DESIGN-FEATURES.htm" },
    { title: "Variable Studio", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/VariableStudio/variable_studio.htm" },
    { title: "派生", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/derived.htm" },
    { title: "Expressions（全局变量与跨文档引用）", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Expressions" },
  ],
  related: { teardowns: ["enclosure"], cards: ["1.5.2", "1.1.6"] },
}

export default card
