import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/server-activity"
import { guardRoute, docAccessLevel, hasAccess, notFound, forbidden } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

function serialize(c: {
  id: string
  docId: string
  parentId: string | null
  authorId: string
  authorName: string
  authorColor: string
  quote: string
  anchorOffset: number
  content: string
  resolved: boolean
  createdAt: Date
  updatedAt: Date
  replies?: unknown[]
  reactions?: { id: string; commentId: string; userId: string; userName: string; emoji: string }[]
}) {
  return {
    id: c.id,
    docId: c.docId,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.authorName,
    authorColor: c.authorColor,
    quote: c.quote,
    anchorOffset: c.anchorOffset,
    content: c.content,
    resolved: c.resolved,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    replies: (c.replies ?? []).map((r) => serialize(r as typeof c)),
    reactions: (c.reactions ?? []).map((rx) => ({
      id: rx.id,
      commentId: rx.commentId,
      userId: rx.userId,
      userName: rx.userName,
      emoji: rx.emoji,
    })),
  }
}

// GET /api/documents/:id/comments — threaded comment list, viewer+
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (!hasAccess(level, "viewer")) return notFound()

    const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const comments = await db.comment.findMany({
      where: { docId: id, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        replies: { orderBy: { createdAt: "asc" }, include: { reactions: true } },
        reactions: { orderBy: { createdAt: "asc" } },
      },
    })

    return NextResponse.json({ comments: comments.map(serialize) })
  } catch (e) {
    console.error("GET comments failed:", e)
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
  }
}

// POST /api/documents/:id/comments — create a comment (or reply when parentId set), editor+.
// The author identity is taken from the session user (server-side truth);
// any authorId/authorName/authorColor in the body is ignored.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const { user } = guard
    const level = await docAccessLevel(user, id)
    if (level === "none") return notFound()
    if (!hasAccess(level, "editor")) return forbidden()

    const body = (await req.json().catch(() => ({}))) as {
      content?: string
      quote?: string
      anchorOffset?: number
      parentId?: string | null
      authorId?: string
      authorName?: string
      authorColor?: string
    }

    const text = (body.content ?? "").trim()
    if (!text) return NextResponse.json({ error: "Comment text is required" }, { status: 400 })
    if (text.length > 2000) return NextResponse.json({ error: "Comment is too long" }, { status: 400 })

    const doc = await db.document.findUnique({ where: { id }, select: { id: true, title: true } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (body.parentId) {
      const parent = await db.comment.findUnique({
        where: { id: body.parentId },
        select: { id: true, docId: true },
      })
      if (!parent || parent.docId !== id) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 })
      }
    }

    const created = await db.comment.create({
      data: {
        docId: id,
        parentId: body.parentId ?? null,
        authorId: user.id,
        authorName: user.name.slice(0, 60),
        authorColor: user.color.slice(0, 32),
        quote: (body.quote ?? "").slice(0, 400),
        anchorOffset: Math.max(0, Math.floor(body.anchorOffset ?? 0)),
        content: text,
      },
      include: { replies: { include: { reactions: true } }, reactions: true },
    })
    await logActivity({
      app: "docs",
      kind: "commented",
      entityId: id,
      entityTitle: doc.title,
      detail: body.parentId ? "replied to a comment" : text.slice(0, 80),
      actor: { id: user.id, name: user.name.slice(0, 60), color: user.color.slice(0, 32) },
    })

    return NextResponse.json({ comment: serialize(created) }, { status: 201 })
  } catch (e) {
    console.error("POST comment failed:", e)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
