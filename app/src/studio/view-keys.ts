/** What a click on the model does: select, note a face or edge, frame or draw a note, measure. */
export type ViewTool = "select" | "note" | "box" | "pen" | "measure"

/** The view's one-letter keys, as the 「快捷键」 card lists them (the host adds its own). */
export type KeyRow = { keys: string; what: string }

export const VIEW_KEYS: KeyRow[] = [
  { keys: "V", what: "查看与选择（Esc 也回到这里）" },
  { keys: "C", what: "标注：点面或边；选中了零件时，给选中的写备注" },
  { keys: "R", what: "框选标注：拖出一个框" },
  { keys: "P", what: "画笔标注：在模型上画" },
  { keys: "M", what: "测量" },
  { keys: "X", what: "剖视" },
  { keys: "D", what: "显示尺寸" },
  { keys: "E", what: "爆炸" },
  { keys: "A", what: "颜色 / 白模" },
  { keys: "F", what: "适应窗口；选中了零件时对准选中的" },
  { keys: "H / ⇧H", what: "隐藏选中的 / 全部显示" },
  { keys: "I", what: "隔离选中的，再按一次恢复" },
  { keys: "Esc", what: "一级一级退出：卡片、工具、选中、回到的步骤" },
  { keys: "?", what: "这张表" },
]
