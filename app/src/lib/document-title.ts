import { loadIndex } from "@/three/baked"
import { cardPageMeta, documentTitle, lessonPageMeta, STATIC_PAGES, teardownPageMeta } from "@/lib/page-meta"

let shown: string | null = null

/**
 * Keep document.title in step with the route. Same titles as the
 * prerendered HTML (page-meta.ts); teardown titles wait for the model index.
 */
export function syncDocumentTitle(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/"
  if (path === shown) return
  shown = path
  const set = (title: string | null | undefined) => {
    if (shown === path) document.title = documentTitle(title)
  }
  const lesson = path.match(/^\/lesson\/([^/]+)$/)
  const teardown = path.match(/^\/teardown\/([^/]+)$/)
  const card = path.match(/^\/card\/([^/]+)$/)
  if (lesson) set(lessonPageMeta(decodeURIComponent(lesson[1]))?.title)
  else if (card) set(cardPageMeta(decodeURIComponent(card[1]))?.title)
  else if (teardown) {
    // The index is usually cached already; until it arrives, keep the current (often prerendered) title.
    const id = decodeURIComponent(teardown[1])
    const fallback = STATIC_PAGES["/teardown"].title
    loadIndex().then(
      (index) => set(index[id] ? teardownPageMeta(index[id]).title : fallback),
      () => set(fallback),
    )
  } else set(STATIC_PAGES[path]?.title)
}
