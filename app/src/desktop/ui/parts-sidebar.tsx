import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { Boxes, ChevronDown, ChevronRight, CircleAlert, Ellipsis, Eye, EyeOff, FolderOpen, PanelLeft, Plus, X } from "lucide-react"
import { TurneryWordmark, WORDMARK_ASPECT } from "@/components/turnery-mark"
import { cn } from "@/lib/utils"
import { Hint } from "@/components/hint"
import { Button, IconButton } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { matchesPart } from "@/studio/part-selection"
import { isSet, lookText, type Appearance, type Look, type LookChange } from "@/studio/appearance"
import { LookPicker } from "@/studio/ui/look-picker"
import { turnery } from "../bridge"
import type { PartSummary, ProjectFile, Snapshot } from "../core/protocol"
import { LEFT, STRUCTURE, type Panels } from "../panels"
import { Resizer } from "./resizer"
import { fileStem } from "./words"

/**
 * A part of the open file: in an assembly, a component (`own` when it comes from a part file of its own,
 * so its colour can go there; `layered` when a file under it has colours this assembly can set over;
 * `here`: what this assembly sets for it; `under`: how it looks without that); in a part split into
 * several, one of them (`body`).
 */
export type Instance = { name: string; id: string; file: string; index: number; look?: Look; own?: boolean; layered?: boolean; here?: Appearance; under?: Look; body?: boolean; /** The part this piece was split from. */ whole?: string }

/** What the 「结构」 section lists and does: the open file's parts. */
export type Structure = {
  kind: "assembly" | "part"
  items: Instance[]
  hidden: ReadonlySet<number>
  /** Shown alone (isolated) right now. */
  isolated: ReadonlySet<number>
  onToggleHidden: (p: Instance) => void
  onIsolate: (p: Instance) => void
  /** Open its own file; a string says why it can't be. */
  canOpen?: (p: Instance) => true | string
  onOpen?: (p: Instance) => void
  onEditInPlace?: (p: Instance) => void
  onNote?: (p: Instance) => void
  onRename?: (p: Instance, name: string) => Promise<boolean>
  /** In the section's title (the assembly's 「+ 零件」). */
  add?: ReactNode
}

const NO_NAMES: string[] = []
const NO_ITEMS: Instance[] = []

/**
 * The left panel: the project's files (a folder: its assemblies and parts) or, without one, the open
 * parts; under them, what the open file is made of. Clicking a file opens it (and makes it the agent's
 * default); double-clicking renames it.
 */
