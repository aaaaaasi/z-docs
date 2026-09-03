"use client"

import * as React from "react"
import { MessageSquareMore } from "lucide-react"
import type { RemoteCursor, CommentDTO } from "@/lib/docs-types"
import { rangeFromOffsets, selectionOffsets, setSelectionFromOffsets, findQuoteRange } from "@/lib/editor-dom"
import { cn } from "@/lib/utils"

interface CaretView {
  key: string
  user: { id: string; name: string; color: string }
  type: "caret" | "sel"
  left: number
  top: number
  width: number
  height: number
}

interface CommentHighlightView {
  key: string
  id: string
  rects: { left: number; top: number; width: number; height: number }[]
  marker: { left: number; top: number; height: number }
  color: string
  count: number
  active: boolean
  anchored: boolean
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
  comments?: CommentDTO[]
  activeCommentId?: string | null
  contentTick?: number
  onCommentClick?: (id: string) => void
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
  comments = [],
  activeCommentId = null,
  contentTick = 0,
  onCommentClick,
}: EditorCanvasProps) {
  const [dims, setDims] = React.useState({ w: 816, h: 1056 })
  const [caretViews, setCaretViews] = React.useState<CaretView[]>([])
  const [highlightViews, setHighlightViews] = React.useState<CommentHighlightView[]>([])

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
    // the page's real offset inside the (transformed) wrapper — margins included
    const offX = el.offsetLeft
    const offY = el.offsetTop
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
              left: (r.left - pageRect.left + offX) / zoom,
              top: (r.top - pageRect.top + offY) / zoom,
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
          left: (caretRect.left - pageRect.left + offX) / zoom,
          top: (caretRect.top - pageRect.top + offY) / zoom,
          width: 2,
          height: Math.max(caretRect.height / zoom, 14),
        })
      } catch {
        // offsets drifted — skip silently
      }
    }
    setCaretViews(views)
  }, [remoteCursors, zoom])

  // Render comment highlight overlays for unresolved threads anchored to
  // text that still exists in the document.
  React.useEffect(() => {
    const el = pageRef.current
    if (!el || comments.length === 0) {
      setHighlightViews([])
      return
    }
    const pageRect = el.getBoundingClientRect()
    const offX = el.offsetLeft
    const offY = el.offsetTop
    const views: CommentHighlightView[] = []
    for (const c of comments) {
      if (c.resolved || !c.quote) continue
      const found = findQuoteRange(el, c.quote, c.anchorOffset)
      if (!found) continue
      try {
        const rects = Array.from(found.range.getClientRects())
        if (rects.length === 0) continue
        const views2 = rects.map((r) => ({
          left: (r.left - pageRect.left + offX) / zoom,
          top: (r.top - pageRect.top + offY) / zoom,
          width: Math.max(r.width / zoom, 2),
          height: r.height / zoom,
        }))
        const last = views2[views2.length - 1]
        views.push({
          key: c.id,
          id: c.id,
          rects: views2,
          marker: { left: last.left + last.width, top: last.top, height: last.height },
          color: c.authorColor,
          count: 1 + (c.replies?.length ?? 0),
          active: activeCommentId === c.id,
          anchored: true,
        })
      } catch {
        // quote range invalid — skip
      }
    }
    setHighlightViews(views)
  }, [comments, activeCommentId, zoom, contentTick, remoteContent])

  const padX = 40
  const padY = 40
  // .doc-page also contributes margin-top 40 + margin-bottom 80 inside the wrapper
  const bottomPad = 120

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
                    left: v.left,
                    top: v.top,
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
                    left: v.left,
                    top: v.top,
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

          {/* Comment highlights overlay */}
          <div className="no-print pointer-events-none absolute inset-0 z-[9]">
            {highlightViews.map((h) =>
              h.rects.map((r, i) => (
                <div
                  key={`${h.key}-hl-${i}`}
                  className={cn(
                    "comment-highlight absolute rounded-[2px] transition-colors",
                    h.active && "comment-highlight-active"
                  )}
                  style={{
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                    ...(h.active ? { backgroundColor: h.color + "40" } : undefined),
                  }}
                  data-comment-hl={h.id}
                />
              ))
            )}
          </div>

          {/* Comment markers (clickable) */}
          <div className="no-print absolute inset-0 z-[11]">
            {highlightViews.map((h) => (
              <button
                key={`${h.key}-marker`}
                role="button"
                aria-label={`Open comment thread (${h.count} ${h.count === 1 ? "message" : "messages"})`}
                data-comment-marker={h.id}
                className="comment-marker"
                style={{
                  left: h.marker.left + 4,
                  top: h.marker.top,
                  height: Math.min(h.marker.height, 22),
                  backgroundColor: h.color,
                }}
                onClick={() => onCommentClick?.(h.id)}
              >
                <MessageSquareMore className="h-3 w-3" />
                {h.count > 1 && <span className="text-[10px] font-semibold tabular-nums">{h.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
