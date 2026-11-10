import * as React from "react"
import { Box, Folder, FolderOpen, FolderPlus, PanelLeft, Plug } from "lucide-react"
import { TurneryMark } from "@/components/turnery-mark"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { notify } from "@/components/ui/toast"
import { turnery, inApp } from "../bridge"
import type { RecentProject } from "../core/protocol"

/** Nothing open yet: the mark, one line, the three ways in, and the projects opened lately. */
export function Welcome({ onSetup }: { onSetup: () => void }) {
  const [recent, setRecent] = React.useState<RecentProject[]>([])
  React.useEffect(() => {
    let alive = true
    void turnery.recentProjects().then((list) => alive && setRecent(list))
    return () => {
      alive = false
    }
  }, [])
  if (!inApp)
    return (
      <div className="grid h-full place-items-center p-8 text-body text-muted-foreground">这个页面是 Turnery 桌面版的窗口，要在 Turnery App 里打开。</div>
    )
  const home = (p: string) => p.replace(/^\/(Users|home)\/[^/]+/, "~")
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-8">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <TurneryMark className="size-14" />
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
          <Button onClick={() => void turnery.newProject()}>
            <FolderPlus />
            新建项目
          </Button>
          <Button variant="ghost" onClick={() => void turnery.openPart()}>
            <FolderOpen />
            打开…
          </Button>
        </div>
        <div className="mt-5 flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!(await turnery.openExample().catch(() => false))) notify.error("没能打开示例")
            }}
          >
            <Box />
            先看一个示例：传感器外壳
          </Button>
          <p className="text-caption text-faint-foreground">不用接 agent。打开后在「参数」里把 t 改成 3：壁变厚，「壁厚 2」这项核对变红。</p>
        </div>
        {recent.length > 0 && (
          <section aria-label="最近的项目" className="mt-10 w-full text-left">
            <h2 className="px-2.5 pb-1.5 text-caption text-faint-foreground">最近的项目</h2>
            <ul className="flex flex-col">
              {recent.map((p) => (
                <li key={p.root}>
                  <button
                    type="button"
                    title={p.root}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={async () => {
                      if (!(await turnery.openProjectAt(p.root).catch(() => false))) notify.error(`打不开 ${p.name}`)
                    }}
                  >
                    <Folder className="size-4 shrink-0 text-faint-foreground" />
                    <span className="max-w-[60%] shrink-0 truncate text-body">{p.name}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-caption text-faint-foreground">{home(p.root)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

/** A project is open but none of its files: say where to pick one. */
export function ProjectStart({ name }: { name: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <PanelLeft className="size-6 text-faint-foreground" />
        <p className="text-body font-medium">{name}</p>
        <p className="text-small text-muted-foreground">从左栏选一个装配或零件打开，或者让 agent 在这个项目里建模。</p>
      </div>
    </div>
  )
}
