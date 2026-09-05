"use client"

import * as React from "react"
import { useI18n } from "@/lib/i18n"
import { htmlToText } from "@/lib/doc-utils"
import { computeInsights, type DensityScore, type LengthBucket } from "@/lib/writing-insights"
import type { WritingStudioProps } from "./writing-studio"

/**
 * 写作心得 tab — Ellipsus-style 15 text-insight metrics:
 * 文本复杂性 / 词汇多样性 / 句子长度 / 句子节奏 / 段落密度 / 句子开头 /
 * 被动语态 / 副词 / 词频 / 词语回声 / 重复的短语 / 对话平衡 / 观点看法 /
 * 标点符号习惯 (+ 顶部总览).
 * All charts are hand-rolled divs/CSS (no chart deps); clicking a sentence,
 * bar or dot locates it in the live document via highlightText().
 */

// ---------------------------------------------------------------------------
// building blocks
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  badge,
  desc,
  className = "",
  children,
}: {
  title: string
  badge?: string
  desc?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={"rounded-xl border p-4 " + className}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {badge !== undefined ? (
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      {desc ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
      ) : null}
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  )
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-2 py-2.5 text-center">
      <div className="truncate text-[10px] text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}

/** label + colored bar + value row used by several metrics */
function MeterRow({
  label,
  pct,
  value,
  color,
}: {
  label: string
  pct: number
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[38%] shrink-0 truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={"h-full rounded-full " + color}
          style={{ width: `${Math.max(pct > 0 ? 2 : 0, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="w-16 shrink-0 truncate text-right text-[11px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  )
}

/** clickable snippet that jumps to (and highlights) the text in the document */
function LocateText({
  text,
  onLocate,
  className = "",
}: {
  text: string
  onLocate: (s: string) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onLocate(text)}
      title={text}
      className={
        "block w-full truncate rounded-sm text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
        className
      }
    >
      {text}
    </button>
  )
}

const DENSITY_META: Array<{ score: DensityScore; color: string; labelKey: string }> = [
  { score: "simple", color: "bg-emerald-500", labelKey: "Simple" },
  { score: "medium", color: "bg-amber-500", labelKey: "Medium" },
  { score: "complex", color: "bg-orange-500", labelKey: "Complex" },
  { score: "dense", color: "bg-rose-500", labelKey: "Dense" },
]

// ---------------------------------------------------------------------------
// main component
// ---------------------------------------------------------------------------

export function WritingInsightsTab(props: WritingStudioProps) {
  const { open, html, highlightText } = props
  const { t } = useI18n()

  const text = React.useMemo(() => htmlToText(html), [html])
  const ins = React.useMemo(() => (open ? computeInsights(text) : null), [open, text])

  if (!ins || ins.summary.words === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {t("This document is empty — start writing and insights will appear here.")}
      </div>
    )
  }

  const locate = highlightText
  const total = ins.summary.sentences
  const pctOf = (n: number): number => (total > 0 ? (n / total) * 100 : 0)

  // 1. text complexity
  const cx = ins.textComplexity
  const grade = Math.round(cx.grade)

  // 3. sentence lengths
  const lenRows: Array<{ label: string; bucket: LengthBucket; color: string }> = [
    { label: t("Short (≤5 words)"), bucket: ins.sentenceLengths.short, color: "bg-emerald-500" },
    { label: t("Medium (6–14 words)"), bucket: ins.sentenceLengths.medium, color: "bg-amber-500" },
    { label: t("Long (15–25 words)"), bucket: ins.sentenceLengths.long, color: "bg-orange-500" },
    { label: t("Very long (>25 words)"), bucket: ins.sentenceLengths.veryLong, color: "bg-rose-500" },
  ]

  // 4. sentence rhythm
  const bars = ins.sentenceRhythm.slice(0, 120)
  const maxWc = bars.reduce((m, b) => Math.max(m, b.wordCount), 1)

  // 6. paragraph density
  const dots = ins.paragraphDensity.slice(0, 150)

  // 7. sentence openers
  const openerRows = [
    { label: t("Pronoun"), value: ins.sentenceOpeners.pronoun, color: "bg-primary" },
    { label: t("Article"), value: ins.sentenceOpeners.article, color: "bg-emerald-500" },
    { label: t("Conjunction"), value: ins.sentenceOpeners.conjunction, color: "bg-amber-500" },
    { label: t("Other"), value: ins.sentenceOpeners.other, color: "bg-violet-400" },
  ]

  // 8. passive voice
  const pv = ins.passiveVoice
  const pvPct = Math.round(pctOf(pv.sentences.length))

  // 10. word frequency
  const maxFreq = ins.wordFrequency.reduce((m, f) => Math.max(m, f.count), 1)

  // 13. point of view
  const povRows = [
    { label: t("First person"), value: ins.pointOfView.first, examples: ins.pointOfView.examples.first, color: "bg-primary" },
    { label: t("Second person"), value: ins.pointOfView.second, examples: ins.pointOfView.examples.second, color: "bg-emerald-500" },
    { label: t("Third person"), value: ins.pointOfView.third, examples: ins.pointOfView.examples.third, color: "bg-amber-500" },
  ]

  // 15. punctuation habits
  const maxPunct = ins.punctuationHabits.reduce((m, h) => Math.max(m, h.per1000), 1)

  return (
    <div className="max-h-[min(30rem,60dvh)] overflow-y-auto slim-scroll pr-1">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 总览 */}
        <SectionCard title={t("Overview")} className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell label={t("Sentences")} value={ins.summary.sentences} />
            <StatCell label={t("Words")} value={ins.summary.words} />
            <StatCell label={t("Paragraphs")} value={ins.summary.paragraphs} />
            <StatCell
              label={t("Avg. sentence length")}
              value={t("{n} words", { n: ins.summary.avgSentenceLen })}
            />
          </div>
        </SectionCard>

        {/* 文本复杂性 */}
        <SectionCard
          title={t("Text complexity")}
          badge={cx.isCJK ? t("Chinese") : t("Flesch–Kincaid")}
          desc={t(
            "Reading-level estimate — scores have no good or bad, they only hint at how complex the text is. (Flesch–Kincaid readability test.)"
          )}
        >
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums text-primary">{grade}</span>
            <span className="text-[13px] font-medium text-foreground">
              {t(cx.label, { grade })}
            </span>
          </div>
          {cx.isCJK ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {t("Chinese text uses a weighted sentence-length estimate.")}
            </p>
          ) : null}
        </SectionCard>

        {/* 词汇多样性 */}
        <SectionCard
          title={t("Vocabulary diversity")}
          badge={t("{pct}% unique words", { pct: ins.vocabDiversity })}
          desc={t("Unique words as a share of all words (type-token ratio).")}
        >
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, ins.vocabDiversity)}%` }}
            />
          </div>
        </SectionCard>

        {/* 句子长度 */}
        <SectionCard
          title={t("Sentence lengths")}
          desc={t("How sentences distribute across length bands.")}
        >
          <div className="space-y-1.5">
            {lenRows.map((r) => (
              <MeterRow
                key={r.label}
                label={r.label}
                pct={r.bucket.pct}
                value={`${r.bucket.count} · ${r.bucket.pct}%`}
                color={r.color}
              />
            ))}
          </div>
        </SectionCard>

        {/* 句子节奏 */}
        <SectionCard
          title={t("Sentence rhythm")}
          desc={t(
            "One bar per sentence — height is word count. Hover or click a bar to locate the sentence in the document."
          )}
        >
          <div className="flex h-24 items-end gap-[3px] overflow-x-auto no-scrollbar">
            {bars.map((b, idx) => (
              <button
                key={idx}
                type="button"
                title={t("Sentence {n} · {w} words", { n: idx + 1, w: b.wordCount })}
                aria-label={t("Sentence {n} · {w} words", { n: idx + 1, w: b.wordCount })}
                onMouseEnter={() => locate(b.sentence)}
                onClick={() => locate(b.sentence)}
                className="w-1.5 shrink-0 rounded-sm bg-primary/70 transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                style={{ height: `${Math.max(6, (b.wordCount / maxWc) * 100)}%` }}
              />
            ))}
          </div>
          {ins.sentenceRhythm.length > 120 ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {t("Showing first 120 sentences")}
            </p>
          ) : null}
        </SectionCard>

        {/* 段落密度 */}
        <SectionCard
          title={t("Paragraph density")}
          desc={t(
            "Each dot is a paragraph, colored by reading density. Hover to locate it in the document."
          )}
        >
          <div className="flex flex-wrap gap-1.5">
            {dots.map((p, idx) => {
              const meta = DENSITY_META.find((d) => d.score === p.score)!
              const label = t("Paragraph {n} · {label}", { n: idx + 1, label: t(meta.labelKey) })
              return (
                <button
                  key={idx}
                  type="button"
                  title={label}
                  aria-label={label}
                  onMouseEnter={() => locate(p.text.slice(0, 40))}
                  onClick={() => locate(p.text.slice(0, 40))}
                  className={
                    "h-3 w-3 rounded-full transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
                    meta.color
                  }
                />
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
            {DENSITY_META.map((d) => (
              <span
                key={d.score}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
              >
                <span className={"h-2 w-2 rounded-full " + d.color} />
                {t(d.labelKey)}
              </span>
            ))}
          </div>
        </SectionCard>

        {/* 句子开头 */}
        <SectionCard
          title={t("Sentence openers")}
          desc={t("What kinds of words your sentences start with.")}
        >
          <div className="space-y-1.5">
            {openerRows.map((r) => (
              <MeterRow
                key={r.label}
                label={r.label}
                pct={pctOf(r.value)}
                value={t("{n} sentences", { n: r.value })}
                color={r.color}
              />
            ))}
          </div>
        </SectionCard>

        {/* 被动语态 */}
        <SectionCard
          title={t("Passive voice")}
          badge={t("{n} sentences", { n: pv.sentences.length })}
          desc={t("Be-verb + past participle. Fine in moderation — worth a look if it piles up.")}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-primary">{pv.count}</span>
            <span className="text-[11px] text-muted-foreground">
              {t("{pct}% of sentences", { pct: pvPct })}
            </span>
          </div>
          {pv.sentences.length > 0 ? (
            <div className="mt-2.5 space-y-1">
              {pv.sentences.slice(0, 4).map((s, i) => (
                <LocateText key={i} text={s} onLocate={locate} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("No passive constructions detected")}
            </p>
          )}
        </SectionCard>

        {/* 副词 */}
        <SectionCard
          title={t("Adverbs")}
          badge={t("{n} per 1,000 words", { n: ins.adverbs.per1000 })}
          desc={t("-ly adverbs and 地-adverbials. Great for nuance, easy to overuse.")}
        >
          {ins.adverbs.words.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {ins.adverbs.words.slice(0, 24).map((w) => (
                <span
                  key={w}
                  className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground"
                >
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t("No adverbs detected")}</p>
          )}
        </SectionCard>

        {/* 词频 */}
        <SectionCard
          title={t("Word frequency")}
          desc={t("Most repeated content words (stopwords excluded).")}
        >
          {ins.wordFrequency.length > 0 ? (
            <div className="space-y-1.5">
              {ins.wordFrequency.map((f) => (
                <div key={f.word} className="flex items-center gap-2">
                  <span
                    className="w-20 shrink-0 truncate text-[12px] font-medium text-foreground"
                    title={f.word}
                  >
                    {f.word}
                  </span>
                  <div className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(f.count / maxFreq) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    ×{f.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t("Not enough repeated words yet")}</p>
          )}
        </SectionCard>

        {/* 词语回声 */}
        <SectionCard
          title={t("Word echo")}
          badge={t("{n} echoes", { n: ins.wordEcho.count })}
          desc={t(
            "Adjacent sentences that share content words — can read as an intentional refrain or as an accidental echo."
          )}
        >
          {ins.wordEcho.pairs.length > 0 ? (
            <div className="space-y-2">
              {ins.wordEcho.pairs.slice(0, 4).map((p, i) => (
                <div key={i} className="rounded-lg bg-muted/40 p-2">
                  <LocateText text={p.a} onLocate={locate} />
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{t("Shared words")}</span>
                    {p.shared.slice(0, 6).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-primary/10 px-1 py-px text-[10px] text-primary"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground" title={p.b}>
                    {p.b}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {t("No echoes between adjacent sentences")}
            </p>
          )}
        </SectionCard>

        {/* 重复的短语 */}
        <SectionCard
          title={t("Repeated phrases")}
          desc={t("Phrases of 2–6 words appearing 3+ times.")}
        >
          {ins.repeatedPhrases.length > 0 ? (
            <ul className="space-y-1">
              {ins.repeatedPhrases.map((p) => (
                <li key={p.phrase} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-foreground" title={p.phrase}>
                    {p.phrase}
                  </span>
                  <span className="shrink-0 rounded-md bg-accent px-1.5 py-px text-[11px] tabular-nums text-accent-foreground">
                    ×{p.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t("No phrase repeats 3+ times")}</p>
          )}
        </SectionCard>

        {/* 对话平衡 */}
        <SectionCard
          title={t("Dialogue balance")}
          badge={t("{pct}% dialogue", { pct: ins.dialogueBalance.dialoguePct })}
          desc={t("Share of characters inside quotes vs. narration.")}
        >
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-primary"
              style={{ width: `${Math.min(100, ins.dialogueBalance.dialoguePct)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="font-medium text-primary">
              {t("Dialogue")} {ins.dialogueBalance.dialoguePct}%
            </span>
            <span className="text-muted-foreground">
              {t("Narration")} {ins.dialogueBalance.narrationPct}%
            </span>
          </div>
          {ins.dialogueBalance.dialogueSentences.length > 0 ? (
            <div className="mt-2.5 space-y-1">
              <p className="text-[10px] tracking-wide text-muted-foreground">
                {t("Sentences with quotes")}
              </p>
              {ins.dialogueBalance.dialogueSentences.slice(0, 5).map((s, i) => (
                <LocateText key={i} text={s} onLocate={locate} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">{t("No dialogue detected")}</p>
          )}
        </SectionCard>

        {/* 观点看法 */}
        <SectionCard
          title={t("Point of view")}
          desc={t("The person each sentence is told from (first marker wins).")}
        >
          <div className="space-y-2">
            {povRows.map((r) => (
              <div key={r.label}>
                <MeterRow
                  label={r.label}
                  pct={pctOf(r.value)}
                  value={t("{n} sentences", { n: r.value })}
                  color={r.color}
                />
                {r.examples.slice(0, 1).map((ex, i) => (
                  <LocateText key={i} text={ex} onLocate={locate} className="mt-0.5" />
                ))}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 标点符号习惯 */}
        <SectionCard
          title={t("Punctuation habits")}
          desc={t("How often each mark appears per 1,000 words.")}
        >
          {ins.punctuationHabits.length > 0 ? (
            <div className="space-y-1.5">
              {ins.punctuationHabits.map((h) => (
                <div key={h.label} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-center text-[13px] font-semibold text-foreground">
                    {h.char}
                  </span>
                  <span
                    className="w-20 shrink-0 truncate text-[11px] text-muted-foreground"
                    title={t(h.label)}
                  >
                    {t(h.label)}
                  </span>
                  <div className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.max(2, (h.per1000 / maxPunct) * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {h.per1000}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {t("No notable punctuation habits")}
            </p>
          )}
        </SectionCard>

        <p className="col-span-full px-1 pb-1 text-[10px] text-muted-foreground">
          {t("Click a sentence to locate it in the document.")}
        </p>
      </div>
    </div>
  )
}
