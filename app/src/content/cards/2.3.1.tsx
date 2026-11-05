import { Arrow, Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 2.3.1 装配上下文设计与外部参考的风险. */

const box = (x: number, y: number, w: number, label: string, className = "fill-muted") => (
  <g>
    <rect x={x} y={y} width={w} height={28} rx={6} className={className} />
    <T x={x + w / 2} y={y + 19} anchor="middle">
      {label}
    </T>
  </g>
)

const card: CardDef = {
  code: "2.3.1",
  title: "在装配里照着邻居画：外部参考的利与险",
  minutes: 5,
  sections: [
    {
      heading: "什么是装配上下文设计",
      body: (
        <p>
          在装配里编辑一个零件，让它的草图直接引用另一个零件的几何：盖子上的孔对准盒子里的螺丝柱，支架的宽度等于电机的宽度。邻居变了，它跟着变。这叫装配上下文设计（in-context），产生的引用就是外部参考。好处很直接：配合尺寸只定义一次，不用两边各量一遍。
        </p>
      ),
    },
    {
      heading: "各软件怎么控制更新",
      body: (
        <ul>
          <li>Onshape：在装配里「在关联中编辑」时，被引用的几何存成一个「关联环境快照」，不会自动更新。要更新时，在装配里手动「更新关联环境」。别的零件动了，你的零件不会意外改变。</li>
          <li>Fusion：「在位编辑」可以选关联或非关联。部件上下文变化后显示为不同步，手动「同步部件上下文」才更新；「断开关联」去掉引用。</li>
          <li>SOLIDWORKS：在装配里编辑零件时建立的关联特征带外部参考。外部参考可以锁定或断开，锁定后不再跟着邻居变。</li>
        </ul>
      ),
    },
    {
      heading: "风险在哪里",
      body: (
        <ul>
          <li>换个地方就断：零件被拿到另一个装配里，原来引用的邻居不在了，参考失效。</li>
          <li>牵一发动全身：引用一层层传下去，改一个零件，一串零件跟着重算；绕一圈回来就成了循环引用。</li>
          <li>悄悄被改：邻居被别人改了，你的零件跟着变，自己却不知道。</li>
        </ul>
      ),
    },
    {
      heading: "用好它的规矩",
      body: (
        <ul>
          <li>只引用稳定的东西：布局草图、骨架模型、标准件的接口尺寸，而不是别人随时会改的细节。</li>
          <li>引用少而清楚：一个零件只引用一两个来源；Onshape 的帮助建议给每个关联环境起一个说得清用途的名字。</li>
          <li>能用全局变量表达的尺寸，就别用几何引用。</li>
          <li>设计定型后，锁定或断开外部参考，零件就能独立复用。</li>
        </ul>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={176} label="左：所有零件只引用一份布局草图；右：零件一个引用一个，还绕成了循环">
        <T x={80} y={16} anchor="middle" tone="muted">
          都引用骨架
        </T>
        {box(30, 26, 100, "布局草图", "fill-info-subtle text-primary")}
        <g className="text-primary">
          <Arrow x1={70} y1={56} x2={32} y2={116} />
          <Arrow x1={80} y1={56} x2={80} y2={116} />
          <Arrow x1={90} y1={56} x2={128} y2={116} />
        </g>
        {box(6, 118, 50, "盒子")}
        {box(58, 118, 44, "盖子")}
        {box(104, 118, 50, "支架")}
        <T x={240} y={16} anchor="middle" tone="muted">
          零件互相引用
        </T>
        {box(200, 26, 80, "盒子")}
        {box(200, 76, 80, "盖子")}
        {box(200, 126, 80, "按钮")}
        <g className="text-muted-foreground">
          <Arrow x1={240} y1={56} x2={240} y2={74} />
          <Arrow x1={240} y1={106} x2={240} y2={124} />
        </g>
        <g className="text-destructive">
          <path d="M 282 140 C 314 140 314 40 284 40" strokeDasharray="4 3" />
          <path d="M 290 36 L 284 40 L 290 44" />
          <T x={302} y={28} anchor="middle" className="text-destructive">
            循环
          </T>
        </g>
      </Svg>
    ),
    caption: "箭头从被引用的一方指向引用它的一方。左边所有零件只引用一份布局草图；右边零件一个引用一个，最后还绕回了自己。",
    after: 2,
  },
  terms: { concepts: ["external-reference", "parent-child", "design-intent"] },
  quiz: [
    {
      q: "你在装配里画盖子时引用了盒子的边。后来把这个盖子用到另一个产品的装配里，会怎样？",
      options: ["一切正常", "盖子找不到原来引用的盒子，外部参考失效，无法再跟着更新", "盒子会被自动带到新装配里"],
      answer: 1,
      explain: "外部参考指向的是原来那个装配里的盒子。换了地方，参考找不到来源。要复用的零件，定型后先锁定或断开参考。",
    },
    {
      q: "Onshape 里，同事改了盒子。你在关联中编辑过的盖子会怎样？",
      options: ["马上自动跟着变", "暂时不变，等你手动更新关联环境", "报错并被删除"],
      answer: 1,
      explain: "Onshape 把被引用的几何存成快照，只有手动「更新关联环境」时才会变。这样别人的改动不会悄悄带走你的零件。",
    },
    {
      q: "好几个零件都要对齐同一组孔位。更稳的做法是？",
      options: ["盖子引用盒子，按钮引用盖子，一层层传下去", "孔位画在一份布局草图或参数表里，各零件都引用它", "每个零件各画一遍孔位"],
      answer: 1,
      explain: "所有零件引用同一个稳定的来源，依赖关系是一层，不会连环牵动，也不会绕成循环。各画一遍则没有任何关联，改的时候容易漏。",
    },
  ],
  takeaways: [
    "装配上下文设计让零件照着邻居画，邻居变它就变：方便，但多了跨零件的依赖",
    "风险是换个装配就断、改一个牵动一串、被别人的改动悄悄带走",
    "只引用布局草图这类稳定的来源，引用少而清楚，定型后锁定或断开",
  ],
  sources: [
    { title: "在关联环境中建模", publisher: "Onshape 帮助", url: "https://cad.onshape.com/help/zh_CN/Content/Assembly/modeling_in_context.htm" },
    { title: "关联性", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-EIP-ASSOCIATIVITY.htm" },
    { title: "同步部件上下文", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-SYNC-ASSEMBLY-CONTEXT.htm" },
    { title: "在装配上下文中断开链接", publisher: "Autodesk Fusion 帮助", url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-BREAK-LINK-CONTEXT.htm" },
    { title: "显示/删除几何关系（外部、在关联中定义、锁定、断开）", publisher: "SOLIDWORKS 2016 帮助", url: "https://help.solidworks.com/2016/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_SK_EDIT_RELATIONS.htm" },
  ],
  related: { lessons: ["assembly-dof"], teardowns: ["enclosure", "hinge_box"], cards: ["2.3.3", "1.4.3", "1.5.1"] },
}

export default card
