/** Site-wide settings. */
export const REPO_URL: string = "https://github.com/linjiejim/arbor"

/** Public origin, for absolute URLs in link previews and the sitemap (no trailing slash). */
export const SITE_URL = "https://arbor.linjiejim.com"

/** Link to a file in the repository, or null when REPO_URL is empty (e.g. a private fork). */
export const sourceUrl = (path: string) => (REPO_URL ? `${REPO_URL.replace(/\/$/, "")}/blob/main/${path}` : null)
