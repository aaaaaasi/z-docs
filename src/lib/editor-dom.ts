"use client"

/**
 * Text-offset utilities — convert between DOM Ranges and plain-text offsets.
 * Used for remote cursor sync and caret restoration across content updates.
 */

export interface TextOffsets {
  start: number
  end: number
}

function textNodesOf(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  return nodes
}

function totalTextLength(root: Node): number {
  return textNodesOf(root).reduce((acc, t) => acc + (t.textContent?.length ?? 0), 0)
}

function offsetOf(root: Node, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    let total = 0
    for (const t of textNodesOf(root)) {
      if (t === container) return total + Math.min(offset, t.textContent?.length ?? 0)
      total += t.textContent?.length ?? 0
    }
    return total
  }
  // container is an element — offset is a child index; count text before that child
  let target: Node | null = null
  if (container === root) {
    target = offset < container.childNodes.length ? container.childNodes[offset] : null
  } else {
    target = container
  }
  if (!target) return totalTextLength(root)
  let total = 0
  for (const t of textNodesOf(root)) {
    if (t === target || (target.nodeType !== Node.TEXT_NODE && target.contains(t))) break
    total += t.textContent?.length ?? 0
  }
  return total
}

export function selectionOffsets(root: HTMLElement): TextOffsets | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  return {
    start: offsetOf(root, range.startContainer, range.startOffset),
    end: offsetOf(root, range.endContainer, range.endOffset),
  }
}

export function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  try {
    const nodes = textNodesOf(root)
    if (nodes.length === 0) return null
    const total = nodes.reduce((acc, t) => acc + (t.textContent?.length ?? 0), 0)
    const s = Math.max(0, Math.min(start, total))
    const e = Math.max(s, Math.min(end, total))
    const locate = (pos: number): Text => {
      let acc = 0
      for (const t of nodes) {
        const len = t.textContent?.length ?? 0
        if (pos <= acc + len) return t
        acc += len
      }
      return nodes[nodes.length - 1]
    }
    const sNode = locate(s)
    const eNode = locate(e)
    const range = document.createRange()
    range.setStart(sNode, Math.min(s - offsetOfBefore(nodes, sNode), sNode.textContent?.length ?? 0))
    range.setEnd(eNode, Math.min(e - offsetOfBefore(nodes, eNode), eNode.textContent?.length ?? 0))
    return range
  } catch {
    return null
  }
}

function offsetOfBefore(nodes: Text[], node: Text): number {
  let acc = 0
  for (const t of nodes) {
    if (t === node) return acc
    acc += t.textContent?.length ?? 0
  }
  return acc
}

