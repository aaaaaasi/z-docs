"use client"

/**
 * Z-Slides — editor shell: top bar (back, inline-renamable title, star,
 * save status, theme controls, layout picker, notes toggle, Present),
 * thumbnail rail, canvas and the collapsible speaker-notes panel.
 * Autosaves 900ms after any change (PATCH), with Ctrl+Z undo, PageUp/Down
 * & arrow slide switching and Ctrl+Enter to present.
 *
 * Responsive top bar:
 *  • ≥1024: full controls incl. the textual SaveStatus pill.
 *  • 768–1024: ThemeControls collapse into a "⋮" design popover; save
 *    feedback shrinks to a 6px status dot.
 *  • <768: additionally star / speaker notes / layout / PPTX export move
 *    into the same "⋮" popover (44px rows), and the slide rail becomes a
 *    bottom filmstrip (see slide-rail.tsx).
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n"
import { trackedDownload } from "@/store/export-progress-store"
import { LangToggle } from "@/components/docs/lang-toggle"
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  LayoutTemplate,
  Loader2,
  MoreVertical,
  Play,
  Star,
  StickyNote,
  X,
} from "lucide-react"
import { useSlidesStore } from "./deck-store"
import { SlideRail } from "./slide-rail"
import { SlideCanvas } from "./slide-canvas"
import { AccentSwatches, ThemeControls, ThemeFontToggle } from "./theme-controls"
import { LayoutGrid, LayoutPickerPopover } from "./layout-picker"
import { cn } from "@/lib/utils"

function SaveStatus() {
  const status = useSlidesStore((s) => s.saveStatus)
  const saveNow = useSlidesStore((s) => s.saveNow)
  const { t } = useI18n()

  if (status === "error") {
    return (
      <>
        {/* <1024: compact retry affordance */}
        <button
          type="button"
          onClick={() => void saveNow()}
          aria-label={t("Couldn’t save — retry")}
          title={t("Couldn’t save — retry")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-destructive outline-none transition-colors hover:bg-destructive/10 lg:hidden"
        >
          <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void saveNow()}
          className="hidden h-8 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-3 text-[13px] text-destructive outline-none transition-colors hover:bg-destructive/10 lg:flex"
        >
          <CloudOff className="h-3.5 w-3.5" />
          {t("Couldn’t save — retry")}
        </button>
      </>
    )
  }

  const busy = status === "pending" || status === "saving"
  const label = busy ? t("Saving…") : t("All changes saved")
  return (
    <>
      {/* <1024: 6px status dot — amber pulsing while saving, green when saved */}
      <span
        role="status"
        aria-live="polite"
        aria-label={label}
        title={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center lg:hidden"
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            busy ? "animate-pulse bg-amber-500" : "bg-primary"
          )}
        />
      </span>
      <div
        className="hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted-foreground lg:flex"
        role="status"
        aria-live="polite"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>{t("Saving…")}</span>
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>{t("All changes saved")}</span>
          </>
        )}
      </div>
    </>
  )
}

function NotesPanel({ onClose }: { onClose: () => void }) {
  const data = useSlidesStore((s) => s.data)
  const currentSlideId = useSlidesStore((s) => s.currentSlideId)
  const updateSlideNotes = useSlidesStore((s) => s.updateSlideNotes)
  const { t } = useI18n()

  const slides = data?.slides ?? []
  const idx = slides.findIndex((s) => s.id === currentSlideId)
  const slide = idx >= 0 ? slides[idx] : null

  return (
    <div className="flex h-40 shrink-0 flex-col border-t bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <StickyNote className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-[13px] font-medium">{t("Speaker notes")}</p>
        <span className="tnum text-xs text-muted-foreground">
          {t("Slide {n} of {total}", { n: idx + 1, total: slides.length })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("Close speaker notes")}
          className="ml-auto h-8 w-8 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {slide ? (
        <Textarea
          value={slide.notes ?? ""}
          onChange={(e) => updateSlideNotes(slide.id, e.target.value)}
          placeholder={t("Notes for slide {n}…", { n: idx + 1 })}
          aria-label={t("Notes for slide {n}", { n: idx + 1 })}
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm shadow-none outline-none focus-visible:ring-0 dark:bg-transparent"
        />
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">{t("No slide selected.")}</p>
      )}
    </div>
  )
}

