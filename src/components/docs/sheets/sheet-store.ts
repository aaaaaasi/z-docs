"use client"

import { create } from "zustand"
import { api } from "@/lib/api-client"
import { toast } from "@/hooks/use-toast"
import { getCurrentLang, tForLang } from "@/lib/i18n"
import { EMPTY_SHEET, type CellData, type SheetData, type SheetMeta } from "@/lib/workspace-types"
import { evaluateSheet } from "./formula"
import { createListActions } from "./sheet-list-actions"
import { clampPos, flushSheetSave, HISTORY_LIMIT, normSel, pushHistory, scheduleSave } from "./sheet-autosave"
import { cellRef, hasFormatting } from "./cells"

export type SheetFilter = "all" | "starred" | "trashed"
export type SaveState = "idle" | "saving" | "saved" | "error"
export interface Pos {
  r: number
  c: number
}
export interface GridSel {
  r0: number
  c0: number
  r1: number
  c1: number
}
export type EditMove = "down" | "up" | "left" | "right" | "none"

const JSON_HEADERS = { "Content-Type": "application/json" }

export interface SheetsState {
  view: "list" | "editor"
  /* list mode */
  sheets: SheetMeta[]
  listLoading: boolean
  listError: string | null
  filter: SheetFilter
  search: string
  /** id → non-empty cell count (hydrated lazily for card meta lines) */
  cellCounts: Record<string, number>
  creating: boolean
  /* editor mode */
  sheetId: string | null
  title: string
  starred: boolean
  data: SheetData
  computed: Record<string, string>
  anchor: Pos
  active: Pos
  sel: GridSel
  editing: { ref: string; draft: string; selectAll: boolean; source: "grid" | "bar" } | null
  saveState: SaveState
  loadingSheet: boolean
  undoStack: SheetData[]
  redoStack: SheetData[]

