"use client"

/**
 * Z-Slides — list mode (Google Drive-like): header with back-to-home,
 * wordmark, search, All/Starred/Trash tabs and a New presentation button;
 * a responsive card grid of deck cards (live first-slide previews).
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowLeft,
  Plus,
  Presentation,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import { useDocsStore } from "@/store/docs-store"
import { useSlidesStore, type SlideTab } from "./deck-store"
import { DeckCard } from "./deck-card"

function EmptyState({ tab, searching }: { tab: SlideTab; searching: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        {tab === "trashed" ? (
          <Trash2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        ) : tab === "starred" ? (
          <Star className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Presentation className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <p className="text-sm font-medium">
        {tab === "trashed"
          ? "Trash is empty"
          : tab === "starred"
            ? "No starred presentations"
            : searching
              ? "No matching presentations"
              : "No presentations yet"}
      </p>
      <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {tab === "trashed"
          ? "Presentations you delete will appear here before they’re removed forever."
          : tab === "starred"
            ? "Star presentations to keep them at your fingertips."
            : searching
              ? "Try a different search, or create a new presentation."
              : "Create your first presentation and start telling your story."}
      </p>
    </div>
  )
}

export function SlidesList({
  onOpenDeck,
  onNewDeck,
}: {
  onOpenDeck: (id: string) => void
  onNewDeck: () => void
}) {
  const goHome = useDocsStore((s) => s.goHome)
  const decks = useSlidesStore((s) => s.decks)
  const previews = useSlidesStore((s) => s.previews)
  const loading = useSlidesStore((s) => s.listLoading)
  const error = useSlidesStore((s) => s.listError)
  const tab = useSlidesStore((s) => s.tab)
  const search = useSlidesStore((s) => s.search)
  const setTab = useSlidesStore((s) => s.setTab)
  const setSearch = useSlidesStore((s) => s.setSearch)
  const fetchList = useSlidesStore((s) => s.fetchList)

  const [localSearch, setLocalSearch] = React.useState("")

  // debounce the search box into the store + refetch
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch)
        void fetchList({ silent: true })
      }
    }, 350)
    return () => clearTimeout(t)
  }, [localSearch, search, setSearch, fetchList])

  const heading =
    tab === "trashed" ? "Trash" : tab === "starred" ? "Starred" : "Recent presentations"

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goHome}
                aria-label="Back to Z-Docs home"
                className="h-11 w-11 shrink-0 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Back to Z-Docs home
            </TooltipContent>
          </Tooltip>

          <div className="flex select-none items-center gap-2" aria-label="Z-Slides">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary shadow-xs">
              <Presentation className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            <span className="hidden text-[16px] font-medium tracking-tight min-[400px]:inline">
              Z-Slides
            </span>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as SlideTab)}
            className="ml-1 shrink-0"
          >
            <TabsList className="h-9 rounded-full bg-muted p-1 sm:h-10">
              <TabsTrigger
                value="all"
                className="h-7 rounded-full px-3 text-[13px] sm:h-8 sm:px-4"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="starred"
                className="h-7 gap-1.5 rounded-full px-3 text-[13px] sm:h-8 sm:px-4"
              >
                <Star className="h-3.5 w-3.5" />
                <span className="hidden min-[480px]:inline">Starred</span>
              </TabsTrigger>
              <TabsTrigger
                value="trashed"
                className="h-7 rounded-full px-3 text-[13px] sm:h-8 sm:px-4"
              >
                <span className="hidden min-[480px]:inline">Trash</span>
                <Trash2 className="h-3.5 w-3.5 min-[480px]:hidden" />
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden w-52 items-center sm:flex lg:w-72">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search presentations"
                aria-label="Search presentations"
                className="h-10 rounded-full pl-10 pr-4 text-sm"
              />
            </div>
            <Button
              onClick={() => void onNewDeck()}
              className="h-10 rounded-full px-4 text-[13px] sm:px-5"
              aria-label="New presentation"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New presentation</span>
            </Button>
          </div>
        </div>

        {/* mobile search row */}
        <div className="px-3 pb-3 sm:hidden">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search presentations"
              aria-label="Search presentations"
              className="h-10 rounded-full pl-10 pr-4 text-sm"
            />
          </div>
        </div>
      </header>

      <section aria-label="Presentation list" className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-base font-semibold">{heading}</h2>
            {!loading && (
              <span className="tnum text-[13px] text-muted-foreground">
                {decks.length} {decks.length === 1 ? "presentation" : "presentations"}
                {search.trim() ? ` matching “${search.trim()}”` : ""}
              </span>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}.{" "}
              <button
                className="font-medium underline underline-offset-2"
                onClick={() => void fetchList()}
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg p-2">
                  <Skeleton className="aspect-video w-full rounded-md" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-1.5 h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : decks.length === 0 ? (
            <EmptyState tab={tab} searching={!!search.trim()} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {decks.map((deck, i) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  preview={previews[deck.id]}
                  index={i}
                  inTrash={tab === "trashed"}
                  onOpen={() => onOpenDeck(deck.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
