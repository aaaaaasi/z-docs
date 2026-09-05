/**
 * Guest-mode route handlers — a mirror of the real Next.js API routes.
 *
 * Every handler mirrors its server counterpart in `src/app/api/**` with
 * byte-level response fidelity: the same wrapper keys ({ documents },
 * { document }, { folder }, { tags }, { sheets }, { sheet }, { decks },
 * { deck }, { forms }, { form }, { comments }, { comment }, { activities }),
 * the same status codes (200/201/400/403/404/409/410/413), the same field
 * names, the same caps/slices and the same activity-log side effects.
 *
 * Deliberate guest-mode differences (documented in worklog Task 18-d):
 *  - no auth guards: the guest owns every row in the local DB
 *  - sanitizeDocHtml is NOT applied (server-only helper; local content never
 *    leaves the browser, and sync-on-sign-in re-enters through the server
 *    route which sanitizes)
 *  - collaborators + AI routes return 403 with a bilingual sign-in message
 *  - /api/export includes all activities (single-user DB)
 */

import { countWords, getSnippet, htmlToText } from "@/lib/doc-utils"
import { getCurrentLang } from "@/lib/i18n"
import {
  GUEST_OWNER_ID,
  guestActor,
  loadDb,
  logActivity,
  logActivityThrottled,
  newId,
  persist,
  type GuestDb,
  type GuestTagRow,
} from "./db"

/* ------------------------------- result types ------------------------------ */

export interface GuestRouteResult {
  status: number
  /** JSON body (mutually exclusive with `text`) */
  json?: unknown
  /** raw text body (export route pretty-prints) */
  text?: string
  /** extra response headers */
  headers?: Record<string, string>
}

function json(status: number, body: unknown): GuestRouteResult {
  return { status, json: body }
}

function notFoundJson(): GuestRouteResult {
  return json(404, { error: "Not found" })
}

/* ------------------------------ shared constants --------------------------- */

const VERSION_INTERVAL_MS = 5 * 60 * 1000 // snapshot at most every 5 minutes
const MAX_VERSIONS = 20
const MAX_DOC_LIST = 200
const MAX_VERSIONS_LIST = 50
const MAX_ACTIVITIES = 200

// Warm, desaturated accents matching the 11-a design system (folders)
const FOLDER_COLORS = ["#0b6b62", "#9a6b2f", "#a15c48", "#5e7050", "#8d5a74", "#a04b3c", "#6e6259"]
// Fixed Google-like label palette (tags)
const TAG_COLORS = ["#0b6b62", "#d93025", "#f9ab00", "#1e8e3e", "#a142f4", "#5f6368"]
const TAG_NAME_MAX = 24
const MAX_TAGS_PER_DOC = 50
const ALLOWED_EMOJI = ["👍", "❤️", "😂", "🎉", "✅", "👀"]
const STORAGE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024 // 15 GB
const MAX_CONTENT_BYTES = 5 * 1024 * 1024 // 5 MB per document content

/** Fields the client owns inside the stats blob (server merges, never trusts). */
const CLIENT_STATS_FIELDS = new Set([
  "activeMs",
  "sessions",
  "pauses",
  "pauseMs",
  "keystrokes",
  "typedChars",
  "typedWords",
  "pastedChars",
  "startedAt",
  "lastAt",
])

const AI_FORBIDDEN_ZH = "登录后即可使用 AI 功能（游客模式仅保留本地功能）"
const AI_FORBIDDEN_EN = "Sign in to use AI features — guest mode keeps everything local."
const SHARE_FORBIDDEN_ZH = "登录后才能分享文档"
const SHARE_FORBIDDEN_EN = "Sign in to share documents."

function localError(zh: string, en: string): string {
  return getCurrentLang() === "en" ? en : zh
}

/* --------------------------------- helpers -------------------------------- */

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function parseJsonBlob(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // corrupted blob
  }
  return {}
}

function nowIso(): string {
  return new Date().toISOString()
}

function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined
}

function byUpdatedDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
}

