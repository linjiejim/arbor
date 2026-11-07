import * as React from "react"
import { Copy } from "lucide-react"
import { IconButton } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { notify } from "@/components/ui/toast"
import { arbor } from "../bridge"
import type { AgentSetup } from "../core/protocol"

export const EXAMPLE_ASK = "用 arbor 建一个 80×50×30 的盒子，壁厚 2，外圆角 R4，四角 M3 螺纹孔，建完核对尺寸再看一眼。"

/** How to plug a local coding agent into Arbor: one command per agent. */
export function AgentSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [setup, setSetup] = React.useState<AgentSetup | null>(null)
  React.useEffect(() => {
    if (open && !setup) void arbor.agentSetup().then(setSetup)
  }, [open, setup])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="接入 coding agent" description="Arbor 通过 MCP 把建模和查看的工具交给本机的 agent；agent 每改一步，这个窗口都实时显示。" />
        <DialogBody className="space-y-5 pb-5">
          {setup ? (
            <>
              <Section title="Claude Code" hint="在终端里运行一次：">
                <Command text={setup.claude} />
              </Section>
              <Section title="Codex" hint="在终端里运行一次：">
                <Command text={setup.codex} />
              </Section>
              <Section title="其他支持 MCP 的 agent" hint="Cursor、Claude Desktop 等，写进它们的 MCP 配置：">
                <Command text={setup.json} />
              </Section>
              <Section title="然后对 agent 说" hint="例如：">
                <Command text={EXAMPLE_ASK} />
              </Section>
              <p className="text-small text-muted-foreground">
                同一个程序也是命令行工具：<code className="font-mono text-small">{setup.bin} help</code>。窗口没开时 agent 也能建模、核对、导出，用到看图或点选时会自动打开 Arbor。
              </p>
            </>
          ) : (
            <p className="text-body text-muted-foreground">正在读取…</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-body font-medium">{title}</h3>
      <p className="mt-0.5 mb-1.5 text-small text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

export function Command({ text }: { text: string }) {
  return (
    <div className="group relative rounded-md border bg-sunken">
      <pre className="overflow-x-auto py-2 pr-10 pl-3 font-mono text-small leading-relaxed whitespace-pre-wrap break-all">{text}</pre>
      <IconButton
        label="复制"
        size="icon-sm"
        className="absolute top-1 right-1"
        onClick={() => void arbor.copy(text).then(() => notify.success("已复制"))}
      >
        <Copy />
      </IconButton>
    </div>
  )
}
