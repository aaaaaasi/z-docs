"use client"

import * as React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useDocsStore } from "@/store/docs-store"
import { HomeView } from "./home/home-view"
import { EditorView } from "./editor/editor-view"

export function DocsApp() {
  const view = useDocsStore((s) => s.view)
  const hydrateFromUrl = useDocsStore((s) => s.hydrateFromUrl)
  const bindPopState = useDocsStore((s) => s.bindPopState)
  const hydrated = React.useRef(false)

  React.useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    void hydrateFromUrl()
    const unbind = bindPopState()
    return unbind
  }, [hydrateFromUrl, bindPopState])

  return (
    <TooltipProvider delayDuration={250}>
      <div key={view} className="animate-view-in">
        {view === "home" ? <HomeView /> : <EditorView />}
      </div>
    </TooltipProvider>
  )
}
