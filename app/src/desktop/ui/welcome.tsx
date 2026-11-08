import { FolderOpen, FolderPlus, Plug } from "lucide-react"
import { ArborMark } from "@/components/arbor-mark"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { arbor, inApp } from "../bridge"

/** Nothing open yet: the mark, one line, and the three ways in. */
export function Welcome({ onSetup }: { onSetup: () => void }) {
  if (!inApp)
    return (
      <div className="grid h-full place-items-center p-8 text-body text-muted-foreground">这个页面是 Arbor 桌面版的窗口，要在 Arbor App 里打开。</div>
    )
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-8">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <ArborMark className="size-14" />
        <h1 className="mt-5 flex items-center gap-1.5 text-heading font-semibold">
          让本机的 agent 来建模
          <Hint
            label="怎么开始"
            align="center"
            tips={[
              "点「接入 Agent」，把一条命令复制到终端运行一次。",
              "然后对 agent 说要建什么，它会在这里一步步建出来。",
              "你在这里看每一步、拖参数，在面上给它留备注。",
              "零件和装配都是 JSON 文件，可以放进 git。",
            ]}
          />
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onSetup}>
            <Plug />
            接入 Agent
          </Button>
          <Button onClick={() => void arbor.newProject()}>
            <FolderPlus />
            新建项目
          </Button>
          <Button variant="ghost" onClick={() => void arbor.openPart()}>
            <FolderOpen />
            打开…
          </Button>
        </div>
      </div>
    </div>
  )
}
