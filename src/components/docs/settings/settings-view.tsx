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
import { trackedDownload } from "@/store/export-progress-store"
import { guestDbStats, readGuestSnapshot, clearGuestData } from "@/lib/local-mode"
import { useLocalUser, saveLocalUser } from "@/lib/identity"
import { initialsOf, PRESENCE_COLORS } from "@/lib/doc-utils"
import { useI18n, type Lang } from "@/lib/i18n"
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
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

/* --------------------------------- General ---------------------------------- */

function GeneralSection() {
  const { t } = useI18n()
  const user = useLocalUser()
  const { toast } = useToast()
  const [draftName, setDraftName] = React.useState<string | null>(null)

  const name = draftName ?? user?.name ?? ""

  // 400ms debounced save of the display name
  React.useEffect(() => {
    if (draftName === null || !user) return
    const timer = setTimeout(() => {
      const trimmed = draftName.trim()
      if (trimmed && trimmed !== user.name) {
        saveLocalUser({ ...user, name: trimmed })
        toast({ title: t("Name saved") })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [draftName, user, toast, t])

  if (!user) {
    return (
      <SectionCard title={t("Profile")}>
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
    <SectionCard title={t("Profile")} description={t("How you appear across the Z workspace.")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-black/5"
          style={{ backgroundColor: user.color }}
          aria-label={t("Avatar preview: {initials}", { initials: initialsOf(name) })}
        >
          {initialsOf(name)}
        </div>
        <div className="min-w-0 max-w-sm flex-1">
          <Label htmlFor="display-name">{t("Display name")}</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={40}
            placeholder={t("Your name")}
            className="mt-1.5 h-10"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t("Saved automatically as you type.")}</p>
        </div>
      </div>
      <div>
        <Label>{t("Avatar color")}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESENCE_COLORS.slice(0, 10).map((c) => {
            const selected = user.color === c
            return (
              <button
                key={c}
                type="button"
                aria-label={t("Use color {color}", { color: c })}
                aria-pressed={selected}
                onClick={() => {
                  saveLocalUser({ ...user, color: c })
                  toast({ title: t("Avatar color updated") })
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
        {t("Your name and color appear in comments, presence and the activity feed.")}
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

/* Native names shown as-is in every language (same convention as lang-toggle). */
const LANG_CARDS: { value: Lang; label: string; sample: string }[] = [
  { value: "zh", label: "中文", sample: "你好，Z-Docs" },
  { value: "en", label: "English", sample: "Hello, Z-Docs" },
]

function LanguagePreview({ text }: { text: string }) {
  return (
    <div className="flex h-[72px] items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <span className="px-3 text-center text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">
        {text}
      </span>
    </div>
  )
}

function AppearanceSection() {
  const { mode, setMode } = useThemeMode()
  const { resolvedTheme } = useTheme()
  const { toast } = useToast()
  const { lang, setLang, t } = useI18n()
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
    <div className="space-y-8">
      <SectionCard title={t("Appearance")} description={t("Choose how Z-Docs looks and feels.")}>
        <div>
          <Label>{t("Theme")}</Label>
          <div role="radiogroup" aria-label={t("Theme")} className="mt-2 grid grid-cols-3 gap-3 sm:max-w-lg">
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
                    <span className="text-[13px] font-medium">{t(card.label)}</span>
                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{t(card.hint)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <Label>{t("Accent color")}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("Recolors buttons, links and highlights across the workspace.")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {ACCENT_OPTIONS.map((option) => {
              const selected = mounted && activeAccent === option.hex
              return (
                <button
                  key={option.hex}
                  type="button"
                  aria-label={t("Accent color: {name}", { name: t(option.name) })}
                  aria-pressed={selected}
                  onClick={() => {
                    setAccent(option.hex)
                    saveAccent(option.hex)
                    toast({ title: t("Accent set to {name}", { name: t(option.name) }) })
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
      <SectionCard title={t("Language")} description={t("Choose the display language for the workspace.")}>
        <div role="radiogroup" aria-label={t("Language")} className="grid grid-cols-2 gap-3 sm:max-w-md">
          {LANG_CARDS.map((card) => {
            const selected = lang === card.value
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLang(card.value)}
                className={cn(
                  "rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-transparent ring-2 ring-primary"
                    : "border-border hover:bg-accent/50"
                )}
              >
                <LanguagePreview text={card.sample} />
                <span className="mt-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium">{card.label}</span>
                  {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

/* --------------------------- Workspace defaults ----------------------------- */

function WorkspaceSection() {
  const { t } = useI18n()
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
    toast({ title: value === "sans" ? t("Default font set to Sans") : t("Default font set to Serif") })
  }

  const saveZoom = (value: string) => {
    if (value !== "100" && value !== "125" && value !== "150") return
    setZoom(value)
    try {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, value)
    } catch {
      // ignore
    }
    toast({ title: t("Default zoom set to {value}%", { value }) })
  }

  return (
    <SectionCard
      title={t("Workspace defaults")}
      description={t("Preferences used when creating new documents.")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="default-font">{t("Default font")}</Label>
          <Select value={font} onValueChange={saveFont}>
            <SelectTrigger id="default-font" className="mt-1.5 h-10 w-full">
              <SelectValue placeholder={t("Sans")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sans">{t("Sans (Arial)")}</SelectItem>
              <SelectItem value="serif">{t("Serif (Georgia)")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("Used when creating new documents")}</p>
        </div>
        <div>
          <Label htmlFor="default-zoom">{t("Default editor zoom")}</Label>
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
          <p className="mt-1.5 text-xs text-muted-foreground">{t("Used when creating new documents")}</p>
        </div>
      </div>
    </SectionCard>
  )
}

/* ------------------------------ Data & storage ------------------------------ */

interface StoragePayload {
  usedBytes?: number
  quotaBytes?: number
  counts?: {
    documents?: number
    sheets?: number
    slides?: number
    forms?: number
    folders?: number
    tags?: number
  }
}

const STORAGE_STATS: { key: keyof NonNullable<StoragePayload["counts"]>; label: string; icon: LucideIcon }[] = [
  { key: "documents", label: "Documents", icon: FileText },
  { key: "sheets", label: "Spreadsheets", icon: FileSpreadsheet },
  { key: "slides", label: "Decks", icon: Presentation },
  { key: "forms", label: "Forms", icon: FormInput },
  { key: "folders", label: "Folders", icon: Folder },
  { key: "tags", label: "Tags", icon: Tag },
]

function DataSection() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [counts, setCounts] = React.useState<NonNullable<StoragePayload["counts"]> | null>(null)
  const [bytes, setBytes] = React.useState(0)
  const [quota, setQuota] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let live = true
    const load = async () => {
      setError(null)
      try {
        // single source of truth — same /api/storage the sidebar reads, so the
        // two surfaces can never disagree (they previously used different
        // quotas: 10 MB here vs 15 GB there)
        const res = await fetch("/api/storage")
        if (!res.ok) throw new Error("Failed to load storage stats")
        const payload = (await res.json()) as StoragePayload
        if (!live) return
        setCounts(payload.counts ?? {})
        setBytes(payload.usedBytes ?? 0)
        setQuota(payload.quotaBytes ?? 0)
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

  const exportAll = async () => {
    // fetch-based so guest mode is served by the local API shim (an anchor
    // navigation would bypass it and hit the server unauthenticated)
    try {
      const res = await fetch("/api/export")
      if (!res.ok) throw new Error("export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "z-workspace-export.json"
      document.body.appendChild(a)
      a.click()
      a.remove()
      // async revoke — synchronous revoke can kill the transfer on slow browsers
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      toast({ title: t("Download started"), description: t("Your workspace is exporting as JSON.") })
    } catch {
      toast({ title: t("Download failed"), description: t("Please try again in a moment.") })
    }
  }

  const resetLocal = () => {
    for (const key of [
      USER_STORAGE_KEY,
      "zdocs-guest",
      "zdocs-guest-db",
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

  const usedPercent = counts && quota > 0 ? Math.min(100, (bytes / quota) * 100) : 0

  return (
    <SectionCard
      title={t("Data & storage")}
      description={t("Everything you create lives in your local Z workspace database.")}
    >
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {t(error)}
        </p>
      ) : counts ? (
        <>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium">{t("Workspace storage")}</p>
              <p className="text-xs text-muted-foreground">
                <span className="tnum font-medium text-foreground">{t("{size} used", { size: formatBytes(bytes) })}</span>
                <span className="opacity-70"> · {quota > 0 ? t("{size} quota", { size: formatBytes(quota) }) : ""}</span>
              </p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t("Workspace storage used")}
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
                    <p className="text-[11px] text-muted-foreground">{t(stat.label)}</p>
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
          {t("Export all your data")}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              {t("Reset local profile")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Reset local profile?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("This clears your saved name, avatar color, theme, accent and workspace defaults from this browser. Your documents, spreadsheets, decks and forms are kept.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={resetLocal}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {t("Reset & reload")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SectionCard>
  )
}

/* ------------------------- guest (local-only) data -------------------------- */

/** Row chips shown for the local guest database (order matters for display). */
const GUEST_COUNT_KEYS: { key: string; label: string }[] = [
  { key: "documents", label: "Docs" },
  { key: "sheets", label: "Sheets" },
  { key: "decks", label: "Slides" },
  { key: "forms", label: "Forms" },
  { key: "comments", label: "Comments" },
  { key: "folders", label: "Folders" },
]

/**
 * Local data management for guest mode: the workspace is running entirely on
 * localStorage, so this card surfaces the real byte usage + row counts, a
 * JSON backup download, and a confirmed wipe. Hidden for signed-in users
 * (their data lives in the server DB, managed by the cloud section above).
 */
function GuestDataSection() {
  const { t } = useI18n()
  const { toast } = useToast()
  const guestMode = useDocsStore((s) => s.guestMode)
  const [stats, setStats] = React.useState<{ bytes: number; counts: Record<string, number> } | null>(null)

  React.useEffect(() => {
    if (!guestMode) return
    setStats(guestDbStats())
  }, [guestMode])

  if (!guestMode) return null

  const exportBackup = () => {
    const snapshot = readGuestSnapshot()
    const stamp = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const name = `z-draft-backup-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.json`
    const blob = new Blob([JSON.stringify({ app: "Z-Docs", kind: "guest-backup", exportedAt: new Date().toISOString(), snapshot }, null, 2)], {
      type: "application/json;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    trackedDownload({ kind: "json", title: t("Local backup"), fileName: name, byteSize: blob.size }).finish(true)
    toast({ title: t("Backup downloaded"), description: name })
  }

  const wipeAll = () => {
    clearGuestData()
    window.location.reload()
  }

  const counts = stats?.counts ?? {}

  return (
    <SectionCard
      title={t("Local data (this device only)")}
      description={t("You are in guest mode — everything lives in this browser’s local storage. Sign in to sync it to the cloud.")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium">{t("Local database")}</p>
        <p className="text-xs text-muted-foreground">
          <span className="tnum font-medium text-foreground">
            {stats ? t("{size} stored locally", { size: formatBytes(stats.bytes) }) : "…"}
          </span>
        </p>
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <div className="flex flex-wrap gap-1.5">
          {GUEST_COUNT_KEYS.map(({ key, label }) => (
            <span
              key={key}
              className="tnum rounded-full border px-2.5 py-0.5 text-[12px] text-muted-foreground"
            >
              {t(label)} {counts[key] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={exportBackup} className="h-10">
          <Download className="h-4 w-4" />
          {t("Export backup (JSON)")}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              {t("Clear local data")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Clear all local data?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("Every document, spreadsheet, deck, form and comment stored in this browser will be deleted. Export a backup first if you want to keep them.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={wipeAll}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {t("Clear & reload")}
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
  const { t } = useI18n()
  return (
    <SectionCard title={t("About")}>
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
            {t("A Google-style workspace: Docs, Sheets, Slides & Forms")}
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
        {t("Local demo — all data lives in your browser and local database.")}
      </p>
    </SectionCard>
  )
}

/* ---------------------------------- page ------------------------------------ */

export function SettingsView() {
  const { t } = useI18n()
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
              aria-label={t("Back to home")}
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("Back")}
          </TooltipContent>
        </Tooltip>
        <h1 className="text-lg font-medium">{t("Settings")}</h1>
        <span
          className="ml-auto rounded-full border bg-background px-3 py-1 text-[11px] text-muted-foreground tnum"
          aria-label={t("Version")}
        >
          Z-Docs v1.0
        </span>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
          <div className="flex flex-col gap-8 md:flex-row">
            <nav aria-label={t("Settings sections")} className="shrink-0 md:w-48">
              <div
                role="tablist"
                aria-label={t("Settings sections")}
                className="flex gap-1 overflow-x-auto pb-1 no-scrollbar md:flex-col md:overflow-x-visible md:pb-0 md:sticky md:top-24"
              >
                {TABS.map((tabItem) => {
                  const Icon = tabItem.icon
                  const active = tab === tabItem.id
                  return (
                    <button
                      key={tabItem.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(tabItem.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(tabItem.label)}
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
              {tab === "data" ? <GuestDataSection /> : null}
              {tab === "about" ? <AboutSection /> : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