/** 44px-tall action row used inside the mobile (⌄ <768) overflow popover. */
function PanelRow({
  icon,
  label,
  onClick,
  disabled,
  pressed,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}

export function DeckEditor({
  onBack,
  onPresent,
}: {
  onBack: () => void
  onPresent: (startIndex: number) => void
}) {
  const title = useSlidesStore((s) => s.title)
  const deckStarred = useSlidesStore((s) => s.deckStarred)
  const data = useSlidesStore((s) => s.data)
  const currentSlideId = useSlidesStore((s) => s.currentSlideId)
  const renameOpenDeck = useSlidesStore((s) => s.renameOpenDeck)
  const toggleOpenDeckStar = useSlidesStore((s) => s.toggleOpenDeckStar)
  const setSlideLayout = useSlidesStore((s) => s.setSlideLayout)
  const moveSelection = useSlidesStore((s) => s.moveSelection)
  const undo = useSlidesStore((s) => s.undo)
  const { t } = useI18n()
  const { toast } = useToast()

  const [titleEditing, setTitleEditing] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState("")
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)

  const slides = data?.slides ?? []
  const currentLayout =
    slides.find((s) => s.id === currentSlideId)?.layout ?? slides[0]?.layout
  const currentIndex = Math.max(
    slides.findIndex((s) => s.id === currentSlideId),
    0
  )

  const present = React.useCallback(() => {
    if (slides.length === 0) return
    onPresent(currentIndex)
  }, [slides.length, onPresent, currentIndex])

  /** Client-side PPTX export (pptxgenjs loaded on demand). */
  const onExportPptx = React.useCallback(async () => {
    if (!data || data.slides.length === 0) return
    setExporting(true)
    const tracker = trackedDownload({
      kind: "pptx",
      title,
      fileName: `${(title.trim() || "presentation").replace(/[\\/:*?"<>|]/g, "_").slice(0, 100)}.pptx`,
    })
    try {
      const { exportDeckToPptx } = await import("@/lib/slides-pptx")
      const name = await exportDeckToPptx(title, data, (percent) => {
        tracker.tick({
          phase: "render",
          percent,
          note: t("Slide {i} of {n}", { i: Math.max(1, Math.round((percent / 90) * data.slides.length)), n: data.slides.length }),
        })
      })
      tracker.finish(true)
      toast({ description: t("Downloaded {name}", { name }) })
    } catch {
      tracker.finish(false)
      toast({ description: t("Export failed — try again"), variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }, [data, title, t, toast])

  // keyboard shortcuts (editor level)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        present()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (typing) return // let the browser undo text edits natively
        e.preventDefault()
        undo()
        return
      }
      if (typing) return
      if (e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault()
        moveSelection(1)
      } else if (e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault()
        moveSelection(-1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [present, undo, moveSelection])

  const commitTitle = () => {
    if (!titleEditing) return
    const v = titleDraft.trim()
    setTitleEditing(false)
    if (v && v !== title) void renameOpenDeck(v)
  }

  const applyLayoutToCurrent = (layout: Parameters<typeof setSlideLayout>[1]) => {
    const id = currentSlideId ?? slides[0]?.id
    if (id) setSlideLayout(id, layout)
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b px-2 sm:px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label={t("Back to presentations")}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("Back to presentations")}
          </TooltipContent>
        </Tooltip>

        {titleEditing ? (
          <Input
            autoFocus
            value={titleDraft}
            maxLength={120}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle()
              else if (e.key === "Escape") setTitleEditing(false)
            }}
            onBlur={commitTitle}
            aria-label={t("Presentation title")}
            className="h-9 w-44 min-w-0 rounded-md text-[15px] font-medium sm:w-64 lg:w-80"
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(title)
                  setTitleEditing(true)
                }}
                aria-label={t("Rename presentation")}
                className="min-w-0 max-w-[180px] truncate rounded-md px-2 py-1.5 text-[15px] font-medium outline-none transition-colors hover:bg-accent focus-visible:bg-accent sm:max-w-[320px] lg:max-w-[440px]"
              >
                {title}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("Rename presentation")}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void toggleOpenDeckStar()}
              aria-label={deckStarred ? t("Remove star") : t("Add star")}
              aria-pressed={deckStarred}
              className="hidden h-9 w-9 shrink-0 rounded-full sm:inline-flex"
            >
              <Star
                className={cn(
                  "h-4.5 w-4.5",
                  deckStarred && "fill-amber-400 text-amber-400"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {deckStarred ? t("Remove star") : t("Add star")}
          </TooltipContent>
        </Tooltip>

        <div className="ml-1 flex">
          <SaveStatus />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <LangToggle />
          <div className="hidden md:flex">
            <ThemeControls />
          </div>

          <div className="hidden sm:block">
            <LayoutPickerPopover
              title={t("Change layout")}
              current={currentLayout}
              onPick={(layout) => applyLayoutToCurrent(layout)}
              trigger={
                <Button
                  variant="ghost"
                  aria-label={t("Change slide layout")}
                  className="h-9 gap-1.5 rounded-full px-3 text-[13px]"
                >
                  <LayoutTemplate className="h-4 w-4" />
                  {t("Layout")}
                </Button>
              }
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotesOpen((o) => !o)}
                aria-label={t("Toggle speaker notes")}
                aria-pressed={notesOpen}
                className={cn(
                  "hidden h-9 w-9 rounded-full sm:inline-flex",
                  notesOpen && "bg-accent text-accent-foreground"
                )}
              >
                <StickyNote className="h-4.5 w-4.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("Speaker notes")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => void onExportPptx()}
                disabled={exporting || slides.length === 0}
                aria-label={t("Export PPTX")}
                className="hidden h-9 gap-1.5 rounded-full px-3 text-[13px] sm:inline-flex"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{t("Export PPTX")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("Export as PowerPoint (.pptx)")}
            </TooltipContent>
          </Tooltip>

          {/* <768 overflow: design (theme color & font on all sizes below md)
              plus star / speaker notes / layout / export rows on phones. */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("More actions")}
                className="h-9 w-9 rounded-full md:hidden"
              >
                <MoreVertical className="h-4.5 w-4.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <div className="flex flex-col gap-0.5 sm:hidden">
                <PanelRow
                  icon={
                    <Star
                      className={cn(
                        "h-4.5 w-4.5",
                        deckStarred && "fill-amber-400 text-amber-400"
                      )}
                    />
                  }
                  label={deckStarred ? t("Remove star") : t("Add star")}
                  pressed={deckStarred}
                  onClick={() => void toggleOpenDeckStar()}
                />
                <PanelRow
                  icon={<StickyNote className="h-4.5 w-4.5" />}
                  label={t("Speaker notes")}
                  pressed={notesOpen}
                  onClick={() => {
                    setNotesOpen((o) => !o)
                    setMoreOpen(false)
                  }}
                />
                <PanelRow
                  icon={
                    exporting ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4.5 w-4.5" />
                    )
                  }
                  label={t("Export PPTX")}
                  disabled={exporting || slides.length === 0}
                  onClick={() => {
                    void onExportPptx()
                    setMoreOpen(false)
                  }}
                />
              </div>

              <p className="mt-2 text-[13px] font-medium sm:mt-0">{t("Design")}</p>
              <p className="mt-3 text-[12px] font-medium text-muted-foreground">
                {t("Theme color")}
              </p>
              <div className="mt-2">
                <AccentSwatches />
              </div>
              <p className="mt-3 text-[12px] font-medium text-muted-foreground">
                {t("Theme font")}
              </p>
              <div className="mt-2">
                <ThemeFontToggle />
              </div>

              <div className="sm:hidden">
                <p className="mt-3 text-[12px] font-medium text-muted-foreground">
                  {t("Change layout")}
                </p>
                <div className="mt-2">
                  <LayoutGrid current={currentLayout} onPick={(layout) => applyLayoutToCurrent(layout)} />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={present}
                disabled={slides.length === 0}
                aria-label={t("Present from current slide")}
                className="h-9 gap-1.5 rounded-full px-4 text-[13px]"
              >
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">{t("Present")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("Present from this slide (Ctrl+Enter)")}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SlideRail />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SlideCanvas />
          {notesOpen && <NotesPanel onClose={() => setNotesOpen(false)} />}
        </div>
      </div>
    </div>
  )
}
