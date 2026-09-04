"use client"

import * as React from "react"
import type { CellData } from "@/lib/workspace-types"
import { cellRef, displayKind, parseRef } from "./cells"
import { useSheetStore } from "./sheet-store"

export const COL_W = 100
export const ROW_H = 32
export const HEADER_W = 44

const CELL_SHADOW = "inset -1px -1px 0 0 var(--border)"
/** all preset fills are light pastels — force Google's dark ink on them */
const INK_ON_FILL = "#202124"

/* --------------------------- individual pieces --------------------------- */

function ColHeader({ c }: { c: number }) {
  const highlighted = useSheetStore((s) => c >= s.sel.c0 && c <= s.sel.c1)
  const selectCol = useSheetStore((s) => s.selectCol)
  return (
    <button
      type="button"
      data-col-header={c}
      onClick={() => selectCol(c)}
      aria-label={`Select column ${cellRef(0, c).replace("1", "")}`}
      className={`flex h-8 shrink-0 select-none items-center justify-center border-0 bg-muted/95 text-[11px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 ${
        highlighted ? "bg-accent text-accent-foreground" : ""
      }`}
      style={{ width: COL_W, boxShadow: CELL_SHADOW }}
    >
      {cellRef(0, c).slice(0, -1)}
    </button>
  )
}

function RowNum({ r }: { r: number }) {
  const highlighted = useSheetStore((s) => r >= s.sel.r0 && r <= s.sel.r1)
  const selectRow = useSheetStore((s) => s.selectRow)
  return (
    <button
      type="button"
      data-row-header={r}
      onClick={() => selectRow(r)}
      aria-label={`Select row ${r + 1}`}
      className={`sticky left-0 z-10 flex h-8 shrink-0 select-none items-center justify-center border-0 bg-muted/95 text-[11px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 ${
        highlighted ? "bg-accent text-accent-foreground" : ""
      }`}
      style={{ width: HEADER_W, height: ROW_H, boxShadow: CELL_SHADOW }}
    >
      <span className="tnum">{r + 1}</span>
    </button>
  )
}

