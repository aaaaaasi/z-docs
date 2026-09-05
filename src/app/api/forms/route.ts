import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, type SessionUser } from "@/lib/server-auth"
import { logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

/** Activity actor comes from the verified session, never client headers. */
function actorFromUser(user: SessionUser) {
  return { id: user.id, name: user.name, color: user.color }
}

function toMeta(f: {
  id: string
  title: string
  description: string
  starred: boolean
  trashed: boolean
  createdAt: Date
  updatedAt: Date
  _count?: { responses: number }
}) {
  return {
    id: f.id,
    title: f.title,
    description: f.description,
    starred: f.starred,
    trashed: f.trashed,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    responseCount: f._count?.responses ?? 0,
  }
}

// GET /api/forms?filter=all|starred|trashed
// Auth required. Members see only their own + legacy (ownerless) forms;
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
    const forms = await db.form.findMany({
      where: where as never,
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { responses: true } } },
    })
    return NextResponse.json({ forms: forms.map(toMeta) })
  } catch (e) {
    console.error("GET /api/forms failed:", e)
    return NextResponse.json({ error: "Failed to load forms" }, { status: 500 })
  }
}

// POST /api/forms — { title?, description?, data? }
// Auth required; the form is owned by the creating account.
export async function POST(req: NextRequest) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response
    const user = g.user

    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      description?: string
      data?: string
    }
    const title = (body.title ?? "").trim().slice(0, 120) || "Untitled form"
    const form = await db.form.create({
      data: {
        title,
        description: (body.description ?? "").slice(0, 400),
        data: body.data ?? "[]",
        ownerId: user.id,
      },
    })
    await logActivity({
      app: "forms",
      kind: "created",
      entityId: form.id,
      entityTitle: form.title,
      actor: actorFromUser(user),
    })
    return NextResponse.json({ form: { ...toMeta(form), data: "[]" } }, { status: 201 })
  } catch (e) {
    console.error("POST /api/forms failed:", e)
    return NextResponse.json({ error: "Failed to create form" }, { status: 500 })
  }
}
