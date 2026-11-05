import { acquireSnapshotter, releaseSnapshotter } from "@/three/snapshot"
import { VIEW_DIRS, disposeObject, type ViewName } from "@/three/viewer"
import type { DisplayData } from "./kernel/build"
import { modelObject } from "./scene"

const LABELS: Record<string, string> = { iso: "等轴测", front: "前视（从 -Y 看）", top: "上视（从 +Z 看）", right: "右视（从 +X 看）" }
const W = 448
const H = 336

/**
 * Render the current model from standard views as PNG data URLs, for the
 * model to look at (and for the learner to see what it saw). Fixed light
 * background so the pictures read the same in either site theme.
 */
export function renderViews(d: DisplayData, views: string[], highlight?: string): string[] {
  if (!d.mesh) return []
  const snap = acquireSnapshotter()
  try {
    return views.map((v) => {
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")!
      const obj = modelObject(d, snap.kit, { status: false, highlight })
      snap.draw(ctx, obj, { w: W, h: H, dir: VIEW_DIRS[(v as ViewName) in VIEW_DIRS ? (v as ViewName) : "iso"], padding: 1.12 })
      disposeObject(obj)
      ctx.globalCompositeOperation = "destination-over"
      ctx.fillStyle = "white" // design-allow: picture for the model, independent of the site theme
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "black" // design-allow: label on the model-facing picture
      ctx.font = "14px sans-serif"
      ctx.fillText(LABELS[v] ?? v, 10, 22)
      return canvas.toDataURL("image/png")
    })
  } finally {
    releaseSnapshotter()
  }
}
