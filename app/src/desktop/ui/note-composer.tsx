import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/input"

/**
 * A note for the agent about the part, some parts or one step, not a spot on the model:
 * what the site's 「让助教改」 buttons start (a step's panel, a failed requirement), the selected
 * parts' 备注 and C. `text` null = closed; otherwise the text it opens with. `about` says what it's on.
 */
/** `onSave` resolves true when the note was saved: only then does the dialog close (the draft stays otherwise). */
export function NoteComposer({ text, about, onClose, onSave }: { text: string | null; about: string; onClose: () => void; onSave: (text: string) => Promise<boolean> }) {
  const [value, setValue] = React.useState(text ?? "")
  const [opened, setOpened] = React.useState(text)
  if (opened !== text) {
    setOpened(text)
    setValue(text ?? "")
  }
  const [saving, setSaving] = React.useState(false)
  const save = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={text !== null} onOpenChange={(open) => !open && onClose()} dirty={value.trim() !== (text ?? "").trim()}>
      <DialogContent size="md">
        <DialogHeader title="给 agent 留一条备注" description={`${about}Agent 下一次调用时会知道，用 get_notes 读到全文。`} />
        <DialogBody>
          <Textarea
            rows={5}
            autoFocus
            value={value}
            maxLength={600}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void save()
              }
            }}
            placeholder="例如：把外圆角改成 R6，顶部开口边再倒个 C0.5"
            aria-label="备注"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" loading={saving} disabled={!value.trim()} onClick={() => void save()}>
            记下备注
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