export function setSelectionFromOffsets(root: HTMLElement, offsets: TextOffsets) {
  const range = rangeFromOffsets(root, offsets.start, offsets.end)
  if (!range) return
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/** All block-level elements that intersect the current selection */
export function selectedBlocks(root: HTMLElement): HTMLElement[] {
  const sel = window.getSelection()
  const blockTags = new Set(["P", "H1", "H2", "H3", "H4", "LI", "BLOCKQUOTE", "DIV", "PRE", "TD", "TH"])
  const blocks: HTMLElement[] = []
  if (!sel || sel.rangeCount === 0) return blocks
  const range = sel.getRangeAt(0)
  const collapsed = range.collapsed
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n as HTMLElement
    if (blockTags.has(el.tagName)) {
      if (collapsed) {
        // caret inside this block
        if (el.contains(range.startContainer)) blocks.push(el)
      } else if (range.intersectsNode(el)) {
        blocks.push(el)
      }
    }
  }
  if (blocks.length === 0 && collapsed && root.contains(range.startContainer)) {
    let node: Node | null = range.startContainer
    while (node && node !== root) {
      if (node.nodeType === Node.ELEMENT_NODE && blockTags.has((node as HTMLElement).tagName)) {
        blocks.push(node as HTMLElement)
        break
      }
      node = node.parentNode
    }
    if (blocks.length === 0) blocks.push(root)
  }
  return blocks
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/* ------------------------------------------------------------------ find */

export interface TextMatch {
  /** global text offset (within root) of the match start */
  start: number
  end: number
  /** live range spanning the matched text (valid until the DOM changes) */
  range: Range
}

/**
 * Find every occurrence of `query` inside root's text content.
 * A match must live within a single text node (v1 simplification —
 * matches spanning element boundaries are skipped, which covers the
 * overwhelming majority of real documents).
 */
export function findTextMatches(root: HTMLElement, query: string, caseSensitive: boolean): TextMatch[] {
  if (!query) return []
  const matches: TextMatch[] = []
  const needle = caseSensitive ? query : query.toLowerCase()
  let base = 0
  for (const t of textNodesOf(root)) {
    const text = t.textContent ?? ""
    if (text.length >= query.length) {
      const scan = caseSensitive ? text : text.toLowerCase()
      let i = scan.indexOf(needle)
      while (i !== -1) {
        const range = document.createRange()
        try {
          range.setStart(t, i)
          range.setEnd(t, i + query.length)
          matches.push({ start: base + i, end: base + i + query.length, range })
        } catch {
          // detached node — skip
        }
        i = scan.indexOf(needle, i + query.length)
      }
    }
    base += text.length
  }
  return matches
}

/**
 * Center a live Range inside the document canvas' scroll container
 * (visual pixels — the canvas' scroll space is the zoomed space).
 */
export function scrollRangeIntoCanvasView(root: HTMLElement, range: Range): void {
  try {
    const rect = range.getBoundingClientRect()
    if (!rect.height && !rect.width) return
    const canvas = root.closest(".doc-canvas-bg")
    if (!(canvas instanceof HTMLElement)) return
    const cRect = canvas.getBoundingClientRect()
    const margin = 60
    if (rect.bottom > cRect.bottom - margin || rect.top < cRect.top + margin) {
      canvas.scrollTop += rect.top + rect.height / 2 - (cRect.top + cRect.height / 2)
    }
  } catch {
    // range detached — ignore
  }
}

/* ------------------------------------------------------------------ tables */

export interface TableContext {
  table: HTMLTableElement
  row: HTMLTableRowElement
  cell: HTMLTableCellElement
  rowIndex: number
  colIndex: number
}

/** Table info for UI state (serializable, safe for React state). */
export interface TableInfo {
  rows: number
  cols: number
  rowIndex: number
  colIndex: number
  hasHeader: boolean
}

/** Resolve the table/row/cell containing the current selection, if any. */
export function getTableContext(root: HTMLElement): TableContext | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  let node: Node | null = sel.anchorNode
  if (!node || !root.contains(node)) return null
  while (node && node !== root) {
    const el = node as HTMLElement
    if (el.tagName === "TD" || el.tagName === "TH") break
    node = node.parentNode
  }
  if (!node || node === root) return null
  const cell = node as HTMLTableCellElement
  const row = cell.closest("tr") as HTMLTableRowElement | null
  const table = cell.closest("table") as HTMLTableElement | null
  if (!row || !table || !root.contains(table)) return null
  const rowIndex = Array.prototype.indexOf.call(table.rows, row)
  const colIndex = Array.prototype.indexOf.call(row.cells, cell)
  if (rowIndex < 0 || colIndex < 0) return null
  return { table, row, cell, rowIndex, colIndex }
}

/** Serializable descriptor of the table at the selection (for menu state). */
export function describeTableAt(root: HTMLElement): TableInfo | null {
  const ctx = getTableContext(root)
  if (!ctx) return null
  return {
    rows: ctx.table.rows.length,
    cols: ctx.row.cells.length,
    rowIndex: ctx.rowIndex,
    colIndex: ctx.colIndex,
    hasHeader: !!ctx.table.rows[0]?.cells[0] && ctx.table.rows[0].cells[0].tagName === "TH",
  }
}

function makeCell(tag: string): HTMLTableCellElement {
  const c = document.createElement(tag === "TH" ? "th" : "td")
  c.innerHTML = "&nbsp;"
  return c
}

/** Place the caret inside a cell so the user can keep typing. */
export function placeCaretInCell(cell: HTMLElement): void {
  try {
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  } catch {
    // ignore
  }
}

/** Insert a row above/below the context row; returns the new row. */
export function insertTableRow(ctx: TableContext, where: "above" | "below"): HTMLTableRowElement {
  const tr = document.createElement("tr")
  const tags = Array.from(ctx.row.cells).map((c) => c.tagName)
  if (tags.length === 0) tags.push("TD")
  for (const t of tags) tr.appendChild(makeCell(t))
  if (where === "above" || ctx.row.nextSibling == null) {
    if (where === "above") ctx.row.parentNode?.insertBefore(tr, ctx.row)
    else ctx.row.parentNode?.appendChild(tr)
  } else {
    ctx.row.parentNode?.insertBefore(tr, ctx.row.nextSibling)
  }
  return tr
}

