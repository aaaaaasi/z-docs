"use client"

import * as React from "react"
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent, type DraggableAttributes,
} from "@dnd-kit/core"
import { FileText } from "lucide-react"
import { useDocsStore } from "@/store/docs-store"
import { useToast } from "@/hooks/use-toast"
import type { DocumentMeta } from "@/lib/docs-types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

/** dnd-kit synthetic listener map (onPointerDown etc.), kept structurally typed */
type DragListeners = Record<string, (event: React.SyntheticEvent) => void> | undefined

/** draggable id format: "doc:<docId>" */
const DOC_DRAG_PREFIX = "doc:"

export function docDragId(docId: string) {
  return DOC_DRAG_PREFIX + docId
}

function parseDocDragId(id: string): string | null {
  return id.startsWith(DOC_DRAG_PREFIX) ? id.slice(DOC_DRAG_PREFIX.length) : null
}

/** Props each draggable doc card merges onto its root element. */
export type DocDragHandle = {
  dragAttributes: DraggableAttributes
  dragListeners: DragListeners
  dragRef: (node: HTMLElement | null) => void
  isDragging: boolean
}

/* ------------------------------------------------------------------ */
/* Context: wraps the whole home layout; owns drag end → move-to-folder */
/* ------------------------------------------------------------------ */

export function HomeDndContext({ children }: { children: React.ReactNode }) {
  const [activeDoc, setActiveDoc] = React.useState<DocumentMeta | null>(null)
  const { toast } = useToast()
  const { t } = useI18n()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // small distance so plain clicks still open the document
      activationConstraint: { distance: 6 },
    })
  )

  const onDragStart = (e: DragStartEvent) => {
    const docId = parseDocDragId(String(e.active.id))
    const doc = docId ? useDocsStore.getState().documents.find((d) => d.id === docId) : null
    setActiveDoc(doc ?? null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const active = parseDocDragId(String(e.active.id))
    setActiveDoc(null)
    if (!active || !e.over) return
    const overId = String(e.over.id)
    const doc = useDocsStore.getState().documents.find((d) => d.id === active)
    if (!doc) return
    let targetFolder: string | null | null = null
    let matched = false
    if (overId === "drop:root") {
      targetFolder = null
      matched = true
    } else if (overId.startsWith("drop:folder:")) {
      targetFolder = overId.slice("drop:folder:".length)
      matched = true
    } else if (overId === "drop:trash") {
      matched = true
      if (!doc.trashed) {
        void useDocsStore.getState().setTrashed(active, true)
        toast({ title: t("Moved to trash"), description: doc.title })
      }
      return
    }
    if (!matched) return
    // no-op when dropped where it already lives
    if ((doc.folderId ?? null) === targetFolder) return
    void useDocsStore.getState().moveToFolder(active, targetFolder)
    const f = useDocsStore.getState().folders.find((x) => x.id === targetFolder)
    toast({ title: f ? t("Moved to “{name}”", { name: f.name }) : t("Removed from folder"), description: doc.title })
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDoc(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeDoc ? <DocDragGhost doc={activeDoc} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

/** Compact floating chip shown while a document is dragged. */
function DocDragGhost({ doc }: { doc: DocumentMeta }) {
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-md border bg-card px-3 py-2 elev-2">
      <FileText className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
      <span className="max-w-[200px] truncate text-[13px] font-medium">{doc.title}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Droppable: folder row or the "All documents" root                    */
/* ------------------------------------------------------------------ */

export function DropTarget({
  folderId,
  kind,
  children,
}: {
  folderId?: string
  kind: "folder" | "root" | "trash"
  children: React.ReactNode
}) {
  const id =
    kind === "folder" && folderId
      ? `drop:folder:${folderId}`
      : kind === "trash"
        ? "drop:trash"
        : "drop:root"
  const { setNodeRef, isOver, active } = useDroppable({ id })
  const engaged = isOver && !!active
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-[background-color,box-shadow] duration-150",
        engaged && "bg-primary/10 ring-1 ring-primary/40 ring-inset",
      )}
    >
      {children}
    </div>
  )
}
