"use client"

import * as React from "react"
import {
  BarChart3,
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FormMeta } from "@/lib/workspace-types"
import { relativeTime } from "@/lib/doc-utils"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ListTab } from "./forms-utils"

interface FormCardProps {
  form: FormMeta
  tab: ListTab
  onOpen: () => void
  onRename: (title: string) => void
  onToggleStar: () => void
  onDuplicate: () => void
  onTrash: () => void
  onRestore: () => void
  onDeleteForever: () => void
  onOpenResponses: () => void
  onOpenFill: () => void
}

/** One form card in the Drive-like grid. */
export function FormCard(p: FormCardProps) {
  const { t, lang } = useI18n()
  const f = p.form
  const [renaming, setRenaming] = React.useState(false)
  const [draft, setDraft] = React.useState(f.title)

  const commitRename = () => {
    setRenaming(false)
    const next = draft.trim()
    if (next && next !== f.title) p.onRename(next.slice(0, 120))
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={t("Open form {title}", { title: f.title })}
      onClick={() => !renaming && p.onOpen()}
      onKeyDown={(e) => {
        if (renaming) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          p.onOpen()
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-background text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <FormGlyph trashed={f.trashed} />

      <div className="flex flex-1 flex-col gap-1 p-3">
        {renaming ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") {
                setDraft(f.title)
                setRenaming(false)
              }
            }}
            aria-label={t("Form title")}
            className="h-8 text-sm font-medium"
          />
        ) : (
          <h3 className="truncate text-sm font-medium" title={f.title}>
            {f.title.trim() || t("Untitled form")}
          </h3>
        )}
        <p className="line-clamp-1 text-[13px] text-muted-foreground" title={f.description}>
          {f.description.trim() || t("No description")}
        </p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
          <p className="min-w-0 truncate text-[12px] text-muted-foreground/80 tnum">
            {f.responseCount === 1
              ? t("1 response · edited {time}", { time: relativeTime(f.updatedAt, lang) })
              : t("{n} responses · edited {time}", { n: f.responseCount, time: relativeTime(f.updatedAt, lang) })}
          </p>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                p.onToggleStar()
              }}
              aria-label={f.starred ? t("Unstar {title}", { title: f.title }) : t("Star {title}", { title: f.title })}
              aria-pressed={f.starred}
              className={cn(
                "h-9 w-9 rounded-full",
                f.starred
                  ? "text-primary opacity-100"
                  : "text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-70"
              )}
            >
              <Star className={cn("h-4 w-4", f.starred && "fill-primary")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t("More actions for {title}", { title: f.title })}
                  className="h-9 w-9 rounded-full text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-70 hover:text-foreground"
                >
                  <MoreVertical className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {p.tab !== "trashed" ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setDraft(f.title)
                        setRenaming(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" /> {t("Rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={p.onToggleStar}>
                      {f.starred ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      {f.starred ? t("Remove star") : t("Add star")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={p.onDuplicate}>
                      <Copy className="h-4 w-4" /> {t("Duplicate")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={p.onOpenResponses}>
                      <BarChart3 className="h-4 w-4" /> {t("View responses")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={p.onOpenFill}>
                      <Eye className="h-4 w-4" /> {t("Fill preview")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={p.onTrash} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" /> {t("Move to trash")}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={p.onRestore}>
                      <RotateCcw className="h-4 w-4" /> {t("Restore")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={p.onOpenResponses}>
                      <BarChart3 className="h-4 w-4" /> {t("View responses")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={p.onDeleteForever} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" /> {t("Delete forever")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  )
}

/* ----------------------------- accent-tinted glyph ------------------------------- */

/** Mini form page built from plain divs — no images. */
export function FormGlyph({ trashed }: { trashed?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex aspect-[5/3] items-center justify-center border-b bg-primary/[0.06] dark:bg-primary/10",
        trashed && "opacity-60 saturate-50"
      )}
    >
      <div className="w-[44%] max-w-[110px] overflow-hidden rounded-[4px] border border-black/[0.07] bg-background shadow-sm dark:border-white/10">
        <div className="h-3 bg-primary/80" />
        <div className="space-y-1.5 p-2">
          <div className="h-[3px] w-4/5 rounded-full bg-foreground/25" />
          <div className="h-[3px] w-full rounded-full bg-foreground/10" />
          <div className="h-[3px] w-3/5 rounded-full bg-foreground/10" />
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="size-2 shrink-0 rounded-full border-2 border-primary/70" />
              <div className="h-[3px] flex-1 rounded-full bg-foreground/10" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 shrink-0 rounded-full border-2 border-foreground/30" />
              <div className="h-[3px] w-2/3 rounded-full bg-foreground/10" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 shrink-0 rounded-[2px] border-2 border-primary/70" />
              <div className="h-[3px] w-3/4 rounded-full bg-foreground/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
