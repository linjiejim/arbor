import * as React from "react"
import { Boxes, CircleAlert, MousePointerClick, Sparkles, X } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { renderShots, renderViews } from "@/studio/look"
import { selectParts } from "@/studio/part-selection"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "@/studio/scene"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { DESKTOP_WORDS, WordsContext } from "@/studio/ui/host-words"
import { StudioViewport } from "@/studio/ui/studio-viewport"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useReselect } from "@/studio/use-reselect"
import { turnery } from "./bridge"
import type { DocState, PartNote, PickRequest, ShowRequest } from "./core/protocol"
import { asNote, useDesktopNotes, useDesktopStudio, useEngine } from "./use-desktop"
import { AssistantProvider } from "./use-assistant"
import { useAssistantLayout } from "./assistant-layout"
import { AssistantDock, AssistantFloat } from "./ui/assistant-window"
import { StatusBar } from "./ui/status-bar"
import { AgentSetupDialog } from "./ui/agent-setup"
import { AddPartMenu, ComponentActions } from "./ui/assembly"
import { NoteComposer } from "./ui/note-composer"
import { PartsSidebar } from "./ui/parts-sidebar"
import { ActivityPanel, NotesPanel } from "./ui/side-panels"
import { TitleBar } from "./ui/title-bar"
import { ProjectStart, Welcome } from "./ui/welcome"
import { ModelLoading } from "./ui/model-loading"

/** A note pinned on a face or an edge (not one about the whole part). */
const onSpot = (n: PartNote): n is PartNote & { kind: "face" | "edge" } => n.kind !== "part"

const editing = () => {
  const el = document.activeElement as HTMLElement | null
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
}

