"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  Sparkles, Loader2, Copy, Check, FileText, Wand2, SpellCheck, Minimize2, Maximize2, Lightbulb,
  Replace, CornerDownLeft, RefreshCw, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { countWords } from "@/lib/doc-utils"
import { useI18n } from "@/lib/i18n"

export type AiAction = "summarize" | "improve" | "proofread" | "shorten" | "lengthen" | "simplify"

const ACTIONS: Array<{ id: AiAction; label: string; hint: string; icon: React.ElementType }> = [
  { id: "summarize", label: "Summarize", hint: "Key points in seconds", icon: FileText },
  { id: "improve", label: "Improve writing", hint: "Clearer, polished phrasing", icon: Wand2 },
  { id: "proofread", label: "Fix grammar", hint: "Spelling & punctuation pass", icon: SpellCheck },
  { id: "shorten", label: "Shorten", hint: "Tighten to the essentials", icon: Minimize2 },
  { id: "lengthen", label: "Lengthen", hint: "Add detail & flow", icon: Maximize2 },
  { id: "simplify", label: "Simplify", hint: "Plain, jargon-free language", icon: Lightbulb },
]

export interface AiSource {
  text: string
  isSelection: boolean
}

export function AiToolsDialog({
  open, onOpenChange, docTitle, source, onReplace, onInsert,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  docTitle: string
  /** Text the actions operate on (selection if any, else the whole doc). */
  source: AiSource | null
  /** Replace the source region (selection or whole doc) with the result. */
  onReplace: (text: string) => void
  /** Insert the result at the caret as new paragraphs. */
  onInsert: (text: string) => void
}) {
  const [action, setAction] = React.useState<AiAction>("improve")
  const [result, setResult] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [showSource, setShowSource] = React.useState(false)
  const { toast } = useToast()
  const { t, lang } = useI18n()

  React.useEffect(() => {
    if (open) {
      setAction("improve")
      setResult("")
      setError(null)
      setLoading(false)
      setShowSource(false)
    }
  }, [open])

  const run = async () => {
    if (!source?.text.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult("")
    try {
      const res = await fetch("/api/ai/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source.text, action, title: docTitle, lang }),
      })
      const data = (await res.json()) as { text?: string; error?: string }
      if (!res.ok || !data.text) throw new Error(data.error ?? t("The AI service is unavailable right now."))
      setResult(data.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Something went wrong"))
    } finally {
      setLoading(false)
    }
  }

  const srcWords = source ? countWords(source.text) : 0
  const outWords = countWords(result)
  const delta = result ? outWords - srcWords : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-4 overflow-hidden p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" /> {t("AI polish")}
          </DialogTitle>
          <DialogDescription className="text-left">
            {t("One-click transformations on")}{lang === "en" ? " " : null}
            {source?.isSelection ? (
              <span className="font-medium text-foreground">{t("your selection ({n} words)", { n: srcWords })}</span>
            ) : (
              <span className="font-medium text-foreground">{t("the whole document ({n} words)", { n: srcWords })}</span>
            )}
            {t(". Review the result before applying it.")}
          </DialogDescription>
        </DialogHeader>

        <div className="slim-scroll -mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          {/* action grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("AI action")}>
            {ACTIONS.map((a) => {
              const Icon = a.icon
              const selected = action === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAction(a.id)}
                  disabled={loading}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150",
                    "hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                      : "border-border bg-card"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                    {t(a.label)}
                  </span>
                  <span className="text-[10.5px] leading-tight text-foreground/60">{t(a.hint)}</span>
                </button>
              )
            })}
          </div>

          {/* source preview */}
          {source && (
            <details
              className="group rounded-lg border bg-muted/40"
              open={showSource}
              onToggle={(e) => setShowSource(e.currentTarget.open)}
            >
              <summary className="flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
                <span>
                  {source.isSelection ? t("Selected text") : t("Document text")} · {t("{n} words", { n: srcWords.toLocaleString() })}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="max-h-32 overflow-y-auto border-t bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {source.text.slice(0, 900)}
                {source.text.length > 900 ? "…" : ""}
              </div>
            </details>
          )}

          <Button onClick={run} disabled={!source?.text.trim() || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? t("Working…") : t("Run AI polish")}
          </Button>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t("Result (editable)")}</p>
                {delta !== 0 && (
                  <p
                    className={cn(
                      "text-[11px] font-medium",
                      delta > 0 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {t("{delta} words vs {target}", {
                      delta: `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`,
                      target: source?.isSelection ? t("selection") : t("document"),
                    })}
                  </p>
                )}
              </div>
              <Textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="max-h-[min(20rem,45dvh)] min-h-36 text-sm"
                aria-label={t("AI result")}
              />
            </div>
          )}
        </div>

        {result && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onOpenChange(false)
                setTimeout(() => onReplace(result), 240)
              }}
            >
              <Replace className="h-3.5 w-3.5" />
              {source?.isSelection ? t("Replace selection") : t("Replace document")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                onOpenChange(false)
                setTimeout(() => onInsert(result), 240)
              }}
            >
              <CornerDownLeft className="h-3.5 w-3.5" /> {t("Insert below cursor")}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void run()} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> {t("Retry")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
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
          {t("Generated by Z-AI · always review AI edits")}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
