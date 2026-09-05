import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeActivity } from "@/lib/server-activity"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/activity?app=docs|sheets|slides|forms&limit=100 — the caller's own
// activity feed: events they performed plus events on entities they own.
export async function GET(req: NextRequest) {
  try {
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response

    const app = req.nextUrl.searchParams.get("app")
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100, 200)
    const me = guard.user
    const [docIds, sheetIds, deckIds, formIds] = await Promise.all([
      db.document.findMany({ where: { ownerId: me.id }, select: { id: true }, take: 500 }),
      db.sheet.findMany({ where: { ownerId: me.id }, select: { id: true }, take: 500 }),
      db.slideDeck.findMany({ where: { ownerId: me.id }, select: { id: true }, take: 500 }),
      db.form.findMany({ where: { ownerId: me.id }, select: { id: true }, take: 500 }),
    ])
    const myEntityIds = [
      ...docIds.map((d) => d.id),
      ...sheetIds.map((d) => d.id),
      ...deckIds.map((d) => d.id),
      ...formIds.map((d) => d.id),
    ]
    const scope = {
      OR: [{ actorId: me.id }, ...(myEntityIds.length ? [{ entityId: { in: myEntityIds } }] : [])],
    }
    const activities = await db.activityLog.findMany({
      where: app ? { AND: [{ app }, scope] } : scope,
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json({ activities: activities.map(serializeActivity) })
  } catch (e) {
    console.error("GET /api/activity failed:", e)
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
  }
}
