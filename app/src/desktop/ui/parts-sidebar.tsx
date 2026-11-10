import { useState, type ReactNode } from "react"
import { Boxes, CircleAlert, FolderOpen, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Hint } from "@/components/hint"
import { IconButton } from "@/components/ui/button"
import { notify } from "@/components/ui/toast"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { matchesPart } from "@/studio/part-selection"
import { isSet, lookText, type Look, type LookChange, type PartAppearance } from "@/studio/appearance"
import { LookPicker } from "@/studio/ui/look-picker"
import { turnery } from "../bridge"
import type { PartSummary, ProjectFile, Snapshot } from "../core/protocol"

/**
 * The project (a folder: its assemblies and parts) or, without one, the open
 * parts. Clicking a file opens it (and makes it the agent's default).
 */
/** A part of the open assembly: `own` when it comes from a part file of its own (its colour can go there). */
type Instance = { name: string; id: string; file: string; index: number; look?: Look; own?: boolean }
export function PartsSidebar({ snapshot, instances = [], selected = [], onSelect, onPoint, onLook }: {
  snapshot: Snapshot | null
  instances?: Instance[]
  selected?: string[]
  onSelect?: (part: Instance, additive: boolean) => void
  onPoint?: (part: Instance | null) => void
  /** Colour these parts; `here`: only in this assembly, not in their part files. */
  onLook?: (names: string[], change: LookChange, here: boolean) => void
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
          label="项目怎么用"
          tips={[
            "项目就是一个文件夹：里面的装配和零件都列在这里。",
            "多个零件的东西：文件 → 新建项目，再在装配里加零件。",
            "点一个文件就打开它，agent 之后的命令也作用在它上面。",
          ]}
        />
        <div className="ml-auto flex">
          <IconButton label="新建零件（⌘N）" size="icon-sm" onClick={() => void turnery.newPart()}>
            <Plus />
          </IconButton>
          <IconButton label="打开（⌘O）" size="icon-sm" onClick={() => void turnery.openPart()}>
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
          <p className="px-3 pb-1 text-caption text-faint-foreground">Shift 点击可多选；点圆点改颜色，选中几个就一起改</p>
          <ul aria-label="装配零件搜索结果" className="min-h-0 overflow-y-auto px-1.5">
            {found.map((p) => <li key={p.name} className={rowClass(selected.includes(p.name))}
              onMouseEnter={() => onPoint?.(p)} onMouseLeave={() => onPoint?.(null)}>
              {onLook && <InstanceLook part={p} group={selected.includes(p.name) && selected.length > 1 ? instances.filter((x) => selected.includes(x.name)) : [p]} onLook={onLook} />}
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

/**
 * The colour dot of an assembly's part: the legend of the view, and the way to change it. With several
 * parts selected and this one among them, it changes all of them.
 */
function InstanceLook({ part, group, onLook }: { part: Instance; group: Instance[]; onLook: (names: string[], change: LookChange, here: boolean) => void }) {
  const [here, setHere] = useState(false)
  const own = group.some((p) => p.own)
  const id = `look-here-${part.index}`
  return (
    <LookPicker
      look={part.look}
      label={group.length > 1 ? `${group.length} 个零件的颜色` : `「${part.name}」的颜色`}
      className="ml-1.5"
      onChange={(change) => onLook(group.map((p) => p.name), change, here)}
      extra={
        own ? (
          <div className="space-y-1">
            <label htmlFor={id} className="flex items-center gap-2 text-small">
              <Checkbox id={id} checked={here} onCheckedChange={(v) => setHere(v === true)} />
              只改这个装配里的
            </label>
            <p className="pl-6 text-caption text-faint-foreground">{here ? "写在装配上，零件文件不变" : "写进零件文件，用到它的地方都跟着变"}</p>
          </div>
        ) : (
          <p className="text-caption text-faint-foreground">标准件、外购件和子装配没有自己的零件文件，颜色写在这个装配里。</p>
        )
      }
    />
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

/**
 * A part file's colour dot: the whole part's look, changed right in the file (open or not). Split parts
 * with looks of their own keep them; the dot then shows the first of those when the whole has none.
 */
function FileLook({ path, name, look }: { path: string; name: string; look?: PartAppearance }) {
  const whole: Look = { ...(look?.color ? { color: look.color } : {}), ...(look?.finish ? { finish: look.finish } : {}), source: "part" }
  const own = Object.entries(look?.parts ?? {}).filter(([, l]) => isSet(l))
  const label = own.length ? `「${name}」整体的颜色（${own.map(([n, l]) => `${n} ${lookText(l)}`).join("、")} 另有自己的）` : `「${name}」的颜色`
  return (
    <LookPicker
      look={whole}
      dot={isSet(whole) || !own.length ? whole : { ...own[0][1], source: "part" }}
      label={label}
      className="ml-1.5"
      onChange={async (change) => {
        const r = await turnery.call("set_appearance", change, path)
        if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
      }}
    />
  )
}

/** A file of the project: open or not. */
function FileRow({ file: f, active }: { file: ProjectFile; active: boolean }) {
  const unit = f.kind === "assembly" ? "个零件" : "个特征"
  return (
    <div className={rowClass(active)}>
      {f.kind === "part" && f.features !== null && <FileLook path={f.path} name={f.name} look={f.look} />}
      <button type="button" className={cn(buttonClass, f.kind === "part" && f.features !== null && "pl-1")} title={f.path} aria-current={active ? "page" : undefined} onClick={() => void turnery.call("open_part", { path: f.path })}>
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
  const colourable = p.kind !== "assembly" && !p.error
  return (
    <div className={rowClass(active)}>
      {colourable && <FileLook path={p.path} name={p.name} look={p.look} />}
      <button type="button" className={cn(buttonClass, colourable && "pl-1")} title={p.path} aria-current={active ? "page" : undefined} onClick={() => void turnery.call("open_part", { path: p.path })}>
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
      onClick={() => void turnery.call("close_part", { path })}
    >
      <X />
    </IconButton>
  )
}
