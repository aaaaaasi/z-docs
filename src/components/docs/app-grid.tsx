"use client"

import * as React from "react"
import { FileClock, LayoutGrid, Settings as SettingsIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useDocsStore } from "@/store/docs-store"
import { APP_META } from "@/components/docs/activity/activity-meta"
import { useI18n } from "@/lib/i18n"
import type { WorkspaceApp } from "@/lib/workspace-types"

const APP_ORDER: WorkspaceApp[] = ["docs", "sheets", "slides", "forms"]

/** The Z workspace app launcher (Google apps-grid style). */
export function AppGridMenu() {
  const [open, setOpen] = React.useState(false)
  const { t } = useI18n()
  const openApp = useDocsStore((s) => s.openApp)
  const goHome = useDocsStore((s) => s.goHome)
  const openActivity = useDocsStore((s) => s.openActivity)
  const openSettings = useDocsStore((s) => s.openSettings)

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Z workspace apps")}
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
        >
          <LayoutGrid className="h-4.5 w-4.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={8} className="w-72 rounded-xl p-3 shadow-xl">
        <p className="px-2 pb-1.5 pt-1 text-xs font-medium tracking-wide text-muted-foreground">
          {t("Z Workspace")}
        </p>
        <div className="grid grid-cols-2 gap-1">
          {APP_ORDER.map((app) => {
            const meta = APP_META[app]
            const Icon = meta.icon
            return (
              <button
                key={app}
                type="button"
                onClick={() => run(() => (app === "docs" ? goHome() : openApp(app)))}
                className="flex flex-col items-center gap-1.5 rounded-lg p-2 pb-2.5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                    color: meta.color,
                  }}
                  aria-hidden="true"
                >
                  <Icon className="h-5.5 w-5.5" />
                </span>
                <span className="text-xs font-medium">{meta.label}</span>
              </button>
            )
          })}
        </div>
        <Separator className="my-2" />
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => run(openActivity)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
          >
            <FileClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-[13px]">{t("Recent activity")}</span>
          </button>
          <button
            type="button"
            onClick={() => run(openSettings)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
          >
            <SettingsIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-[13px]">{t("Settings")}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
