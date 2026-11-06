// Dimensions drawn on the model (kernel/dims.ts says what and where). Each
// line is drawn twice: once depth-tested, once faint and on top, so the part
// of a dimension behind the model shows as fainter but never disappears.
import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { Line2 } from "three/addons/lines/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import type { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { MaterialKit } from "@/three/materials"
import type { Dim } from "./kernel/dims"

type V3 = [number, number, number]
const v = (p: V3) => new THREE.Vector3(...p)

/** Param name a dimension edits, if any (for the connector line from the parameters panel). */
export const dimParam = (d: Dim) => (d.source.type === "param" || d.source.type === "factor" ? d.source.name : null)

/**
 * `scale`: arrowhead and leader size in mm (a few % of the part). `accent`:
 * ids drawn in the accent colour. Labels are buttons; `onClick` gets the dim
 * and its label element.
 */
export function dimensionLayer(
  dims: Dim[],
  kit: MaterialKit,
  opts: { scale: number; accent: Set<string>; onClick?: (d: Dim, el: HTMLElement) => void; onPointLabel?: (on: boolean) => void },
) {
  const group = new THREE.Group()
  group.userData = { kind: "dimensions" }
  const materials: LineMaterial[] = []
  const mats = (accent: boolean) => {
    const solid = kit.dimension.clone()
    solid.resolution.copy(kit.dimension.resolution)
    if (accent) {
      solid.color.copy(kit.edgeHighlight.color)
      solid.linewidth = 1.6
    }
    const ghost = solid.clone()
    ghost.resolution.copy(kit.dimension.resolution)
    ghost.depthTest = false
    ghost.transparent = true
    ghost.opacity = 0.35
    materials.push(solid, ghost)
    return [solid, ghost] as const
  }
  const plain = mats(false)
  const strong = mats(true)

  const poly = (pts: THREE.Vector3[], [solid, ghost]: readonly [LineMaterial, LineMaterial]) => {
    for (const [m, order] of [
      [solid, 5],
      [ghost, 6],
    ] as const) {
      const g = new LineGeometry()
      g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]))
      const l = new Line2(g, m)
      l.renderOrder = order
      l.raycast = () => {}
      group.add(l)
    }
  }

  for (const d of dims) {
    const accent = opts.accent.has(d.id)
    const m = accent ? strong : plain
    const s = opts.scale
    let at: THREE.Vector3
    const g = d.geom
    if (g.type === "line") {
      const a = v(g.a)
      const b = v(g.b)
      const o = v(g.offset)
      const a2 = a.clone().add(o)
      const b2 = b.clone().add(o)
      const over = o.lengthSq() > 1e-12 ? o.clone().normalize().multiplyScalar(s * 0.4) : new THREE.Vector3()
      if (o.lengthSq() > 1e-12) {
        poly([a, a2.clone().add(over)], m)
        poly([b, b2.clone().add(over)], m)
      }
      poly([a2, b2], m)
      // Open arrowheads at both ends.
      const len = a2.distanceTo(b2)
      if (len > 1e-6) {
        const along = b2.clone().sub(a2).normalize()
        const side = o.lengthSq() > 1e-12 ? o.clone().normalize() : new THREE.Vector3(0, 0, 1).cross(along).normalize()
        const tick = Math.min(s * 0.6, len / 4)
        for (const [p, k] of [
          [a2, 1],
          [b2, -1],
        ] as const) {
          const back = p.clone().addScaledVector(along, k * tick)
          poly([back.clone().addScaledVector(side, tick * 0.45), p, back.clone().addScaledVector(side, -tick * 0.45)], m)
        }
      }
      at = a2.add(b2).multiplyScalar(0.5)
    } else if (g.type === "leader") {
      const p = v(g.at)
      at = p.clone().addScaledVector(v(g.dir), s * 2)
      poly([p, at], m)
    } else {
      const c = v(g.center)
      const n = v(g.normal).normalize()
      const u = new THREE.Vector3(1, 0, 0).cross(n).lengthSq() > 1e-6 ? new THREE.Vector3(1, 0, 0).cross(n).normalize() : new THREE.Vector3(0, 1, 0).cross(n).normalize()
      const w = n.clone().cross(u)
      const pts = Array.from({ length: 73 }, (_, i) => {
        const t = (i / 72) * Math.PI * 2
        return c.clone().addScaledVector(u, Math.cos(t) * g.r).addScaledVector(w, Math.sin(t) * g.r)
      })
      poly(pts, m)
      at = c.clone().addScaledVector(u, Math.SQRT1_2 * g.r).addScaledVector(w, Math.SQRT1_2 * g.r)
    }
    group.add(labelFor(d, at, accent, opts.onClick, opts.onPointLabel))
  }

  return {
    group,
    dispose() {
      group.traverse((o) => (o as Line2).geometry?.dispose?.())
      for (const m of materials) m.dispose()
    },
  }
}

/**
 * Labels that overlap on screen: a later one (lower priority) steps up or down
 * a label's height, at most twice; if it still overlaps, it is hidden. Call
 * after the labels have been positioned for the frame.
 */
export function declutter(group: THREE.Object3D) {
  const chips: HTMLElement[] = []
  group.traverse((o) => {
    const chip = (o as CSS2DObject).element?.firstElementChild as HTMLElement | null | undefined
    if (o instanceof CSS2DObject && chip) chips.push(chip)
  })
  const placed: DOMRect[] = []
  const hits = (r: DOMRect) => placed.some((p) => r.left < p.right + 2 && p.left < r.right + 2 && r.top < p.bottom + 1 && p.top < r.bottom + 1)
  for (const chip of chips) {
    chip.style.transform = ""
    chip.style.visibility = ""
    const base = chip.getBoundingClientRect()
    if (!base.width) continue
    const step = base.height + 2
    const fit = [0, -1, 1, -2, 2].find((k) => !hits(new DOMRect(base.x, base.y + k * step, base.width, base.height)))
    if (fit === undefined) {
      chip.style.visibility = "hidden"
      continue
    }
    if (fit) chip.style.transform = `translateY(${fit * step}px)`
    placed.push(new DOMRect(base.x, base.y + fit * step, base.width, base.height))
  }
}

function labelFor(d: Dim, at: THREE.Vector3, accent: boolean, onClick?: (d: Dim, el: HTMLElement) => void, onPoint?: (on: boolean) => void) {
  // The renderer moves the outer box; the chip inside can step aside (declutter).
  const box = document.createElement("div")
  const el = document.createElement(d.editable && onClick ? "button" : "div")
  box.append(el)
  el.textContent = d.text
  el.dataset.dimId = d.id
  const param = dimParam(d)
  if (param) el.dataset.dimParam = param
  el.setAttribute("aria-label", `${d.label}：${d.text}${d.editable && onClick ? "，单击修改" : ""}`)
  el.className = [
    "block rounded-xs border px-1.5 py-px font-mono text-caption tabular whitespace-nowrap transition-transform duration-(--duration-fast)",
    accent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-popover text-foreground",
    d.editable && onClick ? "interactive cursor-pointer hover:border-primary focus-visible:outline-2 focus-visible:outline-ring" : "",
  ].join(" ")
  if (d.editable && onClick) {
    ;(el as HTMLButtonElement).type = "button"
    el.addEventListener("pointerdown", (e) => e.stopPropagation())
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      onClick(d, el)
    })
  }
  if (onPoint) {
    el.addEventListener("pointerenter", () => onPoint(true))
    el.addEventListener("pointerleave", () => onPoint(false))
  }
  const o = new CSS2DObject(box)
  o.position.copy(at)
  o.renderOrder = 7
  return o
}
