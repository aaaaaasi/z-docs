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

        <div className="no-scrollbar -mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
          {/* AI card */}
          <button
            onClick={() => start("ai")}
            disabled={busyId === "ai"}
            className="group flex w-[152px] shrink-0 flex-col items-center gap-2 text-left disabled:opacity-60"
            aria-label="Help me write with AI"
          >
            <div className="relative h-[197px] w-[152px] overflow-hidden rounded-sm border bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20 shadow-sm transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
              {busyId === "ai" ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-110">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="px-2 text-center text-xs font-medium leading-snug text-foreground">
                    Help me write something…
                  </p>
                  <p className="text-center text-[10px] leading-tight text-muted-foreground">Powered by AI</p>
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
                className="group flex w-[152px] shrink-0 flex-col items-center gap-2 text-left disabled:opacity-60"
                aria-label={`Create from ${t.name} template`}
              >
                <div className="relative h-[197px] w-[152px] overflow-hidden rounded-sm border bg-white shadow-sm transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
                  {busyId === t.id ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <DocPreview html={t.content} width={152} />
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
