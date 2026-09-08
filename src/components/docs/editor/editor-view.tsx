"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useDocsStore } from "@/store/docs-store"
import { useLocalUser } from "@/lib/identity"
import { useCollab, type DocChangePayload, type CommentsChangedPayload } from "@/hooks/use-collab"
import { docStats, escapeHtml, getSnippet, htmlToText, countWords } from "@/lib/doc-utils"
import { buildPrintDocument, exportSafeName } from "@/lib/print-html"
import { api as apiFetch } from "@/lib/api-client"
import { trackedDownload, readBlobWithProgress } from "@/store/export-progress-store"
import { useI18n, tForLang, getCurrentLang } from "@/lib/i18n"
import {
  selectionOffsets, selectedBlocks, findQuoteRange,
  getTableContext, describeTableAt, insertTableRow, insertTableColumn, deleteTableRow,
  deleteTableColumn, deleteTableEl, toggleTableHeader, ensureParagraph, placeCaretInCell,
  mergeTableCells, splitTableCell,
  caretRangeFromPoint, pointInSelection, findTextMatches, scrollRangeIntoCanvasView, mapRangeToClone,
  type TableInfo, type TextMatch,
} from "@/lib/editor-dom"
import type { DocumentDTO, CommentDTO } from "@/lib/docs-types"
import {
  collectSuggestions, suggestInsertText, suggestInsertParagraph, suggestDeleteSelection,
  deletionUnitRange, caretSugSpan, acceptSuggestionMark, rejectSuggestionMark,
  focusSuggestionMark, clearSuggestionFocus,
  type SuggestionInfo, type SuggestionAuthor,
} from "@/lib/suggest-dom"
import { DEFAULT_MARGINS, type PageMargins } from "./ruler"
import { EditorCanvas } from "./editor-canvas"
import { EditorHeader } from "./editor-header"
import { MenuBar } from "./menu-bar"
import { Toolbar } from "./toolbar"
import { StatusPill } from "./status-pill"
import { CommentsSidebar, CommentBubble, type PendingQuote } from "./comments-sidebar"
import { DEFAULT_FORMAT, type EditorApi, type FormatState, type TableOp } from "./editor-types"
import { LinkDialog, ImageDialog, TableDialog } from "./dialogs-basic"
import { ShareDialog } from "./share-dialog"
import { VersionHistorySheet } from "./version-history"
import { HelpWriteDialog } from "./help-write-dialog"
import { WordCountDialog, ShortcutsDialog, AboutDialog } from "./info-dialogs"
import { OutlineSidebar, type OutlineItem } from "./outline-sidebar"
import { EmojiDialog } from "./emoji-dialog"
import { FindReplacePanel } from "./find-replace"
import { useVoiceTyping, VoicePill } from "./voice-typing"
import { SpellCheckDialog } from "./spell-check-dialog"
import { WritingStudioDialog } from "./writing-studio"
import { createWritingTracker, type WritingStats, type WritingTracker } from "@/lib/writing-tracker"
import { AiToolsDialog, type AiSource } from "./ai-tools-dialog"
import { FileWarning, Loader2, Rows3, Columns3, Heading, Trash2, TableCellsMerge, TableCellsSplit } from "lucide-react"
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu"

/* ---------------- structured plain-text export ---------------- */

const TXT_BLOCK_TAGS = new Set(["p", "div", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "tr", "table", "figure"])

/** Client-side DOM walk producing a genuinely structured .txt export:
 *  underlined headings, real list markers with nesting, quote prefixes,
 *  verbatim code blocks, tables as `a | b` rows, image alt placeholders. */
function htmlToPlainText(html: string): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  const lines: string[] = []
  const push = (s: string) => {
    if (s.trim()) lines.push(s.replace(/\u00a0/g, " ").trimEnd())
  }

  const inlineText = (node: Node): string => {
    let s = ""
    node.childNodes.forEach((ch) => {
      if (ch.nodeType === Node.TEXT_NODE) s += (ch.textContent || "").replace(/\s+/g, " ")
      else if (ch.nodeType === Node.ELEMENT_NODE) {
        const el = ch as Element
        const tag = el.tagName.toLowerCase()
        if (tag === "br") s += "\n"
        else if (tag === "img") {
          const alt = el.getAttribute("alt")
          if (alt) s += `[${alt}]`
        } else if (TXT_BLOCK_TAGS.has(tag)) s += `\n${inlineText(el)}\n`
        else s += inlineText(el)
      }
    })
    return s
  }

  const walkList = (list: Element, depth: number) => {
    const ordered = list.tagName.toLowerCase() === "ol"
    const indent = "  ".repeat(depth)
    let i = 1
    list.childNodes.forEach((n) => {
      if (n.nodeType !== Node.ELEMENT_NODE) return
      const li = n as Element
      if (li.tagName.toLowerCase() !== "li") return
      let inline = ""
      const nested: Element[] = []
      li.childNodes.forEach((ch) => {
        if (ch.nodeType === Node.TEXT_NODE) inline += (ch.textContent || "").replace(/\s+/g, " ")
        else if (ch.nodeType === Node.ELEMENT_NODE) {
          const cel = ch as Element
          const ctag = cel.tagName.toLowerCase()
          if (ctag === "ul" || ctag === "ol") nested.push(cel)
          else if (ctag === "br") inline += "\n"
          else inline += inlineText(cel)
        }
      })
      const marker = ordered ? `${i++}. ` : "- "
      push(indent + marker + inline.trim())
      nested.forEach((nl) => walkList(nl, depth + 1))
    })
  }

  const walkBlocks = (parent: Element, depth = 0) => {
    const indent = "  ".repeat(depth)
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        push(indent + (node.textContent || "").replace(/\s+/g, " ").trim())
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) {
        const text = inlineText(el).trim()
        if (!text) return
        lines.push("")
        push(indent + text)
        if (tag === "h1") push("=".repeat(Math.min(60, Math.max(6, text.length * 2))))
        else if (tag === "h2") push("-".repeat(Math.min(60, Math.max(6, text.length * 2))))
        lines.push("")
      } else if (tag === "p") {
        const text = inlineText(el).replace(/[ \t]+\n/g, "\n").trim()
        if (text) text.split("\n").forEach((l) => push(indent + l))
      } else if (tag === "ul" || tag === "ol") {
        walkList(el, depth)
      } else if (tag === "blockquote") {
        const inner = inlineText(el).trim()
        if (inner) {
          lines.push("")
          inner.split("\n").forEach((l) => push("> " + l.trim()))
          lines.push("")
        }
      } else if (tag === "pre") {
        const text = el.textContent || ""
        lines.push("")
        text.split("\n").forEach((l) => lines.push(l))
        lines.push("")
      } else if (tag === "hr") {
        lines.push("")
        push("-".repeat(40))
        lines.push("")
      } else if (tag === "table") {
        lines.push("")
        Array.from(el.querySelectorAll("tr")).forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll("th,td")).map((td) => inlineText(td).replace(/\s+/g, " ").trim())
          push(cells.join(" | "))
        })
        lines.push("")
      } else if (tag === "br") {
        lines.push("")
      } else {
        walkBlocks(el, depth)
      }
    })
  }

  walkBlocks(doc.body)
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

