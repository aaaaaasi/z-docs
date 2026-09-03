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
