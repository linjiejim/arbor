import type { OpId } from "./ops"

/** Teardowns on the roadmap that are not baked yet (shown as planned cards). */
export const PLANNED_MODELS: { title: string; subtitle: string; level: string; kind: string; ops: OpId[] }[] = [
  { title: "直齿轮", subtitle: "渐开线 · 模数与齿数驱动", level: "进阶", kind: "单零件", ops: ["sketch", "extrude", "pattern"] },
  { title: "六角螺栓与螺母", subtitle: "多边形 · 倒角 · 螺纹", level: "进阶", kind: "装配", ops: ["extrude", "chamfer", "thread"] },
  { title: "钣金支架", subtitle: "法兰 · 折弯 · 展开", level: "进阶", kind: "单零件", ops: ["extrude", "fillet", "hole"] },
  { title: "手电筒", subtitle: "旋转件 · 螺纹 · 装配顺序", level: "进阶", kind: "装配", ops: ["revolve", "thread", "boolean"] },
  { title: "无线鼠标外壳", subtitle: "曲面 · G2 连续 · 分模", level: "高级", kind: "单零件", ops: ["loft", "thicken", "draft"] },
]
