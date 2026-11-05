import type { LessonController } from "./types"
import type { Viewer } from "@/three/viewer"
import { disposeObject } from "@/three/viewer"
import * as THREE from "three"

/**
 * Base for lesson controllers: state + emit, a root group in the viewer's
 * content, and cleanup of everything registered with `own()`.
 */
export abstract class LessonScene<S extends object> implements LessonController<S> {
  state: S
  protected v: Viewer
  protected root = new THREE.Group()
  private emitFn: (s: S) => void
  private cleanups: (() => void)[] = []

  constructor(v: Viewer, emit: (s: S) => void, initial: S) {
    this.v = v
    this.emitFn = emit
    this.state = initial
    v.content.add(this.root)
    this.own(v.onTheme(() => this.render()))
  }

  protected set(patch: Partial<S>) {
    this.state = { ...this.state, ...patch }
    this.emitFn(this.state)
    this.render()
  }

  /** Register a cleanup (event listeners, frame hooks…). */
  protected own(fn: () => void) {
    this.cleanups.push(fn)
  }

  /** Remove and dispose every child of a group. */
  protected clear(g: THREE.Object3D) {
    for (const c of [...g.children]) {
      g.remove(c)
      disposeObject(c)
    }
  }

  abstract enter(step: number): void
  protected abstract render(): void

  dispose() {
    for (const c of this.cleanups) c()
    this.v.content.remove(this.root)
    disposeObject(this.root)
  }
}
