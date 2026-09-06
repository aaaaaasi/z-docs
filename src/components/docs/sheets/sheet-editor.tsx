"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Star,
  Trash2,
} from "lucide-react"
import { cellRef, fmtNum, parseNumeric, parseRef } from "./cells"
import { evaluateSheet } from "./formula"
import { csvEscape } from "../forms/forms-utils"
import { exportSafeName } from "@/lib/print-html"
import { useToast } from "@/hooks/use-toast"
import { Toolbar } from "./sheet-toolbar"
import { useSheetStore } from "./sheet-store"
import { SheetGrid } from "./grid"
import { useI18n } from "@/lib/i18n"
import { LangToggle } from "@/components/docs/lang-toggle"

/* ------------------------------- title bar ------------------------------- */

function TitleEditor() {
  const title = useSheetStore((s) => s.title)
  const renameCurrentTitle = useSheetStore((s) => s.renameCurrentTitle)
  const { t } = useI18n()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const clean = draft.trim().slice(0, 120)
    if (clean && clean !== title) void renameCurrentTitle(clean)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
        className="h-8 w-40 max-w-[40vw] text-[15px] sm:w-64"
        aria-label={t("Spreadsheet title")}
        maxLength={120}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(title)
        setEditing(true)
      }}
      title={title}
      className="h-9 max-w-[45vw] truncate rounded-md px-2 text-[15px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
      aria-label={t("Rename spreadsheet (current: {title})", { title })}
    >
      {title}
    </button>
  )
}

function SaveStatus() {
  const saveState = useSheetStore((s) => s.saveState)
  const { t } = useI18n()
  if (saveState === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t("Saving…")}
      </span>
    )
  }
  if (saveState === "error") {
    return (
      <span className="text-xs text-destructive" role="status">
        {t("Unable to save")}
      </span>
    )
  }
  return (
    <span className="hidden text-xs text-muted-foreground sm:inline" role="status">
      {t("All changes saved to Z-Drive")}
    </span>
  )
}

/* ------------------------------- formula bar ------------------------------ */

function FormulaBar({ gridRef }: { gridRef: React.RefObject<HTMLDivElement | null> }) {
  const active = useSheetStore((s) => s.active)
  const data = useSheetStore((s) => s.data)
  const editing = useSheetStore((s) => s.editing)
  const beginEdit = useSheetStore((s) => s.beginEdit)
  const updateDraft = useSheetStore((s) => s.updateDraft)
  const commitEdit = useSheetStore((s) => s.commitEdit)
  const cancelEdit = useSheetStore((s) => s.cancelEdit)
  const { t } = useI18n()

  const ref = cellRef(active.r, active.c)
  const raw = editing ? editing.draft : data.cells[ref]?.v ?? ""

  return (
    <div className="flex h-10 items-center gap-1.5 border-b px-2">
      <div
        className="tnum w-16 shrink-0 rounded bg-muted py-1 text-center font-mono text-xs text-foreground"
        aria-label={t("Active cell {ref}", { ref })}
      >
        {ref}
      </div>
      <span aria-hidden className="select-none font-serif text-[13px] italic text-muted-foreground">
        fx
      </span>
      <Input
        value={raw}
        onFocus={() => {
          if (!editing) beginEdit(ref, undefined, false, "bar")
        }}
        onChange={(e) => updateDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitEdit(e.shiftKey ? "up" : "down")
            gridRef.current?.focus({ preventScroll: true })
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancelEdit()
            gridRef.current?.focus({ preventScroll: true })
          } else if (e.key === "Tab") {
            e.preventDefault()
            commitEdit(e.shiftKey ? "left" : "right")
            gridRef.current?.focus({ preventScroll: true })
          }
        }}
        placeholder={t("Enter a value or formula, e.g. =SUM(A1:A5)")}
        aria-label={t("Formula input")}
        spellCheck={false}
        autoComplete="off"
        className="h-7 flex-1 border-transparent bg-transparent font-mono text-[13px] shadow-none focus-visible:border-border focus-visible:bg-background focus-visible:shadow-none"
      />
    </div>
  )
}

/* ------------------------------- status bar ------------------------------- */

