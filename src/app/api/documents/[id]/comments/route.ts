import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

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

// GET /api/documents/:id/comments — threaded comment list
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

// POST /api/documents/:id/comments — create a comment (or reply when parentId set)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
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
    if (!body.authorId || !body.authorName) {
      return NextResponse.json({ error: "Author identity is required" }, { status: 400 })
    }

    const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
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
        authorId: body.authorId,
        authorName: body.authorName.slice(0, 60),
        authorColor: body.authorColor ?? "#0e7c74",
        quote: (body.quote ?? "").slice(0, 400),
        anchorOffset: Math.max(0, Math.floor(body.anchorOffset ?? 0)),
        content: text,
      },
      include: { replies: { include: { reactions: true } }, reactions: true },
    })

    return NextResponse.json({ comment: serialize(created) }, { status: 201 })
  } catch (e) {
    console.error("POST comment failed:", e)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
