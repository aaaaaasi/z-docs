"use client"

/**
 * Z-Slides — editor canvas. Shows the current slide centered on a soft
 * neutral canvas at ~60% width (max 768px), with zoom controls (50–150%,
 * also Ctrl/Cmd +/-) and in-place text editing: single click selects a text
 * region, double click opens a Textarea that exactly covers the region and
 * inherits its typography (it lives inside the scaled slide space).
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { useSlidesStore } from "./deck-store"
import {
  SlideCard,
  useElementWidth,
  type EditableRegion,
  type SlideInteract,
} from "./slide-render"
import { LayoutPickerPopover } from "./layout-picker"
import { cn } from "@/lib/utils"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 10) / 10))

/** The in-place editor rendered inside the (scaled) slide space. */
function RegionEditor({
  region,
  value,
  accent,
  onChange,
  onCommit,
  onCancel,
}: {
  region: EditableRegion
  value: string
  accent: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null)

  // auto-height: cover the region and grow with the content
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // replace placeholder text wholesale, like Google Slides
    if (value === "Click to add title" && document.activeElement === el) {
      el.setSelectionRange(0, el.value.length)
    }
    const min = el.parentElement?.parentElement?.clientHeight ?? 0
    el.style.height = "0px"
    el.style.height = `${Math.max(el.scrollHeight, min)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      autoFocus
      value={value}
      spellCheck={false}
      aria-label={region === "title" ? "Slide title" : "Slide text"}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // never let global editor shortcuts fire while typing
        e.stopPropagation()
        if (e.key === "Enter" && region === "title" && !e.shiftKey) {
          e.preventDefault()
          onCommit()
        } else if (e.key === "Escape") {
          e.preventDefault()
          if (region === "title") onCancel()
          else onCommit()
        }
      }}
      onBlur={onCommit}
      className="absolute left-0 top-0 w-full resize-none overflow-hidden rounded-sm border-0 bg-white p-0 text-neutral-900 outline-none placeholder:text-neutral-400"
      style={{
        font: "inherit",
        lineHeight: "inherit",
        height: "100%",
        boxShadow: `0 0 0 2px ${accent}66`,
      }}
    />
  )
}

export function SlideCanvas() {
  const data = useSlidesStore((s) => s.data)
  const currentSlideId = useSlidesStore((s) => s.currentSlideId)
  const updateSlide = useSlidesStore((s) => s.updateSlide)
  const moveSelection = useSlidesStore((s) => s.moveSelection)
  const addSlide = useSlidesStore((s) => s.addSlide)

  const [zoom, setZoom] = React.useState(1)
  const [selectedRegion, setSelectedRegion] = React.useState<EditableRegion | null>(null)
  const [editing, setEditing] = React.useState<{ region: EditableRegion; value: string } | null>(
    null
  )

  const [areaRef, areaW] = useElementWidth<HTMLDivElement>()

  const slides = data?.slides ?? []
  const slide =
    (data?.slides.find((s) => s.id === currentSlideId) ?? (slides.length > 0 ? slides[0] : null)) ??
    null
  const slideIndex = slide ? slides.findIndex((s) => s.id === slide.id) : -1

  // ~60% of the available width, capped at max-w-3xl, with a floor for phones
  const slideW = areaW > 0 ? Math.round(Math.min(Math.max(areaW * 0.6, 300), 768)) : 0
  const slideH = slideW > 0 ? Math.round((slideW * 9) / 16) : 0

  // Ctrl/Cmd +/- zoom
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        setZoom((z) => clampZoom(z + ZOOM_STEP))
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        setZoom((z) => clampZoom(z - ZOOM_STEP))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /* ---------- in-place editing ---------- */

  const startEdit = (region: EditableRegion) => {
    if (!slide) return
    setEditing({ region, value: region === "title" ? slide.title : slide.body })
    setSelectedRegion(region)
  }

  const commitEditing = () => {
    if (!editing || !slide) {
      setEditing(null)
      return
    }
    const current = editing.region === "title" ? slide.title : slide.body
    setEditing(null)
    if (editing.value !== current) {
      updateSlide(slide.id, { [editing.region]: editing.value })
    }
  }

  const cancelEditing = () => setEditing(null)

  const interact: SlideInteract | undefined =
    slide && data
      ? {
          selectedRegion: editing ? null : selectedRegion,
          editingRegion: editing?.region ?? null,
          onSelectRegion: (r) => setSelectedRegion(r),
          onStartEdit: startEdit,
          renderEditor: (r) =>
            editing && editing.region === r ? (
              <RegionEditor
                region={r}
                value={editing.value}
                accent={data.theme.accent}
                onChange={(v) => setEditing((e) => (e && e.region === r ? { ...e, value: v } : e))}
                onCommit={commitEditing}
                onCancel={cancelEditing}
              />
            ) : null,
          placeholder: true,
        }
      : undefined

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <main
        ref={areaRef}
        aria-label="Slide canvas"
        className="slim-scroll min-h-0 flex-1 overflow-auto bg-muted/60"
        onClick={() => {
          if (editing) commitEditing()
          setSelectedRegion(null)
        }}
      >
        <div className="flex min-h-full justify-center p-4 sm:p-10">
          {slides.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">
                This presentation has no slides yet.
              </p>
              <LayoutPickerPopover
                title="Insert a new slide"
                onPick={(layout) => addSlide(layout)}
                trigger={
                  <Button className="h-10 rounded-full px-5">Add a slide</Button>
                }
              />
            </div>
          ) : slide && data && slideW > 0 ? (
            <div
              className="my-auto"
              style={{ width: Math.round(slideW * zoom), height: Math.round(slideH * zoom) }}
            >
              <div
                className="origin-top-left"
                style={{ width: slideW, height: slideH, transform: `scale(${zoom})` }}
              >
                <SlideCard
                  width={slideW}
                  slide={slide}
                  theme={data.theme}
                  interact={interact}
                  className="shadow-[0_1px_2px_rgba(35,32,28,0.08),0_16px_44px_rgba(35,32,28,0.14)]"
                />
              </div>
            </div>
          ) : (
            // still measuring the canvas — brief placeholder at slide size
            <div
              aria-hidden="true"
              className="my-auto aspect-video w-3/5 max-w-3xl animate-pulse rounded-md bg-muted"
            />
          )}
        </div>
      </main>

      {/* floating toolbar: zoom + (mobile-friendly) slide navigation */}
      <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-full border bg-background/95 p-1 elev-2 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zoom out (Ctrl minus)"
              onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              className="h-9 w-9 rounded-full"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Zoom out (Ctrl−)
          </TooltipContent>
        </Tooltip>
        <span className="tnum w-12 select-none text-center text-[13px] text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zoom in (Ctrl plus)"
              onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              className="h-9 w-9 rounded-full"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Zoom in (Ctrl+)
          </TooltipContent>
        </Tooltip>

        <div aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous slide"
              onClick={() => moveSelection(-1)}
              disabled={slideIndex <= 0}
              className="h-9 w-9 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Previous slide
          </TooltipContent>
        </Tooltip>
        <span
          className={cn("tnum w-14 select-none text-center text-[13px] text-muted-foreground")}
          aria-live="polite"
        >
          {slides.length > 0 ? `${slideIndex + 1} / ${slides.length}` : "0 / 0"}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next slide"
              onClick={() => moveSelection(1)}
              disabled={slideIndex < 0 || slideIndex >= slides.length - 1}
              className="h-9 w-9 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Next slide
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
