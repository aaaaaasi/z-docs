import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, docAccessLevel, hasAccess, notFound, forbidden } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Access check for a single comment: the caller needs editor+ on the parent
 * document AND must either be the comment's author or the doc owner.
 */
async function commentGuard(
  req: NextRequest,
  commentId: string,
  mutating: boolean
): Promise<{ ok: true; user: import("@/lib/server-auth").SessionUser; comment: { id: string; docId: string; authorId: string } } | { ok: false; response: Response }> {
  const guard = await guardRoute(req, mutating ? { mutating: true, limit: 60 } : {})
  if (!guard.ok) return { ok: false, response: guard.response }
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, docId: true, authorId: true },
  })
  if (!comment) return { ok: false, response: notFound() }
  const level = await docAccessLevel(guard.user, comment.docId)
  if (level === "none") return { ok: false, response: notFound() }
  if (!hasAccess(level, "editor")) return { ok: false, response: forbidden() }
  const isAuthor = comment.authorId === guard.user.id
  const isManager = level === "owner"
  if (!isAuthor && !isManager) return { ok: false, response: forbidden() }
  return { ok: true, user: guard.user, comment }
}

// PATCH /api/comments/:id — resolve/unresolve or edit text
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await commentGuard(req, id, true)
    if (!guard.ok) return guard.response

    const body = (await req.json().catch(() => ({}))) as { resolved?: boolean; content?: string }

    const existing = await db.comment.findUnique({ where: { id }, select: { id: true, parentId: true } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: { resolved?: boolean; content?: string } = {}
    if (typeof body.resolved === "boolean") data.resolved = body.resolved
    if (typeof body.content === "string") {
      const text = body.content.trim()
      if (!text) return NextResponse.json({ error: "Comment text is required" }, { status: 400 })
      data.content = text.slice(0, 2000)
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const updated = await db.comment.update({ where: { id }, data })
    return NextResponse.json({ comment: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() } })
  } catch (e) {
    console.error("PATCH comment failed:", e)
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 })
  }
}

// DELETE /api/comments/:id — delete a comment (replies cascade)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await commentGuard(req, id, true)
    if (!guard.ok) return guard.response

    const existing = await db.comment.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.comment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE comment failed:", e)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
