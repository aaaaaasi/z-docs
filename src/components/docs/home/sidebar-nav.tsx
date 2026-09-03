"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { SheetClose } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  Home, Star, Trash2, Plus, FileSpreadsheet, Presentation, FileClock, FormInput, Cloud
} from "lucide-react"
import { useDocsStore } from "@/store/docs-store"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

function Wrap({ children, inSheet }: { children: ReactNode; inSheet: boolean }) {
  return inSheet ? <SheetClose asChild>{children as React.ReactElement}</SheetClose> : <>{children}</>
}

export function NewDocButton({ className, label = "New document" }: { className?: string; label?: string }) {
  const createDoc = useDocsStore((s) => s.createDoc)
  const openDoc = useDocsStore((s) => s.openDoc)
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)

  return (
    <Button
      className={cn("gap-2", className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const id = await createDoc({ templateId: "blank" })
          if (id) openDoc(id)
          else toast({ title: "Could not create document", variant: "destructive" })
        } finally {
          setBusy(false)
        }
      }}
    >
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  )
}

export function SidebarNavContent({ inSheet = false }: { inSheet?: boolean }) {
  const filter = useDocsStore((s) => s.filter)
  const setFilter = useDocsStore((s) => s.setFilter)
  const documents = useDocsStore((s) => s.documents)

  const starredCount = documents.filter((d) => d.starred && !d.trashed).length

  const navItem = (
    active: boolean,
    icon: ReactNode,
    label: string,
    onSelect: () => void,
    badge?: number
  ) => {
    const btn = (
      <Button
        variant="ghost"
        onClick={onSelect}
        className={cn(
          "w-full justify-start gap-3 rounded-full px-4 py-2.5 text-sm font-normal",
          active ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
        )}
      </Button>
    )
    return <Wrap inSheet={inSheet}>{btn}</Wrap>
  }

  return (
    <div className="flex h-full flex-col p-3">
      <div className="px-2 pb-3 pt-1">
        <NewDocButton className="w-full rounded-full" />
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Document filters">
        {navItem(filter === "all", <Home className="h-4.5 w-4.5" />, "All documents", () => setFilter("all"))}
        {navItem(filter === "starred", <Star className="h-4.5 w-4.5" />, "Starred", () => setFilter("starred"), starredCount)}
        {navItem(filter === "trash", <Trash2 className="h-4.5 w-4.5" />, "Trash", () => setFilter("trash"))}
      </nav>

      <div className="mt-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workspace
      </div>
      <nav className="mt-1 flex flex-col gap-0.5" aria-label="Workspace apps">
        {[
          { icon: <FileClock className="h-4.5 w-4.5" />, label: "Recent activity", active: false },
          { icon: <FileSpreadsheet className="h-4.5 w-4.5" />, label: "Z-Sheets", active: false },
          { icon: <Presentation className="h-4.5 w-4.5" />, label: "Z-Slides", active: false },
          { icon: <FormInput className="h-4.5 w-4.5" />, label: "Z-Forms", active: false },
        ].map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                disabled
                className="w-full justify-start gap-3 rounded-full px-4 py-2.5 text-sm font-normal text-muted-foreground/70"
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                <span className="rounded-full border bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  soon
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Coming soon</TooltipContent>
          </Tooltip>
        ))}
      </nav>

      <div className="mt-auto px-4 pb-4">
        <div className="rounded-xl border bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cloud className="h-4 w-4" />
            Storage
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[12%] rounded-full bg-primary" />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">1.8 GB of 15 GB used</p>
        </div>
      </div>
    </div>
  )
}

export function SidebarNav() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block" aria-label="Navigation">
      <SidebarNavContent />
    </aside>
  )
}
