// Parts and notes on disk: atomic writes (an editor never sees half a file),
// and a watcher on the part's folder, since editors and git replace files
// rather than writing into them.
import { watch, type FSWatcher } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { Files } from "../../../app/src/desktop/core/engine"

export const nodeFiles: Files = {
  async read(p) {
    try {
      return await readFile(p, "utf8")
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
      throw e
    }
  },
  async write(p, data) {
    await mkdir(path.dirname(p), { recursive: true })
    const tmp = path.join(path.dirname(p), `.${path.basename(p)}.${process.pid}.tmp`)
    await writeFile(tmp, data)
    await rename(tmp, p)
  },
  watch(p, onChange) {
    const dir = path.dirname(p)
    const name = path.basename(p)
    let timer: NodeJS.Timeout | null = null
    let w: FSWatcher | null = null
    try {
      w = watch(dir, { persistent: false }, (_event, file) => {
        if (file && file.toString() !== name) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(onChange, 120)
      })
      w.on("error", () => {})
    } catch {
      /* the folder may not exist yet: nothing to watch */
    }
    return () => {
      if (timer) clearTimeout(timer)
      w?.close()
    }
  },
}
