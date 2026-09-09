"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { CommentDTO, CommentReactionDTO } from "@/lib/docs-types"
import type { SuggestionInfo } from "@/lib/suggest-dom"
import { relativeTime } from "@/lib/doc-utils"
import {
  MessageSquarePlus, X, Check, RotateCcw, Trash2, CornerDownRight, MessageCircle, Loader2, CheckCircle2, Quote, Pencil, SmilePlus, PencilLine
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

/* ---------------------------------------------------------------- helpers */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

function CommentAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white shadow-sm",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  )
}

/* ---------------------------------------------------------- new-comment composer */

export interface PendingQuote {
  quote: string
  offset: number
}

function Composer({
  quote,
  submitting,
  onSubmit,
  onCancel,
}: {
  quote: string | null
  submitting: boolean
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement | null>(null)
  const { t } = useI18n()

  React.useEffect(() => {
    setText("")
    if (quote != null) {
      // focus the textarea when a new quote is captured
      const t2 = setTimeout(() => ref.current?.focus(), 60)
      return () => clearTimeout(t2)
    }
  }, [quote])

  if (quote == null) return null

  return (
    <div className="animate-fade-in rounded-lg border bg-card p-3" data-testid="comment-composer">
      <div className="mb-2 flex items-start gap-2 rounded-lg bg-muted/70 p-2">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="line-clamp-3 text-xs italic leading-snug text-muted-foreground">{quote}</p>
      </div>
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) {
            e.preventDefault()
            onSubmit(text.trim())
          }
          if (e.key === "Escape") onCancel()
        }}
        placeholder={t("Write a comment… (Ctrl+Enter to post)")}
        className="min-h-[72px] max-h-56 resize-none overflow-y-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        maxLength={2000}
        aria-label={t("Comment text")}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 rounded-md text-muted-foreground" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-md px-4"
          disabled={!text.trim() || submitting}
          onClick={() => onSubmit(text.trim())}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
          {t("Comment")}
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- reply form */

function ReplyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement | null>(null)
  const { t } = useI18n()
  React.useEffect(() => {
    const t2 = setTimeout(() => ref.current?.focus(), 40)
    return () => clearTimeout(t2)
  }, [])

  return (
    <div className="mt-2 rounded-lg bg-muted/60 p-2">
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) {
            e.preventDefault()
            onSubmit(text.trim())
          }
          if (e.key === "Escape") onCancel()
        }}
        placeholder={t("Reply…")}
        className="min-h-[52px] max-h-48 resize-none overflow-y-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        maxLength={2000}
        aria-label={t("Reply text")}
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 rounded-md text-muted-foreground" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button size="sm" className="h-7 rounded-md px-3 text-xs" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          {t("Reply")}
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- edit form */

function EditForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: string
  busy: boolean
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = React.useState(initial)
  const ref = React.useRef<HTMLTextAreaElement | null>(null)
  const { t } = useI18n()
  React.useEffect(() => {
    const t2 = setTimeout(() => ref.current?.focus(), 40)
    return () => clearTimeout(t2)
  }, [])

  return (
    <div className="mt-1.5 rounded-lg border bg-muted/60 p-2">
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) {
            e.preventDefault()
            onSubmit(text.trim())
          }
          if (e.key === "Escape") onCancel()
        }}
        placeholder={t("Edit comment…")}
        className="min-h-[52px] max-h-48 resize-none overflow-y-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        maxLength={2000}
        aria-label={t("Edit comment text")}
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 rounded-md text-muted-foreground" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button
          size="sm"
          className="h-7 rounded-md px-3 text-xs"
          disabled={!text.trim() || text.trim() === initial || busy}
          onClick={() => onSubmit(text.trim())}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t("Save")}
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- reactions */

export const REACTION_EMOJI = ["👍", "❤️", "😂", "🎉", "✅", "👀"] as const

function groupReactions(reactions: CommentReactionDTO[]) {
  const groups = new Map<string, { emoji: string; count: number; names: string[]; mine: boolean }>()
  for (const r of reactions) {
    const g = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, names: [], mine: false }
    g.count += 1
    g.names.push(r.userName)
    groups.set(r.emoji, g)
  }
  return [...groups.values()]
}

