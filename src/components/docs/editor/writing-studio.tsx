"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n, type Lang } from "@/lib/i18n"
import { WritingMetricsTab } from "./writing-metrics"
import { WritingInsightsTab } from "./writing-insights-ui"
import type { WritingStats } from "@/lib/writing-tracker"

export interface WritingStudioProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** document id — metrics tab refreshes stats on open */
  docId: string
  /** live document HTML (for word counts + text analysis) */
  html: string
  /** server-side stats blob + revision counter */
  stats: Partial<WritingStats> | null
  editCount: number
  lang: Lang
  /** locate + highlight a text snippet in the live document (insights hover) */
  highlightText: (text: string) => void
}

/**
 * 写作工作室 — Ellipsus-style writing analytics.
 * Tab 1 写作历程: real telemetry metrics.
 * Tab 2 写作心得: 15 text-insight metrics with in-document highlighting.
 */
export function WritingStudioDialog(props: WritingStudioProps) {
  const { open, onOpenChange } = props
  const { t } = useI18n()
  const [tab, setTab] = React.useState<"metrics" | "insights">("metrics")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {t("Writing studio")}
          </DialogTitle>
        </DialogHeader>
        <div role="tablist" aria-label={t("Writing studio tabs")} className="flex gap-1 border-b pb-2">
          <button
            role="tab"
            aria-selected={tab === "metrics"}
            onClick={() => setTab("metrics")}
            className={
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors " +
              (tab === "metrics"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")
            }
          >
            {t("Writing journey")}
          </button>
          <button
            role="tab"
            aria-selected={tab === "insights"}
            onClick={() => setTab("insights")}
            className={
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors " +
              (tab === "insights"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")
            }
          >
            {t("Writing insights")}
          </button>
        </div>
        <div className="pt-2">
          {tab === "metrics" ? <WritingMetricsTab {...props} /> : <WritingInsightsTab {...props} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
