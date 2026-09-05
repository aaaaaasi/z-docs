import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, type SessionUser } from "@/lib/server-auth"
import { logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

/** Activity actor comes from the verified session, never client headers. */
function actorFromUser(user: SessionUser) {
  return { id: user.id, name: user.name, color: user.color }
}

function toMeta(s: {
  id: string
  title: string
  starred: boolean
  trashed: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: s.id,
    title: s.title,
    starred: s.starred,
    trashed: s.trashed,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

// GET /api/sheets?filter=all|starred|trashed&q=...
// Auth required. Members see only their own + legacy (ownerless) sheets;
// every user sees only their own entities.
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
      ownerId?: string
    } = {
      trashed: filter === "trashed",
    }
    if (filter === "starred") where.starred = true
    if (q) where.title = { contains: q }
    where.ownerId = user.id // every user is independent — own entities only

    const sheets = await db.sheet.findMany({
      where: where as never,
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json({ sheets: sheets.map(toMeta) })
  } catch (e) {
    console.error("GET /api/sheets failed:", e)
    return NextResponse.json({ error: "Failed to load sheets" }, { status: 500 })
  }
}

// POST /api/sheets — create a spreadsheet { title?, data? }
// Auth required; the sheet is owned by the creating account.
export async function POST(req: NextRequest) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response
    const user = g.user

    const body = (await req.json().catch(() => ({}))) as { title?: string; data?: string }
    const title = (body.title ?? "").trim().slice(0, 120) || "Untitled spreadsheet"
    const sheet = await db.sheet.create({
      data: { title, data: body.data ?? "{}", ownerId: user.id },
    })
    await logActivity({
      app: "sheets",
      kind: "created",
      entityId: sheet.id,
      entityTitle: sheet.title,
      actor: actorFromUser(user),
    })
    return NextResponse.json({ sheet: { ...toMeta(sheet), data: "{}" } }, { status: 201 })
  } catch (e) {
    console.error("POST /api/sheets failed:", e)
    return NextResponse.json({ error: "Failed to create sheet" }, { status: 500 })
  }
}
