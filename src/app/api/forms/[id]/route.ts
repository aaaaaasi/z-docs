import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, ownedAccessLevel, hasAccess, type SessionUser } from "@/lib/server-auth"
import { logActivity, logActivityThrottled } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Activity actor comes from the verified session, never client headers. */
function actorFromUser(user: SessionUser) {
  return { id: user.id, name: user.name, color: user.color }
}

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

// GET /api/forms/:id — owner/admin/legacy-viewer only; 404 hides existence.
// (Anonymous respondents go through the dedicated fill/submit flow, not here.)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req)
    if (!g.ok) return g.response

    const { id } = await params
    const level = await ownedAccessLevel(g.user, "form", id)
    if (level === "none") return NextResponse.json({ error: "Not found" }, { status: 404 })

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
// Owner/admin only (server-enforced); 404 for strangers, 403 for viewers.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response
    const user = g.user

    const { id } = await params
    const level = await ownedAccessLevel(user, "form", id)
    if (level === "none") {
      // 404 for ids that don't exist; explicit 403 when the form exists
      // but belongs to someone else (form ids are unguessable cuids)
      const exists = await db.form.findUnique({ where: { id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ error: "You do not have permission to edit this form" }, { status: 403 })
    }
    if (!hasAccess(level, "owner")) {
      return NextResponse.json({ error: "You do not have permission to edit this form" }, { status: 403 })
    }

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
    const actor = actorFromUser(user)

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

// DELETE /api/forms/:id — permanent delete; owner/admin only.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response

    const { id } = await params
    const level = await ownedAccessLevel(g.user, "form", id)
    if (level === "none") {
      const exists = await db.form.findUnique({ where: { id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ error: "You do not have permission to delete this form" }, { status: 403 })
    }
    if (!hasAccess(level, "owner")) {
      return NextResponse.json({ error: "You do not have permission to delete this form" }, { status: 403 })
    }

    const form = await db.form.findUnique({ where: { id } })
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.form.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/forms/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete form" }, { status: 500 })
  }
}
