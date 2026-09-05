import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// DELETE /api/tags/:id — remove a tag; its document links cascade away
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response

    const existing = await db.tag.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true } })
    if (!existing || existing.ownerId !== guard.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db.tag.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/tags/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
  }
}
