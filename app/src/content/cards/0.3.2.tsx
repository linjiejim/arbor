import type { ReactNode } from "react"
import { Arrow, Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 0.3.2 文件格式与交换. */

const box = (y: number, glyph: ReactNode, title: string, formats: string) => (
  <g>
    <rect x={8} y={y} width={304} height={50} rx={6} className="stroke-border" />
    <g className="text-primary">{glyph}</g>
    <T x={54} y={y + 21} className="font-medium">
      {title}
    </T>
    <T x={54} y={y + 39} tone="muted">
      {formats}
    </T>
  </g>
)
const octagon = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8
  return `${30 + 11 * Math.cos(a)},${193 + 11 * Math.sin(a)}`
}).join(" ")

const card: CardDef = {
  code: "0.3.2",
  title: "文件格式：导出时带走了什么",
  minutes: 4,
  sections: [
    {
      heading: "一个模型有三层信息",
      body: (
        <>
          <p>最上面一层是特征树和参数：草图、尺寸、约束、特征的顺序。中间一层是精确几何，也叫 B-rep：每个面是什么曲面、边在哪里、谁和谁相连。最下面一层是三角网格，是把曲面切成小平面后的近似。</p>
          <p>文件格式决定你带走哪几层。原生格式三层都在，但通常只有同一个软件能打开：SOLIDWORKS 的 .sldprt、Fusion 的 .f3d、FreeCAD 的 .FCStd。Onshape 的模型存在云端，没有本地原生文件，只能导出成别的格式。</p>
        </>
      ),
    },
    {
      heading: "STEP：跨软件交换的默认选择",
      body: (
        <>
          <p>
            STEP 是国际标准 ISO 10303，扩展名 .step 或 .stp。常见的版本叫「应用协议」：AP203、AP214，以及 2014 年把两者合并扩展的 AP242，后者还能带尺寸和公差标注（PMI）。
          </p>
          <p>STEP 带走的是精确的实体和装配结构，但常规导出不含特征树。对方打开后得到一块没有历史的实体：想把孔距从 40 改到 50，只能直接编辑面，或者重新建模。</p>
          <ul>
            <li>IGES 更老：1980 年发布第一版，1996 年的 5.3 是最后一版。它主要传曲线和曲面，实体到了对方那里常常变成一堆散面。能用 STEP 就不用 IGES。</li>
            <li>Parasolid（.x_t）是 SOLIDWORKS、Onshape、NX 共用的几何内核的格式，在这几个软件之间转换通常比 STEP 更干净。它同样不带特征树。</li>
          </ul>
        </>
      ),
    },
    {
      heading: "STL 和 3MF：给打印机的网格",
      body: (
        <>
          <p>STL 里只有三角形的顶点坐标：圆柱变成多棱柱，曲面变成小平面。文件里没有单位，同一个「20」，按毫米读和按英寸读差 25.4 倍。标准 STL 也不存颜色。</p>
          <p>3MF 由 3MF 联盟在 2015 年推出，是一个装着 XML 的 ZIP 包。它写明单位（默认毫米），能存颜色、材料、多个物体和它们在打印平台上的位置。切片软件支持的话，用 3MF 代替 STL。</p>
          <p>网格回不去：从 STL 很难再得到能编辑的精确实体。所以网格只用于交付，不用来存档。</p>
        </>
      ),
    },
    {
      heading: "怎么选",
      body: (
        <ul>
          <li>对方要继续改：先问他用什么软件。同一个软件给原生文件；不同软件给 STEP（AP242 或 AP214），再附一张写明关键尺寸的图纸。</li>
          <li>交给打印：优先 3MF，没有就用 STL，导出时确认单位和网格精度。</li>
          <li>自己存档：原生文件和 STEP 各留一份。软件版本升级或换软件时，STEP 是退路。</li>
        </ul>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={228} label="模型的三层信息：特征树和参数、精确几何、三角网格，以及各种格式能带走哪几层">
        {box(8, <path d="M 22 24 h 14 M 26 33 h 14 M 26 42 h 10 M 22 24 v 18 M 22 33 h 4 M 22 42 h 4" />, "特征树和参数", "原生格式 .sldprt .f3d .FCStd")}
        <Arrow x1={30} y1={62} x2={30} y2={84} className="text-faint-foreground" />
        <T x={44} y={78} tone="faint">
          导出 STEP：丢掉草图、尺寸和特征顺序
        </T>
        {box(88, <circle cx={30} cy={113} r={11} />, "精确几何（B-rep）", "STEP · IGES · Parasolid .x_t")}
        <Arrow x1={30} y1={142} x2={30} y2={164} className="text-faint-foreground" />
        <T x={44} y={158} tone="faint">
          转成网格：曲面变成小三角形
        </T>
        {box(168, <polygon points={octagon} />, "三角网格", "STL · 3MF")}
      </Svg>
    ),
    caption: "格式越往下，带走的信息越少。往下转很容易，往上回去很难。",
  },
  table: {
    caption: "常见格式带走了什么",
    head: ["格式", "几何", "特征树和参数", "适合"],
    rows: [
      ["原生（.sldprt / .f3d / .FCStd）", "精确", "有", "自己继续改"],
      ["STEP（.step / .stp）", "精确", "没有", "跨软件交换、发给加工厂"],
      ["IGES（.igs / .iges）", "精确，多为曲面", "没有", "老系统、曲面数据"],
      ["Parasolid（.x_t）", "精确", "没有", "同内核的软件之间"],
      ["STL（.stl）", "三角网格，无单位", "没有", "3D 打印（老格式）"],
      ["3MF（.3mf）", "三角网格，带单位", "没有", "3D 打印"],
    ],
    after: 2,
    note: "Onshape 能导出表里所有的交换格式；Fusion 能导出 STEP、IGES、STL、3MF，但不能导出 Parasolid。以各自帮助里的格式列表为准。",
  },
  terms: { concepts: ["dumb-solid"] },
  quiz: [
    {
      q: "你用 SOLIDWORKS，同事用 Fusion。你导出 STEP 发给他，他想把孔距从 40 改到 50。会怎样？",
      options: ["打开后直接改特征树里的尺寸", "STEP 里没有特征树，他只能直接编辑面或重新建模", "STEP 在 Fusion 里打不开，必须改用 IGES"],
      answer: 1,
      explain: "STEP 带的是精确几何和装配结构，草图、尺寸和特征顺序都不在里面。Fusion 能用直接编辑工具移动孔所在的面，但原来的设计意图要靠他自己重建。",
    },
    {
      q: "一个零件导出 STL 后，打印出来小了约 25 倍。最可能的原因是？",
      options: ["导出时网格精度设得太低", "STL 不记录单位：模型按英寸导出，切片软件按毫米读", "打印机的步进电机没校准"],
      answer: 1,
      explain: "STL 里只有坐标数字。同一个数字按英寸和毫米理解，差 25.4 倍。网格精度只影响表面是否光顺，不影响大小。3MF 写明了单位，能避免这类问题。",
    },
    {
      q: "交给打印服务，还想保留颜色和多个零件的摆放位置，优先选哪种格式？",
      options: ["STL", "3MF", "IGES"],
      answer: 1,
      explain: "3MF 为增材制造设计，能存单位、颜色、材料和多个物体。STL 只有三角形；IGES 是交换精确曲面的老格式，不是给打印用的。",
    },
  ],
  takeaways: [
    "原生格式带特征树和参数；STEP、IGES、Parasolid 只带精确几何；STL、3MF 只剩三角网格",
    "跨软件交换用 STEP，对方要继续改时附上关键尺寸；同内核的软件之间可以用 Parasolid",
    "打印优先用 3MF：它写明单位，能带颜色和多个零件；STL 不记录单位",
  ],
  sources: [
    { title: "STEP-file, ISO 10303-21", publisher: "Library of Congress", url: "https://www.loc.gov/preservation/digital/formats/fdd/fdd000448.shtml" },
    { title: "IGES 的起源与发展（NIST SP 958）", publisher: "NIST", url: "https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/246-249.html" },
    { title: "STL (STereoLithography) File Format Family", publisher: "Library of Congress", url: "https://www.loc.gov/preservation/digital/formats/fdd/fdd000504.shtml" },
    { title: "STL (file format)：单位与比例", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/STL_(file_format)" },
    { title: "3MF Core Specification", publisher: "3MF Consortium", url: "https://github.com/3MFConsortium/spec_core" },
    { title: "导出设计", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Designs/files/ASM-EXPORT-DESIGN.htm" },
    { title: "支持的文件格式", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/File/supported_file_formats.htm" },
    { title: "Importing Files in Cloud-Native CAD（Parasolid）", publisher: "Onshape 博客", url: "https://www.onshape.com/en/blog/importing-files-in-cloud-native-cloud-cad-pdm" },
  ],
  related: { cards: ["0.3.3", "1.4.2"], lessons: ["print-overhang"] },
}

export default card
