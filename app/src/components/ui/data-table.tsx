"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import { Button, IconButton } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StateView } from "@/components/ui/state"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Numbers and amounts: "right" (tabular figures are applied). */
    align?: "left" | "right" | "center"
    /** Drop the column below this breakpoint. */
    hideBelow?: "sm" | "md" | "lg" | "xl"
    /** Pin the identity column left on wide tables. One column only. */
    pin?: "left"
    /** CSS width, e.g. "8rem". Leave unset for the flexible column. */
    width?: string
    /** Role in the phone summary list. Default: first column is the title, next two are meta. */
    mobile?: "title" | "meta" | "hidden"
    /** Let long text wrap instead of truncating. Rare. */
    wrap?: boolean
  }
}

/*
 * Rules baked in:
 *   - header 36 / row 44 (compact 32 / 36); hairlines between rows, no
 *     vertical lines; header text muted, medium weight
 *   - text left, numbers right with tabular figures; nowrap + truncate + title
 *   - sticky header; identity column may pin left; actions pin right
 *   - row click opens details (Drawer); editing never happens by double-click
 *   - ≤ 2 visible row actions, the rest go in a ⋯ menu (render that in rowActions)
 *   - pagination 20 / 50 / 100, remembered per table via pageSizeKey
 *   - loading never shows "empty"; failure never looks like empty
 *   - below md the table becomes a summary list
 * The table fills its parent's height and scrolls inside; give the parent a
 * height (flex-1 min-h-0 in a full-height page) so the page itself doesn't scroll.
 */
export type DataTableProps<T> = {
  columns: ColumnDef<T, any>[]
  data: T[]
  /** Stable id per record. Required: selection, active row and pagination key on it. */
  getRowId: (row: T) => string
  /** Hide on phones; a short label for the list, e.g. "项目". */
  "aria-label"?: string

  loading?: boolean
  error?: unknown
  onRetry?: () => void
  forbidden?: boolean
  /** True when search/filters are active, so zero rows means "no match". */
  filtered?: boolean
  onClearFilters?: () => void
  empty?: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }

  onRowClick?: (row: T) => void
  /** Row currently open in a drawer. */
  activeRowId?: string
  rowActions?: (row: T) => React.ReactNode

  selection?: { value: RowSelectionState; onChange: (v: RowSelectionState) => void }
  bulkActions?: (rows: T[]) => React.ReactNode

  sorting?: { value: SortingState; onChange: (v: SortingState) => void; manual?: boolean }
  /** Server pagination. Omit for client-side pagination of `data`. */
  pagination?: { pageIndex: number; pageSize: number; total: number; onChange: (p: PaginationState) => void }
  pageSizeKey?: string
  pageSizes?: number[]

  renderMobileRow?: (row: T) => React.ReactNode
  className?: string
}

const hideClass = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden", xl: "max-xl:hidden" }
const SELECT_W = "2.5rem"

function readPageSize(key: string | undefined, sizes: number[]) {
  if (!key || typeof localStorage === "undefined") return sizes[0]
  const v = Number(localStorage.getItem(`table:${key}:pageSize`))
  return sizes.includes(v) ? v : sizes[0]
}

