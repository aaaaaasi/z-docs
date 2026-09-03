"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SheetClose } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  Home, Star, Trash2, Plus, FileSpreadsheet, Presentation, FileClock, FormInput, Cloud,
  Folder, FolderPlus, Pencil, MoreVertical
} from "lucide-react"
import { useDocsStore } from "@/store/docs-store"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import type { FolderDTO } from "@/lib/docs-types"

function Wrap({ children, inSheet }: { children: ReactNode; inSheet: boolean }) {
  return inSheet ? <SheetClose asChild>{children as React.ReactElement}</SheetClose> : <>{children}</>
}

export function NewDocButton({ className, label = "New document" }: { className?: string; label?: string }) {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)

  return (
    <Button
      className={cn("gap-2", className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const id = await createDoc({ templateId: "blank" })
          if (id) openDoc(id)
          else toast({ title: "Could not create document", variant: "destructive" })
        } finally {
          setBusy(false)
        }
      }}
    >
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  )
}

export function SidebarNavContent({ inSheet = false }: { inSheet?: boolean }) {
  const filter = useDocsStore((s) => s.filter)
  const setFilter = useDocsStore((s) => s.setFilter)
  const documents = useDocsStore((s) => s.documents)
  const folders = useDocsStore((s) => s.folders)
  const activeFolderId = useDocsStore((s) => s.activeFolderId)
  const openFolder = useDocsStore((s) => s.openFolder)
  const createFolder = useDocsStore((s) => s.createFolder)
  const renameFolder = useDocsStore((s) => s.renameFolder)
  const deleteFolder = useDocsStore((s) => s.deleteFolder)
  const { toast } = useToast()

  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [renaming, setRenaming] = React.useState<FolderDTO | null>(null)
  const [renameValue, setRenameValue] = React.useState("")

  const starredCount = documents.filter((d) => d.starred && !d.trashed).length

  const navItem = (
    active: boolean,
    icon: ReactNode,
    label: string,
    onSelect: () => void,
    badge?: number
  ) => {
    const btn = (
      <Button
        variant="ghost"
        onClick={onSelect}
        className={cn(
          "w-full justify-start gap-3 rounded-full px-4 py-2.5 text-sm font-normal",
          active ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
        )}
      </Button>
    )
    return <Wrap inSheet={inSheet}>{btn}</Wrap>
  }

  return (
    <div className="flex h-full flex-col p-3">
      <div className="px-2 pb-3 pt-1">
        <NewDocButton className="w-full rounded-full" />
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Document filters">
        {navItem(filter === "all", <Home className="h-4.5 w-4.5" />, "All documents", () => {
          useDocsStore.setState({ filter: "all", activeFolderId: null })
          void useDocsStore.getState().refresh({ silent: true })
        })}
        {navItem(filter === "starred", <Star className="h-4.5 w-4.5" />, "Starred", () => setFilter("starred"), starredCount)}
        {navItem(filter === "trash", <Trash2 className="h-4.5 w-4.5" />, "Trash", () => setFilter("trash"))}
      </nav>

      {/* Folders */}
      <div className="mt-4 flex items-center justify-between px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folders</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="New folder"
              onClick={() => {
                setCreating(true)
                setNewName("")
              }}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">New folder</TooltipContent>
        </Tooltip>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5" aria-label="Document folders">
        {creating && (
          <div className="flex items-center gap-2 px-4 py-1.5">
            <Folder className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newName.trim()) {
                  const f = await createFolder(newName.trim())
                  if (f) {
                    toast({ title: "Folder created", description: f.name })
                    setCreating(false)
                  } else {
                    toast({ title: "Couldn't create folder", description: "Names must be unique.", variant: "destructive" })
                  }
                }
                if (e.key === "Escape") setCreating(false)
              }}
              onBlur={() => setCreating(false)}
              placeholder="Folder name"
              className="h-8 rounded-full text-sm"
              maxLength={80}
            />
          </div>
        )}

        {folders.map((f) => {
          const active = filter === "folder" && activeFolderId === f.id
          const btn = (
            <div className="group relative">
              <Button
                variant="ghost"
                onClick={() => openFolder(f.id)}
                className={cn(
                  "w-full justify-start gap-3 rounded-full px-4 py-2.5 text-sm font-normal",
                  active
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Folder className="h-4.5 w-4.5 shrink-0" style={{ color: active ? undefined : f.color }} fill={active ? f.color : "none"} />
                <span className="flex-1 truncate text-left">{f.name}</span>
                {renaming?.id !== f.id && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {(f.count ?? 0) > 0 ? f.count : ""}
                  </span>
                )}
              </Button>
              {/* hover actions */}
              {renaming?.id !== f.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`Actions for folder ${f.name}`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => { setRenaming(f); setRenameValue(f.name) }}>
                      <Pencil className="h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        await deleteFolder(f.id)
                        toast({ title: "Folder deleted", description: "Documents were kept in All documents." })
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Delete folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* inline rename */}
              {renaming?.id === f.id && (
                <div className="absolute inset-0 flex items-center gap-2 rounded-full bg-background px-4">
                  <Folder className="h-4.5 w-4.5 shrink-0" style={{ color: f.color }} />
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        await renameFolder(f.id, renameValue.trim())
                        setRenaming(null)
                      }
                      if (e.key === "Escape") setRenaming(null)
                    }}
                    onBlur={() => setRenaming(null)}
                    className="h-7 rounded-full text-sm"
                    maxLength={80}
                  />
                </div>
              )}
            </div>
          )
          return (
            <Wrap key={f.id} inSheet={inSheet}>{btn}</Wrap>
          )
        })}

        {folders.length === 0 && !creating && (
          <p className="px-4 py-2 text-xs text-muted-foreground/70">
            No folders yet — create one to organize your docs.
          </p>
        )}
      </nav>

      <div className="mt-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        Workspace
      </div>
      <nav className="mt-1 flex flex-col gap-0.5" aria-label="Workspace apps">
        {[
          { icon: <FileClock className="h-4.5 w-4.5" />, label: "Recent activity", active: false },
          { icon: <FileSpreadsheet className="h-4.5 w-4.5" />, label: "Z-Sheets", active: false },
          { icon: <Presentation className="h-4.5 w-4.5" />, label: "Z-Slides", active: false },
          { icon: <FormInput className="h-4.5 w-4.5" />, label: "Z-Forms", active: false },
        ].map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                disabled
                className="w-full justify-start gap-3 rounded-full px-4 py-2.5 text-sm font-normal text-muted-foreground/50"
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                <span className="rounded-full border bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  soon
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Coming soon</TooltipContent>
          </Tooltip>
        ))}
      </nav>

      <div className="mt-auto px-4 pb-4">
        <div className="rounded-xl border bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cloud className="h-4 w-4" />
            Storage
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[12%] rounded-full bg-primary" />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">1.8 GB of 15 GB used</p>
        </div>
      </div>
    </div>
  )
}

export function SidebarNav() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block" aria-label="Navigation">
      <SidebarNavContent />
    </aside>
  )
}
