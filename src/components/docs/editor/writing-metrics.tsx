"use client"

import * as React from "react"
import {
  ChartPie,
  FileText,
  Gauge,
  History,
  Info,
  Pause,
  PenLine,
  Ratio,
  Repeat,
  Timer,
  type LucideIcon,
} from "lucide-react"
import { useI18n, localeOf, type Lang } from "@/lib/i18n"
import { countWords, htmlToText } from "@/lib/doc-utils"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { WritingStats } from "@/lib/writing-tracker"
import type { WritingStudioProps } from "./writing-studio"

/**
 * 写作历程 tab — 8 real telemetry metric cards:
 * 总字数 / 有效写作时间 / 写作次数 / 平均写作速度 / 思考停顿 /
 * 总编辑次数 / 字数与修改次数比率 / 粘贴比例.
 *
 * Live values come from the tracker snapshot (props.stats); each time the
 * dialog opens we additionally GET /api/documents/:id/stats so the cards
 * reflect the newest persisted totals + editCount.
 */

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** Fill a partial server/tracker blob with zeros (defensive against gaps). */
function normStats(raw: Partial<WritingStats> | null | undefined): WritingStats {
  const n = (v: number | undefined): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0
  const s = (v: string | undefined): string => (typeof v === "string" ? v : "")
  return {
    activeMs: n(raw?.activeMs),
    sessions: n(raw?.sessions),
    pauses: n(raw?.pauses),
    pauseMs: n(raw?.pauseMs),
    keystrokes: n(raw?.keystrokes),
    typedChars: n(raw?.typedChars),
    typedWords: n(raw?.typedWords),
    pastedChars: n(raw?.pastedChars),
    startedAt: s(raw?.startedAt),
    lastAt: s(raw?.lastAt),
  }
}

function hasJourneyData(s: WritingStats): boolean {
  return Boolean(
    s.startedAt ||
      s.lastAt ||
      s.activeMs ||
      s.sessions ||
      s.pauses ||
      s.keystrokes ||
      s.typedChars ||
      s.typedWords ||
      s.pastedChars
  )
}

/** "2 小时 3 分 5 秒" / "3 分 5 秒" / "5 秒" (compact en: 2h 3m 5s …). */
function formatDuration(ms: number, t: TFunc): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return t("{h}h {m}m {s}s", { h, m, s })
  if (m > 0) return t("{m}m {s}s", { m, s })
  return t("{s}s", { s })
}

function nf(lang: Lang, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(localeOf(lang), opts)
}

function MetricCard({
  icon: Icon,
  title,
  tip,
  value,
  valueClass,
  sub,
  children,
}: {
  icon: LucideIcon
  title: string
  tip?: string
  value: React.ReactNode
  valueClass?: string
  sub?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Tooltip>
        <TooltipTrigger
          asChild
          tabIndex={0}
          className="flex w-fit max-w-full cursor-default items-center gap-1.5 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <div>
            <Icon className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden="true" />
            <span className="truncate">{title}</span>
            {tip ? <Info className="size-3 shrink-0 opacity-50" aria-hidden="true" /> : null}
          </div>
        </TooltipTrigger>
        {tip ? (
          <TooltipContent side="top" className="max-w-56 text-balance">
            {tip}
          </TooltipContent>
        ) : null}
      </Tooltip>
      <div className={cn("tnum mt-2 font-semibold leading-snug break-words", valueClass ?? "text-2xl")}>
        {value}
      </div>
      {sub ? <div className="tnum mt-1 text-[11px] leading-snug text-muted-foreground">{sub}</div> : null}
      {children}
    </div>
  )
}

