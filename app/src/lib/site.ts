/** Site-wide settings. Fill REPO_URL once the repository is public. */
export const REPO_URL: string = ""

/** Link to a file in the repository, or null while the repo is private. */
export const sourceUrl = (path: string) => (REPO_URL ? `${REPO_URL.replace(/\/$/, "")}/blob/main/${path}` : null)
