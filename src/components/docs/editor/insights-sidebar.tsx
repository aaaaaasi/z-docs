"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles, X, BarChart3, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { htmlToText } from "@/lib/doc-utils"
import { computeInsights, type InsightsResult } from "@/lib/writing-insights"

/**
 * 写作洞察侧栏 — Ellipsus-style LIVE insights rail (their official spec:
 * "Writing insights lives in the right sidebar in the editor… the metrics
 * update in real-time as you write, so it keeps up with you without
 * interrupting your flow. On longer documents, you may briefly see an
 * 'Analyzing…' state while it finishes calculating.").
 *
 * This is the always-on companion to the deep-dive WritingStudioDialog:
 * a compact, single-column digest of every metric that re-computes from
 * the live document ~0.45s after typing pauses, with an Analyzing state
 * for long documents. Clicking any bar/dot/sentence locates it in the doc.
 */

interface InsightsSidebarProps {
  open: boolean
  onClose: () => void
  /** live document HTML straight from contentRef */
  html: string
  /** bumped on every editor input — drives the debounced recompute */
  contentTick: number
  /** open the full WritingStudioDialog deep-dive */
  onOpenStudio: () => void
  /** locate + highlight a text snippet in the live document */
  highlightText: (text: string) => void
}

/** recompute delay after the last keystroke (ms) */
const DEBOUNCE_MS = 450
/** above this many characters the Analyzing badge is shown while computing */
const LONG_DOC_CHARS = 2400

