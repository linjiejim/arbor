import { Arrow, Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 1.1.4 构造几何、投影/转换实体、偏移、修剪、镜像. */

const card: CardDef = {
  code: "1.1.4",
  title: "复用几何：构造线、投影、偏移、修剪、镜像",
  minutes: 5,
  sections: [
    {
      heading: "构造几何：只当参照的线",
      body: (
        <>
          <p>构造几何参与约束，但不会变成特征的轮廓。中心线、对称轴、布局用的框都画成构造几何：先用几条构造线搭好骨架，实际轮廓再挂到骨架上。</p>
          <p>SOLIDWORKS 在线的属性里勾选「作为构造线」，中心线天生就是构造线；Fusion 和 Onshape 都叫「构造」，选中线再点一下就切换。</p>
        </>
      ),
    },
    {
      heading: "投影：直接借用已有的边",
      body: (
        <>
          <p>要和模型上已有的边对齐，不必重画一遍再加约束。SOLIDWORKS 的「转换实体引用」、Fusion 的「投影」、Onshape 的「使用」，都把已有的边投进当前草图，并且保持关联：原来的边变了，投进来的线跟着变。这条线不用任何尺寸就已经完全定义。</p>
          <p>代价是多了一层父子关系。被投影的特征删掉或改得面目全非，草图就会报错。Fusion 的投影可以取消「投影链接」，只要形状、不要关联。</p>
        </>
      ),
    },
    {
      heading: "偏移和镜像：少标尺寸",
      body: (
        <>
          <p>「偏移」（SOLIDWORKS 叫「等距实体」）把一串线整体平移一段距离，整圈只需要一个偏移尺寸；原轮廓改了，偏移线跟着改。壁厚、密封槽、加强边都常用它。</p>
          <p>「镜像」（SOLIDWORKS 写作「镜向实体」）关于一条线复制，同时加上对称约束：只标一半的尺寸，改一边，另一边跟着变。</p>
          <p>FreeCAD 例外：偏移和镜像默认不关联，要勾选「添加偏移约束」「创建对称约束」才会跟着原线变。</p>
        </>
      ),
    },
    {
      heading: "修剪：清掉多余的段",
      body: (
        <p>
          先用完整的线快速画出大致形状，再用「修剪」（SOLIDWORKS 叫「剪裁实体」）删掉交点之间多余的段。按住鼠标划过，可以一次剪掉好几段。剪完检查轮廓是否闭合、交点是否还重合，再看草图是不是仍然完全定义。
        </p>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={186} label="构造线作为对称轴，左半边是画出来的，右半边由镜像得到，内圈由偏移得到">
        <line x1={160} y1={16} x2={160} y2={166} strokeDasharray="6 4" className="text-faint-foreground" />
        <path d="M 160 40 H 95 L 65 70 V 160 H 160" strokeWidth={1.75} />
        <path d="M 160 40 H 225 L 255 70 V 160 H 160" strokeWidth={1.75} className="text-primary" />
        <path d="M 100 52 H 220 L 243 75 V 148 H 77 V 75 Z" className="text-primary" strokeDasharray="5 3" />
        <Arrow x1={65} y1={112} x2={77} y2={112} both className="text-muted-foreground" />
        <T x={58} y={116} anchor="end" tone="muted">
          偏移
        </T>
        <T x={166} y={178} tone="faint">
          构造线（对称轴）
        </T>
        <T x={104} y={32} anchor="middle">
          画的半边
        </T>
        <T x={214} y={32} anchor="middle" tone="primary">
          镜像得到
        </T>
        <T x={172} y={112} tone="primary">
          偏移得到
        </T>
      </Svg>
    ),
    caption: "只画左半边、标左半边的尺寸。右半边由镜像得到，内圈由偏移得到，它们都和原线保持关联。构造线不参与生成实体。",
    after: 0,
  },
  table: {
    caption: "这几个工具在各软件里的叫法",
    head: ["工具", "SOLIDWORKS", "Fusion", "Onshape", "FreeCAD 1.1"],
    rows: [
      ["构造几何", "作为构造线 / 中心线", "构造", "构造", "切换构造几何"],
      ["投影已有边", "转换实体引用", "投影", "使用", "外部投影"],
      ["偏移", "等距实体", "偏移", "偏移", "偏移"],
      ["修剪", "剪裁实体", "修剪", "修剪", "修剪边"],
      ["镜像", "镜向实体", "镜像", "镜像", "镜像（1.0 叫「对称」）"],
    ],
    after: 3,
  },
  terms: { ops: ["sketch", "mirror"], concepts: ["construction-geometry", "constraint", "fully-defined", "parent-child"] },
  quiz: [
    {
      q: "草图里画了一条构造线当对称轴。拉伸这个草图时，它会怎样？",
      options: ["和其他线一起围成轮廓", "不参与轮廓，只作为约束和镜像的参照", "被拉伸成一个薄片"],
      answer: 1,
      explain: "构造几何在生成特征时被忽略。它的用处是给别的线提供对齐、对称的参照。",
    },
    {
      q: "把上一个特征的边投进草图（转换实体引用 / 投影 / 使用），之后删掉了那个特征。会怎样？",
      options: ["投进来的线自动变成普通线，没有影响", "投进来的线失去来源，草图报错，要重新选参考", "被删的特征会自动恢复"],
      answer: 1,
      explain: "投影保持关联，也就建立了父子关系。父特征没了，投影线找不到来源，就会出现悬空或丢失参考的错误。Fusion 会在时间轴上给出警告，并提供重新链接或断开链接。",
    },
    {
      q: "外轮廓宽度要从 80 改到 100。哪种画法只改一个尺寸，左右两边和内圈都跟着变？",
      options: ["左右两半各画各的，分别标尺寸", "画一半再镜像，内圈用偏移", "整圈画好后，内圈逐条画平行线"],
      answer: 1,
      explain: "镜像带着对称约束，偏移带着一个偏移尺寸，它们都和原轮廓关联。逐条画的线之间没有关系，只能一条条改。",
    },
  ],
  takeaways: [
    "构造几何只当参照，不进轮廓：先画骨架，再把轮廓挂上去",
    "投影、偏移、镜像得到的线和原线保持关联，用很少的尺寸就能完全定义",
    "关联也是依赖：被投影的特征删掉或大改，草图会报错",
  ],
  sources: [
    { title: "构造几何线", publisher: "SOLIDWORKS 2021 帮助", url: "https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_Construction_Geometry.htm" },
    { title: "使用转换实体引用", publisher: "SOLIDWORKS 2020 帮助", url: "https://help.solidworks.com/2020/chinese-simplified/SolidWorks/sldworks/t_Using_Convert_Entities.htm" },
    { title: "镜向实体", publisher: "SOLIDWORKS 2022 帮助", url: "https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/c_Mirror_Entities.htm" },
    { title: "投影", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/GUID-850061C4-71F5-4418-AF9C-F0D232022F9C.htm" },
    { title: "偏移", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-OFFSET.htm" },
    { title: "草图中的镜像和阵列", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-SKETCH-CREATE-MIRRORS-PATTERNS.htm" },
    { title: "使用", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Sketch/use.htm" },
    { title: "构造", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Sketch/construction.htm" },
    { title: "Sketcher Offset / Sketcher Symmetry", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Sketcher_Offset" },
  ],
  related: { lessons: ["constraints-dof", "sketch-to-solid"], cards: ["1.1.6"] },
}

export default card