export function DesktopApp() {
  const { snapshot, doc, pick, show, setShow } = useEngine()
  const studio = useDesktopStudio(doc, snapshot)
  const notes = useDesktopNotes(studio, doc, pick)
  const reselect = useReselect(studio)
  const [partsPath, setPartsPath] = React.useState(doc?.path)
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  if (partsPath !== doc?.path) { setPartsPath(doc?.path); setPartsView(NO_PARTS_VIEW) }
  const [treeHover, setTreeHover] = React.useState<Hover | null>(null)
  const [stepSlot, setStepSlot] = React.useState<HTMLDivElement | null>(null)
  const [setupOpen, setSetupOpen] = React.useState(false)
  const [tab, setTab] = React.useState("notes")
  const chatLayout = useAssistantLayout()
  /** 「工程图」 over the 3D view; parameters stay editable beside it. */
  const [sheet, setSheet] = React.useState(false)

  // The agent's `look`: render the views it asked for, from the mesh the engine sent.
  React.useEffect(
    () =>
      turnery.onLook(async (req) =>
        req.shots ? renderShots(req.display, req.shots, { highlight: req.highlight, pins: req.pins, section: req.section, hide: req.hide, size: req.size }) : renderViews(req.display, req.views, req.highlight, { pins: req.pins }),
      ),
    [],
  )
  // What 检查更新… found.
  React.useEffect(() => turnery.onNotice((n) => void (n.tone === "error" ? notify.error(n.text) : notify[n.tone](n.text))), [])

  // Menu items and shortcuts: ⌘Z undoes typing in a field, otherwise the last change to the part.
  const path = doc?.path
  React.useEffect(
    () =>
      turnery.onMenu((action) => {
        if (action === "agent-setup") return setSetupOpen(true)
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
  const pointedFeature = pointed?.path === path ? pointed?.id : null
  const selectedNames = selected && selected.path === path ? selected.parts : []
  const selectedParts = selectedNames.map((name) => studio.display?.parts?.findIndex((p) => p.name === name) ?? -1).filter((i) => i >= 0)
  const selectedFeature = selected && selected.path === path ? (selectedParts.length ? studio.display?.groups.find((g) => g.part === selectedParts.at(-1))?.origin ?? null : selected.parts.length ? null : selected.id) : null
  const pointedPart = pointed?.part && pointed.path === path ? studio.display?.parts?.findIndex((p) => p.name === pointed.part) : undefined
  const [locateStep, setLocateStep] = React.useState<{ id: string; request: number } | null>(null)
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
    const id = studio.display?.groups.find((g) => g.part === index)?.origin ?? ""
    const feature = studio.tree.features.find((f) => f.id === id)
    return { name: p.name, index, id, file: feature?.op === "component" ? feature.file ?? "" : "" }
  }) ?? []
  const [presented, setPresented] = React.useState<unknown>(null)
  const assembly = doc?.kind === "assembly" && !doc.context
  const loading = snapshot?.loading ?? (doc && !doc.error && snapshot?.kernel.phase !== "error" && (!studio.display || studio.display.provisional || presented !== studio.display) ? { path: doc.path, name: doc.name, startedAt: 0, progress: { stage: "mesh" as const, completed: 0, total: 1 } } : null)
  return (
    <WordsContext.Provider value={DESKTOP_WORDS}>
    <AssistantProvider project={snapshot?.project?.root ?? null} part={doc?.path ?? null}>
    <div className="flex h-dvh flex-col bg-background">
      <TitleBar snapshot={snapshot} doc={doc} onSetup={() => setSetupOpen(true)} sheet={sheet && Boolean(doc)} onSheet={setSheet} chat={{ open: chatLayout.layout.mode !== "hidden", onToggle: chatLayout.toggle }} />
      <div className="flex min-h-0 flex-1">
        {/* The start page is just the start page: the sidebar comes with a project or an open file. */}
        {(doc || snapshot?.project || snapshot?.parts.length || loading) && <PartsSidebar snapshot={snapshot} instances={assembly ? assemblyParts : []} selected={selectedNames}
          onSelect={(p, additive) => selectFeature(p.id, p.index, additive)}
          onPoint={(p) => pointFeature(p?.id ?? null, p?.index)} />}
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
              />
              <TreeOverlay
                studio={studio}
                busy={Boolean(loading)}
                onHover={setTreeHover}
                pointedFeature={pointedFeature}
                selectedFeature={selectedFeature}
                locateStep={locateStep}
                onSelectFeature={selectFeature}
                reselect={reselect}
                annotations={notes}
                parts={partsView}
                onParts={setPartsView}
                partsList={!assembly}
                rowActions={assembly ? (f) => <ComponentActions f={f} doc={doc} studio={studio} view={partsView} onView={setPartsView} /> : undefined}
                footer={assembly ? <AddPartMenu doc={doc} /> : undefined}
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
                {!pick && doc.context && <ContextBanner doc={doc} />}
              </>
            )}
          </div>
        </main>
        {doc && (
          <Tabs value={tab} onValueChange={setTab} className="relative flex w-[380px] shrink-0 flex-col border-l max-xl:w-[340px]">
            <TabsList className="shrink-0 px-3">
              <TabsTrigger value="notes">
                备注{doc.notes.some((n) => n.status === "open") ? ` ${doc.notes.filter((n) => n.status === "open").length}` : ""}
              </TabsTrigger>
              <TabsTrigger value="activity">动态</TabsTrigger>
              <TabsTrigger value="params">参数</TabsTrigger>
              <TabsTrigger value="code">代码</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <NotesPanel doc={doc} onLocate={(n) => onSpot(n) && void notes.show(asNote(n))} onWrite={() => notes.setCompose("")} />
            </TabsContent>
            <TabsContent value="activity" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <ActivityPanel doc={doc} snapshot={snapshot} />
            </TabsContent>
            <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
              <ParamsPanel studio={studio} onHover={setTreeHover} annotations={notes} />
            </TabsContent>
            <TabsContent value="code" className="min-h-0 flex-1 overflow-y-auto">
              <CodePanel studio={studio} />
            </TabsContent>
            {/* A step's details from the timeline cover this panel while shown. */}
            <div ref={setStepSlot} className="pointer-events-none absolute inset-0 z-20" />
          </Tabs>
        )}
        {chatLayout.layout.mode === "dock" && <AssistantDock state={chatLayout} />}
      </div>
      <StatusBar snapshot={snapshot} doc={doc} pick={pick} onNotes={() => setTab("notes")} />
      {chatLayout.layout.mode === "float" && <AssistantFloat state={chatLayout} />}
      <AgentSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <NoteComposer
        text={notes.compose}
        onClose={() => notes.setCompose(null)}
        onSave={async (text) => {
          if (!(await notes.addPartNote(text))) return false
          notes.setCompose(null)
          setTab("notes")
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

/** Editing a part inside an assembly: say so, and the way back. */
function ContextBanner({ doc }: { doc: DocState }) {
  if (!doc.context) return null
  return (
    <Banner
      tone="info"
      icon={<Boxes />}
      keep
      action={
        <Button size="sm" variant="secondary" onClick={() => void turnery.call("open_part", { path: doc.context!.assembly })}>
          回到装配
        </Button>
      }
    >
      在「{doc.context.name}」里编辑「{doc.name}」
    </Banner>
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