export function WritingMetricsTab(props: WritingStudioProps) {
  const { t } = useI18n()
  const { open, docId, html, stats, editCount, lang } = props

  /* refresh the persisted totals whenever the studio opens */
  const [fetched, setFetched] = React.useState<{
    stats: WritingStats
    editCount: number
  } | null>(null)

  React.useEffect(() => {
    if (!open || !docId) return
    let cancelled = false
    setFetched(null)
    fetch(`/api/documents/${docId}/stats`, { credentials: "same-origin" })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ stats?: unknown; editCount?: unknown }>)
          : Promise.reject(new Error("failed"))
      )
      .then((data) => {
        if (cancelled) return
        setFetched({
          stats: normStats((data?.stats ?? null) as Partial<WritingStats> | null),
          editCount: typeof data?.editCount === "number" ? data.editCount : 0,
        })
      })
      .catch(() => {
        /* keep the live prop values */
      })
    return () => {
      cancelled = true
    }
  }, [open, docId])

  /* server values (on open) win over the last tracker snapshot */
  const live = normStats(stats)
  const server = fetched?.stats ?? null
  const view = server && hasJourneyData(server) ? server : live
  const edits = fetched ? fetched.editCount : editCount

  const words = React.useMemo(() => countWords(htmlToText(html)), [html])

  const fmtInt = React.useCallback(
    (n: number) => nf(lang, { maximumFractionDigits: 0 }).format(n),
    [lang]
  )
  const fmt1 = React.useCallback(
    (n: number) => nf(lang, { maximumFractionDigits: 1 }).format(n),
    [lang]
  )
  const fmtRatio = React.useCallback(
    (n: number) => nf(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n),
    [lang]
  )

  const activeMinutes = view.activeMs / 60_000
  const charsPerMin = activeMinutes > 0 ? view.typedChars / activeMinutes : 0
  const wordsPerMin = activeMinutes > 0 ? view.typedWords / activeMinutes : 0

  const pasteDenom = view.typedChars + view.pastedChars
  const pastePct = pasteDenom > 0 ? Math.round((view.pastedChars / pasteDenom) * 100) : 0

  /* no journey yet (nothing typed, nothing saved) → onboarding state */
  if (!hasJourneyData(view) && edits === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-accent">
          <PenLine className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="max-w-72 text-sm leading-relaxed text-muted-foreground">
          {t("Start writing and your journey will appear here.")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[min(28rem,55dvh)] overflow-y-auto slim-scroll pr-1">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* 1 — total words in the live document */}
        <MetricCard
          icon={FileText}
          title={t("Total words")}
          value={t("≈{n} words", { n: fmtInt(words) })}
          valueClass="text-xl"
        />

        {/* 2 — effective typing time (keystroke bursts ≤ 5s gaps) */}
        <MetricCard
          icon={Timer}
          title={t("Effective writing time")}
          tip={t("Only counts time while you are actually typing — pauses are excluded.")}
          value={formatDuration(view.activeMs, t)}
          valueClass="text-xl"
        />

        {/* 3 — separate writing sessions (>30min gaps) */}
        <MetricCard
          icon={Repeat}
          title={t("Writing sessions")}
          tip={t("A gap of more than 30 minutes starts a new writing session.")}
          value={fmtInt(view.sessions)}
        />

        {/* 4 — average speed over active time (paste excluded) */}
        <MetricCard
          icon={Gauge}
          title={t("Average speed")}
          tip={t("Based on your own typing only — pasted text is excluded.")}
          value={
            activeMinutes > 0
              ? lang === "zh"
                ? t("{n} chars/min", { n: fmt1(charsPerMin) })
                : t("{n} words/min", { n: fmt1(wordsPerMin) })
              : "—"
          }
          valueClass="text-xl"
          sub={
            activeMinutes > 0
              ? lang === "zh"
                ? t("{n} words/min", { n: fmt1(wordsPerMin) })
                : t("{n} chars/min", { n: fmt1(charsPerMin) })
              : undefined
          }
        />

        {/* 5 — thinking pauses: count + accumulated duration */}
        <MetricCard
          icon={Pause}
          title={t("Thinking pauses")}
          tip={t("Pauses longer than 5 seconds while writing.")}
          value={fmtInt(view.pauses)}
          sub={view.pauseMs > 0 ? t("Total {duration}", { duration: formatDuration(view.pauseMs, t) }) : undefined}
        />

        {/* 6 — saved revisions (server counter) */}
        <MetricCard
          icon={History}
          title={t("Total edits")}
          tip={t("Number of saved changes since the first version.")}
          value={fmtInt(edits)}
        />

        {/* 7 — document size per saved revision */}
        <MetricCard
          icon={Ratio}
          title={t("Words per edit")}
          tip={t("A lower number means more frequent revisions.")}
          value={edits > 0 ? fmtRatio(words / edits) : "—"}
        />

        {/* 8 — share of characters inserted by pasting */}
        <MetricCard
          icon={ChartPie}
          title={t("Paste share")}
          tip={t("Share of characters inserted by pasting.")}
          value={`${pastePct}%`}
        >
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pastePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("Paste share")}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pastePct}%` }}
            />
          </div>
        </MetricCard>
      </div>
    </div>
  )
}
