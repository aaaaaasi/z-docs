"use client"

import * as React from "react"
import { useI18n } from "@/lib/i18n"

export interface PageMargins {
  left: number
  right: number
}

export const DEFAULT_MARGINS: PageMargins = { left: 96, right: 96 }
const SNAP = 12 // 1/8"
const MIN_MARGIN = 48 // 0.5"
const MAX_MARGIN = 336 // 3.5"

function clampSnap(v: number): number {
  return Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.round(v / SNAP) * SNAP))
}

/**
 * Horizontal page ruler — the iconic Google Docs strip above the document.
 * Inch ticks with 1/8" subdivisions, hatched margin zones, and DRAGGABLE
 * margin handles (pointer + keyboard, 1/8" snapping, double-click resets).
 * Sits inside the zoom wrapper so it scales with the page, never prints.
 */
export function DocRuler({
  pageWidth = 816,
  margins = DEFAULT_MARGINS,
  zoom = 1,
  onMarginsChange,
  onDragChange,
}: {
  pageWidth?: number
  margins?: PageMargins
  zoom?: number
  onMarginsChange?: (m: PageMargins) => void
  onDragChange?: (side: "left" | "right" | null) => void
}) {
  const PX_PER_IN = 96
  const inches = pageWidth / PX_PER_IN // 8.5 for Letter

  const [dragging, setDragging] = React.useState<"left" | "right" | null>(null)
  const [tip, setTip] = React.useState<{ x: number; text: string } | null>(null)
  const { t } = useI18n()
  const handleRef = React.useRef<HTMLButtonElement | null>(null)
  const startRef = React.useRef({ clientX: 0, margin: 96 })

  const startDrag = (e: React.PointerEvent, side: "left" | "right") => {
    e.preventDefault()
    handleRef.current = e.currentTarget as HTMLButtonElement
    try {
      handleRef.current.setPointerCapture(e.pointerId)
    } catch {
      // synthetic / detached pointer — drag still works via bubbling events
    }
    startRef.current = { clientX: e.clientX, margin: side === "left" ? margins.left : margins.right }
    setDragging(side)
    onDragChange?.(side)
  }

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const rawDelta = (e.clientX - startRef.current.clientX) / Math.max(zoom, 0.1)
    let next = clampSnap(startRef.current.margin + rawDelta * (dragging === "right" ? -1 : 1))
    // keep at least 1.5" of content between the margins
    if (dragging === "left") next = Math.min(next, pageWidth - MIN_MARGIN - margins.right)
    else next = Math.min(next, pageWidth - MIN_MARGIN - margins.left)
    const m = dragging === "left" ? { ...margins, left: next } : { ...margins, right: next }
    onMarginsChange?.(m)
    const handleX = dragging === "left" ? m.left : pageWidth - m.right
    setTip({ x: handleX, text: t("{v} in", { v: (next / PX_PER_IN).toFixed(2) }) })
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return
    try {
      handleRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
    handleRef.current = null
    setDragging(null)
    setTip(null)
    onDragChange?.(null)
  }

  const nudge = (side: "left" | "right", dir: 1 | -1) => {
    const current = side === "left" ? margins.left : margins.right
    const next = Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, current + dir * SNAP))
    onMarginsChange?.(side === "left" ? { ...margins, left: next } : { ...margins, right: next })
  }

  const reset = (side: "left" | "right") => {
    onMarginsChange?.(side === "left" ? { ...margins, left: 96 } : { ...margins, right: 96 })
  }

  const ticks: React.ReactNode[] = []
  for (let i = 0; i * 12 <= pageWidth; i++) {
    const x = i * 12 // every 1/8"
    const fromInch = i % 8
    const isInch = fromInch === 0
    const isHalf = fromInch === 4
    const isQuarter = fromInch % 2 === 0
    const h = isInch ? 12 : isHalf ? 9 : isQuarter ? 6 : 4
    if (isInch && i > 0 && i / 8 < inches) {
      ticks.push(
        <span
          key={`t${i}`}
          className="doc-ruler-label"
          style={{ left: x - 3 }}
          aria-hidden
        >
          {i / 8}
        </span>
      )
    }
    ticks.push(
      <span
        key={`k${i}`}
        className="doc-ruler-tick"
        style={{ left: x, height: h }}
        aria-hidden
      />
    )
  }

  const dragHandlers: React.HTMLAttributes<HTMLButtonElement> = dragging
    ? { onPointerMove: onDragMove, onPointerUp: endDrag, onPointerCancel: endDrag }
    : {}

  return (
    <div
      className="no-print doc-ruler mx-auto flex h-[26px] items-end"
      role="img"
      aria-label={t("Page ruler — letter size, left margin {left} inches, right margin {right} inches. Drag the triangle handles to adjust.", { left: (margins.left / PX_PER_IN).toFixed(2), right: (margins.right / PX_PER_IN).toFixed(2) })}
    >
      {/* left margin zone */}
      <div className="doc-ruler-margin" style={{ width: margins.left }} title={t("Left margin: {v} in", { v: (margins.left / PX_PER_IN).toFixed(2) })} />
      <div className="doc-ruler-track relative flex-1">
        {ticks}
        <span className="doc-ruler-edge" style={{ left: 0 }} aria-hidden />
        <span className="doc-ruler-edge" style={{ right: 0 }} aria-hidden />
      </div>
      {/* right margin zone */}
      <div className="doc-ruler-margin" style={{ width: margins.right }} title={t("Right margin: {v} in", { v: (margins.right / PX_PER_IN).toFixed(2) })} />

      {/* margin drag handles */}
      <button
        type="button"
        aria-label={t("Left margin — {v} inches. Drag or use arrow keys to adjust.", { v: (margins.left / PX_PER_IN).toFixed(2) })}
        role="slider"
        aria-valuemin={MIN_MARGIN / PX_PER_IN}
        aria-valuemax={MAX_MARGIN / PX_PER_IN}
        aria-valuenow={Math.round((margins.left / PX_PER_IN) * 100) / 100}
        aria-valuetext={t("{v} inches", { v: (margins.left / PX_PER_IN).toFixed(2) })}
        className="doc-ruler-handle"
        style={{ left: margins.left }}
        data-dragging={dragging === "left"}
        onPointerDown={(e) => startDrag(e, "left")}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); nudge("left", -1) }
          if (e.key === "ArrowRight") { e.preventDefault(); nudge("left", 1) }
        }}
        onDoubleClick={() => reset("left")}
        title={t("Drag to change the left margin (double-click to reset)")}
        {...dragHandlers}
      />
      <button
        type="button"
        aria-label={t("Right margin — {v} inches. Drag or use arrow keys to adjust.", { v: (margins.right / PX_PER_IN).toFixed(2) })}
        role="slider"
        aria-valuemin={MIN_MARGIN / PX_PER_IN}
        aria-valuemax={MAX_MARGIN / PX_PER_IN}
        aria-valuenow={Math.round((margins.right / PX_PER_IN) * 100) / 100}
        aria-valuetext={t("{v} inches", { v: (margins.right / PX_PER_IN).toFixed(2) })}
        className="doc-ruler-handle"
        style={{ left: pageWidth - margins.right }}
        data-dragging={dragging === "right"}
        onPointerDown={(e) => startDrag(e, "right")}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); nudge("right", -1) }
          if (e.key === "ArrowRight") { e.preventDefault(); nudge("right", 1) }
        }}
        onDoubleClick={() => reset("right")}
        title={t("Drag to change the right margin (double-click to reset)")}
        {...dragHandlers}
      />

      {/* live value tooltip while dragging */}
      {tip && <span className="doc-ruler-tip" style={{ left: tip.x }}>{tip.text}</span>}
    </div>
  )
}