function StatusBar() {
  const data = useSheetStore((s) => s.data)
  const computed = useSheetStore((s) => s.computed)
  const sel = useSheetStore((s) => s.sel)
  const { t } = useI18n()

  const stats = React.useMemo(() => {
    const cells: number[] = []
    const size = (sel.r1 - sel.r0 + 1) * (sel.c1 - sel.c0 + 1)
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        const n = parseNumeric(computed[cellRef(r, c)] ?? "")
        if (n !== null) cells.push(n)
      }
    }
    if (size === 1) {
      const ref = cellRef(sel.r0, sel.c0)
      const v = computed[ref] ?? ""
      return v ? v : null
    }
    if (size >= 2 && cells.length >= 1) {
      const sum = cells.reduce((a, b) => a + b, 0)
      return `${t("Sum: {n}", { n: fmtNum(sum) })} · ${t("Avg: {n}", {
        n: fmtNum(sum / cells.length),
      })} · ${t("Count: {n}", { n: cells.length })}`
    }
    return null
  }, [sel, computed, t])

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t bg-muted/40 px-3 text-xs text-muted-foreground">
      <span className="tnum">
        {t("Sheet1 · {rows} rows × {cols} cols", { rows: data.rows, cols: data.cols })}
      </span>
      <span className="tnum truncate pl-4" aria-live="polite">
        {stats ?? ""}
      </span>
    </div>
  )
}

/* -------------------------------- editor --------------------------------- */

export function SheetEditor() {
  const loadingSheet = useSheetStore((s) => s.loadingSheet)
  const backToList = useSheetStore((s) => s.backToList)
  const starred = useSheetStore((s) => s.starred)
  const toggleCurrentStar = useSheetStore((s) => s.toggleCurrentStar)
  const trashCurrent = useSheetStore((s) => s.trashCurrent)
  const undo = useSheetStore((s) => s.undo)
  const redo = useSheetStore((s) => s.redo)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  const { toast } = useToast()

  /** Export the current sheet's used range as CSV — computed formula values,
   *  proper quote/comma/newline escaping and a BOM so Excel opens UTF-8. */
  const downloadCsv = React.useCallback(() => {
    const st = useSheetStore.getState()
    const evals = evaluateSheet(st.data)
    const cells = st.data.cells
    let maxR = 0
    let maxC = 0
    for (const ref of Object.keys(cells)) {
      const v = evals[ref] ?? cells[ref]?.v ?? ""
      if (v === "") continue
      const p = parseRef(ref)
      if (!p) continue
      if (p.r > maxR) maxR = p.r
      if (p.c > maxC) maxC = p.c
    }
    const rows: string[] = []
    // cellRef()/parseRef() are 0-based — walk the full used range inclusive
    for (let r = 0; r <= maxR; r++) {
      const row: string[] = []
      for (let c = 0; c <= maxC; c++) {
        const ref = cellRef(r, c)
        row.push(csvEscape(evals[ref] ?? cells[ref]?.v ?? ""))
      }
      rows.push(row.join(","))
    }
    const csv = rows.length ? rows.join("\r\n") : ""
    const name = exportSafeName(st.title || "", "spreadsheet")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // async revoke — synchronous revoke can kill the transfer on slow browsers
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    toast({ title: t("CSV downloaded"), description: `${name}.csv` })
  }, [t, toast])

  // grid owns the keyboard as soon as the editor opens
  React.useEffect(() => {
    gridRef.current?.focus({ preventScroll: true })
  }, [])

  // editor-level shortcuts: undo / redo (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) — only when
  // focus is not inside an input (browser text undo wins there)
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === "z") {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    } else if (k === "y") {
      e.preventDefault()
      redo()
    }
  }

  if (loadingSheet) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <div className="flex h-14 items-center gap-3 border-b px-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex h-12 items-center gap-2 border-b px-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-md" />
          ))}
        </div>
        <div className="flex-1 space-y-2 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background outline-none" onKeyDown={onKeyDown}>
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2 sm:gap-2 sm:px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label={t("Back to spreadsheets")} onClick={backToList}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{t("Back to spreadsheets")}</TooltipContent>
        </Tooltip>
        <span
          aria-hidden
          className="mx-0.5 flex h-6 w-6 items-center justify-center rounded bg-emerald-600/12 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-300/25 sm:h-7 sm:w-7"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
        <TitleEditor />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
              aria-label={starred ? t("Remove star") : t("Add star")}
              aria-pressed={starred}
              onClick={() => void toggleCurrentStar()}
            >
              <Star className={`h-4.5 w-4.5 ${starred ? "fill-amber-500 text-amber-500" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {starred ? t("Remove star") : t("Add star")}
          </TooltipContent>
        </Tooltip>
        <div className="ml-auto flex items-center gap-2">
          <SaveStatus />
          <span className="hidden min-[420px]:inline-flex">
            <LangToggle />
          </span>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground sm:h-9 sm:w-9" aria-label={t("Spreadsheet menu")}>
                    <FileSpreadsheet className="h-4.5 w-4.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{t("More")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={backToList}>
                <FileSpreadsheet className="h-4 w-4" /> {t("Find spreadsheet in list")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadCsv}>
                <Download className="h-4 w-4" /> {t("Download CSV")}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void trashCurrent()}>
                <Trash2 className="h-4 w-4" /> {t("Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Toolbar />
      <FormulaBar gridRef={gridRef} />
      <SheetGrid containerRef={gridRef} />
      <StatusBar />
    </div>
  )
}