export function PartsSidebar({ snapshot, width, panels, onPanels, onCollapse, structure, selected = NO_NAMES, onSelect, onPoint, onLook, onRenameFile }: {
  snapshot: Snapshot | null
  /** 收起左栏 (⌘B): the button at its top. */
  onCollapse: () => void
  width: number
  panels: Panels
  onPanels: (change: (p: Panels) => Panels) => void
  structure?: Structure | null
  selected?: string[]
  onSelect?: (part: Instance, additive: boolean) => void
  onPoint?: (part: Instance | null) => void
  /** Colour these parts; `here`: only in this assembly, not in their part files. */
  onLook?: (names: string[], change: LookChange, here: boolean) => void
  /** Rename a file on disk (its references follow); false when it wasn't. */
  onRenameFile?: (path: string, name: string) => Promise<boolean>
}) {
  const [query, setQuery] = useState("")
  const box = useRef<HTMLElement>(null)
  const mac = turnery.platform === "darwin"
  const instances = structure?.items ?? NO_ITEMS
  const project = snapshot?.project ?? null
  const parts = snapshot?.parts ?? []
  const active = snapshot?.active ?? null
  const inProject = new Set(project?.files.map((f) => f.path))
  const others = parts.filter((p) => !inProject.has(p.path) && matchesPart(query, p.name, p.path))
  const assemblies = project?.files.filter((f) => f.kind === "assembly" && matchesPart(query, f.name, f.path)) ?? []
  const files = project?.files.filter((f) => f.kind === "part" && matchesPart(query, f.name, f.path)) ?? []
  const found = instances.filter((p) => matchesPart(query, p.name, p.id, p.file))
  // Rows are drawn again only when something of their own changes (not on every hover in the view, or
  // every step of the explode slider): what they do is reached through one object that stays the same.
  const live = useRef({ structure, onSelect, onPoint, onLook })
  useEffect(() => {
    live.current = { structure, onSelect, onPoint, onLook }
  })
  const [actions] = useState<RowActions>(() => ({
    select: (p, additive) => live.current.onSelect?.(p, additive),
    point: (p) => live.current.onPoint?.(p),
    look: (names, change, here) => live.current.onLook?.(names, change, here),
    toggleHidden: (p) => live.current.structure?.onToggleHidden(p),
    isolate: (p) => live.current.structure?.onIsolate(p),
    open: (p) => live.current.structure?.onOpen?.(p),
    editInPlace: (p) => live.current.structure?.onEditInPlace?.(p),
    note: (p) => live.current.structure?.onNote?.(p),
    rename: async (p, name) => (await live.current.structure?.onRename?.(p, name)) ?? false,
  }))
  const picked = useMemo(() => new Set(selected), [selected])
  // Several selected: a colour dot among them changes them all.
  const together = useMemo(() => (picked.size > 1 ? instances.filter((x) => picked.has(x.name)) : null), [picked, instances])
  const filesFolded = panels.filesFolded
  const structureFolded = panels.structureFolded
  const both = instances.length > 0 && !filesFolded && !structureFolded
  return (
    <aside ref={box} className="relative flex shrink-0 flex-col border-r bg-sunken" style={{ width }} aria-label={project ? `项目 ${project.name}` : "零件"}>
      <Resizer edge="right" label="拖动调整左栏宽度" value={width} min={LEFT.min} max={LEFT.max} initial={LEFT.initial} onChange={(w) => onPanels((p) => ({ ...p, left: { ...p.left, w } }))} />
      {/* The top of the window: on a Mac the traffic lights sit here, and the row drags the window. */}
      <div className={cn("flex h-12 shrink-0 items-center gap-1 pr-1.5 select-none [-webkit-app-region:drag]", mac ? "pl-22" : "pl-2.5")}>
        <button
          type="button"
          title="回到首页（⇧⌘H）"
          aria-label="回到首页（⇧⌘H）"
          className="flex min-w-0 items-center rounded-md px-1.5 py-1 text-foreground outline-none [-webkit-app-region:no-drag] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void turnery.call("close_project", {})}
        >
          {/* Just the name, no mark (its "t" would stand beside the name's own). Smaller when the panel is narrow. */}
          <TurneryWordmark className="w-auto shrink-0" style={{ height: wordmarkHeight(width - (mac ? 88 : 10) - 50) }} />
        </button>
        <IconButton label="收起左栏（⌘B）" size="icon-sm" className="ml-auto text-muted-foreground [-webkit-app-region:no-drag]" onClick={onCollapse}>
          <PanelLeft />
        </IconButton>
      </div>
      <div className="mx-2 mb-2 flex items-center gap-0.5">
        <div className="relative min-w-0 flex-1">
          <Input type="search" aria-label="搜索零件" placeholder="搜索零件、文件、步骤" value={query} className="pr-8 [&::-webkit-search-cancel-button]:hidden"
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setQuery("") } }} />
          {query && <IconButton label="清空搜索" size="icon-sm" className="absolute top-1 right-1" onClick={() => setQuery("")}><X /></IconButton>}
        </div>
        <IconButton label="新建零件（⌘N）" size="icon-sm" className="text-muted-foreground" onClick={() => void turnery.newPart()}>
          <Plus />
        </IconButton>
        <IconButton label="打开（⌘O）" size="icon-sm" className="text-muted-foreground" onClick={() => void turnery.openPart()}>
          <FolderOpen />
        </IconButton>
      </div>
      <SectionTitle
        title="文件"
        folded={filesFolded}
        onFold={() => onPanels((p) => ({ ...p, filesFolded: !p.filesFolded }))}
        hint={["项目就是一个文件夹：里面的装配和零件都列在这里。", "多个零件的东西：文件 → 新建项目，再在装配里加零件。", "点一个文件就打开它，agent 之后的命令也作用在它上面；双击改名。"]}
      />
      <nav aria-label="文件" className={cn("min-h-0 overflow-y-auto px-1.5 pb-2", filesFolded ? "hidden" : "flex-1")}>
        {query.trim() && !assemblies.length && !files.length && !others.length && <p className="px-2 py-2 text-small text-faint-foreground">没有匹配的项目文件</p>}
        {!project && parts.length === 0 && <p className="px-1.5 py-2 text-small text-faint-foreground">还没有打开的零件</p>}
        {project && project.files.length === 0 && <p className="px-1.5 py-2 text-small text-faint-foreground">这个文件夹里还没有零件</p>}
        {assemblies.length > 0 && (
          <Group title="装配">
            {assemblies.map((f) => (
              <FileRow key={f.path} file={f} active={f.path === active} onRename={onRenameFile} />
            ))}
          </Group>
        )}
        {files.length > 0 && (
          <Group title={assemblies.length ? "零件" : undefined}>
            {files.map((f) => (
              <FileRow key={f.path} file={f} active={f.path === active} onRename={onRenameFile} />
            ))}
          </Group>
        )}
        {others.length > 0 && (
          <Group title={project ? "其他" : undefined}>
            {others.map((p) => (
              <OpenRow key={p.path} part={p} active={p.path === active} onRename={onRenameFile} />
            ))}
          </Group>
        )}
        {project?.truncated && <p className="px-1.5 py-2 text-caption text-faint-foreground">文件太多，只列出了一部分</p>}
      </nav>
      {/* An empty assembly keeps its section: its ＋ is how the first part goes in. */}
      {structure && (instances.length > 0 || structure.kind === "assembly") && (
        <section
          aria-label={structure.kind === "assembly" ? "装配零件" : "零件里的各部分"}
          className={cn("relative flex min-h-0 flex-col border-t", structureFolded ? "shrink-0" : filesFolded ? "flex-1" : "shrink-0")}
          style={both ? { height: panels.structureH, maxHeight: "calc(100% - 8rem)" } : undefined}
        >
          {both && (
            <Resizer
              edge="top"
              label="拖动调整文件和结构的高度"
              value={panels.structureH}
              min={STRUCTURE.min}
              max={() => Math.max(STRUCTURE.min, (box.current?.clientHeight ?? 600) - 128)}
              initial={STRUCTURE.initial}
              onChange={(structureH) => onPanels((p) => ({ ...p, structureH }))}
            />
          )}
          <SectionTitle
            title="结构"
            count={query.trim() ? `${found.length} / ${instances.length}` : `${instances.length}`}
            folded={structureFolded}
            onFold={() => onPanels((p) => ({ ...p, structureFolded: !p.structureFolded }))}
            hint={
              structure.kind === "assembly"
                ? ["点一行选中它，Shift 点击多选；拆成几块的零件每块一行，在 3D 视图里点一下选中整个零件。", "鼠标停在一行上，右边弹出它的文件、步骤和颜色。", "点圆点改颜色，选中的一起改；带外圈的只在这个装配里改过。", "双击改名；⋯ 里可以单独打开零件、在装配里改、隔离。"]
                : ["这个零件拆成了几个部分：点圆点改颜色，眼睛隐藏或显示。"]
            }
            action={structure.add}
          />
          {!structureFolded && (
            <>
              <ul aria-label={structure.kind === "assembly" ? "装配零件搜索结果" : "零件里的各部分"} className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
                {found.map((p) => (
                  <StructureRow
                    key={p.name}
                    part={p}
                    kind={structure.kind}
                    selected={picked.has(p.name)}
                    hidden={structure.hidden.has(p.index)}
                    isolated={structure.isolated.has(p.index)}
                    together={picked.has(p.name) ? together : null}
                    open={structure.canOpen?.(p) ?? "没有零件文件"}
                    looks={Boolean(onLook)}
                    renames={Boolean(structure.onRename) && !p.body}
                    edits={Boolean(structure.onEditInPlace)}
                    notes={Boolean(structure.onNote)}
                    opens={Boolean(structure.onOpen)}
                    actions={actions}
                  />
                ))}
              </ul>
              {!found.length && (
                <p className="px-3 py-2 text-small text-faint-foreground" role="status">
                  {instances.length ? "没有匹配的零件" : "还没有零件：点上面的 ＋ 加一个"}
                </p>
              )}
            </>
          )}
        </section>
      )}

    </aside>
  )
}

