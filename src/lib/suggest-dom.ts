/* ------------------------------------------------------------------ *
 * Suggesting-mode engine (Google Docs "Suggesting" parity).
 *
 * Suggestions live inside the document HTML as marked spans:
 *   insertion        <span class="sug-ins"  data-sid …>text</span>
 *   deletion         <span class="sug-del"  data-sid …>text</span>
 *   paragraph break  <span class="sug-ins sug-para" data-kind="para" …>\u2060</span>
 *
 * Every span carries its author + creation time as data attributes, so the
 * suggestion cards can be re-derived from the document alone (no extra DB
 * tables) and they survive reloads, autosave and collaboration broadcasts.
 * All edits flow through document.execCommand so they land on the browser's
 * undo stack exactly like normal typing.
 * ------------------------------------------------------------------ */

export type SuggestionKind = "ins" | "del" | "para"

export interface SuggestionAuthor {
  id: string
  name: string
  color: string
}

export interface SuggestionInfo {
  sid: string
  kind: SuggestionKind
  authorId: string
  authorName: string
  authorColor: string
  createdAt: number
  /** concatenated text of all marks sharing this sid ("" for para marks) */
  text: string
}

/* ------------------------------------------------------------- utils */

const WORD_JOINER = "\u2060"
const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI",
  "TABLE", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE",
])

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function newSuggestionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function isBlockNode(n: Node): boolean {
  return n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((n as HTMLElement).tagName)
}

/* ------------------------------------------------------- mark queries */

export function collectSuggestions(root: HTMLElement | null): SuggestionInfo[] {
  if (!root) return []
  const bySid = new Map<string, SuggestionInfo>()
  const order: string[] = []
  const marks = root.querySelectorAll<HTMLElement>("[data-sid]")
  for (const el of marks) {
    const sid = el.dataset.sid
    if (!sid) continue
    let info = bySid.get(sid)
    if (!info) {
      const kind: SuggestionKind = el.classList.contains("sug-del")
        ? "del"
        : el.dataset.kind === "para"
          ? "para"
          : "ins"
      info = {
        sid,
        kind,
        authorId: el.dataset.ai ?? "",
        authorName: el.dataset.a ?? "Someone",
        authorColor: el.dataset.c ?? "#0e7c74",
        createdAt: Number(el.dataset.t ?? 0) || 0,
        text: "",
      }
      bySid.set(sid, info)
      order.push(sid)
    }
    info.text += el.textContent ?? ""
  }
  const list = order.map((sid) => bySid.get(sid)!)
  for (const s of list) s.text = s.text.replace(/\u2060/g, "").trim()
  return list
}