export function InsightsSidebar({
  open,
  onClose,
  html,
  contentTick,
  onOpenStudio,
  highlightText,
}: InsightsSidebarProps) {
  const { t } = useI18n()
  const [text, setText] = React.useState("")
  const [ins, setIns] = React.useState<InsightsResult | null>(null)
  const [analyzing, setAnalyzing] = React.useState(false)

  // live pipeline: debounce the raw HTML → plain text → insights, with an
  // "Analyzing…" yield so long documents paint the badge before the sync
  // compute pass (exactly the Ellipsus behavior).
  React.useEffect(() => {
    if (!open) return
    setAnalyzing(true)
    const timer = setTimeout(() => {
      const next = htmlToText(html)
      setText(next)
      if (next.length > LONG_DOC_CHARS) {
        // let the browser paint the Analyzing badge first
        setTimeout(() => {
          setIns(computeInsights(next))
          setAnalyzing(false)
        }, 30)
      } else {
        setIns(computeInsights(next))
        setAnalyzing(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [open, html, contentTick])

  return (
    <aside
      aria-label={t("Writing insights")}
      data-open={open}
      className={cn(
        "no-print relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-l bg-background/95 backdrop-blur-sm",
        "transition-[margin-right] duration-300 ease-in-out",
        open ? "mr-0" : "pointer-events-none -mr-[292px] max-lg:-mr-[100%]",
        // three-tier: phone full-width overlay → tablet 340px floating panel →
        // desktop 292px docked rail
        "w-full lg:w-auto md:w-[340px]",
        "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:border-l max-lg:bg-background max-lg:transition-transform",
        !open && "max-lg:pointer-events-none max-lg:translate-x-full"
      )}
    >
      <div className="flex h-full w-full flex-col lg:w-[292px]">
        {/* header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t("Writing insights")}</h2>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              analyzing
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {t("Analyzing…")}
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {t("Live")}
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Close writing insights")}
            className="ml-auto h-8 w-8 rounded-md text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* body */}
        <div className="slim-scroll flex-1 overflow-y-auto px-3 py-3">
          {!ins || ins.summary.words === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-editorial text-[14.5px] font-medium italic tracking-tight text-foreground/80">
                {t("This document is empty — start writing and insights will appear here.")}
              </p>
            </div>
          ) : (
            <InsightsBody ins={ins} analyzing={analyzing} onLocate={highlightText} onOpenStudio={onOpenStudio} t={t} />
          )}
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ body */

function InsightsBody({
  ins,
  analyzing,
  onLocate,
  onOpenStudio,
  t,
}: {
  ins: InsightsResult
  analyzing: boolean
  onLocate: (s: string) => void
  onOpenStudio: () => void
  t: ReturnType<typeof useI18n>["t"]
}) {
  const total = ins.summary.sentences
  const pctOf = (n: number): number => (total > 0 ? (n / total) * 100 : 0)
  const cx = ins.textComplexity
  const zh = cx.isCJK
  const grade = Math.round(cx.grade)
  const rhythm = ins.sentenceRhythm.slice(-64)
  const maxWc = rhythm.reduce((m, b) => Math.max(m, b.wordCount), 1)
  const dialogue = ins.dialogueBalance
  const pv = ins.passiveVoice
  const len = ins.sentenceLengths

  const lenRows = zh
    ? [
        { key: "Short (≤15 chars)", bucket: len.short, color: "bg-emerald-500" },
        { key: "Medium (16–30 chars)", bucket: len.medium, color: "bg-amber-500" },
        { key: "Long (31–40 chars)", bucket: len.long, color: "bg-orange-500" },
        { key: "Very long (>40 chars)", bucket: len.veryLong, color: "bg-rose-500" },
      ]
    : [
        { key: "Short (≤5 words)", bucket: len.short, color: "bg-emerald-500" },
        { key: "Medium (6–14 words)", bucket: len.medium, color: "bg-amber-500" },
        { key: "Long (15–25 words)", bucket: len.long, color: "bg-orange-500" },
        { key: "Very long (>25 words)", bucket: len.veryLong, color: "bg-rose-500" },
      ]
  const povRows = [
    { key: "First person", value: ins.pointOfView.first, color: "bg-primary" },
    { key: "Second person", value: ins.pointOfView.second, color: "bg-emerald-500" },
    { key: "Third person", value: ins.pointOfView.third, color: "bg-amber-500" },
  ]

  return (
    <div
      className={cn("space-y-4 transition-opacity", analyzing && "opacity-60")}
      aria-busy={analyzing}
    >
      {/* overview strip */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label={t("Words")} value={ins.summary.words} />
        <Metric label={t("Sentences")} value={ins.summary.sentences} />
        <Metric label={t("Paragraphs")} value={ins.summary.paragraphs} />
      </div>

      {/* complexity + diversity */}
      <Block title={t("Text complexity")}>
        {zh ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-primary">{cx.score}</span>
              <span className="text-[12px] font-medium text-foreground">
                {t("/ 100 · {band}", { band: t(cx.band) })}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.min(100, cx.score)}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-primary">{grade}</span>
            <span className="text-[12px] font-medium text-foreground">{t(ins.textComplexity.label, { grade })}</span>
          </div>
        )}
      </Block>

      <Block
        title={t("Vocabulary diversity")}
        right={t(zh ? "{pct}% unique word forms" : "{pct}% unique words", { pct: ins.vocabDiversity })}
      >
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(100, ins.vocabDiversity)}%` }}
          />
        </div>
      </Block>

      {/* sentence lengths */}
      <Block title={t("Sentence lengths")}>
        <div className="flex h-6 items-end gap-1">
          {lenRows.map((r) => (
            <Tooltip key={r.key}>
              <TooltipTrigger asChild>
                <div
                  role="img"
                  className={"min-w-0 flex-1 rounded-t-sm transition-[height] duration-500 " + r.color}
                  style={{ height: `${Math.max(4, r.bucket.pct)}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                {t(r.key)} · {r.bucket.count} · {r.bucket.pct}%
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>{t(zh ? "Short (≤15 chars)" : "Short (≤5 words)")}</span>
          <span>{t(zh ? "Very long (>40 chars)" : "Very long (>25 words)")}</span>
        </div>
      </Block>

      {/* rhythm sparkline (live — last 64 sentences) */}
      <Block title={t("Sentence rhythm")} right={t("Live")}>
        <div className="flex h-12 items-end gap-[2px]">
          {rhythm.map((b, i) => (
            <button
              key={i}
              type="button"
              title={t(zh ? "Sentence {n} · {w} chars" : "Sentence {n} · {w} words", {
                n: ins.sentenceRhythm.length - rhythm.length + i + 1,
                w: b.wordCount,
              })}
              aria-label={t(zh ? "Sentence {n} · {w} chars" : "Sentence {n} · {w} words", {
                n: ins.sentenceRhythm.length - rhythm.length + i + 1,
                w: b.wordCount,
              })}
              onMouseEnter={() => onLocate(b.sentence)}
              onClick={() => onLocate(b.sentence)}
              className="w-full min-w-[2px] shrink-0 rounded-sm bg-primary/60 transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{ height: `${Math.max(8, (b.wordCount / maxWc) * 100)}%` }}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {t("Click a sentence to locate it in the document.")}
        </p>
      </Block>

      {/* dialogue balance */}
      <Block title={t("Dialogue balance")} right={t("{pct}% dialogue", { pct: dialogue.dialoguePct })}>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(100, dialogue.dialoguePct)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{t("Dialogue")} {dialogue.dialoguePct}%</span>
          <span>{t("Narration")} {dialogue.narrationPct}%</span>
        </div>
      </Block>

      {/* passive + adverbs */}
      <Block title={t("Passive voice")} right={t("{n} sentences", { n: pv.sentences.length })}>
        <p className="text-[11px] text-muted-foreground">
          {t("{pct}% of sentences", { pct: Math.round(pctOf(pv.sentences.length)) })}
        </p>
        {pv.sentences[0] && (
          <button
            type="button"
            onClick={() => onLocate(pv.sentences[0])}
            title={pv.sentences[0]}
            className="mt-1 block w-full truncate text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:text-primary hover:underline"
          >
            {pv.sentences[0]}
          </button>
        )}
      </Block>

      <Block title={t("Adverbs")} right={t("{n} per 1,000 words", { n: ins.adverbs.per1000 })}>
        {ins.adverbs.words.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {ins.adverbs.words.slice(0, 10).map((w) => (
              <span key={w} className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                {w}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t("No adverbs detected")}</p>
        )}
      </Block>

      {/* word frequency */}
      <Block title={t("Word frequency")}>
        {ins.wordFrequency.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {ins.wordFrequency.slice(0, 6).map((f) => (
              <span
                key={f.word}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px]"
                title={f.word}
              >
                <span className="max-w-24 truncate">{f.word}</span>
                <span className="tabular-nums font-medium text-primary">×{f.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t("Not enough repeated words yet")}</p>
        )}
      </Block>

      {/* paragraph density dots */}
      <Block title={t("Paragraph density")}>
        <div className="flex flex-wrap gap-1">
          {ins.paragraphDensity.slice(-48).map((p, i) => {
            const score =
              p.score === "simple"
                ? "bg-emerald-500"
                : p.score === "medium"
                  ? "bg-amber-500"
                  : p.score === "complex"
                    ? "bg-orange-500"
                    : "bg-rose-500"
            return (
              <button
                key={i}
                type="button"
                title={t("Paragraph {n} · {label}", { n: ins.paragraphDensity.length - 48 + i + 1, label: t(p.score === "simple" ? "Simple" : p.score === "medium" ? "Medium" : p.score === "complex" ? "Complex" : "Dense") })}
                onMouseEnter={() => onLocate(p.text.slice(0, 40))}
                onClick={() => onLocate(p.text.slice(0, 40))}
                className={"h-2.5 w-2.5 rounded-full transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " + score}
              />
            )
          })}
        </div>
      </Block>

      {/* point of view */}
      <Block title={t("Point of view")}>
        <div className="space-y-1">
          {povRows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-14 shrink-0 truncate text-[10px] text-muted-foreground">{t(r.key)}</span>
              <div className="h-1.5 min-w-4 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={"h-full rounded-full " + r.color}
                  style={{ width: `${Math.max(pctOf(r.value) > 0 ? 3 : 0, Math.min(100, pctOf(r.value)))}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      </Block>

      {/* echoes + repeats summary */}
      <Block title={t("Word echo")} right={t("{n} echoes", { n: ins.wordEcho.count })}>
        {ins.wordEcho.pairs[0] ? (
          <button
            type="button"
            onClick={() => onLocate(ins.wordEcho.pairs[0].a)}
            title={ins.wordEcho.pairs[0].a}
            className="block w-full truncate text-left text-[11px] text-muted-foreground transition-colors hover:text-primary hover:underline"
          >
            {ins.wordEcho.pairs[0].a}
          </button>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            {t("No echoes between adjacent sentences")}
          </p>
        )}
        {ins.repeatedPhrases.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ins.repeatedPhrases.slice(0, 3).map((p) => (
              <span
                key={p.phrase}
                title={p.phrase}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px]"
              >
                <span className="max-w-32 truncate">{p.phrase}</span>
                <span className="font-medium tabular-nums text-primary">×{p.count}</span>
              </span>
            ))}
          </div>
        )}
      </Block>

      {/* open the deep-dive studio */}
      <button
        type="button"
        onClick={onOpenStudio}
        className="group flex w-full items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-[12px] font-medium text-foreground">
            {t("Writing studio")}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {t("Writing journey") + " · " + t("Writing insights")}
          </span>
        </span>
        <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ atoms */

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-1.5 py-2 text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}

function Block({
  title,
  right,
  children,
}: {
  title: string
  right?: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {right ? <span className="shrink-0 text-[10px] font-medium tabular-nums text-primary">{right}</span> : null}
      </div>
      <div className="mt-1.5 min-w-0">{children}</div>
    </section>
  )
}
