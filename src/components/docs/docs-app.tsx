"use client"

import * as React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useDocsStore } from "@/store/docs-store"
import { I18nProvider } from "@/lib/i18n"
import { LoginScreen } from "./login-screen"
import { DocsLogo } from "./home/home-header"
import { HomeView } from "./home/home-view"
import { EditorView } from "./editor/editor-view"
import { SheetsApp } from "./sheets/sheets-app"
import { SlidesApp } from "./slides/slides-app"
import { FormsApp } from "./forms/forms-app"
import { ActivityView } from "./activity/activity-view"
import { SettingsView } from "./settings/settings-view"
import { SettingsEffects } from "./settings/settings-effects"

export function DocsApp() {
  const view = useDocsStore((s) => s.view)
  const hydrateFromUrl = useDocsStore((s) => s.hydrateFromUrl)
  const bindPopState = useDocsStore((s) => s.bindPopState)
  const authUser = useDocsStore((s) => s.authUser)
  const authLoaded = useDocsStore((s) => s.authLoaded)
  const hydrated = React.useRef(false)

  React.useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    useDocsStore.getState().initUnauthorizedListener()
    void hydrateFromUrl()
    const unbind = bindPopState()
    return unbind
  }, [hydrateFromUrl, bindPopState])

  return (
    <I18nProvider>
      <TooltipProvider delayDuration={250}>
        {/* applies persisted settings (accent color) at app level */}
        <SettingsEffects />
        {!authLoaded ? (
          <div className="flex min-h-dvh items-center justify-center bg-background" aria-label="Loading">
            <DocsLogo size="sm" />
          </div>
        ) : !authUser ? (
          <LoginScreen />
        ) : (
          <div key={view} className="animate-view-in">
            {view === "home" && <HomeView />}
            {view === "editor" && <EditorView />}
            {view === "sheets" && <SheetsApp />}
            {view === "slides" && <SlidesApp />}
            {view === "forms" && <FormsApp />}
            {view === "activity" && <ActivityView />}
            {view === "settings" && <SettingsView />}
          </div>
        )}
      </TooltipProvider>
    </I18nProvider>
  )
}
