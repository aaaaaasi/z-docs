"use client"

import { HomeHeader } from "./home-header"
import { SidebarNav } from "./sidebar-nav"
import { TemplateGallery } from "./template-gallery"
import { WorkspaceQuickstart } from "./quickstart"
import { DocsGrid } from "./docs-grid"
import { HomeDndContext } from "./doc-dnd"

export function HomeView() {
  return (
    <HomeDndContext>
      <div className="flex min-h-screen flex-col bg-background">
        <HomeHeader />
        <div className="flex flex-1 overflow-hidden">
          <SidebarNav />
          <main className="min-w-0 flex-1">
            <TemplateGallery />
            <WorkspaceQuickstart />
            <DocsGrid />
          </main>
        </div>
        <footer className="mt-auto border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="font-editorial text-[13px] font-medium tracking-tight text-foreground/70">Z-Docs</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">documents for teams</span>
          </span>
        </footer>
      </div>
    </HomeDndContext>
  )
}
