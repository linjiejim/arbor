import { Link } from "react-router"
import { Boxes, Download, Ruler, Terminal } from "lucide-react"
import { ArborMark } from "@/components/arbor-mark"
import { CodeBlock } from "@/components/code-block"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { REPO_URL } from "@/lib/site"

const RELEASES = `${REPO_URL}/releases/latest`
const ADD_CLAUDE = "claude mcp add --scope user arbor -- /Applications/Arbor.app/Contents/Resources/bin/arbor mcp"

const ABILITIES = [
  { icon: <Terminal />, title: "agent 来建模", text: "Claude Code、Codex 等通过 MCP 调用 39 个建模、观测和核对工具。你在窗口里看每一步，拖参数，在面上给它留备注。" },
  { icon: <Boxes />, title: "项目和装配", text: "一个文件夹就是一个项目。零件各是一个文件，组成装配一起看，共用一份参数；能在装配里对着别的零件改一个零件。" },
  { icon: <Ruler />, title: "STEP 和核对", text: "导入开发板、元件的官方 STEP，围着它建外壳；尺寸、间隙、干涉写成要求，每次重建自动核对。" },
]

/** Arbor 桌面版: what it adds over the workbench here, where to get it, how to hook up an agent. */
export function DesktopPage() {
  return (
    <Page width="narrow" className="mx-auto">
      <div className="flex flex-col items-start gap-4 pt-6">
        <ArborMark className="size-14" />
        <h1 className="text-title-lg font-semibold">Arbor 桌面版</h1>
        <p className="max-w-[40rem] text-reading text-muted-foreground">
          让你电脑上的 coding agent 来建参数化零件。和这里的工作台是同一个内核、同一种文件；网页适合学，桌面版适合做真东西。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="primary">
            <a href={RELEASES} target="_blank" rel="noopener noreferrer">
              <Download />
              下载 macOS 版
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/studio">先在网页上试试</Link>
          </Button>
        </div>
        <p className="text-small text-faint-foreground">Apple 芯片选 arm64，Intel 选 x64。装好后会自动更新。</p>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {ABILITIES.map((a) => (
          <div key={a.title} className="rounded-lg border p-4">
            <div className="text-muted-foreground [&_svg]:size-5">{a.icon}</div>
            <div className="mt-2 text-heading font-semibold">{a.title}</div>
            <p className="mt-1 text-small text-muted-foreground">{a.text}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-heading font-semibold">第一次打开</h2>
        <p className="mt-2 text-body text-muted-foreground">
          Arbor 没有 Apple 签名：第一次打开时，到「系统设置 → 隐私与安全性」点「仍要打开」。然后在 Arbor 右上角点「接入 Agent」，复制对应的命令到终端运行一次，例如 Claude Code：
        </p>
        <CodeBlock code={ADD_CLAUDE} className="mt-3" />
        <p className="mt-3 text-body text-muted-foreground">之后对 agent 说要建什么，比如「用 arbor 建一个 80×50×30 的盒子，壁厚 2，四角 M3 螺纹孔」。</p>
      </section>
    </Page>
  )
}
