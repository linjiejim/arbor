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
  triadBesideCube = false,
  className,
  children,
}: {
  onReady?: (v: Viewer) => void | (() => void)
  options?: ViewerOptions
  viewCube?: boolean
  triad?: boolean
  /** Where the axis triad sits (move it above a bottom toolbar). */
  triadClassName?: string
  /** The triad to the left of the view cube instead (keeps the bottom edge free). */
  triadBesideCube?: boolean
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
        {viewer && viewCube && triad && triadBesideCube ? (
          <div className="absolute top-3 right-3 z-10 flex items-start gap-1">
            <Triad viewer={viewer} className="mt-5" />
            <ViewCube viewer={viewer} />
          </div>
        ) : (
          <>
            {viewer && viewCube && <ViewCube viewer={viewer} className="absolute right-3 top-3 z-10" />}
            {viewer && triad && <Triad viewer={viewer} className={cn("absolute", triadClassName)} />}
          </>
        )}
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

/** Half the cube's edge, px. */
const HALF = 28
/** Width of the edge and corner bands on each face, px. */
const BAND = 13
/** Drag on the cube: radians per pixel. */
const DRAG_RAD = 0.012

/** A view direction's name: 「前右上」. */
function dirLabel(d: THREE.Vector3) {
  return [d.y < 0 ? "前" : d.y > 0 ? "后" : "", d.x > 0 ? "右" : d.x < 0 ? "左" : "", d.z > 0 ? "上" : d.z < 0 ? "下" : ""].join("")
}

/**
 * One face's nine regions: the middle turns to that face's view, the bands
 * along its sides to the edge's view, the corner squares to the corner's.
 * `key` is shared by the same edge or corner on neighbouring faces.
 */
function regions(f: (typeof FACES)[number]) {
  const out: { key: string; dir: THREE.Vector3; view: ViewName | null; label: string }[] = []
  for (const j of [1, 0, -1])
    for (const i of [-1, 0, 1]) {
      const dir = f.n.clone().addScaledVector(f.u, i).addScaledVector(f.v, j)
      const key = dir.toArray().map(Math.round).join(",")
      out.push({ key, dir, view: i === 0 && j === 0 ? f.view : null, label: dirLabel(dir) })
    }
  return out
}
const REGIONS = FACES.map(regions)

/**
 * The navigation cube, drawn in HTML with CSS 3D transforms so the labels
 * are real text. It mirrors the camera's orientation. Click a face, an edge
 * or a corner to fly to that view; drag it to turn the camera; the house for isometric.
 */
export function ViewCube({ viewer, className }: { viewer: Viewer; className?: string }) {
  const refs = React.useRef<(HTMLDivElement | null)[]>([])
  const [hot, setHot] = React.useState<string | null>(null)
  const drag = React.useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null)
  React.useEffect(() => {
    const u = new THREE.Vector3()
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    return viewer.onCameraChange(() => {
      const m = viewer.camera.matrixWorldInverse
      FACES.forEach((f, i) => {
        const el = refs.current[i]
        if (!el) return
        toCss(m, f.u, u)
        toCss(m, f.v, v)
        toCss(m, f.n, n)
        el.style.transform = `matrix3d(${u.x},${u.y},${u.z},0,${-v.x},${-v.y},${-v.z},0,${n.x},${n.y},${n.z},0,${n.x * HALF},${n.y * HALF},${n.z * HALF},1)`
        el.style.visibility = n.z > 0.02 ? "visible" : "hidden"
        el.style.zIndex = String(Math.round(n.z * 100))
      })
    })
  }, [viewer])

  const go = (r: (typeof REGIONS)[number][number]) => {
    if (drag.current?.moved) return
    if (r.view) void viewer.setView(r.view)
    else void viewer.setViewDir(r.dir)
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className="relative size-24 cursor-grab touch-none select-none active:cursor-grabbing"
        aria-label="视图方块：拖动转视角，点面、棱、角切换视图"
        role="group"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          if (!d.moved && Math.hypot(dx, dy) < 3) return
          if (!d.moved) {
            d.moved = true
            setHot(null)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          viewer.orbitBy(-dx * DRAG_RAD, -dy * DRAG_RAD)
          d.x = e.clientX
          d.y = e.clientY
        }}
        onPointerUp={() => {
          // Let the click that ends a drag see `moved`, then forget it.
          window.setTimeout(() => (drag.current = null))
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        {FACES.map((f, i) => (
          <div
            key={f.view}
            ref={(el) => {
              refs.current[i] = el
            }}
            className="absolute top-1/2 left-1/2 grid rounded-xs border border-input bg-popover/90 text-small font-medium text-muted-foreground"
            style={{ width: HALF * 2, height: HALF * 2, margin: -HALF, gridTemplateColumns: `${BAND}px 1fr ${BAND}px`, gridTemplateRows: `${BAND}px 1fr ${BAND}px` }}
          >
            {REGIONS[i].map((r) => (
              <button
                key={r.key}
                type="button"
                aria-label={`${r.view ? f.label : r.label}视图`}
                tabIndex={r.view ? 0 : -1}
                onClick={() => go(r)}
                onPointerEnter={() => !drag.current?.moved && setHot(r.key)}
                onPointerLeave={() => setHot((h) => (h === r.key ? null : h))}
                className={cn(
                  "grid min-h-0 min-w-0 place-items-center outline-none transition-colors duration-(--duration-fast) focus-visible:bg-selected",
                  hot === r.key && "bg-primary/30 text-foreground",
                )}
              >
                {r.view ? f.label : null}
              </button>
            ))}
          </div>
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
