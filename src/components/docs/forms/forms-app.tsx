"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { useDocsStore } from "@/store/docs-store"
import { useToast } from "@/hooks/use-toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { AnswerValue } from "@/lib/workspace-types"
import { FormsList } from "./forms-list"
import { FormBuilder } from "./form-builder"
import { FillView } from "./fill-view"
import { ResponsesView } from "./responses-view"
import {
  apiCreateForm,
  apiGetForm,
  apiGetResponses,
  apiPatchForm,
  apiSubmitResponse,
  newQuestion,
  questionsToData,
  type FormState,
  type FormsMode,
  type ParsedResponse,
  type SaveStatus,
} from "./forms-utils"

/**
 * Z-Forms application shell — owns the four internal modes (list / builder / fill /
 * responses), the open-form state and the debounced autosave engine. The list view
 * fetches its own data via useFormsList.
 */
export function FormsApp() {
  const { toast } = useToast()
  const goHome = useDocsStore((s) => s.goHome)
  const consumeAppTarget = useDocsStore((s) => s.consumeAppTarget)

  /* ------------------------------ mode + form state ------------------------------ */

  const [mode, setMode] = React.useState<FormsMode>("list")
  const [form, setForm] = React.useState<FormState | null>(null)
  const [formLoading, setFormLoading] = React.useState(false)
  const [responses, setResponses] = React.useState<ParsedResponse[]>([])
  const [responsesLoading, setResponsesLoading] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle")

  /* latest-value refs (read by async callbacks + the unmount flush) */
  const formRef = React.useRef<FormState | null>(null)
  React.useEffect(() => {
    formRef.current = form
  }, [form])

  /* --------------------------------- autosave ------------------------------------ */

  const snapshotRef = React.useRef<string | null>(null)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = React.useRef(false)
  const needResaveRef = React.useRef(false)
  const errorToastedRef = React.useRef(false)
  const scheduleSaveRef = React.useRef<() => void>(() => {})

  const formPayload = React.useCallback(
    (f: FormState) =>
      JSON.stringify({ title: f.title, description: f.description, data: questionsToData(f.questions) }),
    []
  )

  const performSave = React.useCallback(async () => {
    const f = formRef.current
    if (!f || savingRef.current) {
      if (f) needResaveRef.current = true
      return
    }
    const payload = formPayload(f)
    if (snapshotRef.current === payload) return
    savingRef.current = true
    setSaveStatus("saving")
    try {
      await apiPatchForm(f.id, {
        title: f.title,
        description: f.description,
        data: questionsToData(f.questions),
      })
      snapshotRef.current = payload
      setSaveStatus("saved")
      errorToastedRef.current = false
    } catch {
      setSaveStatus("error")
      if (!errorToastedRef.current) {
        errorToastedRef.current = true
        toast({
          title: "Couldn't save your form",
          description: "We'll retry automatically on your next edit.",
          variant: "destructive",
        })
      }
    } finally {
      savingRef.current = false
      if (needResaveRef.current) {
        needResaveRef.current = false
        scheduleSaveRef.current()
      }
    }
  }, [formPayload, toast])

  /** Debounce edits for 900ms, Google-style. */
  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus("saving")
    saveTimerRef.current = setTimeout(() => void performSave(), 900)
  }, [performSave])

  React.useEffect(() => {
    scheduleSaveRef.current = scheduleSave
  }, [scheduleSave])

  /* any form edit while in the builder schedules a debounced save */
  React.useEffect(() => {
    if (mode !== "builder" || !form) return
    if (snapshotRef.current === null) return
    if (formPayload(form) !== snapshotRef.current) scheduleSave()
  }, [form, mode, formPayload, scheduleSave])

  /* flush pending edits whenever we leave the builder (mode switch) */
  const prevModeRef = React.useRef<FormsMode>("list")
  React.useEffect(() => {
    const wasBuilder = prevModeRef.current === "builder"
    prevModeRef.current = mode
    if (wasBuilder && mode !== "builder") {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      void performSave()
    }
  }, [mode, performSave])

  /* flush on unmount (e.g. navigating back to Z-Docs home) */
  const performSaveRef = React.useRef(performSave)
  React.useEffect(() => {
    performSaveRef.current = performSave
  }, [performSave])
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const f = formRef.current
      if (f && snapshotRef.current !== null && formPayload(f) !== snapshotRef.current) {
        void performSaveRef.current()
      }
    }
  }, [formPayload])

  /* --------------------------------- data loading -------------------------------- */

  const loadResponses = React.useCallback(
    async (id: string) => {
      setResponsesLoading(true)
      try {
        const list = await apiGetResponses(id)
        setResponses(list)
      } catch {
        toast({ title: "Couldn't load responses", variant: "destructive" })
      } finally {
        setResponsesLoading(false)
      }
    },
    [toast]
  )

  const openFormById = React.useCallback(
    async (id: string, openMode: "edit" | "fill" | "responses" = "edit") => {
      setFormLoading(true)
      /* enter the target mode right away so the loading skeleton replaces the list */
      setMode(openMode === "responses" ? "responses" : openMode === "fill" ? "fill" : "builder")
      try {
        const f = await apiGetForm(id)
        formRef.current = f
        snapshotRef.current = formPayload(f)
        setForm(f)
        setSaveStatus("idle")
        if (openMode === "responses") void loadResponses(id)
      } catch (e) {
        toast({
          title: "Form unavailable",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        })
        setMode("list")
      } finally {
        setFormLoading(false)
      }
    },
    [formPayload, loadResponses, toast]
  )

  /* --------------------------------- navigation ---------------------------------- */

  const switchMode = React.useCallback(
    (next: FormsMode) => {
      setMode(next)
      if (next === "responses") {
        const f = formRef.current
        if (f) void loadResponses(f.id)
      }
    },
    [loadResponses]
  )

  /** The list view refetches itself whenever it mounts, so a plain mode switch is enough. */
  const backToList = React.useCallback(() => setMode("list"), [])

  const createNewForm = React.useCallback(async () => {
    try {
      const q = newQuestion("short")
      const created = await apiCreateForm({
        title: "Untitled form",
        description: "",
        data: questionsToData([q]),
      })
      /* the API echoes data:"[]" — trust the payload we sent */
      const f: FormState = {
        id: created.id,
        title: created.title,
        description: created.description,
        starred: created.starred,
        trashed: created.trashed,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        responseCount: created.responseCount ?? 0,
        questions: [q],
      }
      formRef.current = f
      snapshotRef.current = formPayload(f)
      setForm(f)
      setSaveStatus("idle")
      setMode("builder")
    } catch {
      toast({ title: "Couldn't create form", variant: "destructive" })
    }
  }, [formPayload, toast])

  /* ------------------------------ form-level actions ------------------------------ */

  const updateForm = React.useCallback((patch: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const toggleCurrentStar = React.useCallback(async () => {
    const f = formRef.current
    if (!f) return
    const next = !f.starred
    setForm({ ...f, starred: next })
    try {
      await apiPatchForm(f.id, { starred: next })
    } catch {
      setForm({ ...f, starred: f.starred })
      toast({ title: "Couldn't update star", variant: "destructive" })
    }
  }, [toast])

  const renameCurrent = React.useCallback(
    async (title: string) => {
      const f = formRef.current
      if (!f || title === f.title) return
      const next = { ...f, title }
      setForm(next)
      snapshotRef.current = formPayload(next)
      try {
        await apiPatchForm(f.id, { title })
      } catch {
        toast({ title: "Couldn't rename form", variant: "destructive" })
      }
    },
    [formPayload, toast]
  )

  const duplicateCurrent = React.useCallback(async () => {
    const f = formRef.current
    if (!f) return
    try {
      await apiCreateForm({
        title: `Copy of ${f.title}`,
        description: f.description,
        data: questionsToData(f.questions),
      })
      toast({ title: "Form duplicated", description: `“Copy of ${f.title}” is in your forms list.` })
    } catch {
      toast({ title: "Couldn't duplicate form", variant: "destructive" })
    }
  }, [toast])

  const trashCurrent = React.useCallback(async () => {
    const f = formRef.current
    if (!f) return
    try {
      await apiPatchForm(f.id, { trashed: true })
      toast({ title: "Moved to trash", description: `“${f.title}” was moved to trash.` })
      setForm(null)
      setMode("list")
    } catch {
      toast({ title: "Couldn't move form to trash", variant: "destructive" })
    }
  }, [toast])

  const submitAnswers = React.useCallback(
    async (answers: Record<string, AnswerValue>) => {
      const f = formRef.current
      if (!f) return false
      try {
        await apiSubmitResponse(f.id, answers)
        setForm((prev) => (prev && prev.id === f.id ? { ...prev, responseCount: prev.responseCount + 1 } : prev))
        toast({ title: "Response submitted", description: `Recorded for “${f.title}”.` })
        return true
      } catch (e) {
        toast({
          title: "Submission failed",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        })
        return false
      }
    },
    [toast]
  )

  /* ------------------------------ mount + deep link ------------------------------- */

  const mountedRef = React.useRef(false)
  React.useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    const t = consumeAppTarget()
    if (t && t.app === "forms" && t.id) {
      void openFormById(t.id, t.formMode ?? "edit")
    }
  }, [consumeAppTarget, openFormById])

  /* ------------------------------------ render ------------------------------------ */

  return (
    <TooltipProvider delayDuration={250}>
      {mode === "list" ? (
        <FormsList
          onOpen={(id, openMode) => void openFormById(id, openMode)}
          onNewForm={createNewForm}
          onGoHome={goHome}
        />
      ) : formLoading ? (
        <FormLoading />
      ) : !form ? (
        <FormUnavailable onBack={backToList} />
      ) : mode === "builder" ? (
        <FormBuilder
          key={form.id}
          form={form}
          saveStatus={saveStatus}
          onFormChange={updateForm}
          onToggleStar={() => void toggleCurrentStar()}
          onBack={backToList}
          onTabChange={(t) => switchMode(t === "responses" ? "responses" : "builder")}
          onPreview={() => switchMode("fill")}
          onDuplicate={() => void duplicateCurrent()}
          onTrash={() => void trashCurrent()}
        />
      ) : mode === "fill" ? (
        <FillView
          key={form.id}
          form={form}
          onSubmit={submitAnswers}
          onBackToEditor={() => switchMode("builder")}
        />
      ) : (
        <ResponsesView
          key={form.id}
          form={form}
          responses={responses}
          loading={responsesLoading}
          onBack={backToList}
          onTitleCommit={(title) => void renameCurrent(title)}
          onToggleStar={() => void toggleCurrentStar()}
          onTabChange={(t) => switchMode(t === "responses" ? "responses" : "builder")}
          onPreview={() => switchMode("fill")}
          onDuplicate={() => void duplicateCurrent()}
          onTrash={() => void trashCurrent()}
          onOpenFill={() => switchMode("fill")}
          onRefresh={() => void loadResponses(form.id)}
        />
      )}
    </TooltipProvider>
  )
}

/* ------------------------------ loading / fallback ------------------------------- */

function FormLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <div className="flex h-14 items-center gap-3 border-b bg-background px-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="ml-auto h-7 w-52 rounded-full" />
      </div>
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </main>
    </div>
  )
}

function FormUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border bg-background p-8 text-center shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">This form isn't available</p>
        <Button variant="outline" onClick={onBack} className="h-9">
          Back to forms
        </Button>
      </div>
    </div>
  )
}
