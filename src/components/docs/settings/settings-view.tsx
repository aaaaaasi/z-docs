"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  Check,
  Database,
  Download,
  FileCog,
  FileSpreadsheet,
  FileText,
  Folder,
  FormInput,
  Info,
  Palette,
  Presentation,
  RotateCcw,
  Tag,
  User,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDocsStore } from "@/store/docs-store"
import { useLocalUser, saveLocalUser } from "@/lib/identity"
import { initialsOf, PRESENCE_COLORS } from "@/lib/doc-utils"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  ACCENT_OPTIONS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT_HEX,
  FONT_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  USER_STORAGE_KEY,
  ZOOM_STORAGE_KEY,
  applyAccent,
  readStoredAccent,
  saveAccent,
} from "./settings-lib"

/* ------------------------------ theme mode hook ----------------------------- */

type ThemeMode = "light" | "dark" | "system"

function systemPreference(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Light / Dark / System selection on top of next-themes' setTheme. The app's
 * ThemeProvider has system resolution disabled, so "System" is resolved here
 * via matchMedia and applied as an explicit light/dark theme — and followed
 * live if the OS preference changes. The chosen mode is mirrored to
 * localStorage and re-synced when the theme is toggled elsewhere (header).
 */
function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const { theme, setTheme } = useTheme()
  const [mode, setModeState] = React.useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light"
    let own: string | null = null
    try {
      own = window.localStorage.getItem(THEME_MODE_STORAGE_KEY)
    } catch {
      // storage unavailable
    }
    if (own === "light" || own === "dark" || own === "system") {
      const applied = own === "system" ? systemPreference() : own
      if ((theme === "light" || theme === "dark") && theme !== applied) return theme
      return own
    }
    return theme === "dark" ? "dark" : "light"
  })

  const setMode = React.useCallback(
    (next: ThemeMode) => {
      setModeState(next)
      try {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next)
      } catch {
        // storage unavailable — still apply for this session
      }
      setTheme(next === "system" ? systemPreference() : next)
    },
    [setTheme]
  )

  // keep the card selection honest when the theme is toggled outside Settings
  React.useEffect(() => {
    if (theme !== "light" && theme !== "dark") return
    const applied = mode === "system" ? systemPreference() : mode
    if (theme !== applied) setModeState(theme)
  }, [theme, mode])

  // follow OS preference changes while in System mode
  React.useEffect(() => {
    if (mode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setTheme(mq.matches ? "dark" : "light")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [mode, setTheme])

  return { mode, setMode }
}

/* ------------------------------ shared helpers ------------------------------ */

type SettingsTab = "general" | "appearance" | "workspace" | "data" | "about"

const TABS: { id: SettingsTab; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "workspace", label: "Workspace defaults", icon: FileCog },
  { id: "data", label: "Data & storage", icon: Database },
  { id: "about", label: "About", icon: Info },
]

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6 rounded-xl border bg-background p-6">
      <div>
        <h2 className="text-[15px] font-medium">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/* --------------------------------- General ---------------------------------- */

