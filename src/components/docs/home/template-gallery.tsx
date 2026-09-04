"use client"

import * as React from "react"
import { useDocsStore } from "@/store/docs-store"
import { useToast } from "@/hooks/use-toast"
import { TEMPLATES, localizedTemplate } from "@/lib/templates"
import { DocPreview } from "@/components/docs/doc-preview"
import { ScrollFade } from "@/components/docs/scroll-fade"
import { useI18n } from "@/lib/i18n"
import {
  NotebookPen, Lightbulb, Mail, FileUser, BookOpen, Newspaper, FileText, Sparkles, Loader2, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  NotebookPen, Lightbulb, Mail, FileUser, BookOpen, Newspaper, FileText, Sparkles,
}

export function TemplateGallery() {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  const setOpenAiOnEditor = useDocsStore((s) => s.setOpenAiOnEditor)
  const { toast } = useToast()
  const { t, lang } = useI18n()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const start = async (templateId: string) => {
    if (busyId) return
    setBusyId(templateId)
    try {
      const id = await createDoc({ templateId })
      if (id) {
        if (templateId === "ai") {
          // create a blank doc then auto-open the AI writer
          setOpenAiOnEditor(true)
        }
        openDoc(id, { ai: templateId === "ai" })
      } else {
        toast({ title: t("Could not create the document"), variant: "destructive" })
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-label={t("Start a new document")} className="border-b bg-background px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium text-foreground/70">{t("Start a new document")}</h2>
          <span className="group hidden cursor-default items-center gap-1 text-[13px] text-primary transition-colors hover:underline hover:underline-offset-4 sm:flex">
            {t("Template gallery")} <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>

        <div
          className="no-scrollbar -mx-1 relative flex gap-5 overflow-x-auto px-1 pb-2 max-sm:gap-3 max-sm:snap-x max-sm:snap-mandatory max-sm:overscroll-contain"
          role="list"
          aria-label={t("Document templates")}
        >
          <ScrollFade />
          {/* AI card: quiet white card, thin-line icon, no gradient theatrics */}
          <button
            onClick={() => start("ai")}
            disabled={busyId === "ai"}
            className="group flex w-[152px] shrink-0 flex-col items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-sm disabled:opacity-60 max-sm:snap-start"
            aria-label={t("Help me write with AI")}
          >
            <div className="relative flex h-[197px] w-[152px] items-center justify-center overflow-hidden rounded-sm border bg-card elev-1 transition-[border-color,box-shadow] duration-200 group-hover:border-primary/45 group-hover:elev-2 group-focus-visible:border-primary/45 group-focus-visible:elev-2">
              {busyId === "ai" ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.75} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-4">
                  <Sparkles className="h-7 w-7 text-primary transition-transform duration-200 group-hover:scale-105" strokeWidth={1.5} />
                  <p className="text-center text-[12.5px] font-medium leading-snug text-foreground">
                    {t("Help me write")}
                  </p>
                  <p className="text-center text-[11px] leading-tight text-muted-foreground">{t("AI draft")}</p>
                </div>
              )}
            </div>
            <p className="w-full truncate text-center text-[13px] font-medium">{t("Help me write")}</p>
            <p className="w-full truncate text-center text-[11.5px] text-muted-foreground">{t("Draft with AI")}</p>
          </button>

          {TEMPLATES.map((tpl) => {
            const Icon = ICONS[tpl.icon] ?? FileText
            const loc = localizedTemplate(tpl, lang)
            return (
              <button
                key={tpl.id}
                onClick={() => start(tpl.id)}
                disabled={busyId === tpl.id}
                className="group flex w-[152px] shrink-0 flex-col items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-sm disabled:opacity-60 max-sm:snap-start"
                aria-label={t("Create from {name} template", { name: loc.name })}
              >
                <div className="relative h-[197px] w-[152px] overflow-hidden rounded-sm border bg-card elev-1 transition-[border-color,box-shadow] duration-200 group-hover:border-foreground/25 group-hover:elev-2 group-focus-visible:border-foreground/25 group-focus-visible:elev-2">
                  {busyId === tpl.id ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.75} />
                    </div>
                  ) : (
                    <DocPreview html={loc.content} width={152} />
                  )}
                  {/* hover affordance: flat tint + small label, no blur */}
                  {!busyId && (
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-foreground/[0.05] pb-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-[4px] bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">
                        {t("Use template")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex w-full items-center justify-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", tpl.accent)} strokeWidth={1.75} />
                  <p className="truncate text-[13px] font-medium">{loc.name}</p>
                </div>
                <p className="w-full truncate text-center text-[11.5px] text-muted-foreground">{loc.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
