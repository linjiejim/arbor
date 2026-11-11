// A project is a folder: the assemblies and parts under it. Nothing to save
// about it besides the files themselves. The engine scans it to fill the
// window's sidebar and `list_parts`, and decides which folder that is from
// what was opened last.
import type { Files } from "./engine"
import { PART_EXT, partExtOf } from "./protocol"
import { ASM_EXT, asmExtOf, PARAMS_EXT } from "./sources"

/** How deep, and how much, a scan looks: a project folder opened on a huge tree stays quick. */
export const SCAN_DEPTH = 3
export const SCAN_MAX_FILES = 300
export const SCAN_MAX_DIRS = 400
/** How far up from a part to look for the folder holding its assembly. */
export const ROOT_SEARCH = 3

export type ProjectEntry = {
  /** Absolute, canonical: the same key as an open part's. */
  path: string
  /** File name without the ending. */
  name: string
  /** Folder relative to the project, "" at the top. */
  folder: string
  kind: "part" | "assembly"
  /** Features (parts) or components (assemblies); null when the file can't be read as a tree. */
  features: number | null
}

export type Scan = { root: string; entries: ProjectEntry[]; truncated: boolean }

/** What a scan remembers per file, so unchanged files aren't read again. */
export type ScanCache = Map<string, { mtime: number; features: number | null }>

export const isPartFile = (name: string) => partExtOf(name) !== null
export const isAssemblyFile = (name: string) => asmExtOf(name) !== null
export const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p
export const dirName = (p: string) => p.replace(/[\\/]+$/, "").replace(/[\\/][^\\/]*$/, "") || "/"
export const stripEnding = (name: string) => name.replace(/\.(turnery|arbor)-asm\.json$|\.(turnery|arbor)\.json$|\.params\.json$/, "")
const join = (dir: string, name: string) => `${dir.replace(/[\\/]+$/, "")}/${name}`
const skip = (name: string) => name.startsWith(".") || name === "node_modules"

/** `path` is `root` or inside it. */
export function inside(root: string, path: string) {
  const r = root.replace(/[\\/]+$/, "")
  return path === r || path.startsWith(`${r}/`)
}

/** `to` written relative to the folder `from` ("parts/a.turnery.json", "../pen.params.json"). */
export function relativePath(from: string, to: string) {
  const a = from.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean)
  const b = to.split(/[\\/]/).filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/") || "."
}

/**
 * A folder that may be a project: not the home folder or above it (scanning
 * those would wander through everything), not the file system's root.
 */
export function canBeRoot(dir: string, home?: string) {
  const d = dir.replace(/[\\/]+$/, "")
  if (!d || d === "/" || /^[A-Za-z]:$/.test(d)) return false
  if (home) {
    const h = home.replace(/[\\/]+$/, "")
    if (d === h || inside(d, h)) return false
  }
  return true
}

/**
 * The project a just-opened file belongs to: the current one when the file is
 * in it; an assembly's own folder; else the nearest folder up (at most
 * ROOT_SEARCH levels) holding an assembly; else the file's folder.
 */
export async function rootFor(files: Files, path: string, current: string | null, home?: string): Promise<string | null> {
  if (current && canBeRoot(current, home) && inside(current, path)) return current
  const dir = dirName(path)
  if (isAssemblyFile(path)) return canBeRoot(dir, home) ? dir : null
  if (files.list) {
    let d = dir
    for (let i = 0; i <= ROOT_SEARCH; i++) {
      if (!canBeRoot(d, home)) break
      const list = await files.list(d)
      if (list?.some((e) => !e.dir && isAssemblyFile(e.name))) return d
      const up = dirName(d)
      if (up === d) break
      d = up
    }
  }
  return canBeRoot(dir, home) ? dir : null
}

/** Every part and assembly under `root`, breadth first: shallow files before deep ones. */
export async function scanProject(files: Files, root: string, cache: ScanCache): Promise<Scan> {
  const entries: ProjectEntry[] = []
  let truncated = false
  if (!files.list) return { root, entries, truncated }
  let level = [root]
  let dirs = 0
  for (let depth = 0; depth <= SCAN_DEPTH && level.length; depth++) {
    const next: string[] = []
    for (const dir of level) {
      if (++dirs > SCAN_MAX_DIRS) {
        truncated = true
        break
      }
      const list = (await files.list(dir)) ?? []
      for (const e of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
        if (skip(e.name)) continue
        const p = join(dir, e.name)
        if (e.dir) {
          if (depth < SCAN_DEPTH) next.push(p)
          continue
        }
        const kind = isAssemblyFile(e.name) ? "assembly" : isPartFile(e.name) ? "part" : null
        if (!kind) continue
        if (entries.length >= SCAN_MAX_FILES) {
          truncated = true
          continue
        }
        const path = files.canonical?.(p) ?? p
        entries.push({ path, name: stripEnding(e.name), folder: relativePath(root, dir) === "." ? "" : relativePath(root, dir), kind, features: await countFeatures(files, path, cache) })
      }
    }
    level = next
  }
  return { root, entries, truncated }
}

async function countFeatures(files: Files, path: string, cache: ScanCache): Promise<number | null> {
  const st = await files.stat?.(path)
  const hit = cache.get(path)
  if (st && hit && hit.mtime === st.mtimeMs) return hit.features
  let features: number | null = null
  try {
    const text = await files.read(path)
    const tree = text === null ? null : (JSON.parse(text) as { features?: unknown })
    features = Array.isArray(tree?.features) ? tree.features.length : null
  } catch {
    features = null
  }
  if (st) cache.set(path, { mtime: st.mtimeMs, features })
  return features
}

/** The skeleton of a new project: an empty assembly that uses an empty parameter file. */
export function projectSkeleton(root: string) {
  const name = baseName(root)
  const params = `${name}${PARAMS_EXT}`
  return {
    assembly: join(root, `${name}${ASM_EXT}`),
    params: join(root, params),
    assemblyText: `${JSON.stringify({ uses: params, params: {}, features: [] }, null, 2)}\n`,
    paramsText: `${JSON.stringify({ params: {} }, null, 2)}\n`,
  }
}

/** A part's file name from what the person typed: no slashes, no ending, nothing the file system dislikes. */
export function partFileName(name: string) {
  const n = name
    .trim()
    .replace(/\.turnery\.json$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/^\.+/, "")
  return n ? `${n}${PART_EXT}` : null
}
