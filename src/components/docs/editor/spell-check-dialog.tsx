"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  SpellCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n, type Lang } from "@/lib/i18n"
import { findTextMatches, scrollRangeIntoCanvasView, type TextMatch } from "@/lib/editor-dom"

export interface SpellCheckIssue {
  /** the exact text span in the document (used for locating + replacing) */
  quote: string
  /** "spelling" | "grammar" | "punctuation" | "style" */
  type: string
  /** suggested replacement ("" when no suggestion) */
  suggestion: string
  /** short human explanation */
  message: string
}

export interface SpellCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** the live editable page element (text extraction + in-place fixes) */
  pageRef: React.RefObject<HTMLDivElement | null>
  /** fires after a fix is applied so autosave + stats pick it up */
  onFixed: () => void
  lang: Lang
}

/** Must stay in sync with the server route cap. */
const MAX_TEXT = 12_000

/** Same block-element list findTextMatches uses — guarantees the plain text
 *  we send to the AI maps 1:1 onto the searchable text, so every returned
 *  quote is locatable in the DOM. */
const BLOCK_SELECTOR = "p,h1,h2,h3,h4,li,td,th,blockquote,pre,div"

interface IssueItem extends SpellCheckIssue {
  id: string
}

type Phase = "checking" | "error" | "done"

