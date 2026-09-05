import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, docAccessLevel, hasAccess, notFound } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const ALLOWED_EMOJI = ["👍", "❤️", "😂", "🎉", "✅", "👀"]

// POST /api/comments/:id/reactions — toggle an emoji reaction, viewer+.
// The reacting identity is the session user; userId/userName in the body are ignored.
// Adding when absent, removing when already present (idempotent toggle).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const { user } = guard

    const body = (await req.json().catch(() => ({}))) as { emoji?: string; userId?: string; userName?: string }

    if (!body.emoji || !ALLOWED_EMOJI.includes(body.emoji)) {
      return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 })
    }

    const comment = await db.comment.findUnique({ where: { id }, select: { id: true, docId: true } })
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const level = await docAccessLevel(user, comment.docId)
    if (!hasAccess(level, "viewer")) return notFound()

    const existing = await db.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId: id, userId: user.id, emoji: body.emoji } },
      select: { id: true },
    })

    if (existing) {
      await db.commentReaction.delete({ where: { id: existing.id } })
      return NextResponse.json({ active: false, emoji: body.emoji })
    }

    await db.commentReaction.create({
      data: {
        commentId: id,
        userId: user.id,
        userName: user.name.slice(0, 60),
        emoji: body.emoji,
      },
    })
    return NextResponse.json({ active: true, emoji: body.emoji }, { status: 201 })
  } catch (e) {
    console.error("POST reaction failed:", e)
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 })
  }
}
