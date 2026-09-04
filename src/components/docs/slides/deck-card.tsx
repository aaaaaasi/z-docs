"use client"

/**
 * Z-Slides — a deck card for the list grid: live mini preview of the first
 * slide, title, slide count + edited time, inline rename, star, and a
 * context menu (open / star / rename / duplicate / trash / restore /
 * delete forever with confirmation).
 */

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Copy,
  FolderOpen,
  MoreVertical,
  Pencil,
  Presentation,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
} from "lucide-react"
import { useSlidesStore } from "./deck-store"
import { SlideCard } from "./slide-render"
import { relativeTime } from "@/lib/doc-utils"
import type { DeckData, SlideDeckMeta } from "@/lib/workspace-types"

function DeckMenu({
  deck,
  inTrash,
  onOpen,
  onStar,
  onRename,
  onDuplicate,
  onTrash,
  onRestore,
  onDelete,
}: {
  deck: SlideDeckMeta
  inTrash: boolean
  onOpen: () => void
  onStar: () => void
  onRename: () => void
  onDuplicate: () => void
  onTrash: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${deck.title}`}
          className="h-8 w-8 rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onOpen}>
          <FolderOpen className="h-4 w-4" /> Open
        </DropdownMenuItem>
        {!inTrash && (
          <>
            <DropdownMenuItem onClick={onStar}>
              {deck.starred ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
              {deck.starred ? "Remove star" : "Add star"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" /> Make a copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onTrash}
            >
              <Trash2 className="h-4 w-4" /> Move to trash
            </DropdownMenuItem>
          </>
        )}
        {inTrash && (
          <>
            <DropdownMenuItem onClick={onRestore}>
              <RotateCcw className="h-4 w-4" /> Restore
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete forever
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DeckCard({
  deck,
  preview,
  index,
  inTrash,
  onOpen,
}: {
  deck: SlideDeckMeta
  preview: DeckData | null | undefined
  index: number
  inTrash: boolean
  onOpen: () => void
}) {
  const renameDeck = useSlidesStore((s) => s.renameDeck)
  const setDeckStar = useSlidesStore((s) => s.setDeckStar)
  const setDeckTrashed = useSlidesStore((s) => s.setDeckTrashed)
  const deleteDeckForever = useSlidesStore((s) => s.deleteDeckForever)
  const duplicateDeck = useSlidesStore((s) => s.duplicateDeck)
  const { toast } = useToast()

  const [renaming, setRenaming] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

  const slideCount = preview ? preview.slides.length : null

  const commitRename = async () => {
    setRenaming(false)
    const name = renameValue.trim()
    if (!name || name === deck.title) return
    const ok = await renameDeck(deck.id, name)
    if (ok) toast({ title: "Renamed", description: `“${name}”` })
    else toast({ title: "Rename failed", variant: "destructive" })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={renaming ? undefined : onOpen}
      onKeyDown={(e) => {
        if (renaming) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Open ${deck.title}`}
      className="animate-card-in group flex cursor-pointer flex-col rounded-lg p-2 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
    >
      <div className="relative overflow-hidden rounded-md border border-foreground/10 elev-1 transition-[border-color,box-shadow] duration-200 group-hover:border-foreground/25 group-hover:elev-2 group-focus-visible:border-foreground/25 group-focus-visible:elev-2">
        {preview ? (
          <SlideCard slide={preview.slides[0]} theme={preview.theme} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted/50">
            {preview === null ? (
              <Presentation className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
          </div>
        )}
        {deck.starred && !inTrash && (
          <Star
            className="absolute right-1.5 top-1.5 h-4 w-4 fill-amber-400 text-amber-400 drop-shadow transition-transform duration-200 group-hover:scale-110"
            aria-label="Starred"
          />
        )}
        {inTrash && (
          <div className="absolute left-1.5 top-1.5 rounded-[4px] bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
            In trash
          </div>
        )}
      </div>

      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <Input
              autoFocus
              value={renameValue}
              maxLength={120}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter") void commitRename()
                if (e.key === "Escape") setRenaming(false)
              }}
              onBlur={() => void commitRename()}
              aria-label="Presentation name"
              className="h-8 rounded-md text-sm"
            />
          ) : (
            <p className="truncate text-sm font-medium leading-tight">{deck.title}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {slideCount != null && (
              <>
                {slideCount} {slideCount === 1 ? "slide" : "slides"} ·{" "}
              </>
            )}
            edited {relativeTime(deck.updatedAt)}
          </p>
        </div>
        <DeckMenu
          deck={deck}
          inTrash={inTrash}
          onOpen={onOpen}
          onStar={() => void setDeckStar(deck.id, !deck.starred)}
          onRename={() => {
            setRenameValue(deck.title)
            setRenaming(true)
          }}
          onDuplicate={async () => {
            const ok = await duplicateDeck(deck)
            toast(
              ok
                ? { title: "Copy created", description: `“Copy of ${deck.title}”` }
                : { title: "Couldn’t create the copy", variant: "destructive" }
            )
          }}
          onTrash={() => {
            void setDeckTrashed(deck.id, true)
            toast({ title: "Moved to trash", description: deck.title })
          }}
          onRestore={() => {
            void setDeckTrashed(deck.id, false)
            toast({ title: "Restored", description: deck.title })
          }}
          onDelete={() => setDeleting(true)}
        />
      </div>

      <AlertDialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deck.title}” forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone. The presentation will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                void deleteDeckForever(deck.id)
                toast({ title: "Deleted permanently", variant: "destructive" })
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
