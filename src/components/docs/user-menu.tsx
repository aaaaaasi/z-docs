"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useLocalUser, saveLocalUser } from "@/lib/identity"
import { initialsOf, PRESENCE_COLORS } from "@/lib/doc-utils"
import { useI18n } from "@/lib/i18n"
import { Check } from "lucide-react"

/** Avatar button + popover to edit your display name & color */
export function UserMenu({ align = "end" }: { align?: "start" | "center" | "end" }) {
  const user = useLocalUser()
  const { t } = useI18n()
  const [draft, setDraft] = React.useState<string | null>(null)

  if (!user) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
  }
  const name = draft ?? user.name

  const apply = () => {
    saveLocalUser({ ...user, name: name.trim() || user.name })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={t("Account settings")}
          className="h-9 w-9 rounded-full text-sm font-semibold text-white ring-2 ring-background transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: user.color }}
        >
          {initialsOf(user.name)}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {initialsOf(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{t("Local account · demo")}</p>
            </div>
          </div>
          <Separator className="my-3" />
          <label className="text-xs font-medium text-muted-foreground">{t("Display name")}</label>
          <Input
            value={name}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="mt-1 h-8"
            maxLength={40}
          />
          <label className="mt-3 block text-xs font-medium text-muted-foreground">{t("Avatar color")}</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESENCE_COLORS.slice(0, 10).map((c) => (
              <button
                key={c}
                aria-label={t("Use color {color}", { color: c })}
                onClick={() => {
                  saveLocalUser({ ...user, color: c })
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
              >
                {user.color === c && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
          <Button size="sm" className="mt-3 w-full" onClick={apply}>
            {t("Save profile")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
