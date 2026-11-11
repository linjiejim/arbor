import * as React from "react"
import { Boxes, CircleAlert, MousePointerClick, Sparkles, X } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { notify } from "@/components/ui/toast"
import { renderShots, renderViews } from "@/studio/look"
import { selectParts } from "@/studio/part-selection"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "@/studio/scene"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { DESKTOP_WORDS, WordsContext } from "@/studio/ui/host-words"
import { StudioViewport, type ViewCamera } from "@/studio/ui/studio-viewport"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useReselect } from "@/studio/use-reselect"
import { turnery } from "./bridge"
import type { DocState, PickRequest, ShowRequest, Snapshot } from "./core/protocol"
import { useDesktopNotes, useDesktopStudio, useEngine, type Compose } from "./use-desktop"
import { AssistantProvider } from "./use-assistant"
import { useAssistantLayout } from "./assistant-layout"
import { AssistantDock, AssistantFloat } from "./ui/assistant-window"
import { StatusBar, type StatusTarget } from "./ui/status-bar"
import { AgentSetupDialog } from "./ui/agent-setup"
import { AddPartMenu } from "./ui/assembly"
import { openTarget } from "./open-target"
import { renamedPart } from "./core/rename"
import { arrive, renameVisits, type Renaming, type Visit, type Visits } from "./visits"
import { fileStem } from "./ui/words"
import { NoteComposer } from "./ui/note-composer"
import { PartsSidebar, type Instance, type Structure } from "./ui/parts-sidebar"
import { RightPanel, type PanelTab } from "./ui/right-panel"
import { usePanels } from "./panels"
import { setPartLook } from "@/studio/appearance"
import type { SketchHost } from "@/studio/region"
import { ActivityPanel, NotesPanel } from "./ui/side-panels"
import { TitleBar } from "./ui/title-bar"
import { ProjectStart, Welcome } from "./ui/welcome"
import { ModelLoading } from "./ui/model-loading"

/** A note pinned on a face or an edge (not one about the whole part). */

const editing = () => {
  const el = document.activeElement as HTMLElement | null
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
}