function ReactionRow({
  reactions,
  meId,
  busy,
  onToggle,
}: {
  reactions: CommentReactionDTO[]
  meId: string | null
  busy: boolean
  onToggle: (emoji: string) => void
}) {
  const [picking, setPicking] = React.useState(false)
  const { t } = useI18n()
  const groups = React.useMemo(() => {
    const g = groupReactions(reactions)
    for (const item of g) item.mine = meId != null && reactions.some((r) => r.emoji === item.emoji && r.userId === meId)
    return g
  }, [reactions, meId])

  React.useEffect(() => {
    if (!picking) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-reaction-picker]")) setPicking(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicking(false)
    }
    window.addEventListener("mousedown", close)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [picking])

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-1" data-reactions>
      {groups.map((g) => (
        <Tooltip key={g.emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={g.mine
                ? t("{emoji} reaction, {count}. Click to remove yours", { emoji: g.emoji, count: g.count })
                : t("{emoji} reaction, {count}. Click to react", { emoji: g.emoji, count: g.count })}
              aria-pressed={g.mine}
              disabled={busy}
              onClick={() => onToggle(g.emoji)}
              className={cn(
                "animate-in zoom-in-75 flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs shadow-sm transition-all duration-150 active:scale-90 disabled:opacity-50",
                g.mine
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground"
              )}
            >
              <span aria-hidden>{g.emoji}</span>
              {g.count > 1 && <span className="tnum text-[10px] leading-none">{g.count}</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("{names} reacted with {emoji}", { names: g.names.join(", "), emoji: g.emoji })}
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="relative" data-reaction-picker>
        <button
          type="button"
          aria-label={t("Add reaction")}
          aria-expanded={picking}
          disabled={busy}
          onClick={() => setPicking((p) => !p)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-accent hover:text-foreground active:scale-90 disabled:opacity-50"
        >
          <SmilePlus className={cn("h-3.5 w-3.5 transition-colors", picking && "text-primary")} strokeWidth={1.75} />
        </button>
        {picking && (
          <div
            role="menu"
            aria-label={t("Pick a reaction")}
            className="elev-2 animate-in fade-in-0 zoom-in-95 absolute bottom-8 left-0 z-10 flex origin-bottom-left items-center gap-0.5 rounded-lg border bg-background/95 p-1 backdrop-blur-md duration-150"
          >
            {REACTION_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                aria-label={t("React with {emoji}", { emoji })}
                onClick={() => {
                  onToggle(emoji)
                  setPicking(false)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-all hover:scale-125 hover:bg-accent active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- thread card */

function MessageBody({
  authorName,
  authorColor,
  time,
  children,
  resolved,
}: {
  authorName: string
  authorColor: string
  time: string
  children: React.ReactNode
  resolved: boolean
}) {
  const { t, lang } = useI18n()
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium leading-tight">{authorName}</span>
        <span className="tnum text-[11px] text-muted-foreground">{relativeTime(time, lang)}</span>
        {resolved && <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-label={t("Resolved")} />}
      </div>
      <div
        className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed"
        style={{ borderLeft: `2px solid ${authorColor}33`, paddingLeft: 8, marginLeft: 2 }}
      >
        {children}
      </div>
    </div>
  )
}

interface ThreadCardProps {
  comment: CommentDTO
  active: boolean
  busy: boolean
  meId: string | null
  onReply: (text: string) => void
  onToggleResolve: () => void
  onDelete: () => void
  onFocusClick?: () => void
  onEdit?: (id: string, content: string) => void
  onToggleReaction?: (commentId: string, emoji: string) => void
}

function ThreadCard({ comment, active, busy, meId, onReply, onToggleResolve, onDelete, onFocusClick, onEdit, onToggleReaction }: ThreadCardProps) {
  const { t } = useI18n()
  const [replying, setReplying] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [active])

  const replies = comment.replies ?? []
  const lastActivity = replies.length > 0 ? replies[replies.length - 1].createdAt : comment.createdAt

  return (
    <div
      ref={ref}
      data-comment-id={comment.id}
      className={cn(
        "animate-fade-in scroll-mt-4 rounded-lg border bg-card p-3 transition-[border-color,box-shadow,opacity] group/thread",
        active && "border-primary/60 ring-2 ring-primary/20",
        comment.resolved && "opacity-75"
      )}
    >
      <div className="flex gap-2.5">
        <CommentAvatar name={comment.authorName} color={comment.authorColor} />
        {editing === comment.id ? (
          <div className="min-w-0 flex-1">
            <EditForm
              initial={comment.content}
              busy={busy}
              onSubmit={(text) => {
                onEdit?.(comment.id, text)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : (
          <MessageBody authorName={comment.authorName} authorColor={comment.authorColor} time={lastActivity} resolved={comment.resolved}>
            {comment.content}
          </MessageBody>
        )}
      </div>

      {comment.quote && (
        <button
          onClick={onFocusClick}
          className="mt-2 flex w-full items-start gap-2 rounded-lg bg-muted/70 p-2 text-left transition-colors hover:bg-muted"
          aria-label={t("Show quoted text in document")}
        >
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="line-clamp-2 text-xs italic leading-snug text-muted-foreground">{comment.quote}</p>
        </button>
      )}

      {onToggleReaction && (
        <ReactionRow
          reactions={comment.reactions ?? []}
          meId={meId}
          busy={busy}
          onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
        />
      )}

      {replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border pl-3 ml-4">
          {replies.map((r) => (
            <div key={r.id} className="space-y-0.5">
              <div className="flex gap-2.5">
                <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <div className="flex gap-2">
                  <CommentAvatar name={r.authorName} color={r.authorColor} size="sm" />
                  {editing === r.id ? (
                    <div className="min-w-0 flex-1">
                      <EditForm
                        initial={r.content}
                        busy={busy}
                        onSubmit={(text) => {
                          onEdit?.(r.id, text)
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  ) : (
                    <MessageBody authorName={r.authorName} authorColor={r.authorColor} time={r.createdAt} resolved={r.resolved}>
                      {r.content}
                    </MessageBody>
                  )}
                </div>
                {editing !== r.id && (meId === r.authorId || meId === null) && onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("Edit reply")}
                    className="h-6 w-6 shrink-0 rounded-md text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover/thread:opacity-100 focus-visible:opacity-100"
                    onClick={() => setEditing(r.id)}
                    disabled={busy}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {onToggleReaction && (
                <div
                  className={cn(
                    "ml-6 transition-opacity",
                    (r.reactions?.length ?? 0) === 0 &&
                      "opacity-0 focus-within:opacity-100 group-hover/thread:opacity-100"
                  )}
                >
                  <ReactionRow
                    reactions={r.reactions ?? []}
                    meId={meId}
                    busy={busy}
                    onToggle={(emoji) => onToggleReaction(r.id, emoji)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {replying ? (
        <ReplyForm
          onSubmit={(text) => {
            onReply(text)
            setReplying(false)
          }}
          onCancel={() => setReplying(false)}
        />
      ) : (
        <div className="mt-2 flex items-center gap-1 pl-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setReplying(true)}
            disabled={busy}
          >
            <CornerDownRight className="h-3.5 w-3.5" /> {t("Reply")}
          </Button>
          {(meId === comment.authorId || meId === null) && onEdit && editing !== comment.id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(comment.id)}
              disabled={busy}
            >
              <Pencil className="h-3.5 w-3.5" /> {t("Edit")}
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={onToggleResolve}
                disabled={busy}
              >
                {comment.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {comment.resolved ? t("Reopen") : t("Resolve")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {comment.resolved ? t("Reopen this thread") : t("Mark as resolved")}
            </TooltipContent>
          </Tooltip>
          {(meId === comment.authorId || meId === null) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("Delete comment thread")}
                  className="ml-auto h-7 gap-1 rounded-md px-2.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{t("Delete thread")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- suggestion cards */

function SuggestionCard({
  s,
  active,
  onAccept,
  onReject,
  onFocus,
}: {
  s: SuggestionInfo
  active: boolean
  onAccept: (sid: string) => void
  onReject: (sid: string) => void
  onFocus: (sid: string) => void
}) {
  const { t, lang } = useI18n()
  const verb =
    s.kind === "del" ? t("deleted") : s.kind === "para" ? t("suggested a paragraph break") : t("inserted")
  const preview =
    s.kind === "para" ? "¶" : s.text.length > 120 ? s.text.slice(0, 120).trimEnd() + "…" : s.text

  return (
    <div
      data-sug-card={s.sid}
      className={cn(
        "animate-fade-in rounded-lg border bg-card p-3 transition-[border-color,box-shadow] group/sug",
        active ? "border-primary/60 ring-2 ring-primary/20" : "hover:border-border/80"
      )}
    >
      <div className="flex gap-2.5">
        <CommentAvatar name={s.authorName} color={s.authorColor} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-snug">
            <button
              className="font-semibold text-foreground hover:underline"
              onClick={() => onFocus(s.sid)}
              title={t("Show in document")}
            >
              {s.authorName}
            </button>{" "}
            <span className="text-muted-foreground">{verb}</span>
            {s.createdAt > 0 && (
              <span className="text-muted-foreground"> · {relativeTime(new Date(s.createdAt).toISOString(), lang)}</span>
            )}
          </p>
          {s.kind !== "para" && (
            <button
              className="mt-1.5 block w-full rounded-md bg-muted/60 px-2 py-1.5 text-left text-xs leading-snug transition-colors hover:bg-muted"
              onClick={() => onFocus(s.sid)}
              aria-label={t("Show this suggestion in the document")}
            >
              <span
                className="line-clamp-3"
                style={{
                  textDecorationLine: s.kind === "del" ? "line-through" : "underline",
                  textDecorationColor: s.authorColor,
                  textDecorationThickness: "1.5px",
                  textUnderlineOffset: "2px",
                  color: s.kind === "del" ? s.authorColor : undefined,
                }}
              >
                {preview || t("(empty)")}
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onReject(s.sid)}
        >
          <X className="h-3.5 w-3.5" /> {t("Reject")}
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
          onClick={() => onAccept(s.sid)}
        >
          <Check className="h-3.5 w-3.5" /> {t("Accept")}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- sidebar shell */

export interface CommentsSidebarProps {
  open: boolean
  onClose: () => void
  comments: CommentDTO[]
  loading: boolean
  activeCommentId: string | null
  pendingQuote: PendingQuote | null
  busy: boolean
  meId: string | null
  onSubmitComment: (text: string) => void
  onCancelComposer: () => void
  onReply: (parentId: string, text: string) => void
  onEdit: (id: string, content: string) => void
  onToggleResolve: (c: CommentDTO) => void
  onDelete: (c: CommentDTO) => void
  onFocusComment: (c: CommentDTO) => void
  onToggleReaction?: (commentId: string, emoji: string) => void
  /* suggesting mode */
  suggestions?: SuggestionInfo[]
  activeSuggestionId?: string | null
  onAcceptSuggestion?: (sid: string) => void
  onRejectSuggestion?: (sid: string) => void
  onFocusSuggestion?: (sid: string) => void
}

export function CommentsSidebar(props: CommentsSidebarProps) {
  const {
    open, onClose, comments, loading, activeCommentId, pendingQuote, busy, meId,
    onSubmitComment, onCancelComposer, onReply, onEdit, onToggleResolve, onDelete, onFocusComment, onToggleReaction,
    suggestions = [], activeSuggestionId = null,
    onAcceptSuggestion, onRejectSuggestion, onFocusSuggestion,
  } = props

  const openThreads = React.useMemo(() => comments.filter((c) => !c.resolved), [comments])
  const resolvedThreads = React.useMemo(() => comments.filter((c) => c.resolved), [comments])
  const [showResolved, setShowResolved] = React.useState(false)
  const { t } = useI18n()

  return (
    <aside
      aria-label={t("Comments and suggestions")}
      data-open={open}
      className={cn(
        "no-print relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-l bg-background/95 backdrop-blur-sm",
        "transition-[margin-right] duration-300 ease-in-out",
        open ? "mr-0" : "pointer-events-none -mr-[340px] max-lg:-mr-[100%]",
        // three-tier: phone full-width overlay → tablet 360px floating panel →
        // desktop 340px docked rail
        "w-full lg:w-auto md:w-[360px]",
        "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:border-l max-lg:bg-background max-lg:transition-transform",
        !open && "max-lg:pointer-events-none max-lg:translate-x-full"
      )}
    >
      <div className="flex h-full w-full flex-col lg:w-[340px]">
        {/* header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t("Comments")}</h2>
          {!loading && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {t("{n} open", { n: openThreads.length })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Close comments panel")}
            className="ml-auto h-8 w-8 rounded-md text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* body */}
        <div className="slim-scroll flex-1 space-y-3 overflow-y-auto p-3">
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="sticky top-0 z-[1] -mx-1 flex items-center gap-2 bg-background/95 px-1 py-1 backdrop-blur-sm">
                <PencilLine className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Suggestions")}
                </h3>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                  {suggestions.length}
                </span>
              </div>
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.sid}
                  s={s}
                  active={activeSuggestionId === s.sid}
                  onAccept={onAcceptSuggestion ?? (() => {})}
                  onReject={onRejectSuggestion ?? (() => {})}
                  onFocus={onFocusSuggestion ?? (() => {})}
                />
              ))}
              <div className="pt-1" />
            </div>
          )}

          <Composer
            quote={pendingQuote?.quote ?? null}
            submitting={busy}
            onSubmit={onSubmitComment}
            onCancel={onCancelComposer}
          />

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading comments…")}
            </div>
          ) : comments.length === 0 && pendingQuote == null ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
              <MessageSquarePlus className="h-8 w-8 text-muted-foreground/40" />
              <div>
                <p className="font-editorial text-[14.5px] font-medium italic tracking-tight text-foreground/80">{t("No comments yet")}</p>
                <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                  {t("Select text in the document and press the comment button to start a discussion.")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {openThreads.map((c) => (
                <ThreadCard
                  key={c.id}
                  comment={c}
                  active={activeCommentId === c.id}
                  busy={busy}
                  meId={meId}
                  onReply={(text) => onReply(c.id, text)}
                  onEdit={onEdit}
                  onToggleResolve={() => onToggleResolve(c)}
                  onDelete={() => onDelete(c)}
                  onFocusClick={() => onFocusComment(c)}
                  onToggleReaction={onToggleReaction}
                />
              ))}

              {resolvedThreads.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowResolved((v) => !v)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-expanded={showResolved}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {resolvedThreads.length === 1
                      ? t("{n} resolved thread", { n: resolvedThreads.length })
                      : t("{n} resolved threads", { n: resolvedThreads.length })}
                    <span className="ml-auto text-[10px]">{showResolved ? t("Hide") : t("Show")}</span>
                  </button>
                  {showResolved &&
                    resolvedThreads.map((c) => (
                      <div key={c.id} className="mt-2">
                        <ThreadCard
                          comment={c}
                          active={activeCommentId === c.id}
                          busy={busy}
                          meId={meId}
                          onReply={(text) => onReply(c.id, text)}
                          onEdit={onEdit}
                          onToggleResolve={() => onToggleResolve(c)}
                          onDelete={() => onDelete(c)}
                          onFocusClick={() => onFocusComment(c)}
                          onToggleReaction={onToggleReaction}
                        />
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

/* --------------------------------------------------- selection comment bubble */

export function CommentBubble({
  x,
  y,
  onAdd,
}: {
  x: number
  y: number
  onAdd: () => void
}) {
  const { t } = useI18n()
  return (
    <button
      role="button"
      aria-label={t("Add comment on selected text")}
      data-testid="comment-bubble"
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onAdd}
      className="no-print animate-fade-in fixed z-50 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground elev-2 transition-[border-color,box-shadow,transform] hover:scale-105 hover:border-primary/40"
      style={{
        left: Math.min(Math.max(x - 60, 8), window.innerWidth - 140),
        top: Math.max(y, 8),
      }}
    >
      <MessageSquarePlus className="h-3.5 w-3.5 text-primary" />
      {t("Comment")}
    </button>
  )
}
