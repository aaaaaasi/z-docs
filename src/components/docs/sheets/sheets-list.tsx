"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useDocsStore } from "@/store/docs-store"
import { relativeTime } from "@/lib/doc-utils"
import type { SheetMeta } from "@/lib/workspace-types"
import { useSheetStore, type SheetFilter } from "./sheet-store"
import { SheetCard } from "./sheet-card"

/* ------------------------------- branding ------------------------------- */

export function SheetsLogo() {
  return (
    <div className="flex select-none items-center gap-2" aria-label="Z-Sheets">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600/12 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-300/25"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </span>
      <span className="font-editorial text-[18px] font-medium tracking-tight text-foreground">Z-Sheets</span>
    </div>
  )
}

/* ------------------------------ filter tabs ------------------------------ */

const TABS: { id: SheetFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "starred", label: "Starred" },
  { id: "trashed", label: "Trash" },
]

function FilterTabs({ className = "" }: { className?: string }) {
  const filter = useSheetStore((s) => s.filter)
  const setFilter = useSheetStore((s) => s.setFilter)
  return (
    <div role="tablist" aria-label="Filter spreadsheets" className={`flex rounded-full bg-muted p-0.5 ${className}`}>
      {TABS.map((t) => {
        const on = filter === t.id
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => setFilter(t.id)}
            className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
              on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ empty states ----------------------------- */

function EmptyState({ filter, search }: { filter: SheetFilter; search: string }) {
  const createSheet = useSheetStore((s) => s.createSheet)
  const creating = useSheetStore((s) => s.creating)
  const setSearch = useSheetStore((s) => s.setSearch)
  const loadSheets = useSheetStore((s) => s.loadSheets)

  let title = "No spreadsheets yet"
  let desc = "Create a spreadsheet to get started."
  let action: React.ReactNode = null
  if (search.trim()) {
    title = "No matching spreadsheets"
    desc = `Nothing matches “${search.trim()}”.`
    action = (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSearch("")
          void loadSheets()
        }}
      >
        Clear search
      </Button>
    )
  } else if (filter === "starred") {
    title = "No starred spreadsheets"
    desc = "Star a spreadsheet to keep it close at hand."
  } else if (filter === "trashed") {
    title = "Trash is empty"
    desc = "Deleted spreadsheets will appear here before they're gone forever."
  } else {
    action = (
      <Button size="sm" onClick={() => void createSheet()} disabled={creating}>
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        New spreadsheet
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-300/20">
        <FileSpreadsheet className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{desc}</p>
      </div>
      {action}
    </div>
  )
}

/* --------------------------------- card --------------------------------- */

export function SheetsList() {
  const goHome = useDocsStore((s) => s.goHome)
  const sheets = useSheetStore((s) => s.sheets)
  const listLoading = useSheetStore((s) => s.listLoading)
  const listError = useSheetStore((s) => s.listError)
  const filter = useSheetStore((s) => s.filter)
  const search = useSheetStore((s) => s.search)
  const cellCounts = useSheetStore((s) => s.cellCounts)
  const creating = useSheetStore((s) => s.creating)
  const createSheet = useSheetStore((s) => s.createSheet)
  const setSearch = useSheetStore((s) => s.setSearch)
  const loadSheets = useSheetStore((s) => s.loadSheets)
  const renameSheet = useSheetStore((s) => s.renameSheet)
  const deleteForever = useSheetStore((s) => s.deleteForever)

  const { toast } = useToast()
  const [local, setLocal] = React.useState("")
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<SheetMeta | null>(null)

  // debounced search → refetch (mirrors the Z-Docs home behavior)
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (local !== search) {
        setSearch(local)
        void loadSheets()
      }
    }, 300)
    return () => clearTimeout(t)
  }, [local, search, setSearch, loadSheets])

  const heading = filter === "starred" ? "Starred" : filter === "trashed" ? "Trash" : "All spreadsheets"
  const showSkeleton = listLoading && sheets.length === 0
  const showEmpty = !showSkeleton && sheets.length === 0

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Back to Z-Docs" onClick={goHome}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Back to Z-Docs</TooltipContent>
        </Tooltip>
        <SheetsLogo />
        <div className="relative ml-2 hidden max-w-md flex-1 items-center sm:flex">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Search spreadsheets"
            aria-label="Search spreadsheets"
            className="h-9 rounded-full border-transparent bg-muted pl-10 pr-4 text-[13px] focus-visible:border-border focus-visible:bg-background"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <FilterTabs className="hidden sm:flex" />
          <Button onClick={() => void createSheet()} disabled={creating} className="h-10 rounded-full px-4">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">New spreadsheet</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </header>

      {/* mobile search + filters */}
      <div className="flex items-center gap-2 border-b bg-background px-3 py-2 sm:hidden">
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Search spreadsheets"
            aria-label="Search spreadsheets"
            className="h-9 rounded-full border-transparent bg-muted pl-9 pr-3 text-[13px] focus-visible:border-border focus-visible:bg-background"
          />
        </div>
        <FilterTabs />
      </div>

      {/* content */}
      <main className="slim-scroll flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-medium text-foreground">{heading}</h1>
            {!showSkeleton && !showEmpty && (
              <p className="text-xs text-muted-foreground tnum">
                {sheets.length} spreadsheet{sheets.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {listError && (
            <div role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
              {listError}
            </div>
          )}

          {showSkeleton && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showEmpty && <EmptyState filter={filter} search={search} />}

          {!showSkeleton && !showEmpty && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sheets.map((sheet) => (
                <SheetCard
                  key={sheet.id}
                  sheet={sheet}
                  cellCount={cellCounts[sheet.id]}
                  renaming={renamingId === sheet.id}
                  onStartRename={() => setRenamingId(sheet.id)}
                  onCancelRename={() => setRenamingId(null)}
                  onCommitRename={(title) => {
                    setRenamingId(null)
                    const clean = title.trim().slice(0, 120)
                    if (clean && clean !== sheet.title) void renameSheet(sheet.id, clean)
                  }}
                  onDeleteForever={() => setDeleteTarget(sheet)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* delete-forever confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}” forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. The spreadsheet and everything in it will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  void deleteForever(deleteTarget.id)
                  toast({ title: "Deleted forever", description: `“${deleteTarget.title}” is gone.` })
                }
                setDeleteTarget(null)
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
