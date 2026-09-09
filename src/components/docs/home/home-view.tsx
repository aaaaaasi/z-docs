"use client"

import * as React from "react"
import { HomeHeader } from "./home-header"
import { SidebarNav } from "./sidebar-nav"
import { TemplateGallery } from "./template-gallery"
import { WorkspaceQuickstart } from "./quickstart"
import { DocsGrid } from "./docs-grid"
import { HomeDndContext } from "./doc-dnd"
import { useI18n } from "@/lib/i18n"
import { useDocsStore } from "@/store/docs-store"

export function HomeView() {
  const { t } = useI18n()
  // The "Start a new document / More ways to start" panels belong ONLY to the
  // plain All-documents view — every other context (starred, trash, folder,
  // tag filter, active search) is a results view and hides them, exactly like
  // Google Drive's template row.
  const filter = useDocsStore((s) => s.filter)
  const activeFolderId = useDocsStore((s) => s.activeFolderId)
  const tagFilter = useDocsStore((s) => s.tagFilter)
  const searchQuery = useDocsStore((s) => s.searchQuery)
  const showStartPanels =
    filter === "all" && !activeFolderId && !tagFilter && !searchQuery.trim()

  return (
    <HomeDndContext>
      <div className="flex min-h-screen flex-col bg-background">
        <HomeHeader />
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="min-w-0 flex-1">
            {showStartPanels && (
              <>
                <TemplateGallery />
                <WorkspaceQuickstart />
              </>
            )}
            <DocsGrid />
          </main>
        </div>
        <footer className="mt-auto border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="font-editorial text-[13px] font-medium tracking-tight text-foreground/70">Z-Docs</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{t("documents for teams")}</span>
          </span>
        </footer>
      </div>
    </HomeDndContext>
  )
}
