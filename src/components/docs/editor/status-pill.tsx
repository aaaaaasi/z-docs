"use client"

import { Button } from "@/components/ui/button"
import type { EditorApi } from "./editor-types"
import { Users, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export function StatusPill({ api }: { api: EditorApi }) {
  const { t } = useI18n()
  const s = api.stats
  return (
    <div
      role="status"
      aria-label={t("Document statistics")}
      className="no-print fixed bottom-4 left-1/2 z-30 flex h-8 -translate-x-1/2 items-center gap-1 overflow-hidden rounded-md border bg-background/95 px-1.5 text-xs text-muted-foreground elev-1 backdrop-blur"
    >
      <span className="tnum hidden items-center gap-1 px-2 py-1 sm:flex">
        {s.pages === 1 ? t("1 page") : t("{n} pages", { n: s.pages })}
      </span>
      <span className="h-4 w-px bg-border" />
      <button
        className="tnum px-2 py-1 transition-colors hover:text-foreground"
        onClick={() => api.openDialog("wordcount")}
        aria-label={t("Word count details")}
      >
        {t("{n} words", { n: s.words.toLocaleString() })}
      </button>
      <span className="hidden h-4 w-px bg-border sm:block" />
      <button
        className="hidden px-2 py-1 transition-colors hover:text-foreground sm:block"
        onClick={() => api.openDialog("wordcount")}
      >
        {t("{n} characters", { n: s.chars.toLocaleString() })}
      </button>
      {api.presence.length > 1 && (
        <>
          <span className="h-4 w-px bg-border" />
          <span className="tnum flex items-center gap-1 px-2 py-1">
            <Users className="h-3.5 w-3.5" />
            {api.presence.length}
          </span>
        </>
      )}
      <span className="h-4 w-px bg-border" />
      <div className="flex items-center">
        <Button
          variant="ghost" size="icon"
          aria-label={t("Zoom out")}
          className="h-7 w-7 rounded-md text-muted-foreground"
          onClick={() => api.setZoom(Math.max(0.5, +(api.zoom - 0.1).toFixed(2)))}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-11 text-center tabular-nums">{Math.round(api.zoom * 100)}%</span>
        <Button
          variant="ghost" size="icon"
          aria-label={t("Zoom in")}
          className="h-7 w-7 rounded-md text-muted-foreground"
          onClick={() => api.setZoom(Math.min(2, +(api.zoom + 0.1).toFixed(2)))}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <span
        className={cn(
          "ml-1 h-2 w-2 rounded-full",
          api.connected ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
        title={api.connected ? t("Realtime sync connected") : t("Realtime sync offline")}
        aria-label={api.connected ? t("Realtime sync connected") : t("Realtime sync offline")}
      />
    </div>
  )
}
