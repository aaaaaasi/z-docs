"use client"

/**
 * Z-Slides — theme controls for the editor top bar: an accent-color popover
 * (warm palette, no blues) and a Sans/Serif font toggle. Theme changes are
 * stored in DeckData.theme and autosaved with the deck.
 */

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Palette, Type } from "lucide-react"
import { useSlidesStore } from "./deck-store"
import { ACCENTS } from "./slide-render"
import { cn } from "@/lib/utils"

export function ThemeControls() {
  const theme = useSlidesStore((s) => s.data?.theme)
  const setTheme = useSlidesStore((s) => s.setTheme)

  const accent = theme?.accent
  const font = theme?.font === "serif" ? "serif" : "sans"

  return (
    <div className="flex items-center gap-1.5">
      {/* accent color popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-full"
            aria-label={`Theme color${accent ? ` (${accent})` : ""}`}
          >
            <Palette className="h-4.5 w-4.5" />
            {accent && (
              <span
                aria-hidden="true"
                className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-background"
                style={{ backgroundColor: accent }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <p className="mb-2.5 text-[13px] font-medium">Theme color</p>
          <div className="grid grid-cols-6 gap-1.5">
            {ACCENTS.map((a) => (
              <Tooltip key={a.hex}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setTheme({ accent: a.hex })}
                    aria-label={`${a.name} accent`}
                    aria-pressed={accent === a.hex}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:scale-110",
                      accent === a.hex && "ring-2 ring-ring ring-offset-2 ring-offset-popover"
                    )}
                    style={{ backgroundColor: a.hex }}
                  >
                    {accent === a.hex && (
                      <span aria-hidden="true" className="text-[13px] leading-none text-white">
                        ✓
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {a.name}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Used for rules, bullets and quotes on every slide.
          </p>
        </PopoverContent>
      </Popover>

      {/* sans / serif toggle */}
      <div
        role="group"
        aria-label="Theme font"
        className="flex items-center rounded-md border p-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme({ font: "sans" })}
              aria-pressed={font === "sans"}
              aria-label="Sans-serif font"
              className={cn(
                "h-7 gap-1.5 rounded-[5px] px-2.5 text-[13px]",
                font === "sans" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Type className="h-3.5 w-3.5" />
              Sans
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Sans-serif theme
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme({ font: "serif" })}
              aria-pressed={font === "serif"}
              aria-label="Serif font"
              className={cn(
                "h-7 gap-1.5 rounded-[5px] px-2.5 font-editorial text-[13px]",
                font === "serif" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <span aria-hidden="true" className="font-editorial text-[13px] leading-none">
                Aa
              </span>
              Serif
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Serif theme (editorial)
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