export function suggestionElements(root: HTMLElement | null, sid: string): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-sid="${CSS.escape(sid)}"]`))
}

/* ------------------------------------------------------ mark creation */

/** Place the caret at the very end INSIDE the given element so that
 *  consecutive typing extends the suggestion span naturally. */
export function placeCaretEndInside(el: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel) return
  const last = el.lastChild
  const range = document.createRange()
  try {
    if (last) {
      if (last.nodeType === Node.TEXT_NODE) range.setStart(last, (last.textContent ?? "").length)
      else range.setStartAfter(last)
      range.collapse(true)
    } else {
      range.setStart(el, 0)
      range.collapse(true)
    }
    sel.removeAllRanges()
    sel.addRange(range)
  } catch {
    // detached — leave the caret wherever the browser put it
  }
}

/** Insert plain text at the caret as a suggested insertion. Direct DOM
 *  (Range.insertNode) because Chromium's insertHTML bakes class-based
 *  styles into inline styles and strips data attributes whenever its
 *  style-splicing activates (typing next to existing marks). Consecutive
 *  typing merges into the preceding mark of the same author — one card per
 *  typing run, like Google Docs. */
export function suggestInsertText(
  root: HTMLElement,
  text: string,
  author: SuggestionAuthor
): string | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null
  const span = document.createElement("span")
  const sid = newSuggestionId()
  span.className = "sug-ins"
  span.dataset.sid = sid
  span.dataset.ai = author.id
  span.dataset.a = author.name
  span.dataset.c = author.color
  span.dataset.t = String(Date.now())
  span.style.setProperty("--sc", author.color)
  span.textContent = text
  try {
    range.deleteContents()
    range.insertNode(span)
  } catch {
    return null
  }
  // merge into the immediately preceding own mark (continuous typing run)
  const prev = span.previousSibling
  if (
    prev instanceof HTMLElement &&
    prev.classList.contains("sug-ins") &&
    prev.dataset.kind !== "para" &&
    prev.dataset.ai === author.id
  ) {
    while (span.firstChild) prev.appendChild(span.firstChild)
    span.remove()
    placeCaretEndInside(prev)
    return prev.dataset.sid ?? null
  }
  placeCaretEndInside(span)
  return sid
}

/** Insert a suggested paragraph break at the caret. Chromium normalizes
 *  block-level insertHTML (it strips data attributes), so this is done as a
 *  real paragraph split followed by an inline mark insertion — the mark lands
 *  at the start of the new line, exactly like Google's break indicator. */
export function suggestInsertParagraph(
  root: HTMLElement,
  author: SuggestionAuthor
): string | null {
  // If the caret sits at the very END of an insertion mark, step outside it
  // first — otherwise the paragraph break (and its mark) nests inside that
  // suggestion, which renders and resolves messily.
  const inside = caretSugSpan(root)
  if (inside && inside.classList.contains("sug-ins")) {
    const sel = window.getSelection()
    const last = inside.lastChild
    const atEnd =
      sel?.anchorNode === last ||
      (sel?.anchorNode?.nodeType === Node.TEXT_NODE &&
        sel?.anchorNode === last &&
        sel?.anchorOffset === (last.textContent ?? "").length)
    if (atEnd && sel) {
      const range = document.createRange()
      try {
        range.setStartAfter(inside)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } catch {
        // keep the caret where it is
      }
    }
  }
  // 1. the real paragraph split — Chromium's own op, reliable & undoable
  if (!document.execCommand("insertParagraph")) return null
  // 2. mark the break on the new line via direct DOM (insertHTML would
  //    normalize the mark away when style-splicing activates)
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  const sid = newSuggestionId()
  const span = document.createElement("span")
  span.className = "sug-ins sug-para"
  span.dataset.kind = "para"
  span.dataset.sid = sid
  span.dataset.ai = author.id
  span.dataset.a = author.name
  span.dataset.c = author.color
  span.dataset.t = String(Date.now())
  span.style.setProperty("--sc", author.color)
  span.textContent = WORD_JOINER
  try {
    r.insertNode(span)
  } catch {
    return null
  }
  // caret just after the break mark
  try {
    const after = document.createRange()
    after.setStartAfter(span)
    after.collapse(true)
    sel.removeAllRanges()
    sel.addRange(after)
  } catch {
    // leave the caret as the browser placed it
  }
  return sid
}

/** Wrap a live selection as a suggested deletion. Done with direct DOM
 *  manipulation (extract → mark → re-insert) because Chromium's
 *  execCommand("insertHTML") over a NON-COLLAPSED selection normalizes the
 *  inserted markup — it inlines computed styles and strips data attributes,
 *  which would destroy the mark metadata. */
export function suggestDeleteSelection(
  range: Range,
  author: SuggestionAuthor
): boolean {
  const sid = newSuggestionId()
  let spans: HTMLElement[] = []
  try {
    const frag = range.extractContents()
    if (!frag.firstChild) return false
    spans = markFragment(frag, sid, author)
    range.insertNode(frag)
  } catch {
    return false
  }
  // caret right after the last mark (Google places it after the deletion)
  const sel = window.getSelection()
  const last = spans[spans.length - 1]
  if (sel && last) {
    try {
      const r = document.createRange()
      r.setStartAfter(last)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
    } catch {
      // leave the caret wherever it is
    }
  }
  return true
}

/** Recursively wrap a fragment's children in deletion marks. Block-level
 *  children are recursed into (marks go around their inline content) so we
 *  never end up with a <p> nested inside a <span>. Returns the created marks
 *  in document order. */
function markFragment(frag: ParentNode, sid: string, author: SuggestionAuthor): HTMLElement[] {
  const created: HTMLElement[] = []
  for (const child of Array.from(frag.childNodes)) {
    if (isBlockNode(child)) {
      created.push(...markFragment(child as HTMLElement, sid, author))
      continue
    }
    if (child.nodeType === Node.TEXT_NODE && !(child.textContent ?? "").length) continue
    const span = document.createElement("span")
    span.className = "sug-del"
    span.dataset.sid = sid
    span.dataset.ai = author.id
    span.dataset.a = author.name
    span.dataset.c = author.color
    span.dataset.t = String(Date.now())
    span.style.setProperty("--sc", author.color)
    frag.insertBefore(span, child)
    span.appendChild(child)
    created.push(span)
  }
  return created
}

/** Try to resolve the unit a collapsed caret would delete. Returns a Range
 *  covering that unit, or null when the deletion is structural (paragraph
 *  merge, table boundary, …) and should fall through to the browser. */
export function deletionUnitRange(root: HTMLElement, dir: "backward" | "forward"): Range | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null
  if (!root.contains(node)) return null
  const off = range.startOffset
  const len = (node.textContent ?? "").length
  if (dir === "backward" && off === 0) return null
  if (dir === "forward" && off >= len) return null
  const unit = document.createRange()
  try {
    if (dir === "backward") {
      unit.setStart(node, off - 1)
      unit.setEnd(node, off)
    } else {
      unit.setStart(node, off)
      unit.setEnd(node, off + 1)
    }
  } catch {
    return null
  }
  return unit
}

/** Which suggestion span (if any) contains the caret? */
export function caretSugSpan(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const node = sel.anchorNode
  if (!node || !root.contains(node)) return null
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
  return el?.closest("[data-sid]") ?? null
}

/* ---------------------------------------------------- accept / reject */

function unwrapSpan(span: HTMLElement): void {
  const parent = span.parentNode
  if (!parent) return
  while (span.firstChild) parent.insertBefore(span.firstChild, span)
  parent.removeChild(span)
}

function removeParaMarkParagraph(span: HTMLElement): void {
  // rejecting a paragraph-break suggestion removes the break itself
  const para = span.closest("p, div, h1, h2, h3, h4, li, blockquote")
  unwrapSpan(span)
  if (para && !(para.textContent ?? "").replace(/\u2060|\u200b/g, "").trim() && !para.querySelector("img, br + *, table")) {
    // the paragraph only held the mark — remove it entirely (merge back)
    if (para.querySelectorAll("br").length <= 1 && !(para.textContent ?? "").trim()) {
      para.remove()
    }
  }
}

/** Remove paragraphs that a just-resolved suggestion emptied out (rejecting
 *  the only content of a paragraph should also remove that paragraph). Never
 *  leaves the document without a single block. */
function pruneEmptiedParagraphs(root: HTMLElement, candidates: Set<HTMLElement>): void {
  const isBlock = (n: Node): n is HTMLElement =>
    n.nodeType === Node.ELEMENT_NODE &&
    BLOCK_TAGS.has((n as HTMLElement).tagName) &&
    !(n as HTMLElement).classList.contains("doc-page")
  for (const p of candidates) {
    if (!p.isConnected || !root.contains(p) || !isBlock(p)) continue
    const hasText = (p.textContent ?? "").replace(/[\u2060\u200b\s]/g, "").length > 0
    const hasMedia = !!p.querySelector("img, table, hr, iframe")
    if (!hasText && !hasMedia) p.remove()
  }
  // never leave the document block-less — restore a caret target
  if (root.children.length === 0 || !Array.from(root.children).some(isBlock)) {
    root.innerHTML = "<p><br></p>"
  }
}

/** Accept: apply the suggested edit to the document. */
export function acceptSuggestionMark(root: HTMLElement, sid: string): boolean {
  const marks = suggestionElements(root, sid)
  if (marks.length === 0) return false
  const paras = new Set<HTMLElement>()
  for (const el of marks) {
    const p = el.closest("p, div, h1, h2, h3, h4, li, blockquote") as HTMLElement | null
    if (p && root.contains(p)) paras.add(p)
    if (el.classList.contains("sug-del")) {
      el.remove() // deletion accepted → the text goes away
    } else if (el.dataset.kind === "para") {
      // break accepted → keep the paragraph, drop the mark + word-joiner
      for (const t of Array.from(el.childNodes)) {
        if (t.nodeType === Node.TEXT_NODE && (t.textContent ?? "").includes(WORD_JOINER)) {
          t.textContent = (t.textContent ?? "").replace(/\u2060/g, "")
          if (!(t.textContent ?? "").length) t.remove()
        }
      }
      unwrapSpan(el)
    } else {
      unwrapSpan(el) // insertion accepted → keep the text, drop the mark
    }
  }
  pruneEmptiedParagraphs(root, paras)
  return true
}

/** Reject: revert the suggested edit. */
export function rejectSuggestionMark(root: HTMLElement, sid: string): boolean {
  const marks = suggestionElements(root, sid)
  if (marks.length === 0) return false
  const paras = new Set<HTMLElement>()
  for (const el of marks) {
    const p = el.closest("p, div, h1, h2, h3, h4, li, blockquote") as HTMLElement | null
    if (p && root.contains(p)) paras.add(p)
    if (el.classList.contains("sug-del")) {
      unwrapSpan(el) // deletion rejected → the text stays
    } else if (el.dataset.kind === "para") {
      removeParaMarkParagraph(el)
    } else {
      el.remove() // insertion rejected → the text goes away
    }
  }
  pruneEmptiedParagraphs(root, paras)
  return true
}

/* ------------------------------------------------------------- focus */

/** Scroll a suggestion mark into view and highlight it temporarily. */
export function focusSuggestionMark(
  root: HTMLElement | null,
  sid: string
): HTMLElement | null {
  if (!root) return null
  root.querySelectorAll(".sug-focus").forEach((el) => el.classList.remove("sug-focus"))
  const el = root.querySelector<HTMLElement>(`[data-sid="${CSS.escape(sid)}"]`)
  if (!el) return null
  el.classList.add("sug-focus")
  el.scrollIntoView({ block: "center", behavior: "smooth" })
  return el
}

export function clearSuggestionFocus(root: HTMLElement | null): void {
  if (!root) return
  root.querySelectorAll(".sug-focus").forEach((el) => el.classList.remove("sug-focus"))
}
