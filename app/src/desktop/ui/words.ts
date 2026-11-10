import * as React from "react"
import { OP_NAMES, type FeatureOp } from "@/studio/dsl"
import type { Actor } from "../core/protocol"

/** Re-render every few seconds, for 「12 秒前」. */
export function useNow(ms = 5000) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const COMMAND_LABELS: Record<string, string> = {
  guide: "读说明",
  open_part: "打开零件",
  open_project: "打开项目",
  list_parts: "看零件列表",
  get_state: "读模型状态",
  set_params: "改参数",
  edit_feature: "改特征",
  delete_feature: "删特征",
  inspect: "查看模型",
  set_tree: "替换特征树",
  move_feature: "调整顺序",
  undo: "撤销",
  redo: "重做",
  look: "看模型",
  measure: "测量",
  check: "核对需求",
  export: "导出",
  get_notes: "读备注",
  resolve_note: "回复备注",
  request_pick: "等你点选",
  show: "指给你看",
}

/** 「做拉伸」「核对需求」 */
export const commandLabel = (name: string) => COMMAND_LABELS[name] ?? (name in OP_NAMES ? `做${OP_NAMES[name as FeatureOp]}` : name)

export const ACTOR_LABEL: Record<Actor, string> = { agent: "Agent", assistant: "助手", user: "你", file: "文件" }

/** 「刚刚」「12 秒前」「3 分钟前」 */
export function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 10) return "刚刚"
  if (s < 60) return `${s} 秒前`
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return new Date(at).toLocaleDateString("zh-CN")
}
