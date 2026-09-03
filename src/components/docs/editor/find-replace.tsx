"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Google-Docs-style floating find & replace panel.
 * Presentational only — match state lives in editor-view, which also
 * renders the highlight overlay inside the document canvas.
 */
export interface FindReplacePanelProps {
  open: boolean
  replaceMode: boolean
  query: string
  caseSensitive: boolean
  matchCount: number
  activeIndex: number
  /** comments sidebar is open — slide left so the page text stays visible */
  commentsOpen: boolean
  onQueryChange: (q: string) => void
  onCaseToggle: () => void
  onToggleReplaceMode: () => void
  onNext: () => void
  onPrev: () => void
  onReplace: (replacement: string) => void
  onReplaceAll: (replacement: string) => void
  onClose: () => void
}

export function FindReplacePanel({
  open,
  replaceMode,
  query,
  caseSensitive,
  matchCount,
  activeIndex,
  commentsOpen,
  onQueryChange,
  onCaseToggle,
  onToggleReplaceMode,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplacePanelProps) {
  const [replacement, setReplacement] = React.useState("")
  const findRef = React.useRef<HTMLInputElement>(null)
  const replaceRef = React.useRef<HTMLInputElement>(null)

  // Focus the find field whenever the panel opens
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => findRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    setReplacement("")
  }, [open])

  if (!open) return null

  const hasQuery = query.length > 0
  const noResults = hasQuery && matchCount === 0
  const counter = hasQuery ? `${noResults ? 0 : activeIndex + 1} of ${matchCount}` : ""

  const iconBtn =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

  return (
    <div
      role="dialog"
      aria-label="Find and replace"
      className={cn(
        "no-print elev-1 animate-fade-in absolute top-2 z-20 w-[320px] rounded-lg border bg-background p-2.5",
        "transition-[right] duration-200",
        "max-lg:left-2 max-lg:w-[calc(100%-1rem)]",
        commentsOpen ? "hidden lg:block lg:right-[352px]" : "right-2"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={iconBtn}
          aria-label={replaceMode ? "Hide replace field" : "Show replace field"}
          aria-expanded={replaceMode}
          onClick={onToggleReplaceMode}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", replaceMode && "rotate-180")}
            strokeWidth={1.75}
          />
        </button>
        <input
          ref={findRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (e.shiftKey) {
                onPrev()
              } else {
                onNext()
              }
            } else if (e.key === "Escape") {
              e.preventDefault()
              onClose()
            }
          }}
          placeholder="Find"
          aria-label="Find in document"
          className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
        />
        <span
          className={cn(
            "tnum w-14 shrink-0 text-right text-xs",
            noResults ? "text-destructive" : "text-muted-foreground"
          )}
          aria-live="polite"
          aria-atomic="true"
          title={noResults ? "No results found" : undefined}
        >
          {noResults ? "No results" : counter}
        </span>
        <button
          type="button"
          className={iconBtn}
          aria-label="Match case"
          aria-pressed={caseSensitive}
          onClick={onCaseToggle}
        >
          <span
            className={cn(
              "text-[11px] font-semibold tracking-tight",
              caseSensitive && "text-foreground"
            )}
          >
            Aa
          </span>
        </button>
        <button type="button" className={iconBtn} aria-label="Previous match" onClick={onPrev}>
          <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" className={iconBtn} aria-label="Next match" onClick={onNext}>
          <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" className={iconBtn} aria-label="Close find bar" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {replaceMode && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            ref={replaceRef}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                onReplace(replacement)
                requestAnimationFrame(() => replaceRef.current?.focus())
              } else if (e.key === "Escape") {
                e.preventDefault()
                onClose()
              }
            }}
            placeholder="Replace with"
            aria-label="Replace with"
            className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
          />
          <button
            type="button"
            disabled={!hasQuery || matchCount === 0}
            onClick={() => {
              onReplace(replacement)
              requestAnimationFrame(() => replaceRef.current?.focus())
            }}
            className="h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Replace
          </button>
          <button
            type="button"
            disabled={!hasQuery || matchCount === 0}
            onClick={() => {
              onReplaceAll(replacement)
              requestAnimationFrame(() => replaceRef.current?.focus())
            }}
            className="h-8 shrink-0 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Replace all
          </button>
        </div>
      )}
    </div>
  )
}
