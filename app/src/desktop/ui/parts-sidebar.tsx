import { useState, type ReactNode } from "react"
import { Boxes, CircleAlert, FolderOpen, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Hint } from "@/components/hint"
import { IconButton } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { matchesPart } from "@/studio/part-selection"
import { arbor } from "../bridge"
import type { PartSummary, ProjectFile, Snapshot } from "../core/protocol"

/**
 * The project (a folder: its assemblies and parts) or, without one, the open
 * parts. Clicking a file opens it (and makes it the agent's default).
 */
type Instance = { name: string; id: string; file: string; index: number }
export function PartsSidebar({ snapshot, instances = [], selected = [], onSelect, onPoint }: {
  snapshot: Snapshot | null
  instances?: Instance[]
  selected?: string[]
  onSelect?: (part: Instance, additive: boolean) => void
  onPoint?: (part: Instance | null) => void
}) {
  const [query, setQuery] = useState("")
  const project = snapshot?.project ?? null
  const parts = snapshot?.parts ?? []
  const active = snapshot?.active ?? null
  const inProject = new Set(project?.files.map((f) => f.path))
  const others = parts.filter((p) => !inProject.has(p.path) && matchesPart(query, p.name, p.path))
  const assemblies = project?.files.filter((f) => f.kind === "assembly" && matchesPart(query, f.name, f.path)) ?? []
  const files = project?.files.filter((f) => f.kind === "part" && matchesPart(query, f.name, f.path)) ?? []
  const found = instances.filter((p) => matchesPart(query, p.name, p.id, p.file))
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sunken max-lg:hidden" aria-label={project ? `项目 ${project.name}` : "零件"}>
      <div className="flex h-10 shrink-0 items-center gap-1 pr-1.5 pl-3">
        <span className="truncate text-small font-medium text-muted-foreground" title={project?.root}>
          {project ? project.name : "零件"}
        </span>
        <Hint
          step={1}
          label="项目怎么用"
          tips={[
            "项目就是一个文件夹：里面的装配和零件都列在这里。",
            "多个零件的东西：文件 → 新建项目，再在装配里加零件。",
            "点一个文件就打开它，agent 之后的命令也作用在它上面。",
          ]}
        />
        <div className="ml-auto flex">
          <IconButton label="新建零件（⌘N）" size="icon-sm" onClick={() => void arbor.newPart()}>
            <Plus />
          </IconButton>
          <IconButton label="打开（⌘O）" size="icon-sm" onClick={() => void arbor.openPart()}>
            <FolderOpen />
          </IconButton>
        </div>
      </div>
      <div className="relative mx-2 mb-2">
        <Input type="search" aria-label="搜索零件" placeholder="搜索名称、文件或步骤" value={query} className="pr-8 [&::-webkit-search-cancel-button]:hidden"
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setQuery("") } }} />
        {query && <IconButton label="清空搜索" size="icon-sm" className="absolute top-1 right-1" onClick={() => setQuery("")}><X /></IconButton>}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {query.trim() && !assemblies.length && !files.length && !others.length && <p className="px-2 py-2 text-small text-faint-foreground">没有匹配的项目文件</p>}
        {!project && parts.length === 0 && <p className="px-1.5 py-2 text-small text-faint-foreground">还没有打开的零件</p>}
        {project && project.files.length === 0 && <p className="px-1.5 py-2 text-small text-faint-foreground">这个文件夹里还没有零件</p>}
        {assemblies.length > 0 && (
          <Group title="装配">
            {assemblies.map((f) => (
              <FileRow key={f.path} file={f} active={f.path === active} />
            ))}
          </Group>
        )}
        {files.length > 0 && (
          <Group title={assemblies.length ? "零件" : undefined}>
            {files.map((f) => (
              <FileRow key={f.path} file={f} active={f.path === active} />
            ))}
          </Group>
        )}
        {others.length > 0 && (
          <Group title={project ? "其他" : undefined}>
            {others.map((p) => (
              <OpenRow key={p.path} part={p} active={p.path === active} />
            ))}
          </Group>
        )}
        {project?.truncated && <p className="px-1.5 py-2 text-caption text-faint-foreground">文件太多，只列出了一部分</p>}
      </nav>
      {instances.length > 0 && (
        <section aria-label="装配零件" className="flex max-h-[50%] min-h-0 shrink-0 flex-col border-t pt-2 pb-2">
          <div className="flex items-center justify-between px-3 py-1 text-caption text-muted-foreground">
            <span>装配零件</span><span>{found.length} / {instances.length}</span>
          </div>
          <p className="px-3 pb-1 text-caption text-faint-foreground">Shift 点击可多选</p>
          <ul aria-label="装配零件搜索结果" className="min-h-0 overflow-y-auto px-1.5">
            {found.map((p) => <li key={p.name} className={rowClass(selected.includes(p.name))}
              onMouseEnter={() => onPoint?.(p)} onMouseLeave={() => onPoint?.(null)}>
              <button type="button" aria-label={`选择零件：${p.name}`} aria-pressed={selected.includes(p.name)}
                className={buttonClass} title={[p.name, p.file, p.id].filter(Boolean).join("\n")}
                onFocus={() => onPoint?.(p)} onBlur={() => onPoint?.(null)}
                onClick={(e) => onSelect?.(p, e.shiftKey)}>
                <span className="truncate text-small">{p.name}</span>
              </button>
            </li>)}
          </ul>
          {!found.length && <p className="px-3 py-2 text-small text-faint-foreground" role="status">没有匹配的装配零件</p>}
        </section>
      )}

    </aside>
  )
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="pb-1">
      {title && <div className="px-2.5 pt-2 pb-1 text-caption text-faint-foreground">{title}</div>}
      {children}
    </div>
  )
}

