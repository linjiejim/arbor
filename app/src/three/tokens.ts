import * as THREE from "three"

/**
 * The 3D scene palette lives in CSS (src/styles/featuretree-theme.css). The viewport
 * resolves the custom properties at runtime so light/dark mode and the accent
 * knob switch the scene together with the UI. No colour is hard-coded here.
 */
const NAMES = {
  bg: "--scene-bg",
  grid: "--scene-grid",
  gridStrong: "--scene-grid-strong",
  model: "--scene-model",
  modelDark: "--scene-model-dark",
  metal: "--scene-metal",
  edge: "--scene-edge",
  edgeSoft: "--scene-edge-soft",
  ghost: "--scene-ghost",
  plane: "--scene-plane",
  highlight: "--scene-highlight",
  modified: "--scene-modified",
  sketch: "--scene-sketch",
  defined: "--scene-defined",
  cut: "--scene-cut",
  good: "--scene-good",
  warn: "--scene-warn",
  bad: "--scene-bad",
  axisX: "--axis-x",
  axisY: "--axis-y",
  axisZ: "--axis-z",
} as const

export type SceneTokens = { [K in keyof typeof NAMES]: THREE.Color } & { dark: boolean }

let probe: HTMLSpanElement | null = null
let ctx: CanvasRenderingContext2D | null = null

/** Any CSS colour (rgb(), oklab(), color-mix() results…) → THREE.Color in linear space. */
function resolve(varName: string): THREE.Color {
  if (!probe) {
    probe = document.createElement("span")
    probe.style.display = "none"
    document.body.appendChild(probe)
  }
  probe.style.color = `var(${varName})`
  const css = getComputedStyle(probe).color
  ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "black"
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
}

export function readSceneTokens(): SceneTokens {
  const out = { dark: document.documentElement.classList.contains("dark") } as SceneTokens
  for (const [key, name] of Object.entries(NAMES)) (out as Record<string, unknown>)[key] = resolve(name)
  return out
}

/** Fires when <html> switches between light and dark (class change). */
export function onThemeChange(cb: () => void): () => void {
  const mo = new MutationObserver(() => cb())
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })
  return () => mo.disconnect()
}