/**
 * The colour dot of an assembly's part: the legend of the view, and the way to change it. With several
 * parts selected and this one among them, it changes all of them. A part set in this assembly (over its
 * part file) has a ring round its dot; its panel says so, keeps changing it here, and can drop it.
 */
function InstanceLook({ part, group, onLook }: { part: Instance; group: Instance[]; onLook: (names: string[], change: LookChange, here: boolean) => void }) {
  // Set here over a part file: only those decide where a change goes (the rest are always set here).
  const set = group.filter((p) => p.own && isSet(p.here))
  const [here, setHere] = useState(set.length > 0)
  const own = group.some((p) => p.own)
  const id = `look-here-${part.index}`
  const single = group.length === 1
  return (
    <LookPicker
      look={part.look}
      label={single ? `「${part.name}」的颜色` : `${group.length} 个零件的颜色`}
      className="ml-1.5"
      mark={part.layered && isSet(part.here)}
      note={part.layered && isSet(part.here) ? "只在这个装配里" : undefined}
      // Already set in this assembly: keep changing it here, or the part file's change wouldn't show.
      onOpen={() => setHere(set.length > 0)}
      onChange={(change) => onLook(group.map((p) => p.name), change, here)}
      extra={
        own ? (
          <div className="space-y-1.5">
            {set.length > 0 && (
              <div className="space-y-1 rounded-md bg-muted px-2 py-1.5">
                <p className="text-caption text-muted-foreground">
                  {single ? `只在这个装配里设的；零件文件里${fileText(part.under)}` : `其中 ${set.length} 个只在这个装配里设了颜色`}
                </p>
                <Button size="sm" variant="link" onClick={() => onLook(set.map((p) => p.name), { color: null, finish: null }, true)}>
                  改回跟零件文件一致
                </Button>
              </div>
            )}
            <label htmlFor={id} className="flex items-center gap-2 text-small">
              <Checkbox id={id} checked={here} onCheckedChange={(v) => setHere(v === true)} />
              只改这个装配里的
            </label>
            <p className="pl-6 text-caption text-faint-foreground">
              {here ? "写在装配上，零件文件不变" : set.length ? "写进零件文件；这里单独设的仍然优先，这个装配里看不到变化" : "写进零件文件，用到它的地方都跟着变"}
            </p>
          </div>
        ) : (
          <p className="text-caption text-faint-foreground">标准件、外购件和子装配没有自己的零件文件，颜色写在这个装配里。</p>
        )
      }
    />
  )
}

