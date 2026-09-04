"use client"

/**
 * Z-Slides — present mode. A fullscreen dark overlay rendering the deck
 * large & centered, with a theme-colored progress bar, slide counter,
 * auto-hiding prev/next arrows, a speaker-notes drawer ("n"), an end-of-
 * presentation card and full keyboard navigation. Requests browser
 * fullscreen on enter (silently ignored when unsupported) and exits it on
 * leave.
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, Presentation, StickyNote, X } from "lucide-react"
import { SlideCard, useElementSize } from "./slide-render"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { DeckData } from "@/lib/workspace-types"

const IDLE_MS = 2500

export function PresentMode({
  deck,
  startIndex,
  onExit,
}: {
  deck: DeckData
  startIndex: number
  onExit: () => void
}) {
  const slides = deck.slides
  const total = slides.length
  const { t } = useI18n()

  const [index, setIndex] = React.useState(() =>
    Math.min(Math.max(startIndex, 0), Math.max(total - 1, 0))
  )
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [uiVisible, setUiVisible] = React.useState(true)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const atEnd = index >= total
  const current = atEnd ? slides[total - 1] : slides[index]

  const poke = React.useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setUiVisible(false), IDLE_MS)
  }, [])

  React.useEffect(() => {
    poke()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [poke])

  // ask the browser for fullscreen (best-effort — user gesture is fresh)
  React.useEffect(() => {
    try {
      const p = document.documentElement.requestFullscreen?.()
      if (p && typeof p.catch === "function") p.catch(() => {})
    } catch {
      // unsupported / denied — the overlay still covers everything
    }
    return () => {
      try {
        if (document.fullscreenElement) {
          const p = document.exitFullscreen?.()
          if (p && typeof p.catch === "function") p.catch(() => {})
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const next = React.useCallback(() => setIndex((i) => Math.min(i + 1, total)), [total])
  const prev = React.useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const exit = React.useCallback(() => onExit(), [onExit])

  const advance = React.useCallback(() => {
    if (atEnd) exit()
    else next()
  }, [atEnd, exit, next])

  // keyboard navigation
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      poke()
      // let a focused control handle Space/Enter itself (avoids double-advance)
      const t = e.target as HTMLElement | null
      const onControl =
        !!t &&
        (t.tagName === "BUTTON" || t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      if (onControl && (e.key === " " || e.key === "Enter")) return
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault()
          advance()
          break
        case " ":
          e.preventDefault()
          advance()
          break
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault()
          prev()
          break
        case "Home":
          e.preventDefault()
          setIndex(0)
          break
        case "End":
          e.preventDefault()
          setIndex(Math.max(total - 1, 0))
          break
        case "n":
        case "N":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) setNotesOpen((o) => !o)
          break
        case "Escape":
          exit()
          break
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [advance, prev, exit, total, poke])

  // measure the stage so the slide fits 90% of width AND height
  const [stageRef, stageW, stageH] = useElementSize<HTMLDivElement>()
  const presentW =
    stageW > 0 && stageH > 0
      ? Math.floor(Math.min(stageW * 0.9, (stageH * 0.9 * 16) / 9))
      : 0

  const notes = current?.notes ?? ""

  // portal to document.body: the app shell keeps an `animation ... both`
  // transform on its wrapper, which would otherwise become the containing
  // block for this fixed overlay (zero-height stage bug).
  if (typeof document === "undefined") return null

  return createPortal(
    <div
      role="dialog"
      aria-label={t("Presenting")}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950"
      onClick={advance}
      onMouseMove={poke}
    >
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        {atEnd ? (
          <div className="flex select-none flex-col items-center gap-5 px-6 text-center">
            <Presentation className="h-12 w-12 text-neutral-700" strokeWidth={1.5} aria-hidden="true" />
            <p className="font-editorial text-2xl text-neutral-400">{t("End of presentation")}</p>
            <p className="text-sm text-neutral-600">{t("Press Esc or click to exit")}</p>
          </div>
        ) : current && presentW > 0 ? (
          <SlideCard
            width={presentW}
            slide={current}
            theme={deck.theme}
            bordered={false}
            className="shadow-[0_0_90px_rgba(0,0,0,0.6)]"
          />
        ) : null}
      </div>

      {/* progress bar */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: `${(Math.min(index + 1, total) / Math.max(total, 1)) * 100}%`,
            backgroundColor: deck.theme.accent,
          }}
        />
      </div>

      {/* slide counter */}
      <p
        className="tnum absolute bottom-5 left-5 select-none text-sm text-neutral-400"
        aria-live="polite"
      >
        {Math.min(index + 1, total)} / {total}
      </p>

      {/* notes toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setNotesOpen((o) => !o)
        }}
        aria-label={t("Toggle speaker notes (n)")}
        aria-pressed={notesOpen}
        className={cn(
          "absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 outline-none transition-colors hover:bg-white/10 hover:text-neutral-400",
          notesOpen && "text-neutral-400"
        )}
      >
        <StickyNote className="h-4.5 w-4.5" />
      </button>

      {/* prev / next arrows (auto-hide) */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 justify-between px-3 transition-opacity duration-300",
          uiVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("Previous slide")}
              disabled={index <= 0}
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              className={cn(
                "pointer-events-auto h-12 w-12 rounded-full text-neutral-700 hover:bg-white/10 hover:text-neutral-500",
                index <= 0 && "opacity-30",
                !uiVisible && "pointer-events-none"
              )}
            >
              <ChevronLeft className="h-7 w-7" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {t("Previous (←)")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={atEnd ? t("Exit presentation") : t("Next slide")}
              onClick={(e) => {
                e.stopPropagation()
                advance()
              }}
              className={cn(
                "pointer-events-auto h-12 w-12 rounded-full text-neutral-700 hover:bg-white/10 hover:text-neutral-500",
                !uiVisible && "pointer-events-none"
              )}
            >
              {atEnd ? <X className="h-6 w-6" /> : <ChevronRight className="h-7 w-7" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {atEnd ? t("Exit (Esc)") : t("Next (→)")}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* speaker notes drawer */}
      {notesOpen && (
        <aside
          aria-label={t("Speaker notes")}
          className="absolute inset-x-0 bottom-0 max-h-[32vh] overflow-y-auto border-t border-neutral-800 bg-neutral-900/95 p-4 backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-neutral-300">
              {t("Speaker notes")}{" "}
              <span className="tnum ml-1 text-neutral-500">
                ·{" "}
                {t("slide {n} of {total}", {
                  n: Math.min(index + 1, total),
                  total,
                })}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              aria-label={t("Close speaker notes")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 outline-none transition-colors hover:bg-white/10 hover:text-neutral-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
            {notes || <span className="text-neutral-600">{t("No notes for this slide.")}</span>}
          </p>
        </aside>
      )}
    </div>,
    document.body
  )
}