const TYPE_META: Record<string, { label: string; cls: string }> = {
  spelling: {
    label: "Spelling",
    cls: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  grammar: {
    label: "Grammar",
    cls: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  punctuation: {
    label: "Punctuation",
    cls: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  style: {
    label: "Style",
    cls: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
}

/** Concatenate the page's text exactly the way findTextMatches does
 *  (seamless within a block, "\n" between blocks). */
function extractText(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let full = ""
  let prevBlock: Element | null = null
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    const block = t.parentElement?.closest(BLOCK_SELECTOR) ?? null
    if (full.length > 0 && block !== prevBlock) full += "\n"
    full += t.textContent ?? ""
    prevBlock = block
  }
  return full
}

const clip = (s: string, max = 60): string => (s.length > max ? s.slice(0, max) + "…" : s)

/**
 * 拼写和语法检查 — AI-driven, Google-Docs-sidebar-style issue list.
 * Auto-checks on open, locates each issue in the document (click quote →
 * scroll + native selection highlight), one-click Fix / Ignore, Fix-all
 * (back-to-front so live ranges stay valid) and Recheck.
 */
export function SpellCheckDialog({
  open,
  onOpenChange,
  pageRef,
  onFixed,
  lang,
}: SpellCheckDialogProps) {
  const { t } = useI18n()
  const { toast } = useToast()

  const [phase, setPhase] = React.useState<Phase>("checking")
  const [issues, setIssues] = React.useState<IssueItem[]>([])
  const [errorMsg, setErrorMsg] = React.useState("")
  const [fixedTotal, setFixedTotal] = React.useState(0)
  const [fixingAll, setFixingAll] = React.useState(false)
  const [fixProgress, setFixProgress] = React.useState<{ i: number; total: number } | null>(null)
  const [truncated, setTruncated] = React.useState(false)
  /** guards against overlapping checks (recheck while one is in flight) */
  const checkSeq = React.useRef(0)

  /* ---------------------------------------------------------------- check */

  const runCheck = React.useCallback(async () => {
    const el = pageRef.current
    if (!el) return
    const seq = ++checkSeq.current
    setPhase("checking")
    setErrorMsg("")
    setIssues([])
    setFixedTotal(0)
    setFixProgress(null)

    const fullText = extractText(el)
    const text = fullText.slice(0, MAX_TEXT)
    setTruncated(fullText.length > MAX_TEXT)
    if (!text.trim()) {
      setPhase("done")
      return
    }

    try {
      const res = await fetch("/api/ai/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text, lang }),
      })
      if (seq !== checkSeq.current) return // a newer check superseded this one
      if (res.status === 429) {
        setErrorMsg(t("Too many requests — wait a moment and try again shortly."))
        setPhase("error")
        return
      }
      const data = (await res.json().catch(() => ({}))) as { issues?: SpellCheckIssue[]; error?: string }
      if (!res.ok || !Array.isArray(data.issues)) {
        // guests get a targeted "sign in to use AI" message from the local
        // API shim — surface it verbatim instead of a generic outage
        const guestHint = res.status === 403 && data.error ? data.error : ""
        setErrorMsg(guestHint || t("The AI service is unavailable right now."))
        setPhase("error")
        return
      }
      setIssues(
        data.issues.map((issue, i) => ({
          ...issue,
          id: `${i}:${issue.type}:${issue.quote.slice(0, 24)}`,
        }))
      )
      setPhase("done")
    } catch {
      if (seq !== checkSeq.current) return
      setErrorMsg(t("The AI service is unavailable right now."))
      setPhase("error")
    }
  }, [lang, pageRef, t])

  // auto-start whenever the dialog opens (and when the UI language changes mid-session)
  React.useEffect(() => {
    if (open) void runCheck()
  }, [open, runCheck])

  // drop the temporary selection highlight when the dialog closes
  React.useEffect(() => {
    if (!open) {
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        /* ignore */
      }
    }
  }, [open])

  /* -------------------------------------------------------------- locate */

  const locateMatches = React.useCallback((quote: string): TextMatch[] => {
    const el = pageRef.current
    if (!el || !quote) return []
    const exact = findTextMatches(el, quote, true)
    return exact.length > 0 ? exact : findTextMatches(el, quote, false)
  }, [pageRef])

  const notFoundToast = () =>
    toast({
      title: t("Couldn't find this text in the document"),
      description: t("The document may have changed since the check — try a recheck."),
    })

  /** Click a quote → scroll it into the canvas view + native selection highlight. */
  const jumpTo = (issue: IssueItem) => {
    const el = pageRef.current
    const match = locateMatches(issue.quote)[0]
    if (!el || !match) {
      notFoundToast()
      return
    }
    scrollRangeIntoCanvasView(el, match.range)
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(match.range)
    }
  }

  /* ----------------------------------------------------------------- fix */

  const applyRange = (range: Range, suggestion: string): boolean => {
    try {
      range.deleteContents()
      range.insertNode(document.createTextNode(suggestion))
      return true
    } catch {
      return false
    }
  }

  const fixOne = (issue: IssueItem) => {
    if (!issue.suggestion || fixingAll) return
    const el = pageRef.current
    const match = locateMatches(issue.quote)[0]
    if (!el || !match) {
      notFoundToast()
      return
    }
    if (!applyRange(match.range, issue.suggestion)) {
      toast({ title: t("Something went wrong"), variant: "destructive" })
      return
    }
    el.normalize()
    onFixed()
    setIssues((prev) => prev.filter((i) => i.id !== issue.id))
    setFixedTotal((n) => n + 1)
    toast({
      title: t("Fixed"),
      description: `${clip(issue.quote)} → ${clip(issue.suggestion)}`,
    })
  }

  const ignore = (issue: IssueItem) => {
    setIssues((prev) => prev.filter((i) => i.id !== issue.id))
  }

  /**
   * Fix everything with a suggestion. Every issue is re-located FIRST
   * (duplicate quotes map to distinct occurrences), then replacements run
   * back-to-front so earlier live ranges stay valid — exactly like the
   * find/replace engine.
   */
  const fixAll = async () => {
    const el = pageRef.current
    if (!el || fixingAll || phase !== "done") return
    const fixable = issues.filter((i) => i.suggestion && i.quote)
    if (fixable.length === 0) return

    setFixingAll(true)
    setFixProgress({ i: 0, total: fixable.length })

    const occurrence = new Map<string, number>()
    const located: Array<{ issue: IssueItem; match: TextMatch }> = []
    for (const issue of fixable) {
      const matches = locateMatches(issue.quote)
      const k = occurrence.get(issue.quote) ?? 0
      occurrence.set(issue.quote, k + 1)
      if (matches.length > k) located.push({ issue, match: matches[k] })
    }
    located.sort((a, b) => b.match.start - a.match.start)

    const doneIds = new Set<string>()
    let fixed = 0
    for (const p of located) {
      if (applyRange(p.match.range, p.issue.suggestion)) {
        fixed++
        doneIds.add(p.issue.id)
        setIssues((prev) => prev.filter((i) => !doneIds.has(i.id)))
        setFixedTotal((n) => n + 1)
        setFixProgress({ i: fixed, total: fixable.length })
        await new Promise((r) => setTimeout(r, 40)) // let the progress repaint
      }
    }

    if (fixed > 0) {
      el.normalize()
      onFixed()
      toast({
        title:
          fixed === fixable.length
            ? t("Fixed {n} issues", { n: fixed })
            : t("Fixed {n} of {total} issues", { n: fixed, total: fixable.length }),
      })
    } else {
      notFoundToast()
    }

    setFixProgress(null)
    setFixingAll(false)
  }

  /* -------------------------------------------------------------- render */

  const fixableCount = issues.filter((i) => i.suggestion).length
  const busy = phase === "checking" || fixingAll

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* fixed header */}
        <div className="flex shrink-0 flex-col gap-1 border-b px-4 pt-4 pr-10 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base leading-none font-semibold">
            <SpellCheck className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            {t("Spelling and grammar check")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {phase === "checking" && t("Scanning spelling, grammar, punctuation and style")}
            {phase === "error" && t("Check failed")}
            {phase === "done" &&
              (issues.length > 0
                ? t("Found {n} issues", { n: issues.length })
                : fixedTotal > 0
                  ? t("All flagged issues are fixed")
                  : t("No spelling or grammar issues found"))}
          </DialogDescription>
          {truncated && (
            <p className="text-[11px] text-muted-foreground/80">
              {t("Only the first 12,000 characters were checked")}
            </p>
          )}
        </div>

        {/* scrollable body */}
        <div className="slim-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {phase === "checking" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">{t("Checking your document…")}</p>
              <p className="text-xs text-muted-foreground">
                {t("Scanning spelling, grammar, punctuation and style")}
              </p>
              {/* scan shimmer */}
              <div className="mt-2 w-full max-w-[240px] space-y-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 animate-pulse rounded-full bg-muted"
                    style={{ width: `${100 - i * 18}%`, animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" />
              <p className="max-w-[280px] text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => void runCheck()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t("Retry")}
              </Button>
            </div>
          )}

          {phase === "done" && issues.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2
                className={cn("h-10 w-10", fixedTotal > 0 ? "text-primary" : "text-emerald-500")}
                aria-hidden="true"
              />
              <p className="text-sm font-medium">
                {fixedTotal > 0
                  ? t("All flagged issues are fixed")
                  : t("No spelling or grammar issues found")}
              </p>
              <p className="text-xs text-muted-foreground">{t("Your document reads clean.")}</p>
            </div>
          )}

          {phase === "done" && issues.length > 0 && (
            <div className="space-y-2.5">
              <p className="pb-0.5 text-[11px] text-muted-foreground/80">
                {t("Click the bold text to locate it in the document")}
              </p>
              {issues.map((issue) => {
                const meta = TYPE_META[issue.type] ?? TYPE_META.grammar
                const canFix = Boolean(issue.suggestion)
                return (
                  <div
                    key={issue.id}
                    className="rounded-lg border bg-card p-3 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium",
                          meta.cls
                        )}
                      >
                        {t(meta.label)}
                      </span>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm leading-snug break-words font-semibold text-foreground underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:decoration-primary"
                        onClick={() => jumpTo(issue)}
                        title={issue.quote}
                        aria-label={t("Jump to this issue in the document")}
                      >
                        <span className="line-clamp-2">{issue.quote}</span>
                      </button>
                    </div>

                    {issue.message && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {issue.message}
                      </p>
                    )}

                    {canFix && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed">
                        <span className="line-clamp-2 min-w-0 flex-1 break-words text-muted-foreground line-through decoration-muted-foreground/50">
                          {issue.quote}
                        </span>
                        <ArrowRight
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="line-clamp-2 min-w-0 flex-1 break-words font-medium text-primary">
                          {issue.suggestion}
                        </span>
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 rounded-md px-3 text-xs"
                        disabled={!canFix || fixingAll}
                        onClick={() => fixOne(issue)}
                        aria-label={t("Fix this issue")}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("Fix")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-md px-3 text-xs text-muted-foreground"
                        disabled={fixingAll}
                        onClick={() => ignore(issue)}
                        aria-label={t("Ignore this issue")}
                      >
                        {t("Ignore")}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* fixed footer */}
        <div className="flex shrink-0 flex-col gap-2 border-t px-4 py-3">
          {phase === "done" && (issues.length > 0 || fixedTotal > 0) && (
            <p className="tnum text-xs text-muted-foreground">
              {fixProgress
                ? t("Fixing {i} of {total}…", { i: fixProgress.i, total: fixProgress.total })
                : t("Fixed {n} · {m} remaining", { n: fixedTotal, m: issues.length })}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void runCheck()}
              className="h-8"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", phase === "checking" && "animate-spin")}
                aria-hidden="true"
              />
              {t("Recheck")}
            </Button>
            <Button
              size="sm"
              className="h-8"
              disabled={fixingAll || phase !== "done" || fixableCount === 0}
              onClick={() => void fixAll()}
            >
              {fixingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t("Fix all")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
