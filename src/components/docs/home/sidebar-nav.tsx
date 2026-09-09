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
  Folder, FolderPlus, Pencil, MoreVertical, Tags, Settings
} from "lucide-react"
import { useDocsStore } from "@/store/docs-store"
import { DropTarget } from "./doc-dnd"
import { DEFAULT_TAG_COLOR, TagColorPalette, hitArea } from "./tag-ui"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { ReactNode } from "react"
import type { FolderDTO } from "@/lib/docs-types"

function Wrap({ children, inSheet }: { children: ReactNode; inSheet: boolean }) {
  return inSheet ? <SheetClose asChild>{children as React.ReactElement}</SheetClose> : <>{children}</>
}

export function NewDocButton({ className, label = "New document" }: { className?: string; label?: string }) {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  const { toast } = useToast()
  const { t } = useI18n()
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
          else toast({ title: t("Could not create document"), variant: "destructive" })
        } finally {
          setBusy(false)
        }
      }}
    >
      <Plus className="h-4 w-4" />
      {t(label)}
    </Button>
  )
}

export function SidebarNavContent({ inSheet = false }: { inSheet?: boolean }) {
  const { t } = useI18n()
  const filter = useDocsStore((s) => s.filter)
  const setFilter = useDocsStore((s) => s.setFilter)
  const storageUsage = useDocsStore((s) => s.storageUsage)
  const fetchStorage = useDocsStore((s) => s.fetchStorage)

  // Real usage from /api/storage. The quota is only shown when the server
  // actually reports one (STORAGE_QUOTA_GB env) — never a fabricated total.
  const docCount = useDocsStore((s) => s.documents.length)
  React.useEffect(() => {
    void fetchStorage()
  }, [docCount, fetchStorage])

  const hasQuota = !!storageUsage && storageUsage.quotaBytes > 0
  const storagePct =
    hasQuota && storageUsage
      ? Math.min(100, (storageUsage.usedBytes / Math.max(1, storageUsage.quotaBytes)) * 100)
      : 0
  const storageLabel = storageUsage
    ? hasQuota
      ? t("{used} of {total} used — {count} items", {
          used: formatBytes(storageUsage.usedBytes, t),
          total: formatBytes(storageUsage.quotaBytes, t),
          count:
            (storageUsage.counts.documents ?? 0) +
            (storageUsage.counts.sheets ?? 0) +
            (storageUsage.counts.slides ?? 0) +
            (storageUsage.counts.forms ?? 0),
        })
      : t("{used} used · {count} items", {
          used: formatBytes(storageUsage.usedBytes, t),
          count:
            (storageUsage.counts.documents ?? 0) +
            (storageUsage.counts.sheets ?? 0) +
            (storageUsage.counts.slides ?? 0) +
            (storageUsage.counts.forms ?? 0),
        })
    : t("Calculating…")
  const view = useDocsStore((s) => s.view)
  const openApp = useDocsStore((s) => s.openApp)
  const openActivity = useDocsStore((s) => s.openActivity)
  const openSettings = useDocsStore((s) => s.openSettings)
  const documents = useDocsStore((s) => s.documents)
  const folders = useDocsStore((s) => s.folders)
  const activeFolderId = useDocsStore((s) => s.activeFolderId)
  const openFolder = useDocsStore((s) => s.openFolder)
  const createFolder = useDocsStore((s) => s.createFolder)
  const renameFolder = useDocsStore((s) => s.renameFolder)
  const deleteFolder = useDocsStore((s) => s.deleteFolder)
  const tags = useDocsStore((s) => s.tags)
  const tagFilter = useDocsStore((s) => s.tagFilter)
  const setTagFilter = useDocsStore((s) => s.setTagFilter)
  const createTag = useDocsStore((s) => s.createTag)
  const deleteTag = useDocsStore((s) => s.deleteTag)
  const { toast } = useToast()

  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [renaming, setRenaming] = React.useState<FolderDTO | null>(null)
  const [renameValue, setRenameValue] = React.useState("")

  const [tagCreating, setTagCreating] = React.useState(false)
  const [tagName, setTagName] = React.useState("")
  const [tagColor, setTagColor] = React.useState<string>(DEFAULT_TAG_COLOR)

  const starredCount = documents.filter((d) => d.starred && !d.trashed).length

  const confirmCreateTag = async () => {
    const name = tagName.trim()
    if (!name) return
    const tag = await createTag(name, tagColor)
    if (tag) {
      toast({ title: t("Tag created"), description: tag.name })
      setTagCreating(false)
      setTagName("")
    } else {
      toast({ title: t("Couldn’t create tag"), description: t("Names must be unique."), variant: "destructive" })
    }
  }

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
          "w-full justify-start gap-2.5 rounded-md px-3 py-2 text-[13px] font-normal",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        )}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="tnum text-[11px] text-muted-foreground">{badge}</span>
        )}
      </Button>
    )
    return <Wrap inSheet={inSheet}>{btn}</Wrap>
  }

  return (
    <div className="flex h-full flex-col p-3">
      <div className="px-2 pb-3 pt-1">
        <NewDocButton className="w-full" />
      </div>

      {/* scrollable nav area (folders + tags can grow past the viewport) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      <nav className="flex flex-col gap-0.5" aria-label={t("Document filters")}>
        <DropTarget kind="root">
          {navItem(filter === "all", <Home className="h-4.5 w-4.5" />, t("All documents"), () => {
            useDocsStore.setState({ filter: "all", activeFolderId: null })
            void useDocsStore.getState().refresh({ silent: true })
          })}
        </DropTarget>
        {navItem(filter === "starred", <Star className="h-4.5 w-4.5" />, t("Starred"), () => setFilter("starred"), starredCount)}
        <DropTarget kind="trash">
          {navItem(filter === "trash", <Trash2 className="h-4.5 w-4.5" />, t("Trash"), () => setFilter("trash"))}
        </DropTarget>
      </nav>

      {/* Folders */}
      <div className="mt-4 flex items-center justify-between px-3">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">{t("Folders")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t("New folder")}
              onClick={() => {
                setCreating(true)
                setNewName("")
              }}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{t("New folder")}</TooltipContent>
        </Tooltip>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5" aria-label={t("Document folders")}>
        {creating && (
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <Folder className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newName.trim()) {
                  const f = await createFolder(newName.trim())
                  if (f) {
                    toast({ title: t("Folder created"), description: f.name })
                    setCreating(false)
                  } else {
                    toast({ title: t("Couldn't create folder"), description: t("Names must be unique."), variant: "destructive" })
                  }
                }
                if (e.key === "Escape") setCreating(false)
              }}
              onBlur={() => setCreating(false)}
              placeholder={t("Folder name")}
              className="h-8 rounded-md text-[13px]"
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
                  "w-full justify-start gap-2.5 rounded-md px-3 py-2 text-[13px] font-normal",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Folder className="h-4.5 w-4.5 shrink-0" style={{ color: active ? undefined : f.color }} fill={active ? f.color : "none"} />
                <span className="flex-1 truncate text-left">{f.name}</span>
                {renaming?.id !== f.id && (
                  <span className="tnum text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {(f.count ?? 0) > 0 ? f.count : ""}
                  </span>
                )}
              </Button>
              {/* hover actions */}
              {renaming?.id !== f.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t("Actions for folder {name}", { name: f.name })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => { setRenaming(f); setRenameValue(f.name) }}>
                      <Pencil className="h-4 w-4" /> {t("Rename")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        await deleteFolder(f.id)
                        toast({ title: t("Folder deleted"), description: t("Documents were kept in All documents.") })
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> {t("Delete folder")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* inline rename */}
              {renaming?.id === f.id && (
                <div className="absolute inset-0 flex items-center gap-2.5 rounded-md bg-background px-3">
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
                    className="h-7 rounded-md text-[13px]"
                    maxLength={80}
                  />
                </div>
              )}
            </div>
          )
          return (
            <Wrap key={f.id} inSheet={inSheet}>
              <DropTarget kind="folder" folderId={f.id}>
                {btn}
              </DropTarget>
            </Wrap>
          )
        })}

        {folders.length === 0 && !creating && (
          <p className="px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground/80">
            {t("No folders yet. Create one to organize your docs.")}
          </p>
        )}
      </nav>

      {/* Tags */}
      <div className="mt-4 flex items-center justify-between px-3">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">{t("Tags")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t("New tag")}
              onClick={() => {
                setTagCreating(true)
                setTagName("")
                setTagColor(DEFAULT_TAG_COLOR)
              }}
              className={cn(
                "rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                hitArea
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{t("New tag")}</TooltipContent>
        </Tooltip>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5" aria-label={t("Document tags")}>
        {tagFilter && (
          <Button
            variant="ghost"
            onClick={() => setTagFilter(null)}
            className="w-full justify-start gap-2.5 rounded-md px-3 py-2 text-[13px] font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <Tags className="h-4.5 w-4.5" />
            <span className="flex-1 text-left">{t("All tags")}</span>
          </Button>
        )}

        {tags.map((tag) => {
          const active = tagFilter === tag.id
          const row = (
            <div className="group relative">
              <Button
                variant="ghost"
                onClick={() => setTagFilter(active ? null : tag.id)}
                aria-pressed={active}
                className={cn(
                  "w-full justify-start gap-2.5 rounded-md px-3 py-2 text-[13px] font-normal",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate text-left">{tag.name}</span>
                {(tag.count ?? 0) > 0 && (
                  <span className="tnum text-[11px] text-muted-foreground">{tag.count}</span>
                )}
              </Button>
              {/* hover actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t("Actions for tag {name}", { name: tag.name })}
                    className={cn(
                      "absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100",
                      hitArea
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async () => {
                      await deleteTag(tag.id)
                      toast({ title: t("Tag deleted"), description: t("Removed from all documents.") })
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> {t("Delete tag")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
          return (
            <Wrap key={tag.id} inSheet={inSheet}>
              {row}
            </Wrap>
          )
        })}

        {tagCreating && (
          <div
            className="flex flex-col gap-1.5 px-3 py-1.5"
            onBlur={(e) => {
              // cancel only when focus leaves the whole creation form (palette clicks stay inside)
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTagCreating(false)
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tagColor }}
              />
              <Input
                autoFocus
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmCreateTag()
                  if (e.key === "Escape") setTagCreating(false)
                }}
                placeholder={t("Tag name")}
                aria-label={t("New tag name")}
                className="h-8 rounded-md text-[13px]"
                maxLength={24}
              />
            </div>
            <div className="pl-7">
              <TagColorPalette value={tagColor} onChange={setTagColor} />
            </div>
          </div>
        )}

        {tags.length === 0 && !tagCreating && (
          <p className="px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground/80">
            {t("No tags yet. Use tags to label documents.")}
          </p>
        )}
      </nav>

      <div className="mt-4 px-3 text-[11px] font-medium tracking-wide text-muted-foreground/70">
        {t("Workspace")}
      </div>
      <nav className="mt-1 flex flex-col gap-0.5" aria-label={t("Workspace apps")}>
        {(
          [
            {
              icon: <FileClock className="h-4.5 w-4.5" />,
              label: t("Recent activity"),
              active: view === "activity",
              onSelect: () => openActivity(),
            },
            {
              icon: <FileSpreadsheet className="h-4.5 w-4.5" />,
              label: "Z-Sheets",
              active: view === "sheets",
              onSelect: () => openApp("sheets"),
            },
            {
              icon: <Presentation className="h-4.5 w-4.5" />,
              label: "Z-Slides",
              active: view === "slides",
              onSelect: () => openApp("slides"),
            },
            {
              icon: <FormInput className="h-4.5 w-4.5" />,
              label: "Z-Forms",
              active: view === "forms",
              onSelect: () => openApp("forms"),
            },
            {
              icon: <Settings className="h-4.5 w-4.5" />,
              label: t("Settings"),
              active: view === "settings",
              onSelect: () => openSettings(),
            },
          ] as const
        ).map((item) => (
          <Wrap key={item.label} inSheet={inSheet}>
            {navItem(item.active, item.icon, item.label, item.onSelect)}
          </Wrap>
        ))}
      </nav>
      </div>

      <div className="mt-3 px-3 pb-4">
        <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground">
            <Cloud className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t("Storage")}
          </div>
          {/* Quota bar only when the deployment actually defines a quota —
              otherwise the card shows the honest usage-only line. */}
          {hasQuota && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/70">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(0.5, Math.min(100, storagePct))}%` }}
              />
            </div>
          )}
          <p className="tnum mt-1.5 text-[11px] text-muted-foreground" aria-live="polite">
            {storageLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

export function SidebarNav() {
  const { t } = useI18n()
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block" aria-label={t("Navigation")}>
      <SidebarNavContent />
    </aside>
  )
}

/** Human-readable byte size for the real storage meter. */
function formatBytes(bytes: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (bytes < 1024) return `${bytes} ${t("B")}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t("KB")}`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("MB")}`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${t("GB")}`
}
