import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { notify } from "@/components/ui/toast"
import { turnery } from "../bridge"
import type { ModelSettings } from "../core/protocol"

/** Which model the built-in assistant uses: a provider, a model name, a key. */
export function ModelSettingsDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (s: ModelSettings) => void }) {
  const [settings, setSettings] = React.useState<ModelSettings | null>(null)
  const [preset, setPreset] = React.useState("")
  const [model, setModel] = React.useState("")
  const [baseURL, setBaseURL] = React.useState("")
  const [vision, setVision] = React.useState(false)
  const [key, setKey] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const pick = React.useCallback((s: ModelSettings, id: string) => {
    const p = s.presets.find((x) => x.id === id)
    if (!p) return
    setPreset(id)
    setModel(p.model)
    setBaseURL(p.baseURL)
    setVision(p.vision ?? p.defaultVision)
    setKey("")
  }, [])
  React.useEffect(() => {
    if (!open) return
    void turnery.models().then((s) => {
      setSettings(s)
      pick(s, s.current ?? s.presets[0]?.id ?? "")
    })
  }, [open, pick])

  const p = settings?.presets.find((x) => x.id === preset)
  const save = async () => {
    if (!p) return
    setSaving(true)
    try {
      const next = await turnery.saveModel({ preset, model: model.trim(), baseURL: baseURL.trim(), vision, key: key.trim() ? key.trim() : undefined })
      onSaved(next)
      onOpenChange(false)
    } catch {
      notify.error("没能保存模型设置")
    } finally {
      setSaving(false)
    }
  }
  const ready = Boolean(p && (model.trim() || p.defaultModel) && (p.keyless || p.hasKey || key.trim()) && (p.defaultBaseURL || baseURL.trim() || p.id === "anthropic" || p.id === "deepseek"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader title="助手用哪个模型" description="对话建模用你自己的模型和 key。key 只留在这台电脑上，不进项目文件夹。" />
        <DialogBody className="space-y-4 pb-2">
          {settings && p && (
            <>
              <Field label="服务商">
                <Select aria-label="服务商" value={preset} onValueChange={(id) => pick(settings, id)} options={settings.presets.map((x) => ({ value: x.id, label: x.name }))} />
              </Field>
              <Field label="模型名" hint={p.defaultModel ? `不填就用 ${p.defaultModel}` : "这家要自己填模型名，照它的文档写"}>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={p.defaultModel || "模型名"} spellCheck={false} />
              </Field>
              <Field label="地址" hint={p.defaultBaseURL ? "一般不用改" : p.id === "custom" ? "OpenAI 兼容的地址，通常以 /v1 结尾" : "不填用官方地址"}>
                <Input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder={p.defaultBaseURL || "https://…/v1"} spellCheck={false} />
              </Field>
              {!p.keyless && (
                <Field
                  label="Key"
                  hint={
                    p.hasKey
                      ? `${p.keyNote}。留空就继续用它。`
                      : settings.keysEncrypted
                        ? "保存时用系统的钥匙串加密。"
                        : "保存在 ~/.turnery/providers.json，明文，文件只有你能读。"
                  }
                >
                  <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={p.hasKey ? "••••••••" : "粘贴 key"} autoComplete="off" spellCheck={false} />
                </Field>
              )}
              <label className="flex items-center justify-between gap-3 text-body">
                <span>
                  这个模型能看图
                  <span className="block text-caption text-muted-foreground">打开后，助手用「看一眼」时会收到渲染图；看不了图的模型改用测量来确认。</span>
                </span>
                <Switch checked={vision} onCheckedChange={setVision} aria-label="这个模型能看图" />
              </label>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={!ready} loading={saving} onClick={() => void save()}>
            保存并使用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