/** Insert a column left/right of the context column; returns the new cells.
 *  Keeps the <colgroup> (if any) in sync by splitting the source column's width. */
export function insertTableColumn(ctx: TableContext, where: "left" | "right"): HTMLTableCellElement[] {
  const cells: HTMLTableCellElement[] = []
  for (const row of Array.from(ctx.table.rows)) {
    const ref = row.cells[ctx.colIndex] ?? row.cells[row.cells.length - 1]
    const cell = makeCell(ref?.tagName ?? "TD")
    if (ref && where === "left") row.insertBefore(cell, ref)
    else if (ref?.nextSibling) row.insertBefore(cell, ref.nextSibling)
    else row.appendChild(cell)
    cells.push(cell)
  }
  syncColgroupWithColumns(ctx.table, ctx.colIndex + (where === "left" ? 0 : 1), where === "left" ? "left" : "right")
  return cells
}

/** Delete the context row. Returns true if the table itself became empty and was removed. */
export function deleteTableRow(ctx: TableContext): boolean {
  const rowCount = ctx.table.rows.length
  ctx.row.remove()
  if (ctx.table.rows.length === 0) {
    ctx.table.remove()
    return true
  }
  return rowCount > 1
}

/** Delete the context column. Returns true if the table itself became empty and was removed. */
export function deleteTableColumn(ctx: TableContext): boolean {
  for (const row of Array.from(ctx.table.rows)) {
    const cell = row.cells[ctx.colIndex]
    if (cell) cell.remove()
  }
  const cg = ctx.table.querySelector(":scope > colgroup")
  if (cg && cg.children.length === ctx.table.rows[0]?.cells.length + 1) {
    cg.children[ctx.colIndex]?.remove()
  }
  if (ctx.table.rows.length > 0 && ctx.table.rows[0].cells.length === 0) {
    ctx.table.remove()
    return true
  }
  return false
}

/** Remove the whole table. */
export function deleteTableEl(ctx: TableContext): void {
  ctx.table.remove()
}

/** Toggle the first row between header (th) and body (td) cells. Returns the new header state. */
export function toggleTableHeader(ctx: TableContext): boolean {
  const firstRow = ctx.table.rows[0]
  if (!firstRow) return false
  const isHeader = firstRow.cells[0]?.tagName === "TH"
  for (const cell of Array.from(firstRow.cells)) {
    const next = document.createElement(isHeader ? "td" : "th")
    next.innerHTML = cell.innerHTML
    if (cell === ctx.cell) ctx.cell = next
    cell.replaceWith(next)
  }
  return !isHeader
}

/** Make sure the document always has a paragraph to type in after structural deletes. */
export function ensureParagraph(root: HTMLElement): void {
  if (root.querySelector("p, h1, h2, h3, h4, li, table, blockquote, pre")) return
  const p = document.createElement("p")
  p.innerHTML = "<br>"
  root.appendChild(p)
}

/* ================================ column resizing ================================ */

/**
 * Materialize the table's current column distribution into a <colgroup> with
 * percentage widths, so the columns become resizable and the layout stays
 * responsive. No-op when a width-bearing colgroup already exists.
 */
export function ensureTableColWidths(table: HTMLTableElement): HTMLColElement[] | null {
  const cols = colWidthsFrom(table)
  if (cols) return cols
  const firstRow = table.rows[0]
  if (!firstRow || firstRow.cells.length === 0) return null
  const tableWidth = table.getBoundingClientRect().width
  if (tableWidth <= 0) return null
  table.querySelectorAll("colgroup").forEach((g) => g.remove())
  const cg = document.createElement("colgroup")
  for (const cell of Array.from(firstRow.cells)) {
    const col = document.createElement("col")
    const pct = (cell.getBoundingClientRect().width / tableWidth) * 100
    col.style.width = `${pct.toFixed(3)}%`
    cg.appendChild(col)
  }
  table.insertBefore(cg, table.firstChild)
  return Array.from(cg.children) as HTMLColElement[]
}

/** Existing width-bearing colgroup, if present. */
function colWidthsFrom(table: HTMLTableElement): HTMLColElement[] | null {
  // NOTE: HTMLTableElement has no `colgroup` DOM property — query it explicitly
  const cg = table.querySelector(":scope > colgroup")
  if (!cg) return null
  const cols = Array.from(cg.children) as HTMLColElement[]
  if (cols.length === 0 || cols.some((c) => !c.style.width)) return null
  return cols
}

