import { EMPTY_SHEET, type CellData, type SheetData } from "@/lib/workspace-types"

/* ------------------------------------------------------------------ refs */

/** 0-based column index → letter(s) ("A"…"Z", "AA"…) */
export function colLetter(c: number): string {
  let s = ""
  let n = c + 1
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

/** letter(s) → 0-based column index, -1 if invalid */
export function colIndex(letters: string): number {
  let n = 0
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i)
    if (code < 65 || code > 90) return -1
    n = n * 26 + (code - 64)
  }
  return n - 1
}

/** 0-based row/col → "A1" style ref */
export function cellRef(r: number, c: number): string {
  return colLetter(c) + (r + 1)
}

/** "A1" style ref → 0-based {r, c} or null */
export function parseRef(ref: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]{1,2})([0-9]{1,4})$/.exec(ref)
  if (!m) return null
  const c = colIndex(m[1].toUpperCase())
  const r = parseInt(m[2], 10) - 1
  if (c < 0 || r < 0) return null
  return { r, c }
}

/** normalize a user-typed ref ("b7" → "B7"); null when not a ref */
export function normalizeRef(input: string): string | null {
  const p = parseRef(input.trim())
  return p ? cellRef(p.r, p.c) : null
}

export const ERROR_CODES = ["#ERROR!", "#NAME?", "#DIV/0!", "#CIRC!"] as const

/* ------------------------------------------------------------ sheet data */

/** Parse the raw `data` field of a SheetDTO (JSON string or object) tolerating garbage */
export function parseSheetData(raw: unknown): SheetData {
  let obj: unknown = raw
  if (typeof raw === "string") {
    if (!raw.trim()) return { ...EMPTY_SHEET, cells: {} }
    try {
      obj = JSON.parse(raw)
    } catch {
      return { ...EMPTY_SHEET, cells: {} }
    }
  }
  if (obj === null || typeof obj !== "object") return { ...EMPTY_SHEET, cells: {} }
  const o = obj as Partial<SheetData>
  const rows = clampInt(o.rows, 1, 500, EMPTY_SHEET.rows)
  const cols = clampInt(o.cols, 1, 52, EMPTY_SHEET.cols)
  const cells: Record<string, CellData> = {}
  if (o.cells && typeof o.cells === "object") {
    for (const [k, v] of Object.entries(o.cells)) {
      const p = parseRef(k)
      if (!p || v === null || typeof v !== "object") continue
      const cell = v as Partial<CellData>
      if (p.r >= rows || p.c >= cols) continue
      cells[cellRef(p.r, p.c)] = {
        v: typeof cell.v === "string" ? cell.v : "",
        ...(cell.bold !== undefined ? { bold: !!cell.bold } : {}),
        ...(cell.italic !== undefined ? { italic: !!cell.italic } : {}),
        ...(cell.align === "left" || cell.align === "center" || cell.align === "right"
          ? { align: cell.align }
          : {}),
        ...(typeof cell.bg === "string" && /^#[0-9a-fA-F]{3,8}$/.test(cell.bg) ? { bg: cell.bg } : {}),
      }
    }
  }
  return { rows, cols, cells }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : NaN
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** true when the cell carries any formatting (beyond its raw value) */
export function hasFormatting(cell: CellData | undefined): boolean {
  if (!cell) return false
  return cell.bold !== undefined || cell.italic !== undefined || cell.align !== undefined || cell.bg !== undefined
}

/** Serialize for the API: drop cells whose value is empty */
export function cleanSheetData(data: SheetData): SheetData {
  const cells: Record<string, CellData> = {}
  for (const [ref, cell] of Object.entries(data.cells)) {
    if (!cell || cell.v === "") continue
    cells[ref] = cell
  }
  return { rows: data.rows, cols: data.cols, cells }
}

/** number of non-empty cells (for list card meta) */
export function countCells(data: SheetData): number {
  let n = 0
  for (const cell of Object.values(data.cells)) {
    if (cell && cell.v !== "") n++
  }
  return n
}

/* ------------------------------------------------------------- rendering */

export type CellKind = "number" | "text" | "boolean" | "error"

const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

/** Classify a computed display string for alignment (Google behavior) */
export function displayKind(display: string): CellKind {
  if (display === "TRUE" || display === "FALSE") return "boolean"
  if ((ERROR_CODES as readonly string[]).includes(display)) return "error"
  if (display !== "" && NUMERIC_RE.test(display)) return "number"
  return "text"
}

/** Strictly parse a display string as a number (null when not numeric) */
export function parseNumeric(display: string): number | null {
  if (!NUMERIC_RE.test(display)) return null
  const n = Number(display)
  return Number.isFinite(n) ? n : null
}

/** Human-friendly number for the status bar / formula results (kills float noise) */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "#ERROR!"
  return String(Number(n.toPrecision(12)))
}

/** format a computed number for display */
export const formatNumber = fmtNum
