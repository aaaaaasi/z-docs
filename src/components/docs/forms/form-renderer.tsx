"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n"
import type { AnswerValue, Question } from "@/lib/workspace-types"

/* ------------------------------- star rating input ----------------------------- */

interface StarRatingProps {
  value: number | undefined
  onChange: (n: number) => void
  disabled?: boolean
  invalid?: boolean
  name: string
}

/** 5 clickable stars — filled with the accent color, hover preview, keyboard accessible. */
export function StarRating({ value, onChange, disabled, invalid, name }: StarRatingProps) {
  const { t } = useI18n()
  const [hover, setHover] = React.useState(0)
  const current = hover > 0 ? hover : (value ?? 0)

  const handleKey = (e: React.KeyboardEvent) => {
    let next = value ?? 0
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, (value ?? 0) + 1)
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, (value ?? 0) - 1)
    else if (e.key === "Home") next = 1
    else if (e.key === "End") next = 5
    else if (/^[1-5]$/.test(e.key)) next = Number(e.key)
    else return
    e.preventDefault()
    onChange(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("Rating")}
      aria-invalid={invalid}
      onKeyDown={disabled ? undefined : handleKey}
      onMouseLeave={() => setHover(0)}
      className={cn("flex w-fit items-center gap-1 rounded-md p-1", invalid && "ring-2 ring-destructive/40")}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n === 1 ? t("1 star") : t("{n} stars", { n })}
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => !disabled && setHover(n)}
          onFocus={() => !disabled && setHover(n)}
          onBlur={() => setHover(0)}
          className={cn(
            "flex size-11 items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-90",
            disabled && "cursor-default"
          )}
        >
          <Star
            aria-hidden="true"
            className={cn(
              "size-6 transition-all duration-150",
              n <= current ? "fill-primary text-primary" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
      <span aria-live="polite" className="sr-only">
        {name}: {value ? t("{n} of 5 stars", { n: value }) : t("not rated")}
      </span>
    </div>
  )
}

/* ------------------------------ question input --------------------------------- */

interface QuestionInputProps {
  question: Question
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
  invalid?: boolean
  disabled?: boolean
}

/**
 * The live input control for one question — the single source of truth shared by
 * the fill view and the preview so both stay pixel-identical.
 */
export function QuestionInput({ question, value, onChange, invalid, disabled }: QuestionInputProps) {
  const { t } = useI18n()
  const qid = question.id

  switch (question.type) {
    case "short":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={invalid}
          placeholder={t("Your answer")}
          className="max-w-md"
        />
      )

    case "paragraph":
      return (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={invalid}
          placeholder={t("Your answer")}
          rows={3}
          className="max-h-64 max-w-xl resize-y"
        />
      )

    case "multiple":
      return (
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
          aria-invalid={invalid}
          className="gap-1"
        >
          {question.options.map((opt, i) => {
            const label = opt.trim() || t("Option {n}", { n: i + 1 })
            return (
              <div
                key={i}
                className="flex min-h-11 items-center gap-3 rounded-md px-2 transition-colors hover:bg-muted/60"
              >
                <RadioGroupItem value={label} id={`${qid}-opt-${i}`} aria-invalid={invalid} />
                <Label
                  htmlFor={`${qid}-opt-${i}`}
                  className="cursor-pointer text-sm font-normal leading-snug"
                >
                  {label}
                </Label>
              </div>
            )
          })}
        </RadioGroup>
      )

    case "checkbox": {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="space-y-1" aria-invalid={invalid}>
          {question.options.map((opt, i) => {
            const label = opt.trim() || t("Option {n}", { n: i + 1 })
            return (
              <div
                key={i}
                className="flex min-h-11 items-center gap-3 rounded-md px-2 transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  id={`${qid}-cb-${i}`}
                  checked={selected.includes(label)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, label]
                      : selected.filter((s) => s !== label)
                    onChange(next)
                  }}
                  aria-invalid={invalid}
                />
                <Label
                  htmlFor={`${qid}-cb-${i}`}
                  className="cursor-pointer text-sm font-normal leading-snug"
                >
                  {label}
                </Label>
              </div>
            )
          })}
        </div>
      )
    }

    case "dropdown":
      return (
        <Select
          value={typeof value === "string" ? value : undefined}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger
            id={qid}
            aria-invalid={invalid}
            className="w-full max-w-xs text-sm font-normal"
          >
            <SelectValue placeholder={t("Choose")} />
          </SelectTrigger>
          <SelectContent>
            {question.options.map((opt, i) => {
              const label = opt.trim() || t("Option {n}", { n: i + 1 })
              return (
                <SelectItem key={i} value={label} className="text-sm">
                  {label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      )

    case "rating":
      return (
        <StarRating
          name={question.title || t("Rating")}
          value={typeof value === "number" ? value : undefined}
          onChange={(n) => onChange(n)}
          disabled={disabled}
          invalid={invalid}
        />
      )
  }
}

/* ------------------------------ respondent card --------------------------------- */

interface QuestionCardProps {
  question: Question
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
  error?: boolean
  disabled?: boolean
}

/** Full question card as respondents see it (fill view + preview). */
export function QuestionCard({ question, value, onChange, error, disabled }: QuestionCardProps) {
  const { t } = useI18n()
  return (
    <section
      id={`qcard-${question.id}`}
      aria-labelledby={`q-${question.id}`}
      className="rounded-lg border bg-background p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start gap-1.5">
        <h3 id={`q-${question.id}`} className="text-sm font-medium leading-snug">
          {question.title.trim() || t("Untitled question")}
        </h3>
        {question.required && (
          <span className="text-sm leading-snug text-destructive" aria-label={t("Required")}>
            *
          </span>
        )}
      </div>
      <QuestionInput question={question} value={value} onChange={onChange} invalid={error} disabled={disabled} />
      {error && (
        <p className="mt-3 text-[13px] text-destructive" role="alert">
          {t("This is a required question")}
        </p>
      )}
    </section>
  )
}

/** Small helper used by fill-mode validation to focus the first invalid card. */
export function focusQuestionCard(questionId: string) {
  const card = document.getElementById(`qcard-${questionId}`)
  if (!card) return
  card.scrollIntoView({ behavior: "smooth", block: "center" })
  const focusable = card.querySelector<HTMLElement>("input:not([type=hidden]), textarea, button, [role=radio]")
  window.setTimeout(() => focusable?.focus({ preventScroll: true }), 350)
}
