import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// DELETE /api/tags/:id — remove a tag; its document links cascade away
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.tag.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.tag.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/tags/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
  }
}
