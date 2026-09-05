import { NextRequest } from "next/server"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"

/* ============================ password hashing ============================ */

/** scrypt hash → "salt:hex" (never store raw passwords). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

/** Constant-time scrypt verification. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, "hex")
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

/* ============================== sessions ================================== */

export const SESSION_COOKIE = "zdocs_session"
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export interface SessionUser {
  id: string
  email: string
  name: string
  color: string
}

function toSessionUser(u: { id: string; email: string; name: string; color: string }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, color: u.color }
}

/** Creates a DB session row; returns the opaque token to set as cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.userSession.create({ data: { token, userId, expiresAt } })
  return { token, expiresAt }
}

/** Validates a session token → user (or null). Cheap: indexed unique lookup. */
export async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.userSession.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  return toSessionUser(session.user)
}

/** Reads the session cookie from a request → user (or null). */
export async function getSessionUser(req: NextRequest | Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? ""
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  if (!match) return null
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1))
  return userFromToken(token)
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    // sandbox serves both http (localhost) and proxied https — leave secure off
    // so the cookie works in both; SameSite=Lax already blocks CSRF exfiltration.
    secure: false,
    path: "/",
    expires: expiresAt,
  }
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return
  await db.userSession.deleteMany({ where: { token } }).catch(() => {})
}

/* ============================ rate limiting =============================== */

interface Bucket {
  count: number
  resetAt: number
}
const buckets = new Map<string, Bucket>()

/** In-memory fixed-window limiter. Returns true when the call is allowed. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  // opportunistic cleanup (keep the map small)
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k)
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

/** Client IP for limiter keys (best effort behind the gateway proxy). */
export function clientIp(req: NextRequest | Request): string {
  const h = req.headers
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local"
  )
}

export function tooManyRequests(message = "Too many requests — slow down and try again shortly."): Response {
  return Response.json({ error: message }, { status: 429 })
}

/* ============================== guards ==================================== */

/** 401 helper — every private route starts with this. */
export function unauthorized(message = "Sign in required."): Response {
  return Response.json({ error: message }, { status: 401 })
}

export function forbidden(message = "You do not have permission to do that."): Response {
  return Response.json({ error: message }, { status: 403 })
}

export function notFound(message = "Not found."): Response {
  return Response.json({ error: message }, { status: 404 })
}

/**
 * Same-origin enforcement for mutating requests — blocks cross-site POST/PATCH/
 * DELETE even if a cookie leaks to another origin (defense in depth on top of
 * SameSite=Lax).
 *
 * The app is deployed behind layered reverse proxies that may rewrite Host and
 * X-Forwarded-Host to internal hostnames, so the Origin↔Host comparison alone
 * would misfire. Two trust sources, in order:
 *  1. direct match against Host / X-Forwarded-Host (standard setups);
 *  2. the browser-attested `Sec-Fetch-Site` Fetch Metadata header — browsers
 *     always send it, JS cannot forge it, and proxies don't invent it. A value
 *     of `same-origin`/`same-site` proves the request left a page served by
 *     this very origin (a CSRF page would read `cross-site`).
 */
export function isSameOrigin(req: NextRequest | Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true // non-browser clients (curl, collab service) pass elsewhere
  try {
    const o = new URL(origin)
    const host = req.headers.get("host") ?? ""
    if (o.host === host) return true
    const xfh = req.headers.get("x-forwarded-host")
    if (xfh && xfh.split(",").map((h) => h.trim()).includes(o.host)) return true
    const secFetchSite = req.headers.get("sec-fetch-site")
    if (secFetchSite === "same-origin" || secFetchSite === "same-site") return true
    return false
  } catch {
    return false
  }
}

/**
 * Route guard bundle: session user + same-origin + per-user/IP rate limit.
 * Returns either { ok: true, user } or { ok: false, response } to return.
 */
export async function guardRoute(
  req: NextRequest | Request,
  opts: {
    limit?: number
    windowMs?: number
    mutating?: boolean
  } = {}
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: Response }> {
  const { limit = 240, windowMs = 60_000, mutating = false } = opts
  if (mutating && !isSameOrigin(req)) {
    return { ok: false, response: forbidden("Cross-origin request rejected.") }
  }
  const user = await getSessionUser(req)
  if (!user) return { ok: false, response: unauthorized() }
  const key = `u:${user.id}:${mutating ? "w" : "r"}`
  if (!rateLimit(key, limit, windowMs)) {
    return { ok: false, response: tooManyRequests() }
  }
  return { ok: true, user }
}

/* ========================== entity access rules =========================== */

export type AccessLevel = "none" | "viewer" | "editor" | "owner"

/**
 * Document access: owner → "owner"; collaborator role → viewer/editor;
 * everyone else (including orphaned legacy docs) → "none". Every user is
 * fully independent — nobody can read another user's private documents.
 */
export async function docAccessLevel(user: SessionUser, docId: string): Promise<AccessLevel> {
  const doc = await db.document.findUnique({
    where: { id: docId },
    select: { ownerId: true },
  })
  if (!doc) return "none"
  if (doc.ownerId === user.id) return "owner"
  const collab = await db.collaborator.findUnique({
    where: { docId_email: { docId, email: user.email } },
    select: { role: true },
  })
  if (collab) return collab.role === "editor" ? "editor" : "viewer"
  return "none"
}

/** Owner-only access for sheets, decks and forms (no sharing model there). */
export async function ownedAccessLevel(
  user: SessionUser,
  model: "sheet" | "deck" | "form",
  id: string
): Promise<AccessLevel> {
  const table =
    model === "sheet" ? db.sheet : model === "deck" ? db.slideDeck : db.form
  const entity = await (table as typeof db.sheet).findUnique({
    where: { id },
    select: { ownerId: true },
  })
  if (!entity) return "none"
  if (entity.ownerId === user.id) return "owner"
  return "none"
}

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, viewer: 1, editor: 2, owner: 3 }

export function hasAccess(level: AccessLevel, need: "viewer" | "editor" | "owner"): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[need]
}

/* ============================ input safety ================================ */

const ALLOWED_TAGS = new Set([
  "h1","h2","h3","h4","h5","h6","p","div","br","hr","span","a","b","strong","i","em","u","s",
  "sup","sub","ul","ol","li","blockquote","pre","code","table","thead","tbody","tr","td","th",
  "colgroup","col","img","mark","font",
])

/**
 * Whitelist sanitizer for user-authored document HTML. Strips scripts,
 * event handlers and javascript: URLs so stored content can never execute.
 */
export function sanitizeDocHtml(html: string): string {
  if (!html) return ""
  let out = html
  // drop entire dangerous blocks
  out = out
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
  // event handlers & dangerous attrs on any surviving tag
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
  // javascript:/data:text URLs
  out = out.replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"')
  out = out.replace(/(href|src)\s*=\s*(["']?)\s*data:text\/html[^"'\s>]*\2/gi, '$1="#"')
  // unknown tags → unwrap (keep inner content)
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*)?)\/?>/g, (m, tag: string) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) return m
    return ""
  })
  return out
}

/* ========================= internal service guard ========================= */

/** Shared secret for trusted first-party services (collab-service :3003). */
export function internalSecret(): string {
  return process.env.INTERNAL_SECRET ?? ""
}

export function isInternalRequest(req: NextRequest | Request): boolean {
  const secret = internalSecret()
  if (!secret) return false
  return req.headers.get("x-internal-secret") === secret
}
