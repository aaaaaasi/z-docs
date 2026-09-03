"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AvatarStack } from "@/components/docs/avatar-stack"
import { ThemeToggle } from "@/components/docs/theme-toggle"
import { UserMenu } from "@/components/docs/user-menu"
import { DocsLogo } from "@/components/docs/home/home-header"
import type { EditorApi } from "./editor-types"
import { Star, CloudCheck, CloudOff, CloudUpload, Users, ArrowLeft, Share2, MessageSquare, ListTree } from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/doc-utils"

function SaveState({ api }: { api: EditorApi }) {
  const [text, icon, cls] =
    api.saveStatus === "saving"
      ? ["Saving…", CloudUpload, "text-muted-foreground"]
      : api.saveStatus === "unsaved"
        ? ["Unsaved changes", CloudUpload, "text-amber-600"]
        : api.saveStatus === "error"
          ? ["Offline — retrying", CloudOff, "text-destructive"]
          : ["All changes saved", CloudCheck, "text-muted-foreground"]

  return (
    <div className={cn("flex items-center gap-1 text-xs", cls)}>
      {React.createElement(icon, { className: "h-3.5 w-3.5" })}
      <span>
        {text}
        {api.saveStatus === "saved" && api.lastSavedAt && (
          <span className="hidden sm:inline"> · {relativeTime(api.lastSavedAt.toISOString())}</span>
        )}
      </span>
    </div>
  )
}

export function EditorHeader({ api }: { api: EditorApi }) {
  const titleRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    // keep the input wide enough for its content
    const el = titleRef.current
    if (!el) return
    el.style.width = `${Math.max(api.title.length, 1)}ch`
  }, [api.title])

  return (
    <header className="no-print z-40 flex min-h-14 flex-wrap items-center gap-2 border-b bg-background px-2 py-1.5 sm:px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={api.goHome}
            aria-label="Back to documents"
            className="rounded-md p-1.5 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Back to documents</TooltipContent>
      </Tooltip>

      <DocsLogo size="sm" />

      <div className="ml-1 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <div className="flex items-center">
          <input
            ref={titleRef}
            value={api.title}
            onChange={(e) => api.onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                api.focusEditor()
              }
            }}
            aria-label="Document title"
            maxLength={150}
            className="min-w-[4ch] max-w-full truncate rounded px-1.5 py-0.5 text-lg font-medium outline-none hover:bg-muted/60 focus:bg-muted"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={api.toggleStar}
                aria-label={api.starred ? "Remove star" : "Add star"}
                className="rounded-full p-1.5 transition-colors hover:bg-muted"
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    api.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {api.starred ? "Remove star" : "Star this document"}
            </TooltipContent>
          </Tooltip>
        </div>
        <SaveState api={api} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {api.presence.length > 0 && (
          <div className="hidden items-center gap-2 sm:flex">
            <AvatarStack users={api.presence} size="sm" max={3} />
            <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
              <Users className="h-3.5 w-3.5" />
              {api.presence.length === 1 ? "1 editor" : `${api.presence.length} editors`}
            </span>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => api.toggleOutline()}
              aria-label={api.outlineOpen ? "Hide document outline" : "Show document outline"}
              aria-pressed={api.outlineOpen}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-muted",
                api.outlineOpen ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <ListTree className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {api.outlineOpen ? "Hide document outline" : "Show document outline"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => api.toggleComments()}
              aria-label={api.commentsOpen ? "Hide comments" : "Show comments"}
              aria-pressed={api.commentsOpen}
              className={cn(
                "relative rounded-md p-2 transition-colors hover:bg-muted",
                api.commentsOpen ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <MessageSquare className="h-4.5 w-4.5" />
              {api.unresolvedCommentCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow"
                  aria-label={`${api.unresolvedCommentCount} unresolved comments`}
                >
                  {api.unresolvedCommentCount > 9 ? "9+" : api.unresolvedCommentCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {api.commentsOpen ? "Hide comments" : "Show comments"}
            {api.unresolvedCommentCount > 0 ? ` (${api.unresolvedCommentCount})` : ""}
          </TooltipContent>
        </Tooltip>
        <Button
          size="sm"
          className="gap-2 rounded-full px-4 max-sm:px-3"
          onClick={() => api.openDialog("share")}
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
