import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity } from "@/lib/server-activity"
import { guardRoute, docAccessLevel, hasAccess, notFound, forbidden } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

// GET /api/documents/:id/collaborators — viewer+
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (!hasAccess(level, "viewer")) return notFound()

    const collaborators = await db.collaborator.findMany({
      where: { docId: id },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({
      collaborators: collaborators.map((c) => ({
        id: c.id,
        docId: c.docId,
        email: c.email,
        name: c.name,
        color: c.color,
        role: c.role,
        createdAt: c.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("GET collaborators failed:", e)
    return NextResponse.json({ error: "Failed to load collaborators" }, { status: 500 })
  }
}

// POST /api/documents/:id/collaborators — { email, role?, name?, color? } — owner/admin only:
// inviting collaborators is the document owner's privilege.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (level === "none") return notFound()
    if (!hasAccess(level, "owner")) return forbidden()

    const body = (await req.json().catch(() => ({}))) as {
      email?: string
      role?: string
      name?: string
      color?: string
    }
    const email = (body.email ?? "").trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }
    const role = body.role === "editor" ? "editor" : "viewer"
    const doc = await db.document.findUnique({ where: { id }, select: { id: true, title: true } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const existing = await db.collaborator.findUnique({
      where: { docId_email: { docId: id, email } },
    })
    if (existing) {
      const updated = await db.collaborator.update({ where: { id: existing.id }, data: { role } })
      return NextResponse.json({ collaborator: { ...updated, createdAt: updated.createdAt.toISOString() } })
    }

    const collaborator = await db.collaborator.create({
      data: {
        docId: id,
        email,
        name: (body.name ?? email.split("@")[0]).slice(0, 60),
        color: (body.color ?? "#0b6b62").slice(0, 32),
        role,
      },
    })
    await logActivity({
      app: "docs",
      kind: "shared",
      entityId: id,
      entityTitle: doc.title,
      detail: `shared with ${email}`,
      actor: await actorFromRequest(req),
    })
    return NextResponse.json(
      { collaborator: { ...collaborator, createdAt: collaborator.createdAt.toISOString() } },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST collaborators failed:", e)
    return NextResponse.json({ error: "Failed to add collaborator" }, { status: 500 })
  }
}

// DELETE /api/documents/:id/collaborators?email=... — owner/admin only
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (level === "none") return notFound()
    if (!hasAccess(level, "owner")) return forbidden()

    const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase()
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })
    await db.collaborator.deleteMany({ where: { docId: id, email } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE collaborators failed:", e)
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 })
  }
}
