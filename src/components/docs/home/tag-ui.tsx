"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TagDTO } from "@/lib/docs-types"

/**
 * Shared tag (Google Drive style label) UI primitives.
 * Used by the sidebar Tags section, doc cards/rows, and the docs grid filter chip.
 * Styling: quiet Google-like chips — bg-muted, small dot, 11px text, no heavy borders.
 */

/** Fixed Google-like label palette */
export const TAG_COLORS = [
  { value: "#0b6b62", name: "teal" },
  { value: "#d93025", name: "red" },
  { value: "#f9ab00", name: "amber" },
  { value: "#1e8e3e", name: "green" },
  { value: "#a142f4", name: "purple" },
  { value: "#5f6368", name: "gray" },
] as const

export const DEFAULT_TAG_COLOR: string = TAG_COLORS[0].value

/** "#rrggbb" -> "rgba(r, g, b, alpha)" (falls back to the primary teal) */
export function tagColorAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return `rgba(11, 107, 98, ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Expands a small control's click target to a ~32px hit area via a transparent pseudo-element */
export const hitArea =
  "relative before:absolute before:-inset-1.5 before:rounded-full before:content-['']"

/** Small colored dot used inside chips, rows, and creation forms */
export function TagDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  )
}

/**
 * Small tag chip rendered on doc cards/rows.
 * Visual: h-5, rounded-full, bg-muted, 11px text, colored dot. Clicking filters by the tag
 * (stopPropagation keeps the parent card click from opening the document).
 */
export function TagChip({
  tag,
  active,
  onFilter,
}: {
  tag: TagDTO
  active?: boolean
  onFilter?: () => void
}) {
  const interactive = !!onFilter
  return (
    <button
      type="button"
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation()
              onFilter()
            }
          : undefined
      }
      aria-pressed={interactive ? active : undefined}
      aria-label={interactive ? `Filter by tag ${tag.name}` : undefined}
      title={interactive ? `Filter by \u201C${tag.name}\u201D` : undefined}
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-muted px-2 text-[11px] leading-none text-foreground/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        interactive && cn(hitArea, "cursor-pointer hover:bg-muted/70"),
        active && "font-medium text-foreground"
      )}
    >
      <TagDot color={tag.color} className="h-1.5 w-1.5" />
      <span className="max-w-[9ch] truncate">{tag.name}</span>
    </button>
  )
}

/** Non-interactive "+N" overflow chip for docs carrying more than 3 tags */
export function TagOverflowChip({ count, names }: { count: number; names?: string }) {
  return (
    <span
      title={names ? `More tags: ${names}` : undefined}
      className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] leading-none text-muted-foreground"
    >
      +{count}
    </span>
  )
}

/** Google Drive style filter chip shown in the docs grid header while a tag filter is active */
export function TagFilterChip({ tag, onClear }: { tag: TagDTO; onClear: () => void }) {
  return (
    <div
      className="inline-flex h-8 items-center gap-1.5 rounded-full pl-3 pr-1 ring-1 ring-inset ring-foreground/10"
      style={{ backgroundColor: tagColorAlpha(tag.color, 0.15) }}
    >
      <TagDot color={tag.color} className="h-2.5 w-2.5" />
      <span className="text-[13px] font-medium text-foreground">{tag.name}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear tag filter ${tag.name}`}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          hitArea
        )}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}

/** Row of the 6 fixed palette colors used when creating a tag */
export function TagColorPalette({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (hex: string) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label="Tag color" className={cn("flex items-center gap-1", className)}>
      {TAG_COLORS.map((c) => {
        const selected = c.value === value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${c.name} tag color`}
            onClick={() => onChange(c.value)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
              hitArea,
              selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          >
            <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c.value }} />
          </button>
        )
      })}
    </div>
  )
}
