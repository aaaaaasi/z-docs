import type { CollabUser } from "@/lib/docs-types"
import type { TableInfo } from "@/lib/editor-dom"
import type { SuggestionInfo } from "@/lib/suggest-dom"
import type { PageMargins } from "@/components/docs/editor/ruler"
import type { DocStats } from "@/lib/doc-utils"

export type { SuggestionInfo, PageMargins }

export type SaveStatus = "saved" | "saving" | "unsaved" | "error"

export type TableOp =
  | "insert"
  | "row-above"
  | "row-below"
  | "col-left"
  | "col-right"
  | "delete-row"
  | "delete-col"
  | "delete-table"
  | "toggle-header"
  | "merge-right"
  | "merge-down"
  | "split-cell"

export interface FormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  superscript: boolean
  subscript: boolean
  ul: boolean
  ol: boolean
  block: string
  align: "left" | "center" | "right" | "full"
  fontName: string
  fontSize: number
  link: boolean
}

export const DEFAULT_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  superscript: false,
  subscript: false,
  ul: false,
  ol: false,
  block: "p",
  align: "left",
  fontName: "Arial",
  fontSize: 11,
  link: false,
}

export type DialogKey =
  | "link"
  | "image"
  | "find"
  | "share"
  | "versions"
  | "wordcount"
  | "shortcuts"
  | "helpwrite"
  | "about"
  | "table"
  | "emoji"
  | "aitools"
  | "spellcheck"
  | "writing"

export interface EditorApi {
  docId: string
  title: string
  starred: boolean
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  stats: DocStats
  zoom: number
  setZoom: (z: number) => void
  spellCheck: boolean
  setSpellCheck: (v: boolean) => void
  fmt: FormatState
  exec: (cmd: string, val?: string) => void
  applyFontSize: (pt: number) => void
  applyLineSpacing: (lh: number) => void
  applyAlignment: (a: "left" | "center" | "right" | "full") => void
  clearFormatting: () => void
  focusEditor: () => void
  onTitleChange: (t: string) => void
  focusTitle: () => void
  toggleStar: () => void
  saveNow: () => void
  printDoc: () => void
  /** export the document as a real .pdf file (server vector → raster → print) */
  downloadPdf: () => void
  /** export as .docx (server) / .doc / .html / structured .txt */
  downloadDoc: (format: "docx" | "doc" | "html" | "txt") => void
  goHome: () => void
  moveToTrash: () => void
  duplicate: () => void
  openDialog: (d: DialogKey) => void
  presence: CollabUser[]
  connected: boolean
  /* comments */
  commentsOpen: boolean
  toggleComments: (open?: boolean) => void
  openCommentComposer: () => void
  unresolvedCommentCount: number
  /* document outline */
  outlineOpen: boolean
  toggleOutline: (open?: boolean) => void
  /* live Ellipsus-style writing insights rail */
  insightsOpen: boolean
  toggleInsights: (open?: boolean) => void
  /* insert table */
  insertTable: (rows: number, cols: number) => void
  /* table structural operations (act on the caret's table) */
  tableOp: (op: TableOp) => void
  /** live table descriptor at the caret — null when not inside a table */
  tableInfo: TableInfo | null
  /* voice typing (Web Speech dictation into the caret) */
  voiceListening: boolean
  toggleVoiceTyping: () => void
  /* suggesting mode (Google Docs track-changes parity) */
  mode: "edit" | "suggest"
  setMode: (m: "edit" | "suggest") => void
  suggestions: SuggestionInfo[]
  activeSuggestionId: string | null
  acceptSuggestion: (sid: string) => void
  rejectSuggestion: (sid: string) => void
  focusSuggestion: (sid: string) => void
  /* draggable page margins (ruler handles) */
  pageMargins: PageMargins
  setPageMargins: (m: PageMargins) => void
}
