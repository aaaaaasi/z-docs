"use client"

import * as React from "react"
import { useDocsStore } from "@/store/docs-store"
import { useToast } from "@/hooks/use-toast"
import { TEMPLATES } from "@/lib/templates"
import { DocPreview } from "@/components/docs/doc-preview"
import {
  NotebookPen, Lightbulb, Mail, FileUser, BookOpen, Newspaper, FileText, Sparkles, Loader2, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NotebookPen, Lightbulb, Mail, FileUser, BookOpen, Newspaper, FileText, Sparkles,
}

export function TemplateGallery() {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  const setOpenAiOnEditor = useDocsStore((s) => s.setOpenAiOnEditor)
  const { toast } = useToast()
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
        toast({ title: "Could not create the document", variant: "destructive" })
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-label="Start a new document" className="border-b bg-background px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Start a new document</h2>
          </div>
          <span className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:flex">
            Template gallery <ChevronRight className="h-4 w-4" />
          </span>
        </div>

        <div
          className="no-scrollbar -mx-1 flex gap-5 overflow-x-auto px-1 pb-2 max-sm:gap-3 max-sm:snap-x max-sm:snap-mandatory max-sm:overscroll-contain"
          role="list"
          aria-label="Document templates"
        >
          {/* AI card */}
          <button
            onClick={() => start("ai")}
            disabled={busyId === "ai"}
            className="group flex w-[152px] shrink-0 flex-col items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-sm disabled:opacity-60 max-sm:snap-start"
            aria-label="Help me write with AI"
          >
            <div className="relative h-[197px] w-[152px] overflow-hidden rounded-sm border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-1">
              {busyId === "ai" ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="px-2 text-center text-xs font-medium leading-snug text-foreground">
                    Help me write something…
                  </p>
                  <p className="text-center text-[10px] leading-tight text-muted-foreground">Powered by AI</p>
                </div>
              )}
              {/* hover overlay — matches template cards */}
              {!busyId && (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-primary/30 via-transparent to-transparent pb-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-lg">
                    Ask AI
                  </span>
                </div>
              )}
            </div>
            <p className="w-full truncate text-center text-sm font-medium">Help me write</p>
            <p className="w-full truncate text-center text-xs text-muted-foreground">Draft with AI</p>
          </button>

          {TEMPLATES.map((t) => {
            const Icon = ICONS[t.icon] ?? FileText
            return (
              <button
                key={t.id}
                onClick={() => start(t.id)}
                disabled={busyId === t.id}
                className="group flex w-[152px] shrink-0 flex-col items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-sm disabled:opacity-60 max-sm:snap-start"
                aria-label={`Create from ${t.name} template`}
              >
                <div className="relative h-[197px] w-[152px] overflow-hidden rounded-sm border bg-white shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-1">
                  {busyId === t.id ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <DocPreview html={t.content} width={152} />
                  )}
                  {/* hover overlay */}
                  {!busyId && (
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/25 via-transparent to-transparent pb-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-foreground/85 px-3 py-1 text-[11px] font-medium text-background shadow-lg backdrop-blur-sm">
                        Use template
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex w-full items-center justify-center gap-1.5">
                  <Icon className={cn("h-4 w-4", t.accent)} />
                  <p className="truncate text-sm font-medium">{t.name}</p>
                </div>
                <p className="w-full truncate text-center text-xs text-muted-foreground">{t.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
