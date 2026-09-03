import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// PATCH /api/comments/:id — resolve/unresolve or edit text
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as { resolved?: boolean; content?: string }

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
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.comment.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.comment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE comment failed:", e)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
