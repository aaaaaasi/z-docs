"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import type { VersionDTO } from "@/lib/docs-types"
import { fullTime, relativeTime } from "@/lib/doc-utils"
import { History, Eye, RotateCcw, FileText } from "lucide-react"

export function VersionHistorySheet({
  open, onOpenChange, docId, onRestore,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  docId: string
  onRestore: (content: string) => void
}) {
  const [versions, setVersions] = React.useState<VersionDTO[] | null>(null)
  const [preview, setPreview] = React.useState<VersionDTO | null>(null)
  const { toast } = useToast()

  React.useEffect(() => {
    if (!open || !docId) return
    setVersions(null)
    fetch(`/api/documents/${docId}/versions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((data: { versions: VersionDTO[] }) => setVersions(data.versions ?? []))
      .catch(() => setVersions([]))
  }, [open, docId])

  const restore = (v: VersionDTO) => {
    onRestore(v.content)
    toast({ title: "Version restored", description: `Restored to ${fullTime(v.createdAt)}` })
    setPreview(null)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4.5 w-4.5 text-primary" /> Version history
          </SheetTitle>
          <SheetDescription className="text-xs">
            Snapshots are captured automatically while you edit. Restoring a version creates a new save.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-92px)]">
          <div className="p-4">
            {versions === null ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No versions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep editing — snapshots appear as your document evolves.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-3 border-l pl-5">
                {versions.map((v) => (
                  <li key={v.id} className="relative">
                    <span className="absolute -left-[27px] top-4 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                    <div className="rounded-lg border p-3 transition-colors hover:border-primary/40">
                      <p className="text-sm font-medium">{fullTime(v.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(v.createdAt)} · {v.wordCount.toLocaleString()} words
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setPreview(v)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => restore(v)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </ScrollArea>
        </SheetContent>
      </Sheet>

      <VersionPreviewDialog version={preview} onClose={() => setPreview(null)} />
    </>
  )
}

export function VersionPreviewDialog({
  version, onClose,
}: {
  version: VersionDTO | null
  onClose: () => void
}) {
  // close on Escape
  React.useEffect(() => {
    if (!version) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [version, onClose])

  if (!version) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Version preview"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b bg-background px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Snapshot preview</p>
            <p className="text-xs text-muted-foreground">{fullTime(version.createdAt)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close preview">
            Close
          </Button>
        </div>
        <ScrollArea className="flex-1 bg-neutral-100 p-6">
          <div className="mx-auto max-w-[616px] bg-white p-12 shadow-md">
            <div className="doc-content" dangerouslySetInnerHTML={{ __html: version.content }} />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
