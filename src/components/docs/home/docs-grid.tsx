"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useDraggable } from "@dnd-kit/core"
import { useDocsStore, type BatchOp } from "@/store/docs-store"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import type { DocumentMeta, FolderDTO, TagDTO } from "@/lib/docs-types"
import { relativeTime } from "@/lib/doc-utils"
import { DocPreview } from "@/components/docs/doc-preview"
import { docDragId } from "./doc-dnd"
import { DEFAULT_TAG_COLOR, TagChip, TagColorPalette, TagDot, TagFilterChip, TagOverflowChip } from "./tag-ui"
import { useI18n } from "@/lib/i18n"
import {
  FileText, MoreVertical, Star, StarOff, Pencil, Copy, Trash2, RotateCcw, Trash, LayoutGrid, List, FolderOpen, SearchX, FolderInput, Folder, Tag, Plus, Check, Loader2, X, Home, CheckCheck, ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"

type SortKey = "updated" | "created" | "title"

function titleFor(filter: string, folders: FolderDTO[], activeFolderId: string | null) {
  if (filter === "trash") return "Trash"
  if (filter === "starred") return "Starred"
  if (filter === "folder") {
    const f = folders.find((x) => x.id === activeFolderId)
    return f ? f.name : "Folder"
  }
  return "Recent documents"
}

export function DocsGrid() {
  const { t, lang } = useI18n()
  const documents = useDocsStore((s) => s.documents)
  const loading = useDocsStore((s) => s.loading)
  const error = useDocsStore((s) => s.error)
  const filter = useDocsStore((s) => s.filter)
  const layout = useDocsStore((s) => s.layout)
  const setLayout = useDocsStore((s) => s.setLayout)
  const searchQuery = useDocsStore((s) => s.searchQuery)
  const openDoc = useDocsStore((s) => s.openDoc)
  const toggleStar = useDocsStore((s) => s.toggleStar)
  const renameDoc = useDocsStore((s) => s.renameDoc)
  const setTrashed = useDocsStore((s) => s.setTrashed)
  const deleteForever = useDocsStore((s) => s.deleteForever)
  const duplicateDoc = useDocsStore((s) => s.duplicateDoc)
  const folders = useDocsStore((s) => s.folders)
  const activeFolderId = useDocsStore((s) => s.activeFolderId)
  const moveToFolder = useDocsStore((s) => s.moveToFolder)
  const tags = useDocsStore((s) => s.tags)
  const tagFilter = useDocsStore((s) => s.tagFilter)
  const setTagFilter = useDocsStore((s) => s.setTagFilter)
  /* multi-select + bulk actions */
  const selection = useDocsStore((s) => s.selection)
  const toggleSelect = useDocsStore((s) => s.toggleSelect)
  const selectAll = useDocsStore((s) => s.selectAll)
  const clearSelection = useDocsStore((s) => s.clearSelection)
  const batchOp = useDocsStore((s) => s.batchOp)
  const { toast } = useToast()

  const [sort, setSort] = React.useState<SortKey>("updated")
  const [renaming, setRenaming] = React.useState<DocumentMeta | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [deleting, setDeleting] = React.useState<DocumentMeta | null>(null)
  /* which bulk operation is currently in flight ("null" = idle) */
  const [busy, setBusy] = React.useState<BatchOp | null>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = React.useState(false)
  const [bulkTagOpen, setBulkTagOpen] = React.useState(false)
  const [bulkRenameOpen, setBulkRenameOpen] = React.useState(false)

  const sorted = React.useMemo(() => {
    const list = [...documents]
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === "created") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    else list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return list
  }, [documents, sort])

  // tag filter narrows the current view (folder / starred / search all compose with it)
  const visible = React.useMemo(
    () => (tagFilter ? sorted.filter((d) => (d.tags ?? []).some((t) => t.id === tagFilter)) : sorted),
    [sorted, tagFilter]
  )
  const activeTag = tagFilter ? tags.find((tg) => tg.id === tagFilter) ?? null : null

  const selectionActive = selection.length > 0
  const allVisibleSelected =
    visible.length > 0 && visible.every((d) => selection.includes(d.id))

  /* Escape clears the selection (unless a menu/dialog/input consumed it first) */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (useDocsStore.getState().selection.length === 0) return
      const el = e.target as HTMLElement | null
      if (
        el?.closest(
          '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], input, textarea, [contenteditable="true"]'
        )
      )
        return
      useDocsStore.getState().clearSelection()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const confirmRename = async () => {
    if (!renaming) return
    const name = renameValue.trim()
    if (!name) return
    await renameDoc(renaming.id, name)
    toast({ title: t("Renamed"), description: `“${name}”` })
    setRenaming(null)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    await deleteForever(deleting.id)
    toast({ title: t("Deleted permanently"), variant: "destructive" })
    setDeleting(null)
  }

  const batchSuccess = (op: BatchOp, n: number, folderName?: string) => {
    switch (op) {
      case "star":
        return t("{n} documents starred", { n })
      case "unstar":
        return t("{n} documents unstarred", { n })
      case "trash":
        return t("{n} documents moved to trash", { n })
      case "restore":
        return t("{n} documents restored", { n })
      case "deleteForever":
        return t("{n} documents deleted forever", { n })
      case "move":
        return t("{n} documents moved to “{name}”", { n, name: folderName ?? t("Home") })
      case "tag":
        return t("Tags applied to {n} documents", { n })
      case "rename":
        return t("Renamed {n} documents", { n })
    }
  }

  const runBatch = async (
    op: BatchOp,
    folderId?: string | null,
    folderName?: string,
    tagIds?: string[]
  ) => {
    if (busy || selection.length === 0) return
    // permanent deletion always asks first (mirrors the single-doc flow)
    if (op === "deleteForever") {
      setConfirmBatchDelete(true)
      return
    }
    const ids = [...selection]
    setBusy(op)
    const res = await batchOp(ids, op, folderId, tagIds)
    setBusy(null)
    if (res.ok > 0) toast({ title: batchSuccess(op, res.ok, folderName) })
    if (res.failed > 0)
      toast({ title: t("{n} items failed", { n: res.failed }), variant: "destructive" })
    clearSelection()
  }

  /** Bulk rename — only the documents whose name actually changes are
   *  PATCHed, so unchanged items keep their updatedAt timestamps. */
  const applyBulkRename = async (pairs: { id: string; title: string }[]) => {
    if (busy || pairs.length === 0) return
    setBusy("rename")
    const res = await batchOp(
      pairs.map((p) => p.id),
      "rename",
      undefined,
      undefined,
      pairs.map((p) => p.title)
    )
    setBusy(null)
    if (res.ok > 0) toast({ title: t("Renamed {n} documents", { n: res.ok }) })
    if (res.failed > 0)
      toast({ title: t("{n} items failed", { n: res.failed }), variant: "destructive" })
    clearSelection()
  }

  return (
    <section aria-label={t("Document list")} className="flex-1 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">{t(titleFor(filter, folders, activeFolderId))}</h2>
          {!loading && (
            <span className="tnum text-[13px] text-muted-foreground">
              {t(visible.length === 1 ? "{n} document" : "{n} documents", { n: visible.length })}
              {searchQuery ? t(" matching “{query}”", { query: searchQuery }) : ""}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-[128px] rounded-md text-[13px] text-muted-foreground" aria-label={t("Sort documents")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">{t("Last edited")}</SelectItem>
                <SelectItem value="created">{t("Date created")}</SelectItem>
                <SelectItem value="title">{t("Title A–Z")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border p-0.5">
              <Button
                variant="ghost" size="icon"
                aria-label={t("Grid view")}
                onClick={() => setLayout("grid")}
                className={cn("h-7 w-7 rounded-[5px]", layout === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                aria-label={t("List view")}
                onClick={() => setLayout("list")}
                className={cn("h-7 w-7 rounded-[5px]", layout === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* selection status row: count + select-all / clear (Google Drive style) */}
        {selectionActive && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
            <CheckCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="tnum text-[13px] font-medium">{t("{n} selected", { n: selection.length })}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline" size="sm"
                disabled={busy !== null || allVisibleSelected}
                onClick={() => selectAll(visible.map((d) => d.id))}
                className="h-7 rounded-full px-3 text-[12.5px]"
              >
                {t("Select all")}
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={busy !== null}
                onClick={clearSelection}
                className="h-7 rounded-full px-3 text-[12.5px]"
              >
                {t("Clear selection")}
              </Button>
            </div>
          </div>
        )}

        {/* Google Drive style filter chip while a tag filter is active */}
        {activeTag && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TagFilterChip tag={activeTag} onClear={() => setTagFilter(null)} />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}. <button className="font-medium underline underline-offset-2" onClick={() => useDocsStore.getState().refresh()}>{t("Retry")}</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-wrap gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-[168px] space-y-2">
                <Skeleton className="h-[220px] w-[168px] rounded-sm" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 || visible.length === 0 ? (
          <EmptyState filter={filter} search={!!searchQuery} tag={activeTag} />
        ) : layout === "grid" ? (
          <div className="flex flex-wrap gap-5">
            {visible.map((doc, i) => (
              <DocCard
                key={doc.id}
                doc={doc}
                index={i}
                inTrash={filter === "trash"}
                folders={folders}
                selected={selection.includes(doc.id)}
                selectionActive={selectionActive}
                onToggleSelect={() => toggleSelect(doc.id)}
                onOpen={() => openDoc(doc.id)}
                onStar={() => toggleStar(doc.id)}
                onRename={() => { setRenaming(doc); setRenameValue(doc.title) }}
                onTrash={() => { void setTrashed(doc.id, true); toast({ title: t("Moved to trash"), description: doc.title }) }}
                onRestore={() => { void setTrashed(doc.id, false); toast({ title: t("Restored"), description: doc.title }) }}
                onDelete={() => setDeleting(doc)}
                onDuplicate={() => { void duplicateDoc(doc.id); toast({ title: t("Copy created") }) }}
                onMoveToFolder={(folderId) => {
                  void moveToFolder(doc.id, folderId)
                  const f = folders.find((x) => x.id === folderId)
                  toast({ title: f ? t("Moved to “{name}”", { name: f.name }) : t("Removed from folder") })
                }}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {visible.map((doc, i) => (
              <DocRow
                key={doc.id}
                doc={doc}
                index={i}
                inTrash={filter === "trash"}
                folders={folders}
                selected={selection.includes(doc.id)}
                selectionActive={selectionActive}
                onToggleSelect={() => toggleSelect(doc.id)}
                onOpen={() => openDoc(doc.id)}
                onStar={() => toggleStar(doc.id)}
                onRename={() => { setRenaming(doc); setRenameValue(doc.title) }}
                onTrash={() => { void setTrashed(doc.id, true); toast({ title: t("Moved to trash"), description: doc.title }) }}
                onRestore={() => { void setTrashed(doc.id, false); toast({ title: t("Restored"), description: doc.title }) }}
                onDelete={() => setDeleting(doc)}
                onDuplicate={() => { void duplicateDoc(doc.id); toast({ title: t("Copy created") }) }}
                onMoveToFolder={(folderId) => {
                  void moveToFolder(doc.id, folderId)
                  const f = folders.find((x) => x.id === folderId)
                  toast({ title: f ? t("Moved to “{name}”", { name: f.name }) : t("Removed from folder") })
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Rename document")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            maxLength={120}
            className="h-10"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>{t("Cancel")}</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>{t("Rename")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete forever confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete “{title}” forever?", { title: deleting?.title ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This can’t be undone. The document will be permanently removed.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t("Delete forever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Batch delete-forever confirm (mirrors the single-doc flow) */}
      <AlertDialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete {n} documents forever?", { n: selection.length })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This can’t be undone. The selected documents will be permanently removed.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmBatchDelete(false)
                void runBatch("deleteForever")
              }}
            >
              {t("Delete forever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk tag picker: pick/create tags, applied additively to the selection */}
      <BulkTagDialog
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        count={selection.length}
        busy={busy === "tag"}
        onApply={(tagIds) => {
          setBulkTagOpen(false)
          void runBatch("tag", undefined, undefined, tagIds)
        }}
      />

      {/* Bulk rename: find & replace or numbered patterns, live preview */}
      <BulkRenameDialog
        open={bulkRenameOpen}
        onOpenChange={setBulkRenameOpen}
        docs={visible
          .filter((d) => selection.includes(d.id))
          .map((d) => ({ id: d.id, title: d.title }))}
        busy={busy === "rename"}
        onApply={(pairs) => {
          setBulkRenameOpen(false)
          void applyBulkRename(pairs)
        }}
      />

      {/* Floating bulk-action bar (portaled to body: the animate-view-in wrapper
          keeps a persistent transform, which would break viewport-fixed children) */}
      {selectionActive &&
        !loading &&
        createPortal(
          <BatchActionBar
            count={selection.length}
            inTrash={filter === "trash"}
            folders={folders}
            busy={busy}
            onRun={runBatch}
            onOpenTags={() => setBulkTagOpen(true)}
            onOpenRename={() => setBulkRenameOpen(true)}
            onClose={clearSelection}
          />,
          document.body
        )}
    </section>
  )
}

interface DocActions {
  onOpen: () => void
  onStar: () => void
  onRename: () => void
  onTrash: () => void
  onRestore: () => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveToFolder: (folderId: string | null) => void
}

function MoveToSubmenu({
  folders,
  docFolderId,
  onPick,
}: {
  folders: FolderDTO[]
  docFolderId: string | null | undefined
  onPick: (folderId: string | null) => void
}) {
  const { t } = useI18n()
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <FolderInput className="h-4 w-4" /> {t("Move to")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        <DropdownMenuItem onClick={() => onPick(null)}>
          <Folder className="h-4 w-4" /> {t("No folder")}
          {!docFolderId && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        {folders.length > 0 && <DropdownMenuSeparator />}
        {folders.map((f) => (
          <DropdownMenuItem key={f.id} onClick={() => onPick(f.id)}>
            <Folder className="h-4 w-4" style={{ color: f.color }} /> {f.name}
            {docFolderId === f.id && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/** "Add tags" submenu: checkbox per tag + inline "New tag…" creation (applied to this doc) */
function AddTagsSubmenu({ doc }: { doc: DocumentMeta }) {
  const tags = useDocsStore((s) => s.tags)
  const setDocTags = useDocsStore((s) => s.setDocTags)
  const createTag = useDocsStore((s) => s.createTag)
  const { toast } = useToast()
  const { t } = useI18n()
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState<string>(DEFAULT_TAG_COLOR)
  const docTagIds = new Set((doc.tags ?? []).map((tg) => tg.id))

  const toggleTag = (tagId: string) => {
    const ids = (doc.tags ?? []).map((tg) => tg.id)
    void setDocTags(doc.id, ids.includes(tagId) ? ids.filter((i) => i !== tagId) : [...ids, tagId])
  }

  const confirmCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const tag = await createTag(trimmed, color)
    if (tag) {
      const ids = (doc.tags ?? []).map((tg) => tg.id)
      if (!ids.includes(tag.id)) void setDocTags(doc.id, [...ids, tag.id])
      toast({ title: t("Tag created"), description: t("“{name}” added to this document.", { name: tag.name }) })
      setCreating(false)
      setName("")
    } else {
      toast({ title: t("Couldn’t create tag"), description: t("Names must be unique."), variant: "destructive" })
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Tag className="h-4 w-4" /> {t("Add tags")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        {tags.map((tag) => (
          <DropdownMenuCheckboxItem
            key={tag.id}
            checked={docTagIds.has(tag.id)}
            onCheckedChange={() => toggleTag(tag.id)}
            onSelect={(e) => e.preventDefault()}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate">{tag.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {tags.length > 0 && <DropdownMenuSeparator />}
        {creating ? (
          <div
            className="flex flex-col gap-1.5 px-2 py-1.5"
            onBlur={(e) => {
              // cancel only when focus leaves the whole creation form (palette clicks stay inside)
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCreating(false)
            }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // stop the Radix menu typeahead from stealing printable keys / arrows
                  e.stopPropagation()
                  if (e.key === "Enter") void confirmCreate()
                  if (e.key === "Escape") setCreating(false)
                }}
                placeholder={t("Tag name")}
                aria-label={t("New tag name")}
                className="h-8 rounded-md text-[13px]"
                maxLength={24}
              />
            </div>
            <div className="pl-6">
              <TagColorPalette value={color} onChange={setColor} />
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setCreating(true)
              setName("")
            }}
          >
            <Plus className="h-4 w-4" /> {t("New tag…")}
          </DropdownMenuItem>
        )}
        {tags.length === 0 && !creating && (
          <p className="px-2 py-1.5 text-[11.5px] leading-relaxed text-muted-foreground/80">
            {t("No tags yet. Create one to label documents.")}
          </p>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function CardMenu({
  doc,
  inTrash,
  folders,
  ...a
}: DocActions & { doc: DocumentMeta; inTrash: boolean; folders: FolderDTO[] }) {
  const { t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="icon"
          aria-label={t("Actions for {title}", { title: doc.title })}
          className="h-8 w-8 rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={a.onOpen}><FolderOpen className="h-4 w-4" /> {t("Open")}</DropdownMenuItem>
        {!inTrash && (
          <>
            <DropdownMenuItem onClick={a.onStar}>
              {doc.starred ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
              {doc.starred ? t("Remove star") : t("Add star")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={a.onRename}><Pencil className="h-4 w-4" /> {t("Rename")}</DropdownMenuItem>
            <DropdownMenuItem onClick={a.onDuplicate}><Copy className="h-4 w-4" /> {t("Make a copy")}</DropdownMenuItem>
            <AddTagsSubmenu doc={doc} />
            <MoveToSubmenu folders={folders} docFolderId={doc.folderId} onPick={a.onMoveToFolder} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={a.onTrash} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> {t("Move to trash")}
            </DropdownMenuItem>
          </>
        )}
        {inTrash && (
          <>
            <DropdownMenuItem onClick={a.onRestore}><RotateCcw className="h-4 w-4" /> {t("Restore")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={a.onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> {t("Delete forever")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DocCard({
  doc,
  index,
  inTrash,
  folders,
  selected,
  selectionActive,
  onToggleSelect,
  ...actions
}: DocActions & {
  doc: DocumentMeta
  index: number
  inTrash: boolean
  folders: FolderDTO[]
  selected: boolean
  selectionActive: boolean
  onToggleSelect: () => void
}) {
  const { t, lang } = useI18n()
  const folder = folders.find((f) => f.id === doc.folderId)
  const tagFilter = useDocsStore((s) => s.tagFilter)
  const setTagFilter = useDocsStore((s) => s.setTagFilter)
  const docTags = doc.tags ?? []
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: docDragId(doc.id),
    disabled: inTrash,
  })
  return (
    <div
      ref={dragRef}
      {...dragAttrs}
      {...dragListeners}
      role="button"
      tabIndex={0}
      onClick={() => {
        // selection mode: clicking the body toggles selection instead of opening
        if (selectionActive) onToggleSelect()
        else actions.onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (selectionActive) onToggleSelect()
          else actions.onOpen()
        }
      }}
      className={cn(
        "animate-card-in group flex w-[168px] cursor-pointer flex-col rounded-lg p-2 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
        isDragging && "opacity-40",
        selected && "bg-primary/5 ring-1 ring-primary/40"
      )}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      aria-label={selectionActive ? t("Select {title}", { title: doc.title }) : t("Open {title}", { title: doc.title })}
      aria-pressed={selectionActive ? selected : undefined}
    >
      <div className="relative overflow-hidden rounded-sm border elev-1 transition-[border-color,box-shadow] duration-200 group-hover:border-foreground/25 group-hover:elev-2 group-focus-visible:border-foreground/25 group-focus-visible:elev-2">
        <DocPreview html={doc.content ?? doc.snippet} width={152} className="mx-auto" />
        {/* multi-select checkbox (48px hit area incl. padding) */}
        <div
          className={cn(
            "absolute left-0 top-0 z-10 transition-opacity",
            selectionActive || selected
              ? "opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
          )}
        >
          <SelectCheckbox checked={selected} onChange={onToggleSelect} title={doc.title} />
        </div>
        {doc.starred && !inTrash && (
          <Star className="absolute right-1.5 top-1.5 h-4 w-4 fill-amber-400 text-amber-400 drop-shadow transition-transform duration-200 group-hover:scale-110" aria-label={t("Starred")} />
        )}
        {inTrash && (
          <div
            className={cn(
              "absolute left-1.5 top-1.5 rounded-[4px] bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white transition-opacity",
              selectionActive || selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"
            )}
          >
            {t("In trash")}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{doc.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {folder && (
              <span className="mr-1 inline-flex items-center gap-0.5 align-baseline text-[11px]" style={{ color: folder.color }}>
                <Folder className="inline h-3 w-3" /> {folder.name}
              </span>
            )}
            {relativeTime(doc.updatedAt, lang)}
          </p>
          {docTags.length > 0 && !inTrash && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {docTags.slice(0, 3).map((tg) => (
                <TagChip
                  key={tg.id}
                  tag={tg}
                  active={tagFilter === tg.id}
                  onFilter={() => setTagFilter(tagFilter === tg.id ? null : tg.id)}
                />
              ))}
              {docTags.length > 3 && (
                <TagOverflowChip count={docTags.length - 3} names={docTags.slice(3).map((tg) => tg.name).join(", ")} />
              )}
            </div>
          )}
        </div>
        <CardMenu doc={doc} inTrash={inTrash} folders={folders} {...actions} />
      </div>
    </div>
  )
}

function DocRow({
  doc,
  index,
  inTrash,
  folders,
  selected,
  selectionActive,
  onToggleSelect,
  ...actions
}: DocActions & {
  doc: DocumentMeta
  index: number
  inTrash: boolean
  folders: FolderDTO[]
  selected: boolean
  selectionActive: boolean
  onToggleSelect: () => void
}) {
  const { t, lang } = useI18n()
  const folder = folders.find((f) => f.id === doc.folderId)
  const tagFilter = useDocsStore((s) => s.tagFilter)
  const setTagFilter = useDocsStore((s) => s.setTagFilter)
  const docTags = doc.tags ?? []
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: docDragId(doc.id),
    disabled: inTrash,
  })
  return (
    <div
      ref={dragRef}
      {...dragAttrs}
      {...dragListeners}
      role="button"
      tabIndex={0}
      onClick={() => {
        // selection mode: clicking the body toggles selection instead of opening
        if (selectionActive) onToggleSelect()
        else actions.onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (selectionActive) onToggleSelect()
          else actions.onOpen()
        }
      }}
      className={cn(
        "animate-card-in group flex cursor-pointer items-center gap-3 border-b px-4 py-3 outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50",
        index === 0 && "rounded-t-lg", index % 2 === 1 && "bg-muted/30",
        isDragging && "opacity-40",
        selected && "bg-primary/5 ring-1 ring-primary/35 ring-inset"
      )}
      aria-label={selectionActive ? t("Select {title}", { title: doc.title }) : t("Open {title}", { title: doc.title })}
      aria-pressed={selectionActive ? selected : undefined}
    >
      {/* leading slot: file icon swaps for the 48px multi-select checkbox */}
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <FileText
          className={cn(
            "h-5 w-5 text-muted-foreground transition-opacity",
            selectionActive || selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "absolute inset-0 transition-opacity",
            selectionActive || selected
              ? "opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
          )}
        >
          <SelectCheckbox checked={selected} onChange={onToggleSelect} title={doc.title} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {doc.title}
          {doc.starred && !inTrash && <Star className="ml-1.5 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {folder && (
            <span className="mr-1 inline-flex items-center gap-0.5 align-baseline text-[11px]" style={{ color: folder.color }}>
              <Folder className="inline h-3 w-3" /> {folder.name}
            </span>
          )}
          {doc.snippet || t("Empty document")}
        </p>
        {docTags.length > 0 && !inTrash && (
          <div className="mt-1 flex flex-wrap gap-1">
            {docTags.slice(0, 3).map((tg) => (
              <TagChip
                key={tg.id}
                tag={tg}
                active={tagFilter === tg.id}
                onFilter={() => setTagFilter(tagFilter === tg.id ? null : tg.id)}
              />
            ))}
            {docTags.length > 3 && (
              <TagOverflowChip count={docTags.length - 3} names={docTags.slice(3).map((tg) => tg.name).join(", ")} />
            )}
          </div>
        )}
      </div>
      <span className="tnum hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">{t("{n} words", { n: doc.wordCount })}</span>
      <span className="tnum hidden w-32 shrink-0 text-right text-xs text-muted-foreground md:block">{relativeTime(doc.updatedAt, lang)}</span>
      <CardMenu doc={doc} inTrash={inTrash} folders={folders} {...actions} />
    </div>
  )
}

function EmptyState({ filter, search, tag }: { filter: string; search: boolean; tag?: TagDTO | null }) {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      {search ? (
        <SearchX className="h-10 w-10 text-muted-foreground/40" />
      ) : tag ? (
        <Tag className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
      ) : filter === "trash" ? (
        <Trash className="h-10 w-10 text-muted-foreground/40" />
      ) : (
        <FileText className="h-10 w-10 text-muted-foreground/40" />
      )}
      <p className="font-editorial mt-4 text-[15.5px] font-medium italic tracking-tight text-foreground/80">
        {search
          ? t("No documents match your search")
          : tag
            ? t("No documents with this tag")
            : filter === "trash"
              ? t("Trash is empty")
              : filter === "starred"
                ? t("No starred documents yet")
                : t("No documents yet")}
      </p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {search
          ? t("Try a different keyword or clear the search field.")
          : tag
            ? t("No documents in this view carry the “{name}” label.", { name: tag.name })
            : filter === "trash"
              ? t("Deleted documents will appear here before being removed forever.")
              : t("Pick a template above or start from a blank page to create your first document.")}
      </p>
      {!search && !tag && filter === "all" && (
        <Button
          className="mt-4"
          onClick={async () => {
            const id = await createDoc({ templateId: "blank" })
            if (id) openDoc(id)
          }}
        >
          {t("Create a document")}
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Multi-select primitives                                             */
/* ------------------------------------------------------------------ */

/**
 * Circular Google-Drive-style checkbox. The button itself is a 48px hit
 * target (padding included); the visible circle is 20px inside it.
 * stopPropagation keeps the parent card click (open/toggle) and the dnd-kit
 * drag sensor from reacting to checkbox interaction.
 */
function SelectCheckbox({
  checked,
  onChange,
  title,
}: {
  checked: boolean
  onChange: () => void
  title: string
}) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={t("Select {title}", { title })}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // let the native button click fire without bubbling to the card
        if (e.key === "Enter" || e.key === " ") e.stopPropagation()
      }}
      className="flex h-12 w-12 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/50 bg-white/95 text-transparent shadow-sm dark:border-muted-foreground/60 dark:bg-popover/95"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </button>
  )
}

/**
 * Tag picker for bulk tagging: checkbox chips of existing tags plus an
 * inline create row (name + color palette). Selection is applied
 * additively via runBatch("tag").
 */
function BulkTagDialog({
  open,
  onOpenChange,
  count,
  busy,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  busy: boolean
  onApply: (tagIds: string[]) => void
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const tags = useDocsStore((s) => s.tags)
  const createTag = useDocsStore((s) => s.createTag)

  const [selected, setSelected] = React.useState<string[]>([])
  const [newName, setNewName] = React.useState("")
  const [newColor, setNewColor] = React.useState(DEFAULT_TAG_COLOR)
  const [creating, setCreating] = React.useState(false)

  // reset the draft state whenever the dialog (re)opens
  React.useEffect(() => {
    if (open) {
      setSelected([])
      setNewName("")
      setNewColor(DEFAULT_TAG_COLOR)
    }
  }, [open])

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const createAndSelect = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    const tag = await createTag(name, newColor)
    setCreating(false)
    if (!tag) {
      toast({ title: t("Couldn’t create the tag"), variant: "destructive" })
      return
    }
    setNewName("")
    setNewColor(DEFAULT_TAG_COLOR)
    setSelected((cur) => (cur.includes(tag.id) ? cur : [...cur, tag.id]))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add tags to {n} documents", { n: count })}</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("Existing tags")}>
              {tags.map((tag) => {
                const on = selected.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                    aria-pressed={on}
                    aria-label={t("Tag {name}", { name: tag.name })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] outline-none transition-colors",
                      on
                        ? "border-primary/60 bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <TagDot color={tag.color} className="h-3 w-3" />
                    {tag.name}
                    {on && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              {t("No tags yet — create one below.")}
            </p>
          )}

          {/* inline create row */}
          <div className="mt-4 rounded-lg border p-2">
            <div className="flex items-center gap-2">
              <TagDot color={newColor} className="ml-1 h-3.5 w-3.5 shrink-0" />
              <Input
                value={newName}
                maxLength={40}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void createAndSelect()
                  }
                }}
                placeholder={t("New tag name…")}
                aria-label={t("New tag name")}
                className="h-8 flex-1 border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={!newName.trim() || creating}
                onClick={() => void createAndSelect()}
                aria-label={t("Create tag")}
                className="h-8 w-8 shrink-0 rounded-full"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-1.5 pl-6">
              <TagColorPalette value={newColor} onChange={setNewColor} className="flex-wrap" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={() => onApply(selected)}
            disabled={busy || selected.length === 0}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Tag className="h-4 w-4" />
            )}
            {t("Apply to {n} documents", { n: count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Bulk rename dialog — Google-Drive-add-on parity: find & replace inside
 * names, or numbered patterns with {n} (sequence) / {title} (current name)
 * placeholders. A live preview lists every resulting name; only documents
 * whose name actually changes are PATCHed on apply.
 */
function BulkRenameDialog({
  open,
  onOpenChange,
  docs,
  busy,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  docs: { id: string; title: string }[]
  busy: boolean
  onApply: (pairs: { id: string; title: string }[]) => void
}) {
  const { t } = useI18n()
  const [mode, setMode] = React.useState<"replace" | "number">("replace")
  const [find, setFind] = React.useState("")
  const [repl, setRepl] = React.useState("")
  const [pattern, setPattern] = React.useState("")
  const [start, setStart] = React.useState(1)

  // reset the draft whenever the dialog (re)opens
  React.useEffect(() => {
    if (open) {
      setMode("replace")
      setFind("")
      setRepl("")
      setPattern("")
      setStart(1)
    }
  }, [open])

  const rows = React.useMemo(() => {
    const n0 = Number.isFinite(start) ? Math.trunc(start) : 1
    return docs.map((d, i) => {
      let next = d.title
      if (mode === "replace") {
        if (find) next = d.title.split(find).join(repl)
      } else {
        const eff = pattern.trim() || "{title} {n}"
        next = eff.replace(/\{title\}/g, d.title).replace(/\{n\}/g, String(n0 + i))
      }
      return { id: d.id, title: d.title, next: next.trim().slice(0, 150) }
    })
  }, [docs, mode, find, repl, pattern, start])

  const changed = rows.filter((r) => r.next !== r.title && r.next !== "")
  const preview = rows.slice(0, 6)
  const more = rows.length - preview.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Rename {n} documents", { n: docs.length })}</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "replace" | "number")}>
          <TabsList className="w-full">
            <TabsTrigger value="replace" className="flex-1">{t("Find & replace")}</TabsTrigger>
            <TabsTrigger value="number" className="flex-1">{t("Add numbering")}</TabsTrigger>
          </TabsList>

          <TabsContent value="replace" className="space-y-3 pt-2">
            <div className="space-y-2">
              <label htmlFor="bulk-find" className="text-[13px] font-medium">{t("Find")}</label>
              <Input
                id="bulk-find"
                value={find}
                maxLength={100}
                autoFocus
                onChange={(e) => setFind(e.target.value)}
                placeholder={t("Text to find in the names…")}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bulk-repl" className="text-[13px] font-medium">{t("Replace with")}</label>
              <Input
                id="bulk-repl"
                value={repl}
                maxLength={150}
                onChange={(e) => setRepl(e.target.value)}
                placeholder={t("Replacement text…")}
              />
              <p className="text-xs text-muted-foreground">{t("Case-sensitive. Empty replacement deletes the text.")}</p>
            </div>
          </TabsContent>

          <TabsContent value="number" className="space-y-3 pt-2">
            <div className="space-y-2">
              <label htmlFor="bulk-pattern" className="text-[13px] font-medium">{t("Name pattern")}</label>
              <Input
                id="bulk-pattern"
                value={pattern}
                maxLength={120}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={t("e.g. Report {n}")}
              />
              <p className="text-xs text-muted-foreground">
                {t("{n} = sequence number, {title} = current name. Leave empty to use “{title} {n}”.")}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="bulk-start" className="text-[13px] font-medium">{t("Start number")}</label>
              <Input
                id="bulk-start"
                type="number"
                min={0}
                step={1}
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="w-28"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* live preview — every resulting name before anything is applied */}
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("Preview")}
          </p>
          <div className="max-h-44 overflow-y-auto px-3 py-2" role="list" aria-label={t("Preview")}>
            {preview.map((r) => {
              const same = r.next === r.title || r.next === ""
              return (
                <div key={r.id} className="flex items-center gap-2 py-1 text-[13px]" role="listitem">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={r.title}>
                    {r.title}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                  <span
                    className={cn("min-w-0 flex-1 truncate", same ? "italic text-muted-foreground/70" : "font-medium")}
                    title={r.next}
                  >
                    {same ? t("No change") : r.next}
                  </span>
                </div>
              )
            })}
            {more > 0 && (
              <p className="py-1 pl-1 text-xs text-muted-foreground">+{more}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button onClick={() => onApply(changed)} disabled={busy || changed.length === 0} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            {changed.length > 0
              ? t("Rename {n} documents", { n: changed.length })
              : t("Rename")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Tooltip wrapper for the icon buttons in the bulk-action bar. */
function BarTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Floating bulk-action bar, Google-Drive style: pinned to the viewport bottom
 * center, elevated pill (theme-adaptive), horizontally scrollable at 375px.
 * Rendered via createPortal by DocsGrid.
 */
function BatchActionBar({
  count,
  inTrash,
  folders,
  busy,
  onRun,
  onOpenTags,
  onOpenRename,
  onClose,
}: {
  count: number
  inTrash: boolean
  folders: FolderDTO[]
  busy: BatchOp | null
  onRun: (op: BatchOp, folderId?: string | null, folderName?: string, tagIds?: string[]) => void
  onOpenTags: () => void
  onOpenRename: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const disabled = busy !== null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2" role="toolbar" aria-label={t("Bulk actions")}>
      <div
        className={cn(
          "no-scrollbar flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-x-auto rounded-full border bg-popover/95 p-1 text-popover-foreground backdrop-blur",
          "shadow-[0_2px_6px_rgba(35,32,28,0.10),0_12px_32px_rgba(35,32,28,0.18)]",
          "dark:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_12px_32px_rgba(0,0,0,0.55)]"
        )}
      >
        <span className="tnum shrink-0 whitespace-nowrap px-2.5 text-[13px] font-medium">
          {t("{n} selected", { n: count })}
        </span>
        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        <BarTooltip label={t("Star selected")}>
          <Button
            variant="ghost" size="icon" disabled={disabled}
            aria-label={t("Star selected")}
            onClick={() => onRun("star")}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            {busy === "star" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Star className="h-4.5 w-4.5" />}
          </Button>
        </BarTooltip>

        <BarTooltip label={t("Unstar selected")}>
          <Button
            variant="ghost" size="icon" disabled={disabled}
            aria-label={t("Unstar selected")}
            onClick={() => onRun("unstar")}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            {busy === "unstar" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <StarOff className="h-4.5 w-4.5" />}
          </Button>
        </BarTooltip>

        {/* Bulk tag: opens the tag picker dialog (additive apply) */}
        {!inTrash && (
          <BarTooltip label={t("Add tags")}>
            <Button
              variant="ghost" disabled={disabled}
              aria-label={t("Add tags")}
              onClick={onOpenTags}
              className="h-9 shrink-0 gap-1.5 rounded-full px-2.5"
            >
              {busy === "tag" ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <Tag className="h-4.5 w-4.5" />
              )}
              <span className="hidden text-[13px] font-medium sm:inline">{t("Tags")}</span>
            </Button>
          </BarTooltip>
        )}

        {/* Bulk rename: find & replace / numbering with live preview */}
        <BarTooltip label={t("Rename selected")}>
          <Button
            variant="ghost" disabled={disabled}
            aria-label={t("Rename selected")}
            onClick={onOpenRename}
            className="h-9 shrink-0 gap-1.5 rounded-full px-2.5"
          >
            {busy === "rename" ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Pencil className="h-4.5 w-4.5" />
            )}
            <span className="hidden text-[13px] font-medium sm:inline">{t("Rename")}</span>
          </Button>
        </BarTooltip>

        {/* Move to folder: folders + the home root */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost" disabled={disabled}
              aria-label={t("Move to")}
              className="h-9 shrink-0 gap-1.5 rounded-full px-2.5"
            >
              {busy === "move" ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <FolderInput className="h-4.5 w-4.5" />
              )}
              <span className="hidden text-[13px] font-medium sm:inline">{t("Move to")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52 max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => onRun("move", null, undefined)}>
              <Home className="h-4 w-4" /> {t("Home")}
            </DropdownMenuItem>
            {folders.length > 0 && <DropdownMenuSeparator />}
            {folders.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => onRun("move", f.id, f.name)}>
                <Folder className="h-4 w-4" style={{ color: f.color }} /> {f.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {!inTrash ? (
          <BarTooltip label={t("Move to trash")}>
            <Button
              variant="ghost" size="icon" disabled={disabled}
              aria-label={t("Move to trash")}
              onClick={() => onRun("trash")}
              className="h-9 w-9 shrink-0 rounded-full"
            >
              {busy === "trash" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Trash2 className="h-4.5 w-4.5" />}
            </Button>
          </BarTooltip>
        ) : (
          <>
            <BarTooltip label={t("Restore")}>
              <Button
                variant="ghost" size="icon" disabled={disabled}
                aria-label={t("Restore")}
                onClick={() => onRun("restore")}
                className="h-9 w-9 shrink-0 rounded-full"
              >
                {busy === "restore" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <RotateCcw className="h-4.5 w-4.5" />}
              </Button>
            </BarTooltip>
            <BarTooltip label={t("Delete forever")}>
              <Button
                variant="ghost" size="icon" disabled={disabled}
                aria-label={t("Delete forever")}
                onClick={() => onRun("deleteForever")}
                className="h-9 w-9 shrink-0 rounded-full text-destructive hover:text-destructive"
              >
                {busy === "deleteForever" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Trash2 className="h-4.5 w-4.5" />}
              </Button>
            </BarTooltip>
          </>
        )}

        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
        <BarTooltip label={t("Clear selection")}>
          <Button
            variant="ghost" size="icon" disabled={disabled}
            aria-label={t("Clear selection")}
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <X className="h-4.5 w-4.5" />
          </Button>
        </BarTooltip>
      </div>
    </div>
  )
}
