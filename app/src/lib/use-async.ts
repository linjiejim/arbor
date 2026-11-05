import * as React from "react"
import { loadIndex, type ModelIndexEntry } from "@/three/baked"

/** Run a promise-returning function; re-run when deps change or on retry(). */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setState((s) => (s.loading ? s : { loading: true }))
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (e) => alive && setState({ error: e instanceof Error ? e.message : String(e), loading: false }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])
  return { ...state, retry: () => setAttempt((a) => a + 1) }
}

/** The baked teardown models (app/public/models/index.json). */
export function useModelIndex(): ModelIndexEntry[] {
  const { data } = useAsync(loadIndex, [])
  return data ? Object.values(data) : []
}