export function EditorView() {
  const docId = useDocsStore((s) => s.currentDocId) ?? ""
  const goHomeStore = useDocsStore((s) => s.goHome)
  const openDoc = useDocsStore((s) => s.openDoc)
  const patchDocMeta = useDocsStore((s) => s.patchDocMeta)
  const openAiOnEditor = useDocsStore((s) => s.openAiOnEditor)
  const setOpenAiOnEditor = useDocsStore((s) => s.setOpenAiOnEditor)
  const { toast } = useToast()
  const user = useLocalUser()
  const { t, lang } = useI18n()

  /* ---------------- document state ---------------- */
  const [doc, setDoc] = React.useState<DocumentDTO | null>(null)
  const [loadError, setLoadError] = React.useState<"not-found" | "load-failed" | null>(null)
  const [title, setTitle] = React.useState("")
  const [starred, setStarred] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved" | "error">("saved")
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)
  const [stats, setStats] = React.useState({ words: 0, chars: 0, paragraphs: 0, pages: 1, readingMinutes: 1 })
  const [zoom, setZoomState] = React.useState(1)
  const [spellCheck, setSpellCheck] = React.useState(true)
  const [fmt, setFmt] = React.useState<FormatState>(DEFAULT_FORMAT)
  const [tableInfo, setTableInfo] = React.useState<TableInfo | null>(null)
  const [activeTableEl, setActiveTableEl] = React.useState<HTMLTableElement | null>(null)
  const [menuTableInfo, setMenuTableInfo] = React.useState<TableInfo | null>(null)
  const [outlineOpen, setOutlineOpen] = React.useState(false)
  const [outlineItems, setOutlineItems] = React.useState<OutlineItem[]>([])
  const [remoteContent, setRemoteContent] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<string | null>(null)
  const [linkHasSelection, setLinkHasSelection] = React.useState(false)
  const [aiSource, setAiSource] = React.useState<AiSource | null>(null)

  /* ---------------- writing studio / telemetry ---------------- */
  const trackerRef = React.useRef<WritingTracker | null>(null)
  const [writingStats, setWritingStats] = React.useState<Partial<WritingStats> | null>(null)
  const [editCount, setEditCount] = React.useState(0)

  // workspace default zoom (Settings → Workspace defaults) — applied once on mount
  React.useEffect(() => {
    try {
      const z = window.localStorage.getItem("zdocs-default-zoom")
      if (z === "125") setZoomState(1.25)
      else if (z === "150") setZoomState(1.5)
    } catch {
      // storage unavailable — keep 100%
    }
  }, [])

  /* ---------------- find & replace state ---------------- */
  const [findOpen, setFindOpen] = React.useState(false)
  const [findReplaceMode, setFindReplaceMode] = React.useState(false)
  const [findQuery, setFindQuery] = React.useState("")
  const [findCase, setFindCase] = React.useState(false)
  const [findMatches, setFindMatches] = React.useState<TextMatch[]>([])
  const [findActiveIndex, setFindActiveIndex] = React.useState(-1)

  /* ---------------- comments state ---------------- */
  const [comments, setComments] = React.useState<CommentDTO[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [commentsOpen, setCommentsOpen] = React.useState(false)
  const [activeCommentId, setActiveCommentId] = React.useState<string | null>(null)
  const [commentBusy, setCommentBusy] = React.useState(false)
  const [contentTick, setContentTick] = React.useState(0)
  const [bubble, setBubble] = React.useState<{ x: number; y: number } | null>(null)
  const [pendingQuote, setPendingQuoteState] = React.useState<PendingQuote | null>(null)
  const pendingQuoteRef = React.useRef<PendingQuote | null>(null)

  /* ---------------- suggesting mode state ---------------- */
  const [mode, setModeState] = React.useState<"edit" | "suggest">("edit")
  const [suggestions, setSuggestions] = React.useState<SuggestionInfo[]>([])
  const [activeSuggestionId, setActiveSuggestionId] = React.useState<string | null>(null)

  /* ---------------- page margins state (ruler drag) ---------------- */
  const [pageMargins, setPageMarginsState] = React.useState<PageMargins>(DEFAULT_MARGINS)

  /* ---------------- refs ---------------- */
  const pageRef = React.useRef<HTMLDivElement | null>(null)
  const titleInputRef = React.useRef<HTMLInputElement | null>(null)
  const savedRangeRef = React.useRef<Range | null>(null)
  const aiRangeRef = React.useRef<Range | null>(null)
  const contentRef = React.useRef("")
  const latestTitleRef = React.useRef("")
  const dirtyRef = React.useRef(false)
  const lastInputAtRef = React.useRef(0)
  const lastCursorEmitRef = React.useRef(0)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const broadcastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionCounterRef = React.useRef(0)
  const myIdRef = React.useRef<string | null>(null)
  const userRef = React.useRef<SuggestionAuthor | null>(null)
  const modeRef = React.useRef<"edit" | "suggest">("edit")
  const prevSidsRef = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    userRef.current = user ? { id: user.id, name: user.name, color: user.color } : null
    myIdRef.current = user?.id ?? null
  }, [user])
  React.useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // restore the persisted mode (global) — Google remembers your last mode
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("zdocs:mode")
      if (saved === "suggest") setModeState("suggest")
    } catch {
      // private mode etc.
    }
  }, [])

  /* ---------------- load document ---------------- */
  React.useEffect(() => {
    let cancelled = false
    setDoc(null)
    setLoadError(null)
    setSaveStatus("saved")
    setRemoteContent(null)
    fetch(`/api/documents/${docId}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not-found")
        if (!r.ok) throw new Error("load-failed")
        return r.json() as Promise<{ document: DocumentDTO }>
      })
      .then((data) => {
        if (cancelled) return
        const d = data.document
        setDoc(d)
        setTitle(d.title)
        latestTitleRef.current = d.title
        contentRef.current = d.content
        setStarred(d.starred)
        setStats(docStats(d.content))
        setLastSavedAt(new Date(d.updatedAt))
        // writing telemetry from the server blob (if any)
        const rawStats = (d as DocumentDTO & { stats?: unknown; editCount?: number }).stats
        setWritingStats(
          rawStats && typeof rawStats === "object" ? (rawStats as Partial<WritingStats>) : null
        )
        setEditCount(
          typeof (d as DocumentDTO & { editCount?: number }).editCount === "number"
            ? ((d as DocumentDTO & { editCount: number }).editCount)
            : 0
        )
      })
      .catch((e: Error) => {
        if (cancelled) return
        setLoadError(e.message === "not-found" ? "not-found" : "load-failed")
      })
    // restore per-document page margins
    try {
      const raw = window.localStorage.getItem(`zdocs:margins:${docId}`)
      if (raw) {
        const m = JSON.parse(raw) as PageMargins
        if (typeof m?.left === "number" && typeof m?.right === "number") {
          setPageMarginsState({
            left: Math.min(336, Math.max(48, m.left)),
            right: Math.min(336, Math.max(48, m.right)),
          })
        }
      } else {
        setPageMarginsState(DEFAULT_MARGINS)
      }
    } catch {
      setPageMarginsState(DEFAULT_MARGINS)
    }
    // initial suggestion scan (marks persist inside the document HTML)
    requestAnimationFrame(() => {
      if (cancelled) return
      const list = collectSuggestions(pageRef.current)
      setSuggestions(list)
      prevSidsRef.current = new Set(list.map((s) => s.sid))
    })
    return () => {
      cancelled = true
    }
  }, [docId])

  // auto-open the AI writer when requested from the template gallery
  React.useEffect(() => {
    if (openAiOnEditor && doc) {
      setDialog("helpwrite")
      setOpenAiOnEditor(false)
    }
  }, [openAiOnEditor, doc, setOpenAiOnEditor])

  /* ---------------- writing telemetry tracker ----------------
   * One tracker per document: observes beforeinput on the editable page,
   * flushes to /api/documents/:id/stats every 30s + on unmount. */
  React.useEffect(() => {
    if (!docId) return
    const tracker = createWritingTracker(docId)
    trackerRef.current = tracker
    let detach = () => {}
    let cancelled = false
    const attach = () => {
      const el = pageRef.current
      if (el) {
        detach = tracker.observe(el)
        return true
      }
      return false
    }
    // the canvas mounts after doc load — retry until it exists
    const attachTimer = setInterval(() => {
      if (cancelled || attach()) clearInterval(attachTimer)
    }, 400)
    const flushTimer = setInterval(() => {
      void tracker.flush().then(() => {
        const snap = tracker.snapshot()
        if (snap) setWritingStats(snap)
      })
    }, 30_000)
    const onUnload = () => {
      void tracker.flush()
    }
    window.addEventListener("beforeunload", onUnload)
    return () => {
      cancelled = true
      clearInterval(attachTimer)
      clearInterval(flushTimer)
      window.removeEventListener("beforeunload", onUnload)
      detach()
      void tracker.flush()
      trackerRef.current = null
    }
  }, [docId])

  /* ---------------- comments: load & helpers ---------------- */
  React.useEffect(() => {
    if (!docId) return
    let cancelled = false
    setComments([])
    setCommentsLoading(true)
    setActiveCommentId(null)
    fetch(`/api/documents/${docId}/comments`)
      .then((r) => (r.ok ? (r.json() as Promise<{ comments: CommentDTO[] }>) : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) setComments(data.comments ?? [])
      })
      .catch(() => {
        // non-fatal: the sidebar shows an empty state
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [docId])

  const setPendingQuote = React.useCallback((pq: PendingQuote | null) => {
    pendingQuoteRef.current = pq
    setPendingQuoteState(pq)
  }, [])

  const refreshComments = React.useCallback(async () => {
    if (!docId) return
    try {
      const res = await fetch(`/api/documents/${docId}/comments`)
      if (!res.ok) return
      const data = (await res.json()) as { comments: CommentDTO[] }
      setComments(data.comments ?? [])
    } catch {
      // ignore — next mutation will retry
    }
  }, [docId])

  /* ---------------- collaboration ---------------- */
  const onDocChange = React.useCallback((p: DocChangePayload) => {
    if (myIdRef.current && p.by === myIdRef.current) return
    // last-write-wins: skip remote updates while actively typing
    if (Date.now() - lastInputAtRef.current < 1600) return
    if (p.content != null) {
      if (p.content !== contentRef.current) {
        contentRef.current = p.content
        setRemoteContent(p.content)
        setStats(docStats(p.content))
      }
      setSaveStatus("saved")
      setLastSavedAt(new Date())
    }
    if (p.title != null && document.activeElement !== titleInputRef.current && p.title !== latestTitleRef.current) {
      latestTitleRef.current = p.title
      setTitle(p.title)
    }
  }, [])

  const onCommentsChanged = React.useCallback(
    (p: CommentsChangedPayload) => {
      void refreshComments()
      if (p.action === "add" || p.action === "reply") {
        const lang = getCurrentLang()
        toast({ title: tForLang(lang, "New comment activity"), description: tForLang(lang, "A collaborator updated the discussion.") })
      }
    },
    [refreshComments, toast]
  )

  // guests run fully locally — no realtime collaboration socket at all
  const guestMode = useDocsStore((s) => s.guestMode)
  const { connected, myId, presence, remoteCursors, emitDocChange, emitCursor, emitCommentsChanged } = useCollab(
    docId || null,
    guestMode ? null : user,
    onDocChange,
    onCommentsChanged
  )
  React.useEffect(() => {
    myIdRef.current = myId
  }, [myId])

  /* ---------------- autosave ---------------- */
  const performSave = React.useCallback(
    async (manual = false) => {
      if (!docId) return
      const content = contentRef.current
      const t = latestTitleRef.current
      setSaveStatus("saving")
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, title: t }),
        })
        if (!res.ok) throw new Error("save failed")
        const data = (await res.json()) as { document: DocumentDTO }
        dirtyRef.current = false
        setSaveStatus("saved")
        setLastSavedAt(new Date())
        patchDocMeta(docId, {
          title: t,
          snippet: getSnippet(content),
          wordCount: countWords(htmlToText(content)),
          updatedAt: data.document.updatedAt,
        })
        if (manual) toast({ title: tForLang(getCurrentLang(), "Saved"), description: tForLang(getCurrentLang(), "All changes are safe.") })
      } catch {
        setSaveStatus("error")
        // retry shortly
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => void performSave(), 5000)
      }
    },
    [docId, patchDocMeta, toast]
  )

  const scheduleSave = React.useCallback(() => {
    dirtyRef.current = true
    setSaveStatus("unsaved")
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => void performSave(), 900)
  }, [performSave])

  // flush unsaved changes when leaving the doc
  React.useEffect(() => {
    const id = docId
    return () => {
      if (!dirtyRef.current || !id) return
      try {
        fetch(`/api/documents/${id}`, {
          method: "PATCH",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: contentRef.current, title: latestTitleRef.current }),
        }).catch(() => {})
      } catch {
        // ignore
      }
    }
  }, [docId])

  // warn before leaving with unsaved changes
  React.useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", onBefore)
    return () => window.removeEventListener("beforeunload", onBefore)
  }, [])

  /* ---------------- content input pipeline ---------------- */
  const scheduleStats = React.useCallback(() => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(() => {
      setStats(docStats(contentRef.current))
      // bump so the comment highlight overlays re-align after local edits
      setContentTick((t) => t + 1)
      // re-derive suggestion cards from the document marks
      setSuggestions(collectSuggestions(pageRef.current))
    }, 400)
  }, [])

  const scheduleBroadcast = React.useCallback(() => {
    if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current)
    broadcastTimerRef.current = setTimeout(() => {
      versionCounterRef.current += 1
      emitDocChange(contentRef.current, latestTitleRef.current, versionCounterRef.current)
    }, 300)
  }, [emitDocChange])

  const handleInput = React.useCallback(() => {
    const el = pageRef.current
    if (!el) return
    contentRef.current = el.innerHTML
    lastInputAtRef.current = Date.now()
    scheduleSave()
    scheduleBroadcast()
    scheduleStats()
  }, [scheduleSave, scheduleBroadcast, scheduleStats])

  /* ---------------- suggesting mode ---------------- */
  /** Intercept raw edits while in Suggesting mode and convert them into
   *  marked suggestion spans. Everything flows through execCommand so each
   *  edit is ONE undo step, just like normal typing. */
  React.useEffect(() => {
    const el = pageRef.current
    if (!el || mode !== "suggest" || !doc) return

    const onBeforeInput = (e: Event) => {
      const input = e as InputEvent
      const author = userRef.current
      if (!author) return
      switch (input.inputType) {
        case "insertText": {
          const data = input.data
          if (!data) return
          // typing at the end of your own insertion extends it naturally —
          // let the default insertText happen (it stays inside the mark)
          const span = caretSugSpan(el)
          if (span && span.classList.contains("sug-ins") && span.dataset.ai === author.id) return
          input.preventDefault()
          if (suggestInsertText(el, data, author)) handleInput()
          break
        }
        case "insertParagraph": {
          input.preventDefault()
          if (suggestInsertParagraph(el, author)) handleInput()
          break
        }
        case "insertFromPaste": {
          input.preventDefault()
          const text = input.dataTransfer?.getData("text/plain") ?? ""
          if (text && suggestInsertText(el, text.slice(0, 5000), author)) handleInput()
          break
        }
        case "deleteContentBackward":
        case "deleteContentForward": {
          const dir = input.inputType === "deleteContentBackward" ? "backward" : "forward"
          // backspace inside your own deletion mark shortens it — default ok
          const span = caretSugSpan(el)
          const sel = window.getSelection()
          if (
            sel &&
            sel.isCollapsed &&
            span &&
            span.classList.contains("sug-del") &&
            span.dataset.ai === author.id
          ) {
            return
          }
          if (!sel || !sel.rangeCount) return
          // selection delete → wrap the whole selection as a deletion mark
          if (!sel.isCollapsed) {
            const range = sel.getRangeAt(0)
            if (el.contains(range.commonAncestorContainer)) {
              input.preventDefault()
              // direct-DOM mutation: no input event fires, so drive the
              // autosave pipeline manually
              if (suggestDeleteSelection(range, author)) handleInput()
            }
            return
          }
          // collapsed delete → mark the single unit the browser would remove
          const unit = deletionUnitRange(el, dir)
          if (unit && el.contains(unit.startContainer)) {
            input.preventDefault()
            if (suggestDeleteSelection(unit, author)) handleInput()
          }
          // no unit → structural delete (paragraph merge etc.): default
          break
        }
        default:
          // insertCompositionText, format changes, word deletes, … → default
          break
      }
    }

    el.addEventListener("beforeinput", onBeforeInput)
    return () => el.removeEventListener("beforeinput", onBeforeInput)
  }, [mode, doc, handleInput])

  /** Apply a suggestion: mark → plain content, then persist. */
  const acceptSuggestion = React.useCallback(
    (sid: string) => {
      const el = pageRef.current
      if (!el) return
      if (acceptSuggestionMark(el, sid)) {
        handleInput()
        setSuggestions(collectSuggestions(el))
        if (activeSuggestionId === sid) {
          setActiveSuggestionId(null)
          clearSuggestionFocus(el)
        }
      }
    },
    [handleInput, activeSuggestionId]
  )

  /** Revert a suggestion: mark disappears, the original text stays/returns. */
  const rejectSuggestion = React.useCallback(
    (sid: string) => {
      const el = pageRef.current
      if (!el) return
      if (rejectSuggestionMark(el, sid)) {
        handleInput()
        setSuggestions(collectSuggestions(el))
        if (activeSuggestionId === sid) {
          setActiveSuggestionId(null)
          clearSuggestionFocus(el)
        }
      }
    },
    [handleInput, activeSuggestionId]
  )

  /** Scroll a suggestion mark into view + highlight it. */
  const focusSuggestion = React.useCallback((sid: string) => {
    setActiveSuggestionId(sid)
    focusSuggestionMark(pageRef.current, sid)
  }, [])

  const setMode = React.useCallback(
    (m: "edit" | "suggest") => {
      setModeState(m)
      try {
        window.localStorage.setItem("zdocs:mode", m)
      } catch {
        // ignore
      }
      if (m === "suggest") {
        const el = pageRef.current
        if (el && collectSuggestions(el).length > 0) setCommentsOpen(true)
        const lang = getCurrentLang()
        toast({
          title: tForLang(lang, "You're in suggesting mode"),
          description: tForLang(lang, "Edits you make show as suggestions others can accept or reject."),
        })
      }
    },
    [toast]
  )

  /** Dragging the ruler handles: persist per document. */
  const setPageMargins = React.useCallback(
    (m: PageMargins) => {
      setPageMarginsState(m)
      try {
        window.localStorage.setItem(`zdocs:margins:${docId}`, JSON.stringify(m))
      } catch {
        // ignore
      }
    },
    [docId]
  )

  // Google Docs behavior: the review rail pops open when a NEW suggestion
  // appears while you're in suggesting mode.
  React.useEffect(() => {
    if (mode !== "suggest") {
      prevSidsRef.current = new Set(suggestions.map((s) => s.sid))
      return
    }
    const hasNew = suggestions.some((s) => !prevSidsRef.current.has(s.sid))
    if (hasNew && suggestions.length > 0 && !commentsOpen) setCommentsOpen(true)
    prevSidsRef.current = new Set(suggestions.map((s) => s.sid))
  }, [suggestions, mode, commentsOpen])

  // remote content applied → re-derive suggestion cards (other users'
  // suggestions arrive inside the broadcast HTML)
  React.useEffect(() => {
    if (remoteContent != null) return
    const t = setTimeout(() => {
      setSuggestions(collectSuggestions(pageRef.current))
    }, 80)
    return () => clearTimeout(t)
  }, [remoteContent, contentTick, doc])

  /* ---------------- format state ---------------- */
  const refreshFmt = React.useCallback(() => {
    const q = (c: string) => {
      try {
        return document.queryCommandState(c)
      } catch {
        return false
      }
    }
    let block = "p"
    try {
      block = (document.queryCommandValue("formatBlock") || "p").toLowerCase()
    } catch {
      // ignore
    }
    const sel = window.getSelection()
    const node = sel?.anchorNode
    const elem =
      node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null)
    const computed = elem ? window.getComputedStyle(elem) : null
    const fontName = (computed?.fontFamily ?? "Arial").split(",")[0].replace(/["']/g, "").trim()
    const fontSizePt = computed ? Math.max(6, Math.round(parseFloat(computed.fontSize) / 1.3333)) : 11

    setFmt({
      bold: q("bold"),
      italic: q("italic"),
      underline: q("underline"),
      strike: q("strikeThrough"),
      superscript: q("superscript"),
      subscript: q("subscript"),
      ul: q("insertUnorderedList"),
      ol: q("insertOrderedList"),
      block,
      align: q("justifyCenter")
        ? "center"
        : q("justifyRight")
          ? "right"
          : q("justifyFull")
            ? "full"
            : "left",
      fontName,
      fontSize: fontSizePt,
      link: !!elem?.closest("a"),
    })
  }, [])

  React.useEffect(() => {
    const onSel = () => {
      const el = pageRef.current
      if (!el) return
      const sel = window.getSelection()
      if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return
      if (sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange()
      refreshFmt()
      setTableInfo(describeTableAt(el))
      const ctx = getTableContext(el)
      setActiveTableEl(ctx ? ctx.table : null)
      const now = Date.now()
      if (now - lastCursorEmitRef.current > 140) {
        lastCursorEmitRef.current = now
        const off = selectionOffsets(el)
        if (off) emitCursor(off.start, off.end)
      }

      // comment bubble: show above a non-collapsed selection with text
      const inside = sel.rangeCount > 0 && el.contains(sel.focusNode)
      if (inside && !sel.isCollapsed && !pendingQuoteRef.current) {
        const text = sel.toString().replace(/\s+/g, " ").trim()
        if (text) {
          const rect = sel.getRangeAt(0).getBoundingClientRect()
          setBubble({ x: rect.left + rect.width / 2, y: rect.top - 38 })
        } else {
          setBubble(null)
        }
      } else {
        setBubble(null)
      }
    }
    document.addEventListener("selectionchange", onSel)
    return () => document.removeEventListener("selectionchange", onSel)
  }, [refreshFmt, emitCursor])

  // hide the comment bubble whenever any scroll happens (position would drift)
  React.useEffect(() => {
    const onScroll = () => setBubble(null)
    window.addEventListener("scroll", onScroll, true)
    return () => window.removeEventListener("scroll", onScroll, true)
  }, [])

  /* ---------------- editing commands ---------------- */
  /** Focus the editor and make sure the last valid selection is active — so
   *  toolbar clicks (which blur the editor) never lose the user's selection. */
  const ensureSelection = React.useCallback(() => {
    const el = pageRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    const inside = !!sel && sel.rangeCount > 0 && !!sel.anchorNode && el.contains(sel.anchorNode)
    if (!inside && savedRangeRef.current) {
      try {
        sel?.removeAllRanges()
        sel?.addRange(savedRangeRef.current.cloneRange())
      } catch {
        // saved range no longer valid
      }
    }
  }, [])

  const exec = React.useCallback(
    (cmd: string, val?: string) => {
      const el = pageRef.current
      if (!el) return
      ensureSelection()
      try {
        document.execCommand(cmd, false, val)
      } catch {
        // command unsupported — ignore
      }
      handleInput()
      refreshFmt()
    },
    [handleInput, refreshFmt, ensureSelection]
  )

  const applyFontSize = React.useCallback(
    (pt: number) => {
      const el = pageRef.current
      if (!el) return
      ensureSelection()
      document.execCommand("fontSize", false, "7")
      el.querySelectorAll('font[size="7"]').forEach((f) => {
        const span = document.createElement("span")
        span.style.fontSize = `${pt}pt`
        span.innerHTML = f.innerHTML
        f.replaceWith(span)
      })
      handleInput()
      refreshFmt()
    },
    [handleInput, refreshFmt]
  )

  const applyLineSpacing = React.useCallback(
    (lh: number) => {
      const el = pageRef.current
      if (!el) return
      el.focus()
      const blocks = selectedBlocks(el)
      blocks.forEach((b) => {
        b.style.lineHeight = String(lh)
      })
      handleInput()
    },
    [handleInput]
  )

  const applyAlignment = React.useCallback(
    (a: "left" | "center" | "right" | "full") => {
      const cmd =
        a === "center" ? "justifyCenter" : a === "right" ? "justifyRight" : a === "full" ? "justifyFull" : "justifyLeft"
      exec(cmd)
    },
    [exec]
  )

  const clearFormatting = React.useCallback(() => {
    exec("removeFormat")
    exec("formatBlock", "p")
  }, [exec])

  const focusEditor = React.useCallback(() => {
    const el = pageRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const onTitleChange = React.useCallback(
    (t: string) => {
      setTitle(t)
      latestTitleRef.current = t
      scheduleSave()
      scheduleBroadcast()
    },
    [scheduleSave, scheduleBroadcast]
  )

  /* ---------------- insert helpers ---------------- */
  const insertLink = React.useCallback(
    (url: string, text: string) => {
      const el = pageRef.current
      if (!el) return
      ensureSelection()
      const sel = window.getSelection()
      const collapsed = !sel || sel.isCollapsed || !el.contains(sel.anchorNode)
      if (collapsed) {
        const safeUrl = url.replace(/"/g, "%22")
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${safeUrl}">${escapeHtml(text || url)}</a>`
        )
      } else {
        document.execCommand("createLink", false, url)
      }
      handleInput()
      refreshFmt()
    },
    [handleInput, refreshFmt, ensureSelection]
  )

  const insertImage = React.useCallback(
    (src: string, alt: string) => {
      const el = pageRef.current
      if (!el) return
      ensureSelection()
      const safeSrc = src.replace(/"/g, "%22")
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${safeSrc}" alt="${escapeHtml(alt)}" style="max-width:100%">`
      )
      handleInput()
    },
    [handleInput]
  )

  const insertHtmlAtCursor = React.useCallback(
    (html: string) => {
      const el = pageRef.current
      if (!el) return
      ensureSelection()
      document.execCommand("insertHTML", false, html)
      handleInput()
    },
    [handleInput, ensureSelection]
  )

  /* ---------------- insert table ---------------- */
  const insertTable = React.useCallback(
    (rows: number, cols: number) => {
      const r = Math.min(20, Math.max(1, Math.floor(rows)))
      const c = Math.min(10, Math.max(1, Math.floor(cols)))
      let html = '<table class="zdocs-table"><tbody>'
      for (let i = 0; i < r; i++) {
        html += "<tr>"
        for (let j = 0; j < c; j++) html += "<td>&nbsp;</td>"
        html += "</tr>"
      }
      html += "</tbody></table><p><br></p>"
      insertHtmlAtCursor(html)
      toast({ title: tForLang(getCurrentLang(), "Inserted {r}×{c} table", { r, c }) })
    },
    [insertHtmlAtCursor, toast]
  )

  /* ---------------- table structural operations ---------------- */
  const tableOp = React.useCallback(
    (op: TableOp) => {
      if (op === "insert") {
        setDialog("table")
        return
      }
      const el = pageRef.current
      if (!el) return
      const ctx = getTableContext(el)
      if (!ctx) return
      switch (op) {
        case "row-above":
        case "row-below": {
          const tr = insertTableRow(ctx, op === "row-above" ? "above" : "below")
          placeCaretInCell(tr.cells[0])
          toast({ title: tForLang(getCurrentLang(), "Row inserted") })
          break
        }
        case "col-left":
        case "col-right": {
          const cells = insertTableColumn(ctx, op === "col-left" ? "left" : "right")
          const target = cells[Math.min(ctx.rowIndex, cells.length - 1)]
          if (target) placeCaretInCell(target)
          toast({ title: tForLang(getCurrentLang(), "Column inserted") })
          break
        }
        case "delete-row": {
          const removedTable = !deleteTableRow(ctx)
          if (!removedTable) {
            const nextRow = ctx.table.rows[Math.min(ctx.rowIndex, ctx.table.rows.length - 1)]
            if (nextRow?.cells[0]) placeCaretInCell(nextRow.cells[0])
          }
          toast({ title: tForLang(getCurrentLang(), removedTable ? "Last row removed, table deleted" : "Row deleted") })
          break
        }
        case "delete-col": {
          const removedTable = !deleteTableColumn(ctx)
          if (!removedTable) {
            const row = ctx.table.rows[ctx.rowIndex]
            const cell = row?.cells[Math.min(ctx.colIndex, row.cells.length - 1)]
            if (cell) placeCaretInCell(cell)
          }
          toast({ title: tForLang(getCurrentLang(), removedTable ? "Last column removed, table deleted" : "Column deleted") })
          break
        }
        case "delete-table": {
          const next = ctx.table.nextElementSibling as HTMLElement | null
          const prev = ctx.table.previousElementSibling as HTMLElement | null
          deleteTableEl(ctx)
          // park the caret in a nearby block so typing keeps working
          const park = next?.querySelector("p, td, th") ?? prev?.querySelector("p, td, th")
          if (park) placeCaretInCell(park as HTMLElement)
          toast({ title: tForLang(getCurrentLang(), "Table deleted") })
          break
        }
        case "toggle-header": {
          const nowHeader = toggleTableHeader(ctx)
          placeCaretInCell(ctx.cell)
          toast({ title: tForLang(getCurrentLang(), nowHeader ? "Header row on" : "Header row off") })
          break
        }
        case "merge-right":
        case "merge-down": {
          const ok = mergeTableCells(ctx, op === "merge-right" ? "right" : "down")
          toast({ title: tForLang(getCurrentLang(), ok ? "Cells merged" : "Cells can’t be merged that way") })
          break
        }
        case "split-cell": {
          const ok = splitTableCell(ctx)
          toast({ title: tForLang(getCurrentLang(), ok ? "Cell split" : "This cell isn’t merged") })
          break
        }
      }
      ensureParagraph(el)
      handleInput()
      refreshFmt()
      setTableInfo(describeTableAt(el))
      setActiveTableEl(getTableContext(el)?.table ?? null)
    },
    [handleInput, refreshFmt, toast]
  )

  /* ---------------- comments: actions ---------------- */
  const submitComment = React.useCallback(
    async (text: string) => {
      const pq = pendingQuoteRef.current
      if (!docId || !user || !pq) return
      setCommentBusy(true)
      try {
        const res = await fetch(`/api/documents/${docId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            quote: pq.quote,
            anchorOffset: pq.offset,
            authorId: user.id,
            authorName: user.name,
            authorColor: user.color,
          }),
        })
        if (!res.ok) throw new Error("failed")
        const data = (await res.json()) as { comment: CommentDTO }
        setComments((prev) => [...prev, { ...data.comment, replies: data.comment.replies ?? [] }])
        setActiveCommentId(data.comment.id)
        setPendingQuote(null)
        emitCommentsChanged("add", data.comment.id)
        toast({ title: tForLang(getCurrentLang(), "Comment added") })
      } catch {
        toast({ title: tForLang(getCurrentLang(), "Couldn’t add the comment"), variant: "destructive" })
      } finally {
        setCommentBusy(false)
      }
    },
    [docId, user, setPendingQuote, emitCommentsChanged, toast]
  )

  const submitReply = React.useCallback(
    async (parentId: string, text: string) => {
      if (!docId || !user) return
      setCommentBusy(true)
      try {
        const res = await fetch(`/api/documents/${docId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            parentId,
            authorId: user.id,
            authorName: user.name,
            authorColor: user.color,
          }),
        })
        if (!res.ok) throw new Error("failed")
        const data = (await res.json()) as { comment: CommentDTO }
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId ? { ...c, replies: [...(c.replies ?? []), data.comment] } : c
          )
        )
        emitCommentsChanged("reply", data.comment.id)
      } catch {
        toast({ title: tForLang(getCurrentLang(), "Couldn’t post the reply"), variant: "destructive" })
      } finally {
        setCommentBusy(false)
      }
    },
    [docId, user, emitCommentsChanged, toast]
  )

  const toggleResolveComment = React.useCallback(
    async (c: CommentDTO) => {
      setCommentBusy(true)
      try {
        const res = await fetch(`/api/comments/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved: !c.resolved }),
        })
        if (!res.ok) throw new Error("failed")
        setComments((prev) =>
          prev.map((t) => (t.id === c.id ? { ...t, resolved: !c.resolved } : t))
        )
        emitCommentsChanged(c.resolved ? "unresolve" : "resolve", c.id)
      } catch {
        toast({ title: tForLang(getCurrentLang(), "Couldn’t update the comment"), variant: "destructive" })
      } finally {
        setCommentBusy(false)
      }
    },
    [emitCommentsChanged, toast]
  )

  /** Toggle an emoji reaction on a comment or reply (optimistic, no busy
   *  spinner so quick multi-reactions stay snappy). */
  const toggleReaction = React.useCallback(
    async (commentId: string, emoji: string) => {
      if (!user) return
      // optimistic toggle on a deep-copied list
      const apply = (list: CommentDTO[]): CommentDTO[] =>
        list.map((c) => {
          if (c.id === commentId) {
            const mine = (c.reactions ?? []).some((rx) => rx.userId === user.id && rx.emoji === emoji)
            const next = mine
              ? (c.reactions ?? []).filter((rx) => !(rx.userId === user.id && rx.emoji === emoji))
              : [
                  ...(c.reactions ?? []),
                  { id: `optimistic-${emoji}`, commentId, userId: user.id, userName: user.name, emoji },
                ]
            return { ...c, reactions: next }
          }
          const replies = c.replies ? apply(c.replies) : c.replies
          if (replies !== c.replies) return { ...c, replies }
          return c
        })
      setComments((prev) => apply(prev))
      try {
        const res = await fetch(`/api/comments/${commentId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji, userId: user.id, userName: user.name }),
        })
        if (!res.ok) throw new Error("failed")
        emitCommentsChanged("react", commentId)
      } catch {
        toast({ title: tForLang(getCurrentLang(), "Couldn’t save the reaction"), variant: "destructive" })
        void refreshComments()
      }
    },
    [user, emitCommentsChanged, toast, refreshComments]
  )

  const editComment = React.useCallback(
    async (id: string, content: string) => {
      setCommentBusy(true)
      try {
        const res = await fetch(`/api/comments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        if (!res.ok) throw new Error("failed")
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === id) return { ...c, content }
            const replies = c.replies?.map((r) => (r.id === id ? { ...r, content } : r))
            if (replies && replies !== c.replies) return { ...c, replies }
            return c
          })
        )
        emitCommentsChanged("edit", id)
        toast({ title: tForLang(getCurrentLang(), "Comment updated") })
      } catch {
        toast({ title: tForLang(getCurrentLang(), "Couldn’t update the comment"), variant: "destructive" })
      } finally {
        setCommentBusy(false)
      }
    },
    [emitCommentsChanged, toast]
  )

  const deleteComment = React.useCallback(
    async (c: CommentDTO) => {
      setCommentBusy(true)
      try {
        const res = await fetch(`/api/comments/${c.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("failed")
        setComments((prev) => prev.filter((t) => t.id !== c.id))
        if (activeCommentId === c.id) setActiveCommentId(null)
        emitCommentsChanged("delete", c.id)
        toast({ title: tForLang(getCurrentLang(), "Comment deleted") })
      } catch {
        toast({ title: tForLang(getCurrentLang(), "Couldn’t delete the comment"), variant: "destructive" })
      } finally {
        setCommentBusy(false)
      }
    },
    [activeCommentId, emitCommentsChanged, toast]
  )

  /** Scroll the quoted text of a comment into view and flash its highlight. */
  const focusComment = React.useCallback(
    (c: CommentDTO) => {
      setActiveCommentId(c.id)
      if (c.quote) {
        const el = pageRef.current
        if (el) {
          const found = findQuoteRange(el, c.quote, c.anchorOffset)
          if (found) {
            const canvas = el.closest(".doc-canvas-bg") as HTMLElement | null
            const rect = found.range.getBoundingClientRect()
            if (canvas) {
              const canvasRect = canvas.getBoundingClientRect()
              const target =
                canvas.scrollTop + (rect.top - canvasRect.top) / zoom - canvasRect.height / 3 / zoom
              canvas.scrollTo({ top: Math.max(0, target), behavior: "smooth" })
            }
          }
        }
      }
      window.setTimeout(() => {
        setActiveCommentId((cur) => (cur === c.id ? null : cur))
      }, 5000)
    },
    [zoom]
  )

  const toggleComments = React.useCallback(
    (open?: boolean) => {
      setCommentsOpen((prev) => {
        const next = open ?? !prev
        if (!next) setPendingQuote(null)
        return next
      })
    },
    [setPendingQuote]
  )

  /** Capture the current selection as a quote and open the comment composer. */
  const openCommentComposer = React.useCallback(() => {
    const el = pageRef.current
    const sel = window.getSelection()
    const hasSelection =
      !!el && !!sel && sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode)
    if (hasSelection && el) {
      const off = selectionOffsets(el)
      const quote = (sel?.toString() ?? "").replace(/\s+/g, " ").trim().slice(0, 400)
      setPendingQuote({ quote, offset: off?.start ?? 0 })
    } else {
      setPendingQuote({ quote: "", offset: 0 })
    }
    setCommentsOpen(true)
    setBubble(null)
  }, [setPendingQuote])

  const replaceDocumentHtml = React.useCallback(
    (html: string) => {
      const el = pageRef.current
      if (!el) return
      el.innerHTML = html
      handleInput()
    },
    [handleInput]
  )

  /* ---------------- AI quick actions (polish) ---------------- */
  /** Plain text → paragraph HTML (blank-line paragraphs, single newlines as <br>). */
  const plainTextToHtml = React.useCallback((text: string): string => {
    const paras = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (paras.length === 0) return ""
    return paras
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("")
  }, [])

  /** Replace the captured selection (or the whole document) with AI output.
   *  Runs AFTER the dialog closes (240ms delay in the dialog), so execCommand
   *  is usable — the edit lands on the browser undo stack (⌘Z works). Falls
   *  back to direct Range manipulation if execCommand is unavailable. */
  const replaceAiResult = React.useCallback(
    (text: string) => {
      const el = pageRef.current
      if (!el) return
      const html = plainTextToHtml(text)
      if (!html) {
        toast({ title: tForLang(getCurrentLang(), "Nothing to apply"), description: tForLang(getCurrentLang(), "The AI result is empty.") })
        return
      }
      const range = aiRangeRef.current
      if (aiSource?.isSelection && range && el.contains(range.startContainer)) {
        el.focus()
        const sel = window.getSelection()
        let applied = false
        try {
          sel?.removeAllRanges()
          sel?.addRange(range.cloneRange())
          applied = document.execCommand("insertHTML", false, html)
        } catch {
          applied = false
        }
        if (!applied) {
          // fallback: direct Range surgery (NOT undoable, but always works)
          try {
            range.deleteContents()
            const frag = range.createContextualFragment(html)
            range.insertNode(frag)
          } catch {
            el.insertAdjacentHTML("beforeend", html)
          }
        }
        const after = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
        if (after) savedRangeRef.current = after
        handleInput()
        toast({ title: tForLang(getCurrentLang(), "Selection updated"), description: tForLang(getCurrentLang(), "AI result applied to the selected text.") })
      } else {
        replaceDocumentHtml(html)
        toast({ title: tForLang(getCurrentLang(), "Document updated"), description: tForLang(getCurrentLang(), "AI result replaced the document.") })
      }
    },
    [aiSource, plainTextToHtml, handleInput, replaceDocumentHtml, toast]
  )

  /** Insert AI output as new paragraphs at the caret. */
  const insertAiResult = React.useCallback(
    (text: string) => {
      const html = plainTextToHtml(text)
      if (html) insertHtmlAtCursor(html)
    },
    [plainTextToHtml, insertHtmlAtCursor]
  )

  /* ---------------- find & replace engine ---------------- */

  /** Re-run the search against the live DOM. Keeps the active match pointed
   *  at the same content position (by global offset) when possible.
   *  Returns the fresh matches + the index runFind selected. */
  const runFind = React.useCallback(
    (query: string, caseSensitive: boolean, keepOffset?: number | null): { matches: TextMatch[]; idx: number } => {
      const el = pageRef.current
      if (!el || !query) {
        setFindMatches([])
        setFindActiveIndex(-1)
        return { matches: [], idx: -1 }
      }
      const matches = findTextMatches(el, query, caseSensitive)
      let idx = 0
      if (keepOffset != null && matches.length > 0) {
        idx = matches.findIndex((m) => m.start >= keepOffset)
        if (idx === -1) idx = 0 // wrapped past the end — restart from the top
      }
      setFindMatches(matches)
      setFindActiveIndex(matches.length > 0 ? idx : -1)
      return { matches, idx: matches.length > 0 ? idx : -1 }
    },
    []
  )

  /** Debounced re-run whenever the query / case flag changes. */
  React.useEffect(() => {
    if (!findOpen) return
    const t = setTimeout(() => runFind(findQuery, findCase), 130)
    return () => clearTimeout(t)
  }, [findOpen, findQuery, findCase, runFind])

  /** Re-run after local edits so highlights stay glued to the text. */
  React.useEffect(() => {
    if (!findOpen || !findQuery) return
    const keep = findActiveIndex >= 0 ? findMatches[findActiveIndex]?.start ?? null : null
    runFind(findQuery, findCase, keep)
  }, [contentTick, remoteContent])

  /** Select a match range in the document WITHOUT losing the panel's focus.
   *  Chrome moves DOM focus to a contentEditable when a range inside it is
   *  added to the selection — for a user typing in the find field that would
   *  divert subsequent keystrokes into the document (overwriting the selected
   *  match). Capture the focused element first and hand focus back after. */
  const selectMatchKeepFocus = React.useCallback((m: TextMatch) => {
    const el = pageRef.current
    if (!el) return
    const prior = document.activeElement
    try {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(m.range.cloneRange())
      scrollRangeIntoCanvasView(el, m.range)
    } catch {
      // range detached — ignore
    }
    if (prior instanceof HTMLElement && prior !== el && !el.contains(prior)) {
      prior.focus()
    }
  }, [])

  /** Jump to a match: highlight, select it in the document, scroll into view. */
  const goToMatch = React.useCallback(
    (index: number) => {
      const m = findMatches[index]
      if (!m) return
      setFindActiveIndex(index)
      selectMatchKeepFocus(m)
    },
    [findMatches, selectMatchKeepFocus]
  )

  const findNext = React.useCallback(() => {
    if (findMatches.length === 0) return
    goToMatch((findActiveIndex + 1) % findMatches.length)
  }, [findMatches, findActiveIndex, goToMatch])

  const findPrev = React.useCallback(() => {
    if (findMatches.length === 0) return
    goToMatch((findActiveIndex - 1 + findMatches.length) % findMatches.length)
  }, [findMatches, findActiveIndex, goToMatch])

  /**
   * Highlight + scroll to a text snippet in the live document (used by the
   * writing studio: sentence rhythm, paragraph density, echo, POV…).
   */
  const highlightText = React.useCallback(
    (text: string) => {
      const el = pageRef.current
      if (!el || !text) return
      const matches = findTextMatches(el, text, false)
      if (matches.length === 0) return
      setFindMatches(matches)
      setFindActiveIndex(0)
      scrollRangeIntoCanvasView(el, matches[0].range)
    },
    []
  )

  /** Auto-select the first match whenever a fresh search produces results. */
  React.useEffect(() => {
    if (findOpen && findMatches.length > 0 && findActiveIndex === 0) {
      const m = findMatches[0]
      if (m) selectMatchKeepFocus(m)
    }
  }, [findMatches])

  const openFindPanel = React.useCallback(
    (withReplace: boolean) => {
      setFindOpen(true)
      setFindReplaceMode(withReplace)
      // seed the query with the current selection when it is short & plain
      const el = pageRef.current
      const sel = window.getSelection()
      if (el && sel && !sel.isCollapsed && el.contains(sel.anchorNode)) {
        const text = sel.toString()
        if (text && text.length <= 60 && !text.includes("\n")) {
          setFindQuery(text)
          runFind(text, findCase)
        }
      }
    },
    [findCase, runFind]
  )

  const closeFindPanel = React.useCallback(() => {
    setFindOpen(false)
    setFindMatches([])
    setFindActiveIndex(-1)
    window.getSelection()?.removeAllRanges()
  }, [])

  /** Replace the currently active match. Uses execCommand("insertText")
   *  with the match selected so the change lands in the browser's undo
   *  stack and inherits the surrounding formatting. */
  const replaceCurrent = React.useCallback(
    (replacement: string) => {
      const m = findMatches[findActiveIndex]
      const el = pageRef.current
      if (!m || !el) return
      try {
        el.focus()
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(m.range.cloneRange())
        document.execCommand("insertText", false, replacement)
      } catch {
        return
      }
      // re-run the search starting just after this replacement
      const keep = m.start + replacement.length
      const { matches: next, idx } = runFind(findQuery, findCase, keep)
      if (idx >= 0 && next[idx]) {
        selectMatchKeepFocus(next[idx])
      } else {
        toast({ title: tForLang(getCurrentLang(), "No more matches") })
      }
    },
    [findMatches, findActiveIndex, findQuery, findCase, runFind, selectMatchKeepFocus, toast]
  )

  /** Replace every match in ONE undoable transaction (Google Docs parity).
   *  The replacements are computed on a detached clone of the page (so the
   *  live match ranges stay valid while we walk them), then applied to the
   *  live document with a single select-all + insertHTML execCommand —
   *  Chromium records that as exactly one undo step, preserving all rich
   *  formatting, comment marks and table colgroups. */
  const replaceAllMatches = React.useCallback(
    (replacement: string) => {
      const el = pageRef.current
      if (!el || !findQuery || findMatches.length === 0) return 0
      // 1) compute the post-replacement content on a detached clone
      const clone = el.cloneNode(true) as HTMLElement
      let count = 0
      for (let i = findMatches.length - 1; i >= 0; i--) {
        const m = findMatches[i]
        const r = mapRangeToClone(el, clone, m.range)
        if (!r) continue
        // guard against drift: the cloned range must still cover the query
        const covered = r.toString()
        if (findCase ? covered !== findQuery : covered.toLowerCase() !== findQuery.toLowerCase()) continue
        try {
          r.deleteContents()
          r.insertNode(document.createTextNode(replacement))
          count++
        } catch {
          // skip this one — the final re-scan reports the true state
        }
      }
      if (count === 0) {
        runFind(findQuery, findCase)
        return 0
      }
      const newHtml = clone.innerHTML
      // 2) apply as a single undoable edit
      el.focus()
      const sel = window.getSelection()
      let applied = false
      try {
        sel?.removeAllRanges()
        const all = document.createRange()
        all.selectNodeContents(el)
        sel?.addRange(all)
        applied = document.execCommand("insertHTML", false, newHtml)
      } catch {
        applied = false
      }
      if (!applied) {
        // fallback: direct DOM write + synthetic input event (not undoable,
        // but the autosave + version history still capture the change)
        el.innerHTML = newHtml
      }
      handleInput()
      toast({ title: count === 1
        ? tForLang(getCurrentLang(), "Replaced 1 match")
        : tForLang(getCurrentLang(), "Replaced {n} matches", { n: count }) })
      runFind(findQuery, findCase)
      return count
    },
    [findQuery, findCase, findMatches, runFind, handleInput, toast]
  )

  /* ---------------- voice typing ---------------- */
  /** Insert a finalized dictation chunk at the caret. Goes through
   *  execCommand so each spoken chunk lands on the undo stack and inherits
   *  the surrounding formatting, exactly like typed text. */
  const insertSpokenText = React.useCallback(
    (text: string) => {
      const el = pageRef.current
      if (!el) return
      const sel = window.getSelection()
      const caretInDoc = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)
      if (!caretInDoc) {
        // restore the last known caret, or fall back to the document end
        const r = savedRangeRef.current
        if (r && el.contains(r.startContainer)) {
          sel?.removeAllRanges()
          sel?.addRange(r)
        } else {
          const rg = document.createRange()
          rg.selectNodeContents(el)
          rg.collapse(false)
          sel?.removeAllRanges()
          sel?.addRange(rg)
          savedRangeRef.current = rg.cloneRange()
        }
      }
      el.focus()
      try {
        document.execCommand("insertText", false, text + " ")
      } catch {
        // ignore — next chunk will retry
      }
      handleInput()
    },
    [handleInput]
  )

  const voice = useVoiceTyping(insertSpokenText)

  /** Surface recognizer errors once (mic denied / network / unsupported). */
  React.useEffect(() => {
    if (!voice.error) return
    const lang = getCurrentLang()
    if (voice.error === "unsupported") {
      toast({ title: tForLang(lang, "Voice typing isn’t supported in this browser"), description: tForLang(lang, "Try a Chromium-based browser.") })
    } else if (voice.error === "not-allowed" || voice.error === "service-not-allowed") {
      toast({ title: tForLang(lang, "Microphone access was denied"), description: tForLang(lang, "Allow microphone access in your browser settings to dictate.") })
    } else if (voice.error !== "start-failed") {
      toast({ title: tForLang(lang, "Voice typing stopped"), description: tForLang(lang, "Reason: {reason}", { reason: voice.error }) })
    }
  }, [voice.error, toast])

  const toggleVoiceTyping = React.useCallback(() => {
    voice.toggle()
  }, [voice])

  /* ---------------- export & print ---------------- */

  /** Shared export document builder — the exact same CSS/layout the
   *  server-side Chromium PDF renderer prints, so every format (PDF / Word
   *  / HTML / print) is pixel-consistent. */
  const buildExportHtml = React.useCallback(
    (mode: "print" | "word" | "html" = "word") =>
      buildPrintDocument({
        title: latestTitleRef.current || tForLang(getCurrentLang(), "Untitled document"),
        bodyHtml: contentRef.current,
        mode,
      }),
    []
  )

  const saveBlobFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke asynchronously: some browsers (Safari, headless) start the download
    // after the current task — a synchronous revoke can kill the transfer.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const printDoc = React.useCallback(() => {
    const html = buildExportHtml("print")
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
    document.body.appendChild(iframe)
    const idoc = iframe.contentDocument
    if (!idoc) return
    idoc.open()
    idoc.write(html)
    idoc.close()
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => iframe.remove(), 800)
    }, 300)
  }, [buildExportHtml])

  /** Export the current document as a real .pdf file (Google Docs parity).
   *
   *  Tries the server-side Chromium vector renderer FIRST — selectable text,
   *  correct CJK fonts, correct wrapping of very long words — then falls back
   *  to the local html2canvas raster pipeline, and finally to the print
   *  dialog when canvas rendering is unavailable. */
  const downloadPdf = React.useCallback(async () => {
    const el = pageRef.current
    const lang = getCurrentLang()
    const name = exportSafeName(latestTitleRef.current || tForLang(lang, "Untitled document"))
    const title = latestTitleRef.current || tForLang(lang, "Untitled document")
    // large docs stream real progress; small ones just show the download card
    const estWords = countWords(htmlToText(contentRef.current ?? ""))
    const big = estWords >= 600
    const tracker = trackedDownload({
      kind: "pdf",
      title,
      fileName: `${name}.pdf`,
      note: big ? tForLang(lang, "Large document — this may take a moment") : undefined,
    })

    // 1) server-side vector PDF (Chromium print — real text layer)
    try {
      const res = await apiFetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: latestTitleRef.current, html: contentRef.current }),
      })
      if (res.ok) {
        tracker.tick({ phase: "download", note: tForLang(lang, "Downloading…") })
        const blob = await readBlobWithProgress(res, (loaded, total) => {
          tracker.tick({
            phase: "download",
            percent: total && total > 0 ? Math.min(99, (loaded / total) * 100) : null,
          })
        })
        if (blob.size > 0) {
          saveBlobFile(blob, `${name}.pdf`)
          tracker.finish(true)
          toast({ title: tForLang(lang, "Download started"), description: `${name}.pdf` })
          return
        }
      }
    } catch {
      /* offline / renderer unavailable → client fallbacks below */
    }

    // 2) client raster fallback (html2canvas)
    if (!el) {
      tracker.finish(false)
      return
    }
    let wrap: HTMLElement | null = null
    let prevTransform = ""
    try {
      // capture at scale 1 — reset the zoom transform during the snapshot
      wrap = el.closest("[data-doc-zoom-wrap]") as HTMLElement | null
      if (wrap) {
        prevTransform = wrap.style.transform
        wrap.style.transform = "none"
      }
      const [{ jsPDF }, h2c] = await Promise.all([import("jspdf"), import("html2canvas-pro")])
      tracker.tick({ phase: "render", note: tForLang(lang, "Rendering the document pages") })
      // export the "accepted" view — suggestion marks flattened (Google parity).
      // The class stays on through BOTH the capture and the block measuring so
      // the pagination slices match the rendered canvas exactly (finally removes it).
      if (el.querySelector("[data-sid]") != null) el.classList.add("exporting")
      const canvas = await h2c.default(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      })
      // long unbreakable strings must wrap during capture too
      el.classList.add("export-wrap-all")
      // page geometry: Letter at 96dpi = 816×1056 CSS px inside the page el
      const PAGE_H = 1056
      const total = el.getBoundingClientRect().height
      // paginate on block boundaries (never slice a text line in half)
      const blocks = Array.from(el.children) as HTMLElement[]
      const elTop = el.getBoundingClientRect().top
      const pages: { start: number; end: number }[] = []
      let pageStart = 0
      let pageEnd = 0
      for (const b of blocks) {
        const r = b.getBoundingClientRect()
        const top = r.top - elTop
        const bottom = top + r.height
        if (pageEnd > pageStart && bottom - pageStart > PAGE_H) {
          pages.push({ start: pageStart, end: pageStart + PAGE_H })
          pageStart = top
        }
        pageEnd = bottom
      }
      pages.push({ start: pageStart, end: Math.max(pageEnd, pageStart) })
      // trim the last page to actual content height
      pages[pages.length - 1].end = Math.min(pages[pages.length - 1].end, Math.max(total, 1))

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true })
      const PW = pdf.internal.pageSize.getWidth()
      const PH = pdf.internal.pageSize.getHeight()
      for (let i = 0; i < pages.length; i++) {
        // per-page progress — the card shows “第 2 页，共 5 页” while slicing
        tracker.tick({
          phase: "render",
          percent: ((i + 1) / pages.length) * 100,
          note: tForLang(lang, "Page {i} of {n}", { i: i + 1, n: pages.length }),
        })
        const y0 = Math.max(0, pages[i].start) * 2
        const y1 = Math.max(y0 + 1, Math.min(pages[i].end * 2, canvas.height))
        const slice = document.createElement("canvas")
        slice.width = canvas.width
        slice.height = y1 - y0
        const ctx2d = slice.getContext("2d")
        if (!ctx2d) continue
        ctx2d.fillStyle = "#ffffff"
        ctx2d.fillRect(0, 0, slice.width, slice.height)
        ctx2d.drawImage(canvas, 0, y0, canvas.width, y1 - y0, 0, 0, canvas.width, y1 - y0)
        if (i > 0) pdf.addPage()
        pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, PW, PH, undefined, "FAST")
      }
      const name2 = exportSafeName(latestTitleRef.current || tForLang(lang, "Untitled document"))
      pdf.save(`${name2}.pdf`)
      tracker.finish(true)
      toast({ title: tForLang(lang, "Download started"), description: `${name2}.pdf` })
    } catch {
      // 3) final fallback — print dialog (browser "Save as PDF" is vector)
      tracker.finish(false)
      toast({ title: tForLang(lang, "PDF export fell back to print"), description: tForLang(lang, "Choose “Save as PDF” as the destination") })
      printDoc()
    } finally {
      if (wrap) wrap.style.transform = prevTransform
      el.classList.remove("exporting", "export-wrap-all")
    }
  }, [printDoc, toast])

  const downloadDoc = React.useCallback(
    async (format: "docx" | "doc" | "html" | "txt") => {
      const lang = getCurrentLang()
      const name = exportSafeName(latestTitleRef.current || tForLang(lang, "Untitled document"))
      const title = latestTitleRef.current || tForLang(lang, "Untitled document")
      if (format === "docx") {
        const tracker = trackedDownload({ kind: "docx", title, fileName: `${name}.docx` })
        // real Word package rendered server-side; legacy .doc HTML as fallback
        try {
          const res = await apiFetch("/api/export/docx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: latestTitleRef.current, html: contentRef.current }),
          })
          if (res.ok) {
            tracker.tick({ phase: "download", note: tForLang(lang, "Downloading…") })
            const blob = await readBlobWithProgress(res, (loaded, total) => {
              tracker.tick({
                phase: "download",
                percent: total && total > 0 ? Math.min(99, (loaded / total) * 100) : null,
              })
            })
            if (blob.size > 0) {
              saveBlobFile(blob, `${name}.docx`)
              tracker.finish(true)
              toast({ title: tForLang(lang, "Download started"), description: `${name}.docx` })
              return
            }
          }
        } catch {
          /* server unavailable → legacy .doc below */
        }
        saveBlobFile(new Blob(["\ufeff" + buildExportHtml("word")], { type: "application/msword" }), `${name}.doc`)
        tracker.finish(true)
        toast({ title: tForLang(lang, "Download started"), description: `${name}.doc` })
        return
      }
      let blob: Blob
      if (format === "txt") {
        blob = new Blob([htmlToPlainText(contentRef.current)], { type: "text/plain;charset=utf-8" })
      } else if (format === "html") {
        blob = new Blob([buildExportHtml("html")], { type: "text/html;charset=utf-8" })
      } else {
        blob = new Blob(["\ufeff" + buildExportHtml("word")], { type: "application/msword" })
      }
      const tracker = trackedDownload({ kind: format, title, fileName: `${name}.${format}` })
      saveBlobFile(blob, `${name}.${format}`)
      tracker.finish(true)
      toast({ title: tForLang(lang, "Download started"), description: `${name}.${format}` })
    },
    [buildExportHtml, toast]
  )

  /* ---------------- document actions ---------------- */
  const goHome = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (dirtyRef.current) void performSave()
    goHomeStore()
  }, [performSave, goHomeStore])

  const toggleStar = React.useCallback(async () => {
    const next = !starred
    setStarred(next)
    patchDocMeta(docId, { starred: next })
    try {
      await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: next }),
      })
    } catch {
      setStarred(!next)
    }
  }, [starred, docId, patchDocMeta])

  const moveToTrash = React.useCallback(async () => {
    if (dirtyRef.current) await performSave()
    await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    })
    toast({ title: tForLang(getCurrentLang(), "Moved to trash"), description: latestTitleRef.current })
    goHomeStore()
  }, [docId, performSave, goHomeStore, toast])

  const duplicate = React.useCallback(async () => {
    if (dirtyRef.current) await performSave()
    try {
      const res = await fetch(`/api/documents/${docId}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { document: DocumentDTO }
      toast({ title: tForLang(getCurrentLang(), "Copy created"), description: data.document.title })
      openDoc(data.document.id)
    } catch {
      toast({ title: tForLang(getCurrentLang(), "Couldn't duplicate this document"), variant: "destructive" })
    }
  }, [docId, performSave, openDoc, toast])

  const restoreVersion = React.useCallback(
    (content: string) => {
      const el = pageRef.current
      if (el) el.innerHTML = content
      contentRef.current = content
      handleInput()
      setStats(docStats(content))
    },
    [handleInput]
  )

  /* ---------------- AI quick actions (polish) ---------------- */
  /** Capture the current selection (or fall back to the whole document) and
   *  open the AI polish dialog. Usable from the menu and the ⌥⌘A shortcut. */
  const openAiTools = React.useCallback(() => {
    const el = pageRef.current
    const sel = window.getSelection()
    const selText = sel ? sel.toString().trim() : ""
    if (el && sel && !sel.isCollapsed && selText.length > 0 && el.contains(sel.anchorNode)) {
      aiRangeRef.current = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
      setAiSource({ text: sel.toString(), isSelection: true })
    } else {
      aiRangeRef.current = null
      setAiSource({ text: htmlToText(contentRef.current), isSelection: false })
    }
  }, [])

  /* ---------------- keyboard shortcuts ---------------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === "s" && e.shiftKey) {
        // ⌘⇧S — voice typing (plain ⌘S below stays "save")
        e.preventDefault()
        toggleVoiceTyping()
      } else if (k === "s") {
        e.preventDefault()
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        void performSave(true)
      } else if (k === "f" || k === "h") {
        e.preventDefault()
        openFindPanel(k === "h")
      } else if (k === "k") {
        e.preventDefault()
        const el = pageRef.current
        const sel = window.getSelection()
        setLinkHasSelection(!!el && !!sel && !sel.isCollapsed && el.contains(sel.anchorNode))
        setDialog("link")
      } else if (k === "p") {
        e.preventDefault()
        printDoc()
      } else if (k === "t" && e.shiftKey) {
        e.preventDefault()
        setDialog("table")
      } else if (k === "\\") {
        e.preventDefault()
        clearFormatting()
      } else if (k === "m" && e.altKey) {
        e.preventDefault()
        openCommentComposer()
      } else if (k === "a" && e.altKey) {
        // ⌥⌘A — AI polish on the selection (or whole document)
        e.preventDefault()
        openAiTools()
        setDialog("aitools")
      } else if (k === "escape") {
        setBubble(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [performSave, printDoc, clearFormatting, openCommentComposer, openAiTools, openFindPanel, toggleVoiceTyping])

  // Plain Escape closes the find bar — but only when no Radix menu/dialog is
  // open (those must consume Escape first to close themselves).
  React.useEffect(() => {
    if (!findOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('[data-state="open"][role="menu"], [data-state="open"][role="dialog"], [data-state="open"][role="listbox"], [data-state="open"][role="tooltip"]')) return
      closeFindPanel()
    }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [findOpen, closeFindPanel])

  /* ---------------- document outline ---------------- */
  /** Re-scan the live DOM for h1–h4 and stamp stable data-oid attributes. */
  const parseOutline = React.useCallback(() => {
    const el = pageRef.current
    if (!el) {
      setOutlineItems([])
      return
    }
    const headings = Array.from(el.querySelectorAll<HTMLElement>("h1, h2, h3, h4"))
    const stamp = Date.now().toString(36)
    const items: OutlineItem[] = headings.map((h, i) => {
      const oid = h.dataset.oid ?? `${stamp}-${i}`
      h.dataset.oid = oid
      return {
        oid,
        level: Number(h.tagName[1]) as 1 | 2 | 3 | 4,
        text: (h.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
      }
    })
    setOutlineItems(items)
  }, [])

  React.useEffect(() => {
    // child (EditorCanvas) effects run first, so innerHTML is already set here
    const t = setTimeout(parseOutline, 60)
    return () => clearTimeout(t)
  }, [doc, contentTick, remoteContent, parseOutline])

  const toggleOutline = React.useCallback((open?: boolean) => {
    setOutlineOpen((prev) => open ?? !prev)
  }, [])

  /** Scroll the canvas to a heading and flash it. */
  const jumpToOutline = React.useCallback(
    (item: OutlineItem) => {
      const el = pageRef.current?.querySelector(`[data-oid="${item.oid}"]`) as HTMLElement | null
      if (!el) return
      const canvas = el.closest(".doc-canvas-bg") as HTMLElement | null
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect()
        const rect = el.getBoundingClientRect()
        const target = canvas.scrollTop + (rect.top - canvasRect.top) / zoom - canvasRect.height / 3 / zoom
        canvas.scrollTo({ top: Math.max(0, target), behavior: "smooth" })
      }
      el.classList.remove("outline-flash")
      void el.offsetWidth // restart the animation
      el.classList.add("outline-flash")
      window.setTimeout(() => el.classList.remove("outline-flash"), 1700)
    },
    [zoom]
  )

  /* ---------------- insert emoji ---------------- */
  /** Insert an emoji at the caret WITHOUT relying on document focus — the
   *  picker stays open (Radix dialog focus-traps the page), so execCommand
   *  is unusable; manipulate the saved Range directly instead. */
  const insertEmoji = React.useCallback(
    (emoji: string) => {
      const el = pageRef.current
      if (!el) return
      const sel = window.getSelection()
      let range: Range | null = null
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        range = sel.getRangeAt(0)
      } else if (savedRangeRef.current && el.contains(savedRangeRef.current.startContainer)) {
        range = savedRangeRef.current
      }
      if (!range) {
        el.insertAdjacentHTML("beforeend", escapeHtml(emoji))
      } else {
        try {
          range.deleteContents()
          const text = document.createTextNode(emoji)
          range.insertNode(text)
          range.setStartAfter(text)
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
          savedRangeRef.current = range.cloneRange()
        } catch {
          el.insertAdjacentHTML("beforeend", escapeHtml(emoji))
        }
      }
      handleInput()
    },
    [handleInput]
  )

  /* ---------------- editor api for children ---------------- */
  const others = React.useMemo(() => presence.filter((u) => u.id !== user?.id), [presence, user?.id])

  const api: EditorApi = {
    docId,
    title,
    starred,
    saveStatus,
    lastSavedAt,
    stats,
    zoom,
    setZoom: (z: number) => setZoomState(Math.min(2, Math.max(0.5, z))),
    spellCheck,
    setSpellCheck,
    fmt,
    exec,
    applyFontSize,
    applyLineSpacing,
    applyAlignment,
    clearFormatting,
    focusEditor,
    onTitleChange,
    focusTitle: () => titleInputRef.current?.focus(),
    toggleStar,
    saveNow: () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      void performSave(true)
    },
    printDoc,
    downloadPdf,
    downloadDoc,
    goHome,
    moveToTrash,
    duplicate,
    openDialog: (d) => {
      if (d === "link") {
        const el = pageRef.current
        const sel = window.getSelection()
        setLinkHasSelection(!!el && !!sel && !sel.isCollapsed && el.contains(sel.anchorNode))
      }
      if (d === "aitools") openAiTools()
      if (d === "find") {
        // the menu entry reads "Find and replace" — open with the replace row
        openFindPanel(true)
        return
      }
      setDialog(d)
    },
    presence: others,
    connected,
    /* comments */
    commentsOpen,
    toggleComments,
    openCommentComposer,
    unresolvedCommentCount: comments.filter((c) => !c.resolved).length,
    /* insert table */
    insertTable,
    /* table operations */
    tableOp,
    tableInfo,
    /* document outline */
    outlineOpen,
    toggleOutline,
    /* voice typing */
    voiceListening: voice.listening,
    toggleVoiceTyping,
    /* suggesting mode */
    mode,
    setMode,
    suggestions,
    activeSuggestionId,
    acceptSuggestion,
    rejectSuggestion,
    focusSuggestion,
    /* page margins */
    pageMargins,
    setPageMargins,
  }

  const openDialog = (d: string | null) => setDialog(d)
  const onDialogChange = (o: boolean) => {
    if (!o) setDialog(null)
  }

  /** Right-click on the canvas: move the caret to the click point (so table
   *  operations act on the clicked cell) unless the click keeps an existing
   *  selection, then refresh the menu's table descriptor. */
  const onCanvasContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      const el = pageRef.current
      if (!el || !el.contains(e.target as Node)) return
      if (!pointInSelection(e.clientX, e.clientY)) {
        const range = caretRangeFromPoint(e.clientX, e.clientY)
        if (range && el.contains(range.startContainer)) {
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
          savedRangeRef.current = range.cloneRange()
        }
      }
      setMenuTableInfo(describeTableAt(el))
    },
    []
  )

  /* ---------------- render ---------------- */
  if (loadError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <FileWarning className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <p className="text-lg font-semibold">
            {loadError === "not-found" ? t("This document doesn't exist anymore.") : t("Couldn't load this document.")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("It may have been deleted by someone else.")}</p>
        </div>
        <Button onClick={goHomeStore} className="rounded-md px-6">{t("Back to documents")}</Button>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <EditorHeader api={api} />
      <MenuBar api={api} />
      <Toolbar api={api} />

      {doc ? (
        <div className="relative flex min-h-0 flex-1">
          <FindReplacePanel
            open={findOpen}
            replaceMode={findReplaceMode}
            query={findQuery}
            caseSensitive={findCase}
            matchCount={findMatches.length}
            activeIndex={findActiveIndex}
            commentsOpen={commentsOpen}
            onQueryChange={setFindQuery}
            onCaseToggle={() => setFindCase((c) => !c)}
            onToggleReplaceMode={() => setFindReplaceMode((r) => !r)}
            onNext={findNext}
            onPrev={findPrev}
            onReplace={replaceCurrent}
            onReplaceAll={replaceAllMatches}
            onClose={closeFindPanel}
          />
          <VoicePill
            listening={voice.listening}
            interim={voice.interim}
            onStop={voice.stop}
          />
          <OutlineSidebar
            open={outlineOpen}
            onClose={() => toggleOutline(false)}
            items={outlineItems}
            onJump={jumpToOutline}
          />
          <ContextMenu>
            <ContextMenuTrigger
              asChild
              onContextMenu={onCanvasContextMenu}
              className="contents"
            >
              <div className="contents">
                <EditorCanvas
                  key={docId}
                  pageRef={pageRef}
                  initialContent={doc.content}
                  remoteContent={remoteContent}
                  onRemoteApplied={() => setRemoteContent(null)}
                  onInput={handleInput}
                  spellCheck={spellCheck}
                  zoom={zoom}
                  remoteCursors={remoteCursors}
                  comments={comments}
                  activeCommentId={activeCommentId}
                  contentTick={contentTick}
                  activeTable={activeTableEl}
                  findMatches={findMatches}
                  findActiveIndex={findActiveIndex}
                  margins={pageMargins}
                  onMarginsChange={setPageMargins}
                  onColumnResize={() => {
                    // colgroup widths live in the document HTML: recompute
                    // stats/outline so dependent views stay in sync
                    setTableInfo(describeTableAt(pageRef.current ?? document.body))
                  }}
                  onCommentClick={(id) => {
                    const c = comments.find((t) => t.id === id)
                    if (c) {
                      focusComment(c)
                      setCommentsOpen(true)
                    }
                  }}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              <ContextMenuItem onClick={() => tableOp("row-above")}>
                <Rows3 className="h-4 w-4" /> {t("Insert row above")}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => tableOp("row-below")}>
                <Rows3 className="h-4 w-4" /> {t("Insert row below")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => tableOp("col-left")}>
                <Columns3 className="h-4 w-4" /> {t("Insert column left")}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => tableOp("col-right")}>
                <Columns3 className="h-4 w-4" /> {t("Insert column right")}
              </ContextMenuItem>
              {menuTableInfo && <ContextMenuSeparator />}
              {menuTableInfo && (
                <ContextMenuItem onClick={() => tableOp("toggle-header")}>
                  <Heading className="h-4 w-4" /> {menuTableInfo.hasHeader ? t("Remove header row") : t("Make first row a header")}
                </ContextMenuItem>
              )}
              {menuTableInfo && (menuTableInfo.canMergeRight || menuTableInfo.canMergeDown || menuTableInfo.canSplit) && (
                <>
                  <ContextMenuSeparator />
                  {menuTableInfo.canMergeRight && (
                    <ContextMenuItem onClick={() => tableOp("merge-right")}>
                      <TableCellsMerge className="h-4 w-4" /> {t("Merge cell right")}
                    </ContextMenuItem>
                  )}
                  {menuTableInfo.canMergeDown && (
                    <ContextMenuItem onClick={() => tableOp("merge-down")}>
                      <TableCellsMerge className="h-4 w-4 -rotate-90" /> {t("Merge cell down")}
                    </ContextMenuItem>
                  )}
                  {menuTableInfo.canSplit && (
                    <ContextMenuItem onClick={() => tableOp("split-cell")}>
                      <TableCellsSplit className="h-4 w-4" /> {t("Split cell")}
                    </ContextMenuItem>
                  )}
                </>
              )}
              {menuTableInfo && <ContextMenuSeparator />}
              {menuTableInfo && (
                <ContextMenuItem onClick={() => tableOp("delete-row")} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> {t("Delete row")}
                </ContextMenuItem>
              )}
              {menuTableInfo && (
                <ContextMenuItem onClick={() => tableOp("delete-col")} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> {t("Delete column")}
                </ContextMenuItem>
              )}
              {menuTableInfo && (
                <ContextMenuItem onClick={() => tableOp("delete-table")} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> {t("Delete table")}
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
          <CommentsSidebar
            open={commentsOpen}
            onClose={() => toggleComments(false)}
            comments={comments}
            loading={commentsLoading}
            activeCommentId={activeCommentId}
            pendingQuote={pendingQuote}
            busy={commentBusy}
            meId={user?.id ?? null}
            onSubmitComment={(text) => void submitComment(text)}
            onCancelComposer={() => setPendingQuote(null)}
            onReply={(parentId, text) => void submitReply(parentId, text)}
            onEdit={(id, content) => void editComment(id, content)}
            onToggleResolve={(c) => void toggleResolveComment(c)}
            onDelete={(c) => void deleteComment(c)}
            onFocusComment={focusComment}
            onToggleReaction={(commentId, emoji) => void toggleReaction(commentId, emoji)}
            suggestions={suggestions}
            activeSuggestionId={activeSuggestionId}
            onAcceptSuggestion={acceptSuggestion}
            onRejectSuggestion={rejectSuggestion}
            onFocusSuggestion={focusSuggestion}
          />
        </div>
      ) : (
        <div className="doc-canvas-bg flex flex-1 items-start justify-center overflow-hidden p-10">
          <div className="w-full max-w-[816px] space-y-4 rounded-sm bg-white p-24 shadow-[0_1px_2px_rgba(35,32,28,0.08),0_12px_40px_rgba(35,32,28,0.1)]">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("Loading document…")}</span>
            </div>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      )}

      <StatusPill api={api} />

      {/* Selection comment bubble */}
      {bubble && !pendingQuote && (
        <CommentBubble x={bubble.x} y={bubble.y} onAdd={openCommentComposer} />
      )}

      {/* Dialogs */}
      <LinkDialog
        open={dialog === "link"}
        onOpenChange={onDialogChange}
        onInsert={insertLink}
        hasSelection={linkHasSelection}
      />
      <ImageDialog open={dialog === "image"} onOpenChange={onDialogChange} onInsert={insertImage} />
      <TableDialog open={dialog === "table"} onOpenChange={onDialogChange} onInsert={insertTable} />
      <EmojiDialog open={dialog === "emoji"} onOpenChange={onDialogChange} onInsert={insertEmoji} />
      <ShareDialog
        open={dialog === "share"}
        onOpenChange={onDialogChange}
        docId={docId}
        title={title}
        presence={presence}
        me={{ name: user?.name ?? t("You"), color: user?.color ?? "#0e7c74" }}
      />
      <HelpWriteDialog
        open={dialog === "helpwrite"}
        onOpenChange={onDialogChange}
        onInsert={insertHtmlAtCursor}
        onReplace={replaceDocumentHtml}
        docTitle={title}
      />
      <AiToolsDialog
        open={dialog === "aitools"}
        onOpenChange={onDialogChange}
        docTitle={title}
        source={aiSource}
        onReplace={replaceAiResult}
        onInsert={insertAiResult}
      />
      <WordCountDialog open={dialog === "wordcount"} onOpenChange={onDialogChange} stats={stats} />
      <SpellCheckDialog
        open={dialog === "spellcheck"}
        onOpenChange={onDialogChange}
        pageRef={pageRef}
        onFixed={handleInput}
        lang={lang}
      />
      <WritingStudioDialog
        open={dialog === "writing"}
        onOpenChange={onDialogChange}
        docId={docId}
        html={contentRef.current ?? doc?.content ?? ""}
        stats={writingStats}
        editCount={editCount}
        lang={lang}
        highlightText={highlightText}
      />
      <ShortcutsDialog open={dialog === "shortcuts"} onOpenChange={onDialogChange} />
      <AboutDialog open={dialog === "about"} onOpenChange={onDialogChange} />
      <VersionHistorySheet
        open={dialog === "versions"}
        onOpenChange={onDialogChange}
        docId={docId}
        onRestore={restoreVersion}
        getCurrentContent={() => contentRef.current}
      />
    </div>
  )
}
