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

function serialize(s: {
  id: string
  title: string
  data: string
  starred: boolean
  trashed: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: s.id,
    title: s.title,
    data: s.data,
    starred: s.starred,
    trashed: s.trashed,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

// GET /api/sheets/:id — owner/admin/legacy-viewer only; 404 hides existence
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req)
    if (!g.ok) return g.response

    const { id } = await params
    const level = await ownedAccessLevel(g.user, "sheet", id)
    if (level === "none") return NextResponse.json({ error: "Not found" }, { status: 404 })

    const sheet = await db.sheet.findUnique({ where: { id } })
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ sheet: serialize(sheet) })
  } catch (e) {
    console.error("GET /api/sheets/[id] failed:", e)
    return NextResponse.json({ error: "Failed to load sheet" }, { status: 500 })
  }
}

// PATCH /api/sheets/:id — { title?, data?, starred?, trashed? }
// Owner/admin only (server-enforced); 404 for strangers, 403 for viewers.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response
    const user = g.user

    const { id } = await params
    const level = await ownedAccessLevel(user, "sheet", id)
    if (level === "none") {
      // 404 for ids that don't exist; explicit 403 when the sheet exists
      // but belongs to someone else (sheet ids are unguessable cuids)
      const exists = await db.sheet.findUnique({ where: { id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ error: "You do not have permission to edit this sheet" }, { status: 403 })
    }
    if (!hasAccess(level, "owner")) {
      return NextResponse.json({ error: "You do not have permission to edit this sheet" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      data?: string
      starred?: boolean
      trashed?: boolean
    }
    const before = await db.sheet.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: { title?: string; data?: string; starred?: boolean; trashed?: boolean } = {}
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 120) || before.title
    if (typeof body.data === "string") data.data = body.data
    if (typeof body.starred === "boolean") data.starred = body.starred
    if (typeof body.trashed === "boolean") data.trashed = body.trashed

    const sheet = await db.sheet.update({ where: { id }, data })
    const actor = actorFromUser(user)

    if (data.trashed !== undefined && data.trashed !== before.trashed) {
      await logActivity({
        app: "sheets",
        kind: data.trashed ? "trashed" : "restored",
        entityId: id,
        entityTitle: sheet.title,
        actor,
      })
    } else if (data.starred !== undefined && data.starred !== before.starred) {
      await logActivity({
        app: "sheets",
        kind: data.starred ? "starred" : "unstarred",
        entityId: id,
        entityTitle: sheet.title,
        actor,
      })
    } else if (data.title !== undefined && data.title !== before.title) {
      await logActivity({
        app: "sheets",
        kind: "renamed",
        entityId: id,
        entityTitle: data.title,
        detail: `renamed from “${before.title}”`,
        actor,
      })
    } else if (data.data !== undefined && data.data !== before.data) {
      await logActivityThrottled(10, {
        app: "sheets",
        kind: "edited",
        entityId: id,
        entityTitle: sheet.title,
        detail: "edited cells",
        actor,
      })
    }

    return NextResponse.json({ sheet: serialize(sheet) })
  } catch (e) {
    console.error("PATCH /api/sheets/[id] failed:", e)
    return NextResponse.json({ error: "Failed to update sheet" }, { status: 500 })
  }
}

// DELETE /api/sheets/:id — permanent delete; owner/admin only.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req, { mutating: true })
    if (!g.ok) return g.response

    const { id } = await params
    const level = await ownedAccessLevel(g.user, "sheet", id)
    if (level === "none") {
      const exists = await db.sheet.findUnique({ where: { id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ error: "You do not have permission to delete this sheet" }, { status: 403 })
    }
    if (!hasAccess(level, "owner")) {
      return NextResponse.json({ error: "You do not have permission to delete this sheet" }, { status: 403 })
    }

    const sheet = await db.sheet.findUnique({ where: { id } })
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.sheet.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/sheets/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete sheet" }, { status: 500 })
  }
}
