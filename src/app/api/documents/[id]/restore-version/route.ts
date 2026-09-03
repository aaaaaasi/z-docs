import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// POST /api/documents/:id/restore-version { versionId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { versionId?: string }
    if (!body.versionId) return NextResponse.json({ error: "versionId is required" }, { status: 400 })

    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const version = await db.documentVersion.findUnique({ where: { id: body.versionId } })
    if (!version || version.docId !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    // snapshot the current state before restoring
    await db.documentVersion.create({
      data: { docId: id, title: doc.title, content: doc.content },
    })

    const updated = await db.document.update({
      where: { id },
      data: { content: version.content },
    })

    return NextResponse.json({
      document: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error("POST restore-version failed:", e)
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 })
  }
}
