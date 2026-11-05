import * as React from "react"
import * as THREE from "three"
import { onThemeChange } from "@/three/tokens"
import { acquireSnapshotter, releaseSnapshotter, type Snapshotter } from "@/three/snapshot"
import { displayStep, loadGlb, loadManifest, partsOf, stepsOf } from "@/three/baked"

/**
 * A static picture of a 3D object, drawn by the shared offscreen renderer
 * and redrawn when light/dark changes. Cached per key and theme.
 */
const cache = new Map<string, string>()

export function useThumbnail(
  key: string,
  make: (snap: Snapshotter) => { object: THREE.Object3D; box?: THREE.Box3; dir?: THREE.Vector3 },
  size = { w: 360, h: 270 },
) {
  const [src, setSrc] = React.useState<string | null>(null)
  const makeRef = React.useRef(make)
  makeRef.current = make
  React.useEffect(() => {
    const snap = acquireSnapshotter()
    const draw = () => {
      const theme = document.documentElement.classList.contains("dark") ? "dark" : "light"
      const k = `${key}:${theme}`
      const hit = cache.get(k)
      if (hit) return setSrc(hit)
      snap.refreshTheme()
      const { object, box, dir } = makeRef.current(snap)
      const url = snap.shot(object, { ...size, box, dir, padding: 1.08 })
      cache.set(k, url)
      setSrc(url)
    }
    // Let the page paint first; thumbnails are not urgent.
    const id = requestAnimationFrame(draw)
    const off = onThemeChange(() => requestAnimationFrame(draw))
    return () => {
      cancelAnimationFrame(id)
      off()
      releaseSnapshotter()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return src
}

/**
 * Thumbnail of a baked model: the finished part (default parameters) or the
 * assembly half-exploded, drawn once per theme by the shared renderer.
 */
export function useBakedThumbnail(id: string, size = { w: 360, h: 270 }) {
  const [src, setSrc] = React.useState<string | null>(null)
  React.useEffect(() => {
    let alive = true
    const snap = acquireSnapshotter()
    const draw = async () => {
      const theme = document.documentElement.classList.contains("dark") ? "dark" : "light"
      const k = `baked:${id}:${theme}`
      const hit = cache.get(k)
      if (hit) return setSrc(hit)
      const m = await loadManifest(id)
      const group = new THREE.Group()
      if (m.kind === "part") {
        const v = m.variants[m.defaultVariant]
        const scene = await loadGlb(id, v.file!)
        const steps = stepsOf(scene)
        group.add(displayStep(steps[steps.length - 1], snap.kit))
      } else {
        const scene = await loadGlb(id, m.file)
        const raw = partsOf(scene)
        for (const p of m.parts) {
          const node = raw.get(p.id)
          if (!node) continue
          const o = displayStep(node, snap.kit, { role: p.role })
          o.position.set(p.explode[0] * 0.55, p.explode[1] * 0.55, p.explode[2] * 0.55)
          group.add(o)
        }
      }
      if (!alive) return
      snap.refreshTheme()
      const url = snap.shot(group, { ...size, padding: 1.08 })
      cache.set(k, url)
      setSrc(url)
    }
    draw().catch(() => {})
    const off = onThemeChange(() => draw().catch(() => {}))
    return () => {
      alive = false
      off()
      releaseSnapshotter()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  return src
}
