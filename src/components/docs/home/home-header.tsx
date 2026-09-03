"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Search, Menu, FileText, LayoutGrid, Settings } from "lucide-react"
import { UserMenu } from "@/components/docs/user-menu"
import { ThemeToggle } from "@/components/docs/theme-toggle"
import { useDocsStore } from "@/store/docs-store"
import { SidebarNavContent } from "./sidebar-nav"

/** Logo wordmark used across the app */
export function DocsLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-md" : "h-9 w-9 rounded-[10px]"
  const text = size === "sm" ? "text-lg" : "text-xl"
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className={`${box} flex items-center justify-center bg-primary text-primary-foreground shadow-sm`}>
        <FileText className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      <span className={`${text} font-semibold tracking-tight text-muted-foreground`}>
        Z<span className="text-foreground">-Docs</span>
      </span>
    </div>
  )
}

export function HomeHeader() {
  const searchQuery = useDocsStore((s) => s.searchQuery)
  const setSearchQuery = useDocsStore((s) => s.setSearchQuery)
  const refresh = useDocsStore((s) => s.refresh)
  const [local, setLocal] = React.useState("")

  // debounce search -> store -> refetch
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (local !== searchQuery) {
        setSearchQuery(local)
        void refresh({ silent: true })
      }
    }, 350)
    return () => clearTimeout(t)
  }, [local, searchQuery, setSearchQuery, refresh])

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNavContent inSheet />
          </SheetContent>
        </Sheet>
      </div>

      <DocsLogo />

      <div className="relative ml-2 hidden max-w-xl flex-1 items-center sm:flex">
        <Search className="pointer-events-none absolute left-4 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Search your documents"
          aria-label="Search documents"
          className="h-11 rounded-full border-transparent bg-muted pl-11 pr-4 text-sm focus-visible:border-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* mobile search icon toggles inline field */}
        <div className="relative flex items-center sm:hidden">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Search"
            aria-label="Search documents"
            className="h-9 w-28 rounded-full border-transparent bg-muted pl-9 pr-3 text-sm focus-visible:w-40"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-full text-muted-foreground hover:text-foreground sm:flex" aria-label="Apps (demo)">
              <LayoutGrid className="h-4.5 w-4.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">More apps coming soon</TooltipContent>
        </Tooltip>
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-full text-muted-foreground hover:text-foreground sm:flex" aria-label="Settings (demo)">
              <Settings className="h-4.5 w-4.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Settings</TooltipContent>
        </Tooltip>
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
