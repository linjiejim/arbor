import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { MaterialKit } from "./materials"
import { onThemeChange, readSceneTokens, type SceneTokens } from "./tokens"
import { Tweens, ease } from "./tween"

/**
 * A CAD-style viewport: Z-up world in millimetres, orbit/pan/zoom, crisp
 * edges, token-driven colours, HTML labels, and on-demand rendering (a frame
 * is drawn only when something moved).
 *
 * Views follow the Z-up convention of Onshape / Rhino / NX / build123d:
 *   front looks along +Y, right along −X, top straight down −Z.
 */
export type ViewName = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom"

export const VIEW_DIRS: Record<ViewName, THREE.Vector3> = {
  iso: new THREE.Vector3(1, -1.1, 0.85).normalize(),
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, -1e-4, 1).normalize(),
  bottom: new THREE.Vector3(0, -1e-4, -1).normalize(),
}

export type ViewerOptions = {
  grid?: boolean
  /** Half extent of the ground grid, mm. */
  gridSize?: number
  gridStep?: number
  fov?: number
  /** Disable orbit/pan/zoom (thumbnails, scripted heroes). */
  interactive?: boolean
}

type FrameHook = (dt: number, now: number) => boolean | void

export class Viewer {
  readonly container: HTMLElement
  readonly renderer: THREE.WebGLRenderer
  readonly labels: CSS2DRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  /** Models and their annotations. */
  readonly content = new THREE.Group()
  /** Grid, datum planes and other scaffolding. */
  readonly helpers = new THREE.Group()
  readonly tweens = new Tweens()
  readonly kit: MaterialKit
  tokens: SceneTokens

  private grid: THREE.Group | null = null
  private axisMats: THREE.LineBasicMaterial[] = []
  private raf = 0
  private dirty = true
  private lastTime = 0
  private visible = true
  private frameHooks = new Set<FrameHook>()
  private renderedListeners = new Set<() => void>()
  private cameraListeners = new Set<() => void>()
  private themeListeners = new Set<(t: SceneTokens) => void>()
  private ro: ResizeObserver
  private io: IntersectionObserver
  private stopTheme: () => void
  private pmrem: THREE.PMREMGenerator
  private envRT: THREE.WebGLRenderTarget
  private raycaster = new THREE.Raycaster()
  size = { w: 1, h: 1 }

  constructor(container: HTMLElement, opts: ViewerOptions = {}) {
    this.container = container
    this.tokens = readSceneTokens()

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.localClippingEnabled = true
    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.outline = "none"
    container.appendChild(renderer.domElement)
    this.renderer = renderer

    this.labels = new CSS2DRenderer()
    this.labels.domElement.className = "scene-labels"
    Object.assign(this.labels.domElement.style, { position: "absolute", inset: "0", overflow: "hidden" })
    container.appendChild(this.labels.domElement)

    this.scene.background = this.tokens.bg.clone()
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = this.envRT.texture
    this.scene.environmentIntensity = 0.55

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 28, 1, 0.5, 20000)
    this.camera.up.set(0, 0, 1)
    this.camera.position.copy(VIEW_DIRS.iso).multiplyScalar(320)
    this.camera.lookAt(0, 0, 0)

    // Headlights: the key light rides with the camera so shading reads the same from every angle.
    const key = new THREE.DirectionalLight(undefined, 1.6)
    key.position.set(-1.2, 2.2, 3)
    const fill = new THREE.DirectionalLight(undefined, 0.45)
    fill.position.set(2, -1, 1.5)
    this.camera.add(key, fill)
    const hemi = new THREE.HemisphereLight(undefined, undefined, 0.55)
    hemi.groundColor.setScalar(0.5)
    hemi.position.set(0, 0, 1)
    this.scene.add(this.camera, hemi, this.content, this.helpers)

    this.kit = new MaterialKit(this.tokens)

