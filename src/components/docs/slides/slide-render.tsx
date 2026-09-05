"use client"

/**
 * Z-Slides — shared slide renderer.
 *
 * Every slide is designed on a fixed 960×540 (16:9) "base" canvas and then
 * scaled down with a CSS transform to the requested width. The exact same
 * component renders list previews, editor thumbnails, the editor canvas and
 * the presenter view, so slides always look identical everywhere.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { DeckData, DeckTheme, Slide, SlideLayout } from "@/lib/workspace-types"
import { LAYOUTS } from "./layout-glyph"

/* -------------------------------------------------------------------------- */
/* Constants & helpers                                                        */
/* -------------------------------------------------------------------------- */

export const SLIDE_W = 960
export const SLIDE_H = 540

/** Deck accent palette (warm tones — deliberately no blues) */
export const ACCENTS: { name: string; hex: string }[] = [
  { name: "Teal", hex: "#0b6b62" },
  { name: "Forest", hex: "#3d6b35" },
  { name: "Amber", hex: "#a8601a" },
  { name: "Rust", hex: "#a8431a" },
  { name: "Plum", hex: "#7a4a8a" },
  { name: "Slate", hex: "#4a5568" },
]

export const DEFAULT_THEME: DeckTheme = { accent: ACCENTS[0].hex, font: "sans" }

const VALID_LAYOUTS: ReadonlySet<string> = new Set(LAYOUTS.map((l) => l.id))

