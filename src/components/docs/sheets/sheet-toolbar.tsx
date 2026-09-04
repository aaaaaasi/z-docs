"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  Redo2,
  Undo2,
} from "lucide-react"
import type { CellData } from "@/lib/workspace-types"
import { cellRef } from "./cells"
import { useSheetStore } from "./sheet-store"

/* 8 preset pastel fills (Google-like, no blue/indigo) + "None" */
const FILL_SWATCHES = [
  "#fef3c7",
  "#fef9c3",
  "#ffedd5",
  "#fee2e2",
  "#dcfce7",
  "#d1fae5",
  "#ccfbf1",
  "#fce7f3",
]

const toolBtn =
  "h-11 w-11 sm:h-8 sm:w-8 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60"

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`${toolBtn} ${active ? "bg-accent text-accent-foreground" : ""}`}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function FillPicker({ activeBg }: { activeBg: string | undefined }) {
  const applyFormat = useSheetStore((s) => s.applyFormat)
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-11 gap-1.5 px-2 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-8 sm:px-2.5" aria-label="Fill color">
              <span
                aria-hidden
                className="h-4 w-4 rounded-[3px] border border-border shadow-inner"
                style={{ background: activeBg ?? "transparent" }}
              />
              <span className="text-[13px]">Fill</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Fill color
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-auto p-3">
        <p className="mb-2 text-xs font-medium text-foreground">Fill color</p>
        <div className="grid grid-cols-4 gap-1.5">
          {FILL_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Fill ${hex}`}
              onClick={() => {
                applyFormat({ bg: hex })
                setOpen(false)
              }}
              className={`h-7 w-7 rounded-md border border-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${
                activeBg === hex ? "ring-2 ring-ring/70" : ""
              }`}
              style={{ background: hex }}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full text-[13px]"
          onClick={() => {
            applyFormat({ bg: undefined })
            setOpen(false)
          }}
        >
          <Eraser className="h-3.5 w-3.5" />
          None
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function Toolbar() {
  const data = useSheetStore((s) => s.data)
  const active = useSheetStore((s) => s.active)
  const canUndo = useSheetStore((s) => s.undoStack.length > 0)
  const canRedo = useSheetStore((s) => s.redoStack.length > 0)
  const undo = useSheetStore((s) => s.undo)
  const redo = useSheetStore((s) => s.redo)
  const applyFormat = useSheetStore((s) => s.applyFormat)
  const clearFormatting = useSheetStore((s) => s.clearFormatting)

  const cell: CellData | undefined = data.cells[cellRef(active.r, active.c)]
  const boldOn = cell?.bold === true
  const italicOn = cell?.italic === true
  const align = cell?.align

  return (
    <div
      className="no-scrollbar flex h-auto min-h-12 flex-wrap items-center gap-0.5 overflow-x-auto border-b px-1 py-1 sm:px-2"
      role="toolbar"
      aria-label="Formatting toolbar"
    >
      <ToolbarButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        label="Bold (selection)"
        active={boldOn}
        onClick={() => applyFormat({ bold: !boldOn })}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic (selection)"
        active={italicOn}
        onClick={() => applyFormat({ italic: !italicOn })}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        label="Align left"
        active={align === "left"}
        onClick={() => applyFormat({ align: "left" })}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={align === "center"}
        onClick={() => applyFormat({ align: "center" })}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={align === "right"}
        onClick={() => applyFormat({ align: "right" })}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <FillPicker activeBg={cell?.bg} />
      <ToolbarButton label="Clear formatting (selection)" onClick={clearFormatting}>
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}