/** Keep the colgroup aligned after a structural column change. */
function syncColgroupWithColumns(
  table: HTMLTableElement,
  newColIndex: number,
  side: "left" | "right",
): void {
  const cols = colWidthsFrom(table)
  if (!cols) return // no colgroup yet — percentages materialize on first resize
  const firstRow = table.rows[0]
  const cellCount = firstRow?.cells.length ?? 0
  if (cols.length !== cellCount - 1) return // unexpected shape, leave alone
  const sourceIndex = Math.max(0, newColIndex - (side === "left" ? 0 : 1))
  const source = cols[Math.min(sourceIndex, cols.length - 1)]
  const sourcePct = parseColPct(source) ?? 100 / (cols.length + 1)
  const half = Math.max(sourcePct / 2, 2)
  const other = Math.max(sourcePct - half, 2)
  source.style.width = `${other.toFixed(3)}%`
  const col = document.createElement("col")
  col.style.width = `${half.toFixed(3)}%`
  source.after(col)
}

function parseColPct(col: HTMLColElement): number | null {
  const m = /^([\d.]+)%$/.exec(col.style.width)
  return m ? Number(m[1]) : null
}

/**
 * Adjust the boundary between two adjacent columns by a pixel delta,
 * Google-Docs style: the two neighbors share the table width between them.
 * Returns the applied delta in pixels (0 when clamped).
 */
export function resizeTableColumn(
  table: HTMLTableElement,
  boundaryIndex: number,
  deltaPx: number,
  minPct = 4,
): number {
  const cols = ensureTableColWidths(table)
  if (!cols) return 0
  const i = boundaryIndex
  const j = boundaryIndex + 1
  if (i < 0 || j >= cols.length) return 0
  const a = parseColPct(cols[i])
  const b = parseColPct(cols[j])
  if (a == null || b == null) return 0
  const tableWidth = table.getBoundingClientRect().width
  if (tableWidth <= 0) return 0
  const deltaPct = (deltaPx / tableWidth) * 100
  let na = a + deltaPct
  let nb = b - deltaPct
  // clamp: keep both columns at the minimum width
  if (na < minPct) {
    nb -= minPct - na
    na = minPct
  }
  if (nb < minPct) {
    na -= minPct - nb
    nb = minPct
  }
  na = Math.max(na, minPct)
  nb = Math.max(nb, minPct)
  const appliedPct = na - a
  cols[i].style.width = `${na.toFixed(3)}%`
  cols[j].style.width = `${nb.toFixed(3)}%`
  return (appliedPct / 100) * tableWidth
}

/** Current pixel width of a column (from the first row's cells). */
export function tableColumnPixelWidth(table: HTMLTableElement, colIndex: number): number {
  const firstRow = table.rows[0]
  const cell = firstRow?.cells[colIndex]
  return cell ? cell.getBoundingClientRect().width : 0
}

/** Caret range from a point, cross-browser (WebKit + Firefox). */
export function caretRangeFromPoint(x: number, y: number): Range | null {
  try {
    const d = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    if (typeof d.caretRangeFromPoint === "function") return d.caretRangeFromPoint(x, y)
    const dd = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    }
    if (typeof dd.caretPositionFromPoint === "function") {
      const pos = dd.caretPositionFromPoint(x, y)
      if (!pos) return null
      const r = document.createRange()
      r.setStart(pos.offsetNode, pos.offset)
      r.collapse(true)
      return r
    }
  } catch {
    // ignore
  }
  return null
}

/** Is the point inside the selection's rendered rects? */
export function pointInSelection(x: number, y: number): boolean {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  const rects = sel.getRangeAt(0).getClientRects()
  for (const r of rects) {
    if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) return true
  }
  return false
}

/**
 * Locate the DOM range for a comment's quoted text. First tries the stored
 * creation-time offset hint; when the document has shifted (text added or
 * removed before the quote), falls back to a full-text search. Returns null
 * when the quote no longer exists in the document.
 */
export function findQuoteRange(
  root: HTMLElement,
  quote: string,
  hintOffset: number
): { range: Range; start: number } | null {
  if (!quote) return null
  try {
    const hinted = rangeFromOffsets(root, hintOffset, hintOffset + quote.length)
    if (hinted && hinted.toString() === quote) {
      return { range: hinted, start: hintOffset }
    }
    const text = root.textContent ?? ""
    const idx = text.indexOf(quote)
    if (idx === -1) return null
    const found = rangeFromOffsets(root, idx, idx + quote.length)
    if (!found || found.toString() !== quote) return null
    return { range: found, start: idx }
  } catch {
    return null
  }
}
