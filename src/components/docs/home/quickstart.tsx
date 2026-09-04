"use client"

import * as React from "react"
import { useDocsStore } from "@/store/docs-store"
import { api } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { FileSpreadsheet, Presentation, FormInput, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n, tForLang, getCurrentLang } from "@/lib/i18n"

type NewApp = "sheets" | "slides" | "forms"

const OPTIONS: {
  app: NewApp
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** tint classes for the icon chip */
  chip: string
  /** key of the created entity in the POST response */
  entityKey: string
  title: string
}[] = [
  {
    app: "sheets",
    label: "Spreadsheet",
    hint: "Grids, formulas, sums",
    icon: FileSpreadsheet,
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    entityKey: "sheet",
    title: "Untitled spreadsheet",
  },
  {
    app: "slides",
    label: "Presentation",
    hint: "Decks with present mode",
    icon: Presentation,
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    entityKey: "deck",
    title: "Untitled presentation",
  },
  {
    app: "forms",
    label: "Form",
    hint: "Questions & responses",
    icon: FormInput,
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    entityKey: "form",
    title: "Untitled form",
  },
]

/** "Start a new …" row for the other Z-Workspace apps (Google Drive quick-create). */
export function WorkspaceQuickstart() {
  const openApp = useDocsStore((s) => s.openApp)
  const { toast } = useToast()
  const { t } = useI18n()
  const [busy, setBusy] = React.useState<NewApp | null>(null)

  const start = async (opt: (typeof OPTIONS)[number]) => {
    if (busy) return
    setBusy(opt.app)
    try {
      const res = await api(`/api/${opt.app}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tForLang(getCurrentLang(), opt.title) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Record<string, { id: string }>
      const entity = data[opt.entityKey]
      if (entity?.id) {
        openApp(opt.app, { id: entity.id, formMode: opt.app === "forms" ? "edit" : undefined })
      } else {
        openApp(opt.app)
      }
    } catch {
      toast({
        title: t(`Couldn’t create the ${opt.label.toLowerCase()}`),
        description: t("Open the app and try again."),
        variant: "destructive",
      })
      openApp(opt.app)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label={t("Start a new workspace file")} className="border-b bg-background px-4 pb-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-3 text-[13px] font-medium text-foreground/70">{t("More ways to start")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.app}
                onClick={() => void start(opt)}
                disabled={busy !== null}
                className="group flex items-center gap-3.5 rounded-lg border bg-background p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_2px_10px_rgba(35,32,28,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
                    opt.chip
                  )}
                >
                  {busy === opt.app ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {t(`New ${opt.label.toLowerCase()}`)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t(opt.hint)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
