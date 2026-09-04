"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Copy, MoreVertical, Pencil, RotateCcw, Star, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { relativeTime } from "@/lib/doc-utils"
import type { SheetMeta } from "@/lib/workspace-types"
import { useSheetStore } from "./sheet-store"


/** green-tinted sheet glyph, built from divs (no images) */
function SheetGlyph({ size = 40 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="relative shrink-0 overflow-hidden rounded-md border border-emerald-700/15 bg-emerald-50 dark:bg-emerald-400/10"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-x-0 top-0 h-[34%] bg-emerald-600/75 dark:bg-emerald-400/60" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, transparent 0, transparent 23%, rgba(6,95,70,0.22) 23%, rgba(6,95,70,0.22) 25%), repeating-linear-gradient(to bottom, transparent 0, transparent 30%, rgba(6,95,70,0.16) 30%, rgba(6,95,70,0.16) 33%)",
        }}
      />
    </div>
  )
}

interface CardProps {
  sheet: SheetMeta
  cellCount: number | undefined
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
  onCommitRename: (title: string) => void
  onDeleteForever: () => void
}

export function SheetCard({ sheet, cellCount, renaming, onStartRename, onCancelRename, onCommitRename, onDeleteForever }: CardProps) {
  const openSheet = useSheetStore((s) => s.openSheet)
  const toggleStar = useSheetStore((s) => s.toggleStar)
  const trashSheet = useSheetStore((s) => s.trashSheet)
  const restoreSheet = useSheetStore((s) => s.restoreSheet)
  const duplicateSheet = useSheetStore((s) => s.duplicateSheet)
  const { toast } = useToast()
  const renameRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (renaming) {
      const el = renameRef.current
      el?.focus()
      el?.select()
    }
  }, [renaming])

  const inTrash = sheet.trashed

  return (
    <div
      className="group animate-card-in relative flex cursor-pointer flex-col gap-3 rounded-lg border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-elev-2 focus-within:border-primary/40"
      onClick={(e) => {
        if (renaming) return
        if (e.target instanceof Element && (e.target.closest("[data-menu]") || e.target.closest("button"))) return
        void openSheet(sheet.id)
      }}
      onKeyDown={(e) => {
        if (renaming) return
        if (e.key === "Enter" && e.target === e.currentTarget) void openSheet(sheet.id)
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open spreadsheet ${sheet.title}`}
    >
      <div className="flex items-start gap-3">
        <SheetGlyph />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <Input
              ref={renameRef}
              defaultValue={sheet.title}
              className="h-8 text-sm"
              aria-label="Rename spreadsheet"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter") onCommitRename((e.target as HTMLInputElement).value)
                if (e.key === "Escape") onCancelRename()
              }}
              onBlur={(e) => onCommitRename(e.target.value)}
              maxLength={120}
            />
          ) : (
            <p className="truncate text-sm font-medium text-foreground">{sheet.title}</p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground tnum">
            {cellCount === undefined ? "…" : `${cellCount} cell${cellCount === 1 ? "" : "s"}`} · edited{" "}
            {relativeTime(sheet.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-11 w-11 rounded-full sm:h-9 sm:w-9 ${
                  sheet.starred
                    ? "text-amber-500 opacity-100"
                    : "text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                }`}
                aria-label={sheet.starred ? "Unstar spreadsheet" : "Star spreadsheet"}
                aria-pressed={sheet.starred}
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleStar(sheet.id)
                }}
              >
                <Star className={`h-4.5 w-4.5 ${sheet.starred ? "fill-current" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {sheet.starred ? "Remove star" : "Add star"}
            </TooltipContent>
          </Tooltip>
          <div data-menu onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 sm:h-9 sm:w-9"
                  aria-label={`More actions for ${sheet.title}`}
                >
                  <MoreVertical className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {inTrash ? (
                  <>
                    <DropdownMenuItem onClick={() => void restoreSheet(sheet.id)}>
                      <RotateCcw className="h-4 w-4" /> Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteForever()}
                    >
                      <Trash2 className="h-4 w-4" /> Delete forever
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={onStartRename}>
                      <Pencil className="h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void toggleStar(sheet.id)}>
                      <Star className="h-4 w-4" /> {sheet.starred ? "Remove star" : "Add star"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void duplicateSheet(sheet.id)}>
                      <Copy className="h-4 w-4" /> Make a copy
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void trashSheet(sheet.id)
                        toast({ title: "Moved to trash", description: `“${sheet.title}” can be restored from Trash.` })
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Move to trash
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ list view ------------------------------ */