    this.controls = new OrbitControls(this.camera, renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.14
    this.controls.rotateSpeed = 0.9
    this.controls.zoomToCursor = true
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 5
    this.controls.maxDistance = 6000
    this.controls.enabled = opts.interactive !== false
    this.controls.addEventListener("change", () => this.invalidate())

    if (opts.grid !== false) this.setGrid(opts.gridSize ?? 200, opts.gridStep ?? 10)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting
      if (this.visible) this.invalidate()
    })
    this.io.observe(container)
    this.stopTheme = onThemeChange(() => this.refreshTheme())
    this.resize()
    this.raf = requestAnimationFrame(this.loop)
  }

  // ---------------------------------------------------------------- loop

  invalidate() {
    this.dirty = true
  }

  /** Called every frame while mounted; return true to keep frames coming (an animation is running). */
  onFrame(hook: FrameHook): () => void {
    this.frameHooks.add(hook)
    this.invalidate()
    return () => this.frameHooks.delete(hook)
  }

  /** Subscribe to actual completed draws, without the immediate camera callback. */
  onRendered(cb: () => void): () => void {
    this.renderedListeners.add(cb)
    this.invalidate()
    return () => this.renderedListeners.delete(cb)
  }

  /** Called after each rendered frame (view cube, triad, overlays). */
  onCameraChange(cb: () => void): () => void {
    this.cameraListeners.add(cb)
    cb()
    return () => this.cameraListeners.delete(cb)
  }

  onTheme(cb: (t: SceneTokens) => void): () => void {
    this.themeListeners.add(cb)
    return () => this.themeListeners.delete(cb)
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0
    this.lastTime = now
    if (!this.visible) return
    let moving = this.controls.update(dt)
    if (this.tweens.tick(now)) moving = true
    for (const hook of this.frameHooks) if (hook(dt, now)) moving = true
    if (moving || this.dirty) {
      this.dirty = false
      this.renderNow()
    }
  }

  renderNow() {
    this.renderer.render(this.scene, this.camera)
    this.labels.render(this.scene, this.camera)
    for (const cb of this.cameraListeners) cb()
    for (const cb of this.renderedListeners) cb()
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.size = { w, h }
    this.renderer.setSize(w, h, false)
    this.labels.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.kit.setResolution(w, h)
    this.dirty = true
    if (this.visible) this.renderNow()
  }

  private refreshTheme() {
    this.tokens = readSceneTokens()
    ;(this.scene.background as THREE.Color).copy(this.tokens.bg)
    this.kit.applyTokens(this.tokens)
    const [x, y] = this.axisMats
    x?.color.copy(this.tokens.axisX)
    y?.color.copy(this.tokens.axisY)
    for (const cb of this.themeListeners) cb(this.tokens)
    this.invalidate()
  }

  // ---------------------------------------------------------------- grid

  setGrid(half: number, step: number) {
    if (this.grid) {
      this.helpers.remove(this.grid)
      disposeObject(this.grid)
    }
    const g = new THREE.Group()
    g.name = "grid"
    const minor: number[] = []
    const major: number[] = []
    const n = Math.round(half / step)
    for (let i = -n; i <= n; i++) {
      const v = i * step
      if (i === 0) continue
      const arr = i % 5 === 0 ? major : minor
      arr.push(-half, v, 0, half, v, 0, v, -half, 0, v, half, 0)
    }
    const mk = (pos: number[], mat: THREE.Material) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      const l = new THREE.LineSegments(geo, mat)
      l.renderOrder = -2
      return l
    }
    g.add(mk(minor, this.kit.gridMinor), mk(major, this.kit.gridMajor))
    const ax = new THREE.LineBasicMaterial({ color: this.tokens.axisX, transparent: true, opacity: 0.7, depthWrite: false })
    const ay = new THREE.LineBasicMaterial({ color: this.tokens.axisY, transparent: true, opacity: 0.7, depthWrite: false })
    this.axisMats = [ax, ay]
    g.add(mk([-half, 0, 0, half, 0, 0], ax), mk([0, -half, 0, 0, half, 0], ay))
    g.position.z = -0.02
    this.grid = g
    this.helpers.add(g)
    this.invalidate()
  }

  showGrid(on: boolean) {
    if (this.grid) this.grid.visible = on
    this.invalidate()
  }

  // ---------------------------------------------------------------- camera

  /** Fly the camera to a standard view, keeping the current target and distance unless given. */
  setView(name: ViewName, opts: { animate?: boolean; distance?: number; target?: THREE.Vector3 } = {}) {
    const target = opts.target ?? this.controls.target.clone()
    const dist = opts.distance ?? this.camera.position.distanceTo(this.controls.target)
    const pos = VIEW_DIRS[name].clone().multiplyScalar(dist).add(target)
    return this.flyTo(pos, target, opts.animate === false ? 0 : 750)
  }

  /**
   * Fly to look at the target from a direction (a view cube's edge or corner),
   * keeping target and distance. Straight up or down is nudged off the Z axis, like the top view.
   */
  setViewDir(dir: THREE.Vector3, opts: { animate?: boolean } = {}) {
    const d = dir.clone().normalize()
    if (Math.abs(d.z) > 0.9999) d.set(0, -1e-4, Math.sign(d.z)).normalize()
    const target = this.controls.target.clone()
    const pos = d.multiplyScalar(this.camera.position.distanceTo(target)).add(target)
    return this.flyTo(pos, target, opts.animate === false ? 0 : 750)
  }

  /** Turn the camera around its target: `azimuth` about world Z, `polar` towards or away from the pole (radians). */
  orbitBy(azimuth: number, polar: number) {
    this.tweens.cancel("camera")
    const target = this.controls.target
    const off = this.camera.position.clone().sub(target)
    const r = off.length()
    const theta = Math.atan2(off.y, off.x) + azimuth
    const phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(off.z / r, -1, 1)) + polar, 1e-3, Math.PI - 1e-3)
    off.set(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)).multiplyScalar(r)
    this.camera.position.copy(target).add(off)
    this.camera.lookAt(target)
    this.invalidate()
  }

  /** Arc the camera around its target (slerped direction, lerped distance) so orientation changes read clearly. */
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, duration = 750) {
    const fromT = this.controls.target.clone()
    const fromOff = this.camera.position.clone().sub(fromT)
    const fromDist = fromOff.length()
    const fromDir = fromOff.normalize()
    const toOff = pos.clone().sub(target)
    const toDist = toOff.length()
    const toDir = toOff.normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir)
    const qk = new THREE.Quaternion()
    const id = new THREE.Quaternion()
    const t = new THREE.Vector3()
    return this.tweens.run(
      duration,
      (k) => {
        qk.copy(id).slerp(q, k)
        t.lerpVectors(fromT, target, k)
        const d = fromDist + (toDist - fromDist) * k
        this.camera.position.copy(fromDir).applyQuaternion(qk).multiplyScalar(d).add(t)
        this.controls.target.copy(t)
        this.camera.lookAt(t)
        this.invalidate()
      },
      { tag: "camera", ease: ease.inOut },
    )
  }

  /** Frame an object or box: distance so its bounding sphere fills the view with some padding. */
  fit(what: THREE.Object3D | THREE.Box3, opts: { view?: ViewName; padding?: number; animate?: boolean; dir?: THREE.Vector3 } = {}) {
    const box = what instanceof THREE.Box3 ? what : new THREE.Box3().setFromObject(what)
    if (box.isEmpty()) return Promise.resolve()
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect)
    const dist = (sphere.radius * (opts.padding ?? 1.2)) / Math.sin(Math.min(vfov, hfov) / 2)
    const dir = opts.dir?.clone().normalize() ?? (opts.view ? VIEW_DIRS[opts.view] : this.camera.position.clone().sub(this.controls.target).normalize())
    const pos = dir.clone().multiplyScalar(dist).add(sphere.center)
    return this.flyTo(pos, sphere.center.clone(), opts.animate === false ? 0 : 800)
  }

  // ---------------------------------------------------------------- picking

  private ndc(ev: { clientX: number; clientY: number }) {
    const r = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
  }

  /** The nearest visible hit; `accept` can skip hits (a section plane's cut-away side, back faces). */
  pick(ev: { clientX: number; clientY: number }, objects: THREE.Object3D[], recursive = true, accept?: (h: THREE.Intersection, ray: THREE.Ray) => boolean) {
    this.raycaster.setFromCamera(this.ndc(ev), this.camera)
    return this.raycaster.intersectObjects(objects, recursive).find((h) => h.object.visible && (!accept || accept(h, this.raycaster.ray))) ?? null
  }

  /** Where the pointer ray meets a plane (sketch dragging, extrude handles). */
  rayOnPlane(ev: { clientX: number; clientY: number }, plane: THREE.Plane) {
    this.raycaster.setFromCamera(this.ndc(ev), this.camera)
    return this.raycaster.ray.intersectPlane(plane, new THREE.Vector3())
  }

  ray(ev: { clientX: number; clientY: number }) {
    this.raycaster.setFromCamera(this.ndc(ev), this.camera)
    return this.raycaster.ray.clone()
  }

  /** World point → CSS pixels inside the container. */
  project(p: THREE.Vector3) {
    const v = p.clone().project(this.camera)
    return { x: ((v.x + 1) / 2) * this.size.w, y: ((1 - v.y) / 2) * this.size.h, behind: v.z > 1 }
  }

  // ---------------------------------------------------------------- lifecycle

  /** Replace everything in `content` (disposing what was there). */
  setContent(...objects: THREE.Object3D[]) {
    for (const c of [...this.content.children]) {
      this.content.remove(c)
      disposeObject(c)
    }
    if (objects.length) this.content.add(...objects)
    this.invalidate()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.io.disconnect()
    this.stopTheme()
    this.tweens.clear()
    this.controls.dispose()
    disposeObject(this.content)
    disposeObject(this.helpers)
    this.kit.dispose()
    this.envRT.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    this.labels.domElement.remove()
  }
}

/**
 * Dispose geometries and drop HTML labels under `root`. Materials belong to the
 * kit and are shared, so they are left alone. CSS2D label elements are removed
 * explicitly: three only removes them when the label itself is detached.
 */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
    if (g && !g.userData.shared) g.dispose()
    if (o instanceof CSS2DObject) o.element.remove()
  })
}