  /* list actions */
  loadSheets: (opts?: { silent?: boolean }) => Promise<void>
  setFilter: (f: SheetFilter) => void
  setSearch: (q: string) => void
  createSheet: () => Promise<void>
  openSheet: (id: string) => Promise<void>
  backToList: () => void
  renameSheet: (id: string, title: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  trashSheet: (id: string) => Promise<void>
  restoreSheet: (id: string) => Promise<void>
  deleteForever: (id: string) => Promise<void>
  duplicateSheet: (id: string) => Promise<void>

  /* editor selection */
  clickCell: (r: number, c: number, opts?: { shift?: boolean; toggleHeader?: "col" | "row" }) => void
  dragTo: (r: number, c: number) => void
  selectCol: (c: number) => void
  selectRow: (r: number) => void
  selectAll: () => void
  moveActive: (dr: number, dc: number, extend: boolean) => void

  /* editor editing */
  beginEdit: (ref: string, draft?: string, selectAll?: boolean, source?: "grid" | "bar") => void
  updateDraft: (v: string) => void
  commitEdit: (move: EditMove) => void
  cancelEdit: () => void
  setCellRaw: (ref: string, raw: string) => void
  clearRangeValues: () => void

  /* formatting */
  applyFormat: (fmt: Partial<CellData>) => void
  clearFormatting: () => void

  /* history */
  undo: () => void
  redo: () => void

  /* editor meta */
  renameCurrentTitle: (title: string) => Promise<void>
  toggleCurrentStar: () => Promise<void>
  trashCurrent: () => Promise<void>
}

export const useSheetStore = create<SheetsState>((set, get) => ({
  view: "list",
  sheets: [],
  listLoading: false,
  listError: null,
  filter: "all",
  search: "",
  cellCounts: {},
  creating: false,
  sheetId: null,
  title: "",
  starred: false,
  data: { ...EMPTY_SHEET, cells: {} },
  computed: {},
  anchor: { r: 0, c: 0 },
  active: { r: 0, c: 0 },
  sel: { r0: 0, c0: 0, r1: 0, c1: 0 },
  editing: null,
  saveState: "idle",
  loadingSheet: false,
  undoStack: [],
  redoStack: [],

  ...createListActions(set, get),

  /* --------------------------- selection --------------------------- */

  clickCell: (r, c, opts) => {
    const { data, anchor } = get()
    const p = clampPos({ r, c }, data)
    if (opts?.toggleHeader === "col") {
      set({ anchor: { r: 0, c: p.c }, active: { r: data.rows - 1, c: p.c }, sel: { r0: 0, c0: p.c, r1: data.rows - 1, c1: p.c } })
      return
    }
    if (opts?.toggleHeader === "row") {
      set({ anchor: { r: p.r, c: 0 }, active: { r: p.r, c: data.cols - 1 }, sel: { r0: p.r, c0: 0, r1: p.r, c1: data.cols - 1 } })
      return
    }
    if (opts?.shift) {
      set({ active: p, sel: normSel(anchor, p) })
      return
    }
    set({ anchor: p, active: p, sel: normSel(p, p) })
  },

  dragTo: (r, c) => {
    const { data, anchor } = get()
    const p = clampPos({ r, c }, data)
    set({ active: p, sel: normSel(anchor, p) })
  },
  selectCol: (c) => {
    const { data } = get()
    const col = Math.max(0, Math.min(c, data.cols - 1))
    set({
      anchor: { r: 0, c: col },
      active: { r: data.rows - 1, c: col },
      sel: { r0: 0, c0: col, r1: data.rows - 1, c1: col },
      editing: null,
    })
  },

  selectRow: (r) => {
    const { data } = get()
    const row = Math.max(0, Math.min(r, data.rows - 1))
    set({
      anchor: { r: row, c: 0 },
      active: { r: row, c: data.cols - 1 },
      sel: { r0: row, c0: 0, r1: row, c1: data.cols - 1 },
      editing: null,
    })
  },

  selectAll: () => {
    const { data } = get()
    set({
      anchor: { r: 0, c: 0 },
      active: { r: data.rows - 1, c: data.cols - 1 },
      sel: { r0: 0, c0: 0, r1: data.rows - 1, c1: data.cols - 1 },
    })
  },

  moveActive: (dr, dc, extend) => {
    const { data, anchor, active } = get()
    if (extend) {
      // move the active edge (Google: shift+arrows resize around the anchor)
      const next = clampPos({ r: active.r + dr, c: active.c + dc }, data)
      if (next.r === active.r && next.c === active.c) return
      set({ active: next, sel: normSel(anchor, next) })
      return
    }
    const next = clampPos({ r: active.r + dr, c: active.c + dc }, data)
    if (next.r === active.r && next.c === active.c) return
    set({ anchor: next, active: next, sel: normSel(next, next) })
  },

  /* ---------------------------- editing ---------------------------- */

  beginEdit: (ref, draft, selectAll = false, source = "grid") => {
    const { data, editing } = get()
    if (editing && editing.ref === ref && draft === undefined) return
    const cell = data.cells[ref]
    const initial = draft !== undefined ? draft : cell?.v ?? ""
    set({ editing: { ref, draft: initial, selectAll, source } })
  },

  updateDraft: (v) => {
    const e = get().editing
    if (!e) return
    set({ editing: { ...e, draft: v } })
  },

  commitEdit: (move) => {
    const { editing, data } = get()
    set({ editing: null })
    if (!editing) return
    get().setCellRaw(editing.ref, editing.draft)
    if (move !== "none") {
      const { active } = get()
      const delta: Record<Exclude<EditMove, "none">, [number, number]> = {
        down: [1, 0],
        up: [-1, 0],
        left: [0, -1],
        right: [0, 1],
      }
      const [dr, dc] = delta[move]
      const next = clampPos({ r: active.r + dr, c: active.c + dc }, data)
      set({ anchor: next, active: next, sel: normSel(next, next) })
    }
  },

  cancelEdit: () => set({ editing: null }),

  setCellRaw: (ref, raw) => {
    const st = get()
    const prev = st.data.cells[ref]
    const prevV = prev?.v ?? ""
    if (raw === prevV) return
    const cells = { ...st.data.cells }
    if (raw === "") {
      if (prev && hasFormatting(prev)) cells[ref] = { ...prev, v: "" }
      else delete cells[ref]
    } else {
      cells[ref] = { ...(prev ?? {}), v: raw }
    }
    const next: SheetData = { ...st.data, cells }
    set({ ...pushHistory(st), data: next, computed: evaluateSheet(next) })
    scheduleSave()
  },

  clearRangeValues: () => {
    const st = get()
    const { sel, data } = st
    const cells = { ...data.cells }
    let changed = false
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        const ref = cellRef(r, c)
        const prev = cells[ref]
        if (!prev || prev.v === "") continue
        changed = true
        if (hasFormatting(prev)) cells[ref] = { ...prev, v: "" }
        else delete cells[ref]
      }
    }
    if (!changed) return
    const next: SheetData = { ...data, cells }
    set({ ...pushHistory(st), data: next, computed: evaluateSheet(next) })
    scheduleSave()
  },

  /* --------------------------- formatting --------------------------- */

  applyFormat: (fmt) => {
    const st = get()
    const { sel, data } = st
    const cells = { ...data.cells }
    let changed = false
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        const ref = cellRef(r, c)
        const prev = cells[ref]
        const next: CellData = { ...(prev ?? { v: "" }) }
        if (fmt.bold === undefined) delete next.bold
        else if (fmt.bold !== prev?.bold) next.bold = fmt.bold
        if (fmt.italic === undefined) delete next.italic
        else if (fmt.italic !== prev?.italic) next.italic = fmt.italic
        if (fmt.align === undefined) delete next.align
        else if (fmt.align !== prev?.align) next.align = fmt.align
        if (fmt.bg === undefined) delete next.bg
        else if (fmt.bg !== prev?.bg) next.bg = fmt.bg
        if (
          next.bold === prev?.bold &&
          next.italic === prev?.italic &&
          next.align === prev?.align &&
          next.bg === prev?.bg
        ) {
          // nothing actually changed — don't store pure-empty cells
          if (next.v === "" && cells[ref] === undefined) delete cells[ref]
          continue
        }
        changed = true
        cells[ref] = next
      }
    }
    if (!changed) return
    const nextData: SheetData = { ...data, cells }
    set({ ...pushHistory(st), data: nextData })
    scheduleSave()
  },

  clearFormatting: () => {
    const st = get()
    const { sel, data } = st
    const cells = { ...data.cells }
    let changed = false
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        const ref = cellRef(r, c)
        const prev = cells[ref]
        if (!prev || !hasFormatting(prev)) continue
        changed = true
        if (prev.v === "") delete cells[ref]
        else cells[ref] = { v: prev.v }
      }
    }
    if (!changed) return
    const next: SheetData = { ...data, cells }
    set({ ...pushHistory(st), data: next })
    scheduleSave()
  },

  /* ----------------------------- history ----------------------------- */

  undo: () => {
    const st = get()
    const prev = st.undoStack[st.undoStack.length - 1]
    if (!prev) return
    set({
      undoStack: st.undoStack.slice(0, -1),
      redoStack: [...st.redoStack, st.data].slice(-HISTORY_LIMIT),
      data: prev,
      computed: evaluateSheet(prev),
      editing: null,
    })
    scheduleSave()
  },

  redo: () => {
    const st = get()
    const next = st.redoStack[st.redoStack.length - 1]
    if (!next) return
    set({
      redoStack: st.redoStack.slice(0, -1),
      undoStack: [...st.undoStack, st.data].slice(-HISTORY_LIMIT),
      data: next,
      computed: evaluateSheet(next),
      editing: null,
    })
    scheduleSave()
  },

  /* ---------------------------- editor meta ---------------------------- */

  renameCurrentTitle: async (title) => {
    const id = get().sheetId
    if (!id) return
    const clean = title.trim().slice(0, 120)
    if (!clean || clean === get().title) return
    set({ title: clean })
    try {
      await api(`/api/sheets/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ title: clean }) })
    } catch {
      toast({ title: tForLang(getCurrentLang(), "Rename failed"), variant: "destructive" })
    }
  },

  toggleCurrentStar: () => {
    const id = get().sheetId
    if (!id) return Promise.resolve()
    return get().toggleStar(id)
  },

  trashCurrent: async () => {
    const id = get().sheetId
    if (!id) return
    await api(`/api/sheets/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ trashed: true }) }).catch(() => {})
    get().backToList()
    const lang = getCurrentLang()
    toast({
      title: tForLang(lang, "Moved to trash"),
      description: tForLang(lang, "Find it under the Trash filter to restore."),
    })
  },
}))