export function DesktopApp() {
  const { snapshot, doc, pick, show, setShow } = useEngine()
  const studio = useDesktopStudio(doc, snapshot)
  const notes = useDesktopNotes(studio, doc, pick)
  const reselect = useReselect(studio)
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  const [treeHover, setTreeHover] = React.useState<Hover | null>(null)
  const [stepSlot, setStepSlot] = React.useState<HTMLDivElement | null>(null)
  const [setupOpen, setSetupOpen] = React.useState(false)
  /** The tab chosen last (never 「详情」, which comes and goes with the selection). */
  const [tab, setTab] = React.useState<Exclude<PanelTab, "details">>("notes")
  const panels = usePanels()
  const history = useHistory(doc)
  /** Where the camera was left in each file, for coming back to it (the view closes while a file loads). */
  const [cameras] = React.useState(() => new Map<string, ViewCamera>())
  const chatLayout = useAssistantLayout(panels.widths.left + (doc ? panels.widths.right : 0))
  const agentSeen = useAgentSeen(snapshot)
  /** 「工程图」 over the 3D view; parameters stay editable beside it. */
  const [sheet, setSheet] = React.useState(false)

  // The agent's `look`: render the views it asked for, from the mesh the engine sent.
  React.useEffect(
    () =>
      turnery.onLook(async (req) =>
        req.shots ? renderShots(req.display, req.shots, { highlight: req.highlight, pins: req.pins, section: req.section, hide: req.hide, size: req.size, plain: req.plain }) : renderViews(req.display, req.views, req.highlight, { pins: req.pins }),
      ),
    [],
  )
  // What 检查更新… found.
  React.useEffect(() => turnery.onNotice((n) => void (n.tone === "error" ? notify.error(n.text) : notify[n.tone](n.text))), [])

  // Menu items and shortcuts: ⌘Z undoes typing in a field, otherwise the last change to the part.
  const path = doc?.path
  const menuRef = React.useRef({ toggleLeft: panels.toggleLeft, toggleRight: () => panels.toggleRight(), back: history.back, forward: history.forward })
  React.useEffect(() => {
    menuRef.current = { toggleLeft: panels.toggleLeft, toggleRight: () => panels.toggleRight(), back: history.back, forward: history.forward }
  })
  React.useEffect(
    () =>
      turnery.onMenu((action) => {
        if (action === "agent-setup") return setSetupOpen(true)
        if (action === "toggle-left") return menuRef.current.toggleLeft()
        if (action === "toggle-right") return menuRef.current.toggleRight()
        if (action === "back") return menuRef.current.back?.()
        if (action === "forward") return menuRef.current.forward?.()
        if (editing()) return void document.execCommand(action)
        if (path) void turnery.call(action, {}, path).then((r) => !r.ok && notify(r.text.replace(/^✗ /, "")))
      }),
    [path],
  )

  // The agent points something out: a feature lights up like a hover in the tree; faces or edges like a note.
  // Its highlight goes when it's cleared or replaced (only the one it set: the person's own stays).
  const { setFocus } = notes
  const shownByAgent = React.useRef(false)
  React.useEffect(() => {
    if (show && show.path === path && show.hashes?.length && show.kind) {
      setFocus({ kind: show.kind, hashes: show.hashes })
      shownByAgent.current = true
    } else if (shownByAgent.current) {
      setFocus(null)
      shownByAgent.current = false
    }
  }, [show, path, setFocus])
  const agentHover: Hover | null = show?.feature && show.path === path ? { ids: [show.feature], label: show.label ?? "Agent 指的特征" } : null
  const clearShow = () => setShow(null)
  // A pick request is answered only on the part it asks about.
  const pickHere = pick && pick.path === path ? pick : null

  const [annotation, setAnnotation] = React.useState(false)
  const [pointed, setPointed] = React.useState<{ path?: string; id: string | null; part?: string } | null>(null)
  const [selected, setSelected] = React.useState<{ path?: string; id: string | null; parts: string[] } | null>(null)
  // Each file keeps what was hidden, isolated, pulled apart and selected while another one is open.
  const [kept, setKept] = React.useState<Record<string, { view: PartsView; selected: { id: string | null; parts: string[] } | null }>>({})
  const [partsPath, setPartsPath] = React.useState(doc?.path)
  if (partsPath !== doc?.path) {
    if (partsPath) setKept((k) => ({ ...k, [partsPath]: { view: partsView, selected: selected?.path === partsPath ? { id: selected.id, parts: selected.parts } : null } }))
    setPartsPath(doc?.path)
    const back = doc?.path ? kept[doc.path] : undefined
    setPartsView(back?.view ?? NO_PARTS_VIEW)
    if (back?.selected && doc) setSelected({ path: doc.path, ...back.selected })
  }
  const pointedFeature = pointed?.path === path ? pointed?.id : null
  const selectedNames = selected && selected.path === path ? selected.parts : []
  const selectedParts = selectedNames.map((name) => studio.display?.parts?.findIndex((p) => p.name === name) ?? -1).filter((i) => i >= 0)
  const selectedFeature = selected && selected.path === path ? (selectedParts.length ? studio.display?.groups.find((g) => g.part === selectedParts.at(-1))?.origin ?? null : selected.parts.length ? null : selected.id) : null
  const pointedPart = pointed?.part && pointed.path === path ? studio.display?.parts?.findIndex((p) => p.name === pointed.part) : undefined
  const [locateStep, setLocateStep] = React.useState<{ id: string; request: number } | null>(null)
  // A step or part selected: its details are a tab, brought to the front; closing them goes back to `tab`.
  const [details, setDetails] = React.useState<string | null>(null)
  const [detailsFront, setDetailsFront] = React.useState(false)
  const onDetails = React.useCallback((id: string | null) => {
    setDetails(id)
    setDetailsFront(Boolean(id))
  }, [])
  const chooseTab = (t: PanelTab) => {
    setDetailsFront(t === "details")
    if (t !== "details") setTab(t)
  }
  const pointFeature = React.useCallback((id: string | null, part?: number) => {
    const name = part === undefined ? undefined : studio.display?.parts?.[part]?.name
    setPointed((p) => p?.id === id && p.path === path && p.part === name ? p : { path, id, part: name })
  }, [path, studio.display])
  const selectFeature = React.useCallback((id: string | null, part?: number, additive = false) => {
    if (!id && additive) return
    const name = part === undefined ? undefined : studio.display?.parts?.[part]?.name
    setSelected((p) => {
      const names = name ? selectParts(p && p.path === path ? p.parts : [], name, additive) : []
      return { path, id: name ? (names.length ? id : null) : id, parts: names }
    })
    if (part !== undefined) setPartsView((v) => {
      if (!v.hidden.has(part)) return v
      const hidden = new Set(v.hidden); hidden.delete(part)
      return { ...v, hidden }
    })
  }, [path, studio.display])
  const selectionHover = pointedFeature
  const hoverParts = pointedFeature ? (pointedPart === undefined ? [] : [pointedPart]) : selectedParts
  const modelHover: Hover | null = selectionHover ? { ids: [selectionHover], feature: selectionHover, label: "零件或步骤", faces: hoverParts.length ? studio.display?.groups.filter((g) => g.part !== undefined && hoverParts.includes(g.part)).map((g) => g.hash) : undefined } : agentHover
  const assemblyParts = studio.display?.parts?.map((p, index) => {
    const id = p.component ?? studio.display?.groups.find((g) => g.part === index)?.origin ?? ""
    const feature = studio.tree.features.find((f) => f.id === id)
    const file = feature?.op === "component" ? feature.file ?? "" : ""
    return { name: p.name, index, id, file, look: p.look, here: p.here, under: p.under, own: !!file && !/\.(step|stp)$/i.test(file) && !/-asm\.json$/i.test(file), layered: !!file && !/\.(step|stp)$/i.test(file) }
  }) ?? []
  const [presented, setPresented] = React.useState<unknown>(null)
  const assembly = doc?.kind === "assembly" && !doc.context
  const display = studio.display
  const indexOf = (name: string) => display?.parts?.findIndex((p) => p.name === name) ?? -1
  const isolated = new Set(partsView.focus?.mode === "isolate" ? partsView.focus.parts.map(indexOf).filter((i) => i >= 0) : [])
  const bodies: Instance[] = !assembly && display?.parts && display.parts.length > 1 ? display.parts.map((p, index) => ({ name: p.name, index, id: display.groups.find((g) => g.part === index)?.origin ?? "", file: "", look: p.look, body: true })) : []
  const structure: Structure | null = !doc
    ? null
    : {
        kind: assembly ? "assembly" : "part",
        items: assembly ? assemblyParts : bodies,
        hidden: partsView.hidden,
        isolated,
        onToggleHidden: (p) => {
          const hidden = new Set(partsView.hidden)
          if (hidden.has(p.index)) hidden.delete(p.index)
          else hidden.add(p.index)
          setPartsView({ ...partsView, hidden })
        },
        onNote: (p) => noteOnParts([p.name]),
        onIsolate: (p) => {
          const alone = partsView.focus?.mode === "isolate" && partsView.focus.parts.length === 1 && partsView.focus.parts[0] === p.name
          setPartsView({ ...partsView, focus: alone ? undefined : { parts: [p.name], mode: "isolate" } })
        },
        ...(assembly
          ? {
              canOpen: (p: Instance) => openTarget(doc, p.file).reason ?? true,
              onOpen: (p: Instance) => void openPart(doc, p.file, false),
              onEditInPlace: (p: Instance) => void openPart(doc, p.file, true),
              onRename: async (p: Instance, name: string) => {
                const before = componentOf(p.name, assemblyParts.map((x) => x.name))
                const r = await turnery.call("rename_part", { id: p.id, name }, doc.path)
                if (!r.ok) {
                  notify.error(r.text.replace(/^✗ /, ""))
                  return false
                }
                // What is isolated and selected here goes by the parts' names: they follow.
                const to = (n: string) => renamedPart(n, before, name.trim())
                setPartsView((v) => (v.focus ? { ...v, focus: { ...v.focus, parts: v.focus.parts.map(to) } } : v))
                setSelected((s) => (s && s.path === doc.path ? { ...s, parts: s.parts.map(to) } : s))
                return true
              },
              add: <AddPartMenu doc={doc} />,
            }
          : {}),
      }
  // Open the part under the pointer (double-click) or the one selected (↵): its own file, as from the files list.
  const openPartAt = (index: number) => {
    const p = assemblyParts.find((x) => x.index === index)
    if (assembly && doc && p) void openPart(doc, p.file, false)
  }
  /** Framing (R) and drawing (P) a note: kept like any other, with the area and its picture. */
  const sketchHost: SketchHost = {
    save: async (pick, text) => {
      const { point, part, parts, origins, image, ...rest } = pick
      const ok = await notes.addPartNote(text, { point, ...(part ? { part } : {}), region: { ...rest, parts, origins, ...(image ? { image } : {}) } })
      if (ok) chooseTab("notes")
      return ok
    },
  }
  /** A note about whole parts (by name): pinned at their middle, on the part when there's one. */
  const noteOnParts = (names: string[]) => {
    const ps = names.map((name) => display?.parts?.find((p) => p.name === name)).filter((p) => !!p)
    if (!ps.length) return
    const point = [0, 1, 2].map((k) => ps.reduce((a, p) => a + p.center[k], 0) / ps.length) as [number, number, number]
    notes.setCompose({ text: "", about: { parts: ps.map((p) => p.name), point, ...(ps.length === 1 ? { part: ps[0].name } : {}) } })
  }
  const one = assembly && selectedParts.length === 1 ? assemblyParts.find((x) => x.index === selectedParts[0]) : undefined
  const why = !assembly ? null : selectedParts.length > 1 ? "一次打开一个零件" : one ? (openTarget(doc!, one.file).reason ?? null) : null
  const noteButton = (
    <Button size="sm" variant="ghost" title="给选中的零件写一条备注（C）" onClick={() => noteOnParts(selectedNames)}>
      备注
    </Button>
  )
  const selectionActions = !doc ? null : !assembly ? noteButton : (
    <>
      {noteButton}
      <Button size="sm" variant="ghost" title={why ?? "单独打开它的零件文件（↵，或双击零件）"} disabled={Boolean(why) || !one} onClick={() => one && void openPart(doc, one.file, false)}>
        打开零件
      </Button>
      <Button size="sm" variant="ghost" title={why ?? "在装配里改它，其余零件留在周围"} disabled={Boolean(why) || !one} onClick={() => one && void openPart(doc, one.file, true)}>
        在装配里改
      </Button>
    </>
  )
  const goStatus = (to: StatusTarget) => {
    if (to === "setup") return setSetupOpen(true)
    panels.toggleRight(true)
    if (to === "failed") {
      const i = doc?.report?.features.findIndex((f) => f.state === "error") ?? -1
      const id = i >= 0 ? doc?.tree.features[i]?.id : undefined
      if (id) selectFeature(id)
      return
    }
    chooseTab(to)
  }
  const hasSidebar = Boolean(doc || snapshot?.project || snapshot?.parts.length || snapshot?.loading)
  const loading = snapshot?.loading ?? (doc && !doc.error && snapshot?.kernel.phase !== "error" && (!studio.display || studio.display.provisional || presented !== studio.display) ? { path: doc.path, name: doc.name, startedAt: 0, progress: { stage: "mesh" as const, completed: 0, total: 1 } } : null)
  return (
    <WordsContext.Provider value={DESKTOP_WORDS}>
    <AssistantProvider project={snapshot?.project?.root ?? null} part={doc?.path ?? null}>
    <div className="flex h-dvh flex-col bg-background">
      <TitleBar
        snapshot={snapshot}
        doc={doc}
        onSetup={() => setSetupOpen(true)}
        setup={!agentSeen}
        sheet={sheet && Boolean(doc)}
        onSheet={setSheet}
        chat={{ open: chatLayout.layout.mode !== "hidden", onToggle: chatLayout.toggle }}
        panels={{ left: hasSidebar ? panels.panels.left.open : null, right: doc ? panels.panels.right.open : null, onLeft: panels.toggleLeft, onRight: () => panels.toggleRight() }}
        nav={{ back: history.back, forward: history.forward }}
      />
      <div className="flex min-h-0 flex-1">
        {/* The start page is just the start page: the sidebar comes with a project or an open file. */}
        {hasSidebar && panels.panels.left.open && (
          <PartsSidebar
            snapshot={snapshot}
            width={panels.widths.left}
            panels={panels.panels}
            onPanels={panels.update}
            structure={structure}
            selected={selectedNames}
            onSelect={(p, additive) => selectFeature(p.id || null, p.index, additive)}
            onPoint={(p) => pointFeature(p?.id || null, p?.index)}
            onLook={async (parts, change, here) => {
              if (!assembly) {
                const err = await studio.editTree((t) => setPartLook(t, parts, change))
                if (err) notify.error(err)
                return
              }
              const r = await turnery.call("set_appearance", { parts, ...change, ...(here ? { where: "assembly" } : {}) }, path ?? undefined)
              if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
            }}
            onRenameFile={async (file, name) => {
              const base = baseOf(file)
              const was = fileStem(file)
              const now = `${file.slice(0, file.length - base.length)}${name.trim()}${base.slice(was.length)}`
              const rename = (path: string, to: string) => async () => {
                const r = await turnery.call("rename_file", { path, name: to })
                if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
                return r.ok
              }
              const ok = await history.renaming(file, now, rename(file, name))
              if (ok) notify.undo(`已改名为「${name.trim()}」`, () => void history.renaming(now, file, rename(now, was)))
              return ok
            }}
          />
        )}
        <main className="relative min-h-0 min-w-0 flex-1" data-testid="model-viewport" data-document={path} data-pointed-part={pointed?.path === path ? pointed?.part ?? "" : ""} data-presented={Boolean(studio.display && presented === studio.display)} data-geometry-state={!studio.display ? "loading" : studio.display.provisional ? "preview" : "ready"}>
          {doc ? (
            <>
              <StudioViewport
                studio={studio}
                annotation={annotation || Boolean(pickHere)}
                onAnnotation={setAnnotation}
                onPointFeature={pointFeature}
                onSelectFeature={selectFeature}
                onPresented={setPresented}
                selectedParts={selectedParts}
                onLocateStep={selectedFeature ? () => setLocateStep((r) => ({ id: selectedFeature, request: (r?.request ?? 0) + 1 })) : undefined}
                hover={treeHover ?? modelHover}
                annotations={notes}
                busy={Boolean(loading)}
                copy={{ hint: pick || loading || !annotation ? null : "单击模型上的面或边，给 agent 留一条备注", add: pickHere ? "就是这里" : "记下备注", next: notes.nextPin, busy: "模型还在加载，完成后即可选面和标注" }}
                reselect={reselect}
                parts={partsView}
                onParts={setPartsView}
                selectionActions={selectionActions}
                sketch={sketchHost}
                onNoteSelection={() => noteOnParts(selectedNames)}
                pinNotes={notes.pinNotes}
                onOpenPart={assembly ? openPartAt : undefined}
                keys={DESKTOP_KEYS}
                active={!sheet}
                viewKey={doc.path}
                cameras={cameras}
              />
              <TreeOverlay
                studio={studio}
                busy={Boolean(loading)}
                onHover={setTreeHover}
                selectedFeature={selectedFeature}
                locateStep={locateStep}
                onSelectFeature={selectFeature}
                reselect={reselect}
                annotations={notes}
                parts={partsView}
                onParts={setPartsView}
                partsList={false}
                looks={!assembly}
                timeline={!assembly}
                onDetails={onDetails}
                detailsIn={stepSlot}
              />
              {sheet && (
                <div className="absolute inset-0 z-30 bg-background">
                  <DrawingSheet studio={studio} title={doc.name} />
                </div>
              )}
            </>
          ) : (
            !loading && (snapshot?.project ? <ProjectStart name={snapshot.project.name} /> : <Welcome onSetup={() => setSetupOpen(true)} />)
          )}
          {/* Loading and recomputing sit at the top with the agent's banners, out of the model's way. */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 pr-80 pl-16">
            {loading && <ModelLoading load={loading} visible={Boolean(doc?.path === loading.path && studio.display?.mesh)} />}
            {doc && (
              <>
                {pick && <PickBanner request={pick} elsewhere={pick.path !== path} />}
                {show && show.path === path && !pick && <ShowBanner request={show} onClose={clearShow} />}
                {doc.report?.checksError && <Banner tone="info" icon={<Boxes />}>后台检查失败：{doc.report.checksError}。可继续查看，精确结果暂不可用。</Banner>}
                {doc.report?.checksPending && !loading && <Banner tone="info" icon={<Boxes />}>正在后台检查装配，可继续查看和编辑</Banner>}
                {doc.error && (
                  <Banner tone="danger" icon={<CircleAlert />}>
                    {doc.error}
                  </Banner>
                )}
              </>
            )}
          </div>
        </main>
        {doc && (
          <RightPanel
            open={panels.panels.right.open}
            width={panels.widths.right}
            onWidth={(w) => panels.update((p) => ({ ...p, right: { ...p.right, w } }))}
            onOpen={panels.toggleRight}
            tab={details && detailsFront ? "details" : tab}
            onTab={chooseTab}
            details={Boolean(details)}
            openNotes={doc.notes.filter((n) => n.status === "open").length}
            checksFailing={doc.report?.checks?.filter((c) => !c.invalid && !c.pass).length ?? 0}
            slot={setStepSlot}
          >
            {{
              notes: <NotesPanel doc={doc} onLocate={notes.locateNote} onWrite={() => notes.setCompose({ text: "" })} />,
              activity: <ActivityPanel doc={doc} />,
              params: <ParamsPanel studio={studio} onHover={setTreeHover} annotations={notes} />,
              code: <CodePanel studio={studio} />,
            }}
          </RightPanel>
        )}
        {chatLayout.layout.mode === "dock" && <AssistantDock state={chatLayout} />}
      </div>
      <StatusBar snapshot={snapshot} doc={doc} pick={pick} onGo={goStatus} agentSeen={agentSeen} />
      {chatLayout.layout.mode === "float" && <AssistantFloat state={chatLayout} />}
      <AgentSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <NoteComposer
        text={notes.compose?.text ?? null}
        about={notes.compose ? composeAbout(notes.compose, doc?.kind === "assembly" ? "装配" : "零件") : ""}
        onClose={() => notes.setCompose(null)}
        onSave={async (text) => {
          if (!(await notes.addPartNote(text, notes.compose?.about))) return false
          notes.setCompose(null)
          chooseTab("notes")
          return true
        }}
      />
    </div>
    </AssistantProvider>
    </WordsContext.Provider>
  )
}

/** `keep`: the text keeps its width (a short label beside several buttons) instead of wrapping. */
function Banner({ tone, icon, children, action, keep }: { tone: "info" | "warning" | "danger"; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; keep?: boolean }) {
  const color = { info: "border-info/40", warning: "border-warning/50", danger: "border-destructive/40" }[tone]
  const iconColor = { info: "text-info", warning: "text-warning", danger: "text-destructive" }[tone]
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`pointer-events-auto flex max-w-xl items-center gap-2.5 rounded-lg border bg-background py-1.5 pr-1.5 pl-3 shadow-popover ${color}`}>
      <span className={`shrink-0 [&_svg]:size-4 ${iconColor}`}>{icon}</span>
      <span className={`${keep ? "shrink-0" : "min-w-0 flex-1"} text-body`}>{children}</span>
      {action}
    </div>
  )
}

