"use client"

/**
 * Export progress center — Google-Drive-style download cards.
 *
 * Every long-running export (PDF / DOCX / PPTX / CSV / JSON backup / …)
 * reports progress here; <ExportProgressPanel/> renders the cards in the
 * viewport bottom-right corner. Small exports finish in milliseconds and
 * their completed card simply confirms the download, while large documents
 * stream real byte- or per-page progress.
 *
 * The store is intentionally dependency-free so both the editor (Z-Docs)
 * and the sheet/deck/settings surfaces can drive it without prop drilling.
 */

import { create } from "zustand"

export type ExportKind =
  | "pdf"
  | "docx"
  | "doc"
  | "html"
  | "txt"
  | "pptx"
  | "csv"
  | "json"

export type ExportPhase = "prepare" | "render" | "download" | "done" | "error"

export interface ExportProgressItem {
  id: string
  kind: ExportKind
  /** document / sheet / deck title for the card heading */
  title: string
  fileName: string
  phase: ExportPhase
  /** 0–100, or null while the length is unknown (indeterminate bar) */
  percent: number | null
  /** human progress line, e.g. "第 2 页，共 5 页" */
  note: string | null
  byteSize: number | null
  startedAt: number
}

interface ExportProgressState {
  items: ExportProgressItem[]
  begin: (init: {
    kind: ExportKind
    title: string
    fileName: string
    note?: string
    percent?: number | null
    byteSize?: number | null
  }) => string
  tick: (
    id: string,
    progress: { percent?: number | null; note?: string | null; phase?: ExportPhase }
  ) => void
  finish: (id: string, ok: boolean, note?: string) => void
  dismiss: (id: string) => void
}

let seq = 0
/** done/error cards auto-dismiss after this delay (ms). */
export const EXPORT_CARD_LINGER = 4200
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(id: string) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
}

export const useExportProgress = create<ExportProgressState>((set, get) => ({
  items: [],

  begin: (init) => {
    const id = `exp-${Date.now().toString(36)}-${++seq}`
    const item: ExportProgressItem = {
      id,
      kind: init.kind,
      title: init.title,
      fileName: init.fileName,
      phase: "prepare",
      percent: init.percent ?? null,
      note: init.note ?? null,
      byteSize: init.byteSize ?? null,
      startedAt: Date.now(),
    }
    set((s) => ({ items: [...s.items, item] }))
    return id
  },

  tick: (id, progress) => {
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id
          ? {
              ...it,
              percent: progress.percent !== undefined ? progress.percent : it.percent,
              note: progress.note !== undefined ? progress.note : it.note,
              phase: progress.phase ?? it.phase,
            }
          : it
      ),
    }))
  },

  finish: (id, ok, note) => {
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id
          ? {
              ...it,
              phase: ok ? "done" : "error",
              percent: ok ? 100 : it.percent,
              note: note ?? (ok ? it.note : it.note),
            }
          : it
      ),
    }))
    clearTimer(id)
    timers.set(
      id,
      setTimeout(() => {
        get().dismiss(id)
      }, EXPORT_CARD_LINGER)
    )
  },

  dismiss: (id) => {
    clearTimer(id)
    set((s) => ({ items: s.items.filter((it) => it.id !== id) }))
  },
}))

/* ------------------------------------------------------------------ *
 * Helpers — ergonomic wrappers used by the export call sites.
 * ------------------------------------------------------------------ */

/** Read a fetch Response as a Blob while reporting byte progress. */
export async function readBlobWithProgress(
  res: Response,
  onProgress: (loadedBytes: number, totalBytes: number | null) => void
): Promise<Blob> {
  const totalHeader = res.headers.get("content-length")
  // Only trust the header when the browser did not transparently decompress
  // (gzip would make content-length wrong) — length header absent → null.
  const total = totalHeader ? Number(totalHeader) : null
  if (!res.body || !total || !Number.isFinite(total) || total <= 0) {
    const blob = await res.blob()
    onProgress(blob.size, blob.size)
    return blob
  }
  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value as unknown as BlobPart)
      loaded += value.byteLength
      onProgress(loaded, total)
    }
  }
  return new Blob(chunks, { type: res.headers.get("content-type") ?? "application/octet-stream" })
}

/** Track a Blob download through the progress center (small exports too). */
export interface ExportTracker {
  id: string
  tick: (progress: { percent?: number | null; note?: string | null; phase?: ExportPhase }) => void
  finish: (ok: boolean, note?: string) => void
}

export function trackedDownload(
  init: Parameters<ExportProgressState["begin"]>[0]
): ExportTracker {
  const { begin, tick, finish } = useExportProgress.getState()
  const id = begin(init)
  return {
    id,
    tick: (progress) => tick(id, progress),
    finish: (ok, note) => finish(id, ok, note),
  }
}
