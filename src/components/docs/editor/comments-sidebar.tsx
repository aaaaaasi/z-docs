"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { CommentDTO } from "@/lib/docs-types"
import { relativeTime } from "@/lib/doc-utils"
import {
  MessageSquarePlus, X, Check, RotateCcw, Trash2, CornerDownRight, MessageCircle, Loader2, CheckCircle2, Quote, Pencil
} from "lucide-react"
import { cn } from "@/lib/utils"

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

  React.useEffect(() => {
    setText("")
    if (quote != null) {
      // focus the textarea when a new quote is captured
      const t = setTimeout(() => ref.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [quote])

  if (quote == null) return null

  return (
    <div className="animate-fade-in rounded-xl border bg-card p-3 shadow-sm" data-testid="comment-composer">
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
        placeholder="Write a comment… (Ctrl+Enter to post)"
        className="min-h-[72px] resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        maxLength={2000}
        aria-label="Comment text"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 rounded-full text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-full px-4"
          disabled={!text.trim() || submitting}
          onClick={() => onSubmit(text.trim())}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
          Comment
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
  React.useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 40)
    return () => clearTimeout(t)
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
        placeholder="Reply…"
        className="min-h-[52px] resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        maxLength={2000}
        aria-label="Reply text"
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 rounded-full text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 rounded-full px-3 text-xs" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          Reply
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
  React.useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 40)
    return () => clearTimeout(t)
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
        placeholder="Edit comment…"
        className="min-h-[52px] resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        maxLength={2000}
        aria-label="Edit comment text"
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 rounded-full text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 rounded-full px-3 text-xs"
          disabled={!text.trim() || text.trim() === initial || busy}
          onClick={() => onSubmit(text.trim())}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
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
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium leading-tight">{authorName}</span>
        <span className="text-[11px] text-muted-foreground">{relativeTime(time)}</span>
        {resolved && <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-label="Resolved" />}
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
}

function ThreadCard({ comment, active, busy, meId, onReply, onToggleResolve, onDelete, onFocusClick, onEdit }: ThreadCardProps) {
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
        "animate-fade-in scroll-mt-4 rounded-xl border bg-card p-3 shadow-sm transition-all group/thread",
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
          aria-label="Show quoted text in document"
        >
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="line-clamp-2 text-xs italic leading-snug text-muted-foreground">{comment.quote}</p>
        </button>
      )}

      {replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border pl-3 ml-4">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2.5">
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
                  aria-label="Edit reply"
                  className="h-6 w-6 shrink-0 rounded-full text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover/thread:opacity-100 focus-visible:opacity-100"
                  onClick={() => setEditing(r.id)}
                  disabled={busy}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
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
            className="h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setReplying(true)}
            disabled={busy}
          >
            <CornerDownRight className="h-3.5 w-3.5" /> Reply
          </Button>
          {(meId === comment.authorId || meId === null) && onEdit && editing !== comment.id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(comment.id)}
              disabled={busy}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={onToggleResolve}
                disabled={busy}
              >
                {comment.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {comment.resolved ? "Reopen" : "Resolve"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {comment.resolved ? "Reopen this thread" : "Mark as resolved"}
            </TooltipContent>
          </Tooltip>
          {(meId === comment.authorId || meId === null) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete comment thread"
                  className="ml-auto h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Delete thread</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
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
}

export function CommentsSidebar(props: CommentsSidebarProps) {
  const {
    open, onClose, comments, loading, activeCommentId, pendingQuote, busy, meId,
    onSubmitComment, onCancelComposer, onReply, onEdit, onToggleResolve, onDelete, onFocusComment,
  } = props

  const openThreads = React.useMemo(() => comments.filter((c) => !c.resolved), [comments])
  const resolvedThreads = React.useMemo(() => comments.filter((c) => c.resolved), [comments])
  const [showResolved, setShowResolved] = React.useState(false)

  return (
    <aside
      aria-label="Comments"
      data-open={open}
      className={cn(
        "no-print relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-l bg-background/95 backdrop-blur-sm",
        "transition-[margin-right] duration-300 ease-in-out",
        open ? "mr-0" : "pointer-events-none -mr-[340px] max-lg:-mr-[100%]",
        "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:w-full max-lg:border-l max-lg:bg-background max-lg:shadow-2xl max-lg:transition-transform",
        !open && "max-lg:pointer-events-none max-lg:translate-x-full"
      )}
    >
      <div className="flex h-full w-full flex-col lg:w-[340px]">
        {/* header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Comments</h2>
          {!loading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {openThreads.length} open
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close comments panel"
            className="ml-auto h-8 w-8 rounded-full text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* body */}
        <div className="slim-scroll flex-1 space-y-3 overflow-y-auto p-3">
          <Composer
            quote={pendingQuote?.quote ?? null}
            submitting={busy}
            onSubmit={onSubmitComment}
            onCancel={onCancelComposer}
          />

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
            </div>
          ) : comments.length === 0 && pendingQuote == null ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
              <MessageSquarePlus className="h-8 w-8 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">No comments yet</p>
                <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                  Select text in the document and press the comment button to start a discussion.
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
                    {resolvedThreads.length} resolved {resolvedThreads.length === 1 ? "thread" : "threads"}
                    <span className="ml-auto text-[10px]">{showResolved ? "Hide" : "Show"}</span>
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
  return (
    <button
      role="button"
      aria-label="Add comment on selected text"
      data-testid="comment-bubble"
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onAdd}
      className="no-print animate-fade-in fixed z-50 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg transition-all hover:scale-105 hover:border-primary/40 hover:shadow-xl"
      style={{
        left: Math.min(Math.max(x - 60, 8), window.innerWidth - 140),
        top: Math.max(y, 8),
      }}
    >
      <MessageSquarePlus className="h-3.5 w-3.5 text-primary" />
      Comment
    </button>
  )
}
