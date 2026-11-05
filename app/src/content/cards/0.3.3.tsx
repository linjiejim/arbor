import type { CardDef } from "./types"

/** 0.3.3 单位、精度与材料设置. */

const card: CardDef = {
  code: "0.3.3",
  title: "单位、精度与材料：质量为什么会算错",
  minutes: 4,
  sections: [
    {
      heading: "质量 = 体积 × 密度",
      body: (
        <>
          <p>软件算质量只用两个数：几何算出的体积，和材料给的密度。体积对不对取决于单位，密度对不对取决于材料。任何一个设错，质量就全错，而模型看上去毫无问题，也不会报错。</p>
          <p>
            所以 SOLIDWORKS 认证考试（CSWA）的零件题每道都写明单位制、小数位数和材料。样题里写的是 MMGS 单位制、两位小数、AISI 1020 钢、密度 0.0079 g/mm³，要求报出以克为单位的质量。
          </p>
        </>
      ),
    },
    {
      heading: "单位：先设好，再建模",
      body: (
        <>
          <ul>
            <li>SOLIDWORKS：单位是文档属性（工具 &gt; 选项 &gt; 文档属性 &gt; 单位）。常用 MMGS（毫米、克、秒）和 IPS（英寸、磅、秒）；新零件的单位来自模板。</li>
            <li>Fusion：在浏览器的「文档设置」里改单位。</li>
            <li>Onshape：每个工作区有自己的「工作区单位」，默认跟随「帐户 &gt; 首选项」；帮助里写明的出厂默认是英寸。国内用户第一次用，先把默认单位改成毫米。</li>
          </ul>
          <p>1 英寸精确等于 25.4 毫米。在英寸文档里输入 20，得到的是 508 mm。数值框里可以直接带单位输入，比如 Onshape 里写 <code>20 mm</code>。</p>
          <p>小数位数只影响显示和报告时的舍入，不改变几何。Onshape 帮助写得很明白：显示位数不参与计算。</p>
        </>
      ),
    },
    {
      heading: "材料：没设的时候，各软件不一样",
      body: (
        <>
          <ul>
            <li>SOLIDWORKS：零件没指定材料时，用模板里的默认密度；常见的默认模板是 1000 kg/m³，也就是水。</li>
            <li>Fusion：新建或导入的实体会自动套用一个默认物理材料，默认值可以在首选项里改。</li>
            <li>Onshape：没指定材料的零件质量为零，质量属性工具会把它排除在计算之外并给出提示。</li>
          </ul>
          <p>三种做法都不报错。看质量之前，先确认每个零件的材料。</p>
        </>
      ),
    },
  ],
  table: {
    caption: "同一个 100 × 50 × 20 mm 的方块（体积 100 cm³）",
    head: ["材料", "密度 g/cm³", "质量"],
    rows: [
      ["碳钢（如 1020）", "约 7.85–7.87", "约 786 g"],
      ["6061 铝合金", "2.70", "270 g"],
      ["PLA（打印耗材）", "1.24", "124 g"],
      ["水（SOLIDWORKS 常见默认值）", "1.00", "100 g"],
    ],
    note: "1 g/cm³ = 0.001 g/mm³ = 1000 kg/m³。CSWA 样题里钢的密度写作 0.0079 g/mm³，就是 7.9 g/cm³。",
  },
  terms: {},
  quiz: [
    {
      q: "一块 100 × 50 × 20 mm 的 6061 铝（2.70 g/cm³），软件报质量 100 g。最可能哪里错了？",
      options: ["单位设成了英寸", "零件没有指定材料，软件用了水的密度", "小数位数设得太少"],
      answer: 1,
      explain: "体积是 100 cm³，铝应该是 270 g。100 g 正好是密度 1 g/cm³ 的结果，SOLIDWORKS 没指定材料时常常就是这个值。单位错了会差 25.4 的三次方倍，远不止这点。",
    },
    {
      q: "把显示的小数位数从 2 改成 4，模型会怎样？",
      options: ["几何不变，只是数字显示得更细", "所有尺寸被重新取整", "质量会变"],
      answer: 0,
      explain: "小数位数只控制显示和报告时的舍入，内部按完整精度计算。考试规定小数位数，是为了让答案好比对。",
    },
    {
      q: "Onshape 账户首选项从没改过，在新文档里不写单位输入「20」画线。线有多长？",
      options: ["20 mm", "20 in，也就是 508 mm", "20 cm"],
      answer: 1,
      explain: "Onshape 出厂的默认单位是英寸，不写单位的数字按工作区单位理解。改「帐户 > 首选项」的默认单位，或者直接输入 20 mm。",
    },
  ],
  takeaways: [
    "质量 = 体积 × 密度：单位决定体积，材料决定密度，设错了都不会报错",
    "建模前先设单位：SOLIDWORKS 看模板，Onshape 出厂默认英寸；1 in = 25.4 mm",
    "看质量前先确认材料：没设材料时，SOLIDWORKS 常用水的密度，Fusion 套默认材料，Onshape 记为零",
  ],
  sources: [
    { title: "CSWA Sample Exam", publisher: "SOLIDWORKS", url: "https://www.solidworks.com/sites/default/files/2018-07/CSWASampleExam.pdf" },
    { title: "文档属性 - 单位", publisher: "SOLIDWORKS 2023 帮助", url: "https://help.solidworks.com/2023/chinese-simplified/SolidWorks/sldworks/HIDD_OPTIONS_UNITS_NEW.htm" },
    { title: "Material Favourites for Easy Access in SOLIDWORKS（默认密度）", publisher: "Javelin", url: "https://www.javelin-tech.com/blog/2020/07/material-favourites-for-easy-access-in-solidworks/" },
    { title: "物理材料和外观", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-55EC2C42-60E1-48C7-B802-D2AA7AB6F0CB.htm" },
    {
      title: "在 Fusion 中更改文档单位",
      publisher: "Autodesk 知识库",
      url: "https://www.autodesk.com.cn/support/technical/article/caas/sfdcarticles/sfdcarticles/CHS/Uploaded-files-from-other-CAD-systems-use-metric-units-in-Fusion-360.html",
    },
    { title: "设置每个工作区的默认单位", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Document/setting_default_units_per_workspace.htm" },
    { title: "自定义零件材料", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/customizing_part_materials.htm" },
    { title: "SI Units – Length（1 in = 25.4 mm）", publisher: "NIST", url: "https://www.nist.gov/pml/owm/si-units-length" },
    { title: "Aluminum 6061-T6 材料数据", publisher: "MatWeb", url: "https://www.matweb.com/search/datasheet.aspx?matguid=1b8c06d0ca7c456694c7777d9e10be5b" },
    { title: "AISI 1020 Steel 材料数据", publisher: "MatWeb", url: "https://www.matweb.com/search/DataSheet.aspx?MatGUID=a2eed65d6e5e4b66b7315a1b30f4b391" },
    { title: "Ingeo 4043D 技术数据表（PLA 密度）", publisher: "NatureWorks", url: "https://www.natureworksllc.com/~/media/Files/NatureWorks/Technical-Documents/Technical-Data-Sheets/TechnicalDataSheet_4043D_3D-monofilament_pdf.pdf" },
  ],
  related: { cards: ["0.3.2", "1.5.3"] },
}

export default card
