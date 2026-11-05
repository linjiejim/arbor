// Turn whatever the kernel threw into something people (and the model) can act on.
// With replicad-opencascadejs 1.x, OCCT C++ exceptions arrive as native
// WebAssembly.Exception objects; oc.getExceptionMessage() decodes them.
import { getOC } from "replicad"
import { ExprError } from "../expr"

export type KernelError = { kind: "occt" | "input" | "js"; type: string; message: string }

/** Thrown for problems in the feature definition itself (bad reference, empty selection…). */
export class InputError extends Error {}

export function describeError(err: unknown): KernelError {
  if (err instanceof InputError || err instanceof ExprError) return { kind: "input", type: "input", message: err.message }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc: any = getOC()
  if (typeof WebAssembly !== "undefined" && "Exception" in WebAssembly && err instanceof WebAssembly.Exception) {
    let type = "OCCT"
    let message = ""
    try {
      const decoded = oc.getExceptionMessage(err)
      if (Array.isArray(decoded)) [type, message] = decoded
      else if (decoded) message = String(decoded)
    } catch {
      /* keep defaults */
    }
    try {
      oc.decrementExceptionRefcount(err)
    } catch {
      /* not fatal */
    }
    return { kind: "occt", type, message }
  }
  if (typeof err === "number") return { kind: "occt", type: "Standard_Failure", message: `内核异常 ${err}` }
  const e = err as Error
  return { kind: "js", type: e?.name ?? "Error", message: String(e?.message ?? err) }
}

/** Plain-language explanation and a likely fix, per operation. */
export function explain(op: string, e: KernelError): { message: string; hint?: string } {
  if (e.kind === "input") return { message: e.message }
  const raw = `${e.type}${e.message ? `: ${e.message}` : ""}`
  switch (op) {
    case "fillet":
      return {
        message: `内核没能做出这个圆角（${raw}）`,
        hint: "多半是半径太大：圆角不能大于相邻面的宽度或壁厚。先试小一点的半径，或少选几条边。",
      }
    case "chamfer":
      return { message: `内核没能做出这个倒角（${raw}）`, hint: "倒角距离可能超过了相邻面的宽度，试小一点。" }
    case "shell":
      return {
        message: `抽壳失败（${raw}）`,
        hint: "壁厚可能大于某处圆角半径或局部尺寸；常见修法是先抽壳再做外圆角，或减小壁厚。",
      }
    case "extrude":
    case "revolve":
      return { message: `${op === "extrude" ? "拉伸" : "旋转"}失败（${raw}）`, hint: "检查草图是否闭合、是否自相交；旋转时轮廓不能跨过旋转轴。" }
    default:
      return { message: `内核报错（${raw}）` }
  }
}
