"use client"

/**
 * Z-Slides — layout picker. Shared by the editor toolbar's "Layout"
 * button (changes the current slide's layout), the rail's "+ New slide"
 * button (creates a slide with the picked layout) and the mobile (<md)
 * design panel, which renders `LayoutGrid` inline.
 */

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useI18n } from "@/lib/i18n"
import { LAYOUTS, LayoutGlyph } from "./layout-glyph"
import type { SlideLayout } from "@/lib/workspace-types"
import { cn } from "@/lib/utils"

/** The 6 layout tiles (min 44px tall — touch friendly). */
export function LayoutGrid({
  current,
  onPick,
}: {
  /** layout of the slide being edited (marks the active tile) */
  current?: SlideLayout
  onPick: (layout: SlideLayout) => void
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onPick(l.id)}
          aria-label={t(l.label)}
          aria-pressed={current === l.id}
          className={cn(
            "flex min-h-11 flex-col items-center gap-1 rounded-md p-1.5 outline-none transition-colors",
            "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
            current === l.id && "bg-accent text-accent-foreground"
          )}
        >
          <LayoutGlyph layout={l.id} />
          <span className="text-[11px] leading-tight text-muted-foreground">{t(l.label)}</span>
        </button>
      ))}
    </div>
  )
}

export function LayoutPickerPopover({
  trigger,
  title,
  current,
  onPick,
  align = "start",
}: {
  trigger: React.ReactNode
  title: string
  /** layout of the slide being edited (marks the active tile) */
  current?: SlideLayout
  onPick: (layout: SlideLayout) => void
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-60 p-3">
        <p className="mb-2 text-[13px] font-medium text-popover-foreground">{title}</p>
        <LayoutGrid
          current={current}
          onPick={(layout) => {
            onPick(layout)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
