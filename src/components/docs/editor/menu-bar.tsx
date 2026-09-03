"use client"

import * as React from "react"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import type { EditorApi } from "./editor-types"
import {
  FilePlus2, Copy, Pencil, History, Download, Printer, Trash2, Undo2, Redo2, Scissors,
  ClipboardCopy, ClipboardPaste, Replace, Moon, Maximize, ZoomIn, Link, ImagePlus,
  Minus, CalendarDays, Sparkles, Bold, Italic, Underline, Strikethrough, Superscript,
  Subscript, RemoveFormatting, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, TextQuote, Calculator, Keyboard, Info
} from "lucide-react"
import { cn } from "@/lib/utils"

function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded px-2.5 py-1 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MenuBar({ api }: { api: EditorApi }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === "dark"

  return (
    <div className="no-print flex h-10 items-center gap-0.5 border-b bg-background px-2" role="menubar" aria-label="Document menus">
      <Menu label="File">
        <DropdownMenuItem onClick={api.duplicate}><FilePlus2 className="h-4 w-4" /> Make a copy</DropdownMenuItem>
        <DropdownMenuItem onClick={api.focusTitle}><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("versions")}><History className="h-4 w-4" /> Version history</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.downloadDoc("doc")}><Download className="h-4 w-4" /> Download Word (.doc)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.downloadDoc("html")}><Download className="h-4 w-4" /> Download HTML</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.downloadDoc("txt")}><Download className="h-4 w-4" /> Download text (.txt)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={api.printDoc}><Printer className="h-4 w-4" /> Print <DropdownMenuShortcut>⌘P</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={api.moveToTrash} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Move to trash
        </DropdownMenuItem>
      </Menu>

      <Menu label="Edit">
        <DropdownMenuItem onClick={() => api.exec("undo")}><Undo2 className="h-4 w-4" /> Undo <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("redo")}><Redo2 className="h-4 w-4" /> Redo <DropdownMenuShortcut>⌘Y</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.exec("cut")}><Scissors className="h-4 w-4" /> Cut</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("copy")}><ClipboardCopy className="h-4 w-4" /> Copy</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("paste")}><ClipboardPaste className="h-4 w-4" /> Paste</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("selectAll")}><ClipboardCopy className="h-4 w-4" /> Select all <DropdownMenuShortcut>⌘A</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("find")}>
          <Replace className="h-4 w-4" /> Find and replace <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
        </DropdownMenuItem>
      </Menu>

      <Menu label="View">
        <DropdownMenuCheckboxItem
          checked={dark}
          onCheckedChange={() => setTheme(dark ? "light" : "dark")}
        >
          <Moon className="h-4 w-4" /> Dark mode
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={api.spellCheck} onCheckedChange={api.setSpellCheck}>
          <Calculator className="h-4 w-4" /> Spell check
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
          <Maximize className="h-4 w-4" /> Full screen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.setZoom(0.75)}><ZoomIn className="h-4 w-4" /> Zoom 75%</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.setZoom(1)}><ZoomIn className="h-4 w-4" /> Zoom 100%</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.setZoom(1.25)}><ZoomIn className="h-4 w-4" /> Zoom 125%</DropdownMenuItem>
      </Menu>

      <Menu label="Insert">
        <DropdownMenuItem onClick={() => api.openDialog("link")}><Link className="h-4 w-4" /> Link <DropdownMenuShortcut>⌘K</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("image")}><ImagePlus className="h-4 w-4" /> Image</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("insertHorizontalRule")}><Minus className="h-4 w-4" /> Horizontal line</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            api.exec("insertText", new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))
          }
        >
          <CalendarDays className="h-4 w-4" /> Today&apos;s date
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.openDialog("helpwrite")}>
          <Sparkles className="h-4 w-4 text-primary" /> Help me write (AI)
        </DropdownMenuItem>
      </Menu>

      <Menu label="Format">
        <DropdownMenuItem onClick={() => api.exec("bold")}><Bold className="h-4 w-4" /> Bold <DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("italic")}><Italic className="h-4 w-4" /> Italic <DropdownMenuShortcut>⌘I</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("underline")}><Underline className="h-4 w-4" /> Underline <DropdownMenuShortcut>⌘U</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("strikeThrough")}><Strikethrough className="h-4 w-4" /> Strikethrough</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.exec("superscript")}><Superscript className="h-4 w-4" /> Superscript</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("subscript")}><Subscript className="h-4 w-4" /> Subscript</DropdownMenuItem>
        <DropdownMenuItem onClick={api.clearFormatting}><RemoveFormatting className="h-4 w-4" /> Clear formatting <DropdownMenuShortcut>⌘\</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => api.exec("insertUnorderedList")}><List className="h-4 w-4" /> Bulleted list</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /> Numbered list</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.exec("formatBlock", "blockquote")}><TextQuote className="h-4 w-4" /> Quote block</DropdownMenuItem>
      </Menu>

      <Menu label="Tools">
        <DropdownMenuItem onClick={() => api.openDialog("wordcount")}><Calculator className="h-4 w-4" /> Word count</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("versions")}><History className="h-4 w-4" /> Version history</DropdownMenuItem>
      </Menu>

      <Menu label="Help">
        <DropdownMenuItem onClick={() => api.openDialog("shortcuts")}><Keyboard className="h-4 w-4" /> Keyboard shortcuts</DropdownMenuItem>
        <DropdownMenuItem onClick={() => api.openDialog("about")}><Info className="h-4 w-4" /> About Z-Docs</DropdownMenuItem>
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
            title={label}
            aria-label={label}
            onClick={() => api.applyAlignment(align)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              api.fmt.align === align && "bg-muted text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  )
}