const GridBody = React.memo(function GridBody({
  cells,
  computed,
  rows,
  cols,
}: {
  cells: Record<string, CellData>
  computed: Record<string, string>
  rows: number
  cols: number
}) {
  const rowEls: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    const cellEls: React.ReactNode[] = []
    for (let c = 0; c < cols; c++) {
      const ref = cellRef(r, c)
      const cell = cells[ref]
      const display = computed[ref] ?? ""
      const kind = displayKind(display)
      const align = cell?.align ?? (kind === "number" ? "right" : kind === "text" ? "left" : "center")
      cellEls.push(
        <div
          key={c}
          data-cell
          data-r={r}
          data-c={c}
          role="gridcell"
          className={`flex h-8 shrink-0 select-none items-center overflow-hidden whitespace-nowrap px-1.5 text-[13px] leading-none ${
            kind === "number" ? "tnum" : ""
          } ${cell?.bold ? "font-bold" : "font-normal"} ${cell?.italic ? "italic" : ""} ${
            kind === "error" ? "text-destructive" : ""
          } ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}
          style={{
            width: COL_W,
            height: ROW_H,
            boxShadow: CELL_SHADOW,
            ...(cell?.bg
              ? { background: cell.bg, color: INK_ON_FILL }
              : {}),
          }}
        >
          {display}
        </div>
      )
    }
    rowEls.push(
      <div key={r} role="row" className="flex">
        <RowNum r={r} />
        {cellEls}
      </div>
    )
  }
  return <>{rowEls}</>
})

/* ------------------------------ cell editor ------------------------------ */

function CellEditorInput({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const editing = useSheetStore((s) => s.editing)
  const updateDraft = useSheetStore((s) => s.updateDraft)
  const commitEdit = useSheetStore((s) => s.commitEdit)
  const cancelEdit = useSheetStore((s) => s.cancelEdit)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const el = inputRef.current
    if (!el || !editing) return
    // only steal focus when the edit began in the grid — a formula-bar edit keeps its focus
    if (editing.source !== "grid") return
    el.focus({ preventScroll: true })
    if (editing.selectAll) el.select()
    else el.setSelectionRange(el.value.length, el.value.length)
    // run once per editing target — NOT per keystroke (draft changes must not move the caret)
  }, [editing?.ref])

  if (!editing) return null
  const p = parseRef(editing.ref)
  if (!p) return null

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isFormula = editing.draft.trimStart().startsWith("=")
    if (e.key === "Enter") {
      e.preventDefault()
      commitEdit(e.shiftKey ? "up" : "down")
      containerRef.current?.focus({ preventScroll: true })
    } else if (e.key === "Tab") {
      e.preventDefault()
      commitEdit(e.shiftKey ? "left" : "right")
      containerRef.current?.focus({ preventScroll: true })
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
      containerRef.current?.focus({ preventScroll: true })
    } else if (e.key.startsWith("Arrow") && !isFormula) {
      // arrows commit + navigate when editing a plain value (Google behavior)
      e.preventDefault()
      const move = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right"
      commitEdit(move)
      containerRef.current?.focus({ preventScroll: true })
    }
  }

  return (
    <input
      key={editing.ref}
      ref={inputRef}
      value={editing.draft}
      onChange={(e) => updateDraft(e.target.value)}
      onKeyDown={onKey}
      aria-label={`Edit cell ${editing.ref}`}
      spellCheck={false}
      autoComplete="off"
      className="absolute z-40 rounded-none border-0 bg-background px-1.5 text-[13px] leading-none text-foreground shadow-none outline-none focus:ring-0"
      style={{
        left: HEADER_W + p.c * COL_W,
        top: ROW_H + p.r * ROW_H,
        width: COL_W,
        height: ROW_H,
        boxShadow: "0 0 0 2px var(--primary)",
      }}
    />
  )
}

/* --------------------------------- grid --------------------------------- */

export function SheetGrid({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const data = useSheetStore((s) => s.data)
  const computed = useSheetStore((s) => s.computed)
  const sel = useSheetStore((s) => s.sel)
  const active = useSheetStore((s) => s.active)
  const editingOn = useSheetStore((s) => !!s.editing)
  const clickCell = useSheetStore((s) => s.clickCell)
  const dragTo = useSheetStore((s) => s.dragTo)
  const selectAll = useSheetStore((s) => s.selectAll)
  const beginEdit = useSheetStore((s) => s.beginEdit)
  const moveActive = useSheetStore((s) => s.moveActive)
  const clearRangeValues = useSheetStore((s) => s.clearRangeValues)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const draggingRef = React.useRef(false)

  const posFromEvent = (e: { clientX: number; clientY: number }) => {
    const rect = contentRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      r: Math.floor((e.clientY - rect.top - ROW_H) / ROW_H),
      c: Math.floor((e.clientX - rect.left - HEADER_W) / COL_W),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // header clicks resolve through the DOM target (sticky overlay)
    const target = e.target as Element
    // clicks inside the in-cell editor (caret placement) must not commit/select
    if (target instanceof Element && target.closest("input")) return
    const colHeader = target.closest("[data-col-header]")
    const rowHeader = target.closest("[data-row-header]")
    if (colHeader || rowHeader) return // header buttons handle their own clicks
    if (target.closest("#sheets-corner")) {
      selectAll()
      return
    }
    const p = posFromEvent(e)
    if (!p) return
    if (p.r < 0 && p.c < 0) {
      selectAll()
      return
    }
    // clicking away commits an in-flight edit (Google behavior)
    if (useSheetStore.getState().editing) {
      useSheetStore.getState().commitEdit("none")
    }
    draggingRef.current = true
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // capture unsupported — drag still works within the container
    }
    clickCell(p.r, p.c, { shift: e.shiftKey })
    containerRef.current?.focus({ preventScroll: true })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const p = posFromEvent(e)
    if (!p) return
    if (p.r < 0 || p.c < 0) return
    dragTo(p.r, p.c)
  }

  const endDrag = () => {
    draggingRef.current = false
  }

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = posFromEvent(e)
    if (!p || p.r < 0 || p.c < 0 || p.r >= data.rows || p.c >= data.cols) return
    beginEdit(cellRef(p.r, p.c))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editingOn) return
    const { rows, cols } = data
    const mod = e.ctrlKey || e.metaKey
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault()
        moveActive(-1, 0, e.shiftKey)
        break
      case "ArrowDown":
        e.preventDefault()
        moveActive(1, 0, e.shiftKey)
        break
      case "ArrowLeft":
        e.preventDefault()
        moveActive(0, -1, e.shiftKey)
        break
      case "ArrowRight":
        e.preventDefault()
        moveActive(0, 1, e.shiftKey)
        break
      case "Tab":
        e.preventDefault()
        moveActive(0, e.shiftKey ? -1 : 1, false)
        break
      case "Enter":
        e.preventDefault()
        beginEdit(cellRef(active.r, active.c))
        break
      case "F2":
        e.preventDefault()
        beginEdit(cellRef(active.r, active.c))
        break
      case "Delete":
      case "Backspace":
        e.preventDefault()
        clearRangeValues()
        break
      case "Home":
        e.preventDefault()
        moveActive(0, -active.c, false) // row start
        break
      case "End":
        e.preventDefault()
        moveActive(0, cols - 1 - active.c, false)
        break
      default:
        if (mod && (e.key === "a" || e.key === "A")) {
          e.preventDefault()
          selectAll()
          break
        }
        if (e.key.length === 1 && !mod && !e.altKey) {
          e.preventDefault()
          beginEdit(cellRef(active.r, active.c), e.key)
        }
    }
  }

  const selW = (sel.c1 - sel.c0 + 1) * COL_W
  const selH = (sel.r1 - sel.r0 + 1) * ROW_H

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label="Spreadsheet grid"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className="slim-scroll relative min-h-0 flex-1 overflow-auto bg-background outline-none focus-visible:inset-ring-1 focus-visible:inset-ring-ring/40"
    >
      <div
        ref={contentRef}
        className="relative select-none"
        style={{ width: HEADER_W + data.cols * COL_W }}
      >
        {/* header row (sticky top) */}
        <div role="row" className="sticky top-0 z-20 flex" style={{ minWidth: HEADER_W + data.cols * COL_W }}>
          <button
            id="sheets-corner"
            type="button"
            onClick={selectAll}
            aria-label="Select all cells"
            className="sticky left-0 z-30 flex h-8 shrink-0 items-center justify-center border-0 bg-muted/95 backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
            style={{ width: HEADER_W, height: ROW_H, boxShadow: "inset -1px -1px 0 0 var(--border)" }}
          >
            <span aria-hidden className="h-2 w-2 rotate-45 border-b border-r border-muted-foreground/60" />
          </button>
          {Array.from({ length: data.cols }, (_, c) => (
            <ColHeader key={c} c={c} />
          ))}
        </div>

        {/* body */}
        <GridBody cells={data.cells} computed={computed} rows={data.rows} cols={data.cols} />

        {/* selection overlays (crisp, absolutely positioned over the content) */}
        <div
          aria-hidden
          className="pointer-events-none absolute z-[5]"
          style={{
            left: HEADER_W + sel.c0 * COL_W,
            top: ROW_H + sel.r0 * ROW_H,
            width: selW,
            height: selH,
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            boxShadow: "inset 0 0 0 1px var(--primary)",
          }}
        />
        {!editingOn && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[6]"
            style={{
              left: HEADER_W + active.c * COL_W,
              top: ROW_H + active.r * ROW_H,
              width: COL_W,
              height: ROW_H,
              boxShadow: "0 0 0 2px var(--primary)",
            }}
          >
            <span
              className="absolute -bottom-[3px] -right-[3px] h-[6px] w-[6px] border border-background"
              style={{ background: "var(--primary)" }}
            />
          </div>
        )}

        {/* in-place cell editor */}
        <CellEditorInput containerRef={containerRef} />
      </div>
    </div>
  )
}