/** A part file's look, after 「零件文件里」: 「是蓝」「没设颜色（白模）」. */
const fileText = (l: Look | undefined) => (l && isSet(l) ? `是${lookText(l)}` : "没设颜色（白模）")

/** A section of the left panel: its title folds it; `action` sits on the right. */
function SectionTitle({ title, count, folded, onFold, hint, action }: { title: string; count?: string; folded: boolean; onFold: () => void; hint?: string[]; action?: ReactNode }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 pr-1.5 pl-1.5">
      <button type="button" aria-expanded={!folded} className="flex min-w-0 items-center gap-1 rounded-sm px-1 py-0.5 text-caption text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={onFold}>
        {folded ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
        <span className="truncate">{title}</span>
        {count && <span className="ml-1 text-faint-foreground tabular">{count}</span>}
      </button>
      {hint && <Hint label={`${title}怎么用`} tips={hint} />}
      <span className="ml-auto flex items-center">{action}</span>
    </div>
  )
}

/** What a row of 「结构」 does: the same object for every row and every redraw. */
type RowActions = {
  select: (p: Instance, additive: boolean) => void
  point: (p: Instance | null) => void
  look: (names: string[], change: LookChange, here: boolean) => void
  toggleHidden: (p: Instance) => void
  isolate: (p: Instance) => void
  open: (p: Instance) => void
  editInPlace: (p: Instance) => void
  note: (p: Instance) => void
  rename: (p: Instance, name: string) => Promise<boolean>
}

