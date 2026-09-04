"use client"

import { api } from "@/lib/api-client"
import { toast } from "@/hooks/use-toast"
import { EMPTY_SHEET, type SheetDTO, type SheetMeta } from "@/lib/workspace-types"
import { cleanSheetData, countCells, parseSheetData } from "./cells"
import { evaluateSheet } from "./formula"
import { flushSheetSave } from "./sheet-autosave"
import type { SheetsState } from "./sheet-store"

type Set = (partial: Partial<SheetsState>) => void
type Get = () => SheetsState

const JSON_HEADERS = { "Content-Type": "application/json" }

/** list + navigation actions for the sheets store (composed into the store) */
export function createListActions(set: Set, get: Get) {
  const actions: Pick<
    SheetsState,
    | "loadSheets"
    | "setFilter"
    | "setSearch"
    | "createSheet"
    | "openSheet"
    | "backToList"
    | "renameSheet"
    | "toggleStar"
    | "trashSheet"
    | "restoreSheet"
    | "deleteForever"
    | "duplicateSheet"
  > = {
  /* ------------------------------ list ------------------------------ */

  loadSheets: async (opts) => {
    if (!opts?.silent) set({ listLoading: true, listError: null })
    try {
      const { filter, search } = get()
      const params = new URLSearchParams({ filter })
      if (search.trim()) params.set("q", search.trim())
      const res = await api(`/api/sheets?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed to load spreadsheets (${res.status})`)
      const data = (await res.json()) as { sheets: SheetMeta[] }
      const sheets = data.sheets ?? []
      set({ sheets })
      // lazily hydrate "N cells" meta (list endpoint has no cell counts)
      void hydrateCellCounts(sheets, set, get)
    } catch (e) {
      set({ listError: e instanceof Error ? e.message : "Something went wrong" })
    } finally {
      set({ listLoading: false })
    }
  },

  setFilter: (f) => {
    set({ filter: f })
    void get().loadSheets()
  },

  setSearch: (q) => set({ search: q }),

  createSheet: async () => {
    if (get().creating) return
    set({ creating: true })
    try {
      const res = await api("/api/sheets", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ title: "Untitled spreadsheet", data: JSON.stringify(EMPTY_SHEET) }),
      })
      if (!res.ok) throw new Error("create failed")
      const data = (await res.json()) as { sheet: SheetDTO }
      get().openSheet(data.sheet.id)
    } catch {
      toast({ title: "Couldn't create spreadsheet", description: "Please try again.", variant: "destructive" })
    } finally {
      set({ creating: false })
    }
  },

  openSheet: async (id) => {
    set({ loadingSheet: true })
    try {
      const res = await api(`/api/sheets/${id}`)
      if (!res.ok) throw new Error(`Failed to open (${res.status})`)
      const body = (await res.json()) as { sheet: SheetDTO }
      const sheet = body.sheet
      const data = parseSheetData(sheet.data)
      set({
        view: "editor",
        sheetId: sheet.id,
        title: sheet.title,
        starred: sheet.starred,
        data,
        computed: evaluateSheet(data),
        undoStack: [],
        redoStack: [],
        editing: null,
        anchor: { r: 0, c: 0 },
        active: { r: 0, c: 0 },
        sel: { r0: 0, c0: 0, r1: 0, c1: 0 },
        saveState: "idle",
        loadingSheet: false,
      })
    } catch {
      set({ view: "list", loadingSheet: false })
      toast({ title: "Couldn't open spreadsheet", description: "It may have been deleted.", variant: "destructive" })
      void get().loadSheets()
    }
  },

  backToList: () => {
    // flush a pending save immediately so nothing is lost on navigation
    flushSheetSave()
    set({ view: "list", sheetId: null, editing: null })
    void get().loadSheets()
  },

  renameSheet: async (id, title) => {
    const prev = get().sheets
    set({ sheets: prev.map((s) => (s.id === id ? { ...s, title } : s)) })
    try {
      await api(`/api/sheets/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ title }) })
    } catch {
      set({ sheets: prev })
      toast({ title: "Rename failed", variant: "destructive" })
    }
  },

  toggleStar: async (id) => {
    const cur = get().sheets.find((s) => s.id === id)
    if (!cur) return
    const next = !cur.starred
    set({ sheets: get().sheets.map((s) => (s.id === id ? { ...s, starred: next } : s)) })
    if (get().sheetId === id) set({ starred: next })
    try {
      await api(`/api/sheets/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ starred: next }) })
      if (get().filter === "starred" && !next) void get().loadSheets({ silent: true })
    } catch {
      set({ sheets: get().sheets.map((s) => (s.id === id ? { ...s, starred: !next } : s)) })
    }
  },

  trashSheet: async (id) => {
    set({ sheets: get().sheets.filter((s) => s.id !== id) })
    try {
      await api(`/api/sheets/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ trashed: true }) })
    } catch {
      void get().loadSheets({ silent: true })
    }
  },

  restoreSheet: async (id) => {
    set({ sheets: get().sheets.filter((s) => s.id !== id) })
    try {
      await api(`/api/sheets/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ trashed: false }) })
    } catch {
      void get().loadSheets({ silent: true })
    }
  },

  deleteForever: async (id) => {
    set({ sheets: get().sheets.filter((s) => s.id !== id) })
    try {
      await api(`/api/sheets/${id}`, { method: "DELETE" })
    } catch {
      void get().loadSheets({ silent: true })
    }
  },

  duplicateSheet: async (id) => {
    try {
      const src = get().sheets.find((s) => s.id === id)
      let dataStr: string | undefined
      try {
        const res = await api(`/api/sheets/${id}`)
        if (res.ok) {
          const body = (await res.json()) as { sheet: SheetDTO }
          // keep only non-empty cells when copying
          const parsed = parseSheetData(body.sheet.data)
          dataStr = JSON.stringify(cleanSheetData(parsed))
        }
      } catch {
        // copy without data beats failing outright
      }
      const res = await api("/api/sheets", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ title: `Copy of ${src?.title ?? "Untitled spreadsheet"}`, data: dataStr }),
      })
      if (!res.ok) throw new Error("duplicate failed")
      await get().loadSheets({ silent: true })
      toast({ title: "Spreadsheet copied", description: `“Copy of ${src?.title ?? "Untitled"}” is ready.` })
    } catch {
      toast({ title: "Couldn't copy spreadsheet", variant: "destructive" })
    }
  },
  }
  return actions
}

/* -------------------- lazy cell-count hydration (list) -------------------- */

async function hydrateCellCounts(sheets: SheetMeta[], set: Set, get: Get) {
  const missing = sheets.filter((s) => get().cellCounts[s.id] === undefined)
  if (missing.length === 0) return
  const results = await Promise.all(
    missing.map(async (s) => {
      try {
        const res = await api(`/api/sheets/${s.id}`)
        if (!res.ok) return null
        const body = (await res.json()) as { sheet: SheetDTO }
        return { id: s.id, n: countCells(parseSheetData(body.sheet.data)) }
      } catch {
        return null
      }
    })
  )
  const counts = { ...get().cellCounts }
  let touched = false
  for (const r of results) {
    if (r) {
      counts[r.id] = r.n
      touched = true
    }
  }
  if (touched) set({ cellCounts: counts })
}
