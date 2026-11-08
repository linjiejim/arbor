// Parts and notes on disk: atomic writes (an editor never sees half a file),
// and a watcher on the part's folder, since editors and git replace files
// rather than writing into them.
import { realpathSync, watch, type FSWatcher } from "node:fs"
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises"
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
  async readBytes(p) {
    try {
      const b = await readFile(p)
      return new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
      throw e
    }
  },
  async stat(p) {
    try {
      const s = await stat(p)
      return s.isFile() ? { size: s.size, mtimeMs: s.mtimeMs } : null
    } catch {
      return null
    }
  },
  async list(dir) {
    try {
      return (await readdir(dir, { withFileTypes: true })).map((d) => ({ name: d.name, dir: d.isDirectory() }))
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === "ENOENT" || code === "ENOTDIR") return null
      if (code === "EACCES" || code === "EPERM") return []
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
  canonical(p) {
    // Symlinks resolved in the deepest folder that exists (the file itself may not exist yet).
    let dir = path.dirname(p)
    const rest = [path.basename(p)]
    for (;;) {
      try {
        // native: the OS resolves `..` after a symlink physically; the JS version folds it by name first.
        return path.join(realpathSync.native(dir), ...rest)
      } catch {
        const up = path.dirname(dir)
        if (up === dir) return p
        rest.unshift(path.basename(dir))
        dir = up
      }
    }
  },
}
