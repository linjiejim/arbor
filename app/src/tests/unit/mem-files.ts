// An in-memory file system for the Turnery engine tests.
import type { Files } from "@/desktop/core/engine"

/** An in-memory disk; `touch` plays someone else saving the file. */
export function memFiles() {
  const disk = new Map<string, string | Uint8Array>()
  const watchers = new Map<string, () => void>()
  /** Bumped on every write: the modification time of this disk. */
  const written = new Map<string, number>()
  let clock = 0
  // Like the real file system, `a/../b` reaches `b` when reading and writing.
  const norm = (p: string) => {
    const out: string[] = []
    for (const seg of p.split("/")) {
      if (seg === "..") out.pop()
      else out.push(seg)
    }
    return out.join("/")
  }
  const files: Files = {
    read: async (raw) => {
      const p = norm(raw)
      const v = disk.get(p)
      return v === undefined ? null : typeof v === "string" ? v : new TextDecoder().decode(v)
    },
    readBytes: async (raw) => {
      const p = norm(raw)
      const v = disk.get(p)
      return v === undefined ? null : typeof v === "string" ? new TextEncoder().encode(v) : v
    },
    stat: async (raw) => {
      const p = norm(raw)
      const v = disk.get(p)
      return v === undefined ? null : { size: typeof v === "string" ? v.length : v.byteLength, mtimeMs: written.get(p) ?? 0 }
    },
    list: async (raw) => {
      const dir = norm(raw).replace(/\/+$/, "")
      const out = new Map<string, boolean>()
      for (const k of disk.keys()) {
        if (!k.startsWith(`${dir}/`)) continue
        const rest = k.slice(dir.length + 1).split("/")
        out.set(rest[0], rest.length > 1 || out.get(rest[0]) === true)
      }
      return out.size ? [...out].map(([name, dir]) => ({ name, dir })) : null
    },
    write: async (raw, d) => {
      const p = norm(raw)
      disk.set(p, d)
      written.set(p, ++clock)
    },
    rename: async (rawFrom, rawTo) => {
      const from = norm(rawFrom)
      const to = norm(rawTo)
      if (disk.has(to)) throw new Error(`${to} 已经存在`)
      // A file, or a folder with everything in it.
      for (const k of [...disk.keys()]) {
        if (k !== from && !k.startsWith(`${from}/`)) continue
        const dest = to + k.slice(from.length)
        disk.set(dest, disk.get(k)!)
        written.set(dest, ++clock)
        disk.delete(k)
        watchers.get(k)?.()
      }
    },
    watch: (raw, cb) => {
      const p = norm(raw)
      watchers.set(p, cb)
      return () => watchers.delete(p)
    },
    // Paths are told apart by case here, as on a disk that doesn't ignore it.
    same: async (a, b) => norm(a) === norm(b),
    // No symlinks in memory: `..` resolves by name, as the real file system would here.
    canonical: (p) => {
      const out: string[] = []
      for (const seg of p.split("/")) {
        if (seg === "..") out.pop()
        else out.push(seg)
      }
      return out.join("/")
    },
  }
  const touch = async (p: string, data: string | Uint8Array) => {
    disk.set(p, data)
    written.set(p, ++clock)
    watchers.get(p)?.()
  }
  return { disk, files, touch }
}

