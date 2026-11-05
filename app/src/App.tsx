import type * as React from "react"
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from "react-router"
import { SiteHeader } from "@/components/site-header"
import { HomePage } from "@/routes/home"

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
      { path: "/practice", lazy: lazy(() => import("@/routes/practice"), "PracticePage") },
      { path: "/card/:code", lazy: lazy(() => import("@/routes/card"), "CardPage") },
    ],
  },
  // Immersive pages: their own header, the viewport takes the screen.
  { path: "/lesson/:id", lazy: lazy(() => import("@/routes/lesson"), "LessonPage") },
  { path: "/teardown/:id", lazy: lazy(() => import("@/routes/teardown"), "TeardownPage") },
])

export function App() {
  return <RouterProvider router={router} />
}
