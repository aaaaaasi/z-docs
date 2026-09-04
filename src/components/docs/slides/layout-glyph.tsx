"use client"

/**
 * Z-Slides — layout registry + tiny wireframe glyphs used by the layout
 * picker tiles (shared by the editor toolbar and the rail's "+ New slide").
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import type { SlideLayout } from "@/lib/workspace-types"

export const LAYOUTS: { id: SlideLayout; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "titleBody", label: "Title and body" },
  { id: "twoColumn", label: "Two columns" },
  { id: "quote", label: "Quote" },
  { id: "section", label: "Section" },
  { id: "blank", label: "Blank" },
]

/** Tiny wireframe preview of a layout (used by the layout picker tiles). */
export function LayoutGlyph({ layout, className }: { layout: SlideLayout; className?: string }) {
  let glyph: React.ReactNode = null
  switch (layout) {
    case "title":
      glyph = (
        <>
          <div className="mx-auto mt-[20%] h-[10%] w-[54%] rounded-[2px] bg-foreground/55" />
          <div className="mx-auto mt-[9%] h-[6%] w-[36%] rounded-[2px] bg-foreground/20" />
        </>
      )
      break
    case "titleBody":
      glyph = (
        <>
          <div className="h-[10%] w-[50%] rounded-[2px] bg-foreground/55" />
          <div className="mt-[10%] h-[6%] w-full rounded-[2px] bg-foreground/20" />
          <div className="mt-[8%] h-[6%] w-[92%] rounded-[2px] bg-foreground/20" />
          <div className="mt-[8%] h-[6%] w-[96%] rounded-[2px] bg-foreground/20" />
        </>
      )
      break
    case "twoColumn":
      glyph = (
        <>
          <div className="h-[10%] w-[50%] rounded-[2px] bg-foreground/55" />
          <div className="mt-[12%] grid grid-cols-2 gap-[14%]">
            <div className="flex flex-col gap-[55%]">
              <div className="h-[5.5%] w-full rounded-[2px] bg-foreground/20" />
              <div className="h-[5.5%] w-full rounded-[2px] bg-foreground/20" />
            </div>
            <div className="flex flex-col gap-[55%]">
              <div className="h-[5.5%] w-full rounded-[2px] bg-foreground/20" />
              <div className="h-[5.5%] w-full rounded-[2px] bg-foreground/20" />
            </div>
          </div>
        </>
      )
      break
    case "quote":
      glyph = (
        <div className="flex h-full flex-col items-center justify-center">
          <span className="font-editorial text-[13px] leading-none text-foreground/50">&ldquo;</span>
          <div className="mt-[8%] h-[6%] w-[58%] rounded-[2px] bg-foreground/25" />
          <div className="mt-[7%] h-[4%] w-[34%] rounded-[2px] bg-foreground/15" />
        </div>
      )
      break
    case "section":
      glyph = (
        <>
          <div className="mx-auto mt-[32%] h-[3.5%] w-[24%] rounded-full bg-foreground/55" />
          <div className="mx-auto mt-[9%] h-[10%] w-[46%] rounded-[2px] bg-foreground/55" />
        </>
      )
      break
    case "blank":
    default:
      glyph = null
      break
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex aspect-video w-full flex-col rounded-[4px] border border-foreground/12 bg-white p-[9%]",
        className
      )}
    >
      {glyph}
    </div>
  )
}