/** The agent is waiting for a click: say what it asked, and let the person decline. */
function PickBanner({ request, elsewhere }: { request: PickRequest; elsewhere: boolean }) {
  const what = request.kind === "face" ? "一个面" : request.kind === "edge" ? "一条边" : "一个面或一条边"
  const part = request.path.split(/[\\/]/).pop()
  return (
    <Banner
      tone="warning"
      icon={<MousePointerClick />}
      action={
        <>
          {elsewhere && (
            <Button size="sm" variant="secondary" onClick={() => void turnery.call("open_part", { path: request.path })}>
              切到 {part}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void turnery.answerPick(request.id, null)}>
            不点了
          </Button>
        </>
      }
    >
      <span className="font-medium">Agent 请你{elsewhere ? `在 ${part} 上` : ""}点{what}：</span>
      {request.prompt}
    </Banner>
  )
}

function ShowBanner({ request, onClose }: { request: ShowRequest; onClose: () => void }) {
  return (
    <Banner
      tone="info"
      icon={<Sparkles />}
      action={
        <IconButton label="取消高亮" size="icon-sm" onClick={onClose}>
          <X />
        </IconButton>
      }
    >
      <span className="font-medium">Agent 指给你看：</span>
      {request.label ?? (request.hashes ? `${request.hashes.length} ${request.kind === "face" ? "个面" : "条边"}` : "")}
    </Banner>
  )
}

/** The window's own keys, after the view's in the 「快捷键」 card. */
const DESKTOP_KEYS = [
  { keys: "↵", what: "单独打开选中的零件（也可以双击零件）" },
  { keys: "⌘B / ⌥⌘B", what: "收起或展开左栏 / 右栏" },
  { keys: "⌘[ / ⌘]", what: "后退 / 前进" },
]

/**
 * The files opened in this window, in order, for 后退 / 前进 (⌘[ / ⌘]). A file in an assembly is
 * opened again in it. Going back and then opening another file drops what was ahead, as in a browser.
 */
function useHistory(doc: DocState | null) {
  const [history, setHistory] = React.useState<Visits>({ list: [], at: -1 })
  /** Where back / forward is going, until the file opens (or fails to). */
  const [travel, setTravel] = React.useState<number | null>(null)
  /** A file being renamed: shown again under its new name, it is the same visit. */
  const [renaming, setRenaming] = React.useState<Renaming | null>(null)
  const visit: Visit | null = doc ? { path: doc.path, ...(doc.context ? { context: doc.context.assembly } : {}) } : null
  const key = visit ? `${visit.path}\n${visit.context ?? ""}` : ""
  const [seen, setSeen] = React.useState("")
  if (key !== seen) {
    setSeen(key)
    // No file while the next one loads: where back / forward is going holds until it arrives.
    if (visit) {
      setHistory(arrive(history, visit, travel, renaming))
      setTravel(null)
    }
  }
  const go = (at: number) => {
    const v = history.list[at]
    if (!v) return
    setTravel(at)
    void turnery.call("open_part", v.context ? { path: v.path, context: v.context } : { path: v.path }).then((r) => {
      if (r.ok) return
      setTravel(null)
      notify.error(r.text.replace(/^✗ /, ""))
    })
  }
  return {
    back: history.at > 0 ? () => go(history.at - 1) : null,
    forward: history.at >= 0 && history.at < history.list.length - 1 ? () => go(history.at + 1) : null,
    /**
     * Rename a file (`run`): the file reopening under its new name is no new visit (which would drop
     * what is ahead), and once it's done the visits to it go to the new name. Nothing changes if it fails.
     */
    renaming: async (from: string, to: string, run: () => Promise<boolean>) => {
      setRenaming({ from, to })
      const ok = await run().finally(() => setRenaming(null))
      if (ok) setHistory((h) => renameVisits(h, from, to))
      return ok
    },
  }
}

/** The component a part belongs to: 「螺钉#2/垫圈」→「螺钉」 (the longest name among the parts that fits). */
function componentOf(part: string, all: string[]) {
  const bases = [...new Set(all.map((n) => n.replace(/[#/].*$/, "")))].filter((b) => part === b || part.startsWith(`${b}#`) || part.startsWith(`${b}/`))
  return bases.sort((a, b) => b.length - a.length)[0] ?? part.replace(/[#/].*$/, "")
}
const baseOf = (p: string) => p.split(/[\\/]/).pop() ?? p

/** The dialog's line on what the note is about. */
function composeAbout(c: Compose, whole: string) {
  const a = c.about
  if (a?.feature) return `关于步骤「${a.name ?? a.feature}」。`
  if (a?.parts?.length) return `关于零件${a.parts.map((p) => `「${p}」`).join("")}（整个零件，不用点在面或边上）。`
  return `关于整个${whole}。`
}

const AGENT_SEEN = "turnery:agent-seen"

/** Whether an outside agent has worked in Turnery on this machine (then 「接入 Agent」 leaves the top bar). */
function useAgentSeen(snapshot: Snapshot | null) {
  const [seen, setSeen] = React.useState(() => {
    try {
      return localStorage.getItem(AGENT_SEEN) === "1"
    } catch {
      return false
    }
  })
  const now = snapshot?.agent.who === "agent" && snapshot.agent.at !== null
  if (now && !seen) setSeen(true)
  React.useEffect(() => {
    if (!seen) return
    try {
      localStorage.setItem(AGENT_SEEN, "1")
    } catch {
      /* private mode: this window only */
    }
  }, [seen])
  return seen
}

/** Open a component's own file: alone (as from the files list), or inside this assembly. */
async function openPart(doc: DocState, file: string, inPlace: boolean) {
  const t = openTarget(doc, file)
  if (t.reason) return notify(t.reason)
  const r = await turnery.call("open_part", inPlace && !t.nested ? { path: t.path, context: doc.path } : { path: t.path })
  if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
}
