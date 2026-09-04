"use client"

import * as React from "react"
import {
  BarChart3,
  ChevronDown,
  Download,
  Eye,
  ListChecks,
  MessagesSquare,
  RefreshCw,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { relativeTime } from "@/lib/doc-utils"
import type { Question } from "@/lib/workspace-types"
import {
  BuilderTab,
  FormState,
  ParsedResponse,
  answerColor,
  answerToText,
  buildResponsesCsv,
  downloadCsvFile,
  isEmptyAnswer,
  sanitizeFilename,
  typeLabel,
} from "./forms-utils"
import { FormTopBar } from "./form-top-bar"

interface ResponsesViewProps {
  form: FormState
  responses: ParsedResponse[]
  loading: boolean
  onBack: () => void
  onTitleCommit: (title: string) => void
  onToggleStar: () => void
  onTabChange: (tab: BuilderTab) => void
  onPreview: () => void
  onDuplicate: () => void
  onTrash: () => void
  onOpenFill: () => void
  onRefresh: () => void
}

/** Responses mode — Google-Forms-style analytics with bars, rating stats and CSV export. */
export function ResponsesView(props: ResponsesViewProps) {
  const { form, responses, loading } = props
  const { toast } = useToast()

  const answeredCells = React.useMemo(
    () =>
      responses.reduce(
        (sum, r) => sum + form.questions.filter((q) => !isEmptyAnswer(r.answers[q.id])).length,
        0
      ),
    [responses, form.questions]
  )
  const avgPct =
    responses.length > 0 && form.questions.length > 0
      ? Math.round((100 * answeredCells) / (responses.length * form.questions.length))
      : 0

  const handleDownload = () => {
    const csv = buildResponsesCsv(form.questions, responses)
    downloadCsvFile(`${sanitizeFilename(form.title)}-responses.csv`, csv)
    toast({
      title: "CSV downloaded",
      description: `${responses.length} response${responses.length === 1 ? "" : "s"} exported to ${sanitizeFilename(form.title)}-responses.csv`,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <FormTopBar
        form={form}
        activeTab="responses"
        onBack={props.onBack}
        onTitleCommit={props.onTitleCommit}
        onToggleStar={props.onToggleStar}
        onTabChange={props.onTabChange}
        onPreview={props.onPreview}
        onDuplicate={props.onDuplicate}
        onTrash={props.onTrash}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {/* Summary strip */}
        <section aria-label="Response summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard icon={MessagesSquare} label="Responses" value={String(responses.length)} />
          <SummaryCard icon={ListChecks} label="Questions" value={String(form.questions.length)} />
          <SummaryCard icon={BarChart3} label="Avg answered" value={`${avgPct}%`} sub="per question" />
          <div className="flex flex-col justify-between rounded-lg border bg-background p-4 shadow-xs">
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Button
                onClick={handleDownload}
                disabled={responses.length === 0}
                className="w-full gap-2"
                size="sm"
                aria-label="Download responses as CSV"
              >
                <Download className="h-4 w-4" /> Download CSV
              </Button>
            )}
            <p className="mt-2 truncate text-[12px] text-muted-foreground" title={`${sanitizeFilename(form.title)}-responses.csv`}>
              {sanitizeFilename(form.title)}-responses.csv
            </p>
          </div>
        </section>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-background p-5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-2 w-full" />
                <Skeleton className="mt-3 h-2 w-3/4" />
              </div>
            ))}
          </div>
        ) : responses.length === 0 ? (
          <EmptyResponses onOpenFill={props.onOpenFill} />
        ) : (
          <Tabs defaultValue="summary" className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="individual">Individual</TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onRefresh}
                aria-label="Refresh responses"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="summary" className="mt-4 space-y-4">
              {form.questions.map((q, i) => (
                <QuestionSummary key={q.id} question={q} index={i} responses={responses} />
              ))}
              {form.questions.length === 0 && (
                <p className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-[13px] text-muted-foreground">
                  This form has no questions yet.
                </p>
              )}
            </TabsContent>

            <TabsContent value="individual" className="mt-4">
              <section aria-label="All responses" className="space-y-2">
                <h2 className="mb-2 text-sm font-medium">All responses</h2>
                {responses.map((r, i) => (
                  <Collapsible key={r.id} defaultOpen={i === 0}>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-4 py-3 text-left shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
                      <span className="min-w-0 truncate text-[13px] font-medium">
                        Response {i + 1}
                        <span className="font-normal text-muted-foreground"> · {relativeTime(r.submittedAt)}</span>
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 rounded-b-lg border border-t-0 bg-background px-4 pb-4 pt-3">
                      {form.questions.map((q) => {
                        const a = answerToText(r.answers[q.id])
                        return (
                          <div key={q.id}>
                            <p className="text-[13px] font-medium text-muted-foreground">
                              {q.title.trim() || "Untitled question"}
                            </p>
                            <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-sm", !a && "italic text-muted-foreground")}>
                              {a || "No answer"}
                            </p>
                          </div>
                        )
                      })}
                      {form.questions.length === 0 && (
                        <p className="text-[13px] italic text-muted-foreground">No questions.</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </section>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

/* -------------------------------- summary card ---------------------------------- */

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <p className="mt-1 text-3xl font-normal tnum">{value}</p>
      {sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

/* ------------------------------ per-question summary ---------------------------- */

function QuestionSummary({ question, index, responses }: { question: Question; index: number; responses: ParsedResponse[] }) {
  const values = responses.map((r) => r.answers[question.id])
  const answered = values.filter((v) => !isEmptyAnswer(v)).length
  const title = question.title.trim() || "Untitled question"

  return (
    <section aria-label={`Summary for question ${index + 1}`} className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {title}
          {question.required && <span className="text-destructive"> *</span>}
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {typeLabel(question.type)}
          </span>
          <span className="text-[13px] text-muted-foreground tnum">{answered} answered</span>
        </div>
      </div>

      {question.type === "multiple" || question.type === "dropdown" ? (
        <ChoiceBars question={question} responses={responses} />
      ) : question.type === "checkbox" ? (
        <ChoiceBars question={question} responses={responses} checkbox />
      ) : question.type === "rating" ? (
        <RatingSummary question={question} responses={responses} />
      ) : (
        <TextAnswers question={question} responses={responses} />
      )}
    </section>
  )
}

function ChoiceBars({ question, responses, checkbox }: { question: Question; responses: ParsedResponse[]; checkbox?: boolean }) {
  const labels = question.options.map((o, i) => o.trim() || `Option ${i + 1}`)
  const counts = labels.map((label) => {
    if (checkbox) {
      return responses.filter((r) => Array.isArray(r.answers[question.id]) && (r.answers[question.id] as string[]).includes(label)).length
    }
    return responses.filter((r) => r.answers[question.id] === label).length
  })
  const total = responses.length
  const selections = counts.reduce((a, b) => a + b, 0)

  return (
    <div>
      {checkbox && (
        <p className="mb-3 text-[13px] text-muted-foreground tnum">{selections} selections across {total} responses</p>
      )}
      <div className="space-y-2.5">
        {labels.map((label, i) => {
          const pct = total > 0 ? Math.round((100 * counts[i]) / total) : 0
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[13px] sm:w-36" title={label}>
                {label}
              </span>
              <div
                className="h-2 flex-1 rounded-full bg-muted"
                role="img"
                aria-label={`${label}: ${counts[i]} of ${total} responses (${pct}%)`}
              >
                <div
                  className={cn("h-2 rounded-full bg-primary transition-[width] duration-500", counts[i] > 0 && "min-w-[3px]")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[13px] text-muted-foreground tnum">
                {counts[i]} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RatingSummary({ question, responses }: { question: Question; responses: ParsedResponse[] }) {
  const nums = responses
    .map((r) => r.answers[question.id])
    .filter((v): v is number => typeof v === "number")
  const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: nums.filter((n) => n === star).length }))
  const max = Math.max(1, ...dist.map((d) => d.count))

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="shrink-0">
        <p className="text-3xl font-normal tnum" aria-label={`Average rating ${avg.toFixed(1)} of 5`}>
          {nums.length > 0 ? avg.toFixed(1) : "–"}
        </p>
        <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
          <Star className="size-3 fill-primary text-primary" aria-hidden="true" /> average of 5 · {nums.length} rated
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {dist.map((d) => (
          <div key={d.star} className="flex items-center gap-3">
            <span className="flex w-9 shrink-0 items-center gap-1 text-[13px] text-muted-foreground tnum" aria-label={`${d.star} stars: ${d.count} responses`}>
              {d.star}
              <Star className="size-3 fill-muted-foreground/30 text-muted-foreground/40" aria-hidden="true" />
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.round((100 * d.count) / max)}%`, minWidth: d.count > 0 ? "3px" : undefined }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[13px] text-muted-foreground tnum">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TextAnswers({ question, responses }: { question: Question; responses: ParsedResponse[] }) {
  const items = responses
    .filter((r) => !isEmptyAnswer(r.answers[question.id]))
    .map((r) => ({ text: answerToText(r.answers[question.id]), at: r.submittedAt, id: r.id }))

  if (items.length === 0) {
    return <p className="text-[13px] italic text-muted-foreground">No answers yet</p>
  }

  return (
    <div className="slim-scroll max-h-64 space-y-3 overflow-y-auto pr-2">
      {items.map((it) => (
        <div key={it.id} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white"
            style={{ backgroundColor: answerColor(it.text) }}
          >
            {(it.text.trim()[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">{it.text}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{relativeTime(it.at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------- empty state ---------------------------------- */

function EmptyResponses({ onOpenFill }: { onOpenFill: () => void }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-background/60 p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <BarChart3 className="h-6 w-6 text-primary" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium">No responses yet</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Open the preview and submit one to see analytics here.</p>
      </div>
      <Button onClick={onOpenFill} className="mt-1 gap-2" aria-label="Open preview to submit a test response">
        <Eye className="h-4 w-4" /> Open preview
      </Button>
    </section>
  )
}
