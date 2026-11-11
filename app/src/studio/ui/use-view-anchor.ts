import * as React from "react"
import * as THREE from "three"
import type { Viewer } from "@/three/viewer"

type V3 = [number, number, number]

/**
 * A card's anchor on a point of the model: placed again whenever the camera settles; `moving` while it
 * turns (the card hides meanwhile, as the pin it belongs to moves under it).
 */
export function useViewAnchor(viewer: Viewer, point: V3) {
  const [moving, setMoving] = React.useState(false)
  const [place, setPlace] = React.useState(0)
  const anchor = React.useRef({ getBoundingClientRect: () => new DOMRect() })
  const [x, y, z] = point
  React.useLayoutEffect(() => {
    const p = viewer.project(new THREE.Vector3(x, y, z))
    const r = viewer.renderer.domElement.getBoundingClientRect()
    anchor.current = { getBoundingClientRect: () => new DOMRect(r.left + p.x, r.top + p.y, 0, 0) }
  }, [viewer, x, y, z, place])
  React.useEffect(() => {
    const start = () => setMoving(true)
    const end = () => {
      setMoving(false)
      setPlace((k) => k + 1)
    }
    viewer.controls.addEventListener("start", start)
    viewer.controls.addEventListener("end", end)
    return () => {
      viewer.controls.removeEventListener("start", start)
      viewer.controls.removeEventListener("end", end)
    }
  }, [viewer])
  return { anchor, moving, place }
}
