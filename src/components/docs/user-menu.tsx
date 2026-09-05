"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useLocalUser, saveLocalUser } from "@/lib/identity"
import { initialsOf, PRESENCE_COLORS } from "@/lib/doc-utils"
import { useI18n } from "@/lib/i18n"
import { useDocsStore } from "@/store/docs-store"
import { Check, CloudUpload, HardDrive, LogOut } from "lucide-react"

/** Avatar button + account popover: real account info, presence color, sign out;
 *  guests get a local-mode card with a sign-in call to action. */
export function UserMenu({ align = "end" }: { align?: "start" | "center" | "end" }) {
  const presence = useLocalUser()
  const authUser = useDocsStore((s) => s.authUser)
  const guestMode = useDocsStore((s) => s.guestMode)
  const logout = useDocsStore((s) => s.logout)
  const showAuthScreen = useDocsStore((s) => s.showAuthScreen)
  const { t } = useI18n()

  if (!presence) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={t("Account settings")}
          className="h-9 w-9 rounded-full text-sm font-semibold text-white ring-2 ring-background transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: presence.color }}
        >
          {initialsOf(presence.name)}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: presence.color }}
            >
              {initialsOf(presence.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{authUser?.name ?? presence.name}</p>
              {authUser ? (
                <p className="truncate text-xs text-muted-foreground">{authUser.email}</p>
              ) : guestMode ? (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <HardDrive className="h-3 w-3 text-primary" aria-hidden="true" />
                  {t("Guest · Local mode — data stays on this device")}
                </p>
              ) : null}
            </div>
          </div>
          <Separator className="my-3" />
          <label className="mt-0 block text-xs font-medium text-muted-foreground">{t("Avatar color")}</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESENCE_COLORS.slice(0, 10).map((c) => (
              <button
                key={c}
                aria-label={t("Use color {color}", { color: c })}
                onClick={() => {
                  saveLocalUser({ ...presence, color: c })
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
              >
                {presence.color === c && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
          {guestMode && !authUser ? (
            <Button
              size="sm"
              className="mt-4 w-full rounded-full"
              onClick={showAuthScreen}
            >
              <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Sign in to sync & share")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-4 w-full text-muted-foreground hover:text-destructive hover:border-destructive/40"
              onClick={() => void logout()}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Sign out")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
