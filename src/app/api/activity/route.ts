import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

// GET /api/activity?app=docs|sheets|slides|forms&limit=100
export async function GET(req: NextRequest) {
  try {
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