/** Unique slide id (crypto when available, Math.random fallback) */
export function newSlideId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `s-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/** A fresh slide. The deck contract starts decks with one "title" slide. */
export function makeSlide(layout: SlideLayout = "title"): Slide {
  return {
    id: newSlideId(),
    layout,
    title: "",
    body: "",
  }
}

function isHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s)
}

function sanitizeSlide(raw: unknown): Slide | null {
  if (typeof raw !== "object" || raw === null) return null
  const s = raw as Record<string, unknown>
  if (typeof s.id !== "string") return null
  const layout = VALID_LAYOUTS.has(String(s.layout)) ? (s.layout as SlideLayout) : "blank"
  return {
    id: s.id,
    layout,
    title: typeof s.title === "string" ? s.title : "",
    body: typeof s.body === "string" ? s.body : "",
    notes: typeof s.notes === "string" ? s.notes : undefined,
  }
}

function sanitizeTheme(raw: unknown): DeckTheme {
  const t = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    accent: isHex(t.accent) ? (t.accent as string) : DEFAULT_THEME.accent,
    font: t.font === "serif" ? "serif" : "sans",
  }
}

/**
 * Parse a deck's persisted JSON payload, tolerating anything malformed:
 * returns a healthy deck (fresh title slide + default theme) when the stored
 * data is empty, corrupt or has no usable slides.
 */
export function parseDeckData(raw: string | null | undefined): DeckData {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { slides?: unknown; theme?: unknown }
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides.map(sanitizeSlide).filter((s): s is Slide => s !== null)
        : []
      if (slides.length > 0) return { slides, theme: sanitizeTheme(parsed.theme) }
    } catch {
      // fall through to a fresh deck
    }
  }
  return { slides: [makeSlide("title")], theme: { ...DEFAULT_THEME } }
}

/** Split two-column bodies on a line that contains only dashes. */
export function splitColumns(body: string): [string[], string[]] {
  const lines = body.split("\n")
  const idx = lines.findIndex((l) => l.trim() === "---")
  if (idx < 0) return [lines, []]
  return [lines.slice(0, idx), lines.slice(idx + 1)]
}

/** Measure an element's width (ResizeObserver) — used for fluid slide cards. */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T | null>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Measure an element's width AND height (presenter stage sizing). */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
  number,
] {
  const ref = React.useRef<T | null>(null)
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 })
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setSize({ w: rect.width, h: rect.height })
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      setSize((prev) =>
        Math.abs(prev.w - box.width) > 0.5 || Math.abs(prev.h - box.height) > 0.5
          ? { w: box.width, h: box.height }
          : prev
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size.w, size.h]
}

/* -------------------------------------------------------------------------- */
/* Interactive regions (editor canvas only)                                   */
/* -------------------------------------------------------------------------- */

export type EditableRegion = "title" | "body"

export interface SlideInteract {
  selectedRegion: EditableRegion | null
  editingRegion: EditableRegion | null
  /** single click — select the region */
  onSelectRegion: (region: EditableRegion) => void
  /** double click — edit in place */
  onStartEdit: (region: EditableRegion) => void
  /** the in-place editor node rendered inside the region's box */
  renderEditor: (region: EditableRegion) => React.ReactNode
  /** render muted placeholder text for empty regions */
  placeholder: boolean
}

/**
 * A text block of a slide. When `interact` is provided the block becomes
 * clickable / double-clickable and can host an in-place editor that exactly
 * covers the block (the editor lives inside the scaled slide space, so its
 * typography matches the rendered text pixel-for-pixel).
 */
function TextRegion({
  region,
  text,
  interact,
  placeholder,
  className,
  children,
}: {
  region: EditableRegion
  text: string
  interact?: SlideInteract
  placeholder?: string
  className?: string
  children?: React.ReactNode
}) {
  const editing = interact?.editingRegion === region
  const selected = interact?.selectedRegion === region
  return (
    <div
      className={cn(
        "relative",
        selected && "ring-2 ring-primary/70",
        className
      )}
      onClick={
        interact && !editing
          ? (e) => {
              e.stopPropagation()
              interact.onSelectRegion(region)
            }
          : undefined
      }
      onDoubleClick={
        interact
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              interact.onStartEdit(region)
            }
          : undefined
      }
    >
      <div className={cn(editing && "invisible")}>
        {children ?? (text ? <span className="block whitespace-pre-wrap">{text}</span> : null)}
        {!text && placeholder && interact?.placeholder && (
          <span className="block whitespace-pre-wrap text-neutral-400">{placeholder}</span>
        )}
      </div>
      {editing && interact ? (
        <div className="absolute left-0 top-0 w-full">{interact.renderEditor(region)}</div>
      ) : null}
    </div>
  )
}

/** Body lines rendered as an accent-bulleted list (titleBody / twoColumn). */
function BulletLines({ lines, accent }: { lines: string[]; accent: string }) {
  if (!lines.some((l) => l.trim())) return null
  return (
    <div className="flex flex-col gap-[0.6em]">
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-[0.75em]">
          <span
            aria-hidden="true"
            className="mt-[0.58em] h-[0.34em] w-[0.34em] shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span className="min-w-0 flex-1 whitespace-pre-wrap">{line || "\u00A0"}</span>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Layouts                                                                    */
/* -------------------------------------------------------------------------- */

function SlideView({
  slide,
  theme,
  interact,
}: {
  slide: Slide
  theme: DeckTheme
  interact?: SlideInteract
}) {
  const { t } = useI18n()
  let content: React.ReactNode

  switch (slide.layout) {
    case "title":
      content = (
        <div className="flex h-full w-full flex-col items-center justify-center px-24 pb-4 text-center">
          <TextRegion
            region="title"
            text={slide.title}
            interact={interact}
            placeholder={t("Click to add title")}
            className="max-w-[720px] text-[52px] font-medium leading-[1.14] tracking-[-0.015em] text-neutral-800"
          />
          <TextRegion
            region="body"
            text={slide.body}
            interact={interact}
            placeholder={t("Click to add subtitle")}
            className="mt-6 max-w-[560px] text-[22px] leading-[1.5] text-neutral-500"
          />
        </div>
      )
      break

    case "titleBody":
      content = (
        <div className="flex h-full w-full flex-col px-20 pb-16 pt-14">
          <TextRegion
            region="title"
            text={slide.title}
            interact={interact}
            placeholder={t("Click to add title")}
            className="text-[38px] font-medium leading-[1.18] text-neutral-800"
          />
          <div
            aria-hidden="true"
            className="mt-5 h-1 w-14 rounded-full"
            style={{ backgroundColor: theme.accent }}
          />
          <TextRegion
            region="body"
            text={slide.body}
            interact={interact}
            placeholder={t("Click to add text")}
            className="mt-7 min-h-0 flex-1 overflow-hidden text-[20px] leading-[1.55] text-neutral-700"
          >
            <BulletLines lines={slide.body.split("\n")} accent={theme.accent} />
          </TextRegion>
        </div>
      )
      break

    case "twoColumn": {
      const [left, right] = splitColumns(slide.body)
      content = (
        <div className="flex h-full w-full flex-col px-20 pb-16 pt-14">
          <TextRegion
            region="title"
            text={slide.title}
            interact={interact}
            placeholder={t("Click to add title")}
            className="text-[36px] font-medium leading-[1.18] text-neutral-800"
          />
          <div
            aria-hidden="true"
            className="mt-5 h-1 w-14 rounded-full"
            style={{ backgroundColor: theme.accent }}
          />
          <TextRegion
            region="body"
            text={slide.body}
            interact={interact}
            placeholder={t("Click to add text")}
            className="mt-7 min-h-0 flex-1 overflow-hidden text-[18px] leading-[1.55] text-neutral-700"
          >
            <div className="grid h-full grid-cols-2 gap-12">
              <BulletLines lines={left} accent={theme.accent} />
              <BulletLines lines={right} accent={theme.accent} />
            </div>
          </TextRegion>
        </div>
      )
      break
    }

    case "quote": {
      const lines = slide.body.split("\n")
      const quote = lines[0] ?? ""
      const attribution = lines[1] ?? ""
      content = (
        <div className="flex h-full w-full flex-col items-center justify-center px-32 text-center">
          <span
            aria-hidden="true"
            className="font-editorial -mb-6 select-none text-[110px] leading-none"
            style={{ color: theme.accent }}
          >
            &ldquo;
          </span>
          <TextRegion
            region="body"
            text={slide.body}
            interact={interact}
            placeholder={t("Click to add quote")}
            className="max-w-[640px]"
          >
            {slide.body && (
              <>
                <p className="italic text-[28px] leading-[1.45] text-neutral-800">{quote}</p>
                {attribution && (
                  <p className="mt-5 text-[17px] leading-[1.4] text-neutral-400">— {attribution}</p>
                )}
              </>
            )}
          </TextRegion>
        </div>
      )
      break
    }

    case "section":
      content = (
        <div className="flex h-full w-full flex-col items-center justify-center px-28 text-center">
          <div
            aria-hidden="true"
            className="h-[3px] w-14 rounded-full"
            style={{ backgroundColor: theme.accent }}
          />
          <TextRegion
            region="title"
            text={slide.title}
            interact={interact}
            placeholder={t("Click to add section title")}
            className="mt-8 max-w-[760px] text-[54px] font-medium leading-[1.12] tracking-[-0.01em] text-neutral-800"
          />
          <TextRegion
            region="body"
            text={slide.body}
            interact={interact}
            placeholder={t("Click to add caption")}
            className="mt-5 max-w-[540px] text-[19px] leading-[1.5] text-neutral-400"
          />
        </div>
      )
      break

    case "blank":
    default:
      content = (
        <div className="flex h-full w-full items-center px-24">
          <TextRegion
            region="body"
            text={slide.body}
            interact={interact}
            placeholder={t("Click to add text")}
            className="w-full text-[22px] leading-[1.55] text-neutral-700"
          />
        </div>
      )
      break
  }

  return (
    <div className={cn("h-full w-full bg-white", theme.font === "serif" && "font-editorial")}>
      {content}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* SlideCard — the public renderer                                            */
/* -------------------------------------------------------------------------- */

/**
 * Renders a slide on a white 16:9 card.
 * Pass `width` for a fixed-size card, or omit it to auto-measure the card's
 * fluid container width (grid cells, thumbnail rails).
 */
export function SlideCard({
  slide,
  theme,
  width,
  interact,
  bordered = true,
  className,
}: {
  slide: Slide
  theme: DeckTheme
  width?: number
  interact?: SlideInteract
  /** hairline border around the white card (off for the presenter) */
  bordered?: boolean
  className?: string
}) {
  const [measureRef, measured] = useElementWidth<HTMLDivElement>()
  const { t } = useI18n()
  const w = width ?? measured
  const scale = w > 0 ? w / SLIDE_W : 0
  return (
    <div
      ref={width === undefined ? measureRef : undefined}
      role={interact ? undefined : "img"}
      aria-label={
        interact
          ? undefined
          : t("Slide preview: {title}", {
              title: slide.title || slide.body || slide.layout,
            })
      }
      className={cn(
        "relative overflow-hidden bg-white",
        width === undefined && "aspect-video w-full",
        bordered && "rounded-md border border-foreground/15",
        className
      )}
      style={width !== undefined ? { width, height: Math.round((width * 9) / 16) } : undefined}
    >
      {scale > 0 && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
        >
          <SlideView slide={slide} theme={theme} interact={interact} />
        </div>
      )}
    </div>
  )
}

