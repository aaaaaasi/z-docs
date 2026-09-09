"use client"

import * as React from "react"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { useI18n, localeOf } from "@/lib/i18n"
import type { EditorApi } from "./editor-types"
import { ScrollFade } from "@/components/docs/scroll-fade"
import {
  FilePlus2, Copy, Pencil, History, Download, Printer, Trash2, Undo2, Redo2, Scissors,
  ClipboardCopy, ClipboardPaste, Replace, Moon, Maximize, ZoomIn, Link, ImagePlus,
  Minus, CalendarDays, Sparkles, Bold, Italic, Underline, Strikethrough, Superscript,
  Subscript, RemoveFormatting, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, TextQuote, Calculator, Keyboard, Info, MessageSquarePlus, Table,
  Rows3, Columns3, Heading, ChevronRight, ListTree, Smile, Mic, FileDown, TableCellsMerge, TableCellsSplit,
  SpellCheck, BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"

function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="max-sm:h-11 max-sm:px-3 rounded px-2.5 py-1 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground max-sm:py-2">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MenuBar({ api }: { api: EditorApi }) {
  const { t, lang } = useI18n()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === "dark"

  return (
    <div
      className="no-print no-scrollbar relative flex h-10 max-sm:h-11 items-center gap-0.5 overflow-x-auto border-b bg-background px-2 max-sm:gap-0 max-sm:px-1"
      role="menubar"
      aria-label={t("Document menus")}
    >
      <ScrollFade className="max-sm:block sm:hidden" />
      <Menu label={t("File")}>
        <DropdownMenuItem onClick={api.duplicate}><FilePlus2 className="h-4 w-4" /> {t("Make a copy")}</DropdownMenuItem>
        <DropdownMenuItem onClick={api.focusTitle}><Pencil className="h-4 w-4" /> {t("Rename")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("versions")}><History className="h-4 w-4" /> {t("Version history")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.downloadPdf()}><FileDown className="h-4 w-4" /> {t("PDF document (.pdf)")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.downloadDoc("docx")}><Download className="h-4 w-4" /> {t("Word document (.docx)")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.downloadDoc("html")}><Download className="h-4 w-4" /> {t("Download HTML")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.downloadDoc("txt")}><Download className="h-4 w-4" /> {t("Download text (.txt)")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={api.printDoc}><Printer className="h-4 w-4" /> {t("Print")} <DropdownMenuShortcut>⌘P</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={api.moveToTrash} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> {t("Move to trash")}
        </DropdownMenuItem>
      </Menu>

      <Menu label={t("Edit")}>
        <DropdownMenuItem onClick={() => api.exec("undo")}><Undo2 className="h-4 w-4" /> {t("Undo")} <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("redo")}><Redo2 className="h-4 w-4" /> {t("Redo")} <DropdownMenuShortcut>⌘Y</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.exec("cut")}><Scissors className="h-4 w-4" /> {t("Cut")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("copy")}><ClipboardCopy className="h-4 w-4" /> {t("Copy")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("paste")}><ClipboardPaste className="h-4 w-4" /> {t("Paste")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("selectAll")}><ClipboardCopy className="h-4 w-4" /> {t("Select all")} <DropdownMenuShortcut>⌘A</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("find")}>
          <Replace className="h-4 w-4" /> {t("Find and replace")} <DropdownMenuShortcut>⌘H</DropdownMenuShortcut>
        </DropdownMenuItem>
      </Menu>

      <Menu label={t("View")}>
        <DropdownMenuCheckboxItem
          checked={api.outlineOpen}
          onCheckedChange={(v) => api.toggleOutline(!!v)}
        >
          <ListTree className="h-4 w-4" /> {t("Show document outline")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={api.insightsOpen}
          onCheckedChange={(v) => api.toggleInsights(!!v)}
        >
          <BarChart3 className="h-4 w-4" /> {t("Show writing insights")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={dark}
          onCheckedChange={() => setTheme(dark ? "light" : "dark")}
        >
          <Moon className="h-4 w-4" /> {t("Dark mode")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={api.spellCheck} onCheckedChange={api.setSpellCheck}>
          <Calculator className="h-4 w-4" /> {t("Spell check")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
          <Maximize className="h-4 w-4" /> {t("Full screen")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.setZoom(0.75)}><ZoomIn className="h-4 w-4" /> {t("Zoom 75%")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.setZoom(1)}><ZoomIn className="h-4 w-4" /> {t("Zoom 100%")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.setZoom(1.25)}><ZoomIn className="h-4 w-4" /> {t("Zoom 125%")}</DropdownMenuItem>
      </Menu>

      <Menu label={t("Insert")}>
        <DropdownMenuItem onClick={() => api.openDialog("link")}><Link className="h-4 w-4" /> {t("Link")} <DropdownMenuShortcut>⌘K</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("image")}><ImagePlus className="h-4 w-4" /> {t("Image")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("insertHorizontalRule")}><Minus className="h-4 w-4" /> {t("Horizontal line")}</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            api.exec("insertText", new Date().toLocaleDateString(localeOf(lang), { year: "numeric", month: "long", day: "numeric" }))
          }
        >
          <CalendarDays className="h-4 w-4" /> {t("Today's date")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("table")}>
          <Table className="h-4 w-4" /> {t("Table")} <DropdownMenuShortcut>⌘⇧T</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("emoji")}>
          <Smile className="h-4 w-4" /> {t("Emoji & symbols")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Table className="h-4 w-4" /> {t("Table options")}
            <ChevronRight className="ml-auto h-3.5 w-3.5" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuItem onClick={() => api.tableOp("row-above")}>
              <Rows3 className="h-4 w-4" /> {t("Insert row above")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => api.tableOp("row-below")}>
              <Rows3 className="h-4 w-4" /> {t("Insert row below")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => api.tableOp("col-left")}>
              <Columns3 className="h-4 w-4" /> {t("Insert column left")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => api.tableOp("col-right")}>
              <Columns3 className="h-4 w-4" /> {t("Insert column right")}
            </DropdownMenuItem>
            {api.tableInfo && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => api.tableOp("merge-right")} disabled={!api.tableInfo.canMergeRight}>
                  <TableCellsMerge className="h-4 w-4" /> {t("Merge cell right")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => api.tableOp("merge-down")} disabled={!api.tableInfo.canMergeDown}>
                  <TableCellsMerge className="h-4 w-4 -rotate-90" /> {t("Merge cell down")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => api.tableOp("split-cell")} disabled={!api.tableInfo.canSplit}>
                  <TableCellsSplit className="h-4 w-4" /> {t("Split cell")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => api.tableOp("toggle-header")}>
                  <Heading className="h-4 w-4" /> {api.tableInfo.hasHeader ? t("Remove header row") : t("Header row")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => api.tableOp("delete-row")} className="text-destructive focus:text-destructive">
                  <Rows3 className="h-4 w-4" /> {t("Delete row")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => api.tableOp("delete-col")} className="text-destructive focus:text-destructive">
                  <Columns3 className="h-4 w-4" /> {t("Delete column")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => api.tableOp("delete-table")} className="text-destructive focus:text-destructive">
                  <Table className="h-4 w-4" /> {t("Delete table")}
                </DropdownMenuItem>
              </>
            )}
            {!api.tableInfo && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {t("Place the caret inside a table to enable row & column tools.")}
              </div>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={api.openCommentComposer}>
          <MessageSquarePlus className="h-4 w-4" /> {t("Comment")} <DropdownMenuShortcut>⌘⌥M</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("helpwrite")}>
          <Sparkles className="h-4 w-4 text-primary" /> {t("Help me write (AI)")}
        </DropdownMenuItem>
      </Menu>

      <Menu label={t("Format")}>
        <DropdownMenuItem onClick={() => api.exec("bold")}><Bold className="h-4 w-4" /> {t("Bold")} <DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("italic")}><Italic className="h-4 w-4" /> {t("Italic")} <DropdownMenuShortcut>⌘I</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("underline")}><Underline className="h-4 w-4" /> {t("Underline")} <DropdownMenuShortcut>⌘U</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("strikeThrough")}><Strikethrough className="h-4 w-4" /> {t("Strikethrough")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.exec("superscript")}><Superscript className="h-4 w-4" /> {t("Superscript")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("subscript")}><Subscript className="h-4 w-4" /> {t("Subscript")}</DropdownMenuItem>
        <DropdownMenuItem onClick={api.clearFormatting}><RemoveFormatting className="h-4 w-4" /> {t("Clear formatting")} <DropdownMenuShortcut>⌘\</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.exec("insertUnorderedList")}><List className="h-4 w-4" /> {t("Bulleted list")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /> {t("Numbered list")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("formatBlock", "blockquote")}><TextQuote className="h-4 w-4" /> {t("Quote block")}</DropdownMenuItem>
      </Menu>

      <Menu label={t("Tools")}>
        <DropdownMenuItem onClick={() => api.openDialog("aitools")}>
          <Sparkles className="h-4 w-4 text-primary" /> {t("AI polish")}
          <DropdownMenuShortcut>⌥⌘A</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={api.toggleVoiceTyping}>
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <Mic className={cn("h-4 w-4", api.voiceListening && "text-primary")} strokeWidth={1.75} />
            {api.voiceListening && (
              <span aria-hidden className="absolute -right-1 -top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
            )}
          </span>
          <span className={api.voiceListening ? "text-primary" : undefined}>
            {api.voiceListening ? t("Stop voice typing") : t("Voice typing")}
          </span>
          <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("spellcheck")}>
          <SpellCheck className="h-4 w-4" /> {t("Spelling and grammar check…")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("wordcount")}><Calculator className="h-4 w-4" /> {t("Word count")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("writing")}>
          <BarChart3 className="h-4 w-4" /> {t("Writing studio")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("versions")}><History className="h-4 w-4" /> {t("Version history")}</DropdownMenuItem>
      </Menu>

      <Menu label={t("Help")}>
        <DropdownMenuItem onClick={() => api.openDialog("shortcuts")}><Keyboard className="h-4 w-4" /> {t("Keyboard shortcuts")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("about")}><Info className="h-4 w-4" /> {t("About Z-Docs")}</DropdownMenuItem>
      </Menu>

      {/* alignment quick access inside menubar right */}
      <div className="ml-auto hidden items-center gap-0.5 pr-1 sm:flex">
        {(
          [
            { icon: AlignLeft, align: "left" as const, label: "Align left" },
            { icon: AlignCenter, align: "center" as const, label: "Align center" },
            { icon: AlignRight, align: "right" as const, label: "Align right" },
            { icon: AlignJustify, align: "full" as const, label: "Justify" },
          ] as const
        ).map(({ icon: Icon, align, label }) => (
          <button
            key={align}
            title={t(label)}
            aria-label={t(label)}
            onClick={() => api.applyAlignment(align)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              api.fmt.align === align && "bg-muted text-foreground"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </div>
  )
}
