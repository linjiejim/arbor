import type { DocState } from "./core/protocol"
import { besides } from "./core/sources"

const isStep = (file: string) => /\.(step|stp)$/i.test(file)

/**
 * Where a component's own file is, to open it: a part opens on its own or inside the assembly; a
 * sub-assembly opens as itself. A STEP reference or a standard part has no file of its own (`reason`).
 */
export function openTarget(doc: DocState, file: string): { path: string; nested: boolean; reason?: undefined } | { reason: string; path?: undefined; nested?: undefined } {
  if (!file) return { reason: "标准件没有零件文件" }
  if (isStep(file)) return { reason: "STEP 参考件没有零件文件" }
  return { path: besides(doc.path, file), nested: /\.(turnery|arbor)-asm\.json$/i.test(file) }
}
