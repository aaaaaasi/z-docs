"use client"

/**
 * Export progress panel — stacked download cards pinned to the viewport
 * bottom-right (Google Docs / Drive download-center parity).
 *
 * Renders live progress for running exports and a confirm card for
 * finished ones. Determinate exports show a real percent bar; unknown
 * lengths show the animated indeterminate shimmer. Fully keyboard
 * dismissible and screen-reader friendly (role="status").
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { useExportProgress, type ExportProgressItem, type ExportKind } from "@/store/export-progress-store"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { X, Check, AlertCircle, FileDown } from "lucide-react"

const KIND_LABELS: Record<ExportKind, string> = {
  pdf: "PDF",
  docx: "Word",
  doc: "Word",
  html: "HTML",
  txt: "Text",
  pptx: "PowerPoint",
  csv: "CSV",
  json: "JSON",
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

function ProgressCard({ item }: { item: ExportProgressItem }) {
  const { t } = useI18n()
  const dismiss = useExportProgress((s) => s.dismiss)
  const done = item.phase === "done" || item.phase === "error"
  const pct = item.percent

  const phaseText = () => {
    switch (item.phase) {
      case "prepare":
        return t("Preparing…")
      case "render":
        return item.note ?? t("Rendering…")
      case "download":
        return item.note ?? t("Downloading…")
      case "done":
        return item.byteSize != null
          ? t("Downloaded · {size}", { size: formatBytes(item.byteSize) })
          : t("Downloaded")
      case "error":
        return t("Export failed")
    }
  }

  const statusIcon =
    item.phase === "done" ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />
      </span>
    ) : item.phase === "error" ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    ) : (
      <FileDown className="mt-0.5 h-4.5 w-4.5 shrink-0 animate-pulse text-muted-foreground" />
    )

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in slide-in-from-bottom-2 fade-in w-[320px] max-w-[calc(100vw-1.5rem)] rounded-xl border bg-popover/95 p-3 text-popover-foreground shadow-[0_2px_6px_rgba(35,32,28,0.10),0_12px_32px_rgba(35,32,28,0.20)] backdrop-blur duration-300 dark:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_12px_32px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-start gap-2.5">
        {statusIcon}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              item.phase === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {item.phase === "done" || item.phase === "error"
              ? phaseText()
              : `${KIND_LABELS[item.kind] ?? String(item.kind)} · ${phaseText()}`}
            {!done && pct != null && <span className="tnum"> · {Math.round(pct)}%</span>}
          </p>
          {/* determinate bar when a percent is known, indeterminate shimmer otherwise */}
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("Export progress: {file}", { file: item.fileName })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct != null ? Math.round(pct) : undefined}
          >
            {pct != null ? (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
              />
            ) : (
              <div className="indeterminate-bar h-full w-1/2 rounded-full bg-primary/70" />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismiss(item.id)}
          aria-label={t("Dismiss")}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ExportProgressPanel() {
  const { t } = useI18n()
  const items = useExportProgress((s) => s.items)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted || items.length === 0) return null

  const MAX_VISIBLE = 3
  const visible = items.slice(-MAX_VISIBLE)
  const overflow = items.length - visible.length

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2" aria-label={t("Exports")}>
      {overflow > 0 && <p className="pr-1 text-xs text-muted-foreground">+{overflow}</p>}
      {visible.map((it) => (
        <ProgressCard key={it.id} item={it} />
      ))}
      <style>{`
@keyframes zdocs-indeterminate {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(340%); }
}
.indeterminate-bar { animation: zdocs-indeterminate 1.2s ease-in-out infinite; }
`}</style>
    </div>,
    document.body
  )
}
