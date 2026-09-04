"use client"

/**
 * Z-Slides — editor left rail: numbered live thumbnails of every slide,
 * per-slide context menu (duplicate / reorder / delete) and the
 * "+ New slide" layout picker.
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
          className="h-6 w-6 rounded-[5px] border border-border/60 bg-background/95 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
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
      className="hidden w-56 shrink-0 flex-col border-r bg-background md:flex"
    >
      <div className="slim-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5 p-3">
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
                  "group flex cursor-pointer items-start gap-2 rounded-lg p-1.5 outline-none transition-colors",
                  isCurrent ? "bg-accent" : "hover:bg-muted/70 focus-visible:bg-muted/70"
                )}
              >
                <span
                  className={cn(
                    "tnum mt-1 w-4 shrink-0 text-right text-[11px] text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <div className="relative min-w-0 flex-1">
                  <div
                    className={cn(
                      "overflow-hidden rounded-[4px] border border-foreground/10 transition-shadow",
                      isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                  >
                    {theme && <SlideCard slide={slide} theme={theme} />}
                  </div>
                  <div
                    className="absolute right-1 top-1 focus-within:opacity-100 data-[state=open]:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SlideMenu slide={slide} index={i} total={slides.length} />
                  </div>
                </div>
              </div>
            )
          })}

          {slides.length === 0 && (
            <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-muted-foreground">
              {t("No slides yet. Add one below.")}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t p-3">
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