/**
 * A part in 「结构」, on one line: colour, name (double-click renames), eye, and ⋯. What doesn't fit on
 * the line (the full name, its file, its step, its colour) is on a card to the right of the panel when
 * the pointer rests on the row or the keyboard is on it.
 */
const StructureRow = memo(function StructureRow({ part: p, kind, selected, hidden, isolated, together, open, looks, renames, edits, notes, opens, actions: a }: {
  part: Instance
  kind: Structure["kind"]
  selected: boolean
  hidden: boolean
  isolated: boolean
  /** The selected parts, when this is one of several. */
  together: Instance[] | null
  /** Its own file can be opened; else why not. */
  open: true | string
  looks: boolean
  renames: boolean
  edits: boolean
  notes: boolean
  opens: boolean
  actions: RowActions
}) {
  const base = p.name.replace(/[#/].*$/, "")
  const group = together ?? [p]
  const [renaming, setRenaming] = useState(false)
  const reveal = "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
  // 「机身/上盖」: what tells this row from its neighbours is the end, so the start gives way first.
  const cut = p.name.lastIndexOf("/") + 1
  return (
    <TooltipPrimitive.Root delayDuration={350} disableHoverableContent>
      <TooltipPrimitive.Trigger asChild>
        <li className={rowClass(selected)} onMouseEnter={() => a.point(p)} onMouseLeave={() => a.point(null)}>
          {looks && (p.body ? <LookPicker look={p.look} label={`「${p.name}」的颜色`} className="ml-1.5" onChange={(change) => a.look(group.map((x) => x.name), change, false)} /> : <InstanceLook part={p} group={group} onLook={a.look} />)}
          {renaming && renames ? (
            <InlineName
              value={base}
              label="零件名"
              onDone={async (name) => {
                const ok = name === base || (await a.rename(p, name))
                if (ok) setRenaming(false)
                return ok
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <button
              type="button"
              aria-label={`选择零件：${p.name}`}
              aria-pressed={selected}
              className="flex h-7 min-w-0 flex-1 items-center px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onFocus={() => a.point(p)}
              onBlur={() => a.point(null)}
              // The second click of a double-click renames; it doesn't toggle the selection back.
              onClick={(e) => e.detail < 2 && a.select(p, e.shiftKey)}
              onDoubleClick={() => renames && setRenaming(true)}
              onKeyDown={(e) => {
                if (e.key === "F2" && renames) {
                  e.preventDefault()
                  setRenaming(true)
                }
                // ↵ opens the part's own file, as in the view (Space still selects it); ⇧↵ edits it in the assembly.
                if (e.key === "Enter" && opens && open === true) {
                  e.preventDefault()
                  if (e.shiftKey && edits) a.editInPlace(p)
                  else a.open(p)
                }
              }}
            >
              <span className={cn("flex min-w-0 text-small", hidden && "line-through opacity-60")}>
                {cut > 0 && <span className="min-w-[3ch] shrink-[50] truncate text-faint-foreground">{p.name.slice(0, cut)}</span>}
                <span className="min-w-0 truncate">{p.name.slice(cut)}</span>
              </span>
            </button>
          )}
          {!renaming && (
            // Over the end of the name, not beside it: the name keeps the whole row until the pointer comes.
            <span className={cn("flex shrink-0 items-center pr-0.5", !hidden && cn("absolute inset-y-0 right-0 rounded-r-md pl-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100", selected ? "bg-selected" : "bg-sunken bg-[image:linear-gradient(var(--accent),var(--accent))]"))}>
              <IconButton label={hidden ? `显示「${p.name}」` : `隐藏「${p.name}」`} tooltip={false} size="icon-sm" className={cn("size-6 text-muted-foreground", !hidden && reveal)} onClick={() => a.toggleHidden(p)}>
                {hidden ? <EyeOff /> : <Eye />}
              </IconButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label={`「${p.name}」的更多操作`} tooltip={false} size="icon-sm" className={cn("size-6 text-muted-foreground", reveal)}>
                    <Ellipsis />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {kind === "assembly" && (
                    <>
                      <DropdownMenuItem disabled={open !== true} onSelect={() => a.open(p)}>
                        {open === true ? "打开零件" : `打开零件（${open}）`}
                        <DropdownMenuShortcut>↵</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      {edits && open === true && (
                        <DropdownMenuItem onSelect={() => a.editInPlace(p)}>
                          在装配里改
                          <DropdownMenuShortcut>⇧↵</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => a.isolate(p)}>
                    {isolated ? "恢复显示" : "隔离"}
                    <DropdownMenuShortcut>I</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  {notes && (
                    <DropdownMenuItem onSelect={() => a.note(p)}>
                      写备注
                      <DropdownMenuShortcut>C</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                  {renames && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setRenaming(true)}>改名…</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          )}
        </li>
      </TooltipPrimitive.Trigger>
      {!renaming && (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side="right" align="start" sideOffset={10} collisionPadding={8} className="z-50 w-64 rounded-lg border bg-popover p-3 text-small shadow-popover data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in">
            <PartCard part={p} hidden={hidden} isolated={isolated} kind={kind} open={open} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  )
})

/** What a row of 「结构」 has no room for. */
function PartCard({ part: p, hidden, isolated, kind, open }: { part: Instance; hidden: boolean; isolated: boolean; kind: Structure["kind"]; open: true | string }) {
  const piece = p.whole ? p.name.slice(p.whole.length + 1) : ""
  const state = [hidden ? "已隐藏" : "", isolated ? "已隔离" : ""].filter(Boolean).join(" · ")
  const from = p.body ? "" : !p.file ? "标准件" : /\.(step|stp)$/i.test(p.file) ? "STEP 参考件" : /-asm\.json$/i.test(p.file) ? "子装配" : "零件文件"
  const rows: [string, ReactNode][] = [
    ...(p.whole ? [["属于", p.whole] as [string, ReactNode]] : []),
    ...(from ? [["来源", from] as [string, ReactNode]] : []),
    ...(p.file ? [["文件", <span key="f" className="font-mono text-caption break-all">{p.file}</span>] as [string, ReactNode]] : []),
    ...(p.id ? [["步骤", <span key="i" className="font-mono text-caption break-all">{p.id}</span>] as [string, ReactNode]] : []),
    ["颜色", `${lookText(p.look, "没设（白模）")}${p.layered && isSet(p.here) ? "，只在这个装配里" : ""}`],
    ...(state ? [["状态", state] as [string, ReactNode]] : []),
  ]
  return (
    <div className="space-y-2">
      <div className="font-medium break-words">{piece || p.name}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-faint-foreground">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-faint-foreground">
        {kind === "assembly" ? `单击选中，Shift 多选${p.body ? "" : " · 双击改名"}${open === true ? " · ↵ 打开零件" : ""}` : "单击选中 · 圆点改颜色"}
      </p>
    </div>
  )
}

/** A name being edited in place: Enter keeps it (the row stays open when it wasn't taken), Esc leaves it. */
function InlineName({ value, label, onDone, onCancel }: { value: string; label: string; onDone: (name: string) => Promise<boolean>; onCancel: () => void }) {
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const settled = useRef(false)
  const commit = async () => {
    if (settled.current || busy) return
    const name = draft.trim()
    if (!name) return onCancel()
    setBusy(true)
    const ok = await onDone(name)
    setBusy(false)
    if (ok) settled.current = true
  }
  return (
    <Input
      autoFocus
      aria-label={label}
      value={draft}
      disabled={busy}
      maxLength={60}
      className="mx-1 h-7 min-w-0 flex-1 text-small"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (!settled.current && !busy) {
          settled.current = true
          onCancel()
        }
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === "Enter") {
          e.preventDefault()
          void commit()
        } else if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          settled.current = true
          onCancel()
        }
      }}
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

/** The wordmark's height in the room it has: 18 px, down to 12 px when the panel is narrow. */
const wordmarkHeight = (room: number) => Math.max(12, Math.min(18, room / WORDMARK_ASPECT))

const rowClass = (active: boolean) => cn("group relative flex items-center rounded-md", active ? "bg-selected" : "hover:bg-accent")
const buttonClass = "flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** A file's row, or the field renaming it. Click opens the file; double-click or F2 renames it. */
function Renamable({ path, onRename, children }: { path: string; onRename?: (path: string, name: string) => Promise<boolean>; children: (rename: { onDoubleClick?: () => void; onKeyDown?: (e: KeyboardEvent) => void }) => ReactNode }) {
  const [renaming, setRenaming] = useState(false)
  const stem = fileStem(path)
  if (renaming && onRename)
    return (
      <div className={rowClass(false)}>
        <InlineName
          value={stem}
          label="文件名"
          onDone={async (name) => {
            const ok = name === stem || (await onRename(path, name))
            if (ok) setRenaming(false)
            return ok
          }}
          onCancel={() => setRenaming(false)}
        />
      </div>
    )
  return <>{children(onRename ? { onDoubleClick: () => setRenaming(true), onKeyDown: (e) => { if (e.key === "F2") { e.preventDefault(); setRenaming(true) } } } : {})}</>
}

/** A file of the project: open or not. */
function FileRow({ file: f, active, onRename }: { file: ProjectFile; active: boolean; onRename?: (path: string, name: string) => Promise<boolean> }) {
  const unit = f.kind === "assembly" ? "个零件" : "个特征"
  return (
    <Renamable path={f.path} onRename={onRename}>
      {(rename) => (
    <div className={rowClass(active)}>
      <button type="button" className={buttonClass} title={`${f.path}\n双击改名`} aria-current={active ? "page" : undefined} onClick={(e) => e.detail < 2 && void turnery.call("open_part", { path: f.path })} {...rename}>
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
      )}
    </Renamable>
  )
}

/** An open part outside the project (or any open part, without a project). */
function OpenRow({ part: p, active, onRename }: { part: PartSummary; active: boolean; onRename?: (path: string, name: string) => Promise<boolean> }) {
  return (
    <Renamable path={p.path} onRename={onRename}>
      {(rename) => (
    <div className={rowClass(active)}>
      <button type="button" className={buttonClass} title={`${p.path}\n双击改名`} aria-current={active ? "page" : undefined} onClick={(e) => e.detail < 2 && void turnery.call("open_part", { path: p.path })} {...rename}>
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
      )}
    </Renamable>
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
