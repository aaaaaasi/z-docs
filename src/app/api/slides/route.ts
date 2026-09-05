import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, type SessionUser } from "@/lib/server-auth"
import { logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

/** Activity actor comes from the verified session, never client headers. */
function actorFromUser(user: SessionUser) {
  return { id: user.id, name: user.name, color: user.color }
}

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
// Auth required. Members see only their own + legacy (ownerless) decks;
// admins see the whole workspace.
export async function GET(req: NextRequest) {
  try {
    const g = await guardRoute(req)
    if (!g.ok) return g.response
    const user = g.user

    const filter = req.nextUrl.searchParams.get("filter") ?? "all"
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase()
    const where: {
      starred?: boolean
      trashed: boolean
      title?: { contains: string }
      OR?: { ownerId: string | null }[]
    } = {
      trashed: filter === "trashed",
    }
    if (filter === "starred") where.starred = true
    if (q) where.title = { contains: q }
    if (user.role !== "admin") where.OR = [{ ownerId: user.id }, { ownerId: null }]
    const decks = await db.slideDeck.findMany({ where: where as never, orderBy: { updatedAt: "desc" } })
    return NextResponse.json({ decks: decks.map(toMeta) })
  } catch (e) {
    console.error("GET /api/slides failed:", e)
    return NextResponse.json({ error: "Failed to load decks" }, { status: 500 })
  }
}

// POST /api/slides — { title?, data? }
// Auth required; the deck is owned by the creating account.
export async function POST(req: NextRequest) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response
    const user = g.user

    const body = (await req.json().catch(() => ({}))) as { title?: string; data?: string }
    const title = (body.title ?? "").trim().slice(0, 120) || "Untitled presentation"
    const deck = await db.slideDeck.create({ data: { title, data: body.data ?? "[]", ownerId: user.id } })
    await logActivity({
      app: "slides",
      kind: "created",
      entityId: deck.id,
      entityTitle: deck.title,
      actor: actorFromUser(user),
    })
    return NextResponse.json({ deck: { ...toMeta(deck), data: "[]" } }, { status: 201 })
  } catch (e) {
    console.error("POST /api/slides failed:", e)
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
  }
}
