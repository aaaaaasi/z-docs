"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ListTree, X, Heading1 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface OutlineItem {
  /** data-oid stamped on the heading element in the live DOM */
  oid: string
  level: 1 | 2 | 3 | 4
  text: string
}

interface OutlineSidebarProps {
  open: boolean
  onClose: () => void
  items: OutlineItem[]
  onJump: (item: OutlineItem) => void
}

const LEVEL_STYLES: Record<number, string> = {
  1: "pl-2.5 font-medium text-sm",
  2: "pl-6 text-sm",
  3: "pl-9.5 text-[13px] text-muted-foreground",
  4: "pl-[52px] text-[13px] text-muted-foreground/80",
}

export function OutlineSidebar({ open, onClose, items, onJump }: OutlineSidebarProps) {
  return (
    <aside
      aria-label="Document outline"
      data-open={open}
      className={cn(
        "no-print relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-r bg-background/95 backdrop-blur-sm",
        "transition-[margin-left] duration-300 ease-in-out",
        open ? "ml-0" : "pointer-events-none -ml-[248px] max-lg:-ml-[100%]",
        "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-full max-lg:border-r max-lg:bg-background max-lg:transition-transform",
        !open && "max-lg:pointer-events-none max-lg:-translate-x-full"
      )}
    >
      <div className="flex h-full w-full flex-col lg:w-[248px]">
        {/* header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <ListTree className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Document outline</h2>
          {items.length > 0 && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {items.length}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close document outline"
            className="ml-auto h-8 w-8 rounded-md text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* body */}
        <div className="slim-scroll flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <Heading1 className="h-8 w-8 text-muted-foreground/40" />
              <div>
                <p className="font-editorial text-[14.5px] font-medium italic tracking-tight text-foreground/80">No headings yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add headings with <span className="font-medium">Format → Paragraph styles</span> or the
                  style dropdown to build a navigable outline.
                </p>
              </div>
            </div>
          ) : (
            <nav aria-label="Outline items" className="flex flex-col gap-0.5">
              {items.map((item) => (
                <Tooltip key={item.oid}>
                  <TooltipTrigger asChild>
                    <button
                      role="button"
                      data-outline-item={item.oid}
                      onClick={() => onJump(item)}
                      className={cn(
                        "flex w-full items-center gap-2 truncate rounded-md py-1.5 pr-2 text-left outline-none transition-colors",
                        "hover:bg-muted focus-visible:bg-muted",
                        LEVEL_STYLES[item.level] ?? LEVEL_STYLES[3]
                      )}
                      aria-label={`Jump to ${item.text}`}
                    >
                      {item.level === 1 && <span className="h-1 w-1 shrink-0 rounded-full bg-primary/70" />}
                      <span className="truncate">{item.text || "Untitled heading"}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-48 truncate text-xs">
                    {item.text || "Untitled heading"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </nav>
          )}
        </div>
      </div>
    </aside>
  )
}
