"use client"

import * as React from "react"
import { ArrowLeft, FormInput, Loader2, Plus, Search, SearchX, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
import { ListTab } from "./forms-utils"
import { useI18n } from "@/lib/i18n"
import { useFormsList } from "./use-forms-list"
import { FormCard } from "./form-card"

interface FormsListProps {
  /** open a form in a given mode (builder / fill / responses) */
  onOpen: (id: string, mode: "edit" | "fill" | "responses") => void
  /** create a new form — parent enters the builder; resolves when done */
  onNewForm: () => Promise<void>
  onGoHome: () => void
}

/** List mode — a Drive-like grid of the user's forms (self-fetching). */
export function FormsList({ onOpen, onNewForm, onGoHome }: FormsListProps) {
  const { t } = useI18n()
  const list = useFormsList()
  const [local, setLocal] = React.useState(list.search)
  const [creating, setCreating] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<(typeof list.forms)[number] | null>(null)

  /* debounced search -> refetch */
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== list.search) list.applySearch(local)
    }, 350)
    return () => clearTimeout(timer)
  }, [local, list.search, list.applySearch])

  const handleNew = async () => {
    setCreating(true)
    try {
      await onNewForm()
    } finally {
      setCreating(false)
    }
  }

  const tabs = (
    <Tabs value={list.tab} onValueChange={(v) => list.setTab(v as ListTab)}>
      <TabsList className="h-9">
        <TabsTrigger value="all" className="text-[13px]">{t("All")}</TabsTrigger>
        <TabsTrigger value="starred" className="text-[13px]">{t("Starred")}</TabsTrigger>
        <TabsTrigger value="trashed" className="text-[13px]">{t("Trash")}</TabsTrigger>
      </TabsList>
    </Tabs>
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-3 sm:px-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onGoHome}
              aria-label={t("Back to Z-Docs home")}
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{t("Back to Z-Docs home")}</TooltipContent>
        </Tooltip>

        <div className="flex select-none items-center gap-2.5" aria-label="Z-Forms">
          <span className="flex size-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <FormInput className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="text-lg font-medium tracking-tight">Z-Forms</span>
        </div>

        {/* Search: resting pill that wakes into a card on focus */}
        <div className="relative ml-2 hidden max-w-sm flex-1 items-center sm:flex">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={t("Search forms")}
            aria-label={t("Search forms")}
            className="h-10 rounded-full border-transparent bg-muted pl-10 pr-4 text-sm placeholder:text-muted-foreground/80 focus-visible:border-border focus-visible:bg-background focus-visible:shadow-[0_1px_2px_rgba(35,32,28,0.05),0_6px_20px_rgba(35,32,28,0.08)]"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">{tabs}</div>
          <Button
            onClick={() => void handleNew()}
            disabled={creating}
            className="h-9 gap-1.5"
            aria-label={t("Create a new form")}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{t("New form")}</span>
          </Button>
        </div>
      </header>

      {/* Mobile: tabs row + compact search */}
      <div className="flex h-12 items-center gap-2 border-b px-2 md:hidden">
        {tabs}
        <div className="relative ml-auto flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={t("Search")}
            aria-label={t("Search forms")}
            className="h-9 w-28 rounded-full border-transparent bg-muted pl-9 pr-3 text-sm focus-visible:w-36 focus-visible:border-border focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Grid */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-3 sm:p-5 md:p-6">
        {list.error ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background/60 p-10 text-center">
            <p className="text-sm font-medium text-destructive">{t(list.error)}</p>
            <Button variant="outline" onClick={list.reload} className="h-9">{t("Try again")}</Button>
          </div>
        ) : list.loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border bg-background">
                <Skeleton className="aspect-[5/3] rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : list.forms.length === 0 ? (
          <EmptyState tab={list.tab} search={list.search} onNewForm={() => void handleNew()} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {list.forms.map((f) => (
              <FormCard
                key={f.id}
                form={f}
                tab={list.tab}
                onOpen={() => onOpen(f.id, "edit")}
                onRename={(title) => void list.renameForm(f.id, title)}
                onToggleStar={() => void list.toggleStar(f.id)}
                onDuplicate={() => void list.duplicateForm(f.id)}
                onTrash={() => void list.setTrashed(f.id, true)}
                onRestore={() => void list.setTrashed(f.id, false)}
                onDeleteForever={() => setDeleteTarget(f)}
                onOpenResponses={() => onOpen(f.id, "responses")}
                onOpenFill={() => onOpen(f.id, "fill")}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete-forever confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete “{title}” forever?", { title: deleteTarget?.title ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This permanently removes the form and its {n} responses. This action can’t be undone.", {
                n: deleteTarget?.responseCount ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void list.deleteForever(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              {t("Delete forever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* --------------------------------- empty states ---------------------------------- */

function EmptyState({ tab, search, onNewForm }: { tab: ListTab; search: string; onNewForm: () => void }) {
  const { t } = useI18n()
  if (search.trim()) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background/60 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">{t("No forms found")}</p>
        <p className="text-[13px] text-muted-foreground">{t("Nothing matches “{search}”.", { search: search.trim() })}</p>
      </div>
    )
  }
  if (tab === "starred") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background/60 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Star className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">{t("No starred forms")}</p>
        <p className="text-[13px] text-muted-foreground">{t("Star the forms you reach for most and they’ll show up here.")}</p>
      </div>
    )
  }
  if (tab === "trashed") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background/60 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Trash2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">{t("Trash is empty")}</p>
        <p className="text-[13px] text-muted-foreground">{t("Forms you delete will appear here before they’re gone forever.")}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background/60 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <FormInput className="h-6 w-6 text-primary" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">{t("Create your first form")}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        {t("Build surveys and quizzes with multiple choice, checkboxes, dropdowns and star ratings — then watch the responses roll in.")}
      </p>
      <Button onClick={onNewForm} className="mt-1 gap-2" aria-label={t("Create a new form")}>
        <Plus className="h-4 w-4" /> {t("New form")}
      </Button>
    </div>
  )
}
