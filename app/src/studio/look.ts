import * as THREE from "three"
import { acquireSnapshotter, releaseSnapshotter } from "@/three/snapshot"
import { VIEW_DIRS, disposeObject, type ViewName } from "@/three/viewer"
import type { DisplayData } from "./kernel/build"
import { modelObject } from "./scene"

const LABELS: Record<string, string> = { iso: "等轴测", front: "前视（从 -Y 看）", top: "上视（从 +Z 看）", right: "右视（从 +X 看）", current: "学习者当前的视角" }

/** A numbered annotation pin at a point on the model. */
export type Pin = { n: number; point: [number, number, number] }
const W = 448
const H = 336

/**
 * Render the current model from standard views as PNG data URLs, for the
 * model to look at (and for the learner to see what it saw). Fixed light
 * background so the pictures read the same in either site theme.
 */
export function renderViews(d: DisplayData, views: string[], highlight?: string, extra: { pins?: Pin[]; dir?: THREE.Vector3 } = {}): string[] {
  if (!d.mesh) return []
  const snap = acquireSnapshotter()
  try {
    return views.map((v) => {
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")!
      const obj = modelObject(d, snap.kit, { status: false, highlight })
      const dir = v === "current" && extra.dir ? extra.dir : VIEW_DIRS[(v as ViewName) in VIEW_DIRS ? (v as ViewName) : "iso"]
      snap.draw(ctx, obj, { w: W, h: H, dir, padding: 1.12 })
      disposeObject(obj)
      ctx.globalCompositeOperation = "destination-over"
      ctx.fillStyle = "white" // design-allow: picture for the model, independent of the site theme
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "black" // design-allow: label on the model-facing picture
      ctx.font = "14px sans-serif"
      ctx.fillText(LABELS[v] ?? v, 10, 22)
      for (const p of extra.pins ?? []) drawPin(ctx, p, snap.camera)
      return canvas.toDataURL("image/png")
    })
  } finally {
    releaseSnapshotter()
  }
}

/** A numbered dot where the learner clicked, as seen by `camera`. */
function drawPin(ctx: CanvasRenderingContext2D, pin: Pin, camera: THREE.Camera) {
  const v = new THREE.Vector3(...pin.point).project(camera)
  if (v.z > 1) return
  const x = ((v.x + 1) / 2) * W
  const y = ((1 - v.y) / 2) * H
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fillStyle = "#d9480f" // design-allow: pin colour on the model-facing picture
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "white" // design-allow: pin outline on the model-facing picture
  ctx.stroke()
  ctx.fillStyle = "white" // design-allow: pin number on the model-facing picture
  ctx.font = "bold 13px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(pin.n), x, y + 0.5)
  ctx.textAlign = "start"
  ctx.textBaseline = "alphabetic"
}
