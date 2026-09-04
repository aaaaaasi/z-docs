import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const ALLOWED_EMOJI = ["👍", "❤️", "😂", "🎉", "✅", "👀"]

// POST /api/comments/:id/reactions — toggle an emoji reaction for a user.
// Adding when absent, removing when already present (idempotent toggle).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as { emoji?: string; userId?: string; userName?: string }

    if (!body.emoji || !ALLOWED_EMOJI.includes(body.emoji)) {
      return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 })
    }
    if (!body.userId || !body.userName) {
      return NextResponse.json({ error: "User identity is required" }, { status: 400 })
    }

    const comment = await db.comment.findUnique({ where: { id }, select: { id: true } })
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const existing = await db.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId: id, userId: body.userId, emoji: body.emoji } },
      select: { id: true },
    })

    if (existing) {
      await db.commentReaction.delete({ where: { id: existing.id } })
      return NextResponse.json({ active: false, emoji: body.emoji })
    }

    await db.commentReaction.create({
      data: {
        commentId: id,
        userId: body.userId,
        userName: body.userName.slice(0, 60),
        emoji: body.emoji,
      },
    })
    return NextResponse.json({ active: true, emoji: body.emoji }, { status: 201 })
  } catch (e) {
    console.error("POST reaction failed:", e)
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 })
  }
}
