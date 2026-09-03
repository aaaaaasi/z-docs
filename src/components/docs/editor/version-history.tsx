"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { VersionDTO } from "@/lib/docs-types"
import { fullTime, relativeTime, htmlToText } from "@/lib/doc-utils"
import { diffText, diffStats, type DiffSegment } from "@/lib/text-diff"
import { History, Eye, RotateCcw, FileText, GitCompareArrows, ArrowRight, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function VersionHistorySheet({
  open, onOpenChange, docId, onRestore, getCurrentContent,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  docId: string
  onRestore: (content: string) => void
  /** Live HTML of the open document (default diff target). */
  getCurrentContent: () => string
}) {
  const [versions, setVersions] = React.useState<VersionDTO[] | null>(null)
  const [preview, setPreview] = React.useState<VersionDTO | null>(null)
  const [diffFor, setDiffFor] = React.useState<VersionDTO | null>(null)
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
              <div className="flex flex-col items-center rounded-lg border border-dashed p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No versions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep editing. Snapshots appear as your document evolves.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-3 pl-5">
                {/* gradient timeline spine */}
                <span
                  aria-hidden
                  className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-border to-transparent"
                />
                {versions.map((v, i) => (
                  <li key={v.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[27px] top-4 h-2.5 w-2.5 rounded-full border-2 border-primary",
                        i === 0 ? "bg-primary shadow-[0_0_0_3px_rgba(11,107,98,0.15)]" : "bg-background"
                      )}
                    />
                    <div className="rounded-lg border p-3 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm">
                      <p className="tnum flex flex-wrap items-center gap-2 text-sm font-medium">
                        {fullTime(v.createdAt)}
                        {i === 0 && (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Latest
                          </span>
                        )}
                      </p>
                      <p className="tnum text-xs text-muted-foreground">
                        {relativeTime(v.createdAt)} · {v.wordCount.toLocaleString()} words
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setPreview(v)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => setDiffFor(v)}
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" /> Changes
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

      <VersionDiffDialog
        base={diffFor}
        versions={versions ?? []}
        getCurrentContent={getCurrentContent}
        onClose={() => setDiffFor(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ diff */

const CURRENT_KEY = "__current__"

export function VersionDiffDialog({
  base, versions, getCurrentContent, onClose,
}: {
  base: VersionDTO | null
  versions: VersionDTO[]
  getCurrentContent: () => string
  onClose: () => void
}) {
  // close on Escape
  React.useEffect(() => {
    if (!base) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [base, onClose])

  const [targetKey, setTargetKey] = React.useState<string>(CURRENT_KEY)

  // reset target whenever a new base version is opened
  React.useEffect(() => {
    if (base) setTargetKey(CURRENT_KEY)
  }, [base?.id])

  const target: { label: string; content: string; isCurrent: boolean } | null = React.useMemo(() => {
    if (!base) return null
    if (targetKey === CURRENT_KEY) {
      return { label: "Current document", content: getCurrentContent(), isCurrent: true }
    }
    const v = versions.find((x) => x.id === targetKey)
    if (!v) return null
    return { label: fullTime(v.createdAt), content: v.content, isCurrent: false }
  }, [base, targetKey, versions, getCurrentContent])

  const segments: DiffSegment[] | null = React.useMemo(() => {
    if (!base || !target) return null
    return diffText(htmlToText(base.content), htmlToText(target.content))
  }, [base, target])

  const stats = React.useMemo(() => (segments ? diffStats(segments) : null), [segments])

  if (!base || !target || !segments) return null

  const otherVersions = versions.filter((v) => v.id !== base.id)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Version changes"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white elev-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b bg-background px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <GitCompareArrows className="h-4 w-4 text-primary" /> What changed
            </p>
            <p className="tnum mt-0.5 text-xs text-muted-foreground">
              {fullTime(base.createdAt)}
              <ArrowRight className="mx-1 inline h-3 w-3" />
              {target.label}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close diff">
            Close
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Compare with</span>
          <Select value={targetKey} onValueChange={setTargetKey}>
            <SelectTrigger className="h-8 w-52 text-xs" aria-label="Compare with">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CURRENT_KEY} className="text-xs">Current document</SelectItem>
              {otherVersions.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {fullTime(v.createdAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1.5 text-xs font-medium">
            {stats && stats.addedWords > 0 && (
              <span className="tnum inline-flex items-center gap-1 rounded-md bg-[rgba(58,125,68,0.12)] px-2.5 py-1 text-[#3a7d44]">
                <TrendingUp className="h-3 w-3" />+{stats.addedWords} {stats.addedWords === 1 ? "word" : "words"}
              </span>
            )}
            {stats && stats.removedWords > 0 && (
              <span className="tnum inline-flex items-center gap-1 rounded-md bg-[rgba(176,67,43,0.10)] px-2.5 py-1 text-[#b0432b]">
                <TrendingDown className="h-3 w-3" />−{stats.removedWords} {stats.removedWords === 1 ? "word" : "words"}
              </span>
            )}
            {stats && stats.addedWords === 0 && stats.removedWords === 0 && (
              <span className="tnum rounded-md bg-muted px-2.5 py-1 text-muted-foreground">No word changes</span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 bg-neutral-50 p-6">
          <div className="mx-auto max-w-[616px] rounded-lg bg-white p-8 shadow-[0_1px_2px_rgba(35,32,28,0.08),0_12px_40px_rgba(35,32,28,0.1)]">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Both versions are empty.</p>
            ) : (
              <div className="diff-body text-sm text-neutral-800">
                {segments.map((s, i) =>
                  s.type === "same" ? (
                    <span key={i}>{s.text}</span>
                  ) : s.type === "add" ? (
                    <ins key={i} className="diff-ins">{s.text}</ins>
                  ) : (
                    <del key={i} className="diff-del">{s.text}</del>
                  )
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-4 border-t bg-background px-4 py-2.5 text-xs text-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px] bg-[rgba(58,125,68,0.30)]" /> added
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px] bg-[rgba(176,67,43,0.22)]" /> removed
          </span>
        </div>
      </div>
    </div>
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
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white elev-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b bg-background px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Snapshot preview</p>
            <p className="tnum text-xs text-muted-foreground">{fullTime(version.createdAt)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close preview">
            Close
          </Button>
        </div>
        <ScrollArea className="flex-1 bg-neutral-100 p-6">
          <div className="mx-auto max-w-[616px] bg-white p-12 shadow-[0_1px_2px_rgba(35,32,28,0.08),0_12px_40px_rgba(35,32,28,0.1)]">
            <div className="doc-content" dangerouslySetInnerHTML={{ __html: version.content }} />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
