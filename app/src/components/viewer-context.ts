import * as React from "react"
import type { Viewer } from "@/three/viewer"

/** The Viewer of the nearest Viewport, for overlays rendered inside it. */
export const ViewerCtx = React.createContext<Viewer | null>(null)
export const useViewer = () => React.useContext(ViewerCtx)
