import { Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 2.3.3 标准件、紧固件与孔对齐. Figure: 3 px = 1 mm, an M6×20 cap screw through a clearance hole into a tapped hole. */

const card: CardDef = {
  code: "2.3.3",
  title: "标准件：从库里调螺钉，和孔对上",
  minutes: 4,
  sections: [
    {
      heading: "标准件不用自己画",
      body: (
        <>
          <p>螺钉、螺母、垫圈都有国标或 ISO 规格，尺寸是定好的。各软件都带标准件库，按规格插入即可：SOLIDWORKS 的 Toolbox（标准里有 GB），Fusion 的「插入紧固件」，Onshape 的「标准内容」，FreeCAD 装第三方的 Fasteners 工作台。</p>
          <p>库里的零件一般是简化外形，没有真实的螺纹牙型，用来装配、查干涉、出 BOM 足够了。</p>
        </>
      ),
    },
    {
      heading: "常用国标和对应的 ISO",
      body: (
        <p>
          Fusion 和 Onshape 的库只有 ANSI、DIN、ISO 等，没有 GB。下表这几个国标都是参照对应的 ISO 标准制定的，库里没有国标件时可以先按 ISO 选，出图和采购时写国标号。国标会修订，用之前查一下是否现行：比如六角头螺栓全螺纹的 GB/T 5783，2025 年发布了新版。
        </p>
      ),
    },
    {
      heading: "让螺钉跟着孔走",
      body: (
        <>
          <p>孔用孔特征做，孔就带着规格，库才知道该配什么螺钉：</p>
          <ul>
            <li>SOLIDWORKS「智能扣件」：给装配里的异型孔向导孔自动配上对应类型和大小的螺钉；盲孔取短一档的标准长度，通孔取长一档。「阵列驱动零部件阵列」按孔的阵列一次放好所有螺钉。</li>
            <li>Onshape「标准内容」能读出孔特征的螺纹定义，自动定螺钉尺寸；「仿制」把一个螺钉复制到所有匹配的孔上。</li>
            <li>Fusion「插入紧固件」按选中的圆边定尺寸，用「选择类似对象」可以一次插到同一个面上的所有同类孔。</li>
          </ul>
          <p>好处是：孔从 M4 改成 M5，或者从 4 个变成 6 个，螺钉跟着更新，BOM 里的数量也对。</p>
        </>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={146} label="剖视：M6 螺钉穿过上板的通孔，拧进下板的螺纹孔">
        <defs>
          <pattern id="card-233-a" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className="text-faint-foreground" strokeWidth={0.8} />
          </pattern>
          <pattern id="card-233-b" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="7" className="text-faint-foreground" strokeWidth={0.8} />
          </pattern>
        </defs>
        {/* 上板：通孔 Ø6.6 */}
        <path fillRule="evenodd" fill="url(#card-233-a)" stroke="none" d="M 20 40 H 200 V 70 H 20 Z M 100 40 H 120 V 70 H 100 Z" />
        <path d="M 20 40 H 100 V 70 H 20 Z M 120 40 H 200 V 70 H 120 Z" strokeWidth={1.5} />
        {/* 下板：M6 螺纹孔，底孔 Ø5 */}
        <path fillRule="evenodd" fill="url(#card-233-b)" stroke="none" d="M 20 70 H 200 V 130 H 20 Z M 102.5 70 H 117.5 V 121 L 110 125 L 102.5 121 Z" />
        <path d="M 20 70 H 102.5 V 121 L 110 125 L 117.5 121 V 70 H 200 V 130 H 20 Z" strokeWidth={1.5} />
        <path d="M 101 70 V 112 M 119 70 V 112" strokeWidth={0.75} />
        <path d="M 101 112 H 119" strokeWidth={1.5} />
        {/* 螺钉 M6×20：头 Ø10 × 6 */}
        <path d="M 95 22 H 125 V 40 H 119 V 100 H 101 V 40 H 95 Z" className="fill-background" strokeWidth={1.75} />
        <path d="M 110 14 V 132" strokeDasharray="10 3 2 3" strokeWidth={0.75} className="text-muted-foreground" />
        <g className="text-muted-foreground" strokeWidth={0.75} strokeDasharray="2 3">
          <path d="M 127 31 H 208 M 122 55 H 208 M 121 92 H 208" />
        </g>
        <T x={212} y={35}>
          螺钉 M6×20
        </T>
        <T x={212} y={59}>
          通孔 Ø6.6
        </T>
        <T x={212} y={96}>
          M6 螺纹孔
        </T>
      </Svg>
    ),
    caption: "螺钉穿过上板的通孔（GB/T 5277 中等装配 Ø6.6），拧进下板的 M6 螺纹孔。两个孔都用孔特征做，库就能按规格配上 M6 螺钉。",
    after: 0,
  },
  table: {
    caption: "常用紧固件的国标和对应 ISO",
    head: ["名称", "国标", "对应 ISO"],
    nowrap: [1, 2],
    rows: [
      ["内六角圆柱头螺钉", "GB/T 70.1-2008", "ISO 4762"],
      ["六角头螺栓 全螺纹", "GB/T 5783-2025", "ISO 4017"],
      ["1 型六角螺母", "GB/T 6170-2015", "ISO 4032"],
      ["平垫圈 A 级", "GB/T 97.1-2002", "ISO 7089"],
    ],
    after: 1,
  },
  terms: { ops: ["hole", "pattern", "thread"], concepts: ["mate"] },
  quiz: [
    {
      q: "用智能扣件给装配自动配螺钉，配得最准的前提是？",
      options: ["孔是用异型孔向导（孔特征）做的，带着规格", "孔是画圆再拉伸切除出来的", "螺钉已经提前手动画好"],
      answer: 0,
      explain: "异型孔向导的孔带着规格，能配上对应类型和大小的螺钉。普通切除的孔只能按直径猜一个默认类型。",
    },
    {
      q: "Fusion 或 Onshape 的标准件库里找不到 GB 件，怎么办？",
      options: ["自己从头画所有螺钉", "先按对应的 ISO 件选（比如 GB/T 70.1 对应 ISO 4762），出图和采购时写国标号", "随便选一个看起来像的"],
      answer: 1,
      explain: "这几个常用国标都是参照对应 ISO 制定的，建模和装配时用 ISO 件代替很常见。正式的图纸和采购清单以国标号为准，并确认标准是否现行。",
    },
    {
      q: "孔从 4 个改成 6 个后，螺钉也要变成 6 个。哪种放法能自动跟上？",
      options: ["手动一个个复制螺钉", "用阵列驱动零部件阵列或仿制，让螺钉跟着孔走", "在零件里画 6 个螺钉实体"],
      answer: 1,
      explain: "阵列驱动和仿制都以孔为依据放螺钉，孔的数量和位置变了，螺钉跟着变，BOM 数量也对。手动复制的螺钉和孔之间没有关系。",
    },
  ],
  takeaways: [
    "螺钉、螺母、垫圈从标准件库调，不自己画；SOLIDWORKS Toolbox 带 GB，其他库可先按对应 ISO 选",
    "孔用孔特征做，螺钉才能按规格自动配上",
    "用阵列驱动或仿制放螺钉：孔变了，螺钉和 BOM 数量跟着变",
  ],
  sources: [
    { title: "SOLIDWORKS Toolbox 概述", publisher: "SOLIDWORKS 2024 帮助", url: "https://help.solidworks.com/2024/Chinese-simplified/SolidWorks/toolbox/c_toolbox_overview.htm" },
    { title: "智能扣件 PropertyManager", publisher: "SOLIDWORKS 2023 帮助", url: "https://help.solidworks.com/2023/chinese-simplified/SolidWorks/sldworks/HIDD_NEW_SMARTFASTENER_DLG.htm" },
    { title: "阵列驱动零部件阵列", publisher: "SOLIDWORKS 2021 帮助", url: "https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_DVE_COMPPAT_DERIVED.htm" },
    { title: "插入紧固件", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-INSERT-FASTENER.htm" },
    { title: "标准内容", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Assembly/standard_content.htm" },
    { title: "仿制", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Assembly/replicate.htm" },
    { title: "Fasteners Workbench", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Fasteners_Workbench" },
    { title: "GB/T 5783-2025 紧固件 六角头螺栓 全螺纹", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=01F5A0044F83A172F91B138098BEEBA0" },
    { title: "GB/T 97.1-2002 平垫圈 A 级", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=199E0585386FDF8B9CACF6225BA5F924" },
    { title: "GB/T 70.1 内六角圆柱头螺钉（标准检索）", publisher: "全国标准信息公共服务平台", url: "https://std.samr.gov.cn/search/stdPage?q=GB/T70.1" },
    { title: "GB/T 6170 1 型六角螺母（标准检索）", publisher: "全国标准信息公共服务平台", url: "https://std.samr.gov.cn/search/stdPage?q=GB/T6170" },
  ],
  related: { lessons: ["assembly-dof"], teardowns: ["enclosure", "hinge_box"], cards: ["2.3.1", "1.2.4"] },
}

export default card
