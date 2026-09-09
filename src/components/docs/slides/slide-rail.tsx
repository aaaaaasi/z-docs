"use client"

/**
 * Z-Slides — slide rail.
 *
 * Responsive behavior (Material Design 3 navigation guidance):
 *  • ≥1024 (lg): the classic w-56 vertical thumbnail column.
 *  • 768–1024 (md, tablets): narrowed w-48 vertical rail (number + smaller
 *    thumbnails) — same layout, less chrome.
 *  • <768 (phones): a fixed 96px bottom filmstrip — horizontally scrolling
 *    thumbnails with a live slide-number badge and an always-visible "⋮"
 *    per-slide menu (hover doesn't exist on touch), ending with a "+ New
 *    slide" card. Selection, reordering, duplication, deletion and slide
 *    creation are therefore all reachable on a phone.
 */

import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { ArrowDown, ArrowUp, Copy, MoreVertical, Plus, Trash2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useSlidesStore } from "./deck-store"
import { SlideCard } from "./slide-render"
import { LayoutPickerPopover } from "./layout-picker"
import { cn } from "@/lib/utils"
import type { Slide } from "@/lib/workspace-types"

function SlideMenu({
  slide,
  index,
  total,
}: {
  slide: Slide
  index: number
  total: number
}) {
  const duplicateSlide = useSlidesStore((s) => s.duplicateSlide)
  const moveSlide = useSlidesStore((s) => s.moveSlide)
  const deleteSlide = useSlidesStore((s) => s.deleteSlide)
  const undo = useSlidesStore((s) => s.undo)
  const { toast } = useToast()
  const { t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Actions for slide {n}", { n: index + 1 })}
          className="h-8 w-8 rounded-[5px] border border-border/60 bg-background/95 text-muted-foreground shadow-sm transition-opacity hover:text-foreground md:h-6 md:w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 md:h-3.5 md:w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => duplicateSlide(slide.id)}>
          <Copy className="h-4 w-4" /> {t("Duplicate slide")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === 0}
          onClick={() => moveSlide(slide.id, -1)}
        >
          <ArrowUp className="h-4 w-4" /> {t("Move up")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === total - 1}
          onClick={() => moveSlide(slide.id, 1)}
        >
          <ArrowDown className="h-4 w-4" /> {t("Move down")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            deleteSlide(slide.id)
            toast({
              title: t("Slide deleted"),
              action: (
                <ToastAction altText={t("Undo the deletion")} onClick={() => undo()}>
                  {t("Undo")}
                </ToastAction>
              ),
            })
          }}
        >
          <Trash2 className="h-4 w-4" /> {t("Delete slide")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SlideRail() {
  const data = useSlidesStore((s) => s.data)
  const currentSlideId = useSlidesStore((s) => s.currentSlideId)
  const selectSlide = useSlidesStore((s) => s.selectSlide)
  const addSlide = useSlidesStore((s) => s.addSlide)
  const { t } = useI18n()

  const slides = data?.slides ?? []
  const theme = data?.theme

  return (
    <nav
      aria-label={t("Slide thumbnails")}
      className="order-last flex h-24 w-full shrink-0 flex-row border-t bg-background md:order-none md:h-auto md:w-48 md:flex-col md:border-t-0 md:border-r lg:w-56"
    >
      {/* thumbnails — horizontal filmstrip on phones, vertical column ≥md */}
      <div className="slim-scroll flex min-h-0 flex-1 items-center gap-2 overflow-x-auto px-2 py-2 md:flex-col md:items-stretch md:gap-1.5 md:overflow-x-hidden md:overflow-y-auto md:p-3">
        {slides.map((slide, i) => {
          const isCurrent = slide.id === currentSlideId
          return (
            <div
              key={slide.id}
              role="button"
              tabIndex={0}
              aria-label={t("Go to slide {n}", { n: i + 1 })}
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => selectSlide(slide.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  selectSlide(slide.id)
                }
              }}
              className={cn(
                "relative flex w-32 shrink-0 cursor-pointer flex-col rounded-lg p-1 outline-none transition-colors md:w-full md:flex-row md:items-start md:gap-2 md:p-1.5",
                isCurrent ? "bg-accent" : "hover:bg-muted/70 focus-visible:bg-muted/70"
              )}
            >
              {/* slide number — left column on ≥md, badge overlay on phones */}
              <span className="tnum mt-1 hidden w-4 shrink-0 text-right text-[11px] text-muted-foreground md:block">
                {i + 1}
              </span>
              <span
                aria-hidden="true"
                className="tnum pointer-events-none absolute bottom-1.5 left-1.5 z-10 rounded-[3px] bg-foreground/60 px-1 py-0.5 text-[10px] font-medium leading-none text-background md:hidden"
              >
                {i + 1}
              </span>

              <div className="relative w-full min-w-0 md:w-auto md:flex-1">
                <div
                  className={cn(
                    "overflow-hidden rounded-[4px] border border-foreground/10 transition-shadow",
                    isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  )}
                >
                  {theme && <SlideCard slide={slide} theme={theme} />}
                </div>
                <div
                  className="absolute right-0.5 top-0.5 focus-within:opacity-100 data-[state=open]:opacity-100 md:right-1 md:top-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SlideMenu slide={slide} index={i} total={slides.length} />
                </div>
              </div>
            </div>
          )
        })}

        {/* phones: the filmstrip ends with a "+ New slide" card */}
        <LayoutPickerPopover
          title={t("Insert a new slide")}
          onPick={(layout) => addSlide(layout)}
          trigger={
            <button
              type="button"
              aria-label={t("New slide")}
              className="flex aspect-video w-32 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground outline-none transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:bg-muted/70 md:hidden"
            >
              <Plus className="h-6 w-6" />
            </button>
          }
        />

        {slides.length === 0 && (
          <p className="hidden px-2 py-6 text-center text-[12px] leading-relaxed text-muted-foreground md:block">
            {t("No slides yet. Add one below.")}
          </p>
        )}
      </div>

      {/* ≥md footer: full-width New slide button + PageUp/Down hint */}
      <div className="hidden shrink-0 border-t p-3 md:block">
        <LayoutPickerPopover
          title={t("Insert a new slide")}
          onPick={(layout) => addSlide(layout)}
          trigger={
            <Button
              variant="outline"
              className="h-10 w-full justify-start gap-2 rounded-lg text-[13px]"
            >
              <Plus className="h-4 w-4" /> {t("New slide")}
            </Button>
          }
        />
        <p className="mt-2 hidden px-1 text-[11px] leading-relaxed text-muted-foreground/80 lg:block">
          <Tooltip>
            <TooltipTrigger asChild>
              <kbd
                aria-label={t("Page up and page down keys")}
                className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]"
              >
                ⇞/⇟
              </kbd>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("Switch slides")}
            </TooltipContent>
          </Tooltip>{" "}
          {t("switches slides")}
        </p>
      </div>
    </nav>
  )
}
