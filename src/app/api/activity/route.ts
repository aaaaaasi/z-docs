import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeActivity } from "@/lib/server-activity"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/activity?app=docs|sheets|slides|forms&limit=100 — signed-in members
export async function GET(req: NextRequest) {
  try {
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response

    const app = req.nextUrl.searchParams.get("app")
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100, 200)
    const activities = await db.activityLog.findMany({
      where: app ? { app } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json({ activities: activities.map(serializeActivity) })
  } catch (e) {
    console.error("GET /api/activity failed:", e)
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
  }
}
