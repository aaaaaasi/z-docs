"use client"

import * as React from "react"
import { CheckCircle2, Eraser, Eye, Loader2, PencilRuler } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import type { AnswerValue } from "@/lib/workspace-types"
import { FormState, isEmptyAnswer } from "./forms-utils"
import { QuestionCard, focusQuestionCard } from "./form-renderer"

interface FillViewProps {
  form: FormState
  onSubmit: (answers: Record<string, AnswerValue>) => Promise<boolean>
  onBackToEditor: () => void
}

/** Fill mode — the respondent view (also used as the builder's live preview). */
export function FillView({ form, onSubmit, onBackToEditor }: FillViewProps) {
  const { t } = useI18n()
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({})
  const [errorIds, setErrorIds] = React.useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const setAnswer = (qid: string, v: AnswerValue | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev }
      if (v === undefined || v === "") delete next[qid]
      else next[qid] = v
      return next
    })
    setErrorIds((prev) => {
      if (!prev.has(qid)) return prev
      const next = new Set(prev)
      next.delete(qid)
      return next
    })
  }

  /* Esc exits the preview back to the builder */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBackToEditor()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onBackToEditor])

  const clearForm = () => {
    setAnswers({})
    setErrorIds(new Set())
  }

  const handleSubmit = async () => {
    const invalid = form.questions.filter((q) => q.required && isEmptyAnswer(answers[q.id]))
    if (invalid.length > 0) {
      setErrorIds(new Set(invalid.map((q) => q.id)))
      focusQuestionCard(invalid[0].id)
      return
    }
    setSubmitting(true)
    const ok = await onSubmit(answers)
    setSubmitting(false)
    if (ok) {
      setSubmitted(true)
      setErrorIds(new Set())
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <FillTopBar onBackToEditor={onBackToEditor} />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-10">
          <section
            aria-live="polite"
            className="flex w-full flex-col items-center gap-5 rounded-lg border bg-background p-10 text-center shadow-sm"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-normal">{t("Your response has been recorded")}</h1>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              {t("Thanks for filling out “{title}”.", { title: form.title.trim() || t("Untitled form") })}
            </p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => { setSubmitted(false); clearForm() }} className="h-10">
                {t("Fill another response")}
              </Button>
              <Button onClick={onBackToEditor} className="h-10">
                {t("Back to editor")}
              </Button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <FillTopBar onBackToEditor={onBackToEditor} />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8 sm:px-6 sm:py-10">
        {/* Form header with the accent strip — the Google-Forms signature */}
        <section
          aria-labelledby="fill-form-title"
          className="rounded-lg border border-t-[6px] border-t-primary bg-background p-5 shadow-sm sm:p-6"
        >
          <h1 id="fill-form-title" className="text-2xl font-normal leading-tight">
            {form.title.trim() || t("Untitled form")}
          </h1>
          {form.description.trim() && (
            <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>
          )}
        </section>

        {form.questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
            error={errorIds.has(q.id)}
          />
        ))}

        <div className="pt-2">
          <p className="text-[13px] text-muted-foreground">{t("Never submit passwords through Z-Forms.")}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={submitting} className="h-10 min-w-32" aria-label={t("Submit response")}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("Submit")}
            </Button>
            <Button
              variant="ghost"
              onClick={clearForm}
              disabled={submitting}
              className="h-10 gap-2 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <Eraser className="h-4 w-4" /> {t("Clear form")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

function FillTopBar({ onBackToEditor }: { onBackToEditor: () => void }) {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBackToEditor}
        aria-label={t("Back to editor")}
        className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <PencilRuler className="h-4 w-4" />
        <span className="hidden sm:inline">{t("Back to editor")}</span>
      </Button>
      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[13px] font-medium text-primary">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        {t("Preview")}
        <kbd className="hidden ml-1 rounded border border-primary/25 bg-background/60 px-1 text-[10px] text-muted-foreground sm:inline">
          {t("Esc to exit")}
        </kbd>
      </span>
    </header>
  )
}
