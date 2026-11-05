import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { MaterialKit } from "./materials"
import { readSceneTokens } from "./tokens"
import { disposeObject } from "./viewer"

/**
 * One offscreen renderer that draws many small pictures: gallery thumbnails
 * and the atlas cards' hover animations. Browsers cap live WebGL contexts
 * (~16), so a grid of cards must not each own a canvas.
 */
export class Snapshotter {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(26, 1, 0.5, 5000)
  kit: MaterialKit
  private pmrem: THREE.PMREMGenerator
  private env: THREE.WebGLRenderTarget
  private holder = new THREE.Group()

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.env = this.pmrem.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = this.env.texture
    this.scene.environmentIntensity = 0.55
    this.camera.up.set(0, 0, 1)
    const key = new THREE.DirectionalLight(undefined, 1.6)
    key.position.set(-1.2, 2.2, 3)
    const fill = new THREE.DirectionalLight(undefined, 0.45)
    fill.position.set(2, -1, 1.5)
    this.camera.add(key, fill)
    const hemi = new THREE.HemisphereLight(undefined, undefined, 0.55)
    hemi.groundColor.setScalar(0.5)
    this.scene.add(this.camera, hemi, this.holder)
    this.kit = new MaterialKit(readSceneTokens())
  }

  refreshTheme() {
    this.kit.applyTokens(readSceneTokens())
  }

  /**
   * Draw `object` into a 2D canvas context (CSS size w × h). The object is
   * framed by `box` (or its own bounds) from direction `dir`.
   */
  draw(ctx: CanvasRenderingContext2D, object: THREE.Object3D, opts: { w: number; h: number; dir?: THREE.Vector3; box?: THREE.Box3; padding?: number }) {
    const { w, h } = opts
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.holder.add(object)
    const box = opts.box ?? new THREE.Box3().setFromObject(object)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect)
    const dist = (sphere.radius * (opts.padding ?? 1.15)) / Math.sin(Math.min(vfov, hfov) / 2)
    const dir = (opts.dir ?? new THREE.Vector3(1, -1.1, 0.85)).clone().normalize()
    this.camera.position.copy(sphere.center).addScaledVector(dir, dist)
    this.camera.lookAt(sphere.center)
    this.renderer.render(this.scene, this.camera)
    this.holder.remove(object)
    const c = ctx.canvas
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(this.renderer.domElement, 0, 0, c.width, c.height)
  }

  /** Render once to a data URL (static thumbnails). Disposes the object. */
  shot(object: THREE.Object3D, opts: { w: number; h: number; dir?: THREE.Vector3; box?: THREE.Box3; padding?: number }) {
    const dpr = Math.min(window.devicePixelRatio, 2)
    const canvas = document.createElement("canvas")
    canvas.width = opts.w * dpr
    canvas.height = opts.h * dpr
    this.draw(canvas.getContext("2d")!, object, opts)
    disposeObject(object)
    return canvas.toDataURL("image/png")
  }

  dispose() {
    this.kit.dispose()
    this.env.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}

let shared: Snapshotter | null = null
let users = 0

/** Ref-counted shared instance. */
export function acquireSnapshotter() {
  shared ??= new Snapshotter()
  users++
  return shared
}

export function releaseSnapshotter() {
  users--
  if (users <= 0 && shared) {
    shared.dispose()
    shared = null
    users = 0
  }
}
