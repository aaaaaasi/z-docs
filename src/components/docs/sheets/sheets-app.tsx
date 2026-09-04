"use client"

import * as React from "react"
import { useDocsStore } from "@/store/docs-store"
import { flushSheetSave } from "./sheet-autosave"
import { useSheetStore } from "./sheet-store"
import { SheetsList } from "./sheets-list"
import { SheetEditor } from "./sheet-editor"

/**
 * Z-Sheets — Google-Sheets-like spreadsheet workspace.
 * Two internal modes (list / editor) driven by the local sheet store.
 */
export function SheetsApp() {
  const view = useSheetStore((s) => s.view)
  const consumeAppTarget = useDocsStore((s) => s.consumeAppTarget)
  const bootedRef = React.useRef(false)

  // one-shot boot: honor a deep-link target (?app=sheets&entity=<id>) or load the list
  React.useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    const target = consumeAppTarget()
    const { openSheet, loadSheets } = useSheetStore.getState()
    if (target && target.app === "sheets" && target.id) {
      void openSheet(target.id)
    } else {
      // deterministic start (store persists across mounts)
      useSheetStore.setState({ view: "list", editing: null })
      void loadSheets()
    }
  }, [consumeAppTarget])

  // never lose a pending autosave when navigating away from Z-Sheets
  React.useEffect(() => () => flushSheetSave(), [])

  return view === "editor" ? <SheetEditor /> : <SheetsList />
}
