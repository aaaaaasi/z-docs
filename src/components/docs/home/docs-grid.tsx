"use client"

import * as React from "react"
import { useDraggable } from "@dnd-kit/core"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useDocsStore } from "@/store/docs-store"
import type { DocumentMeta, FolderDTO, TagDTO } from "@/lib/docs-types"
import { relativeTime } from "@/lib/doc-utils"
import { DocPreview } from "@/components/docs/doc-preview"
import { docDragId } from "./doc-dnd"
import { DEFAULT_TAG_COLOR, TagChip, TagColorPalette, TagFilterChip, TagOverflowChip } from "./tag-ui"
import { useI18n } from "@/lib/i18n"
import {
  FileText, MoreVertical, Star, StarOff, Pencil, Copy, Trash2, RotateCcw, Trash, LayoutGrid, List, FolderOpen, SearchX, FolderInput, Folder, Tag, Plus
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
  const { toast } = useToast()

  const [sort, setSort] = React.useState<SortKey>("updated")
  const [renaming, setRenaming] = React.useState<DocumentMeta | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [deleting, setDeleting] = React.useState<DocumentMeta | null>(null)

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
  ...actions
}: DocActions & { doc: DocumentMeta; index: number; inTrash: boolean; folders: FolderDTO[] }) {
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
      onClick={actions.onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && actions.onOpen()}
      className={cn(
        "animate-card-in group flex w-[168px] cursor-pointer flex-col rounded-lg p-2 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
        isDragging && "opacity-40"
      )}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      aria-label={t("Open {title}", { title: doc.title })}
    >
      <div className="relative overflow-hidden rounded-sm border elev-1 transition-[border-color,box-shadow] duration-200 group-hover:border-foreground/25 group-hover:elev-2 group-focus-visible:border-foreground/25 group-focus-visible:elev-2">
        <DocPreview html={doc.content ?? doc.snippet} width={152} className="mx-auto" />
        {doc.starred && !inTrash && (
          <Star className="absolute right-1.5 top-1.5 h-4 w-4 fill-amber-400 text-amber-400 drop-shadow transition-transform duration-200 group-hover:scale-110" aria-label={t("Starred")} />
        )}
        {inTrash && (
          <div className="absolute left-1.5 top-1.5 rounded-[4px] bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
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
  ...actions
}: DocActions & { doc: DocumentMeta; index: number; inTrash: boolean; folders: FolderDTO[] }) {
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
      onClick={actions.onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && actions.onOpen()}
      className={cn(
        "animate-card-in group flex cursor-pointer items-center gap-3 border-b px-4 py-3 outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50",
        index === 0 && "rounded-t-lg", index % 2 === 1 && "bg-muted/30",
        isDragging && "opacity-40"
      )}
      aria-label={t("Open {title}", { title: doc.title })}
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
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
