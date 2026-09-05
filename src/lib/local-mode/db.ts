/**
 * Guest-mode local database — a localStorage-backed, single-user mirror of the
 * Prisma schema (one JSON blob under the "zdocs-guest-db" key).
 *
 * The row types intentionally match the Prisma models 1:1 (dates stored as ISO
 * strings) so the route handlers in local-mode/routes.ts can mirror the real
 * server routes' response shapes exactly.
 *
 * Persistence model: the DB is cached in memory, hydrated from localStorage on
 * first access, and written back synchronously after every mutating request.
 * When localStorage is unavailable (private mode / quota), everything keeps
 * working from memory for the duration of the session.
 */

import { readLocalUser } from "@/lib/identity"

export const GUEST_DB_KEY = "zdocs-guest-db"

/** Stand-in for the session user id — every guest row is "owned" by this. */
export const GUEST_OWNER_ID = "local"

/* ------------------------------- row types -------------------------------- */

export interface GuestDocRow {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  folderId: string | null
  ownerId: string
  /** WritingStats JSON blob — kept as a raw string exactly like the DB column */
  stats: string
  editCount: number
  createdAt: string
  updatedAt: string
}

export interface GuestFolderRow {
  id: string
  name: string
  color: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface GuestTagRow {
  id: string
  name: string
  color: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface GuestDocumentTagRow {
  docId: string
  tagId: string
}

export interface GuestVersionRow {
  id: string
  docId: string
  title: string
  content: string
  createdAt: string
}

export interface GuestCommentRow {
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
}

export interface GuestReactionRow {
  id: string
  commentId: string
  userId: string
  userName: string
  emoji: string
  createdAt: string
}

export interface GuestSheetRow {
  id: string
  title: string
  data: string
  starred: boolean
  trashed: boolean
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface GuestDeckRow {
  id: string
  title: string
  data: string
  starred: boolean
  trashed: boolean
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface GuestFormRow {
  id: string
  title: string
  description: string
  data: string
  starred: boolean
  trashed: boolean
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface GuestResponseRow {
  id: string
  formId: string
  /** JSON blob of answers — stored raw like the DB column */
  answers: string
  submittedAt: string
}

export interface GuestActivityRow {
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
}

export interface GuestDb {
  v: number
  documents: GuestDocRow[]
  documentTags: GuestDocumentTagRow[]
  documentVersions: GuestVersionRow[]
  comments: GuestCommentRow[]
  commentReactions: GuestReactionRow[]
  folders: GuestFolderRow[]
  tags: GuestTagRow[]
  sheets: GuestSheetRow[]
  decks: GuestDeckRow[]
  forms: GuestFormRow[]
  formResponses: GuestResponseRow[]
  activities: GuestActivityRow[]
}

export function emptyDb(): GuestDb {
  return {
    v: 1,
    documents: [],
    documentTags: [],
    documentVersions: [],
    comments: [],
    commentReactions: [],
    folders: [],
    tags: [],
    sheets: [],
    decks: [],
    forms: [],
    formResponses: [],
    activities: [],
  }
}

/* ----------------------------- storage engine ----------------------------- */

let cache: GuestDb | null = null

function safeGetItem(): string | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(GUEST_DB_KEY)
  } catch {
    return null
  }
}

function safeSetItem(raw: string): boolean {
  try {
    if (typeof window === "undefined") return false
    window.localStorage.setItem(GUEST_DB_KEY, raw)
    return true
  } catch {
    // private mode / quota exceeded — keep going from memory
    return false
  }
}

function hydrate(raw: string | null): GuestDb {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<GuestDb>
      if (parsed && typeof parsed === "object") {
        const db = emptyDb()
        for (const key of Object.keys(db) as (keyof GuestDb)[]) {
          const value = (parsed as Record<string, unknown>)[key]
          if (Array.isArray(value)) (db[key] as unknown[]) = value as never
        }
        return db
      }
    } catch {
      // corrupted blob — fall through to a fresh DB
    }
  }
  return emptyDb()
}

/** Load (and cache) the guest DB. Never throws. */
export function loadDb(): GuestDb {
  if (cache) return cache
  cache = hydrate(safeGetItem())
  return cache
}

/** Synchronously persist the in-memory DB back to localStorage (best effort). */
export function persist(): void {
  if (!cache) return
  safeSetItem(JSON.stringify(cache))
}

/* -------------------------------- utilities ------------------------------- */

/** `local-` + random base36 id (crypto.randomUUID when available). */
export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `local-${crypto.randomUUID().replace(/-/g, "")}`
    }
  } catch {
    // fall through to Math.random
  }
  return `local-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export interface GuestActor {
  id: string
  name: string
  color: string
}

/**
 * The guest's identity — mirrors how the session user is the server-side
 * truth for attribution. Falls back to a stable "Guest" identity when the
 * local identity store is unavailable.
 */
export function guestActor(): GuestActor {
  try {
    const user = readLocalUser()
    if (user && user.id && user.name) {
      return {
        id: user.id,
        name: user.name.slice(0, 60),
        color: (user.color || "#0e7c74").slice(0, 32),
      }
    }
  } catch {
    // identity unavailable — default below
  }
  return { id: GUEST_OWNER_ID, name: "Guest", color: "#0e7c74" }
}

/** Same shape as the server's logActivity: never throws, caps the feed at 200. */
export function logActivity(
  db: GuestDb,
  input: { app: string; kind: string; entityId: string; entityTitle: string; detail?: string }
): void {
  try {
    const actor = guestActor()
    db.activities.push({
      id: newId(),
      app: input.app,
      kind: input.kind,
      entityId: input.entityId,
      entityTitle: input.entityTitle.slice(0, 120),
      detail: (input.detail ?? "").slice(0, 160),
      actorId: actor.id,
      actorName: actor.name,
      actorColor: actor.color,
      createdAt: new Date().toISOString(),
    })
    if (db.activities.length > 200) db.activities = db.activities.slice(-200)
  } catch {
    // activity logging must never break the mutation it decorates
  }
}

/**
 * Same as logActivity but skips when an identical (app+entity+kind) entry was
 * logged within `minutes` — used for high-frequency "edited" autosave events.
 * When a recent entry exists its timestamp is touched to stay fresh.
 */
export function logActivityThrottled(
  db: GuestDb,
  minutes: number,
  input: { app: string; kind: string; entityId: string; entityTitle: string; detail?: string }
): void {
  try {
    const since = Date.now() - minutes * 60_000
    for (let i = db.activities.length - 1; i >= 0; i--) {
      const a = db.activities[i]
      if (
        a.app === input.app &&
        a.entityId === input.entityId &&
        a.kind === input.kind &&
        Date.parse(a.createdAt) > since
      ) {
        a.createdAt = new Date().toISOString()
        return
      }
    }
    logActivity(db, input)
  } catch {
    // never throw
  }
}

/* ------------------------------ public surface ----------------------------- */

/** Content payload exported for cloud sync when the guest signs in. */
export interface GuestSnapshot {
  documents: Array<{
    title: string
    content: string
    starred: boolean
    trashed: boolean
    folderId: string | null
    stats: Record<string, unknown>
    editCount: number
    /** tag names attached to the document */
    tags: string[]
  }>
  folders: Array<{ id?: string; name: string; color: string }>
  sheets: Array<{ title: string; data: string; starred: boolean; trashed: boolean }>
  decks: Array<{ title: string; data: string; starred: boolean; trashed: boolean }>
  forms: Array<{ title: string; description: string; data: string; starred: boolean; trashed: boolean }>
}

function parseStatsBlob(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // corrupted blob — empty object
  }
  return {}
}

function dbHasContent(db: Partial<GuestDb>): boolean {
  const keys: (keyof GuestDb)[] = [
    "documents",
    "sheets",
    "decks",
    "forms",
    "folders",
    "tags",
    "comments",
    "formResponses",
    "activities",
  ]
  return keys.some((k) => Array.isArray(db[k]) && (db[k] as unknown[]).length > 0)
}

/** Full export of local-only content for cloud sync on sign-in. */
export function readGuestSnapshot(): GuestSnapshot {
  const db = loadDb()
  return {
    documents: db.documents.map((d) => ({
      title: d.title,
      content: d.content,
      starred: d.starred,
      trashed: d.trashed,
      folderId: d.folderId,
      stats: parseStatsBlob(d.stats),
      editCount: d.editCount,
      tags: db.documentTags
        .filter((t) => t.docId === d.id)
        .map((t) => db.tags.find((tag) => tag.id === t.tagId)?.name)
        .filter((name): name is string => typeof name === "string"),
    })),
    folders: db.folders.map((f) => ({ id: f.id, name: f.name, color: f.color })),
    sheets: db.sheets.map((s) => ({ title: s.title, data: s.data, starred: s.starred, trashed: s.trashed })),
    decks: db.decks.map((d) => ({ title: d.title, data: d.data, starred: d.starred, trashed: d.trashed })),
    forms: db.forms.map((f) => ({
      title: f.title,
      description: f.description,
      data: f.data,
      starred: f.starred,
      trashed: f.trashed,
    })),
  }
}

/** Wipe every local-only guest record (the whole localStorage DB key). */
export function clearGuestData(): void {
  cache = emptyDb()
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_DB_KEY)
  } catch {
    // storage unavailable — memory reset above is all we can do
  }
}

/** Whether any local-only guest content exists (memory or persisted). */
export function hasGuestData(): boolean {
  if (typeof window === "undefined") return false
  if (cache) return dbHasContent(cache)
  try {
    const raw = window.localStorage.getItem(GUEST_DB_KEY)
    if (!raw) return false
    return dbHasContent(JSON.parse(raw) as Partial<GuestDb>)
  } catch {
    return false
  }
}

/** Byte size + per-table row counts of the local DB blob (storage display). */
export function guestDbStats(): { bytes: number; counts: Record<string, number> } {
  const db = loadDb()
  const raw = JSON.stringify(db)
  let bytes = raw.length
  try {
    bytes = new TextEncoder().encode(raw).length
  } catch {
    // keep character length
  }
  return {
    bytes,
    counts: {
      documents: db.documents.length,
      versions: db.documentVersions.length,
      comments: db.comments.length,
      reactions: db.commentReactions.length,
      folders: db.folders.length,
      tags: db.tags.length,
      sheets: db.sheets.length,
      decks: db.decks.length,
      forms: db.forms.length,
      responses: db.formResponses.length,
      activities: db.activities.length,
    },
  }
}
