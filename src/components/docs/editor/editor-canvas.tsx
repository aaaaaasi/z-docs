"use client"

import * as React from "react"
import type { RemoteCursor } from "@/lib/docs-types"
import { rangeFromOffsets, selectionOffsets, setSelectionFromOffsets } from "@/lib/editor-dom"

interface CaretView {
  key: string
  user: { id: string; name: string; color: string }
  type: "caret" | "sel"
  left: number
  top: number
  width: number
  height: number
}

interface EditorCanvasProps {
  pageRef: React.RefObject<HTMLDivElement | null>
  initialContent: string
  remoteContent: string | null
  onRemoteApplied: () => void
  onInput: () => void
  spellCheck: boolean
  zoom: number
  remoteCursors: Record<string, RemoteCursor>
  emptyPlaceholder?: string
}

export function EditorCanvas({
  pageRef,
  initialContent,
  remoteContent,
  onRemoteApplied,
  onInput,
  spellCheck,
  zoom,
  remoteCursors,
  emptyPlaceholder = "Start writing…",
}: EditorCanvasProps) {
  const [dims, setDims] = React.useState({ w: 816, h: 1056 })
  const [caretViews, setCaretViews] = React.useState<CaretView[]>([])

  // Mount: set initial content & editor defaults
  React.useEffect(() => {
    const el = pageRef.current
    if (!el) return
    el.innerHTML = initialContent
    try {
      document.execCommand("styleWithCSS", false, "true")
      document.execCommand("defaultParagraphSeparator", false, "p")
    } catch {
      // older browsers
    }
  }, [])

  // Apply remote content (preserving local caret when possible)
  React.useEffect(() => {
    const el = pageRef.current
    if (!el || remoteContent == null) return
    if (el.innerHTML === remoteContent) {
      onRemoteApplied()
      return
    }
    const caret = selectionOffsets(el)
    el.innerHTML = remoteContent
    if (caret) setSelectionFromOffsets(el, caret)
    onRemoteApplied()
  }, [remoteContent])

  // Track page dimensions for the zoom wrapper
  React.useEffect(() => {
    const el = pageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    setDims({ w: el.offsetWidth, h: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  // Render remote cursors whenever they update
  React.useEffect(() => {
    const el = pageRef.current
    if (!el || Object.keys(remoteCursors).length === 0) {
      setCaretViews([])
      return
    }
    const views: CaretView[] = []
    const pageRect = el.getBoundingClientRect()
    for (const c of Object.values(remoteCursors)) {
      try {
        const range = rangeFromOffsets(el, c.start, c.end)
        if (!range) continue
        if (c.start !== c.end) {
          const rects = Array.from(range.getClientRects())
          rects.forEach((r, i) => {
            views.push({
              key: `${c.user.id}-sel-${i}`,
              user: c.user,
              type: "sel",
              left: (r.left - pageRect.left) / zoom,
              top: (r.top - pageRect.top) / zoom,
              width: Math.max(r.width / zoom, 2),
              height: r.height / zoom,
            })
          })
        }
        // caret marker at the end of the selection
        const caretRect =
          c.start !== c.end
            ? Array.from(range.getClientRects()).pop() ?? range.getBoundingClientRect()
            : range.getBoundingClientRect()
        views.push({
          key: `${c.user.id}-caret`,
          user: c.user,
          type: "caret",
          left: (caretRect.left - pageRect.left) / zoom,
          top: (caretRect.top - pageRect.top) / zoom,
          width: 2,
          height: Math.max(caretRect.height / zoom, 14),
        })
      } catch {
        // offsets drifted — skip silently
      }
    }
    setCaretViews(views)
  }, [remoteCursors, zoom])

  const padX = 40
  const padY = 40
  const bottomPad = 100

  return (
    <div
      className="print-reset doc-canvas-bg slim-scroll flex-1 overflow-auto"
      data-zoom={zoom}
      role="region"
      aria-label="Document canvas"
    >
      <div
        className="mx-auto"
        style={{ width: (dims.w + padX * 2) * zoom, height: (dims.h + padY + bottomPad) * zoom }}
      >
        <div
          className="relative"
          style={{ width: dims.w + padX * 2, transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          <div className="px-10 pt-10">
            <div
              ref={pageRef}
              className="doc-page doc-content"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Document body"
              spellCheck={spellCheck}
              data-placeholder={emptyPlaceholder}
              onInput={onInput}
            />
          </div>

          {/* Remote cursors overlay */}
          <div className="no-print pointer-events-none absolute inset-0 z-10">
            {caretViews.map((v) =>
              v.type === "sel" ? (
                <div
                  key={v.key}
                  className="absolute rounded-[1px]"
                  style={{
                    left: padX + v.left,
                    top: padY + v.top,
                    width: v.width,
                    height: v.height,
                    backgroundColor: v.user.color + "33",
                    mixBlendMode: "multiply",
                  }}
                />
              ) : (
                <div
                  key={v.key}
                  className="remote-caret blinking absolute"
                  style={{
                    left: padX + v.left,
                    top: padY + v.top,
                    height: v.height,
                    backgroundColor: v.user.color,
                  }}
                >
                  <span
                    className="remote-caret-label"
                    style={{ backgroundColor: v.user.color }}
                  >
                    {v.user.name}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
