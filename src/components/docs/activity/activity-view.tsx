"use client"

import * as React from "react"
import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns"
import { AlertTriangle, ArrowLeft, FileClock, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDocsStore } from "@/store/docs-store"
import { useLocalUser } from "@/lib/identity"
import type { LocalUser } from "@/lib/identity"
import { colorForId, fullTime, initialsOf, relativeTime } from "@/lib/doc-utils"
import type { ActivityDTO, WorkspaceApp } from "@/lib/workspace-types"
import { cn } from "@/lib/utils"
import { APP_META, KIND_META } from "./activity-meta"

type ActivityFilter = "all" | WorkspaceApp

interface DayGroup {
  key: string
  label: string
  items: ActivityDTO[]
}

const FILTERS: { value: ActivityFilter; label: string; app: WorkspaceApp | null }[] = [
  { value: "all", label: "All", app: null },
  { value: "docs", label: "Docs", app: "docs" },
  { value: "sheets", label: "Sheets", app: "sheets" },
  { value: "slides", label: "Slides", app: "slides" },
  { value: "forms", label: "Forms", app: "forms" },
]

/* --------------------------------- helpers --------------------------------- */

function dayKeyAndLabel(date: Date): { key: string; label: string } {
  const key = format(date, "yyyy-MM-dd")
  if (isToday(date)) return { key, label: "Today" }
  if (isYesterday(date)) return { key, label: "Yesterday" }
  if (differenceInCalendarDays(new Date(), date) < 7) return { key, label: format(date, "EEEE") }
  return { key, label: format(date, "EEE d MMM") }
}

function groupByDay(activities: ActivityDTO[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const activity of activities) {
    const { key, label } = dayKeyAndLabel(new Date(activity.createdAt))
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(activity)
    else groups.push({ key, label, items: [activity] })
  }
  return groups
}

/* ----------------------------------- row ----------------------------------- */

function ActivityRow({ activity, me }: { activity: ActivityDTO; me: LocalUser | null }) {
  const openDoc = useDocsStore((s) => s.openDoc)
  const openApp = useDocsStore((s) => s.openApp)

  const appMeta = APP_META[activity.app] ?? APP_META.docs
  const kindMeta = KIND_META[activity.kind] ?? KIND_META.edited
  const AppIcon = appMeta.icon
  const KindIcon = kindMeta.icon

  const isMe = !!me && activity.actor?.id === me.id
  const displayName = isMe ? "You" : activity.actor?.name || "Someone"
  const initialsName = isMe ? me.name : activity.actor?.name || "?"
  const actorColor = activity.actor?.color || colorForId(activity.actor?.id ?? activity.id)
  const time = relativeTime(activity.createdAt)
  const full = fullTime(activity.createdAt)
  const canOpen = !!activity.entityId

  const inner = (
    <>
      {/* actor avatar with an app-colored badge showing the kind */}
      <span className="relative mt-0.5 shrink-0">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold leading-none text-white"
          style={{ backgroundColor: actorColor }}
          aria-hidden="true"
        >
          {initialsOf(initialsName)}
        </span>
        <span
          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background"
          style={{ backgroundColor: appMeta.color }}
          aria-hidden="true"
        >
          <KindIcon
            className="h-2.5 w-2.5 text-white"
            fill={kindMeta.filled ? "currentColor" : "none"}
          />
        </span>
      </span>

      {/* sentence */}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug">
          <span className="font-medium text-foreground">{displayName}</span>{" "}
          <span className="text-muted-foreground">{kindMeta.verb}</span>{" "}
          {activity.entityTitle ? (
            <span className="font-medium text-foreground">“{activity.entityTitle}”</span>
          ) : null}
        </span>
        {activity.detail ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground/90">
            {activity.detail}
          </span>
        ) : null}
      </span>

      {/* relative time */}
      {time ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-3 shrink-0 self-start whitespace-nowrap pt-0.5 text-[11px] tnum text-muted-foreground">
              {time}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {full || time}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </>
  )

  if (canOpen) {
    return (
      <li>
        <button
          type="button"
          onClick={() => {
            if (activity.app === "docs") openDoc(activity.entityId)
            else openApp(activity.app, { id: activity.entityId })
          }}
          className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60"
        >
          {inner}
        </button>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2.5">{inner}</li>
  )
}

/* --------------------------------- states ---------------------------------- */

function ActivitySkeletonList() {
  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6"
      aria-busy="true"
      aria-label="Loading activity"
    >
      <p className="sr-only">Loading activity…</p>
      <Skeleton className="mt-2 h-3.5 w-24" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-2 py-3">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
      ))}
    </div>
  )
}

function ActivityEmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center sm:py-28">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <FileClock className="h-6 w-6 text-primary" />
      </span>
      <h2 className="mt-4 text-[15px] font-medium">No activity yet</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
        Create a document, spreadsheet or form and it will show up here
      </p>
      <Button
        variant="ghost"
        onClick={onBack}
        className="mt-6 h-10 rounded-full px-5 text-[13px] font-medium text-primary hover:text-primary"
      >
        Back to home
      </Button>
    </div>
  )
}

function ActivityErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn’t load activity</AlertTitle>
        <AlertDescription>
          <span className="block">{message}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="mt-2 h-9 border-destructive/40 text-destructive hover:text-destructive"
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}

/* ---------------------------------- page ----------------------------------- */

export function ActivityView() {
  const goHome = useDocsStore((s) => s.goHome)
  const me = useLocalUser()

  const [filter, setFilter] = React.useState<ActivityFilter>("all")
  const [items, setItems] = React.useState<ActivityDTO[]>([])
  const [counts, setCounts] = React.useState<Record<WorkspaceApp, number> | null>(null)
  const [allCount, setAllCount] = React.useState(0)
  const [loadedFilter, setLoadedFilter] = React.useState<ActivityFilter>("all")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadTick, setReloadTick] = React.useState(0)
  const requestId = React.useRef(0)

  // fetch on mount, on filter change and on manual refresh (no polling)
  React.useEffect(() => {
    const id = ++requestId.current
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // filtered feed for the list + full feed for the chip counts
        const urls =
          filter === "all"
            ? ["/api/activity?limit=200"]
            : [`/api/activity?app=${filter}&limit=100`, "/api/activity?limit=200"]
        const responses = await Promise.all(urls.map((u) => fetch(u)))
        const bad = responses.find((r) => !r.ok)
        if (bad) throw new Error(`Failed to load activity (${bad.status})`)
        const payloads = await Promise.all(
          responses.map((r) => r.json() as Promise<{ activities?: ActivityDTO[] }>)
        )
        if (cancelled || id !== requestId.current) return
        setItems(payloads[0]?.activities ?? [])
        const all = payloads[payloads.length - 1]?.activities ?? []
        const nextCounts: Record<WorkspaceApp, number> = { docs: 0, sheets: 0, slides: 0, forms: 0 }
        for (const a of all) if (a.app in nextCounts) nextCounts[a.app] += 1
        setCounts(nextCounts)
        setAllCount(all.length)
        setLoadedFilter(filter)
      } catch (e) {
        if (cancelled || id !== requestId.current) return
        setError(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        if (!cancelled && id === requestId.current) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [filter, reloadTick])

  const groups = React.useMemo(() => groupByDay(items), [items])
  // keep the previous list visible while revalidating with the same filter
  const showStale = loading && !error && items.length > 0 && loadedFilter === filter

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={goHome}
              aria-label="Back"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Back
          </TooltipContent>
        </Tooltip>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-medium leading-tight">Recent activity</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Everything you and your collaborators touched
          </p>
        </div>
        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setReloadTick((t) => t + 1)}
                aria-label="Refresh activity"
                className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("h-4.5 w-4.5", loading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Refresh
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main className="flex-1">
        {/* filter chips */}
        <div
          className="flex flex-wrap items-center gap-2 px-6 py-3"
          role="group"
          aria-label="Filter activity by app"
        >
          {FILTERS.map((f) => {
            const Icon = f.app ? APP_META[f.app].icon : null
            const active = filter === f.value
            const count = f.value === "all" ? allCount : (counts?.[f.value] ?? 0)
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {f.label}
                {counts ? (
                  <span
                    className={cn(
                      "tnum rounded-full px-1.5 text-[11px] leading-5",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* content */}
        {error ? (
          <ActivityErrorState message={error} onRetry={() => setReloadTick((t) => t + 1)} />
        ) : loading && !showStale ? (
          <ActivitySkeletonList />
        ) : items.length === 0 ? (
          <ActivityEmptyState onBack={goHome} />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6" aria-busy={loading}>
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label} className="mt-6 first:mt-2">
                <h2 className="sticky top-16 z-10 border-b border-border/60 bg-background py-2 text-xs font-medium tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <ul role="list" className="mt-1.5">
                  {group.items.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} me={me} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
