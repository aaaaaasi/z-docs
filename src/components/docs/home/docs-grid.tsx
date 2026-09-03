"use client"

import * as React from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
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
import type { DocumentMeta } from "@/lib/docs-types"
import { relativeTime } from "@/lib/doc-utils"
import { DocPreview } from "@/components/docs/doc-preview"
import {
  FileText, MoreVertical, Star, StarOff, Pencil, Copy, Trash2, RotateCcw, Trash, LayoutGrid, List, FolderOpen, SearchX
} from "lucide-react"
import { cn } from "@/lib/utils"

type SortKey = "updated" | "created" | "title"

function titleFor(filter: string) {
  if (filter === "trash") return "Trash"
  if (filter === "starred") return "Starred"
  return "Recent documents"
}

export function DocsGrid() {
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

  const confirmRename = async () => {
    if (!renaming) return
    const name = renameValue.trim()
    if (!name) return
    await renameDoc(renaming.id, name)
    toast({ title: "Renamed", description: `“${name}”` })
    setRenaming(null)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    await deleteForever(deleting.id)
    toast({ title: "Deleted permanently", variant: "destructive" })
    setDeleting(null)
  }

  return (
    <section aria-label="Document list" className="flex-1 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">{titleFor(filter)}</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? "document" : "documents"}
              {searchQuery ? ` matching “${searchQuery}”` : ""}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-[150px] rounded-full text-sm" aria-label="Sort documents">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last edited</SelectItem>
                <SelectItem value="created">Date created</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-full border p-0.5">
              <Button
                variant="ghost" size="icon"
                aria-label="Grid view"
                onClick={() => setLayout("grid")}
                className={cn("h-8 w-8 rounded-full", layout === "grid" ? "bg-muted" : "text-muted-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                aria-label="List view"
                onClick={() => setLayout("list")}
                className={cn("h-8 w-8 rounded-full", layout === "list" ? "bg-muted" : "text-muted-foreground")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error} — <button className="underline underline-offset-2" onClick={() => useDocsStore.getState().refresh()}>retry</button>
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
        ) : sorted.length === 0 ? (
          <EmptyState filter={filter} search={!!searchQuery} />
        ) : layout === "grid" ? (
          <div className="flex flex-wrap gap-5">
            {sorted.map((doc, i) => (
              <DocCard
                key={doc.id}
                doc={doc}
                index={i}
                inTrash={filter === "trash"}
                onOpen={() => openDoc(doc.id)}
                onStar={() => toggleStar(doc.id)}
                onRename={() => { setRenaming(doc); setRenameValue(doc.title) }}
                onTrash={() => { void setTrashed(doc.id, true); toast({ title: "Moved to trash", description: doc.title }) }}
                onRestore={() => { void setTrashed(doc.id, false); toast({ title: "Restored", description: doc.title }) }}
                onDelete={() => setDeleting(doc)}
                onDuplicate={() => { void duplicateDoc(doc.id); toast({ title: "Copy created" }) }}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            {sorted.map((doc, i) => (
              <DocRow
                key={doc.id}
                doc={doc}
                index={i}
                inTrash={filter === "trash"}
                onOpen={() => openDoc(doc.id)}
                onStar={() => toggleStar(doc.id)}
                onRename={() => { setRenaming(doc); setRenameValue(doc.title) }}
                onTrash={() => { void setTrashed(doc.id, true); toast({ title: "Moved to trash", description: doc.title }) }}
                onRestore={() => { void setTrashed(doc.id, false); toast({ title: "Restored", description: doc.title }) }}
                onDelete={() => setDeleting(doc)}
                onDuplicate={() => { void duplicateDoc(doc.id); toast({ title: "Copy created" }) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
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
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete forever confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}” forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone. The document will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete forever
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
}

function CardMenu({ doc, inTrash, ...a }: DocActions & { doc: DocumentMeta; inTrash: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="icon"
          aria-label={`Actions for ${doc.title}`}
          className="h-8 w-8 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={a.onOpen}><FolderOpen className="h-4 w-4" /> Open</DropdownMenuItem>
        {!inTrash && (
          <>
            <DropdownMenuItem onClick={a.onStar}>
              {doc.starred ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
              {doc.starred ? "Remove star" : "Add star"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={a.onRename}><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={a.onDuplicate}><Copy className="h-4 w-4" /> Make a copy</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={a.onTrash} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Move to trash
            </DropdownMenuItem>
          </>
        )}
        {inTrash && (
          <>
            <DropdownMenuItem onClick={a.onRestore}><RotateCcw className="h-4 w-4" /> Restore</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={a.onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Delete forever
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DocCard({ doc, index, inTrash, ...actions }: DocActions & { doc: DocumentMeta; index: number; inTrash: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={actions.onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && actions.onOpen()}
      className={cn(
        "animate-card-in group flex w-[168px] cursor-pointer flex-col rounded-lg p-2 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
      )}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      aria-label={`Open ${doc.title}`}
    >
      <div className="relative overflow-hidden rounded-sm border shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-md">
        <DocPreview html={doc.content} width={152} className="mx-auto" />
        {doc.starred && !inTrash && (
          <Star className="absolute right-1.5 top-1.5 h-4 w-4 fill-amber-400 text-amber-400 drop-shadow transition-transform duration-200 group-hover:scale-110" aria-label="Starred" />
        )}
        {inTrash && (
          <div className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            In trash
          </div>
        )}
      </div>
      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{doc.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {relativeTime(doc.updatedAt)}
          </p>
        </div>
        <CardMenu doc={doc} inTrash={inTrash} {...actions} />
      </div>
    </div>
  )
}

function DocRow({ doc, index, inTrash, ...actions }: DocActions & { doc: DocumentMeta; index: number; inTrash: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={actions.onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && actions.onOpen()}
      className={cn(
        "animate-card-in group flex cursor-pointer items-center gap-3 border-b px-4 py-3 outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50",
        index === 0 && "rounded-t-xl", index % 2 === 1 && "bg-muted/20"
      )}
      aria-label={`Open ${doc.title}`}
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {doc.title}
          {doc.starred && !inTrash && <Star className="ml-1.5 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{doc.snippet || "Empty document"}</p>
      </div>
      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">{doc.wordCount} words</span>
      <span className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground md:block">{relativeTime(doc.updatedAt)}</span>
      <CardMenu doc={doc} inTrash={inTrash} {...actions} />
    </div>
  )
}

function EmptyState({ filter, search }: { filter: string; search: boolean }) {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      {search ? (
        <SearchX className="h-10 w-10 text-muted-foreground/40" />
      ) : filter === "trash" ? (
        <Trash className="h-10 w-10 text-muted-foreground/40" />
      ) : (
        <FileText className="h-10 w-10 text-muted-foreground/40" />
      )}
      <p className="mt-4 text-sm font-medium">
        {search
          ? "No documents match your search"
          : filter === "trash"
            ? "Trash is empty"
            : filter === "starred"
              ? "No starred documents yet"
              : "No documents yet"}
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {search
          ? "Try a different keyword or clear the search field."
          : filter === "trash"
            ? "Deleted documents will appear here before being removed forever."
            : "Pick a template above or start from a blank page to create your first document."}
      </p>
      {!search && filter === "all" && (
        <Button
          className="mt-4 rounded-full"
          onClick={async () => {
            const id = await createDoc({ templateId: "blank" })
            if (id) openDoc(id)
          }}
        >
          Create a document
        </Button>
      )}
    </div>
  )
}
