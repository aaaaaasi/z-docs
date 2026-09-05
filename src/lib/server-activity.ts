import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionUser } from "@/lib/server-auth"
import type { ActivityKind, WorkspaceApp } from "@/lib/workspace-types"

/** Identity used for activity-feed attribution. */
export type ActivityActor = { id: string; name: string; color: string }

/** Legacy `x-z-actor` header parsing (trusted internal service calls only). */
function actorFromHeader(req: NextRequest): ActivityActor {
  try {
    const raw = req.headers.get("x-z-actor")
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; name?: string; color?: string }
      if (parsed && typeof parsed === "object") {
        return {
          id: String(parsed.id ?? "local"),
          name: String(parsed.name ?? "Local user").slice(0, 60),
          color: String(parsed.color ?? "#0b6b62").slice(0, 32),
        }
      }
    }
  } catch {
    // malformed header — fall through to default
  }
  return { id: "local", name: "Local user", color: "#0b6b62" }
}

/**
 * Resolve the activity actor. The authenticated session user always wins
 * (server-side truth — a client cannot spoof attribution via headers).
 * Without a session (internal service calls, e.g. collab-service :3003) the
 * legacy `x-z-actor` header is honored as a fallback.
 */
export async function actorFromRequest(req: NextRequest): Promise<ActivityActor> {
  try {
    const user = await getSessionUser(req)
    if (user) return { id: user.id, name: user.name.slice(0, 60), color: user.color.slice(0, 32) }
  } catch {
    // session lookup failed — fall through to header fallback
  }
  return actorFromHeader(req)
}

/** Never throws — activity logging must not break the mutation it decorates. */
export async function logActivity(input: {
  app: WorkspaceApp
  kind: ActivityKind
  entityId: string
  entityTitle: string
  detail?: string
  /** resolved actor — or a pending one (callers may pass `actorFromRequest(req)` un-awaited). */
  actor: ActivityActor | Promise<ActivityActor>
}): Promise<void> {
  try {
    const actor = await input.actor
    await db.activityLog.create({
      data: {
        app: input.app,
        kind: input.kind,
        entityId: input.entityId,
        entityTitle: input.entityTitle.slice(0, 120),
        detail: (input.detail ?? "").slice(0, 160),
        actorId: actor.id,
        actorName: actor.name,
        actorColor: actor.color,
      },
    })
    // cap the feed at 200 rows (oldest pruned first)
    const count = await db.activityLog.count()
    if (count > 200) {
      const stale = await db.activityLog.findMany({
        orderBy: { createdAt: "asc" },
        take: count - 200,
        select: { id: true },
      })
      if (stale.length) await db.activityLog.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
    }
  } catch (e) {
    console.error("logActivity failed:", e)
  }
}

/**
 * Same as logActivity, but skips when an identical (app+entity+kind) entry was
 * logged within `minutes`. Used for high-frequency "edited" events from autosave.
 */
export async function logActivityThrottled(
  minutes: number,
  input: Parameters<typeof logActivity>[0]
): Promise<void> {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000)
    const recent = await db.activityLog.findFirst({
      where: { app: input.app, entityId: input.entityId, kind: input.kind, createdAt: { gt: since } },
      select: { id: true },
    })
    if (recent) {
      // touch timestamp of the existing entry so "recently edited" stays fresh
      await db.activityLog.update({ where: { id: recent.id }, data: { createdAt: new Date() } })
      return
    }
    await logActivity(input)
  } catch {
    // never throw
  }
}

export function serializeActivity(a: {
  id: string
  app: string
  kind: string
  entityId: string
  entityTitle: string
  detail: string
  actorId: string
  actorName: string
  actorColor: string
  createdAt: Date
}) {
  return {
    id: a.id,
    app: a.app,
    kind: a.kind,
    entityId: a.entityId,
    entityTitle: a.entityTitle,
    detail: a.detail,
    actor: { id: a.actorId, name: a.actorName, color: a.actorColor },
    createdAt: a.createdAt.toISOString(),
  }
}
