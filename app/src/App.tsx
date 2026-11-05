import type * as React from "react"
import { createBrowserRouter, Outlet, redirect, RouterProvider, ScrollRestoration } from "react-router"
import { SiteHeader } from "@/components/site-header"
import { HomePage } from "@/routes/home"
import { syncDocumentTitle } from "@/lib/document-title"

/** Pages other than home load on demand: each brings only its own code. */
const lazy =
  <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] })

function SiteLayout() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <Outlet />
      <ScrollRestoration />
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/learn", lazy: lazy(() => import("@/routes/learn"), "LearnPage") },
      { path: "/teardown", lazy: lazy(() => import("@/routes/teardown"), "TeardownIndex") },
      { path: "/atlas", lazy: lazy(() => import("@/routes/atlas"), "AtlasPage") },
      { path: "/glossary", lazy: lazy(() => import("@/routes/glossary"), "GlossaryPage") },
      { path: "/card/:code", lazy: lazy(() => import("@/routes/card"), "CardPage") },
      // 「练习」was taken down on 2026-11-06; old links land on the learning path.
      { path: "/practice", loader: () => redirect("/learn") },
      { path: "*", lazy: lazy(() => import("@/routes/not-found"), "NotFoundPage") },
    ],
  },
  // Immersive pages: their own header, the viewport takes the screen.
  { path: "/lesson/:id", lazy: lazy(() => import("@/routes/lesson"), "LessonPage") },
  { path: "/teardown/:id", lazy: lazy(() => import("@/routes/teardown"), "TeardownPage") },
  { path: "/studio", lazy: lazy(() => import("@/routes/studio"), "StudioPage") },
])

// Per-route <title>, matching the prerendered HTML (lib/page-meta.ts).
syncDocumentTitle(router.state.location.pathname)
router.subscribe((s) => syncDocumentTitle(s.location.pathname))

export function App() {
  return <RouterProvider router={router} />
}
