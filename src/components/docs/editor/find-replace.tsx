"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

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
  /** insights rail is open (same right column) — mirror the comments offset */
  insightsOpen?: boolean
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
  insightsOpen = false,
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
  const { t } = useI18n()

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
  const counter = hasQuery ? t("{n} of {total}", { n: noResults ? 0 : activeIndex + 1, total: matchCount }) : ""

  const iconBtn =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

  return (
    <div
      role="dialog"
      aria-label={t("Find and replace")}
      className={cn(
        "no-print elev-2 animate-fade-in absolute top-2 z-20 w-[320px] rounded-lg border bg-background/95 p-2.5 backdrop-blur-md",
        "transition-[right] duration-200",
        // <lg the rails are overlays — keep the find panel usable ON TOP of
        // them (previously it was hidden entirely while comments was open,
        // making search unreachable on mobile/tablet).
        "max-lg:left-2 max-lg:z-40 max-lg:w-[calc(100%-1rem)]",
        commentsOpen
          ? "lg:right-[352px]"
          : insightsOpen
            ? "lg:right-[304px]"
            : "right-2"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={iconBtn}
          aria-label={replaceMode ? t("Hide replace field") : t("Show replace field")}
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
          placeholder={t("Find")}
          aria-label={t("Find in document")}
          className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(11,107,98,0.1)]"
        />
        <span
          className={cn(
            "tnum w-14 shrink-0 text-right text-xs",
            noResults ? "text-destructive" : "text-muted-foreground"
          )}
          aria-live="polite"
          aria-atomic="true"
          title={noResults ? t("No results found") : undefined}
        >
          {noResults ? t("No results") : counter}
        </span>
        <button
          type="button"
          className={iconBtn}
          aria-label={t("Match case")}
          title={t("Match case")}
          aria-pressed={caseSensitive}
          onClick={onCaseToggle}
        >
          <span
            className={cn(
              "text-[11px] font-semibold tracking-tight transition-colors",
              caseSensitive && "text-foreground"
            )}
          >
            Aa
          </span>
        </button>
        <button type="button" className={iconBtn} aria-label={t("Previous match")} onClick={onPrev}>
          <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" className={iconBtn} aria-label={t("Next match")} onClick={onNext}>
          <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" className={iconBtn} aria-label={t("Close find bar")} onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {replaceMode && (
        <div className="animate-in fade-in-0 slide-in-from-top-1 mt-1.5 flex items-center gap-1.5 duration-150">
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
            placeholder={t("Replace with")}
            aria-label={t("Replace with")}
            className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(11,107,98,0.1)]"
          />
          <button
            type="button"
            disabled={!hasQuery || matchCount === 0}
            onClick={() => {
              onReplace(replacement)
              requestAnimationFrame(() => replaceRef.current?.focus())
            }}
            className="h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium text-foreground transition-all hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {t("Replace")}
          </button>
          <button
            type="button"
            disabled={!hasQuery || matchCount === 0}
            onClick={() => {
              onReplaceAll(replacement)
              requestAnimationFrame(() => replaceRef.current?.focus())
            }}
            className="h-8 shrink-0 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {t("Replace all")}
          </button>
        </div>
      )}
    </div>
  )
}
