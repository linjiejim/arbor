/** Site-wide settings. */
export const REPO_URL: string = "https://github.com/linjiejim/featuretree"

/** Link to a file in the repository, or null when REPO_URL is empty (e.g. a private fork). */
export const sourceUrl = (path: string) => (REPO_URL ? `${REPO_URL.replace(/\/$/, "")}/blob/main/${path}` : null)
