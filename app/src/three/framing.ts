import * as THREE from "three"

/** Closer than this to the camera is never drawn. */
const MIN_NEAR = 0.5
/** The most the far plane may be a multiple of the near one, so the depth buffer keeps its precision. */
const MAX_DEPTH_RATIO = 10000

/**
 * Near and far clipping planes for a camera `dist` away from the centre of a bounding sphere of
 * `radius`: just outside the sphere on both sides, so they follow the size of the model. A camera
 * inside the sphere gets the smallest near plane the depth precision allows.
 */
export function clipRange(dist: number, radius: number): [near: number, far: number] {
  const far = (dist + radius) * 1.01 + 1
  const near = Math.max(MIN_NEAR, far / MAX_DEPTH_RATIO, (dist - radius) * 0.99)
  return [near, far]
}

/**
 * Point `camera` at `box` from direction `dir`, far enough back that the box's bounding sphere fills
 * the view with `padding` to spare, and put the clipping planes around `drawn`: the bounds of
 * everything that will be rendered (the same box, unless the picture is a close-up of one part of
 * something larger). Returns the distance to the centre of `box`.
 */
export function frameCamera(camera: THREE.PerspectiveCamera, box: THREE.Box3, dir: THREE.Vector3, padding: number, drawn: THREE.Box3 = box) {
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const vfov = THREE.MathUtils.degToRad(camera.fov)
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
  const dist = (sphere.radius * padding) / Math.sin(Math.min(vfov, hfov) / 2)
  camera.position.copy(sphere.center).addScaledVector(dir.clone().normalize(), dist)
  camera.lookAt(sphere.center)
  const all = (drawn.isEmpty() ? box : drawn).getBoundingSphere(new THREE.Sphere())
  if (all.radius > 0) [camera.near, camera.far] = clipRange(camera.position.distanceTo(all.center), all.radius)
  camera.updateProjectionMatrix()
  return dist
}
