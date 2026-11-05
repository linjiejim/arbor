import * as React from "react"
import * as THREE from "three"
import { House } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"
import { Viewer, type ViewName, type ViewerOptions } from "@/three/viewer"
import { ViewerCtx } from "@/components/viewer-context"

/**
 * Hosts one Viewer. `onReady` runs once with the viewer and may return a
 * cleanup. Overlays (view cube, triad, toolbars) are plain HTML on top;
 * they can reach the viewer with `useViewer()` from viewer-context.
 */
export function Viewport({
  onReady,
  options,
  viewCube = true,
  triad = true,
  triadClassName = "bottom-3 left-3",
  className,
  children,
}: {
  onReady?: (v: Viewer) => void | (() => void)
  options?: ViewerOptions
  viewCube?: boolean
  triad?: boolean
  /** Where the axis triad sits (move it above a bottom toolbar). */
  triadClassName?: string
  className?: string
  children?: React.ReactNode
}) {
  const host = React.useRef<HTMLDivElement>(null)
  const [viewer, setViewer] = React.useState<Viewer | null>(null)
  const ready = React.useRef(onReady)
  ready.current = onReady

  React.useEffect(() => {
    const v = new Viewer(host.current!, options)
    setViewer(v)
    const cleanup = ready.current?.(v)
    return () => {
      cleanup?.()
      v.dispose()
      setViewer(null)
    }
    // The viewer lives for the component's lifetime; options are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn("relative isolate overflow-hidden bg-scene", className)}>
      <div ref={host} className="absolute inset-0" />
      <ViewerCtx.Provider value={viewer}>
        {viewer && viewCube && <ViewCube viewer={viewer} className="absolute right-3 top-3" />}
        {viewer && triad && <Triad viewer={viewer} className={cn("absolute", triadClassName)} />}
        {children}
      </ViewerCtx.Provider>
    </div>
  )
}

// ------------------------------------------------------------------ view cube

const FACES: { view: ViewName; label: string; n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }[] = [
  { view: "front", label: "前", n: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  { view: "back", label: "后", n: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  { view: "right", label: "右", n: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 1, 0), v: new THREE.Vector3(0, 0, 1) },
  { view: "left", label: "左", n: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, -1, 0), v: new THREE.Vector3(0, 0, 1) },
  { view: "top", label: "上", n: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  { view: "bottom", label: "下", n: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, -1, 0) },
]

/** World direction → CSS 3D space of the overlay (x right, y down, z towards the viewer). */
function toCss(m: THREE.Matrix4, w: THREE.Vector3, out: THREE.Vector3) {
  out.copy(w).transformDirection(m)
  out.y = -out.y
  return out
}

/**
 * The navigation cube, drawn in HTML with CSS 3D transforms so the labels
 * are real text. It mirrors the camera's orientation; click a face to fly
 * to that standard view, the house for isometric.
 */
export function ViewCube({ viewer, className }: { viewer: Viewer; className?: string }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  React.useEffect(() => {
    const u = new THREE.Vector3()
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    const h = 22
    return viewer.onCameraChange(() => {
      const m = viewer.camera.matrixWorldInverse
      FACES.forEach((f, i) => {
        const el = refs.current[i]
        if (!el) return
        toCss(m, f.u, u)
        toCss(m, f.v, v)
        toCss(m, f.n, n)
        el.style.transform = `matrix3d(${u.x},${u.y},${u.z},0,${-v.x},${-v.y},${-v.z},0,${n.x},${n.y},${n.z},0,${n.x * h},${n.y * h},${n.z * h},1)`
        el.style.visibility = n.z > 0.02 ? "visible" : "hidden"
        el.style.zIndex = String(Math.round(n.z * 100))
      })
    })
  }, [viewer])

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative size-16" aria-label="视图方块" role="group">
        {FACES.map((f, i) => (
          <button
            key={f.view}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            aria-label={`${f.label}视图`}
            onClick={() => viewer.setView(f.view)}
            className={cn(
              "absolute left-1/2 top-1/2 -ml-[22px] -mt-[22px] grid size-[44px] place-items-center",
              "rounded-xs border border-input bg-popover/90 text-small font-medium text-muted-foreground",
              "transition-colors duration-(--duration-fast) hover:border-primary hover:bg-selected hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <IconButton label="等轴测视图" size="icon-sm" className="text-muted-foreground" onClick={() => viewer.setView("iso")}>
        <House />
      </IconButton>
    </div>
  )
}

// ------------------------------------------------------------------ triad

const AXES = [
  { name: "X", dir: new THREE.Vector3(1, 0, 0), cls: "stroke-axis-x", text: "fill-axis-x" },
  { name: "Y", dir: new THREE.Vector3(0, 1, 0), cls: "stroke-axis-y", text: "fill-axis-y" },
  { name: "Z", dir: new THREE.Vector3(0, 0, 1), cls: "stroke-axis-z", text: "fill-axis-z" },
]

/** X/Y/Z axis indicator that follows the camera. */
export function Triad({ viewer, className }: { viewer: Viewer; className?: string }) {
  const lines = React.useRef<(SVGLineElement | null)[]>([])
  const labels = React.useRef<(SVGTextElement | null)[]>([])
  React.useEffect(() => {
    const p = new THREE.Vector3()
    return viewer.onCameraChange(() => {
      const m = viewer.camera.matrixWorldInverse
      AXES.forEach((a, i) => {
        toCss(m, a.dir, p)
        const x = 28 + p.x * 18
        const y = 28 + p.y * 18
        lines.current[i]?.setAttribute("x2", String(x))
        lines.current[i]?.setAttribute("y2", String(y))
        labels.current[i]?.setAttribute("x", String(28 + p.x * 25))
        labels.current[i]?.setAttribute("y", String(28 + p.y * 25 + 4))
      })
    })
  }, [viewer])
  return (
    <svg viewBox="0 0 56 56" className={cn("pointer-events-none size-14", className)} aria-hidden>
      {AXES.map((a, i) => (
        <g key={a.name}>
          <line
            ref={(el) => {
              lines.current[i] = el
            }}
            x1="28"
            y1="28"
            x2="28"
            y2="28"
            className={a.cls}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            ref={(el) => {
              labels.current[i] = el
            }}
            textAnchor="middle"
            className={cn("text-caption font-semibold", a.text)}
          >
            {a.name}
          </text>
        </g>
      ))}
    </svg>
  )
}
