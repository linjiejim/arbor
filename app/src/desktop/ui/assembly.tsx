import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { notify } from "@/components/ui/toast"
import { turnery } from "../bridge"
import type { DocState } from "../core/protocol"
import { PaletteChoice } from "@/studio/ui/look-picker"

/** 「+ 零件」 over an assembly's parts: a new part, an existing file, or a STEP. */
export function AddPartMenu({ doc }: { doc: DocState }) {
  const [naming, setNaming] = React.useState(false)
  const add = async (input: { name?: string; file?: string; color?: string }) => {
    const r = await turnery.call("add_part", input, doc.path)
    if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
    return r.ok
  }
  const pick = async (kind: "part" | "step") => {
    const file = await turnery.pickFile(kind)
    if (file) await add({ file })
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-small text-muted-foreground">
            <Plus />
            零件
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setNaming(true)}>新零件…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void pick("part")}>已有零件或装配…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void pick("step")}>STEP 参考件…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewPartDialog open={naming} onOpenChange={setNaming} onCreate={(name, color) => add({ name, ...(color ? { color } : {}) })} />
    </>
  )
}

function NewPartDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (name: string, color: string | null) => Promise<boolean> }) {
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await onCreate(name.trim(), color)
    setBusy(false)
    if (ok) {
      setName("")
      setColor(null)
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title="新零件" description="建在 parts/ 下，放进这个装配，然后在装配里编辑它" />
        <DialogBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <Input autoFocus placeholder="零件名，例如 笔杆" value={name} onChange={(e) => setName(e.target.value)} aria-label="零件名" />
          </form>
          <div className="mt-4 space-y-2">
            <div className="text-small text-muted-foreground">颜色（可以以后再改）</div>
            <PaletteChoice value={color} onChange={setColor} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" disabled={!name.trim()} loading={busy} onClick={() => void submit()}>
            新建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
