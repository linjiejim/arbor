import { Svg, T } from "@/components/card-figure"
import type { CardDef } from "./types"

/** 0.2.4 按图建模的读图法. */

const CENTER = "10 3 2 3" // 细点画线
const HIDDEN = "4 3" // 细虚线

const card: CardDef = {
  code: "0.2.4",
  title: "按图建模：先读图，再动手",
  minutes: 5,
  sections: [
    {
      heading: "先看标题栏和投影法",
      body: (
        <>
          <p>拿到图纸，先别急着画草图。标题栏（GB/T 10609.1）里写着比例、材料、图号，还有投影符号。材料决定密度，按图建模的题目常常要报质量，材料错了质量就错。</p>
          <p>
            国标优先用第一角画法（GB/T 14692）：俯视图在主视图<strong>下方</strong>，左视图在主视图<strong>右方</strong>。英文图纸和不少英文教程用第三角画法，位置正好相反。不认投影法，零件会被系统性地建反。
          </p>
          <p>国标图纸上的尺寸以毫米为单位时不写单位（GB/T 4458.4）；用别的单位会注明。</p>
        </>
      ),
    },
    {
      heading: "找对称和基准",
      body: (
        <>
          <p>细点画线表示轴线和对称中心线（GB/T 4457.4）。看到它，就知道哪里对称、孔绕着哪根轴分布。细虚线是看不见的轮廓，比如藏在里面的孔。</p>
          <p>再看尺寸从哪里标起：长、宽、高三个方向，尺寸集中出发的那个面或那条线就是尺寸基准，常见的是底面、对称面和主要孔的轴线。建模时把基准放在原点和基准面上：对称面落在基准面上，就能用两侧对称拉伸和镜像，改宽度时两边一起变，和图纸的意图一致。</p>
        </>
      ),
    },
    {
      heading: "拆成简单形体，定建模顺序",
      body: (
        <>
          <p>制图课里读图主要用形体分析法：把零件拆成板、柱、筋、孔这些简单形体，弄清它们怎样叠加、怎样挖切。个别看不懂的斜面或缺口，再一个面一个面地分析（线面分析法）。拆完，顺序也就出来了：</p>
          <ol>
            <li>主体：在最能反映形状特征的视图上画草图，拉伸或旋转。</li>
            <li>叠加和挖切：凸台、槽、腔。</li>
            <li>孔：用孔特征，按图上的规格。</li>
            <li>圆角、倒角放最后。</li>
          </ol>
        </>
      ),
    },
    {
      heading: "建完对一遍",
      body: (
        <p>
          逐个核对图上的尺寸，再看体积或质量和给出的数是否一致。认证考试就是这样判分的：SOLIDWORKS 的 CSWA 零件题给一张带尺寸的图，要求建模后报质量。差很多，多半漏了特征或建反了；差一点，多半是某个尺寸或材料不对。
        </p>
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={222} label="第一角画法的主视图和俯视图：细点画线是对称中心线，底面和对称面是尺寸基准">
        {/* 主视图 */}
        <path d="M 40 70 H 160 V 90 H 40 Z M 80 70 V 30 H 120 V 70" strokeWidth={1.75} />
        <g className="text-muted-foreground" strokeDasharray={HIDDEN} strokeWidth={0.9}>
          <path d="M 92 30 V 90 M 108 30 V 90 M 54 70 V 90 M 66 70 V 90 M 134 70 V 90 M 146 70 V 90" />
        </g>
        <g className="text-muted-foreground" strokeDasharray={CENTER} strokeWidth={0.9}>
          <path d="M 100 20 V 100 M 60 64 V 96 M 140 64 V 96" />
        </g>
        <T x={100} y={114} anchor="middle" tone="muted">
          主视图
        </T>
        {/* 俯视图（第一角：在主视图下方） */}
        <rect x={40} y={128} width={120} height={60} strokeWidth={1.75} />
        <circle cx={100} cy={158} r={20} strokeWidth={1.75} />
        <circle cx={100} cy={158} r={8} strokeWidth={1.75} />
        <circle cx={60} cy={158} r={6} strokeWidth={1.75} />
        <circle cx={140} cy={158} r={6} strokeWidth={1.75} />
        <g className="text-muted-foreground" strokeDasharray={CENTER} strokeWidth={0.9}>
          <path d="M 32 158 H 168 M 100 120 V 196 M 60 148 V 168 M 140 148 V 168" />
        </g>
        <T x={100} y={214} anchor="middle" tone="muted">
          俯视图
        </T>
        {/* 基准 */}
        <g className="text-primary">
          <path d="M 164 90 H 176" strokeWidth={1.75} />
          <T x={180} y={94} tone="primary">
            高度基准：底面
          </T>
          <T x={180} y={162} tone="primary">
            宽度基准：对称线
          </T>
          <T x={108} y={16} tone="primary">
            长度基准：对称面
          </T>
        </g>
        <T x={180} y={38} tone="muted">
          细点画线
        </T>
        <T x={180} y={56} tone="muted">
          ＝ 轴线、对称中心线
        </T>
      </Svg>
    ),
    caption: "第一角画法：俯视图在主视图下方。两条细点画线说明零件左右、前后都对称；高度方向的尺寸从底面标起。",
    after: 1,
  },
  terms: { ops: ["extrude", "mirror", "hole"], concepts: ["projection", "section", "datum", "design-intent"] },
  quiz: [
    {
      q: "按国标第一角画法，俯视图放在主视图的哪里？",
      options: ["下方", "上方", "右方"],
      answer: 0,
      explain: "GB/T 14692 规定优先采用第一角画法，俯视图在主视图下方，左视图在右方。第三角画法正好相反，俯视图在上方。读图前先认投影符号。",
    },
    {
      q: "一条细点画线穿过零件中间，两边尺寸相同。建模时最好怎么做？",
      options: ["让这条线落在基准面上，用两侧对称拉伸或镜像", "从零件的一个角开始画，两边分别标尺寸", "先建一半，另一半复制过去再手动对齐"],
      answer: 0,
      explain: "细点画线是对称中心线。对称面落在基准面上，尺寸从它标起，改宽度时两边一起变，和图纸表达的意图一致。分别标尺寸或手动对齐，改一次就可能不再对称。",
    },
    {
      q: "按图建好零件后，最快的整体自查办法是？",
      options: ["核对尺寸后，看体积或质量是否和给出的数一致", "从几个角度截图，看看像不像", "把所有尺寸改大一点再看"],
      answer: 0,
      explain: "体积和质量对几何的任何遗漏都很敏感，认证考试就是这样判分的。差很多说明漏了特征或建反了，差一点多半是某个尺寸或材料设错。",
    },
  ],
  takeaways: [
    "先看标题栏和投影符号：国标优先第一角画法，英文图纸多用第三角",
    "细点画线标出对称和轴线；尺寸从哪里标起，哪里就是基准，建模时把它们放在原点和基准面上",
    "按形体拆开：先主体，再叠加和挖切，再孔，最后圆角倒角；建完用体积或质量对一遍",
  ],
  sources: [
    { title: "GB/T 14692-2008 技术制图 投影法", publisher: "全国标准信息公共服务平台", url: "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D774EED3A7E05397BE0A0AB82A" },
    { title: "GB/T 4457.4-2002 机械制图 图样画法 图线", publisher: "全国标准信息公共服务平台", url: "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D808DCD3A7E05397BE0A0AB82A" },
    { title: "GB/T 4458.4-2003 机械制图 尺寸注法", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=08588A5F3FE19F16B9EE8D5D87E064D5" },
    { title: "GB/T 10609.1-2008 技术制图 标题栏", publisher: "国家标准全文公开系统", url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=0F8577CB9AB82D5819048A87920CABAB" },
    { title: "画法几何与工程制图 9.8 读组合体视图", publisher: "西安建筑科技大学", url: "https://netedu.xauat.edu.cn/jpkc/netedu/jpkc/tmgc/wlzy/3/9.8.htm" },
    { title: "零件图的尺寸标注（尺寸基准）", publisher: "广东工业大学课程资料", url: "https://courses.gdut.edu.cn/pluginfile.php/671542/mod_resource/content/0/9-3%E9%9B%B6%E4%BB%B6%E5%9B%BE%E7%9A%84%E5%B0%BA%E5%AF%B8%E6%A0%87%E6%B3%A8.pdf" },
    { title: "CSWA Sample Exam", publisher: "SOLIDWORKS", url: "https://www.solidworks.com/sites/default/files/2018-07/CSWASampleExam.pdf" },
  ],
  related: { lessons: ["projection", "section-views"], cards: ["1.5.3"] },
}

export default card
