import type { ReactNode } from "react"
import { Boxes, CircleAlert, FolderOpen, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Hint } from "@/components/hint"
import { IconButton } from "@/components/ui/button"
import { arbor } from "../bridge"
import type { PartSummary, ProjectFile, Snapshot } from "../core/protocol"

/**
 * The project (a folder: its assemblies and parts) or, without one, the open
 * parts. Clicking a file opens it (and makes it the agent's default).
 */
export function PartsSidebar({ snapshot }: { snapshot: Snapshot | null }) {
  const project = snapshot?.project ?? null
  const parts = snapshot?.parts ?? []
  const active = snapshot?.active ?? null
  const inProject = new Set(project?.files.map((f) => f.path))
  const others = parts.filter((p) => !inProject.has(p.path))
  const assemblies = project?.files.filter((f) => f.kind === "assembly") ?? []
  const files = project?.files.filter((f) => f.kind === "part") ?? []
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
      <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
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
const buttonClass = "flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** A file of the project: open or not. */
function FileRow({ file: f, active }: { file: ProjectFile; active: boolean }) {
  const unit = f.kind === "assembly" ? "个零件" : "个特征"
  return (
    <div className={rowClass(active)}>
      <button type="button" className={buttonClass} title={f.path} aria-current={active ? "page" : undefined} onClick={() => void arbor.call("open_part", { path: f.path })}>
        <span className={cn("flex w-full items-center gap-1.5 truncate text-body", active && "font-medium", !f.open && !active && "text-muted-foreground")}>
          {f.kind === "assembly" && <Boxes className="size-3.5 shrink-0 text-faint-foreground" />}
          <span className="truncate">{f.name}</span>
        </span>
        <span className="flex w-full items-center gap-2 truncate text-caption text-faint-foreground">
          {f.features === null ? "读不了" : `${f.features} ${unit}`}
          {f.folder && <span className="truncate">{f.folder}</span>}
          {f.openNotes > 0 && <span className="text-warning">{f.openNotes} 条备注</span>}
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
        <span className={cn("flex w-full items-center gap-1.5 truncate text-body", active && "font-medium")}>
          {p.error && <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-label="文件有错" />}
          {p.kind === "assembly" && <Boxes className="size-3.5 shrink-0 text-faint-foreground" />}
          <span className="truncate">{p.name}</span>
        </span>
        <span className="flex items-center gap-2 text-caption text-faint-foreground">
          {p.features} 个{p.kind === "assembly" ? "零件" : "特征"}
          {p.openNotes > 0 && <span className="text-warning">{p.openNotes} 条备注</span>}
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
      className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      onClick={() => void arbor.call("close_part", { path })}
    >
      <X />
    </IconButton>
  )
}
