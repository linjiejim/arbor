import * as React from "react"
import type { UIMessage } from "ai"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input, Textarea } from "@/components/ui/input"
import { notify } from "@/components/ui/toast"
import type { Tree } from "../dsl"
import { LIMITS } from "../limits"
import { chatLines, createShare, deleteShare, payloadProblem, sharePayload, shareUrl, type ShareCreated } from "../share"

/** 「法兰盘」rather than 「草图1」: the first feature that isn't a sketch, named by the model. */
function defaultTitle(tree: Tree) {
  const named = tree.features.find((f) => f.op !== "sketch" && f.name?.trim())
  return named?.name?.trim().slice(0, LIMITS.title) || "我的模型"
}

/**
 * Make a link to the current model: title, an optional note, and (only when
 * ticked) the text of the chat. Once made, the link can be copied or deleted
 * again; deleting is the one irreversible step, so it asks first.
 */
export function ShareDialog({ open, onOpenChange, tree, messages }: { open: boolean; onOpenChange: (o: boolean) => void; tree: Tree; messages: UIMessage[] }) {
  const [title, setTitle] = React.useState("")
  const [note, setNote] = React.useState("")
  const [withChat, setWithChat] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [made, setMade] = React.useState<ShareCreated | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const lines = React.useMemo(() => (open ? chatLines(messages).length : 0), [open, messages])

  // Every opening starts a new link from the model as it is now.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(defaultTitle(tree))
      setNote("")
      setWithChat(false)
      setError(null)
      setMade(null)
    }
  }

  const generate = async () => {
    const payload = sharePayload({ title, note, tree, messages: withChat ? messages : undefined })
    const problem = payloadProblem(payload)
    if (problem) return setError(problem)
    setPending(true)
    setError(null)
    try {
      setMade(await createShare(payload))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  const url = made ? shareUrl(made.id) : ""
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      notify.success("已复制链接")
    } catch {
      notify("没能复制，请手动选中链接复制")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader title="分享模型" description={made ? "知道链接的人都能打开、拖参数、复制到自己的工作台；链接不会被列出或搜到。" : "生成一个链接，别人打开就能看到同一个模型。"} />
          {made ? (
            <DialogBody>
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label="分享链接" className="font-mono" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="primary" onClick={() => void copy()}>
                  复制链接
                </Button>
              </div>
              <p className="mt-3 text-small text-muted-foreground">一年里没人打开过的链接会自动删除。之后再改模型，链接里的不会跟着变。</p>
              <Button variant="link" size="sm" className="mt-4 text-destructive" onClick={() => setConfirmDelete(true)}>
                删除这个链接
              </Button>
            </DialogBody>
          ) : (
            <DialogBody>
              <FieldGroup>
                <Field label="标题" required>
                  <Input value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label="说明" hint={`可选，最多 ${LIMITS.note} 字`}>
                  <Textarea value={note} maxLength={LIMITS.note} rows={2} placeholder="例如：第三课作业" onChange={(e) => setNote(e.target.value)} />
                </Field>
                <label className="flex items-start gap-2">
                  <Checkbox className="mt-0.5" checked={withChat} disabled={!lines} onCheckedChange={(c) => setWithChat(c === true)} />
                  <span>
                    <span className="block text-body">附上和助教的对话（只含文字）</span>
                    <span className="block text-small text-faint-foreground">
                      {lines ? `会带上 ${lines} 条消息；图片、思考过程和工具调用不会带上` : "还没有对话"}
                    </span>
                  </span>
                </label>
              </FieldGroup>
              {error && (
                <p role="alert" className="mt-4 rounded-md bg-destructive-subtle px-3 py-2 text-small text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
          )}
          <DialogFooter>
            {made ? (
              <Button onClick={() => onOpenChange(false)}>关闭</Button>
            ) : (
              <Button variant="primary" loading={pending} disabled={!title.trim()} onClick={() => void generate()}>
                生成链接
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="删除这个链接？"
        description="之后打开它的人只会看到「链接不存在」。删除后不能恢复。"
        confirmLabel="删除链接"
        tone="danger"
        onConfirm={async () => {
          if (!made) return
          await deleteShare(made.id, made.deleteToken)
          setMade(null)
          onOpenChange(false)
          notify.success("已删除链接")
        }}
      />
    </>
  )
}
