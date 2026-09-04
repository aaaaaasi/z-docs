"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ListOrdered,
  MoreVertical,
  Plus,
  SquareCheck,
  Circle,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Question, QuestionType } from "@/lib/workspace-types"
import { QUESTION_TYPES, hasOptions } from "./forms-utils"

interface QuestionEditorProps {
  question: Question
  index: number
  total: number
  onChange: (q: Question) => void
  onDelete: () => void
  onDuplicate: () => void
  onMove: (dir: -1 | 1) => void
}

/** One editable question card in the builder (Google-Forms-style). */
export function QuestionEditor({ question, index, total, onChange, onDelete, onDuplicate, onMove }: QuestionEditorProps) {
  const qid = question.id

  const changeType = (type: QuestionType) => {
    // seed two blank options when switching onto a choice type with none
    const options = hasOptions(type)
      ? question.options.length >= 2
        ? question.options
        : ["", ""]
      : question.options
    onChange({ ...question, type, options })
  }

  const setOption = (i: number, text: string) => {
    const options = question.options.map((o, j) => (j === i ? text : o))
    onChange({ ...question, options })
  }

  const removeOption = (i: number) => {
    if (question.options.length <= 2) return
    onChange({ ...question, options: question.options.filter((_, j) => j !== i) })
  }

  const addOption = () => {
    onChange({ ...question, options: [...question.options, ""] })
  }

  return (
    <section
      aria-label={`Question ${index + 1}`}
      className="rounded-lg border bg-background p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      {/* Row 1: question title · type · required · menu */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input
          value={question.title}
          onChange={(e) => onChange({ ...question, title: e.target.value })}
          placeholder={`Question ${index + 1}`}
          aria-label={`Question ${index + 1} title`}
          className="h-10 min-w-[180px] flex-1 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1 focus-visible:ring-ring/60 rounded-sm"
        />
        <Select value={question.type} onValueChange={(v) => changeType(v as QuestionType)}>
          <SelectTrigger
            aria-label={`Question ${index + 1} type`}
            className="h-9 w-[150px] border-0 bg-muted/50 text-[13px] font-normal text-muted-foreground shadow-none hover:bg-muted"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-[13px]">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id={`required-${qid}`}
            checked={question.required}
            onCheckedChange={(required) => onChange({ ...question, required })}
            aria-label={`Question ${index + 1} required`}
          />
          <Label
            htmlFor={`required-${qid}`}
            className="cursor-pointer text-[13px] text-muted-foreground"
          >
            Required
          </Label>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`More actions for question ${index + 1}`}
            >
              <MoreVertical className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" /> Duplicate question
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(-1)} disabled={index === 0}>
              <ArrowUp className="h-4 w-4" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDown className="h-4 w-4" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: type-specific editing / preview */}
      <div className="mt-4">
        {question.type === "multiple" && (
          <OptionsEditor question={question} glyph="radio" onSet={setOption} onRemove={removeOption} onAdd={addOption} />
        )}
        {question.type === "checkbox" && (
          <OptionsEditor question={question} glyph="checkbox" onSet={setOption} onRemove={removeOption} onAdd={addOption} />
        )}
        {question.type === "dropdown" && (
          <OptionsEditor question={question} glyph="list" onSet={setOption} onRemove={removeOption} onAdd={addOption} />
        )}
        {question.type === "rating" && (
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="size-4 fill-muted-foreground/25 text-muted-foreground/35" />
              ))}
            </span>
            <span>Rating · 1–5 stars</span>
          </div>
        )}
        {question.type === "short" && (
          <Input disabled placeholder="Short-answer text" aria-hidden="true" className="max-w-xs text-sm text-muted-foreground" />
        )}
        {question.type === "paragraph" && (
          <Textarea
            disabled
            placeholder="Long-answer text"
            aria-hidden="true"
            rows={2}
            className="max-w-xl resize-none text-sm text-muted-foreground"
          />
        )}
      </div>
    </section>
  )
}

/* ------------------------------ options editor ---------------------------------- */

type GlyphKind = "radio" | "checkbox" | "list"

interface OptionsEditorProps {
  question: Question
  glyph: GlyphKind
  onSet: (i: number, text: string) => void
  onRemove: (i: number) => void
  onAdd: () => void
}

function OptionsEditor({ question, glyph, onSet, onRemove, onAdd }: OptionsEditorProps) {
  const canRemove = question.options.length > 2
  return (
    <div className="space-y-0.5">
      {question.options.map((opt, i) => (
        <div key={i} className="group flex items-center gap-2.5 pr-1">
          {glyph === "radio" && <Circle className="size-4.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
          {glyph === "checkbox" && <SquareCheck className="size-4.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
          {glyph === "list" && <ListOrdered className="size-4.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
          <Input
            value={opt}
            onChange={(e) => onSet(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            aria-label={`Option ${i + 1}`}
            className="h-9 flex-1 border-0 bg-transparent px-1 text-sm font-normal shadow-none focus-visible:ring-1 focus-visible:ring-ring/60 rounded-sm"
          />
          {canRemove ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(i)}
              aria-label={`Remove option ${i + 1}`}
              className={cn(
                "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground",
                "opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              )}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <div className="h-8 w-8 shrink-0" aria-hidden="true" />
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAdd}
        className="mt-1 h-9 gap-2 text-[13px] font-normal text-muted-foreground hover:text-foreground"
        aria-label="Add option"
      >
        <Plus className="h-4 w-4" /> Add option
      </Button>
    </div>
  )
}