function byCreatedAsc(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

function byCreatedDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

function len(...vals: (string | null | undefined)[]): number {
  return vals.reduce((n, v) => n + (v ? v.length : 0), 0)
}

/* ------------------------------ doc serializers ----------------------------- */

/** Raw document row spread (exactly the Prisma column set) with ISO dates. */
function rawDoc(d: {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  folderId: string | null
  ownerId: string
  stats: string
  editCount: number
  createdAt: string
  updatedAt: string
}) {
  return {
    id: d.id,
    title: d.title,
    content: d.content,
    starred: d.starred,
    trashed: d.trashed,
    folderId: d.folderId,
    ownerId: d.ownerId,
    stats: d.stats,
    editCount: d.editCount,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

/** Document tags as the API returns them (id/name/color, name-sorted). */
function docTagList(db: GuestDb, docId: string): { id: string; name: string; color: string }[] {
  const ids = new Set(db.documentTags.filter((t) => t.docId === docId).map((t) => t.tagId))
  const tags = db.tags.filter((t) => ids.has(t.id))
  return tags
    .map((t) => ({ id: t.id, name: t.name, color: t.color }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** toMeta from documents/route.ts (list view; includes content + snippet). */
function docMeta(db: GuestDb, d: Parameters<typeof rawDoc>[0]) {
  return {
    id: d.id,
    title: d.title,
    content: d.content,
    starred: d.starred,
    trashed: d.trashed,
    folderId: d.folderId,
    tags: docTagList(db, d.id),
    snippet: getSnippet(d.content),
    wordCount: countWords(htmlToText(d.content)),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

/** serialize from documents/[id]/route.ts (stats parsed, tags included). */
function serializeDoc(db: GuestDb, d: Parameters<typeof rawDoc>[0]) {
  return {
    ...rawDoc(d),
    stats: parseJsonBlob(d.stats),
    tags: docTagList(db, d.id),
  }
}

/** Snapshot the pre-update state (rate-limited) to build version history. */
function maybeSnapshot(db: GuestDb, docId: string, oldTitle: string, oldContent: string): void {
  try {
    const versions = db.documentVersions.filter((v) => v.docId === docId)
    const latest = versions.slice().sort(byCreatedDesc)[0]
    const due = !latest || Date.now() - Date.parse(latest.createdAt) > VERSION_INTERVAL_MS
    if (!due) return
    db.documentVersions.push({
      id: newId(),
      docId,
      title: oldTitle,
      content: oldContent,
      createdAt: nowIso(),
    })
    // cap stored versions at MAX_VERSIONS (oldest pruned first)
    if (versions.length + 1 > MAX_VERSIONS) {
      const keep = db.documentVersions
        .filter((v) => v.docId === docId)
        .sort(byCreatedDesc)
        .slice(0, MAX_VERSIONS)
      const keepIds = new Set(keep.map((v) => v.id))
      db.documentVersions = db.documentVersions.filter((v) => keepIds.has(v.id))
    }
  } catch {
    // snapshot must never break the save
  }
}

/* --------------------------- comment serializers ---------------------------- */

function rawComment(c: {
  id: string
  docId: string
  parentId: string | null
  authorId: string
  authorName: string
  authorColor: string
  quote: string
  anchorOffset: number
  content: string
  resolved: boolean
  createdAt: string
  updatedAt: string
}) {
  return {
    id: c.id,
    docId: c.docId,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.authorName,
    authorColor: c.authorColor,
    quote: c.quote,
    anchorOffset: c.anchorOffset,
    content: c.content,
    resolved: c.resolved,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

type CommentLike = Parameters<typeof rawComment>[0]

/** serialize from documents/[id]/comments/route.ts (threaded, reactions). */
function serializeComment(db: GuestDb, c: CommentLike): unknown {
  const replies = db.comments
    .filter((r) => r.parentId === c.id)
    .sort(byCreatedAsc)
    .map((r) => serializeComment(db, r) as CommentLike & { replies: unknown[]; reactions: unknown[] })
  const reactions = db.commentReactions
    .filter((rx) => rx.commentId === c.id)
    .sort(byCreatedAsc)
    .map((rx) => ({
      id: rx.id,
      commentId: rx.commentId,
      userId: rx.userId,
      userName: rx.userName,
      emoji: rx.emoji,
    }))
  return {
    ...rawComment(c),
    replies,
    reactions,
  }
}

/* ------------------------------ documents tree ------------------------------ */

function listDocuments(db: GuestDb, sp: URLSearchParams): GuestRouteResult {
  const filter = sp.get("filter") ?? "all"
  const q = sp.get("q")?.trim() ?? ""
  const folderId = sp.get("folder")?.trim() ?? ""

  const needle = q.toLowerCase()
  const docs = db.documents
    .filter((d) => {
      if (filter === "trash") {
        if (!d.trashed) return false
      } else {
        if (d.trashed) return false
        if (filter === "starred" && !d.starred) return false
      }
      // folder scoping: "root" = no folder; an id scopes to it; omitted = all
      if (folderId === "root") {
        if (d.folderId !== null) return false
      } else if (folderId && folderId !== "all") {
        if (d.folderId !== folderId) return false
      }
      if (needle) {
        const inTitle = d.title.toLowerCase().includes(needle)
        const inContent = d.content.toLowerCase().includes(needle)
        if (!inTitle && !inContent) return false
      }
      return true
    })
    .sort(byUpdatedDesc)
    .slice(0, MAX_DOC_LIST)

  return json(200, { documents: docs.map((d) => docMeta(db, d)) })
}

function createDocument(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const title = (() => {
    const t = str(b.title)
    return t && t.trim() ? t.trim().slice(0, 150) : "Untitled document"
  })()
  const content = str(b.content)?.slice(0, MAX_CONTENT_BYTES) ?? ""

  const now = nowIso()
  const doc = {
    id: newId(),
    title,
    content,
    starred: false,
    trashed: false,
    folderId: null as string | null,
    ownerId: GUEST_OWNER_ID,
    stats: "",
    editCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  db.documents.push(doc)
  logActivity(db, { app: "docs", kind: "created", entityId: doc.id, entityTitle: doc.title })
  return json(201, { document: rawDoc(doc) })
}

function getDocument(db: GuestDb, id: string): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()
  return json(200, { document: serializeDoc(db, doc) })
}

function patchDocument(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()
  const b = bodyOf(body)

  const data: {
    title?: string
    content?: string
    starred?: boolean
    trashed?: boolean
    folderId?: string | null
    editCount?: number
  } = {}
  const title = str(b.title)
  if (title && title.trim()) data.title = title.trim().slice(0, 150)
  const content = str(b.content)
  if (content !== null) data.content = content.slice(0, MAX_CONTENT_BYTES)
  const starred = bool(b.starred)
  if (starred !== undefined) data.starred = starred
  const trashed = bool(b.trashed)
  if (trashed !== undefined) data.trashed = trashed
  if (b.folderId === null || typeof b.folderId === "string") {
    if (b.folderId === null || b.folderId === "" || b.folderId === "root") {
      data.folderId = null
    } else {
      const folder = db.folders.find((f) => f.id === b.folderId)
      if (!folder) return json(400, { error: "Folder not found" })
      data.folderId = b.folderId
    }
  }

  const before = { title: doc.title, content: doc.content, starred: doc.starred, trashed: doc.trashed }
  const contentChanged = data.content !== undefined && data.content !== before.content
  if (contentChanged) {
    maybeSnapshot(db, id, doc.title, doc.content)
    // every real saved change after the first version bumps the revision counter
    data.editCount = doc.editCount + 1
  }

  Object.assign(doc, data)
  doc.updatedAt = nowIso()

  if (data.trashed !== undefined && data.trashed !== before.trashed) {
    logActivity(db, {
      app: "docs",
      kind: data.trashed ? "trashed" : "restored",
      entityId: id,
      entityTitle: doc.title,
    })
  } else if (data.starred !== undefined && data.starred !== before.starred) {
    logActivity(db, {
      app: "docs",
      kind: data.starred ? "starred" : "unstarred",
      entityId: id,
      entityTitle: doc.title,
    })
  } else if (data.title !== undefined && data.title !== before.title) {
    logActivity(db, {
      app: "docs",
      kind: "renamed",
      entityId: id,
      entityTitle: data.title,
      detail: `renamed from “${before.title}”`,
    })
  } else if (contentChanged) {
    logActivityThrottled(db, 10, {
      app: "docs",
      kind: "edited",
      entityId: id,
      entityTitle: doc.title,
    })
  }

  return json(200, { document: serializeDoc(db, doc) })
}

function deleteDocument(db: GuestDb, id: string): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  db.documents = db.documents.filter((d) => d.id !== id)
  db.documentVersions = db.documentVersions.filter((v) => v.docId !== id)
  // comments cascade (replies included) with their reactions
  const removedComments = db.comments.filter((c) => c.docId === id)
  const removedIds = new Set(removedComments.map((c) => c.id))
  db.commentReactions = db.commentReactions.filter((rx) => !removedIds.has(rx.commentId))
  db.comments = db.comments.filter((c) => c.docId !== id)
  db.documentTags = db.documentTags.filter((t) => t.docId !== id)
  return json(200, { ok: true })
}

function duplicateDocument(db: GuestDb, id: string): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  const now = nowIso()
  // the copy starts from column defaults — only title/content carry over
  const copy = {
    id: newId(),
    title: `Copy of ${doc.title}`.slice(0, 150),
    content: doc.content,
    starred: false,
    trashed: false,
    folderId: null as string | null,
    ownerId: GUEST_OWNER_ID,
    stats: "",
    editCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  db.documents.push(copy)
  logActivity(db, {
    app: "docs",
    kind: "duplicated",
    entityId: copy.id,
    entityTitle: copy.title,
    detail: `copy of “${doc.title}”`,
  })

  return json(201, {
    document: {
      ...rawDoc(copy),
      snippet: getSnippet(copy.content),
      wordCount: countWords(htmlToText(copy.content)),
    },
  })
}

function putDocumentTags(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  if (!Array.isArray(b.tagIds) || b.tagIds.some((v) => typeof v !== "string")) {
    return json(400, { error: "tagIds must be an array of strings" })
  }
  // dedupe + cap
  const tagIds = [...new Set(b.tagIds as string[])].slice(0, MAX_TAGS_PER_DOC)

  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  // keep only ids that exist as tags (unknown ids are dropped)
  const tags = tagIds
    .map((tid) => db.tags.find((t) => t.id === tid))
    .filter((t): t is GuestTagRow => !!t)

  db.documentTags = db.documentTags.filter((t) => t.docId !== id)
  for (const t of tags) db.documentTags.push({ docId: id, tagId: t.id })

  const sorted = tags
    .map((t) => ({ id: t.id, name: t.name, color: t.color }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return json(200, { tags: sorted })
}

function listVersions(db: GuestDb, id: string): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  const versions = db.documentVersions
    .filter((v) => v.docId === id)
    .sort(byCreatedDesc)
    .slice(0, MAX_VERSIONS_LIST)

  return json(200, {
    versions: versions.map((v) => ({
      id: v.id,
      docId: v.docId,
      title: v.title,
      content: v.content,
      wordCount: countWords(htmlToText(v.content)),
      createdAt: v.createdAt,
    })),
  })
}

function restoreVersion(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const versionId = str(b.versionId)
  if (!versionId) return json(400, { error: "versionId is required" })

  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  const version = db.documentVersions.find((v) => v.id === versionId)
  if (!version || version.docId !== id) return json(404, { error: "Version not found" })

  // snapshot the current state before restoring
  db.documentVersions.push({
    id: newId(),
    docId: id,
    title: doc.title,
    content: doc.content,
    createdAt: nowIso(),
  })

  doc.content = version.content
  doc.updatedAt = nowIso()
  return json(200, { document: rawDoc(doc) })
}

function getDocStats(db: GuestDb, id: string): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()
  return json(200, { stats: parseJsonBlob(doc.stats), editCount: doc.editCount })
}

function patchDocStats(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return json(403, { error: "Editor access required" })

  const b = bodyOf(body)
  const merged: Record<string, unknown> = { ...parseJsonBlob(doc.stats) }
  for (const [k, v] of Object.entries(b)) {
    if (!CLIENT_STATS_FIELDS.has(k)) continue
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) merged[k] = v
    else if (typeof v === "string" && v.length <= 40) merged[k] = v
  }

  doc.stats = JSON.stringify(merged)
  doc.updatedAt = nowIso()
  return json(200, { ok: true, stats: merged })
}

function collaboratorsForbidden(): GuestRouteResult {
  return json(403, { error: localError(SHARE_FORBIDDEN_ZH, SHARE_FORBIDDEN_EN) })
}

/* -------------------------------- comments --------------------------------- */

function listComments(db: GuestDb, id: string): GuestRouteResult {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  const top = db.comments.filter((c) => c.docId === id && c.parentId === null).sort(byCreatedAsc)
  return json(200, { comments: top.map((c) => serializeComment(db, c)) })
}

function createComment(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const rawContent = str(b.content) ?? ""
  const text = rawContent.trim()
  if (!text) return json(400, { error: "Comment text is required" })
  if (text.length > 2000) return json(400, { error: "Comment is too long" })

  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return notFoundJson()

  const parentId = str(b.parentId)
  if (parentId) {
    const parent = db.comments.find((c) => c.id === parentId)
    if (!parent || parent.docId !== id) {
      return json(404, { error: "Parent comment not found" })
    }
  }

  // author identity is local truth — body authorId/authorName/authorColor ignored
  const actor = guestActor()
  const anchorRaw = b.anchorOffset
  const anchor = Math.max(0, Math.floor(typeof anchorRaw === "number" && Number.isFinite(anchorRaw) ? anchorRaw : 0))

  const now = nowIso()
  const created = {
    id: newId(),
    docId: id,
    parentId: parentId ?? null,
    authorId: actor.id,
    authorName: actor.name.slice(0, 60),
    authorColor: actor.color.slice(0, 32),
    quote: (str(b.quote) ?? "").slice(0, 400),
    anchorOffset: anchor,
    content: text,
    resolved: false,
    createdAt: now,
    updatedAt: now,
  }
  db.comments.push(created)
  logActivity(db, {
    app: "docs",
    kind: "commented",
    entityId: id,
    entityTitle: doc.title,
    detail: parentId ? "replied to a comment" : text.slice(0, 80),
  })

  return json(201, { comment: serializeComment(db, created) })
}

function patchComment(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const comment = db.comments.find((c) => c.id === id)
  if (!comment) return notFoundJson()
  const b = bodyOf(body)

  const data: { resolved?: boolean; content?: string } = {}
  const resolved = bool(b.resolved)
  if (resolved !== undefined) data.resolved = resolved
  const rawContent = str(b.content)
  if (rawContent !== null) {
    const text = rawContent.trim()
    if (!text) return json(400, { error: "Comment text is required" })
    data.content = text.slice(0, 2000)
  }
  if (Object.keys(data).length === 0) {
    return json(400, { error: "Nothing to update" })
  }

  Object.assign(comment, data)
  comment.updatedAt = nowIso()
  return json(200, { comment: rawComment(comment) })
}

function deleteComment(db: GuestDb, id: string): GuestRouteResult {
  const comment = db.comments.find((c) => c.id === id)
  if (!comment) return notFoundJson()

  // replies cascade
  const removedIds = new Set([id, ...db.comments.filter((c) => c.parentId === id).map((c) => c.id)])
  db.commentReactions = db.commentReactions.filter((rx) => !removedIds.has(rx.commentId))
  db.comments = db.comments.filter((c) => !removedIds.has(c.id))
  return json(200, { ok: true })
}

function toggleReaction(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const emoji = str(b.emoji)
  if (!emoji || !ALLOWED_EMOJI.includes(emoji)) {
    return json(400, { error: "Unsupported emoji" })
  }

  const comment = db.comments.find((c) => c.id === id)
  if (!comment) return notFoundJson()

  const actor = guestActor()
  const existing = db.commentReactions.find(
    (r) => r.commentId === id && r.userId === actor.id && r.emoji === emoji
  )
  if (existing) {
    db.commentReactions = db.commentReactions.filter((r) => r.id !== existing.id)
    return json(200, { active: false, emoji })
  }

  db.commentReactions.push({
    id: newId(),
    commentId: id,
    userId: actor.id,
    userName: actor.name.slice(0, 60),
    emoji,
    createdAt: nowIso(),
  })
  return json(201, { active: true, emoji })
}

/* --------------------------------- folders --------------------------------- */

function folderCount(db: GuestDb, folderId: string): number {
  return db.documents.filter((d) => d.folderId === folderId).length
}

function listFolders(db: GuestDb): GuestRouteResult {
  const folders = db.folders.slice().sort((a, b) => a.name.localeCompare(b.name))
  return json(200, {
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      count: folderCount(db, f.id),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
  })
}

function createFolder(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const name = str(b.name)?.trim().slice(0, 80) ?? ""
  if (!name) return json(400, { error: "Folder name is required" })

  if (db.folders.some((f) => f.name === name)) {
    return json(409, { error: "A folder with this name already exists" })
  }

  const colorRaw = str(b.color)
  const color =
    colorRaw && /^#[0-9a-fA-F]{6}$/.test(colorRaw)
      ? colorRaw
      : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]

  const now = nowIso()
  const folder = { id: newId(), name, color, ownerId: GUEST_OWNER_ID, createdAt: now, updatedAt: now }
  db.folders.push(folder)
  return json(201, { folder: { ...folder, count: 0 } })
}

function patchFolder(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const id = str(b.id)
  if (!id) return json(400, { error: "Folder id is required" })

  const folder = db.folders.find((f) => f.id === id)
  if (!folder) return notFoundJson()

  const data: { name?: string; color?: string } = {}
  const name = str(b.name)
  if (name && name.trim()) data.name = name.trim().slice(0, 80)
  const colorRaw = str(b.color)
  if (colorRaw && /^#[0-9a-fA-F]{6}$/.test(colorRaw)) data.color = colorRaw
  if (Object.keys(data).length === 0) {
    return json(400, { error: "Nothing to update" })
  }

  if (data.name && db.folders.some((f) => f.name === data.name && f.id !== id)) {
    return json(409, { error: "A folder with this name already exists" })
  }

  Object.assign(folder, data)
  folder.updatedAt = nowIso()
  return json(200, { folder: { ...folder } })
}

function deleteFolder(db: GuestDb, sp: URLSearchParams): GuestRouteResult {
  const id = sp.get("id")
  if (!id) return json(400, { error: "Folder id is required" })

  const folder = db.folders.find((f) => f.id === id)
  if (!folder) return notFoundJson()

  // documents inside move back to root
  for (const d of db.documents) {
    if (d.folderId === id) {
      d.folderId = null
      d.updatedAt = nowIso()
    }
  }
  db.folders = db.folders.filter((f) => f.id !== id)
  return json(200, { ok: true })
}

/* ----------------------------------- tags ----------------------------------- */

function listTags(db: GuestDb): GuestRouteResult {
  const tags = db.tags.slice().sort((a, b) => a.name.localeCompare(b.name))
  return json(200, {
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: db.documentTags.filter((dt) => dt.tagId === t.id).length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  })
}

function createTag(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const name = str(b.name)?.trim().slice(0, TAG_NAME_MAX) ?? ""
  if (!name) return json(400, { error: "Tag name is required" })

  if (db.tags.some((t) => t.name === name)) {
    return json(409, { error: "A tag with this name already exists" })
  }

  const colorRaw = str(b.color)
  const color =
    colorRaw && /^#[0-9a-fA-F]{6}$/.test(colorRaw)
      ? colorRaw
      : TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]

  const now = nowIso()
  const tag = { id: newId(), name, color, ownerId: GUEST_OWNER_ID, createdAt: now, updatedAt: now }
  db.tags.push(tag)
  return json(201, {
    tag: { id: tag.id, name: tag.name, color: tag.color, count: 0, createdAt: tag.createdAt, updatedAt: tag.updatedAt },
  })
}

function deleteTag(db: GuestDb, id: string): GuestRouteResult {
  const tag = db.tags.find((t) => t.id === id)
  if (!tag) return notFoundJson()

  db.tags = db.tags.filter((t) => t.id !== id)
  db.documentTags = db.documentTags.filter((t) => t.tagId !== id)
  return json(200, { ok: true })
}

/* ------------------------ sheets / slides / forms --------------------------- */

interface OwnedRow {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  ownerId: string
  createdAt: string
  updatedAt: string
}

interface SheetLikeRow extends OwnedRow {
  data: string
}

interface FormLikeRow extends OwnedRow {
  description: string
  data: string
}

function sheetMeta(s: OwnedRow) {
  return {
    id: s.id,
    title: s.title,
    starred: s.starred,
    trashed: s.trashed,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

function serializeSheet(s: SheetLikeRow) {
  return { ...sheetMeta(s), data: s.data }
}

function formMeta(f: FormLikeRow, responseCount: number) {
  return {
    id: f.id,
    title: f.title,
    description: f.description,
    starred: f.starred,
    trashed: f.trashed,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    responseCount,
  }
}

function serializeForm(f: FormLikeRow, responseCount: number) {
  return { ...formMeta(f, responseCount), data: f.data }
}

/** Shared list filter for sheets/slides/forms (server: filter === "trashed"). */
function applyEntityFilter<T extends OwnedRow>(rows: T[], sp: URLSearchParams): T[] {
  const filter = sp.get("filter") ?? "all"
  const q = (sp.get("q") ?? "").trim().toLowerCase()
  return rows
    .filter((r) => {
      if (r.trashed !== (filter === "trashed")) return false
      if (filter === "starred" && !r.starred) return false
      if (q && !r.title.toLowerCase().includes(q)) return false
      return true
    })
    .sort(byUpdatedDesc)
}

/** Shared PATCH core for sheets/slides/forms rows. */
function patchOwnedRow<T extends OwnedRow>(row: T, body: unknown, defaults: { title: string }): void {
  const b = bodyOf(body)
  const title = str(b.title)
  if (title !== null) row.title = title.trim().slice(0, 120) || row.title || defaults.title
  const starred = bool(b.starred)
  if (starred !== undefined) row.starred = starred
  const trashed = bool(b.trashed)
  if (trashed !== undefined) row.trashed = trashed
  row.updatedAt = nowIso()
}

function logOwnedActivity(
  db: GuestDb,
  app: "sheets" | "slides" | "forms",
  row: OwnedRow,
  before: { title: string; starred: boolean; trashed: boolean },
  data: { title?: string; starred?: boolean; trashed?: boolean; dataChanged?: boolean },
  detail: { edited: string }
): void {
  if (data.trashed !== undefined && data.trashed !== before.trashed) {
    logActivity(db, {
      app,
      kind: data.trashed ? "trashed" : "restored",
      entityId: row.id,
      entityTitle: row.title,
    })
  } else if (data.starred !== undefined && data.starred !== before.starred) {
    logActivity(db, {
      app,
      kind: data.starred ? "starred" : "unstarred",
      entityId: row.id,
      entityTitle: row.title,
    })
  } else if (data.title !== undefined && data.title !== before.title) {
    logActivity(db, {
      app,
      kind: "renamed",
      entityId: row.id,
      entityTitle: data.title,
      detail: `renamed from “${before.title}”`,
    })
  } else if (data.dataChanged) {
    logActivityThrottled(db, 10, {
      app,
      kind: "edited",
      entityId: row.id,
      entityTitle: row.title,
      detail: detail.edited,
    })
  }
}

/* ---------------------------------- sheets ---------------------------------- */

function listSheets(db: GuestDb, sp: URLSearchParams): GuestRouteResult {
  return json(200, { sheets: applyEntityFilter(db.sheets, sp).map(sheetMeta) })
}

function createSheet(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const title = (str(b.title) ?? "").trim().slice(0, 120) || "Untitled spreadsheet"
  const data = str(b.data) ?? "{}"
  const now = nowIso()
  const sheet: SheetLikeRow = {
    id: newId(),
    title,
    data,
    starred: false,
    trashed: false,
    ownerId: GUEST_OWNER_ID,
    createdAt: now,
    updatedAt: now,
  }
  db.sheets.push(sheet)
  logActivity(db, { app: "sheets", kind: "created", entityId: sheet.id, entityTitle: sheet.title })
  // NOTE: mirrors the server quirk — the create response reports data: "{}"
  return json(201, { sheet: { ...sheetMeta(sheet), data: "{}" } })
}

function getSheet(db: GuestDb, id: string): GuestRouteResult {
  const sheet = db.sheets.find((s) => s.id === id)
  if (!sheet) return notFoundJson()
  return json(200, { sheet: serializeSheet(sheet) })
}

function patchSheet(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const sheet = db.sheets.find((s) => s.id === id)
  if (!sheet) return notFoundJson()
  const before = { title: sheet.title, starred: sheet.starred, trashed: sheet.trashed, data: sheet.data }

  const b = bodyOf(body)
  const data = str(b.data)
  const titleProvided = str(b.title)
  patchOwnedRow(sheet, body, { title: "Untitled spreadsheet" })
  if (data !== null) sheet.data = data

  logOwnedActivity(
    db,
    "sheets",
    sheet,
    before,
    { title: titleProvided !== null ? sheet.title : undefined, dataChanged: data !== null && data !== before.data },
    { edited: "edited cells" }
  )
  return json(200, { sheet: serializeSheet(sheet) })
}

function deleteSheet(db: GuestDb, id: string): GuestRouteResult {
  const sheet = db.sheets.find((s) => s.id === id)
  if (!sheet) return notFoundJson()
  db.sheets = db.sheets.filter((s) => s.id !== id)
  return json(200, { ok: true })
}

/* ---------------------------------- slides ---------------------------------- */

function listDecks(db: GuestDb, sp: URLSearchParams): GuestRouteResult {
  return json(200, { decks: applyEntityFilter(db.decks, sp).map(sheetMeta) })
}

function createDeck(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const title = (str(b.title) ?? "").trim().slice(0, 120) || "Untitled presentation"
  const data = str(b.data) ?? "[]"
  const now = nowIso()
  const deck: SheetLikeRow = {
    id: newId(),
    title,
    data,
    starred: false,
    trashed: false,
    ownerId: GUEST_OWNER_ID,
    createdAt: now,
    updatedAt: now,
  }
  db.decks.push(deck)
  logActivity(db, { app: "slides", kind: "created", entityId: deck.id, entityTitle: deck.title })
  // mirrors the server quirk — create response reports data: "[]"
  return json(201, { deck: { ...sheetMeta(deck), data: "[]" } })
}

function getDeck(db: GuestDb, id: string): GuestRouteResult {
  const deck = db.decks.find((d) => d.id === id)
  if (!deck) return notFoundJson()
  return json(200, { deck: serializeSheet(deck) })
}

function patchDeck(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const deck = db.decks.find((d) => d.id === id)
  if (!deck) return notFoundJson()
  const before = { title: deck.title, starred: deck.starred, trashed: deck.trashed, data: deck.data }

  const b = bodyOf(body)
  const data = str(b.data)
  const titleProvided = str(b.title)
  patchOwnedRow(deck, body, { title: "Untitled presentation" })
  if (data !== null) deck.data = data

  logOwnedActivity(
    db,
    "slides",
    deck,
    before,
    { title: titleProvided !== null ? deck.title : undefined, dataChanged: data !== null && data !== before.data },
    { edited: "edited slides" }
  )
  return json(200, { deck: serializeSheet(deck) })
}

function deleteDeck(db: GuestDb, id: string): GuestRouteResult {
  const deck = db.decks.find((d) => d.id === id)
  if (!deck) return notFoundJson()
  db.decks = db.decks.filter((d) => d.id !== id)
  return json(200, { ok: true })
}

/* ----------------------------------- forms ---------------------------------- */

function listForms(db: GuestDb, sp: URLSearchParams): GuestRouteResult {
  const forms = applyEntityFilter(db.forms, sp)
  return json(200, {
    forms: forms.map((f) => formMeta(f, db.formResponses.filter((r) => r.formId === f.id).length)),
  })
}

function createForm(db: GuestDb, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const title = (str(b.title) ?? "").trim().slice(0, 120) || "Untitled form"
  const description = (str(b.description) ?? "").slice(0, 400)
  const data = str(b.data) ?? "[]"
  const now = nowIso()
  const form: FormLikeRow = {
    id: newId(),
    title,
    description,
    data,
    starred: false,
    trashed: false,
    ownerId: GUEST_OWNER_ID,
    createdAt: now,
    updatedAt: now,
  }
  db.forms.push(form)
  logActivity(db, { app: "forms", kind: "created", entityId: form.id, entityTitle: form.title })
  // mirrors the server quirk — create response reports data: "[]"
  return json(201, { form: { ...formMeta(form, 0), data: "[]" } })
}

function getForm(db: GuestDb, id: string): GuestRouteResult {
  const form = db.forms.find((f) => f.id === id)
  if (!form) return notFoundJson()
  return json(200, {
    form: serializeForm(form, db.formResponses.filter((r) => r.formId === id).length),
  })
}

function patchForm(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const form = db.forms.find((f) => f.id === id)
  if (!form) return notFoundJson()
  const before = { title: form.title, starred: form.starred, trashed: form.trashed, data: form.data }

  const b = bodyOf(body)
  const data = str(b.data)
  const description = str(b.description)
  const titleProvided = str(b.title)
  patchOwnedRow(form, body, { title: "Untitled form" })
  if (description !== null) form.description = description.slice(0, 400)
  if (data !== null) form.data = data

  logOwnedActivity(
    db,
    "forms",
    form,
    before,
    { title: titleProvided !== null ? form.title : undefined, dataChanged: data !== null && data !== before.data },
    { edited: "edited questions" }
  )
  return json(200, {
    form: serializeForm(form, db.formResponses.filter((r) => r.formId === id).length),
  })
}

function deleteForm(db: GuestDb, id: string): GuestRouteResult {
  const form = db.forms.find((f) => f.id === id)
  if (!form) return notFoundJson()
  db.forms = db.forms.filter((f) => f.id !== id)
  db.formResponses = db.formResponses.filter((r) => r.formId !== id)
  return json(200, { ok: true })
}

function listResponses(db: GuestDb, id: string): GuestRouteResult {
  const form = db.forms.find((f) => f.id === id)
  if (!form) return notFoundJson()
  const responses = db.formResponses
    .filter((r) => r.formId === id)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
  return json(200, {
    responses: responses.map((r) => ({
      id: r.id,
      formId: r.formId,
      answers: r.answers,
      submittedAt: r.submittedAt,
    })),
  })
}

function submitResponse(db: GuestDb, id: string, body: unknown): GuestRouteResult {
  const b = bodyOf(body)
  const answers = b.answers ?? {}
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return json(400, { error: "Invalid answers payload" })
  }
  // every value must be a scalar or array of scalars; cap the payload size
  let serialized = "{}"
  try {
    serialized = JSON.stringify(answers)
  } catch {
    return json(400, { error: "Invalid answers payload" })
  }
  if (serialized.length > 20_000) {
    return json(413, { error: "Response is too large" })
  }
  for (const value of Object.values(answers as Record<string, unknown>)) {
    const okValue =
      typeof value === "string" ||
      typeof value === "number" ||
      (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number"))
    if (!okValue) return json(400, { error: "Invalid answers payload" })
  }

  const form = db.forms.find((f) => f.id === id)
  if (!form) return notFoundJson()
  if (form.trashed) return json(410, { error: "Form is closed" })

  const response = { id: newId(), formId: id, answers: serialized, submittedAt: nowIso() }
  db.formResponses.push(response)

  logActivity(db, {
    app: "forms",
    kind: "submitted",
    entityId: id,
    entityTitle: form.title,
    detail: "new response received",
  })

  // only the acknowledgment is returned — no form definition data
  return json(201, { response: { id: response.id, submittedAt: response.submittedAt } })
}

/* --------------------------- activity / storage / export --------------------- */

function serializeActivity(a: {
  id: string
  app: string
  kind: string
  entityId: string
  entityTitle: string
  detail: string
  actorId: string
  actorName: string
  actorColor: string
  createdAt: string
}) {
  return {
    id: a.id,
    app: a.app,
    kind: a.kind,
    entityId: a.entityId,
    entityTitle: a.entityTitle,
    detail: a.detail,
    actor: { id: a.actorId, name: a.actorName, color: a.actorColor },
    createdAt: a.createdAt,
  }
}

function listActivity(db: GuestDb, sp: URLSearchParams): GuestRouteResult {
  const app = sp.get("app")
  const limit = Math.min(Number(sp.get("limit") ?? 100) || 100, 200)
  // guest mode: every row in the local DB is the caller's own activity
  const rows = (app ? db.activities.filter((a) => a.app === app) : db.activities.slice())
    .sort(byCreatedDesc)
    .slice(0, limit)
  return json(200, { activities: rows.map(serializeActivity) })
}

function storageUsage(db: GuestDb): GuestRouteResult {
  const breakdown = {
    documents: db.documents.reduce((n, d) => n + len(d.title, d.content, d.stats), 0),
    versions: db.documentVersions.reduce((n, v) => n + len(v.title, v.content), 0),
    sheets: db.sheets.reduce((n, s) => n + len(s.title, s.data), 0),
    slides: db.decks.reduce((n, d) => n + len(d.title, d.data), 0),
    forms: db.forms.reduce((n, f) => n + len(f.title, f.description, f.data), 0),
    responses: db.formResponses.reduce((n, r) => n + len(r.answers), 0),
    comments: db.comments.reduce((n, c) => n + len(c.content, c.authorName, c.quote), 0),
    other:
      db.folders.reduce((n, f) => n + len(f.name), 0) + db.tags.reduce((n, t) => n + len(t.name), 0),
  }
  const usedBytes = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const counts = {
    documents: db.documents.length,
    versions: db.documentVersions.length,
    sheets: db.sheets.length,
    slides: db.decks.length,
    forms: db.forms.length,
    responses: db.formResponses.length,
    comments: db.comments.length,
  }
  return json(200, { usedBytes, quotaBytes: STORAGE_QUOTA_BYTES, breakdown, counts })
}

function exportWorkspace(db: GuestDb): GuestRouteResult {
  const documents = db.documents.filter((d) => !d.trashed)
  const sheets = db.sheets.filter((s) => !s.trashed)
  const decks = db.decks.filter((d) => !d.trashed)
  const forms = db.forms.filter((f) => !f.trashed)
  const activity = db.activities.slice().sort(byCreatedDesc).slice(0, 100)

  const payload = {
    exportedAt: nowIso(),
    product: "Z-Docs workspace export",
    counts: {
      documents: documents.length,
      sheets: sheets.length,
      decks: decks.length,
      forms: forms.length,
      folders: db.folders.length,
      tags: db.tags.length,
    },
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      starred: d.starred,
      folderId: d.folderId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    folders: db.folders.map((f) => ({ id: f.id, name: f.name, color: f.color })),
    tags: db.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    sheets: sheets.map((s) => ({ id: s.id, title: s.title, data: s.data, starred: s.starred, updatedAt: s.updatedAt })),
    decks: decks.map((d) => ({ id: d.id, title: d.title, data: d.data, starred: d.starred, updatedAt: d.updatedAt })),
    forms: forms.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      data: f.data,
      starred: f.starred,
      updatedAt: f.updatedAt,
      responseCount: db.formResponses.filter((r) => r.formId === f.id).length,
    })),
    activity: activity.map((a) => ({
      app: a.app,
      kind: a.kind,
      entityTitle: a.entityTitle,
      detail: a.detail,
      createdAt: a.createdAt,
    })),
  }
  return {
    status: 200,
    text: JSON.stringify(payload, null, 2),
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="z-workspace-export.json"`,
    },
  }
}

/* -------------------------------- dispatcher -------------------------------- */

/**
 * Dispatch a locally-handled API request. `url` is already resolved against
 * the page origin and verified to be an /api/* URL outside /api/auth and
 * /api/import.
 *
 * Mutating handlers edit the in-memory DB; the caller (the fetch shim) is
 * responsible for calling persist() after non-GET requests.
 */
export function handleGuestRoute(url: URL, method: string, body: unknown): GuestRouteResult {
  try {
    const db = loadDb()
    const segs = url.pathname.split("/").filter(Boolean).map(safeDecode)
    const sp = url.searchParams
    const m = method.toUpperCase()

    if (segs[0] !== "api") return notFoundJson()

    /* documents tree */
    if (segs[1] === "documents") {
      if (segs.length === 2) {
        if (m === "GET") return listDocuments(db, sp)
        if (m === "POST") return createDocument(db, body)
      } else if (segs.length === 3) {
        const id = segs[2]
        if (m === "GET") return getDocument(db, id)
        if (m === "PATCH") return patchDocument(db, id, body)
        if (m === "DELETE") return deleteDocument(db, id)
      } else if (segs.length === 4) {
        const id = segs[2]
        const sub = segs[3]
        if (sub === "duplicate" && m === "POST") return duplicateDocument(db, id)
        if (sub === "tags" && m === "PUT") return putDocumentTags(db, id, body)
        if (sub === "versions" && m === "GET") return listVersions(db, id)
        if (sub === "restore-version" && m === "POST") return restoreVersion(db, id, body)
        if (sub === "stats") {
          if (m === "GET") return getDocStats(db, id)
          if (m === "PATCH") return patchDocStats(db, id, body)
        }
        if (sub === "comments") {
          if (m === "GET") return listComments(db, id)
          if (m === "POST") return createComment(db, id, body)
        }
        // sharing requires an account in guest mode
        if (sub === "collaborators") return collaboratorsForbidden()
      }
      return notFoundJson()
    }

    /* comments tree */
    if (segs[1] === "comments") {
      if (segs.length === 3) {
        const id = segs[2]
        if (m === "PATCH") return patchComment(db, id, body)
        if (m === "DELETE") return deleteComment(db, id)
      } else if (segs.length === 4 && segs[3] === "reactions") {
        if (m === "POST") return toggleReaction(db, segs[2], body)
      }
      return notFoundJson()
    }

    /* folders */
    if (segs[1] === "folders" && segs.length === 2) {
      if (m === "GET") return listFolders(db)
      if (m === "POST") return createFolder(db, body)
      if (m === "PATCH") return patchFolder(db, body)
      if (m === "DELETE") return deleteFolder(db, sp)
    }

    /* tags */
    if (segs[1] === "tags") {
      if (segs.length === 2) {
        if (m === "GET") return listTags(db)
        if (m === "POST") return createTag(db, body)
      } else if (segs.length === 3 && m === "DELETE") {
        return deleteTag(db, segs[2])
      }
      return notFoundJson()
    }

    /* sheets */
    if (segs[1] === "sheets") {
      if (segs.length === 2) {
        if (m === "GET") return listSheets(db, sp)
        if (m === "POST") return createSheet(db, body)
      } else if (segs.length === 3) {
        const id = segs[2]
        if (m === "GET") return getSheet(db, id)
        if (m === "PATCH") return patchSheet(db, id, body)
        if (m === "DELETE") return deleteSheet(db, id)
      }
      return notFoundJson()
    }

    /* slides */
    if (segs[1] === "slides") {
      if (segs.length === 2) {
        if (m === "GET") return listDecks(db, sp)
        if (m === "POST") return createDeck(db, body)
      } else if (segs.length === 3) {
        const id = segs[2]
        if (m === "GET") return getDeck(db, id)
        if (m === "PATCH") return patchDeck(db, id, body)
        if (m === "DELETE") return deleteDeck(db, id)
      }
      return notFoundJson()
    }

    /* forms */
    if (segs[1] === "forms") {
      if (segs.length === 2) {
        if (m === "GET") return listForms(db, sp)
        if (m === "POST") return createForm(db, body)
      } else if (segs.length === 3) {
        const id = segs[2]
        if (m === "GET") return getForm(db, id)
        if (m === "PATCH") return patchForm(db, id, body)
        if (m === "DELETE") return deleteForm(db, id)
      } else if (segs.length === 4 && segs[3] === "responses") {
        const id = segs[2]
        if (m === "GET") return listResponses(db, id)
        if (m === "POST") return submitResponse(db, id, body)
      }
      return notFoundJson()
    }

    /* activity / storage / export */
    if (segs[1] === "activity" && segs.length === 2 && m === "GET") return listActivity(db, sp)
    if (segs[1] === "storage" && segs.length === 2 && m === "GET") return storageUsage(db)
    if (segs[1] === "export" && segs.length === 2 && m === "GET") return exportWorkspace(db)

    /* AI requires an account in guest mode */
    if (segs[1] === "ai") {
      return json(403, { error: localError(AI_FORBIDDEN_ZH, AI_FORBIDDEN_EN) })
    }

    // anything else under /api (e.g. /api/internal/*) has no local handler
    return notFoundJson()
  } catch {
    return json(500, { error: "Guest-mode request failed" })
  }
}
