"use client"

/**
 * Z-Slides — editor shell: top bar (back, inline-renamable title, star,
 * save status, theme controls, layout picker, notes toggle, Present),
 * thumbnail rail, canvas and the collapsible speaker-notes panel.
 * Autosaves 900ms after any change (PATCH), with Ctrl+Z undo, PageUp/Down
 * & arrow slide switching and Ctrl+Enter to present.
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n"
import { LangToggle } from "@/components/docs/lang-toggle"
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  LayoutTemplate,
  Loader2,
  Play,
  Star,
  StickyNote,
  X,
} from "lucide-react"
import { useSlidesStore } from "./deck-store"
import { SlideRail } from "./slide-rail"
import { SlideCanvas } from "./slide-canvas"
import { ThemeControls } from "./theme-controls"
import { LayoutPickerPopover } from "./layout-picker"
import { cn } from "@/lib/utils"

function SaveStatus() {
  const status = useSlidesStore((s) => s.saveStatus)
  const saveNow = useSlidesStore((s) => s.saveNow)
  const { t } = useI18n()

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={() => void saveNow()}
        className="flex h-8 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-3 text-[13px] text-destructive outline-none transition-colors hover:bg-destructive/10"
      >
        <CloudOff className="h-3.5 w-3.5" />
        {t("Couldn’t save — retry")}
      </button>
    )
  }

  const busy = status === "pending" || status === "saving"
  return (
    <div
      className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted-foreground"
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
    try {
      const { exportDeckToPptx } = await import("@/lib/slides-pptx")
      const name = await exportDeckToPptx(title, data)
      toast({ description: t("Downloaded {name}", { name }) })
    } catch {
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
            className="h-9 w-44 rounded-md text-[15px] font-medium sm:w-64 lg:w-80"
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

        <div className="ml-1 hidden lg:flex">
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
              onPick={(layout) => {
                const id = currentSlideId ?? slides[0]?.id
                if (id) setSlideLayout(id, layout)
              }}
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
                  "h-9 w-9 rounded-full",
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
                className="h-9 gap-1.5 rounded-full px-3 text-[13px]"
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

      <div className="flex min-h-0 flex-1">
        <SlideRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <SlideCanvas />
          {notesOpen && <NotesPanel onClose={() => setNotesOpen(false)} />}
        </div>
      </div>
    </div>
  )
}
