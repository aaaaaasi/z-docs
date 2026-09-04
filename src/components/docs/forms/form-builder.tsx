"use client"

import * as React from "react"
import { FilePlus2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Question } from "@/lib/workspace-types"
import { FormState, SaveStatus, BuilderTab, newQuestion } from "./forms-utils"
import { FormTopBar } from "./form-top-bar"
import { QuestionEditor } from "./question-editor"

interface FormBuilderProps {
  form: FormState
  saveStatus: SaveStatus
  onFormChange: (patch: Partial<FormState>) => void
  onToggleStar: () => void
  onBack: () => void
  onTabChange: (tab: BuilderTab) => void
  onPreview: () => void
  onDuplicate: () => void
  onTrash: () => void
}

/** Builder mode — Google-Forms-style question editor with autosave handled by the parent. */
export function FormBuilder({
  form,
  saveStatus,
  onFormChange,
  onToggleStar,
  onBack,
  onTabChange,
  onPreview,
  onDuplicate,
  onTrash,
}: FormBuilderProps) {
  const questions = form.questions

  /* Ctrl/⌘+Enter toggles the respondent preview */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        onPreview()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPreview])

  const setQuestions = (next: Question[]) => onFormChange({ questions: next })

  const updateQuestion = (id: string, q: Question) =>
    setQuestions(questions.map((x) => (x.id === id ? q : x)))

  const deleteQuestion = (id: string) => setQuestions(questions.filter((x) => x.id !== id))

  const duplicateQuestion = (id: string) => {
    const i = questions.findIndex((x) => x.id === id)
    if (i === -1) return
    const copy: Question = { ...questions[i], id: crypto.randomUUID() }
    const next = [...questions]
    next.splice(i + 1, 0, copy)
    setQuestions(next)
  }

  const moveQuestion = (id: string, dir: -1 | 1) => {
    const i = questions.findIndex((x) => x.id === id)
    const j = i + dir
    if (i === -1 || j < 0 || j >= questions.length) return
    const next = [...questions]
    ;[next[i], next[j]] = [next[j], next[i]]
    setQuestions(next)
  }

  const addQuestion = () => setQuestions([...questions, newQuestion("short")])

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <FormTopBar
        form={form}
        activeTab="questions"
        saveStatus={saveStatus}
        onBack={onBack}
        onTitleCommit={(title) => onFormChange({ title })}
        onToggleStar={onToggleStar}
        onTabChange={onTabChange}
        onPreview={onPreview}
        onDuplicate={onDuplicate}
        onTrash={onTrash}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 pb-32 pt-8 sm:px-6 sm:pt-10">
        {/* Form header — big borderless Google-style title + description */}
        <section
          aria-label="Form title and description"
          className="rounded-lg border bg-background p-5 shadow-sm sm:p-6"
        >
          <Input
            value={form.title}
            onChange={(e) => onFormChange({ title: e.target.value })}
            placeholder="Form title"
            aria-label="Form title"
            className="h-auto rounded-none border-0 border-b border-b-transparent px-0 py-1 text-2xl font-normal shadow-none focus-visible:border-b-primary focus-visible:ring-0 md:text-2xl"
          />
          <Input
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
            placeholder="Form description"
            aria-label="Form description"
            className="mt-3 h-auto rounded-none border-0 border-b border-b-transparent px-0 py-1 text-sm font-normal text-muted-foreground shadow-none focus-visible:border-b-primary focus-visible:ring-0"
          />
        </section>

        {questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onChange={(next) => updateQuestion(q.id, next)}
            onDelete={() => deleteQuestion(q.id)}
            onDuplicate={() => duplicateQuestion(q.id)}
            onMove={(dir) => moveQuestion(q.id, dir)}
          />
        ))}

        {questions.length === 0 && (
          <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background/60 p-10 text-center">
            <FilePlus2 className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm font-medium">No questions yet</p>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              Add your first question — choose from short answer, multiple choice, checkboxes, dropdown or rating.
            </p>
            <Button onClick={addQuestion} className="mt-1 gap-2" aria-label="Add question">
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </section>
        )}
      </main>

      {/* Floating action button — Google's pink FAB, ours teal */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          size="lg"
          onClick={addQuestion}
          aria-label="Add question"
          className="h-12 rounded-full gap-2 px-5 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden text-sm sm:inline">Add question</span>
        </Button>
      </div>
    </div>
  )
}
