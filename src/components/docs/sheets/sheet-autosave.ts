"use client"

import { api } from "@/lib/api-client"
import { toast } from "@/hooks/use-toast"
import type { SheetData } from "@/lib/workspace-types"
import { cleanSheetData } from "./cells"
import { useSheetStore, type SheetsState } from "./sheet-store"

export const HISTORY_LIMIT = 50
const JSON_HEADERS = { "Content-Type": "application/json" }

let saveTimer: ReturnType<typeof setTimeout> | null = null
let saveChain: Promise<void> = Promise.resolve()

/** debounce an autosave (800ms) and flag the UI as "saving" */
export function scheduleSave() {
  const st = useSheetStore.getState()
  if (!st.sheetId) return
  if (st.saveState !== "saving") useSheetStore.setState({ saveState: "saving" })
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveChain = saveChain.then(() => doSave())
  }, 800)
}

/** PATCH the current sheet data — serialized through saveChain so writes never race */
export async function doSave() {
  const { sheetId, data } = useSheetStore.getState()
  if (!sheetId) return
  try {
    const res = await api(`/api/sheets/${sheetId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ data: JSON.stringify(cleanSheetData(data)) }),
    })
    if (!res.ok) throw new Error(`save failed (${res.status})`)
    if (useSheetStore.getState().sheetId === sheetId) useSheetStore.setState({ saveState: "saved" })
  } catch {
    if (useSheetStore.getState().sheetId === sheetId) {
      useSheetStore.setState({ saveState: "error" })
      toast({
        title: "Couldn't save spreadsheet",
        description: "Your changes are still here — try editing again.",
        variant: "destructive",
      })
    }
  }
}

/** flush any pending autosave right now (used on unmount / navigation) */
export function flushSheetSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    if (useSheetStore.getState().sheetId) saveChain = saveChain.then(() => doSave())
  }
}

/** snapshot the current data onto the undo stack (call before any mutation) */
export function pushHistory(st: SheetsState): Pick<SheetsState, "undoStack" | "redoStack"> {
  return { undoStack: [...st.undoStack, st.data].slice(-HISTORY_LIMIT), redoStack: [] }
}

/** normalized rect covered by two positions */
export function normSel(a: { r: number; c: number }, b: { r: number; c: number }) {
  return {
    r0: Math.min(a.r, b.r),
    c0: Math.min(a.c, b.c),
    r1: Math.max(a.r, b.r),
    c1: Math.max(a.c, b.c),
  }
}

/** clamp a position to the grid bounds */
export function clampPos(p: { r: number; c: number }, data: SheetData) {
  return {
    r: Math.max(0, Math.min(data.rows - 1, p.r)),
    c: Math.max(0, Math.min(data.cols - 1, p.c)),
  }
}
