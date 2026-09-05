/** Cross-app (Z-Docs / Z-Sheets / Z-Slides / Z-Forms) shared DTO types. */

export type WorkspaceView =
  | "home"
  | "editor"
  | "sheets"
  | "slides"
  | "forms"
  | "activity"
  | "settings"

export type WorkspaceApp = "docs" | "sheets" | "slides" | "forms"

/* ---------------------------------- Z-Sheets ---------------------------------- */

/** A single spreadsheet cell. `v` is the raw user input (may be a formula "=SUM(A1:A2)"). */
export interface CellData {
  v: string
  bold?: boolean
  italic?: boolean
  align?: "left" | "center" | "right"
  /** hex fill color, e.g. "#fef3c7" */
  bg?: string
}

export interface SheetData {
  rows: number
  cols: number
  /** key = "A1" style cell ref */
  cells: Record<string, CellData>
}

export interface SheetDTO {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  data?: SheetData
}

export interface SheetMeta {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
}

export const EMPTY_SHEET: SheetData = { rows: 60, cols: 26, cells: {} }

/* ---------------------------------- Z-Slides ---------------------------------- */

export type SlideLayout = "title" | "titleBody" | "twoColumn" | "quote" | "section" | "blank"

export interface Slide {
  id: string
  layout: SlideLayout
  title: string
  body: string
  /** speaker notes */
  notes?: string
}

export interface DeckTheme {
  /** accent hex, e.g. "#0b6b62" */
  accent: string
  /** display font stack name — one of the Google-like deck fonts */
  font: string
}

export interface DeckData {
  slides: Slide[]
  theme: DeckTheme
}

export interface SlideDeckDTO {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  data?: DeckData
}

export interface SlideDeckMeta {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
}

/* ---------------------------------- Z-Forms ----------------------------------- */

export type QuestionType =
  | "short"
  | "paragraph"
  | "multiple"
  | "checkbox"
  | "dropdown"
  | "rating"

export interface Question {
  id: string
  type: QuestionType
  title: string
  /** options for multiple / checkbox / dropdown */
  options: string[]
  required: boolean
}

export interface FormDTO {
  id: string
  title: string
  description: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  /** response count (list endpoint only) */
  responseCount?: number
  data?: Question[]
}

export interface FormMeta {
  id: string
  title: string
  description: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  responseCount: number
}

export type AnswerValue = string | string[] | number

export interface FormResponseDTO {
  id: string
  formId: string
  answers: Record<string, AnswerValue>
  submittedAt: string
}

/* --------------------------------- Activity ----------------------------------- */

export type ActivityKind =
  | "created"
  | "edited"
  | "renamed"
  | "starred"
  | "unstarred"
  | "trashed"
  | "restored"
  | "duplicated"
  | "commented"
  | "submitted"
  | "shared"

export interface ActivityDTO {
  id: string
  app: WorkspaceApp
  kind: ActivityKind
  entityId: string
  entityTitle: string
  detail: string
  actor: { id: string; name: string; color: string }
  createdAt: string
}
