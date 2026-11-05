import type { CardDef } from "./types"

/** 1.4.2 编辑导入几何. */

const card: CardDef = {
  code: "1.4.2",
  title: "改一个没有特征树的 STEP 零件",
  minutes: 4,
  sections: [
    {
      heading: "导入后得到什么",
      body: (
        <>
          <p>从 STEP、IGES 导入的零件只有面和边，没有草图、尺寸和特征树。想把孔距从 40 改到 50，没有尺寸可以双击。</p>
          <p>各软件的处理：SOLIDWORKS 里它是特征树上的一个输入特征；Fusion 在参数化模式下把导入的几何放进一个「基础特征」；FreeCAD 可以把它设为实体的「基础特征」，然后在上面接着建。</p>
        </>
      ),
    },
    {
      heading: "第一步：检查并修复",
      body: (
        <p>
          中性格式转换时可能丢面、留缝，导进来是一堆曲面而不是一个实体。很多实体操作要求输入是封闭的实体，所以先修。SOLIDWORKS 的「输入诊断」（工具 &gt; 评估 &gt; 输入诊断）能找出坏面和缝隙，尝试修复，再缝合成实体。修干净了，后面的编辑才可靠。
        </p>
      ),
    },
    {
      heading: "改法一：直接编辑面",
      body: (
        <>
          <p>不需要特征树，直接动面：</p>
          <ul>
            <li>移动面：把孔或凸台的面平移、偏移，改位置和大小。</li>
            <li>删除面：去掉一个圆角、小孔或刻字，相邻的面延伸过来补上。</li>
            <li>替换面：用另一个面替换选中的面，比如把一个斜面换成对齐另一个零件的平面。</li>
            <li>改圆角：Onshape 的「修改圆角」能直接改半径或去掉圆角。</li>
          </ul>
          <p>在 Onshape 里，这些操作本身也是特征，记在特征列表里，以后还能改。</p>
        </>
      ),
    },
    {
      heading: "改法二：接着建，或者重建",
      body: (
        <>
          <p>新加的结构（加一个凸台、开一个槽）用普通特征叠在导入的实体上，它们有完整的参数。SOLIDWORKS 的 FeatureWorks（「识别特征」）还能把导入实体里规则的拉伸、孔、圆角识别回特征，适合机加件；复杂的曲面件识别不了。</p>
          <p>怎么选：少量、一次性的修改，直接编辑；要长期维护、反复改尺寸的零件，照着它重建一个原生模型，把设计意图放回参数里。</p>
        </>
      ),
    },
  ],
  table: {
    caption: "各软件里的直接编辑工具",
    head: ["要做的事", "SOLIDWORKS", "Fusion", "Onshape"],
    rows: [
      ["修复导入几何", "输入诊断", "缝合（把曲面缝成实体）", "封闭（把曲面封成实体）"],
      ["移动面", "移动面", "推拉；移动/复制（选面）", "移动面"],
      ["删除面", "删除面", "删除", "删除面"],
      ["替换面", "替换面", "替换面", "替换面"],
      ["识别特征", "FeatureWorks「识别特征」", "—", "—"],
      ["改圆角", "—", "—", "修改圆角"],
    ],
    after: 2,
    note: "「—」表示这个软件里没有同名的专用命令，可以用其他方式完成。",
  },
  terms: { ops: ["fillet", "hole"], concepts: ["dumb-solid", "feature-tree"] },
  quiz: [
    {
      q: "供应商发来一个 STEP 零件，你只需要把一个孔挪 5 mm。最省事的做法是？",
      options: ["用移动面把孔的圆柱面平移 5 mm", "照着它重建整个零件", "用文本编辑器改 STEP 文件里的坐标"],
      answer: 0,
      explain: "一次性的小改动，直接编辑面最快。重建适合以后还要反复改的零件；手改 STEP 文件既难又容易破坏拓扑。",
    },
    {
      q: "导入后得到的是一堆曲面，不是实体。先做什么？",
      options: ["用输入诊断这类工具修复缝隙，缝合成实体", "直接在曲面上打孔", "导出成 STL 再导回来"],
      answer: 0,
      explain: "很多实体操作要求封闭的实体，先修复、缝合，后面的编辑才可靠。转成 STL 会把精确曲面变成三角网格，问题更大。",
    },
    {
      q: "这个导入的零件以后要按客户需求反复改尺寸。最好怎么办？",
      options: ["每次都用移动面改", "照着它重建一个原生参数化模型，以后改参数", "让客户每次重新发 STEP"],
      answer: 1,
      explain: "直接编辑适合少量修改；反复改的时候，没有尺寸和意图的模型每次都要重新判断改哪些面。花一次时间重建，以后改一个数就行。",
    },
  ],
  takeaways: [
    "导入的 STEP 只有面和边：先检查、修复成干净的实体",
    "少量修改直接编辑面：移动、删除、替换；新结构用普通特征叠上去",
    "要长期反复改的零件，重建成原生参数化模型",
  ],
  sources: [
    { title: "输入诊断概述", publisher: "SOLIDWORKS 2024 帮助", url: "https://help.solidworks.com/2024/Chinese-simplified/SolidWorks/sldworks/c_Import_Diagnostics_Overview.htm" },
    { title: "移动面 PropertyManager", publisher: "SOLIDWORKS 2022 帮助", url: "https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/hidd_dve_feat_move_face.htm" },
    { title: "使用逐步识别来识别输入的实体特征（FeatureWorks）", publisher: "SOLIDWORKS 2021 帮助", url: "https://help.solidworks.com/2021/chinese-simplified/solidworks/fworks/t_Recognizing_Features_Using_step_by_step.htm" },
    { title: "建模模式和时间轴（基础特征）", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Designs/files/ASM-DESIGN-MODELING-MODES.htm" },
    { title: "推拉", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-02F9ADA3-7556-42A9-8AD1-552728D537AB.htm" },
    { title: "替换面", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-CA081251-AA0B-46DC-BD14-D95886B4B0F8.htm" },
    { title: "删除面", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/delete_face.htm" },
    { title: "修改圆角", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/modify_fillet.htm" },
    { title: "Parametric Editing vs. Direct Editing", publisher: "Onshape 博客", url: "https://www.onshape.com/en/blog/parametric-editing-vs-direct-editing-cad-systems" },
    { title: "PartDesign Body（基础特征）", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/PartDesign_Body" },
  ],
  related: { lessons: ["feature-tree"], cards: ["0.3.2", "1.4.3"] },
}

export default card
