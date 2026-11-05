/**
 * A tiny tween runner driven by the viewer's frame loop.
 *
 * UI motion follows jim-uiux (120–240ms). Content motion in the viewport —
 * a profile sweeping into a solid, a camera turning to face a plane — is the
 * explanation itself, so it runs longer (≈0.5–1.5s). Under "reduce motion"
 * every tween jumps to its end state.
 */
export type Ease = (t: number) => number

export const ease = {
  linear: (t: number) => t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
}

type Tween = {
  start: number
  duration: number
  update: (k: number) => void
  ease: Ease
  done: () => void
  tag?: string
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export class Tweens {
  private list: Tween[] = []

  /** Resolves when finished or cancelled. Starting a tween with an existing tag cancels the old one. */
  run(duration: number, update: (k: number) => void, opts: { ease?: Ease; tag?: string } = {}): Promise<void> {
    if (opts.tag) this.cancel(opts.tag)
    if (duration <= 0 || prefersReducedMotion()) {
      update(1)
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.list.push({ start: performance.now(), duration, update, ease: opts.ease ?? ease.inOut, done: resolve, tag: opts.tag })
    })
  }

  cancel(tag: string) {
    this.list = this.list.filter((t) => {
      if (t.tag !== tag) return true
      t.done()
      return false
    })
  }

  clear() {
    for (const t of this.list) t.done()
    this.list = []
  }

  get active() {
    return this.list.length > 0
  }

  /** Advance all tweens; returns true when anything moved. */
  tick(now: number): boolean {
    if (!this.list.length) return false
    const keep: Tween[] = []
    for (const t of this.list) {
      const k = Math.min(1, (now - t.start) / t.duration)
      t.update(t.ease(k))
      if (k < 1) keep.push(t)
      else t.done()
    }
    this.list = keep
    return true
  }
}
