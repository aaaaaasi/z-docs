import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity, logActivityThrottled } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

function serialize(f: {
  id: string
  title: string
  description: string
  data: string
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
    data: f.data,
    starred: f.starred,
    trashed: f.trashed,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    responseCount: f._count?.responses ?? 0,
  }
}

// GET /api/forms/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const form = await db.form.findUnique({
      where: { id },
      include: { _count: { select: { responses: true } } },
    })
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ form: serialize(form) })
  } catch (e) {
    console.error("GET /api/forms/[id] failed:", e)
    return NextResponse.json({ error: "Failed to load form" }, { status: 500 })
  }
}

// PATCH /api/forms/:id — { title?, description?, data?, starred?, trashed? }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      description?: string
      data?: string
      starred?: boolean
      trashed?: boolean
    }
    const before = await db.form.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: {
      title?: string
      description?: string
      data?: string
      starred?: boolean
      trashed?: boolean
    } = {}
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 120) || before.title
    if (typeof body.description === "string") data.description = body.description.slice(0, 400)
    if (typeof body.data === "string") data.data = body.data
    if (typeof body.starred === "boolean") data.starred = body.starred
    if (typeof body.trashed === "boolean") data.trashed = body.trashed

    const form = await db.form.update({
      where: { id },
      data,
      include: { _count: { select: { responses: true } } },
    })
    const actor = actorFromRequest(req)

    if (data.trashed !== undefined && data.trashed !== before.trashed) {
      await logActivity({
        app: "forms",
        kind: data.trashed ? "trashed" : "restored",
        entityId: id,
        entityTitle: form.title,
        actor,
      })
    } else if (data.starred !== undefined && data.starred !== before.starred) {
      await logActivity({
        app: "forms",
        kind: data.starred ? "starred" : "unstarred",
        entityId: id,
        entityTitle: form.title,
        actor,
      })
    } else if (data.title !== undefined && data.title !== before.title) {
      await logActivity({
        app: "forms",
        kind: "renamed",
        entityId: id,
        entityTitle: data.title,
        detail: `renamed from “${before.title}”`,
        actor,
      })
    } else if (data.data !== undefined && data.data !== before.data) {
      await logActivityThrottled(10, {
        app: "forms",
        kind: "edited",
        entityId: id,
        entityTitle: form.title,
        detail: "edited questions",
        actor,
      })
    }

    return NextResponse.json({ form: serialize(form) })
  } catch (e) {
    console.error("PATCH /api/forms/[id] failed:", e)
    return NextResponse.json({ error: "Failed to update form" }, { status: 500 })
  }
}

// DELETE /api/forms/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const form = await db.form.findUnique({ where: { id } })
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.form.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/forms/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete form" }, { status: 500 })
  }
}
