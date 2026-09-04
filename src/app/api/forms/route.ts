import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

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
export async function GET(req: NextRequest) {
  try {
    const filter = req.nextUrl.searchParams.get("filter") ?? "all"
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase()
    const where: { starred?: boolean; trashed: boolean; title?: { contains: string } } = {
      trashed: filter === "trashed",
    }
    if (filter === "starred") where.starred = true
    if (q) where.title = { contains: q }
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
export async function POST(req: NextRequest) {
  try {
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
      },
    })
    await logActivity({
      app: "forms",
      kind: "created",
      entityId: form.id,
      entityTitle: form.title,
      actor: actorFromRequest(req),
    })
    return NextResponse.json({ form: { ...toMeta(form), data: "[]" } }, { status: 201 })
  } catch (e) {
    console.error("POST /api/forms failed:", e)
    return NextResponse.json({ error: "Failed to create form" }, { status: 500 })
  }
}