export function DataTable<T>({
  columns: columnsProp,
  data,
  getRowId,
  loading,
  error,
  onRetry,
  forbidden,
  filtered,
  onClearFilters,
  empty,
  onRowClick,
  activeRowId,
  rowActions,
  selection,
  bulkActions,
  sorting: sortingProp,
  pagination: serverPage,
  pageSizeKey,
  pageSizes = [20, 50, 100],
  renderMobileRow,
  className,
  ...aria
}: DataTableProps<T>) {
  const [innerSort, setInnerSort] = React.useState<SortingState>([])
  const [clientPage, setClientPage] = React.useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: readPageSize(pageSizeKey, pageSizes),
  }))
  const sorting = sortingProp?.value ?? innerSort
  const page = serverPage ? { pageIndex: serverPage.pageIndex, pageSize: serverPage.pageSize } : clientPage

  const columns = React.useMemo<ColumnDef<T, any>[]>(() => {
    if (!selection) return columnsProp
    const select: ColumnDef<T, any> = {
      id: "__select",
      enableSorting: false,
      meta: { width: SELECT_W, mobile: "hidden" },
      header: ({ table }) => (
        <Checkbox
          aria-label={s().selectedCount(0)}
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox aria-label={String(row.id)} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
      ),
    }
    return [select, ...columnsProp]
  }, [columnsProp, selection])

  const table = useReactTable({
    data,
    columns,
    getRowId: (r) => getRowId(r),
    state: { sorting, pagination: page, rowSelection: selection?.value ?? {} },
    enableRowSelection: !!selection,
    onRowSelectionChange: (u) => selection?.onChange(typeof u === "function" ? u(selection.value) : u),
    onSortingChange: (u) => {
      const next = typeof u === "function" ? u(sorting) : u
      if (sortingProp) sortingProp.onChange(next)
      else setInnerSort(next)
    },
    manualSorting: sortingProp?.manual,
    manualPagination: !!serverPage,
    rowCount: serverPage?.total,
    onPaginationChange: (u) => {
      const next = typeof u === "function" ? u(page) : u
      if (serverPage) serverPage.onChange(next)
      else setClientPage(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sortingProp?.manual ? undefined : getSortedRowModel(),
    getPaginationRowModel: serverPage ? undefined : getPaginationRowModel(),
    autoResetPageIndex: !serverPage,
  })

  const setPageSize = (n: number) => {
    if (pageSizeKey) localStorage.setItem(`table:${pageSizeKey}:pageSize`, String(n))
    table.setPagination({ pageIndex: 0, pageSize: n })
  }

  const rows = table.getRowModel().rows
  const total = serverPage?.total ?? data.length
  const pageCount = Math.max(1, Math.ceil(total / page.pageSize))

  // Results shrank under the current page (deleted the last row on it, narrower filter): step back.
  React.useEffect(() => {
    if (!loading && page.pageIndex > 0 && page.pageIndex >= pageCount) table.setPageIndex(pageCount - 1)
  }, [loading, page.pageIndex, pageCount, table])
  const selectedRows = selection ? table.getSelectedRowModel().rows.map((r) => r.original) : []
  const showSkeleton = useDelayedFlag(!!loading && data.length === 0)
  const refetching = useDelayedFlag(!!loading && data.length > 0)
  const pinnedLeft = (id: string) => table.getColumn(id)?.columnDef.meta?.pin === "left"
  const hasPinned = columnsProp.some((c) => c.meta?.pin === "left")
  const isSticky = (id: string) => pinnedLeft(id) || (id === "__select" && hasPinned)

  // ---- body for the non-row states ----
  let state: React.ReactNode = null
  if (forbidden) state = <StateView kind="no-permission" size="sm" />
  else if (error && data.length === 0) state = <StateView kind="error" size="sm" onRetry={onRetry} />
  else if (loading && data.length === 0) state = showSkeleton ? "skeleton" : "blank"
  else if (data.length === 0)
    state = filtered ? (
      <StateView kind="no-match" size="sm" onClearFilters={onClearFilters} />
    ) : (
      <StateView kind="empty" size="sm" title={empty?.title} description={empty?.description} action={empty?.action} />
    )

  const clickable = !!onRowClick
  const onRowActivate = (e: React.MouseEvent | React.KeyboardEvent, row: Row<T>) => {
    if (!onRowClick) return
    const el = e.target as HTMLElement
    if (el.closest("button, a, input, label, [role=checkbox], [role=menuitem]")) return
    onRowClick(row.original)
  }

  const cellClass = (meta: NonNullable<ColumnDef<T>["meta"]> | undefined, id: string) =>
    cn(
      "px-3",
      meta?.align === "right" && "text-right tabular",
      meta?.align === "center" && "text-center",
      meta?.hideBelow && hideClass[meta.hideBelow],
      id === "__select" && "w-10 px-0 pl-3",
      isSticky(id) && "sticky z-[1]",
    )
  const pinStyle = (id: string, meta: NonNullable<ColumnDef<T>["meta"]> | undefined): React.CSSProperties => ({
    width: meta?.width,
    left: !isSticky(id) ? undefined : id === "__select" ? 0 : selection ? SELECT_W : 0,
  })

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* ---------- table (md and up) ---------- */}
      <div className="relative min-h-0 flex-1 overflow-auto max-md:hidden">
        <table aria-label={aria["aria-label"]} aria-busy={loading || undefined} className="w-full border-separate border-spacing-0 text-body">
          <thead className="sticky top-0 z-[2]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta
                  const sort = h.column.getIsSorted()
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                      style={pinStyle(h.column.id, meta)}
                      className={cn(
                        "h-(--row-head-h) whitespace-nowrap border-b bg-sunken text-left text-small font-medium text-muted-foreground",
                        cellClass(meta, h.column.id),
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            "group/sort inline-flex items-center gap-1 hover:text-foreground",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sort === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-0 group-hover/sort:opacity-100" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  )
                })}
                {rowActions && (
                  <th scope="col" className="sticky right-0 h-(--row-head-h) w-px border-b bg-sunken px-3">
                    <span className="sr-only">{s().rowActions}</span>
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody className={cn("transition-opacity duration-(--duration-base)", refetching && "opacity-60")}>
            {state === "skeleton" &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {table.getVisibleLeafColumns().map((c) => (
                    <td key={c.id} className={cn("h-(--row-h) border-b", cellClass(c.columnDef.meta, c.id))}>
                      <Skeleton className={cn("h-3", c.columnDef.meta?.align === "right" ? "ml-auto w-12" : "w-3/5")} />
                    </td>
                  ))}
                  {rowActions && <td className="border-b" />}
                </tr>
              ))}
            {state === "blank" && (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="h-40" />
              </tr>
            )}
            {state && typeof state !== "string" && (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)}>{state}</td>
              </tr>
            )}
            {!state &&
              rows.map((row) => {
                const active = activeRowId !== undefined && row.id === activeRowId
                const selected = row.getIsSelected()
                return (
                  <tr
                    key={row.id}
                    data-state={selected || active ? "selected" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={(e) => onRowActivate(e, row)}
                    onKeyDown={(e) => e.key === "Enter" && onRowActivate(e, row)}
                    className={cn("group/row", clickable && "cursor-pointer focus-visible:outline-offset-[-2px]")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <BodyCell key={cell.id} cell={cell} className={cellClass(cell.column.columnDef.meta, cell.column.id)} style={pinStyle(cell.column.id, cell.column.columnDef.meta)} />
                    ))}
                    {rowActions && (
                      <td className="sticky right-0 h-(--row-h) w-px whitespace-nowrap border-b bg-background px-2 text-right group-hover/row:shadow-[inset_0_0_0_9999px_var(--accent)] group-data-[state=selected]/row:bg-selected">
                        <div className="flex items-center justify-end gap-0.5">{rowActions(row.original)}</div>
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* ---------- summary list (below md) ---------- */}
      <div className="min-h-0 flex-1 overflow-auto md:hidden">
        {state === "skeleton" &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 border-b px-4 py-3.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        {state === "blank" && <div className="h-40" />}
        {state && typeof state !== "string" && state}
        {!state && (
          <ul aria-label={aria["aria-label"]}>
            {rows.map((row) => (
              <li
                key={row.id}
                tabIndex={clickable ? 0 : undefined}
                onClick={(e) => onRowActivate(e, row)}
                onKeyDown={(e) => e.key === "Enter" && onRowActivate(e, row)}
                data-state={row.getIsSelected() || row.id === activeRowId ? "selected" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-3 border-b px-4 py-2.5 data-[state=selected]:bg-selected",
                  clickable && "cursor-pointer active:bg-pressed",
                )}
              >
                {selection && (
                  <Checkbox aria-label={String(row.id)} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
                )}
                <div className="min-w-0 flex-1">{renderMobileRow ? renderMobileRow(row.original) : <DefaultMobileRow row={row} />}</div>
                {rowActions && <div className="flex shrink-0 items-center">{rowActions(row.original)}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- footer ---------- */}
      {(total > 0 || selectedRows.length > 0 || page.pageIndex > 0) && !forbidden && (
        <div className="flex min-h-(--control-lg) shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-1.5 text-small text-muted-foreground max-md:px-4">
          {selectedRows.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{s().selectedCount(selectedRows.length)}</span>
              {bulkActions?.(selectedRows)}
              <Button variant="ghost" size="sm" onClick={() => table.resetRowSelection()}>
                {s().clearSelection}
              </Button>
            </div>
          ) : (
            <span className="tabular">{s().totalCount(total)}</span>
          )}
          {(total > pageSizes[0] || page.pageIndex > 0) && (
            <div className="ml-auto flex items-center gap-2">
              <Select
                aria-label={s().perPage(page.pageSize)}
                className="h-(--control-sm) w-auto gap-1 border-transparent px-2 text-small hover:bg-accent"
                value={String(page.pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
                options={pageSizes.map((n) => ({ value: String(n), label: s().perPage(n) }))}
              />
              <span className="tabular">{s().pageOf(page.pageIndex + 1, pageCount)}</span>
              <div className="flex">
                <IconButton label={s().prevPage} size="icon-sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                  <ChevronLeft />
                </IconButton>
                <IconButton label={s().nextPage} size="icon-sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                  <ChevronRight />
                </IconButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BodyCell<T>({ cell, className, style }: { cell: Cell<T, unknown>; className?: string; style?: React.CSSProperties }) {
  const meta = cell.column.columnDef.meta
  const raw = cell.getValue()
  return (
    <td
      style={style}
      className={cn(
        "h-(--row-h) border-b bg-background",
        "group-hover/row:shadow-[inset_0_0_0_9999px_var(--accent)] group-data-[state=selected]/row:bg-selected",
        meta?.wrap ? "py-2" : "max-w-0 whitespace-nowrap",
        className,
      )}
    >
      <div className={cn(!meta?.wrap && "truncate")} title={typeof raw === "string" ? raw : undefined}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    </td>
  )
}

function DefaultMobileRow<T>({ row }: { row: Row<T> }) {
  const cells = row.getVisibleCells().filter((c) => c.column.id !== "__select" && c.column.columnDef.meta?.mobile !== "hidden")
  const title = cells.find((c) => c.column.columnDef.meta?.mobile === "title") ?? cells[0]
  const marked = cells.filter((c) => c.column.columnDef.meta?.mobile === "meta")
  const meta = (marked.length ? marked : cells.filter((c) => c !== title).slice(0, 2)).filter(Boolean)
  return (
    <>
      <div className="truncate text-body font-medium">{title && flexRender(title.column.columnDef.cell, title.getContext())}</div>
      {meta.length > 0 && (
        <div className="mt-0.5 flex items-center gap-2 truncate text-small text-muted-foreground">
          {meta.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <span aria-hidden>·</span>}
              <span className="truncate">{flexRender(c.column.columnDef.cell, c.getContext())}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  )
}
