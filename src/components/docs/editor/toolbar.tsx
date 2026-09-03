"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { EditorApi } from "./editor-types"
import { FONT_FAMILIES, FONT_SIZES, TEXT_COLOR_PALETTE } from "@/lib/doc-utils"
import {
  Undo2, Redo2, Printer, Bold, Italic, Underline, Strikethrough, Link, ImagePlus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Indent,
  Outdent, RemoveFormatting, Sparkles, Text, Highlighter, ChevronDown, Baseline
} from "lucide-react"
import { cn } from "@/lib/utils"

function TB({
  icon: Icon,
  label,
  active,
  onClick,
  className,
  iconClassName,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  onClick: () => void
  className?: string
  iconClassName?: string
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground",
            active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            className
          )}
        >
          <Icon className={cn("h-4.5 w-4.5", iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}

const STYLES = [
  { value: "p", label: "Normal text" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "blockquote", label: "Quote" },
]

function PaletteGrid({ onPick, allowNone }: { onPick: (c: string) => void; allowNone?: boolean }) {
  return (
    <div className="w-56 p-2">
      {allowNone && (
        <button
          onClick={() => onPick("transparent")}
          className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
        >
          <span className="relative h-4 w-4 rounded border bg-white">
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">/</span>
          </span>
          No highlight
        </button>
      )}
      <div className="grid grid-cols-10 gap-1">
        {TEXT_COLOR_PALETTE.map((c) => (
          <button
            key={c}
            aria-label={`Use color ${c}`}
            onClick={() => onPick(c)}
            className="h-4.5 w-4.5 rounded-[3px] border border-black/10 transition-transform hover:scale-125"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted">
        Custom color
        <input
          type="color"
          className="h-6 w-8 cursor-pointer rounded border bg-transparent"
          onChange={(e) => onPick(e.target.value)}
          aria-label="Custom color"
        />
      </label>
    </div>
  )
}

export function Toolbar({ api }: { api: EditorApi }) {
  const [lastTextColor, setLastTextColor] = React.useState("#0b6b62")
  const [lastHighlight, setLastHighlight] = React.useState("#fff2cc")

  const blockValue = STYLES.find((s) => s.value === api.fmt.block)?.value ?? "p"

  return (
    <div
      className="no-print no-scrollbar flex h-12 items-center gap-0.5 overflow-x-auto border-b bg-background px-2"
      role="toolbar"
      aria-label="Text formatting toolbar"
    >
      <TB icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => api.exec("undo")} />
      <TB icon={Redo2} label="Redo (Ctrl+Y)" onClick={() => api.exec("redo")} />
      <TB icon={Printer} label="Print (Ctrl+P)" onClick={api.printDoc} />

      {/* Paragraph style */}
      <Select value={blockValue} onValueChange={(v) => api.exec("formatBlock", v)}>
        <SelectTrigger
          aria-label="Paragraph style"
          className="mx-1 h-9 w-[118px] shrink-0 rounded-md border-transparent bg-muted/60 text-sm focus-visible:ring-1"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STYLES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font family */}
      <Select value={api.fmt.fontName} onValueChange={(v) => api.exec("fontName", v)}>
        <SelectTrigger
          aria-label="Font family"
          className="mx-1 h-9 w-[118px] shrink-0 rounded-md border-transparent bg-muted/60 text-sm focus-visible:ring-1"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Baseline className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font size stepper */}
      <div className="mx-1 flex h-9 shrink-0 items-center rounded-md bg-muted/60">
        <Button
          variant="ghost" size="icon" aria-label="Decrease font size"
          className="h-9 w-7 rounded-none rounded-l-md text-muted-foreground"
          onClick={() => {
            const i = FONT_SIZES.indexOf(api.fmt.fontSize)
            const next = FONT_SIZES[Math.max(0, i - 1)] ?? 8
            api.applyFontSize(next)
          }}
        >
          <span className="text-xs font-semibold">−</span>
        </Button>
        <span className="w-8 text-center text-sm tabular-nums">{api.fmt.fontSize}</span>
        <Button
          variant="ghost" size="icon" aria-label="Increase font size"
          className="h-9 w-7 rounded-none rounded-r-md text-muted-foreground"
          onClick={() => {
            const i = FONT_SIZES.indexOf(api.fmt.fontSize)
            const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, i + 1)] ?? 11
            api.applyFontSize(next)
          }}
        >
          <span className="text-xs font-semibold">+</span>
        </Button>
      </div>

      <TB icon={Bold} label="Bold (Ctrl+B)" active={api.fmt.bold} onClick={() => api.exec("bold")} iconClassName="font-black" />
      <TB icon={Italic} label="Italic (Ctrl+I)" active={api.fmt.italic} onClick={() => api.exec("italic")} iconClassName="italic" />
      <TB icon={Underline} label="Underline (Ctrl+U)" active={api.fmt.underline} onClick={() => api.exec("underline")} />
      <TB icon={Strikethrough} label="Strikethrough" active={api.fmt.strike} onClick={() => api.exec("strikeThrough")} />

      {/* Text color */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost" size="icon" aria-label="Text color"
                className="relative h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
              >
                <Text className="h-4.5 w-4.5" />
                <span className="absolute bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-sm" style={{ backgroundColor: lastTextColor }} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Text color</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-60 p-0">
          <PaletteGrid
            onPick={(c) => {
              setLastTextColor(c)
              api.exec("foreColor", c)
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Highlight */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost" size="icon" aria-label="Highlight color"
                className="relative h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
              >
                <Highlighter className="h-4.5 w-4.5" />
                <span className="absolute bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-sm" style={{ backgroundColor: lastHighlight }} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Highlight</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-60 p-0">
          <PaletteGrid
            allowNone
            onPick={(c) => {
              if (c === "transparent") {
                api.exec("hiliteColor", "transparent")
              } else {
                setLastHighlight(c)
                api.exec("hiliteColor", c)
              }
            }}
          />
        </PopoverContent>
      </Popover>

      <div className="mx-1 h-6 w-px shrink-0 bg-border" />

      <TB icon={Link} label="Insert link (Ctrl+K)" active={api.fmt.link} onClick={() => api.openDialog("link")} />
      <TB icon={ImagePlus} label="Insert image" onClick={() => api.openDialog("image")} />

      <div className="mx-1 h-6 w-px shrink-0 bg-border" />

      {/* Alignment */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="icon" aria-label="Alignment"
                className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
              >
                {api.fmt.align === "center" ? (
                  <AlignCenter className="h-4.5 w-4.5" />
                ) : api.fmt.align === "right" ? (
                  <AlignRight className="h-4.5 w-4.5" />
                ) : api.fmt.align === "full" ? (
                  <AlignJustify className="h-4.5 w-4.5" />
                ) : (
                  <AlignLeft className="h-4.5 w-4.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Align</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => api.applyAlignment("left")}><AlignLeft className="h-4 w-4" /> Left</DropdownMenuItem>
          <DropdownMenuItem onClick={() => api.applyAlignment("center")}><AlignCenter className="h-4 w-4" /> Center</DropdownMenuItem>
          <DropdownMenuItem onClick={() => api.applyAlignment("right")}><AlignRight className="h-4 w-4" /> Right</DropdownMenuItem>
          <DropdownMenuItem onClick={() => api.applyAlignment("full")}><AlignJustify className="h-4 w-4" /> Justified</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Line spacing */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="icon" aria-label="Line spacing"
                className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
              >
                <div className="flex flex-col items-center gap-[3px]">
                  <span className="block h-[1.5px] w-4 rounded bg-current" />
                  <span className="block h-[1.5px] w-4 rounded bg-current" />
                  <span className="block h-[1.5px] w-4 rounded bg-current" />
                </div>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Line &amp; paragraph spacing</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          {[1, 1.15, 1.5, 2].map((v) => (
            <DropdownMenuItem key={v} onClick={() => api.applyLineSpacing(v)}>
              <span className="w-12 tabular-nums">{v}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-6 w-px shrink-0 bg-border" />

      <TB icon={ListOrdered} label="Numbered list" active={api.fmt.ol} onClick={() => api.exec("insertOrderedList")} />
      <TB icon={List} label="Bulleted list" active={api.fmt.ul} onClick={() => api.exec("insertUnorderedList")} />
      <TB icon={Outdent} label="Decrease indent" onClick={() => api.exec("outdent")} />
      <TB icon={Indent} label="Increase indent" onClick={() => api.exec("indent")} />
      <TB icon={RemoveFormatting} label="Clear formatting (Ctrl+\)" onClick={api.clearFormatting} />

      <div className="ml-1 mr-1 h-6 w-px shrink-0 bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => api.openDialog("helpwrite")}
            className="h-9 shrink-0 gap-1.5 rounded-full border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden text-xs font-medium sm:inline">Help me write</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Draft content with AI</TooltipContent>
      </Tooltip>

      <div className="ml-auto hidden shrink-0 items-center gap-1 pr-1 text-xs text-muted-foreground lg:flex">
        <ChevronDown className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}
