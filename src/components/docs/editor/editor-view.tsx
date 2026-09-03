"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useDocsStore } from "@/store/docs-store"
import { useLocalUser } from "@/lib/identity"
import { useCollab, type DocChangePayload } from "@/hooks/use-collab"
import { docStats, escapeHtml, getSnippet, htmlToText, countWords } from "@/lib/doc-utils"
import { selectionOffsets, selectedBlocks, escapeRegex } from "@/lib/editor-dom"
import type { DocumentDTO } from "@/lib/docs-types"
import { EditorCanvas } from "./editor-canvas"
import { EditorHeader } from "./editor-header"
import { MenuBar } from "./menu-bar"
import { Toolbar } from "./toolbar"
import { StatusPill } from "./status-pill"
import { DEFAULT_FORMAT, type EditorApi, type FormatState } from "./editor-types"
import { LinkDialog, ImageDialog, FindReplaceDialog } from "./dialogs-basic"
import { ShareDialog } from "./share-dialog"
import { VersionHistorySheet } from "./version-history"
import { HelpWriteDialog } from "./help-write-dialog"
import { WordCountDialog, ShortcutsDialog, AboutDialog } from "./info-dialogs"
import { FileWarning, Loader2 } from "lucide-react"

export function EditorView() {
  const docId = useDocsStore((s) => s.currentDocId) ?? ""
  const goHomeStore = useDocsStore((s) => s.goHome)
  const openDoc = useDocsStore((s) => s.openDoc)
  const patchDocMeta = useDocsStore((s) => s.patchDocMeta)
  const openAiOnEditor = useDocsStore((s) => s.openAiOnEditor)
  const setOpenAiOnEditor = useDocsStore((s) => s.setOpenAiOnEditor)
  const { toast } = useToast()
  const user = useLocalUser()

  /* ---------------- document state ---------------- */
  const [doc, setDoc] = React.useState<DocumentDTO | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [starred, setStarred] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved" | "error">("saved")
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)
  const [stats, setStats] = React.useState({ words: 0, chars: 0, paragraphs: 0, pages: 1, readingMinutes: 1 })
  const [zoom, setZoomState] = React.useState(1)
  const [spellCheck, setSpellCheck] = React.useState(true)
  const [fmt, setFmt] = React.useState<FormatState>(DEFAULT_FORMAT)
  const [remoteContent, setRemoteContent] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<string | null>(null)
  const [linkHasSelection, setLinkHasSelection] = React.useState(false)

  /* ---------------- refs ---------------- */
  const pageRef = React.useRef<HTMLDivElement | null>(null)
  const titleInputRef = React.useRef<HTMLInputElement | null>(null)
  const savedRangeRef = React.useRef<Range | null>(null)
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
      })
      .catch((e: Error) => {
        if (cancelled) return
        setLoadError(e.message === "not-found" ? "This document doesn't exist anymore." : "Couldn't load this document.")
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

  const { connected, myId, presence, remoteCursors, emitDocChange, emitCursor } = useCollab(
    docId || null,
    user,
    onDocChange
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
        if (manual) toast({ title: "Saved", description: "All changes are safe." })
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
      const now = Date.now()
      if (now - lastCursorEmitRef.current > 140) {
        lastCursorEmitRef.current = now
        const off = selectionOffsets(el)
        if (off) emitCursor(off.start, off.end)
      }
    }
    document.addEventListener("selectionchange", onSel)
    return () => document.removeEventListener("selectionchange", onSel)
  }, [refreshFmt, emitCursor])

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

  const replaceDocumentHtml = React.useCallback(
    (html: string) => {
      const el = pageRef.current
      if (!el) return
      el.innerHTML = html
      handleInput()
    },
    [handleInput]
  )

  /* ---------------- find & replace ---------------- */
  const countMatches = React.useCallback((find: string, caseSensitive: boolean) => {
    const el = pageRef.current
    if (!el || !find) return 0
    const re = new RegExp(escapeRegex(find), caseSensitive ? "g" : "gi")
    let count = 0
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent ?? ""
      const m = t.match(re)
      if (m) count += m.length
    }
    return count
  }, [])

  const replaceAllMatches = React.useCallback(
    (find: string, replace: string, caseSensitive: boolean) => {
      const el = pageRef.current
      if (!el || !find) return 0
      const re = new RegExp(escapeRegex(find), caseSensitive ? "g" : "gi")
      let count = 0
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      while (walker.nextNode()) nodes.push(walker.currentNode as Text)
      for (const n of nodes) {
        const t = n.textContent ?? ""
        const m = t.match(re)
        if (m) {
          count += m.length
          n.textContent = t.replace(re, replace)
        }
      }
      if (count > 0) {
        handleInput()
        toast({ title: `Replaced ${count} ${count === 1 ? "match" : "matches"}` })
      }
      return count
    },
    [handleInput, toast]
  )

  /* ---------------- export & print ---------------- */
  const buildExportHtml = React.useCallback(() => {
    const t = escapeHtml(latestTitleRef.current || "Untitled document")
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${t}</title>
<style>
@page { margin: 1in; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.15; color: #202124; }
h1 { font-size: 20pt; font-weight: 400; color: #3c4043; margin: 16pt 0 6.5pt; }
h2 { font-size: 16pt; font-weight: 400; color: #3c4043; margin: 14pt 0 5pt; }
h3 { font-size: 14pt; font-weight: 400; color: #434343; margin: 12pt 0 4pt; }
p { margin: 0 0 7.5pt; }
ul { list-style: disc outside; padding-left: 40px; margin: 8pt 0; }
ol { list-style: decimal outside; padding-left: 40px; margin: 8pt 0; }
blockquote { border-left: 3px solid #dadce0; margin: 8pt 0; padding: 4pt 0 4pt 16pt; color: #5f6368; }
a { color: #0b6b62; }
img { max-width: 100%; }
</style></head>
<body>${contentRef.current}</body></html>`
  }, [])

  const printDoc = React.useCallback(() => {
    const html = buildExportHtml()
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

  const downloadDoc = React.useCallback(
    (format: "doc" | "html" | "txt") => {
      const name = (latestTitleRef.current || "Untitled document").replace(/[^\w\d\-. ]+/g, "_").trim() || "document"
      let blob: Blob
      if (format === "txt") {
        blob = new Blob([htmlToText(contentRef.current)], { type: "text/plain;charset=utf-8" })
      } else if (format === "html") {
        blob = new Blob([buildExportHtml()], { type: "text/html;charset=utf-8" })
      } else {
        blob = new Blob(["\ufeff" + buildExportHtml()], { type: "application/msword" })
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${name}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: "Download started", description: a.download })
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
    toast({ title: "Moved to trash", description: latestTitleRef.current })
    goHomeStore()
  }, [docId, performSave, goHomeStore, toast])

  const duplicate = React.useCallback(async () => {
    if (dirtyRef.current) await performSave()
    try {
      const res = await fetch(`/api/documents/${docId}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { document: DocumentDTO }
      toast({ title: "Copy created", description: data.document.title })
      openDoc(data.document.id)
    } catch {
      toast({ title: "Couldn't duplicate this document", variant: "destructive" })
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

  /* ---------------- keyboard shortcuts ---------------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === "s") {
        e.preventDefault()
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        void performSave(true)
      } else if (k === "f" || k === "h") {
        e.preventDefault()
        setDialog("find")
      } else if (k === "k") {
        e.preventDefault()
        const el = pageRef.current
        const sel = window.getSelection()
        setLinkHasSelection(!!el && !!sel && !sel.isCollapsed && el.contains(sel.anchorNode))
        setDialog("link")
      } else if (k === "p") {
        e.preventDefault()
        printDoc()
      } else if (k === "\\") {
        e.preventDefault()
        clearFormatting()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [performSave, printDoc, clearFormatting])

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
      setDialog(d)
    },
    presence: others,
    connected,
  }

  const openDialog = (d: string | null) => setDialog(d)
  const onDialogChange = (o: boolean) => {
    if (!o) setDialog(null)
  }

  /* ---------------- render ---------------- */
  if (loadError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <FileWarning className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <p className="text-lg font-semibold">{loadError}</p>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted by someone else.</p>
        </div>
        <Button onClick={goHomeStore} className="rounded-full px-6">Back to documents</Button>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <EditorHeader api={api} />
      <MenuBar api={api} />
      <Toolbar api={api} />

      {doc ? (
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
        />
      ) : (
        <div className="doc-canvas-bg flex flex-1 items-start justify-center overflow-hidden p-10">
          <div className="w-full max-w-[816px] space-y-4 rounded-sm bg-white p-24 shadow-lg">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading document…</span>
            </div>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      )}

      <StatusPill api={api} />

      {/* Dialogs */}
      <LinkDialog
        open={dialog === "link"}
        onOpenChange={onDialogChange}
        onInsert={insertLink}
        hasSelection={linkHasSelection}
      />
      <ImageDialog open={dialog === "image"} onOpenChange={onDialogChange} onInsert={insertImage} />
      <FindReplaceDialog
        open={dialog === "find"}
        onOpenChange={onDialogChange}
        onCountMatches={countMatches}
        onReplaceAll={replaceAllMatches}
      />
      <ShareDialog
        open={dialog === "share"}
        onOpenChange={onDialogChange}
        docId={docId}
        title={title}
        presence={presence}
        me={{ name: user?.name ?? "You", color: user?.color ?? "#129c58" }}
      />
      <HelpWriteDialog
        open={dialog === "helpwrite"}
        onOpenChange={onDialogChange}
        onInsert={insertHtmlAtCursor}
        onReplace={replaceDocumentHtml}
        docTitle={title}
      />
      <WordCountDialog open={dialog === "wordcount"} onOpenChange={onDialogChange} stats={stats} />
      <ShortcutsDialog open={dialog === "shortcuts"} onOpenChange={onDialogChange} />
      <AboutDialog open={dialog === "about"} onOpenChange={onDialogChange} />
      <VersionHistorySheet
        open={dialog === "versions"}
        onOpenChange={onDialogChange}
        docId={docId}
        onRestore={restoreVersion}
      />
    </div>
  )
}
