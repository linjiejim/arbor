import * as React from "react"

const PANEL_STORE = "ft-studio-panel-w"
export const PANEL_DEFAULT = 420
export const PANEL_MIN = 320
/** Leave the 3D view at least 360 px. */
const panelMax = () => Math.max(PANEL_MIN, Math.min(960, window.innerWidth - 360))
const clampPanel = (w: number) => Math.round(Math.min(panelMax(), Math.max(PANEL_MIN, w)))

/** Width of the studio's side panel, remembered across visits (the workbench and shared links share it). */
export function usePanelWidth() {
  const [width, setWidth] = React.useState(() => {
    const saved = Number(localStorage.getItem(PANEL_STORE))
    return saved ? clampPanel(saved) : PANEL_DEFAULT
  })
  const resize = React.useCallback((w: number, save = false) => {
    const next = clampPanel(w)
    setWidth(next)
    if (save) localStorage.setItem(PANEL_STORE, String(next))
  }, [])
  return { width, resize }
}
