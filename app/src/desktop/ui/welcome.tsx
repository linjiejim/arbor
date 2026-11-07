import type { ReactNode } from "react"
import { FolderOpen, Plug, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { arbor, inApp } from "../bridge"
import { Command, EXAMPLE_ASK } from "./agent-setup"
import { ArborMark } from "@/components/arbor-mark"

/** No part open yet: what Arbor is for, and the three ways in. */
export function Welcome({ onSetup }: { onSetup: () => void }) {
  if (!inApp)
    return (
      <div className="grid h-full place-items-center p-8 text-body text-muted-foreground">这个页面是 Arbor 桌面版的窗口，要在 Arbor App 里打开。</div>
    )
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-8">
      <div className="w-full max-w-lg">
        <ArborMark className="size-10" />
        <h1 className="mt-4 text-heading font-semibold">让本机的 coding agent 来建模</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Agent 通过 MCP 调用建模工具，几何由 OpenCascade 内核算出。你在这里看它每一步建了什么、拖参数、在面上留备注，它下一次调用就会知道。
        </p>
        <ol className="mt-6 space-y-4 text-body">
          <Step n={1} title="接入 agent">
            Claude Code、Codex 或其他支持 MCP 的 agent，一条命令。
            <div className="mt-2">
              <Button size="sm" variant="primary" onClick={onSetup}>
                <Plug />
                接入 Agent
              </Button>
            </div>
          </Step>
          <Step n={2} title="对它说要建什么">
            <div className="mt-2">
              <Command text={EXAMPLE_ASK} />
            </div>
          </Step>
          <Step n={3} title="在这里看、改、留备注">
            零件就是一个 <code className="font-mono text-small">.arbor.json</code> 文件，可以放进 git。
          </Step>
        </ol>
        <div className="mt-8 flex gap-2 border-t pt-5">
          <Button size="sm" onClick={() => void arbor.newPart()}>
            <Plus />
            新建零件
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void arbor.openPart()}>
            <FolderOpen />
            打开零件…
          </Button>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full border text-small font-medium tabular">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}
