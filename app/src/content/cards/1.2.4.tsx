import { Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 1.2.4 孔与螺纹特征. Figure: 4 px = 1 mm, section through three holes. */

const card: CardDef = {
  code: "1.2.4",
  title: "孔特征：比画圆再切多了什么",
  minutes: 5,
  sections: [
    {
      heading: "孔特征记得「这是什么孔」",
      body: (
        <>
          <p>画一个圆再拉伸切除，也能得到一个孔，但模型只知道这里有个圆柱面。用孔特征，模型记得它是 M6 螺纹孔、螺纹深 12、底孔直径 5。</p>
          <p>这些规格有三个用处：出工程图时自动标注孔的规格；装配时紧固件库能按孔配螺钉；把 M6 改成 M5，底孔、沉孔、螺纹一起变。SOLIDWORKS 叫「异型孔向导」，Fusion、Onshape、FreeCAD 都叫「孔」。</p>
        </>
      ),
    },
    {
      heading: "常见孔型",
      body: (
        <ul>
          <li>通孔：让螺钉穿过去。国标 GB/T 5277 规定了间隙，M6 用的通孔按精装配、中等装配、粗装配分别是 6.4、6.6、7 mm。</li>
          <li>柱形沉孔：让圆柱头螺钉的头沉进去。按 GB/T 152.3，配 M6 内六角圆柱头螺钉的沉孔直径 11、深 6.8。</li>
          <li>锥形沉孔（埋头孔）：给沉头螺钉，锥角 90°，见 GB/T 152.2。</li>
          <li>锪平：在铸件这类粗糙表面上锪出一小块平面，让螺母或垫圈贴平。深度一般不标，锪平为止。</li>
          <li>螺纹孔：先钻底孔再攻丝。M6×1 的底孔钻头是 5 mm（GB/T 20330）；普通粗牙螺纹的底孔大致等于公称直径减螺距。</li>
        </ul>
      ),
    },
    {
      heading: "装饰螺纹和真实螺纹",
      body: (
        <>
          <p>孔特征里的螺纹默认是「装饰螺纹」：几何上只是一个底孔直径的圆柱，螺纹规格记在特征里。工程图按国标画法表示（GB/T 4459.1）：螺纹牙顶画粗实线，牙底画细实线，端视图上牙底的细实线只画约 3/4 圈。</p>
          <p>
            真的建出螺旋牙型（SOLIDWORKS 的「螺纹」特征、Fusion「螺纹」里勾选「实体化」、FreeCAD 的「建模螺纹」）会让模型变重、重算变慢。加工和出图需要的是规格，只有 3D 打印螺纹或要渲染时，才值得建真实牙型。
          </p>
        </>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={176} label="剖视图：柱形沉孔、锥形沉孔和 M6 螺纹盲孔">
        <defs>
          <pattern id="card-124-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className="text-faint-foreground" strokeWidth={0.8} />
          </pattern>
        </defs>
        <path
          fillRule="evenodd"
          fill="url(#card-124-hatch)"
          stroke="none"
          d="M 10 40 H 310 V 140 H 10 Z M 38 40 H 82 V 67 H 73 V 140 H 47 V 67 H 38 Z M 135 40 H 185 L 173 52 V 140 H 147 V 52 Z M 250 40 H 270 V 112 L 260 118 L 250 112 Z"
        />
        <g strokeWidth={1.75}>
          <path d="M 10 40 H 38 V 67 H 47 V 140 H 10 Z" />
          <path d="M 82 40 H 135 L 147 52 V 140 H 73 V 67 H 82 Z" />
          <path d="M 185 40 H 250 V 112 L 260 118 L 270 112 V 40 H 310 V 140 H 173 V 52 Z" />
          <path d="M 248 88 H 272" />
        </g>
        <path d="M 248 40 V 88 M 272 40 V 88" strokeWidth={0.75} />
        <g className="text-muted-foreground" strokeDasharray="10 3 2 3" strokeWidth={0.75}>
          <path d="M 60 32 V 148 M 160 32 V 148 M 260 32 V 126" />
        </g>
        <T x={60} y={162} anchor="middle">
          柱形沉孔
        </T>
        <T x={160} y={162} anchor="middle">
          锥形沉孔
        </T>
        <T x={260} y={162} anchor="middle">
          M6 螺纹盲孔
        </T>
        <T x={60} y={28} anchor="middle" tone="muted">
          Ø11 深 6.8
        </T>
        <T x={160} y={28} anchor="middle" tone="muted">
          90°
        </T>
        <T x={260} y={28} anchor="middle" tone="muted">
          螺纹深 12
        </T>
      </Svg>
    ),
    caption: "剖开看三种孔。右边的螺纹盲孔按国标画法：粗实线是钻出来的底孔（螺纹小径），细实线是螺纹大径，螺纹终止线画粗实线。",
    after: 1,
  },
  table: {
    caption: "同一种孔，各软件的叫法不同",
    head: ["孔型", "SOLIDWORKS", "Fusion", "Onshape", "FreeCAD"],
    rows: [
      ["柱形沉孔", "柱形沉头孔", "沉头孔", "沉头孔", "沉孔"],
      ["锥形沉孔", "锥形沉头孔", "倒角孔", "倒角孔", "埋头孔"],
      ["螺纹孔", "直螺纹孔", "孔攻螺纹类型选「螺纹」", "螺纹孔", "带螺纹的"],
      ["真实螺纹", "螺纹（特征）", "螺纹，勾选「实体化」", "无原生命令", "建模螺纹"],
    ],
    after: 2,
    note: "注意：Fusion 和 Onshape 的「沉头孔」指柱形沉孔，锥形的叫「倒角孔」。看不准时以示意图为准。",
  },
  terms: { ops: ["hole", "thread", "cut"] },
  quiz: [
    {
      q: "画圆加拉伸切除，和用孔特征做出的 M6 螺纹孔，几何上可以一模一样。孔特征多了什么？",
      options: ["什么也没多，只是操作快一点", "孔的规格：出图能自动标注，紧固件库能按它配螺钉，改规格时一起变", "更精确的圆柱面"],
      answer: 1,
      explain: "差别不在几何，在制造语义。画圆切出来的孔只是一个圆柱面，出图时要手动补螺纹标注，改规格要一处处改。",
    },
    {
      q: "用 M6 内六角圆柱头螺钉，想让螺钉头不露出表面。该用哪种孔？",
      options: ["锥形沉孔（埋头孔）", "柱形沉孔", "锪平"],
      answer: 1,
      explain: "圆柱头螺钉的头是圆柱，配柱形沉孔（GB/T 152.3 里 M6 对应 Ø11、深 6.8）。锥形沉孔配沉头螺钉；锪平只把表面锪平，藏不住螺钉头。",
    },
    {
      q: "孔特征里的螺纹为什么默认用装饰螺纹？",
      options: ["真实螺纹在工程图上画不出来", "模型轻、算得快，规格照样记在特征里，出图按国标画法表示", "装饰螺纹的强度更高"],
      answer: 1,
      explain: "加工和出图要的是规格，不是螺旋面。真实牙型计算慢，只在 3D 打印螺纹或渲染时才值得建。",
    },
  ],
  takeaways: [
    "用孔特征，不要画圆再切：规格跟着孔走，出图、配螺钉、改规格都靠它",
    "柱形沉孔配圆柱头螺钉，锥形沉孔（埋头孔）配沉头螺钉；各软件叫法不同，以形状为准",
    "螺纹默认用装饰螺纹；只有打印螺纹或要渲染时才建真实牙型",
  ],
  sources: [
    { title: "异型孔向导概述", publisher: "SOLIDWORKS 2015 帮助", url: "https://help.solidworks.com/2015/chinese-simplified/SolidWorks/sldworks/c_Hole_Wizard_Overview.htm" },
    { title: "装饰螺纹线", publisher: "SOLIDWORKS 2024 帮助", url: "https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/c_cosmetic_threads.htm" },
    { title: "孔参考", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-3A76B269-8C8D-437B-8F4A-85D0B2BBA492.htm" },
    { title: "螺纹参考", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-C37E8172-DE94-4EB0-AFE3-9D3172328441.htm" },
    { title: "孔", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/hole.htm" },
    { title: "PartDesign Hole", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/PartDesign_Hole" },
    { title: "GB/T 5277-1985 紧固件 螺栓和螺钉通孔", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=7C6B6039F8E5FB5FD8F318E06BAFB0B5" },
    { title: "GB/T 152.3-1988 紧固件 圆柱头用沉孔", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=9959F71ECC47D1E24E0FF3B19CF53CE8" },
    { title: "GB/T 152.2-2014 紧固件 沉头螺钉用沉孔", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=BDD6BF5044871D29A0081E5D634C6767" },
    { title: "GB/T 4459.1-1995 机械制图 螺纹及螺纹紧固件表示法", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=026B5C6659F37FBE052E85E8C4C9D83E" },
    { title: "GB/T 20330-2006 攻丝前钻孔用麻花钻直径", publisher: "全国标准信息公共服务平台", url: "https://std.samr.gov.cn/search/stdPage?q=GB/T20330" },
  ],
  related: { teardowns: ["enclosure_bottom"], cards: ["2.3.3"] },
}

export default card
