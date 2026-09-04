import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

function toMeta(d: {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: d.id,
    title: d.title,
    starred: d.starred,
    trashed: d.trashed,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

// GET /api/slides?filter=all|starred|trashed
export async function GET(req: NextRequest) {
  try {
    const filter = req.nextUrl.searchParams.get("filter") ?? "all"
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase()
    const where: { starred?: boolean; trashed: boolean; title?: { contains: string } } = {
      trashed: filter === "trashed",
    }
    if (filter === "starred") where.starred = true
    if (q) where.title = { contains: q }
    const decks = await db.slideDeck.findMany({ where: where as never, orderBy: { updatedAt: "desc" } })
    return NextResponse.json({ decks: decks.map(toMeta) })
  } catch (e) {
    console.error("GET /api/slides failed:", e)
    return NextResponse.json({ error: "Failed to load decks" }, { status: 500 })
  }
}

// POST /api/slides — { title?, data? }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string; data?: string }
    const title = (body.title ?? "").trim().slice(0, 120) || "Untitled presentation"
    const deck = await db.slideDeck.create({ data: { title, data: body.data ?? "[]" } })
    await logActivity({
      app: "slides",
      kind: "created",
      entityId: deck.id,
      entityTitle: deck.title,
      actor: actorFromRequest(req),
    })
    return NextResponse.json({ deck: { ...toMeta(deck), data: "[]" } }, { status: 201 })
  } catch (e) {
    console.error("POST /api/slides failed:", e)
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
  }
}
