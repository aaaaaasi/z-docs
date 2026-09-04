"use client"

import * as React from "react"
import { AlertCircle, ArrowLeft, Check, Copy, Eye, Loader2, MoreVertical, Star, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BuilderTab, FormState, SaveStatus } from "./forms-utils"

interface FormTopBarProps {
  form: FormState
  activeTab: BuilderTab
  saveStatus?: SaveStatus
  onBack: () => void
  onTitleCommit: (title: string) => void
  onToggleStar: () => void
  onTabChange: (tab: BuilderTab) => void
  onPreview: () => void
  onDuplicate: () => void
  onTrash: () => void
}

/** Shared h-14 top bar for the builder (Questions tab) and responses (Responses tab). */
export function FormTopBar({
  form,
  activeTab,
  saveStatus,
  onBack,
  onTitleCommit,
  onToggleStar,
  onTabChange,
  onPreview,
  onDuplicate,
  onTrash,
}: FormTopBarProps) {
  const { t } = useI18n()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")

  const startEditing = () => {
    setDraft(form.title)
    setEditing(true)
  }

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== form.title) onTitleCommit(next.slice(0, 120))
  }

  const shown = saveStatus ?? "idle"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={t("Back to forms list")}
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t("Back to forms list")}
        </TooltipContent>
      </Tooltip>

      {/* Editable form title — click to rename, Enter/Esc to finish */}
      <div className="min-w-0 flex-1 sm:flex-none">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") {
                setEditing(false)
                e.stopPropagation()
              }
            }}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t("Form title")}
            className="h-9 w-full text-sm font-medium sm:w-64"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={t("Rename form")}
            className="hidden h-10 max-w-[190px] items-center truncate rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:flex"
          >
            {form.title.trim() || t("Untitled form")}
          </button>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleStar}
            aria-label={form.starred ? t("Unstar form") : t("Star form")}
            className={cn(
              "hidden h-10 w-10 rounded-full sm:flex",
              form.starred ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("h-4.5 w-4.5", form.starred && "fill-primary")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {form.starred ? t("Remove star") : t("Add star")}
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        {/* Autosave status pill */}
        {shown !== "idle" && (
          <span
            aria-live="polite"
            className="hidden items-center gap-1.5 text-[13px] text-muted-foreground lg:flex"
          >
            {(shown === "pending" || shown === "saving") && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Saving…")}
              </>
            )}
            {shown === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-primary" /> {t("All changes saved")}
              </>
            )}
            {shown === "error" && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" /> {t("Save failed")}
              </>
            )}
          </span>
        )}

        {/* Segmented Questions / Responses tabs */}
        <div role="tablist" aria-label={t("Form sections")} className="flex items-center rounded-full border bg-background p-0.5 shadow-xs">
          <SegmentedTab active={activeTab === "questions"} onClick={() => onTabChange("questions")}>
            {t("Questions")}
          </SegmentedTab>
          <SegmentedTab active={activeTab === "responses"} onClick={() => onTabChange("responses")}>
            {t("Responses")}
            <span
              aria-label={
                form.responseCount === 1
                  ? t("1 response")
                  : t("{n} responses", { n: form.responseCount })
              }
              className={cn(
                "ml-1 rounded-full px-1.5 text-[11px] leading-4 tnum",
                activeTab === "responses"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {form.responseCount}
            </span>
          </SegmentedTab>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onPreview} className="h-9 gap-1.5" aria-label={t("Preview form")}>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{t("Preview")}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("Open respondent preview")}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("More form actions")}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" /> {t("Duplicate form")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onTrash} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> {t("Move to trash")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function SegmentedTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
