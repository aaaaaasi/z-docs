"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Sparkles, Loader2, CornerDownLeft, RefreshCw, Copy, Check, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

const SUGGESTIONS = [
  "Write an agenda for a product team weekly meeting",
  "Draft a friendly project kickoff announcement",
  "Write a professional thank-you email to a client",
  "Create an outline for a blog post about remote work",
  "Write a short team update about this quarter's goals",
  "Draft meeting minutes with action items",
]

export function HelpWriteDialog({
  open, onOpenChange, onInsert, onReplace, docTitle,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onInsert: (html: string) => void
  onReplace: (html: string) => void
  docTitle: string
}) {
  const [prompt, setPrompt] = React.useState("")
  const [result, setResult] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const { toast } = useToast()
  const { t, lang } = useI18n()

  React.useEffect(() => {
    if (open) {
      setPrompt("")
      setResult("")
      setError(null)
      setLoading(false)
    }
  }, [open])

  const generate = async () => {
    const p = prompt.trim()
    if (!p || loading) return
    setLoading(true)
    setError(null)
    setResult("")
    try {
      const res = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, title: docTitle, lang }),
      })
      if (!res.ok) {
        // guests get a targeted "sign in to use AI" message from the local
        // API shim — surface it verbatim instead of a generic outage
        const errData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(
          res.status === 403 && errData.error ? errData.error : t("The AI service is unavailable right now.")
        )
      }
      const data = (await res.json()) as { text?: string }
      if (!data.text) throw new Error(t("Empty response. Try rephrasing your prompt."))
      setResult(data.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Something went wrong"))
    } finally {
      setLoading(false)
    }
  }

  const buildHtml = () => {
    const paras = result
      .split(/\n{2,}|\r\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escape(p)}</p>`)
      .join("")
    return `<h2>${escape(prompt.trim().slice(0, 80))}</h2>${paras}`
  }

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-4 overflow-hidden p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" /> {t("Help me write")}
          </DialogTitle>
          <DialogDescription className="text-left">
            {t("Describe what you need and the AI drafts it for you. Edit the result, then insert it into your document.")}
          </DialogDescription>
        </DialogHeader>

        <div className="slim-scroll -mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("e.g. Write a project update for our stakeholders about the Q3 launch…")}
            className="min-h-24 max-h-40 resize-none"
            maxLength={600}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void generate()
            }}
          />

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(t(s))}
                className="shrink-0 rounded-md border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
              >
                <Wand2 className="mr-1 inline h-3 w-3" />
                {t(s)}
              </button>
            ))}
          </div>

          <Button onClick={generate} disabled={!prompt.trim() || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? t("Writing…") : t("Generate draft")}
            {!loading && (
              <span className={cn("hidden text-[10px] font-normal opacity-60 sm:inline", "ml-1")}>(⌘↵)</span>
            )}
          </Button>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t("Draft (editable)")}</p>
              <Textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="max-h-[min(20rem,45dvh)] min-h-36 text-sm"
                aria-label={t("AI draft result")}
              />
            </div>
          )}
        </div>

        {result && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button size="sm" className="gap-1.5" onClick={() => { const html = buildHtml(); onOpenChange(false); setTimeout(() => onInsert(html), 240) }}>
              <CornerDownLeft className="h-3.5 w-3.5" /> {t("Insert at cursor")}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { const html = buildHtml(); onOpenChange(false); setTimeout(() => onReplace(html), 240) }}>
              {t("Replace document")}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void generate()}>
              <RefreshCw className="h-3.5 w-3.5" /> {t("Regenerate")}
            </Button>
            <Button
              size="sm" variant="ghost" className="gap-1.5"
              onClick={async () => {
                await navigator.clipboard.writeText(result).catch(() => {})
                setCopied(true)
                toast({ title: t("Copied to clipboard") })
                setTimeout(() => setCopied(false), 1800)
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {t("Copy")}
            </Button>
          </div>
        )}

        <DialogFooter className="text-xs text-muted-foreground">
          {t("Generated by Z-AI · always review AI drafts")}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
