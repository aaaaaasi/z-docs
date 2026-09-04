"use client"

import { api } from "@/lib/api-client"
import type { AnswerValue, FormMeta, Question, QuestionType } from "@/lib/workspace-types"

/* --------------------------------- shared types -------------------------------- */

export type FormsMode = "list" | "builder" | "fill" | "responses"
export type ListTab = "all" | "starred" | "trashed"
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error"
export type BuilderTab = "questions" | "responses"

/** Fully-loaded form with parsed questions — the client-side shape used by every view. */
export interface FormState {
  id: string
  title: string
  description: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  responseCount: number
  questions: Question[]
}

/** A submitted response with `answers` parsed from the stored JSON string. */
export interface ParsedResponse {
  id: string
  formId: string
  submittedAt: string
  answers: Record<string, AnswerValue>
}

/* ------------------------------- raw API payload ------------------------------- */

interface RawForm {
  id: string
  title: string
  description: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  responseCount?: number
  /** JSON string of Question[] (server contract) */
  data?: string
}

/* ------------------------------- API wrappers ---------------------------------- */

export async function apiListForms(tab: ListTab, q = ""): Promise<FormMeta[]> {
  const params = new URLSearchParams({ filter: tab })
  if (q.trim()) params.set("q", q.trim())
  const res = await api(`/api/forms?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to load forms")
  const data = (await res.json()) as { forms?: FormMeta[] }
  return data.forms ?? []
}

/** POST /api/forms — note: the response echoes `data: "[]"`, so the caller must NOT trust it. */
export async function apiCreateForm(init: {
  title?: string
  description?: string
  data?: string
}): Promise<RawForm> {
  const res = await api("/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(init),
  })
  if (!res.ok) throw new Error("Failed to create form")
  const data = (await res.json()) as { form: RawForm }
  return data.form
}

export async function apiGetForm(id: string): Promise<FormState> {
  const res = await api(`/api/forms/${encodeURIComponent(id)}`)
  if (res.status === 404) throw new Error("Form not found")
  if (!res.ok) throw new Error("Failed to load form")
  const data = (await res.json()) as { form: RawForm }
  return {
    id: data.form.id,
    title: data.form.title,
    description: data.form.description,
    starred: data.form.starred,
    trashed: data.form.trashed,
    createdAt: data.form.createdAt,
    updatedAt: data.form.updatedAt,
    responseCount: data.form.responseCount ?? 0,
    questions: parseQuestions(data.form.data),
  }
}

export async function apiPatchForm(
  id: string,
  patch: { title?: string; description?: string; data?: string; starred?: boolean; trashed?: boolean }
): Promise<RawForm> {
  const res = await api(`/api/forms/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error("Failed to update form")
  const data = (await res.json()) as { form: RawForm }
  return data.form
}

export async function apiDeleteForm(id: string): Promise<void> {
  const res = await api(`/api/forms/${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete form")
}

export async function apiGetResponses(id: string): Promise<ParsedResponse[]> {
  const res = await api(`/api/forms/${encodeURIComponent(id)}/responses`)
  if (!res.ok) throw new Error("Failed to load responses")
  const data = (await res.json()) as {
    responses?: { id: string; formId: string; submittedAt: string; answers: string }[]
  }
  return (data.responses ?? []).map((r) => ({
    id: r.id,
    formId: r.formId,
    submittedAt: r.submittedAt,
    answers: parseAnswers(r.answers),
  }))
}

export async function apiSubmitResponse(
  id: string,
  answers: Record<string, AnswerValue>
): Promise<ParsedResponse> {
  const res = await api(`/api/forms/${encodeURIComponent(id)}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  })
  if (res.status === 410) throw new Error("This form is closed and no longer accepts responses.")
  if (!res.ok) throw new Error("Failed to submit response")
  const data = (await res.json()) as { response: ParsedResponse }
  return data.response
}

function parseAnswers(raw: string): Record<string, AnswerValue> {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, AnswerValue>
    }
  } catch {
    // fall through
  }
  return {}
}

/* ------------------------------ question helpers ------------------------------- */

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "multiple", label: "Multiple choice" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "rating", label: "Rating stars" },
]

export function typeLabel(t: QuestionType): string {
  return QUESTION_TYPES.find((x) => x.value === t)?.label ?? "Short answer"
}

export function hasOptions(t: QuestionType): boolean {
  return t === "multiple" || t === "checkbox" || t === "dropdown"
}

export function newQuestion(type: QuestionType = "short"): Question {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    options: hasOptions(type) ? ["", ""] : [],
    required: false,
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return "q-" + Math.random().toString(36).slice(2, 12)
}

const VALID_TYPES: QuestionType[] = ["short", "paragraph", "multiple", "checkbox", "dropdown", "rating"]

/** Parse the stored JSON `data` string (or pre-parsed array) into safe Question objects. */
export function parseQuestions(raw: unknown): Question[] {
  let arr: unknown = raw
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  const out: Question[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const q = item as Record<string, unknown>
    const type = VALID_TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "short"
    out.push({
      id: typeof q.id === "string" && q.id ? q.id : uuid(),
      type,
      title: typeof q.title === "string" ? q.title : "",
      options: Array.isArray(q.options)
        ? q.options.filter((o): o is string => typeof o === "string")
        : hasOptions(type)
          ? ["", ""]
          : [],
      required: q.required === true,
    })
  }
  return out
}

export function questionsToData(questions: Question[]): string {
  return JSON.stringify(questions)
}

/* ------------------------------- answer helpers -------------------------------- */

export function isEmptyAnswer(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === "string") return v.trim() === ""
  if (Array.isArray(v)) return v.every((s) => typeof s !== "string" || s.trim() === "")
  return v === 0
}

export function answerToText(v: AnswerValue | undefined): string {
  if (v === undefined || v === null) return ""
  if (Array.isArray(v)) return v.filter((s) => typeof s === "string" && s.trim()).join(", ")
  return String(v)
}

/* ------------------------------ deterministic colors ---------------------------- */

const ANSWER_COLORS = ["#0e7c74", "#1f8a5f", "#5aa02c", "#c9a227", "#e08a3c", "#d95f5f", "#7d5ba6"]

/** Deterministic bubble color derived from the answer text hash (stable across renders). */
export function answerColor(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return ANSWER_COLORS[Math.abs(hash) % ANSWER_COLORS.length]
}

/* ----------------------------------- CSV export --------------------------------- */

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

/** Build the full CSV document from questions + responses (oldest row first). */
export function buildResponsesCsv(questions: Question[], responses: ParsedResponse[]): string {
  const rows: string[] = []
  rows.push([csvEscape("Timestamp"), ...questions.map((q) => csvEscape(q.title || "Untitled question"))].join(","))
  const chronological = [...responses].reverse()
  for (const r of chronological) {
    rows.push(
      [csvEscape(r.submittedAt), ...questions.map((q) => csvEscape(answerToText(r.answers[q.id])))].join(",")
    )
  }
  return rows.join("\n")
}

export function sanitizeFilename(title: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return clean || "form"
}

/** Trigger a client-side download of `content` as a CSV file. */
export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
