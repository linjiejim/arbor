import * as React from "react"
import { Eye, EyeOff, Plus } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { notify } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { componentName, type Feature } from "@/studio/dsl"
import type { PartsView } from "@/studio/scene"
import type { Studio } from "@/studio/use-studio"
import { arbor } from "../bridge"
import type { DocState } from "../core/protocol"
import { besides } from "../core/sources"

const isStep = (file: string) => /\.(step|stp)$/i.test(file)

/** The parts a component shows as: its own name, `name/sub` for each part of a split part, `name#2` for each copy. */
function partsOf(studio: Studio, name: string) {
  return (studio.display?.parts ?? []).flatMap((p, k) => (p.name === name || p.name.startsWith(`${name}/`) || p.name.startsWith(`${name}#`) ? [k] : []))
}

/**
 * A component's row in the assembly's tree: an eye for its parts and 「改」 to
 * edit the part in place (the rest of the assembly stays around it).
 */
export function ComponentActions({ f, doc, studio, view, onView }: { f: Feature; doc: DocState; studio: Studio; view: PartsView; onView: (v: PartsView) => void }) {
  {
    if (f.op !== "component") return null
    const name = componentName(f)
    const parts = partsOf(studio, name)
    const hidden = parts.length > 0 && parts.every((k) => view.hidden.has(k))
    const reveal = "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
    return (
      <>
        {parts.length > 0 && (
          <IconButton
            label={hidden ? `显示「${name}」` : `隐藏「${name}」`}
            size="icon-sm"
            className={cn("size-6 text-muted-foreground", !hidden && reveal)}
            onClick={() => {
              const next = new Set(view.hidden)
              for (const k of parts) {
                if (hidden) next.delete(k)
                else next.add(k)
              }
              onView({ ...view, hidden: next })
            }}
          >
            {hidden ? <EyeOff /> : <Eye />}
          </IconButton>
        )}
        {f.file && !isStep(f.file) && (
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-6 px-1.5 text-caption text-muted-foreground", reveal)}
            onClick={async () => {
              // A sub-assembly opens as itself; a part opens inside this assembly.
              const file = f.file!
              const nested = /\.arbor-asm\.json$/i.test(file)
              const r = await arbor.call("open_part", nested ? { path: besides(doc.path, file) } : { path: besides(doc.path, file), context: doc.path })
              if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
            }}
          >
            改
          </Button>
        )}
      </>
    )
  }
}

/** 「+ 零件」 under an assembly's tree: a new part, an existing file, or a STEP. */
export function AddPartMenu({ doc }: { doc: DocState }) {
  const [naming, setNaming] = React.useState(false)
  const add = async (input: { name?: string; file?: string }) => {
    const r = await arbor.call("add_part", input, doc.path)
    if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
    return r.ok
  }
  const pick = async (kind: "part" | "step") => {
    const file = await arbor.pickFile(kind)
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
      <NewPartDialog open={naming} onOpenChange={setNaming} onCreate={(name) => add({ name })} />
    </>
  )
}

function NewPartDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await onCreate(name.trim())
    setBusy(false)
    if (ok) {
      setName("")
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
