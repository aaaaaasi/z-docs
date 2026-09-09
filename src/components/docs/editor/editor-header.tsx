"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AvatarStack } from "@/components/docs/avatar-stack"
import { ThemeToggle } from "@/components/docs/theme-toggle"
import { LangToggle } from "@/components/docs/lang-toggle"
import { UserMenu } from "@/components/docs/user-menu"
import { DocsLogo } from "@/components/docs/home/home-header"
import type { EditorApi } from "./editor-types"
import { Star, CloudCheck, CloudOff, CloudUpload, Users, ArrowLeft, Share2, MessageSquare, ListTree, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/doc-utils"
import { useI18n } from "@/lib/i18n"

function SaveState({ api }: { api: EditorApi }) {
  const { t, lang } = useI18n()
  const [text, icon, cls] =
    api.saveStatus === "saving"
      ? [t("Saving…"), CloudUpload, "text-muted-foreground"]
      : api.saveStatus === "unsaved"
        ? [t("Unsaved changes"), CloudUpload, "text-amber-600"]
        : api.saveStatus === "error"
          ? [t("Offline, retrying"), CloudOff, "text-destructive"]
          : [t("All changes saved"), CloudCheck, "text-muted-foreground"]

  return (
    <div className={cn("flex items-center gap-1 text-xs", cls)}>
      {React.createElement(icon, { className: "h-3.5 w-3.5" })}
      <span>
        {text}
        {api.saveStatus === "saved" && api.lastSavedAt && (
          <span className="tnum hidden sm:inline"> · {relativeTime(api.lastSavedAt.toISOString(), lang)}</span>
        )}
      </span>
    </div>
  )
}

export function EditorHeader({ api }: { api: EditorApi }) {
  const { t } = useI18n()
  const titleRef = React.useRef<HTMLInputElement>(null)
  const sizerRef = React.useRef<HTMLSpanElement>(null)

  React.useLayoutEffect(() => {
    // keep the input exactly wide enough for its content — measured with a
    // hidden sizer span (a `ch`-based width under-measures CJK ~2× and cut
    // long Chinese titles off)
    const el = titleRef.current
    const sizer = sizerRef.current
    if (!el || !sizer) return
    sizer.textContent = api.title || " "
    const w = sizer.getBoundingClientRect().width
    // + 12px input padding + 2px caret room, floor at 8ch for comfortable typing
    el.style.width = `calc(max(8ch, ${Math.ceil(w) + 14}px))`
  }, [api.title])

  return (
    <header className="no-print relative z-40 flex min-h-14 flex-wrap items-center gap-2 border-b bg-background px-2 py-1.5 sm:px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={api.goHome}
            aria-label={t("Back to documents")}
            className="rounded-md p-1.5 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t("Back to documents")}</TooltipContent>
      </Tooltip>

      <DocsLogo size="sm" />

      <div className="ml-1 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        {/* hidden sizer — mirrors the input's exact typography to measure
            CJK-accurate title width */}
        <span
          ref={sizerRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 -z-10 whitespace-pre text-lg font-medium"
        />
        <div className="flex min-w-0 items-center">
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
            aria-label={t("Document title")}
            title={api.title}
            maxLength={150}
            className="min-w-[8ch] max-w-full rounded px-1.5 py-0.5 text-lg font-medium outline-none hover:bg-muted/60 focus:bg-muted"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={api.toggleStar}
                aria-label={api.starred ? t("Remove star") : t("Add star")}
                className="rounded-md p-1.5 transition-colors hover:bg-muted"
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    api.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  )}
                  strokeWidth={1.75}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {api.starred ? t("Remove star") : t("Star this document")}
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
              {api.presence.length === 1 ? t("1 editor") : t("{n} editors", { n: api.presence.length })}
            </span>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => api.toggleInsights()}
              aria-label={api.insightsOpen ? t("Hide writing insights") : t("Show writing insights")}
              aria-pressed={api.insightsOpen}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-muted",
                api.insightsOpen ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <BarChart3 className="h-4.5 w-4.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {api.insightsOpen ? t("Hide writing insights") : t("Show writing insights")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => api.toggleOutline()}
              aria-label={api.outlineOpen ? t("Hide document outline") : t("Show document outline")}
              aria-pressed={api.outlineOpen}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-muted",
                api.outlineOpen ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <ListTree className="h-4.5 w-4.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {api.outlineOpen ? t("Hide document outline") : t("Show document outline")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => api.toggleComments()}
              aria-label={api.commentsOpen ? t("Hide comments") : t("Show comments")}
              aria-pressed={api.commentsOpen}
              className={cn(
                "relative rounded-md p-2 transition-colors hover:bg-muted",
                api.commentsOpen ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <MessageSquare className="h-4.5 w-4.5" strokeWidth={1.75} />
              {api.unresolvedCommentCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow"
                  aria-label={t("{n} unresolved comments", { n: api.unresolvedCommentCount })}
                >
                  {api.unresolvedCommentCount > 9 ? "9+" : api.unresolvedCommentCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {api.commentsOpen ? t("Hide comments") : t("Show comments")}
            {api.unresolvedCommentCount > 0 ? ` (${api.unresolvedCommentCount})` : ""}
          </TooltipContent>
        </Tooltip>
        <LangToggle />
        <Button
          size="sm"
          className="gap-2 rounded-md px-4 max-sm:px-3"
          onClick={() => api.openDialog("share")}
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Share")}</span>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
