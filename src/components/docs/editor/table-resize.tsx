"use client"

import * as React from "react"
import { resizeTableColumn, tableColumnPixelWidth } from "@/lib/editor-dom"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

interface BoundaryView {
  index: number
  left: number
  top: number
  height: number
}

interface DragState {
  index: number
  left: number
  colWidth: number
}

interface TableResizeOverlayProps {
  pageRef: React.RefObject<HTMLDivElement | null>
  activeTable: HTMLTableElement | null
  zoom: number
  contentTick: number
  /** Fire after a resize so the editor marks the document dirty and autosaves. */
  onCommit: () => void
}

/**
 * Google-Docs-style column resizing, rendered as an overlay OUTSIDE the
 * contenteditable surface so the saved document HTML stays clean: only the
 * <colgroup> percentage widths persist (responsive + export friendly).
 *
 * Interactions:
 * - drag a boundary grabber: two adjacent columns share the table width
 * - focus a grabber + ArrowLeft/ArrowRight: nudge by 6 px (Shift: 24 px)
 */
export function TableResizeOverlay({ pageRef, activeTable, zoom, contentTick, onCommit }: TableResizeOverlayProps) {
  const [tableBox, setTableBox] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [boundaries, setBoundaries] = React.useState<BoundaryView[]>([])
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [dragTick, setDragTick] = React.useState(0)
  const { t } = useI18n()
  const lastXRef = React.useRef(0)

  /* Recompute overlay geometry from the live DOM. Re-runs after every drag
     frame (dragTick), every content change (contentTick), zoom and table switch. */
  React.useEffect(() => {
    const el = pageRef.current
    if (!el || !activeTable || !el.contains(activeTable) || activeTable.rows.length === 0) {
      setTableBox(null)
      setBoundaries([])
      return
    }
    const offX = el.offsetLeft
    const offY = el.offsetTop
    const pageRect = el.getBoundingClientRect()
    const map = (r: DOMRect) => ({
      left: (r.left - pageRect.left + offX) / zoom,
      top: (r.top - pageRect.top + offY) / zoom,
      width: r.width / zoom,
      height: r.height / zoom,
    })
    const box = map(activeTable.getBoundingClientRect())
    setTableBox(box)
    const firstRow = activeTable.rows[0]
    const views: BoundaryView[] = []
    for (let i = 0; i < firstRow.cells.length - 1; i++) {
      const r = map(firstRow.cells[i].getBoundingClientRect())
      views.push({ index: i, left: r.left + r.width, top: box.top, height: box.height })
    }
    setBoundaries(views)
    if (drag) {
      setDrag((d) => (d ? { ...d, left: views[d.index]?.left ?? d.left, colWidth: tableColumnPixelWidth(activeTable, d.index) } : d))
    }
  }, [activeTable, zoom, contentTick, dragTick, pageRef])

  const applyDelta = (index: number, dxPage: number) => {
    if (!activeTable) return
    resizeTableColumn(activeTable, index, dxPage)
    setDragTick((t) => t + 1)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (!activeTable || e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    lastXRef.current = e.clientX
    setDrag({ index, left: boundaries[index]?.left ?? 0, colWidth: tableColumnPixelWidth(activeTable, index) })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const dx = (e.clientX - lastXRef.current) / zoom
    lastXRef.current = e.clientX
    if (Math.abs(dx) > 0.1) applyDelta(drag.index, dx)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
    setDrag(null)
    onCommit()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (!activeTable) return
    const step = e.shiftKey ? 24 : 6
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      applyDelta(index, -step)
      onCommit()
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      applyDelta(index, step)
      onCommit()
    }
  }

  if (!tableBox || boundaries.length === 0) return null

  return (
    <div className="no-print pointer-events-none absolute inset-0 z-[12]">
      {/* Active table outline: quiet cue that the table is selected */}
      <div
        className="absolute rounded-[2px] border-[1.5px] border-primary/45"
        style={{ left: tableBox.left - 1, top: tableBox.top - 1, width: tableBox.width + 2, height: tableBox.height + 2 }}
      />

      {/* Column boundary grabbers */}
      {boundaries.map((b) => {
        const isDrag = drag?.index === b.index
        return (
          <div
            key={`col-boundary-${b.index}`}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("Column {n} width. Drag or use arrow keys to resize.", { n: b.index + 1 })}
            tabIndex={0}
            className="table-col-resize pointer-events-auto absolute cursor-col-resize touch-none outline-none"
            style={{ left: b.left - 6, top: b.top - 10, width: 12, height: b.height + 10 }}
            onPointerDown={(e) => onPointerDown(e, b.index)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(e) => onKeyDown(e, b.index)}
          >
            {/* grab line */}
            <span
              className={cn(
                "absolute top-0 w-[2px] rounded-full transition-[width,opacity] duration-100",
                isDrag ? "inset-y-0 bg-primary opacity-100" : "top-[9px] h-[calc(100%-9px)] bg-primary/50 opacity-80",
              )}
              style={{ left: 5 }}
            />
            {/* grabber cap (sits above the table like Google Docs) */}
            <span
              className={cn(
                "absolute left-[-1px] top-[-2px] flex h-[12px] w-[14px] items-center justify-center rounded-[3px] border bg-card transition-colors duration-100",
                isDrag ? "border-primary elev-1" : "border-border",
              )}
            >
              <span className={cn("h-[6px] w-[2px] rounded-full transition-colors", isDrag ? "bg-primary" : "bg-foreground/30")} />
            </span>
            {/* live width tooltip while dragging */}
            {isDrag && (
              <span
                className="bg-foreground text-background absolute top-[-30px] left-[7px] rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums whitespace-nowrap"
                style={{ transform: "translateX(-50%)" }}
              >
                {t("{n} px", { n: Math.round(drag.colWidth) })}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