const rowClass = (active: boolean) => cn("group relative flex items-center rounded-md", active ? "bg-selected" : "hover:bg-accent")
const buttonClass = "flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** A file of the project: open or not. */
function FileRow({ file: f, active }: { file: ProjectFile; active: boolean }) {
  const unit = f.kind === "assembly" ? "个零件" : "个特征"
  return (
    <div className={rowClass(active)}>
      <button type="button" className={buttonClass} title={f.path} aria-current={active ? "page" : undefined} onClick={() => void arbor.call("open_part", { path: f.path })}>
        <span className={cn("flex min-w-0 flex-1 items-center gap-1.5 truncate text-body", active && "font-medium", !f.open && !active && "text-muted-foreground")}>
          {f.kind === "assembly" && <Boxes className="size-3.5 shrink-0 text-faint-foreground" />}
          <span className="truncate">{f.name}</span>
        </span>
        <span className={cn("ml-auto shrink-0 text-caption text-faint-foreground", f.open && "group-hover:invisible group-focus-within:invisible")}>
          {f.features === null ? "读不了" : `${f.features} ${unit}`}
          {f.openNotes > 0 && <span className="ml-1 text-warning">{f.openNotes} 条备注</span>}
        </span>
      </button>
      {f.open && <CloseButton path={f.path} />}
    </div>
  )
}

/** An open part outside the project (or any open part, without a project). */
function OpenRow({ part: p, active }: { part: PartSummary; active: boolean }) {
  return (
    <div className={rowClass(active)}>
      <button type="button" className={buttonClass} title={p.path} aria-current={active ? "page" : undefined} onClick={() => void arbor.call("open_part", { path: p.path })}>
        <span className={cn("flex min-w-0 flex-1 items-center gap-1.5 truncate text-body", active && "font-medium")}>
          {p.error && <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-label="文件有错" />}
          {p.kind === "assembly" && <Boxes className="size-3.5 shrink-0 text-faint-foreground" />}
          <span className="truncate">{p.name}</span>
        </span>
        <span className="ml-auto shrink-0 text-caption text-faint-foreground group-hover:invisible group-focus-within:invisible">
          {p.features} 个{p.kind === "assembly" ? "零件" : "特征"}
          {p.openNotes > 0 && <span className="ml-1 text-warning">{p.openNotes} 条备注</span>}
        </span>
      </button>
      <CloseButton path={p.path} />
    </div>
  )
}

function CloseButton({ path }: { path: string }) {
  return (
    <IconButton
      label="关闭（文件不动）"
      size="icon-sm"
      className="absolute right-1 bg-sunken opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      onClick={() => void arbor.call("close_part", { path })}
    >
      <X />
    </IconButton>
  )
}