function GeneralSection() {
  const user = useLocalUser()
  const { toast } = useToast()
  const [draftName, setDraftName] = React.useState<string | null>(null)

  const name = draftName ?? user?.name ?? ""

  // 400ms debounced save of the display name
  React.useEffect(() => {
    if (draftName === null || !user) return
    const t = setTimeout(() => {
      const trimmed = draftName.trim()
      if (trimmed && trimmed !== user.name) {
        saveLocalUser({ ...user, name: trimmed })
        toast({ title: "Name saved" })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [draftName, user, toast])

  if (!user) {
    return (
      <SectionCard title="Profile">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full max-w-sm" />
          </div>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Profile" description="How you appear across the Z workspace.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-black/5"
          style={{ backgroundColor: user.color }}
          aria-label={`Avatar preview: ${initialsOf(name)}`}
        >
          {initialsOf(name)}
        </div>
        <div className="min-w-0 max-w-sm flex-1">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={40}
            placeholder="Your name"
            className="mt-1.5 h-10"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Saved automatically as you type.</p>
        </div>
      </div>
      <div>
        <Label>Avatar color</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESENCE_COLORS.slice(0, 10).map((c) => {
            const selected = user.color === c
            return (
              <button
                key={c}
                type="button"
                aria-label={`Use color ${c}`}
                aria-pressed={selected}
                onClick={() => {
                  saveLocalUser({ ...user, color: c })
                  toast({ title: "Avatar color updated" })
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                )}
                style={{ backgroundColor: c }}
              >
                {selected ? <Check className="h-4 w-4 text-white" /> : null}
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your name and color appear in comments, presence and the activity feed.
      </p>
    </SectionCard>
  )
}

/* ------------------------------- Appearance --------------------------------- */

function WindowBody({ dark }: { dark: boolean }) {
  return (
    <div className={cn("flex-1", dark ? "bg-neutral-900" : "bg-white")}>
      <div
        className={cn(
          "flex h-4 items-center gap-1 border-b px-2",
          dark ? "border-neutral-700 bg-neutral-800" : "border-neutral-100 bg-neutral-50"
        )}
      >
        <span className="h-1 w-1 rounded-full bg-[#0b6b62]" />
        <span className={cn("h-1 w-4 rounded-full", dark ? "bg-neutral-600" : "bg-neutral-200")} />
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className={cn("h-1.5 w-3/5 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-200")} />
        <div className={cn("h-1.5 w-4/5 rounded-full", dark ? "bg-neutral-800" : "bg-neutral-100")} />
        <div className="h-1.5 w-1/3 rounded-full bg-[#0b6b62]" />
      </div>
    </div>
  )
}

function WindowPreview({ variant }: { variant: "light" | "dark" | "split" }) {
  if (variant === "split") {
    return (
      <div className="flex h-[72px] overflow-hidden rounded-md border border-neutral-300">
        <WindowBody dark={false} />
        <WindowBody dark />
      </div>
    )
  }
  return (
    <div
      className={cn(
        "h-[72px] overflow-hidden rounded-md border",
        variant === "dark" ? "border-neutral-700" : "border-neutral-200"
      )}
    >
      <WindowBody dark={variant === "dark"} />
    </div>
  )
}

const THEME_CARDS: { value: ThemeMode; label: string; hint: string; preview: "light" | "dark" | "split" }[] = [
  { value: "light", label: "Light", hint: "Bright surfaces", preview: "light" },
  { value: "dark", label: "Dark", hint: "Dimmed surfaces", preview: "dark" },
  { value: "system", label: "System", hint: "Follows your device", preview: "split" },
]

function AppearanceSection() {
  const { mode, setMode } = useThemeMode()
  const { resolvedTheme } = useTheme()
  const { toast } = useToast()
  const [accent, setAccent] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setAccent(readStoredAccent())
    setMounted(true)
  }, [])

  // keep the applied accent correct when the light/dark theme flips
  React.useEffect(() => {
    const hex = readStoredAccent()
    if (hex) applyAccent(hex)
  }, [resolvedTheme])

  const activeAccent = accent ?? DEFAULT_ACCENT_HEX

  return (
    <SectionCard title="Appearance" description="Choose how Z-Docs looks and feels.">
      <div>
        <Label>Theme</Label>
        <div role="radiogroup" aria-label="Theme" className="mt-2 grid grid-cols-3 gap-3 sm:max-w-lg">
          {THEME_CARDS.map((card) => {
            const selected = mounted && mode === card.value
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(card.value)}
                className={cn(
                  "rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-transparent ring-2 ring-primary"
                    : "border-border hover:bg-accent/50"
                )}
              >
                <WindowPreview variant={card.preview} />
                <span className="mt-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium">{card.label}</span>
                  {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{card.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <Label>Accent color</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Recolors buttons, links and highlights across the workspace.
        </p>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {ACCENT_OPTIONS.map((option) => {
            const selected = mounted && activeAccent === option.hex
            return (
              <button
                key={option.hex}
                type="button"
                aria-label={`Accent color: ${option.name}`}
                aria-pressed={selected}
                onClick={() => {
                  setAccent(option.hex)
                  saveAccent(option.hex)
                  toast({ title: `Accent set to ${option.name}` })
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                )}
                style={{ backgroundColor: option.hex }}
              >
                {selected ? <Check className="h-4 w-4 text-white" /> : null}
              </button>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}

/* --------------------------- Workspace defaults ----------------------------- */

function WorkspaceSection() {
  const { toast } = useToast()
  const [font, setFont] = React.useState<"sans" | "serif">("sans")
  const [zoom, setZoom] = React.useState<"100" | "125" | "150">("100")

  React.useEffect(() => {
    try {
      const f = window.localStorage.getItem(FONT_STORAGE_KEY)
      if (f === "sans" || f === "serif") setFont(f)
      const z = window.localStorage.getItem(ZOOM_STORAGE_KEY)
      if (z === "100" || z === "125" || z === "150") setZoom(z)
    } catch {
      // storage unavailable — defaults are fine
    }
  }, [])

  const saveFont = (value: string) => {
    if (value !== "sans" && value !== "serif") return
    setFont(value)
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, value)
    } catch {
      // ignore
    }
    toast({ title: value === "sans" ? "Default font set to Sans" : "Default font set to Serif" })
  }

  const saveZoom = (value: string) => {
    if (value !== "100" && value !== "125" && value !== "150") return
    setZoom(value)
    try {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, value)
    } catch {
      // ignore
    }
    toast({ title: `Default zoom set to ${value}%` })
  }

  return (
    <SectionCard
      title="Workspace defaults"
      description="Preferences used when creating new documents."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="default-font">Default font</Label>
          <Select value={font} onValueChange={saveFont}>
            <SelectTrigger id="default-font" className="mt-1.5 h-10 w-full">
              <SelectValue placeholder="Sans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sans">Sans (Arial)</SelectItem>
              <SelectItem value="serif">Serif (Georgia)</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">Used when creating new documents</p>
        </div>
        <div>
          <Label htmlFor="default-zoom">Default editor zoom</Label>
          <Select value={zoom} onValueChange={saveZoom}>
            <SelectTrigger id="default-zoom" className="mt-1.5 h-10 w-full">
              <SelectValue placeholder="100%" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100%</SelectItem>
              <SelectItem value="125">125%</SelectItem>
              <SelectItem value="150">150%</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">Used when creating new documents</p>
        </div>
      </div>
    </SectionCard>
  )
}

/* ------------------------------ Data & storage ------------------------------ */

interface ExportPayload {
  counts?: {
    documents?: number
    sheets?: number
    decks?: number
    forms?: number
    folders?: number
    tags?: number
  }
}

const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 // 10 MB demo quota

const STORAGE_STATS: { key: keyof NonNullable<ExportPayload["counts"]>; label: string; icon: LucideIcon }[] = [
  { key: "documents", label: "Documents", icon: FileText },
  { key: "sheets", label: "Spreadsheets", icon: FileSpreadsheet },
  { key: "decks", label: "Decks", icon: Presentation },
  { key: "forms", label: "Forms", icon: FormInput },
  { key: "folders", label: "Folders", icon: Folder },
  { key: "tags", label: "Tags", icon: Tag },
]

function DataSection() {
  const { toast } = useToast()
  const [counts, setCounts] = React.useState<NonNullable<ExportPayload["counts"]> | null>(null)
  const [bytes, setBytes] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let live = true
    const load = async () => {
      setError(null)
      try {
        const res = await fetch("/api/export")
        if (!res.ok) throw new Error(`Failed to load storage stats (${res.status})`)
        const text = await res.text()
        if (!live) return
        const payload = JSON.parse(text) as ExportPayload
        setCounts(payload.counts ?? {})
        setBytes(new TextEncoder().encode(text).length)
      } catch (e) {
        if (!live) return
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    }
    void load()
    return () => {
      live = false
    }
  }, [])

  const exportAll = () => {
    const a = document.createElement("a")
    a.href = "/api/export"
    a.setAttribute("download", "")
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast({ title: "Download started", description: "Your workspace is exporting as JSON." })
  }

  const resetLocal = () => {
    for (const key of [
      USER_STORAGE_KEY,
      ACCENT_STORAGE_KEY,
      FONT_STORAGE_KEY,
      ZOOM_STORAGE_KEY,
      THEME_MODE_STORAGE_KEY,
    ]) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // ignore
      }
    }
    window.location.reload()
  }

  const usedPercent = counts ? Math.min(100, (bytes / STORAGE_QUOTA_BYTES) * 100) : 0

  return (
    <SectionCard
      title="Data & storage"
      description="Everything you create lives in your local Z workspace database."
    >
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : counts ? (
        <>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium">Workspace storage</p>
              <p className="text-xs text-muted-foreground">
                <span className="tnum font-medium text-foreground">{formatBytes(bytes)}</span> used
                <span className="opacity-70"> · 10 MB quota</span>
              </p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Workspace storage used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPercent)}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STORAGE_STATS.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.key} className="flex items-center gap-3 rounded-lg border p-3">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="tnum text-[15px] font-medium leading-tight">
                      {counts[stat.key] ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STORAGE_STATS.map((stat) => (
              <Skeleton key={stat.key} className="h-14 rounded-lg" />
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={exportAll} className="h-10">
          <Download className="h-4 w-4" />
          Export all your data
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              Reset local profile
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset local profile?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears your saved name, avatar color, theme, accent and workspace defaults
                from this browser. Your documents, spreadsheets, decks and forms are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={resetLocal}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Reset &amp; reload
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SectionCard>
  )
}

/* ---------------------------------- About ----------------------------------- */

const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "Tailwind 4",
  "Prisma",
  "TipTap-style canvas",
  "socket.io collab",
]

function AboutSection() {
  return (
    <SectionCard title="About">
      <div className="flex items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary"
          aria-hidden="true"
        >
          <span className="logo-caret h-4 w-[3px] rounded-[1px] bg-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-editorial text-xl font-medium tracking-tight">Z-Docs</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            A Google-style workspace: Docs, Sheets, Slides &amp; Forms
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TECH_STACK.map((tech) => (
          <span
            key={tech}
            className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground"
          >
            {tech}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Local demo — all data lives in your browser and local database.
      </p>
    </SectionCard>
  )
}

/* ---------------------------------- page ------------------------------------ */

export function SettingsView() {
  const goHome = useDocsStore((s) => s.goHome)
  const [tab, setTab] = React.useState<SettingsTab>("general")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={goHome}
              aria-label="Back to home"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Back
          </TooltipContent>
        </Tooltip>
        <h1 className="text-lg font-medium">Settings</h1>
        <span
          className="ml-auto rounded-full border bg-background px-3 py-1 text-[11px] text-muted-foreground tnum"
          aria-label="Version"
        >
          Z-Docs v1.0
        </span>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
          <div className="flex flex-col gap-8 md:flex-row">
            <nav aria-label="Settings sections" className="shrink-0 md:w-48">
              <div
                role="tablist"
                aria-label="Settings sections"
                className="flex gap-1 overflow-x-auto pb-1 no-scrollbar md:flex-col md:overflow-x-visible md:pb-0 md:sticky md:top-24"
              >
                {TABS.map((t) => {
                  const Icon = t.icon
                  const active = tab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </nav>
            <div className="min-w-0 flex-1">
              {tab === "general" ? <GeneralSection /> : null}
              {tab === "appearance" ? <AppearanceSection /> : null}
              {tab === "workspace" ? <WorkspaceSection /> : null}
              {tab === "data" ? <DataSection /> : null}
              {tab === "about" ? <AboutSection /> : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
